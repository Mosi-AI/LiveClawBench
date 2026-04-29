/**
 * Universal CLI argument parser for mock services.
 * Supports: --key value, --key=value
 *
 * Limitation: Does NOT support boolean flags (e.g., --dev without a value).
 * All current mocks use key-value pairs only (--port, --database, --log).
 */
export function parseCliArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (
      args[i].startsWith("--") &&
      i + 1 < args.length &&
      !args[i + 1].startsWith("--")
    ) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    } else if (args[i].startsWith("--") && args[i].includes("=")) {
      const eqIdx = args[i].indexOf("=");
      result[args[i].slice(2, eqIdx)] = args[i].slice(eqIdx + 1);
    }
  }
  return result;
}

/** Parse --port with validation */
export function parseCliPort(): number | undefined {
  const args = parseCliArgs();
  const portStr = args.port;
  if (!portStr) return undefined;
  const port = Number(portStr);
  if (Number.isInteger(port) && port > 0 && port < 65536) return port;
  return undefined;
}
