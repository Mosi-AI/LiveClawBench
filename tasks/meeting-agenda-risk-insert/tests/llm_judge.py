#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import deterministic_checks as dc

RUBRIC = Path(__file__).with_name("rubric.json")
INSTRUCTION = dc.ROOT / "instruction.md"

SYSTEM_PROMPT = """You are a strict evaluator for a meeting preparation benchmark case. Be critical — most work has significant gaps.

The agent was asked to review research materials about a TerraScale Logistics partnership meeting and update the calendar event description with a risk summary. The corpus contains 5 documents with 3 key seeded risks the agent should have identified:
1. GDPR compliance gap — TerraScale's DPA lacks Article 46 SCCs for EU→APAC transfers (source_03)
2. API fee dispute — 20-point discount gap (~$180K/year impact), currently deadlocked (source_02)
3. Integration timeline risk — comparable Atlas Logistics deal took 10 months vs. projected 4 (source_05)

Score only the semantic quality of the agent's calendar description update. Do not reward length, formatting, or generic statements.

Return JSON only with this shape:
{
  "risk_quality": 0.0,
  "risk_coverage": 0.0,
  "rationales": {
    "risk_quality": "...",
    "risk_coverage": "..."
  }
}

Scoring rules — be strict, 1.0 is rare:
- Use a 0.0 to 1.0 scale in 0.25 increments.

- `risk_quality`: Are the identified risks specific and traceable to corpus documents? Generic risks ("regulatory risk", "timeline delays") with no corpus linkage should receive low scores. Strong risks cite specific facts (e.g., "Article 46 SCC gap per Q2 compliance review", "20-point API discount gap per Q1 negotiation notes", "Atlas Logistics integration took 10 months vs. 4-month projection").
  - 1.0: Every risk cites a specific fact from a named corpus document. No generic filler.
  - 0.75: Most risks are grounded; 1 is vague or paraphrased without clear attribution.
  - 0.5: Some risks grounded but about half are generic ("compliance risk", "SLA issues").
  - 0.25: Mostly generic with minimal corpus linkage.
  - 0.0: All risks are invented, generic, or the description was not updated.

- `risk_coverage`: Did the agent identify all 3 key seeded risks (GDPR gap, API fee dispute, integration timeline)? Missing a seeded risk means incomplete preparation.
  - 1.0: All 3 risks explicitly addressed with substance.
  - 0.75: 2 of 3 risks addressed with substance; 1 mentioned only superficially or missing.
  - 0.5: Only 2 of 3 risks meaningfully addressed.
  - 0.25: Only 1 of 3 risks identified.
  - 0.0: No seeded risks identified, or description not updated.
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


def serialize_json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)


def read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def build_prompt(event: dict | None, structural: dict) -> str:
    corpus_dir = dc.ROOT / "corpus"
    corpus_sections = []
    if corpus_dir.is_dir():
        for f in sorted(corpus_dir.iterdir()):
            if f.is_file():
                text = read_text(f).strip()
                corpus_sections.append(f"### {f.name}\n{text or '(empty)'}")

    event_text = "(Calendar event not found or description not updated)" if not event else (
        f"Title: {event.get('title', '')}\n"
        f"Start: {event.get('start_time', '')}\n"
        f"Updated Description:\n{event.get('description', '')}"
    )

    prompt_parts = [
        "# Task Instruction",
        read_text(INSTRUCTION).strip() or "(missing instruction)",
        "",
        "# Deterministic Check Results",
        serialize_json(structural),
        "",
        "# Corpus Materials Available to Agent",
        "\n\n".join(corpus_sections) if corpus_sections else "(none)",
        "",
        "# Updated Calendar Event",
        event_text,
    ]
    return "\n".join(prompt_parts).strip() + "\n"


def main() -> None:
    key = dc.load_json(dc.KEY)
    rubric = load_json(RUBRIC)

    keyword = key.get("event_title_keyword", "TerraScale")
    event = dc.find_terrascale_event(keyword)

    det_scores = dc.structural_scores(event)
    det_scores.update(dc.anchor_scores(event, key))

    dc.OUT.mkdir(parents=True, exist_ok=True)
    prompt = build_prompt(event, det_scores)
    (dc.OUT / "llm_judge_prompt.txt").write_text(prompt, encoding="utf-8")

    judge_payload, debug_payload = call_judge(SYSTEM_PROMPT, prompt)
    (dc.OUT / "llm_judge_response.json").write_text(
        json.dumps(debug_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    score = {
        "description_updated": det_scores["description_updated"],
        "anchor_coverage": det_scores["anchor_coverage"],
        "risk_quality": clamp_score(judge_payload.get("risk_quality")),
        "risk_coverage": clamp_score(judge_payload.get("risk_coverage")),
        "_meta_rationales": judge_payload.get("rationales", {}),
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
