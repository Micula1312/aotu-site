// AOTU — controller.js
// Touch UI: legge tag reali da WordPress/MySQL via REST API e invia comandi agli schermi via WebSocket.

const RAW_API_BASE = (window.__AOTU_WP_API_URL || '/wp-json').replace(/\/$/, '');

const API_BASE = RAW_API_BASE.endsWith('/wp-json')
  ? RAW_API_BASE
  : `${RAW_API_BASE}/wp-json`;

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

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));

function log(line, data = null) {
  if (!els.logBox) return;
  const now = new Date().toLocaleTimeString('it-IT');
  const payload = data ? `\n${JSON.stringify(data, null, 2)}` : '';
  els.logBox.textContent = `[${now}] ${line}${payload}\n\n${els.logBox.textContent}`.slice(0, 4000);
}

function setConnection(status) {
  if (!els.connection) return;
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
  if (!els.tagCloud) return;

  els.tagCloud.innerHTML = '<span class="muted">loading tags…</span>';

  try {
    const tagsUrl = `${API_BASE}/wp/v2/tags?per_page=100&_fields=id,name,slug,count`;
    console.log('[controller] tags url=', tagsUrl);

    const tagRes = await fetch(tagsUrl, { mode: 'cors' });
    let tags = tagRes.ok ? await tagRes.json() : [];
    tags = Array.isArray(tags) ? tags : [];



    // Fallback: se /tags torna vuoto, ricava i tag dai media embedded come archive.js
    if (!tags.length) {
      const mediaUrl = `${API_BASE}/wp/v2/media?per_page=100&_embed=1&_fields=id,_embedded,tags`;
      console.log('[controller] media fallback url=', mediaUrl);

      const mediaRes = await fetch(mediaUrl, { mode: 'cors' });
      if (!mediaRes.ok) throw new Error(`HTTP media ${mediaRes.status}`);

      const media = await mediaRes.json();
      const map = new Map();

      media.forEach(item => {
        const terms = item._embedded?.['wp:term'] || [];

        terms.flat().forEach(term => {
          if (term.taxonomy !== 'post_tag') return;

          const id = Number(term.id);
          const existing = map.get(id);

          map.set(id, {
            id,
            name: term.name,
            slug: term.slug || '',
            count: existing ? existing.count + 1 : 1,
          });
        });
      });

      tags = [...map.values()];
    }

    STATE.tags = tags
      .filter(t => t.name)
      .sort((a, b) => (b.count || 0) - (a.count || 0));

    console.log('[controller] loaded tags=', STATE.tags);

    renderTags();
    log(`loaded ${STATE.tags.length} database tags`);
  } catch (err) {
    console.error('[controller] tag error', err);
    els.tagCloud.innerHTML = '<span class="muted">no tags / API error</span>';
    log('error loading tags', { error: String(err), api: API_BASE });
  }
}

function renderTags(search = '') {
  if (!els.tagCloud) return;

  const query = String(search || '').toLowerCase();

  const filtered = STATE.tags.filter(t =>
    !query ||
    t.name.toLowerCase().includes(query) ||
    (t.slug || '').toLowerCase().includes(query)
  );

  const topTags = [...filtered]
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 10);

  const otherTags = filtered
    .filter(t => !topTags.some(top => top.id === t.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  els.tagCloud.innerHTML = `
    <div class="tag-section">
      <h3>TOP 10 DATABASE TAGS</h3>
      <div class="tag-list">
        ${topTags.map(tagButton).join('')}
      </div>
    </div>

    <div class="tag-section">
      <h3>ALL TAGS</h3>
      <div class="tag-list">
        ${otherTags.map(tagButton).join('')}
      </div>
    </div>
  `;
}

function tagButton(tag) {
  const count = Number(tag.count || 0);
  const countLabel = count > 0 ? `<span>${count}</span>` : '';

  return `
    <button
      class="tag-pill"
      data-tag-id="${tag.id}"
      data-tag-name="${escapeHtml(tag.name)}"
      data-tag-slug="${escapeHtml(tag.slug || '')}"
    >
      #${escapeHtml(tag.name)}
      ${countLabel}
    </button>
  `;
}

els.targetGrid?.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-target]');
  if (!btn) return;

  STATE.target = btn.dataset.target;

  els.targetGrid
    .querySelectorAll('.target')
    .forEach(el => el.classList.toggle('is-active', el === btn));

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

els.tagSearch?.addEventListener('input', (event) => {
  renderTags(event.target.value);
});

els.reloadTags?.addEventListener('click', loadTags);

els.cmdRandom?.addEventListener('click', () => send({ type: 'RANDOM_ARCHIVE' }));
els.cmdBlackout?.addEventListener('click', () => send({ type: 'BLACKOUT' }));
els.cmdWake?.addEventListener('click', () => send({ type: 'WAKE' }));
els.cmdPulse?.addEventListener('click', () => send({ type: 'PULSE' }));

console.log('[controller] API_BASE=', API_BASE);

connectWS();
loadTags();

window.AOTU_CONTROLLER = { STATE, send, loadTags };