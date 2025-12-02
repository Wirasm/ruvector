# RuVector-Postgres Development & Testing Dockerfile
# Multi-stage build for PostgreSQL 16 with pgrx and all dependencies

FROM rust:1.82-bookworm AS builder

# Add PostgreSQL APT repository
RUN sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list' && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -

# Install PostgreSQL development dependencies
RUN apt-get update && apt-get install -y \
    postgresql-16 \
    postgresql-server-dev-16 \
    libclang-dev \
    clang \
    pkg-config \
    libssl-dev \
    cmake \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install pgrx (compatible with pgrx = "0.12" in Cargo.toml)
RUN cargo install cargo-pgrx --version 0.12.6 --locked

# Initialize pgrx for PostgreSQL 16
RUN cargo pgrx init --pg16 /usr/lib/postgresql/16/bin/pg_config

# Set PGRX environment for consistent builds
ENV PGRX_PG_CONFIG_PATH=/usr/lib/postgresql/16/bin/pg_config
ENV PGRX_HOME=/root/.pgrx

# Set working directory - use /build to avoid any parent Cargo.toml issues
WORKDIR /build/ruvector-postgres

# Copy only the postgres crate - this is a standalone crate with no workspace dependencies
COPY crates/ruvector-postgres/Cargo.toml ./
COPY crates/ruvector-postgres/build.rs ./
COPY crates/ruvector-postgres/ruvector.control ./
COPY crates/ruvector-postgres/src ./src/
COPY crates/ruvector-postgres/sql ./sql/
COPY crates/ruvector-postgres/benches ./benches/

# Build the extension with all features (standalone, no workspace)
RUN cargo pgrx package \
    --pg-config /usr/lib/postgresql/16/bin/pg_config \
    --features pg16

# Runtime image
FROM postgres:16-bookworm

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy built extension from builder (updated path for /build directory)
COPY --from=builder /build/ruvector-postgres/target/release/ruvector_postgres-pg16/usr/share/postgresql/16/extension/* /usr/share/postgresql/16/extension/
COPY --from=builder /build/ruvector-postgres/target/release/ruvector_postgres-pg16/usr/lib/postgresql/16/lib/* /usr/lib/postgresql/16/lib/

# Copy initialization script
COPY crates/ruvector-postgres/docker/init.sql /docker-entrypoint-initdb.d/

# Set environment variables
ENV POSTGRES_USER=ruvector
ENV POSTGRES_PASSWORD=ruvector
ENV POSTGRES_DB=ruvector_test

# Health check
HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=5 \
    CMD pg_isready -U $POSTGRES_USER -d $POSTGRES_DB || exit 1

EXPOSE 5432
