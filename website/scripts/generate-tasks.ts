/**
 * Task data generation script
 *
 * Reads task definitions from local mirror:
 *   1. cases_registry_zh.csv  → task list, description_zh, factors, domain, etc.
 *   2. cases_registry.csv     → description_en
 *   3. tasks/<name>/instruction.md → instruction
 *   4. tasks/<name>/task.toml → category, tags, verifier, agent, environment, etc.
 *   5. task-binary-map.json   → mock_apps (from "binaries" field)
 *   6. tasks/<name>/tests/test.sh → verifier_type (verify.py / evaluate.py / llm_judge.py)
 *
 * Generates tasks.json in site-data/ matching the format of tasks-backup.json,
 * but WITHOUT mock_app_features and WITH task.toml fields included.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_MIRROR =  path.resolve(__dirname, '../documents/LiveClawBench');
const SITE_DATA_DIR = path.resolve(__dirname, '../site-data');
const SITE_CONTENT_DIR = path.resolve(__dirname, '../site-content');

// ─── Local file reader ──────────────────────────────────────────────────────

/**
 * Read a file's text content from the local mirror directory.
 */
function readLocalFile(repoPath: string): string | null {
  const localPath = path.join(LOCAL_MIRROR, repoPath);
  try {
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath, 'utf-8');
    }
    console.warn(`  ⚠️  File not found locally: ${localPath}`);
    return null;
  } catch (e) {
    console.warn(`  ⚠️  Failed to read ${localPath}: ${(e as Error).message}`);
    return null;
  }
}

// ─── Simple TOML parser (handles the flat + single-level-table format used by task.toml) ──

interface TomlTable {
  [key: string]: string | number | boolean | string[] | TomlTable;
}

function parseToml(text: string): TomlTable {
  const root: TomlTable = {};
  let current: TomlTable = root;
  let currentName = '';

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    // skip blanks & comments
    if (!line || line.startsWith('#')) continue;

    // [section]
    const sectionMatch = line.match(/^\[(\w+)\]$/);
    if (sectionMatch) {
      currentName = sectionMatch[1];
      current = {};
      root[currentName] = current;
      continue;
    }

    // key = value
    const kvMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      let val: string | number | boolean | string[] = kvMatch[2].trim();

      // strip inline comment (only when # is preceded by space and not inside a string)
      val = val.replace(/\s+#\s+.*$/, '').trim();

      // array
      if (val.startsWith('[')) {
        const inner = val.slice(1, -1).trim();
        if (inner === '') {
          current[key] = [];
        } else {
          current[key] = inner.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        }
        continue;
      }

      // boolean
      if (val === 'true') { current[key] = true; continue; }
      if (val === 'false') { current[key] = false; continue; }

      // number
      if (/^-?\d+(\.\d+)?$/.test(val)) { current[key] = parseFloat(val); continue; }

      // string (strip quotes)
      current[key] = val.replace(/^"|"$/g, '');
    }
  }
  return root;
}

// ─── CSV parser ────────────────────────────────────────────────────────────────

interface CsvRow {
  [key: string]: string;
}

/**
 * Parse a CSV string into an array of row objects.
 * Handles quoted fields (including those with commas and newlines).
 */
function parseCsv(text: string): CsvRow[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  // Split into lines, respecting quoted fields that may contain newlines
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        i++; // skip \r\n
      }
      if (current.trim()) {
        lines.push(current);
      }
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    lines.push(current);
  }

  if (lines.length < 2) return [];

  // Parse header
  const headers = splitCsvLine(lines[0]);

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Split a single CSV line into fields, respecting double-quoted fields.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ─── Task entry interface ──────────────────────────────────────────────────────

