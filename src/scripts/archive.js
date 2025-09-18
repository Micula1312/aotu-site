// AOTU Archive — cards + lightbox (image/video/audio) + TAG FILTER (post_tag)
// Dev/Prod safe:
// - in dev usa SEMPRE il proxy: /wp-json → target .../wp/wp-json
// - in prod usa window.__WP_API_URL (iniettata dal layout Base.astro)

// ---------- Endpoint WP ----------
const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

let API_BASE = IS_DEV
  ? '/wp-json' // proxy in dev
  : (typeof window !== 'undefined' && window.__WP_API_URL)
    ? window.__WP_API_URL
    : 'https://thearchiveoftheuntamed.xyz/wp/wp-json'; // fallback

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

let CURRENT_TAG  = param('mtag');   // può essere id, slug o nome
let CURRENT_KIND = param('mkind');  // riservato (non usato qui)
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
  tagId: null,      // ID di post_tag usato per filtrare
  tagLabel: null,   // nome leggibile del tag (per la pill)
};

// ---------- Utils ----------
const escapeHtml = (s='') =>
  s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const mapType = (item) => {
  const mt = (item.mime_type || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  if (mt.startsWith('audio/')) return 'audio';
  return 'doc';
};

// Per un look più "pixel" senza zoom, preferiamo miniature piccole in preview
const PIXELATE_PREVIEW = true;

const thumb = (item) => {
  const s = item.media_details && item.media_details.sizes;
  if (s) {
    if (PIXELATE_PREVIEW && s.thumbnail?.source_url) return s.thumbnail.source_url; // mini → upscaling naturale
    if (s.medium?.source_url)    return s.medium.source_url;
    if (s.full?.source_url)      return s.full.source_url;
  }
  return item.source_url;
};

const setStatus = (txt) => {
  if (stateEl) { stateEl.hidden = !txt; stateEl.textContent = txt || ''; }
};
const showGrid = (yes) => { if (grid) grid.hidden = !yes; };

// ---------- Tag resolve (name/slug -> ID per filtrare) ----------
const TAG_CACHE = new Map(); // key: lowercased name/slug -> { id, name, slug }

async function resolveTagId(query) {
  // Se è già un numero, usalo direttamente
  if (/^\d+$/.test(String(query))) {
    return { id: Number(query), name: null, slug: null };
  }
  const key = String(query).trim().toLowerCase();
  if (TAG_CACHE.has(key)) return TAG_CACHE.get(key);

  const url = `${API_BASE}/wp/v2/tags?search=${encodeURIComponent(query)}&_fields=id,name,slug`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const arr = await res.json();

  // prova match su slug, poi su name, altrimenti prendi il primo
  const bySlug = arr.find(t => t.slug?.toLowerCase() === key);
  const byName = arr.find(t => t.name?.toLowerCase() === key);
  const found = bySlug || byName || arr[0] || null;

  if (found) {
    const val = { id: Number(found.id), name: found.name, slug: found.slug };
    TAG_CACHE.set(key, val);
    return val;
  }
  return null;
}

async function ensureTagIdIfNeeded() {
  STATE.tagId = null;
  STATE.tagLabel = null;
  if (!CURRENT_TAG) return;
  const resolved = await resolveTagId(CURRENT_TAG);
  if (resolved?.id) {
    STATE.tagId = resolved.id;
    STATE.tagLabel = resolved.name || CURRENT_TAG;
  }
}

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
  if (CURRENT_TYPE) parts.push(`<button type="button" class="pill" data-x="type">${CURRENT_TYPE} </button>`);
  const tagLabel = STATE.tagLabel || CURRENT_TAG;
  if (tagLabel)   parts.push(`<button type="button" class="pill" data-x="mtag">tag: ${escapeHtml(tagLabel)} </button>`);
  if (CURRENT_KIND) parts.push(`<button type="button" class="pill" data-x="mkind">kind: ${CURRENT_KIND} </button>`);
  pillsWrap.innerHTML = parts.join('') || '<span class="muted">No active filters</span>';
  if (clearAllBtn) clearAllBtn.hidden = !(CURRENT_TYPE || CURRENT_TAG || CURRENT_KIND);

  pillsWrap.querySelectorAll('button.pill')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const which = btn.dataset.x;
      if (which === 'type') { CURRENT_TYPE = ''; if (typeFilter) typeFilter.value = ''; }
      if (which === 'mtag') { CURRENT_TAG = ''; STATE.tagId = null; STATE.tagLabel = null; }
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

  // Campi necessari + termini embedded per leggere i tag (post_tag) + 'tags' (ID) per fallback
  url.searchParams.set('_fields',
    'id,date,mime_type,media_type,source_url,title,alt_text,caption,media_details,_embedded,tags'
  );
  url.searchParams.set('_embed', '1');

  const q = (searchInput?.value || '').trim();
  if (q) url.searchParams.set('search', q);

  const wanted = (typeFilter?.value || '').trim();
  if (wanted) url.searchParams.set('media_type', wanted === 'doc' ? 'file' : wanted);

  // *** filtro per TAG (post_tag) — WP vuole l'ID ***
  if (STATE.tagId) url.searchParams.set('tags', String(STATE.tagId));

  return url.toString();
}

