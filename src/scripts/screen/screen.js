// AOTU — screen.js
// Client fullscreen: riceve comandi WebSocket e mostra media WP filtrati per tag.

const RAW_API_BASE = (window.__AOTU_WP_API_URL || 'https://thearchiveoftheuntamed.xyz/wp').replace(/\/$/, '');

const API_BASE = RAW_API_BASE.endsWith('/wp-json')
  ? RAW_API_BASE
  : `${RAW_API_BASE}/wp-json`;

const WS_URL = window.__AOTU_WS_URL || 'ws://localhost:8787';

const params = new URLSearchParams(window.location.search);
const SCREEN_ID = params.get('id') || 'screen-1';

const els = {
  screenId: document.getElementById('screenId'),
  status: document.getElementById('screenStatus'),
  mediaLayer: document.getElementById('mediaLayer'),
  veil: document.getElementById('veil'),
  tagLabel: document.getElementById('tagLabel'),
  stage: document.getElementById('stage'),
};

const STATE = {
  ws: null,
  items: [],
  index: 0,
  timer: null,
  reconnectTimer: null,
};

if (els.screenId) els.screenId.textContent = SCREEN_ID.toUpperCase();

function setStatus(status) {
  if (!els.status) return;
  els.status.textContent = status;
}

function shouldHandle(msg) {
  return msg.target === 'all' || msg.target === SCREEN_ID;
}

function connectWS() {
  clearTimeout(STATE.reconnectTimer);
  setStatus('connecting');

  const ws = new WebSocket(WS_URL);
  STATE.ws = ws;

  ws.addEventListener('open', () => {
    setStatus('online');

    ws.send(JSON.stringify({
      type: 'HELLO',
      role: 'screen',
      screenId: SCREEN_ID,
      sentAt: Date.now(),
    }));
  });

  ws.addEventListener('close', () => {
    setStatus('offline');
    STATE.reconnectTimer = setTimeout(connectWS, 1200);
  });

  ws.addEventListener('error', () => {
    setStatus('error');
  });

  ws.addEventListener('message', async (event) => {
    let msg;

    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!shouldHandle(msg)) return;

    if (msg.type === 'FILTER_TAG') {
      if (els.tagLabel) els.tagLabel.textContent = `#${msg.tagName || msg.tagSlug || msg.tagId}`;
      const items = await fetchMedia({ tagId: msg.tagId });
      startPlaylist(items);
    }

    if (msg.type === 'RANDOM_ARCHIVE') {
      if (els.tagLabel) els.tagLabel.textContent = 'RANDOM ARCHIVE';
      const items = await fetchMedia();
      startPlaylist(items);
    }

    if (msg.type === 'BLACKOUT') {
      blackout();
    }

    if (msg.type === 'WAKE') {
      wake();
    }

    if (msg.type === 'PULSE') {
      pulse();
    }
  });
}

async function fetchMedia({ tagId = null } = {}) {
  const url = new URL(`${API_BASE}/wp/v2/media`, window.location.origin);

  url.searchParams.set('per_page', '100');
  url.searchParams.set('orderby', 'date');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('_embed', '1');
  url.searchParams.set(
    '_fields',
    'id,date,mime_type,media_type,source_url,title,alt_text,caption,media_details,tags,_embedded'
  );

  if (tagId) {
    url.searchParams.set('tags', String(tagId));
  }

  console.log('[screen] media url=', url.toString());

  try {
    const res = await fetch(url.toString(), { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    return Array.isArray(data)
      ? data.filter(item => {
          const mt = (item.mime_type || '').toLowerCase();
          return mt.startsWith('image/') || mt.startsWith('video/');
        })
      : [];
  } catch (err) {
    console.error('[screen] media fetch error', err);
    return [];
  }
}

function startPlaylist(items = []) {
  clearInterval(STATE.timer);

  STATE.items = shuffle(items);
  console.log('[screen] playlist items=', STATE.items.length, STATE.items);
  STATE.index = 0;

  if (!STATE.items.length) {
    showNoMedia();
    return;
  }

  showCurrent();

  STATE.timer = setInterval(() => {
    STATE.index = (STATE.index + 1) % STATE.items.length;
    showCurrent();
  }, 7000);
}

function showCurrent() {
  const item = STATE.items[STATE.index];
  if (!item) {
    showNoMedia();
    return;
  }

  showMedia(item);
}

function showMedia(item) {
  if (!els.mediaLayer) return;

  const mime = (item.mime_type || '').toLowerCase();
  const title = item.title?.rendered || 'Untitled';

  console.log('[screen] showing', {
  mime,
  title,
  src: item.source_url,
  img: getImageUrl(item)
});

  els.mediaLayer.innerHTML = '';
  els.mediaLayer.classList.remove('is-ready');

  if (mime.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = getImageUrl(item);
    img.alt = stripHtml(title);
    img.className = 'screen-media is-image';
    els.mediaLayer.appendChild(img);
  }

  if (mime.startsWith('video/')) {
    const video = document.createElement('video');
    video.src = toProxyUrl(item.source_url);
    video.className = 'screen-media is-video';
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    els.mediaLayer.appendChild(video);
    video.play().catch(() => {});
  }
    requestAnimationFrame(() => {
    els.mediaLayer.classList.add('is-ready');
  });
}

function getImageUrl(item) {
  const sizes = item.media_details?.sizes;

  const src =
    sizes?.large?.source_url ||
    sizes?.medium_large?.source_url ||
    sizes?.medium?.source_url ||
    sizes?.full?.source_url ||
    item.source_url;

  return toProxyUrl(src);
}

function toProxyUrl(src = '') {
  try {
    const u = new URL(src);
    return u.pathname;
  } catch {
    return src;
  }
}

function showNoMedia() {
  if (!els.mediaLayer) return;
  els.mediaLayer.innerHTML = '<div class="no-media">NO MEDIA</div>';
}

function blackout() {
  clearInterval(STATE.timer);
  if (els.mediaLayer) els.mediaLayer.innerHTML = '';
  if (els.tagLabel) els.tagLabel.textContent = 'BLACKOUT';
  document.body.classList.add('is-blackout');
}

function wake() {
  document.body.classList.remove('is-blackout');
  if (els.tagLabel) els.tagLabel.textContent = 'THE ARCHIVE IS ALIVE';
}

function pulse() {
  document.body.classList.remove('is-pulsing');
  void document.body.offsetWidth;
  document.body.classList.add('is-pulsing');
}

function shuffle(arr = []) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function stripHtml(html = '') {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

console.log('[screen] API_BASE=', API_BASE);
console.log('[screen] SCREEN_ID=', SCREEN_ID);

connectWS();

// Prima accensione: pesca subito qualcosa dalla media library.
fetchMedia().then(startPlaylist);

window.AOTU_SCREEN = { STATE, fetchMedia, startPlaylist };