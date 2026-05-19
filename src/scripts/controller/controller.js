// AOTU — controller.js
// Touch UI: legge i tag REALI da WordPress/MySQL via REST API e invia comandi agli schermi via WebSocket.

const API_BASE = (window.__AOTU_WP_API_URL || 'https://thearchiveoftheuntamed.xyz/wp/wp-json').replace(/\/$/, '');
const WS_URL = window.__AOTU_WS_URL || 'ws://localhost:8787';

const els = {
  connection: document.getElementById('connectionState'),
  targetGrid: document.getElementById('targetGrid'),
  tagCloud: document.getElementById('tagCloud'),
  tagSearch: document.getElementById('tagSearch'),
  reloadTags: document.getElementById('reloadTags'),
  cmdRandom: document.getElementById('cmdRandom'),
  cmdBlackout: document.getElementById('cmdBlackout'),
  cmdWake: document.getElementById('cmdWake'),
  cmdPulse: document.getElementById('cmdPulse'),
  logBox: document.getElementById('logBox'),
};

const STATE = {
  ws: null,
  target: 'all',
  tags: [],
  reconnectTimer: null,
};

const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

function log(line, data = null) {
  const now = new Date().toLocaleTimeString('it-IT');
  const payload = data ? `\n${JSON.stringify(data, null, 2)}` : '';
  els.logBox.textContent = `[${now}] ${line}${payload}\n\n${els.logBox.textContent}`.slice(0, 4000);
}

function setConnection(status) {
  els.connection.textContent = status;
  els.connection.dataset.status = status;
}

function connectWS() {
  clearTimeout(STATE.reconnectTimer);
  setConnection('connecting');

  const ws = new WebSocket(WS_URL);
  STATE.ws = ws;

  ws.addEventListener('open', () => {
    setConnection('online');
    send({ type: 'HELLO', role: 'controller' }, false);
    log('controller connected');
  });

  ws.addEventListener('close', () => {
    setConnection('offline');
    STATE.reconnectTimer = setTimeout(connectWS, 1200);
  });

  ws.addEventListener('error', () => {
    setConnection('error');
  });

  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'CLIENTS') log('connected clients', msg.clients);
    } catch {}
  });
}

function send(command, shouldLog = true) {
  const payload = {
    ...command,
    target: command.target || STATE.target,
    sentAt: Date.now(),
  };

  if (!STATE.ws || STATE.ws.readyState !== WebSocket.OPEN) {
    log('websocket not ready', payload);
    return;
  }

  STATE.ws.send(JSON.stringify(payload));
  if (shouldLog) log(`sent ${payload.type} → ${payload.target}`, payload);
}

async function loadTags() {
  els.tagCloud.innerHTML = '<span class="muted">loading tags…</span>';

  try {
    const url = `${API_BASE}/wp/v2/tags?per_page=100&_fields=id,name,slug,count`;
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const tags = await res.json();
    STATE.tags = Array.isArray(tags)
      ? tags.sort((a, b) => (b.count || 0) - (a.count || 0))
      : [];

    renderTags();
    log(`loaded ${STATE.tags.length} database tags`);
  } catch (err) {
    console.error(err);
    els.tagCloud.innerHTML = '<span class="muted">no tags / API error</span>';
    log('error loading tags', { error: String(err), api: API_BASE });
  }
}

function renderTags() {
  const q = (els.tagSearch.value || '').trim().toLowerCase();
  const tags = q
    ? STATE.tags.filter(t => `${t.name} ${t.slug}`.toLowerCase().includes(q))
    : STATE.tags;

  if (!tags.length) {
    els.tagCloud.innerHTML = '<span class="muted">no matching tags</span>';
    return;
  }

  els.tagCloud.innerHTML = tags.map(tag => `
    <button class="tag-pill" data-tag-id="${tag.id}" data-tag-name="${escapeHtml(tag.name)}" data-tag-slug="${escapeHtml(tag.slug)}">
      #${escapeHtml(tag.name)} <small>${tag.count || 0}</small>
    </button>
  `).join('');
}

els.targetGrid?.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-target]');
  if (!btn) return;
  STATE.target = btn.dataset.target;
  els.targetGrid.querySelectorAll('.target').forEach(el => el.classList.toggle('is-active', el === btn));
  log(`target selected: ${STATE.target}`);
});

els.tagCloud?.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-tag-id]');
  if (!btn) return;

  send({
    type: 'FILTER_TAG',
    tagId: Number(btn.dataset.tagId),
    tagName: btn.dataset.tagName,
    tagSlug: btn.dataset.tagSlug,
  });
});

els.tagSearch?.addEventListener('input', renderTags);
els.reloadTags?.addEventListener('click', loadTags);

els.cmdRandom?.addEventListener('click', () => send({ type: 'RANDOM_ARCHIVE' }));
els.cmdBlackout?.addEventListener('click', () => send({ type: 'BLACKOUT' }));
els.cmdWake?.addEventListener('click', () => send({ type: 'WAKE' }));
els.cmdPulse?.addEventListener('click', () => send({ type: 'PULSE' }));

connectWS();
loadTags();

window.AOTU_CONTROLLER = { STATE, send, loadTags };
