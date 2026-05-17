/** @jsxImportSource hono/jsx */
import type { OpenAPIApp } from "mock-lib";
import { initDb } from "../db";
import { getToday, getCurrentTime } from "../utils/clock";

function Layout({ title, today, children }: { title: string; today?: string; children: any }) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} - Health Manager</title>
        <link rel="stylesheet" href="/static/styles.css" />
      </head>
      <body data-today={today || ""}>
        <nav class="navbar">
          <div class="nav-brand">Health Manager</div>
          <div class="nav-links">
            <a href="/" class="nav-link">Dashboard</a>
            <a href="/browse" class="nav-link">Categories</a>
            <a href="/allergens" class="nav-link">Allergens</a>
            <a href="/medications" class="nav-link">Medications</a>
          </div>
        </nav>
        <main class="container">{children}</main>
        <script src="/static/app.js"></script>
      </body>
    </html>
  );
}

function MetricCard({ label, value, unit, icon }: { label: string; value: any; unit?: string; icon: string }) {
  const display = value != null ? `${value}${unit ? " " + unit : ""}` : "--";
  return (
    <div class="metric-card">
      <div class="metric-icon">{icon}</div>
      <div class="metric-value">{display}</div>
      <div class="metric-label">{label}</div>
    </div>
  );
}

const METRIC_LABELS: Record<string, { label: string; unit: string; icon: string }> = {
  steps: { label: "Steps", unit: "", icon: "👣" },
  active_energy_kcal: { label: "Active Energy", unit: "kcal", icon: "🔥" },
  sleep_hours: { label: "Sleep Duration", unit: "hrs", icon: "😴" },
  sleep_quality: { label: "Sleep Quality", unit: "%", icon: "💤" },
  light_sleep_hours: { label: "Light Sleep", unit: "h", icon: "🌙" },
  deep_sleep_hours: { label: "Deep Sleep", unit: "h", icon: "🌊" },
  rem_sleep_hours: { label: "REM Sleep", unit: "h", icon: "👁" },
  low_intensity_min: { label: "Low Intensity", unit: "min", icon: "🚶" },
  medium_intensity_min: { label: "Med Intensity", unit: "min", icon: "🏃" },
  high_intensity_min: { label: "High Intensity", unit: "min", icon: "🏋" },
  total_activity_min: { label: "Total Activity", unit: "min", icon: "⏱" },
  resting_heart_rate_bpm: { label: "Resting HR", unit: "bpm", icon: "❤️" },
  avg_heart_rate_bpm: { label: "Avg HR", unit: "bpm", icon: "💓" },
  weight_kg: { label: "Weight", unit: "kg", icon: "⚖️" },
  body_fat_percent: { label: "Body Fat", unit: "%", icon: "📊" },
  blood_oxygen_percent: { label: "Blood Oxygen", unit: "%", icon: "🫁" },
};

