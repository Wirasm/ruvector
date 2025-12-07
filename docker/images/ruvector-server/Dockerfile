# RuVector Server - High-performance REST API server
# Built on top of ruvector-core with HTTP endpoint support

# Build stage
FROM rust:1.83-bookworm as builder

LABEL org.opencontainers.image.title="RuVector Server"
LABEL org.opencontainers.image.description="High-performance REST API server for Ruvector"
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

# Build the server binary
RUN cargo build --release \
    --package ruvector-server \
    --package ruvector-core \
    --package ruvector-index \
    --package ruvector-storage \
    --package ruvector-query

# Runtime stage
FROM debian:bookworm-slim

LABEL org.opencontainers.image.title="RuVector Server"
LABEL org.opencontainers.image.description="High-performance REST API server for Ruvector"
LABEL org.opencontainers.image.authors="RuVector Team"
LABEL org.opencontainers.image.source="https://github.com/ruvnet/ruvector"
LABEL org.opencontainers.image.licenses="MIT"

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash ruvector

# Copy binaries from builder
COPY --from=builder /build/target/release/ruvector-server /usr/local/bin/

# Set up data and config directories
RUN mkdir -p /var/lib/ruvector /etc/ruvector && \
    chown -R ruvector:ruvector /var/lib/ruvector /etc/ruvector

# Switch to non-root user
USER ruvector
WORKDIR /var/lib/ruvector

# Expose REST API port
EXPOSE 8080

# Expose volumes
VOLUME ["/var/lib/ruvector", "/etc/ruvector"]

# Environment variables
ENV RUVECTOR_HOST=0.0.0.0
ENV RUVECTOR_PORT=8080
ENV RUVECTOR_DATA_DIR=/var/lib/ruvector
ENV RUST_LOG=info

# Healthcheck
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Default command
ENTRYPOINT ["ruvector-server"]
CMD ["--host", "0.0.0.0", "--port", "8080"]
