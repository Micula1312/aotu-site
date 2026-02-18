// js/core.js — theme, audio, neon, sidebar (mobile + desktop) + drawers state

// ========== THEME ==========
const THEME_KEY = 'aotuTheme';
const themeBtn = document.getElementById('themeBtn');

function applyTheme(t) {
  if (t === 'light') document.body.dataset.theme = 'light';
  else delete document.body.dataset.theme;

  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', String(t === 'light'));
    themeBtn.textContent = t === 'light' ? 'light' : 'terminal';
  }
}
function flipTheme() {
  const cur = document.body.dataset.theme === 'light' ? 'light' : 'terminal';
  const next = cur === 'light' ? 'terminal' : 'light';
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  applyTheme(next);
}
// init theme
applyTheme((() => { try { return localStorage.getItem(THEME_KEY) || 'terminal'; } catch { return 'terminal'; } })());
themeBtn?.addEventListener('click', flipTheme);

// ========== AUDIO ==========
const audio = document.getElementById('bg-audio');
const audioBtn = document.getElementById('audioBtn');
function updateAudioBtnLabel() {
  if (audio && audioBtn) audioBtn.textContent = audio.muted ? '[ unmute ]' : '[ play ♩ ]';
}
function toggleAudio() {
  if (!audio) return;
  audio.muted = !audio.muted;
  if (!audio.muted) audio.play().catch(() => {});
  updateAudioBtnLabel();
}
audioBtn?.addEventListener('click', toggleAudio);
updateAudioBtnLabel();

// ========== NEON MODE ==========
const NEON_KEY = 'aotuNeon';
const neonBtn  = document.getElementById('neonBtn');

function applyNeon(on) {
  document.body.classList.toggle('neon', !!on);
  neonBtn?.setAttribute('aria-pressed', String(!!on));
  if (neonBtn) neonBtn.textContent = on ? '★ neon ON' : '★ neon';
}
(function initNeon(){
  let saved = false;
  try { saved = localStorage.getItem(NEON_KEY) === 'true'; } catch {}
  applyNeon(saved);
})();
neonBtn?.addEventListener('click', () => {
  const next = !document.body.classList.contains('neon');
  try { localStorage.setItem(NEON_KEY, String(next)); } catch {}
  applyNeon(next);
});

// ========== SIDEBAR: MOBILE DROP-DOWN (dall’alto) ==========
(() => {
  const body      = document.body;
  const sidebar   = document.getElementById('sidebar');
  const pull      = document.getElementById('sidebarPull');   // linguetta INDEX
  const closeBtn  = document.getElementById('closeSidebar');  // bottone ✕ nella winbar
  const backdrop  = document.getElementById('sidebarBackdrop');

  if (!sidebar || !pull || !backdrop) return;

  let lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    body.classList.add('sidebar-open');
    pull.setAttribute('aria-expanded', 'true');
    setTimeout(() => sidebar.focus(), 0);
    body.style.overflow = 'hidden'; // blocca scroll sotto
  }
  function close() {
    body.classList.remove('sidebar-open');
    pull.setAttribute('aria-expanded', 'false');
    body.style.overflow = '';
    lastFocus?.focus?.();
  }

  pull.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && body.classList.contains('sidebar-open')) close();
  });
})();

// ========== SIDEBAR: DESKTOP COLLAPSE/EXPAND (con persistenza) ==========
(() => {
  const body       = document.body;
  const sidebar    = document.getElementById('sidebar');
  const desktopBtn = document.getElementById('toggleSidebarDesktop');
  const railHandle = document.getElementById('railHandle'); // maniglia sulla rail
  if (!sidebar || !desktopBtn || !railHandle) return;

  const COLLAPSE_KEY = 'aotuSidebarCollapsed';
  const mqMobile = window.matchMedia('(max-width: 880px)');

  function setDesktopCollapsed(collapsed) {
    body.classList.toggle('sidebar-collapsed', !!collapsed);
    const expanded = collapsed ? 'false' : 'true';
    desktopBtn.setAttribute('aria-expanded', expanded);
    railHandle.setAttribute('aria-expanded', expanded);
    desktopBtn.textContent = collapsed ? '☰ expand' : '◀ collapse';
    // mostra la rail solo quando collassata e non in mobile
    const showRail = collapsed && !mqMobile.matches && !body.classList.contains('sidebar-open');
    railHandle.style.opacity = showRail ? '1' : '0';
    railHandle.style.pointerEvents = showRail ? 'auto' : 'none';
    try { localStorage.setItem(COLLAPSE_KEY, String(!!collapsed)); } catch {}
  }

  // init
  (function init(){
    let saved = false;
    try { saved = localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch {}
    if (mqMobile.matches) {
      body.classList.remove('sidebar-collapsed');
      desktopBtn.textContent = '◀ collapse';
      desktopBtn.setAttribute('aria-expanded', 'true');
      railHandle.setAttribute('aria-expanded', 'true');
      railHandle.style.opacity = '0';
      railHandle.style.pointerEvents = 'none';
    } else {
      setDesktopCollapsed(saved);
    }
  })();

  desktopBtn.addEventListener('click', () => {
    if (mqMobile.matches) return; // su mobile non collassiamo (c’è il drawer)
    const willCollapse = !body.classList.contains('sidebar-collapsed');
    setDesktopCollapsed(willCollapse);
  });

  railHandle.addEventListener('click', () => {
    if (!mqMobile.matches) setDesktopCollapsed(false);
  });

  mqMobile.addEventListener?.('change', () => {
    // ricalcola visibilità rail e stato pulsante al cambio layout
    const saved = (() => { try { return localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch { return false; } })();
    if (mqMobile.matches) {
      body.classList.remove('sidebar-collapsed');
      desktopBtn.textContent = '◀ collapse';
      desktopBtn.setAttribute('aria-expanded', 'true');
      railHandle.style.opacity = '0';
      railHandle.style.pointerEvents = 'none';
    } else {
      setDesktopCollapsed(saved);
    }
  });
})();

// ========== SIDEBAR: DRAWERS <details> (persistenza open/close) ==========
(() => {
  const KEY = 'aotu:drawers';
  /** @type {Record<string,boolean>} */
  const state = (() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  })();

  document.querySelectorAll('aside#index, aside#sidebar, aside.sidebar') // robusto rispetto ai nomi
    .forEach(aside => {
      aside.querySelectorAll('details.drawer').forEach($d => {
        const name = $d.dataset.drawer || 'drawer';
        if (name in state) $d.open = !!state[name];
        $d.addEventListener('toggle', () => {
          state[name] = $d.open;
          try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
        });
      });
    });
})();
