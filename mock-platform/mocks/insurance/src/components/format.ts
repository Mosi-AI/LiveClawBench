/** Shared formatting utilities for insurance UI components. */

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
