#!/usr/bin/env python3
"""Per-dimension LLM judge for deep research report tasks.

Loads a nested rubric (dimension_weights + per-dimension criteria), checks for
report.md existence as a deterministic gate, then makes one independent judge call
per dimension.  Failed dimension calls retry up to 3 times with exponential
backoff; persistent failures score 0.0 for that dimension.
"""

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

import deterministic_checks as dc

RUBRIC = Path(__file__).with_name("rubric.json")

INSTRUCTION = dc.ROOT / "instruction.md"

DEFAULT_JUDGE_MODEL = "deepseek-v3.2"
MAX_RETRIES = 3
BACKOFF_BASE = 2.0

SYSTEM_PROMPT = """You are a strict research report evaluator. Score the agent's report against each criterion below on a 0.0–1.0 scale (0.25 increments). Be critical — 1.0 is rare.

Return JSON only with this exact shape:
{
  "scores": [
    {"criterion": "...", "score": 0.75, "rationale": "..."},
    ...
  ]
}
"""


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def parse_json_blob(text: str) -> dict:
    cleaned = strip_code_fence(text)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start < 0 or end < start:
            return {}
        try:
            payload = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            return {}
    return payload if isinstance(payload, dict) else {}


def extract_chat_text(payload: dict) -> str:
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message", {})
        content = message.get("content", "")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict) and item.get("type") in {
                    "text",
                    "output_text",
                }:
                    parts.append(str(item.get("text", "")))
            return "\n".join(parts)
    return ""


def extract_responses_text(payload: dict) -> str:
    output = payload.get("output")
    if not isinstance(output, list):
        return ""
    parts = []
    for item in output:
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if not isinstance(content, dict):
                continue
            if "text" in content:
                parts.append(str(content.get("text", "")))
            elif content.get("type") in {"output_text", "text"}:
                parts.append(str(content.get("text", "")))
    return "\n".join(part for part in parts if part)


def post_json(url: str, payload: dict, api_key: str) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.loads(response.read().decode("utf-8"))


