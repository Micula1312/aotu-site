// AOTU Network — lista 4 colonne con barra filtri su una riga
// Server-side: search + kind  |  Client-side: city + tag  |  Sort: A→Z / Z→A / recenti

// ---------- DOM refs ----------
const listEl =
  document.getElementById('networkList') ||
  document.getElementById('list') ||
  document.getElementById('grid');
const state = document.getElementById('state');

const qInput    = document.getElementById('q');
const cityInput = document.getElementById('city');
const tagInput  = document.getElementById('tag');
const kindSel   = document.getElementById('kind');
const sortSel   = document.getElementById('sort');
const refreshBtn= document.getElementById('refresh');

// ---------- API base (dev/prod via .env già esistente) ----------
const API_BASE =
  (import.meta.env && import.meta.env.PUBLIC_WP_API_BASE)
    ? import.meta.env.PUBLIC_WP_API_BASE.replace(/\/$/, '')
    : 'https://thearchiveoftheuntamed.xyz/wp/wp-json/wp/v2';

// Endpoints WP REST (CPT + Taxonomy)
const EP_KINDS = `${API_BASE}/aotu_kind`;
const EP_NODES = `${API_BASE}/aotu_node`; // CPT "Network Nodes" esposto via wp/v2
console.log('[network] API_BASE', API_BASE);

// ---------- Helpers ----------
const esc = (s) => s ? String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])) : '';
const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
const pick = (...vals) => vals.find(v => v !== undefined && v !== null && String(v).trim() !== '') || '';

function getCity(it){ return pick(it?.meta?.city, it?.acf?.city); }
function getCountry(it){ return pick(it?.meta?.country, it?.acf?.country); }
function getWebsite(it){ return pick(it?.meta?.website, it?.acf?.website, it?.link); }
function getTags(it){ return (pick(it?.meta?.tags, it?.acf?.tags) || '').toLowerCase(); }

function getKindName(it){
  const term = it?._embedded?.['wp:term']?.flat()?.find(t => t.taxonomy === 'aotu_kind');
  return term?.name || pick(it?.meta?.kind, it?.acf?.kind, '—');
}

// ---------- KINDS (select) ----------
async function fetchKinds() {
  try {
    const r = await fetch(`${EP_KINDS}?per_page=100&_fields=id,name,slug`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const kinds = await r.json();
    if (!Array.isArray(kinds)) return;

    // ripulisci mantenendo la prima option
    kindSel?.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
    kinds.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.slug; opt.textContent = k.name;
      kindSel?.appendChild(opt);
    });
  } catch (e) {
    console.warn('[network] kinds error:', e);
  }
}

// ---------- NODES ----------
let RAW = [];   // risposta server (tutta)
let CACHE = []; // dopo filtri client-side (city/tag) e sort

async function fetchNodes() {
  try {
    if (state) { state.hidden = false; state.textContent = 'Loading…'; }
    if (listEl) listEl.innerHTML = '';

    const params = new URLSearchParams();
    params.set('per_page', '100');
    params.set('_fields', 'id,title,excerpt,meta,link,date');
    params.set('_embed', '1'); // include termini + featured

    const kind = kindSel?.value || '';
    if (kind) params.set('aotu_kind', kind); // filtro server-side per tassonomia

    const q = (qInput?.value || '').trim();
    if (q) params.set('search', q); // WP core: cerca su title+content+excerpt

    const url = `${EP_NODES}?${params.toString()}`;
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);

    const data = await r.json();
    RAW = Array.isArray(data) ? data : [];

    applyClientFiltersAndRender();
  } catch (e) {
    console.error('[network] fetchNodes error:', e);
    if (state) { state.hidden = false; state.textContent = 'Error loading network.'; }
  }
}

