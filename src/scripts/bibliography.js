// ---------- Config base ----------
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

let API_BASE;
if (typeof window !== 'undefined' && window.__WP_API_URL) {
  API_BASE = window.__WP_API_URL.replace(/\/$/, '');
} else if (isLocal) {
  API_BASE = '/wp-json'; // dev → proxy Vite
} else {
  API_BASE = 'https://thearchiveoftheuntamed.xyz/wp-json';
}

const ENDPOINT = `${API_BASE}/aotu/v1/texts`;
const TAGS_EP  = `${API_BASE}/wp/v2/aotu_bib_tag?_fields=name,slug&per_page=100`;
const TYPES_EP = `${API_BASE}/wp/v2/aotu_bib_type?_fields=name,slug&per_page=100`;

console.info('[bibliography] API_BASE:', API_BASE);
console.info('[bibliography] ENDPOINT:', ENDPOINT);
console.info('[bibliography] TAGS_EP:', TAGS_EP);
console.info('[bibliography] TYPES_EP:', TYPES_EP);

// ---------- UI refs ----------
const $form   = document.getElementById('bib-filters');
const $list   = document.getElementById('bib-results');
const $more   = document.getElementById('bib-loadmore');
const $count  = document.getElementById('bib-count');
const $status = document.getElementById('bib-status');
const $reset  = document.getElementById('bib-reset');
const $expCSV = document.getElementById('bib-export-csv');
const $expBIB = document.getElementById('bib-export-bib');
const $dlTag  = document.getElementById('dl-tag');
const $dlType = document.getElementById('dl-type');

// se il form non c'è, esci con un messaggio chiaro
if (!$form || !$list) {
  console.warn('[bibliography] Missing #bib-filters or #bib-results in HTML');
}

// Blocca submit/enter
$form?.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation(); });
$form?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); scheduleFetch(); }
});

// ---------- Stato ----------
let state = {
  page: 1,
  pages: 1,
  per_page: 24,
  itemsCache: [],
  lastParams: {}
};

// ---------- Utils ----------
const qs = (params) => new URLSearchParams(params).toString();
const setStatus = (msg) => { if ($status) { $status.textContent = msg || ''; $status.hidden = !msg; } };
const escapeHTML = (s='') => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------- Autocomplete (tags/types) ----------
async function loadTaxonomies() {
  setStatus('Loading vocab…');
  try {
    const [rTags, rTypes] = await Promise.all([fetch(TAGS_EP), fetch(TYPES_EP)]);
    console.info('[bibliography] taxo status:', rTags.status, rTypes.status);
    if (!rTags.ok || !rTypes.ok) throw new Error(`HTTP tags=${rTags.status} types=${rTypes.status}`);

    const [tags, types] = await Promise.all([rTags.json(), rTypes.json()]);
    if ($dlTag)  $dlTag.innerHTML  = tags.map(t => `<option value="${t.slug}">${escapeHTML(t.name)}</option>`).join('');
    if ($dlType) $dlType.innerHTML = types.map(t => `<option value="${t.slug}">${escapeHTML(t.name)}</option>`).join('');
    setStatus('');
  } catch (e) {
    console.warn('[bibliography] autocomplete failed:', e);
    setStatus('Autocomplete unavailable (api).');
  }
}

// ---------- First load ----------
(async function init() {
  // 1) autocomplete
  loadTaxonomies();

  // 2) params da URL → form
  const urlParams = readParamsFromURL();
  state.per_page = urlParams.per_page || state.per_page;
  fillForm(urlParams);

  // 3) prima fetch
  await fetchPage(urlParams, false);
})();
