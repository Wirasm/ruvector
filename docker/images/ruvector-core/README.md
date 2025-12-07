# RuVector Core

[![Docker Pulls](https://img.shields.io/docker/pulls/ruvnet/ruvector-core)](https://hub.docker.com/r/ruvnet/ruvector-core)
[![Docker Image Size](https://img.shields.io/docker/image-size/ruvnet/ruvector-core/latest)](https://hub.docker.com/r/ruvnet/ruvector-core)
[![Docker Image Version](https://img.shields.io/docker/v/ruvnet/ruvector-core/latest)](https://hub.docker.com/r/ruvnet/ruvector-core)
[![GitHub](https://img.shields.io/github/license/ruvnet/ruvector)](https://github.com/ruvnet/ruvector)

**High-performance vector database core with HNSW indexing and SIMD acceleration.** RuVector Core is the foundational engine powering all RuVector services, providing ultra-fast vector similarity search with 61µs latency and adaptive compression that reduces memory usage by 5-15x.

## Features

- 🚀 **61µs p50 latency** - 30-800x faster than alternatives
- 💾 **200MB per 1M vectors** - Adaptive compression (2-32x reduction)
- 🔧 **HNSW indexing** - Hierarchical Navigable Small World graphs
- ⚡ **SIMD acceleration** - AVX-512, AVX2, NEON support
- 📊 **Multiple distance metrics** - L2, Cosine, Inner Product, Manhattan
- 🔄 **Zero-copy operations** - Memory-mapped file support
- 🛡️ **Production-ready** - Non-root user, health checks, proper signals

## Quick Start

```bash
# Run RuVector Core
docker run -d \
  --name ruvector-core \
  -v ruvector-data:/var/lib/ruvector \
  ruvnet/ruvector-core:latest

# Check status
docker exec ruvector-core ruvector status
```

## Usage Examples

### Create a Vector Index

```bash
docker run -v ruvector-data:/var/lib/ruvector ruvnet/ruvector-core:latest \
  ruvector init --dimensions 1536 --metric cosine
```

### Search Vectors

```bash
docker run -v ruvector-data:/var/lib/ruvector ruvnet/ruvector-core:latest \
  ruvector search --query "[0.1, 0.2, ...]" --top-k 10
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VECTOR_DIMENSION` | 1536 | Default vector dimensions |
| `RUST_LOG` | info | Log level |
| `HNSW_M` | 16 | HNSW max connections |
| `HNSW_EF_CONSTRUCTION` | 200 | HNSW construction parameter |

## Performance

| Metric | Value |
|--------|-------|
| **p50 Latency** | 61µs |
| **Memory (1M vectors)** | 200MB |
| **SIMD Support** | AVX-512, AVX2, NEON |

## Related Images

- [`ruvnet/ruvector`](https://hub.docker.com/r/ruvnet/ruvector) - Complete platform
- [`ruvnet/ruvector-server`](https://hub.docker.com/r/ruvnet/ruvector-server) - REST API
- [`ruvnet/ruvector-gnn`](https://hub.docker.com/r/ruvnet/ruvector-gnn) - Graph Neural Networks

## Links

- [GitHub](https://github.com/ruvnet/ruvector)
- [crates.io](https://crates.io/crates/ruvector-core)

## License

MIT License
