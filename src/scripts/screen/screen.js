// AOTU — screen.js
// Client fullscreen: riceve comandi dal controller e carica media WordPress filtrati per tag reale.

const API_BASE = (window.__AOTU_WP_API_URL || 'https://thearchiveoftheuntamed.xyz/wp/wp-json').replace(/\/$/, '');
const WS_URL = window.__AOTU_WS_URL || 'ws://localhost:8787';

const params = new URLSearchParams(location.search);
const SCREEN_ID = params.get('id') || params.get('screen') || `screen-${Math.floor(Math.random() * 999)}`;

const els = {
  stage: document.getElementById('stage'),
  mediaLayer: document.getElementById('mediaLayer'),
  veil: document.getElementById('veil'),
  tagLabel: document.getElementById('tagLabel'),
  screenId: document.getElementById('screenId'),
  screenStatus: document.getElementById('screenStatus'),
};

const STATE = {
  ws: null,
  items: [],
  index: 0,
  timer: null,
  dwell: Number(params.get('dwell') || 7000),
  reconnectTimer: null,
};

els.screenId.textContent = SCREEN_ID;

function setStatus(status) {
  els.screenStatus.textContent = status;
  els.screenStatus.dataset.status = status;
}

function connectWS() {
  clearTimeout(STATE.reconnectTimer);
  setStatus('connecting');

  const ws = new WebSocket(WS_URL);
  STATE.ws = ws;

  ws.addEventListener('open', () => {
    setStatus('online');
    ws.send(JSON.stringify({ type: 'HELLO', role: 'screen', screenId: SCREEN_ID, sentAt: Date.now() }));
  });

  ws.addEventListener('close', () => {
    setStatus('offline');
    STATE.reconnectTimer = setTimeout(connectWS, 1200);
  });

  ws.addEventListener('error', () => setStatus('error'));

  ws.addEventListener('message', async (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (!isForMe(msg)) return;
    await handleCommand(msg);
  });
}

function isForMe(msg) {
  return msg.target === 'all' || msg.target === SCREEN_ID;
}

async function handleCommand(msg) {
  if (msg.type === 'FILTER_TAG') {
    els.tagLabel.textContent = `#${msg.tagName || msg.tagSlug || msg.tagId}`;
    await loadMedia({ tagId: msg.tagId });
    startLoop();
  }

  if (msg.type === 'RANDOM_ARCHIVE') {
    els.tagLabel.textContent = 'RANDOM ARCHIVE';
    await loadMedia({ random: true });
    startLoop({ shuffle: true });
  }

  if (msg.type === 'BLACKOUT') {
    blackout(true);
  }

  if (msg.type === 'WAKE') {
    blackout(false);
  }

  if (msg.type === 'PULSE') {
    els.stage.classList.remove('is-pulsing');
    void els.stage.offsetWidth;
    els.stage.classList.add('is-pulsing');
  }
}

function blackout(on) {
  els.stage.classList.toggle('is-blackout', on);
}

async function loadMedia({ tagId = null, random = false } = {}) {
  const url = new URL(`${API_BASE}/wp/v2/media`);
  url.searchParams.set('per_page', '100');
  url.searchParams.set('_fields', 'id,date,mime_type,media_type,source_url,title,media_details,tags');
  url.searchParams.set('orderby', 'date');
  url.searchParams.set('order', 'desc');

  if (tagId) url.searchParams.set('tags', String(tagId));

  const res = await fetch(url.toString(), { mode: 'cors' });
  if (!res.ok) throw new Error(`media HTTP ${res.status}`);

  const data = await res.json();
  STATE.items = Array.isArray(data)
    ? data.filter(item => {
        const mt = (item.mime_type || '').toLowerCase();
        return mt.startsWith('image/') || mt.startsWith('video/') || mt.startsWith('audio/');
      })
    : [];

  if (random) shuffle(STATE.items);
  STATE.index = 0;
}

function startLoop({ shuffle: doShuffle = false } = {}) {
  clearInterval(STATE.timer);
  if (!STATE.items.length) {
    renderEmpty();
    return;
  }

  if (doShuffle) shuffle(STATE.items);
  renderCurrent();
  STATE.timer = setInterval(next, STATE.dwell);
}

function next() {
  if (!STATE.items.length) return;
  STATE.index = (STATE.index + 1) % STATE.items.length;
  renderCurrent();
}

function renderCurrent() {
  const item = STATE.items[STATE.index];
  if (!item) return renderEmpty();

  const type = mapType(item);
  const title = item.title?.rendered?.replace(/<[^>]*>/g, '') || 'Untitled';

  els.mediaLayer.innerHTML = '';
  els.mediaLayer.classList.remove('is-ready');

  let node;

  if (type === 'image') {
    node = new Image();
    node.src = item.source_url;
    node.alt = title;
    node.onload = () => els.mediaLayer.classList.add('is-ready');
  }

  if (type === 'video') {
    node = document.createElement('video');
    node.src = item.source_url;
    node.autoplay = true;
    node.muted = true;
    node.loop = true;
    node.playsInline = true;
    node.addEventListener('loadeddata', () => els.mediaLayer.classList.add('is-ready'), { once: true });
  }

  if (type === 'audio') {
    node = document.createElement('div');
    node.className = 'audio-object';
    node.innerHTML = `<div class="audio-title">${escapeHtml(title)}</div><audio src="${item.source_url}" autoplay loop></audio>`;
    setTimeout(() => els.mediaLayer.classList.add('is-ready'), 50);
  }

  if (!node) return renderEmpty();
  els.mediaLayer.appendChild(node);
}

function renderEmpty() {
  els.mediaLayer.innerHTML = '<div class="empty">NO MEDIA</div>';
  els.mediaLayer.classList.add('is-ready');
}

function mapType(item) {
  const mt = (item.mime_type || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  if (mt.startsWith('audio/')) return 'audio';
  return 'doc';
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

connectWS();

// Stato iniziale: carica random, così ogni schermo vive anche prima del primo comando.
loadMedia({ random: true }).then(() => startLoop({ shuffle: true })).catch(() => renderEmpty());

window.AOTU_SCREEN = { SCREEN_ID, STATE, loadMedia, startLoop };
