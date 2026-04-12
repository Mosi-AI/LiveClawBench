/**
 * build-task-images.ts — Build per-task Docker images with binary subsets
 *
 * Reads the task→binary mapping artifact (config/task-binary-map.json),
 * then builds a Docker image for each task containing only its required
 * mock binaries FROM the public base image.
 *
 * Usage: bun run scripts/build-task-images.ts [--dry-run]
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const DIST_DIR = join(import.meta.dir, "..", "dist");
const CONFIG_PATH = join(import.meta.dir, "..", "config", "task-binary-map.json");
const BASE_IMAGE = "liveclawbench-base:latest";

interface TaskMapping {
  binaries: string[];
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

function loadMapping(): MappingConfig {
  if (!existsSync(CONFIG_PATH)) {
    console.error(`Mapping file not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

  // Validate: all referenced binaries exist in the binaries list
  const validBinaries = new Set(raw.binaries as string[]);
  for (const [task, mapping] of Object.entries(raw.tasks)) {
    const m = mapping as TaskMapping;
    for (const bin of m.binaries) {
      if (!validBinaries.has(bin)) {
        console.error(`Invalid binary "${bin}" in task "${task}"`);
        process.exit(1);
      }
    }
  }

  return raw as MappingConfig;
}

async function buildTaskImage(
  task: string,
  binaries: string[],
  dryRun: boolean,
): Promise<BuildTaskImageResult> {
  const imageTag = `liveclawbench-${task}:latest`;

  if (binaries.length === 0) {
    // No mock binaries needed — just tag the base image
    if (dryRun) {
      console.log(`  [DRY RUN] docker tag ${BASE_IMAGE} ${imageTag}`);
      return { task, success: true, imageTag, binariesIncluded: [] };
    }

    const proc = Bun.spawn(["docker", "tag", BASE_IMAGE, imageTag], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return { task, success: false, imageTag, binariesIncluded: [], error: stderr.trim() };
    }
    return { task, success: true, imageTag, binariesIncluded: [] };
  }

  // Build a temporary Dockerfile for this task
  const tmpDir = join(import.meta.dir, "..", ".tmp-images");
  mkdirSync(tmpDir, { recursive: true });

  const dockerfileContent = [
    `FROM ${BASE_IMAGE}`,
    "",
    `# Task: ${task}`,
    `# Binaries: ${binaries.join(", ")}`,
    "",
    "COPY --chmod=755 <<'SCRIPT' /opt/mock/startup.sh",
    "#!/bin/sh",
    "set -e",
    "for bin in /opt/mock/bin/mock-*; do",
    '  if [ -x "$bin" ]; then',
    '    "$bin" --port ${PORT:-3000} &',
    "  fi",
    "done",
    "wait",
    "SCRIPT",
    "",
  ];

  // Add COPY lines for each binary
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
    dockerfileContent.push(`COPY mock-${bin} /opt/mock/bin/mock-${bin}`);
  }

  const dockerfilePath = join(tmpDir, `Dockerfile.${task}`);
  writeFileSync(dockerfilePath, dockerfileContent.join("\n") + "\n");

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

  const mapping = loadMapping();
  const taskCount = Object.keys(mapping.tasks).length;
  console.log(`Tasks:      ${taskCount}\n`);

  const results: BuildTaskImageResult[] = [];
  for (const [task, config] of Object.entries(mapping.tasks)) {
    process.stdout.write(`Building ${task} (${config.binaries.length} binaries)... `);
    const result = await buildTaskImage(task, config.binaries, dryRun);
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
