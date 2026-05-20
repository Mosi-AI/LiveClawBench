/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "../components/layout";
import type { ThermostatSettings, WearableRecovery } from "../types";

type CoffeePageData = {
  start_time: string;
  status: string;
  beans_grams: number;
  cancelled: boolean;
  updated_at: string;
};

export const CoffeePage: FC<{ schedule: CoffeePageData }> = ({ schedule }) => {
  const displayStartTime = schedule.cancelled ? "-" : schedule.start_time;
  const displayStatus = schedule.cancelled ? "-" : schedule.status.toUpperCase();
  const displayBeans = schedule.cancelled ? "-" : `${schedule.beans_grams}g`;
  const statusBadgeClass = schedule.cancelled
    ? ""
    : schedule.status === "ready"
      ? "status-ready"
      : schedule.status === "brewing"
        ? "status-brewing"
        : "status-scheduled";

  return <Layout title="Coffee Schedule" scripts={`
async function updateSchedule() {
  const startTime = document.getElementById('start-time').value;
  const beansGrams = parseInt(document.getElementById('beans-grams').value) || 20;
  if (!startTime) { alert('Please enter a start time'); return; }
  if (beansGrams < 5 || beansGrams > 100) { alert('Beans amount must be between 5g and 100g'); return; }
  try {
    const response = await fetch('/api/coffee-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time: startTime, beans_grams: beansGrams, cancelled: false })
    });
    const data = await response.json();
    const errorMessage = data.error || data.message;
    if (errorMessage) alert('Error: ' + errorMessage);
    else location.reload();
  } catch (err) { alert('Failed to update schedule'); }
}

async function cancelSchedule() {
  if (!confirm('Are you sure you want to cancel the coffee schedule?')) return;
  try {
    const response = await fetch('/api/coffee-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancelled: true })
    });
    const data = await response.json();
    const errorMessage = data.error || data.message;
    if (errorMessage) alert('Error: ' + errorMessage);
    else location.reload();
  } catch (err) { alert('Failed to cancel schedule'); }
}
`}>
    <h1>Coffee Schedule</h1>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Start Time</span>
        <span class="metric-value">{displayStartTime}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Status</span>
        <span class="metric-value">
          <span class={`status-badge ${statusBadgeClass}`}>
            {displayStatus}
          </span>
        </span>
      </div>
      <div class="metric">
        <span class="metric-label">Beans</span>
        <span class="metric-value">{displayBeans}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Last Updated</span>
        <span class="metric-value">{schedule.updated_at}</span>
      </div>
    </div>

    <h2>Update Schedule</h2>
    <div class="card">
      <div style="margin-bottom:12px;">
        <label style="display:block; margin-bottom:4px; font-weight:500;">Start Time</label>
        <input type="time" id="start-time" value={schedule.start_time} style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block; margin-bottom:4px; font-weight:500;">Beans (grams)</label>
        <input type="number" id="beans-grams" value={schedule.beans_grams} min="5" max="100" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn btn-danger" onclick="cancelSchedule()">Cancel Schedule</button>
        <button class="btn" onclick="updateSchedule()">Update</button>
      </div>
    </div>

    <p style="color: #666; font-size: 14px; margin-top: 16px;">Brewing takes approximately 30 minutes.</p>
  </Layout>;
};

