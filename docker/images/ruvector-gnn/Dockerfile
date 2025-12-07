# RuVector GNN - Graph Neural Network layer for HNSW topology
# Advanced graph analytics and neural network capabilities on vector indices

# Build stage
FROM rust:1.83-bookworm as builder

LABEL org.opencontainers.image.title="RuVector GNN"
LABEL org.opencontainers.image.description="Graph Neural Network layer for Ruvector on HNSW topology"
LABEL org.opencontainers.image.authors="RuVector Team"
LABEL org.opencontainers.image.source="https://github.com/ruvnet/ruvector"
LABEL org.opencontainers.image.licenses="MIT"

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy workspace configuration
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates

# Build with release optimizations and SIMD support
ENV RUSTFLAGS="-C target-cpu=native -C opt-level=3 -C lto=fat -C codegen-units=1"

# Build GNN engine and dependencies
RUN cargo build --release \
    --package ruvector-gnn \
    --package ruvector-core \
    --package ruvector-index \
    --package ruvector-storage \
    --package ruvector-query

# Runtime stage
FROM debian:bookworm-slim

LABEL org.opencontainers.image.title="RuVector GNN"
LABEL org.opencontainers.image.description="Graph Neural Network layer for Ruvector on HNSW topology"
LABEL org.opencontainers.image.authors="RuVector Team"
LABEL org.opencontainers.image.source="https://github.com/ruvnet/ruvector"
LABEL org.opencontainers.image.licenses="MIT"

# Install runtime dependencies including BLAS/LAPACK for numerical operations
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libblas3 \
    liblapack3 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash ruvector

# Copy binaries from builder
COPY --from=builder /build/target/release/ruvector-gnn /usr/local/bin/

# Set up data, models, and cache directories
RUN mkdir -p /var/lib/ruvector/data \
    /var/lib/ruvector/models \
    /var/lib/ruvector/cache \
    /etc/ruvector && \
    chown -R ruvector:ruvector /var/lib/ruvector /etc/ruvector

# Switch to non-root user
USER ruvector
WORKDIR /var/lib/ruvector

# Expose GNN service port
EXPOSE 8081

# Expose volumes
VOLUME ["/var/lib/ruvector/data", "/var/lib/ruvector/models", "/etc/ruvector"]

# Environment variables
ENV RUVECTOR_GNN_HOST=0.0.0.0
ENV RUVECTOR_GNN_PORT=8081
ENV RUVECTOR_DATA_DIR=/var/lib/ruvector/data
ENV RUVECTOR_MODEL_DIR=/var/lib/ruvector/models
ENV RUVECTOR_CACHE_DIR=/var/lib/ruvector/cache
ENV RUST_LOG=info
ENV OMP_NUM_THREADS=4

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8081/health || exit 1

# Default command
ENTRYPOINT ["ruvector-gnn"]
CMD ["--host", "0.0.0.0", "--port", "8081"]
