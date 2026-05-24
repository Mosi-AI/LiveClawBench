#!/usr/bin/env python3
"""Multi-step signup form with consent-dependent branching. Port 8500."""

import http.server
import json
import re
import urllib.parse
from http.cookies import SimpleCookie

PORT = 8500
HOST = "0.0.0.0"

# Server-side session store: session_id -> {step, branch, data}
sessions = {}

# Form field definitions
STEPS = {
    1: [
        ("email", "R", "Email", "email"),
        ("password", "R", "Password", "password"),
        ("username", "O", "Username", "text"),
    ],
    2: [
        ("full_name", "R", "Full Name", "text"),
        ("company", "O", "Company", "text"),
    ],
    3: [],  # Special: consent radio (handled in render)
    4: [],  # Branch-dependent (handled in render)
    5: [
        ("agree_terms", "R", "I agree to the Terms of Service", "checkbox"),
        ("newsletter", "O", "Subscribe to newsletter", "checkbox"),
    ],
}

BRANCH_A_FIELDS = [
    ("marketing_email", "O", "Marketing Emails", "checkbox"),
    ("marketing_sms", "O", "Marketing SMS/Text", "checkbox"),
    ("phone", "O", "Phone Number", "text"),
]

BRANCH_B_FIELDS = [
    ("phone", "O", "Phone Number", "text"),
]


def get_session(headers):
    cookie = SimpleCookie(headers.get("Cookie", ""))
    sid = None
    if "session_id" in cookie:
        sid = cookie["session_id"].value
    if sid not in sessions:
        import random
        import string

        sid = "".join(random.choices(string.ascii_lowercase + string.digits, k=16))
        sessions[sid] = {"step": 1, "branch": None, "data": {}}
    return sid


