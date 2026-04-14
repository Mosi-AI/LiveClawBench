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

import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

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
  "browser-portal": 8123,
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

interface TaskMapping {
  binaries: string[];
  startup_extra?: string;
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

  // NOTE: Bun mock binaries are currently stubs without real API implementations.
  // They are included in the image but NOT started in Plan 1 to avoid port conflicts
  // with the existing Python Flask services that provide the actual API functionality.
  // Stub startup will be enabled in Plan 2 when Bun mocks implement real APIs.

  // Embed task-specific extra startup content (e.g. browser mock server init)
  // This content is read from the repo at image build time and embedded in the
  // read-only /opt/mock/startup.d/{task}.sh — not executed from writable paths.
  if (startupExtra) {
    // Strip shebang line and bash-specific set options from embedded content
    // since the outer script uses /bin/sh (POSIX). The embedded content runs
    // in the same shell context, so shebang is irrelevant and set -euo pipefail
    // would fail in dash. We keep set -e from the outer script.
    const stripped = startupExtra
      .split("\n")
      .filter((line) => !line.startsWith("#!") && line.trim() !== "set -euo pipefail")
      .join("\n")
      .trimEnd();
    lines.push("# Task-specific service startup (embedded from startup_extra)");
    lines.push(stripped);
    lines.push("");
  } else if (binaries.length > 0) {
    // For service-backed tasks without startup_extra, delegate to the task's
    // Python startup script. The Bun mock binaries are stubs that will replace
    // these Python services in Plan 2; until then, the Python services provide
    // the real API that the agent and verifier expect.
    // startup.sh is available at /workspace/environment/startup.sh because the
    // task Dockerfile does COPY . /workspace/environment/ (includes startup.sh).
    lines.push("# Start task-specific Python mock services");
    lines.push("# NOTE: Bun stub binaries are not started (see note above)");
    lines.push("if [ -f /workspace/environment/startup.sh ]; then");
    lines.push("  bash /workspace/environment/startup.sh &");
    lines.push("elif [ -f /workspace/startup.sh ]; then");
    lines.push("  bash /workspace/startup.sh &");
    lines.push("fi");
    lines.push("# Wait for services to bind their ports");
    lines.push("# Preserves 5-second delay from original per-task entrypoints");
    lines.push("sleep 5");
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

async function buildTaskImage(
  task: string,
  binaries: string[],
  dryRun: boolean,
  startupExtraPath?: string,
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

    // Reject stale binaries (source newer than compiled artifact)
    const entryPoint = join(MOCKS_DIR, bin, "src", "index.ts");
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
    const sourceStat = statSync(entryPoint);
    if (sourceStat.mtimeMs > binaryStat.mtimeMs) {
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

  // COPY mock binaries (if any)
  for (const bin of binaries) {
    dockerfileLines.push(`COPY mock-${bin} /opt/mock/bin/mock-${bin}`);
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

  const proc = Bun.spawn(
    ["docker", "build", "-t", imageTag, "-f", dockerfilePath, DIST_DIR],
    { stdout: "pipe", stderr: "pipe" },
  );
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
    const result = await buildTaskImage(task, config.binaries, dryRun, config.startup_extra);
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