export const WearablePage: FC<{ data: WearableRecovery; date: string }> = ({
  data,
  date,
}) => {
  return <Layout title="Wearable & Recovery" scripts={`
function showReadinessFormula() {
  alert('Readiness Formula:\\n\\nreadiness = sleep_quality × 0.4 + (100 - normalized_resting_heart_rate) × 0.3 + activity_factor × 0.3\\n\\n• sleep_quality: from health service (0-100)\\n• normalized_resting_heart_rate: (resting_heart_rate - 40) / 60 × 100\\n• activity_factor: min(total_activity_min / 60 × 100, 100)');
}

function openSetValuesModal() {
  document.getElementById('sleep-hours').value = '';
  document.getElementById('sleep-score').value = '';
  document.getElementById('readiness').value = '';
  document.getElementById('resting-heart-rate').value = '';
  document.getElementById('set-values-modal').style.display = 'block';
}

function closeSetValuesModal() {
  document.getElementById('set-values-modal').style.display = 'none';
}

async function saveValues() {
  const sleepHours = parseFloat(document.getElementById('sleep-hours').value);
  const sleepScore = parseFloat(document.getElementById('sleep-score').value);
  const readiness = parseFloat(document.getElementById('readiness').value);
  const restingHeartRate = parseFloat(document.getElementById('resting-heart-rate').value);

  if (isNaN(sleepHours) || isNaN(sleepScore) || isNaN(readiness) || isNaN(restingHeartRate)) {
    alert('Please fill in all fields with valid numbers');
    return;
  }

  if (sleepHours < 0 || sleepHours > 24) {
    alert('Sleep hours must be between 0 and 24');
    return;
  }

  if (sleepScore < 0 || sleepScore > 100) {
    alert('Sleep score must be between 0 and 100');
    return;
  }

  if (readiness < 0 || readiness > 100) {
    alert('Readiness must be between 0 and 100');
    return;
  }

  if (restingHeartRate < 30 || restingHeartRate > 200) {
    alert('Resting heart rate must be between 30 and 200 bpm');
    return;
  }

  try {
    const response = await fetch('/api/wearable-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sleep_hours: sleepHours,
        sleep_score: sleepScore,
        readiness: readiness,
        resting_heart_rate: restingHeartRate
      })
    });
    const result = await response.json();
    if (result.error) {
      alert('Error: ' + result.error);
    } else {
      closeSetValuesModal();
      location.reload();
    }
  } catch (err) {
    alert('Failed to save values');
  }
}

window.onclick = function(event) {
  const modal = document.getElementById('set-values-modal');
  if (event.target === modal) closeSetValuesModal();
};
`}>
    <h1>Wearable & Recovery Data</h1>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Date</span>
        <span class="metric-value">{date}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Sleep Hours</span>
        <span class="metric-value">{`${data.sleep_hours} hrs`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Sleep Score</span>
        <span class="metric-value">{`${data.sleep_score}/100`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">
          Readiness
          <span onclick="showReadinessFormula()" style="display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; background: #667eea; color: white; border-radius: 50%; font-size: 12px; font-weight: bold; margin-left: 8px; cursor: pointer; user-select: none;" title="Click to see formula">?</span>
        </span>
        <span class="metric-value">{`${data.readiness}/100`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Resting Heart Rate</span>
        <span class="metric-value">{`${data.resting_heart_rate} bpm`}</span>
      </div>
    </div>

    <button class="btn" onclick="openSetValuesModal()" style="margin-top: 15px;">Set Values</button>

    <p style="color: #666; font-size: 14px;">Note: This page displays current wellness data. Values need to be manually synced.</p>

    <div id="set-values-modal" style="display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.4);">
      <div style="background:white; margin:80px auto; padding:20px; border-radius:8px; width:400px; max-width:90%;">
        <h2 style="margin-top:0;">Set Today's Values</h2>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Sleep Hours (0-24)</label>
          <input type="number" id="sleep-hours" step="0.1" min="0" max="24" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Sleep Score (0-100)</label>
          <input type="number" id="sleep-score" step="1" min="0" max="100" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Readiness (0-100)</label>
          <input type="number" id="readiness" step="1" min="0" max="100" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Resting Heart Rate (30-200 bpm)</label>
          <input type="number" id="resting-heart-rate" step="1" min="30" max="200" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeSetValuesModal()">Cancel</button>
          <button class="btn" onclick="saveValues()">Save</button>
        </div>
      </div>
    </div>
  </Layout>;
};

export const ThermostatPage: FC<{ thermostat: ThermostatSettings }> = ({
  thermostat,
}) => {
  return <Layout title="Thermostat Control" scripts={`
async function updateThermostat() {
  const mode = document.getElementById('mode').value;
  const temperature = parseFloat(document.getElementById('temperature').value);
  if (isNaN(temperature)) { alert('Please enter a valid temperature'); return; }
  try {
    const response = await fetch('/api/thermostat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, temperature })
    });
    const data = await response.json();
    const errorMessage = data.error || data.message;
    if (errorMessage) { alert('Error: ' + errorMessage); }
    else { location.reload(); }
  } catch (err) { alert('Failed to update thermostat'); }
}
`}>
    <h1>Thermostat Control</h1>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Current Mode</span>
        <span class="metric-value">{thermostat.mode.toUpperCase()}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Target Temperature</span>
        <span class="metric-value">{`${thermostat.temperature}°F`}</span>
      </div>
    </div>

    <h2>Update Settings</h2>
    <div class="card">
      <select id="mode">
        <option value="comfort" selected={thermostat.mode === "comfort"}>Comfort</option>
        <option value="eco" selected={thermostat.mode === "eco"}>Eco</option>
        <option value="off" selected={thermostat.mode === "off"}>Off</option>
      </select>
      <input type="number" id="temperature" value={thermostat.temperature} step="1" min="50" max="90" placeholder="Temperature (°F)" />
      <button class="btn" onclick="updateThermostat()">Update</button>
    </div>
  </Layout>;
};
