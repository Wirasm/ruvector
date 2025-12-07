# RuVector GNN

[![Docker Pulls](https://img.shields.io/docker/pulls/ruvnet/ruvector-gnn)](https://hub.docker.com/r/ruvnet/ruvector-gnn)
[![Docker Image Size](https://img.shields.io/docker/image-size/ruvnet/ruvector-gnn/latest)](https://hub.docker.com/r/ruvnet/ruvector-gnn)
[![Docker Image Version](https://img.shields.io/docker/v/ruvnet/ruvector-gnn/latest)](https://hub.docker.com/r/ruvnet/ruvector-gnn)
[![GitHub](https://img.shields.io/github/license/ruvnet/ruvector)](https://github.com/ruvnet/ruvector)

**Graph Neural Network layer for RuVector on HNSW topology.** Enables self-learning vector search achieving 8.2x faster search with 18% less memory through intelligent graph-based learning.

## Features

- 🧠 **Self-learning search** - Results improve automatically
- 📈 **8.2x faster search** - GNN-optimized HNSW traversal
- 💾 **18% less memory** - Learned compression patterns
- 🔧 **Multiple architectures** - GCN, GraphSAGE, GAT, GIN

## Quick Start

```bash
docker run -d --name ruvector-gnn -p 8081:8081 ruvnet/ruvector-gnn:latest
curl http://localhost:8081/health
```

## GNN Architectures

| Architecture | Best For |
|--------------|----------|
| **GCN** | General graphs |
| **GraphSAGE** | Large graphs |
| **GAT** | Attention-based |
| **GIN** | High expressiveness |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GNN_PORT` | 8081 | Service port |
| `MODEL_PATH` | /var/lib/ruvector/models | Model storage |
| `CUDA_VISIBLE_DEVICES` | (empty) | GPU IDs |

## Performance

| Metric | Without GNN | With GNN |
|--------|-------------|----------|
| Search Speed | 61µs | 7.4µs (8.2x) |
| Memory | 200MB/1M | 164MB/1M (-18%) |

## License

MIT License
