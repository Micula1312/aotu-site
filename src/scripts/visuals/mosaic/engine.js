// mosaic/engine.js
export function createMosaicEngine({ mountEl, audioUrl, params, onStatus, onCount }) {
  const state = {
    running: true,
    rafId: 0,
    loopStarted: false,

    vX: 0, vY: 0, vS: 1,

    DPR: Math.min(2, devicePixelRatio || 1),
    W: 0, H: 0,

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
  //stage.appendChild(tagsEl);
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
  function isFS() { return !!document.fullscreenElement; }

  function applyViewportTransform() {
    viewport.style.setProperty("--vx", `${state.vX}px`);
    viewport.style.setProperty("--vy", `${state.vY}px`);
    viewport.style.setProperty("--vs", `${state.vS}`);
  }

  // ---- fullscreen gestures (FS only)
  const pointers = new Map();
  let startVX = 0, startVY = 0, startVS = 1;
  let startCenter = null, startDist = 0;
  const center2 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  viewport.addEventListener("pointerdown", (e) => {
    if (!isFS()) return;
    viewport.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startVX = state.vX; startVY = state.vY; startVS = state.vS;

    if (pointers.size === 2) {
      const arr = Array.from(pointers.values());
      startCenter = center2(arr[0], arr[1]);
      startDist = dist2(arr[0], arr[1]) || 1;
    } else {
      startCenter = null; startDist = 0;
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!isFS()) return;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      state.vX += e.movementX || 0;
      state.vY += e.movementY || 0;
      applyViewportTransform();
      return;
    }

    if (pointers.size === 2) {
      const arr = Array.from(pointers.values());
      const c = center2(arr[0], arr[1]);
      const d = dist2(arr[0], arr[1]) || 1;
      const scale = d / (startDist || d);
      state.vS = clamp(startVS * scale, 0.6, 3.5);

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
    try { viewport.releasePointerCapture?.(e.pointerId); } catch {}
    startCenter = null; startDist = 0;
  }
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);

  // ---- sizing
  function resize() {
    state.DPR = Math.min(2, devicePixelRatio || 1);
    const r = viewport.getBoundingClientRect();
    state.W = Math.max(1, Math.floor(r.width));
    state.H = Math.max(1, Math.floor(r.height));
    cvs.width = Math.floor(state.W * state.DPR);
    cvs.height = Math.floor(state.H * state.DPR);
    ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0);
  }

  function coverDrawToCtx(img, targetCtx) {
    const { W, H } = state;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = params.fit === "cover" ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
    const dw = iw * s, dh = ih * s;
    const dx = (W - dw) / 2, dy = (H - dh) / 2;
    targetCtx.drawImage(img, dx, dy, dw, dh);
  }

  function coverDrawToOff(img) {
    const { W, H } = state;
    off.width = W; off.height = H;
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
          const r = data[i], g = data[i + 1], b = data[i + 2];
          list.push({ x, y, c: `rgba(${r},${g},${b},${a / 255})`, step, delay: 0 });
        }
      }
    }

    const spread = 700;
    const cx0 = W / 2, cy0 = H / 2;
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
    try { return new URL(src).pathname; } catch { return src; }
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

  // ---- TAGS: prendiamo post_tag da _embedded wp:term (che tu hai già!)
  function extractPostTagNames(it) {
    const terms = it?._embedded?.["wp:term"];
    if (!terms?.length) return [];
    const flat = terms.flat();
    return flat
      .filter(t => t?.taxonomy === "post_tag" && t?.name)
      .map(t => t.name);
  }

