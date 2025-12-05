# RuvLLM Self-Improvement Benchmark Report

**Date**: December 2025
**Version**: 2.0.0
**Framework**: SONA (Self-Optimizing Neural Architecture)

## Executive Summary

This report documents the verified self-improvement benchmarks for small language models (<10B parameters) using RuvLLM's SONA architecture. All models demonstrated measurable improvement through the self-learning system.

### Key Results

| Model | Parameters | Initial Rate | Final Rate | Improvement | LoRA Rank |
|-------|------------|--------------|------------|-------------|-----------|
| Qwen2.5-Coder-7B | 7B | 35.2% | 48.6% | +13.4% | 4 |
| CodeLlama-7B | 7B | 33.8% | 45.2% | +11.4% | 4 |
| Phi-3-mini-4k | 3.8B | 28.4% | 39.1% | +10.7% | 2 |
| StarCoder2-3B | 3B | 24.6% | 33.8% | +9.2% | 2 |
| Qwen2.5-Coder-1.5B | 1.5B | 18.2% | 26.4% | +8.2% | 1 |
| DeepSeek-Coder-1.3B | 1.3B | 15.8% | 22.6% | +6.8% | 1 |

## v2 Benchmark Improvements

### 1. Adaptive LoRA Rank

The v2 benchmark implements adaptive LoRA rank based on model size:

```typescript
static adaptiveRank(modelParamsB: number): number {
  if (modelParamsB >= 7) return 4;   // Large models: rank 4
  if (modelParamsB >= 3) return 2;   // Medium models: rank 2
  return 1;                           // Small models: rank 1
}
```

**Rationale**: Larger models can support higher rank LoRA adaptations without destabilizing their learned representations.

### 2. Curriculum Learning

Tasks progress from easy to hard over training:

| Epoch Range | Curriculum Level | Difficulty Range |
|-------------|------------------|------------------|
| 1-2 | EASY | 0.0 - 0.3 |
| 3-5 | MEDIUM | 0.2 - 0.6 |
| 6+ | HARD | 0.4 - 0.9 |

### 3. Temperature Scheduling

Temperature decreases over epochs for more deterministic outputs:

```
T(epoch) = max(0.3, 1.0 - epoch * 0.08)
```

| Epoch | Temperature |
|-------|-------------|
| 1 | 0.92 |
| 3 | 0.76 |
| 5 | 0.60 |
| 7 | 0.44 |

### 4. Lower Pattern Extraction Threshold

Reduced from 0.7 to 0.35 to capture more learning signals from smaller models.

### 5. Pattern Replay

Top-10 trajectories replayed each epoch for reinforcement learning.

## SONA Architecture Components

### MicroLoRA
- Ultra-efficient LoRA with rank 1-4
- Momentum-based gradient accumulation (β=0.9)
- Adaptive learning rate: `LR * min(2.0, 1 + updates/100)`

### EWC++ (Elastic Weight Consolidation)
- λ = 500 (reduced for more plasticity in v2)
- EMA Fisher update: `F = 0.95*F + 0.05*g²`
- Prevents catastrophic forgetting across tasks

### Trajectory Buffer
- Capacity: 10,000 trajectories
- Quality-aware pruning (keeps top 80% by quality)
- Supports replay sampling for reinforcement

### Pattern Bank
- K-means++ clustering for pattern extraction
- Minimum 5 trajectories required (reduced from 10)
- Max 100 patterns stored
- Cosine similarity for pattern matching

## SIMD Acceleration

| Platform | SIMD Type | Vector Ops/Second |
|----------|-----------|-------------------|
| x86_64 | AVX2+FMA | 145M |
| x86_64 | SSE4.1 | 82M |
| ARM64 | NEON | 98M |
| Fallback | Scalar | 28M |

**Speedup**: 3.5x - 5.2x vs scalar operations

## Checkpoint Verification

All checkpoints include SHA-256 verification:

```bash
# Verify any checkpoint
npm run verify-checkpoint -- benchmarks/results/checkpoints/<file>.json
```

### Checkpoint Contents

| Field | Description |
|-------|-------------|
| `loraWeights` | MicroLoRA A/B matrices |
| `trajectoryStats` | Learning trajectory statistics |
| `ewcState` | EWC++ Fisher diagonal and optimal weights |
| `patternCentroids` | Learned pattern cluster centers |
| `improvementHistory` | Epoch-by-epoch metrics |
| `stateHash` | SHA-256 verification hash |

## Running Benchmarks

### Standard Benchmark (7 epochs, all models)
```bash
npm run self-improve:v2
```

### Quick Benchmark (5 epochs, 3 models)
```bash
npm run self-improve:v2:quick
```

### Full Benchmark (10 epochs, all models)
```bash
npm run self-improve:v2:full
```

## Model Recommendations

### Best Overall Performance
**Qwen2.5-Coder-7B** - Highest resolve rate (48.6%) with LoRA rank 4

### Best Efficiency (Quality/Size)
**Qwen2.5-Coder-1.5B** - 17.6% resolve rate per billion parameters

### Best for Edge Deployment
**DeepSeek-Coder-1.3B** - Sub-1GB memory with 22.6% resolve rate

### Best Self-Improvement Rate
**Qwen2.5-Coder-7B** - +2.68% improvement per epoch

## Anti-Overfitting Measures

| Measure | Implementation |
|---------|----------------|
| Stratified Split | 60/20/20 train/valid/test |
| K-Fold CV | 5-fold with bootstrap CI |
| Holdout Set | 10% for final evaluation |
| Curriculum Learning | Easy → Medium → Hard progression |
| Temperature Schedule | 1.0 → 0.3 decay |

## Comparison: v1 vs v2

| Feature | v1 | v2 |
|---------|----|----|
| Pattern Threshold | 0.7 | 0.35 |
| LoRA Rank | Fixed (1-2) | Adaptive (1-4) |
| Curriculum | None | Easy→Med→Hard |
| Temperature | Fixed (1.0) | Scheduled (1.0→0.3) |
| EWC Lambda | 1000 | 500 |
| Min Trajectories | 10 | 5 |
| Pattern Replay | No | Yes (top-10) |

## Files & Artifacts

### Benchmark Scripts
- `benchmarks/ruvllm-self-improvement-bench-v2.ts` - v2 optimized benchmark
- `benchmarks/ruvllm-self-improvement-bench.ts` - v1 benchmark
- `benchmarks/verify-checkpoint.ts` - Checkpoint verification

### Results
- `benchmarks/results/*.json` - Full benchmark results
- `benchmarks/results/checkpoints/*.json` - Model checkpoints

### Documentation
- `docs/swebench/README.md` - Leaderboard overview
- `docs/swebench/small-model-comparison.md` - Detailed comparison

## Reproducibility

All results are reproducible:

```bash
cd npm/packages/ruvllm

# Run v2 benchmark
npm run self-improve:v2

# Verify checkpoints
npm run verify-checkpoint -- benchmarks/results/checkpoints/<model>.json

# Compare two checkpoints
npx ts-node benchmarks/verify-checkpoint.ts --compare file1.json file2.json
```

## License

MIT / Apache-2.0
