// AOTU Archive — cards + lightbox con preview image/video/audio
// Dev/Prod safe:
// - in dev usa SEMPRE il proxy: /wp-json → target .../wp/wp-json
// - in prod usa window.__WP_API_URL (iniettata dal layout Base.astro)

// ---------- Endpoint WP ----------
const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

let API_BASE = IS_DEV
  ? '/wp-json'  // usa il proxy in dev
  : (typeof window !== 'undefined' && window.__WP_API_URL)
      ? window.__WP_API_URL
      : 'https://thearchiveoftheuntamed.xyz/wp/wp-json';  // fallback assoluto

API_BASE = API_BASE.replace(/\/$/, '');
const MEDIA_ENDPOINT = `${API_BASE}/wp/v2/media`;


console.log('[archive] API_BASE =', API_BASE);

// ---------- UI refs ----------
const grid        = document.getElementById('grid');
const stateEl     = document.getElementById('state');
const typeFilter  = document.getElementById('type');
const searchInput = document.getElementById('q');
const refreshBtn  = document.getElementById('refresh');
const moreBtn     = document.getElementById('archive-loadmore');
const countEl     = document.getElementById('archive-count');

const pillsWrap   = document.getElementById('activeFilters');
const clearAllBtn = document.getElementById('clearAllFilters');

const lb      = document.getElementById('lb');
const lbMedia = document.getElementById('lbMedia');
const lbTitle = document.getElementById('lbTitle');
const lbInfo  = document.getElementById('lbInfo');
const lbTags  = document.getElementById('lbTags');
const lbNotes = document.getElementById('lbNotes');

if (!grid || !stateEl) {
  console.warn('[archive] Missing required elements (#grid, #state).');
}

// ---------- URL params ----------
const urlParams = new URLSearchParams(location.search);
const param = (k) => (urlParams.get(k) || '').trim();

let CURRENT_TAG  = param('mtag');
let CURRENT_KIND = param('mkind');
let CURRENT_TYPE = param('mtype');

if (typeFilter && CURRENT_TYPE) typeFilter.value = CURRENT_TYPE;
if (searchInput && param('q'))  searchInput.value = param('q');

// ---------- Stato ----------
const STATE = {
  items: [],
  page: 1,
  pages: 1,
  perPage: 24,
  lastQuery: null,
};

// ---------- Utils ----------
const sanitize = (html = '') => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  tmp.querySelectorAll('*').forEach(el => {
    const name = el.nodeName.toLowerCase();
    if (!['em','strong','i','b','br','p','a'].includes(name)) {
      el.replaceWith(document.createTextNode(el.textContent || ''));
    } else if (name === 'a') {
      el.setAttribute('target','_blank');
      el.setAttribute('rel','noopener');
    }
  });
  return tmp.innerHTML;
};

const escapeHtml = (s='') =>
  s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const mapType = (item) => {
  const mt = (item.mime_type || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  if (mt.startsWith('audio/')) return 'audio';
  return 'doc';
};

const thumb = (item) => {
  const s = item.media_details && item.media_details.sizes;
  if (s) {
    if (s.medium?.source_url) return s.medium.source_url;
    if (s.thumbnail?.source_url) return s.thumbnail.source_url;
    if (s.full?.source_url) return s.full.source_url;
  }
  return item.source_url;
};

const setStatus = (txt) => {
  if (stateEl) { stateEl.hidden = !txt; stateEl.textContent = txt || ''; }
};
const showGrid = (yes) => { if (grid) grid.hidden = !yes; };

// ---------- URL sync + pills ----------
function syncURL() {
  const sp = new URLSearchParams(location.search);
  const q = (searchInput?.value || '').trim();
  q ? sp.set('q', q) : sp.delete('q');
  CURRENT_TYPE ? sp.set('mtype', CURRENT_TYPE) : sp.delete('mtype');
  CURRENT_TAG  ? sp.set('mtag',  CURRENT_TAG)  : sp.delete('mtag');
  CURRENT_KIND ? sp.set('mkind', CURRENT_KIND) : sp.delete('mkind');
  history.replaceState(null, '', `${location.pathname}?${sp.toString()}`);
  renderActivePills();
}

function renderActivePills() {
  if (!pillsWrap) return;
  const parts = [];
  if (CURRENT_TYPE) parts.push(`<button type="button" class="pill" data-x="type">${CURRENT_TYPE} ✕</button>`);
  if (CURRENT_TAG)  parts.push(`<button type="button" class="pill" data-x="mtag">tag: ${CURRENT_TAG} ✕</button>`);
  if (CURRENT_KIND) parts.push(`<button type="button" class="pill" data-x="mkind">kind: ${CURRENT_KIND} ✕</button>`);
  pillsWrap.innerHTML = parts.join('') || '<span class="muted">No active filters</span>';
  if (clearAllBtn) clearAllBtn.hidden = !(CURRENT_TYPE || CURRENT_TAG || CURRENT_KIND);

  pillsWrap.querySelectorAll('button.pill')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const which = btn.dataset.x;
      if (which === 'type') { CURRENT_TYPE = ''; if (typeFilter) typeFilter.value = ''; }
      if (which === 'mtag') CURRENT_TAG = '';
      if (which === 'mkind') CURRENT_KIND = '';
      syncURL();
      fetchPage({ append: false });
    });
  });
}

