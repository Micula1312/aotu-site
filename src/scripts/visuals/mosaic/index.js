// src/scripts/visuals/mosaic/index.js
import { createMosaicEngine } from "./engine.js";
import { mountMosaicUI } from "./ui.js";

(() => {
  const qs = new URLSearchParams(location.search);

  // Read config from DOM (set by mosaic.astro)
  const root = document.getElementById("mosaic-root");
  const wpFromDom = (root?.dataset.wp || "").replace(/\/+$/, "");
  const audioUrl = root?.dataset.audio || "";

  // URL params override (optional)
  const site = (qs.get("site") || wpFromDom || "").replace(/\/+$/, "");
  const useProxy =
    !site ||
    ["1", "true", "yes", "y"].includes((qs.get("proxy") || "1").toLowerCase());

  const params = {
    site,
    useProxy,
    perPage: clampInt(qs.get("perPage"), 100, 1, 100),
    search: qs.get("q") || "",
    fit: qs.get("fit") || "cover",
    dwell: clampInt(qs.get("dwell"), 1200, 300, 8000),
    cell: clampInt(qs.get("cell"), 16, 0, 40),
    order: qs.get("order") || "random",
    shuffle: isTrue(qs.get("shuffle") || "1"),
    blur: 0,
    invert: 0,
    cooldown: clampInt(qs.get("cooldown"), 420, 60, 5000),
    microBlur: false,
    microBlurMax: 2.0,
  };

  // Tags overlay only if provided
//   const tagsRaw = (qs.get("tags") || "").trim();
//   const tags = tagsRaw
//     ? tagsRaw
//         .split(",")
//         .map((t) => t.trim())
//         .filter(Boolean)
//         .map((t) => (t.startsWith("#") ? t : `#${t}`))
//     : [];

  // ---- Shared CSS (app + stage + FS rules)
  injectCSS();

  // Mount app container
  const app = document.createElement("div");
  app.className = "app";
  document.body.appendChild(app);

  // Create engine
  const engine = createMosaicEngine({
    mountEl: app,
    audioUrl,
    params,
    onStatus: () => {},
    onCount: () => {},
  });


  // Mount UI
  mountMosaicUI({ mountEl: app, params, engine });

  // Start
  engine
    .start()
    .catch((e) => console.error("[mosaic] start error:", e));

  // ---------------- helpers ----------------
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

  /* AU */
  --au-green: #b6ff00;
  --au-green2: rgba(182,255,0,.35);
}

html,body{margin:0;height:100%;background:#0b0b0b;color:#ddd;font-family:system-ui,Arial,sans-serif;overflow:hidden}

.app{ position:fixed; inset:0; display:flex; align-items:stretch; }
.stageWrap{ position:relative; flex:1; display:flex; align-items:center; justify-content:center; background:#0b0b0b; }
.stage{
  position:relative;
  width:min(calc(100vw - var(--panel-w)), 100vh);
  height:min(calc(100vw - var(--panel-w)), 100vh);
  background:#000;
  overflow:hidden;
  border:1px solid var(--au-green2); /* was rgba(255,255,255,.06) */
  border-radius:12px;
}

/* Draggable/zoomable square (the thing that gets transformed) */
.viewport{
  position:relative; left:50%; top:50%;
  width:100%; height:100%;
  transform: translate(-50%,-50%) translate(var(--vx, 0px), var(--vy, 0px)) scale(var(--vs, 1));
  transform-origin:center center;
  overflow:hidden;
  touch-action:none;
  will-change: transform;
  filter: blur(var(--blur)) invert(var(--invert));

  /* AU border */
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

/* TAGS: overlay INSIDE the draggable square (append tagsEl to viewport in engine.js) */
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
.ui input[type="range"]{width:100%}
.ui input[type="number"]{width:100%}
.ui select{border:1px solid var(--ui-bd); background:transparent; color:#ddd; border-radius:10px; padding:7px 10px; font:12px system-ui}
.ui button{border:1px solid var(--ui-bd); background:transparent; color:#ddd; border-radius:12px; padding:9px 10px; font:12px system-ui}
.val{opacity:.85; font-variant-numeric: tabular-nums;}
.pill{display:inline-flex; padding:4px 8px; border:1px solid rgba(255,255,255,.10); border-radius:999px; opacity:.85;}

/* Fullscreen: UI + status hidden, stage fills screen, viewport becomes a square you can drag/pinch */
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


    `;
    document.head.appendChild(style);
  }
})();
