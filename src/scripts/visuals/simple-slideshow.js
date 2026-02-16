// Simple WP Media Slideshow (full viewport, zero dipendenze)
// Controlli: Velocità, Invert, Blur, Colore, Fit toggle, Fullscreen
// URL params: site, perPage, delay(ms), shuffle(0/1), fit(cover|contain), inv(0..1), blur(px), tint(#rrggbb)
(() => {
  const qs = new URLSearchParams(location.search);
  const site = (qs.get('site') || '').replace(/\/+$/,'');
  const perPage = Math.min(Math.max(parseInt(qs.get('perPage')||'50',10),1),100);

  let delay = Math.max(300, parseInt(qs.get('delay')||'2000',10));
  const shuffle = ['1','true','yes','y'].includes((qs.get('shuffle')||'0').toLowerCase());
  let fit = (qs.get('fit') || 'cover'); // cover | contain
  let inv = Math.max(0, Math.min(1, parseFloat(qs.get('inv') || '0')));
  let blurPx = Math.max(0, parseFloat(qs.get('blur') || '0'));
  let tintHex = (qs.get('tint') || '#000000').replace(/^([^#].*)$/,'#$1');

  // Endpoint WP (se "site" è vuoto, usa /wp-json relativo: comodo con proxy Vite)
  const endpoint = (site ? `${site}` : '') + `/wp-json/wp/v2/media`;
  const url = new URL(endpoint, location.origin);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('orderby', 'date');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('media_type', 'image');
  url.searchParams.set('_embed', '1');

  // ---------- STYLES ----------
  const style = document.createElement('style');
  style.textContent = `
    :root{ --ui-bg: rgba(12,12,12,.70); --ui-bd: #2c2c2c }
    html,body{margin:0;height:100%;background:#0b0b0b}

    /* STACK: contiene immagini + overlay; invert è qui per valere su entrambe */
    .ss__stack{
      position:fixed; inset:0; z-index:1; isolation:isolate;
      filter: invert(var(--inv, 0));
    }

    .ss__img{
      position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
      filter: blur(var(--blur, 0px));
      transition:opacity .6s ease; opacity:1;
    }
    .ss__img.is-hidden{ opacity:0 }

    /* overlay colore sopra le immagini nello stesso stack */
    .ss__overlay{
      position:absolute; inset:0; z-index:2; pointer-events:none;
      background-color: transparent; /* impostato via JS */
    }

    .ss__status{ position:fixed; left:12px; top:12px; color:#9a9a9a;
      font:12px/1.4 system-ui,Arial; opacity:.9; z-index:11 }

    /* Barra unica full-width */
    .ss__ui{
      position:fixed; left:0; right:0; bottom:0; z-index:10;
      display:flex; gap:14px; align-items:center; flex-wrap:nowrap;
      padding:10px 12px; background:var(--ui-bg); border-top:1px solid var(--ui-bd);
      backdrop-filter:blur(6px) saturate(1.2);
      overflow-x:auto; scrollbar-width:thin;
    }
    .ss__ui label{display:flex; gap:8px; align-items:center; color:#ddd; font:12px system-ui; white-space:nowrap}
    .ss__ui input[type="range"]{width:160px}
    .ss__ui input[type="color"]{inline-size:28px; block-size:22px; border:none; padding:0; background:transparent}
    .ss__ui button{border:1px solid var(--ui-bd); background:transparent; color:#ddd; border-radius:10px; padding:6px 10px; font:12px system-ui; white-space:nowrap}
    .ss__val{opacity:.8}
    .ss__spacer{flex:1}
  `;
  document.head.appendChild(style);

  // ---------- DOM ----------
  // stack isolato per i filtri condivisi
  const stack = document.createElement('div');
  stack.className = 'ss__stack';
  document.body.append(stack);

  // immagini crossfade
  const a = document.createElement('img');
  const b = document.createElement('img');
  a.className = 'ss__img'; b.className = 'ss__img is-hidden';
  a.alt = b.alt = '';
  stack.append(a,b);

  // overlay colore (sopra le immagini)
  const overlay = document.createElement('div');
  overlay.className = 'ss__overlay';
  stack.append(overlay);

  // status
  const status = document.createElement('div');
  status.className = 'ss__status';
  status.textContent = 'carico immagini…';
  document.body.append(status);

  // barra unica
  const ui = document.createElement('div');
  ui.className = 'ss__ui';
  ui.innerHTML = `
    <label>Velocità
      <input id="uiDelay" type="range" min="0.5" max="8" step="0.1">
      <span class="ss__val" id="uiDelayVal"></span>
    </label>
    <label>Invert
      <input id="uiInv" type="range" min="0" max="1" step="0.01">
      <span class="ss__val" id="uiInvVal"></span>
    </label>
    <label>Blur
      <input id="uiBlur" type="range" min="0" max="20" step="0.5">
      <span class="ss__val" id="uiBlurVal"></span>
    </label>
    <label>Colore <input id="uiTint" type="color"></label>
    <span class="ss__spacer"></span>
    <button id="uiFit" type="button">Fit: cover</button>
    <button id="uiFS" type="button">Fullscreen</button>
  `;
  document.body.append(ui);

  // refs UI
  const uiDelay = ui.querySelector('#uiDelay');
  const uiDelayVal = ui.querySelector('#uiDelayVal');
  const uiInv  = ui.querySelector('#uiInv');
  const uiInvVal = ui.querySelector('#uiInvVal');
  const uiBlur  = ui.querySelector('#uiBlur');
  const uiBlurVal = ui.querySelector('#uiBlurVal');
  const uiTint = ui.querySelector('#uiTint');
  const uiFit = ui.querySelector('#uiFit');
  const uiFS = ui.querySelector('#uiFS');

  // ---------- helpers ----------
  const setParam = (k,v)=>{ qs.set(k,String(v)); history.replaceState(null,'',`?${qs.toString()}`) };

  const pickSrc = (item) =>
    item?.media_details?.sizes?.large?.source_url ||
    item?.media_details?.sizes?.medium_large?.source_url ||
    item?.media_details?.sizes?.medium?.source_url ||
    item?.source_url || item?.guid?.rendered || '';

  const shuffleInPlace = (arr)=>{
    for(let j=arr.length-1; j>0; j--){
      const k = Math.floor(Math.random()*(j+1));
      [arr[j], arr[k]] = [arr[k], arr[j]];
    }
  };

  const preload = (src)=> new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>res(src);
    img.onerror = ()=>rej(new Error('img load error '+src));
    img.src = src; // no crossOrigin
  });

  function hexToRgb(hex){
    const m = hex.replace('#','').match(/^([0-9a-f]{6})$/i);
    if(!m) return {r:0,g:0,b:0};
    const n = parseInt(m[1],16);
    return { r: (n>>16)&255, g: (n>>8)&255, b: n&255 };
  }

  function applyFit(){
    a.style.objectFit = fit;
    b.style.objectFit = fit;
    uiFit.textContent = `Fit: ${fit}`;
  }
  function applyFX(){
    // invert su wrapper (coerente sul crossfade)
    stack.style.setProperty('--inv', String(inv));
    uiInvVal.textContent = inv.toFixed(2);

    // blur su immagini tramite CSS var
    stack.style.setProperty('--blur', `${blurPx}px`);
    uiBlurVal.textContent = `${blurPx}px`;

    // overlay colore (alpha fisso per semplicità)
    const {r,g,b} = hexToRgb(tintHex);
    const ALPHA = 0.30;
    const col = `rgba(${r},${g},${b},${ALPHA})`;
    overlay.style.background = col;
    overlay.style.backgroundColor = col;
  }

  function updateFSButton(){
    uiFS.textContent = document.fullscreenElement ? 'Exit FS' : 'Fullscreen';
  }
  async function toggleFullscreen(){
    try{
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    }catch(_e){}
    updateFSButton();
  }

  // init UI values
  uiDelay.value = (delay/1000).toFixed(1);
  uiDelayVal.textContent = (delay/1000).toFixed(1) + 's';
  uiInv.value = String(inv);
  uiBlur.value = String(blurPx);
  uiBlurVal.textContent = `${blurPx}px`;
  uiTint.value = tintHex;
  applyFit();
  applyFX();

  // ---------- STATE ----------
  let list = [];
  let i = 0;
  let playing = true;
  let timer = null;
  let front = a, back = b;

  async function showNext(step=1){
    if(!list.length) return;
    i = (i + step + list.length) % list.length;
    const src = list[i];
    try{
      await preload(src);
      back.src = src;
      back.classList.remove('is-hidden');
      front.classList.add('is-hidden');
      [front, back] = [back, front];
      status.textContent = `${i+1}/${list.length}`;
    }catch(e){
      console.warn(e);
      i = (i + 1) % list.length;
    }
  }
  function startLoop(){ stopLoop(); timer = setInterval(()=>{ if(playing) showNext(1) }, delay); }
  function stopLoop(){ if(timer){ clearInterval(timer); timer = null } }

  // ---------- UI events ----------
  uiDelay.addEventListener('input', ()=>{
    const s = parseFloat(uiDelay.value)||2;
    delay = Math.max(0.3, s) * 1000;
    uiDelayVal.textContent = s.toFixed(1) + 's';
    setParam('delay', Math.round(delay));
    startLoop();
  });

  uiInv.addEventListener('input', ()=>{
    inv = Math.max(0, Math.min(1, parseFloat(uiInv.value)||0));
    setParam('inv', inv);
    applyFX();
  });

  uiBlur.addEventListener('input', ()=>{
    blurPx = Math.max(0, parseFloat(uiBlur.value)||0);
    setParam('blur', blurPx);
    applyFX();
  });

  uiTint.addEventListener('input', ()=>{
    tintHex = uiTint.value;
    setParam('tint', tintHex);
    applyFX();
  });

  uiFit.addEventListener('click', ()=>{
    fit = (fit === 'cover') ? 'contain' : 'cover';
    setParam('fit', fit);
    applyFit();
  });

  uiFS.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFSButton);

  // tastiera
  document.addEventListener('keydown', (e)=>{
    if(e.code === 'Space'){ e.preventDefault(); playing = !playing; status.textContent = (playing?'▶︎':'⏸') + ` ${i+1}/${list.length}` }
    if(e.key === 'ArrowRight'){ showNext(+1) }
    if(e.key === 'ArrowLeft'){ showNext(-1) }
    if(e.key === 'f' || e.key === 'F'){ toggleFullscreen() }
  });
  document.addEventListener('visibilitychange', ()=>{ document.hidden ? stopLoop() : startLoop() });

  // ---------- boot ----------
  (async ()=>{
    try{
      const res = await fetch(url.toString(), {mode:'cors'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      list = data.map(pickSrc).filter(Boolean);
      if(shuffle) shuffleInPlace(list);
      if(!list.length){ status.textContent = 'nessuna immagine trovata'; return; }
      front.src = list[0];
      status.textContent = `1/${list.length}`;
      startLoop();
    }catch(err){
      console.error(err);
      status.textContent = 'errore fetch (CORS/site/endpoint?)';
    }
  })();
})();