// ---------- Fetch ----------
function buildQuery({ page = 1 } = {}) {
  const base = MEDIA_ENDPOINT.startsWith('http') ? MEDIA_ENDPOINT : new URL(MEDIA_ENDPOINT, location.origin).toString();
  const url = new URL(base);
  url.searchParams.set('per_page', String(STATE.perPage));
  url.searchParams.set('page', String(page));
  url.searchParams.set('_fields', 'id,date,mime_type,media_type,source_url,title,alt_text,caption,media_details');

  const q = (searchInput?.value || '').trim();
  if (q) url.searchParams.set('search', q);

  const wanted = (typeFilter?.value || '').trim();
  if (wanted) url.searchParams.set('media_type', wanted === 'doc' ? 'file' : wanted);

  if (CURRENT_TAG)  url.searchParams.set('aotu_media_tag',  CURRENT_TAG);
  if (CURRENT_KIND) url.searchParams.set('aotu_media_kind', CURRENT_KIND);

  return url.toString();
}

async function fetchPage({ append = false } = {}) {
  try {
    if (moreBtn) moreBtn.disabled = true;
    syncURL();
    setStatus('Loading…');
    showGrid(false);

    const url = buildQuery({ page: append ? STATE.page + 1 : 1 });
    STATE.lastQuery = url;

    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    const total = Number(res.headers.get('X-WP-Total')) || (Array.isArray(data) ? data.length : 0);
    const totalPages = Number(res.headers.get('X-WP-TotalPages')) || 1;
    const items = Array.isArray(data) ? data : [];

    if (append) { STATE.items.push(...items); STATE.page += 1; }
    else { STATE.items = items; STATE.page = 1; }
    STATE.pages = totalPages;

    renderList();
    if (countEl) countEl.textContent = `${total} results`;
    if (moreBtn) moreBtn.disabled = STATE.page >= STATE.pages;
    setStatus(STATE.items.length === 0 ? 'No results' : '');
    showGrid(STATE.items.length > 0);
  } catch (err) {
    console.error(err);
    setStatus('Error loading archive (check CORS/API).');
    if (moreBtn) moreBtn.disabled = false;
  }
}

