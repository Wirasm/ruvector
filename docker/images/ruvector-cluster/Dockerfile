# RuVector Cluster - Distributed clustering and sharding with Raft consensus
FROM rust:1.83-bookworm as builder

LABEL maintainer="RuVector Team"
LABEL description="Distributed clustering and sharding for ruvector"
LABEL version="0.1.0"
LABEL org.opencontainers.image.source="https://github.com/ruvnet/ruvector"
LABEL org.opencontainers.image.description="Multi-node clustering with automatic sharding and Raft consensus"
LABEL org.opencontainers.image.licenses="MIT"

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    clang \
    llvm \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/

# Build with release optimizations
ENV RUSTFLAGS="-C target-cpu=native -C opt-level=3"
RUN cargo build --release \
    -p ruvector-cluster \
    -p ruvector-raft \
    --features "distributed,raft,auto-shard"

# Runtime stage
FROM debian:bookworm-slim

LABEL maintainer="RuVector Team"
LABEL description="Distributed clustering and sharding for ruvector"
LABEL version="0.1.0"

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 ruvector

# Copy binaries from builder
COPY --from=builder /build/target/release/ruvector-cluster /usr/local/bin/
COPY --from=builder /build/target/release/ruvector-raft /usr/local/bin/

# Set permissions
RUN chown ruvector:ruvector /usr/local/bin/ruvector-cluster /usr/local/bin/ruvector-raft

# Create data and config directories
RUN mkdir -p /data /config && chown -R ruvector:ruvector /data /config

USER ruvector
WORKDIR /data

# Expose ports
# 8082 - HTTP API
# 7000 - Cluster communication
# 7001 - Raft consensus
# 7002 - Gossip protocol
EXPOSE 8082 7000 7001 7002

# Environment variables
ENV RUST_LOG=info
ENV CLUSTER_DATA_DIR=/data
ENV CLUSTER_CONFIG_DIR=/config

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD /usr/local/bin/ruvector-cluster health || exit 1

# Default command
CMD ["/usr/local/bin/ruvector-cluster", "serve", \
     "--host", "0.0.0.0", \
     "--port", "8082", \
     "--cluster-port", "7000", \
     "--raft-port", "7001"]
