export const PROFILE_JS = `function editField(fieldName, currentValue) {
  var labels = { username: 'Username', gender: 'Gender', email: 'Email', phone: 'Phone', address: 'Delivery Address' };
  var isTextarea = fieldName === 'address';
  var modal = document.createElement('div');
  modal.className = 'edit-modal active';
  modal.id = 'editModal';
  modal.onclick = closeEditModal;
  var content = document.createElement('div');
  content.className = 'edit-modal-content';
  content.onclick = function(e) { e.stopPropagation(); };
  var header = document.createElement('div');
  header.className = 'edit-modal-header';
  var title = document.createElement('div');
  title.className = 'edit-modal-title';
  title.textContent = 'Edit ' + labels[fieldName];
  var closeBtn = document.createElement('button');
  closeBtn.className = 'edit-modal-close';
  closeBtn.textContent = '\\u00D7';
  closeBtn.onclick = closeEditModal;
  header.appendChild(title);
  header.appendChild(closeBtn);
  var body = document.createElement('div');
  body.className = 'edit-modal-body';
  var label = document.createElement('div');
  label.className = 'edit-field-label';
  label.textContent = labels[fieldName];
  var input;
  if (isTextarea) {
    input = document.createElement('textarea');
  } else {
    input = document.createElement('input');
    input.type = 'text';
  }
  input.className = 'edit-field-input';
  input.id = 'editInput';
  input.value = currentValue;
  body.appendChild(label);
  body.appendChild(input);
  var actions = document.createElement('div');
  actions.className = 'edit-modal-actions';
  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = closeEditModal;
  var saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = function() { saveField(fieldName); };
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(actions);
  modal.appendChild(content);
  document.body.appendChild(modal);
  setTimeout(function() {
    var inp = document.getElementById('editInput');
    if (inp) { inp.focus(); if (!isTextarea) inp.select(); }
  }, 100);
}

function closeEditModal(event) {
  if (event && event.target !== event.currentTarget) return;
  var modal = document.getElementById('editModal');
  if (modal) modal.remove();
}

async function saveField(fieldName) {
  var input = document.getElementById('editInput');
  if (!input) return;
  var newValue = input.value.trim();
  if (!newValue) { alert('Value cannot be empty'); return; }
  try {
    var response = await fetch('/api/user/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: fieldName, value: newValue })
    });
    var data = await response.json();
    if (data.success) {
      var displayEl = document.getElementById(fieldName + '-display');
      if (displayEl) {
        var valueText = displayEl.querySelector('.value-text');
        if (valueText) valueText.textContent = newValue;
      }
      closeEditModal();
    } else {
      alert('Failed to save: ' + data.message);
    }
  } catch (error) {
    console.error('Error saving field:', error);
    alert('Error saving. Please try again.');
  }
}

function showPaymentDetail(type, account, balance) {
  var modal = document.createElement('div');
  modal.className = 'payment-modal active';
  modal.id = 'paymentModal';
  modal.onclick = closeModal;
  var content = document.createElement('div');
  content.className = 'modal-content';
  content.onclick = function(e) { e.stopPropagation(); };
  var header = document.createElement('div');
  header.className = 'modal-header';
  var title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = type;
  var closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '\\u00D7';
  closeBtn.onclick = closeModal;
  header.appendChild(title);
  header.appendChild(closeBtn);
  var body = document.createElement('div');
  body.className = 'modal-body';
  var accountRow = document.createElement('div');
  accountRow.className = 'detail-row';
  var accountLabel = document.createElement('span');
  accountLabel.className = 'detail-label';
  accountLabel.textContent = 'Account';
  var accountValue = document.createElement('span');
  accountValue.className = 'detail-value';
  accountValue.textContent = account;
  accountRow.appendChild(accountLabel);
  accountRow.appendChild(accountValue);
  body.appendChild(accountRow);
  if (balance) {
    var balanceRow = document.createElement('div');
    balanceRow.className = 'detail-row';
    var balanceLabel = document.createElement('span');
    balanceLabel.className = 'detail-label';
    balanceLabel.textContent = 'Balance';
    var balanceValue = document.createElement('span');
    balanceValue.className = 'detail-value';
    balanceValue.style.color = '#1e8e3e';
    balanceValue.textContent = balance;
    balanceRow.appendChild(balanceLabel);
    balanceRow.appendChild(balanceValue);
    body.appendChild(balanceRow);
  }
  var statusRow = document.createElement('div');
  statusRow.className = 'detail-row';
  var statusLabel = document.createElement('span');
  statusLabel.className = 'detail-label';
  statusLabel.textContent = 'Status';
  var statusValue = document.createElement('span');
  statusValue.className = 'detail-value';
  statusValue.style.color = '#1e8e3e';
  statusValue.textContent = '\\u2713 Active';
  statusRow.appendChild(statusLabel);
  statusRow.appendChild(statusValue);
  body.appendChild(statusRow);
  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(content);
  document.body.appendChild(modal);
}

function closeModal(event) {
  if (event && event.target !== event.currentTarget) return;
  var modal = document.getElementById('paymentModal');
  if (modal) modal.remove();
}`;
