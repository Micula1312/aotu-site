````markdown
# Archive of the Untamed — Astro Starter

Questo repository contiene il sito della tesi **Archive of the Untamed** costruito con [Astro](https://astro.build), tema "terminal", **sidebar/indice** comune, audio di background e pagina **Archive** collegata in modalità headless a WordPress.

## Requisiti

- **Node.js 18+** (consigliato 20)
- **Git**

## Installazione e avvio

```bash
# Installa le dipendenze
npm install

# Avvia l'ambiente di sviluppo
npm run dev
# → apri http://localhost:4321

# Build per la produzione
npm run build

# Anteprima della build
npm run preview
````

## Struttura del progetto

```
/public
  /css/terminal.css             # Stile tema terminale
  /js/core.js                   # Toggle tema + mute audio
  /js/index.js                  # Effetto typewriter per index
  /js/archive.js                # Fetch WP REST + griglia + lightbox
  /assets/audio/soundscape.mp3  # Audio di background
/src
  /components/Sidebar.astro     # Sidebar/Indice condivisa
  /components/Header.astro      # Header comune
  /layouts/Base.astro           # Layout a due colonne
  /pages/index.astro            # Home
  /pages/abstract.astro         # Abstract
  /pages/manifesto.astro        # Manifesto
  /pages/archive.astro          # Archive
/.github/workflows/deploy.yml   # Deploy GitHub Pages
```

## Import JS e avviso `is:inline`

Quando importi script da `/public` in un file `.astro`, aggiungi l’attributo `is:inline` per evitare il bundling automatico di Astro:

```astro
<script src="/js/index.js" is:inline></script>
```

Questo vale per tutti i file in `/public/js/`.

## Configurazione

* **URL del sito**: imposta `site` in `astro.config.mjs`.
* **Audio**: percorso in `Base.astro` → `<source src="/assets/audio/soundscape.mp3" ...>`.
* **Endpoint WordPress**: modifica `WP_API_URL` in `public/js/archive.js`.

## Deploy su GitHub Pages

1. Commit & push di tutto (incluso `/.github/workflows/deploy.yml`).
2. Su GitHub → **Settings → Pages** → Source: **GitHub Actions**.
3. Ogni push su `main` avvia build e deploy automatico.

## Note

* Usa `core.js` per gestione tema e audio.
* Aggiorna `Sidebar.astro` per modificare l’indice.
* Per SEO, valuta il fetch dei contenuti WP in fase di build.

---

**Autrice:** Micol Gelsi — *Archive of the Untamed*

```
```
