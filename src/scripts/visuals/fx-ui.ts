/// <reference lib="dom" />
// Effetti: Pixelate, Blur, Duotone
// Sicuro con strictNullChecks, senza errori in strict.

const root = document.documentElement;
const scope = document.body; // dove applichiamo le classi fx-*

// Helpers tipizzati
const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel);
const on = <K extends keyof HTMLElementEventMap>(
  el: HTMLElement | null | undefined,
  type: K,
  handler: (ev: HTMLElementEventMap[K]) => any
) => { if (el) el.addEventListener(type, handler as EventListener); };

// Elements (tutti opzionali: se non ci sono, non facciamo nulla)
const fab      = $('#fx-fab') as HTMLButtonElement | null;
const panel    = $('#fx-panel') as HTMLElement | null;
const closeBtn = $('#fx-close') as HTMLButtonElement | null;
const resetBtn = $('#fx-reset') as HTMLButtonElement | null;

const pxChk  = $('#fx-px-chk') as HTMLInputElement | null;
const px     = $('#fx-px') as HTMLInputElement | null;
const pxOut  = $('#fx-px-out') as HTMLOutputElement | null;

const blur    = $('#fx-blur') as HTMLInputElement | null;
const blurOut = $('#fx-blur-out') as HTMLOutputElement | null;

const duoChk = $('#fx-duo-chk') as HTMLInputElement | null;
const duoA   = $('#fx-duo-a') as HTMLInputElement | null;   // type="color"
const duoB   = $('#fx-duo-b') as HTMLInputElement | null;   // type="color"
const duoO   = $('#fx-duo-o') as HTMLInputElement | null;   // type="range"
let duoOverlay = $('#fx-duo-overlay') as HTMLElement | null;

// Init overlay se manca
(function ensureDuoOverlay(){
  if (!duoOverlay) {
    const el = document.createElement('div');
    el.id = 'fx-duo-overlay';
    document.body.appendChild(el);
    duoOverlay = el;
  }
})();

// Open/close panel
on(fab, 'click', () => { panel?.classList.toggle('open'); });
on(closeBtn, 'click', () => { panel?.classList.remove('open'); });

// Reset
on(resetBtn, 'click', () => {
  // Defaults
  root.style.setProperty('--fx-px', '1');
  root.style.setProperty('--fx-blur', '0px');
  root.style.setProperty('--fx-duo-a', '#00ffc8');
  root.style.setProperty('--fx-duo-b', '#6b00ff');
  root.style.setProperty('--fx-duo-o', '0.5');

  scope.classList.remove('fx-pixelate');

  if (px) px.value = '1';
  if (pxOut) pxOut.value = '1';
  if (pxChk) pxChk.checked = false;

  if (blur) blur.value = '0';
  if (blurOut) blurOut.value = '0px';

  if (duoChk) duoChk.checked = false;
  if (duoOverlay) duoOverlay.style.display = 'none';
  if (duoA) duoA.value = '#00ffc8';
  if (duoB) duoB.value = '#6b00ff';
  if (duoO) duoO.value = '0.5';
});

// Pixelate
on(pxChk, 'change', () => { if (pxChk?.checked) scope.classList.add('fx-pixelate'); else scope.classList.remove('fx-pixelate'); });
on(px, 'input', () => {
  if (!px) return;
  const v = Math.max(1, Math.min(64, Math.floor(Number(px.value) || 1)));
  root.style.setProperty('--fx-px', String(v));
  if (pxOut) pxOut.value = String(v);
});

// Blur
on(blur, 'input', () => {
  if (!blur) return;
  const v = Math.max(0, Math.min(50, Number(blur.value) || 0));
  root.style.setProperty('--fx-blur', `${v}px`);
  if (blurOut) blurOut.value = `${v}px`;
});

// Duotone
on(duoChk, 'change', () => {
  if (!duoOverlay || !duoChk) return;
  duoOverlay.style.display = duoChk.checked ? 'block' : 'none';
});
on(duoA, 'input', () => { if (duoA) root.style.setProperty('--fx-duo-a', duoA.value); });
on(duoB, 'input', () => { if (duoB) root.style.setProperty('--fx-duo-b', duoB.value); });
on(duoO, 'input', () => {
  if (!duoO) return;
  const v = Math.max(0, Math.min(1, Number(duoO.value)));
  root.style.setProperty('--fx-duo-o', String(v));
});

// Chiudi pannello su ESC
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') panel?.classList.remove('open');
});
