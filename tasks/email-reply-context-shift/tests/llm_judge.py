"""Verifier for email-reply-context-shift (C1).

Checks: final sent email acknowledges the meeting cancellation.

Scoring:
  - When JUDGE_BASE_URL is set and the judge call succeeds, return the
    judge's 0.0-1.0 score + write per-dimension breakdown to reward.json.
  - When JUDGE_BASE_URL is set but the call fails (network outage, model
    rejected, etc.), the retry loop exhausts and the verifier emits 0.0
    with `_meta_judge_failed=1`. (Was previously a silent 0; PR-5 makes
    the failure mode explicit so downstream stats can filter judge errors
    out of agent-skill aggregates.)
  - When JUDGE_BASE_URL is unset (offline / no-credentials run), fall back
    to the deterministic heuristic scorer.
"""

import http.client  # PR-5: RemoteDisconnected / IncompleteRead retries
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
        if attempt < 2:
            time.sleep(2**attempt)
    if last_exc is None:
        # Defensive: retry loop must have set last_exc on every failure path;
        # `if` instead of `assert` so behavior is identical under `python -O`.
        raise RuntimeError("post_json retry loop exited without raising")
    raise last_exc


def call_judge(prompt: str) -> tuple[float, str, str]:
    """Return (score, rationale, mode) from the judge. PR-5 B5.4: rationale is
    surfaced so the verifier can write it into reward.json's _meta_judge_verdict.
    Raises RuntimeError on persistent failure (no silent fallback to 0)."""
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
            "chat_completions",
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
            "responses",
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
    for mode, url, payload, extractor in attempts:
        try:
            raw = post_json(url, payload, api_key)
            text = extractor(raw)
            parsed = parse_json_blob(text)
            score = parsed.get("score")
            rationale = str(parsed.get("rationale", ""))[:500]
            if score is not None:
                try:
                    return float(score), rationale, mode
                except (TypeError, ValueError):
                    pass
            errors.append(f"{mode}: response did not contain valid score")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            errors.append(f"{mode}: HTTP {exc.code} {body}")
        except Exception as exc:
            errors.append(f"{mode}: {exc}")

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


def _write_breakdown(
    score: float,
    sent_emails,
    *,
    judge_used: int,
    judge_mode: str = "",
    judge_verdict: str = "",
    judge_failed: int = 0,
    judge_error: str = "",
) -> None:
    """PR-5 B5.4: write reward.json with breakdown fields. Stage-2 / harbor can
    inspect _meta_judge_* to distinguish a true 0-score from a judge failure."""
    import pathlib as _pl

    verifier_dir = _pl.Path("/logs/verifier")
    try:
        verifier_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "reward": round(float(score), 4),
            "passed": int(score >= 0.5),
            "_meta_sent_email_count": len(sent_emails),
            "_meta_judge_used": int(judge_used),
            "_meta_judge_mode": judge_mode,
            "_meta_judge_verdict": judge_verdict,
            "_meta_judge_failed": int(judge_failed),
            "_meta_judge_error": judge_error,
        }
        (verifier_dir / "reward.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except Exception as exc:
        print(f"WARNING: could not write reward.json: {exc}", file=sys.stderr)


def main():
    score = 0.0
    sent_emails = check_sent_emails()

    if not sent_emails:
        print("No sent emails found")
        _write_breakdown(score, sent_emails, judge_used=0)
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
    judge_mode = ""
    judge_verdict = ""
    judge_failed = 0
    judge_error = ""
    if judge_url:
        prompt = (
            "The agent was asked to reply to an email about a meeting, "
            "but the meeting was cancelled while they were drafting. "
            "Check if the final sent email acknowledges the cancellation.\n\n"
            f"Sent emails: {json.dumps(emails_data)}"
        )
        # PR-5: NO silent heuristic fallback when judge fails. Per PR-5 design,
        # judge failure must be loud — record it in reward.json and emit a
        # JUDGE_FAILED marker to stderr so harbor can distinguish a true 0 from
        # a judge crash. We still write a 0 score (harbor expects a number) but
        # the _meta_judge_failed=1 flag makes the cause visible.
        try:
            score, judge_verdict, judge_mode = call_judge(prompt)
        except Exception as exc:
            judge_failed = 1
            judge_error = str(exc)[:500]
            score = 0.0
            print(f"JUDGE_FAILED: {judge_error}", file=sys.stderr)
        _write_breakdown(
            score,
            sent_emails,
            judge_used=1,
            judge_mode=judge_mode,
            judge_verdict=judge_verdict,
            judge_failed=judge_failed,
            judge_error=judge_error,
        )
    else:
        # No JUDGE_BASE_URL configured — heuristic is the documented offline path.
        # This is NOT a judge failure, so judge_used=0 (not judge_failed=1).
        score = heuristic_score(sent_emails)
        _write_breakdown(score, sent_emails, judge_used=0)

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
