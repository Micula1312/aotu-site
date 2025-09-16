// AOTU Network — ES module
// Lista a 4 colonne (Name | Location | Kind | Website) + dialog dettagli opzionale

// ---------- DOM refs ----------
const listEl =
  document.getElementById('networkList') ||
  document.getElementById('list') ||
  document.getElementById('grid');
const state = document.getElementById('state');
const kindSel = document.getElementById('kind');
const qInput = document.getElementById('q');
const refreshBtn = document.getElementById('refresh');
const sortSel = document.getElementById('sort');

// ---------- API base (dev/prod via .env) ----------
const API_BASE =
  (import.meta.env && import.meta.env.PUBLIC_WP_API_BASE)
    ? import.meta.env.PUBLIC_WP_API_BASE.replace(/\/$/, '')
    : 'https://thearchiveoftheuntamed.xyz/wp/wp-json/wp/v2';

// Endpoint custom (come da tuo repo precedente)
const EP_KINDS = `${API_BASE}/aotu_kind`;
const EP_NODES = `${API_BASE}/aotu_node`;

// ---------- Helpers ----------
const esc = (s) => s ? String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])) : '';
const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

// Leggi campi noti da meta/ACF
const pick = (...vals) => vals.find(v => v !== undefined && v !== null && String(v).trim() !== '') || '';
function getCity(it){ return pick(it?.meta?.city, it?.acf?.city); }
function getCountry(it){ return pick(it?.meta?.country, it?.acf?.country); }
function getWebsite(it){ return pick(it?.meta?.website, it?.acf?.website, it?.link); }
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
let CACHE = [];

async function fetchNodes() {
  try {
    if (state) { state.hidden = false; state.textContent = 'Loading…'; }
    if (listEl) listEl.innerHTML = '';

    const params = new URLSearchParams();
    params.set('per_page', '100');
    params.set('_fields', 'id,title,excerpt,meta,link,date');
    params.set('_embed', '1'); // include termini + featured

    const kind = kindSel?.value || '';
    if (kind) params.set('aotu_kind', kind);

    const q = (qInput?.value || '').trim();
    if (q) params.set('search', q);

    const url = `${EP_NODES}?${params.toString()}`;
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);

    const data = await r.json();
    CACHE = Array.isArray(data) ? data : [];

    // ordinamento
    const mode = sortSel?.value || 'az';
    const byTitle = (a,b) => (a.title?.rendered || '').localeCompare(b.title?.rendered || '', undefined, {sensitivity:'base'});
    const byDate  = (a,b) => new Date(b.date) - new Date(a.date);
    if (mode === 'az')  CACHE.sort(byTitle);
    if (mode === 'za')  CACHE.sort((a,b)=>byTitle(b,a));
    if (mode === 'new') CACHE.sort(byDate);

    renderList();
  } catch (e) {
    console.error('[network] fetchNodes error:', e);
    if (state) { state.hidden = false; state.textContent = 'Error loading network.'; }
  }
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

// ---------- DIALOG DETTAGLIO ----------
async function openNode(id){
  // se non c'è dialog, esci silenziosamente
  const dlg = document.getElementById('node');
  if (!dlg) return;

  try {
    const r = await fetch(`${EP_NODES}/${id}?_embed=1`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const it = await r.json();

    // header
    const title = it?.title?.rendered || '—';
    const kind = getKindName(it);
    const city = getCity(it), country = getCountry(it);
    const website = getWebsite(it);

    const nodeTitle = document.getElementById('nodeTitle');
    const nodeInfo  = document.getElementById('nodeInfo');
    const nodeTerms = document.getElementById('nodeTerms');
    const nodeLinks = document.getElementById('nodeLinks');
    const media     = document.getElementById('nodeMedia');
    const body      = document.getElementById('nodeBody');

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
      // puoi aggiungere social, email, ecc. se in meta/ACF
    }

    // body (excerpt)
    if (body) body.innerHTML = it?.excerpt?.rendered || '';

    // media (logo ACF o featured image)
    if (media) {
      media.innerHTML = '';
      const logoUrl = pick(it?.meta?.logo?.source_url, it?.acf?.logo?.url);
      if (logoUrl) {
        const img = new Image();
        img.src = logoUrl; img.alt = title;
        media.appendChild(img);
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
refreshBtn?.addEventListener('click', fetchNodes);
kindSel?.addEventListener('change', fetchNodes);
sortSel?.addEventListener('change', fetchNodes);
qInput?.addEventListener('input', debounce(fetchNodes, 300));

// ---------- Boot ----------
console.log('[network] boot');
(async function init(){ await fetchKinds(); await fetchNodes(); })();
