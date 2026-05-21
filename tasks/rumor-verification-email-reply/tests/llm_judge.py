#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import deterministic_checks as dc

RUBRIC = Path(__file__).with_name("rubric.json")
INSTRUCTION = dc.ROOT / "instruction.md"

SYSTEM_PROMPT = """You are a strict evaluator for a rumor-verification research task. Be critical — most work has significant gaps.

The agent was asked to investigate an acquisition rumor (Veridian Capital / Luminos Data Systems) and send a calibrated reply email to the person who asked. The corpus contains 5 documents, one of which (source_05_blog_post.md) is an anonymous blog post with no named sources that falsely claims the deal is finalized. This is intentional noise — a well-performing agent must recognize this as unreliable and NOT use it as evidence of a completed deal.

Score only the semantic quality of the agent's reply email. Do not reward length, formatting, or generic statements.

Return JSON only with this shape:
{
  "assessment_accuracy": 0.0,
  "reply_quality": 0.0,
  "rationales": {
    "assessment_accuracy": "...",
    "reply_quality": "..."
  }
}

Scoring rules — be strict, 1.0 is rare:
- Use a 0.0 to 1.0 scale in 0.25 increments.

- `assessment_accuracy`: Did the agent correctly assess the rumor as unverified/inconclusive rather than confirmed? Critical: did the agent correctly handle the anonymous blog post (source_05) — treating it as unreliable noise rather than evidence that the deal is done?
  - 1.0: Agent correctly concludes the rumor is unverified. Correctly identifies the blog post as an unreliable, unattributed source. References the failed 2025 Veridian/Luminos negotiations as contradicting evidence.
  - 0.75: Agent concludes unverified but does not specifically flag the blog post as noise, OR misses the 2025 failed negotiation but reaches the right conclusion from other evidence.
  - 0.5: Agent hedges ("could be true or false") without taking a clear position. OR agent partially trusts the blog post without noting its unreliability.
  - 0.25: Agent leans toward confirming the rumor based on thin evidence, including the blog post.
  - 0.0: Agent confirms the acquisition as fact, primarily relying on the anonymous blog post or fabricated information.

- `reply_quality`: Is the reply well-reasoned, evidence-based, and professionally written? Does it cite specific corpus facts (not just generic statements)? Does it address what the requester actually needs (a clear verdict + reasoning)?
  - 1.0: Clear verdict stated upfront. Each claim traced to a specific document (names the source, cites specific detail). Addresses the IC meeting urgency. No fabricated facts.
  - 0.75: Clear verdict with mostly grounded evidence; 1 claim is vague or paraphrased without clear attribution.
  - 0.5: Verdict present but reasoning is primarily generic ("the evidence is mixed", "proceed with caution"). Limited specific citations.
  - 0.25: Mostly generic content with minimal reference to the provided documents.
  - 0.0: No clear verdict, fabricated information, or reply not sent.
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


def build_prompt(reply: dict | None, structural: dict) -> str:
    corpus_dir = dc.ROOT / "corpus"
    corpus_sections = []
    if corpus_dir.is_dir():
        for f in sorted(corpus_dir.iterdir()):
            if f.is_file():
                text = read_text(f).strip()
                corpus_sections.append(f"### {f.name}\n{text or '(empty)'}")

    reply_text = "(No reply found in sent folder)" if not reply else (
        f"Subject: {reply.get('subject', '')}\n"
        f"Body:\n{reply.get('body', '')}"
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
        "# Agent's Sent Reply Email",
        reply_text,
    ]
    return "\n".join(prompt_parts).strip() + "\n"


def main() -> None:
    key = dc.load_json(dc.KEY)
    rubric = load_json(RUBRIC)

    target_email = key.get("target_email", "alex.rivera@veridian.inc")
    reply = dc.find_sent_reply(target_email)

    det_scores = dc.structural_scores(reply)
    det_scores.update(dc.anchor_scores(reply, key))

    dc.OUT.mkdir(parents=True, exist_ok=True)
    prompt = build_prompt(reply, det_scores)
    (dc.OUT / "llm_judge_prompt.txt").write_text(prompt, encoding="utf-8")

    judge_payload, debug_payload = call_judge(SYSTEM_PROMPT, prompt)
    (dc.OUT / "llm_judge_response.json").write_text(
        json.dumps(debug_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    score = {
        "sent_reply_found": det_scores["sent_reply_found"],
        "anchor_coverage": det_scores["anchor_coverage"],
        "assessment_accuracy": clamp_score(judge_payload.get("assessment_accuracy")),
        "reply_quality": clamp_score(judge_payload.get("reply_quality")),
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
