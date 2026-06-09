/**
 * Domains data generation script
 *
 * Copies docs/metadata/domains.toml from local mirror
 * to site-data/domains.toml as-is, without any parsing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_MIRROR =  path.resolve(__dirname, '../documents/LiveClawBench');
const SITE_DATA_DIR = path.resolve(__dirname, '../site-data');
const OUTPUT_PATH = path.join(SITE_DATA_DIR, 'domains.toml');

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

// ─── Main ──────────────────────────────────────────────────────────────────────

function generateDomains() {
  console.log('📂 Copying domains.toml...\n');

  console.log('   Reading: docs/metadata/domains.toml');
  const content = readLocalFile('docs/metadata/domains.toml');
  if (!content) {
    console.error('❌ Failed to read docs/metadata/domains.toml from local mirror');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(SITE_DATA_DIR)) {
    fs.mkdirSync(SITE_DATA_DIR, { recursive: true });
  }

  // Write output as-is
  fs.writeFileSync(OUTPUT_PATH, content, 'utf-8');
  console.log(`✅ domains.toml copied → ${OUTPUT_PATH}`);
}

generateDomains();
