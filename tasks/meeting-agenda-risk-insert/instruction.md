I have a partnership meeting with TerraScale Logistics tomorrow and I want to go in well-prepared. Please check my calendar (http://localhost:5006/) for the meeting details.

To access the calendar API, first authenticate: `POST http://localhost:5006/api/auth/login` with body `{"username": "peter.griffin@work.mosi.inc", "password": "password123"}` — the response contains an `access_token`. Include it as `Authorization: Bearer <token>` in all subsequent requests. List events via `GET http://localhost:5006/api/events`.

Review the background materials in `corpus/` (available at `~/.openclaw/corpus/`) — there are several documents covering our history with TerraScale that are relevant to the meeting.

Once you've identified the key risks and open issues we should address, update the meeting's calendar description with a concise risk summary so I have it handy during the meeting. Use `PUT http://localhost:5006/api/events/<id>` with body `{"description": "..."}` to update it. Make sure to include at least 3 specific risk items.
