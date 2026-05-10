import type { Database } from "bun:sqlite";

export interface ModerationResult {
  action: "warn" | "block" | "hide" | "none";
  matched: string;
  rule_id: number | null;
}

function isWordChar(c: string): boolean {
  return /[a-z0-9\u4e00-\u9fa5]/.test(c);
}

function isWordBoundary(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return true;
  return !isWordChar(text[index - 1]) || !isWordChar(text[index]);
}

function findExactWord(text: string, phrase: string): boolean {
  let idx = text.indexOf(phrase);
  while (idx !== -1) {
    const before = idx === 0 || !isWordChar(text[idx - 1]);
    const after = idx + phrase.length >= text.length || !isWordChar(text[idx + phrase.length]);
    if (before && after) return true;
    idx = text.indexOf(phrase, idx + 1);
  }
  return false;
}

function findPrefixWord(text: string, phrase: string): boolean {
  let idx = text.indexOf(phrase);
  while (idx !== -1) {
    const before = idx === 0 || !isWordChar(text[idx - 1]);
    if (before) return true;
    idx = text.indexOf(phrase, idx + 1);
  }
  return false;
}

export function applyModeration(db: Database, text: string, scope: "post" | "comment"): ModerationResult {
  const rules = db.query(
    "SELECT id, phrase, match_mode, action FROM keyword_rule WHERE is_active = 1 AND scope = ?"
  ).all(scope) as Array<{ id: number; phrase: string; match_mode: string; action: string }>;

  let worstAction: "warn" | "block" | "hide" | "none" = "none";
  let matchedPhrase = "";
  let matchedRuleId: number | null = null;

  const lowerText = text.toLowerCase();

  for (const rule of rules) {
    const phrase = rule.phrase.toLowerCase();
    let hit = false;

    if (rule.match_mode === "exact") {
      hit = findExactWord(lowerText, phrase);
    } else if (rule.match_mode === "prefix") {
      hit = findPrefixWord(lowerText, phrase);
    } else {
      // contains
      hit = lowerText.includes(phrase);
    }

    if (hit) {
      // Priority: block > hide > warn
      const actionPriority = { block: 3, hide: 2, warn: 1 } as const;
      const currentPriority = worstAction === "none" ? 0 : actionPriority[worstAction as keyof typeof actionPriority] || 0;
      const newPriority = actionPriority[rule.action as keyof typeof actionPriority] || 0;

      if (newPriority > currentPriority) {
        worstAction = rule.action as "warn" | "block" | "hide";
        matchedPhrase = rule.phrase;
        matchedRuleId = rule.id;
      }
    }
  }

  return {
    action: worstAction,
    matched: matchedPhrase,
    rule_id: matchedRuleId,
  };
}
