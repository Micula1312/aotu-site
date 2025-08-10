// js/core.js — shared theme, audio controls
const THEME_KEY = 'aotuTheme';
const themeBtn = document.getElementById('themeBtn');

function applyTheme(t) {
  // nuovo sistema: data-theme
  if (t === 'light') {
    document.body.dataset.theme = 'light';
  } else {
    delete document.body.dataset.theme;
  }
  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', String(t === 'light'));
    themeBtn.textContent = t === 'light' ? 'light' : 'terminal';
  }
}

function flipTheme() {
  const cur = document.body.dataset.theme === 'light' ? 'light' : 'terminal';
  const next = cur === 'light' ? 'terminal' : 'light';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

// inizializza
applyTheme(localStorage.getItem(THEME_KEY) || 'terminal');
if (themeBtn) themeBtn.addEventListener('click', flipTheme);

// --- Audio controls unchanged ---
const audio = document.getElementById('bg-audio');
const audioBtn = document.getElementById('audioBtn');
function updateAudioBtnLabel() {
  if (audio && audioBtn) audioBtn.textContent = audio.muted ? '[ unmute ]' : '[ mute ]';
}
function toggleAudio() {
  if (!audio) return;
  audio.muted = !audio.muted;
  if (!audio.muted) { audio.play().catch(() => {}); }
  updateAudioBtnLabel();
}
if (audioBtn) audioBtn.addEventListener('click', toggleAudio);
updateAudioBtnLabel();
