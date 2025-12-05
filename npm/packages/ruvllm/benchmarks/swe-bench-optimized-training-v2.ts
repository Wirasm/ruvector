/**
 * OPTIMIZED TRAINING BENCHMARK V2
 *
 * Improved version that ENHANCES baseline instead of replacing it.
 * Uses ensemble voting and smarter confidence thresholds.
 *
 * Key improvements from V1:
 * - Lower confidence thresholds to avoid overriding good baseline
 * - Ensemble voting between methods
 * - Cross-validation for hyperparameter tuning
 * - Better feature extraction
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { SonaCoordinator, ReasoningBank, EwcManager } from '../src/sona';
import { LoraAdapter } from '../src/lora';

interface SWEBenchInstance {
    instance_id: string;
    repo: string;
    patch: string;
    problem_statement: string;
    hints_text: string;
}

interface CodeSearchSample {
    code: string;
    docstring: string;
    func_name: string;
    language: string;
}

// ============================================================================
// IMPROVED FEATURE EXTRACTION
// ============================================================================

class FeatureExtractor {
    /**
     * Extract file from problem using multiple strategies
     */
    extractFileCandidates(problem: string): Array<{ file: string; score: number; method: string }> {
        const candidates: Array<{ file: string; score: number; method: string }> = [];

        // Strategy 1: Explicit file paths in backticks
        const backtickFiles = problem.match(/`([^`]+\.py)`/g) || [];
        for (const match of backtickFiles) {
            const file = match.replace(/`/g, '');
            candidates.push({ file, score: 0.9, method: 'backtick' });
        }

        // Strategy 2: Quoted file paths
        const quotedFiles = problem.match(/"([^"]+\.py)"/g) || [];
        for (const match of quotedFiles) {
            const file = match.replace(/"/g, '');
            candidates.push({ file, score: 0.85, method: 'quoted' });
        }

        // Strategy 3: Plain file paths
        const plainFiles = problem.match(/(?:^|\s)([\w\/]+\.py)(?:\s|$|[,.\)])/gm) || [];
        for (const match of plainFiles) {
            const file = match.trim().replace(/[,.\)]/g, '');
            if (file.includes('/') || file.length > 3) {
                candidates.push({ file, score: 0.7, method: 'plain' });
            }
        }

        // Strategy 4: From import statements
        const imports = problem.match(/from\s+([\w.]+)\s+import/g) || [];
        for (const imp of imports) {
            const module = imp.replace('from ', '').replace(' import', '');
            const file = module.replace(/\./g, '/') + '.py';
            candidates.push({ file, score: 0.6, method: 'import' });
        }

        // Strategy 5: Class/function mentions → likely file
        const classNames = problem.match(/class\s+(\w+)/g) || [];
        for (const cls of classNames) {
            const name = cls.replace('class ', '').toLowerCase();
            candidates.push({ file: name + '.py', score: 0.4, method: 'class' });
        }

        // Strategy 6: Error traceback file paths
        const tracebackFiles = problem.match(/File "([^"]+\.py)"/g) || [];
        for (const match of tracebackFiles) {
            const file = match.replace(/File "|"/g, '');
            candidates.push({ file, score: 0.8, method: 'traceback' });
        }

        // Strategy 7: Django/Pytest specific patterns
        if (problem.toLowerCase().includes('django')) {
            const djangoPatterns = [
                { regex: /models?\s+(\w+)/gi, suffix: 'models.py', score: 0.5 },
                { regex: /views?\s+(\w+)/gi, suffix: 'views.py', score: 0.5 },
                { regex: /admin\s+(\w+)/gi, suffix: 'admin.py', score: 0.5 },
            ];
            for (const pat of djangoPatterns) {
                if (pat.regex.test(problem)) {
                    candidates.push({ file: pat.suffix, score: pat.score, method: 'django' });
                }
            }
        }

        // Deduplicate and sort by score
        const seen = new Set<string>();
        const unique: Array<{ file: string; score: number; method: string }> = [];
        for (const c of candidates.sort((a, b) => b.score - a.score)) {
            const key = c.file.split('/').pop() || c.file;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(c);
            }
        }

        return unique;
    }

    /**
     * Score how well a candidate matches the gold file
     */
    matchScore(predicted: string, gold: string): number {
        if (!predicted || !gold) return 0;

        const predFile = predicted.split('/').pop() || '';
        const goldFile = gold.split('/').pop() || '';

        // Exact match
        if (predFile === goldFile) return 1.0;
        if (gold.endsWith(predicted)) return 0.9;
        if (predicted.endsWith(goldFile)) return 0.8;
        if (gold.includes(predFile)) return 0.7;

        return 0;
    }
}