const CATEGORIES = [
  { name: "Fitness", icon: "🏃", metrics: ["steps", "active_energy_kcal"] },
  { name: "Sleep", icon: "😴", metrics: ["sleep_hours", "sleep_quality", "light_sleep_hours", "deep_sleep_hours", "rem_sleep_hours"] },
  { name: "Activity", icon: "⏱", metrics: ["low_intensity_min", "medium_intensity_min", "high_intensity_min", "total_activity_min"] },
  { name: "Heart", icon: "❤️", metrics: ["resting_heart_rate_bpm", "avg_heart_rate_bpm"] },
  { name: "Body", icon: "⚖️", metrics: ["weight_kg", "body_fat_percent"] },
  { name: "Vitals", icon: "🫁", metrics: ["blood_oxygen_percent"] },
];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function registerFrontendRoutes(app: OpenAPIApp) {
  app.get("/", (c) => {
    const db = initDb();
    const today = getToday();
    const queryDate = c.req.query("date") || today;
    const snapshot = db.query(
      "SELECT * FROM health_daily_snapshot WHERE user_id = 1 AND date = ?"
    ).get(queryDate) as any;

    const nowTime = getCurrentTime(); // HH:MM from DB
    const meds = db.query(
      "SELECT * FROM medication WHERE user_id = 1 AND archived = 0"
    ).all() as any[];
    const medsWithSlots = meds.map((m: any) => {
      const slots = db.query("SELECT * FROM medication_intake_slot WHERE medication_id = ? ORDER BY time_hhmm ASC").all(m.id) as any[];
      const logs = db.query(
        "SELECT * FROM medication_dose_log WHERE medication_id = ? AND logged_at >= ? ORDER BY logged_at DESC"
      ).all(m.id, queryDate) as any[];
      // next upcoming slot for this med
      const upcoming = slots.find((s: any) => s.time_hhmm >= nowTime);
      const nextSlot = upcoming ?? (slots.length > 0 ? slots[0] : null);
      const nextTime = nextSlot ? nextSlot.time_hhmm : null;
      const nextIsToday = upcoming != null;
      return { ...m, slots, todayLogs: logs, nextSlot, nextTime, nextIsToday };
    });

    // Find the earliest next time across all meds, then pick up to 3 meds at that time
    const timesWithMeds = medsWithSlots.filter((m: any) => m.nextTime);
    // prefer today's upcoming; if none, fall back to tomorrow
    const todayUpcoming = timesWithMeds.filter((m: any) => m.nextIsToday);
    const pool = todayUpcoming.length > 0 ? todayUpcoming : timesWithMeds;
    const earliestTime = pool.length > 0
      ? pool.reduce((min: string, m: any) => m.nextTime < min ? m.nextTime : min, pool[0].nextTime)
      : null;
    const nextMeds = earliestTime
      ? pool.filter((m: any) => m.nextTime === earliestTime).slice(0, 3)
      : [];

    const allergenCount = (db.query("SELECT COUNT(*) as c FROM allergen WHERE user_id = 1 AND archived = 0").get() as any).c;
    const allergens = db.query(
      "SELECT name, severity FROM allergen WHERE user_id = 1 AND archived = 0 ORDER BY id DESC"
    ).all() as { name: string; severity: string | null }[];

    const prevDate = shiftDate(queryDate, -1);
    const nextDate = shiftDate(queryDate, 1);
    const isToday = queryDate === today;

    // 7-day trend data for the summary section
    const weekStart = shiftDate(queryDate, -6);
    const weekSnapshots = db.query(
      "SELECT date, steps, sleep_hours, resting_heart_rate_bpm FROM health_daily_snapshot WHERE user_id = 1 AND date >= ? AND date <= ? ORDER BY date"
    ).all(weekStart, queryDate) as any[];

    return c.html(
      <Layout title="Dashboard" today={today}>
        <div class="page-header">
          <h1>Health Dashboard</h1>
          <div class="date-nav">
            <a href={`/?date=${prevDate}`} class="btn btn-sm date-nav-btn">&lt;</a>
            <span class="date-badge">{queryDate}</span>
            {!isToday && <a href={`/?date=${nextDate}`} class="btn btn-sm date-nav-btn">&gt;</a>}
            {!isToday && <a href="/" class="btn btn-sm">Today</a>}
          </div>
        </div>

        {snapshot ? (
          <div class="metrics-grid">
            <a href="/health/steps" class="metric-card-link"><MetricCard icon="👣" label="Steps" value={snapshot.steps} /></a>
            <a href="/health/active_energy_kcal" class="metric-card-link"><MetricCard icon="🔥" label="Active Energy" value={snapshot.active_energy_kcal} unit="kcal" /></a>
            <a href="/health/sleep_hours" class="metric-card-link"><MetricCard icon="😴" label="Sleep" value={snapshot.sleep_hours} unit="hrs" /></a>
            <a href="/health/sleep_quality" class="metric-card-link"><MetricCard icon="💤" label="Sleep Quality" value={snapshot.sleep_quality} unit="%" /></a>
            <a href="/health/light_sleep_hours" class="metric-card-link"><MetricCard icon="🌙" label="Light Sleep" value={snapshot.light_sleep_hours} unit="h" /></a>
            <a href="/health/deep_sleep_hours" class="metric-card-link"><MetricCard icon="🌊" label="Deep Sleep" value={snapshot.deep_sleep_hours} unit="h" /></a>
            <a href="/health/rem_sleep_hours" class="metric-card-link"><MetricCard icon="👁" label="REM Sleep" value={snapshot.rem_sleep_hours} unit="h" /></a>
            <a href="/health/low_intensity_min" class="metric-card-link"><MetricCard icon="🚶" label="Low Intensity" value={snapshot.low_intensity_min} unit="min" /></a>
            <a href="/health/medium_intensity_min" class="metric-card-link"><MetricCard icon="🏃" label="Med Intensity" value={snapshot.medium_intensity_min} unit="min" /></a>
            <a href="/health/high_intensity_min" class="metric-card-link"><MetricCard icon="🏋" label="High Intensity" value={snapshot.high_intensity_min} unit="min" /></a>
            <a href="/health/total_activity_min" class="metric-card-link"><MetricCard icon="⏱" label="Total Activity" value={snapshot.total_activity_min} unit="min" /></a>
            <a href="/health/resting_heart_rate_bpm" class="metric-card-link"><MetricCard icon="❤️" label="Resting HR" value={snapshot.resting_heart_rate_bpm} unit="bpm" /></a>
            <a href="/health/avg_heart_rate_bpm" class="metric-card-link"><MetricCard icon="💓" label="Avg HR" value={snapshot.avg_heart_rate_bpm} unit="bpm" /></a>
            <a href="/health/weight_kg" class="metric-card-link"><MetricCard icon="⚖️" label="Weight" value={snapshot.weight_kg} unit="kg" /></a>
            <a href="/health/body_fat_percent" class="metric-card-link"><MetricCard icon="📊" label="Body Fat" value={snapshot.body_fat_percent} unit="%" /></a>
            <a href="/health/blood_oxygen_percent" class="metric-card-link"><MetricCard icon="🫁" label="Blood Oxygen" value={snapshot.blood_oxygen_percent} unit="%" /></a>
          </div>
        ) : (
          <div class="empty-state">
            <p>No health data for {queryDate}</p>
          </div>
        )}

        {weekSnapshots.length > 1 && (
          <div class="section">
            <div class="section-header">
              <h2>7-Day Trends</h2>
              <a href="/browse" class="btn btn-sm">View Details</a>
            </div>
            <div class="week-summary">
              <div class="week-chart" id="week-steps-chart" data-values={JSON.stringify(weekSnapshots.map((s: any) => s.steps))} data-labels={JSON.stringify(weekSnapshots.map((s: any) => s.date.slice(5)))} data-metric="Steps"></div>
              <div class="week-chart" id="week-sleep-chart" data-values={JSON.stringify(weekSnapshots.map((s: any) => s.sleep_hours))} data-labels={JSON.stringify(weekSnapshots.map((s: any) => s.date.slice(5)))} data-metric="Sleep"></div>
              <div class="week-chart" id="week-hr-chart" data-values={JSON.stringify(weekSnapshots.map((s: any) => s.resting_heart_rate_bpm))} data-labels={JSON.stringify(weekSnapshots.map((s: any) => s.date.slice(5)))} data-metric="Heart Rate"></div>
            </div>
          </div>
        )}

        <div class="section">
          <div class="section-header">
            <h2>Next Medication</h2>
            <a href="/medications" class="btn btn-sm">Manage</a>
          </div>
          {nextMeds.length === 0 ? (
            <div class="empty-state"><p>No upcoming medications</p></div>
          ) : (
            <div class="med-list">
              <div class="next-med-time">
                <span class="reminder-icon">⏰</span>
                <span>{earliestTime} {nextMeds[0].nextIsToday ? "today" : "tomorrow"}</span>
              </div>
              {nextMeds.map((m: any) => {
                const slot = m.nextSlot;
                const logEntry = (m.todayLogs as any[]).find((l: any) => l.slot_id === slot.id);
                const logged = !!logEntry;
                return (
                  <div class="med-card" key={m.id}>
                    <div class="med-header">
                      <strong>{m.display_name || m.name}</strong>
                      <span class={`freq-badge freq-${m.frequency}`}>{m.frequency === "daily" ? "Daily" : m.frequency === "every_two_days" ? "Every Two Days" : m.frequency === "weekly" ? "Weekly" : m.frequency === "monthly" ? "Monthly" : m.frequency === "as_needed" ? "As Needed" : "Other"}</span>
                    </div>
                    <div class={`slot-row ${logged ? "slot-taken" : ""}`}>
                      <span class="slot-time">{slot.time_hhmm}</span>
                      <span class="slot-dose">{slot.dose_amount} {slot.dose_unit}</span>
                      {slot.label && <span class="slot-label">{slot.label}</span>}
                      {logged ? (
                        <div class="slot-actions">
                          <span class="status-badge taken">Taken</span>
                          <button class="btn btn-sm btn-danger cancel-dose-btn"
                            data-med-id={m.id} data-log-id={logEntry.id}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button class="btn btn-sm btn-primary log-dose-btn"
                          data-med-id={m.id} data-slot-id={slot.id}>
                          Log
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div class="section">
          <div class="section-header">
            <h2>Allergens</h2>
            <a href="/allergens" class="btn btn-sm">Manage ({allergenCount})</a>
          </div>
          {allergens.length === 0 ? (
            <div class="empty-state"><p>No allergens recorded</p></div>
          ) : (
            <div class="allergen-summary">
              {allergens.map((a) => (
                <span class={`allergen-tag severity-${a.severity || "unknown"}`} key={a.name}>{a.name}</span>
              ))}
            </div>
          )}
        </div>
      </Layout>
    );
  });

  // Browse categories page
  app.get("/browse", (c) => {
    const db = initDb();
    const today = getToday();
    const weekStart = shiftDate(today, -6);

    const categoriesWithData = CATEGORIES.map(cat => {
      const latestValues = cat.metrics.map(m => {
        const row = db.query(
          "SELECT value FROM health_metric_series WHERE user_id = 1 AND metric_type = ? ORDER BY date DESC LIMIT 1"
        ).get(m) as any;
        return { metric: m, value: row?.value ?? null, ...METRIC_LABELS[m] };
      });
      return { ...cat, latestValues };
    });

    return c.html(
      <Layout title="Browse" today={today}>
        <div class="page-header">
          <h1>Health Categories</h1>
        </div>
        <div class="category-list">
          {categoriesWithData.map(cat => (
            <div class="category-card" key={cat.name}>
              <div class="category-header">
                <span class="category-icon">{cat.icon}</span>
                <div>
                  <h3>{cat.name}</h3>
                </div>
              </div>
              <div class="category-metrics">
                {cat.latestValues.map(mv => (
                  <a href={`/health/${mv.metric}`} class="category-metric-link" key={mv.metric}>
                    <span class="category-metric-label">{mv.label}</span>
                    <span class="category-metric-value">
                      {mv.value != null ? `${mv.value}${mv.unit ? " " + mv.unit : ""}` : "--"}
                    </span>
                    <span class="category-metric-arrow">&gt;</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Layout>
    );
  });

  // Health metric detail page
  app.get("/health/:type", (c) => {
    const metricType = c.req.param("type");
    const meta = METRIC_LABELS[metricType];
    if (!meta) {
      return c.html(<Layout title="Not Found" today={getToday()}><div class="empty-state"><p>Unknown metric type</p></div></Layout>);
    }

    const db = initDb();
    const today = getToday();
    const daysParam = c.req.query("days") || "7";
    const days = parseInt(daysParam, 10) || 7;
    const startDateParam = c.req.query("start_date") || "";
    const endDateParam = c.req.query("end_date") || "";

    let startDate: string;
    let endDate: string;
    let customRange = false;

    if (startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
      customRange = true;
    } else {
      endDate = today;
      startDate = shiftDate(today, -(days - 1));
    }

    const rows = db.query(
      "SELECT date, value FROM health_metric_series WHERE user_id = 1 AND metric_type = ? AND date >= ? AND date <= ? ORDER BY date"
    ).all(metricType, startDate, endDate) as { date: string; value: number }[];

    // For ranges > 30 days, chart shows only last 30 days but stats use full range
    const MAX_CHART_DAYS = 30;
    let chartRows = rows;
    let chartLimited = false;
    if (customRange) {
      const rangeSpanDays = Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (rangeSpanDays > MAX_CHART_DAYS || rows.length > MAX_CHART_DAYS) {
        chartRows = rows.slice(Math.max(0, rows.length - MAX_CHART_DAYS));
        chartLimited = true;
      }
    }

    // Compute stats from ALL rows (full range)
    let stats = { mean: 0, min: 0, max: 0, trend: "stable" as string, insight: "" };
    if (rows.length > 0) {
      const values = rows.map(r => r.value);
      stats.mean = +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
      stats.min = +Math.min(...values).toFixed(1);
      stats.max = +Math.max(...values).toFixed(1);

      const mid = Math.floor(values.length / 2);
      if (mid > 0) {
        const firstHalf = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
        const secondHalf = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid);
        const change = ((secondHalf - firstHalf) / firstHalf) * 100;
        stats.trend = change > 5 ? "rising" : change < -5 ? "falling" : "stable";
      }
      const rangeLabel = customRange ? `${startDate} to ${endDate}` : `the past ${days} days`;
      stats.insight = stats.trend === "rising"
        ? `${meta.label} has been rising over ${rangeLabel}, averaging ${stats.mean}${meta.unit ? " " + meta.unit : ""}`
        : stats.trend === "falling"
          ? `${meta.label} has been falling over ${rangeLabel}, averaging ${stats.mean}${meta.unit ? " " + meta.unit : ""}`
          : `${meta.label} has been stable over ${rangeLabel}, averaging ${stats.mean}${meta.unit ? " " + meta.unit : ""}`;
    }

    return c.html(
      <Layout title={meta.label} today={today}>
        <div class="page-header">
          <h1>{meta.icon} {meta.label}</h1>
          <a href="/browse" class="btn btn-sm">Back</a>
        </div>

        <div class="period-tabs">
          <a href={`/health/${metricType}?days=7`} class={`period-tab ${!customRange && days === 7 ? "active" : ""}`}>7 Days</a>
          <a href={`/health/${metricType}?days=14`} class={`period-tab ${!customRange && days === 14 ? "active" : ""}`}>14 Days</a>
          <a href={`/health/${metricType}?days=30`} class={`period-tab ${!customRange && days === 30 ? "active" : ""}`}>30 Days</a>
          <span class={`period-tab ${customRange ? "active" : ""}`} id="custom-range-tab">Custom</span>
        </div>

        <div class={`date-range-picker ${customRange ? "visible" : ""}`} id="date-range-picker">
          <form method="get" action={`/health/${metricType}`} class="date-range-form">
            <label>Start: <input type="date" name="start_date" value={startDate} /></label>
            <label>End: <input type="date" name="end_date" value={endDate} /></label>
            <button type="submit" class="btn btn-sm btn-primary">Apply</button>
          </form>
        </div>

        {rows.length > 0 ? (
          <div class="detail-content">
            <div class="chart-container">
              <div class="bar-chart" id="detail-chart"
                data-values={JSON.stringify(chartRows.map(r => r.value))}
                data-labels={JSON.stringify(chartRows.map(r => r.date.slice(5)))}
                data-unit={meta.unit}></div>
              {chartLimited && (
                <div class="chart-limit-notice">Only showing the most recent 30 days in the chart. Statistics below reflect the full selected range ({rows.length} days).</div>
              )}
            </div>

            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">{stats.mean}{meta.unit ? ` ${meta.unit}` : ""}</div>
                <div class="stat-label">Average</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{stats.min}{meta.unit ? ` ${meta.unit}` : ""}</div>
                <div class="stat-label">Min</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{stats.max}{meta.unit ? ` ${meta.unit}` : ""}</div>
                <div class="stat-label">Max</div>
              </div>
              <div class="stat-item">
                <div class="stat-value trend-{stats.trend === 'rising' ? 'up' : stats.trend === 'falling' ? 'down' : 'flat'}">
                  {stats.trend === "rising" ? "↑ Rising" : stats.trend === "falling" ? "↓ Falling" : "→ Stable"}
                </div>
                <div class="stat-label">Trend</div>
              </div>
            </div>

            {stats.insight && (
              <div class="insight-card">
                <div class="insight-icon">💡</div>
                <div class="insight-text">{stats.insight}</div>
              </div>
            )}

            <div class="section">
              <h3>Data Records</h3>
              <div class="data-list">
                {[...rows].reverse().map(r => (
                  <div class="data-row" key={r.date}>
                    <span class="data-date">{r.date}</span>
                    <span class="data-value">{r.value}{meta.unit ? ` ${meta.unit}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div class="empty-state">
            <p>No {meta.label} data for the past {days} days</p>
          </div>
        )}
      </Layout>
    );
  });

  app.get("/allergens", (c) => {
    const db = initDb();
    const today = getToday();
    const allergens = db.query(
      "SELECT * FROM allergen WHERE user_id = 1 AND archived = 0 ORDER BY id DESC"
    ).all() as any[];

    return c.html(
      <Layout title="Allergens" today={today}>
        <div class="page-header">
          <h1>Allergen Management</h1>
          <button class="btn btn-primary" id="add-allergen-btn">Add Allergen</button>
        </div>

        <div id="allergen-form" class="form-card hidden">
          <h3 id="allergen-form-title">Add Allergen</h3>
          <input type="hidden" id="allergen-edit-id" value="" />
          <div class="form-group">
            <label>Name *</label>
            <input type="text" id="allergen-name" placeholder="e.g. Peanuts" required />
          </div>
          <div class="form-group">
            <label>Severity</label>
            <select id="allergen-severity">
              <option value="">Not specified</option>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea id="allergen-notes" placeholder="Describe allergic reactions..."></textarea>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" id="allergen-submit">Save</button>
            <button class="btn" id="allergen-cancel">Cancel</button>
          </div>
        </div>

        {allergens.length === 0 ? (
          <div class="empty-state"><p>No allergens recorded. Click the button above to add one.</p></div>
        ) : (
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Severity</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allergens.map((a: any) => (
                  <tr key={a.id} data-id={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td>
                      <span class={`severity-badge severity-${a.severity || "unknown"}`}>
                        {a.severity === "severe" ? "Severe" : a.severity === "moderate" ? "Moderate" : a.severity === "mild" ? "Mild" : "Not specified"}
                      </span>
                    </td>
                    <td class="notes-cell">{a.notes || "--"}</td>
                    <td>
                      <button class="btn btn-sm edit-allergen-btn"
                        data-id={a.id} data-name={a.name} data-severity={a.severity || ""}
                        data-notes={a.notes || ""}>Edit</button>
                      <button class="btn btn-sm btn-danger delete-allergen-btn" data-id={a.id}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Layout>
    );
  });

  app.get("/medications", (c) => {
    const db = initDb();
    const today = getToday();
    const sortBy = c.req.query("sort") || "time";

    const meds = db.query(
      "SELECT * FROM medication WHERE user_id = 1 AND archived = 0 ORDER BY id DESC"
    ).all() as any[];
    const medsWithSlots = meds.map((m: any) => {
      const slots = db.query("SELECT * FROM medication_intake_slot WHERE medication_id = ? ORDER BY time_hhmm ASC").all(m.id) as any[];
      return { ...m, slots };
    });

    // Sort medications
    const nowTime = getCurrentTime(); // HH:MM
    const freqOrder: Record<string, number> = {
      daily: 0, every_two_days: 1, weekly: 2, monthly: 3, as_needed: 4, other: 5,
    };
    if (sortBy === "name") {
      medsWithSlots.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
    } else {
      // Sort by: frequency group (daily first), then next upcoming slot time
      function getNextSlotKey(med: any): string {
        const freq = freqOrder[med.frequency] ?? 5;
        const freqPrefix = String(freq);
        // Future start_date: not active yet, sort after all active meds in same freq group
        if (med.start_date > today) {
          return freqPrefix + ":F:" + med.start_date + ":" + (med.slots.length > 0 ? med.slots[0].time_hhmm : "99:99");
        }
        const slots = med.slots as any[];
        if (slots.length === 0) return freqPrefix + ":E:99:99";
        const future = slots.filter((s: any) => s.time_hhmm > nowTime);
        if (future.length > 0) return freqPrefix + ":A:" + future[0].time_hhmm;
        // All slots passed today — next is tomorrow's earliest
        return freqPrefix + ":B:" + slots[0].time_hhmm;
      }
      medsWithSlots.sort((a: any, b: any) => {
        const ta = getNextSlotKey(a);
        const tb = getNextSlotKey(b);
        if (ta !== tb) return ta.localeCompare(tb);
        return (a.name || "").localeCompare(b.name || "");
      });
    }

    // Compute next reminder time for each medication
    function getNextReminder(med: any): string | null {
      const slots = med.slots as any[];
      if (slots.length === 0) return null;
      if (med.start_date > today) return med.start_date + " " + slots[0].time_hhmm;
      const future = slots.filter((s: any) => s.time_hhmm > nowTime);
      if (future.length > 0) return future[0].time_hhmm + " today";
      return slots[0].time_hhmm + " tomorrow";
    }

    return c.html(
      <Layout title="Medications" today={today}>
        <div class="page-header">
          <h1>Medications</h1>
          <button class="btn btn-primary" id="add-med-btn">Add Medication</button>
        </div>

        <div class="sort-controls">
          <span>Sort by:</span>
          <a href="/medications?sort=name" class={`btn btn-sm ${sortBy === "name" ? "btn-primary" : ""}`}>Name</a>
          <a href="/medications?sort=time" class={`btn btn-sm ${sortBy === "time" ? "btn-primary" : ""}`}>Time</a>
        </div>

        <div id="med-form" class="form-card hidden">
          <h3 id="med-form-title">Add Medication</h3>
          <input type="hidden" id="med-edit-id" value="" />
          <div class="form-row">
            <div class="form-group">
              <label>Medication Name *</label>
              <input type="text" id="med-name" placeholder="e.g. Vitamin D" required />
            </div>
            <div class="form-group">
              <label>Display Name</label>
              <input type="text" id="med-display-name" placeholder="e.g. Vit D" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Frequency</label>
              <select id="med-frequency">
                <option value="daily">Daily</option>
                <option value="every_two_days">Every Two Days</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="as_needed">As Needed</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Dose</label>
              <div class="dose-input-row">
                <input type="number" id="med-dose-amount" placeholder="Amount" step="0.5" min="0" value="0" />
                <input type="text" id="med-dose-unit" placeholder="Unit" value="tablet" />
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Start Date *</label>
              <input type="date" id="med-start-date" />
            </div>
            <div class="form-group">
              <label>End Date</label>
              <input type="date" id="med-end-date" />
            </div>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea id="med-notes" placeholder="Dosage instructions..."></textarea>
          </div>
          <div class="slots-section">
            <div class="section-header">
              <h4>Intake Slots</h4>
              <button class="btn btn-sm" id="add-slot-btn" type="button">+ Add Slot</button>
            </div>
            <div id="slots-container"></div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" id="med-submit">Save</button>
            <button class="btn" id="med-cancel">Cancel</button>
          </div>
        </div>

        {medsWithSlots.length === 0 ? (
          <div class="empty-state"><p>No medications recorded. Click the button above to add one.</p></div>
        ) : (
          <div class="med-grid">
            {medsWithSlots.map((m: any) => (
              <div class="med-detail-card" key={m.id}>
                <div class="med-detail-header">
                  <div>
                    <h3>{m.display_name || m.name}</h3>
                    {m.display_name && <span class="med-subname">{m.name}</span>}
                  </div>
                  <div class="med-actions">
                    <button class="btn btn-sm edit-med-btn"
                      data-id={m.id} data-name={m.name}
                      data-display-name={m.display_name || ""}
                      data-frequency={m.frequency}
                      data-dose-amount={m.dose_amount || ""}
                      data-dose-unit={m.dose_unit || ""}
                      data-start-date={m.start_date}
                      data-end-date={m.end_date || ""}
                      data-notes={m.notes || ""}
                      data-slots={JSON.stringify(m.slots)}>Edit</button>
                    <button class="btn btn-sm btn-danger delete-med-btn" data-id={m.id}>Discontinue</button>
                  </div>
                </div>
                <div class="med-meta">
                  <span class={`freq-badge freq-${m.frequency}`}>
                    {m.frequency === "daily" ? "Daily" : m.frequency === "every_two_days" ? "Every Two Days" : m.frequency === "weekly" ? "Weekly" : m.frequency === "monthly" ? "Monthly" : m.frequency === "as_needed" ? "As Needed" : "Other"}
                  </span>
                  {m.dose_amount && <span class="dose-badge">{m.dose_amount} {m.dose_unit}</span>}
                  <span>Started {m.start_date}</span>
                  {m.end_date && <span>Until {m.end_date}</span>}
                </div>
                {getNextReminder(m) && (
                  <div class="next-reminder">
                    <span class="reminder-icon">⏰</span>
                    <span>Next: {getNextReminder(m)}</span>
                  </div>
                )}
                {m.notes && <p class="med-notes">{m.notes}</p>}
                {(m.slots as any[]).length > 0 && (
                  <div class="slots-display">
                    {(m.slots as any[]).map((s: any) => (
                      <div class="slot-chip" key={s.id}>
                        <span class="slot-time">{s.time_hhmm}</span>
                        <span class="slot-dose">{s.dose_amount} {s.dose_unit}</span>
                        {s.label && <span class="slot-label">({s.label})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Layout>
    );
  });
}
