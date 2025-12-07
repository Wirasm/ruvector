# RuVector Server

[![Docker Pulls](https://img.shields.io/docker/pulls/ruvnet/ruvector-server)](https://hub.docker.com/r/ruvnet/ruvector-server)
[![Docker Image Size](https://img.shields.io/docker/image-size/ruvnet/ruvector-server/latest)](https://hub.docker.com/r/ruvnet/ruvector-server)
[![Docker Image Version](https://img.shields.io/docker/v/ruvnet/ruvector-server/latest)](https://hub.docker.com/r/ruvnet/ruvector-server)
[![GitHub](https://img.shields.io/github/license/ruvnet/ruvector)](https://github.com/ruvnet/ruvector)

**High-performance REST API server for RuVector vector database.** Built on Axum with Tower middleware, providing 50,000+ RPS with CORS, compression, and health checks.

## Features

- 🌐 **REST API** - Full HTTP interface for vector operations
- ⚡ **High throughput** - 50,000+ requests per second
- 🔒 **CORS support** - Configurable cross-origin sharing
- 📦 **Gzip compression** - Automatic response compression
- 🏥 **Health checks** - Built-in /health endpoint

## Quick Start

```bash
docker run -d --name ruvector-server -p 8080:8080 ruvnet/ruvector-server:latest
curl http://localhost:8080/health
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/vectors` | Add vector |
| POST | `/search` | Search vectors |
| GET | `/vectors/:id` | Get vector |
| DELETE | `/vectors/:id` | Delete vector |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `RUVECTOR_HOST` | 0.0.0.0 | Bind address |
| `RUVECTOR_PORT` | 8080 | Server port |
| `RUST_LOG` | info | Log level |

## Related Images

- [`ruvnet/ruvector-core`](https://hub.docker.com/r/ruvnet/ruvector-core) - Core library
- [`ruvnet/ruvector-cli`](https://hub.docker.com/r/ruvnet/ruvector-cli) - CLI/MCP

## License

MIT License
