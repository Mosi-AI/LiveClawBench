/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "../components/layout";
import type { CalendarEvent, MealPlan, Recipe, UserConstraints } from "../types";
import { escJs } from "./utils";

export const CalendarPage: FC<{ events: CalendarEvent[] }> = ({ events }) => {
  return <Layout title="Calendar" scripts={`
let editingId = null;

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Event';
  document.getElementById('event-id').value = '';
  document.getElementById('event-title').value = '';
  document.getElementById('event-time').value = '';
  document.getElementById('event-type').value = '';
  document.getElementById('workout-type').value = '';
  document.getElementById('event-modal').style.display = 'block';
}

function openEditModal(id, title, startTime, eventType, workoutType) {
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Event';
  document.getElementById('event-id').value = id;
  document.getElementById('event-title').value = title;
  document.getElementById('event-time').value = startTime;
  document.getElementById('event-type').value = eventType || '';
  document.getElementById('workout-type').value = workoutType || '';
  document.getElementById('event-modal').style.display = 'block';
}

function closeModal() {
  document.getElementById('event-modal').style.display = 'none';
  editingId = null;
}

async function saveEvent() {
  const title = document.getElementById('event-title').value.trim();
  const startTime = document.getElementById('event-time').value.trim();
  const eventType = document.getElementById('event-type').value.trim();
  const workoutType = document.getElementById('workout-type').value;

  if (!title || !startTime) {
    alert('Title and Start Time are required');
    return;
  }

  const body = { title, start_time: startTime };
  if (eventType) body.event_type = eventType;
  if (workoutType) body.workout_type = workoutType;

  try {
    const url = editingId ? '/api/calendar/' + editingId : '/api/calendar';
    const method = editingId ? 'PUT' : 'POST';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    const errorMessage = data.error || data.message;
    if (errorMessage) alert('Error: ' + errorMessage);
    else { closeModal(); location.reload(); }
  } catch (err) { alert('Failed to save event'); }
}

async function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  try {
    const response = await fetch('/api/calendar/' + id, { method: 'DELETE' });
    const data = await response.json();
    const errorMessage = data.error || data.message;
    if (errorMessage) alert('Error: ' + errorMessage);
    else location.reload();
  } catch (err) { alert('Failed to delete event'); }
}

function openMarkModal(id, currentStatus) {
  document.getElementById('mark-event-id').value = id;
  document.getElementById('mark-status').value = currentStatus;
  document.getElementById('mark-modal').style.display = 'block';
}

function closeMarkModal() {
  document.getElementById('mark-modal').style.display = 'none';
}

async function saveMarkStatus() {
  const id = document.getElementById('mark-event-id').value;
  const status = document.getElementById('mark-status').value;
  if (!status) {
    closeMarkModal();
    return;
  }
  try {
    const response = await fetch('/api/calendar/' + id + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    const errorMessage = data.error || data.message;
    if (errorMessage) alert('Error: ' + errorMessage);
    else { closeMarkModal(); location.reload(); }
  } catch (err) { alert('Failed to update status'); }
}

window.onclick = function(event) {
  const eventModal = document.getElementById('event-modal');
  const markModal = document.getElementById('mark-modal');
  if (event.target === eventModal) closeModal();
  if (event.target === markModal) closeMarkModal();
};
`}>
    <h1>Calendar</h1>

    <div id="event-modal" style="display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.4);">
      <div style="background:white; margin:80px auto; padding:20px; border-radius:8px; width:400px; max-width:90%;">
        <h2 id="modal-title" style="margin-top:0;">Add Event</h2>
        <input type="hidden" id="event-id" />
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Title *</label>
          <input type="text" id="event-title" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Start Time *</label>
          <input type="text" id="event-time" placeholder="e.g. 2026-05-09T10:00:00Z" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Event Type</label>
          <input type="text" id="event-type" placeholder="e.g. workout, meeting" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Workout Type</label>
          <select id="workout-type" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            <option value="">-- None --</option>
            <option value="hiit">HIIT</option>
            <option value="yoga">Yoga</option>
            <option value="walking">Walking</option>
            <option value="cycling">Cycling</option>
            <option value="strength">Strength</option>
            <option value="stretching">Stretching</option>
            <option value="swimming">Swimming</option>
            <option value="rest">Rest</option>
          </select>
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn" onclick="saveEvent()">Save</button>
        </div>
      </div>
    </div>

    <div id="mark-modal" style="display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.4);">
      <div style="background:white; margin:80px auto; padding:20px; border-radius:8px; width:300px; max-width:90%;">
        <h2 style="margin-top:0;">Mark Status</h2>
        <input type="hidden" id="mark-event-id" />
        <div style="margin-bottom:16px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Status</label>
          <select id="mark-status" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            <option value="">-- Cancel --</option>
            <option value="done">Done</option>
            <option value="undone">Undone</option>
          </select>
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeMarkModal()">Cancel</button>
          <button class="btn" onclick="saveMarkStatus()">Save</button>
        </div>
      </div>
    </div>

    <button class="btn" onclick="openAddModal()" style="margin-bottom:15px;">Add New</button>
    {events.length > 0 ? (
      <table>
        <thead><tr><th>Event</th><th>Time</th><th>Type</th><th>Workout</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {events.map((event) => (
            <tr>
              <td>{event.title}</td>
              <td>{event.start_time}</td>
              <td>{event.event_type || "-"}</td>
              <td>{event.workout_type || "-"}</td>
              <td>
                <span class={`status-badge ${event.status === "done" ? "status-ready" : "status-scheduled"}`}>
                  {event.status.toUpperCase()}
                </span>
              </td>
              <td>
                <button class="btn btn-secondary" style="padding:4px 12px;" onclick={`openEditModal(${event.id}, '${escJs(event.title)}', '${escJs(event.start_time)}', '${escJs(event.event_type || "")}', '${escJs(event.workout_type || "")}')`}>Edit</button>
                <button class="btn" style="padding:4px 12px;" onclick={`openMarkModal(${event.id}, '${event.status}')`}>Mark</button>
                <button class="btn btn-danger" style="padding:4px 12px;" onclick={`deleteEvent(${event.id})`}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : <p>No events scheduled.</p>}
  </Layout>;
};

export const MealPlanPage: FC<{
  constraints: UserConstraints;
  recipes: Recipe[];
  currentPlan: MealPlan | null;
}> = ({ constraints, recipes, currentPlan }) => {
  return <Layout title="Meal Planning" scripts={`
let currentPlan = null;
let editingPlan = null;

function initPlanData() {
  const today = new Date();
  const days = [];
  const date = new Date(today);
  days.push({
    date: date.toISOString().split('T')[0],
    meals: []
  });
  return days;
}

function openCreateModal() {
  editingPlan = null;
  document.getElementById('plan-modal-title').textContent = 'Create Meal Plan';
  renderPlanEditor(initPlanData());
  document.getElementById('plan-modal').style.display = 'block';
}

function openEditModal() {
  if (!currentPlan) return;
  editingPlan = currentPlan;
  document.getElementById('plan-modal-title').textContent = 'Edit Meal Plan';
  renderPlanEditor(JSON.parse(currentPlan.plan_data));
  document.getElementById('plan-modal').style.display = 'block';
}

function closePlanModal() {
  document.getElementById('plan-modal').style.display = 'none';
  editingPlan = null;
}

function renderPlanEditor(days) {
  const container = document.getElementById('plan-days');
  const mealTypes = ['breakfast', 'lunch', 'dinner'];
  const recipes = ${JSON.stringify(recipes.map((recipe) => ({ id: recipe.id, name: recipe.name, meal_type: recipe.meal_type, calories_total: recipe.calories_total })))};

  let html = '';
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    html += '<div class="day-card"><h3>' + day.date + '</h3>';
    for (const mealType of mealTypes) {
      const meal = day.meals.find(m => m.meal_type === mealType);
      const mealRecipes = recipes.filter(r => r.meal_type === mealType);
      html += '<div class="meal-row"><label>' + mealType.charAt(0).toUpperCase() + mealType.slice(1) + ':</label>';
      html += '<select id="day-' + i + '-' + mealType + '" onchange="updateCalories()">';
      html += '<option value="">-- Select --</option>';
      for (const r of mealRecipes) {
        const selected = meal && meal.meal_id === r.id ? ' selected' : '';
        html += '<option value="' + r.id + '"' + selected + '>' + r.name + ' (' + r.calories_total + ' kcal)</option>';
      }
      html += '</select></div>';
    }
    html += '</div>';
  }
  container.innerHTML = html;
  updateCalories();
}

function updateCalories() {
  const recipes = ${JSON.stringify(recipes.map((recipe) => ({ id: recipe.id, calories_total: recipe.calories_total })))};
  const container = document.getElementById('plan-days');
  const dayCards = container.querySelectorAll('.day-card');
  const numDays = dayCards.length;
  let totalCalories = 0;
  for (let i = 0; i < numDays; i++) {
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const select = document.getElementById('day-' + i + '-' + mealType);
      if (select && select.value) {
        const recipe = recipes.find(r => r.id === parseInt(select.value));
        if (recipe) totalCalories += recipe.calories_total;
      }
    }
  }
  document.getElementById('total-calories').textContent = totalCalories + ' kcal';
  document.getElementById('avg-calories').textContent = numDays > 0 ? Math.round(totalCalories / numDays) + ' kcal/day' : '0 kcal/day';
}

function savePlan() {
  const days = [];
  const container = document.getElementById('plan-days');
  const dayCards = container.querySelectorAll('.day-card');
  const numDays = dayCards.length;
  for (let i = 0; i < numDays; i++) {
    const dateInput = document.querySelector('#plan-days .day-card:nth-child(' + (i + 1) + ') h3');
    const meals = [];
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const select = document.getElementById('day-' + i + '-' + mealType);
      if (select && select.value) {
        meals.push({ meal_type: mealType, meal_id: parseInt(select.value) });
      }
    }
    days.push({ date: dateInput.textContent, meals });
  }

  fetch('/api/meal-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days })
  })
  .then(r => r.json())
  .then(data => {
    const errorMessage = data.error || data.message;
    if (errorMessage) alert('Error: ' + errorMessage);
    else { closePlanModal(); location.reload(); }
  })
  .catch(err => alert('Failed to save plan'));
}

function deletePlan() {
  if (!currentPlan) return;
  if (!confirm('Delete current meal plan?')) return;
  fetch('/api/meal-plan', { method: 'DELETE' })
    .then(r => r.json())
    .then(data => {
      const errorMessage = data.error || data.message;
      if (errorMessage) alert('Error: ' + errorMessage);
      else location.reload();
    })
    .catch(err => alert('Failed to delete plan'));
}

const planDataElement = document.getElementById('current-plan-data');
if (planDataElement && planDataElement.textContent) {
  try {
    currentPlan = JSON.parse(planDataElement.textContent);
  } catch (e) {}
}

window.onclick = function(event) {
  const modal = document.getElementById('plan-modal');
  if (event.target === modal) closePlanModal();
}
`}>
    <h1>Meal Planning</h1>

    <script id="current-plan-data" type="application/json">{currentPlan ? JSON.stringify(currentPlan) : ""}</script>

    <h2>Your Constraints</h2>
    <div class="card">
      <div class="metric">
        <span class="metric-label">Calorie Target</span>
        <span class="metric-value">{`${constraints.calorie_target} kcal/day`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Weekly Budget</span>
        <span class="metric-value">{`$${constraints.weekly_budget_limit}`}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Allergies</span>
        <span class="metric-value">{constraints.allergy_constraints}</span>
      </div>
    </div>

    <h2>Current Meal Plan</h2>
    {currentPlan ? (
      <div class="card">
        <div class="metric">
          <span class="metric-label">Plan ID</span>
          <span class="metric-value">{currentPlan.plan_id}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Created</span>
          <span class="metric-value">{currentPlan.created_at}</span>
        </div>
        <div style="margin-top: 15px;">
          <button class="btn btn-secondary" onclick="openEditModal()">Edit Plan</button>
        </div>
        <table style="margin-top: 15px;">
          <thead><tr><th>Date</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th><th>Daily Calories</th></tr></thead>
          <tbody id="current-plan-table"></tbody>
        </table>
        <script>{`
          const planData = ${JSON.stringify(currentPlan.plan_data)};
          const recipes = ${JSON.stringify(recipes)};
          const table = document.getElementById('current-plan-table');
          let html = '';
          for (const day of JSON.parse(planData)) {
            let dayCalories = 0;
            const meals = { breakfast: '-', lunch: '-', dinner: '-' };
            for (const m of day.meals) {
              const recipe = recipes.find(r => r.id === m.meal_id);
              if (recipe) {
                meals[m.meal_type] = recipe.name;
                dayCalories += recipe.calories_total;
              }
            }
            html += '<tr><td>' + day.date + '</td><td>' + meals.breakfast + '</td><td>' + meals.lunch + '</td><td>' + meals.dinner + '</td><td>' + dayCalories + ' kcal</td></tr>';
          }
          table.innerHTML = html;
        `}</script>
      </div>
    ) : (
      <div class="card">
        <p>No meal plan created yet.</p>
        <button class="btn" onclick="openCreateModal()" style="margin-top: 10px;">Create Meal Plan</button>
      </div>
    )}

    <h2>Available Recipes</h2>
    <table>
      <thead><tr><th>Name</th><th>Meal</th><th>Calories</th><th>Allergens</th></tr></thead>
      <tbody>
        {recipes.map((recipe) => (
          <tr>
            <td>{recipe.name}</td>
            <td>{recipe.meal_type}</td>
            <td>{`${recipe.calories_total} kcal`}</td>
            <td>{recipe.allergens || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <div id="plan-modal" style="display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.4); overflow:auto;">
      <div style="background:white; margin:20px auto; padding:20px; border-radius:8px; width:900px; max-width:95%; max-height:90vh; overflow-y:auto;">
        <h2 id="plan-modal-title" style="margin-top:0;">Create Weekly Meal Plan</h2>
        <div style="margin-bottom:15px; padding:10px; background:#f8f9fa; border-radius:4px;">
          <strong>Weekly Total:</strong> <span id="total-calories">0 kcal</span> |
          <strong> Daily Avg:</strong> <span id="avg-calories">0 kcal/day</span>
          <span style="margin-left:15px; color:#666;">Target: {constraints.calorie_target} kcal/day</span>
        </div>
        <div id="plan-days" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:15px;"></div>
        <div style="margin-top:20px; display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closePlanModal()">Cancel</button>
          <button class="btn" onclick="savePlan()">Save Plan</button>
        </div>
      </div>
    </div>

    <style>{`
      .day-card { background: #f8f9fa; padding: 12px; border-radius: 6px; }
      .day-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #333; }
      .meal-row { margin-bottom: 8px; }
      .meal-row label { display: block; font-size: 12px; color: #666; margin-bottom: 2px; }
      .meal-row select { width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
    `}</style>
  </Layout>;
};
