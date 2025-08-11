// AOTU Archive — cards + lightbox, con preview per image/video/audio
// Dev/Prod safe: in dev usa proxy Astro (/wp-json, /wp), in prod usa il dominio.

// ---------- UI refs ----------
const grid = document.getElementById('grid');
const state = document.getElementById('state');
const typeFilter = document.getElementById('type');
const searchInput = document.getElementById('q');
const refreshBtn = document.getElementById('refresh');
const lb = document.getElementById('lb');
const lbMedia = document.getElementById('lbMedia');
const lbTitle = document.getElementById('lbTitle');
const lbInfo = document.getElementById('lbInfo');
const lbTags = document.getElementById('lbTags');
const lbNotes = document.getElementById('lbNotes');

if (!grid || !state) {
  console.warn('[archive] Missing required elements (#grid, #state).');
}

// ---------- WP endpoint auto-detect ----------
const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const WP_ROOT = isDev ? '' : 'https://thearchiveoftheuntamed.xyz';
let WP_API_URL = null;

async function detectWpApiUrl() {
  const tryUrl = async (u) => {
    try { const r = await fetch(u); return r.ok; } catch { return false; }
  };
  const sub = `${WP_ROOT}/wp/wp-json/`;
  const root = `${WP_ROOT}/wp-json/`;
  WP_API_URL = (await tryUrl(sub)) ? `${WP_ROOT}/wp/wp-json/wp/v2/media`
                                   : `${WP_ROOT}/wp-json/wp/v2/media`;
}

async function ensureApiResolved() {
  if (!WP_API_URL) await detectWpApiUrl();
}

// ---------- Data ----------
let CACHE = [];

async function fetchArchive() {
  if (state) { state.hidden = false; state.textContent = 'Loading…'; }
  if (grid) grid.hidden = true;

  try {
    await ensureApiResolved();
    const url = new URL(WP_API_URL, location.origin);
    url.searchParams.set('per_page', '50');
    url.searchParams.set('_fields', 'id,date,mime_type,media_type,source_url,title,alt_text,caption,media_details');

    const q = (searchInput?.value || '').trim();
    if (q) url.searchParams.set('search', q);

    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    CACHE = Array.isArray(data) ? data : [];
    renderArchive();
  } catch (err) {
    console.error(err);
    if (state) state.textContent = 'Error loading archive (check CORS & API).';
  }
}

function mapType(item) {
  const mt = (item.mime_type || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  if (mt.startsWith('audio/')) return 'audio';
  return 'doc';
}

function thumb(item) {
  const s = item.media_details && item.media_details.sizes;
  if (s) {
    if (s.medium?.source_url) return s.medium.source_url;
    if (s.thumbnail?.source_url) return s.thumbnail.source_url;
    if (s.full?.source_url) return s.full.source_url;
  }
  return item.source_url;
}

function escapeHtml(s) {
  return s ? String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])) : '';
}

// ---------- Render ----------
function renderArchive() {
  const wanted = (typeFilter?.value || '').trim();
  const list = CACHE.filter(it => !wanted || mapType(it) === wanted);

  if (!grid) return;
  grid.innerHTML = '';

  if (!list.length) {
    if (state) { state.hidden = false; state.textContent = 'No results'; }
    grid.hidden = true;
    return;
  }

  if (state) state.hidden = true;
  grid.hidden = false;

  list.forEach(item => {
    const t = mapType(item);
    const el = document.createElement('article');
    el.className = 'card';
    el.dataset.type = t;
    el.dataset.id = item.id;

    const title = escapeHtml(item.title?.rendered || 'Untitled');
    const date = (item.date || '').slice(0,10);

    // preview (image/video/audio/doc)
    let previewHTML = '';
    if (t === 'image') {
      previewHTML = `<img loading="lazy" src="${thumb(item)}" alt="${title}">`;
    } else if (t === 'video') {
      const poster =
        item.media_details?.sizes?.medium?.source_url ||
        item.media_details?.sizes?.thumbnail?.source_url || '';
      previewHTML = `
        <video class="pv" src="${item.source_url}#t=0.1"
               muted playsinline autoplay loop preload="metadata"
               ${poster ? `poster="${poster}"` : ''} aria-label="${title}">
        </video>`;
    } else if (t === 'audio') {
      previewHTML = `
        <div class="audio-wrap">
          <button class="audio-play" aria-label="Play ${title}">▶</button>
          <audio class="pv" src="${item.source_url}" preload="metadata"></audio>
        </div>`;
    } else {
      previewHTML = `<div class="ph" aria-hidden="true">DOC</div>`;
    }

    el.innerHTML = `
      <a href="#" data-id="${item.id}" aria-label="Open ${title} (${t})">
        ${previewHTML}
        <div class="meta">
          <h3 class="title">${title}</h3>
          <div class="muted">${[t, date].filter(Boolean).join(' · ')}</div>
        </div>
      </a>`;

    const link = el.querySelector('a');
    link.addEventListener('click', e => { e.preventDefault(); openLightbox(item); });
    link.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(item); }
    });

    // UX preview behavior
    if (t === 'audio') {
      const wrap = el.querySelector('.audio-wrap');
      const btn = el.querySelector('.audio-play');
      const au = el.querySelector('audio.pv');
      if (wrap && btn && au) {
        const stop = () => { try { au.pause(); au.currentTime = 0; } catch {} };
        wrap.addEventListener('mouseenter', () => { au.play().catch(()=>{}); });
        wrap.addEventListener('mouseleave', stop);
        btn.addEventListener('click', e => { e.preventDefault(); au.paused ? au.play().catch(()=>{}) : au.pause(); });
      }
    } else if (t === 'video') {
      const v = el.querySelector('video.pv');
      if (v) { v.muted = true; v.playsInline = true; }
    }

    grid.appendChild(el);
  });
}

// ---------- Lightbox ----------
function openLightbox(item) {
  if (!lb) return;
  const t = mapType(item);
  lbTitle && (lbTitle.textContent = item.title?.rendered || 'Untitled');
  lbInfo && (lbInfo.textContent = [t, (item.date || '').slice(0,10)].filter(Boolean).join(' · '));
  lbTags && (lbTags.textContent = item.alt_text || '');
  lbNotes && (lbNotes.innerHTML = item.caption?.rendered || '');

  if (lbMedia) {
    lbMedia.innerHTML = '';
    if (t === 'image') {
      const img = new Image();
      img.src = item.source_url;
      img.alt = item.title?.rendered || '';
      lbMedia.appendChild(img);
    } else if (t === 'video') {
      const v = document.createElement('video');
      v.src = item.source_url; v.controls = true; v.playsInline = true;
      lbMedia.appendChild(v);
    } else if (t === 'audio') {
      const a = document.createElement('audio');
      a.src = item.source_url; a.controls = true;
      lbMedia.appendChild(a);
    } else {
      const p = document.createElement('p');
      p.innerHTML = `Document: <a href="${item.source_url}" target="_blank" rel="noopener">open</a>`;
      lbMedia.appendChild(p);
    }
  }

  lb.showModal();
}

// chiusura su backdrop
lb?.addEventListener('click', (e) => {
  const rect = lb.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inside) lb.close();
});
lb?.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.close(); });

// ---------- Events ----------
const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,a),ms); }; };

refreshBtn?.addEventListener('click', fetchArchive);
typeFilter?.addEventListener('change', renderArchive);
searchInput?.addEventListener('input', debounce(() => fetchArchive(), 250));
searchInput?.addEventListener('keypress', e => { if (e.key === 'Enter') fetchArchive(); });

// ---------- Kick-off ----------
fetchArchive();
