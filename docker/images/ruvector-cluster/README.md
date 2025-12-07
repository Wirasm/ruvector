# RuVector Cluster

[![Docker Pulls](https://img.shields.io/docker/pulls/ruvnet/ruvector-cluster)](https://hub.docker.com/r/ruvnet/ruvector-cluster)
[![Docker Image Size](https://img.shields.io/docker/image-size/ruvnet/ruvector-cluster/latest)](https://hub.docker.com/r/ruvnet/ruvector-cluster)
[![Docker Image Version](https://img.shields.io/docker/v/ruvnet/ruvector-cluster/latest)](https://hub.docker.com/r/ruvnet/ruvector-cluster)
[![GitHub](https://img.shields.io/github/license/ruvnet/ruvector)](https://github.com/ruvnet/ruvector)

**Distributed clustering and sharding with Raft consensus.** Enables horizontal scaling across multiple nodes with automatic sharding, leader election, and fault tolerance.

## Features

- 🔗 **Raft consensus** - Strong consistency
- 📊 **Automatic sharding** - Distribute data
- 🔄 **Leader election** - Automatic failover
- 🛡️ **Fault tolerance** - Survive node failures

## Quick Start

```bash
# Leader node
docker run -d --name ruvector-cluster-1 \
  -p 8084:8084 -p 9000:9000 \
  -e CLUSTER_NODE_ID=node-1 \
  -e CLUSTER_MODE=leader \
  ruvnet/ruvector-cluster:latest

# Follower
docker run -d --name ruvector-cluster-2 \
  -e CLUSTER_NODE_ID=node-2 \
  -e CLUSTER_SEED_NODES=ruvector-cluster-1:9000 \
  ruvnet/ruvector-cluster:latest
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLUSTER_NODE_ID` | node-1 | Node identifier |
| `CLUSTER_PORT` | 8084 | HTTP API |
| `RAFT_PORT` | 9000 | Raft consensus |
| `REPLICATION_FACTOR` | 3 | Replicas per shard |

## Performance

| Nodes | Write Latency | Read Latency |
|-------|---------------|--------------|
| 3 | 5ms | 1ms |
| 5 | 7ms | 1ms |
| 7 | 10ms | 1ms |

## License

MIT License
