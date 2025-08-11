// AOTU Network — griglia nodi (CPT aotu_node) con filtro "Kinds", ricerca e sort

// ---------- UI refs ----------
const grid = document.getElementById('grid');
const state = document.getElementById('state');
const kindSel = document.getElementById('kind');
const qInput = document.getElementById('q');
const refreshBtn = document.getElementById('refresh');
const sortSel = document.getElementById('sort');

// ---------- ENV / API base autodetect ----------
const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
// In dev: usa proxy Vite/Astro (WP_ROOT = ""), in prod: dominio reale
const WP_DOMAIN = 'https://thearchiveoftheuntamed.xyz';
const WP_ROOT = isDev ? '' : WP_DOMAIN;

// Es: ".../wp-json/wp/v2" oppure ".../wp/wp-json/wp/v2"
let API_BASE = null;

async function detectApiBase() {
  const ok = async (u) => {
    try { const r = await fetch(u, { method: 'GET' }); return r.ok; }
    catch { return false; }
  };
  const root = `${WP_ROOT}/wp-json/`;
  const sub  = `${WP_ROOT}/wp/wp-json/`;

  if (await ok(root))       API_BASE = `${WP_ROOT}/wp-json/wp/v2`;
  else if (await ok(sub))   API_BASE = `${WP_ROOT}/wp/wp-json/wp/v2`;
  else {
    console.error('[network] WP REST non raggiungibile (root o /wp)');
    API_BASE = `${WP_ROOT}/wp-json/wp/v2`; // fallback
  }
}
async function ensureApi() { if (!API_BASE) await detectApiBase(); }

// ---------- Utils ----------
const esc = (s) => s ? String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])) : '';
const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

// ---------- Fetch kinds ----------
async function fetchKinds() {
  try {
    await ensureApi();
    const r = await fetch(`${API_BASE}/aotu_kind?per_page=100&_fields=id,name,slug`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const kinds = await r.json();
    // reset opzioni (lascia "All kinds")
    kindSel.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
    kinds.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.slug;
      opt.textContent = k.name;
      kindSel.appendChild(opt);
    });
  } catch (e) {
    console.warn('[network] errore kinds:', e);
  }
}

// ---------- Fetch nodes ----------
let CACHE = [];

async function fetchNodes() {
  if (state) { state.hidden = false; state.textContent = 'Loading…'; }
  if (grid) grid.hidden = true;

  try {
    await ensureApi();

    const params = new URLSearchParams();
    params.set('per_page', '100');
    params.set('_fields', 'id,title,excerpt,meta,link,date');

    const kind = kindSel?.value || '';
    if (kind) params.set('aotu_kind', kind);

    const q = (qInput?.value || '').trim();
    if (q) params.set('search', q);

    const url = `${API_BASE}/aotu_node?${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);

    const data = await r.json();
    CACHE = Array.isArray(data) ? data : [];

    // ---- ordinamento
    const mode = sortSel?.value || 'az';
    const byTitle = (a,b) => (a.title?.rendered || '').localeCompare(
      b.title?.rendered || '', undefined, { sensitivity: 'base' }
    );
    const byDate  = (a,b) => new Date(b.date) - new Date(a.date);

    if (mode === 'az')  CACHE.sort(byTitle);
    if (mode === 'za')  CACHE.sort((a,b) => byTitle(b,a));
    if (mode === 'new') CACHE.sort(byDate);

    render();
  } catch (e) {
    console.error('[network] nodes fetch error:', e);
    if (state) { state.hidden = false; state.textContent = 'Error loading nodes'; }
  }
}

// ---------- Render ----------
function render() {
  if (!grid) return;
  grid.innerHTML = '';

  if (!CACHE.length) {
    if (state) { state.hidden = false; state.textContent = 'No results — try another kind or search.'; }
    grid.hidden = true;
    return;
  }

  if (state) state.hidden = true;
  grid.hidden = false;

  CACHE.forEach(item => {
    const title = esc(item.title?.rendered || 'Untitled');
    const city = esc(item.meta?.city || '');
    const country = esc(item.meta?.country || '');
    const website = (item.meta?.website || '').trim();
    const instagram = (item.meta?.instagram || '').trim();
    const tags = esc((item.meta?.tags || '').trim());

    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <a href="#" aria-label="Open ${title}">
        <div class="ph" aria-hidden="true">NODE</div>
        <div class="meta">
          <h3 class="title">${title}</h3>
          <div class="muted">${[city, country].filter(Boolean).join(' · ')}</div>
          ${tags ? `<div class="muted">${tags}</div>` : ''}
          <div style="margin-top:6px; display:flex; gap:10px; flex-wrap:wrap;">
            ${website ? `<a class="chip" href="${website}" target="_blank" rel="noopener">website</a>` : ''}
            ${instagram ? `<a class="chip" href="${instagram}" target="_blank" rel="noopener">@instagram</a>` : ''}
            <a class="chip" href="${item.link}" target="_blank" rel="noopener">on_wordpress</a>
          </div>
        </div>
      </a>
    `;
    grid.appendChild(card);
  });
}

// ---------- Events ----------
refreshBtn?.addEventListener('click', fetchNodes);
kindSel?.addEventListener('change', fetchNodes);
sortSel?.addEventListener('change', fetchNodes);
qInput?.addEventListener('input', debounce(fetchNodes, 300));

// ---------- Boot ----------
console.log('[network] boot');
(async function init(){
  await fetchKinds();
  await fetchNodes();
})();
