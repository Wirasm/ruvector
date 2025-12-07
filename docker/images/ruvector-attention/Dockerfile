# RuVector Attention - 39 Attention mechanisms with geometric, graph, and sparse attention
FROM rust:1.83-bookworm as builder

LABEL maintainer="RuVector Team"
LABEL description="Attention mechanisms - geometric, graph, and sparse attention"
LABEL version="0.1.0"
LABEL org.opencontainers.image.source="https://github.com/ruvnet/ruvector"
LABEL org.opencontainers.image.description="39 attention mechanisms including MHA, GQA, MoA, and specialized variants"
LABEL org.opencontainers.image.licenses="MIT"

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    clang \
    llvm \
    libblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/

# Build with release optimizations and SIMD
ENV RUSTFLAGS="-C target-cpu=native -C opt-level=3 -C target-feature=+avx2,+fma"
RUN cargo build --release \
    -p ruvector-attention \
    --features "simd,all-attention,cuda"

# Runtime stage
FROM debian:bookworm-slim

LABEL maintainer="RuVector Team"
LABEL description="Attention mechanisms - geometric, graph, and sparse attention"
LABEL version="0.1.0"

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libblas3 \
    liblapack3 \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 ruvector

# Copy binary from builder
COPY --from=builder /build/target/release/ruvector-attention /usr/local/bin/

# Set permissions
RUN chown ruvector:ruvector /usr/local/bin/ruvector-attention

# Create model cache directory
RUN mkdir -p /cache/models && chown -R ruvector:ruvector /cache

USER ruvector
WORKDIR /cache

# Expose ports
# 8081 - HTTP API
# 50052 - gRPC
EXPOSE 8081 50052

# Environment variables
ENV RUST_LOG=info
ENV MODEL_CACHE_DIR=/cache/models

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD /usr/local/bin/ruvector-attention health || exit 1

# Default command
CMD ["/usr/local/bin/ruvector-attention", "serve", "--host", "0.0.0.0", "--port", "8081"]
