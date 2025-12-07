# RuVector CLI & MCP Server - Command-line interface and Model Context Protocol server
# Includes both ruvector CLI and ruvector-mcp server binaries

# Build stage
FROM rust:1.83-bookworm as builder

LABEL org.opencontainers.image.title="RuVector CLI & MCP"
LABEL org.opencontainers.image.description="CLI and MCP server for Ruvector"
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

# Build with release optimizations
ENV RUSTFLAGS="-C target-cpu=native -C opt-level=3 -C lto=fat -C codegen-units=1"

# Build CLI and MCP server binaries
RUN cargo build --release \
    --package ruvector \
    --package ruvector-mcp \
    --package ruvector-core \
    --package ruvector-index \
    --package ruvector-storage \
    --package ruvector-query

# Runtime stage
FROM debian:bookworm-slim

LABEL org.opencontainers.image.title="RuVector CLI & MCP"
LABEL org.opencontainers.image.description="CLI and MCP server for Ruvector"
LABEL org.opencontainers.image.authors="RuVector Team"
LABEL org.opencontainers.image.source="https://github.com/ruvnet/ruvector"
LABEL org.opencontainers.image.licenses="MIT"

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    jq \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash ruvector

# Copy binaries from builder
COPY --from=builder /build/target/release/ruvector /usr/local/bin/
COPY --from=builder /build/target/release/ruvector-mcp /usr/local/bin/

# Set up data and config directories
RUN mkdir -p /var/lib/ruvector /etc/ruvector /home/ruvector/.config/ruvector && \
    chown -R ruvector:ruvector /var/lib/ruvector /etc/ruvector /home/ruvector/.config

# Switch to non-root user
USER ruvector
WORKDIR /home/ruvector

# Expose MCP server port (optional, for TCP mode)
EXPOSE 3000

# Expose volumes
VOLUME ["/var/lib/ruvector", "/etc/ruvector", "/home/ruvector/.config/ruvector"]

# Environment variables
ENV RUVECTOR_DATA_DIR=/var/lib/ruvector
ENV RUVECTOR_CONFIG_DIR=/etc/ruvector
ENV RUST_LOG=info

# Healthcheck for MCP server mode
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD pgrep -x ruvector-mcp > /dev/null || pgrep -x ruvector > /dev/null || exit 1

# Default command shows help
ENTRYPOINT ["ruvector"]
CMD ["--help"]
