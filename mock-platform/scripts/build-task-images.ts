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
// NOTE: entrypoint.sh lives at repo-root/shared/entrypoint.sh, outside mock-platform/.
// It is copied into the Docker build context (dist/) at build time.
// Do NOT move this file without updating the copy logic below.
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
  insurance: 6000,
  calendar: 5006,
  "mint-diet": 5003,
  weather: 3000,
  social: 5004,
  expense: 5005,
};

function portProxyLines(listenPort: number, targetPort: number): string[] {
  return [
    `python3 -c "`,
    `import socketserver, socket, threading`,
    `class P(socketserver.ThreadingTCPServer):`,
    `  allow_reuse_address = True`,
    `  def server_bind(self):`,
    `    super().server_bind()`,
    `    import os`,
    `    os.set_inheritable(self.socket.fileno(), False)`,
    `class H(socketserver.BaseRequestHandler):`,
    `  def handle(self):`,
    `    b=socket.socket(socket.AF_INET, socket.SOCK_STREAM | getattr(socket, 'SOCK_CLOEXEC', 0)); b.connect(('127.0.0.1',${targetPort}))`,
    `    def fwd(src,dst):`,
    `      try:`,
    `        while (d:=src.recv(8192)): dst.send(d)`,
    `      except: pass`,
    `    threading.Thread(target=fwd,args=(self.request,b),daemon=True).start()`,
    `    try:`,
    `      fwd(b,self.request)`,
    `    finally:`,
    `      try: self.request.shutdown(socket.SHUT_RDWR)`,
    `      except: pass`,
    `      try: b.shutdown(socket.SHUT_RDWR)`,
    `      except: pass`,
    `P(('0.0.0.0',${listenPort}),H).serve_forever()`,
    `" > /dev/null 2>&1 &`,
  ];
}

// All 37 benchmark task names (canonical source of truth)
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
  "conflict-repair-acb", "skill-combination", "insurance-deductible-selection", "health-insurance-optimization",
  "mint-diet-snack-log", "weather-aqi-report",
  "social-media-posting", "social-unlike-post", "expense-draft-delete",
]);

interface AssetMapping {
  /** Source path relative to the repository root */
  src: string;
  /** Destination path inside the per-task Docker image */
  dest: string;
}

interface FrontendConfig {
  /** Path to the frontend source directory (relative to repo root), e.g. "tasks/flight-booking/environment/airline-app/frontend" */
  src: string;
  /** Build output subdirectory within src, e.g. "dist" */
  buildDir: string;
  /** Destination path inside the Docker image, e.g. "/opt/mock/frontend/airline" */
  dest: string;
}

interface TaskMapping {
  binaries: string[];
  startup_extra?: string;
  /** Optional per-task assets to COPY into the image */
  assets?: AssetMapping[];
  /** Optional multiple frontend SPA build configurations */
  frontends?: FrontendConfig[];
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

