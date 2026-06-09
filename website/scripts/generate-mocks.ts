/**
 * Mock app data generation script
 *
 * Reads mock app list from local mirror (task-binary-map.json "binaries" field),
 * enriches with summary from local mirror (README.md "Mock Services" table) and
 * preview data from local public/mock-previews/,
 * outputs site-data/mock-apps.json.
 *
 * Fields:
 *   id, name        ← binaries list from task-binary-map.json
 *   summary         ← Description column from README table (empty string if not found)
 *   agentActions    ← placeholder (empty array)
 *   sourceFiles     ← actual data source paths (task-binary-map.json, README.md, mock-previews/*)
 *   mainScreens     ← image files in public/mock-previews/<id>/mainScreens/
 *   demoGif         ← /mock-previews/<id>/demo.gif (if exists)
 *   previewAssets   ← contents of public/mock-previews/<id>/previewAssets/previewAssets.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_MIRROR =  path.resolve(__dirname, '../documents/LiveClawBench');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_MOCK_PREVIEWS = path.join(PROJECT_ROOT, 'public', 'mock-previews');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'site-data', 'mock-apps.json');

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

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

interface MainScreen {
  name: string;
  src: string;
}

interface MockApp {
  id: string;
  name: string;
  summary: string;
  mainScreens: MainScreen[];
  agentActions: string[];
  demoGif: string | null;
  previewAssets: unknown[];
  sourceFiles: string[];
}

// ─── README table parsing (for summary lookup) ──────────────────────

interface ServiceRow {
  service: string;
  directory: string;
  dirname: string;
  description: string;
}

/**
 * Parse the "Mock Services" markdown table from README content.
 * Columns: | Service | Directory | Binary | Description |
 */
