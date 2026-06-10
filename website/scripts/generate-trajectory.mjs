/**
 * Fetch trajectory data from HuggingFace and process it to generate
 * trajectory-distribution.json.
 *
 * Note: leaderboard.json AND task-results.json are owned by
 * generate_leaderboard.py (calibrated scores from analysis_outputs CSVs).
 * This script does NOT write either of them — keeping per-task averages
 * in lockstep with the leaderboard.
 *
 * This script runs fetch-data.ps1 first to download raw-rows.json,
 * then processes the data locally.
 *
 * Usage:
 *   node scripts/generate-trajectory.mjs              # fetch + process
 *   node scripts/generate-trajectory.mjs --skip-fetch  # process only (skip download)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DATA = path.resolve(__dirname, '../site-data');

// Display name overrides applied to raw model identifiers from HF rows.
// Keep aligned with website/scripts/generate_leaderboard.py.
const MODEL_RENAME_MAP = {
  'gpt-5.5-medium': 'gpt-5.5',
  'qwen3.6-35b-a3b': 'qwen3.6-flash',
  'qwen3.5-35b-a3b': 'qwen3.5-flash',
};

function renameModel(name) {
  return MODEL_RENAME_MAP[name] || name;
}

function parseTrajectory(trajStr) {
  try {
    return JSON.parse(trajStr);
  } catch {
    return null;
  }
}

function getStepCount(traj) {
  if (!traj || !traj.steps) return 0;
  return traj.steps.length;
}

function normalizeDifficulty(d) {
  const map = { 'E': 'easy', 'M': 'medium', 'H': 'hard' };
  return map[d] || d?.toLowerCase() || d;
}

function getStepLengthBucket(stepCount) {
  if (stepCount <= 5) return '1-5';
  if (stepCount <= 10) return '6-10';
  if (stepCount <= 15) return '11-15';
  if (stepCount <= 20) return '16-20';
  if (stepCount <= 25) return '21-25';
  if (stepCount <= 30) return '26-30';
  if (stepCount <= 35) return '31-35';
  if (stepCount <= 40) return '36-40';
  if (stepCount <= 50) return '41-50';
  return '51+';
}

function processTrajectoryData(rows) {
  const byDifficulty = {};
  const byDomain = {};
  const byFactor = {};
  const byModel = {};
  const stepLengthDistribution = {};

  for (const row of rows) {
    const { difficulty, domain, complexity_factor, trajectory } = row;
    const model_name = renameModel(row.model_name);
    const diff = normalizeDifficulty(difficulty);
    const traj = parseTrajectory(trajectory);
    const stepCount = getStepCount(traj);

    byDifficulty[diff] = (byDifficulty[diff] || 0) + 1;
    byDomain[domain] = (byDomain[domain] || 0) + 1;

    if (Array.isArray(complexity_factor)) {
      for (const f of complexity_factor) {
        byFactor[f] = (byFactor[f] || 0) + 1;
      }
    }

    byModel[model_name] = (byModel[model_name] || 0) + 1;

    // Step length distribution
    const bucket = getStepLengthBucket(stepCount);
    stepLengthDistribution[bucket] = (stepLengthDistribution[bucket] || 0) + 1;
  }

  // Sort step length distribution by bucket order
  const bucketOrder = ['1-5', '6-10', '11-15', '16-20', '21-25', '26-30', '31-35', '36-40', '41-50', '51+'];
  const sortedStepLengthDistribution = {};
  for (const bucket of bucketOrder) {
    if (stepLengthDistribution[bucket] !== undefined) {
      sortedStepLengthDistribution[bucket] = stepLengthDistribution[bucket];
    }
  }

  return { byDifficulty, byDomain, byFactor, byModel, stepLengthDistribution: sortedStepLengthDistribution };
}

function buildTrajectoryDistribution(rows, processed) {
  return {
    updatedAt: new Date().toISOString().split('T')[0],
    totalTrajectories: rows.length,
    byDifficulty: processed.byDifficulty,
    byDomain: processed.byDomain,
    byFactor: processed.byFactor,
    stepLengthDistribution: processed.stepLengthDistribution,
  };
}

// ─── Step 1: Fetch data from HuggingFace (optional) ──────────────────────────
const args = process.argv.slice(2);
const skipFetch = args.includes('--skip-fetch');

if (skipFetch) {
  console.log('⏭️  Skipping data fetch (--skip-fetch flag provided)\n');
} else {
  const fetchScript = path.resolve(__dirname, 'fetch-data.ps1');
  console.log('🌐 Fetching trajectory data from HuggingFace...\n');
  try {
    // Try pwsh (PowerShell Core) first, fall back to powershell (Windows PowerShell)
    let psCmd = 'pwsh';
    try { execSync('pwsh -Version', { stdio: 'pipe' }); } catch { psCmd = 'powershell'; }
    execSync(`${psCmd} -NoProfile -ExecutionPolicy Bypass -File "${fetchScript}"`, { stdio: 'inherit' });
    console.log('\n✅ Data fetch completed\n');
  } catch (e) {
    console.warn(`⚠️  Failed to run fetch-data.ps1: ${e.message}`);
    console.warn('   Continuing with existing raw-rows.json if available...\n');
  }
}

// ─── Step 2: Process trajectory data ─────────────────────────────────────────
const rawPath = path.join(SITE_DATA, 'raw-rows.json');

if (!fs.existsSync(rawPath)) {
  console.error(`❌ ${rawPath} not found. Run without --skip-fetch to download data first.`);
  process.exit(1);
}

console.log('📂 Reading raw data from', rawPath);

let rawContent = fs.readFileSync(rawPath, 'utf-8');
// Strip BOM if present (PowerShell Out-File adds BOM)
if (rawContent.charCodeAt(0) === 0xFEFF) {
  rawContent = rawContent.slice(1);
}
const rows = JSON.parse(rawContent);
console.log(`📊 Loaded ${rows.length} rows`);

// Guard against an empty raw-rows.json (placeholder or failed fetch)
// silently regenerating trajectory-distribution.json with no data.
if (rows.length === 0) {
  console.warn(
    '⚠️  raw-rows.json is empty — skipping trajectory-distribution.json ' +
      'regeneration. Run without --skip-fetch (or repopulate raw-rows.json) ' +
      'before re-running.'
  );
  process.exit(0);
}

console.log('\n📈 Processing trajectory data...');
const processed = processTrajectoryData(rows);

// Build trajectory-distribution.json
const trajectoryDist = buildTrajectoryDistribution(rows, processed);
const trajPath = path.join(SITE_DATA, 'trajectory-distribution.json');
fs.writeFileSync(trajPath, JSON.stringify(trajectoryDist, null, 2));
console.log(`✅ Written ${trajPath}`);

// Summary
console.log('\n📊 Summary:');
console.log(`  Total trajectories: ${trajectoryDist.totalTrajectories}`);
console.log(`  Models: ${Object.keys(processed.byModel).length}`);
console.log(`  Difficulties: ${JSON.stringify(trajectoryDist.byDifficulty)}`);
console.log(`  Domains: ${Object.keys(trajectoryDist.byDomain).join(', ')}`);
console.log(`  Step length distribution: ${JSON.stringify(trajectoryDist.stepLengthDistribution)}`);