    // Validate optional frontends array
    if ("frontends" in taskObj) {
      const fes = taskObj.frontends;
      if (!Array.isArray(fes)) {
        errors.push(`Task "${taskName}" 'frontends' must be an array`);
      } else {
        for (let fi = 0; fi < fes.length; fi++) {
          const fe = fes[fi];
          if (typeof fe !== "object" || fe === null) {
            errors.push(`Task "${taskName}" 'frontends[${fi}]' must be an object`);
            continue;
          }
          const feObj = fe as Record<string, unknown>;
          for (const key of ["src", "buildDir", "dest"]) {
            if (typeof feObj[key] !== "string" || !(feObj[key] as string)) {
              errors.push(`Task "${taskName}" 'frontends[${fi}].${key}' must be a non-empty string`);
            }
          }
          const allowedFrontendKeys = new Set(["src", "buildDir", "dest"]);
          for (const key of Object.keys(feObj)) {
            if (!allowedFrontendKeys.has(key)) {
              errors.push(`Task "${taskName}" 'frontends[${fi}]' has unknown key: "${key}"`);
            }
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
    "# Helper: wait for an HTTP endpoint to become ready, exit non-zero on timeout",
    "wait_http() {",
    "  url=\"$1\"",
    "  max=\"${2:-30}\"",
    "  i=0",
    "  while [ $i -lt $max ]; do",
    "    if curl -sf \"$url\" >/dev/null 2>&1; then",
    "      return 0",
    "    fi",
    "    i=$((i + 1))",
    "    sleep 0.5",
    "  done",
    "  echo \"ERROR: $url did not become ready after ${max} attempts\" >&2",
    "  exit 1",
    "}",
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

  // Step 1: Launch Bun mock binaries
  if (binaries.length > 0) {
    lines.push("# Start Bun mock binaries");
    for (const bin of binaries) {
      const port = BINARY_PORTS[bin];
      if (bin === "doc-search") {
        // Doc-search requires explicit --database and --log flags for verifier
        const outputBase = "${HOME:-/home/node}/.openclaw/output";
        lines.push(`/opt/mock/bin/mock-doc-search --port ${port} --database "${outputBase}/browser_mock_documents.sqlite" --log "${outputBase}/browser_mock_access.jsonl" &`);
        // Signal to solution/solve.sh that Bun mock is already running,
        // preventing it from starting the legacy Python sidecar on the same port
        lines.push(`export BROWSER_MOCK_BASE_URL="http://127.0.0.1:${port}"`);
      } else if (bin === "airline") {
        // Airline Bun binary must share the SQLite DB with the Python verifier
        // so that verifier scripts (which import SQLAlchemy models) see the
        // same data the agent created through the Bun API.
        // The DB lives at a stable path; python_compat is symlinked so that
        // verifier imports resolve to /workspace/environment/airline-app.
        lines.push(`export AIRLINE_DB_PATH=/var/lib/mock-data/airline/airline.db`);
        lines.push(`export DATABASE_URL=sqlite:////var/lib/mock-data/airline/airline.db`);
        lines.push(`mkdir -p /var/lib/mock-data/airline`);
        // Replace the legacy airline-app with python_compat bridge so verifier
        // imports resolve to /opt/mock/python_compat/airline-app. The -T flag
        // treats the target as a normal file (avoids linking inside an existing dir).
        lines.push(`if [ -e /workspace/environment/airline-app ] && [ ! -L /workspace/environment/airline-app ]; then`);
        lines.push(`  mv /workspace/environment/airline-app /workspace/environment/airline-app.legacy`);
        lines.push(`fi`);
        lines.push(`ln -sfn /opt/mock/python_compat/airline-app /workspace/environment/airline-app`);
        lines.push(`mkdir -p /workspace/environment/airline-app/backend/instance`);
        lines.push(`ln -sf /var/lib/mock-data/airline/airline.db /workspace/environment/airline-app/backend/instance/airline.db`);
        // Smoke check: verify python_compat bridge creates a working app (non-fatal)
        lines.push(`python3 -c "import sys; sys.path.insert(0, '/workspace/environment/airline-app/backend'); from app import create_app; create_app('development')" || echo "WARN: python_compat smoke check failed, continuing..."`);
        // Redirect Bun airline logs to expected paths and proxy 5173→5000
        // so task instructions referencing localhost:5173 continue to work.
        lines.push(`/opt/mock/bin/mock-${bin} --port ${port} > /tmp/airline-backend.log 2>&1 &`);
        lines.push(`echo "Airline frontend served by Bun on port ${port}" > /tmp/airline-frontend.log`);
        lines.push(`echo "npm install skipped — frontend pre-built at image time" > /tmp/airline-npm-install.log`);
        // Proxy port 5173 to Bun airline port for legacy URL compatibility
        // Uses Python's socketserver (always available) as a simple TCP forwarder.
        lines.push(...portProxyLines(5173, port));
      } else if (bin === "email") {
        // Email Bun binary must share the SQLite DB with the Python verifier
        // so that verifier scripts (which import SQLAlchemy models) see the
        // same data the agent created through the Bun API.
        lines.push(`export EMAIL_DB_PATH=/var/lib/mock-data/email/email.db`);
        lines.push(`mkdir -p /var/lib/mock-data/email`);
        lines.push(`if [ -e /workspace/environment/email-app ] && [ ! -L /workspace/environment/email-app ]; then`);
        lines.push(`  mv /workspace/environment/email-app /workspace/environment/email-app.legacy`);
        lines.push(`fi`);
        lines.push(`ln -sfn /opt/mock/python_compat/email-app /workspace/environment/email-app`);
        lines.push(`mkdir -p /workspace/environment/email-app/backend/instance`);
        lines.push(`ln -sf /var/lib/mock-data/email/email.db /workspace/environment/email-app/backend/instance/email.db`);
        // Smoke check: verify python_compat bridge exports the verifier import contract (fatal)
        lines.push(`python3 -c "import sys; sys.path.insert(0, '/workspace/environment/email-app/backend'); from app import app; from models import Email"`);
        lines.push(`/opt/mock/bin/mock-${bin} --port ${port} > /tmp/email-backend.log 2>&1 &`);
        lines.push(`echo "Email frontend served by Bun on port ${port}" > /tmp/email-frontend.log`);
        lines.push(`echo "npm install skipped — frontend pre-built at image time" > /tmp/email-npm-install.log`);
        // Proxy port 5174 to Bun email port for legacy URL compatibility
        lines.push(...portProxyLines(5174, port));
      } else if (bin === "todolist") {
        lines.push(`export TODOLIST_DB_PATH=/var/lib/mock-data/todolist/todolist.db`);
        lines.push(`mkdir -p /var/lib/mock-data/todolist`);
        lines.push(`/opt/mock/bin/mock-${bin} --port ${port} > /tmp/todolist-backend.log 2>&1 &`);
        lines.push(`echo "Todolist frontend served by Bun on port ${port}" > /tmp/todolist-frontend.log`);
        lines.push(`echo "npm install skipped — frontend pre-built at image time" > /tmp/todolist-npm-install.log`);
        // Proxy port 3000 to Bun todolist port for legacy URL compatibility
        lines.push(...portProxyLines(3000, port));
      } else if (bin === "expense") {
        lines.push(`export EXPENSE_MOCK_DB_PATH=/var/lib/mock-data/expense/expense.db`);
        lines.push(`export EXPENSE_MOCK_ATTACHMENTS_DIR=/var/lib/mock-data/expense/attachments`);
        lines.push(`mkdir -p /var/lib/mock-data/expense/attachments`);
        lines.push(`/opt/mock/bin/mock-${bin} --port ${port} > /tmp/expense-backend.log 2>&1 &`);
        lines.push(`echo "Expense frontend served by Bun on port ${port}" > /tmp/expense-frontend.log`);
        lines.push(`echo "npm install skipped — frontend pre-built at image time" > /tmp/expense-npm-install.log`);
      } else {
        lines.push(`/opt/mock/bin/mock-${bin} --port ${port} &`);
      }
    }
    lines.push("");
    lines.push("# Wait for mock binaries to bind their ports");
    lines.push("for port in " + binaries.map((b) => BINARY_PORTS[b]).join(" ") + "; do");
    lines.push("  wait_http \"http://localhost:${port}/health\"");
    lines.push("done");
    // Also wait for proxy ports to be ready
    if (binaries.includes("airline")) {
      lines.push("wait_http \"http://localhost:5173/health\"");
    }
    if (binaries.includes("email")) {
      lines.push("wait_http \"http://localhost:5174/health\"");
    }
    if (binaries.includes("todolist")) {
      lines.push("wait_http \"http://localhost:3000/health\"");
    }
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

    // TODO: Remove shop-app block filter when no task uses startup_extra
    // that contains "# Start shop-app". This filter strips legacy Python
    // shop-app startup lines when the Bun mock-shop binary is present.
    // When implemented binaries include 'shop', strip Python shop-app startup lines
    // to avoid port conflicts (Python start.sh kills processes on port 1234).
    if (binaries.includes("shop")) {
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

    // Airline-app block filter (port-conflict avoidance):
    //   - Trigger: a line matching /^#\s*Start\s+airline-app/i
    //   - Terminator: the next line matching /^#\s*Start\s+/i (any service)
    //     or end of filtered lines
    //   - Behavior: drops every line between trigger (exclusive) and
    //     terminator (exclusive). The terminator line is KEPT because it
    //     begins a different service block.
    // When Bun mock-airline is implemented, legacy Python airline-app startup
    // (both backend python3 run.py and frontend npm run dev) must be stripped
    // to avoid port-5000 conflicts.
    if (binaries.includes("airline")) {
      let inAirlineBlock = false;
      filtered = filtered.filter((line) => {
        const l = line.trim();
        if (l.match(/^#\s*Start\s+airline-app/i)) {
          inAirlineBlock = true;
          return false;
        }
        if (inAirlineBlock && l.match(/^#\s*Start\s+/i)) {
          inAirlineBlock = false;
          return true;
        }
        if (inAirlineBlock) return false;
        return true;
      });
    }

    // Email-app block filter (port-conflict avoidance):
    // When Bun mock-email is implemented, legacy Python email-app startup
    // must be stripped to avoid port-5001 conflicts.
    if (binaries.includes("email")) {
      let inEmailBlock = false;
      filtered = filtered.filter((line) => {
        const l = line.trim();
        if (l.match(/^#\s*Start\s+email-app/i)) {
          inEmailBlock = true;
          return false;
        }
        if (inEmailBlock && l.match(/^#\s*Start\s+/i)) {
          inEmailBlock = false;
          return true;
        }
        if (inEmailBlock) return false;
        return true;
      });
    }

    // Todolist-app block filter (port-conflict avoidance):
    // When Bun mock-todolist is implemented, legacy Python todolist-app startup
    // must be stripped to avoid port-5002 conflicts.
    if (binaries.includes("todolist")) {
      let inTodolistBlock = false;
      filtered = filtered.filter((line) => {
        const l = line.trim();
        if (l.match(/^#\s*Start\s+todolist-app/i)) {
          inTodolistBlock = true;
          return false;
        }
        if (inTodolistBlock && l.match(/^#\s*Start\s+/i)) {
          inTodolistBlock = false;
          return true;
        }
        if (inTodolistBlock) return false;
        return true;
      });
    }

    // TODO: Remove sqlite bootstrap filter when no task uses startup_extra
    // that contains the python3 sqlite bootstrap heredoc.
    // When implemented binaries include 'doc-search', strip Python sqlite bootstrap
    // because the Bun binary handles DB initialization via initDatabase().
    // The Python bootstrap would delete/recreate the DB after Bun has opened it.
    if (binaries.includes("doc-search")) {
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
  }

  // Step 3: Final wait for all services to be ready
  if (binaries.length > 0 || startupExtra) {
    lines.push("# Wait for all services to be ready");
    lines.push("sleep 2");
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
  frontends?: FrontendConfig[],
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

  // Collect frontend build configurations
  const allFrontends: FrontendConfig[] = [];
  if (frontends) allFrontends.push(...frontends);

  // Build frontend SPAs on host if configured
  const frontendBuildDirs: { buildDir: string; dest: string }[] = [];
  for (const fe of allFrontends) {
    const repoRoot = join(import.meta.dir, "..", "..");
    const frontendSrc = resolve(repoRoot, fe.src);

    if (!existsSync(frontendSrc)) {
      return {
        task,
        success: false,
        imageTag,
        binariesIncluded: binaries,
        error: `Frontend source directory not found: ${frontendSrc}`,
      };
    }

    // Check node/npm availability
    const nodeCheck = Bun.spawnSync(["node", "--version"], { stdout: "pipe" });
    if (nodeCheck.exitCode !== 0) {
      return {
        task,
        success: false,
        imageTag,
        binariesIncluded: binaries,
        error: "node is required for frontend builds but not found on host (need Node.js >= 18)",
      };
    }
    const nodeVersion = new TextDecoder().decode(nodeCheck.stdout).trim();
    const majorVersion = parseInt(nodeVersion.replace(/^v/, "").split(".")[0], 10);
    if (majorVersion < 18) {
      return {
        task,
        success: false,
        imageTag,
        binariesIncluded: binaries,
        error: `Node.js >= 18 required for frontend builds (found ${nodeVersion})`,
      };
    }

    const npmCheck = Bun.spawnSync(["npm", "--version"], { stdout: "pipe" });
    if (npmCheck.exitCode !== 0) {
      return {
        task,
        success: false,
        imageTag,
        binariesIncluded: binaries,
        error: "npm is required for frontend builds but not found on host",
      };
    }

    if (!dryRun) {
      const buildOutputDir = join(frontendSrc, fe.buildDir);

      // npm install
      const installProc = Bun.spawn(["npm", "install", "--prefix", frontendSrc], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const installExit = await installProc.exited;
      if (installExit !== 0) {
        const stderr = await new Response(installProc.stderr).text();
        return {
          task,
          success: false,
          imageTag,
          binariesIncluded: binaries,
          error: `Frontend npm install failed for ${task}: ${stderr.trim()}`,
        };
      }

      // npm run build
      const buildProc = Bun.spawn(["npm", "run", "build", "--prefix", frontendSrc], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const buildExit = await buildProc.exited;
      if (buildExit !== 0) {
        const stderr = await new Response(buildProc.stderr).text();
        return {
          task,
          success: false,
          imageTag,
          binariesIncluded: binaries,
          error: `Frontend npm run build failed for ${task}: ${stderr.trim()}`,
        };
      }

      if (!existsSync(buildOutputDir)) {
        return {
          task,
          success: false,
          imageTag,
          binariesIncluded: binaries,
          error: `Frontend build output directory not found: ${buildOutputDir}`,
        };
      }

      frontendBuildDirs.push({ buildDir: buildOutputDir, dest: fe.dest });
    } else {
      console.log(`  [DRY RUN] npm install && npm run build in ${frontendSrc}`);
      frontendBuildDirs.push({ buildDir: join(frontendSrc, fe.buildDir), dest: fe.dest });
    }
  }

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

  // Copy python_compat bridge for airline tasks so verifier scripts can
  // import SQLAlchemy models and query the shared DB.
  if (binaries.includes("airline")) {
    const pythonCompatDir = join(import.meta.dir, "..", "python_compat", "airline-app");
    if (existsSync(pythonCompatDir)) {
      const contextDir = "python-compat-airline";
      const contextPath = join(DIST_DIR, contextDir);
      mkdirSync(contextPath, { recursive: true });
      const cpProc = Bun.spawnSync(["cp", "-r", `${pythonCompatDir}/.`, contextPath]);
      if (cpProc.exitCode !== 0) {
        return {
          task,
          success: false,
          imageTag,
          binariesIncluded: binaries,
          error: `Failed to copy python_compat to context: ${cpProc.stderr}`,
        };
      }
      dockerfileLines.push(`COPY ${contextDir}/ /opt/mock/python_compat/airline-app/`);
      dockerfileLines.push(`RUN pip install --no-cache-dir --break-system-packages -r /opt/mock/python_compat/airline-app/requirements.txt`);
      // Ensure the /workspace/environment/airline-app symlink exists at runtime
      // (the startup script creates it; here we just ensure the target dir exists)
      dockerfileLines.push(`RUN mkdir -p /workspace/environment`);
    }
  }

  // Copy python_compat bridge for email tasks so verifier scripts can
  // import SQLAlchemy models and query the shared DB.
  if (binaries.includes("email")) {
    const pythonCompatDir = join(import.meta.dir, "..", "python_compat", "email-app");
    if (existsSync(pythonCompatDir)) {
      const contextDir = "python-compat-email";
      const contextPath = join(DIST_DIR, contextDir);
      mkdirSync(contextPath, { recursive: true });
      const cpProc = Bun.spawnSync(["cp", "-r", `${pythonCompatDir}/.`, contextPath]);
      if (cpProc.exitCode !== 0) {
        return {
          task,
          success: false,
          imageTag,
          binariesIncluded: binaries,
          error: `Failed to copy python_compat to context: ${cpProc.stderr}`,
        };
      }
      dockerfileLines.push(`COPY ${contextDir}/ /opt/mock/python_compat/email-app/`);
      dockerfileLines.push(`RUN pip install --no-cache-dir --break-system-packages -r /opt/mock/python_compat/email-app/requirements.txt`);
      dockerfileLines.push(`RUN mkdir -p /workspace/environment`);
    }
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

  // COPY pre-built frontend SPA files (if configured)
  for (let fi = 0; fi < frontendBuildDirs.length; fi++) {
    const { buildDir, dest } = frontendBuildDirs[fi];
    if (dryRun) {
      console.log(`  [DRY RUN] frontend build output → ${dest}`);
      console.log(`  [DRY RUN] COPY frontend-${task}-${fi}/ ${dest}/`);
    } else {
      const contextDir = `frontend-${task}-${fi}`;
      const contextPath = join(DIST_DIR, contextDir);
      mkdirSync(contextPath, { recursive: true });
      const cpProc = Bun.spawnSync(["cp", "-r", `${buildDir}/.`, contextPath]);
      if (cpProc.exitCode !== 0) {
        return {
          task,
          success: false,
          imageTag,
          binariesIncluded: binaries,
          error: `Failed to copy frontend build output to context: ${cpProc.stderr}`,
        };
      }
      dockerfileLines.push(`RUN mkdir -p ${dest}`);
      dockerfileLines.push(`COPY ${contextDir}/ ${dest}/`);
    }
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
    const result = await buildTaskImage(task, config.binaries, dryRun, config.startup_extra, config.assets, config.frontends);
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
