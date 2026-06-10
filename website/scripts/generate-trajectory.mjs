/**
 * Fetch trajectory data from HuggingFace and process it to generate
 * leaderboard.json, trajectory-distribution.json, and task-results.json
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

function inferSuccess(traj) {
  if (!traj || !traj.steps) return false;
  const agentSteps = traj.steps.filter(s => s.source === 'agent' && s.message && s.message.trim().length > 0);
  if (agentSteps.length === 0) return false;
  const lastAgentStep = agentSteps[agentSteps.length - 1];
  const msg = lastAgentStep.message.toLowerCase();
  const successIndicators = ['success', 'completed', 'done', 'submitted', 'finished', 'created', 'updated', 'sent', 'registered', 'confirmed', 'saved', 'installed', 'resolved', 'fixed'];
  return successIndicators.some(ind => msg.includes(ind));
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
  const modelStats = {};

  for (const row of rows) {
    const { difficulty, domain, complexity_factor, trajectory } = row;
    const model_name = renameModel(row.model_name);
    const diff = normalizeDifficulty(difficulty);
    const traj = parseTrajectory(trajectory);
    const stepCount = getStepCount(traj);
    const success = inferSuccess(traj);

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

    if (!modelStats[model_name]) {
      modelStats[model_name] = {
        total: 0,
        success: 0,
        byDifficulty: { easy: { total: 0, success: 0 }, medium: { total: 0, success: 0 }, hard: { total: 0, success: 0 } },
        byFactor: {},
        byDomain: {},
      };
    }
    const ms = modelStats[model_name];
    ms.total++;
    if (success) ms.success++;

    if (ms.byDifficulty[diff]) {
      ms.byDifficulty[diff].total++;
      if (success) ms.byDifficulty[diff].success++;
    }

    if (Array.isArray(complexity_factor)) {
      for (const f of complexity_factor) {
        if (!ms.byFactor[f]) ms.byFactor[f] = { total: 0, success: 0 };
        ms.byFactor[f].total++;
        if (success) ms.byFactor[f].success++;
      }
    }

    // Track per-domain success (not just count)
    if (!ms.byDomain[domain]) ms.byDomain[domain] = { total: 0, success: 0 };
    ms.byDomain[domain].total++;
    if (success) ms.byDomain[domain].success++;
  }

  // Sort step length distribution by bucket order
  const bucketOrder = ['1-5', '6-10', '11-15', '16-20', '21-25', '26-30', '31-35', '36-40', '41-50', '51+'];
  const sortedStepLengthDistribution = {};
  for (const bucket of bucketOrder) {
    if (stepLengthDistribution[bucket] !== undefined) {
      sortedStepLengthDistribution[bucket] = stepLengthDistribution[bucket];
    }
  }

  return { byDifficulty, byDomain, byFactor, byModel, stepLengthDistribution: sortedStepLengthDistribution, modelStats };
}

function buildLeaderboard(modelStats) {
  const models = [];

  for (const [modelName, stats] of Object.entries(modelStats)) {
    const overall = stats.total > 0 ? Math.round((stats.success / stats.total) * 1000) / 10 : 0;

    const difficulty = {};
    for (const [diff, data] of Object.entries(stats.byDifficulty)) {
      if (data.total > 0) {
        difficulty[diff] = Math.round((data.success / data.total) * 1000) / 10;
      }
    }

    const factors = {};
    for (const [factor, data] of Object.entries(stats.byFactor)) {
      if (data.total > 0) {
        factors[factor] = Math.round((data.success / data.total) * 1000) / 10;
      }
    }

    // Compute actual per-domain success rates
    const domains = {};
    for (const [domain, data] of Object.entries(stats.byDomain)) {
      if (data.total > 0) {
        domains[domain] = Math.round((data.success / data.total) * 1000) / 10;
      }
    }

    models.push({ model: modelName, overall, difficulty, factors, domains, runs: stats.total });
  }

  models.sort((a, b) => b.overall - a.overall);

  return models.map((m, i) => ({
    rank: i + 1,
    model: m.model,
    overall: m.overall,
    difficulty: m.difficulty,
    factors: m.factors,
    domains: m.domains,
    runs: m.runs,
    coverage: 1.0,
  }));
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

console.log('\n📈 Processing trajectory data...');
const processed = processTrajectoryData(rows);

// Build trajectory-distribution.json
const trajectoryDist = buildTrajectoryDistribution(rows, processed);
const trajPath = path.join(SITE_DATA, 'trajectory-distribution.json');
fs.writeFileSync(trajPath, JSON.stringify(trajectoryDist, null, 2));
console.log(`✅ Written ${trajPath}`);

// Build leaderboard.json
const rankedModels = buildLeaderboard(processed.modelStats);
const leaderboard = {
  updatedAt: new Date().toISOString().split('T')[0],
  source: 'https://huggingface.co/datasets/Mosi-AI/LiveClawbench-trajectories',
  scoreScale: '0-100',
  metrics: ['overall', 'easy', 'medium', 'hard', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  models: rankedModels,
};
const lbPath = path.join(SITE_DATA, 'leaderboard.json');
fs.writeFileSync(lbPath, JSON.stringify(leaderboard, null, 2));
console.log(`✅ Written ${lbPath}`);

// Build per-task results (task-results.json)
const taskResults = {};
for (const row of rows) {
  const taskName = row.case_name;
  if (!taskResults[taskName]) taskResults[taskName] = [];
  taskResults[taskName].push({
    model: renameModel(row.model_name),
    reward: row.reward ?? null,
    is_correct: row.is_correct ?? null,
  });
}
const taskResultsOutput = {};
for (const [taskName, entries] of Object.entries(taskResults)) {
  const byModel = {};
  for (const e of entries) {
    if (!byModel[e.model]) byModel[e.model] = { rewards: [], correct: 0, attempts: 0 };
    byModel[e.model].attempts++;
    if (e.reward != null) byModel[e.model].rewards.push(e.reward);
    if (e.is_correct) byModel[e.model].correct++;
  }
  taskResultsOutput[taskName] = Object.entries(byModel).map(([model, d]) => ({
    model,
    avgScore: d.rewards.length ? +(d.rewards.reduce((a, b) => a + b, 0) / d.rewards.length).toFixed(3) : null,
    attempts: d.attempts,
    allPassed: d.correct === d.attempts && d.attempts > 0,
  }));
}
const trPath = path.join(SITE_DATA, 'task-results.json');
fs.writeFileSync(trPath, JSON.stringify(taskResultsOutput, null, 2));
console.log(`✅ Written ${trPath}`);

// Summary
console.log('\n📊 Summary:');
console.log(`  Total trajectories: ${trajectoryDist.totalTrajectories}`);
console.log(`  Models: ${Object.keys(processed.byModel).length}`);
console.log(`  Difficulties: ${JSON.stringify(trajectoryDist.byDifficulty)}`);
console.log(`  Domains: ${Object.keys(trajectoryDist.byDomain).join(', ')}`);
console.log(`  Step length distribution: ${JSON.stringify(trajectoryDist.stepLengthDistribution)}`);
console.log(`  Top model: ${rankedModels[0]?.model} (${rankedModels[0]?.overall}%)`);
