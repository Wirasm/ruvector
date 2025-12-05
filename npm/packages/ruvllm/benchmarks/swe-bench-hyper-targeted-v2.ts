/**
 * HYPER-TARGETED TRAINING V2
 *
 * Key fix from V1: Use per-repo train/test split
 * Each repo is split 60/40 to ensure training data
 *
 * The problem was: test set had repos not in training
 * Solution: Split EACH repo's instances into train/test
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
// SPECIALIZED MICRO-MODEL
// ============================================================================

class RepoMicroModel {
    private repo: string;
    private keywordToFile: Map<string, Map<string, number>> = new Map();
    private fileFrequency: Map<string, number> = new Map();
    private errorToFile: Map<string, string[]> = new Map();
    private classToFile: Map<string, string> = new Map();
    private moduleToFile: Map<string, string> = new Map();
    private trainingSize = 0;

    constructor(repo: string) {
        this.repo = repo;
    }

    /**
     * Train on repo instances
     */
    train(instances: SWEBenchInstance[]): void {
        this.trainingSize = instances.length;

        for (const inst of instances) {
            const file = this.extractFile(inst.patch);
            if (!file) continue;

            const fileName = file.split('/').pop() || '';

            // File frequency
            this.fileFrequency.set(fileName, (this.fileFrequency.get(fileName) || 0) + 1);

            // Keyword → file associations
            const keywords = this.extractKeywords(inst.problem_statement);
            for (const kw of keywords) {
                if (!this.keywordToFile.has(kw)) {
                    this.keywordToFile.set(kw, new Map());
                }
                const fileMap = this.keywordToFile.get(kw)!;
                fileMap.set(fileName, (fileMap.get(fileName) || 0) + 1);
            }

            // Error type → file
            const errorTypes = inst.problem_statement.match(/\w+Error|\w+Exception/g) || [];
            for (const errType of errorTypes) {
                if (!this.errorToFile.has(errType)) {
                    this.errorToFile.set(errType, []);
                }
                if (!this.errorToFile.get(errType)!.includes(fileName)) {
                    this.errorToFile.get(errType)!.push(fileName);
                }
            }

            // Class name → file (often file is named after class)
            const classes = inst.problem_statement.match(/class\s+(\w+)/gi) || [];
            for (const cls of classes) {
                const className = cls.replace(/class\s+/i, '').toLowerCase();
                this.classToFile.set(className, fileName);
            }

            // Module → file
            const modules = inst.problem_statement.match(/from\s+([\w.]+)\s+import/g) || [];
            for (const mod of modules) {
                const moduleName = mod.replace(/from\s+/, '').replace(/\s+import/, '');
                const expectedFile = moduleName.split('.').pop() + '.py';
                this.moduleToFile.set(moduleName, fileName);
            }
        }
    }

    /**
     * Predict with specialized knowledge
     */
    predict(problem: string): { file: string; confidence: number; method: string } {
        // Strategy 1: Keyword matching (strongest signal)
        const keywords = this.extractKeywords(problem);
        const fileScores: Map<string, number> = new Map();

        for (const kw of keywords) {
            const fileMap = this.keywordToFile.get(kw);
            if (fileMap) {
                for (const [file, count] of fileMap) {
                    // Weight by both keyword match count and file frequency
                    const fileFreq = this.fileFrequency.get(file) || 1;
                    const score = count * Math.log(fileFreq + 1);
                    fileScores.set(file, (fileScores.get(file) || 0) + score);
                }
            }
        }

        if (fileScores.size > 0) {
            const sorted = Array.from(fileScores.entries()).sort((a, b) => b[1] - a[1]);
            const topScore = sorted[0][1];
            const secondScore = sorted[1]?.[1] || 0;

            // Only use if clear winner
            if (topScore > 2 && (sorted.length === 1 || topScore > secondScore * 1.5)) {
                return {
                    file: sorted[0][0],
                    confidence: Math.min(0.9, topScore * 0.1),
                    method: 'keyword-match',
                };
            }
        }

        // Strategy 2: Error type lookup
        const errorMatch = problem.match(/\w+Error|\w+Exception/);
        if (errorMatch) {
            const files = this.errorToFile.get(errorMatch[0]);
            if (files && files.length > 0) {
                return {
                    file: files[0],
                    confidence: 0.5,
                    method: 'error-lookup',
                };
            }
        }

        // Strategy 3: Module → file mapping
        const moduleMatch = problem.match(/from\s+([\w.]+)\s+import/);
        if (moduleMatch) {
            const moduleName = moduleMatch[1];
            const file = this.moduleToFile.get(moduleName);
            if (file) {
                return { file, confidence: 0.6, method: 'module-lookup' };
            }
        }

        // Strategy 4: Most common file (domain prior)
        const sorted = Array.from(this.fileFrequency.entries()).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
            return {
                file: sorted[0][0],
                confidence: 0.3,
                method: 'domain-prior',
            };
        }

        // Strategy 5: Baseline regex
        const fileMatch = problem.match(/[\w\/]+\.py/);
        if (fileMatch) {
            return { file: fileMatch[0].split('/').pop() || fileMatch[0], confidence: 0.4, method: 'baseline' };
        }

        return { file: 'unknown.py', confidence: 0.1, method: 'fallback' };
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

        // Also extract special patterns
        const methods = text.match(/\.(\w+)\(/g) || [];
        const attributes = text.match(/\.(\w+)(?!\()/g) || [];

        return [...new Set([
            ...words.slice(0, 40),
            ...methods.map(m => m.replace(/[.()]/g, '').toLowerCase()),
            ...attributes.map(a => a.replace('.', '').toLowerCase()).slice(0, 10),
        ])];
    }

    private isStopWord(word: string): boolean {
        const stops = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'were', 'when', 'what', 'which', 'should', 'would', 'could', 'there', 'their', 'about', 'after', 'before', 'using', 'where', 'being', 'some', 'like', 'just', 'also', 'here', 'work', 'does', 'want', 'need', 'make', 'made']);
        return stops.has(word);
    }

    getStats() {
        return {
            repo: this.repo,
            trainingSize: this.trainingSize,
            keywords: this.keywordToFile.size,
            files: this.fileFrequency.size,
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
    console.log('HYPER-TARGETED TRAINING V2');
    console.log('Per-repo train/test split for proper evaluation');
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

    console.log(`\n📊 Repository Distribution:`);
    const sortedRepos = Array.from(byRepo.entries()).sort((a, b) => b[1].length - a[1].length);
    for (const [repo, instances] of sortedRepos) {
        const bar = '█'.repeat(Math.floor(instances.length / 3));
        console.log(`  ${repo.padEnd(30)} ${instances.length.toString().padStart(3)} ${bar}`);
    }

    // Split EACH repo 60/40 for train/test
    const trainInstances: SWEBenchInstance[] = [];
    const testInstances: SWEBenchInstance[] = [];

    for (const [repo, instances] of byRepo) {
        const splitIdx = Math.floor(instances.length * 0.6);
        trainInstances.push(...instances.slice(0, splitIdx));
        testInstances.push(...instances.slice(splitIdx));
    }

    console.log(`\n  Per-repo split: Train ${trainInstances.length}, Test ${testInstances.length}`);

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
    // HYPER-TARGETED MICRO-MODELS
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('HYPER-TARGETED MICRO-MODELS');
    console.log('='.repeat(70));

    // Train a micro-model for each repo
    const models = new Map<string, RepoMicroModel>();

    console.log('\n  Training micro-models:');
    for (const [repo, instances] of byRepo) {
        const trainCount = Math.floor(instances.length * 0.6);
        const model = new RepoMicroModel(repo);
        model.train(instances.slice(0, trainCount));
        models.set(repo, model);

        const stats = model.getStats();
        console.log(`    ${repo.substring(0, 25).padEnd(26)}: ${stats.trainingSize} samples, ${stats.keywords} keywords, ${stats.files} files`);
    }

    // Evaluate
    console.log('\n  Evaluating...');
    let microCorrect = 0;
    const microByRepo: Map<string, { correct: number; total: number }> = new Map();
    const methodCounts: Record<string, { total: number; correct: number }> = {};

    for (const inst of testInstances) {
        const gold = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
        const model = models.get(inst.repo);

        let pred: { file: string; confidence: number; method: string };
        if (model) {
            pred = model.predict(inst.problem_statement);
        } else {
            pred = { file: baseline(inst.problem_statement), confidence: 0.3, method: 'no-model' };
        }

        if (!microByRepo.has(inst.repo)) {
            microByRepo.set(inst.repo, { correct: 0, total: 0 });
        }
        microByRepo.get(inst.repo)!.total++;

        if (!methodCounts[pred.method]) {
            methodCounts[pred.method] = { total: 0, correct: 0 };
        }
        methodCounts[pred.method].total++;

        if (fileMatches(pred.file, gold)) {
            microCorrect++;
            microByRepo.get(inst.repo)!.correct++;
            methodCounts[pred.method].correct++;
        }
    }

    const microAcc = microCorrect / testInstances.length;
    console.log(`\n  Overall: ${microCorrect}/${testInstances.length} = ${(microAcc * 100).toFixed(1)}%`);

    console.log('\n  By Method:');
    for (const [method, stats] of Object.entries(methodCounts).sort((a, b) => b[1].total - a[1].total)) {
        const acc = stats.total > 0 ? (stats.correct / stats.total * 100).toFixed(1) : '0.0';
        console.log(`    ${method.padEnd(18)}: ${acc}% (${stats.correct}/${stats.total})`);
    }

    // ========================================================================
    // PER-REPOSITORY COMPARISON
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('PER-REPOSITORY COMPARISON');
    console.log('='.repeat(70));

    console.log('\n  Repository                      Baseline   Micro    Δ       Status');
    console.log('  ' + '-'.repeat(70));

    const repoResults: Array<{ repo: string; baseAcc: number; microAcc: number; diff: number }> = [];

    for (const [repo, baseStats] of baselineByRepo) {
        const microStats = microByRepo.get(repo) || { correct: 0, total: 0 };
        const baseAcc = baseStats.total > 0 ? baseStats.correct / baseStats.total : 0;
        const mAcc = microStats.total > 0 ? microStats.correct / microStats.total : 0;
        const diff = mAcc - baseAcc;

        repoResults.push({ repo, baseAcc, microAcc: mAcc, diff });
    }

    repoResults.sort((a, b) => b.diff - a.diff);

    for (const r of repoResults) {
        const status = r.diff > 0.01 ? '✅ IMPROVED' : r.diff < -0.01 ? '⚠️ DEGRADED' : '➖ SAME';
        const diffStr = r.diff >= 0 ? `+${(r.diff * 100).toFixed(1)}%` : `${(r.diff * 100).toFixed(1)}%`;
        console.log(`  ${r.repo.substring(0, 28).padEnd(30)} ${(r.baseAcc * 100).toFixed(1).padStart(6)}%  ${(r.microAcc * 100).toFixed(1).padStart(6)}%  ${diffStr.padStart(7)}  ${status}`);
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
    const overallDiff = microAcc - baselineAcc;

    console.log('\n┌───────────────────────────────┬──────────┬─────────────────┐');
    console.log('│ Configuration                 │ Accuracy │ vs Baseline     │');
    console.log('├───────────────────────────────┼──────────┼─────────────────┤');
    console.log(`│ Baseline                      │ ${(baselineAcc * 100).toFixed(1).padStart(6)}% │       -         │`);
    console.log(`│ Hyper-Targeted Micro-Models   │ ${(microAcc * 100).toFixed(1).padStart(6)}% │ ${overallDiff >= 0 ? '+' : ''}${(overallDiff * 100).toFixed(1)}%          │`);
    console.log('└───────────────────────────────┴──────────┴─────────────────┘');

    console.log(`\n📊 Per-Repository Results:`);
    console.log(`  ✅ Improved: ${improved}/${repoResults.length} repos`);
    console.log(`  ⚠️ Degraded: ${degraded}/${repoResults.length} repos`);
    console.log(`  ➖ Same: ${same}/${repoResults.length} repos`);

    if (overallDiff > 0) {
        console.log(`\n✅ HYPER-TARGETED TRAINING IMPROVED: +${(overallDiff * 100).toFixed(1)}% overall`);
    } else {
        console.log(`\n⚠️ Overall: ${(overallDiff * 100).toFixed(1)}%`);
    }

    // Best improvements
    const topImproved = repoResults.filter(r => r.diff > 0).slice(0, 3);
    if (topImproved.length > 0) {
        console.log('\n🏆 Best Improvements:');
        for (const r of topImproved) {
            console.log(`  ${r.repo}: ${(r.baseAcc * 100).toFixed(1)}% → ${(r.microAcc * 100).toFixed(1)}% (+${(r.diff * 100).toFixed(1)}%)`);
        }
    }

    // Save results
    const results = {
        timestamp: new Date().toISOString(),
        version: 'hyper-targeted-v2',
        dataset: { total: sweInstances.length, train: trainInstances.length, test: testInstances.length },
        baseline: { accuracy: baselineAcc, correct: baselineCorrect },
        microModel: { accuracy: microAcc, correct: microCorrect, byMethod: methodCounts },
        perRepo: repoResults,
        summary: { improved, degraded, same, overallDiff },
        provenance: {
            hash: crypto.createHash('sha256')
                .update(JSON.stringify({ baselineAcc, microAcc }))
                .digest('hex').substring(0, 32),
        },
    };

    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    const resultsPath = path.join(resultsDir, `hyper-targeted-v2-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);
}

main().catch(console.error);
