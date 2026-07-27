const WP_API =
  window.__AOTU_WP_API_URL ||
  "https://thearchiveoftheuntamed.xyz/wp/wp-json";

const MEDIA_API = `${WP_API.replace(/\/$/, "")}/wp/v2/media`;

const root = document.getElementById("squareVisual") || document.body;

const PER_PAGE = 100;
const DWELL = 2200;
const CELL = 18;
const DENSITY = 0.42;

let mediaList = [];
let currentIndex = 0;

function injectStyle() {
  const style = document.createElement("style");

  style.innerHTML = `
    html,
    body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
      font-family: Arial, Helvetica, sans-serif;
    }

    #squareVisual {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      background: #000;
    }

    .sv-frame {
      position: relative;
      width: min(100vw, 100vh);
      height: min(100vw, 100vh);
      overflow: hidden;
      background: #000;
      opacity: 0;
      transform: scale(1.02);
      transition: opacity 800ms ease, transform 1200ms ease;
    }

    .sv-frame.is-visible {
      opacity: 1;
      transform: scale(1);
    }

    .sv-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;

      filter:
        hue-rotate(95deg)
        saturate(3.2)
        contrast(1.42)
        brightness(1.04);
    }

    .sv-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      mix-blend-mode: screen;
      opacity: 0.85;
      image-rendering: pixelated;
      filter:
        hue-rotate(95deg)
        saturate(3.4)
        contrast(1.8);
    }

    .sv-tags {
      position: absolute;
      left: 16px;
      bottom: 14px;
      right: 16px;
      z-index: 4;

      color: #d4ff52;
      font-size: clamp(16px, 2.4vw, 36px);
      font-weight: 900;
      line-height: 1.05;
      letter-spacing: -0.04em;
      text-transform: lowercase;

      text-shadow: 0 0 18px rgba(0,0,0,.85);
      pointer-events: none;
    }

    .sv-status {
      color: rgb(0,255,0);
      font-size: clamp(18px, 4vw, 56px);
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
  `;

  document.head.appendChild(style);
}

async function fetchMedia() {
  const url =
    `${MEDIA_API}?per_page=${PER_PAGE}` +
    `&orderby=date&order=desc` +
    `&_embed=1` +
    `&_fields=id,date,title,mime_type,source_url,media_details,_embedded`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`media fetch ${res.status}`);

  const data = await res.json();

  return data
    .filter((item) => (item.mime_type || "").startsWith("image/"))
    .map((item) => ({
      src: pickImage(item),
      tags: extractTags(item),
      title: item.title?.rendered || "",
    }))
    .filter((item) => item.src);
}

function pickImage(item) {
  return (
    item.media_details?.sizes?.large?.source_url ||
    item.media_details?.sizes?.medium_large?.source_url ||
    item.media_details?.sizes?.medium?.source_url ||
    item.source_url
  );
}

function extractTags(item) {
  const terms = item._embedded?.["wp:term"] || [];

  const tags = terms
    .flat()
    .filter((term) => term.taxonomy === "post_tag")
    .map((term) => `#${term.name}`);

  return tags.length ? tags.slice(0, 8) : ["#archive", "#untamed"];
}

function showStatus(text) {
  root.innerHTML = `<div class="sv-status">${text}</div>`;
}

function showVisual(item) {
  root.innerHTML = `
    <div class="sv-frame">
      <img class="sv-img" crossorigin="anonymous" src="${toRelative(item.src)}" alt="" />
      <canvas class="sv-canvas"></canvas>
      <div class="sv-tags">${item.tags.join(" ")}</div>
    </div>
  `;

  const frame = root.querySelector(".sv-frame");
  const img = root.querySelector(".sv-img");
  const canvas = root.querySelector(".sv-canvas");

  img.addEventListener("load", () => {
    drawPixelOverlay(img, canvas);
    requestAnimationFrame(() => frame.classList.add("is-visible"));
  });
}

function toRelative(src = "") {
  try {
    return new URL(src).pathname;
  } catch {
    return src;
  }
}

function drawPixelOverlay(img, canvas) {
  const size = Math.floor(Math.min(window.innerWidth, window.innerHeight));

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;

  const octx = off.getContext("2d");

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  const scale = Math.max(size / iw, size / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;

  octx.drawImage(img, dx, dy, dw, dh);

  const data = octx.getImageData(0, 0, size, size).data;

  for (let y = 0; y < size; y += CELL) {
    for (let x = 0; x < size; x += CELL) {
      if (Math.random() > DENSITY) continue;

      const cx = Math.min(size - 1, x + CELL / 2);
      const cy = Math.min(size - 1, y + CELL / 2);
      const i = (Math.floor(cy) * size + Math.floor(cx)) * 4;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.78)`;
      ctx.fillRect(x, y, CELL, CELL);
    }
  }
}

function next() {
  if (!mediaList.length) return;

  currentIndex = Math.floor(Math.random() * mediaList.length);
  showVisual(mediaList[currentIndex]);
}

async function init() {
  injectStyle();
  showStatus("loading archive");

  try {
    mediaList = await fetchMedia();

    if (!mediaList.length) {
      showStatus("no media");
      return;
    }

    next();
    setInterval(next, DWELL);
  } catch (err) {
    console.error(err);
    showStatus("archive error");
  }
}

init();