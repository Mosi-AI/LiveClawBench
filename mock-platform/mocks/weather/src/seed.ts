import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.WEATHER_DB_PATH ?? "/tmp/weather.db";
export let db!: Database;
export let seedDate: string = "";

export function cstDateStr(d: Date = new Date()): string {
  const cst = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const year = cst.getUTCFullYear();
  const month = String(cst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(cst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface CitySpec {
  slug: string;
  display_name: string;
  timezone_label: string;
  today: DailySpec;
  tomorrow: DailySpec;
  aqi: number;
  aqi_category: string;
  aqi_summary: string;
}

interface DailySpec {
  condition_text: string;
  temp_high_c: number;
  temp_low_c: number;
  precip_mm: number;
  wind_dir: string;
  wind_speed_kmh: number;
  uv_index: number;
  tip_title: string;
  tip_body: string;
}

const CITIES: CitySpec[] = [
  {
    slug: "beijing",
    display_name: "北京",
    timezone_label: "UTC+8",
    today: {
      condition_text: "晴",
      temp_high_c: 28,
      temp_low_c: 16,
      precip_mm: 0,
      wind_dir: "北风",
      wind_speed_kmh: 12,
      uv_index: 7,
      tip_title: "适合户外活动",
      tip_body: "今日天气晴好，气温舒适，建议外出锻炼，注意防晒。空气质量一般，敏感人群可佩戴口罩。",
    },
    tomorrow: {
      condition_text: "多云",
      temp_high_c: 25,
      temp_low_c: 14,
      precip_mm: 0,
      wind_dir: "北风",
      wind_speed_kmh: 10,
      uv_index: 4,
      tip_title: "适宜散步",
      tip_body: "明日多云，气温略降，适合户外散步。空气质量轻度污染，建议减少剧烈运动。",
    },
    aqi: 75,
    aqi_category: "moderate",
    aqi_summary: "空气质量一般，敏感人群应减少长时间户外活动。",
  },
  {
    slug: "shanghai",
    display_name: "上海",
    timezone_label: "UTC+8",
    today: {
      condition_text: "阴有小雨",
      temp_high_c: 22,
      temp_low_c: 18,
      precip_mm: 4,
      wind_dir: "东南风",
      wind_speed_kmh: 16,
      uv_index: 2,
      tip_title: "携带雨具",
      tip_body: "今日阴天有小雨，请携带雨伞出行。气温偏低，注意添衣保暖。空气质量良好。",
    },
    tomorrow: {
      condition_text: "转晴",
      temp_high_c: 24,
      temp_low_c: 17,
      precip_mm: 0,
      wind_dir: "东南风",
      wind_speed_kmh: 12,
      uv_index: 5,
      tip_title: "雨后好天气",
      tip_body: "明日雨后转晴，空气清新，适合外出活动。注意路面湿滑。",
    },
    aqi: 35,
    aqi_category: "good",
    aqi_summary: "空气质量良好，适合各类户外活动。",
  },
  {
    slug: "shenzhen",
    display_name: "深圳",
    timezone_label: "UTC+8",
    today: {
      condition_text: "多云",
      temp_high_c: 30,
      temp_low_c: 24,
      precip_mm: 0,
      wind_dir: "东南风",
      wind_speed_kmh: 14,
      uv_index: 6,
      tip_title: "注意防暑",
      tip_body: "今日气温较高，注意防暑降温，多补充水分。空气质量良好，适合早晚户外运动。",
    },
    tomorrow: {
      condition_text: "午后阵雨",
      temp_high_c: 28,
      temp_low_c: 23,
      precip_mm: 8,
      wind_dir: "东南风",
      wind_speed_kmh: 18,
      uv_index: 4,
      tip_title: "午后带伞",
      tip_body: "明日午后有阵雨，建议下午出行携带雨伞。气温适中，上午适合户外活动。",
    },
    aqi: 28,
    aqi_category: "good",
    aqi_summary: "空气质量优良，非常适合户外运动。",
  },
  {
    slug: "chengdu",
    display_name: "成都",
    timezone_label: "UTC+8",
    today: {
      condition_text: "阴",
      temp_high_c: 23,
      temp_low_c: 17,
      precip_mm: 0,
      wind_dir: "东北风",
      wind_speed_kmh: 6,
      uv_index: 2,
      tip_title: "减少户外活动",
      tip_body: "今日空气质量对敏感人群不健康，建议减少户外剧烈运动，外出佩戴口罩。",
    },
    tomorrow: {
      condition_text: "小雨",
      temp_high_c: 20,
      temp_low_c: 15,
      precip_mm: 6,
      wind_dir: "东北风",
      wind_speed_kmh: 8,
      uv_index: 1,
      tip_title: "雨天注意保暖",
      tip_body: "明日小雨，气温有所下降，外出注意防雨保暖。雨天有助于改善空气质量。",
    },
    aqi: 120,
    aqi_category: "unhealthy_sensitive",
    aqi_summary: "空气质量对敏感人群不健康，建议老人、儿童减少外出。",
  },
  {
    slug: "harbin",
    display_name: "哈尔滨",
    timezone_label: "UTC+8",
    today: {
      condition_text: "晴",
      temp_high_c: 12,
      temp_low_c: 2,
      precip_mm: 0,
      wind_dir: "西北风",
      wind_speed_kmh: 12,
      uv_index: 4,
      tip_title: "注意保暖",
      tip_body: "今日天气晴朗但气温较低，外出注意保暖，尤其是早晚温差较大。空气质量优良。",
    },
    tomorrow: {
      condition_text: "小雪",
      temp_high_c: 6,
      temp_low_c: -1,
      precip_mm: 3,
      wind_dir: "西北风",
      wind_speed_kmh: 15,
      uv_index: 2,
      tip_title: "防滑保暖",
      tip_body: "明日有小雪，路面可能湿滑，外出注意防滑。气温较低，做好全身保暖。",
    },
    aqi: 22,
    aqi_category: "good",
    aqi_summary: "空气质量优良，适合户外活动，注意防寒保暖。",
  },
];

function computeHourlyTemp(high: number, low: number, hour: number): number {
  const avg = (high + low) / 2;
  const amp = (high - low) / 2;
  return Math.round(avg + amp * Math.cos(((hour - 14) / 24) * 2 * Math.PI));
}


function initSchema(database: Database): void {
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE location (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slug          TEXT NOT NULL UNIQUE,
      display_name  TEXT NOT NULL,
      timezone_label TEXT NOT NULL
    );

    CREATE TABLE weather_daily (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id   INTEGER NOT NULL REFERENCES location(id),
      valid_date    TEXT NOT NULL,
      condition_text TEXT NOT NULL,
      temp_high_c   REAL NOT NULL,
      temp_low_c    REAL NOT NULL,
      precip_mm     REAL NOT NULL DEFAULT 0,
      wind_dir      TEXT NOT NULL DEFAULT '',
      wind_speed_kmh REAL NOT NULL DEFAULT 0,
      uv_index      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE weather_hourly (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id   INTEGER NOT NULL REFERENCES location(id),
      valid_date    TEXT NOT NULL,
      hour          INTEGER NOT NULL,
      temp_c        REAL NOT NULL,
      feels_like_c  REAL NOT NULL,
      condition_text TEXT NOT NULL,
      precip_mm     REAL NOT NULL DEFAULT 0,
      humidity      INTEGER NOT NULL DEFAULT 60,
      cloud_cover   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE air_quality_snapshot (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id   INTEGER NOT NULL REFERENCES location(id),
      observed_at   TEXT NOT NULL,
      aqi           INTEGER NOT NULL,
      category      TEXT NOT NULL,
      summary_text  TEXT NOT NULL
    );

    CREATE TABLE health_activity_tip (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id   INTEGER NOT NULL REFERENCES location(id),
      valid_date    TEXT NOT NULL,
      tip_title     TEXT NOT NULL,
      tip_body      TEXT NOT NULL
    );
  `);
}

function seedCities(database: Database, todayStr: string, tomorrowStr: string): void {
  const insertLocation = database.prepare(
    "INSERT INTO location (slug, display_name, timezone_label) VALUES (?, ?, ?) RETURNING id"
  );
  const insertDaily = database.prepare(
    `INSERT INTO weather_daily
      (location_id, valid_date, condition_text, temp_high_c, temp_low_c, precip_mm, wind_dir, wind_speed_kmh, uv_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertHourly = database.prepare(
    `INSERT INTO weather_hourly
      (location_id, valid_date, hour, temp_c, feels_like_c, condition_text, precip_mm, humidity, cloud_cover)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertAqi = database.prepare(
    `INSERT INTO air_quality_snapshot
      (location_id, observed_at, aqi, category, summary_text)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertTip = database.prepare(
    `INSERT INTO health_activity_tip
      (location_id, valid_date, tip_title, tip_body)
     VALUES (?, ?, ?, ?)`
  );

  for (const city of CITIES) {
    const row = insertLocation.get(city.slug, city.display_name, city.timezone_label) as { id: number };
    const locationId = row.id;

    for (const [dateStr, daily] of [[todayStr, city.today], [tomorrowStr, city.tomorrow]] as [string, DailySpec][]) {
      insertDaily.run(
        locationId, dateStr,
        daily.condition_text, daily.temp_high_c, daily.temp_low_c,
        daily.precip_mm, daily.wind_dir, daily.wind_speed_kmh, daily.uv_index
      );

      const hourlyPrecip = daily.precip_mm > 0 ? daily.precip_mm / 11 : 0; // 11 hours: 10-20 inclusive
      const baseHumidity = daily.condition_text.includes("雨") ? 85 : daily.condition_text.includes("雪") ? 80 : 60;
      const baseCloud = daily.condition_text === "晴" ? 10 : daily.condition_text.includes("多云") ? 50 : 80;

      for (let hour = 0; hour < 24; hour++) {
        const tempC = computeHourlyTemp(daily.temp_high_c, daily.temp_low_c, hour);
        const precip = hour >= 10 && hour <= 20 ? hourlyPrecip : 0;
        insertHourly.run(locationId, dateStr, hour, tempC, tempC + 2, daily.condition_text, precip, baseHumidity, baseCloud);
      }
    }

    insertAqi.run(locationId, `${todayStr} 09:00:00`, city.aqi, city.aqi_category, city.aqi_summary);

    insertTip.run(locationId, todayStr, city.today.tip_title, city.today.tip_body);
    insertTip.run(locationId, tomorrowStr, city.tomorrow.tip_title, city.tomorrow.tip_body);
  }
}

export function initDb(): void {
  try { db?.close(); } catch { /* ignore if not yet open */ }
  mkdirSync(dirname(DB_PATH), { recursive: true });
  if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
  db = new Database(DB_PATH, { create: true });

  const now = new Date();
  const todayStr = cstDateStr(now);
  const tomorrowStr = cstDateStr(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  seedDate = todayStr;

  initSchema(db);
  seedCities(db, todayStr, tomorrowStr);
}
