# RuVector CLI

[![Docker Pulls](https://img.shields.io/docker/pulls/ruvnet/ruvector-cli)](https://hub.docker.com/r/ruvnet/ruvector-cli)
[![Docker Image Size](https://img.shields.io/docker/image-size/ruvnet/ruvector-cli/latest)](https://hub.docker.com/r/ruvnet/ruvector-cli)
[![Docker Image Version](https://img.shields.io/docker/v/ruvnet/ruvector-cli/latest)](https://hub.docker.com/r/ruvnet/ruvector-cli)
[![GitHub](https://img.shields.io/github/license/ruvnet/ruvector)](https://github.com/ruvnet/ruvector)

**CLI and MCP server for RuVector.** Command-line interface and Model Context Protocol server for AI assistant integration with Claude, GPT, and other systems.

## Features

- 🖥️ **Full CLI** - Complete command-line management
- 🤖 **MCP Server** - AI assistant integration
- 📊 **Interactive mode** - REPL for exploration
- 📁 **File operations** - JSON, CSV, NPY formats

## Quick Start

```bash
# CLI mode
docker run --rm ruvnet/ruvector-cli:latest ruvector --help

# MCP server mode
docker run -d --name ruvector-mcp -p 3000:3000 ruvnet/ruvector-cli:latest ruvector-mcp
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize database |
| `add` | Add vectors |
| `search` | Search vectors |
| `export` | Export data |
| `bench` | Run benchmarks |
| `repl` | Interactive mode |

## MCP Integration

Configure in Claude Desktop:
```json
{
  "mcpServers": {
    "ruvector": {"url": "http://localhost:3000"}
  }
}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PORT` | 3000 | MCP server port |
| `SERVER_URL` | | RuVector server URL |

## License

MIT License