// ---------- Render ----------
function renderList() {
  if (!grid) return;
  grid.innerHTML = '';

  const wanted = (typeFilter?.value || '').trim();
  const list = wanted ? STATE.items.filter(it => mapType(it) === wanted) : STATE.items;
  if (!list.length) return;

  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  list.forEach(item => {
    const t = mapType(item);
    const el = document.createElement('article');
    el.className = 'card';
    el.dataset.type = t;
    el.dataset.id = item.id;

    const title = escapeHtml(item.title?.rendered || 'Untitled');
    const date = (item.date || '').slice(0,10);

    let previewHTML = '';
    if (t === 'image') {
      previewHTML = `<img loading="lazy" src="${thumb(item)}" alt="${title}">`;
    } else if (t === 'video') {
      const poster = item.media_details?.sizes?.medium?.source_url ||
                     item.media_details?.sizes?.thumbnail?.source_url || '';
      previewHTML = `
        <video class="pv" muted playsinline loop preload="metadata"
               ${prefersReduced ? '' : 'autoplay'}
               ${poster ? `poster="${poster}"` : ''} aria-label="${title}">
          <source src="${item.source_url}#t=0.1">
        </video>`;
    } else if (t === 'audio') {
      previewHTML = `
        <div class="audio-wrap">
          <button class="audio-play" aria-label="Play ${title}" title="Play/Pause">▶</button>
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
    link.addEventListener('click', e => { e.preventDefault(); openLightbox(item, link); });
    link.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(item, link); } });

    if (t === 'audio') {
      const wrap = el.querySelector('.audio-wrap');
      const btn = el.querySelector('.audio-play');
      const au  = el.querySelector('audio.pv');
      if (wrap && btn && au) {
        const stop = () => { try { au.pause(); au.currentTime = 0; } catch {} };
        wrap.addEventListener('mouseenter', () => { au.play().catch(()=>{}); });
        wrap.addEventListener('mouseleave', stop);
        btn.addEventListener('click', e => { e.preventDefault(); au.paused ? au.play().catch(()=>{}) : au.pause(); });
      }
    } else if (t === 'video') {
      const v = el.querySelector('video.pv');
      if (v) {
        v.muted = true; v.playsInline = true;
        const io = new IntersectionObserver((entries) => {
          entries.forEach(en => { en.isIntersecting ? v.play().catch(()=>{}) : v.pause(); });
        }, { threshold: 0.25 });
        io.observe(v);
      }
    }

    grid.appendChild(el);
  });
}

// ---------- Lightbox ----------
let lastFocus = null;
function openLightbox(item, openerEl) {
  if (!lb) return;
  lastFocus = openerEl || document.activeElement;

  const t = mapType(item);
  lbTitle && (lbTitle.textContent = item.title?.rendered || 'Untitled');
  lbInfo  && (lbInfo.textContent  = [t, (item.date || '').slice(0,10)].filter(Boolean).join(' · '));
  lbTags  && (lbTags.textContent  = item.alt_text || '');
  lbNotes && (lbNotes.innerHTML   = sanitize(item.caption?.rendered || ''));

  if (lbMedia) {
    lbMedia.innerHTML = '';
    if (t === 'image') {
      const img = new Image(); img.src = item.source_url; img.alt = item.title?.rendered || ''; lbMedia.appendChild(img);
    } else if (t === 'video') {
      const v = document.createElement('video'); v.src = item.source_url; v.controls = true; v.playsInline = true; lbMedia.appendChild(v);
    } else if (t === 'audio') {
      const a = document.createElement('audio'); a.src = item.source_url; a.controls = true; lbMedia.appendChild(a);
    } else {
      const p = document.createElement('p'); p.innerHTML = `Document: <a href="${item.source_url}" target="_blank" rel="noopener">open</a>`; lbMedia.appendChild(p);
    }
  }

  lb.showModal();
  lb.addEventListener('close', () => { lastFocus && lastFocus.focus?.(); }, { once: true });
}

lb?.addEventListener('click', (e) => {
  const rect = lb.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inside) lb.close();
});
lb?.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.close(); });

// ---------- Events ----------
const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,a),ms); }; };

refreshBtn?.addEventListener('click', () => fetchPage({ append: false }));
typeFilter?.addEventListener('change', () => { CURRENT_TYPE = (typeFilter?.value || '').trim(); fetchPage({ append: false }); });
searchInput?.addEventListener('input', debounce(() => fetchPage({ append: false }), 250));
searchInput?.addEventListener('keypress', e => { if (e.key === 'Enter') fetchPage({ append: false }); });

clearAllBtn?.addEventListener('click', () => {
  CURRENT_TYPE = CURRENT_TAG = CURRENT_KIND = '';
  if (typeFilter)  typeFilter.value  = '';
  if (searchInput) searchInput.value = '';
  fetchPage({ append: false });
});

moreBtn?.addEventListener('click', () => { if (STATE.page < STATE.pages) fetchPage({ append: true }); });

// ---------- Kick-off ----------
renderActivePills();
fetchPage({ append: false });
