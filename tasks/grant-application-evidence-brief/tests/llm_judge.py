#!/usr/bin/env python3
# NOTE: Helper functions (call_judge, post_json, etc.) are intentionally kept
# self-contained here because harbor's build context prevents cross-task sharing.
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import deterministic_checks as dc

RUBRIC_PATH = Path(__file__).with_name("rubric.json")
CORPUS_DIR = Path.home() / ".openclaw" / "corpus"

SYSTEM_PROMPT = """You are a strict evaluator for a research grant benchmark task.
The agent was asked to update an outdated research evidence brief using the latest corpus materials.

Score only the semantic quality of the agent's work. Be critical — most submissions have flaws.
Return JSON only with this exact shape:
{
  "novelty_correction": 0.0,
  "evidence_grounding": 0.0,
  "claim_repair": 0.0,
  "rationales": {
    "novelty_correction": "...",
    "evidence_grounding": "...",
    "claim_repair": "..."
  }
}

Scoring criteria (use 0.0, 0.25, 0.5, 0.75, or 1.0):

novelty_correction (0.0–1.0):
  The OLD draft incorrectly claimed CLDU is "the first to apply adapter layers" as its
  primary novelty. The LATEST materials clarify: adapter layers are now standard (used by
  Meta's CrossLingual-XL too); the REAL novelty is the document-structure-aware attention
  mechanism. Does the result's "novelty" field reflect the corrected understanding?
  - 1.0: Explicitly identifies structure-aware attention as the key novelty AND acknowledges
    that adapter layers alone are not the differentiator.
  - 0.75: Identifies structure-aware attention but doesn't explicitly contrast with adapter layers.
  - 0.5: Mentions structure-aware attention but still prominently claims adapter layers as novel.
  - 0.25: Vague novelty claim without specific mechanism.
  - 0.0: Still claims "first to apply adapter layers" as the primary novelty.

evidence_grounding (0.0–1.0):
  Does each item in "supporting_evidence" cite a specific, verifiable result from the corpus
  AND mention the source file? Generic claims like "results are strong" score 0.
  - 1.0: All 3+ evidence items cite specific numbers/findings AND name the source file.
  - 0.75: Most evidence items cite specific content; 1 is somewhat generic.
  - 0.5: Mix — some specific, some generic without sources.
  - 0.25: Evidence exists but mostly generic descriptions without specifics.
  - 0.0: No evidence grounded in specific corpus data.

claim_repair (0.0–1.0):
  The task requires INCREMENTAL UPDATE, not full rewrite. Does the agent explicitly
  acknowledge and correct the outdated claims (rather than silently omitting them)?
  Key outdated claims that must be addressed:
  1. The old F1 score of 78.3% (should be corrected to 84.1%)
  2. EMNLP 2024 submission plan (should acknowledge ACL 2025 acceptance)
  3. The adapter-layer novelty claim (should be corrected to structure-aware attention)
  - 1.0: All 3 outdated claims are explicitly corrected or superseded in the output.
  - 0.75: 2 of 3 explicitly corrected.
  - 0.5: 1 of 3 explicitly corrected; others silently omitted.
  - 0.25: Claims are omitted but not explicitly corrected.
  - 0.0: Outdated claims are reproduced without correction.
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
        for path in (
            ["message", "content"],
            ["content", "parts", 0, "text"],
            ["text"],
        ):
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


def call_judge(result_json: dict) -> dict:
    base_url = os.environ.get("JUDGE_BASE_URL", "").rstrip("/")
    api_key = os.environ.get("JUDGE_API_KEY", "")
    model = os.environ.get("JUDGE_MODEL_ID", "deepseek-v3.2")

    if not base_url:
        raise RuntimeError("JUDGE_BASE_URL is not set")

    # Build corpus summary for context
    corpus_summary = ""
    if CORPUS_DIR.is_dir():
        for f in sorted(CORPUS_DIR.glob("*.md")):
            corpus_summary += f"\n\n=== {f.name} ===\n" + f.read_text(encoding="utf-8")

    user_content = (
        "## Agent's result.json\n"
        + json.dumps(result_json, ensure_ascii=False, indent=2)
        + "\n\n## Corpus files available to agent\n"
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
    url = f"{base_url}/chat/completions"
    resp = post_json(url, payload, headers)
    text = extract_text(resp)
    return parse_json_blob(text)


def main() -> None:
    rubric = json.loads(RUBRIC_PATH.read_text(encoding="utf-8"))
    det_rubric = rubric["deterministic"]
    llm_rubric = rubric["llm"]

    det_scores, result = dc.run()

    # Compute deterministic portion
    det_total = sum(det_scores.get(k, 0.0) * w for k, w in det_rubric.items())

    # LLM evaluation (only if result.json exists)
    llm_scores: dict = {}
    llm_rationales: dict = {}
    llm_total = 0.0

    if result:
        # Fail closed: if the judge is unavailable, raise rather than silently passing
        # on deterministic scores alone.
        raw = call_judge(result)
        for key in llm_rubric:
            llm_scores[key] = clamp(raw.get(key, 0.0))
        llm_rationales = raw.get("rationales", {})
        llm_total = sum(llm_scores.get(k, 0.0) * w for k, w in llm_rubric.items())

    reward = round(det_total + llm_total, 4)

    # A2 hard gate: the corrections field must be a non-empty list, proving the agent
    # produced an incremental update rather than a silent full rewrite.  Semantic quality
    # of the corrections (whether old values are explicitly named) is evaluated by the
    # LLM judge's claim_repair rubric, not by exact token matching here.
    if not result.get("corrections"):
        reward = min(reward, 0.49)

    report = {
        "reward": reward,
        "deterministic": det_scores,
        "llm": llm_scores,
        "rationales": llm_rationales,
    }

    out_dir = Path("/logs/verifier")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "reward.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    reward_file = out_dir / "reward.txt"
    reward_file.write_text(str(reward) + "\n", encoding="utf-8")

    print(f"Score: {reward}/1.0")
    if reward < 0.5:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
