// Christmas List Generator & Shopper - Flask backend
const API = '/api';
let recipients = [];
let stats = {};
let pinLocked = false;
let currentRecipientId = null;
let filteredStatus = 'All';
let allIdeas = [];
let currentSearchIdeaId = null;

// --- Auth Gate ---
let appAuthed = false;

async function checkAuth() {
  try {
    const res = await apiFetch(`${API}/auth/status`, { credentials: 'include' });
    const data = await res.json();
    appAuthed = data.authed === true;
    return appAuthed;
  } catch (e) {
    appAuthed = false;
    return false;
  }
}

async function doLogin(password) {
  const res = await apiFetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (data.success) { appAuthed = true; }
  return data.success;
}

async function doLogout() {
  await apiFetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
  appAuthed = false;
}

function showAuthGate() {
  const existing = document.getElementById('authGate');
  if (existing) { existing.classList.add('active'); return; }

  const overlay = document.createElement('div');
  overlay.id = 'authGate';
  overlay.className = 'lock-overlay active';

  const modal = document.createElement('div');
  modal.className = 'lock-modal';

  const title = document.createElement('h2');
  title.textContent = 'Access Required';

  const desc = document.createElement('p');
  desc.textContent = 'Enter the access password to view the Christmas list.';

  const input = document.createElement('input');
  input.type = 'password';
  input.className = 'lock-input';
  input.id = 'authGateInput';
  input.placeholder = 'Password';

  const error = document.createElement('div');
  error.className = 'lock-error';
  error.id = 'authGateError';

  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'btn btn-primary';
  submit.textContent = 'Enter';
  submit.onclick = async () => {
    const pwd = document.getElementById('authGateInput').value;
    if (!pwd) return;
    submit.disabled = true;
    submit.textContent = 'Checking...';
    const ok = await doLogin(pwd);
    if (ok) {
      overlay.classList.remove('active');
      overlay.remove();
      await Promise.all([loadRecipients(), loadStats(), loadIdeas()]);
      render();
    } else {
      document.getElementById('authGateError').textContent = 'Incorrect password';
      submit.disabled = false;
      submit.textContent = 'Enter';
    }
  };

  actions.appendChild(submit);
  modal.appendChild(title);
  modal.appendChild(desc);
  modal.appendChild(input);
  modal.appendChild(error);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  input.focus();
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit.click(); });
}

// Helper that sends the session cookie with every API call
async function apiFetch(url, opts = {}) {
  opts = { credentials: 'include', ...opts };
  return fetch(url, opts);
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  updatePinUI();
  const authed = await checkAuth();
  if (!authed) { showAuthGate(); return; }
  await Promise.all([loadRecipients(), loadStats(), loadIdeas()]);
  render();
});

// --- Event Listeners ---
function setupEventListeners() {
  document.getElementById('addRecipientBtn').addEventListener('click', openModal);
  document.getElementById('addRecipientModalBtn').addEventListener('click', openModal);
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('recipientForm').addEventListener('submit', handleAddRecipient);
  document.getElementById('editRecipientForm').addEventListener('submit', handleEditRecipient);

  document.getElementById('pinToggleBtn').addEventListener('click', togglePinLock);

  document.getElementById('quickAddBtn').addEventListener('click', handleQuickAdd);
  document.getElementById('quickAddInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleQuickAdd();
  });

  document.getElementById('exportCsvBtn').addEventListener('click', () => downloadFile('/api/export/csv', 'christmas-list.csv'));
  document.getElementById('exportJsonBtn').addEventListener('click', () => downloadFile('/api/export/json', 'christmas-list.json'));

  document.getElementById('productSearchBtn').addEventListener('click', handleProductSearch);
  document.getElementById('productSearchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleProductSearch();
  });
  document.getElementById('closeSearchModalBtn').addEventListener('click', closeSearchModal);
  document.getElementById('quickAddCancelBtn').addEventListener('click', closeSearchModal);

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// --- Tab Navigation ---
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const target = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (target) target.classList.add('active');
  const panel = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  if (panel) panel.classList.add('active');
  if (tab === 'runs') renderShoppingRuns();
}

// --- PIN Lock ---
function updatePinUI() {
  const btn = document.getElementById('pinToggleBtn');
  if (pinLocked) {
    btn.innerHTML = '<span class="icon">🔓</span><span>PIN Lock: On</span>';
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.add('btn-danger');
  } else {
    btn.innerHTML = '<span class="icon">🔒</span><span>PIN Lock: Off</span>';
    btn.setAttribute('aria-pressed', 'false');
    btn.classList.remove('btn-danger');
  }
}