function parseMockServicesTable(readmeContent: string): ServiceRow[] {
  const lines = readmeContent.split('\n');
  const rows: ServiceRow[] = [];

  let inMockServicesSection = false;
  let tableStarted = false;

  for (const line of lines) {
    if (/^##\s+Mock\s+Services/.test(line.trim())) {
      inMockServicesSection = true;
      continue;
    }
    if (inMockServicesSection && /^##\s+/.test(line.trim())) break;
    if (!inMockServicesSection) continue;
    if (!line.trim().startsWith('|')) continue;

    if (line.includes('Service') && line.includes('Description')) {
      tableStarted = true;
      continue;
    }

    if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue;
    if (!tableStarted) continue;

    const cells = line
      .split('|')
      .map(c => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length);

    if (cells.length >= 4) {
      const service = cells[0];
      const directoryRaw = cells[1].replace(/`/g, '');
      const description = cells[3];

      const parts = directoryRaw.split('/').filter(Boolean);
      const dirname = parts.length >= 2 ? parts[parts.length - 1] : parts[0] || service.toLowerCase();

      rows.push({ service, directory: directoryRaw, dirname, description });
    }
  }

  return rows;
}

// ─── mainScreens from public/mock-previews/<id>/mainScreens/ ───────

function readMainScreens(dirname: string): MainScreen[] {
  const screensDir = path.join(PUBLIC_MOCK_PREVIEWS, dirname, 'mainScreens');
  if (!fs.existsSync(screensDir)) return [];

  try {
    const files = fs.readdirSync(screensDir).filter(f =>
      IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase())
    );

    return files.map(f => ({
      name: path.basename(f, path.extname(f)),
      src: `/mock-previews/${dirname}/mainScreens/${f}`,
    }));
  } catch {
    return [];
  }
}

// ─── demoGif from public/mock-previews/<id>/demo.gif ────────────────

function readDemoGif(dirname: string): string | null {
  const gifPath = path.join(PUBLIC_MOCK_PREVIEWS, dirname, 'demo.gif');
  if (!fs.existsSync(gifPath)) return null;
  return `/mock-previews/${dirname}/demo.gif`;
}

// ─── previewAssets from public/mock-previews/<id>/previewAssets/previewAssets.json ──

function readPreviewAssets(dirname: string): unknown[] {
  const jsonPath = path.join(PUBLIC_MOCK_PREVIEWS, dirname, 'previewAssets', 'previewAssets.json');
  if (!fs.existsSync(jsonPath)) return [];

  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    const parsed = JSON.parse(content);
    const assets: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.previewAssets)
        ? parsed.previewAssets
        : [];

    const prefix = `/mock-previews/${dirname}/previewAssets/`;
    return assets.map((asset: any) => {
      if (asset && typeof asset === 'object' && typeof asset.src === 'string') {
        return { ...asset, src: prefix + asset.src };
      }
      return asset;
    });
  } catch {
    return [];
  }
}

// ─── Main generation ────────────────────────────────────────────────

function generateMocks() {
  console.log('Generating mock app data from local mirror...\n');

  // 1. Read binaries list from task-binary-map.json
  console.log('Reading: mock-platform/config/task-binary-map.json');
  const binaryMapText = readLocalFile('mock-platform/config/task-binary-map.json');
  if (!binaryMapText) {
    console.error('❌ Failed to read task-binary-map.json from local mirror');
    process.exit(1);
  }

  const taskBinaryMap = JSON.parse(binaryMapText);
  const binaries: string[] = taskBinaryMap.binaries || [];
  console.log(`Found ${binaries.length} binaries in task-binary-map.json\n`);

  // 2. Read README table for summary lookup
  let summaryMap: Record<string, string> = {};
  console.log('Reading: mock-platform/README.md');
  const readmeContent = readLocalFile('mock-platform/README.md');
  if (readmeContent) {
    const serviceRows = parseMockServicesTable(readmeContent);
    for (const row of serviceRows) {
      summaryMap[row.dirname] = row.description;
    }
  } else {
    console.warn('⚠️  README.md not found locally, summaries will be empty');
  }

  // 3. Build mock apps
  const mockApps: MockApp[] = binaries.map(binaryName => {
    const summary = summaryMap[binaryName] || '';

    // agentActions: placeholder (empty array)
    const agentActions: string[] = [];

    // sourceFiles: actual data sources used to generate this mock app entry
    const sourceFiles: string[] = [
      'mock-platform/config/task-binary-map.json',
      'mock-platform/README.md',
    ];

    const mainScreensDir = path.join(PUBLIC_MOCK_PREVIEWS, binaryName, 'mainScreens');
    if (fs.existsSync(mainScreensDir)) {
      sourceFiles.push(`public/mock-previews/${binaryName}/mainScreens/`);
    }
    if (fs.existsSync(path.join(PUBLIC_MOCK_PREVIEWS, binaryName, 'demo.gif'))) {
      sourceFiles.push(`public/mock-previews/${binaryName}/demo.gif`);
    }
    if (fs.existsSync(path.join(PUBLIC_MOCK_PREVIEWS, binaryName, 'previewAssets', 'previewAssets.json'))) {
      sourceFiles.push(`public/mock-previews/${binaryName}/previewAssets/previewAssets.json`);
    }

    // mainScreens, demoGif, previewAssets from public/mock-previews/
    const mainScreens = readMainScreens(binaryName);
    const demoGif = readDemoGif(binaryName);
    const previewAssets = readPreviewAssets(binaryName);

    return {
      id: binaryName,
      name: binaryName,
      summary,
      mainScreens,
      agentActions,
      demoGif,
      previewAssets,
      sourceFiles,
    };
  });

  const output = { mockApps };

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');

  console.log(`✅ Generated ${mockApps.length} mock apps → ${OUTPUT_PATH}`);
  mockApps.forEach(app => {
    console.log(`   - ${app.name} (${app.id}): ${app.summary || '(no summary)'}`);
    console.log(`     mainScreens: ${app.mainScreens.length}, demoGif: ${app.demoGif ?? '(none)'}, previewAssets: ${app.previewAssets.length}`);
  });
}

generateMocks();
