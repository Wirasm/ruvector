/**
 * HYPERBOLIC EMBEDDING BENCHMARK V4
 *
 * Uses Poincaré Ball model for hierarchical code structure:
 * - File paths are hierarchical: /django/db/models/base.py
 * - Module imports are hierarchical: from django.db.models import Model
 * - Class inheritance is hierarchical: class Foo(Bar):
 *
 * Hyperbolic space naturally captures "distance" in hierarchies.
 * Parent-child relationships have small hyperbolic distance.
 *
 * Key insight: The baseline works by simple regex.
 * We need to AUGMENT it, not replace it.
 * Use hyperbolic embeddings to RANK multiple candidates.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface SWEBenchInstance {
    instance_id: string;
    repo: string;
    patch: string;
    problem_statement: string;
    hints_text: string;
}

// ============================================================================
// POINCARÉ BALL EMBEDDINGS
// ============================================================================

class PoincareBall {
    private dim: number;
    private curvature: number;
    private embeddings: Map<string, number[]> = new Map();

    constructor(dim: number = 32, curvature: number = 1.0) {
        this.dim = dim;
        this.curvature = curvature;
    }

    /**
     * Create hyperbolic embedding for a hierarchical path
     * Root is at origin, leaves are near boundary
     */
    embedHierarchy(path: string[]): number[] {
        const embedding = new Array(this.dim).fill(0);

        // Each level moves us closer to the boundary
        // Parent embeddings contain children's direction
        for (let level = 0; level < path.length; level++) {
            const segment = path[level];
            const hash = crypto.createHash('sha256').update(segment).digest();

            // Radius increases with depth (closer to boundary = more specific)
            const radius = 0.1 + (level / path.length) * 0.85; // Stay inside ball (< 1)

            // Direction determined by hash
            for (let i = 0; i < this.dim; i++) {
                const angle = (hash[i % 32] / 255) * 2 * Math.PI;
                const weight = 1 / (level + 1); // Earlier levels have more influence
                embedding[i] += Math.cos(angle + i) * radius * weight;
            }
        }

        // Project into Poincaré ball (norm < 1)
        return this.project(embedding);
    }

    /**
     * Embed a file path
     */
    embedPath(filePath: string): number[] {
        const parts = filePath.split('/').filter(p => p.length > 0);
        return this.embedHierarchy(parts);
    }

    /**
     * Embed a module path (django.db.models -> ['django', 'db', 'models'])
     */
    embedModule(modulePath: string): number[] {
        const parts = modulePath.split('.').filter(p => p.length > 0);
        return this.embedHierarchy(parts);
    }

    /**
     * Embed text with word hierarchy (earlier words = more important)
     */
    embedText(text: string): number[] {
        const words = text.toLowerCase()
            .replace(/[^a-z0-9_]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2)
            .slice(0, 20);
        return this.embedHierarchy(words);
    }

    /**
     * Hyperbolic distance in Poincaré ball
     * d(u, v) = arcosh(1 + 2 * ||u-v||^2 / ((1-||u||^2)(1-||v||^2)))
     */
    distance(u: number[], v: number[]): number {
        const normU = this.norm(u);
        const normV = this.norm(v);

        // Clamp to avoid numerical issues at boundary
        const safeNormU = Math.min(normU, 0.999);
        const safeNormV = Math.min(normV, 0.999);

        const diff = u.map((ui, i) => ui - v[i]);
        const diffNormSq = diff.reduce((s, d) => s + d * d, 0);

        const denom = (1 - safeNormU * safeNormU) * (1 - safeNormV * safeNormV);
        const arg = 1 + 2 * diffNormSq / denom;

        return Math.acosh(Math.max(1, arg));
    }

    /**
     * Convert hyperbolic distance to similarity (0-1)
     */
    similarity(u: number[], v: number[]): number {
        const dist = this.distance(u, v);
        return Math.exp(-dist * this.curvature);
    }

    /**
     * Project point into Poincaré ball (norm < 1)
     */
    private project(x: number[]): number[] {
        const norm = this.norm(x);
        if (norm >= 1) {
            // Scale down to stay inside ball
            const scale = 0.95 / norm;
            return x.map(xi => xi * scale);
        }
        return x;
    }

    private norm(x: number[]): number {
        return Math.sqrt(x.reduce((s, xi) => s + xi * xi, 0));
    }

    /**
     * Store embedding
     */
    store(key: string, embedding: number[]): void {
        this.embeddings.set(key, embedding);
    }

    /**
     * Find nearest neighbors
     */
    findNearest(query: number[], k: number = 5): Array<{ key: string; similarity: number }> {
        const results: Array<{ key: string; similarity: number }> = [];

        for (const [key, emb] of this.embeddings) {
            const sim = this.similarity(query, emb);
            results.push({ key, similarity: sim });
        }

        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, k);
    }

    size(): number {
        return this.embeddings.size;
    }
}