interface TaskEntry {
  case_id: number;
  name: string;
  difficulty: string;
  domain: string;
  domains_multi: string[];
  factors: { A1: boolean; A2: boolean; B1: boolean; B2: boolean; C1: boolean; C2: boolean };
  instruction: string;
  description_zh: string;
  description_en: string;
  mock_apps: string[];
  has_frontend: boolean;
  status: string;
  category: string;
  tags: string[];
  verifier_type: string;
  verifier: { timeout_sec: number };
  agent: { timeout_sec: number };
  environment: {
    build_timeout_sec: number;
    cpus: number;
    memory_mb: number;
    storage_mb: number;
    allow_internet: boolean;
  };
  paths: {
    task_toml: string;
    instruction: string;
    environment: string;
    test_sh: string;
  };
  [key: string]: unknown;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function generateTasks() {
  console.log('📂 Reading task data from local mirror...\n');

  // ── 1. Read cases_registry_zh.csv (task list + description_zh) ──
  console.log('   Reading: docs/metadata/cases_registry_zh.csv');
  const zhCsvText = readLocalFile('docs/metadata/cases_registry_zh.csv');
  if (!zhCsvText) {
    console.error('❌ Failed to read cases_registry_zh.csv');
    process.exit(1);
  }
  const zhRows = parseCsv(zhCsvText);
  console.log(`   Found ${zhRows.length} rows in cases_registry_zh.csv\n`);

  // ── 2. Read cases_registry.csv (description_en) ──
  console.log('   Reading: docs/metadata/cases_registry.csv');
  const enCsvText = readLocalFile('docs/metadata/cases_registry.csv');
  if (!enCsvText) {
    console.error('❌ Failed to read cases_registry.csv');
    process.exit(1);
  }
  const enRows = parseCsv(enCsvText);
  console.log(`   Found ${enRows.length} rows in cases_registry.csv\n`);

  // Build a map of case_name → description_en from the English CSV
  const descriptionEnMap = new Map<string, string>();
  for (const row of enRows) {
    const caseName = row['Case name']?.trim();
    const description = row['description']?.trim();
    if (caseName && description) {
      descriptionEnMap.set(caseName, description);
    }
  }

  // ── 3. Read task-binary-map.json (mock_apps) ──
  console.log('   Reading: mock-platform/config/task-binary-map.json');
  const binaryMapText = readLocalFile('mock-platform/config/task-binary-map.json');
  if (!binaryMapText) {
    console.error('❌ Failed to read task-binary-map.json');
    process.exit(1);
  }
  const binaryMapData = JSON.parse(binaryMapText);
  const binaryMap = binaryMapData.tasks as Record<string, { binaries: string[]; frontends?: unknown[] }>;
  console.log(`   Found ${Object.keys(binaryMap).length} tasks in task-binary-map.json\n`);

  // ── 4. Process each task from the Chinese CSV ──
  const tasks: TaskEntry[] = [];

  for (const row of zhRows) {
    const caseName = row['Case name']?.trim();
    if (!caseName) {
      console.warn('  ⚠️  Skipping row with empty Case name');
      continue;
    }

    // Only process "implemented" tasks
    const status = row['status']?.trim();
    if (status && status !== 'implemented') {
      console.log(`  ⏭️  Skipping "${caseName}" (status: ${status})`);
      continue;
    }

    const caseId = parseInt(row['case_id']?.trim() || '0', 10);
    const difficultyRaw = row['difficulty']?.trim() || '';
    const difficultyMap: Record<string, string> = { 'E': 'easy', 'M': 'medium', 'H': 'hard' };
    const difficulty = difficultyMap[difficultyRaw] || difficultyRaw || 'unknown';
    const domain = row['domain']?.trim() || '';
    const domainsMultiStr = row['domains_multi']?.trim() || '';
    const descriptionZh = row['description']?.trim() || '';
    const descriptionEn = descriptionEnMap.get(caseName) || '';

    // Parse domains_multi (semicolon-separated)
    const domainsMulti = domainsMultiStr
      ? domainsMultiStr.split(';').map(s => s.trim()).filter(Boolean)
      : domain ? [domain] : [];

    // Parse factors
    const factorA1 = row['factor_A1']?.trim() === '1';
    const factorA2 = row['factor_A2']?.trim() === '1';
    const factorB1 = row['factor_B1']?.trim() === '1';
    const factorB2 = row['factor_B2']?.trim() === '1';
    const factorC1 = row['factor_C1']?.trim() === '1';
    const factorC2 = row['factor_C2']?.trim() === '1';

    // ── 4a. Read instruction.md ──
    let instruction = '';
    const instructionText = readLocalFile(`tasks/${caseName}/instruction.md`);
    if (instructionText) {
      instruction = instructionText.trim();
    } else {
      console.warn(`  ⚠️  "${caseName}": cannot read instruction.md`);
    }

    // ── 4b. Read task.toml ──
    let toml: TomlTable | null = null;
    const tomlText = readLocalFile(`tasks/${caseName}/task.toml`);
    if (tomlText) {
      toml = parseToml(tomlText);
    } else {
      console.warn(`  ⚠️  "${caseName}": cannot read task.toml`);
    }

    const meta = toml?.metadata as TomlTable | undefined;
    const verifier = toml?.verifier as TomlTable | undefined;
    const agent = toml?.agent as TomlTable | undefined;
    const environment = toml?.environment as TomlTable | undefined;

    // ── 4c. Get mock_apps from task-binary-map.json ──
    const taskBinary = binaryMap[caseName];
    const mockApps: string[] = taskBinary ? [...taskBinary.binaries] : [];

    // ── 4d. Determine verifier_type from tests/test.sh ──
    let verifierType = '';
    const testShContent = readLocalFile(`tasks/${caseName}/tests/test.sh`);
    if (testShContent) {
      if (testShContent.includes('llm_judge.py')) {
        verifierType = 'llm_judge.py';
      } else if (testShContent.includes('evaluate.py')) {
        verifierType = 'evaluate.py';
      } else if (testShContent.includes('verify.py')) {
        verifierType = 'verify.py';
      }
    } else {
      console.warn(`  ⚠️  "${caseName}": cannot read tests/test.sh`);
    }

    // ── 4e. Build the task entry ──
    const task: TaskEntry = {
      case_id: caseId,
      name: caseName,
      difficulty: difficulty,
      domain: domain,
      domains_multi: domainsMulti,
      factors: {
        A1: factorA1,
        A2: factorA2,
        B1: factorB1,
        B2: factorB2,
        C1: factorC1,
        C2: factorC2,
      },
      instruction: instruction,
      description_zh: descriptionZh,
      description_en: descriptionEn,
      mock_apps: mockApps,
      has_frontend: Array.isArray(taskBinary?.frontends) && taskBinary!.frontends!.length > 0,
      status: status || '',
      category: (meta?.category as string) ?? '',
      tags: Array.isArray(meta?.tags) ? (meta!.tags as string[]) : [],
      verifier_type: verifierType,
      verifier: {
        timeout_sec: (verifier?.timeout_sec as number) ?? 900,
      },
      agent: {
        timeout_sec: (agent?.timeout_sec as number) ?? 1800,
      },
      environment: {
        build_timeout_sec: (environment?.build_timeout_sec as number) ?? 600,
        cpus: (environment?.cpus as number) ?? 2,
        memory_mb: (environment?.memory_mb as number) ?? 4096,
        storage_mb: (environment?.storage_mb as number) ?? 10240,
        allow_internet: (environment?.allow_internet as boolean) ?? true,
      },
      paths: {
        task_toml: `tasks/${caseName}/task.toml`,
        instruction: `tasks/${caseName}/instruction.md`,
        environment: `tasks/${caseName}/environment/Dockerfile`,
        test_sh: `tasks/${caseName}/tests/test.sh`,
      },
    };

    // Copy any additional fields from [metadata] that are not already in the task entry
    if (meta) {
      const handledMetaKeys = new Set([
        'case_id', 'difficulty', 'domain', 'domains_multi',
        'factor_a1', 'factor_a2', 'factor_b1', 'factor_b2',
        'factor_c1', 'factor_c2',
        'category', 'tags',
      ]);
      for (const [key, value] of Object.entries(meta)) {
        if (!handledMetaKeys.has(key) && !(key in task)) {
          task[key] = value;
        }
      }
    }

    // Copy any additional top-level TOML sections (other than metadata/verifier/agent/environment)
    if (toml) {
      const handledSections = new Set(['metadata', 'verifier', 'agent', 'environment']);
      for (const [key, value] of Object.entries(toml)) {
        if (!handledSections.has(key) && !(key in task)) {
          task[key] = value;
        }
      }
    }

    tasks.push(task);
    console.log(`  ✅ ${caseName} (case_id: ${caseId}, mock_apps: [${mockApps.join(', ')}])`);
  }

  // Sort by case_id
  tasks.sort((a, b) => a.case_id - b.case_id);

  console.log(`\n📊 Total tasks: ${tasks.length}`);

  // ── 5. Ensure output directory exists ──
  if (!fs.existsSync(SITE_DATA_DIR)) {
    fs.mkdirSync(SITE_DATA_DIR, { recursive: true });
  }

  // ── 6. Write tasks.json output ──
  const output = { tasks };
  const canonicalPath = path.join(SITE_DATA_DIR, 'tasks.json');
  fs.writeFileSync(canonicalPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Updated: ${canonicalPath}`);

  // ── 7. Generate representative-cases.json ──
  console.log('\n📋 Generating representative-cases.json...');

  // Read the representative-cases name list from site-config.json
  const siteConfigPath = path.join(SITE_CONTENT_DIR, 'site-config.json');
  let representativeCaseNames: string[] = [];
  if (fs.existsSync(siteConfigPath)) {
    const siteConfig = JSON.parse(fs.readFileSync(siteConfigPath, 'utf-8'));
    representativeCaseNames = siteConfig['representative-cases'] || [];
    console.log(`   Found ${representativeCaseNames.length} representative case names in site-config.json`);
  } else {
    console.warn('   ⚠️  site-config.json not found, skipping representative-cases generation');
  }

  if (representativeCaseNames.length > 0) {
    // Build a task lookup map by name
    const taskMap = new Map<string, TaskEntry>();
    for (const t of tasks) {
      taskMap.set(t.name, t);
    }

    interface RepCase {
      name: string;
      domain: string;
      difficulty: string;
      factors: { A1: boolean; A2: boolean; B1: boolean; B2: boolean; C1: boolean; C2: boolean };
      summary_zh: string;
      summary_en: string;
      detailUrl: string;
    }

    const repCases: RepCase[] = [];

    for (const caseName of representativeCaseNames) {
      const task = taskMap.get(caseName);

      if (task) {
        // Task found in tasks.json — build entry from task data
        repCases.push({
          name: task.name,
          domain: task.domain,
          difficulty: task.difficulty,
          factors: task.factors,
          summary_zh: task.description_zh || '',
          summary_en: task.description_en || '',
          detailUrl: `/tasks/${task.name}`,
        });
        console.log(`  ✅ ${caseName} (from tasks.json)`);
      } else {
        console.warn(`  ⚠️  "${caseName}" not found in tasks.json or existing representative-cases`);
      }
    }

    const repCasesOutput = { cases: repCases };
    const repCasesPath = path.join(SITE_DATA_DIR, 'representative-cases.json');
    fs.writeFileSync(repCasesPath, JSON.stringify(repCasesOutput, null, 2));
    console.log(`\n💾 Updated: ${repCasesPath}`);
  }

  // ── 8. Update metrics-summary.json ──
  console.log('\n📊 Updating metrics-summary.json...');

  const metricsPath = path.join(SITE_DATA_DIR, 'metrics-summary.json');
  let existingMetrics: Record<string, unknown> = {};
  if (fs.existsSync(metricsPath)) {
    try {
      existingMetrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    } catch {
      // ignore parse errors
    }
  }

  // Compute task-derived metrics
  const totalTasks = tasks.length;

  // Difficulty distribution
  const difficultyDist: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  for (const t of tasks) {
    const d = t.difficulty.toLowerCase();
    if (d in difficultyDist) {
      difficultyDist[d]++;
    }
  }

  // Domain distribution
  const domainDist: Record<string, number> = {};
  for (const t of tasks) {
    const domain = t.domain;
    domainDist[domain] = (domainDist[domain] || 0) + 1;
  }
  // Sort by count descending
  const sortedDomainEntries = Object.entries(domainDist).sort((a, b) => b[1] - a[1]);
  const sortedDomainDist: Record<string, number> = {};
  for (const [k, v] of sortedDomainEntries) {
    sortedDomainDist[k] = v;
  }

  // Factor distribution
  const factorDist: Record<string, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
  for (const t of tasks) {
    if (t.factors.A1) factorDist.A1++;
    if (t.factors.A2) factorDist.A2++;
    if (t.factors.B1) factorDist.B1++;
    if (t.factors.B2) factorDist.B2++;
    if (t.factors.C1) factorDist.C1++;
    if (t.factors.C2) factorDist.C2++;
  }

  // Factor overlap distribution
  const factorOverlapDist: Record<string, number> = { '0 factors': 0, '1 factor': 0, '2 factors': 0, '3 factors': 0, '4+ factors': 0 };
  for (const t of tasks) {
    let enabledFactorCount = 0;
    if (t.factors) {
      for (const enabled of Object.values(t.factors)) {
        if (enabled) enabledFactorCount++;
      }
    }
    if (enabledFactorCount === 0) {
      factorOverlapDist['0 factors']++;
    } else if (enabledFactorCount === 1) {
      factorOverlapDist['1 factor']++;
    } else if (enabledFactorCount === 2) {
      factorOverlapDist['2 factors']++;
    } else if (enabledFactorCount === 3) {
      factorOverlapDist['3 factors']++;
    } else {
      factorOverlapDist['4+ factors']++;
    }
  }

  // Verifier type distribution
  const verifierDist: Record<string, number> = {};
  for (const t of tasks) {
    const vt = t.verifier_type;
    if (vt) {
      verifierDist[vt] = (verifierDist[vt] || 0) + 1;
    }
  }

  // Build updated metrics — preserve non-task-derived fields from existing data
  const updatedMetrics = {
    ...existingMetrics,
    totalTasks,
    difficultyDistribution: difficultyDist,
    domainDistribution: sortedDomainDist,
    factorDistribution: factorDist,
    factorOverlapDistribution: factorOverlapDist,
    verifierTypeDistribution: verifierDist,
  };

  fs.writeFileSync(metricsPath, JSON.stringify(updatedMetrics, null, 2));
  console.log(`  ✅ totalTasks: ${totalTasks}`);
  console.log(`  ✅ difficultyDistribution: ${JSON.stringify(difficultyDist)}`);
  console.log(`  ✅ factorDistribution: ${JSON.stringify(factorDist)}`);
  console.log(`  ✅ factorOverlapDistribution: ${JSON.stringify(factorOverlapDist)}`);
  console.log(`💾 Updated: ${metricsPath}`);
}

generateTasks();
