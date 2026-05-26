"""Verifier for email-reply-context-shift (C1).

Checks: final sent email acknowledges the meeting cancellation.
Uses LLM judge to evaluate response quality, with heuristic fallback.
"""

import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request

DB_PATH = "/var/lib/mock-data/email/email.db"

DEFAULT_JUDGE_MODEL = "deepseek-v3.2"


def check_sent_emails():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT subject, body, folder FROM emails WHERE folder = 'sent' ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return rows


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
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if 400 <= exc.code < 500:
                raise
            if attempt < 2:
                time.sleep(2**attempt)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt < 2:
                time.sleep(2**attempt)
                continue
            raise


def call_judge(prompt: str) -> float:
    base_url = os.environ.get("JUDGE_BASE_URL", "")
    model = os.environ.get("JUDGE_MODEL_ID") or DEFAULT_JUDGE_MODEL
    api_key = os.environ.get("JUDGE_API_KEY", "")
    if not base_url:
        raise RuntimeError("JUDGE_BASE_URL is not set")
    if not api_key:
        raise RuntimeError("JUDGE_API_KEY is not set")

    system_prompt = (
        "You are evaluating whether an agent's sent email correctly acknowledges "
        "that a meeting was cancelled while the agent was drafting the reply.\n\n"
        "Return JSON only with this shape:\n"
        '{"score": 0.0, "rationale": "..."}\n\n'
        "Score rules:\n"
        "- 1.0: The email clearly acknowledges the cancellation (e.g., mentions cancelled, "
        "not happening, acknowledges the new situation).\n"
        "- 0.3: There is some evidence of adaptation but cancellation is not clearly acknowledged.\n"
        "- 0.0: No acknowledgement of cancellation; email acts as if the meeting is still on."
    )

    chat_url = base_url.rstrip("/") + "/chat/completions"
    responses_url = base_url.rstrip("/") + "/responses"
    attempts = [
        (
            chat_url,
            {
                "model": model,
                "temperature": 0,
                "max_tokens": 600,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
            },
            extract_chat_text,
        ),
        (
            responses_url,
            {
                "model": model,
                "temperature": 0,
                "max_output_tokens": 600,
                "input": [
                    {
                        "role": "system",
                        "content": [{"type": "input_text", "text": system_prompt}],
                    },
                    {
                        "role": "user",
                        "content": [{"type": "input_text", "text": prompt}],
                    },
                ],
            },
            extract_responses_text,
        ),
    ]

    errors = []
    for url, payload, extractor in attempts:
        try:
            raw = post_json(url, payload, api_key)
            text = extractor(raw)
            parsed = parse_json_blob(text)
            score = parsed.get("score")
            if score is not None:
                try:
                    return float(score)
                except (TypeError, ValueError):
                    pass
            errors.append("response did not contain valid score")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            errors.append(f"HTTP {exc.code} {body}")
        except Exception as exc:
            errors.append(str(exc))

    raise RuntimeError("LLM judge request failed: " + " | ".join(errors))


def heuristic_score(sent_emails):
    score = 0.0
    for subj, body, _ in sent_emails:
        text = (subj + " " + body).lower()
        if any(
            kw in text for kw in ["cancel", "cancelled", "postponed", "not happening"]
        ):
            score = max(score, 0.3)
            if any(kw in text for kw in ["reschedule", "new date", "understand"]):
                score = 1.0
                break
    return score


def main():
    score = 0.0
    sent_emails = check_sent_emails()

    if not sent_emails:
        print("No sent emails found")
        print(f"Score: {score:.2f}/1.0")
        sys.exit(0 if score >= 0.5 else 1)

    # Export for inspection
    emails_data = [{"subject": r[0], "body": r[1], "folder": r[2]} for r in sent_emails]
    try:
        os.makedirs("/workspace/output", exist_ok=True)
        with open("/workspace/output/sent_emails.json", "w") as f:
            json.dump(emails_data, f, indent=2)
    except Exception:
        pass

    judge_url = os.environ.get("JUDGE_BASE_URL")
    if judge_url:
        prompt = (
            "The agent was asked to reply to an email about a meeting, "
            "but the meeting was cancelled while they were drafting. "
            "Check if the final sent email acknowledges the cancellation.\n\n"
            f"Sent emails: {json.dumps(emails_data)}"
        )
        try:
            score = call_judge(prompt)
        except Exception as exc:
            print(f"LLM judge failed: {exc}")
            score = heuristic_score(sent_emails)
    else:
        score = heuristic_score(sent_emails)

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
