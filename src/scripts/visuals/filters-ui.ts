/// <reference lib="dom" />
// Pannello filtri: costruisce/aggiorna la query string dell'URL.

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel);
const on = <K extends keyof HTMLElementEventMap>(
  el: HTMLElement | null | undefined,
  type: K,
  handler: (ev: HTMLElementEventMap[K]) => any
) => { if (el) el.addEventListener(type, handler as EventListener); };

const fab    = $('#vf-fab') as HTMLButtonElement | null;
const panel  = $('#vf-panel') as HTMLElement | null;
const closeB = $('#vf-close') as HTMLButtonElement | null;
const resetB = $('#vf-reset') as HTMLButtonElement | null;
const applyB = $('#vf-apply') as HTMLButtonElement | null;

// Inputs (tutti opzionali; leggi solo se esistono)
const iSite    = $('#vf-site') as HTMLInputElement | null;
const iPerPage = $('#vf-per') as HTMLInputElement | null;
const iOrderBy = $('#vf-orderby') as HTMLSelectElement | null;
const iOrder   = $('#vf-order') as HTMLSelectElement | null;
const iSearch  = $('#vf-search') as HTMLInputElement | null;

// opzionali per i vari template
const iEvery   = $('#vf-every') as HTMLInputElement | null;
const iScale   = $('#vf-scale') as HTMLInputElement | null;
const iSeed    = $('#vf-seed') as HTMLInputElement | null;
const iMax     = $('#vf-max') as HTMLInputElement | null;
const iTilt    = $('#vf-tilt') as HTMLInputElement | null;
const iCap     = $('#vf-cap') as HTMLInputElement | null;
const iCapH    = $('#vf-caph') as HTMLInputElement | null;

const iDir       = $('#vf-dir') as HTMLSelectElement | null;
const iFit       = $('#vf-fit') as HTMLSelectElement | null;
const iPreload   = $('#vf-preload') as HTMLInputElement | null;
const iInterval  = $('#vf-interval') as HTMLInputElement | null;
const iTrans     = $('#vf-transition') as HTMLInputElement | null;
const iAutoplay  = $('#vf-autoplay') as HTMLInputElement | null; // checkbox

on(fab, 'click', () => { panel?.classList.toggle('open'); });
on(closeB, 'click', () => { panel?.classList.remove('open'); });

// reset semplice: svuota i campi noti
on(resetB, 'click', () => {
  [iSearch, iEvery, iScale, iSeed, iMax, iTilt, iCap, iCapH, iInterval, iTrans].forEach(inp => { if (inp) inp.value = ''; });
  if (iAutoplay) iAutoplay.checked = true;
});

// Costruisci nuova query unendo esistente + valori panel
function buildQuery(): string {
  const p = new URLSearchParams(location.search);

  const setNum = (key: string, el: HTMLInputElement | null) => {
    if (!el || el.value.trim()==='') return;
    const n = Number(el.value);
    if (!Number.isNaN(n)) p.set(key, String(n));
  };
  const setStr = (key: string, el: HTMLInputElement | HTMLSelectElement | null) => {
    if (!el) return;
    const v = (el as HTMLInputElement | HTMLSelectElement).value.trim();
    if (v !== '') p.set(key, v);
  };

  setStr('site', iSite);
  setNum('perPage', iPerPage);
  setStr('orderby', iOrderBy);
  setStr('order', iOrder);
  setStr('search', iSearch);

  // sequence params
  setNum('every', iEvery);
  setNum('scale', iScale); // accetta decimali (verranno come string, ok)
  setNum('seed', iSeed);
  setNum('max', iMax);
  setNum('tilt', iTilt);
  setNum('cap', iCap);
  setNum('capH', iCapH);

  // cover/carousel params
  setStr('dir', iDir);
  setStr('fit', iFit);
  setNum('preload', iPreload);
  setNum('interval', iInterval);
  setNum('transition', iTrans);
  if (iAutoplay) p.set('autoplay', iAutoplay.checked ? '1' : '0');

  return `?${p.toString()}`;
}

on(applyB, 'click', () => {
  const url = location.pathname + buildQuery();
  location.assign(url);
});

// Chiudi su ESC
addEventListener('keydown', (e) => { if (e.key === 'Escape') panel?.classList.remove('open'); });


;(window as any).__FILTERS_READY__ = true;