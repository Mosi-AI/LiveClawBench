(function() {
  function toast(msg, type) {
    var el = document.createElement("div");
    el.className = "toast toast-" + (type || "success");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 3000);
  }

  async function api(method, path, body) {
    var opts = { method: method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(path, opts);
    var data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  function reloadMedPage() {
    var params = new URLSearchParams(window.location.search);
    var sort = params.get("sort") || "time";
    window.location.href = "/medications?sort=" + sort;
  }

  // --- Bar chart rendering ---
  function renderBarChart(container, values, labels, unit) {
    if (!container || !values || values.length === 0) return;
    var max = Math.max.apply(null, values);
    if (max === 0) max = 1;

    var title = container.dataset.metric;
    var html = "";
    if (title) html += '<div class="week-chart-title">' + title + '</div>';
    html += '<div class="bar-chart-bars">';
    for (var i = 0; i < values.length; i++) {
      var h = Math.max(4, (values[i] / max) * 100);
      html += '<div class="bar-chart-bar" style="height:' + h + '%"><span class="bar-chart-bar-tip">' + values[i] + (unit || '') + '</span></div>';
    }
    html += '</div><div class="bar-chart-labels">';
    for (var j = 0; j < labels.length; j++) {
      html += '<div class="bar-chart-label">' + labels[j] + '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  // Render week summary charts on dashboard
  document.querySelectorAll(".week-chart").forEach(function(el) {
    try {
      var values = JSON.parse(el.dataset.values || "[]");
      var labels = JSON.parse(el.dataset.labels || "[]");
      renderBarChart(el, values, labels);
    } catch(e) {}
  });

  // Render detail page chart
  var detailChart = document.getElementById("detail-chart");
  if (detailChart) {
    try {
      var values = JSON.parse(detailChart.dataset.values || "[]");
      var labels = JSON.parse(detailChart.dataset.labels || "[]");
      var unit = detailChart.dataset.unit || "";
      renderBarChart(detailChart, values, labels, unit);
    } catch(e) {}
  }

  // --- Dose logging (dashboard) ---
  document.querySelectorAll(".log-dose-btn").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      var medId = this.dataset.medId;
      var slotId = this.dataset.slotId;
      try {
        await api("POST", "/api/medications/" + medId + "/log", {
          slot_id: Number(slotId), status: "taken"
        });
        toast("Dose logged");
        setTimeout(function() { location.reload(); }, 500);
      } catch(e) { toast(e.message, "error"); }
    });
  });

  // --- Cancel dose (dashboard) ---
  document.querySelectorAll(".cancel-dose-btn").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      var medId = this.dataset.medId;
      var logId = this.dataset.logId;
      if (!confirm("Cancel this dose log?")) return;
      try {
        await api("DELETE", "/api/medications/" + medId + "/log/" + logId);
        toast("Dose cancelled");
        setTimeout(function() { location.reload(); }, 500);
      } catch(e) { toast(e.message, "error"); }
    });
  });

  // --- Custom date range tab toggle ---
  var customRangeTab = document.getElementById("custom-range-tab");
  var dateRangePicker = document.getElementById("date-range-picker");
  if (customRangeTab && dateRangePicker) {
    customRangeTab.addEventListener("click", function() {
      document.querySelectorAll(".period-tab").forEach(function(t) { t.classList.remove("active"); });
      customRangeTab.classList.add("active");
      dateRangePicker.classList.add("visible");
    });
    if (customRangeTab.classList.contains("active")) {
      dateRangePicker.classList.add("visible");
    }
  }

  // --- Allergen CRUD ---
  var allergenForm = document.getElementById("allergen-form");
  var addAllergenBtn = document.getElementById("add-allergen-btn");
  var allergenCancel = document.getElementById("allergen-cancel");
  var allergenSubmit = document.getElementById("allergen-submit");

  if (addAllergenBtn) {
    addAllergenBtn.addEventListener("click", function() {
      document.getElementById("allergen-edit-id").value = "";
      document.getElementById("allergen-name").value = "";
      document.getElementById("allergen-severity").value = "";
      document.getElementById("allergen-notes").value = "";
      document.getElementById("allergen-form-title").textContent = "Add Allergen";
      allergenForm.classList.remove("hidden");
    });
  }

  if (allergenCancel) {
    allergenCancel.addEventListener("click", function() {
      allergenForm.classList.add("hidden");
    });
  }

  document.querySelectorAll(".edit-allergen-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      document.getElementById("allergen-edit-id").value = this.dataset.id;
      document.getElementById("allergen-name").value = this.dataset.name;
      document.getElementById("allergen-severity").value = this.dataset.severity;
      document.getElementById("allergen-notes").value = this.dataset.notes;
      document.getElementById("allergen-form-title").textContent = "Edit Allergen";
      allergenForm.classList.remove("hidden");
    });
  });

  if (allergenSubmit) {
    allergenSubmit.addEventListener("click", async function() {
      var editId = document.getElementById("allergen-edit-id").value;
      var name = document.getElementById("allergen-name").value.trim();
      if (!name) { toast("Name is required", "error"); return; }
      var severityVal = document.getElementById("allergen-severity").value;
      var notesVal = document.getElementById("allergen-notes").value;
      var body = {
        name: name,
        severity: severityVal ? severityVal : (editId ? null : undefined),
        notes: notesVal ? notesVal : (editId ? null : undefined)
      };
      try {
        if (editId) {
          await api("PUT", "/api/allergens/" + editId, body);
          toast("Updated");
        } else {
          await api("POST", "/api/allergens", body);
          toast("Added");
        }
        setTimeout(function() { location.reload(); }, 500);
      } catch(e) { toast(e.message, "error"); }
    });
  }

  document.querySelectorAll(".delete-allergen-btn").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      if (!confirm("Are you sure you want to delete this allergen?")) return;
      try {
        await api("DELETE", "/api/allergens/" + this.dataset.id);
        toast("Deleted");
        setTimeout(function() { location.reload(); }, 500);
      } catch(e) { toast(e.message, "error"); }
    });
  });

  // --- Medication CRUD ---
  var medForm = document.getElementById("med-form");
  var addMedBtn = document.getElementById("add-med-btn");
  var medCancel = document.getElementById("med-cancel");
  var medSubmit = document.getElementById("med-submit");
  var slotsContainer = document.getElementById("slots-container");
  var addSlotBtn = document.getElementById("add-slot-btn");

  function createSlotRow(slot) {
    var div = document.createElement("div");
    div.className = "slot-input-row";
    div.innerHTML =
      '<input type="time" class="slot-time-input" value="' + (slot ? slot.time_hhmm : "08:00") + '" />' +
      '<input type="number" class="slot-amount-input" placeholder="Dose" step="0.5" min="0" value="' + (slot ? slot.dose_amount : "0") + '" />' +
      '<input type="text" class="slot-unit-input" placeholder="Unit" value="' + (slot ? slot.dose_unit : "tablet") + '" />' +
      '<input type="text" class="slot-label-input" placeholder="Label (optional)" value="' + (slot && slot.label ? slot.label : "") + '" />' +
      '<button type="button" class="btn btn-sm btn-danger remove-slot-btn">×</button>';
    div.querySelector(".remove-slot-btn").addEventListener("click", function() { div.remove(); });
    return div;
  }

  if (addMedBtn) {
    addMedBtn.addEventListener("click", function() {
      document.getElementById("med-edit-id").value = "";
      document.getElementById("med-name").value = "";
      document.getElementById("med-display-name").value = "";
      document.getElementById("med-frequency").value = "daily";
      document.getElementById("med-dose-amount").value = "0";
      document.getElementById("med-dose-unit").value = "tablet";
      document.getElementById("med-start-date").value = document.body.dataset.today || new Date().toISOString().slice(0, 10);
      document.getElementById("med-end-date").value = "";
      document.getElementById("med-notes").value = "";
      document.getElementById("med-form-title").textContent = "Add Medication";
      slotsContainer.innerHTML = "";
      medForm.classList.remove("hidden");
    });
  }

  if (addSlotBtn) {
    addSlotBtn.addEventListener("click", function() {
      slotsContainer.appendChild(createSlotRow());
    });
  }

  if (medCancel) {
    medCancel.addEventListener("click", function() {
      medForm.classList.add("hidden");
    });
  }

  document.querySelectorAll(".edit-med-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      document.getElementById("med-edit-id").value = this.dataset.id;
      document.getElementById("med-name").value = this.dataset.name;
      document.getElementById("med-display-name").value = this.dataset.displayName;
      document.getElementById("med-frequency").value = this.dataset.frequency;
      document.getElementById("med-dose-amount").value = this.dataset.doseAmount || "";
      document.getElementById("med-dose-unit").value = this.dataset.doseUnit || "";
      document.getElementById("med-start-date").value = this.dataset.startDate;
      document.getElementById("med-end-date").value = this.dataset.endDate || "";
      document.getElementById("med-notes").value = this.dataset.notes;
      document.getElementById("med-form-title").textContent = "Edit Medication";
      slotsContainer.innerHTML = "";
      var slots = JSON.parse(this.dataset.slots || "[]");
      slots.forEach(function(s) { slotsContainer.appendChild(createSlotRow(s)); });
      // Allow empty slots - don't force adding one
      medForm.classList.remove("hidden");
    });
  });

  if (medSubmit) {
    medSubmit.addEventListener("click", async function() {
      var editId = document.getElementById("med-edit-id").value;
      var name = document.getElementById("med-name").value.trim();
      if (!name) { toast("Medication name is required", "error"); return; }
      var slots = [];
      slotsContainer.querySelectorAll(".slot-input-row").forEach(function(row) {
        var time = row.querySelector(".slot-time-input").value;
        var amountVal = row.querySelector(".slot-amount-input").value;
        var unit = row.querySelector(".slot-unit-input").value.trim();
        if (time) {
          slots.push({ time_hhmm: time, dose_amount: amountVal !== "" ? parseFloat(amountVal) : undefined, dose_unit: unit || undefined, label: row.querySelector(".slot-label-input").value.trim() || undefined });
        }
      });
      var doseAmountVal = document.getElementById("med-dose-amount").value;
      var doseAmount = doseAmountVal !== "" ? parseFloat(doseAmountVal) : null;
      var doseUnit = document.getElementById("med-dose-unit").value.trim() || null;
      var body = {
        name: name,
        display_name: document.getElementById("med-display-name").value.trim() || undefined,
        frequency: document.getElementById("med-frequency").value,
        dose_amount: editId ? doseAmount : (doseAmount !== null ? doseAmount : undefined),
        dose_unit: editId ? doseUnit : (doseUnit || undefined),
        start_date: document.getElementById("med-start-date").value,
        end_date: document.getElementById("med-end-date").value || undefined,
        notes: document.getElementById("med-notes").value.trim() || undefined,
        slots: slots
      };
      try {
        if (editId) {
          await api("PUT", "/api/medications/" + editId, body);
          toast("Updated");
        } else {
          await api("POST", "/api/medications", body);
          toast("Added");
        }
        setTimeout(function() { reloadMedPage(); }, 500);
      } catch(e) { toast(e.message, "error"); }
    });
  }

  document.querySelectorAll(".delete-med-btn").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      if (!confirm("Are you sure you want to discontinue this medication?")) return;
      try {
        await api("DELETE", "/api/medications/" + this.dataset.id);
        toast("Discontinued");
        setTimeout(function() { reloadMedPage(); }, 500);
      } catch(e) { toast(e.message, "error"); }
    });
  });
})();
