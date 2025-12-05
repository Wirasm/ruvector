/**
 * HYPER-TARGETED TRAINING V4
 *
 * Key insight from v3: keyword-targeted (4.9%) < baseline-fallback (13.0%)
 * The micro-model HURTS performance when used as primary predictor.
 *
 * NEW STRATEGY: Use micro-model as RANKER, not predictor
 * 1. Extract ALL candidates from problem text (baseline approach)
 * 2. Score candidates using learned domain knowledge
 * 3. Return highest-scored candidate
 *
 * This way, micro-model ENHANCES baseline rather than replacing it.
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
// CANDIDATE EXTRACTOR (Baseline approach)
// ============================================================================

function extractCandidates(problem: string): string[] {
    const candidates = new Set<string>();

    // Strategy 1: Direct .py file mentions
    const pyFiles = problem.match(/[\w\/]+\.py/g) || [];
    for (const f of pyFiles) {
        candidates.add(f.split('/').pop() || f);
    }

    // Strategy 2: From imports
    const imports = problem.match(/from\s+([\w.]+)\s+import/g) || [];
    for (const imp of imports) {
        const module = imp.replace(/from\s+/, '').replace(/\s+import/, '');
        const parts = module.split('.');
        candidates.add(parts[parts.length - 1] + '.py');
    }

    // Strategy 3: Quoted files
    const quoted = problem.match(/"([^"]+\.py)"/g) || [];
    for (const q of quoted) {
        candidates.add(q.replace(/"/g, '').split('/').pop() || '');
    }

    // Strategy 4: Backtick files
    const backticks = problem.match(/`([^`]+\.py)`/g) || [];
    for (const bt of backticks) {
        candidates.add(bt.replace(/`/g, '').split('/').pop() || '');
    }

    return Array.from(candidates).filter(c => c.length > 0 && c.endsWith('.py'));
}

// ============================================================================
// DOMAIN RANKER (Micro-model for scoring)
// ============================================================================

class DomainRanker {
    private repo: string;
    private fileScores: Map<string, number> = new Map();  // file → times seen
    private keywordToFile: Map<string, Map<string, number>> = new Map();
    private trainingSize = 0;

    constructor(repo: string) {
        this.repo = repo;
    }

    train(instances: SWEBenchInstance[]): void {
        this.trainingSize = instances.length;

        for (const inst of instances) {
            const file = this.extractFile(inst.patch);
            if (!file) continue;

            const fileName = file.split('/').pop() || '';

            // Track file frequency
            this.fileScores.set(fileName, (this.fileScores.get(fileName) || 0) + 1);

            // Track keyword → file associations
            const keywords = this.extractKeywords(inst.problem_statement);
            for (const kw of keywords) {
                if (!this.keywordToFile.has(kw)) {
                    this.keywordToFile.set(kw, new Map());
                }
                const fileMap = this.keywordToFile.get(kw)!;
                fileMap.set(fileName, (fileMap.get(fileName) || 0) + 1);
            }
        }
    }

    /**
     * Score a candidate file based on domain knowledge
     */
    score(candidate: string, problem: string): number {
        let score = 0;

        // Base score from file frequency (domain prior)
        const freq = this.fileScores.get(candidate) || 0;
        score += Math.log(freq + 1) * 0.5;

        // Keyword match score
        const keywords = this.extractKeywords(problem);
        for (const kw of keywords) {
            const fileMap = this.keywordToFile.get(kw);
            if (fileMap && fileMap.has(candidate)) {
                score += fileMap.get(candidate)! * 0.3;
            }
        }

        return score;
    }

    /**
     * Rank candidates by domain knowledge
     */
    rank(candidates: string[], problem: string): string[] {
        if (candidates.length === 0) return [];

        const scored = candidates.map(c => ({
            candidate: c,
            score: this.score(c, problem),
        }));

        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.candidate);
    }

    private extractFile(patch: string): string {
        const match = patch.match(/diff --git a\/(.+?) b\//);
        return match ? match[1] : '';
    }

    private extractKeywords(text: string): string[] {
        return text.toLowerCase()
            .replace(/[^a-z0-9_]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !this.isStopWord(w))
            .slice(0, 40);
    }

    private isStopWord(word: string): boolean {
        const stops = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'were', 'when', 'what', 'which', 'should', 'would', 'could', 'there', 'their', 'about', 'after', 'before', 'using', 'where', 'being', 'some', 'like', 'just', 'also', 'here', 'work', 'does', 'want', 'need', 'make', 'made']);
        return stops.has(word);
    }

    getStats() {
        return {
            repo: this.repo,
            trainingSize: this.trainingSize,
            files: this.fileScores.size,
            keywords: this.keywordToFile.size,
        };
    }
}

