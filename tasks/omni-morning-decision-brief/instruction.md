I'm about to start my day. Please pull together a morning decision brief from all my services and send it to the team chat.

**Services to check:**
- Calendar: `http://localhost:5006/` — authenticate via `POST /login` with form fields `email=peter.griffin@work.mosi.inc&password=password123` (Content-Type: application/x-www-form-urlencoded); the response sets a `token` cookie; use as `Authorization: Bearer <token>`. List events via `GET /api/events`.
- Email: `http://localhost:5174/` — authenticate via `POST /api/auth/login` with JSON `{"username": "peter", "password": "password123"}`; use the `access_token` as `Authorization: Bearer <token>`. List inbox via `GET /api/emails?folder=inbox`.
- Health: `http://localhost:5007/` — no auth required. Get today's snapshot via `GET /api/health/snapshot`.
- Weather: `http://localhost:3000/` — no auth required. Get Beijing forecast via `GET /api/location/beijing/health-tips` or browse `GET /api/locations`.

**What to include in the brief:**
1. **Must-do items** — critical tasks and action items for today (from calendar and email)
2. **Schedule risks** — any timing conflicts, overlapping meetings, or tight windows you notice
3. **Health & weather** — relevant health stats and weather context for the day
4. **Recommended prep** — what I should read or prepare before key meetings

**Where to send it:**
Post the complete brief as a message to the `#general` channel (channel ID 1) in the team chat at `http://localhost:5003/`. Use `GET /api/channels` to list channels, then `POST /api/channels/1/messages` with body `{"message_kind": "chat", "body": "..."}`.

**After sending the brief:**
Update `/workspace/daily_action_log.md` with today's date and the key action items you identified. Follow the existing format in that file.
