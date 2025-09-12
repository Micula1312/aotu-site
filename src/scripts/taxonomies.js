const list = document.getElementById('taxo-list');
if (!list) {
  console.warn('[taxonomies] #taxo-list non trovato');
} else {
  // Normalizzazione BASE (front-end) e API_BASE (WP v2)
  const BASE = (list.dataset.base || '/').replace(/\/+$/, '/') || '/';
  let apiBase = list.dataset.apiBase || window.__WP_API_BASE || '/wp-json/wp/v2';

  // Normalizza apiBase: può essere relativo ("/wp-json/wp/v2") o assoluto ("https://.../wp-json/wp/v2")
  try {
    if (!/^https?:\/\//i.test(apiBase)) {
      // relativo: forza leading slash e unico trailing slash
      apiBase = ('/' + apiBase.replace(/^\/+/, '')).replace(/\/+$/, '') + '/';
    } else {
      // assoluto: mantieni origin+pathname con unico trailing slash
      const u = new URL(apiBase);
      apiBase = (u.origin + u.pathname).replace(/\/+$/, '') + '/';
    }
  } catch (e) {
    console.error('[taxonomies] API base non valida:', apiBase, e);
    apiBase = '/wp-json/wp/v2/';
  }

  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    }
    children.forEach(c => node.append(c));
    return node;
  };

  // Join "sicuro": apiBase già finisce con "/", path non deve iniziare con "/"
  const api = (path) => {
    const clean = String(path).replace(/^\/+/, '');
    if (/^https?:\/\//i.test(apiBase)) return new URL(clean, apiBase).toString();
    return apiBase + clean;
  };

  const fmtCount = (n) => `<small class="dim">(${n})</small>`;

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  async function loadTaxonomies() {
    list.innerHTML = '<li class="dim">Caricamento…</li>';
    try {
      // ⚠️ apiBase è già ".../wp/v2/", quindi qui chiediamo solo "taxonomies"
      const taxos = await fetchJSON(api('taxonomies?_fields=name,slug,rest_base,types,hierarchical'));
      const entries = Object.entries(taxos)
        .filter(([, t]) => Array.isArray(t.types) && t.types.length)
        .sort((a, b) => a[1].name.localeCompare(b[1].name, 'it'));

      if (!entries.length) {
        list.innerHTML = '<li class="dim">Nessuna tassonomia trovata.</li>';
        return;
      }

      list.innerHTML = '';

      for (const [slug, t] of entries) {
        const group = el('li', { class: 'group' });
        group.append(el('h2', { html: t.name }));

        // rest_base per i termini (es: "categories", "post_tag", o custom)
        const rest = t.rest_base || slug;

        // Paginazione termini
        let page = 1;
        const terms = [];
        while (true) {
          const url = api(`${encodeURIComponent(rest)}?per_page=100&page=${page}&_fields=id,name,slug,count`);
          const res = await fetch(url);
          if (!res.ok) break;
          const chunk = await res.json();
          terms.push(...chunk);
          const totalPages = Number(res.headers.get('X-WP-TotalPages') || '1');
          if (page >= totalPages) break;
          page++;
        }

        if (!terms.length) {
          group.append(el('div', { class: 'dim', html: '— nessun termine —' }));
          list.append(group);
          continue;
        }

        terms.sort((a, b) => a.name.localeCompare(b.name, 'it'));

        const ul = el('ul');
        for (const term of terms) {
          const href = `${BASE}archive?tax=${encodeURIComponent(slug)}&term=${encodeURIComponent(term.slug)}`;
          const li = el('li');
          const a = el('a', { href, html: term.name });
          li.append(a);
          li.insertAdjacentHTML('beforeend', ' ' + fmtCount(term.count ?? 0));
          ul.append(li);
        }

        group.append(ul);
        list.append(group);
      }
    } catch (err) {
      console.error('[taxonomies] errore:', err);
      list.innerHTML = `<li class="dim">Errore nel caricamento delle tassonomie. <code>${String(err.message || err)}</code></li>`;
    }
  }

  loadTaxonomies();
}
