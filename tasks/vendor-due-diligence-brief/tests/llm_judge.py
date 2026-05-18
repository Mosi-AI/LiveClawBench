#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import deterministic_checks as dc

RUBRIC = Path(__file__).with_name("rubric.json")
INSTRUCTION = dc.ROOT / "instruction.md"

SYSTEM_PROMPT = """You are a strict evaluator for a vendor due diligence brief benchmark case. Be critical — most work has significant gaps.

Score only the semantic quality of the agent's due diligence brief. Do not reward length, formatting, or generic statements.
Every red flag must be traceable to a specific corpus document or email detail. Generic risk boilerplate ("vendor lock-in", "security risks") with no corpus linkage must receive low scores.

Return JSON only with this shape:
{
  "evidence_grounding": 0.0,
  "recommendation_quality": 0.0,
  "vendor_background_quality": 0.0,
  "rationales": {
    "evidence_grounding": "...",
    "recommendation_quality": "...",
    "vendor_background_quality": "..."
  }
}

Scoring rules — be strict, 1.0 is rare:
- Use a 0.0 to 1.0 scale in 0.25 increments.

- `evidence_grounding`: Are the red flags each backed by a specific, citable detail from the email or corpus materials? Generic claims like "the vendor may have security issues" or "pricing could be high" with no reference to a specific document fact are not evidence-grounded.
  - 1.0: Every red flag cites a specific fact (e.g., "SOC 2 Type II not yet certified per security questionnaire", "IP dispute with ForgeNet per internal memo"). No fabricated or ungrounded claims.
  - 0.75: Most red flags are grounded; 1 is generic or paraphrased without traceable source.
  - 0.5: Half grounded, half generic boilerplate.
  - 0.25: Mostly generic risks with minimal corpus linkage.
  - 0.0: All red flags are invented or could apply to any vendor without reading the materials.

- `recommendation_quality`: Is the recommendation actionable and proportionate to the identified risks? A good recommendation names a specific next step or condition (e.g., "proceed only after receiving SOC 2 Type II report and resolution of the ForgeNet IP dispute"). A bad recommendation is vague ("proceed with caution") or fails to address the most critical risks.
  - 1.0: Recommendation explicitly addresses the top risks with named conditions. Clearly states proceed / conditional / do not proceed with a rationale grounded in the evidence.
  - 0.75: Mostly actionable but missing one specific condition or risk reference.
  - 0.5: Generic recommendation that doesn't engage with the specific risks identified.
  - 0.25: Contradicts the evidence or ignores critical red flags.
  - 0.0: No meaningful recommendation or completely ungrounded.

- `vendor_background_quality`: Does vendor_background correctly identify the vendor using details from the intro email and corpus, and does fit_assessment meaningfully engage with the technical need? vendor_background must include the contact name (Marcus Webb) and email address (partnerships@cloudedge.io) from the intro email, plus key corpus facts (DataGuard / AES-256-GCM, Series A / $18M, founded 2022). fit_assessment should address whether the product actually fits the stated use case — not generic statements.
  - 1.0: Contact name and email correct from email; company facts (product, funding, founding year) from corpus; fit_assessment engages specifically with the technical use case.
  - 0.75: Contact name correct but email missing, OR one corpus fact missing; fit_assessment adequate.
  - 0.5: Company and product identified from corpus but contact info missing or wrong; fit_assessment generic.
  - 0.25: Only company name correct; background mostly fabricated; fit_assessment absent or vague.
  - 0.0: Wrong vendor, fabricated contact info, or background entirely missing.
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


def _email_auth_token() -> str:
    """Log in as the default user and return a bearer token."""
    request = urllib.request.Request(
        "http://localhost:5174/api/auth/login",
        data=json.dumps({"username": "peter", "password": "password123"}).encode(
            "utf-8"
        ),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5) as r:
        data = json.loads(r.read().decode("utf-8"))
    token = (data.get("data") or {}).get("access_token")
    if not token:
        raise RuntimeError("Email auth login failed — could not obtain access_token")
    return token


def fetch_email_context() -> str:
    """Fetch vendor intro email from mock service so the judge can verify email-backed claims.

    Raises RuntimeError if the email service is unreachable or the vendor intro is not found,
    so a broken A1 dependency fails the verifier closed rather than degrading silently.
    """
    token = _email_auth_token()
    auth_headers = {"Authorization": f"Bearer {token}"}
    request = urllib.request.Request(
        "http://localhost:5174/api/emails?folder=inbox", headers=auth_headers
    )
    with urllib.request.urlopen(request, timeout=5) as r:
        data = json.loads(r.read().decode("utf-8"))
    emails = data.get("data", {}).get("emails", [])
    for email in emails:
        subject = (email.get("subject") or "").lower()
        body = (email.get("body") or "").lower()
        if "cloudedge" in subject or "vendor" in subject or "cloudedge" in body:
            email_id = email.get("id")
            if email_id:
                detail_request = urllib.request.Request(
                    f"http://localhost:5174/api/emails/{email_id}",
                    headers=auth_headers,
                )
                with urllib.request.urlopen(detail_request, timeout=5) as r:
                    detail = json.loads(r.read().decode("utf-8"))
                email = detail.get("data", {}).get("email", email)
            return (
                f"Subject: {email.get('subject', '')}\n"
                f"From: {email.get('sender_name', '')} <{email.get('sender_email', '')}>\n"
                f"Body:\n{email.get('body', '')}"
            )
    raise RuntimeError(
        "Vendor intro email not found in inbox — cannot judge email-backed evidence"
    )


def build_prompt(result: dict, structural: dict) -> str:
    email_context = fetch_email_context()

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
        "# Vendor Introduction Email",
        email_context,
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
        "red_flags_minimum": det_scores["red_flags_minimum"],
        "anchor_coverage": det_scores["anchor_coverage"],
        "vendor_background_quality": clamp_score(
            judge_payload.get("vendor_background_quality")
        ),
        "evidence_grounding": clamp_score(judge_payload.get("evidence_grounding")),
        "recommendation_quality": clamp_score(
            judge_payload.get("recommendation_quality")
        ),
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