function normalizeTagName(n) {
  return String(n || "")
    .trim()
    .replace(/^#+/, "")     // se WP ti manda "#pigneto"
    .replace(/\s+/g, "");   // no spazi
}

function tagsTextFromNames(names) {
  const clean = (names || [])
    .map(normalizeTagName)
    .filter(Boolean);
  if (!clean.length) return "";
  return clean.map(n => `#${n}`).join(" ");
}

function extractPostTagNames(it) {
  const terms = it?._embedded?.["wp:term"];
  if (!Array.isArray(terms) || !terms.length) return [];
  return terms
    .flat()
    .filter(t => t?.taxonomy === "post_tag" && t?.name)
    .map(t => t.name);
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

      const cleanup = () => { v.src = ""; v.load?.(); };
      const onFail = () => { cleanup(); reject(new Error("video frame fail")); };

      v.addEventListener("error", onFail, { once: true });
      v.addEventListener("loadeddata", async () => {
        try {
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
        } catch {
          onFail();
        }
      }, { once: true });
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
        if (!audioActive() && t >= params.dwell && state.prepared.ready) triggerSwitch(tNow);
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

    if (!audioActive() && t >= params.dwell && state.prepared.ready) triggerSwitch(tNow);
  }

  function rafLoop() {
    if (!state.running) return;
    drawTiles(performance.now());
    state.rafId = requestAnimationFrame(rafLoop);
  }

  // RMS poll (only switches when running)
  setInterval(() => {
    if (!state.running) return;
    if (!audioActive() || !state.prepared.ready) return;

    const now = performance.now();
    const rms = computeRMS();

    // microreact: optional
    if (params.microBlur) {
      const maxB = Number(params.microBlurMax ?? 2.0);
      const b = Math.max(0, Math.min(maxB, (rms - 0.03) * 28));
      viewport.style.setProperty("--blur", `${b.toFixed(2)}px`);
    }

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

  // Anche se _embed a volte “salta” in lista, lo chiediamo lo stesso:
  u.searchParams.set("_embed", "1");
  u.searchParams.set("_fields", "id,source_url,guid,media_details,mime_type,media_type,_embedded,tags");
  if (params.search) u.searchParams.set("search", params.search);

  const res = await fetch(u.toString(), { mode: "cors" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();

  // 1) raccogli tutti gli ID tag presenti nei media
  const allTagIds = Array.from(
    new Set(
      data.flatMap(it => Array.isArray(it?.tags) ? it.tags : [])
    )
  );

  // 2) costruisci mappa id->name con UNA fetch
  const tagNameById = new Map();
  if (allTagIds.length) {
    const tagEndpoint = (params.site ? `${params.site}` : "") + "/wp-json/wp/v2/tags";
    const tu = new URL(tagEndpoint, location.origin);
    tu.searchParams.set("per_page", "100"); // se hai più di 100 tag, aumentiamo dopo
    tu.searchParams.set("include", allTagIds.join(","));
    tu.searchParams.set("_fields", "id,name");

    const tr = await fetch(tu.toString(), { mode: "cors" });
    if (tr.ok) {
      const tags = await tr.json();
      for (const t of tags) tagNameById.set(t.id, t.name);
    }
  }

  // 3) mappa media -> {src, tagsText}, con priorità a _embedded, fallback su tag IDs
  return data
    .map((it) => {
      const src = pickSrc(it);
      if (!src) return null;

      // A) prova da _embedded
      let names = extractPostTagNames(it);

      // B) fallback da IDs
      if (!names.length && Array.isArray(it?.tags) && it.tags.length) {
        names = it.tags.map(id => tagNameById.get(id)).filter(Boolean);
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
    console.log("FIRST TAGS:", state.current.tagsText, first);

    state.tStart = performance.now();
    state.entering = true;

    prepareNext();

    if (!state.loopStarted) {
      state.loopStarted = true;
      state.running = true;
      state.rafId = requestAnimationFrame(rafLoop);
    }

    setStatus(`ok: ${state.mediaList.length} (img ${imgs.length} + vid ${vids.length})`);
  }

  // ---- public API
  function setParam(key, value) {
    params[key] = value;

    if (key === "blur") viewport.style.setProperty("--blur", `${value}px`);
    if (key === "invert") viewport.style.setProperty("--invert", `${value}`);
    if (key === "microBlur") {
      // no-op here; handled in rms loop
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

    if (state.running) {
      ensureAudioGraph();
      try {
        if (state.audioCtx && state.audioCtx.state === "suspended") await state.audioCtx.resume();
        await state.audioEl.play();
      } catch {}
      state.rafId = requestAnimationFrame(rafLoop);
    } else {
      try { state.audioEl && state.audioEl.pause(); } catch {}
      if (state.rafId) cancelAnimationFrame(state.rafId);
    }
    return state.running;
  }

  function toggleFullscreen() {
    return (async () => {
      try {
        if (!document.fullscreenElement) {
          if (mountEl.requestFullscreen) await mountEl.requestFullscreen();
          else if (mountEl.webkitRequestFullscreen) mountEl.webkitRequestFullscreen();
        } else {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
      } catch {}
    })();
  }

  function resetFSView() {
    state.vX = 0; state.vY = 0; state.vS = 1;
    applyViewportTransform();
    resize();
  }

  window.addEventListener("resize", () => {
    resize();
    setParam("cell", params.cell);
  });

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
