# RuVector Attention

[![Docker Pulls](https://img.shields.io/docker/pulls/ruvnet/ruvector-attention)](https://hub.docker.com/r/ruvnet/ruvector-attention)
[![Docker Image Size](https://img.shields.io/docker/image-size/ruvnet/ruvector-attention/latest)](https://hub.docker.com/r/ruvnet/ruvector-attention)
[![Docker Image Version](https://img.shields.io/docker/v/ruvnet/ruvector-attention/latest)](https://hub.docker.com/r/ruvnet/ruvector-attention)
[![GitHub](https://img.shields.io/github/license/ruvnet/ruvector)](https://github.com/ruvnet/ruvector)

**39 attention mechanisms for geometric, graph, and sparse attention.** Includes MHA, GQA, MoA, and specialized variants with SIMD acceleration.

## Features

- 🎯 **39 attention types** - MHA, GQA, MoA, and more
- 🔢 **Geometric attention** - Hyperbolic, Euclidean, Lorentz
- 📊 **Graph attention** - GAT, GATv2, edge attention
- ⚡ **SIMD + BLAS** - AVX2, FMA, NEON acceleration

## Quick Start

```bash
docker run -d --name ruvector-attention -p 8083:8083 ruvnet/ruvector-attention:latest
```

## Attention Types

| Type | Description | Complexity |
|------|-------------|------------|
| MHA | Multi-Head | O(n²d) |
| GQA | Grouped Query | O(n²d/g) |
| Flash | Memory-efficient | O(n) |
| Sparse | Block sparse | O(n√n d) |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ATTENTION_PORT` | 8083 | Service port |
| `ATTENTION_HEADS` | 8 | Default heads |
| `FLASH_ATTENTION` | true | Enable Flash |

## License

MIT License
