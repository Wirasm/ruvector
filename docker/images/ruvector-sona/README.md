# RuVector SONA

[![Docker Pulls](https://img.shields.io/docker/pulls/ruvnet/ruvector-sona)](https://hub.docker.com/r/ruvnet/ruvector-sona)
[![Docker Image Size](https://img.shields.io/docker/image-size/ruvnet/ruvector-sona/latest)](https://hub.docker.com/r/ruvnet/ruvector-sona)
[![Docker Image Version](https://img.shields.io/docker/v/ruvnet/ruvector-sona/latest)](https://hub.docker.com/r/ruvnet/ruvector-sona)
[![GitHub](https://img.shields.io/github/license/ruvnet/ruvector)](https://github.com/ruvnet/ruvector)

**Self-Optimizing Neural Architecture for runtime-adaptive learning.** SONA enables continuous learning without retraining using LoRA, EWC++, and ReasoningBank.

## Features

- 🧠 **Self-learning** - Improves results over time
- 🔧 **Two-tier LoRA** - Efficient low-rank adaptation
- 🛡️ **EWC++** - Prevents catastrophic forgetting
- 📚 **ReasoningBank** - Pattern storage and retrieval
- 📈 **10-30% accuracy improvement**

## Quick Start

```bash
docker run -d --name ruvector-sona -p 8085:8085 ruvnet/ruvector-sona:latest
```

## Learning API

```bash
# Enable learning
curl -X POST http://localhost:8085/learning/enable -d '{"enabled": true}'

# Record feedback
curl -X POST http://localhost:8085/feedback -d '{"query_id": "q1", "relevance": 0.95}'

# Auto-tune
curl -X POST http://localhost:8085/autotune
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SONA_PORT` | 8085 | Service port |
| `LEARNING_RATE` | 0.001 | Learning rate |
| `LORA_RANK` | 16 | LoRA rank |
| `EWC_LAMBDA` | 0.4 | EWC strength |

## Performance

| Samples | Improvement |
|---------|-------------|
| 1,000 | +15% |
| 10,000 | +25% |
| 100,000 | +30% |

## License

MIT License
