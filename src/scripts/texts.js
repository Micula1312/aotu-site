// AOTU — Texts (Bibliography) · barra ricerca + type/tag + sort (stile Network)

// ---------- DOM ----------
const listEl =
  document.getElementById('networkList') ||
  document.getElementById('list') ||
  document.getElementById('grid');
const state = document.getElementById('state');

const qInput     = document.getElementById('q');
const authorInput= document.getElementById('author');
const typeSel    = document.getElementById('type');
const tagSel     = document.getElementById('tag');
const sortSel    = document.getElementById('sort');
const refreshBtn = document.getElementById('refresh');

// ---------- API base (dalle env già in uso) ----------
function computeApiBase(){
  let fromEnv = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_WP_API_URL) {
      fromEnv = String(import.meta.env.PUBLIC_WP_API_URL);
    }
  } catch {}
  if (fromEnv) return fromEnv.replace(/\/$/, '') + '/wp-json';
  if (typeof window !== 'undefined' && window.__WP_API_URL) return String(window.__WP_API_URL).replace(/\/$/, '') + '/wp-json';
  if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return '/wp-json';
  return 'https://thearchiveoftheuntamed.xyz/wp/wp-json';
}
const API_BASE = computeApiBase();
const EP_TEXTS = `${API_BASE}/aotu/v1/texts`;
const EP_TYPES = `${API_BASE}/wp/v2/aotu_bib_type?_fields=name,slug&per_page=100`;
const EP_TAGS  = `${API_BASE}/wp/v2/aotu_bib_tag?_fields=name,slug&per_page=100`;
console.info('[texts] boot', { API_BASE, ENDPOINT: EP_TEXTS });

// ---------- Helpers ----------
const esc  = (s) => s ? String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])) : '';
const pick = (...vals) => vals.find(v => v !== undefined && v !== null && String(v).trim() !== '') || '';
const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

function getYear(it){ return pick(it?.year, it?.meta?.year, it?.date?.slice?.(0,4)); }
function getTitle(it){ return pick(it?.title?.rendered, it?.title, 'Untitled'); }
function getAuthors(it){
  if (Array.isArray(it?.authors)) return it.authors.join(', ');
  return pick(it?.author, it?.authors);
}
function getType(it){ return pick(it?.type, it?.post_type); }
function getVenue(it){ return pick(it?.publisher, it?.venue); }

// ---------- Stato ----------
let CACHE = [];

// mapping select → orderby/order lato server
function sortParamsFromMode(mode){
  switch (mode) {
    case 'year_desc': return { orderby: 'year',  order: 'desc' };
    case 'year_asc':  return { orderby: 'year',  order: 'asc'  };
    case 'title_az':  return { orderby: 'title', order: 'asc'  };
    case 'title_za':  return { orderby: 'title', order: 'desc' };
    case 'date_new':  return { orderby: 'date',  order: 'desc' };
    default:          return { orderby: 'year',  order: 'desc' };
  }
}

// ---------- Taxonomie: type/tag ----------
async function loadTaxonomies(){
  try {
    const [rt, rg] = await Promise.all([
      fetch(EP_TYPES, { cache: 'no-cache' }),
      fetch(EP_TAGS,  { cache: 'no-cache' })
    ]);
    if (!rt.ok || !rg.ok) throw new Error(`HTTP types=${rt.status} tags=${rg.status}`);
    const [types, tags] = await Promise.all([rt.json(), rg.json()]);

    // pulisci (lascia la prima option “All …”)
    typeSel?.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
    tagSel ?.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());

    if (Array.isArray(types)) {
      types.forEach(t => {
        const o = document.createElement('option');
        o.value = t.slug; o.textContent = t.name; typeSel?.appendChild(o);
      });
    }
    if (Array.isArray(tags)) {
      tags.forEach(t => {
        const o = document.createElement('option');
        o.value = t.slug; o.textContent = t.name; tagSel?.appendChild(o);
      });
    }
  } catch (e) {
    console.warn('[texts] taxonomies error:', e);
  }
}

// ---------- Fetch + render ----------
async function fetchTexts(){
  try {
    if (state) { state.hidden = false; state.textContent = 'Loading…'; }
    if (listEl) listEl.innerHTML = '';

    const params = new URLSearchParams();
    params.set('per_page', '100');

    // ricerca testo pieno (il plugin usa 'q' per WP_Query->s)
    const q = (qInput?.value || '').trim();
    if (q) params.set('q', q);

    // 🔧 ricerca AUTORE (il plugin usa 'author' LIKE su meta 'author')
    const author = (authorInput?.value || '').trim();
    if (author) params.set('author', author);

    // filtri tassonomici (slug multipli separati da virgola)
    const type = (typeSel?.value || '').trim();
    if (type) params.set('type', type);

    const tag = (tagSel?.value || '').trim();
    if (tag) params.set('tag', tag);

    const { orderby, order } = sortParamsFromMode(sortSel?.value);
    params.set('orderby', orderby);
    params.set('order',   order);

    const url = `${EP_TEXTS}?${params.toString()}`;
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);

    const data = await r.json();
    // risposta del plugin: { items:[…], total, pages, ... }
    CACHE = Array.isArray(data?.items) ? data.items : [];

    renderList();
  } catch (e) {
    console.error('[texts] fetch error:', e);
    if (state) { state.hidden = false; state.textContent = 'Error loading texts.'; }
  }
}

function renderList(){
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!CACHE.length){
    if (state) { state.hidden = false; state.textContent = 'No results'; }
    return;
  }
  if (state) state.hidden = true;

  CACHE.forEach(item => {
    const title = esc(getTitle(item));
    const authors = esc(getAuthors(item) || '—');
    const year = esc(getYear(item) || '—');
    const meta = esc([getType(item), getVenue(item)].filter(Boolean).join(' · ') || '—');

    const row = document.createElement('div');
    row.className = 'network-card';
    row.innerHTML = `
      <div data-label="Title">${title}</div>
      <div data-label="Authors">${authors}</div>
      <div data-label="Year">${year}</div>
      <div data-label="Type / Venue">${meta}</div>
    `;
    listEl.appendChild(row);
  });
}

// ---------- Events ----------
const doFetch = debounce(fetchTexts, 250);
qInput     ?.addEventListener('input', doFetch);
authorInput?.addEventListener('input', doFetch);
typeSel    ?.addEventListener('change', fetchTexts);
tagSel     ?.addEventListener('change', fetchTexts);
sortSel    ?.addEventListener('change', fetchTexts);
refreshBtn ?.addEventListener('click', fetchTexts);

// ---------- Kick-off ----------
(async function init(){
  await loadTaxonomies();
  await fetchTexts();
})();
