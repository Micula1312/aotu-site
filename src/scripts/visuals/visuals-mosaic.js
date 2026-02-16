// Visuals Mosaic (no deps) — square output + FS drag/pinch + built-in audio + blur/invert UI
// Params: site, perPage (<=100), q, fit(cover|contain), dwell(ms), cell(px; can be 0),
//         order(random|left|top|center), shuffle(0/1), proxy(0/1), tags=...
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const qs = new URLSearchParams(location.search);

  // ---- Params
  const site = (qs.get("site") || "").replace(/\/+$/, "");
  const useProxy =
    !site ||
    ["1", "true", "yes", "y"].includes((qs.get("proxy") || "1").toLowerCase());

  // request up to 100
  const perPage = clamp(int(qs.get("perPage"), 100), 1, 100);

  const search = qs.get("q") || "";
  let fit = qs.get("fit") || "cover";
  let dwell = clamp(int(qs.get("dwell"), 1200), 300, 8000);
  let cell = clamp(int(qs.get("cell"), 16), 0, 40); // ✅ allow 0
  let order = qs.get("order") || "random";
  const shuffle = isTrue(qs.get("shuffle") || "1");

  // hashtags overlay
  const tagsRaw = (qs.get("tags") || "").trim();
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`))
    : [];

  // ---- Audio URL injected by Astro (recommended)
  const AUDIO_URL =
    (window.__AOTU_MOSAIC_AUDIO__ && window.__AOTU_MOSAIC_AUDIO__.audioUrl) ||
    "/soundscape.mp3";

  // ---- Endpoint WP (fetch images + videos, merge, shuffle)
  const endpoint = (site ? `${site}` : "") + "/wp-json/wp/v2/media";

  function makeMediaURL(mediaType) {
    const u = new URL(endpoint, location.origin);
    u.searchParams.set("per_page", String(perPage));
    u.searchParams.set("orderby", "date");
    u.searchParams.set("order", "desc");
    u.searchParams.set("media_type", mediaType); // image | video
    u.searchParams.set("_embed", "1");
    if (search) u.searchParams.set("search", search);
    return u;
  }

  // ---- DOM + CSS
  const style = document.createElement("style");
  style.textContent = `
    :root{ --ui-bg: rgba(12,12,12,.70); --ui-bd:#2c2c2c; --panel-w: 260px; --blur: 0px; --invert: 0; }
    html,body{margin:0;height:100%;background:#0b0b0b;color:#ddd;font-family:system-ui,Arial,sans-serif;overflow:hidden}

    .app{ position:fixed; inset:0; display:flex; align-items:stretch; }
    .stageWrap{ position:relative; flex:1; display:flex; align-items:center; justify-content:center; background:#0b0b0b; }
    .stage{
      position:relative;
      width:min(calc(100vw - var(--panel-w)), 100vh);
      height:min(calc(100vw - var(--panel-w)), 100vh);
      background:#000;
      overflow:hidden;
      border:1px solid rgba(255,255,255,.06);
      border-radius:12px;
    }

    /* viewport quadrato (trascinabile/zoomabile SOLO in fullscreen) */
    .viewport{
      position:absolute;
      left:50%; top:50%;
      width:100%;
      height:100%;
      transform: translate(-50%,-50%) translate(var(--vx, 0px), var(--vy, 0px)) scale(var(--vs, 1));
      transform-origin:center center;
      overflow:hidden;
      touch-action:none;
      will-change: transform;
      filter: blur(var(--blur)) invert(var(--invert));
    }

    .content{ position:absolute; inset:0; }
    canvas{ position:absolute; inset:0; display:block; width:100%; height:100%; }

    .status{
      position:absolute; left:10px; top:10px; z-index:10;
      color:#9a9a9a; font:12px/1.4 system-ui,Arial; opacity:.95;
      background: rgba(0,0,0,.35);
      padding:6px 8px; border-radius:10px;
      border:1px solid rgba(255,255,255,.08);
      user-select:none;
      pointer-events:none;
    }

    .tags{
      position:absolute; left:12px; bottom:12px; z-index:10;
      color:#fff;
      font-family: Helvetica, Arial, system-ui, sans-serif;
      font-size: 16px;
      line-height: 1.25;
      letter-spacing: 0.2px;
      opacity: 0.95;
      user-select:none;
      pointer-events:none;
      white-space: pre-wrap;
    }

    .ui{
      width:var(--panel-w);
      position:relative;
      z-index:12;
      display:flex;
      flex-direction:column;
      gap:12px;
      padding:12px;
      background:var(--ui-bg);
      border-left:1px solid var(--ui-bd);
      backdrop-filter:blur(6px) saturate(1.2);
      overflow:auto;
      -webkit-overflow-scrolling: touch;
    }
    .ui h3{margin:0 0 6px 0; font: 13px/1.2 system-ui; color:#cfcfcf; opacity:.9;}
    .ui label{display:flex; flex-direction:column; gap:6px; font:12px system-ui}
    .ui .row{display:flex; gap:10px; align-items:center; justify-content:space-between}
    .ui input[type="range"]{width:100%}
    .ui select{border:1px solid var(--ui-bd); background:transparent; color:#ddd; border-radius:10px; padding:7px 10px; font:12px system-ui}
    .ui button{border:1px solid var(--ui-bd); background:transparent; color:#ddd; border-radius:12px; padding:9px 10px; font:12px system-ui}
    .val{opacity:.85; font-variant-numeric: tabular-nums;}
    .pill{display:inline-flex; padding:4px 8px; border:1px solid rgba(255,255,255,.10); border-radius:999px; opacity:.85;}

    /* Fullscreen: UI + status spariscono, stage occupa tutto, viewport diventa quadrato base 1:1 */
    :is(:fullscreen, :-webkit-full-screen) .ui{
      opacity:0 !important;
      pointer-events:none !important;
    }
    :is(:fullscreen, :-webkit-full-screen) .status{
      opacity:0 !important;
      pointer-events:none !important;
    }
    :is(:fullscreen, :-webkit-full-screen) .stage{
      width:100vw; height:100vh; border-radius:0;
    }
    :is(:fullscreen, :-webkit-full-screen) .viewport{
      width: min(100vw, 100vh);
      height: min(100vw, 100vh);
    }
  `;
  document.head.appendChild(style);

  const app = document.createElement("div");
  app.className = "app";
  document.body.appendChild(app);

  const stageWrap = document.createElement("div");
  stageWrap.className = "stageWrap";
  app.appendChild(stageWrap);

  const stage = document.createElement("div");
  stage.className = "stage";
  stageWrap.appendChild(stage);

  const viewport = document.createElement("div");
  viewport.className = "viewport";
  stage.appendChild(viewport);

  const content = document.createElement("div");
  content.className = "content";
  viewport.appendChild(content);

  const cvs = document.createElement("canvas");
  const ctx = cvs.getContext("2d", { willReadFrequently: true });
  content.appendChild(cvs);

  const status = document.createElement("div");
  status.className = "status";
  status.textContent = "carico…";
  stage.appendChild(status);

  const tagsEl = document.createElement("div");
  tagsEl.className = "tags";
  tagsEl.textContent = tags.length ? tags.join(" ") : "";
  stage.appendChild(tagsEl);

  // UI (minimal + blur/invert)
  const ui = document.createElement("div");
  ui.className = "ui";
  ui.innerHTML = `
    <h3>AOTU • Mosaic</h3>

    <label>Pixel (cell)
      <input id="uCell" type="range" min="0" max="40" step="1">
      <div class="row"><span class="val" id="vCell"></span><span class="pill">0 = nitido</span></div>
    </label>

    <label>Blur
      <input id="uBlur" type="range" min="0" max="16" step="0.5">
      <div class="row"><span class="val" id="vBlur"></span><span class="val">px</span></div>
    </label>

    <label>Invert
      <input id="uInv" type="range" min="0" max="1" step="0.05">
      <div class="row"><span class="val" id="vInv"></span><span class="val">0..1</span></div>
    </label>

    <label>Ordine
      <select id="uOrder">
        <option value="random">random</option>
        <option value="left">da sinistra</option>
        <option value="top">dall’alto</option>
        <option value="center">dal centro</option>
      </select>
    </label>

    <button id="uFit" type="button"></button>

    <button id="uAudio" type="button">Play</button>
    <button id="uFS" type="button">Fullscreen</button>
  `;
  app.appendChild(ui);

  const uCell = $("#uCell", ui), vCell = $("#vCell", ui);
  const uBlur = $("#uBlur", ui), vBlur = $("#vBlur", ui);
  const uInv = $("#uInv", ui), vInv = $("#vInv", ui);
  const uOrder = $("#uOrder", ui);
  const uFit = $("#uFit", ui);
  const uAudioBtn = $("#uAudio", ui);
  const uFS = $("#uFS", ui);

  // init UI values
  uCell.value = String(cell);
  vCell.textContent = `${cell}px`;
  uOrder.value = order;
  uFit.textContent = `Fit: ${fit}`;

  let blurPx = 0;
  let inv = 0;
  uBlur.value = String(blurPx);
  uInv.value = String(inv);
  vBlur.textContent = `${blurPx}`;
  vInv.textContent = `${inv.toFixed(2)}`;
  viewport.style.setProperty("--blur", `${blurPx}px`);
  viewport.style.setProperty("--invert", `${inv}`);

  uBlur.addEventListener("input", () => {
    blurPx = clamp(parseFloat(uBlur.value) || 0, 0, 16);
    vBlur.textContent = `${blurPx}`;
    viewport.style.setProperty("--blur", `${blurPx}px`);
  });
  uInv.addEventListener("input", () => {
    inv = clamp(parseFloat(uInv.value) || 0, 0, 1);
    vInv.textContent = inv.toFixed(2);
    viewport.style.setProperty("--invert", `${inv}`);
  });

  // ---- Fullscreen-only drag + pinch zoom on viewport
  let vX = 0, vY = 0, vS = 1;
  function applyViewportTransform() {
    viewport.style.setProperty("--vx", `${vX}px`);
    viewport.style.setProperty("--vy", `${vY}px`);
    viewport.style.setProperty("--vs", `${vS}`);
  }
  function isFS() { return !!document.fullscreenElement; }
  applyViewportTransform();

  const pointers = new Map(); // id -> {x,y}
  let startVX = 0, startVY = 0, startVS = 1;
  let startCenter = null, startDist = 0;
  const center2 = (a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const dist2 = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

  viewport.addEventListener("pointerdown", (e) => {
    if (!isFS()) return;
    viewport.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    startVX = vX; startVY = vY; startVS = vS;

    if (pointers.size === 2) {
      const arr = Array.from(pointers.values());
      startCenter = center2(arr[0], arr[1]);
      startDist = dist2(arr[0], arr[1]) || 1;
    } else {
      startCenter = null;
      startDist = 0;
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!isFS()) return;
    if (!pointers.has(e.pointerId)) return;

    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      // drag 1 finger
      vX += e.movementX || 0;
      vY += e.movementY || 0;
      applyViewportTransform();
      return;
    }

    if (pointers.size === 2) {
      const arr = Array.from(pointers.values());
      const c = center2(arr[0], arr[1]);
      const d = dist2(arr[0], arr[1]) || 1;

      const scale = d / (startDist || d);
      vS = clamp(startVS * scale, 0.6, 3.5);

      if (startCenter) {
        vX = startVX + (c.x - startCenter.x);
        vY = startVY + (c.y - startCenter.y);
      }
      applyViewportTransform();
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    try { viewport.releasePointerCapture?.(e.pointerId); } catch {}
    startCenter = null; startDist = 0;
  }
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);

  // ---- Canvas sizing: match viewport rect
  let DPR = Math.min(2, devicePixelRatio || 1);
  let W = 0, H = 0;

  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    const r = viewport.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width));
    H = Math.max(1, Math.floor(r.height));
    cvs.width = Math.floor(W * DPR);
    cvs.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  addEventListener("resize", () => {
    resize();
    rebuildCurrentAndPrepared();
  });

  document.addEventListener("fullscreenchange", () => {
    if (isFS()) {
      vX = 0; vY = 0; vS = 1;
      applyViewportTransform();
      resize();
    }
    updateFSButton();
  });

  resize();

  // ---- Fetch media (images+videos)
  let mediaList = [];
  let idx = 0;

  (async () => {
    try {
      const [imgs, vids] = await Promise.all([
        fetchList(makeMediaURL("image")),
        fetchList(makeMediaURL("video")),
      ]);

      mediaList = [
        ...imgs.map((src) => ({ kind: "image", src })),
        ...vids.map((src) => ({ kind: "video", src })),
      ].filter((m) => !!m.src);

      if (shuffle) shuffleInPlace(mediaList);

      status.textContent = `ok: ${mediaList.length} (img ${imgs.length} + vid ${vids.length}) • ${useProxy ? "proxy ON" : "remote"}`;
      if (mediaList.length) initShow();
      else status.textContent = "nessun media";
    } catch (e) {
      console.error(e);
      status.textContent = "errore fetch (CORS/site/endpoint?)";
    }
  })();

  async function fetchList(u) {
    const res = await fetch(u.toString(), { mode: "cors" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    // for images use sizes, for videos fallback to source_url
    return data
      .map((it) => pickSrc(it))
      .filter(Boolean)
      .map((src) => (useProxy ? toRelative(src) : src));
  }

  // ---- Rendering helpers
  const off = document.createElement("canvas");
  const octx = off.getContext("2d", { willReadFrequently: true });

  function coverDrawToCtx(img, targetCtx) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = fit === "cover" ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
    const dw = iw * s, dh = ih * s;
    const dx = (W - dw) / 2, dy = (H - dh) / 2;
    targetCtx.drawImage(img, dx, dy, dw, dh);
  }

  function coverDrawToOff(img) {
    off.width = W; off.height = H;
    octx.clearRect(0, 0, W, H);
    coverDrawToCtx(img, octx);
  }

  function buildTilesForImage(img) {
    if (cell <= 0) return { tiles: null, maxDelay: 0 };

    const MAX_TILES = 12000;
    let step = Math.max(1, cell);
    const est = Math.ceil(W / step) * Math.ceil(H / step);
    if (est > MAX_TILES) step = Math.ceil(Math.sqrt((W * H) / MAX_TILES));

    coverDrawToOff(img);
    const data = octx.getImageData(0, 0, W, H).data;
    const list = [];

    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const cx = Math.min(W - 1, x + (step >> 1));
        const cy = Math.min(H - 1, y + (step >> 1));
        const i = (cy * W + cx) * 4;
        const a = data[i + 3];
        if (a > 8) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          list.push({ x, y, c: `rgba(${r},${g},${b},${a / 255})`, step, delay: 0 });
        }
      }
    }

    const spread = 700; // fixed (no speed slider)
    const cx0 = W / 2, cy0 = H / 2;
    let maxDelay = 0;

    for (let k = 0; k < list.length; k++) {
      const t = list[k];
      let d = 0;
      if (order === "random") d = Math.random() * spread;
      else if (order === "left") d = (t.x / W) * spread;
      else if (order === "top") d = (t.y / H) * spread;
      else if (order === "center") {
        const dist = Math.hypot(t.x - cx0, t.y - cy0) / Math.hypot(cx0, cy0);
        d = dist * spread;
      }
      t.delay = d;
      if (d > maxDelay) maxDelay = d;
    }

    return { tiles: list, maxDelay };
  }

  // ---- Media loading
  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      if (!useProxy) img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  async function loadMediaAsImage(media) {
    if (media.kind === "image") return loadImage(media.src);

    // video -> capture first frame to image (light)
    return captureVideoFrameAsImage(media.src);
  }

  function captureVideoFrameAsImage(src) {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      if (!useProxy) v.crossOrigin = "anonymous";
      v.src = src;

      const cleanup = () => {
        v.src = "";
        v.load?.();
      };

      const onFail = () => { cleanup(); reject(new Error("video frame fail")); };

      v.addEventListener("error", onFail, { once: true });

      v.addEventListener("loadeddata", async () => {
        try {
          // draw to temp canvas
          const tw = Math.max(1, v.videoWidth || 640);
          const th = Math.max(1, v.videoHeight || 360);
          const tc = document.createElement("canvas");
          tc.width = tw; tc.height = th;
          const tctx = tc.getContext("2d");
          tctx.drawImage(v, 0, 0, tw, th);

          const dataUrl = tc.toDataURL("image/jpeg", 0.85);
          cleanup();
          const img = await loadImage(dataUrl);
          resolve(img);
        } catch (e) {
          onFail();
        }
      }, { once: true });
    });
  }

  // ---- State
  let current = { img: null, tiles: null, idx: 0, maxDelay: 0 };
  let prepared = { img: null, tiles: null, idx: 0, ready: false, src: "", maxDelay: 0 };
  let prevFull = null; // previous full: tiles array OR an Image (when cell=0)

  let tStart = 0;
  let entering = true;
  let loopStarted = false;

  async function initShow() {
    current.idx = idx;
    current.img = await loadMediaAsImage(mediaList[current.idx]);
    const built = buildTilesForImage(current.img);
    current.tiles = built.tiles;
    current.maxDelay = built.maxDelay;

    tStart = performance.now();
    entering = true;

    status.textContent = `${current.idx + 1}/${mediaList.length} • cell ${cell}px • ${fit} • audio: ${audioActive() ? "ON" : "OFF (dwell)"}`;

    prepareNext();
    if (!loopStarted) {
      loopStarted = true;
      requestAnimationFrame(rafLoop);
    }
  }

  function prepareNext() {
    prepared.ready = false;
    prepared.idx = (current.idx + 1) % mediaList.length;
    prepared.src = mediaList[prepared.idx]?.src || "";

    loadMediaAsImage(mediaList[prepared.idx])
      .then((img) => {
        prepared.img = img;
        const built = buildTilesForImage(img);
        prepared.tiles = built.tiles;
        prepared.maxDelay = built.maxDelay;
        prepared.ready = true;
      })
      .catch(() => {
        prepared.ready = false;
      });
  }

  function rebuildCurrentAndPrepared() {
    if (current.img) {
      const built = buildTilesForImage(current.img);
      current.tiles = built.tiles;
      current.maxDelay = built.maxDelay;
      tStart = performance.now();
      entering = true;
    }
    if (prepared.ready && prepared.img) {
      const built2 = buildTilesForImage(prepared.img);
      prepared.tiles = built2.tiles;
      prepared.maxDelay = built2.maxDelay;
    }
    prevFull = null;
  }

  function triggerSwitch(tNow) {
    if (!prepared.ready) return;

    prevFull = cell <= 0 ? current.img : current.tiles;

    current.idx = prepared.idx;
    current.img = prepared.img;
    current.tiles = prepared.tiles;
    current.maxDelay = prepared.maxDelay;

    tStart = tNow;
    entering = true;

    status.textContent = `${current.idx + 1}/${mediaList.length} • cell ${cell}px • ${fit} • audio: ${audioActive() ? "ON" : "OFF (dwell)"}`;
    prepareNext();
  }

  function drawFrameDirect(img) {
    ctx.clearRect(0, 0, W, H);
    coverDrawToCtx(img, ctx);
  }

  function drawTiles(tNow) {
    const t = tNow - tStart;

    // cell=0 => nitido
    if (cell <= 0) {
      const enterDur = 500;
      ctx.clearRect(0, 0, W, H);

      if (entering) {
        if (prevFull) coverDrawToCtx(prevFull, ctx);
        const k = Math.max(0, Math.min(1, t / enterDur));
        ctx.globalAlpha = k;
        coverDrawToCtx(current.img, ctx);
        ctx.globalAlpha = 1;

        if (t >= enterDur) {
          entering = false;
          prevFull = null;
          tStart = tNow;
        }
      } else {
        coverDrawToCtx(current.img, ctx);
        if (!audioActive() && t >= dwell && prepared.ready) triggerSwitch(tNow);
      }
      return;
    }

    // mosaic mode
    const enterDur = 600;
    const enterEnd = current.maxDelay + enterDur;

    ctx.clearRect(0, 0, W, H);
    const easeOut = (x) => 1 - Math.pow(1 - x, 2);

    if (entering) {
      if (prevFull) {
        for (let i = 0; i < prevFull.length; i++) {
          const p = prevFull[i];
          ctx.fillStyle = p.c;
          ctx.fillRect(p.x, p.y, p.step, p.step);
        }
      }
      for (let i = 0; i < current.tiles.length; i++) {
        const p = current.tiles[i];
        const st = t - p.delay;
        if (st < 0) continue;
        const k = easeOut(Math.max(0, Math.min(1, st / enterDur)));
        const size = p.step * k;
        const dx = p.x + (p.step - size) / 2;
        const dy = p.y + (p.step - size) / 2;
        ctx.globalAlpha = k;
        ctx.fillStyle = p.c;
        ctx.fillRect(dx, dy, size, size);
      }
      ctx.globalAlpha = 1;

      if (t >= enterEnd) {
        entering = false;
        prevFull = null;
        tStart = tNow;
      }
      return;
    }

    for (let i = 0; i < current.tiles.length; i++) {
      const p = current.tiles[i];
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.step, p.step);
    }

    if (!audioActive() && t >= dwell && prepared.ready) triggerSwitch(tNow);
  }

  function rafLoop() {
    drawTiles(performance.now());
    requestAnimationFrame(rafLoop);
  }

  // ---- AUDIO (built-in soundscape; RMS trigger; dwell fallback when audio off)
  let audioEl = null;
  let audioCtx = null;
  let analyser = null;
  let td = null;

  let lastTrig = 0;
  const cooldownMs = 420;
  const thresh = 0.12;
  let rmsSm = 0;
  const smooth = 0.90;

  function audioActive() {
    return !!(audioEl && !audioEl.paused && analyser && td);
  }

  function ensureAudioGraph() {
    if (audioEl) return;

    audioEl = document.createElement("audio");
    audioEl.src = AUDIO_URL;
    audioEl.preload = "auto";
    audioEl.loop = true;
    audioEl.crossOrigin = "anonymous";

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaElementSource(audioEl);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.65;
    td = new Uint8Array(analyser.fftSize);

    src.connect(analyser);
    analyser.connect(audioCtx.destination);

    // try autoplay (may be blocked)
    audioCtx.resume().catch(() => {});
    audioEl.play().catch(() => {});
  }

  function computeRMS() {
    analyser.getByteTimeDomainData(td);
    let sum = 0;
    for (let i = 0; i < td.length; i++) {
      const v = (td[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / td.length);
    rmsSm = smooth * rmsSm + (1 - smooth) * rms;
    return rmsSm;
  }

  setInterval(() => {
    if (!audioActive() || !prepared.ready) return;
    const now = performance.now();
    const rms = computeRMS();
    if (rms > thresh && now - lastTrig > cooldownMs) {
      lastTrig = now;
      triggerSwitch(now);
    }
  }, 33);

  // ---- UI events
  uCell.addEventListener("input", () => {
    cell = clamp(int(uCell.value, 0), 0, 40);
    vCell.textContent = `${cell}px`;
    rebuildCurrentAndPrepared();
  });

  uOrder.addEventListener("change", () => {
    order = uOrder.value;
    rebuildCurrentAndPrepared();
  });

  uFit.addEventListener("click", () => {
    fit = fit === "cover" ? "contain" : "cover";
    uFit.textContent = `Fit: ${fit}`;
    rebuildCurrentAndPrepared();
  });

  // Play/Pause audio only (visual always runs)
  uAudioBtn.addEventListener("click", async () => {
    ensureAudioGraph();
    if (!audioEl) return;

    if (audioEl.paused) {
      try {
        if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();
        await audioEl.play();
        uAudioBtn.textContent = "Pausa";
      } catch {}
    } else {
      try { audioEl.pause(); } catch {}
      uAudioBtn.textContent = "Play";
    }
  });

  // Fullscreen
  function updateFSButton() {
    uFS.textContent = document.fullscreenElement ? "Exit FS" : "Fullscreen";
  }
  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        if (app.requestFullscreen) await app.requestFullscreen();
        else if (app.webkitRequestFullscreen) app.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch {}
    updateFSButton();
  }
  uFS.addEventListener("click", toggleFullscreen);
  updateFSButton();

  // ---- Init
  vCell.textContent = `${cell}px`;
  uFit.textContent = `Fit: ${fit}`;
  resize();

  // ---- Helpers
  function pickSrc(it) {
    // works for images; for video it usually falls back to source_url
    return (
      it?.media_details?.sizes?.large?.source_url ||
      it?.media_details?.sizes?.medium_large?.source_url ||
      it?.media_details?.sizes?.medium?.source_url ||
      it?.source_url ||
      it?.guid?.rendered ||
      ""
    );
  }
  function toRelative(src) {
    try { return new URL(src).pathname; } catch { return src; }
  }
  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function int(v, def = 0) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : def;
  }
  function isTrue(s) { return ["1", "true", "yes", "y"].includes(String(s).toLowerCase()); }
})();