async function fetchPage({ append = false } = {}) {
  try {
    if (moreBtn) moreBtn.disabled = true;
    syncURL();
    setStatus('Loading…');
    showGrid(false);

    // risolvi l'ID del tag se l'utente ha messo nome/slug
    await ensureTagIdIfNeeded();

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

// ---------- Tag helpers (embed → fallback IDs) ----------

// Cache per nomi: id -> { id, name, slug }
const TAG_NAME_CACHE = new Map();

async function fetchTagMetaByIds(ids = []) {
  const missing = ids.filter(id => !TAG_NAME_CACHE.has(id));
  if (!missing.length) return;
  const url = `${API_BASE}/wp/v2/tags?per_page=100&include=${missing.join(',')}&_fields=id,name,slug`;
  const res = await fetch(url);
  if (!res.ok) return;
  const arr = await res.json();
  arr.forEach(t => TAG_NAME_CACHE.set(Number(t.id), { id: Number(t.id), name: t.name, slug: t.slug || '' }));
}

// Ritorna sempre [{id, name, slug}].
// 1) Prova da _embedded['wp:term'] (taxonomy === 'post_tag')
// 2) Fallback: usa item.tags (array di ID) e risolvi via /wp/v2/tags
async function getPostTags(item) {
  const terms = item._embedded?.['wp:term'];
  if (terms?.length) {
    const embedded = terms.flat()
      .filter(t => t.taxonomy === 'post_tag' && t.name)
      .map(t => ({ id: Number(t.id), name: t.name, slug: t.slug || '' }));
    if (embedded.length) return embedded;
  }

  const ids = Array.isArray(item.tags) ? item.tags.map(n => Number(n)).filter(Boolean) : [];
  if (!ids.length) return [];

  await fetchTagMetaByIds(ids);
  return ids
    .map(id => TAG_NAME_CACHE.get(id))
    .filter(Boolean);
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

    // Card: solo immagine + titolo overlay
    el.innerHTML = `
      <a href="#" data-id="${item.id}" aria-label="Open ${title} (${t})">
        ${previewHTML}
        <h3 class="title">${title}</h3>
      </a>`;

    const link = el.querySelector('a');
    link.addEventListener('click', e => { e.preventDefault(); openLightbox(item, link); });
    link.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(item, link); }
    });

    if (t === 'audio') {
      const wrap = el.querySelector('.audio-wrap');
      const btn  = el.querySelector('.audio-play');
      const au   = el.querySelector('audio.pv');
      if (wrap && btn && au) {
        const stop = () => { try { au.pause(); au.currentTime = 0; } catch {} };
        wrap.addEventListener('mouseenter', () => { au.play().catch(()=>{}); });
        wrap.addEventListener('mouseleave', stop);
        btn.addEventListener('click', e => {
          e.preventDefault();
          au.paused ? au.play().catch(()=>{}) : au.pause();
        });
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
async function openLightbox(item, openerEl) {
  if (!lb) return;
  lastFocus = openerEl || document.activeElement;

  const t = mapType(item);

  // Titolo
  if (lbTitle) lbTitle.textContent = item.title?.rendered || 'Untitled';

  // Data upload (formattata IT)
  const dateStr = item.date
    ? new Date(item.date).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })
    : (item.date || '').slice(0,10);
  if (lbInfo) lbInfo.textContent = dateStr;

  // TAG: post_tag (embed → fallback IDs), cliccabili -> filtro
  const tags = await getPostTags(item);
  if (lbTags) {
    lbTags.innerHTML = tags.length
      ? tags.map(tg => `<button type="button" class="tag-pill" data-id="${tg.id}" data-name="${escapeHtml(tg.name)}">#${escapeHtml(tg.name)}</button>`).join(' ')
      : '';
  }

  // Niente note/caption
  if (lbNotes) { lbNotes.hidden = true; lbNotes.innerHTML = ''; }

  // Media
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

  // ESC / click fuori
  const onKey = (e) => { if (e.key === 'Escape') lb.close(); };
  const onClickOutside = (e) => {
    const rect = lb.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) lb.close();
  };
  lb.addEventListener('keydown', onKey, { once: true });
  lb.addEventListener('click', onClickOutside, { once: true });

  lb.addEventListener('close', () => { lastFocus && lastFocus.focus?.(); }, { once: true });
}

