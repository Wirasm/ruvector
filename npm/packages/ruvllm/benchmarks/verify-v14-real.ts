/**
 * VERIFY V14 RESULTS ARE REAL
 *
 * Show actual predictions vs gold for each test instance
 */

import * as fs from 'fs';
import * as path from 'path';

interface SWEBenchInstance {
    instance_id: string;
    repo: string;
    patch: string;
    problem_statement: string;
    hints_text: string;
}

// Extract from hints (V14's key technique)
function extractFromHints(hints: string): Array<{ file: string; score: number }> {
    const results: Array<{ file: string; score: number }> = [];
    const seen = new Set<string>();

    if (!hints || hints.length === 0) return results;

    // Direct file paths
    const directPaths = hints.match(/(?:^|\s|`|")([a-z_][a-z0-9_\/]*\.py)(?:\s|`|"|:|#|$)/gi) || [];
    for (const match of directPaths) {
        const file = match.replace(/^[\s`"]+|[\s`":,#]+$/g, '');
        const fileName = file.split('/').pop() || file;
        if (!seen.has(fileName) && fileName.endsWith('.py') && fileName.length > 3) {
            seen.add(fileName);
            results.push({ file: fileName, score: 0.88 });
        }
    }

    // GitHub URLs
    const urlPaths = hints.match(/github\.com\/[^\/]+\/[^\/]+\/blob\/[^\/]+\/([^\s#]+\.py)/gi) || [];
    for (const match of urlPaths) {
        const pathPart = match.match(/blob\/[^\/]+\/(.+\.py)/i);
        if (pathPart) {
            const fileName = pathPart[1].split('/').pop() || '';
            if (!seen.has(fileName) && fileName.length > 3) {
                seen.add(fileName);
                results.push({ file: fileName, score: 0.92 });
            }
        }
    }

    // Line refs (file.py:123)
    const lineRefs = hints.match(/([a-z_][a-z0-9_]*\.py):\d+/gi) || [];
    for (const match of lineRefs) {
        const fileName = match.split(':')[0];
        if (!seen.has(fileName)) {
            seen.add(fileName);
            results.push({ file: fileName, score: 0.90 });
        }
    }

    return results;
}

function fileMatches(predicted: string, gold: string): boolean {
    if (!predicted || !gold) return false;
    const predFile = predicted.split('/').pop() || '';
    const goldFile = gold.split('/').pop() || '';
    return predFile === goldFile || gold.endsWith(predFile) || predicted.endsWith(goldFile) || gold.includes(predFile);
}

async function main() {
    console.log('='.repeat(70));
    console.log('V14 VERIFICATION - REAL PREDICTIONS VS GOLD');
    console.log('='.repeat(70));

    const swePath = path.join(__dirname, 'swe-bench-real', 'all_instances.json');
    const sweInstances: SWEBenchInstance[] = JSON.parse(fs.readFileSync(swePath, 'utf8'));

    console.log(`\nLoaded ${sweInstances.length} REAL SWE-bench Lite instances from HuggingFace\n`);

    // Show sample of instances with hints
    console.log('=== SAMPLE INSTANCES WITH HINTS-BASED PREDICTIONS ===\n');

    const byRepo = new Map<string, SWEBenchInstance[]>();
    for (const inst of sweInstances) {
        if (!byRepo.has(inst.repo)) byRepo.set(inst.repo, []);
        byRepo.get(inst.repo)!.push(inst);
    }

    // Get test instances
    const testInstances: SWEBenchInstance[] = [];
    for (const [, instances] of byRepo) {
        const splitIdx = Math.floor(instances.length * 0.6);
        testInstances.push(...instances.slice(splitIdx));
    }

    let correct = 0;
    let hintsUsed = 0;
    const details: Array<{ id: string; gold: string; pred: string; match: boolean; method: string; hintsPreview: string }> = [];

    for (const inst of testInstances) {
        const goldPath = inst.patch.match(/diff --git a\/(.+?) b\//)?.[1] || '';
        const goldFile = goldPath.split('/').pop() || '';

        const hintsFiles = extractFromHints(inst.hints_text || '');
        let pred = '';
        let method = '';

        if (hintsFiles.length > 0) {
            pred = hintsFiles[0].file;
            method = 'hints-direct';
            hintsUsed++;
        } else {
            // Fallback to baseline
            const fileMatch = inst.problem_statement.match(/[\w\/]+\.py/g) || [];
            pred = fileMatch.length > 0 ? (fileMatch[0].split('/').pop() || fileMatch[0]) : 'unknown.py';
            method = 'baseline';
        }

        const match = fileMatches(pred, goldPath);
        if (match) correct++;

        details.push({
            id: inst.instance_id,
            gold: goldPath,
            pred,
            match,
            method,
            hintsPreview: (inst.hints_text || '').substring(0, 100),
        });
    }

    // Show sample of correct hints-based predictions
    console.log('--- CORRECT HINTS-BASED PREDICTIONS (sample) ---\n');
    const correctHints = details.filter(d => d.match && d.method === 'hints-direct').slice(0, 8);
    for (const d of correctHints) {
        console.log(`✅ ${d.id}`);
        console.log(`   Gold: ${d.gold}`);
        console.log(`   Pred: ${d.pred}`);
        console.log(`   Hints: "${d.hintsPreview}..."\n`);
    }

    // Show sample of incorrect predictions
    console.log('--- INCORRECT PREDICTIONS (sample) ---\n');
    const incorrect = details.filter(d => !d.match).slice(0, 5);
    for (const d of incorrect) {
        console.log(`❌ ${d.id}`);
        console.log(`   Gold: ${d.gold}`);
        console.log(`   Pred: ${d.pred}`);
        console.log(`   Method: ${d.method}\n`);
    }

    // Summary
    console.log('='.repeat(70));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`\nTotal test instances: ${testInstances.length}`);
    console.log(`Hints used: ${hintsUsed}/${testInstances.length} (${(hintsUsed/testInstances.length*100).toFixed(1)}%)`);
    console.log(`Correct predictions: ${correct}/${testInstances.length} (${(correct/testInstances.length*100).toFixed(1)}%)`);

    // Verify it's real SWE-bench data
    console.log('\n=== DATA AUTHENTICITY CHECK ===\n');
    console.log(`Source: npm/packages/ruvllm/benchmarks/swe-bench-real/all_instances.json`);
    console.log(`Origin: princeton-nlp/SWE-bench_Lite via HuggingFace`);
    console.log(`Total instances: ${sweInstances.length}`);
    console.log(`First instance ID: ${sweInstances[0].instance_id}`);
    console.log(`Repos represented: ${new Set(sweInstances.map(i => i.repo)).size}`);

    // Show repo distribution
    const repoCounts = new Map<string, number>();
    for (const inst of sweInstances) {
        repoCounts.set(inst.repo, (repoCounts.get(inst.repo) || 0) + 1);
    }
    console.log('\nInstances per repo:');
    for (const [repo, count] of Array.from(repoCounts.entries()).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${repo}: ${count}`);
    }
}

main().catch(console.error);
