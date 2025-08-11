// AOTU Network — lista a righe 4 colonne (Name | Location | Kind | Website)

const listEl =
  document.getElementById('networkList') ||
  document.getElementById('list') ||
  document.getElementById('grid');
const state = document.getElementById('state');
const kindSel = document.getElementById('kind');
const qInput = document.getElementById('q');
const refreshBtn = document.getElementById('refresh');
const sortSel = document.getElementById('sort');

const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const WP_DOMAIN = 'https://thearchiveoftheuntamed.xyz';
const WP_ROOT = isDev ? '' : WP_DOMAIN;

let API_BASE = null;

async function detectApiBase() {
  const ok = async (u) => { try { const r = await fetch(u); return r.ok; } catch { return false; } };
  if (await ok(`${WP_ROOT}/wp-json/`))      API_BASE = `${WP_ROOT}/wp-json/wp/v2`;
  else if (await ok(`${WP_ROOT}/wp/wp-json/`)) API_BASE = `${WP_ROOT}/wp/wp-json/wp/v2`;
  else { console.error('[network] REST non raggiungibile'); API_BASE = `${WP_ROOT}/wp-json/wp/v2`; }
}
async function ensureApi(){ if (!API_BASE) await detectApiBase(); }

const esc = (s) => s ? String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])) : '';
const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

async function fetchKinds() {
  try {
    await ensureApi();
    const r = await fetch(`${API_BASE}/aotu_kind?per_page=100&_fields=id,name,slug`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const kinds = await r.json();
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

let CACHE = [];
async function fetchNodes() {
  if (state) { state.hidden = false; state.textContent = 'Loading…'; }
  if (listEl) listEl.hidden = true;

  try {
    await ensureApi();

    const params = new URLSearchParams();
    params.set('per_page', '100');
    params.set('_fields', 'id,title,excerpt,meta,link,date');
    params.set('_embed', '1'); // include termini

    const kind = kindSel?.value || '';
    if (kind) params.set('aotu_kind', kind);

    const q = (qInput?.value || '').trim();
    if (q) params.set('search', q);

    const url = `${API_BASE}/aotu_node?${params.toString()}`;
    const r = await fetch(url);
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

    render();
  } catch (e) {
    console.error('[network] nodes fetch error:', e);
    if (state) { state.hidden = false; state.textContent = 'Error loading nodes'; }
  }
}

function primaryKind(item) {
  // se WP ritorna i termini in _embedded
  const termsGroups = item?._embedded?.['wp:term'];
  if (Array.isArray(termsGroups) && termsGroups.length && termsGroups[0].length) {
    return termsGroups[0][0]?.name || '';
  }
  return '';
}

function render() {
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!CACHE.length) {
    if (state) { state.hidden = false; state.textContent = 'No results — try another kind or search.'; }
    listEl.hidden = true; return;
  }

  if (state) state.hidden = true;
  listEl.hidden = false;

  CACHE.forEach(item => {
    const title = esc(item.title?.rendered || 'Untitled');
    const city = esc((item.meta?.city || '').trim());
    const country = esc((item.meta?.country || '').trim());
    const kind = esc(primaryKind(item) || '');
    const website = (item.meta?.website || '').trim();

    const row = document.createElement('div');
    row.className = 'network-card';
    row.innerHTML = `
      <div data-label="Name">${title}</div>
      <div data-label="Location">${[city, country].filter(Boolean).join(' · ')}</div>
      <div data-label="Kind">${kind}</div>
      <div data-label="Website">${website ? `<a href="${website}" target="_blank" rel="noopener">link</a>` : ''}</div>
    `;
    listEl.appendChild(row);
  });
}

refreshBtn?.addEventListener('click', fetchNodes);
kindSel?.addEventListener('change', fetchNodes);
sortSel?.addEventListener('change', fetchNodes);
qInput?.addEventListener('input', debounce(fetchNodes, 300));

console.log('[network] boot');
(async function init(){ await fetchKinds(); await fetchNodes(); })();
