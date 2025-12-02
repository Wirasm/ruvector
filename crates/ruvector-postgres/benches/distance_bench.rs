//! Benchmark for distance functions
//!
//! Compare SIMD vs scalar implementations across different vector sizes

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use rand::prelude::*;
use rand_chacha::ChaCha8Rng;

// Import from crate (adjust path as needed)
mod distance_impl {
    /// Scalar Euclidean distance
    pub fn euclidean_scalar(a: &[f32], b: &[f32]) -> f32 {
        a.iter()
            .zip(b.iter())
            .map(|(x, y)| {
                let diff = x - y;
                diff * diff
            })
            .sum::<f32>()
            .sqrt()
    }

    /// Scalar cosine distance
    pub fn cosine_scalar(a: &[f32], b: &[f32]) -> f32 {
        let mut dot = 0.0f32;
        let mut norm_a = 0.0f32;
        let mut norm_b = 0.0f32;

        for (x, y) in a.iter().zip(b.iter()) {
            dot += x * y;
            norm_a += x * x;
            norm_b += y * y;
        }

        let denominator = (norm_a * norm_b).sqrt();
        if denominator == 0.0 {
            return 1.0;
        }

        1.0 - (dot / denominator)
    }

    /// Scalar inner product
    pub fn inner_product_scalar(a: &[f32], b: &[f32]) -> f32 {
        -a.iter().zip(b.iter()).map(|(x, y)| x * y).sum::<f32>()
    }

    /// AVX2 Euclidean distance
    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "avx2", enable = "fma")]
    pub unsafe fn euclidean_avx2(a: &[f32], b: &[f32]) -> f32 {
        use std::arch::x86_64::*;

        let n = a.len();
        let mut sum = _mm256_setzero_ps();

        let chunks = n / 8;
        for i in 0..chunks {
            let offset = i * 8;
            let va = _mm256_loadu_ps(a.as_ptr().add(offset));
            let vb = _mm256_loadu_ps(b.as_ptr().add(offset));
            let diff = _mm256_sub_ps(va, vb);
            sum = _mm256_fmadd_ps(diff, diff, sum);
        }

        let sum_high = _mm256_extractf128_ps(sum, 1);
        let sum_low = _mm256_castps256_ps128(sum);
        let sum128 = _mm_add_ps(sum_high, sum_low);
        let sum64 = _mm_add_ps(sum128, _mm_movehl_ps(sum128, sum128));
        let sum32 = _mm_add_ss(sum64, _mm_shuffle_ps(sum64, sum64, 1));

        let mut result = _mm_cvtss_f32(sum32);

        for i in (chunks * 8)..n {
            let diff = a[i] - b[i];
            result += diff * diff;
        }

        result.sqrt()
    }

    #[cfg(not(target_arch = "x86_64"))]
    pub unsafe fn euclidean_avx2(a: &[f32], b: &[f32]) -> f32 {
        euclidean_scalar(a, b)
    }
}

fn generate_vectors(n: usize, dims: usize, seed: u64) -> (Vec<f32>, Vec<f32>) {
    let mut rng = ChaCha8Rng::seed_from_u64(seed);
    let a: Vec<f32> = (0..dims).map(|_| rng.gen_range(-1.0..1.0)).collect();
    let b: Vec<f32> = (0..dims).map(|_| rng.gen_range(-1.0..1.0)).collect();
    (a, b)
}

fn bench_euclidean(c: &mut Criterion) {
    let mut group = c.benchmark_group("Euclidean Distance");

    for dims in [128, 384, 768, 1536, 3072].iter() {
        let (a, b) = generate_vectors(1, *dims, 42);

        group.bench_with_input(
            BenchmarkId::new("scalar", dims),
            dims,
            |bench, _| {
                bench.iter(|| distance_impl::euclidean_scalar(black_box(&a), black_box(&b)))
            },
        );

        #[cfg(target_arch = "x86_64")]
        if is_x86_feature_detected!("avx2") {
            group.bench_with_input(
                BenchmarkId::new("avx2", dims),
                dims,
                |bench, _| {
                    bench.iter(|| unsafe {
                        distance_impl::euclidean_avx2(black_box(&a), black_box(&b))
                    })
                },
            );
        }
    }

    group.finish();
}

fn bench_cosine(c: &mut Criterion) {
    let mut group = c.benchmark_group("Cosine Distance");

    for dims in [128, 384, 768, 1536].iter() {
        let (a, b) = generate_vectors(1, *dims, 42);

        group.bench_with_input(
            BenchmarkId::new("scalar", dims),
            dims,
            |bench, _| {
                bench.iter(|| distance_impl::cosine_scalar(black_box(&a), black_box(&b)))
            },
        );
    }

    group.finish();
}

fn bench_inner_product(c: &mut Criterion) {
    let mut group = c.benchmark_group("Inner Product");

    for dims in [128, 384, 768, 1536].iter() {
        let (a, b) = generate_vectors(1, *dims, 42);

        group.bench_with_input(
            BenchmarkId::new("scalar", dims),
            dims,
            |bench, _| {
                bench.iter(|| distance_impl::inner_product_scalar(black_box(&a), black_box(&b)))
            },
        );
    }

    group.finish();
}

fn bench_batch(c: &mut Criterion) {
    let mut group = c.benchmark_group("Batch Distance (1000 vectors)");

    for dims in [128, 384, 1536].iter() {
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let query: Vec<f32> = (0..*dims).map(|_| rng.gen_range(-1.0..1.0)).collect();
        let vectors: Vec<Vec<f32>> = (0..1000)
            .map(|_| (0..*dims).map(|_| rng.gen_range(-1.0..1.0)).collect())
            .collect();

        group.bench_with_input(
            BenchmarkId::new("sequential", dims),
            dims,
            |bench, _| {
                bench.iter(|| {
                    vectors
                        .iter()
                        .map(|v| distance_impl::euclidean_scalar(black_box(&query), black_box(v)))
                        .collect::<Vec<_>>()
                })
            },
        );

        group.bench_with_input(
            BenchmarkId::new("parallel_rayon", dims),
            dims,
            |bench, _| {
                use rayon::prelude::*;
                bench.iter(|| {
                    vectors
                        .par_iter()
                        .map(|v| distance_impl::euclidean_scalar(black_box(&query), black_box(v)))
                        .collect::<Vec<_>>()
                })
            },
        );
    }

    group.finish();
}

criterion_group!(benches, bench_euclidean, bench_cosine, bench_inner_product, bench_batch);
criterion_main!(benches);
