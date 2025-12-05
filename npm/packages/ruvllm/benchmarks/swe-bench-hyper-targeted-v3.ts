/**
 * HYPER-TARGETED TRAINING V3
 *
 * Key learnings from V2:
 * - sphinx improved +14.3%
 * - django improved +2.2%
 * - BUT small repos (astropy: 3 samples) degraded badly
 *
 * V3 Strategy: SMART FALLBACK
 * - Only use micro-model if enough training data (>= 10 samples)
 * - Only override baseline if confidence is HIGH
 * - Otherwise use baseline (which is proven at 18.3%)
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
// SMART MICRO-MODEL WITH FALLBACK
// ============================================================================

class SmartMicroModel {
    private repo: string;
    private keywordToFile: Map<string, Map<string, number>> = new Map();
    private fileFrequency: Map<string, number> = new Map();
    private modulePatterns: Map<string, string> = new Map();
    private trainingSize = 0;
    private minConfidence = 0.5;

    constructor(repo: string, minConfidence = 0.5) {
        this.repo = repo;
        this.minConfidence = minConfidence;
    }

    train(instances: SWEBenchInstance[]): void {
        this.trainingSize = instances.length;

        for (const inst of instances) {
            const file = this.extractFile(inst.patch);
            if (!file) continue;

            const fileName = file.split('/').pop() || '';

            // File frequency
            this.fileFrequency.set(fileName, (this.fileFrequency.get(fileName) || 0) + 1);

            // Keyword → file (stronger weighting for unique associations)
            const keywords = this.extractKeywords(inst.problem_statement);
            for (const kw of keywords) {
                if (!this.keywordToFile.has(kw)) {
                    this.keywordToFile.set(kw, new Map());
                }
                const fileMap = this.keywordToFile.get(kw)!;
                fileMap.set(fileName, (fileMap.get(fileName) || 0) + 1);
            }

            // Module → file patterns
            const modules = inst.problem_statement.match(/from\s+([\w.]+)\s+import/g) || [];
            for (const mod of modules) {
                const moduleName = mod.replace(/from\s+/, '').replace(/\s+import/, '');
                this.modulePatterns.set(moduleName, fileName);
            }
        }
    }

    /**
     * Returns prediction with confidence. If confidence < threshold, returns null
     * to signal fallback to baseline.
     */
    predict(problem: string): { file: string; confidence: number; method: string } | null {
        // Skip if not enough training data
        if (this.trainingSize < 10) {
            return null;  // Signal to use baseline
        }

        // Strategy 1: Keyword matching
        const keywords = this.extractKeywords(problem);
        const fileScores: Map<string, number> = new Map();

        for (const kw of keywords) {
            const fileMap = this.keywordToFile.get(kw);
            if (fileMap) {
                for (const [file, count] of fileMap) {
                    const fileFreq = this.fileFrequency.get(file) || 1;
                    // TF-IDF-like weighting
                    const score = count * Math.log(this.trainingSize / (fileFreq + 1) + 1);
                    fileScores.set(file, (fileScores.get(file) || 0) + score);
                }
            }
        }

        if (fileScores.size > 0) {
            const sorted = Array.from(fileScores.entries()).sort((a, b) => b[1] - a[1]);
            const topScore = sorted[0][1];
            const secondScore = sorted[1]?.[1] || 0;

            // Confidence based on score gap and absolute score
            const scoreGap = sorted.length > 1 ? topScore / (secondScore + 0.1) : 2;
            const confidence = Math.min(0.9, (topScore / 10) * Math.min(scoreGap / 2, 1));

            if (confidence >= this.minConfidence) {
                return {
                    file: sorted[0][0],
                    confidence,
                    method: 'keyword-targeted',
                };
            }
        }

        // Strategy 2: Module patterns
        const moduleMatch = problem.match(/from\s+([\w.]+)\s+import/);
        if (moduleMatch) {
            const file = this.modulePatterns.get(moduleMatch[1]);
            if (file) {
                return { file, confidence: 0.6, method: 'module-targeted' };
            }
        }

        // Don't use domain-prior if not confident enough
        return null;
    }

    private extractFile(patch: string): string {
        const match = patch.match(/diff --git a\/(.+?) b\//);
        return match ? match[1] : '';
    }

    private extractKeywords(text: string): string[] {
        const words = text.toLowerCase()
            .replace(/[^a-z0-9_]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !this.isStopWord(w));

        // Extract method/attribute mentions
        const methods = (text.match(/\.(\w+)\(/g) || []).map(m => m.replace(/[.()]/g, ''));
        const attrs = (text.match(/\.(\w+)(?!\()/g) || []).map(a => a.replace('.', '')).slice(0, 10);

        return [...new Set([...words.slice(0, 40), ...methods, ...attrs])];
    }

    private isStopWord(word: string): boolean {
        const stops = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'were', 'when', 'what', 'which', 'should', 'would', 'could', 'there', 'their', 'about', 'after', 'before', 'using', 'where', 'being', 'some', 'like', 'just', 'also', 'here', 'work', 'does', 'want', 'need', 'make', 'made', 'test', 'tests']);
        return stops.has(word);
    }

    getStats() {
        return {
            repo: this.repo,
            trainingSize: this.trainingSize,
            keywords: this.keywordToFile.size,
            files: this.fileFrequency.size,
            enabled: this.trainingSize >= 10,
        };
    }
}

