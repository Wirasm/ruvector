# RuVector Graph

[![Docker Pulls](https://img.shields.io/docker/pulls/ruvnet/ruvector-graph)](https://hub.docker.com/r/ruvnet/ruvector-graph)
[![Docker Image Size](https://img.shields.io/docker/image-size/ruvnet/ruvector-graph/latest)](https://hub.docker.com/r/ruvnet/ruvector-graph)
[![Docker Image Version](https://img.shields.io/docker/v/ruvnet/ruvector-graph/latest)](https://hub.docker.com/r/ruvnet/ruvector-graph)
[![GitHub](https://img.shields.io/github/license/ruvnet/ruvector)](https://github.com/ruvnet/ruvector)

**Distributed Neo4j-compatible hypergraph database with SIMD optimization.** Combines vector similarity search with Cypher queries for powerful knowledge graphs.

## Features

- 🔗 **Cypher queries** - Neo4j-compatible syntax
- 🌐 **Bolt protocol** - Standard graph protocol (port 7687)
- 📊 **Hypergraph support** - Multi-edge relationships
- ⚡ **SIMD optimization** - Hardware-accelerated traversal

## Quick Start

```bash
docker run -d --name ruvector-graph \
  -p 7687:7687 -p 7474:7474 \
  ruvnet/ruvector-graph:latest
```

## Example Queries

```cypher
CREATE (a:Person {name: 'Alice', embedding: [0.1, 0.2, ...]})
MATCH (a:Person)-[:KNOWS]->(b) RETURN b.name
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BOLT_PORT` | 7687 | Bolt protocol |
| `HTTP_PORT` | 7474 | HTTP API |
| `NEO4J_AUTH` | none | Authentication |

## License

MIT License
