// js/core.js — theme, audio, sidebar (mobile + desktop) + remember state

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
applyTheme((() => { try { return localStorage.getItem(THEME_KEY) || 'terminal'; } catch { return 'terminal'; } })());
themeBtn?.addEventListener('click', flipTheme);

// ========== AUDIO ==========
const audio = document.getElementById('bg-audio');
const audioBtn = document.getElementById('audioBtn');
function updateAudioBtnLabel() {
  if (audio && audioBtn) audioBtn.textContent = audio.muted ? '[ unmute ]' : '[ mute ]';
}
function toggleAudio() {
  if (!audio) return;
  audio.muted = !audio.muted;
  if (!audio.muted) audio.play().catch(() => {});
  updateAudioBtnLabel();
}
audioBtn?.addEventListener('click', toggleAudio);
updateAudioBtnLabel();

// ========== SIDEBAR: MOBILE DRAWER ==========
(() => {
  const sidebar  = document.getElementById('sidebar');
  const openBtn  = document.getElementById('openSidebar');   // header (mobile) — se non c'è, il blocco resta harmless
  const closeBtn = document.getElementById('closeSidebar');  // dentro la sidebar
  const backdrop = document.getElementById('sidebarBackdrop');

  if (!sidebar || !backdrop) return;

  function open() {
    document.body.classList.add('sidebar-open');
    sidebar.classList.add('is-open');
    backdrop.classList.add('is-visible');
    openBtn?.setAttribute('aria-expanded', 'true');
    closeBtn?.setAttribute('aria-expanded', 'true');
    sidebar.focus();
  }
  function close() {
    document.body.classList.remove('sidebar-open');
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-visible');
    openBtn?.setAttribute('aria-expanded', 'false');
    closeBtn?.setAttribute('aria-expanded', 'false');
    openBtn?.focus();
  }

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('is-open')) close();
  });

  // se si passa a desktop, chiudi il drawer mobile
  const toDesktop = window.matchMedia('(min-width: 901px)');
  toDesktop.addEventListener?.('change', () => close());
})();

// ========== SIDEBAR: DESKTOP COLLAPSE/EXPAND + REMEMBER ==========
(() => {
  const sidebar    = document.getElementById('sidebar');
  const desktopBtn = document.getElementById('toggleSidebarDesktop');
  const railHandle = document.getElementById('railHandle');   // ← opzionale (la maniglia sulla rail)
  const backdrop   = document.getElementById('sidebarBackdrop');
  if (!sidebar || !desktopBtn) return;

  const COLLAPSE_KEY = 'aotuSidebarCollapsed';
  const mqMobile = window.matchMedia('(max-width: 900px)');

  // su mobile: chiudi il drawer
  const closeMobile = () => {
    document.body.classList.remove('sidebar-open');
    sidebar.classList.remove('is-open');
    backdrop?.classList.remove('is-visible');
    desktopBtn.setAttribute('aria-expanded', 'true');
  };

  function setCollapsed(on) {
    document.body.classList.toggle('sidebar-collapsed', !!on);
    // ARIA + label per entrambi i controlli
    const expanded = on ? 'false' : 'true';
    desktopBtn.setAttribute('aria-expanded', expanded);
    railHandle?.setAttribute('aria-expanded', expanded);
    desktopBtn.textContent = on ? '☰ expand' : '◀ collapse';
    try { localStorage.setItem(COLLAPSE_KEY, String(!!on)); } catch {}
  }

  // init
  (function init(){
    let saved = false;
    try { saved = localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch {}
    if (mqMobile.matches) {
      // su mobile ignoriamo stato collapsed
      document.body.classList.remove('sidebar-collapsed');
      desktopBtn.textContent = 'close ✕';
      desktopBtn.setAttribute('aria-expanded', 'true');
      railHandle?.setAttribute('aria-expanded', 'true');
    } else {
      setCollapsed(saved);
    }
  })();

  // click: su mobile chiude; su desktop collassa/espande
  desktopBtn.addEventListener('click', () => {
    if (mqMobile.matches) {
      closeMobile();
    } else {
      const willCollapse = !document.body.classList.contains('sidebar-collapsed');
      setCollapsed(willCollapse);
    }
  });

  // la maniglia sulla rail riapre
  railHandle?.addEventListener('click', () => {
    if (!mqMobile.matches) setCollapsed(false);
  });

  // sync su resize
  mqMobile.addEventListener?.('change', (e) => {
    if (e.matches) {
      document.body.classList.remove('sidebar-collapsed');
      desktopBtn.textContent = 'close ✕';
      desktopBtn.setAttribute('aria-expanded', 'true');
      railHandle?.setAttribute('aria-expanded', 'true');
    } else {
      let saved = false;
      try { saved = localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch {}
      setCollapsed(saved);
    }
  });
})();