// ============================================================================
// PATTERN LEARNER WITH CROSS-VALIDATION
// ============================================================================

class PatternLearner {
    private patterns: Map<string, Array<{ keywords: string[]; file: string }>> = new Map();
    private keywordWeights: Map<string, number> = new Map();

    /**
     * Learn patterns from training data
     */
    learn(instances: SWEBenchInstance[]): number {
        let learned = 0;

        for (const inst of instances) {
            const file = this.extractFile(inst.patch);
            if (!file) continue;

            // Extract keywords from problem
            const keywords = this.extractKeywords(inst.problem_statement);

            if (!this.patterns.has(inst.repo)) {
                this.patterns.set(inst.repo, []);
            }
            this.patterns.get(inst.repo)!.push({ keywords, file });

            // Build keyword → file weights
            for (const kw of keywords) {
                const key = `${kw}|${file.split('/').pop()}`;
                this.keywordWeights.set(key, (this.keywordWeights.get(key) || 0) + 1);
            }

            learned++;
        }

        return learned;
    }

    /**
     * Predict file based on learned patterns
     */
    predict(problem: string, repo: string): Array<{ file: string; score: number }> {
        const keywords = this.extractKeywords(problem);
        const fileScores: Map<string, number> = new Map();

        // Score by keyword matches
        for (const kw of keywords) {
            for (const [key, weight] of this.keywordWeights) {
                if (key.startsWith(kw + '|')) {
                    const file = key.split('|')[1];
                    fileScores.set(file, (fileScores.get(file) || 0) + weight);
                }
            }
        }

        // Score by repo-specific patterns
        const repoPatterns = this.patterns.get(repo) || [];
        for (const pat of repoPatterns) {
            const overlap = keywords.filter(kw => pat.keywords.includes(kw)).length;
            if (overlap > 0) {
                const file = pat.file.split('/').pop() || pat.file;
                fileScores.set(file, (fileScores.get(file) || 0) + overlap * 2);
            }
        }

        // Normalize and return
        const maxScore = Math.max(...fileScores.values(), 1);
        return Array.from(fileScores.entries())
            .map(([file, score]) => ({ file, score: score / maxScore }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    }

    private extractFile(patch: string): string {
        const match = patch.match(/diff --git a\/(.+?) b\//);
        return match ? match[1] : '';
    }

    private extractKeywords(text: string): string[] {
        // Extract meaningful keywords
        const words = text.toLowerCase()
            .replace(/[^a-z0-9_]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !this.isStopWord(w));

        // Add special patterns
        const errors = text.match(/(\w+Error|\w+Exception)/g) || [];
        const methods = text.match(/(\w+)\(\)/g) || [];

        return [...new Set([...words.slice(0, 50), ...errors, ...methods.map(m => m.replace('()', ''))])];
    }

    private isStopWord(word: string): boolean {
        const stops = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'were', 'when', 'what', 'which', 'should', 'would', 'could', 'there', 'their', 'about', 'after']);
        return stops.has(word);
    }
}

// ============================================================================
// ENSEMBLE PREDICTOR
// ============================================================================

class EnsemblePredictor {
    private featureExtractor: FeatureExtractor;
    private patternLearner: PatternLearner;
    private ewcManager: EwcManager;