def render_step(step, session, error=None):
    sid = (
        list(sessions.keys())[list(sessions.values()).index(session)]
        if session in sessions.values()
        else None
    )  # noqa
    # find sid for this session
    sid = None
    for k, v in sessions.items():
        if v is session:
            sid = k
            break

    branch = session.get("branch")
    data = session.get("data", {})

    fields_html = []

    if step == 3:
        # Consent radio
        checked_accept = ""
        checked_decline = ""
        if data.get("consent_marketing") == "accept":
            checked_accept = "checked"
        elif data.get("consent_marketing") == "decline":
            checked_decline = "checked"

        fields_html.append(
            '<div class="field">'
            '<label><span class="required">*</span> Marketing Communications</label>'
            '<div class="radio-group">'
            '<label class="radio-label">'
            f'<input type="radio" name="consent_marketing" value="accept" {checked_accept}> '
            "Accept — I'd like to receive marketing emails and SMS</label><br>"
            '<label class="radio-label">'
            f'<input type="radio" name="consent_marketing" value="decline" {checked_decline}> '
            "Decline — No marketing communications</label>"
            "</div>"
            "</div>"
        )
    elif step == 4:
        if branch == "accept":
            step_fields = BRANCH_A_FIELDS
        else:
            step_fields = BRANCH_B_FIELDS

        for name, req, label, ftype in step_fields:
            val = data.get(name, "")
            is_phone = name == "phone"
            req_class = "required-field" if is_phone else ""
            req_star = '<span class="required">*</span> ' if is_phone else ""
            hint = '<span class="hint-text">(Required)</span>' if is_phone else ""
            if ftype == "checkbox":
                checked = "checked" if val else ""
                fields_html.append(
                    f'<div class="field {req_class}">'
                    f"<label>{req_star}{label} {hint}"
                    f'<input type="{ftype}" name="{name}" {"checked" if val else ""}>'
                    f"</label>"
                    f"</div>"
                )
            else:
                fields_html.append(
                    f'<div class="field {req_class}">'
                    f"<label>{req_star}{label} {hint}</label>"
                    f'<input type="{ftype}" name="{name}" value="{escape_html(val)}">'
                    f"</div>"
                )
    else:
        for name, req, label, ftype in STEPS.get(step, []):
            val = data.get(name, "")
            req_star = '<span class="required">*</span> ' if req == "R" else ""
            if ftype == "checkbox":
                checked = "checked" if val else ""
                fields_html.append(
                    f'<div class="field">'
                    f"<label>{req_star}{label}"
                    f'<input type="{ftype}" name="{name}" {"checked" if val else ""}>'
                    f"</label>"
                    f"</div>"
                )
            else:
                fields_html.append(
                    f'<div class="field">'
                    f"<label>{req_star}{label}</label>"
                    f'<input type="{ftype}" name="{name}" value="{escape_html(val)}">'
                    f"</div>"
                )

    error_html = ""
    if error:
        error_html = f'<div class="error">{escape_html(error)}</div>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sign Up — Step {step}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 40px auto; padding: 20px; }}
  h1 {{ font-size: 1.4em; }}
  .step-indicator {{ color: #666; font-size: 0.9em; margin-bottom: 20px; }}
  .field {{ margin-bottom: 16px; }}
  .field label {{ display: block; font-weight: 500; margin-bottom: 4px; }}
  .field input[type="text"], .field input[type="email"], .field input[type="password"] {{
    width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box;
  }}
  .required {{ color: #d32f2f; font-weight: bold; }}
  .hint-text {{ color: #d32f2f; font-size: 0.8em; font-weight: normal; }}
  .required-field input[type="text"] {{ border-color: #d32f2f; }}
  .required-field input[type="text"]:focus {{ border-color: #d32f2f; box-shadow: 0 0 0 2px rgba(211,47,47,0.2); }}
  .error {{ background: #ffebee; color: #c62828; padding: 10px 14px; border-radius: 4px; margin-bottom: 16px; font-size: 0.9em; }}
  .radio-group {{ margin: 8px 0; }}
  .radio-label {{ display: block; margin: 6px 0; font-weight: normal; }}
  .radio-label input {{ margin-right: 6px; }}
  button {{ background: #1976d2; color: #fff; border: none; padding: 10px 24px; border-radius: 4px; font-size: 14px; cursor: pointer; }}
  button:hover {{ background: #1565c0; }}
  .note {{ color: #888; font-size: 0.8em; margin-top: 16px; }}
</style>
</head>
<body>
<h1>Create Your Account</h1>
<div class="step-indicator">Step {step} of 5</div>
{error_html}
<form method="POST" action="/api/submit">
<input type="hidden" name="step" value="{step}">
{"".join(fields_html)}
<button type="submit">{"Submit" if step == 5 else "Next"}</button>
</form>
<div class="note">Fields marked with <span class="required">*</span> are required.</div>
</body>
</html>"""


def escape_html(s):
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


class ConsentHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress default logging to stderr

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/health":
            self.send_json({"ok": True})
            return

        if path == "/":
            self.redirect("/step/1")
            return

        m = re.match(r"^/step/(\d+)$", path)
        if m:
            step = int(m.group(1))
            if step < 1 or step > 5:
                self.send_error(404)
                return
            sid = get_session(self.headers)
            session = sessions[sid]

            # If branching not yet set, show step=3 with form
            # For step 4, branch must be set (from step 3)
            if step == 4 and session.get("branch") is None:
                self.redirect("/step/3")
                return

            html = render_step(step, session)
            cookie = SimpleCookie()
            cookie["session_id"] = sid
            cookie["session_id"]["path"] = "/"
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Set-Cookie", cookie["session_id"].OutputString())
            self.end_headers()
            self.wfile.write(html.encode("utf-8"))
            return

        self.send_error(404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/submit":
            sid = get_session(self.headers)
            session = sessions[sid]

            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            form_data = urllib.parse.parse_qs(body, keep_blank_values=True)

            step = int(form_data.get("step", [1])[0])

            # Store form values
            for key, values in form_data.items():
                if key != "step":
                    session["data"][key] = values[0] if values else ""

            # Validate required fields for this step
            errors = []
            if step == 3:
                consent = session["data"].get("consent_marketing", "")
                if not consent:
                    errors.append(
                        "Please select Accept or Decline for marketing communications."
                    )
                else:
                    session["branch"] = consent

            elif step == 4:
                # No required fields at step 4 — phone is OPTIONAL despite visual cues
                pass

            else:
                for name, req, label, ftype in STEPS.get(step, []):
                    if req == "R":
                        val = session["data"].get(name, "").strip()
                        if ftype == "checkbox":
                            if val not in ("on", "checked", "1", "true"):
                                errors.append(f"{label} is required.")
                        else:
                            if not val:
                                errors.append(f"{label} is required.")

            if errors:
                session["step"] = step
                html = render_step(step, session, error=" ".join(errors))
                cookie = SimpleCookie()
                cookie["session_id"] = sid
                cookie["session_id"]["path"] = "/"
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Set-Cookie", cookie["session_id"].OutputString())
                self.end_headers()
                self.wfile.write(html.encode("utf-8"))
                return

            # Advance to next step
            if step < 5:
                session["step"] = step + 1
                self.redirect(f"/step/{step + 1}")
            else:
                # Final submit — show success
                self.send_html(
                    "<h1>Account Created</h1><p>Thank you for signing up.</p>"
                )
            return

        self.send_error(404)

    def redirect(self, location):
        self.send_response(303)
        self.send_header("Location", location)
        self.end_headers()

    def send_json(self, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, html):
        data = f"<!DOCTYPE html><html><body>{html}</body></html>".encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    server = http.server.HTTPServer((HOST, PORT), ConsentHandler)
    print(f"Consent signup server listening on {HOST}:{PORT}")
    server.serve_forever()
