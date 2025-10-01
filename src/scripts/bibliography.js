// AOTU Bibliography — ES module (lista infinita, nessun filtro / no single view)

// ---------- DOM compat con ListPage ----------
const listEl =
  document.getElementById('networkList') || // se ListPage lo espone così
  document.getElementById('list') ||
  document.getElementById('grid');
const stateEl = document.getElementById('state'); // barra di stato di ListPage, se presente

if (!listEl) console.warn('[bibliography] Missing list container (#networkList|#list|#grid)');

// ---------- API base (usa le env che già hai) ----------
function computeApiBase() {
  // PUBLIC_WP_API_URL = https://thearchiveoftheuntamed.xyz/wp
  let fromEnv = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_WP_API_URL) {
      fromEnv = String(import.meta.env.PUBLIC_WP_API_URL);
    }
  } catch {}
  if (fromEnv) return fromEnv.replace(/\/$/, '') + '/wp-json';

  if (typeof window !== 'undefined' && window.__WP_API_URL) {
    return String(window.__WP_API_URL).replace(/\/$/, '') + '/wp-json';
  }
  if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    return '/wp-json'; // proxy dev
  }
  return 'https://thearchiveoftheuntamed.xyz/wp/wp-json';
}
const API_BASE = computeApiBase();
const ENDPOINT = `${API_BASE}/aotu/v1/texts`;

console.log('[bibliography] boot', { API_BASE, ENDPOINT });

// ---------- Stato infinito ----------
let page = 1;
const PER_PAGE = 40;
let loading = false;
let endReached = false;

// ---------- Helpers ----------
const esc = (s) => s ? String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])) : '';

function setState(msg = '', show = true) {
  if (!stateEl) return;
  stateEl.textContent = msg || '';
  stateEl.hidden = !show;
}

function pick(...vals) {
  return vals.find(v => v !== undefined && v !== null && String(v).trim() !== '') || '';
}

// Campi tipici dell’endpoint texts
function getYear(it)   { return pick(it?.meta?.year, it?.year, it?.date?.slice?.(0,4)); }
function getTitle(it)  { return pick(it?.title?.rendered, it?.title, 'Untitled'); }
function getAuthors(it){
  if (Array.isArray(it?.authors)) return it.authors.join(', ');
  return pick(it?.author, it?.authors);
}
function getType(it)   { return pick(it?.type, it?.post_type); }
function getVenue(it)  { return pick(it?.venue, it?.publisher); }

// ---------- Render di una riga (4 colonne, come Network) ----------
function renderRow(item) {
  const row = document.createElement('div');
  row.className = 'network-card'; // riusa lo stile a 4 colonne (già presente)
  row.innerHTML = `
    <div data-label="Title">${esc(getTitle(item))}</div>
    <div data-label="Authors">${esc(getAuthors(item) || '—')}</div>
    <div data-label="Year">${esc(getYear(item) || '—')}</div>
    <div data-label="Type / Venue">${esc([getType(item), getVenue(item)].filter(Boolean).join(' · ') || '—')}</div>
  `;
  // niente click: non apriamo nessuna scheda singola
  return row;
}

// ---------- Fetch + append ----------
async function fetchPage() {
  if (loading || endReached) return;
  loading = true;
  setState('Loading…', true);

  const params = new URLSearchParams({
    per_page: String(PER_PAGE),
    page: String(page),
    orderby: 'year', // se non supportato dal tuo endpoint: sostituisci con 'date'
    order: 'desc',
    _embed: '1'
  });

  try {
    const url = `${ENDPOINT}?${params.toString()}`;
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const items = await r.json();

    if (Array.isArray(items) && items.length) {
      const frag = document.createDocumentFragment();
      items.forEach(it => frag.appendChild(renderRow(it)));
      listEl?.appendChild(frag);
      page += 1;
      setState('', false);

      // se la pagina è corta, autopopola finché riempie lo schermo
      maybeAutofillViewport();
    } else {
      endReached = true;
      setState(listEl?.children.length ? 'End.' : 'No entries.', true);
      observer.disconnect();
    }
  } catch (e) {
    console.error('[bibliography] fetch error', e);
    setState('Error loading bibliography.', true);
  } finally {
    loading = false;
  }
}

// ---------- Infinite scroll ----------
const sentinel = document.createElement('div');
sentinel.id = 'bib-sentinel';
sentinel.style.height = '1px';
(listEl?.parentElement || document.body).appendChild(sentinel);

const observer = new IntersectionObserver((entries) => {
  if (entries.some(e => e.isIntersecting)) fetchPage();
}, { rootMargin: '800px 0px 800px 0px' });

function maybeAutofillViewport() {
  const room = document.documentElement.scrollHeight - window.innerHeight;
  if (!endReached && room < 1600 && !loading) setTimeout(() => fetchPage(), 0);
}

// ---------- Kick-off ----------
observer.observe(sentinel);
fetchPage();
