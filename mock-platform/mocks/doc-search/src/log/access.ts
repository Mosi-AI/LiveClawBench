/**
 * JSONL access logging
 */

import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import type { AccessEvent } from "../types";

export interface LogState {
  logPath: string;
  logDiskDegraded: boolean;
}

export function createLogState(logPath: string): LogState {
  return { logPath, logDiskDegraded: false };
}

export function writeEvent(state: LogState, event: AccessEvent): boolean {
  if (state.logDiskDegraded) return false;
  const line = JSON.stringify(event) + "\n";
  try {
    appendFileSync(state.logPath, line);
    return true;
  } catch (err) {
    console.error("mock-doc-search: access log write failed, entering degraded mode", err);
    state.logDiskDegraded = true;
    return false;
  }
}

export function initAccessLog(state: LogState): void {
  const logDir = state.logPath.substring(0, state.logPath.lastIndexOf("/"));
  try {
    mkdirSync(logDir, { recursive: true });
  } catch (err) {
    console.error(`mock-doc-search: FATAL: cannot create access-log directory: ${logDir}`, err);
    process.exit(1);
  }
  // Truncate/create the log file (matches Python `: > "$BROWSER_MOCK_LOG"`)
  try {
    writeFileSync(state.logPath, "");
  } catch (err) {
    console.error(`mock-doc-search: FATAL: cannot create access log file: ${state.logPath}`, err);
    process.exit(1);
  }
}
