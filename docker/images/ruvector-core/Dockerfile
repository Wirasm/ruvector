# RuVector Core - High-performance vector database engine with HNSW indexing
# Multi-stage build for optimized binary size and security

# Build stage
FROM rust:1.83-bookworm as builder

LABEL org.opencontainers.image.title="RuVector Core"
LABEL org.opencontainers.image.description="High-performance vector database core with HNSW indexing"
LABEL org.opencontainers.image.authors="RuVector Team"
LABEL org.opencontainers.image.source="https://github.com/ruvnet/ruvector"
LABEL org.opencontainers.image.licenses="MIT"

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy workspace configuration
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates

# Build with release optimizations and SIMD support
ENV RUSTFLAGS="-C target-cpu=native -C opt-level=3 -C lto=fat -C codegen-units=1"

# Build the core library and CLI
RUN cargo build --release \
    --package ruvector \
    --package ruvector-core \
    --package ruvector-index \
    --package ruvector-storage \
    --package ruvector-query

# Runtime stage
FROM debian:bookworm-slim

LABEL org.opencontainers.image.title="RuVector Core"
LABEL org.opencontainers.image.description="High-performance vector database core with HNSW indexing"
LABEL org.opencontainers.image.authors="RuVector Team"
LABEL org.opencontainers.image.source="https://github.com/ruvnet/ruvector"
LABEL org.opencontainers.image.licenses="MIT"

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash ruvector

# Copy binaries from builder
COPY --from=builder /build/target/release/ruvector /usr/local/bin/

# Set up data directory
RUN mkdir -p /var/lib/ruvector && \
    chown -R ruvector:ruvector /var/lib/ruvector

# Switch to non-root user
USER ruvector
WORKDIR /var/lib/ruvector

# Expose volume for persistent data
VOLUME ["/var/lib/ruvector"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ruvector status || exit 1

# Default command
ENTRYPOINT ["ruvector"]
CMD ["--help"]