// Tag pill nel lightbox → applica filtro
lbTags?.addEventListener('click', (e) => {
  const btn = e.target.closest('.tag-pill');
  if (!btn) return;
  CURRENT_TAG = String(btn.dataset.id); // memorizzo come ID (valido per ?tags=)
  STATE.tagId = Number(btn.dataset.id);
  STATE.tagLabel = btn.dataset.name || CURRENT_TAG;
  if (typeFilter) typeFilter.value = '';
  lb.close();
  fetchPage({ append: false });
});

// ---------- Tag Cloud (post_tag) ----------
async function renderTagList() {
  const wrap = document.getElementById('tagList');
  if (!wrap) return;

  wrap.innerHTML = '<span class="muted">loading tags…</span>';
  try {
    const res = await fetch(`${API_BASE}/wp/v2/tags?per_page=100&_fields=id,name,slug,count`);
    if (!res.ok) throw new Error(res.status);
    const tags = await res.json();

    // Ordina per usage (discendente)
    tags.sort((a,b) => (b.count||0) - (a.count||0));

    wrap.innerHTML = tags.map(t =>
      `<button class="pill" data-tag-id="${t.id}" data-tag-name="${escapeHtml(t.name)}">#${escapeHtml(t.name)} (${t.count||0})</button>`
    ).join(' ');

    // Click su un tag → applica filtro (usa ID, come richiede /wp/v2/media?tags=<ID>)
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tag-id]');
      if (!btn) return;
      CURRENT_TAG        = String(btn.dataset.tagId);
      STATE.tagId        = Number(btn.dataset.tagId);
      STATE.tagLabel     = btn.dataset.tagName;
      if (typeFilter) typeFilter.value = '';
      fetchPage({ append: false });
    }, { once: true }); // attach una sola volta
  } catch (err) {
    console.error(err);
    wrap.innerHTML = '<span class="muted">no tags</span>';
  }
}


// ---------- Events ----------
const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,a),ms); }; };

refreshBtn?.addEventListener('click', () => fetchPage({ append: false }));
typeFilter?.addEventListener('change', () => { CURRENT_TYPE = (typeFilter?.value || '').trim(); fetchPage({ append: false }); });
searchInput?.addEventListener('input', debounce(() => fetchPage({ append: false }), 250));
searchInput?.addEventListener('keypress', e => { if (e.key === 'Enter') fetchPage({ append: false }); });

clearAllBtn?.addEventListener('click', () => {
  CURRENT_TYPE = CURRENT_TAG = CURRENT_KIND = '';
  STATE.tagId = null; STATE.tagLabel = null;
  if (typeFilter)  typeFilter.value  = '';
  if (searchInput) searchInput.value = '';
  fetchPage({ append: false });
});

moreBtn?.addEventListener('click', () => { if (STATE.page < STATE.pages) fetchPage({ append: true }); });

// ---------- Kick-off ----------
renderActivePills();
renderTagList(); 
fetchPage({ append: false });
