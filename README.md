# Archive of the Untamed — Astro Starter

Questo repository contiene il sito della tesi **Archive of the Untamed** costruito con [Astro](https://astro.build), tema "terminal", **sidebar/indice** comune, audio di background e pagina **Archive** collegata in modalità headless a WordPress.

**Live:** https://micula1312.github.io/aotu-site/

---

## Requisiti

- **Node.js 18+** (consigliato 20)
- **Git**
- (opzionale) **MAMP** per far girare WordPress in locale su `http://localhost/`

---

## Installazione e avvio

```bash
# Installa le dipendenze
npm install

# Avvia l'ambiente di sviluppo (WP locale su http://localhost)
npm run dev
# → apri http://localhost:4321

# Build per la produzione (GitHub Pages)
npm run build:gh

# Anteprima della build
npm run preview
Variabili d’ambiente
Il progetto usa due file nascosti nella root:

.env (sviluppo locale con WP in MAMP):

ini
Copia codice
DEPLOY_TARGET=domain
WP_TARGET=http://localhost
VITE_WP_API=/wp-json
.env.production (produzione su GitHub Pages con WP remoto in /wp):

ini
Copia codice
DEPLOY_TARGET=ghpages
WP_TARGET=https://thearchiveoftheuntamed.xyz/wp
VITE_WP_API=https://thearchiveoftheuntamed.xyz/wp/wp-json
Nel codice usa sempre:

js
Copia codice
const API = import.meta.env.VITE_WP_API;
Struttura del progetto
bash
Copia codice
/src
  /components/Sidebar.astro     # Sidebar/Indice condivisa
  /components/Header.astro      # Header comune
  /layouts/Base.astro           # Layout a due colonne + audio bg
  /pages/index.astro            # Home
  /pages/abstract.astro         # Abstract
  /pages/manifesto.astro        # Manifesto
  /pages/archive.astro          # Archive (fetch da WP)
  /scripts/core.js              # Toggle tema + mute audio
  /scripts/index.js             # Effetto typewriter per index
  /scripts/archive.js            # Fetch WP REST + griglia + lightbox
  /styles/terminal.css          # Stile tema terminale
  /assets/audio/soundscape.mp3  # Audio di background
/public                         # Vuota (solo passthrough se serve)
/.github/workflows/deploy.yml   # Deploy GitHub Pages
astro.config.mjs                # Config Astro (site/base, proxy WP)
Import JS e CSS
Gli asset si trovano in src/ e vanno importati così:

astro
Copia codice
---
import "../styles/terminal.css";
import "../scripts/index.js";
---
Oppure con <script type="module">:

astro
Copia codice
<script type="module" src="/src/scripts/index.js"></script>
⚠️ Non serve più is:inline (era valido solo per file in /public).

Configurazione
Dominio / GitHub Pages: gestito da astro.config.mjs tramite DEPLOY_TARGET.

Audio: percorso in Base.astro → <source src="/src/assets/audio/soundscape.mp3">.

Endpoint WP: definito tramite variabili .env.

Deploy su GitHub Pages
In astro.config.mjs per ghpages assicurati di avere:

js
Copia codice
site: 'https://micula1312.github.io/aotu-site/',
base: '/aotu-site/',
Commit & push su main.

Il workflow /.github/workflows/deploy.yml builda e pubblica automaticamente.
Su GitHub → Settings → Pages → Source: GitHub Actions.

Note
Usa core.js per gestione tema e audio.

Aggiorna Sidebar.astro per modificare l’indice.

In futuro si può fetchare WP in fase di build per migliorare SEO.

Autrice: Micol Gelsi — Archive of the Untamed