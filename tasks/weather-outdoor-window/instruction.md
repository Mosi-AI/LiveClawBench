You want to go for an outdoor run in Shanghai today. Check today's hourly forecast at http://localhost:3000/location/shanghai/hourly (open it in your browser) and identify the longest continuous block of hours where the precipitation reading is 0.0 (no rain). If there are multiple windows of the same length, choose the earliest one. Save your result to `/workspace/output/exercise_window.json` with the following keys:
- `"start_hour"` — integer hour (0–23) when the window starts
- `"end_hour"` — integer hour (0–23, inclusive) when the window ends
- `"duration_hours"` — integer count of hours in the window (end_hour − start_hour + 1)
