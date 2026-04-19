/**
 * build-task-images.ts — Build per-task Docker images with binary subsets
 *
 * Reads the task→binary mapping artifact (config/task-binary-map.json),
 * validates its schema, then builds a Docker image for each task containing
 * only its required mock binaries FROM the public base image.
 *
 * Features:
 * - Schema validation gate: fails fast on invalid mapping before any image build
 * - Per-binary port assignment: each mock binary runs on its designated port
 * - startup.d/{task}.sh generation: per-task startup script in read-only path
 * - Shared entrypoint inclusion: COPY shared/entrypoint.sh into the image
 *
 * Usage: bun run scripts/build-task-images.ts [--dry-run]
 */

import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, readdirSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const DIST_DIR = join(import.meta.dir, "..", "dist");
const CONFIG_PATH = join(import.meta.dir, "..", "config", "task-binary-map.json");
const ENTRYPOINT_SRC = join(import.meta.dir, "..", "..", "shared", "entrypoint.sh");
const BASE_IMAGE = "liveclawbench-base:latest";

/**
 * Canonical port assignment per binary.
 * These match the existing Python/Flask mock service ports so that
 * task instruction.md prompts and verification scripts continue to work
 * without modification during the Plan 2 migration.
 */
const BINARY_PORTS: Record<string, number> = {
  airline: 5000,
  email: 5001,
  shop: 1234,
  todolist: 5002,
  "doc-search": 8123,
};

// All 30 benchmark task names (canonical source of truth)
const ALL_TASK_NAMES = new Set([
  "watch-shop", "washer-shop", "info-change", "washer-change",
  "email-watch-shop", "email-washer-change", "email-writing", "email-reply",
  "schedule-change-request", "flight-booking", "flight-info-change-notice",
  "flight-seat-selection", "flight-seat-selection-failed", "flight-cancel-claim",
  "baggage-tracking-application", "blog-site-from-scratch",
  "blog-site-completion-from-starter", "vue-build-fix-single", "vue-build-fix-chain",
  "skill-creation", "skill-repository-curation", "skill-supplementation",
  "skill-conflict-resolution", "skill-dependency-fix", "noise-filtering",
  "mixed-tool-memory", "incremental-update-ctp", "live-web-research-sqlite-fts5",
  "conflict-repair-acb", "skill-combination",
]);

interface AssetMapping {
  /** Source path relative to the repository root */
  src: string;
  /** Destination path inside the per-task Docker image */
  dest: string;
}

interface TaskMapping {
  binaries: string[];
  startup_extra?: string;
  /** Optional per-task assets to COPY into the image */
  assets?: AssetMapping[];
}

interface MappingConfig {
  binaries: string[];
  tasks: Record<string, TaskMapping>;
}

interface BuildTaskImageResult {
  task: string;
  success: boolean;
  imageTag: string;
  binariesIncluded: string[];
  error?: string;
}

// --- Schema Validation ---

