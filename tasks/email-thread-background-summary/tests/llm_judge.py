#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import deterministic_checks as dc

RUBRIC = Path(__file__).with_name("rubric.json")
INSTRUCTION = Path(__file__).resolve().parents[1] / "instruction.md"

SYSTEM_PROMPT = """You are a strict evaluator for a project background summary benchmark task.

The agent received an email announcing the "Nova Analytics Platform" project and was asked
to read related corpus files, then write a short background summary to
~/.openclaw/output/project_background.txt.

The corpus contained four relevant files (project overview, architecture design,
stakeholders and requirements, risk register) and ONE unrelated red-herring file about
the "Signal Enhancement Suite". A correct summary should be based only on the Nova
Analytics Platform files.

Return JSON only with this shape:
{
  "summary_coverage": 0.0,
  "summary_accuracy": 0.0,
  "rationales": {
    "summary_coverage": "...",
    "summary_accuracy": "..."
  }
}

Scoring rules (use 0.0 to 1.0 scale in 0.25 increments):

- `summary_coverage`: Does the summary cover the key aspects of the Nova Analytics Platform?
  Expected content includes: project goals/purpose, timeline or launch target (Q3 2026),
  technology stack (Kafka, dbt, BigQuery), team lead (Dr. Sarah Kim), and at least one
  stakeholder group or known risk.
  - 1.0: Covers goals, timeline, tech stack, team lead, and stakeholders or risks.
  - 0.75: Covers 4 of the 5 expected aspects clearly.
  - 0.5: Covers 3 aspects; others are vague or missing.
  - 0.25: Only 1–2 aspects mentioned; very thin summary.
  - 0.0: File is empty, off-topic, or describes a different project.

- `summary_accuracy`: Are the facts correct relative to the corpus? No hallucinations?
  Is the summary focused on Nova Analytics and not the Signal Enhancement Suite?
  - 1.0: All stated facts match the corpus; no invented details; no SES content mixed in.
  - 0.75: Mostly accurate; one minor inaccuracy or vague statement.
  - 0.5: Some accurate facts but one clear hallucination or wrong value (e.g., wrong team
    lead name, wrong launch date, wrong technology name).
  - 0.25: Multiple hallucinations or significant wrong facts.
  - 0.0: Mostly fabricated or describes Signal Enhancement Suite instead of Nova Analytics.
"""


def read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def load_json_file(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def weighted_sum(score: dict, rubric: dict) -> float:
    return round(sum(score.get(key, 0.0) * weight for key, weight in rubric.items()), 4)


def clamp_score(value) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    return round(min(1.0, max(0.0, number)), 4)


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


DEFAULT_JUDGE_MODEL = "deepseek-v3.2"


def call_judge(system_prompt: str, user_prompt: str) -> tuple[dict, dict]:
    base_url = os.environ.get("JUDGE_BASE_URL") or ""
    model = os.environ.get("JUDGE_MODEL_ID") or DEFAULT_JUDGE_MODEL
    api_key = os.environ.get("JUDGE_API_KEY") or ""
    if not base_url:
        raise RuntimeError("JUDGE_BASE_URL is not set")
    if not api_key:
        raise RuntimeError("JUDGE_API_KEY is not set")

    chat_url = base_url.rstrip("/") + "/chat/completions"
    responses_url = base_url.rstrip("/") + "/responses"
    attempts = [
        (
            "chat_completions",
            chat_url,
            {
                "model": model,
                "temperature": 0,
                "max_tokens": 1200,
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
                "max_output_tokens": 1200,
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


def build_prompt(det_checks: dict) -> str:
    output_text = read_text(dc.OUTPUT_FILE).strip() or "(file not found or empty)"

    corpus_dir = Path.home() / ".openclaw" / "corpus"
    corpus_sections = []
    if corpus_dir.is_dir():
        for f in sorted(corpus_dir.iterdir()):
            if f.is_file():
                text = read_text(f).strip()
                corpus_sections.append(f"### {f.name}\n{text or '(empty)'}")

    prompt_parts = [
        "# Task Instruction",
        read_text(INSTRUCTION).strip() or "(missing instruction)",
        "",
        "# Deterministic Check Results",
        json.dumps(det_checks, ensure_ascii=False, indent=2),
        "",
        "# Corpus Materials Available to Agent",
        "\n\n".join(corpus_sections) if corpus_sections else "(none)",
        "",
        "# Agent Output: project_background.txt",
        output_text,
    ]
    return "\n".join(prompt_parts).strip() + "\n"


def main() -> None:
    rubric = load_json_file(RUBRIC)
    det_checks = dc.run_checks()

    out_dir = Path.home() / ".openclaw" / "output"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "deterministic_checks.json").write_text(
        json.dumps(det_checks, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    prompt = build_prompt(det_checks)
    (out_dir / "llm_judge_prompt.txt").write_text(prompt, encoding="utf-8")

    judge_payload, debug_payload = call_judge(SYSTEM_PROMPT, prompt)
    (out_dir / "llm_judge_response.json").write_text(
        json.dumps(debug_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    score = {
        "output_file_exists": det_checks["output_file_exists"],
        "project_identified": det_checks["project_identified"],
        "corpus_coverage_score": det_checks["corpus_coverage_score"],
        "summary_coverage": clamp_score(judge_payload.get("summary_coverage")),
        "summary_accuracy": clamp_score(judge_payload.get("summary_accuracy")),
        "_meta_rationales": judge_payload.get("rationales", {}),
        "_meta_det_checks": det_checks,
        "_meta_judge_model": debug_payload.get("model"),
        "_meta_judge_mode": debug_payload.get("mode"),
    }
    score["reward"] = weighted_sum(score, rubric)

    verifier_dir = Path("/logs/verifier")
    verifier_dir.mkdir(parents=True, exist_ok=True)
    (verifier_dir / "reward.json").write_text(
        json.dumps(score, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (verifier_dir / "reward.txt").write_text(str(score["reward"]), encoding="utf-8")


if __name__ == "__main__":
    main()