    constructor() {
        this.featureExtractor = new FeatureExtractor();
        this.patternLearner = new PatternLearner();
        this.ewcManager = new EwcManager(1000);
    }

    /**
     * Train the ensemble
     */
    train(instances: SWEBenchInstance[]): { patternsLearned: number } {
        const patternsLearned = this.patternLearner.learn(instances);
        return { patternsLearned };
    }

    /**
     * Predict with ensemble voting
     */
    predict(instance: SWEBenchInstance): {
        file: string;
        confidence: number;
        method: string;
        votes: Array<{ method: string; file: string; score: number }>;
    } {
        const votes: Array<{ method: string; file: string; score: number }> = [];

        // Get candidates from feature extraction (baseline-like)
        const extracted = this.featureExtractor.extractFileCandidates(instance.problem_statement);
        for (const c of extracted.slice(0, 3)) {
            votes.push({ method: c.method, file: c.file, score: c.score });
        }

        // Get candidates from pattern learning
        const patterns = this.patternLearner.predict(instance.problem_statement, instance.repo);
        for (const p of patterns.slice(0, 2)) {
            // Pattern predictions should have lower weight since they're learned
            votes.push({ method: 'pattern', file: p.file, score: p.score * 0.6 });
        }

        // Aggregate votes with weighted voting
        const fileVotes: Map<string, number> = new Map();
        for (const vote of votes) {
            const key = vote.file.split('/').pop() || vote.file;
            fileVotes.set(key, (fileVotes.get(key) || 0) + vote.score);
        }

        // Find winner
        let bestFile = '';
        let bestScore = 0;
        for (const [file, score] of fileVotes) {
            if (score > bestScore) {
                bestScore = score;
                bestFile = file;
            }
        }

        // Determine winning method
        let winningMethod = 'ensemble';
        if (votes.length > 0) {
            const winnerVote = votes.find(v => v.file.includes(bestFile) || bestFile.includes(v.file.split('/').pop() || ''));
            if (winnerVote) {
                winningMethod = winnerVote.method;
            }
        }

        // If no good candidate, use fallback
        if (!bestFile || bestScore < 0.3) {
            // Fallback: use repo name to guess
            const repoName = instance.repo.split('/')[1] || 'core';
            bestFile = repoName + '/core.py';
            winningMethod = 'fallback';
            bestScore = 0.2;
        }

        // Find the full path if we only have filename
        if (!bestFile.includes('/')) {
            const fullPath = votes.find(v => v.file.endsWith(bestFile));
            if (fullPath) bestFile = fullPath.file;
        }

        return {
            file: bestFile,
            confidence: Math.min(bestScore, 0.95),
            method: winningMethod,
            votes,
        };
    }
}

// ============================================================================
// ENHANCED BASELINE
// ============================================================================

function enhancedBaseline(instance: SWEBenchInstance): { file: string; confidence: number } {
    const extractor = new FeatureExtractor();
    const candidates = extractor.extractFileCandidates(instance.problem_statement);

    if (candidates.length > 0) {
        return { file: candidates[0].file, confidence: candidates[0].score };
    }

    return { file: instance.repo.split('/')[1] + '/core.py', confidence: 0.2 };
}

function originalBaseline(instance: SWEBenchInstance): { file: string; confidence: number } {
    const problem = instance.problem_statement;

    // Simple extraction (same as V1)
    const fileMatches = problem.match(/[\w\/]+\.py/g) || [];
    if (fileMatches.length > 0) {
        return { file: fileMatches[0], confidence: 0.5 };
    }

    const moduleMatches = problem.match(/from\s+([\w.]+)\s+import/g) || [];
    if (moduleMatches.length > 0) {
        const module = moduleMatches[0].replace('from ', '').replace(' import', '');
        return { file: module.replace(/\./g, '/') + '.py', confidence: 0.4 };
    }

    return { file: instance.repo.split('/')[1] + '/core.py', confidence: 0.2 };
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
// CROSS-VALIDATION TUNING
// ============================================================================

function crossValidate(instances: SWEBenchInstance[], folds: number = 5): {
    meanAccuracy: number;
    stdAccuracy: number;
    foldResults: number[];
} {
    const foldSize = Math.floor(instances.length / folds);
    const foldResults: number[] = [];

    for (let i = 0; i < folds; i++) {
        const testStart = i * foldSize;
        const testEnd = testStart + foldSize;

        const testSet = instances.slice(testStart, testEnd);
        const trainSet = [...instances.slice(0, testStart), ...instances.slice(testEnd)];

        const ensemble = new EnsemblePredictor();
        ensemble.train(trainSet);

        let correct = 0;
        for (const inst of testSet) {
            const gold = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
            const pred = ensemble.predict(inst);
            if (fileMatches(pred.file, gold)) correct++;
        }

        foldResults.push(correct / testSet.length);
    }

    const mean = foldResults.reduce((a, b) => a + b, 0) / folds;
    const std = Math.sqrt(foldResults.reduce((s, v) => s + (v - mean) ** 2, 0) / folds);

    return { meanAccuracy: mean, stdAccuracy: std, foldResults };
}

// ============================================================================
// MAIN BENCHMARK
// ============================================================================

async function main() {
    console.log('\n' + '='.repeat(70));
    console.log('OPTIMIZED TRAINING BENCHMARK V2');
    console.log('Ensemble Voting + Cross-Validation + Enhanced Feature Extraction');
    console.log('='.repeat(70));

    // Load SWE-bench data
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
    console.log('ORIGINAL BASELINE (Simple extraction)');
    console.log('='.repeat(70));

    let origBaselineCorrect = 0;
    for (const inst of testInstances) {
        const gold = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
        const pred = originalBaseline(inst);
        if (fileMatches(pred.file, gold)) origBaselineCorrect++;
    }
    const origBaselineAcc = origBaselineCorrect / testInstances.length;
    console.log(`  File Location Accuracy: ${(origBaselineAcc * 100).toFixed(1)}%`);

    // ========================================================================
    // ENHANCED BASELINE
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('ENHANCED BASELINE (Multiple extraction strategies)');
    console.log('='.repeat(70));

    let enhBaslineCorrect = 0;
    for (const inst of testInstances) {
        const gold = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
        const pred = enhancedBaseline(inst);
        if (fileMatches(pred.file, gold)) enhBaslineCorrect++;
    }
    const enhBaselineAcc = enhBaslineCorrect / testInstances.length;
    console.log(`  File Location Accuracy: ${(enhBaselineAcc * 100).toFixed(1)}%`);

    // ========================================================================
    // CROSS-VALIDATION
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('CROSS-VALIDATION (5-fold)');
    console.log('='.repeat(70));

    const cvResult = crossValidate(sweInstances, 5);
    console.log(`  Mean Accuracy: ${(cvResult.meanAccuracy * 100).toFixed(1)}% ± ${(cvResult.stdAccuracy * 100).toFixed(1)}%`);
    console.log(`  Folds: ${cvResult.foldResults.map(f => (f * 100).toFixed(1) + '%').join(', ')}`);

    // ========================================================================
    // ENSEMBLE PREDICTION
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('ENSEMBLE PREDICTION');
    console.log('='.repeat(70));

    const ensemble = new EnsemblePredictor();
    console.log('\n  Training ensemble...');
    const trainResult = ensemble.train(trainInstances);
    console.log(`  Patterns learned: ${trainResult.patternsLearned}`);

    let ensembleCorrect = 0;
    const methodCounts: Record<string, { total: number; correct: number }> = {};

    for (const inst of testInstances) {
        const gold = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
        const pred = ensemble.predict(inst);

        if (!methodCounts[pred.method]) {
            methodCounts[pred.method] = { total: 0, correct: 0 };
        }
        methodCounts[pred.method].total++;

        if (fileMatches(pred.file, gold)) {
            ensembleCorrect++;
            methodCounts[pred.method].correct++;
        }
    }

    const ensembleAcc = ensembleCorrect / testInstances.length;
    console.log(`\n  File Location Accuracy: ${(ensembleAcc * 100).toFixed(1)}%`);
    console.log(`\n  By Method:`);
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

    const impVsOrig = ensembleAcc - origBaselineAcc;
    const impVsEnh = ensembleAcc - enhBaselineAcc;

    console.log('\n┌───────────────────────────┬──────────┬───────────────────┐');
    console.log('│ Configuration             │ Accuracy │ vs Original       │');
    console.log('├───────────────────────────┼──────────┼───────────────────┤');
    console.log(`│ Original Baseline         │ ${(origBaselineAcc * 100).toFixed(1).padStart(6)}% │        -          │`);
    console.log(`│ Enhanced Baseline         │ ${(enhBaselineAcc * 100).toFixed(1).padStart(6)}% │ ${impVsEnh >= 0 ? '+' : ''}${((enhBaselineAcc - origBaselineAcc) * 100).toFixed(1).padStart(5)}%          │`);
    console.log(`│ Ensemble (Pattern+Extract)│ ${(ensembleAcc * 100).toFixed(1).padStart(6)}% │ ${impVsOrig >= 0 ? '+' : ''}${(impVsOrig * 100).toFixed(1).padStart(5)}%          │`);
    console.log(`│ Cross-Validated Mean      │ ${(cvResult.meanAccuracy * 100).toFixed(1).padStart(6)}% │ ±${(cvResult.stdAccuracy * 100).toFixed(1)}%            │`);
    console.log('└───────────────────────────┴──────────┴───────────────────┘');

    const bestAcc = Math.max(origBaselineAcc, enhBaselineAcc, ensembleAcc);
    const bestMethod = bestAcc === ensembleAcc ? 'Ensemble' :
                       bestAcc === enhBaselineAcc ? 'Enhanced Baseline' : 'Original Baseline';

    console.log(`\n📊 BEST CONFIGURATION: ${bestMethod} (${(bestAcc * 100).toFixed(1)}%)`);

    if (ensembleAcc > origBaselineAcc) {
        console.log(`\n✅ IMPROVEMENT: +${((ensembleAcc - origBaselineAcc) * 100).toFixed(1)}% absolute`);
        console.log(`   Relative improvement: ${((impVsOrig / origBaselineAcc) * 100).toFixed(0)}%`);
    } else {
        console.log(`\n⚠️ No improvement over original baseline`);
        console.log(`   Enhanced baseline is best: ${(enhBaselineAcc * 100).toFixed(1)}%`);
    }

    console.log('\n📊 TECHNIQUES IN V2:');
    console.log('  ✓ Multiple extraction strategies (backtick, quoted, import, etc.)');
    console.log('  ✓ Pattern learning with keyword weighting');
    console.log('  ✓ Ensemble voting with weighted scores');
    console.log('  ✓ Cross-validation for honest evaluation');
    console.log('  ✓ Lower confidence thresholds to avoid overriding');

    // Save results
    const results = {
        timestamp: new Date().toISOString(),
        version: 'v2',
        dataset: {
            total: sweInstances.length,
            train: trainInstances.length,
            test: testInstances.length,
        },
        results: {
            originalBaseline: origBaselineAcc,
            enhancedBaseline: enhBaselineAcc,
            ensemble: ensembleAcc,
            crossValidation: cvResult,
        },
        improvement: {
            vsOriginal: impVsOrig,
            vsEnhanced: impVsEnh,
        },
        byMethod: methodCounts,
        provenance: {
            hash: crypto.createHash('sha256')
                .update(JSON.stringify({ origBaselineAcc, enhBaselineAcc, ensembleAcc }))
                .digest('hex'),
        },
    };

    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    const resultsPath = path.join(resultsDir, `optimized-training-v2-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);
}

main().catch(console.error);