function togglePinLock() {
  showLockOverlay(pinLocked ? 'unlock' : 'set');
}

function showLockOverlay(mode) {
  const existing = document.getElementById('lockOverlay');
  if (existing) { existing.classList.add('active'); return; }

  const overlay = document.createElement('div');
  overlay.id = 'lockOverlay';
  overlay.className = 'lock-overlay';

  const modal = document.createElement('div');
  modal.className = 'lock-modal';

  const title = document.createElement('h2');
  title.id = 'lockTitle';
  title.textContent = { set: 'Set PIN Lock', unlock: 'Enter PIN to Unlock', clear: 'Disable PIN' }[mode];

  const input = document.createElement('input');
  input.type = 'password';
  input.className = 'lock-input';
  input.id = 'lockInput';
  input.placeholder = '••••••';
  input.maxLength = 6;
  input.inputMode = 'numeric';

  const error = document.createElement('div');
  error.className = 'lock-error';
  error.id = 'lockError';

  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn-cancel';
  cancel.textContent = 'Cancel';
  cancel.onclick = () => { overlay.classList.remove('active'); };

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'btn btn-primary';
  submit.id = 'lockSubmitBtn';
  submit.textContent = { set: 'Set PIN', unlock: 'Unlock', clear: 'Disable PIN' }[mode];
  submit.onclick = () => handleLockSubmit(mode);

  actions.appendChild(cancel);
  actions.appendChild(submit);

  modal.appendChild(title);
  modal.appendChild(input);
  modal.appendChild(error);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  input.focus();
}

async function handleLockSubmit(mode) {
  const pin = (document.getElementById('lockInput')?.value || '').trim();
  const error = document.getElementById('lockError');
  if (!/^\d{4,6}$/.test(pin)) { error.textContent = 'PIN must be 4-6 digits'; return; }

  const endpoints = { set: '/api/lock/set-pin', unlock: '/api/lock/unlock', clear: '/api/lock/clear-pin' };
  const res = await apiFetch(endpoints[mode] || '/api/lock/clear-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin })
  });
  const data = await res.json();

  if (mode === 'unlock') {
    if (data.unlocked) {
      pinLocked = false; updatePinUI();
      closeLockOverlay();
    } else { error.textContent = 'Incorrect PIN'; }
  } else {
    if (data.success) {
      pinLocked = mode === 'set';
      updatePinUI();
      closeLockOverlay();
    } else { error.textContent = data.error || 'Failed'; }
  }
}

function closeLockOverlay() {
  document.getElementById('lockOverlay')?.classList.remove('active');
  document.getElementById('lockOverlay')?.remove();
}

// --- Modal Helpers ---
function openModal() {
  document.getElementById('recipientForm').reset();
  document.getElementById('addRecipientModal').classList.add('active');
}
function closeModal() {
  document.getElementById('addRecipientModal').classList.remove('active');
}

function openEditRecipientModal(recipientId) {
  const recipient = recipients.find(r => r.id === recipientId);
  if (!recipient) return;
  const form = document.getElementById('editRecipientForm');
  form.dataset.recipientId = recipientId;
  form.querySelector('input[name="name"]').value = recipient.name || '';
  form.querySelector('input[name="relationship"]').value = recipient.relationship || '';
  form.querySelector('input[name="age"]').value = recipient.age !== null && recipient.age !== undefined ? recipient.age : '';
  form.querySelector('input[name="interests"]').value = (recipient.interests || []).join(', ');
  form.querySelector('input[name="dislikes"]').value = (recipient.dislikes || []).join(', ');
  form.querySelector('input[name="budget"]').value = recipient.budget || 0;
  document.getElementById('editRecipientModal').classList.add('active');
}

function closeEditRecipientModal() {
  document.getElementById('editRecipientModal').classList.remove('active');
}

