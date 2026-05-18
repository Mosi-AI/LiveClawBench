#!/usr/bin/env python3
# NOTE: Helper functions are intentionally self-contained (no cross-task sharing).
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import deterministic_checks as dc

RUBRIC_PATH = Path(__file__).with_name("rubric.json")
CORPUS_DIR = Path.home() / ".openclaw" / "corpus"
OUTPUT_PATH = Path.home() / ".openclaw" / "output" / "analyst_qna.md"
WORKSPACE_PATH = Path.home() / ".openclaw" / "workspace" / "analyst_prep_q2.md"

SYSTEM_PROMPT = """You are a strict evaluator for an analyst call benchmark task.
The agent was asked to: (1) check a calendar for Thursday's NXL analyst call, (2) resolve
"NXL" to "Nexaline Therapeutics" using the corpus, and (3) update an outdated Q2 draft to
reflect Q3 2024 materials.

Score only semantic quality. Be critical. Return JSON only:
{
  "calendar_a1_used": 0.0,
  "claim_repair": 0.0,
  "content_quality": 0.0,
  "rationales": {
    "calendar_a1_used": "...",
    "claim_repair": "...",
    "content_quality": "..."
  }
}

Scoring (0.0, 0.25, 0.5, 0.75, or 1.0):

calendar_a1_used (cross-service coordination):
  Did the agent query the calendar (localhost:5003) to retrieve the meeting details?
  The calendar event has start_time 14:00 (2 PM) and end_time 16:00 (4 PM) on Thursday.
  These times are ONLY available from the calendar API — they do not appear in the corpus
  or workspace files. Only award positive scores when there is explicit calendar evidence.
  - 1.0: Output explicitly references the meeting time (14:00, 2:00 PM, 2 PM, or equivalent)
    AND correctly uses Q3 2024 Nexaline Therapeutics materials.
  - 0.75: Output references a specific Thursday date (not just "this Thursday" from the
    instruction) and Q3 materials — partial calendar evidence of date lookup.
  - 0.5: Output uses the full event title "NXL Q3 Investor Call" or source "IR" context
    suggesting the calendar record was read, with Q3 materials.
  - 0.0: No explicit calendar-specific field (date, time, or event title) is present in
    the output — including outputs that use Q3 content derived only from corpus/workspace.
    Do NOT award any positive score if no calendar detail appears.

claim_repair (A2 — old draft correction):
  The old draft had these specific outdated claims:
  1. NXL-7 Q2 product revenue $31.8M (→ should be Q3 $41.6M)
  2. FY guidance $190–205M (→ should be $210–220M)
  3. "No near-term competitor approval risk" (→ ZPH-4 filed for accelerated approval; must acknowledge)
  4. NXL-12 enrollment ~70% complete (→ enrollment completed October 2024)
  Does the output explicitly correct these (not just omit them)?
  - 1.0: All 4 outdated claims explicitly corrected with updated figures.
  - 0.75: 3 of 4 corrected.
  - 0.5: 2 of 4 corrected.
  - 0.25: 1 of 4 corrected; rest silently omitted.
  - 0.0: Old claims reproduced or output is generic.

content_quality (Q&A pack substance):
  Are the Q&A answers grounded in specific corpus data? Are the risk topics drawn from the
  internal risk memo? Are the Do Not Say items actionable and specific?
  - 1.0: Answers cite specific numbers, risk topics match internal memo (NXL-12 interim,
    NXL-19 SPA, competitor ZPH-4), Do Not Say items are specific and actionable.
  - 0.75: Good specificity overall but 1-2 generic answers.
  - 0.5: Mix of specific and generic content.
  - 0.25: Mostly generic; could apply to any biotech company.
  - 0.0: Boilerplate or copied from old draft without update.
"""


def post_json(url: str, payload: dict, headers: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc


def extract_text(resp: dict) -> str:
    for key in ("choices", "candidates"):
        items = resp.get(key, [])
        if not items:
            continue
        item = items[0]
        for path in (["message", "content"], ["content", "parts", 0, "text"], ["text"]):
            node = item
            for k in path:
                if isinstance(node, dict):
                    node = node.get(k)
                elif isinstance(node, list) and isinstance(k, int):
                    node = node[k] if k < len(node) else None
                else:
                    node = None
            if isinstance(node, str) and node.strip():
                return node.strip()
    return ""


def parse_json_blob(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        return {}
    try:
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return {}


def clamp(v) -> float:
    try:
        return max(0.0, min(1.0, float(v)))
    except (TypeError, ValueError):
        return 0.0


def call_judge(output_text: str) -> dict:
    base_url = os.environ.get("JUDGE_BASE_URL", "").rstrip("/")
    api_key = os.environ.get("JUDGE_API_KEY", "")
    model = os.environ.get("JUDGE_MODEL_ID", "deepseek-v3.2")

    if not base_url:
        raise RuntimeError("JUDGE_BASE_URL is not set")

    corpus_summary = ""
    if CORPUS_DIR.is_dir():
        for f in sorted(CORPUS_DIR.glob("*.md")):
            corpus_summary += f"\n\n=== {f.name} ===\n" + f.read_text(encoding="utf-8")

    old_draft = ""
    if WORKSPACE_PATH.exists():
        old_draft = WORKSPACE_PATH.read_text(encoding="utf-8")

    user_content = (
        "## Agent's output (analyst_qna.md)\n"
        + output_text
        + "\n\n## Old draft for comparison (analyst_prep_q2.md)\n"
        + old_draft
        + "\n\n## Corpus files available\n"
        + corpus_summary
    )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.0,
        "max_tokens": 1024,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    resp = post_json(f"{base_url}/chat/completions", payload, headers)
    return parse_json_blob(extract_text(resp))


def main() -> None:
    rubric = json.loads(RUBRIC_PATH.read_text(encoding="utf-8"))
    det_rubric = rubric["deterministic"]
    llm_rubric = rubric["llm"]

    det_scores = dc.run()
    det_total = sum(det_scores.get(k, 0.0) * w for k, w in det_rubric.items())

    llm_scores: dict = {}
    llm_rationales: dict = {}
    llm_total = 0.0
    llm_error = None

    output_text = (
        OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.exists() else ""
    )
    if output_text.strip():
        try:
            raw = call_judge(output_text)
            for key in llm_rubric:
                llm_scores[key] = clamp(raw.get(key, 0.0))
            llm_rationales = raw.get("rationales", {})
            llm_total = sum(llm_scores.get(k, 0.0) * w for k, w in llm_rubric.items())
        except Exception as exc:
            llm_error = str(exc)

    reward = round(det_total + llm_total, 4)

    report = {
        "reward": reward,
        "deterministic": det_scores,
        "llm": llm_scores,
        "rationales": llm_rationales,
    }
    if llm_error:
        report["llm_error"] = llm_error

    out_dir = Path("/logs/verifier")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "reward.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (out_dir / "reward.txt").write_text(str(reward) + "\n", encoding="utf-8")

    print(f"Score: {reward}/1.0")
    if llm_error:
        print(f"[LLM judge error: {llm_error}]")
    if reward < 0.5:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
