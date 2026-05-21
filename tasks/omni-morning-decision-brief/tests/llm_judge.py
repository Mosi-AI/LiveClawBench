#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import deterministic_checks as dc

RUBRIC = Path(__file__).with_name("rubric.json")
INSTRUCTION = Path(__file__).resolve().parents[1] / "instruction.md"

SYSTEM_PROMPT = """You are a strict evaluator for a morning decision brief benchmark task.

The agent was asked to:
1. Check the user's calendar, email, health stats, and weather.
2. Send a morning brief to the team chat with 4 sections: must-dos, schedule risks, health/weather, prep.
3. Update /workspace/daily_action_log.md with today's key action items.

A key B1 (Implicit Goal Resolution) aspect: the calendar has TWO overlapping meetings between
10:00-11:00 (Q2 Budget Review) and 10:30-11:30 (Vendor Demo - CloudEdge). The agent must notice
and report this conflict WITHOUT being explicitly told to look for conflicts.

Be critical. High scores require specific, accurate content grounded in the actual service data.

Return JSON only with this shape:
{
  "schedule_risk_detected": 0.0,
  "brief_completeness": 0.0,
  "synthesis_quality": 0.0,
  "rationales": {
    "schedule_risk_detected": "...",
    "brief_completeness": "...",
    "synthesis_quality": "..."
  }
}

Scoring rules (0.0 to 1.0 in 0.25 increments):

- `schedule_risk_detected`: Did the agent identify the hidden schedule conflict between
  Q2 Budget Review (10:00-11:00) and the Vendor Demo (10:30-11:30)?
  - 1.0: Conflict explicitly called out with both meeting names and the time overlap.
  - 0.75: Conflict mentioned but one meeting name missing or overlap time imprecise.
  - 0.5: Agent notes something is wrong with the 10:00-11:30 window without specifics.
  - 0.25: Vague mention of "busy morning" without identifying the conflict.
  - 0.0: No mention of any schedule conflict.

- `brief_completeness`: Does the brief contain all 4 required sections with substantive content?
  Sections: (1) must-do items, (2) schedule risks, (3) health/weather, (4) prep/recommended reading.
  - 1.0: All 4 sections present with specific actionable content (not generic placeholders).
  - 0.75: 3 of 4 sections present with good content; one section thin or generic.
  - 0.5: 2 of 4 sections present, or all 4 present but mostly generic/empty.
  - 0.25: Only 1 section present or all sections are placeholder text.
  - 0.0: Brief is missing, empty, or not structured.

- `synthesis_quality`: Does the brief demonstrate meaningful cross-service synthesis?
  High quality: connects email action items to calendar events (e.g., "prep for 10:30 demo" linked
  to the CloudEdge email), uses real health/weather data, identifies the Q2 roadmap deadline.
  - 1.0: Brief connects facts from ≥3 services in a coherent, actionable narrative.
  - 0.75: Uses ≥2 services well; connections are clear and specific.
  - 0.5: Uses multiple services but mostly lists facts without synthesis.
  - 0.25: Mostly generic advice; minimal grounding in actual service data.
  - 0.0: No apparent use of actual service data.
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


def fetch_chat_messages() -> str:
    try:
        req = urllib.request.Request(f"{dc.CHAT_BASE}/api/channels/1/messages")
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read().decode("utf-8"))
        messages = data.get("messages", [])
        chat_msgs = [m for m in messages if m.get("message_kind") == "chat"]
        if not chat_msgs:
            return "(no chat messages found in #general)"
        last = chat_msgs[-1]
        return last.get("body", "(empty message)")
    except Exception as exc:
        return f"(error fetching chat messages: {exc})"


def build_prompt(det_checks: dict) -> str:
    brief_text = fetch_chat_messages()
    log_text = (
        dc.read_text(dc.DAILY_LOG).strip() or "(daily_action_log.md not found or empty)"
    )

    prompt_parts = [
        "# Task Instruction",
        read_text(INSTRUCTION).strip() or "(missing instruction)",
        "",
        "# Deterministic Check Results",
        json.dumps(det_checks, ensure_ascii=False, indent=2),
        "",
        "# Seeded Schedule Context (for evaluating schedule_risk_detected)",
        (
            "Today's calendar had 4 events:\n"
            "  09:00-09:30 Morning Team Standup\n"
            "  10:00-11:00 Q2 Budget Review\n"
            "  10:30-11:30 Vendor Demo - CloudEdge Integration  <-- CONFLICT with Budget Review\n"
            "  15:00-16:00 1:1 with Jordan Chen\n"
            "Key emails: (1) CloudEdge pre-read for 10:30 demo, "
            "(2) ACTION REQUIRED: Q2 Roadmap due today by 5 PM"
        ),
        "",
        "# Agent's Morning Brief (sent to #general chat)",
        brief_text,
        "",
        "# Agent's daily_action_log.md update",
        log_text,
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
        "chat_message_sent": det_checks["chat_message_sent"],
        "daily_log_updated": det_checks["daily_log_updated"],
        "schedule_risk_detected": clamp_score(
            judge_payload.get("schedule_risk_detected")
        ),
        "brief_completeness": clamp_score(judge_payload.get("brief_completeness")),
        "synthesis_quality": clamp_score(judge_payload.get("synthesis_quality")),
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
