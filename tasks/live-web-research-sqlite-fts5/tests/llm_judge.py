#!/usr/bin/env python3
# NOTE: The utility functions in this file (call_judge, post_json, extract_chat_text,
# extract_responses_text, parse_json_blob, etc.) are intentionally duplicated across all
# five LLM-judge tasks. Harbor's per-task build context (environment/ dir only) prevents
# cross-task file sharing without baking shared logic into the base image. If you edit
# these helpers, apply the same change to the counterparts in:
#   tasks/conflict-repair-acb/tests/llm_judge.py
#   tasks/incremental-update-ctp/tests/llm_judge.py
#   tasks/live-web-research-sqlite-fts5/tests/llm_judge.py
#   tasks/mixed-tool-memory/tests/llm_judge.py
#   tasks/noise-filtering/tests/llm_judge.py
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import deterministic_checks as dc

RUBRIC = Path(__file__).with_name("rubric.json")
INSTRUCTION = dc.ROOT / "instruction.md"

SYSTEM_PROMPT = """You are a strict evaluator for a PKB benchmark case. Be critical — most work has flaws.

Score only the semantic quality of the agent's work. Do not reward formatting, verbosity, or any specific JSON schema.
Do not infer quality from field names or structure alone. Use only the actual content and reasoning.

IMPORTANT: Evaluate ALL agent outputs together — workspace notes, result.json, and output files. Content in result.json counts as meaningful output even when workspace notes are empty.

Return JSON only with this shape:
{
  "extraction_quality": 0.0,
  "note_quality": 0.0,
  "rationales": {
    "extraction_quality": "...",
    "note_quality": "..."
  }
}

Scoring rules — be strict, 1.0 is rare and reserved for exceptional work:
- Use a 0.0 to 1.0 scale in 0.25 increments.

- `extraction_quality`: Did the agent actually extract facts from the real web pages rather than just copying from local corpus files? Check each independently:
  1. paper_exactness — did the agent determine from the paper that speculative decoding preserves exact target distribution?
  2. paper_core_mechanism — did the agent identify the draft-then-verify loop from the paper?
  3. paper_venue — did the agent extract the publication venue (PMLR/ICML 2023) from page metadata?
  4. video_role — did the agent correctly classify the YouTube video as a public explainer?
  Score by counting how many of the 4 facts show evidence of genuine page extraction:
  - 1.0: All 4 facts show clear evidence of browser-based extraction, not just local corpus copying
  - 0.75: 3 of 4 facts extracted well
  - 0.5: 2 of 4 facts extracted
  - 0.25: Mostly copied from local brief with minimal page engagement, OR result.json contains answers that go beyond the local corpus but without clear browser evidence
  - 0.0: ONLY if result.json AND workspace notes are ALL completely empty or contain zero factual content about the paper/video

- `note_quality`: Is the agent's knowledge captured in a compact, reusable quick-reference?
  - 1.0: Durable workspace note concisely answers all 4 questions, clearly distinguishes the paper (authoritative) from the video (explainer), includes venue info for citation, and would be useful to a future agent without re-visiting the URLs.
  - 0.75: Note covers most questions but is missing venue detail or paper/video distinction.
  - 0.5: Answers are present in result.json (query_answers field) and are substantive, but no durable workspace note was created. The agent captured the knowledge in its structured output but not in a reusable workspace artifact.
  - 0.25: Some content exists in result.json but answers are shallow, generic, or lack source detail. OR workspace note exists but is mostly unchanged from seed.
  - 0.0: ONLY if neither result.json nor workspace notes contain ANY substantive answers to the 4 questions. If result.json has a populated query_answers field with real answers, you MUST score at least 0.25.
  MANDATORY RULE: If result.json query_answers contains substantive text answers for most questions, the minimum score is 0.25 (shallow answers) or 0.5 (good answers without workspace note). Score 0.0 is reserved for completely empty or missing content.
"""


def load_json(path: Path):
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


def serialize_json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)


def build_prompt(key: dict, result: dict, structural: dict) -> str:
    durable_paths = dc.gather_durable_artifact_paths(result)
    output_texts = dc.load_output_texts()

    durable_sections = []
    for path in durable_paths:
        durable_sections.append(
            "\n".join(
                [
                    f"### {dc.workspace_relpath(path)}",
                    dc.read_text(path).strip() or "(empty)",
                ]
            )
        )

    output_sections = []
    for name, text in output_texts.items():
        output_sections.append(f"### {name}\n{text}")

    focus = key.get("judge_focus", {})

    prompt_parts = [
        "# Task Prompt",
        dc.read_text(INSTRUCTION).strip() or "(missing instruction)",
        "",
        "# Structural Baseline",
        serialize_json(structural),
        "",
        "# What The Agent Should Have Extracted",
        "\n".join(f"- {item}" for item in focus.get("extraction_expectations", []))
        or "- (none provided)",
        "",
        "# What Good Note Quality Looks Like",
        "\n".join(f"- {item}" for item in focus.get("note_quality_expectations", []))
        or "- (none provided)",
        "",
        "# Agent result.json",
        serialize_json(result),
        "",
        "# Human-Readable Output Files",
        "\n\n".join(output_sections) if output_sections else "(none)",
        "",
        "# Durable Workspace Artifacts",
        "\n\n".join(durable_sections) if durable_sections else "(none)",
    ]
    return "\n".join(prompt_parts).strip() + "\n"


def main() -> None:
    key = load_json(dc.KEY)
    rubric = load_json(RUBRIC)
    result = dc.load_result_payload()

    score = dc.structural_scores(result)
    score.update(dc.database_integrity_score(key))
    score.update(dc.query_accuracy_score(key, result))
    score.update(dc.browser_trace_score(key))
    prompt = build_prompt(key, result, score)

    (dc.OUT / "llm_judge_prompt.txt").write_text(prompt, encoding="utf-8")

    judge_payload, debug_payload = call_judge(SYSTEM_PROMPT, prompt)
    (dc.OUT / "llm_judge_response.json").write_text(
        json.dumps(debug_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    score = {
        "result_contract_valid": score["result_contract_valid"],
        "database_integrity": score["database_integrity"],
        "query_accuracy": score["query_accuracy"],
        "browser_trace": score["browser_trace"],
        "workspace_update": score["workspace_update"],
        "extraction_quality": clamp_score(judge_payload.get("extraction_quality")),
        "note_quality": clamp_score(judge_payload.get("note_quality")),
        "_meta_rationales": judge_payload.get("rationales", {}),
        "_meta_judge_model": debug_payload.get("model"),
        "_meta_judge_mode": debug_payload.get("mode"),
    }
    score["reward"] = weighted_sum(score, rubric)

    (dc.ROOT / "reward.json").write_text(
        json.dumps(score, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (dc.ROOT / "reward.txt").write_text(str(score["reward"]), encoding="utf-8")


if __name__ == "__main__":
    main()