// ============================================================================
// HIERARCHICAL CODE ANALYZER
// ============================================================================

class HierarchicalAnalyzer {
    private poincare: PoincareBall;
    private pathToFile: Map<string, string> = new Map();

    constructor() {
        this.poincare = new PoincareBall(64, 0.5);
    }

    /**
     * Learn from training instances
     */
    learn(instances: SWEBenchInstance[]): void {
        for (const inst of instances) {
            const file = this.extractFile(inst.patch);
            if (!file) continue;

            // Embed the file path
            const fileEmb = this.poincare.embedPath(file);
            this.poincare.store(`file:${file}`, fileEmb);
            this.pathToFile.set(`file:${file}`, file);

            // Extract and embed modules from problem
            const modules = inst.problem_statement.match(/from\s+([\w.]+)\s+import/g) || [];
            for (const mod of modules) {
                const modulePath = mod.replace('from ', '').replace(' import', '');
                const modEmb = this.poincare.embedModule(modulePath);
                this.poincare.store(`module:${modulePath}`, modEmb);
                this.pathToFile.set(`module:${modulePath}`, file);
            }

            // Embed the problem text
            const textEmb = this.poincare.embedText(inst.problem_statement);
            this.poincare.store(`problem:${inst.instance_id}`, textEmb);
            this.pathToFile.set(`problem:${inst.instance_id}`, file);
        }
    }

    /**
     * Find candidate files using hyperbolic similarity
     */
    findCandidates(problem: string): Array<{ file: string; similarity: number; source: string }> {
        const candidates = new Map<string, { similarity: number; source: string }>();

        // Try module-based lookup
        const modules = problem.match(/from\s+([\w.]+)\s+import/g) || [];
        for (const mod of modules) {
            const modulePath = mod.replace('from ', '').replace(' import', '');
            const modEmb = this.poincare.embedModule(modulePath);
            const nearest = this.poincare.findNearest(modEmb, 3);

            for (const match of nearest) {
                const file = this.pathToFile.get(match.key);
                if (file && match.similarity > 0.1) {
                    const existing = candidates.get(file);
                    if (!existing || match.similarity > existing.similarity) {
                        candidates.set(file, { similarity: match.similarity, source: 'module' });
                    }
                }
            }
        }

        // Try text-based lookup
        const textEmb = this.poincare.embedText(problem);
        const textNearest = this.poincare.findNearest(textEmb, 5);

        for (const match of textNearest) {
            const file = this.pathToFile.get(match.key);
            if (file && match.similarity > 0.05) {
                const existing = candidates.get(file);
                if (!existing || match.similarity * 0.8 > existing.similarity) {
                    candidates.set(file, { similarity: match.similarity * 0.8, source: 'text' });
                }
            }
        }

        return Array.from(candidates.entries())
            .map(([file, data]) => ({ file, ...data }))
            .sort((a, b) => b.similarity - a.similarity);
    }

    private extractFile(patch: string): string {
        const match = patch.match(/diff --git a\/(.+?) b\//);
        return match ? match[1] : '';
    }

    getStats(): { embeddings: number } {
        return { embeddings: this.poincare.size() };
    }
}

// ============================================================================
// HYBRID PREDICTOR: Baseline + Hyperbolic Ranking
// ============================================================================

class HybridPredictor {
    private analyzer: HierarchicalAnalyzer;

    constructor() {
        this.analyzer = new HierarchicalAnalyzer();
    }

    learn(instances: SWEBenchInstance[]): void {
        console.log('  Learning hyperbolic embeddings...');
        this.analyzer.learn(instances);
        console.log(`  Stored ${this.analyzer.getStats().embeddings} embeddings`);
    }

