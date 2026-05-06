/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";

interface CalendarEvent {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
}

interface CalendarPageProps {
  user: { first_name: string; last_name: string } | null;
  events: CalendarEvent[];
  error?: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

export const CalendarPage: FC<CalendarPageProps> = ({ user, events, error }) => {
  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Company Calendar</title>
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
          <h1>Calendar</h1>

          {error && <p class="error">{error}</p>}

          <h2>Create Event</h2>
          <form method="post" action="/events" class="form-card">
            <label>
              Title:
              <input type="text" name="title" required />
            </label>
            <label>
              Start Time:
              <input type="datetime-local" name="start_time" required />
            </label>
            <label>
              End Time:
              <input type="datetime-local" name="end_time" required />
            </label>
            <button type="submit">Create Event</button>
          </form>

          <h2>Upcoming Events</h2>
          {events.length === 0 ? (
            <p>No events yet.</p>
          ) : (
            <table class="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => (
                  <tr key={evt.id}>
                    <td>{evt.title}</td>
                    <td>{formatTime(evt.start_time)}</td>
                    <td>{formatTime(evt.end_time)}</td>
                    <td>
                      <form method="post" action={`/events/${evt.id}/delete`}>
                        <button type="submit" class="btn-danger">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      </body>
    </html>
  );
};
