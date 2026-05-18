I have a partnership discussion this Friday. Please check my calendar (http://localhost:3000/) for the meeting details — you can list all todos via `GET http://localhost:3000/api/todos` or browse by date with `GET http://localhost:3000/api/todos?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`.

Then research the counterpart company and topic using the materials in `corpus/` (available at `~/.openclaw/corpus/`).

Put together a concise briefing doc covering:
1. Background on the other party
2. At least 3 key discussion points I should prepare
3. Potential risks or opportunities
4. Suggested questions to ask

Save the full brief to `~/.openclaw/output/result.json` with these fields:
- `"meeting_summary"` — one-sentence summary of the meeting context extracted from the calendar
- `"background"` — background on the counterpart company
- `"discussion_points"` — list of at least 3 key discussion points (strings)
- `"risks"` — list of at least 1 risk or concern
- `"opportunities"` — list of at least 1 opportunity
- `"suggested_questions"` — list of at least 3 suggested questions to ask
