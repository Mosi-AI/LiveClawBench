export function formatDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}
