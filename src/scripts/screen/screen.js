const STATE_API = "https://thearchiveoftheuntamed.xyz/wp/wp-json/aotu/v1/state";
const WP_API = "https://thearchiveoftheuntamed.xyz/wp/wp-json/wp/v2";
const MEDIA_API = `${WP_API}/media`;
const TAGS_API = `${WP_API}/tags`;

const params = new URLSearchParams(window.location.search);
const SCREEN_ID = params.get("id") || "screen-1";

let lastUpdatedAt = 0;
let currentTag = "";
let currentMode = "sync";
let currentSpeed = 6000;
let currentMedia = [];
let currentIndex = 0;
let slideTimer = null;

const stage =
  document.querySelector("[data-screen-stage]") ||
  document.querySelector("#screen-stage") ||
  document.body;

function shouldApplyToThisScreen(state) {
  return !state.screen || state.screen === "all" || state.screen === SCREEN_ID;
}

async function pollState() {
  try {
    const res = await fetch(`${STATE_API}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;

    const state = await res.json();

    if (!state.updatedAt || state.updatedAt === lastUpdatedAt) return;
    if (!shouldApplyToThisScreen(state)) return;

    lastUpdatedAt = state.updatedAt;
    console.log("AOTU NEW STATE", state);

    applyState(state);
  } catch (err) {
    console.warn("AOTU polling offline/intermittent", err);
  }
}

async function applyState(state) {
  currentSpeed = Number(state.speed) || 6000;
  currentMode = state.mode || "sync";

  applyMode(currentMode);

  if (currentMode === "blackout") {
    return;
  }

  if (currentMode === "random") {
    currentTag = "";
    currentMedia = await fetchMediaByTag("");
    currentIndex = Math.floor(Math.random() * Math.max(currentMedia.length, 1));
    renderCurrentMedia();
    restartSlideshow();
    return;
  }

  if (state.tag !== currentTag) {
    currentTag = state.tag || "";
    currentMedia = await fetchMediaByTag(currentTag);
    currentIndex = 0;
    renderCurrentMedia();
  }

  restartSlideshow();
}

function applyMode(mode) {
  stage.classList.remove(
    "is-blackout",
    "fx-pulse",
    "fx-pixel",
    "fx-mosaic",
    "fx-invert",
    "fx-blur",
    "fx-acid"
  );

  if (mode === "blackout") stage.classList.add("is-blackout");
  if (mode === "pulse") stage.classList.add("fx-pulse");
  if (mode === "pixel") stage.classList.add("fx-pixel");
  if (mode === "mosaic") stage.classList.add("fx-mosaic");
  if (mode === "invert") stage.classList.add("fx-invert");
  if (mode === "blur") stage.classList.add("fx-blur");
  if (mode === "acid") stage.classList.add("fx-acid");
}

async function resolveTagId(tag) {
  if (!tag) return null;

  const cleanTag = tag.replace(/^#/, "").trim();

  const res = await fetch(
    `${TAGS_API}?slug=${encodeURIComponent(cleanTag)}&t=${Date.now()}`,
    { cache: "no-store" }
  );

  if (!res.ok) return null;

  const tags = await res.json();
  return tags?.[0]?.id || null;
}

async function fetchMediaByTag(tag) {
  let url = `${MEDIA_API}?per_page=50&_fields=id,source_url,media_type,mime_type,title,alt_text`;

  if (tag) {
    const tagId = await resolveTagId(tag);

    if (!tagId) {
      console.warn("AOTU tag not found", tag);
      return [];
    }

    url += `&tags=${tagId}`;
  }

  try {
    const res = await fetch(`${url}&t=${Date.now()}`, { cache: "no-store" });

    if (!res.ok) {
      console.error("AOTU media fetch error", res.status);
      return [];
    }

    const media = await res.json();

    return media.filter((item) => {
      const mime = item.mime_type || "";
      return mime.startsWith("image/") || mime.startsWith("video/");
    });
  } catch (err) {
    console.error("AOTU media fetch failed", err);
    return [];
  }
}

function renderCurrentMedia() {
  if (currentMode === "blackout") return;

  if (!currentMedia.length) {
    stage.innerHTML = `
      <div class="aotu-empty">
        <p>${SCREEN_ID}</p>
        <p>No media found</p>
        <p>${currentTag ? "#" + currentTag : "waiting for signal"}</p>
      </div>
    `;
    return;
  }

  const item = currentMedia[currentIndex];
  const url = item.source_url;
  const mime = item.mime_type || "";

  stage.innerHTML = "";

  let el;

  if (mime.startsWith("video/")) {
    el = document.createElement("video");
    el.src = url;
    el.autoplay = true;
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
  } else {
    el = document.createElement("img");
    el.src = url;
    el.alt = item.alt_text || item.title?.rendered || "";
  }

  el.className = "aotu-screen-media";
  stage.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add("is-visible");
  });
}

function nextMedia() {
  if (!currentMedia.length || currentMode === "blackout") return;

  if (currentMode === "random") {
    currentIndex = Math.floor(Math.random() * currentMedia.length);
  } else {
    currentIndex = (currentIndex + 1) % currentMedia.length;
  }

  renderCurrentMedia();
}

function restartSlideshow() {
  if (slideTimer) clearInterval(slideTimer);

  slideTimer = setInterval(() => {
    nextMedia();
  }, currentSpeed);
}

function injectBaseStyle() {
  const style = document.createElement("style");

  style.innerHTML = `
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
    }

    .aotu-screen-media {
      width: 100vw;
      height: 100vh;
      object-fit: cover;
      display: block;
      opacity: 0;
      transform: scale(1.04);
      transition: opacity 800ms ease, transform 1200ms ease, filter 500ms ease;
      background: #000;
    }

    .aotu-screen-media.is-visible {
      opacity: 1;
      transform: scale(1);
    }

    .is-blackout {
      background: #000 !important;
    }

    .is-blackout > * {
      opacity: 0 !important;
      pointer-events: none;
    }

    .fx-pulse .aotu-screen-media {
      animation: aotuPulse 900ms infinite alternate ease-in-out;
    }

    .fx-pixel .aotu-screen-media {
      image-rendering: pixelated;
      filter: contrast(1.45) saturate(1.7);
      transform: scale(1.1);
    }

    .fx-mosaic .aotu-screen-media {
      image-rendering: pixelated;
      filter: contrast(1.9) saturate(2.1);
      transform: scale(1.22);
    }

    .fx-invert .aotu-screen-media {
      filter: invert(1) contrast(1.35) saturate(1.4);
    }

    .fx-blur .aotu-screen-media {
      filter: blur(14px) contrast(1.4) saturate(1.5);
      transform: scale(1.14);
    }

    .fx-acid .aotu-screen-media {
      filter: hue-rotate(95deg) saturate(3.2) contrast(1.35);
    }

    .aotu-empty {
      width: 100vw;
      height: 100vh;
      display: grid;
      place-content: center;
      gap: 0.5rem;
      text-align: center;
      color: #d4ff52;
      background: #000;
      font-family: Arial, Helvetica, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .aotu-empty p {
      margin: 0;
    }

    @keyframes aotuPulse {
      from {
        filter: brightness(0.7) contrast(1.2) saturate(1.2);
        transform: scale(1.02);
      }

      to {
        filter: brightness(1.5) contrast(1.8) saturate(2);
        transform: scale(1.09);
      }
    }
  `;

  document.head.appendChild(style);
}

injectBaseStyle();
pollState();
setInterval(pollState, 1000);

console.log("AOTU screen ready", SCREEN_ID);