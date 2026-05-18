const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateAttachmentRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let ref = "att_";
  for (const b of bytes) {
    ref += ALPHANUM[b % ALPHANUM.length];
  }
  return ref;
}

const ALLOWED_FILENAME_CHARS = /^[a-zA-Z0-9._-]+$/;

export function sanitizeFilename(filename: string): string | null {
  const base = filename.split("/").pop()!.split("\\").pop()!;
  if (!base || !ALLOWED_FILENAME_CHARS.test(base)) return null;
  if (base.startsWith(".")) return null;
  return base;
}