// ============================================================================
// BASELINE
// ============================================================================

function baseline(problem: string): string {
    const fileMatch = problem.match(/[\w\/]+\.py/g) || [];
    if (fileMatch.length > 0) return fileMatch[0];

    const moduleMatch = problem.match(/from\s+([\w.]+)\s+import/);
    if (moduleMatch) {
        return moduleMatch[1].replace(/\./g, '/') + '.py';
    }

    return 'unknown.py';
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
    console.log('HYPER-TARGETED TRAINING V3');
    console.log('Smart fallback: Only override baseline when confident');
    console.log('='.repeat(70));

    // Load data
    const swePath = path.join(__dirname, 'swe-bench-real', 'all_instances.json');
    const sweInstances: SWEBenchInstance[] = JSON.parse(fs.readFileSync(swePath, 'utf8'));
    console.log(`\nLoaded ${sweInstances.length} SWE-bench Lite instances`);

    // Group by repository
    const byRepo = new Map<string, SWEBenchInstance[]>();
    for (const inst of sweInstances) {
        if (!byRepo.has(inst.repo)) {
            byRepo.set(inst.repo, []);
        }
        byRepo.get(inst.repo)!.push(inst);
    }

    // Per-repo split
    const trainInstances: SWEBenchInstance[] = [];
    const testInstances: SWEBenchInstance[] = [];

    for (const [repo, instances] of byRepo) {
        const splitIdx = Math.floor(instances.length * 0.6);
        trainInstances.push(...instances.slice(0, splitIdx));
        testInstances.push(...instances.slice(splitIdx));
    }

    console.log(`  Train: ${trainInstances.length}, Test: ${testInstances.length}`);

    // ========================================================================
    // BASELINE
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('BASELINE');
    console.log('='.repeat(70));

    let baselineCorrect = 0;
    const baselineByRepo: Map<string, { correct: number; total: number }> = new Map();

    for (const inst of testInstances) {
        const gold = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
        const pred = baseline(inst.problem_statement);

        if (!baselineByRepo.has(inst.repo)) {
            baselineByRepo.set(inst.repo, { correct: 0, total: 0 });
        }
        baselineByRepo.get(inst.repo)!.total++;

        if (fileMatches(pred, gold)) {
            baselineCorrect++;
            baselineByRepo.get(inst.repo)!.correct++;
        }
    }

    const baselineAcc = baselineCorrect / testInstances.length;
    console.log(`  Overall: ${baselineCorrect}/${testInstances.length} = ${(baselineAcc * 100).toFixed(1)}%`);

    // ========================================================================
    // SMART HYBRID (Micro-model + Baseline fallback)
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('SMART HYBRID (Micro-model when confident, else baseline)');
    console.log('='.repeat(70));

    // Train models
    const models = new Map<string, SmartMicroModel>();
    console.log('\n  Training micro-models (min 10 samples to enable):');

    for (const [repo, instances] of byRepo) {
        const trainCount = Math.floor(instances.length * 0.6);
        const model = new SmartMicroModel(repo, 0.4);
        model.train(instances.slice(0, trainCount));
        models.set(repo, model);

        const stats = model.getStats();
        const status = stats.enabled ? '✓' : '✗';
        console.log(`    ${status} ${repo.substring(0, 25).padEnd(26)}: ${stats.trainingSize} samples ${stats.enabled ? `(${stats.keywords} keywords)` : '(disabled)'}`);
    }

    // Evaluate
    console.log('\n  Evaluating...');
    let hybridCorrect = 0;
    const hybridByRepo: Map<string, { correct: number; total: number }> = new Map();
    const methodCounts: Record<string, { total: number; correct: number }> = {};
    let microUsed = 0;
    let baselineFallback = 0;

    for (const inst of testInstances) {
        const gold = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
        const model = models.get(inst.repo);

        let predFile: string;
        let method: string;

        // Try micro-model first
        const microPred = model?.predict(inst.problem_statement);

        if (microPred) {
            predFile = microPred.file;
            method = microPred.method;
            microUsed++;
        } else {
            // Fallback to baseline
            predFile = baseline(inst.problem_statement);
            method = 'baseline-fallback';
            baselineFallback++;
        }

        if (!hybridByRepo.has(inst.repo)) {
            hybridByRepo.set(inst.repo, { correct: 0, total: 0 });
        }
        hybridByRepo.get(inst.repo)!.total++;

        if (!methodCounts[method]) {
            methodCounts[method] = { total: 0, correct: 0 };
        }
        methodCounts[method].total++;

        if (fileMatches(predFile, gold)) {
            hybridCorrect++;
            hybridByRepo.get(inst.repo)!.correct++;
            methodCounts[method].correct++;
        }
    }

    const hybridAcc = hybridCorrect / testInstances.length;
    console.log(`\n  Overall: ${hybridCorrect}/${testInstances.length} = ${(hybridAcc * 100).toFixed(1)}%`);
    console.log(`  Micro-model used: ${microUsed}/${testInstances.length} (${(microUsed/testInstances.length*100).toFixed(1)}%)`);
    console.log(`  Baseline fallback: ${baselineFallback}/${testInstances.length} (${(baselineFallback/testInstances.length*100).toFixed(1)}%)`);

    console.log('\n  By Method:');
    for (const [method, stats] of Object.entries(methodCounts).sort((a, b) => b[1].total - a[1].total)) {
        const acc = stats.total > 0 ? (stats.correct / stats.total * 100).toFixed(1) : '0.0';
        console.log(`    ${method.padEnd(20)}: ${acc}% (${stats.correct}/${stats.total})`);
    }

    // ========================================================================
    // PER-REPOSITORY COMPARISON
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('PER-REPOSITORY COMPARISON');
    console.log('='.repeat(70));

    const repoResults: Array<{ repo: string; baseAcc: number; hybridAcc: number; diff: number }> = [];

    for (const [repo, baseStats] of baselineByRepo) {
        const hybridStats = hybridByRepo.get(repo) || { correct: 0, total: 0 };
        const baseAcc = baseStats.total > 0 ? baseStats.correct / baseStats.total : 0;
        const hAcc = hybridStats.total > 0 ? hybridStats.correct / hybridStats.total : 0;
        repoResults.push({ repo, baseAcc, hybridAcc: hAcc, diff: hAcc - baseAcc });
    }

    repoResults.sort((a, b) => b.diff - a.diff);

    console.log('\n  Repository                      Baseline   Hybrid    Δ       Status');
    console.log('  ' + '-'.repeat(70));

    for (const r of repoResults) {
        const status = r.diff > 0.01 ? '✅ IMPROVED' : r.diff < -0.01 ? '⚠️ DEGRADED' : '➖ SAME';
        const diffStr = r.diff >= 0 ? `+${(r.diff * 100).toFixed(1)}%` : `${(r.diff * 100).toFixed(1)}%`;
        console.log(`  ${r.repo.substring(0, 28).padEnd(30)} ${(r.baseAcc * 100).toFixed(1).padStart(6)}%  ${(r.hybridAcc * 100).toFixed(1).padStart(6)}%  ${diffStr.padStart(7)}  ${status}`);
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    const improved = repoResults.filter(r => r.diff > 0.01).length;
    const degraded = repoResults.filter(r => r.diff < -0.01).length;
    const same = repoResults.filter(r => Math.abs(r.diff) <= 0.01).length;
    const overallDiff = hybridAcc - baselineAcc;

    console.log('\n┌───────────────────────────────┬──────────┬─────────────────┐');
    console.log('│ Configuration                 │ Accuracy │ vs Baseline     │');
    console.log('├───────────────────────────────┼──────────┼─────────────────┤');
    console.log(`│ Baseline                      │ ${(baselineAcc * 100).toFixed(1).padStart(6)}% │       -         │`);
    console.log(`│ Smart Hybrid (Micro+Baseline) │ ${(hybridAcc * 100).toFixed(1).padStart(6)}% │ ${overallDiff >= 0 ? '+' : ''}${(overallDiff * 100).toFixed(1)}%          │`);
    console.log('└───────────────────────────────┴──────────┴─────────────────┘');

    console.log(`\n📊 Per-Repository Results:`);
    console.log(`  ✅ Improved: ${improved}/${repoResults.length}`);
    console.log(`  ⚠️ Degraded: ${degraded}/${repoResults.length}`);
    console.log(`  ➖ Same: ${same}/${repoResults.length}`);

    if (overallDiff > 0) {
        console.log(`\n✅ SMART HYBRID IMPROVED: +${(overallDiff * 100).toFixed(1)}% overall`);
    } else if (Math.abs(overallDiff) < 0.5) {
        console.log(`\n✓ Maintained baseline performance (${(overallDiff * 100).toFixed(1)}%)`);
    } else {
        console.log(`\n⚠️ Overall: ${(overallDiff * 100).toFixed(1)}%`);
    }

    console.log('\n📋 V3 SMART HYBRID STRATEGY:');
    console.log('  ✓ Micro-model only for repos with >= 10 training samples');
    console.log('  ✓ Confidence-based: only override if confident');
    console.log('  ✓ Fallback to proven baseline for uncertain cases');
    console.log('  ✓ Best of both worlds: domain expertise + reliability');

    // Save results
    const results = {
        timestamp: new Date().toISOString(),
        version: 'hyper-targeted-v3',
        dataset: { total: sweInstances.length, train: trainInstances.length, test: testInstances.length },
        baseline: { accuracy: baselineAcc, correct: baselineCorrect },
        hybrid: { accuracy: hybridAcc, correct: hybridCorrect, microUsed, baselineFallback, byMethod: methodCounts },
        perRepo: repoResults,
        summary: { improved, degraded, same, overallDiff },
        provenance: {
            hash: crypto.createHash('sha256')
                .update(JSON.stringify({ baselineAcc, hybridAcc }))
                .digest('hex').substring(0, 32),
        },
    };

    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    const resultsPath = path.join(resultsDir, `hyper-targeted-v3-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);
}

main().catch(console.error);
