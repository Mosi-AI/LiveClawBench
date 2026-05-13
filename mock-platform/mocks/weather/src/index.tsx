import { Hono } from "hono";
import { createMockApp, startServer } from "mock-lib";
import type { AppEnv, MockAppV2 } from "mock-lib";
import { db, initDb, seedDate, cstDateStr } from "./seed.js";
import type { Location, WeatherDaily, WeatherHourly, AirQualitySnapshot, HealthActivityTip } from "./types.js";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function tomorrowStr(): string {
  return cstDateStr(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function getLocation(slug: string): Location | null {
  return db.query("SELECT * FROM location WHERE slug = ?").get(slug) as Location | null;
}

function renderNotFound(slug: string): Response {
  return renderPage("未找到城市", `<div class="card"><h2>未找到城市</h2><p>城市"${escHtml(slug)}"不存在。</p><a href="/">返回首页</a></div>`, "", 404);
}

function renderNav(currentSlug: string): string {
  const locations = db.query("SELECT slug, display_name FROM location ORDER BY id ASC").all() as { slug: string; display_name: string }[];
  return `<nav style="padding:8px 16px;background:#1a73e8;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <a href="/search" style="color:#fff;font-weight:bold;text-decoration:none;font-size:16px">天气预报</a>
    ${locations.map(l => `<a href="/location/${l.slug}" style="color:${l.slug === currentSlug ? '#ffd' : '#cce'};text-decoration:none;padding:4px 8px;border-radius:4px">${l.display_name}</a>`).join("")}
    <form action="/search" method="get" style="margin-left:auto;display:flex;gap:4px">
      <input name="q" placeholder="搜索城市" style="padding:4px 8px;border-radius:4px;border:none;font-size:14px"/>
      <button type="submit" style="padding:4px 10px;background:#0d47a1;color:#fff;border:none;border-radius:4px;cursor:pointer">搜索</button>
    </form>
  </nav>`;
}

function renderPage(title: string, body: string, slug = "", status = 200): Response {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} - 天气预报</title>
<style>
body{margin:0;font-family:'PingFang SC','Microsoft YaHei',sans-serif;background:#f5f5f5;color:#333}
.container{max-width:960px;margin:0 auto;padding:16px}
.card{background:#fff;border-radius:8px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h1,h2,h3{margin:0 0 8px}
table{width:100%;border-collapse:collapse}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #eee}
th{background:#f0f4ff;font-weight:600}
a{color:#1a73e8;text-decoration:none}
a:hover{text-decoration:underline}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600}
.good{background:#e8f5e9;color:#2e7d32}
.moderate{background:#fff3e0;color:#e65100}
.unhealthy_sensitive{background:#fce4ec;color:#c62828}
</style>
</head>
<body>
${renderNav(slug)}
<div class="container">${body}</div>
</body>
</html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function registerRoutes(app: Hono<AppEnv>): void {
  app.use("*", async (c, next) => {
    if (cstDateStr() !== seedDate) initDb();
    await next();
  });

  app.get("/__mock_sentinel__/weather", (c) =>
    c.json({ mock: "weather", sentinel: true })
  );

  app.get("/", (c) => c.redirect("/location/beijing"));

  app.get("/location/:slug", (c) => {
    const slug = c.req.param("slug");
    const loc = getLocation(slug);
    if (!loc) return renderNotFound(slug);

    const today = cstDateStr();
    const tomorrow = tomorrowStr();
    const dailyRows = db.query(
      "SELECT * FROM weather_daily WHERE location_id = ? ORDER BY valid_date ASC"
    ).all(loc.id) as WeatherDaily[];
    const todayDaily = dailyRows.find(r => r.valid_date === today) ?? dailyRows[0];
    const tomorrowDaily = dailyRows.find(r => r.valid_date === tomorrow) ?? null;

    const aqi = db.query(
      "SELECT * FROM air_quality_snapshot WHERE location_id = ?"
    ).get(loc.id) as AirQualitySnapshot | null;

    const tips = db.query(
      "SELECT * FROM health_activity_tip WHERE location_id = ? ORDER BY valid_date ASC"
    ).all(loc.id) as HealthActivityTip[];

    const body = `
<div class="card">
  <h1>${loc.display_name} <small style="font-size:14px;color:#666">${loc.timezone_label}</small></h1>
  <p style="margin:0;color:#666">${formatDate(today)}</p>
</div>
<div class="card">
  <h2>今天 <span style="font-size:14px;color:#666">${formatDate(todayDaily?.valid_date ?? today)}</span></h2>
  <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin:8px 0">
    <div style="font-size:48px;font-weight:200">${todayDaily?.temp_high_c ?? '--'}°C</div>
    <div>
      <div style="font-size:18px">${todayDaily?.condition_text ?? '--'}</div>
      <div style="color:#666">最高 ${todayDaily?.temp_high_c ?? '--'}°C / 最低 ${todayDaily?.temp_low_c ?? '--'}°C</div>
      <div style="color:#666">风向：${todayDaily?.wind_dir ?? '--'} ${todayDaily?.wind_speed_kmh ?? '--'}km/h</div>
    </div>
  </div>
  <div style="display:flex;gap:12px">
    <a href="/location/${slug}/hourly">逐小时预报</a>
    <a href="/location/${slug}/daily">多日预报</a>
  </div>
</div>
${tomorrowDaily ? `
<div class="card">
  <h2>明天 <span style="font-size:14px;color:#666">${formatDate(tomorrowDaily.valid_date)}</span></h2>
  <div style="color:#666">${tomorrowDaily.condition_text} / ${tomorrowDaily.temp_high_c}°C / ${tomorrowDaily.temp_low_c}°C</div>
</div>` : ""}
${aqi ? `
<div class="card">
  <h2>空气质量</h2>
  <p>AQI：<strong>${aqi.aqi}</strong> <span class="badge ${aqi.category}">${aqi.category}</span></p>
  <p style="color:#666">${aqi.summary_text}</p>
</div>` : ""}
${tips.length > 0 ? `
<div class="card">
  <h2>健康建议</h2>
  ${tips.map(t => `<div style="margin-bottom:12px"><strong>${t.tip_title}</strong> <span style="font-size:12px;color:#999">${formatDate(t.valid_date)}</span><p style="margin:4px 0;color:#555">${t.tip_body}</p></div>`).join("")}
</div>` : ""}
`;
    return renderPage(loc.display_name, body, slug);
  });

  app.get("/location/:slug/hourly", (c) => {
    const slug = c.req.param("slug");
    const loc = getLocation(slug);
    if (!loc) return renderNotFound(slug);

    const today = cstDateStr();
    const tomorrow = tomorrowStr();
    const hourlyRows = db.query(
      "SELECT * FROM weather_hourly WHERE location_id = ? ORDER BY valid_date ASC, hour ASC"
    ).all(loc.id) as WeatherHourly[];

    const todayHours = hourlyRows.filter(r => r.valid_date === today);
    const tomorrowHours = hourlyRows.filter(r => r.valid_date === tomorrow).slice(0, 6);

    const body = `
<div class="card">
  <a href="/location/${slug}">← 返回 ${loc.display_name}</a>
  <h1 style="margin-top:8px">${loc.display_name} 逐小时预报</h1>
</div>
<div class="card">
  <h2>今天</h2>
  <table>
    <thead><tr><th>时间</th><th>温度</th><th>体感</th><th>天气</th><th>降水(mm)</th><th>湿度</th><th>云量</th></tr></thead>
    <tbody>
      ${todayHours.map(h => `<tr><td>${String(h.hour).padStart(2, "0")}:00</td><td>${h.temp_c}°C</td><td>${h.feels_like_c}°C</td><td>${h.condition_text}</td><td>${h.precip_mm.toFixed(1)}</td><td>${h.humidity}%</td><td>${h.cloud_cover}%</td></tr>`).join("")}
    </tbody>
  </table>
</div>
${tomorrowHours.length > 0 ? `
<div class="card">
  <h2>明日预览</h2>
  <table>
    <thead><tr><th>时间</th><th>温度</th><th>体感</th><th>天气</th><th>降水(mm)</th><th>湿度</th><th>云量</th></tr></thead>
    <tbody>
      ${tomorrowHours.map(h => `<tr><td>${String(h.hour).padStart(2, "0")}:00</td><td>${h.temp_c}°C</td><td>${h.feels_like_c}°C</td><td>${h.condition_text}</td><td>${h.precip_mm.toFixed(1)}</td><td>${h.humidity}%</td><td>${h.cloud_cover}%</td></tr>`).join("")}
    </tbody>
  </table>
</div>` : ""}
`;
    return renderPage(`${loc.display_name} 逐小时`, body, slug);
  });

  app.get("/location/:slug/daily", (c) => {
    const slug = c.req.param("slug");
    const loc = getLocation(slug);
    if (!loc) return renderNotFound(slug);

    const today = cstDateStr();
    const dailyRows = db.query(
      "SELECT * FROM weather_daily WHERE location_id = ? ORDER BY valid_date ASC"
    ).all(loc.id) as WeatherDaily[];

    const body = `
<div class="card">
  <a href="/location/${slug}">← 返回 ${loc.display_name}</a>
  <h1 style="margin-top:8px">${loc.display_name} 多日预报</h1>
</div>
<div class="card">
  <table>
    <thead><tr><th>日期</th><th>天气</th><th>最高</th><th>最低</th><th>降水(mm)</th><th>风向</th></tr></thead>
    <tbody>
      ${dailyRows.map(d => `<tr>
        <td>${d.valid_date === today ? "今天" : "明天"} ${formatDate(d.valid_date)}</td>
        <td>${d.condition_text}</td>
        <td>${d.temp_high_c}°C</td>
        <td>${d.temp_low_c}°C</td>
        <td>${d.precip_mm}</td>
        <td>${d.wind_dir} ${d.wind_speed_kmh}km/h</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>
`;
    return renderPage(`${loc.display_name} 多日预报`, body, slug);
  });

  app.get("/search", (c) => {
    const q = c.req.query("q") ?? "";
    const rows = db.query(
      "SELECT * FROM location WHERE display_name LIKE ?"
    ).all(`%${q}%`) as Location[];

    if (rows.length === 1) {
      return c.redirect(`/location/${rows[0].slug}`);
    }

    const qEsc = escHtml(q);
    const title = q ? `搜索"${qEsc}"` : "城市列表";
    let body: string;
    if (rows.length === 0) {
      body = `<div class="card"><h2>未找到城市</h2><p>没有找到与"${qEsc}"匹配的城市。</p><a href="/search">查看全部城市</a></div>`;
    } else {
      body = `<div class="card">
  <h2>${title}</h2>
  <ul style="padding:0;list-style:none;margin:0">
    ${rows.map(l => `<li style="padding:8px 0;border-bottom:1px solid #eee"><a href="/location/${l.slug}" style="font-size:16px">${l.display_name}</a></li>`).join("")}
  </ul>
</div>`;
    }
    return renderPage(title, body);
  });

  app.get("/api/locations", (c) => {
    const rows = db.query(
      "SELECT id, slug, display_name, timezone_label FROM location ORDER BY id ASC"
    ).all();
    return c.json({ ok: true, data: rows });
  });

  app.get("/api/location/:slug/air-quality", (c) => {
    const slug = c.req.param("slug");
    const loc = db.query("SELECT id FROM location WHERE slug = ?").get(slug) as { id: number } | null;
    if (!loc) return c.json({ ok: false, error: "city not found" }, 404);

    const row = db.query(
      "SELECT observed_at, aqi, category, summary_text FROM air_quality_snapshot WHERE location_id = ?"
    ).get(loc.id) as { observed_at: string; aqi: number; category: string; summary_text: string } | null;

    if (!row) return c.json({ ok: false, error: "city not found" }, 404);

    return c.json({
      ok: true,
      data: {
        location_slug: slug,
        observed_at: row.observed_at,
        aqi: row.aqi,
        category: row.category,
        summary_text: row.summary_text,
      },
    });
  });

  app.get("/api/location/:slug/health-tips", (c) => {
    const slug = c.req.param("slug");
    const loc = db.query("SELECT id FROM location WHERE slug = ?").get(slug) as { id: number } | null;
    if (!loc) return c.json({ ok: false, error: "city not found" }, 404);

    const rows = db.query(
      "SELECT valid_date, tip_title, tip_body FROM health_activity_tip WHERE location_id = ? ORDER BY valid_date ASC"
    ).all(loc.id);

    return c.json({ ok: true, data: rows });
  });
}

export function createWeatherApp(): MockAppV2 {
  const mockApp = createMockApp({ name: "weather", port: 3000, routes: registerRoutes });
  mockApp.seed = initDb;
  return mockApp;
}

if (import.meta.main) {
  startServer(createWeatherApp());
}