async function handleEditRecipient() {
  const form = document.getElementById('editRecipientForm');
  const recipientId = form.dataset.recipientId;
  if (!recipientId) return;
  const fd = new FormData(form);
  const recipient = {
    name: fd.get('name'),
    relationship: fd.get('relationship'),
    age: fd.get('age') ? parseInt(fd.get('age')) : null,
    interests: fd.get('interests') ? fd.get('interests').split(',').map(s => s.trim()).filter(Boolean) : [],
    dislikes: fd.get('dislikes') ? fd.get('dislikes').split(',').map(s => s.trim()).filter(Boolean) : [],
    allergies: fd.get('allergies') ? fd.get('allergies').split(',').map(s => s.trim()).filter(Boolean) : [],
    budget: fd.get('budget') ? parseFloat(fd.get('budget')) : 0,
  };
  try {
    const res = await apiFetch(`${API}/recipients/${recipientId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recipient)
    });
    if (res.ok) {
      closeEditRecipientModal();
      await loadRecipients();
      await loadStats();
      render();
    }
  } catch (err) { console.error(err); }
}
function closeSearchModal() {
  document.getElementById('productSearchModal').classList.remove('active');
  document.getElementById('quickAddRecipientModal').classList.remove('active');
  currentSearchIdeaId = null; // reset so re-open creates a fresh idea
}

// --- Data Loading ---
async function loadRecipients() {
  try {
    const res = await apiFetch(`${API}/recipients`);
    recipients = await res.json();
  } catch (e) { recipients = []; }
}

async function loadStats() {
  try {
    const res = await apiFetch(`${API}/stats`);
    stats = await res.json();
  } catch (e) { stats = {}; }
}

async function loadIdeas() {
  try {
    const res = await apiFetch(`${API}/ideas`);
    allIdeas = await res.json();
  } catch (e) { allIdeas = []; }
}

// --- Add Recipient ---
async function handleAddRecipient(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const recipient = {
    name: fd.get('name'),
    relationship: fd.get('relationship'),
    age: fd.get('age') ? parseInt(fd.get('age')) : null,
    interests: fd.get('interests') ? fd.get('interests').split(',').map(s => s.trim()).filter(Boolean) : [],
    dislikes: fd.get('dislikes') ? fd.get('dislikes').split(',').map(s => s.trim()).filter(Boolean) : [],
    allergies: [],
    budget: fd.get('budget') ? parseFloat(fd.get('budget')) : 0,
  };
  try {
    const res = await apiFetch(`${API}/recipients`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recipient)
    });
    if (res.ok) {
      closeModal();
      await loadRecipients();
      await loadStats();
      render();
    }
  } catch (err) { console.error(err); }
}

// --- Quick-Add ---
function parseQuickAdd(text) {
  text = text.trim();
  if (!text) return null;
  const priceMatch = text.match(/\$?(\d+(?:\.\d{1,2})?)/);
  let price = null;
  if (priceMatch) {
    price = parseFloat(priceMatch[0].replace('$', ''));
    text = text.slice(0, priceMatch.index) + text.slice(priceMatch.index + priceMatch[0].length);
  }
  const stores = ['amazon', 'target', 'walmart', 'best buy', 'etsy', 'costco', 'kohl', 'macys', 'nordstrom', 'sephora', 'apple', 'microsoft', 'gamestop', 'barnes', 'home depot', 'lowes', 'ikea', 'wayfair'];
  let store = null;
  const textLower = text.toLowerCase();
  for (const s of stores) {
    if (textLower.includes(s)) {
      store = s.charAt(0).toUpperCase() + s.slice(1);
      text = text.replace(s, '').trim();
      break;
    }
  }
  let recipientName = null;
  const forMatch = text.match(/\bfor\s+([A-Za-z][A-Za-z\s]+?)(?:\s*$)/i);
  if (forMatch) {
    recipientName = forMatch.group(1).trim();
    text = text.slice(0, forMatch.index).trim();
  }
  const name = text.replace(/\s+/g, ' ').trim().replace(/^[.,;]|[.,;]$/g, '');
  if (!name) return null;
  return { name, price, store, recipientName };
}

function findRecipientByName(name) {
  if (!name) return null;
  const nl = name.toLowerCase();
  for (const r of recipients) {
    if (r.name.toLowerCase() === nl || r.name.toLowerCase().startsWith(nl)) return r;
  }
  return null;
}

async function handleQuickAdd() {
  const input = document.getElementById('quickAddInput');
  const text = input.value.trim();
  if (!text) return;
  const parsed = parseQuickAdd(text);
  if (!parsed) { alert('Could not parse that. Try: "Lego Star Wars set $45 Target for Leo"'); return; }
  input.value = '';

  // If recipient named, auto-add
  if (parsed.recipientName) {
    const r = findRecipientByName(parsed.recipientName);
    if (r) { await addQuickIdea(r, parsed); return; }
    alert(`Recipient "${parsed.recipientName}" not found.`);
    return;
  }

  // Show picker
  const picker = document.getElementById('recipientPickerList');
  picker.innerHTML = recipients.map(r => `
    <div class="recipient-picker-item" onclick="confirmQuickAdd('${r.id}')">
      <div class="recipient-picker-info">
        <span class="recipient-picker-name">${escapeHtml(r.name)}</span>
        <span class="recipient-picker-budget">budget: $${r.budget} • ${r.relationship}</span>
      </div>
      <span class="recipient-picker-confirm">Add</span>
    </div>
  `).join('');

  document.getElementById('quickAddParsedText').innerHTML = `Add <strong>"${escapeHtml(parsed.name)}"</strong>${parsed.price ? ` $${parsed.price.toFixed(2)}` : ''}${parsed.store ? ` at ${escapeHtml(parsed.store)}` : ''} to:`;

  document.getElementById('quickAddRecipientModal').classList.add('active');
  window._pendingQuickAdd = parsed;
}

async function confirmQuickAdd(recipientId) {
  const recipient = recipients.find(r => r.id === recipientId);
  if (recipient && window._pendingQuickAdd) {
    await addQuickIdea(recipient, window._pendingQuickAdd);
    document.getElementById('quickAddRecipientModal').classList.remove('active');
  }
}

async function addQuickIdea(recipient, parsed) {
  const idea = {
    id: `i_quick_${Date.now()}`,
    recipientId: recipient.id,
    name: parsed.name,
    category: 'Quick Add',
    price: parsed.price || 0,
    reason: 'Added via Quick-Add',
    query: `https://www.google.com/search?q=${encodeURIComponent(parsed.name)}`,
    url: `https://www.google.com/search?q=${encodeURIComponent(parsed.name)}`,
    status: 'Idea',
    store: parsed.store || null,
    actualPrice: parsed.price || null,
    dateAdded: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
  const res = await apiFetch(`${API}/ideas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(idea)
  });
  if (res.ok) {
    await Promise.all([loadIdeas(), loadStats()]);
    render();
    alert(`Added "${parsed.name}" for ${recipient.name}!`);
  }
}

// --- Product Search ---
async function handleProductSearch() {
  const input = document.getElementById('productSearchInput');
  const query = input.value.trim();
  if (!query) return;

  const res = await apiFetch(`${API}/search`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query })
  });
  const data = await res.json();

  // Show rate limit notice if needed
  if (data.rateLimited) {
    document.getElementById('rateLimitMessage').textContent =
      data.rateMessage || 'API limit reached — showing estimated results.';
    document.getElementById('rateLimitNotice').style.display = 'flex';
  } else {
    document.getElementById('rateLimitNotice').style.display = 'none';
  }

  renderSearchResults(data.results);
  document.getElementById('productSearchModal').classList.add('active');
  input.value = '';
}

function renderSearchResults(results) {
  const container = document.getElementById('searchResults');
  if (!results || results.length === 0) {
    container.innerHTML = '<p class="empty-hint">No results found. Try a different search term.</p>';
    return;
  }

  // Store results so click handlers can access full objects (avoids fragile inline onclick)
  window._searchResults = results;

  container.innerHTML = results.map((r, i) => {
    const p = parsePrice(r.price);
    const priceHtml = p !== null ? `<span class="product-result-price">$${p.toFixed(2)}</span>` :
      (r.price ? `<span class="product-result-price">${escapeHtml(String(r.price))}</span>` : '');
    return `
      <div class="product-result" data-result-index="${i}">
        <div class="product-result-info">
          <div class="product-result-title">${escapeHtml(r.title || 'Product')}</div>
          <div class="product-result-meta">
            <span class="product-result-source">${escapeHtml(r.source || 'Unknown')}</span>
            ${priceHtml}
          </div>
        </div>
        <div class="product-result-action">Add →</div>
      </div>
    `;
  }).join('');

  // Attach click handlers via delegation-safe direct binding
  container.querySelectorAll('.product-result').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.resultIndex, 10);
      const r = (window._searchResults || [])[idx];
      if (r) selectProduct(r.title || '', r.url || '', r.price || 0, r.source || '');
    });
  });
}

async function selectProduct(title, url, price, source) {
  const cleanUrl = url || `https://www.google.com/search?q=${encodeURIComponent(title)}`;
  const numericPrice = parsePrice(price) || 0;

  if (!currentRecipientId) {
    alert('Please choose a recipient first — click "View Gifts" on a recipient card.');
    return;
  }

  try {
    if (currentSearchIdeaId) {
      // Attach product details to the existing idea being edited
      const res = await apiFetch(`${API}/ideas/${currentSearchIdeaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, query: cleanUrl, price: numericPrice, store: source || null })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      currentSearchIdeaId = null;
      showToast(`Added "${title}"`);
    } else {
      // Create a brand-new idea from the product result
      const idea = {
        recipientId: currentRecipientId,
        name: title,
        category: 'Quick Find',
        price: numericPrice,
        reason: `Found via ${source || 'search'}`,
        query: cleanUrl,
        url: cleanUrl,
        status: 'Idea',
        store: source || null,
        actualPrice: numericPrice || null,
        dateAdded: new Date().toISOString().slice(0, 19).replace('T', ' '),
      };
      const res = await apiFetch(`${API}/ideas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(idea)
      });
      if (res.status === 409) {
        // Duplicate gift already exists for this recipient — skip and just open the store
        showToast('Gift already in list — opening store');
        closeSearchModal();
        window.open(cleanUrl, '_blank');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Added "${title}"`);
    }

    // Close modal and refresh data
    closeSearchModal();
    await Promise.all([loadIdeas(), loadStats()]);
    render();

    // Open the store link so the user can buy there
    window.open(cleanUrl, '_blank');
  } catch (err) {
    console.error('selectProduct failed:', err);
    alert(`Could not attach product: ${err.message}`);
  }
}

// Small transient notification
function showToast(message) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// --- Status Filter Pills ---
function setupFilterPills() {
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      filteredStatus = pill.dataset.filter;
      renderCards();
    });
  });
}

// --- Render ---
function render() {
  renderRecipients();
  renderStats();
  renderCards();
  updateFilterPillsFromStats();
  if (document.getElementById('tabRuns')?.classList.contains('active')) {
    renderShoppingRuns();
  }
}

function updateFilterPillsFromStats() {
  const pills = document.querySelectorAll('.pill');
  if (!pills.length) return;
  const hasOrdered = allIdeas.some(i => i.status === 'Ordered');
  const hasArrived = allIdeas.some(i => i.status === 'Arrived');
  for (const p of pills) {
    const f = p.dataset.filter;
    p.style.display = (f === 'Ordered' && !hasOrdered) || (f === 'Arrived' && !hasArrived) ? 'none' : '';
  }
}

function renderRecipients() {
  const grid = document.getElementById('recipientsGrid');
  const count = document.getElementById('recipientCount');
  count.textContent = recipients.length;

  if (!recipients.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <span class="icon">🎁</span>
        <h3>No Recipients Yet</h3>
        <p>Click "Add Recipient" to start building your Christmas list!</p>
      </div>
    `;
    document.getElementById('cardsSection').style.display = 'none';
    return;
  }

  // Group average gift count
  const counts = recipients.map(r => allIdeas.filter(i => i.recipientId === r.id).length);
  const avgCount = counts.reduce((a, b) => a + b, 0) / Math.max(1, recipients.length);

  grid.innerHTML = recipients.map(r => {
    const spent = (stats.byRecipient?.[r.id]?.spent || 0);
    const remaining = Math.max(0, (r.budget || 0) - spent);
    const ideas = allIdeas.filter(i => i.recipientId === r.id);
    const ideaCount = ideas.length;

    let badgeClass = '';
    let badgeText = '';
    if (remaining < 0) { badgeClass = 'warn'; badgeText = '⚠ OVER BUDGET'; }
    else if (remaining < (r.budget || 0) * 0.15) { badgeClass = 'warn'; badgeText = '⚠ Low Budget (<15%)'; }
    else if (ideaCount < avgCount * 0.5) { badgeClass = 'warn'; badgeText = 'Few Gifts'; }

    const cardDisabled = pinLocked ? ' style="filter: blur(8px); pointer-events: none;"' : '';
    const borderColor = remaining < 0 ? '#e74c3c' : 'var(--border)';
    const pointerEvents = pinLocked ? 'none' : 'auto';

    return `
      <div class="recipient-card${cardDisabled}" data-id="${r.id}" style="border-color: ${borderColor}">
        <div class="recipient-header" style="pointer-events: ${pointerEvents}">
          <div class="recipient-info">
            <h3>${escapeHtml(r.name)}</h3>
            <p>${escapeHtml(r.relationship)}${r.age ? ` • Age ${r.age}` : ''}</p>
          </div>
          <div class="recipient-budget">
            <div class="budget-value">$${remaining.toFixed(2)}</div>
            <div class="budget-label">of $${(r.budget || 0).toFixed(2)}</div>
          </div>
        </div>
        ${badgeClass ? `<span class="recipient-badge ${badgeClass}">${badgeText}</span>` : ''}
        <div class="tags">
          ${(r.interests || []).map(i => `<span class="tag">${escapeHtml(i)}</span>`).join('')}
          ${(r.dislikes || []).map(d => `<span class="tag tag-warning">⚠ ${escapeHtml(d)}</span>`).join('')}
          ${(r.allergies || []).map(a => `<span class="tag tag-danger">⛔ ${escapeHtml(a)}</span>`).join('')}
        </div>
        <div class="recipient-actions" style="pointer-events: ${pointerEvents}">
          <button class="btn btn-small" onclick="generateIdeas('${r.id}')">Generate</button>
          <button class="btn btn-small btn-primary" onclick="viewCards('${r.id}')">View Gifts</button>
          <button class="btn btn-small" onclick="openEditRecipientModal('${r.id}')">Edit</button>
          <button class="btn btn-small btn-danger" onclick="deleteRecipient('${r.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderStats() {
  document.getElementById('totalSpend').textContent = '$' + (stats.totalSpend || 0).toFixed(2);
  document.getElementById('totalBudget').textContent = '$' + (stats.totalBudget || 0).toFixed(2);
  document.getElementById('remainingBudget').textContent = '$' + (stats.remaining || 0).toFixed(2);
  document.getElementById('recipientsCount').textContent = recipients.length;
  document.getElementById('totalSpend').className = 'stat-value ' + ((stats.totalSpend || 0) > 0 ? 'danger' : 'accent');
  document.getElementById('totalBudget').className = 'stat-value accent';
  document.getElementById('remainingBudget').className = 'stat-value ' + ((stats.remaining || 0) < 0 ? 'danger' : 'accent');
}

function renderCards() {
  const section = document.getElementById('cardsSection');
  const grid = document.getElementById('cardsGrid');

  if (!currentRecipientId) { section.style.display = 'none'; return; }
  const recipient = recipients.find(r => r.id === currentRecipientId);
  if (!recipient) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  section.querySelector('h2').innerHTML = `Gifts for ${escapeHtml(recipient.name)} <span class="icon">🎁</span>`;

  const ideas = filteredStatus === 'All' ? allIdeas : allIdeas.filter(i => i.status === filteredStatus);
  const recipientIdeas = ideas.filter(i => i.recipientId === currentRecipientId);

  if (!recipientIdeas?.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="icon">🎁</span>
        <h3>No Gift Ideas Yet</h3>
        <p>Click "Generate" on the recipient card to get personalized suggestions</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = recipientIdeas.map(i => {
    const statusClass = i.status.toLowerCase();
    const fieldsHtml = `
      <div class="idea-fields">
        <div class="idea-field idea-field-name">
          <label>Gift Name</label>
          <input type="text" value="${escapeHtml(i.name)}" onchange="updateIdeaName(this, '${i.id}')">
        </div>
        ${i.store ? `
        <div class="idea-field">
          <label>Store</label>
          <input type="text" value="${escapeHtml(i.store || '')}" onchange="updateIdeaStore(this, '${i.id}')">
        </div>
        ` : ''}
        <div class="idea-field">
          <label>Price Paid</label>
          <input type="number" step="0.01" value="${(i.actualPrice || i.price || 0).toFixed(2)}" onchange="updateIdeaPrice(this, '${i.id}')">
        </div>
      </div>`;

    return `
      <div class="idea-card" data-idea-id="${i.id}" data-status="${i.status}">
        <div class="idea-card-top">
          <div>
            <h3 class="idea-title">${escapeHtml(i.name)}</h3>
            <p class="idea-recipient">for ${escapeHtml(recipient.name)}</p>
          </div>
          <span class="idea-status idea-${statusClass}">${i.status}</span>
        </div>
        <div class="idea-price-row">
          <div class="idea-price">$${((i.status !== 'Idea' && i.actualPrice != null ? i.actualPrice : i.price) || 0).toFixed(2)}</div>
          <span class="idea-category">${escapeHtml(i.category || 'Other')}</span>
        </div>
        <p class="idea-reason">${escapeHtml(i.reason || 'A thoughtful gift idea tailored to their interests.')}</p>
        ${fieldsHtml}
        <div class="idea-actions">
          ${i.status === 'Idea' ? `
            <button class="btn btn-primary" onclick="updateIdeaStatus('${i.id}')">Mark Ordered</button>
            <button class="btn" onclick="openProductPicker('${i.id}')">Find Products</button>
            <button class="btn btn-danger" onclick="deleteIdea('${i.id}')">Delete</button>
          ` : i.status === 'Ordered' ? `
            <button class="btn btn-primary" onclick="updateIdeaStatus('${i.id}')" style="background: var(--warning); border-color: var(--warning);">Mark Arrived</button>
            <button class="btn" onclick="openProductPicker('${i.id}')">Find Products</button>
            <button class="btn" onclick="resetIdeaStatus('${i.id}')">Reset</button>
            <button class="btn btn-danger" onclick="deleteIdea('${i.id}')">Delete</button>
          ` : i.status === 'Arrived' ? `
            <button class="btn btn-primary" onclick="updateIdeaStatus('${i.id}')" style="background: var(--accent); border-color: var(--accent);">Mark Wrapped</button>
            <button class="btn" onclick="openProductPicker('${i.id}')">Find Products</button>
            <button class="btn" onclick="resetIdeaStatus('${i.id}')">Reset</button>
            <button class="btn btn-danger" onclick="deleteIdea('${i.id}')">Delete</button>
          ` : i.status === 'Wrapped' ? `
            <button class="btn" onclick="resetIdeaStatus('${i.id}')">Reset</button>
            <button class="btn btn-danger" onclick="deleteIdea('${i.id}')">Delete</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// --- Idea Actions ---
async function generateIdeas(recipientId) {
  const recipient = recipients.find(r => r.id === recipientId);
  if (!recipient) return;
  try {
    const res = await apiFetch(`${API}/recipients/${recipientId}/ideas`);
    const data = await res.json();
    if (data.ideas?.length) {
      for (const idea of data.ideas) { await addIdeaFromServer(idea); }
      await Promise.all([loadIdeas(), loadStats()]);
      render();
    }
  } catch (err) { console.error(err); }
}

async function addIdeaFromServer(idea) {
  return apiFetch(`${API}/ideas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(idea)
  }).then(res => res.json());
}

async function updateIdeaStatus(ideaId) {
  const idea = allIdeas.find(i => i.id === ideaId);
  if (!idea) return;
  const next = idea.status === 'Idea' ? 'Ordered' : idea.status === 'Ordered' ? 'Arrived' : idea.status === 'Arrived' ? 'Wrapped' : null;
  if (!next) return;
  const payload = { status: next };
  // When marking Ordered, sync actualPrice to the estimated price if not already set
  if (next === 'Ordered' && (!idea.actualPrice || idea.actualPrice === 0)) {
    payload.actualPrice = idea.price || 0;
  }
  await apiFetch(`${API}/ideas/${ideaId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  await Promise.all([loadIdeas(), loadStats()]);
  render();
}

async function resetIdeaStatus(ideaId) {
  if (!confirm('Reset this gift back to "Idea" status?')) return;
  await apiFetch(`${API}/ideas/${ideaId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Idea' })
  });
  await Promise.all([loadIdeas(), loadStats()]);
  render();
}

async function deleteIdea(ideaId) {
  if (!confirm('Delete this gift idea permanently?')) return;
  await apiFetch(`${API}/ideas/${ideaId}`, {
    method: 'DELETE'
  });
  await Promise.all([loadIdeas(), loadStats()]);
  render();
}

async function updateIdeaStore(input, ideaId) {
  await apiFetch(`${API}/ideas/${ideaId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store: input.value })
  });
  await loadIdeas();
}

async function updateIdeaName(input, ideaId) {
  const name = (input.value || '').trim();
  if (!name) return;
  const res = await apiFetch(`${API}/ideas/${ideaId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
  });
  if (res.ok) {
    await Promise.all([loadIdeas(), loadStats()]);
    render();
  }
}

async function updateIdeaPrice(input, ideaId) {
  const price = parseFloat(input.value) || 0;
  await apiFetch(`${API}/ideas/${ideaId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actualPrice: price })
  });
  await Promise.all([loadIdeas(), loadStats()]);
  render();
}

function openProductPicker(ideaId) {
  // Prefill the search input with the idea's name
  const idea = allIdeas.find(i => i.id === ideaId);
  const searchInput = document.getElementById('productSearchInput');
  if (idea) searchInput.value = idea.name || '';
  currentRecipientId = allIdeas.find(i => i.id === ideaId)?.recipientId || currentRecipientId;
  currentSearchIdeaId = ideaId; // keep for "attach to existing idea" path
  document.getElementById('productSearchModal').classList.add('active');
  searchInput.focus();
}

function deleteRecipient(id) {
  if (!confirm('Delete this recipient and all their gift ideas?')) return;
  apiFetch(`${API}/recipients/${id}`, { method: 'DELETE' })
    .then(() => Promise.all([loadRecipients(), loadStats(), loadIdeas()]))
    .then(render);
}

// --- Shopping Runs Tab ---
function renderShoppingRuns() {
  const ideas = allIdeas.filter(i => i.status === 'Idea');

  // Group by store
  const grouped = {};
  for (const i of ideas) {
    const store = i.store || 'Unassigned';
    if (!grouped[store]) grouped[store] = [];
    grouped[store].push(i);
  }

  // Classify: known online retailers
  const onlineStores = new Set(['Amazon', 'Etsy', 'Best Buy', 'Walmart']);
  const instoreStores = new Set(['Target', 'Kohl', 'Macy\'s', 'Nordstrom', 'Sephora', 'Apple', 'Microsoft', 'GameStop', 'Barnes', 'Home Depot', 'Lowes', 'IKEA', 'Wayfair']);

  const onlineHTML = [];
  const instoreHTML = [];

  for (const [store, items] of Object.entries(grouped)) {
    const isOnline = onlineStores.has(store) || (store === 'Unassigned');
    const target = isOnline ? onlineHTML : instoreHTML;
    const total = items.reduce((s, i) => s + (i.price || 0), 0);

    target.push(`
      <div class="run-group">
        <div class="run-group-header">
          <span class="run-group-title">${escapeHtml(store)}</span>
          <span class="run-group-total">$${total.toFixed(2)} <span class="run-group-count">(${items.length} items)</span></span>
        </div>
        ${items.map(i => {
          const r = recipients.find(r => r.id === i.recipientId);
          return `
            <div class="run-item">
              <div class="run-item-info">
                <div class="run-item-name">${escapeHtml(i.name)}</div>
                <div class="run-item-meta">
                  <span class="run-item-recipient">${escapeHtml(r?.name || '?')}</span>
                  <span>$${(i.price || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `);
  }

  document.getElementById('onlineRunsList').innerHTML = onlineHTML.join('') || '<div class="run-empty">No online orders needed</div>';
  document.getElementById('instoreRunsList').innerHTML = instoreHTML.join('') || '<div class="run-empty">No in-store runs needed</div>';
}

// --- Export ---
function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function parsePrice(value) {
  // Handles "$49.99", "49.99", "US$49.99", "€29,99", "£15.00", "$10 - $40", ranges, etc.
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && isFinite(value)) return value;
  const s = String(value).trim();
  if (!s) return null;

  // Try to extract the first number found, handling thousands separators
  // Examples: "$1,299.00" -> 1299, "49.99" -> 49.99, "€1.299,00" (EU style) -> 1299
  const cleaned = s
    .replace(/[€£¥$]/g, '')
    .replace(/\s/g, '');

  // Try US style: 1,234.56
  let m = cleaned.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
  if (m) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(n)) return n;
  }

  // Try EU style: 1.234,56
  m = cleaned.match(/(\d{1,3}(?:\.\d{3})*,\d{1,2})/);
  if (m) {
    const n = parseFloat(m[1].replace(/\./g, '').replace(/,/g, '.'));
    if (!isNaN(n)) return n;
  }

  // Try plain decimal: 49.99
  m = cleaned.match(/(\d+\.\d{1,2})/);
  if (m) {
    const n = parseFloat(m[1]);
    if (!isNaN(n)) return n;
  }

  // Try plain integer
  m = cleaned.match(/(\d+)/);
  if (m) {
    const n = parseFloat(m[1]);
    if (!isNaN(n)) return n;
  }

  return null;
}

// --- Utility ---
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose for onclick handlers
window.generateIdeas = generateIdeas;
window.viewCards = viewCards;
window.deleteRecipient = deleteRecipient;
window.updateIdeaStatus = updateIdeaStatus;
window.updateIdeaName = updateIdeaName;
window.updateIdeaStore = updateIdeaStore;
window.updateIdeaPrice = updateIdeaPrice;
window.openProductPicker = openProductPicker;
window.selectProduct = selectProduct;
window.confirmQuickAdd = confirmQuickAdd;
window.openEditRecipientModal = openEditRecipientModal;
window.closeEditRecipientModal = closeEditRecipientModal;
window.handleEditRecipient = handleEditRecipient;
window.resetIdeaStatus = resetIdeaStatus;
window.deleteIdea = deleteIdea;

function viewCards(recipientId) {
  currentRecipientId = recipientId;
  render();
  document.getElementById('cardsSection').scrollIntoView({ behavior: 'smooth' });
}

// Initialize filter pills
document.addEventListener('DOMContentLoaded', setupFilterPills);