We are discussing a potential vendor partnership tomorrow. Please check my email (http://localhost:5174/) for the vendor's introduction.

To access the email API, first authenticate: `POST http://localhost:5174/api/auth/login` with body `{"username": "peter", "password": "password123"}` — the response contains an `access_token`. Include it as `Authorization: Bearer <token>` in all subsequent requests. Then list inbox emails via `GET http://localhost:5174/api/emails?folder=inbox` and read a specific email via `GET http://localhost:5174/api/emails/<id>`.

Then review the supporting materials in `corpus/` (available at `~/.openclaw/corpus/`).

Prepare a due diligence brief covering:
1. Vendor background
2. Product/service fit assessment
3. At least 3 red flags or open questions (each must reference a specific detail from the email or corpus)
4. A recommendation on whether we should proceed to the next round

Save the result to `~/.openclaw/output/result.json` with these fields:
- `"vendor_background"` — who the vendor is, what they do, funding stage; include the vendor contact's name and email address from the introduction email
- `"fit_assessment"` — how well their offering fits our needs
- `"red_flags"` — list of at least 3 red flags or open questions (strings), each citing specific evidence
- `"recommendation"` — actionable recommendation: proceed / conditional proceed / do not proceed, with clear rationale
