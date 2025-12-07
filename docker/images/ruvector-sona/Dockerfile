# RuVector SONA - Self-Optimizing Neural Architecture with runtime-adaptive learning
FROM rust:1.83-bookworm as builder

LABEL maintainer="RuVector Team"
LABEL description="Self-Optimizing Neural Architecture - Runtime-adaptive learning"
LABEL version="0.1.0"
LABEL org.opencontainers.image.source="https://github.com/ruvnet/ruvector"
LABEL org.opencontainers.image.description="Self-learning module with LoRA, EWC++, and ReasoningBank"
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
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/

# Build with release optimizations and ML features
ENV RUSTFLAGS="-C target-cpu=native -C opt-level=3 -C target-feature=+avx2,+fma"
RUN cargo build --release \
    -p ruvector-sona \
    --features "lora,ewc,reasoning-bank,meta-learning,auto-tune"

# Runtime stage
FROM debian:bookworm-slim

LABEL maintainer="RuVector Team"
LABEL description="Self-Optimizing Neural Architecture - Runtime-adaptive learning"
LABEL version="0.1.0"

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libblas3 \
    liblapack3 \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for advanced features
RUN pip3 install --no-cache-dir \
    numpy \
    scipy \
    scikit-learn

# Create app user
RUN useradd -m -u 1000 ruvector

# Copy binary from builder
COPY --from=builder /build/target/release/ruvector-sona /usr/local/bin/

# Set permissions
RUN chown ruvector:ruvector /usr/local/bin/ruvector-sona

# Create directories for models, checkpoints, and reasoning bank
RUN mkdir -p /models /checkpoints /reasoning-bank && \
    chown -R ruvector:ruvector /models /checkpoints /reasoning-bank

USER ruvector
WORKDIR /models

# Expose ports
# 8083 - HTTP API
# 50053 - gRPC
# 8084 - Metrics/monitoring
EXPOSE 8083 50053 8084

# Environment variables
ENV RUST_LOG=info
ENV SONA_MODEL_DIR=/models
ENV SONA_CHECKPOINT_DIR=/checkpoints
ENV SONA_REASONING_BANK_DIR=/reasoning-bank
ENV SONA_AUTO_TUNE=true
ENV SONA_LEARNING_RATE=0.001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD /usr/local/bin/ruvector-sona health || exit 1

# Default command with auto-tuning enabled
CMD ["/usr/local/bin/ruvector-sona", "serve", \
     "--host", "0.0.0.0", \
     "--port", "8083", \
     "--auto-tune", \
     "--enable-lora", \
     "--enable-ewc", \
     "--enable-reasoning-bank"]
