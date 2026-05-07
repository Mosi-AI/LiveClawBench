export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function parseFormBody(form: Record<string, string | File>): Record<string, unknown> {
  const body: Record<string, unknown> = Object.fromEntries(Object.entries(form));
  if (typeof body.amount === "string") {
    const num = Number(body.amount);
    body.amount = isNaN(num) ? body.amount : num;
  }
  return body;
}