def call_judge(system_prompt: str, user_prompt: str) -> tuple[dict, dict]:
    base_url = os.environ.get("JUDGE_BASE_URL") or ""
    model = os.environ.get("JUDGE_MODEL_ID") or DEFAULT_JUDGE_MODEL
    api_key = os.environ.get("JUDGE_API_KEY") or ""
    if not base_url:
        raise RuntimeError("JUDGE_BASE_URL is not set for LLM judging")
    if not api_key:
        raise RuntimeError("JUDGE_API_KEY is not set for LLM judging")

    chat_url = base_url.rstrip("/") + "/chat/completions"
    responses_url = base_url.rstrip("/") + "/responses"
    attempts = [
        (
            "chat_completions",
            chat_url,
            {
                "model": model,
                "temperature": 0,
                "max_tokens": 4096,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
            extract_chat_text,
        ),
        (
            "responses",
            responses_url,
            {
                "model": model,
                "temperature": 0,
                "max_output_tokens": 4096,
                "input": [
                    {
                        "role": "system",
                        "content": [{"type": "input_text", "text": system_prompt}],
                    },
                    {
                        "role": "user",
                        "content": [{"type": "input_text", "text": user_prompt}],
                    },
                ],
            },
            extract_responses_text,
        ),
    ]

    errors = []
    for mode, url, payload, extractor in attempts:
        try:
            raw = post_json(url, payload, api_key)
            text = extractor(raw)
            parsed = parse_json_blob(text)
            if parsed:
                return parsed, {
                    "mode": mode,
                    "url": url,
                    "model": model,
                    "raw_response": raw,
                }
            errors.append(f"{mode}: response did not contain valid JSON")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            errors.append(f"{mode}: HTTP {exc.code} {body}")
        except Exception as exc:
            errors.append(f"{mode}: {exc}")

    raise RuntimeError("LLM judge request failed: " + " | ".join(errors))


def judge_dimension(
    dimension: str, criteria: list[dict], instruction: str, report_text: str
) -> tuple[float, dict]:
    """Score one dimension with retries. Returns (dimension_score, debug_info)."""
    criteria_lines = []
    for c in criteria:
        criteria_lines.append(f"- {c['criterion']} (weight: {c['weight']})")

    user_prompt = "\n".join(
        [
            "# Task Instruction",
            instruction,
            "",
            "# Agent Report",
            report_text,
            "",
            f"# Dimension: {dimension}",
            "Score the report against each criterion below. Return JSON only.",
            "",
            *criteria_lines,
        ]
    )

    last_error = ""
    for attempt in range(MAX_RETRIES):
        try:
            judge_payload, debug_payload = call_judge(SYSTEM_PROMPT, user_prompt)
            scores = judge_payload.get("scores", [])
            if not isinstance(scores, list):
                raise RuntimeError("judge response 'scores' is not a list")

            total = 0.0
            for c in criteria:
                name = c["criterion"]
                weight = c["weight"]
                score_entry = next(
                    (s for s in scores if s.get("criterion") == name), None
                )
                if score_entry is None:
                    raise RuntimeError(f"missing score for criterion: {name}")
                score = score_entry.get("score", 0.0)
                try:
                    score = float(score)
                except (TypeError, ValueError):
                    score = 0.0
                score = round(min(1.0, max(0.0, score)), 4)
                total += score * weight

            dim_score = round(min(1.0, max(0.0, total)), 4)
            return dim_score, {
                "dimension": dimension,
                "attempt": attempt + 1,
                "mode": debug_payload.get("mode"),
                "model": debug_payload.get("model"),
                "scores": scores,
            }
        except Exception as exc:
            last_error = str(exc)
            if attempt < MAX_RETRIES - 1:
                sleep_s = BACKOFF_BASE**attempt
                time.sleep(sleep_s)

    return 0.0, {
        "dimension": dimension,
        "attempt": MAX_RETRIES,
        "error": last_error,
    }


def main() -> None:
    rubric = load_json(RUBRIC)
    instruction = ""
    if INSTRUCTION.exists():
        instruction = INSTRUCTION.read_text(encoding="utf-8").strip()

    verifier_dir = Path("/logs/verifier")
    verifier_dir.mkdir(parents=True, exist_ok=True)

    report_path = dc.find_report()
    if report_path is None:
        score = {
            "reward": 0.0,
            "_meta_report_found": 0,
            "_meta_word_count": 0,
            "_meta_meets_length": False,
        }
        (verifier_dir / "reward.json").write_text(
            json.dumps(score, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (verifier_dir / "reward.txt").write_text("0.0", encoding="utf-8")
        return

    meets_length, word_count = dc.check_report_length(report_path)
    if not meets_length:
        score = {
            "reward": 0.0,
            "_meta_report_found": 1,
            "_meta_word_count": word_count,
            "_meta_meets_length": meets_length,
        }
        (verifier_dir / "reward.json").write_text(
            json.dumps(score, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (verifier_dir / "reward.txt").write_text("0.0", encoding="utf-8")
        return

    report_text = report_path.read_text(encoding="utf-8").strip()

    dimension_weights = rubric.get("dimension_weights", {})
    criteria_by_dimension = rubric.get("criteria", {})

    dimension_scores: dict[str, float] = {}
    raw_responses: list[dict] = []

    for dimension, weight in dimension_weights.items():
        criteria = criteria_by_dimension.get(dimension, [])
        if not isinstance(criteria, list):
            criteria = []
        dim_score, debug = judge_dimension(
            dimension, criteria, instruction, report_text
        )
        dimension_scores[dimension] = dim_score
        raw_responses.append(debug)

    final_reward = sum(
        dimension_scores.get(d, 0.0) * w for d, w in dimension_weights.items()
    )
    final_reward = round(min(1.0, max(0.0, final_reward)), 4)

    score = {
        "reward": final_reward,
        "_meta_report_found": 1,
        "_meta_word_count": word_count,
        "_meta_meets_length": meets_length,
    }
    for d, s in dimension_scores.items():
        score[f"dimension_{d}"] = s

    (verifier_dir / "reward.json").write_text(
        json.dumps(score, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (verifier_dir / "reward.txt").write_text(str(final_reward), encoding="utf-8")
    (verifier_dir / "llm_judge_response.json").write_text(
        json.dumps(raw_responses, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
