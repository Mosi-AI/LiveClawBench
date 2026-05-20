/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "../components/layout";
import type { RoomMetrics, ThermostatSettings } from "../types";

export const DashboardPage: FC<{
  metrics: RoomMetrics;
  thermostat: ThermostatSettings;
}> = ({ metrics, thermostat }) => {
  return <Layout title="Smart Home Dashboard">
    <h1>Smart Home Dashboard</h1>

    <h2>Room Metrics</h2>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Temperature</span>
        <span class="metric-value">{`${metrics.temperature}°${metrics.unit_temp}`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Humidity</span>
        <span class="metric-value">{`${metrics.humidity}%`}</span>
      </div>
      {metrics.noise != null ? (
        <div class="metric">
          <span class="metric-label">Noise Level</span>
          <span class="metric-value">{`${metrics.noise} dB`}</span>
        </div>
      ) : null}
      {metrics.light != null ? (
        <div class="metric">
          <span class="metric-label">Light</span>
          <span class="metric-value">{`${metrics.light} lux`}</span>
        </div>
      ) : null}
      {metrics.air_quality != null ? (
        <div class="metric">
          <span class="metric-label">Air Quality</span>
          <span class="metric-value">{metrics.air_quality}</span>
        </div>
      ) : null}
    </div>

    <h2>Thermostat</h2>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Mode</span>
        <span class="metric-value">{thermostat.mode.toUpperCase()}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Target Temperature</span>
        <span class="metric-value">{`${thermostat.temperature}°F`}</span>
      </div>
    </div>
  </Layout>;
};
