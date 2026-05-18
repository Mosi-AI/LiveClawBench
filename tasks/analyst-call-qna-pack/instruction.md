I have an analyst call coming up this Thursday. Please check my calendar (http://localhost:5003/) for the meeting details.

To access the calendar API, use the login page at `http://localhost:5003/login` with email `peter.griffin@work.mosi.inc` and password `password123`. You can also query events via the API: authenticate with `POST http://localhost:5003/api/auth/login` (body: `{"email": "peter.griffin@work.mosi.inc", "password": "password123"}`), then call `GET http://localhost:5003/api/events` with `Authorization: Bearer <token>`.

Use the meeting details from the calendar to locate the correct materials in `corpus/` (available at `~/.openclaw/corpus/`). Note that the calendar entry may use a company alias or ticker, while the corpus files use the full company name — you will need to resolve the mapping yourself.

There is also a previous draft Q&A file in `~/.openclaw/workspace/`. Your task is to **update it** to reflect the latest materials — correct any outdated figures or claims, and do not simply copy the old draft.

Prepare a final analyst Q&A pack saved to `~/.openclaw/output/analyst_qna.md` with these sections:

## Q&A Pairs
At least **8** likely analyst questions with concise recommended answers.

## Risk Topics
At least **3** sensitive risk topics that may come up on the call.

## Do Not Say
At least **3** specific reminders about outdated or unsupported claims from the previous draft that must not be repeated.
