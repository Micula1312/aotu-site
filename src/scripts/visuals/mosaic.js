// mosaic.js (ALL-IN-ONE)

export function createMosaicEngine({ mountEl, audioUrl, params, onStatus, onCount }) {
  const state = {
    running: true,
    rafId: 0,
    loopStarted: false,

    // pan/zoom/rotate (used only in fullscreen / fakefs)
    vX: 0,
    vY: 0,
    vS: 1,
    vR: 0, // radians

    DPR: Math.min(2, window.devicePixelRatio || 1),
    W: 0,
    H: 0,

    mediaList: [],
    idx: 0,
    current: { img: null, tiles: null, idx: 0, maxDelay: 0, tagsText: "" },
    prepared: { img: null, tiles: null, idx: 0, ready: false, maxDelay: 0, tagsText: "" },
    prevFull: null,

    tStart: 0,
    entering: true,

    audioEl: null,
    audioCtx: null,
    analyser: null,
    td: null,
    lastTrig: 0,
    rmsSm: 0,
  };

  // ---- DOM
  const stageWrap = document.createElement("div");
  stageWrap.className = "stageWrap";
  mountEl.appendChild(stageWrap);

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

  const statusEl = document.createElement("div");
  statusEl.className = "status";
  statusEl.textContent = "carico…";
  stage.appendChild(statusEl);

  const tagsEl = document.createElement("div");
  tagsEl.className = "tags";
  tagsEl.textContent = "";
  viewport.appendChild(tagsEl); // così pan+zoom lo trascinano

  const off = document.createElement("canvas");
  const octx = off.getContext("2d", { willReadFrequently: true });

  function setStatus(s) {
    statusEl.textContent = s;
    onStatus && onStatus(s);
  }
  function setTagsText(txt) {
    tagsEl.textContent = txt || "";
  }

  // ---- helpers
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  function isFS() {
    return !!document.fullscreenElement || document.documentElement.classList.contains("fakefs");
  }
  function applyViewportTransform() {
    viewport.style.setProperty("--vx", `${state.vX}px`);
    viewport.style.setProperty("--vy", `${state.vY}px`);
    viewport.style.setProperty("--vs", `${state.vS}`);
    viewport.style.setProperty("--vr", `${state.vR}rad`);
  }

  // ---- gesture math (pan + pinch + rotate)
  const pointers = new Map();
  let startVX = 0,
    startVY = 0,
    startVS = 1,
    startVR = 0;

  let startCenter = null;
  let startDist = 0;
  let startAng = 0;

  const center2 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ang2 = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

  function getPoint(e) {
    return { x: e.clientX, y: e.clientY };
  }

  // iOS Safari: avoid page scroll when manipulating
  viewport.addEventListener(
    "touchmove",
    (e) => {
      if (isFS()) e.preventDefault();
    },
    { passive: false }
  );

  viewport.addEventListener("pointerdown", (e) => {
    if (!isFS()) return;
    viewport.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, getPoint(e));

    startVX = state.vX;
    startVY = state.vY;
    startVS = state.vS;
    startVR = state.vR;

    if (pointers.size === 2) {
      const arr = Array.from(pointers.values());
      startCenter = center2(arr[0], arr[1]);
      startDist = dist2(arr[0], arr[1]) || 1;
      startAng = ang2(arr[0], arr[1]) || 0;
    } else {
      startCenter = null;
      startDist = 0;
      startAng = 0;
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!isFS()) return;
    if (!pointers.has(e.pointerId)) return;

    const prev = pointers.get(e.pointerId);
    const cur = getPoint(e);
    pointers.set(e.pointerId, cur);

    if (pointers.size === 1) {
      // manual delta (movementX is unreliable on iOS)
      const dx = (cur.x - prev.x) || 0;
      const dy = (cur.y - prev.y) || 0;
      state.vX += dx;
      state.vY += dy;
      applyViewportTransform();
      return;
    }

    if (pointers.size === 2) {
      const arr = Array.from(pointers.values());
      const c = center2(arr[0], arr[1]);
      const d = dist2(arr[0], arr[1]) || 1;
      const a = ang2(arr[0], arr[1]) || 0;

      const scale = d / (startDist || d);
      state.vS = clamp(startVS * scale, 0.55, 3.75);

      // rotate: delta angle
      const da = a - (startAng || a);
      state.vR = startVR + da;

      // pan: follow center movement
      if (startCenter) {
        state.vX = startVX + (c.x - startCenter.x);
        state.vY = startVY + (c.y - startCenter.y);
      }
      applyViewportTransform();
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    try {
      viewport.releasePointerCapture?.(e.pointerId);
    } catch {}
    startCenter = null;
    startDist = 0;
    startAng = 0;
  }
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);

  // ---- sizing
  function resize() {
    state.DPR = Math.min(2, window.devicePixelRatio || 1);

    const r = viewport.getBoundingClientRect();
    state.W = Math.max(1, Math.floor(r.width));
    state.H = Math.max(1, Math.floor(r.height));

    cvs.width = Math.floor(state.W * state.DPR);
    cvs.height = Math.floor(state.H * state.DPR);
    ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0);
  }

  function coverDrawToCtx(img, targetCtx) {
    const { W, H } = state;
    const iw = img.naturalWidth,
      ih = img.naturalHeight;
    const s = params.fit === "cover" ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
    const dw = iw * s,
      dh = ih * s;
    const dx = (W - dw) / 2,
      dy = (H - dh) / 2;
    targetCtx.drawImage(img, dx, dy, dw, dh);
  }

  function coverDrawToOff(img) {
    const { W, H } = state;
    off.width = W;
    off.height = H;
    octx.clearRect(0, 0, W, H);
    coverDrawToCtx(img, octx);
  }

  function buildTilesForImage(img) {
    const { W, H } = state;
    if (params.cell <= 0) return { tiles: null, maxDelay: 0 };

    const MAX_TILES = 12000;
    let step = Math.max(1, params.cell);
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
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          list.push({ x, y, c: `rgba(${r},${g},${b},${a / 255})`, step, delay: 0 });
        }
      }
    }

    const spread = 700;
    const cx0 = W / 2,
      cy0 = H / 2;
    let maxDelay = 0;

    for (let k = 0; k < list.length; k++) {
      const t = list[k];
      let d = 0;
      if (params.order === "random") d = Math.random() * spread;
      else if (params.order === "left") d = (t.x / W) * spread;
      else if (params.order === "top") d = (t.y / H) * spread;
      else if (params.order === "center") {
        const dist = Math.hypot(t.x - cx0, t.y - cy0) / Math.hypot(cx0, cy0);
        d = dist * spread;
      }
      t.delay = d;
      if (d > maxDelay) maxDelay = d;
    }

    return { tiles: list, maxDelay };
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function toRelative(src) {
    try {
      return new URL(src).pathname;
    } catch {
      return src;
    }
  }

  function pickSrc(it) {
    return (
      it?.media_details?.sizes?.large?.source_url ||
      it?.media_details?.sizes?.medium_large?.source_url ||
      it?.media_details?.sizes?.medium?.source_url ||
      it?.source_url ||
      it?.guid?.rendered ||
      ""
    );
  }

  function normalizeTagName(n) {
    return String(n || "").trim().replace(/^#+/, "").replace(/\s+/g, "");
  }

  function tagsTextFromNames(names) {
    const clean = (names || []).map(normalizeTagName).filter(Boolean);
    if (!clean.length) return "";
    return clean.map((n) => `#${n}`).join(" ");
  }

  function extractPostTagNames(it) {
    const terms = it?._embedded?.["wp:term"];
    if (!Array.isArray(terms) || !terms.length) return [];
    return terms
      .flat()
      .filter((t) => t?.taxonomy === "post_tag" && t?.name)
      .map((t) => t.name);
  }

  // ---- media loading
  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      if (!params.useProxy) img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  function captureVideoFrameAsImage(src) {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      if (!params.useProxy) v.crossOrigin = "anonymous";
      v.src = src;

      const cleanup = () => {
        v.src = "";
        v.load?.();
      };
      const onFail = () => {
        cleanup();
        reject(new Error("video frame fail"));
      };

      v.addEventListener("error", onFail, { once: true });
      v.addEventListener(
        "loadeddata",
        async () => {
          try {
            const tw = Math.max(1, v.videoWidth || 640);
            const th = Math.max(1, v.videoHeight || 360);
            const tc = document.createElement("canvas");
            tc.width = tw;
            tc.height = th;
            const tctx = tc.getContext("2d");
            tctx.drawImage(v, 0, 0, tw, th);
            const dataUrl = tc.toDataURL("image/jpeg", 0.85);
            cleanup();
            const img = await loadImage(dataUrl);
            resolve(img);
          } catch {
            onFail();
          }
        },
        { once: true }
      );
    });
  }

  async function loadMediaAsImage(media) {
    if (media.kind === "image") return loadImage(media.src);
    return captureVideoFrameAsImage(media.src);
  }

  // ---- audio graph (muted, analyser only)
  const thresh = 0.12;
  const smooth = 0.9;

  function audioActive() {
    return !!(state.audioEl && !state.audioEl.paused && state.analyser && state.td);
  }

  function ensureAudioGraph() {
    if (state.audioEl) return;

    const audioEl = document.createElement("audio");
    audioEl.src = audioUrl;
    audioEl.preload = "auto";
    audioEl.loop = true;
    audioEl.muted = true;
    audioEl.volume = 0;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaElementSource(audioEl);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.65;
    const td = new Uint8Array(analyser.fftSize);

    const gain0 = audioCtx.createGain();
    gain0.gain.value = 0;

    src.connect(analyser);
    analyser.connect(gain0);
    gain0.connect(audioCtx.destination);

    state.audioEl = audioEl;
    state.audioCtx = audioCtx;
    state.analyser = analyser;
    state.td = td;

    audioCtx.resume().catch(() => {});
    audioEl.play().catch(() => {});
  }

  function computeRMS() {
    state.analyser.getByteTimeDomainData(state.td);
    let sum = 0;
    for (let i = 0; i < state.td.length; i++) {
      const v = (state.td[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / state.td.length);
    state.rmsSm = smooth * state.rmsSm + (1 - smooth) * rms;
    return state.rmsSm;
  }

  // ---- switching
  function triggerSwitch(tNow) {
    if (!state.prepared.ready) return;

    state.prevFull = params.cell <= 0 ? state.current.img : state.current.tiles;

    state.current.idx = state.prepared.idx;
    state.current.img = state.prepared.img;
    state.current.tiles = state.prepared.tiles;
    state.current.maxDelay = state.prepared.maxDelay;
    state.current.tagsText = state.prepared.tagsText;

    setTagsText(state.current.tagsText);

    state.tStart = tNow;
    state.entering = true;

    prepareNext();
  }

  function prepareNext() {
    state.prepared.ready = false;
    state.prepared.idx = (state.current.idx + 1) % state.mediaList.length;

    const next = state.mediaList[state.prepared.idx];

    loadMediaAsImage(next)
      .then((img) => {
        state.prepared.img = img;
        const built = buildTilesForImage(img);
        state.prepared.tiles = built.tiles;
        state.prepared.maxDelay = built.maxDelay;
        state.prepared.tagsText = next.tagsText || "";
        state.prepared.ready = true;
      })
      .catch(() => {
        state.prepared.ready = false;
      });
  }

  // ---- drawing
  function drawTiles(tNow) {
    const t = tNow - state.tStart;
    const { W, H } = state;

    if (params.cell <= 0) {
      const enterDur = 500;
      ctx.clearRect(0, 0, W, H);

      if (state.entering) {
        if (state.prevFull) coverDrawToCtx(state.prevFull, ctx);
        const k = Math.max(0, Math.min(1, t / enterDur));
        ctx.globalAlpha = k;
        coverDrawToCtx(state.current.img, ctx);
        ctx.globalAlpha = 1;

        if (t >= enterDur) {
          state.entering = false;
          state.prevFull = null;
          state.tStart = tNow;
        }
      } else {
        coverDrawToCtx(state.current.img, ctx);
        if (state.running && !audioActive() && t >= params.dwell && state.prepared.ready) {
          triggerSwitch(tNow);
        }
      }
      return;
    }

    const enterDur = 600;
    const enterEnd = state.current.maxDelay + enterDur;
    ctx.clearRect(0, 0, W, H);
    const easeOut = (x) => 1 - Math.pow(1 - x, 2);

    if (state.entering) {
      if (state.prevFull) {
        for (let i = 0; i < state.prevFull.length; i++) {
          const p = state.prevFull[i];
          ctx.fillStyle = p.c;
          ctx.fillRect(p.x, p.y, p.step, p.step);
        }
      }

      for (let i = 0; i < state.current.tiles.length; i++) {
        const p = state.current.tiles[i];
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
        state.entering = false;
        state.prevFull = null;
        state.tStart = tNow;
      }
      return;
    }

    for (let i = 0; i < state.current.tiles.length; i++) {
      const p = state.current.tiles[i];
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.step, p.step);
    }

    if (state.running && !audioActive() && t >= params.dwell && state.prepared.ready) {
      triggerSwitch(tNow);
    }
  }

  state.paused = false;

  function rafLoop() {
  if (!state.loopStarted) return;
  // disegna SEMPRE
  drawTiles(performance.now());
  state.rafId = requestAnimationFrame(rafLoop);
}

  // RMS poll (only switches when running)
  setInterval(() => {
    if (!state.running) return;
    if (!audioActive() || !state.prepared.ready) return;

    const now = performance.now();
    const rms = computeRMS();

    const cooldown = Math.max(60, Number(params.cooldown ?? 420));
    if (rms > thresh && now - state.lastTrig > cooldown) {
      state.lastTrig = now;
      triggerSwitch(now);
    }
  }, 33);

  // ---- fetch media
  async function fetchList(mediaType) {
    const endpoint = (params.site ? `${params.site}` : "") + "/wp-json/wp/v2/media";
    const u = new URL(endpoint, location.origin);
    u.searchParams.set("per_page", String(params.perPage));
    u.searchParams.set("orderby", "date");
    u.searchParams.set("order", "desc");
    u.searchParams.set("media_type", mediaType);

    u.searchParams.set("_embed", "1");
    u.searchParams.set("_fields", "id,source_url,guid,media_details,mime_type,media_type,_embedded,tags");
    if (params.search) u.searchParams.set("search", params.search);

    const res = await fetch(u.toString(), { mode: "cors" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    const allTagIds = Array.from(new Set(data.flatMap((it) => (Array.isArray(it?.tags) ? it.tags : []))));

    const tagNameById = new Map();
    if (allTagIds.length) {
      const tagEndpoint = (params.site ? `${params.site}` : "") + "/wp-json/wp/v2/tags";
      const tu = new URL(tagEndpoint, location.origin);
      tu.searchParams.set("per_page", "100");
      tu.searchParams.set("include", allTagIds.join(","));
      tu.searchParams.set("_fields", "id,name");

      const tr = await fetch(tu.toString(), { mode: "cors" });
      if (tr.ok) {
        const tags = await tr.json();
        for (const t of tags) tagNameById.set(t.id, t.name);
      }
    }

    return data
      .map((it) => {
        const src = pickSrc(it);
        if (!src) return null;

        let names = extractPostTagNames(it);
        if (!names.length && Array.isArray(it?.tags) && it.tags.length) {
          names = it.tags.map((id) => tagNameById.get(id)).filter(Boolean);
        }

        return {
          src: params.useProxy ? toRelative(src) : src,
          tagsText: tagsTextFromNames(names),
        };
      })
      .filter(Boolean);
  }

  async function start() {
    resize();

    const [imgs, vids] = await Promise.all([fetchList("image"), fetchList("video")]);

    state.mediaList = [
      ...imgs.map((m) => ({ kind: "image", ...m })),
      ...vids.map((m) => ({ kind: "video", ...m })),
    ].filter((m) => m.src);

    if (params.shuffle) shuffleInPlace(state.mediaList);

    onCount && onCount({ total: state.mediaList.length, imgs: imgs.length, vids: vids.length });

    if (!state.mediaList.length) {
      setStatus("nessun media");
      return;
    }

    state.idx = 0;
    const first = state.mediaList[state.idx];

    state.current.idx = state.idx;
    state.current.img = await loadMediaAsImage(first);
    const built = buildTilesForImage(state.current.img);
    state.current.tiles = built.tiles;
    state.current.maxDelay = built.maxDelay;
    state.current.tagsText = first.tagsText || "";
    setTagsText(state.current.tagsText);

    state.tStart = performance.now();
    state.entering = true;

    prepareNext();

    if (!state.loopStarted) {
      state.loopStarted = true;
      state.rafId = requestAnimationFrame(rafLoop);
    }

    setStatus(`ok: ${state.mediaList.length} (img ${imgs.length} + vid ${vids.length})`);
  }

    // --- iOS viewport fix
    setVhVar();
    window.addEventListener("resize", setVhVar);
    window.addEventListener("orientationchange", () => {
      setTimeout(() => { setVhVar(); resetFSView(); }, 200);
    });

    // se disponibile: ancora più preciso su iOS
    window.visualViewport?.addEventListener("resize", () => {
      setVhVar();
      if (isFS()) resetFSView();
    });

  // ---- public API
  function setParam(key, value) {
    params[key] = value;

    if (key === "blur") viewport.style.setProperty("--blur", `${value}px`);
    if (key === "invert") viewport.style.setProperty("--invert", `${value}`);
    if (key === "mode") {
      params.mode = value;

      // entrando in audio: attiva graph
      if (params.mode === "audio") {
        ensureAudioGraph();
        try { state.audioCtx?.resume?.(); state.audioEl?.play?.(); } catch {}
      } else {
        // entrando in time: spegni audio (opzionale)
        try { state.audioEl && state.audioEl.pause(); } catch {}
      }
    }

    if (key === "cell" || key === "order" || key === "fit" || key === "dwell") {
      if (state.current.img) {
        const built = buildTilesForImage(state.current.img);
        state.current.tiles = built.tiles;
        state.current.maxDelay = built.maxDelay;
        state.tStart = performance.now();
        state.entering = true;
      }
      if (state.prepared.ready && state.prepared.img) {
        const built2 = buildTilesForImage(state.prepared.img);
        state.prepared.tiles = built2.tiles;
        state.prepared.maxDelay = built2.maxDelay;
      }
      state.prevFull = null;
    }
  }

async function toggleRun() {
  state.running = !state.running;

  // se torni in running e sei in audio-mode, riattiva audio
  if (state.running && params.mode === "audio") {
    ensureAudioGraph();
    try {
      if (state.audioCtx && state.audioCtx.state === "suspended") await state.audioCtx.resume();
      await state.audioEl.play();
    } catch {}
  }

  // se metti in pausa: stoppa solo audio
  if (!state.running) {
    try { state.audioEl && state.audioEl.pause(); } catch {}
  }

  return state.running;
}

function isIOS() {
  // iPhone/iPad/iPod + iPadOS che finge Mac
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function setVhVar() {
  // iOS Safari: 100vh ballerino -> usiamo --vh
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}
setVhVar();
window.addEventListener("resize", setVhVar);
window.addEventListener("orientationchange", setVhVar);

async function toggleFullscreen() {
  const docEl = document.documentElement;
  const doc = document;

  // iOS: niente fullscreen “vero” affidabile -> SOLO fakefs
  if (isIOS()) {
    docEl.classList.toggle("fakefs");
    setVhVar();
    resetFSView();
    return;
  }

  // Desktop/Android: fullscreen nativo
  const el = mountEl;
  const req =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen;

  const exit =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.msExitFullscreen;

  try {
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) await req.call(el);
    else await exit.call(doc);
    resetFSView();
  } catch {
    // fallback se qualcosa va storto
    docEl.classList.toggle("fakefs");
    setVhVar();
    resetFSView();
  }
}

function resetFSView() {
  state.vX = 0;
  state.vY = 0;
  state.vS = 1;
  state.vR = 0;
  applyViewportTransform();
  resize();

  // 🔥 draw immediato post-resize (anti-nero)
  drawTiles(performance.now());
}
  // iOS address bar / rotation resize
  const vv = window.visualViewport;
  const onAnyResize = () => {
    resize();
    setParam("cell", params.cell);
  };
  window.addEventListener("resize", onAnyResize);
  vv && vv.addEventListener("resize", onAnyResize);

  document.addEventListener("fullscreenchange", () => {
    if (isFS()) resetFSView();
  });

  applyViewportTransform();

  viewport.style.setProperty("--blur", `${params.blur || 0}px`);
  viewport.style.setProperty("--invert", `${params.invert || 0}`);

  return {
    start,
    setParam,
    toggleRun,
    toggleFullscreen,
    resetFSView,
    audioActive: () => audioActive(),
    setStatus,
    reload: () => location.reload(),
  };
}

export function mountMosaicUI({ mountEl, params, engine }) {
  const $ = (s, r = document) => r.querySelector(s);

  const ui = document.createElement("div");
  ui.className = "ui";
  ui.innerHTML = `
    <h3>#Untamed visuals</h3>
    <div class="row" style="gap:10px;">
      <button id="uRun" type="button" class="btn">Pausa</button>
      <button id="uReload" type="button" class="btn">Reset</button>
    </div>

    <label>Velocità
      <input id="uDwell" type="range" min="300" max="8000" step="100">
      <div class="row"><span class="val" id="vDwell"></span><span class="val">ms</span></div>
    </label>

    <label>Offuscamento
      <input id="uBlur" type="range" min="0" max="16" step="0.5">
      <div class="row"><span class="val" id="vBlur"></span><span class="val">px</span></div>
    </label>

    <label>Inverti i colori!
      <input id="uInv" type="range" min="0" max="1" step="0.05">
      <div class="row"><span class="val" id="vInv"></span><span class="val">0..1</span></div>
    </label>

    <label>Pixelate (cell)
      <input id="uCell" type="range" min="0" max="40" step="1">
      <div class="row"><span class="val" id="vCell"></span><span class="pill">0 = nitido</span></div>
    </label>

    <label>Pixel direction
      <select id="uOrder">
        <option value="random">random</option>
        <option value="left">da sinistra</option>
        <option value="top">dall’alto</option>
        <option value="center">dal centro</option>
      </select>
    </label>

    <label>Cooldown (audio)
      <input id="uCool" type="range" min="120" max="2500" step="20">
      <div class="row"><span class="val" id="vCool"></span><span class="val">ms</span></div>
    </label>

    <button id="uFit" type="button"></button>

    <button id="uFS" type="button" class="btn attack">ATTACK</button>
  `;
  mountEl.appendChild(ui);

  const uCell = $("#uCell", ui),
    vCell = $("#vCell", ui);
  const uDwell = $("#uDwell", ui),
    vDwell = $("#vDwell", ui);
  const uBlur = $("#uBlur", ui),
    vBlur = $("#vBlur", ui);
  const uInv = $("#uInv", ui),
    vInv = $("#vInv", ui);
  const uOrder = $("#uOrder", ui);
  const uCool = $("#uCool", ui),
    vCool = $("#vCool", ui);

  const uFit = $("#uFit", ui);
  const uRun = $("#uRun", ui);
  const uReload = $("#uReload", ui);
  const uFS = $("#uFS", ui);

  // init values
  uCell.value = String(params.cell);
  vCell.textContent = `${params.cell}px`;

  uDwell.value = String(params.dwell);
  vDwell.textContent = String(params.dwell);

  uBlur.value = String(params.blur || 0);
  vBlur.textContent = `${params.blur || 0}`;

  uInv.value = String(params.invert || 0);
  vInv.textContent = (params.invert || 0).toFixed(2);

  uOrder.value = params.order;

  params.cooldown ??= 420;
  uCool.value = String(params.cooldown);
  vCool.textContent = String(params.cooldown);

  uFit.textContent = `Fit: ${params.fit}`;

  uCell.addEventListener("input", () => {
    params.cell = parseInt(uCell.value, 10) || 0;
    vCell.textContent = `${params.cell}px`;
    engine.setParam("cell", params.cell);
  });

  uDwell.addEventListener("input", () => {
    params.dwell = Math.max(300, Math.min(8000, parseInt(uDwell.value, 10) || 1200));
    vDwell.textContent = String(params.dwell);
    engine.setParam("dwell", params.dwell);
  });

  uBlur.addEventListener("input", () => {
    params.blur = parseFloat(uBlur.value) || 0;
    vBlur.textContent = `${params.blur}`;
    engine.setParam("blur", params.blur);
  });

  uInv.addEventListener("input", () => {
    params.invert = parseFloat(uInv.value) || 0;
    vInv.textContent = params.invert.toFixed(2);
    engine.setParam("invert", params.invert);
  });

  uOrder.addEventListener("change", () => {
    params.order = uOrder.value;
    engine.setParam("order", params.order);
  });

  uCool.addEventListener("input", () => {
    params.cooldown = parseInt(uCool.value, 10) || 420;
    vCool.textContent = String(params.cooldown);
    engine.setParam("cooldown", params.cooldown);
  });

  uFit.addEventListener("click", () => {
    params.fit = params.fit === "cover" ? "contain" : "cover";
    uFit.textContent = `Fit: ${params.fit}`;
    engine.setParam("fit", params.fit);
  });

  uRun.addEventListener("click", async () => {
    const running = await engine.toggleRun();
    uRun.textContent = running ? "Pausa" : "Play";
  });

  uReload.addEventListener("click", () => engine.reload());
  uFS.addEventListener("click", () => engine.toggleFullscreen());

  function updateFSButton() {
    const fs = document.fullscreenElement || document.documentElement.classList.contains("fakefs");
    uFS.setAttribute("data-fs", fs ? "1" : "0");
  }
  document.addEventListener("fullscreenchange", updateFSButton);
  document.addEventListener("webkitfullscreenchange", updateFSButton);
  updateFSButton();

  return { ui };
}

// -------------------------------------------------------
// BOOTSTRAP
(() => {
  const qs = new URLSearchParams(location.search);

  const root = document.getElementById("mosaic-root");
  const wpFromDom = (root?.dataset.wp || "").replace(/\/+$/, "");
  const audioUrl = root?.dataset.audio || "";

  const site = (qs.get("site") || wpFromDom || "").replace(/\/+$/, "");
  const useProxy = !site || ["1", "true", "yes", "y"].includes((qs.get("proxy") || "1").toLowerCase());

  const params = {
    site,
    useProxy,
    perPage: clampInt(qs.get("perPage"), 300, 1, 300),
    search: qs.get("q") || "",
    fit: qs.get("fit") || "cover",
    dwell: clampInt(qs.get("dwell"), 1200, 300, 8000),
    cell: clampInt(qs.get("cell"), 16, 0, 40),
    order: qs.get("order") || "random",
    shuffle: isTrue(qs.get("shuffle") || "1"),
    blur: 0,
    invert: 0,
    cooldown: clampInt(qs.get("cooldown"), 420, 60, 5000),
    mode: "audio", // "audio" | "time"
  };

  injectCSS();

  const app = document.createElement("div");
  app.className = "app";
  document.body.appendChild(app);

  const engine = createMosaicEngine({
    mountEl: app,
    audioUrl,
    params,
    onStatus: () => {},
    onCount: () => {},
  });

  mountMosaicUI({ mountEl: app, params, engine });

  engine.start().catch((e) => console.error("[mosaic] start error:", e));

  function clampInt(v, def, min, max) {
    const n = parseInt(v, 10);
    const x = Number.isFinite(n) ? n : def;
    return Math.max(min, Math.min(max, x));
  }

  function isTrue(s) {
    return ["1", "true", "yes", "y"].includes(String(s).toLowerCase());
  }

  function injectCSS() {
    const style = document.createElement("style");
    style.textContent = `
:root{
  --ui-bg: rgba(12,12,12,.70);
  --ui-bd:#2c2c2c;
  --panel-w: 260px;
  --blur: 0px;
  --invert: 0;

  --au-green: #b6ff00;
  --au-green2: rgba(182,255,0,.35);
}

html,body{
  margin:0;
  height:100%;
  background:#0b0b0b;
  color:#ddd;
  font-family:system-ui,Arial,sans-serif;
  overflow:hidden;
  overscroll-behavior: none;
}

.app{
  position:fixed;
  inset:0;
  display:flex;
  align-items:stretch;
  height: calc(var(--vh, 1vh) * 100);
}
.stageWrap{ position:relative; flex:1; display:flex; align-items:center; justify-content:center; background:#0b0b0b; }
.stage{
  position:relative;
  width:min(calc(100vw - var(--panel-w)), 100vh);
  height:min(calc(100vw - var(--panel-w)), 100vh);
  background:#000;
  overflow:hidden;
  border:1px solid var(--au-green2);
  border-radius:12px;
}

.viewport{
  position:relative; left:50%; top:50%;
  width:100%; height:100%;
  transform:
    translate(-50%,-50%)
    translate(var(--vx, 0px), var(--vy, 0px))
    rotate(var(--vr, 0rad))
    scale(var(--vs, 1));
  transform-origin:center center;
  overflow:hidden;
  touch-action:none;
  will-change: transform;
  filter: blur(var(--blur)) invert(var(--invert));
  border: 2px solid var(--au-green);
  box-sizing: border-box;
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
  position:absolute; left:12px; bottom:12px; z-index:20;
  color: var(--au-green);
  font-family: Helvetica, Arial, system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.25;
  letter-spacing: 0.2px;
  opacity: 0.98;
  user-select:none;
  pointer-events:none;
  white-space: pre-wrap;
  background: rgba(0,0,0,.35);
  padding: 6px 10px;
  border-radius: 12px;
  backdrop-filter: blur(6px);
  text-shadow:
    0 0 8px rgba(182,255,0,.55),
    0 0 18px rgba(182,255,0,.35);
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
.ui input[type="range"]{width:100%; accent-color: var(--au-green); }
.ui select{
  border:1px solid rgba(182,255,0,.35);
  background:transparent; color:#ddd;
  border-radius:10px; padding:7px 10px; font:12px system-ui;
  box-shadow: 0 0 0 1px rgba(0,0,0,.35) inset;
}
.val{opacity:.85; font-variant-numeric: tabular-nums;}
.pill{display:inline-flex; padding:4px 8px; border:1px solid rgba(255,255,255,.10); border-radius:999px; opacity:.85;}

.ui button{
  border: 1px solid rgba(182,255,0,.55);
  background: rgba(182,255,0,.10);
  color: #dfff9a;
  border-radius: 14px;
  padding: 10px 12px;
  font: 12px/1 system-ui;
  letter-spacing: .3px;
  text-transform: uppercase;
  box-shadow:
    0 0 0 1px rgba(0,0,0,.35) inset,
    0 10px 22px rgba(0,0,0,.35),
    0 0 18px rgba(182,255,0,.18);
  transition: transform .08s ease, background .12s ease, box-shadow .12s ease;
}
.ui button:hover{
  background: rgba(182,255,0,.16);
  box-shadow:
    0 0 0 1px rgba(0,0,0,.35) inset,
    0 12px 26px rgba(0,0,0,.38),
    0 0 26px rgba(182,255,0,.28);
}
.ui button:active{ transform: translateY(1px) scale(.99); }
.ui button.btn{ width: 100%; }

.ui button.attack{
  background: rgba(182,255,0,.22);
  color: #0b0b0b;
  border-color: rgba(182,255,0,.95);
  box-shadow:
    0 0 0 1px rgba(0,0,0,.45) inset,
    0 16px 34px rgba(0,0,0,.45),
    0 0 30px rgba(182,255,0,.38);
}
.ui button.attack:hover{
  background: rgba(182,255,0,.30);
  box-shadow:
    0 0 0 1px rgba(0,0,0,.45) inset,
    0 18px 38px rgba(0,0,0,.48),
    0 0 40px rgba(182,255,0,.52);
}

/* Fullscreen (real) */
:is(:fullscreen, :-webkit-full-screen) .ui{ opacity:0 !important; pointer-events:none !important; }
:is(:fullscreen, :-webkit-full-screen) .status{ opacity:0 !important; pointer-events:none !important; }
:is(:fullscreen, :-webkit-full-screen) .stage{ width:100vw; height:100vh; border-radius:0; }
:is(:fullscreen, :-webkit-full-screen) .viewport{
  width: min(100vw, 100vh);
  height: min(100vw, 100vh);
  border-width: 3px;
  box-shadow:
    0 0 0 1px rgba(0,0,0,.35) inset,
    0 0 24px rgba(182,255,0,.25);
}
:is(:fullscreen, :-webkit-full-screen) .tags{
  font-size: 32px;
  line-height: 1.18;
  letter-spacing: 0.3px;
  max-width: min(92vw, 92vh);
  left: 24px;
  bottom: 24px;
}

/* iOS fake fullscreen */
.fakefs body{ overflow:hidden !important; }
.fakefs .app{ position:fixed !important; inset:0 !important; width:100vw !important; height:100vh !important; }
.fakefs .stage{ width:100vw !important; height:100vh !important; border-radius:0 !important; }
.fakefs .viewport{ width:min(100vw, 100vh) !important; height:min(100vw, 100vh) !important; }
.fakefs .ui, .fakefs .status{ opacity:0 !important; pointer-events:none !important; }
`;
    document.head.appendChild(style);
  }
})();
