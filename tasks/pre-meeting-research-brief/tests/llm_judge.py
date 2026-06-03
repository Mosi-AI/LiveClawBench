#!/usr/bin/env python3
# NOTE: The utility functions in this file (call_judge, post_json, extract_chat_text,
# extract_responses_text, parse_json_blob, etc.) are intentionally duplicated across all
# twenty-one LLM-judge tasks. Harbor's per-task build context (environment/ dir only)
# prevents cross-task file sharing without baking shared logic into the base image.
# If you edit these helpers, sync the change to every other tasks/*/tests/llm_judge.py
# (21 files in total — see CLAUDE.md `LLM-judge tasks` for the canonical list).
import datetime
import http.client  # PR-5: RemoteDisconnected / IncompleteRead retries
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

import deterministic_checks as dc

RUBRIC = Path(__file__).with_name("rubric.json")
INSTRUCTION = dc.ROOT / "instruction.md"

SYSTEM_PROMPT = """You are a strict evaluator for a research brief benchmark case. Be critical — most work has significant gaps.

Score only the semantic quality of the agent's research brief. Do not reward length, formatting, or generic statements.
Every claim in the brief must be traceable to a specific corpus source. Generic business advice or ungrounded assertions should receive low scores.

Return JSON only with this shape:
{
  "grounding_quality": 0.0,
  "synthesis_quality": 0.0,
  "meeting_summary_accuracy": 0.0,
  "rationales": {
    "grounding_quality": "...",
    "synthesis_quality": "...",
    "meeting_summary_accuracy": "..."
  }
}

Scoring rules — be strict, 1.0 is rare:
- Use a 0.0 to 1.0 scale in 0.25 increments.

- `grounding_quality`: Are the discussion points, risks, and opportunities each traceable to specific information from the corpus? Each item should cite or clearly reference a concrete detail (company fact, market figure, legal requirement, competitive dynamic) from the provided materials.
  - 1.0: Every discussion point and risk/opportunity maps to a specific corpus fact. No generic filler ("AI is important", "consider regulations").
  - 0.75: Most items are grounded but 1–2 are vague or not traceable to provided materials.
  - 0.5: Half the items are grounded; the other half are generic advice.
  - 0.25: Mostly generic business platitudes with minimal corpus linkage.
  - 0.0: No meaningful grounding in provided materials.

- `synthesis_quality`: Do the suggested questions and overall brief demonstrate synthesis across multiple corpus sources? High-quality briefs connect facts from different documents (e.g., linking the legal concern to the product capability to a competitive implication). Low-quality briefs list facts without integration.
  - 1.0: Questions are sharp, specific, and derived from cross-source synthesis. Brief demonstrates clear reasoning chains.
  - 0.75: Most questions are specific; 1–2 are generic. Some cross-source connections.
  - 0.5: Questions are adequate but could be asked without reading the corpus.
  - 0.25: Questions are generic ("What are your goals?", "How do you handle security?").
  - 0.0: No meaningful synthesis evident.

- `meeting_summary_accuracy`: Does meeting_summary correctly identify the counterpart and key meeting details from the calendar entry provided? It must name the counterpart (Alex Morgan / NovaTech AI), reference the correct date (either as "Friday" or the ISO date shown in the calendar entry), and ideally include time (14:00) and location (Conference Room A). Do not reward fabricated or generic summaries not grounded in the calendar entry.
  - 1.0: Counterpart name/company, correct date (weekday or ISO), and at least one of time or location correctly stated.
  - 0.75: Counterpart identified and date correct; time or location omitted but no fabrication.
  - 0.5: Counterpart identified but date or another key detail is wrong or fabricated.
  - 0.25: Meeting referenced but counterpart wrong or significantly fabricated.
  - 0.0: Completely fabricated, generic, or no reference to the seeded meeting details.
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
    # PR-5: cover TLS EOF / RemoteDisconnected / IncompleteRead in addition
    # to the original URLError. Budget: 3 attempts x 60s + (1 + 2)s sleeps
    # = ~183s, fits within harbor's 240s verifier_timeout default.
    # (Issue #108 §2.4 / TRACKING B5.1; budget tuned per PR #112 review.)
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if 400 <= exc.code < 500:
                raise  # 4xx is permanent — do not retry
            last_exc = exc
        except (OSError, http.client.IncompleteRead) as exc:
            # URLError, TimeoutError, ConnectionError, ssl.SSLError, and
            # http.client.RemoteDisconnected all inherit from OSError;
            # IncompleteRead is a HTTPException so it must be listed
            # separately. (PR-5 / PR #112 review simplification.)
            last_exc = exc
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            # PR #112 review (112-4): partial / malformed response bodies
            # (truncated chunked transfers, gzip stripping by middleboxes,
            # the judge endpoint returning HTML on a transient 5xx page) get
            # raised here. Treat as retryable instead of bubbling an
            # uncaught exception past the verifier's per-dimension try/except.
            last_exc = exc
        if attempt < 2:
            time.sleep(2**attempt)
    # PR #112 review (112-5): the prior `if last_exc is None: raise
    # RuntimeError(...)` guard is unreachable — the loop only falls through
    # after attempt 2, and every failure branch above assigns last_exc.
    # The `type: ignore` covers the Optional narrowing for mypy/ruff.
    raise last_exc  # type: ignore[misc]


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


def fetch_calendar_context() -> str:
    """Fetch the seeded partnership meeting todo so the judge can verify meeting_summary accuracy.

    Raises RuntimeError if the todo service is unreachable or no meeting entry is found.
    """
    with urllib.request.urlopen("http://localhost:3000/api/todos", timeout=5) as r:
        data = json.loads(r.read().decode("utf-8"))
    todos = data.get("data") or []
    for todo in todos:
        title = (todo.get("title") or "").lower()
        description = (todo.get("description") or "").lower()
        if (
            "partnership" in title
            or "novatech" in title
            or "partnership" in description
        ):
            date_str = todo.get("date", "")
            try:
                weekday = datetime.date.fromisoformat(date_str).strftime("%A")
                date_display = f"{date_str} ({weekday})"
            except (ValueError, TypeError):
                date_display = date_str
            return (
                f"Title: {todo.get('title', '')}\n"
                f"Date: {date_display}\n"
                f"Time: {todo.get('time', '')}\n"
                f"Location: {todo.get('location', '')}\n"
                f"Person: {todo.get('person', '')}\n"
                f"Description: {todo.get('description', '')}"
            )
    raise RuntimeError(
        "Partnership meeting not found in calendar — cannot judge meeting_summary accuracy"
    )


def build_prompt(result: dict, structural: dict) -> str:
    calendar_context = fetch_calendar_context()

    corpus_dir = dc.ROOT / "corpus"
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
        serialize_json(structural),
        "",
        "# Calendar Entry Available to Agent",
        calendar_context,
        "",
        "# Corpus Materials Available to Agent",
        "\n\n".join(corpus_sections) if corpus_sections else "(none)",
        "",
        "# Agent result.json",
        serialize_json(result),
    ]
    return "\n".join(prompt_parts).strip() + "\n"


def main() -> None:
    key = dc.load_json(dc.KEY)
    rubric = load_json(RUBRIC)
    result = dc.load_json(dc.OUT / "result.json")

    det_scores = dc.structural_scores(result, key)
    det_scores.update(dc.anchor_scores(result, key))

    dc.OUT.mkdir(parents=True, exist_ok=True)
    prompt = build_prompt(result, det_scores)
    (dc.OUT / "llm_judge_prompt.txt").write_text(prompt, encoding="utf-8")

    judge_payload, debug_payload = call_judge(SYSTEM_PROMPT, prompt)
    (dc.OUT / "llm_judge_response.json").write_text(
        json.dumps(debug_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    score = {
        "structural_valid": det_scores["structural_valid"],
        "structure_completeness": det_scores["structure_completeness"],
        "anchor_coverage": det_scores["anchor_coverage"],
        "meeting_summary_accuracy": clamp_score(
            judge_payload.get("meeting_summary_accuracy")
        ),
        "grounding_quality": clamp_score(judge_payload.get("grounding_quality")),
        "synthesis_quality": clamp_score(judge_payload.get("synthesis_quality")),
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