function validateMapping(raw: unknown): MappingConfig {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    throw new Error("Mapping file root must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;

  // Check required top-level keys
  if (!Array.isArray(obj.binaries)) {
    errors.push("Missing or invalid 'binaries' array");
  }
  if (typeof obj.tasks !== "object" || obj.tasks === null) {
    errors.push("Missing or invalid 'tasks' object");
  }

  if (errors.length > 0) {
    throw new Error("Schema validation failed:\n  " + errors.join("\n  "));
  }

  const binaries = obj.binaries as string[];
  const tasks = obj.tasks as Record<string, unknown>;

  // Validate binaries array
  const seenBinaries = new Set<string>();
  for (const bin of binaries) {
    if (typeof bin !== "string") {
      errors.push(`Non-string entry in 'binaries': ${JSON.stringify(bin)}`);
    } else if (seenBinaries.has(bin)) {
      errors.push(`Duplicate binary name: "${bin}"`);
    } else if (!(bin in BINARY_PORTS)) {
      errors.push(`Unknown binary name: "${bin}" (no port mapping)`);
    } else {
      seenBinaries.add(bin);
    }
  }

  // Validate tasks object
  const seenTaskNames = new Set<string>();
  for (const [taskName, taskVal] of Object.entries(tasks)) {
    // Check task name is a known benchmark task
    if (!ALL_TASK_NAMES.has(taskName)) {
      errors.push(`Unknown task name: "${taskName}"`);
    }
    if (seenTaskNames.has(taskName)) {
      errors.push(`Duplicate task name: "${taskName}"`);
    }
    seenTaskNames.add(taskName);

    // Check task value shape
    if (typeof taskVal !== "object" || taskVal === null) {
      errors.push(`Task "${taskName}" value must be an object`);
      continue;
    }

    const taskObj = taskVal as Record<string, unknown>;
    if (!Array.isArray(taskObj.binaries)) {
      errors.push(`Task "${taskName}" missing 'binaries' array`);
      continue;
    }

    const taskBinaries = taskObj.binaries as unknown[];
    if (taskBinaries.some((b) => typeof b !== "string")) {
      errors.push(`Task "${taskName}" has non-string entries in 'binaries'`);
      continue;
    }

    const taskBinStrings = taskBinaries as string[];

    // Check for unknown binary references
    for (const bin of taskBinStrings) {
      if (!seenBinaries.has(bin)) {
        errors.push(`Task "${taskName}" references unknown binary: "${bin}"`);
      }
    }

    // Check for duplicate binary references within a task
    const taskBinSet = new Set(taskBinStrings);
    if (taskBinSet.size !== taskBinStrings.length) {
      errors.push(`Task "${taskName}" has duplicate binary references`);
    }

    // Validate optional startup_extra field
    if ("startup_extra" in taskObj) {
      if (typeof taskObj.startup_extra !== "string") {
        errors.push(`Task "${taskName}" 'startup_extra' must be a string path`);
      }
    }

    // Validate optional assets field
    if ("assets" in taskObj) {
      if (!Array.isArray(taskObj.assets)) {
        errors.push(`Task "${taskName}" 'assets' must be an array`);
      } else {
        for (let ai = 0; ai < (taskObj.assets as unknown[]).length; ai++) {
          const asset = (taskObj.assets as unknown[])[ai];
          if (typeof asset !== "object" || asset === null) {
            errors.push(`Task "${taskName}" assets[${ai}] must be an object`);
            continue;
          }
          const assetObj = asset as Record<string, unknown>;
          if (typeof assetObj.src !== "string" || !assetObj.src) {
            errors.push(`Task "${taskName}" assets[${ai}] missing 'src' string`);
          }
          if (typeof assetObj.dest !== "string" || !assetObj.dest) {
            errors.push(`Task "${taskName}" assets[${ai}] missing 'dest' string`);
          }
        }
      }
    }
  }

  // Check for missing tasks
  for (const expectedTask of ALL_TASK_NAMES) {
    if (!seenTaskNames.has(expectedTask)) {
      errors.push(`Missing task: "${expectedTask}"`);
    }
  }

  // Reject unknown top-level keys (allow known metadata keys)
  const allowedTopLevel = new Set(["$schema", "$id", "description", "version", "binaries", "tasks"]);
  for (const key of Object.keys(obj)) {
    if (!allowedTopLevel.has(key)) {
      errors.push(`Unknown top-level key: "${key}"`);
    }
  }

  if (errors.length > 0) {
    throw new Error("Schema validation failed:\n  " + errors.join("\n  "));
  }

  return { binaries, tasks: tasks as Record<string, TaskMapping> };
}

function loadMapping(): MappingConfig {
  if (!existsSync(CONFIG_PATH)) {
    console.error(`Mapping file not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  return validateMapping(raw);
}

// --- Image Build ---

function generateStartupScript(task: string, binaries: string[], startupExtra?: string): string {
  const lines = [
    "#!/bin/sh",
    `# Startup for task: ${task}`,
    `# Binaries: ${binaries.length > 0 ? binaries.join(", ") : "(none)"}`,
    "set -e",
    "",
  ];

  // Step 0: Data directory initialization for shop tasks
  // The shop binary stores data at /var/lib/mock-data/shop/ and verifiers
  // read from /tmp/mosi_shop_*.json via symlinks.
  if (binaries.includes("shop")) {
    lines.push("# Initialize shop data directory and verifier-compatible symlinks");
    lines.push("mkdir -p /var/lib/mock-data/shop");
    lines.push("chown mock:mock /var/lib/mock-data/shop");
    lines.push("chmod 700 /var/lib/mock-data/shop");
    lines.push("ln -sf /var/lib/mock-data/shop/mosi_shop_orders.json /tmp/mosi_shop_orders.json");
    lines.push("ln -sf /var/lib/mock-data/shop/mosi_shop_cart.json /tmp/mosi_shop_cart.json");
    lines.push("ln -sf /var/lib/mock-data/shop/mosi_shop_user.json /tmp/mosi_shop_user.json");
    lines.push("");
  }

  // Binaries that are stubs (health/sentinel only) — the real services are
  // started by the task's startup.sh.  Implemented binaries (shop, doc-search)
  // are full Bun replacements and should be launched directly.
  const STUB_BINARIES = new Set(["email", "airline", "todolist"]);
  const implementedBinaries = binaries.filter((b) => !STUB_BINARIES.has(b));
  const hasStubBinaries = binaries.some((b) => STUB_BINARIES.has(b));

  // Step 1: Launch implemented Bun mock binaries (skip stubs)
  if (implementedBinaries.length > 0) {
    lines.push("# Start Bun mock binaries (implemented services)");
    for (const bin of implementedBinaries) {
      const port = BINARY_PORTS[bin];
      if (bin === "doc-search") {
        // Doc-search requires explicit --database and --log flags for verifier
        const outputBase = "${HOME:-/home/node}/.openclaw/output";
        lines.push(`/opt/mock/bin/mock-doc-search --port ${port} --database "${outputBase}/browser_mock_documents.sqlite" --log "${outputBase}/browser_mock_access.jsonl" &`);
        // Signal to solution/solve.sh that Bun mock is already running,
        // preventing it from starting the legacy Python sidecar on the same port
        lines.push(`export BROWSER_MOCK_BASE_URL="http://127.0.0.1:${port}"`);
      } else {
        lines.push(`/opt/mock/bin/mock-${bin} --port ${port} &`);
      }
    }
    lines.push("");
    lines.push("# Wait for mock binaries to bind their ports");
    lines.push("sleep 2");
    lines.push("");
  }

  // Step 2: Embed task-specific extra startup content (e.g. Python email services)
  // This content is read from the repo at image build time and embedded in the
  // read-only /opt/mock/startup.d/{task}.sh — not executed from writable paths.
  // Both Bun binaries AND legacy startup can coexist (e.g. Bun shop + Python email).
  if (startupExtra) {
    // Strip shebang line and bash-specific set options from embedded content
    // since the outer script uses /bin/sh (POSIX). The embedded content runs
    // in the same shell context, so shebang is irrelevant and set -euo pipefail
    // would fail in dash. We keep set -e from the outer script.
    let filtered = startupExtra
      .split("\n")
      .filter((line) => !line.startsWith("#!") && line.trim() !== "set -euo pipefail");

    // -------------------------------------------------------------------------
    // Regex-based startup script filtering contract
    // -------------------------------------------------------------------------
    // The filters below rely on EXACT comment conventions used in task
    // startup_extra files. Any change to these conventions in the source
    // files MUST be mirrored here.
    //
    // Shop-app block filter (port-conflict avoidance):
    //   - Trigger: a line matching /^#\s*Start\s+shop-app/i  (case-insensitive)
    //   - Terminator: the next line matching /^#\s*Start\s+/i (any service)
    //   - Behavior: drops every line between trigger (exclusive) and
    //     terminator (exclusive). The terminator line is KEPT because it
    //     begins a different service block.
    //   - Example:
    //       # Start shop-app
    //       cd /workspace/environment/shop-app && python3 app.py &
    //       # Start email-service   <-- terminator, kept
    //
    // Doc-search SQLite bootstrap filter (DB lifecycle collision avoidance):
    //   - Trigger: a line matching /^python3\s+-.*documents\.sql.*<<'PY'$/
    //   - Terminator: a line that is exactly "PY" (heredoc end marker)
    //   - Behavior: drops trigger, terminator, and every line in between.
    //   - Also drops: /^:\s*>\s*"\$\{BROWSER_MOCK_LOG\}"$/ (log truncation
    //     that collides with Bun binary log init).
    // -------------------------------------------------------------------------

    // When implemented binaries include 'shop', strip Python shop-app startup lines
    // to avoid port conflicts (Python start.sh kills processes on port 1234).
    if (implementedBinaries.includes("shop")) {
      let inShopBlock = false;
      filtered = filtered.filter((line) => {
        const l = line.trim();
        if (l.match(/^#\s*Start\s+shop-app/i)) {
          inShopBlock = true;
          return false;
        }
        if (inShopBlock && l.match(/^#\s*Start\s+/i)) {
          inShopBlock = false;
          // Keep this line (it's a new block)
          return true;
        }
        if (inShopBlock) return false;
        return true;
      });
    }

    // When implemented binaries include 'doc-search', strip Python sqlite bootstrap
    // because the Bun binary handles DB initialization via initDatabase().
    // The Python bootstrap would delete/recreate the DB after Bun has opened it.
    if (implementedBinaries.includes("doc-search")) {
      let inSqliteBlock = false;
      filtered = filtered.filter((line) => {
        const l = line.trim();
        // Match the python3 sqlite bootstrap heredoc
        if (l.match(/^python3\s+-.*documents\.sql.*<<'PY'$/)) {
          inSqliteBlock = true;
          return false;
        }
        if (inSqliteBlock) {
          if (l === "PY") {
            inSqliteBlock = false;
          }
          return false;
        }
        // Also strip the log truncation line (Bun binary handles this)
        if (l.match(/^:\s*>\s*"\$\{BROWSER_MOCK_LOG\}"$/)) {
          return false;
        }
        return true;
      });
    }

    const stripped = filtered.join("\n").trimEnd();
    if (stripped) {
      lines.push("# Task-specific legacy startup (embedded from startup_extra)");
      lines.push(stripped);
      lines.push("");
    }
  } else if (hasStubBinaries) {
    // Tasks with stub binaries (email, airline, todolist) and no startup_extra:
    // start the real Python/Node services from the task's startup.sh instead.
    // Run via bash since startup.sh files use Bash-specific features.
    lines.push("# Legacy app fallback — stub binaries, run real services via bash");
    lines.push("if [ -f /workspace/environment/startup.sh ]; then");
    lines.push("  bash /workspace/environment/startup.sh");
    lines.push("fi");
    lines.push("");
  }

  // Step 3: Final wait for all services to be ready
  if (implementedBinaries.length > 0 || startupExtra || hasStubBinaries) {
    lines.push("# Wait for all services to be ready");
    lines.push("sleep 3");
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

async function buildTaskImage(
  task: string,
  binaries: string[],
  dryRun: boolean,
  startupExtraPath?: string,
  assets?: AssetMapping[],
): Promise<BuildTaskImageResult> {
  const imageTag = `liveclawbench-${task}-base:latest`;

  // Build a per-task Dockerfile
  const tmpDir = join(import.meta.dir, "..", ".tmp-images");
  mkdirSync(tmpDir, { recursive: true });

  // Check all binaries exist before building (skip for zero-binary tasks)
  // Also verify binaries are not stale (source newer than binary)
  const MOCKS_DIR = join(import.meta.dir, "..", "mocks");
  for (const bin of binaries) {
    const binaryPath = join(DIST_DIR, `mock-${bin}`);
    if (!existsSync(binaryPath)) {
      return {
        task,
        success: false,
        imageTag,
        binariesIncluded: binaries,
        error: `Binary not found: ${binaryPath}`,
      };
    }

    // Reject stale binaries (any source file newer than compiled artifact)
    const srcDir = join(MOCKS_DIR, bin, "src");
    const tsEp = join(srcDir, "index.ts");
    const tsxEp = join(srcDir, "index.tsx");
    const entryPoint = existsSync(tsxEp) ? tsxEp : tsEp;
    if (!existsSync(entryPoint)) {
      return {
        task,
        success: false,
        imageTag,
        binariesIncluded: binaries,
        error: `Source entry point not found: ${entryPoint}`,
      };
    }

    const binaryStat = statSync(binaryPath);
    // Check all .ts/.tsx files in the src directory, not just the entry point,
    // since imported modules (e.g. search-algorithm.ts) may have changed.
    function collectTsFiles(dir: string, visited = new Set<string>()): string[] {
      // Symlink cycle protection: track realpaths to avoid infinite recursion
      let realDir: string;
      try {
        realDir = realpathSync(dir);
      } catch {
        realDir = dir;
      }
      if (visited.has(realDir)) return [];
      visited.add(realDir);

      const results: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...collectTsFiles(full, visited));
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          results.push(full);
        }
      }
      return results;
    }
    const srcFiles = collectTsFiles(srcDir);
    const staleFile = srcFiles.find((f) => statSync(f).mtimeMs > binaryStat.mtimeMs);
    if (staleFile) {
      const sourceStat = statSync(staleFile);
      return {
        task,
        success: false,
        imageTag,
        binariesIncluded: binaries,
        error: `Stale binary: ${binaryPath} (source ${sourceStat.mtimeMs} newer than binary ${binaryStat.mtimeMs})`,
      };
    }
  }

  // Read optional startup_extra content from repo root
  let startupExtraContent: string | undefined;
  if (startupExtraPath) {
    const repoRoot = join(import.meta.dir, "..", "..");
    const extraAbsPath = join(repoRoot, startupExtraPath);
    if (!existsSync(extraAbsPath)) {
      return {
        task,
        success: false,
        imageTag,
        binariesIncluded: binaries,
        error: `startup_extra file not found: ${extraAbsPath}`,
      };
    }
    startupExtraContent = readFileSync(extraAbsPath, "utf-8");
  }

  const startupContent = generateStartupScript(task, binaries, startupExtraContent);

  const dockerfileLines = [
    `FROM ${BASE_IMAGE}`,
    "",
    `# Task: ${task}`,
    `# Binaries: ${binaries.length > 0 ? binaries.join(", ") : "(none)"}`,
    "",
  ];

  // Create mock user for shop data directory ownership
  // Tolerate only user-exists error (exit code 9); fail on other errors.
  if (binaries.includes("shop")) {
    dockerfileLines.push("RUN useradd -r -s /bin/false mock 2>/dev/null || [ $? -eq 9 ] || (echo 'mock user creation failed' >&2 && exit 1)");
    dockerfileLines.push("");
  }

  // COPY mock binaries (if any)
  for (const bin of binaries) {
    dockerfileLines.push(`COPY mock-${bin} /opt/mock/bin/mock-${bin}`);
  }

  // Stage and COPY per-task assets (CSS, JSON, SQL sidecars)
  // Asset source files are copied into DIST_DIR (build context) so Docker COPY can find them.
  if (assets && assets.length > 0) {
    const repoRoot = resolve(import.meta.dir, "..", "..");
    const canonicalRepoRoot = realpathSync(repoRoot);
    const destDirs = new Set<string>();
    const assetCopyLines: string[] = [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const destDir = asset.dest.substring(0, asset.dest.lastIndexOf("/"));
      if (destDir) destDirs.add(destDir);

      // Validate asset.src has no trailing slash (prevents empty filename from pop())
      if (asset.src.endsWith("/")) {
        return {
          task,
          success: false,
          imageTag,
          binariesIncluded: binaries,
          error: `Asset src must not end with trailing slash: "${asset.src}"`,
        };
      }

      // Resolve to absolute path and validate containment within repo root
      const srcAbsPath = resolve(repoRoot, asset.src);
      if (!srcAbsPath.startsWith(repoRoot + sep)) {
        return {
          task,
          success: false,
          imageTag,
          binariesIncluded: binaries,
          error: `Asset path escapes repo root: "${asset.src}" -> ${srcAbsPath}`,
        };
      }

      if (!existsSync(srcAbsPath)) {
        return {
          task,
          success: false,
          imageTag,
          binariesIncluded: binaries,
          error: `Asset source not found: ${srcAbsPath}`,
        };
      }

      // Canonical symlink-safe containment check
      const canonicalSrcPath = realpathSync(srcAbsPath);
      if (
        canonicalSrcPath !== canonicalRepoRoot &&
        !canonicalSrcPath.startsWith(canonicalRepoRoot + sep)
      ) {
        return {
          task,
          success: false,
          imageTag,
          binariesIncluded: binaries,
          error: `Asset path escapes repo root (symlink): "${asset.src}" -> ${canonicalSrcPath}`,
        };
      }
      const srcFileName = asset.src.split("/").pop()!;
      const contextName = `asset-${task}-${i}-${srcFileName}`;
      writeFileSync(join(DIST_DIR, contextName), readFileSync(srcAbsPath));
      assetCopyLines.push(`COPY ${contextName} ${asset.dest}`);
    }

    // Emit RUN mkdir before asset COPY lines (creates destination dirs in the image)
    if (destDirs.size > 0) {
      dockerfileLines.push(`RUN mkdir -p ${[...destDirs].join(" ")}`);
    }
    dockerfileLines.push(...assetCopyLines);
  }

  // COPY startup script to deterministic /opt/mock/startup.d/{task}.sh
  // The startup script is written to DIST_DIR (build context) as startup-{task}.sh
  dockerfileLines.push("");
  dockerfileLines.push(`COPY startup-${task}.sh /opt/mock/startup.d/${task}.sh`);
  dockerfileLines.push("");

  // Ensure startup.d ownership and permissions (root:root, read-only)
  dockerfileLines.push("RUN chown root:root /opt/mock/startup.d/" + task + ".sh && \\");
  dockerfileLines.push("    chmod 755 /opt/mock/startup.d/" + task + ".sh");
  dockerfileLines.push("");

  // COPY shared entrypoint from the canonical shared/entrypoint.sh
  // This is the single secure entrypoint for all per-task images
  dockerfileLines.push(`COPY entrypoint.sh /opt/mock/entrypoint.sh`);
  dockerfileLines.push("RUN chmod 755 /opt/mock/entrypoint.sh");
  dockerfileLines.push("");

  // Set TASK_NAME so the entrypoint finds the correct startup script
  dockerfileLines.push(`ENV TASK_NAME=${task}`);
  dockerfileLines.push("");

  dockerfileLines.push(`ENTRYPOINT ["/opt/mock/entrypoint.sh"]`);
  // No CMD here — inherits from base image (openclaw:2026.3.11 provides long-lived command)
  dockerfileLines.push("");

  // Write startup script content to DIST_DIR (Docker build context)
  // This ensures the COPY command can find the file at build time.
  // Using plain COPY instead of BuildKit heredoc ensures portability
  // when Docker BuildKit is disabled or unavailable.
  const startupScriptPath = join(DIST_DIR, `startup-${task}.sh`);
  writeFileSync(startupScriptPath, startupContent);

  // COPY startup script is already in dockerfileLines as regular COPY
  // No need for heredoc replacement (removed in earlier edit)

  const dockerfilePath = join(tmpDir, `Dockerfile.${task}`);
  writeFileSync(dockerfilePath, dockerfileLines.join("\n") + "\n");

  // Build context needs both dist/ (for binaries) and shared/ (for entrypoint.sh)
  // We copy entrypoint.sh into the dist dir temporarily for the build context
  const entrypointDest = join(DIST_DIR, "entrypoint.sh");
  const entrypointSrc = ENTRYPOINT_SRC;
  if (existsSync(entrypointSrc)) {
    writeFileSync(entrypointDest, readFileSync(entrypointSrc));
  }

  if (dryRun) {
    console.log(`  [DRY RUN] docker build -t ${imageTag} -f ${dockerfilePath} ${DIST_DIR}`);
    return { task, success: true, imageTag, binariesIncluded: binaries };
  }

  let proc;
  try {
    proc = Bun.spawn(
      ["docker", "build", "-t", imageTag, "-f", dockerfilePath, DIST_DIR],
      { stdout: "pipe", stderr: "pipe" },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { task, success: false, imageTag, binariesIncluded: binaries, error: `docker spawn failed: ${msg}` };
  }
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    return { task, success: false, imageTag, binariesIncluded: binaries, error: stderr.trim() };
  }

  return { task, success: true, imageTag, binariesIncluded: binaries };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=== LiveClawBench Task Image Builder ===\n");
  console.log(`Base image: ${BASE_IMAGE}`);
  console.log(`Mapping:    ${CONFIG_PATH}`);
  if (dryRun) console.log("Mode:       DRY RUN\n");

  // Schema validation gate — fail fast before any image build
  let mapping: MappingConfig;
  try {
    mapping = loadMapping();
    console.log("Schema validation: PASS");
  } catch (err) {
    console.error(`Schema validation: FAIL\n${err}`);
    process.exit(1);
  }

  const taskCount = Object.keys(mapping.tasks).length;
  console.log(`Tasks:      ${taskCount}\n`);

  const results: BuildTaskImageResult[] = [];
  for (const [task, config] of Object.entries(mapping.tasks)) {
    process.stdout.write(`Building ${task} (${config.binaries.length} binaries)... `);
    const result = await buildTaskImage(task, config.binaries, dryRun, config.startup_extra, config.assets);
    results.push(result);

    if (result.success) {
      console.log(`OK -> ${result.imageTag}`);
    } else {
      console.log(`FAILED`);
      console.error(`  Error: ${result.error}`);
    }
  }

  // Summary
  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\n=== Build Summary ===`);
  console.log(`Passed: ${passed.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);

  if (failed.length > 0) {
    console.log("\nFailed tasks:");
    for (const f of failed) {
      console.log(`  - ${f.task}: ${f.error}`);
    }
    process.exit(1);
  }

  console.log("\nTask image build complete.");
}

main().catch((err) => {
  console.error("Build error:", err);
  process.exit(1);
});
