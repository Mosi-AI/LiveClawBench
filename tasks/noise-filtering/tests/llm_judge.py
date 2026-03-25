#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import deterministic_checks as dc

RUBRIC = Path(__file__).with_name("rubric.json")
INSTRUCTION = dc.ROOT / "instruction.md"

SYSTEM_PROMPT = """You are evaluating a benchmark case for a PKB agent.

Score only the semantic quality of the agent's work. Do not reward formatting, verbosity, or any specific JSON schema.
Do not infer source quality from file names, ids, or titles. Use only the document contents and how well the agent handled conflicting evidence.

Return JSON only with this shape:
{
  "noise_source_identification": 0.0,
  "memory_correction": 0.0,
  "rationales": {
    "noise_source_identification": "...",
    "memory_correction": "..."
  }
}

Scoring rules:
- Use a 0.0 to 1.0 scale. Prefer 0.0, 0.25, 0.5, 0.75, or 1.0.
- `noise_source_identification`: Did the agent correctly isolate the misleading/noisy material by content and avoid treating it as reliable signal?
- `memory_correction`: Did the durable workspace notes actually correct the prior mistaken beliefs and leave a reusable memory update, rather than only producing a transient answer?
- For `memory_correction`, focus on durable workspace artifacts, not just `output/result.json`.
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


def call_judge(system_prompt: str, user_prompt: str) -> tuple[dict, dict]:
    base_url = (
        os.environ.get("OPENCLAW_JUDGE_BASE_URL")
        or os.environ.get("OPENCLAW_ARK_BASE_URL")
        or "https://ark.cn-beijing.volces.com/api/coding/v3"
    )
    model = (
        os.environ.get("OPENCLAW_JUDGE_MODEL")
        or os.environ.get("OPENCLAW_ARK_MODEL")
        or "kimi-k2.5"
    )
    api_key = (
        os.environ.get("OPENCLAW_JUDGE_API_KEY")
        or os.environ.get("OPENCLAW_ARK_API_KEY")
        or ""
    )
    if not api_key:
        raise RuntimeError("OPENCLAW_ARK_API_KEY is not set for LLM judging")

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
        except Exception as exc:  # pragma: no cover - network/runtime dependent
            errors.append(f"{mode}: {exc}")

    raise RuntimeError("LLM judge request failed: " + " | ".join(errors))


def serialize_json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)


def build_prompt(key: dict, result: dict, structural: dict) -> str:
    corpus_docs = dc.load_corpus_docs()
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

    corpus_sections = []
    for idx, doc in enumerate(corpus_docs, start=1):
        corpus_sections.append(
            "\n".join(
                [
                    f"### Document {idx}",
                    f"path: {doc['path']}",
                    doc["content"].strip() or "(empty)",
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
        "# Prior Memory Beliefs To Correct",
        "\n".join(f"- {item}" for item in focus.get("memory_seed_beliefs", []))
        or "- (none provided)",
        "",
        "# What Good Correction Looks Like",
        "\n".join(
            f"- {item}" for item in focus.get("memory_correction_expectations", [])
        )
        or "- (none provided)",
        "",
        "# Noise-Filtering Goal",
        str(focus.get("noise_goal", "")).strip(),
        "",
        "# Agent result.json",
        serialize_json(result),
        "",
        "# Human-Readable Output Files",
        "\n\n".join(output_sections) if output_sections else "(none)",
        "",
        "# Durable Workspace Artifacts",
        "\n\n".join(durable_sections) if durable_sections else "(none)",
        "",
        "# Corpus Documents",
        "\n\n".join(corpus_sections),
    ]
    return "\n".join(prompt_parts).strip() + "\n"


def main() -> None:
    key = load_json(dc.KEY)
    rubric = load_json(RUBRIC)
    result = load_json(dc.OUT / "result.json")
    structural = dc.structural_scores(result, key)
    prompt = build_prompt(key, result, structural)

    (dc.OUT / "llm_judge_prompt.txt").write_text(prompt, encoding="utf-8")

    judge_payload, debug_payload = call_judge(SYSTEM_PROMPT, prompt)
    (dc.OUT / "llm_judge_response.json").write_text(
        json.dumps(debug_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    score = {
        "result_contract_valid": structural["result_contract_valid"],
        "workspace_update": structural["workspace_update"],
        "noise_source_identification": clamp_score(
            judge_payload.get("noise_source_identification")
        ),
        "memory_correction": clamp_score(judge_payload.get("memory_correction")),
        "judge_rationales": judge_payload.get("rationales", {}),
        "judge_model": debug_payload.get("model"),
        "judge_mode": debug_payload.get("mode"),
    }
    score["final_score"] = weighted_sum(score, rubric)

    (dc.ROOT / "reward.json").write_text(
        json.dumps(score, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (dc.ROOT / "reward.txt").write_text(str(score["final_score"]), encoding="utf-8")


if __name__ == "__main__":
    main()
