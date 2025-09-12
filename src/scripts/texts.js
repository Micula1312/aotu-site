// Dev/prod safe: in dev usa /wp-json (proxy Vite), in prod window.__WP_API_URL (…/wp-json)
const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
let API_BASE;
if (typeof window !== 'undefined' && window.__WP_API_URL) {
  API_BASE = window.__WP_API_URL.replace(/\/$/, '');
} else if (isLocal) {
  API_BASE = '/wp-json';
} else {
  API_BASE = 'https://thearchiveoftheuntamed.xyz/wp-json';
}

const ENDPOINT = `${API_BASE}/aotu/v1/texts`; // usa il tuo endpoint custom (supporta paging/filtri server)
console.info('[texts] ENDPOINT:', ENDPOINT);

// UI
const $form  = document.getElementById('texts-filters');
const $list  = document.getElementById('texts-list');
const $more  = document.getElementById('texts-more');
const $count = document.getElementById('texts-count');
const $stat  = document.getElementById('texts-status');

// blocca submit/enter
$form?.addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); });
$form?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); scheduleFetch(); } });

let state = { page: 1, pages: 1, per_page: 24, total: 0, items: [] };

const qs = (o) => new URLSearchParams(o).toString();
const escapeHTML = (s='') => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const setStatus = (m) => { if ($stat) { $stat.textContent = m || ''; $stat.hidden = !m; } };

function card(it){
  const by = [it.author, it.year, it.publisher, it.city].filter(Boolean).join(' · ');
  const tags = [...(it.types||[]), ...(it.tags||[])].join(' • ');
  return `
  <article class="bib-card">
    <header>
      <h3>${escapeHTML(it.title || 'Untitled')}</h3>
      ${by ? `<div class="muted">${escapeHTML(by)}</div>` : ''}
    </header>
    ${it.excerpt ? `<p class="mt-1">${it.excerpt}</p>` : ''}
    <footer class="mt-2 small muted">
      ${tags ? `<span>${escapeHTML(tags)}</span>` : ''}
      ${it.url ? `<a class="ml-2" href="${it.url}" target="_blank" rel="noopener">link</a>` : ''}
      ${it.permalink ? `<a class="ml-2" href="${it.permalink}" target="_blank" rel="noopener">view</a>` : ''}
      ${it.doi ? `<span class="ml-2">DOI: ${escapeHTML(it.doi)}</span>` : ''}
      ${it.isbn ? `<span class="ml-2">ISBN: ${escapeHTML(it.isbn)}</span>` : ''}
    </footer>
  </article>`;
}

function paramsFromForm(){
  const fd = new FormData($form || undefined);
  const data = fd ? Object.fromEntries(fd.entries()) : {};
  data.q = (data.q || '').trim();
  data.per_page = state.per_page;
  data.page = state.page;
  return data;
}

async function fetchPage(append=false){
  const p = paramsFromForm();
  const url = `${ENDPOINT}?${qs(p)}`;
  setStatus('Loading…'); if ($more) $more.disabled = true;
  try{
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP '+r.status);
    const j = await r.json();

    state.page  = j.page;
    state.pages = j.pages;
    state.total = j.total;

    if (!append){ state.items = []; $list && ($list.innerHTML = ''); }
    state.items.push(...j.items);

    const html = j.items.map(card).join('');
    $list?.insertAdjacentHTML('beforeend', html);

    if ($count) $count.textContent = `${state.total} results`;
    if ($more)  $more.disabled = state.page >= state.pages;
    setStatus(j.total === 0 ? 'No results.' : '');
  }catch(err){
    console.error(err);
    setStatus('Error loading texts (CORS/API).');
    if ($more) $more.disabled = false;
  }
}

let t;
function scheduleFetch(){ clearTimeout(t); t = setTimeout(()=>{ state.page = 1; fetchPage(false); }, 250); }

$form?.addEventListener('input', scheduleFetch);
$form?.querySelector('button[type="reset"]')?.addEventListener('click', ()=> setTimeout(scheduleFetch, 0));
$more?.addEventListener('click', ()=> { if (state.page < state.pages){ state.page += 1; fetchPage(true); } });

// first load
fetchPage(false);
