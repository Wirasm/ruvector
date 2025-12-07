# RuVector Graph - Distributed Neo4j-compatible hypergraph database with SIMD optimization
FROM rust:1.83-bookworm as builder

LABEL maintainer="RuVector Team"
LABEL description="Distributed Neo4j-compatible hypergraph database with SIMD optimization"
LABEL version="0.1.0"
LABEL org.opencontainers.image.source="https://github.com/ruvnet/ruvector"
LABEL org.opencontainers.image.description="Graph database with Cypher queries and graph algorithms"
LABEL org.opencontainers.image.licenses="MIT"

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    clang \
    llvm \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/

# Build with release optimizations
ENV RUSTFLAGS="-C target-cpu=native -C opt-level=3"
RUN cargo build --release \
    -p ruvector-graph \
    --features "simd,distributed,cypher"

# Runtime stage
FROM debian:bookworm-slim

LABEL maintainer="RuVector Team"
LABEL description="Distributed Neo4j-compatible hypergraph database with SIMD optimization"
LABEL version="0.1.0"

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 ruvector

# Copy binary from builder
COPY --from=builder /build/target/release/ruvector-graph /usr/local/bin/

# Set permissions
RUN chown ruvector:ruvector /usr/local/bin/ruvector-graph

# Create data directory
RUN mkdir -p /data && chown ruvector:ruvector /data

USER ruvector
WORKDIR /data

# Expose ports
# 7474 - HTTP
# 7687 - Bolt protocol
EXPOSE 7474 7687

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /usr/local/bin/ruvector-graph health || exit 1

# Default command
CMD ["/usr/local/bin/ruvector-graph", "serve", "--host", "0.0.0.0"]