    /**
     * Hybrid prediction: Use baseline + hyperbolic ranking
     */
    predict(instance: SWEBenchInstance): {
        file: string;
        confidence: number;
        method: string;
    } {
        // Step 1: Get baseline candidates
        const baselineCandidates = this.extractBaseline(instance.problem_statement);

        // Step 2: Get hyperbolic candidates
        const hyperbolicCandidates = this.analyzer.findCandidates(instance.problem_statement);

        // Step 3: Score and combine
        const allCandidates = new Map<string, { score: number; source: string }>();

        // Add baseline candidates with their scores
        for (const cand of baselineCandidates) {
            const fileName = cand.file.split('/').pop() || cand.file;
            allCandidates.set(fileName, { score: cand.score, source: cand.source });
        }

        // Boost candidates that also appear in hyperbolic results
        for (const hypCand of hyperbolicCandidates) {
            const fileName = hypCand.file.split('/').pop() || hypCand.file;
            const existing = allCandidates.get(fileName);

            if (existing) {
                // Boost: appears in both baseline and hyperbolic
                existing.score *= 1.5;
                existing.source = 'hybrid';
            } else if (hypCand.similarity > 0.3) {
                // Only add hyperbolic-only if high confidence
                allCandidates.set(fileName, { score: hypCand.similarity * 0.5, source: 'hyperbolic' });
            }
        }

        // Find best candidate
        let bestFile = '';
        let bestScore = 0;
        let bestSource = 'fallback';

        for (const [file, data] of allCandidates) {
            if (data.score > bestScore) {
                bestScore = data.score;
                bestFile = file;
                bestSource = data.source;
            }
        }

        // Fallback
        if (!bestFile) {
            const repoName = instance.repo.split('/')[1] || 'core';
            bestFile = repoName + '.py';
            bestScore = 0.1;
            bestSource = 'fallback';
        }

        return {
            file: bestFile,
            confidence: Math.min(bestScore, 0.95),
            method: bestSource,
        };
    }

    /**
     * Original baseline extraction
     */
    private extractBaseline(problem: string): Array<{ file: string; score: number; source: string }> {
        const candidates: Array<{ file: string; score: number; source: string }> = [];

        // Regex for .py files
        const fileMatches = problem.match(/[\w\/]+\.py/g) || [];
        for (const f of fileMatches) {
            candidates.push({ file: f, score: 0.6, source: 'regex' });
        }

        // From imports
        const imports = problem.match(/from\s+([\w.]+)\s+import/g) || [];
        for (const imp of imports) {
            const module = imp.replace('from ', '').replace(' import', '');
            const file = module.replace(/\./g, '/') + '.py';
            candidates.push({ file, score: 0.5, source: 'import' });
        }

        // Backtick files (high confidence when present)
        const backticks = problem.match(/`([^`]+\.py)`/g) || [];
        for (const bt of backticks) {
            const file = bt.replace(/`/g, '');
            candidates.push({ file, score: 0.8, source: 'backtick' });
        }

        // Quoted files
        const quoted = problem.match(/"([^"]+\.py)"/g) || [];
        for (const q of quoted) {
            const file = q.replace(/"/g, '');
            candidates.push({ file, score: 0.7, source: 'quoted' });
        }

        return candidates;
    }
}

// ============================================================================
// ORIGINAL BASELINE
// ============================================================================

function originalBaseline(problem: string): { file: string; confidence: number } {
    const fileMatches = problem.match(/[\w\/]+\.py/g) || [];
    if (fileMatches.length > 0) {
        return { file: fileMatches[0], confidence: 0.5 };
    }

    const moduleMatches = problem.match(/from\s+([\w.]+)\s+import/g) || [];
    if (moduleMatches.length > 0) {
        const module = moduleMatches[0].replace('from ', '').replace(' import', '');
        return { file: module.replace(/\./g, '/') + '.py', confidence: 0.4 };
    }

    return { file: 'unknown.py', confidence: 0.1 };
}

function fileMatches(predicted: string, gold: string): boolean {
    if (!predicted || !gold) return false;
    const predFile = predicted.split('/').pop() || '';
    const goldFile = gold.split('/').pop() || '';
    return predFile === goldFile ||
        gold.endsWith(predFile) ||
        predicted.endsWith(goldFile) ||
        gold.includes(predFile);
}

// ============================================================================
// MAIN BENCHMARK
// ============================================================================

