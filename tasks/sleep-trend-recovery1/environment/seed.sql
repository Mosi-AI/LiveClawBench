INSERT OR REPLACE INTO benchmark_clock (id, clock_time)
VALUES (1, '2026-05-09T07:45:00Z');

INSERT OR REPLACE INTO thermostat_settings (id, mode, temperature, updated_at)
VALUES (1, 'eco', 72.0, '2026-05-09T06:30:00Z');

INSERT OR REPLACE INTO calendar_event (id, title, start_time, event_type, workout_type, status, updated_at) VALUES
(1, 'Morning Routine', '2026-05-09T08:00:00Z', 'routine', NULL, 'undone', '2026-05-08T20:00:00Z'),
(2, 'HIIT Workout', '2026-05-09T09:00:00Z', 'workout', 'hiit', 'undone', '2026-05-08T20:00:00Z'),
(3, 'Team Standup', '2026-05-09T11:00:00Z', 'meeting', NULL, 'undone', '2026-05-08T20:00:00Z'),
(4, 'Project Review', '2026-05-09T14:00:00Z', 'meeting', NULL, 'undone', '2026-05-08T20:00:00Z'),
(5, 'Evening Walk', '2026-05-09T18:30:00Z', 'workout', 'walking', 'undone', '2026-05-08T20:00:00Z');

INSERT OR REPLACE INTO coffee_schedule (schedule_date, start_time, beans_grams, cancelled, updated_at) VALUES
('2026-05-09', '07:00', 20, 0, '2026-05-09T06:00:00Z'),
('2026-05-10', '07:00', 20, 0, '2026-05-09T06:00:00Z');

INSERT OR REPLACE INTO room_metrics (id, temperature, humidity, unit_temp, noise, light, air_quality)
VALUES (1, 72.0, 48.0, 'F', 32.0, 120.0, 88);

INSERT OR REPLACE INTO room (id, name)
VALUES (1, 'Bedroom');