// ============================================================================
// BASELINE
// ============================================================================

function baseline(problem: string): string {
    const fileMatch = problem.match(/[\w\/]+\.py/g) || [];
    if (fileMatch.length > 0) return fileMatch[0].split('/').pop() || fileMatch[0];

    const moduleMatch = problem.match(/from\s+([\w.]+)\s+import/);
    if (moduleMatch) {
        const parts = moduleMatch[1].split('.');
        return parts[parts.length - 1] + '.py';
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
    console.log('HYPER-TARGETED TRAINING V4');
    console.log('Micro-model as RANKER (score candidates) not predictor');
    console.log('='.repeat(70));

    // Load data
    const swePath = path.join(__dirname, 'swe-bench-real', 'all_instances.json');
    const sweInstances: SWEBenchInstance[] = JSON.parse(fs.readFileSync(swePath, 'utf8'));
    console.log(`\nLoaded ${sweInstances.length} instances`);

    // Group by repo
    const byRepo = new Map<string, SWEBenchInstance[]>();
    for (const inst of sweInstances) {
        if (!byRepo.has(inst.repo)) byRepo.set(inst.repo, []);
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
    // BASELINE (first match)
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('BASELINE (first .py match)');
    console.log('='.repeat(70));

    let baselineCorrect = 0;
    const baselineByRepo: Map<string, { correct: number; total: number }> = new Map();

    for (const inst of testInstances) {
        const gold = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
        const pred = baseline(inst.problem_statement);

        if (!baselineByRepo.has(inst.repo)) baselineByRepo.set(inst.repo, { correct: 0, total: 0 });
        baselineByRepo.get(inst.repo)!.total++;

        if (fileMatches(pred, gold)) {
            baselineCorrect++;
            baselineByRepo.get(inst.repo)!.correct++;
        }
    }

    const baselineAcc = baselineCorrect / testInstances.length;
    console.log(`  Overall: ${baselineCorrect}/${testInstances.length} = ${(baselineAcc * 100).toFixed(1)}%`);

    // ========================================================================
    // RANKED EXTRACTION
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('RANKED EXTRACTION (domain-scored candidates)');
    console.log('='.repeat(70));

    // Train rankers
    const rankers = new Map<string, DomainRanker>();
    console.log('\n  Training domain rankers:');
    for (const [repo, instances] of byRepo) {
        const trainCount = Math.floor(instances.length * 0.6);
        const ranker = new DomainRanker(repo);
        ranker.train(instances.slice(0, trainCount));
        rankers.set(repo, ranker);
        const stats = ranker.getStats();
        console.log(`    ${repo.substring(0, 25).padEnd(26)}: ${stats.files} files, ${stats.keywords} keywords`);
    }

    // Evaluate
    console.log('\n  Evaluating...');
    let rankedCorrect = 0;
    const rankedByRepo: Map<string, { correct: number; total: number }> = new Map();
    let singleCandidate = 0;
    let multiCandidate = 0;
    let noCandidates = 0;

    for (const inst of testInstances) {
        const gold = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
        const candidates = extractCandidates(inst.problem_statement);

        if (!rankedByRepo.has(inst.repo)) rankedByRepo.set(inst.repo, { correct: 0, total: 0 });
        rankedByRepo.get(inst.repo)!.total++;

        let pred: string;

        if (candidates.length === 0) {
            pred = 'unknown.py';
            noCandidates++;
        } else if (candidates.length === 1) {
            pred = candidates[0];
            singleCandidate++;
        } else {
            // Use domain ranker to pick best candidate
            const ranker = rankers.get(inst.repo);
            if (ranker) {
                const ranked = ranker.rank(candidates, inst.problem_statement);
                pred = ranked[0];
            } else {
                pred = candidates[0];  // Fallback to first
            }
            multiCandidate++;
        }

        if (fileMatches(pred, gold)) {
            rankedCorrect++;
            rankedByRepo.get(inst.repo)!.correct++;
        }
    }

    const rankedAcc = rankedCorrect / testInstances.length;
    console.log(`\n  Overall: ${rankedCorrect}/${testInstances.length} = ${(rankedAcc * 100).toFixed(1)}%`);
    console.log(`  Single candidate: ${singleCandidate}, Multi: ${multiCandidate}, None: ${noCandidates}`);

    // ========================================================================
    // PER-REPOSITORY COMPARISON
    // ========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('PER-REPOSITORY COMPARISON');
    console.log('='.repeat(70));

    const repoResults: Array<{ repo: string; baseAcc: number; rankedAcc: number; diff: number }> = [];

    for (const [repo, baseStats] of baselineByRepo) {
        const rankedStats = rankedByRepo.get(repo) || { correct: 0, total: 0 };
        const baseAcc = baseStats.total > 0 ? baseStats.correct / baseStats.total : 0;
        const rAcc = rankedStats.total > 0 ? rankedStats.correct / rankedStats.total : 0;
        repoResults.push({ repo, baseAcc, rankedAcc: rAcc, diff: rAcc - baseAcc });
    }

    repoResults.sort((a, b) => b.diff - a.diff);

    console.log('\n  Repository                      Baseline   Ranked    Δ');
    console.log('  ' + '-'.repeat(60));

    for (const r of repoResults) {
        const status = r.diff > 0.01 ? '✅' : r.diff < -0.01 ? '⚠️' : '➖';
        const diffStr = r.diff >= 0 ? `+${(r.diff * 100).toFixed(1)}%` : `${(r.diff * 100).toFixed(1)}%`;
        console.log(`  ${status} ${r.repo.substring(0, 28).padEnd(30)} ${(r.baseAcc * 100).toFixed(1).padStart(6)}%  ${(r.rankedAcc * 100).toFixed(1).padStart(6)}%  ${diffStr}`);
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
    const overallDiff = rankedAcc - baselineAcc;

    console.log('\n┌───────────────────────────────┬──────────┬─────────────────┐');
    console.log('│ Configuration                 │ Accuracy │ vs Baseline     │');
    console.log('├───────────────────────────────┼──────────┼─────────────────┤');
    console.log(`│ Baseline (first match)        │ ${(baselineAcc * 100).toFixed(1).padStart(6)}% │       -         │`);
    console.log(`│ Ranked (domain-scored)        │ ${(rankedAcc * 100).toFixed(1).padStart(6)}% │ ${overallDiff >= 0 ? '+' : ''}${(overallDiff * 100).toFixed(1)}%          │`);
    console.log('└───────────────────────────────┴──────────┴─────────────────┘');

    console.log(`\n📊 Results: ✅ ${improved}, ⚠️ ${degraded}, ➖ ${same}`);

    if (overallDiff > 0) {
        console.log(`\n✅ RANKED EXTRACTION IMPROVED: +${(overallDiff * 100).toFixed(1)}%`);
    } else if (Math.abs(overallDiff) < 1) {
        console.log(`\n✓ Similar to baseline (${(overallDiff * 100).toFixed(1)}%)`);
    } else {
        console.log(`\n⚠️ Overall: ${(overallDiff * 100).toFixed(1)}%`);
    }

    console.log('\n📋 V4 RANKER STRATEGY:');
    console.log('  ✓ Extract ALL candidate files from problem text');
    console.log('  ✓ Score candidates using learned domain patterns');
    console.log('  ✓ Return highest-scored candidate');
    console.log('  ✓ Domain knowledge ENHANCES baseline, not replaces');

    // Save
    const results = {
        timestamp: new Date().toISOString(),
        version: 'hyper-targeted-v4',
        baseline: { accuracy: baselineAcc },
        ranked: { accuracy: rankedAcc, singleCandidate, multiCandidate, noCandidates },
        perRepo: repoResults,
        summary: { improved, degraded, same, overallDiff },
    };

    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
    const resultsPath = path.join(resultsDir, `hyper-targeted-v4-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);
}

main().catch(console.error);