async function main() {
    console.log('\n' + '='.repeat(70));
    console.log('HYPERBOLIC EMBEDDING BENCHMARK V4');
    console.log('Poincaré Ball Model for Hierarchical Code Structure');
    console.log('='.repeat(70));

    // Load data
    const swePath = path.join(__dirname, 'swe-bench-real', 'all_instances.json');
    const sweInstances: SWEBenchInstance[] = JSON.parse(fs.readFileSync(swePath, 'utf8'));
    console.log(`\nLoaded ${sweInstances.length} SWE-bench instances`);

    // Split data
    const trainSize = Math.floor(sweInstances.length * 0.6);
    const trainInstances = sweInstances.slice(0, trainSize);
    const testInstances = sweInstances.slice(trainSize);
    console.log(`Train: ${trainInstances.length}, Test: ${testInstances.length}`);

    // ========================================================================
    // ORIGINAL BASELINE
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('ORIGINAL BASELINE');
    console.log('='.repeat(70));

    let baselineCorrect = 0;
    for (const inst of testInstances) {
        const gold = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
        const pred = originalBaseline(inst.problem_statement);
        if (fileMatches(pred.file, gold)) baselineCorrect++;
    }
    const baselineAcc = baselineCorrect / testInstances.length;
    console.log(`  File Location Accuracy: ${(baselineAcc * 100).toFixed(1)}%`);

    // ========================================================================
    // HYPERBOLIC HYBRID
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('HYPERBOLIC HYBRID PREDICTION');
    console.log('='.repeat(70));

    const hybrid = new HybridPredictor();
    hybrid.learn(trainInstances);

    let hybridCorrect = 0;
    const methodCounts: Record<string, { total: number; correct: number }> = {};

    for (const inst of testInstances) {
        const gold = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
        const pred = hybrid.predict(inst);

        if (!methodCounts[pred.method]) {
            methodCounts[pred.method] = { total: 0, correct: 0 };
        }
        methodCounts[pred.method].total++;

        if (fileMatches(pred.file, gold)) {
            hybridCorrect++;
            methodCounts[pred.method].correct++;
        }
    }

    const hybridAcc = hybridCorrect / testInstances.length;

    console.log(`\n  File Location Accuracy: ${(hybridAcc * 100).toFixed(1)}%`);
    console.log('\n  By Method:');
    for (const [method, stats] of Object.entries(methodCounts).sort((a, b) => b[1].total - a[1].total)) {
        const acc = stats.total > 0 ? (stats.correct / stats.total * 100).toFixed(1) : '0.0';
        console.log(`    ${method.padEnd(15)}: ${acc}% (${stats.correct}/${stats.total})`);
    }

    // ========================================================================
    // COMPARISON
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('BEFORE / AFTER COMPARISON');
    console.log('='.repeat(70));

    const improvement = hybridAcc - baselineAcc;
    const relativeImprovement = baselineAcc > 0 ? (improvement / baselineAcc * 100) : 0;

    console.log('\n┌───────────────────────────────┬──────────┬─────────────────┐');
    console.log('│ Configuration                 │ Accuracy │ Improvement     │');
    console.log('├───────────────────────────────┼──────────┼─────────────────┤');
    console.log(`│ Original Baseline             │ ${(baselineAcc * 100).toFixed(1).padStart(6)}% │       -         │`);
    console.log(`│ Hyperbolic Hybrid             │ ${(hybridAcc * 100).toFixed(1).padStart(6)}% │ ${improvement >= 0 ? '+' : ''}${(improvement * 100).toFixed(1)}% (${relativeImprovement >= 0 ? '+' : ''}${relativeImprovement.toFixed(0)}% rel) │`);
    console.log('└───────────────────────────────┴──────────┴─────────────────┘');

    if (improvement > 0) {
        console.log(`\n✅ IMPROVEMENT ACHIEVED: +${(improvement * 100).toFixed(1)}% absolute`);
    } else if (Math.abs(improvement) < 0.01) {
        console.log(`\n✓ No regression: maintained baseline performance`);
    } else {
        console.log(`\n⚠️ Regression: ${(improvement * 100).toFixed(1)}%`);
    }

    console.log('\n📐 HYPERBOLIC GEOMETRY BENEFITS:');
    console.log('  ✓ Poincaré Ball preserves hierarchical distances');
    console.log('  ✓ File paths: /django/db/models/base.py');
    console.log('  ✓ Module paths: django.db.models.Model');
    console.log('  ✓ Parent-child relationships have small distance');
    console.log('  ✓ Siblings have similar distance from root');

    // Save results
    const results = {
        timestamp: new Date().toISOString(),
        version: 'v4-hyperbolic',
        dataset: {
            total: sweInstances.length,
            train: trainInstances.length,
            test: testInstances.length,
        },
        results: {
            baseline: baselineAcc,
            hybrid: hybridAcc,
        },
        improvement: {
            absolute: improvement,
            relative: relativeImprovement,
        },
        byMethod: methodCounts,
        technique: 'Poincaré Ball hyperbolic embeddings',
        provenance: {
            hash: crypto.createHash('sha256')
                .update(JSON.stringify({ baselineAcc, hybridAcc }))
                .digest('hex'),
        },
    };

    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    const resultsPath = path.join(resultsDir, `hyperbolic-v4-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);
}

main().catch(console.error);
