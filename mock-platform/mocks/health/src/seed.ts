import type { Database } from "bun:sqlite";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function seedDatabase(db: Database): void {
  const count = db.query("SELECT COUNT(*) as c FROM health_daily_snapshot").get() as { c: number };
  // Also backfill if new columns are missing (old DB migrated)
  const needsBackfill = count.c > 0 &&
    (db.query("SELECT COUNT(*) as c FROM health_daily_snapshot WHERE light_sleep_hours IS NULL").get() as { c: number }).c > 0;
  if (count.c > 0 && !needsBackfill) return;

  const rand = seededRandom(42);
  const row = db.query("SELECT value FROM system_config WHERE key = 'current_date'").get() as { value: string } | null;
  const todayStr = row?.value ?? "2026-05-13";

  db.exec("BEGIN TRANSACTION");
  try {
    for (let i = 29; i >= 0; i--) {
      const date = shiftDate(todayStr, -i);

      const steps = Math.floor(3000 + rand() * 12000);
      const activeEnergy = Math.floor(150 + rand() * 500);
      const sleepHours = +(5.5 + rand() * 3.5).toFixed(1);
      // Sleep quality correlates with deep+REM ratio: higher quality → more deep/REM, less light
      const qualityNoise = rand() * 0.1 - 0.05;
      const qualityFactor = sleepHours >= 7 ? 0.6 + qualityNoise : 0.45 + qualityNoise;
      const sleepQuality = +Math.min(99, Math.max(50, (qualityFactor * 100 + rand() * 20))).toFixed(1);
      const restingHr = Math.floor(55 + rand() * 20);
      const avgHr = Math.floor(65 + rand() * 25);
      const weight = +(65 + rand() * 5).toFixed(1);
      const bodyFat = +(15 + rand() * 10).toFixed(1);
      const bloodOxygen = +(95 + rand() * 4).toFixed(1);

      // Sleep breakdown: deep+REM ratio driven by quality (higher quality = more deep+REM)
      const qRatio = (sleepQuality - 50) / 50; // 0..1
      const deepRatio = 0.13 + qRatio * 0.10 + rand() * 0.04;
      const remRatio  = 0.20 + qRatio * 0.05 + rand() * 0.04;
      // Use integer minutes to guarantee exact sum
      const totalSleepMin = Math.round(sleepHours * 60);
      const deepMin  = Math.round(totalSleepMin * deepRatio);
      const remMin   = Math.round(totalSleepMin * remRatio);
      const lightMin = totalSleepMin - deepMin - remMin;
      const lightSleep = +(lightMin / 60).toFixed(2);
      const deepSleep  = +(deepMin  / 60).toFixed(2);
      const remSleep   = +(remMin   / 60).toFixed(2);

      // Activity breakdown: total driven by steps; split into intensities
      const activityFactor = (steps - 3000) / 12000; // 0..1
      const totalActivity = Math.floor(20 + activityFactor * 80 + rand() * 20);
      const highIntensity = Math.floor(totalActivity * (0.05 + activityFactor * 0.20 + rand() * 0.05));
      const medIntensity  = Math.floor(totalActivity * (0.20 + activityFactor * 0.15 + rand() * 0.05));
      const lowIntensity  = totalActivity - medIntensity - highIntensity;

      if (needsBackfill) {
        db.exec(`UPDATE health_daily_snapshot SET
          light_sleep_hours = ${lightSleep}, deep_sleep_hours = ${deepSleep}, rem_sleep_hours = ${remSleep},
          low_intensity_min = ${lowIntensity}, medium_intensity_min = ${medIntensity},
          high_intensity_min = ${highIntensity}, total_activity_min = ${totalActivity}
          WHERE user_id = 1 AND date = '${date}'`);
        for (const [type, value] of [
          ["light_sleep_hours", lightSleep], ["deep_sleep_hours", deepSleep], ["rem_sleep_hours", remSleep],
          ["low_intensity_min", lowIntensity], ["medium_intensity_min", medIntensity],
          ["high_intensity_min", highIntensity], ["total_activity_min", totalActivity],
        ] as const) {
          db.exec(`INSERT OR REPLACE INTO health_metric_series (user_id, metric_type, date, value)
            VALUES (1, '${type}', '${date}', ${value})`);
        }
      } else {
        db.exec(`INSERT INTO health_daily_snapshot
          (user_id, date, steps, active_energy_kcal, sleep_hours, sleep_quality,
           light_sleep_hours, deep_sleep_hours, rem_sleep_hours,
           low_intensity_min, medium_intensity_min, high_intensity_min, total_activity_min,
           resting_heart_rate_bpm, avg_heart_rate_bpm, weight_kg, body_fat_percent, blood_oxygen_percent)
          VALUES (1, '${date}', ${steps}, ${activeEnergy}, ${sleepHours}, ${sleepQuality},
           ${lightSleep}, ${deepSleep}, ${remSleep},
           ${lowIntensity}, ${medIntensity}, ${highIntensity}, ${totalActivity},
           ${restingHr}, ${avgHr}, ${weight}, ${bodyFat}, ${bloodOxygen})`);

        const metrics = [
          ["steps", steps], ["active_energy_kcal", activeEnergy],
          ["sleep_hours", sleepHours], ["sleep_quality", sleepQuality],
          ["light_sleep_hours", lightSleep], ["deep_sleep_hours", deepSleep], ["rem_sleep_hours", remSleep],
          ["low_intensity_min", lowIntensity], ["medium_intensity_min", medIntensity],
          ["high_intensity_min", highIntensity], ["total_activity_min", totalActivity],
          ["resting_heart_rate_bpm", restingHr], ["avg_heart_rate_bpm", avgHr],
          ["weight_kg", weight], ["body_fat_percent", bodyFat], ["blood_oxygen_percent", bloodOxygen],
        ] as const;
        for (const [type, value] of metrics) {
          db.exec(`INSERT INTO health_metric_series (user_id, metric_type, date, value)
            VALUES (1, '${type}', '${date}', ${value})`);
        }
      }
    }

    if (!needsBackfill) {
      const allergens = [
        { name: "Peanuts", severity: "severe", notes: "Severe allergy, carry epinephrine pen at all times" },
        { name: "Pollen", severity: "mild", notes: "Seasonal, take antihistamines in spring" },
        { name: "Shellfish", severity: "moderate", notes: "Allergic to shrimp and crab, fish is fine" },
      ];
      for (const a of allergens) {
        db.exec(`INSERT INTO allergen (user_id, name, severity, notes)
          VALUES (1, '${a.name}', '${a.severity}', '${a.notes}')`);
      }

      db.exec(`INSERT INTO medication (user_id, name, display_name, frequency, start_date, notes)
        VALUES (1, 'Vitamin D', NULL, 'daily', '${todayStr}', 'One tablet daily after meals')`);
      db.exec(`INSERT INTO medication_intake_slot (medication_id, time_hhmm, dose_amount, dose_unit, label)
        VALUES (1, '08:00', 1, 'tablet', 'After breakfast')`);

      db.exec(`INSERT INTO medication (user_id, name, display_name, frequency, start_date, notes)
        VALUES (1, 'Omega-3', 'Fish Oil', 'daily', '${todayStr}', 'Two capsules daily')`);
      db.exec(`INSERT INTO medication_intake_slot (medication_id, time_hhmm, dose_amount, dose_unit, label)
        VALUES (2, '08:00', 1, 'capsule', 'After breakfast')`);
      db.exec(`INSERT INTO medication_intake_slot (medication_id, time_hhmm, dose_amount, dose_unit, label)
        VALUES (2, '20:00', 1, 'capsule', 'After dinner')`);
    }

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