// Applica filtri client-side (city, tag) + ordinamento e render
function applyClientFiltersAndRender(){
  const cityQ = (cityInput?.value || '').trim().toLowerCase();
  const tagQ  = (tagInput ?.value || '').trim().toLowerCase();

  // filtra per city/tag leggendo i meta esposti in REST
  CACHE = RAW.filter(it => {
    const city = (getCity(it) || '').toLowerCase();
    const tags = getTags(it); // stringa "forest, urban, legal" → match .includes
    const okCity = cityQ ? city.includes(cityQ) : true;
    const okTag  = tagQ  ? tags.includes(tagQ) : true;
    return okCity && okTag;
  });

  // ordinamento
  const mode = sortSel?.value || 'az';
  const byTitle = (a,b) => (a.title?.rendered || '').localeCompare(b.title?.rendered || '', undefined, {sensitivity:'base'});
  const byDate  = (a,b) => new Date(b.date) - new Date(a.date);
  if (mode === 'az')  CACHE.sort(byTitle);
  if (mode === 'za')  CACHE.sort((a,b)=>byTitle(b,a));
  if (mode === 'new') CACHE.sort(byDate);

  renderList();
}

function renderList() {
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!CACHE.length) {
    if (state) { state.hidden = false; state.textContent = 'No results'; }
    return;
  }
  if (state) state.hidden = true;

  CACHE.forEach(item => {
    const title = esc(item?.title?.rendered || '—');
    const city = esc(getCity(item));
    const country = esc(getCountry(item));
    const kind = esc(getKindName(item));
    const website = esc(getWebsite(item));

    const row = document.createElement('div');
    row.className = 'network-card';
    row.innerHTML = `
      <div data-label="Name">${title}</div>
      <div data-label="Location">${[city, country].filter(Boolean).join(' · ')}</div>
      <div data-label="Kind">${kind}</div>
      <div data-label="Website">${website ? `<a href="${website}" target="_blank" rel="noopener">link</a>` : ''}</div>
    `;
    listEl.appendChild(row);

    // click → dialog dettagli (se presente nel DOM)
    row.addEventListener('click', () => openNode(item.id));
    row.style.cursor = 'pointer';
  });
}

// ---------- DIALOG DETTAGLIO (come tua versione attuale) ----------
async function openNode(id){
  const dlg = document.getElementById('node');
  if (!dlg) return;

  try {
    const r = await fetch(`${EP_NODES}/${id}?_embed=1`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const it = await r.json();

    const nodeTitle = document.getElementById('nodeTitle');
    const nodeInfo  = document.getElementById('nodeInfo');
    const nodeTerms = document.getElementById('nodeTerms');
    const nodeLinks = document.getElementById('nodeLinks');
    const media     = document.getElementById('nodeMedia');
    const body      = document.getElementById('nodeBody');

    const title = it?.title?.rendered || '—';
    const kind  = getKindName(it);
    const city  = getCity(it), country = getCountry(it);
    const website = getWebsite(it);

    if (nodeTitle) nodeTitle.innerHTML = esc(title);
    if (nodeInfo)  nodeInfo.textContent = [city, country].filter(Boolean).join(' · ');
    if (nodeTerms) nodeTerms.textContent = kind ? String(kind) : '';

    if (nodeLinks) {
      nodeLinks.innerHTML = '';
      if (website) {
        const a = document.createElement('a');
        a.href = website; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = 'website';
        nodeLinks.appendChild(a);
      }
    }

    if (body) body.innerHTML = it?.excerpt?.rendered || '';

    if (media) {
      media.innerHTML = '';
      const logoUrl = pick(it?.meta?.logo?.source_url, it?.acf?.logo?.url);
      if (logoUrl) {
        const img = new Image();
        img.src = logoUrl; img.alt = title; media.appendChild(img);
      } else if (it._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
        const img = new Image();
        img.src = it._embedded['wp:featuredmedia'][0].source_url;
        img.alt = title; media.appendChild(img);
      }
    }

    dlg.showModal();
  } catch (e) {
    console.error('[network] openNode error:', e);
  }
}

// ---------- Events ----------
const doFetch = debounce(fetchNodes, 250);
qInput   ?.addEventListener('input', doFetch);     // server-side
kindSel  ?.addEventListener('change', fetchNodes); // server-side
sortSel  ?.addEventListener('change', applyClientFiltersAndRender); // client-side
cityInput?.addEventListener('input', debounce(applyClientFiltersAndRender, 150)); // client-side
tagInput ?.addEventListener('input', debounce(applyClientFiltersAndRender, 150)); // client-side
refreshBtn?.addEventListener('click', fetchNodes);

// ---------- Boot ----------
console.log('[network] boot');
(async function init(){ await fetchKinds(); await fetchNodes(); })();
