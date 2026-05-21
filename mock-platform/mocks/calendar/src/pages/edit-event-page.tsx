/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { EVENT_TYPE_VALUES } from "../routes/events";

interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
}

interface EditEventPageProps {
  user: { first_name: string; last_name: string } | null;
  event: CalendarEvent;
  error?: string;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const EditEventPage: FC<EditEventPageProps> = ({ user, event, error }) => {
  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Edit Event — Company Calendar</title>
        <link rel="stylesheet" href="/static/css/style.css" />
      </head>
      <body>
        <nav class="top-nav">
          <div class="nav-brand">Company Calendar</div>
          <div class="nav-links">
            <a href="/">Calendar</a>
          </div>
          <div class="nav-user">
            {user ? (
              <span>Welcome, {user.first_name} {user.last_name}</span>
            ) : (
              <a href="/login">Login</a>
            )}
          </div>
        </nav>
        <main class="container">
          <h1>Edit Event</h1>

          {error && <p class="error">{error}</p>}

          <form method="post" action={`/events/${event.id}/edit`} class="form-card">
            <label>
              Title:
              <input type="text" name="title" required value={event.title} />
            </label>
            <label>
              Description:
              <textarea name="description" rows={2}>{event.description ?? ""}</textarea>
            </label>
            <label>
              Event Type:
              <select name="event_type">
                {EVENT_TYPE_VALUES.map((t) => (
                  <option value={t} selected={t === event.event_type}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Start Time:
              <input type="datetime-local" name="start_time" required value={toDatetimeLocal(event.start_time)} />
            </label>
            <label>
              End Time:
              <input type="datetime-local" name="end_time" required value={toDatetimeLocal(event.end_time)} />
            </label>
            <button type="submit">Save Changes</button>
            <a href="/" class="btn-cancel">Cancel</a>
          </form>
        </main>
      </body>
    </html>
  );
};
