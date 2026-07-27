// src/scripts/pdf-live.js

import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STATE_API =
  "https://thearchiveoftheuntamed.xyz/wp/wp-json/aotu/v1/pdf-state";

const PDF_QUEUE = [
  "https://thearchiveoftheuntamed.xyz/wp/wp-content/uploads/2026/06/roma-junio-2026-compressed.pdf",
  "https://thearchiveoftheuntamed.xyz/wp/wp-content/uploads/2026/06/AU-compressed.pdf",
];

let currentPdfIndex = 0;

const pdfCanvas = document.getElementById("pdfCanvas");
const fxCanvas = document.getElementById("fxCanvas");
const pageLabel = document.getElementById("pageLabel");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const nextPdfBtn = document.getElementById("nextPdfBtn");

const acidBtn = document.getElementById("acidBtn");
const starsBtn = document.getElementById("starsBtn");
const warpBtn = document.getElementById("warpBtn");
const attackBtn = document.getElementById("attackBtn");
const resetBtn = document.getElementById("resetBtn");

const pctx = pdfCanvas.getContext("2d", { willReadFrequently: true });
const fctx = fxCanvas.getContext("2d");

let pdf = null;
let pageNum = 1;
let rendering = false;
let mode = "laugh";
let particles = [];
let overlayColor = "0,255,0";
let currentFilter = "green";

const mouse = {
  x: 0,
  y: 0,
  down: false,
};

const FILTERS = {
  raw: "none",
  green: "hue-rotate(95deg) saturate(3.2) contrast(1.35)",
  lime: "hue-rotate(65deg) saturate(2.8) contrast(1.45) brightness(1.08)",
  orange: "hue-rotate(-25deg) saturate(3) contrast(1.4)",
  white: "grayscale(1) contrast(1.55) brightness(1.12)",
  violet: "hue-rotate(250deg) saturate(2.8) contrast(1.35)",
};

function getCurrentPdfUrl() {
  return PDF_QUEUE[currentPdfIndex];
}

function getPdfUrlForEnvironment() {
  if (location.hostname === "localhost") {
    return `/api/pdf-proxy?url=${encodeURIComponent(getCurrentPdfUrl())}`;
  }

  return getCurrentPdfUrl();
}

function applyPdfFilter(name = currentFilter) {
  currentFilter = name;
  pdfCanvas.style.filter = FILTERS[currentFilter] || FILTERS.green;
}

/* ---------------- PDF ---------------- */

async function loadPDF({ keepPage = false } = {}) {
  try {
    particles = [];
    rendering = false;

    const pdfUrl = getPdfUrlForEnvironment();

    console.log("START LOAD PDF", pdfUrl);

    const task = pdfjsLib.getDocument({
      url: pdfUrl,
      withCredentials: false,
    });

    pdf = await task.promise;

    console.log("PDF LOADED OK", pdf.numPages);

    if (!keepPage) pageNum = 1;
    if (pageNum > pdf.numPages) pageNum = pdf.numPages;

    await renderPage(pageNum);
  } catch (err) {
    console.error("PDF LOAD FAILED", err);
  }
}

async function renderPage(num) {
  if (!pdf || rendering) return;

  rendering = true;

  try {
    const page = await pdf.getPage(num);
    const viewport = page.getViewport({ scale: 1 });

    const scale = Math.min(
      window.innerWidth / viewport.width,
      window.innerHeight / viewport.height
    );

    const scaled = page.getViewport({ scale });

    pdfCanvas.width = fxCanvas.width = scaled.width;
    pdfCanvas.height = fxCanvas.height = scaled.height;

    await page.render({
      canvasContext: pctx,
      viewport: scaled,
    }).promise;

    applyPdfFilter(currentFilter);

    if (pageLabel) {
      pageLabel.textContent = `${pageNum} / ${pdf.numPages}`;
    }
  } catch (err) {
    console.error("RENDER ERROR:", err);
  } finally {
    rendering = false;
  }
}

async function nextPdf() {
  currentPdfIndex = (currentPdfIndex + 1) % PDF_QUEUE.length;
  await loadPDF();
}

async function prevPdf({ goToLastPage = false } = {}) {
  currentPdfIndex--;

  if (currentPdfIndex < 0) {
    currentPdfIndex = PDF_QUEUE.length - 1;
  }

  await loadPDF();

  if (goToLastPage && pdf) {
    pageNum = pdf.numPages;
    await renderPage(pageNum);
  }
}



/* ---------------- PIXEL ---------------- */

function getBrightness(x, y) {
  try {
    const d = pctx.getImageData(x, y, 1, 1).data;
    return (d[0] + d[1] + d[2]) / 3;
  } catch {
    return 255;
  }
}

/* ---------------- PARTICLES ---------------- */

function spawn(x, y) {
  const brightness = getBrightness(x, y);
  const amount = brightness < 120 ? 8 : 3;

  for (let i = 0; i < amount; i++) {
    particles.push({
      kind: mode === "laugh" ? "laugh" : mode,
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      size: 12 + Math.random() * 18,
      life: 1,
      rot: Math.random() * Math.PI,
    });
  }
}

function drawStar(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();

  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i;
    const rr = i % 2 === 0 ? r : r * 0.42;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
  ctx.strokeStyle = `rgb(${overlayColor})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawLaugh(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.sin(p.rot) * 0.25);
  ctx.font = `${p.size}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("😂", 0, 0);
  ctx.restore();
}

/* ---------------- LOOP ---------------- */

function animate() {
  requestAnimationFrame(animate);

  fctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

  if (mouse.down) {
    spawn(mouse.x, mouse.y);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.015;
    p.rot += 0.06;
    p.life -= 0.014;

    fctx.globalAlpha = Math.max(p.life, 0);

    if (p.kind === "star") {
      fctx.globalCompositeOperation = "source-over";
      drawStar(fctx, p.x, p.y, p.size, p.rot);
    }

    if (p.kind === "laugh") {
      fctx.globalCompositeOperation = "source-over";
      drawLaugh(fctx, p);
    }

    if (p.kind === "acid") {
      const pulse = 1 + Math.sin(Date.now() * 0.012 + p.rot) * 0.5;

      fctx.globalCompositeOperation = "difference";
      fctx.beginPath();
      fctx.arc(p.x, p.y, p.size * 2.2 * pulse, 0, Math.PI * 2);
      fctx.strokeStyle = `rgb(${overlayColor})`;
      fctx.lineWidth = 2;
      fctx.stroke();

      fctx.globalCompositeOperation = "lighter";
      fctx.beginPath();
      fctx.arc(
        p.x + Math.sin(p.rot) * 8,
        p.y + Math.cos(p.rot) * 8,
        p.size * 0.9,
        0,
        Math.PI * 2
      );
      fctx.fillStyle = `rgba(${overlayColor},0.55)`;
      fctx.fill();
    }

    if (p.kind === "warp") {
      fctx.globalCompositeOperation = "source-over";

      const s = 30 + p.size * 2;

      fctx.drawImage(
        pdfCanvas,
        p.x - s / 2,
        p.y - s / 2,
        s,
        s,
        p.x - s / 2 + Math.sin(Date.now() * 0.01 + p.rot) * 12,
        p.y - s / 2 + Math.cos(Date.now() * 0.01 + p.rot) * 12,
        s,
        s
      );
    }

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  fctx.globalAlpha = 1;
  fctx.globalCompositeOperation = "source-over";
}

/* ---------------- POINTER ---------------- */

function updatePointer(e) {
  const rect = fxCanvas.getBoundingClientRect();
  const scaleX = fxCanvas.width / rect.width;
  const scaleY = fxCanvas.height / rect.height;

  mouse.x = (e.clientX - rect.left) * scaleX;
  mouse.y = (e.clientY - rect.top) * scaleY;
}

fxCanvas.addEventListener("pointermove", (e) => {
  updatePointer(e);

  if (mouse.down) {
    spawn(mouse.x, mouse.y);
  }
});

fxCanvas.addEventListener("pointerdown", (e) => {
  mouse.down = true;
  updatePointer(e);
  spawn(mouse.x, mouse.y);
});

window.addEventListener("pointerup", () => {
  mouse.down = false;
});


let lastRemoteUpdate = 0;

async function pollPdfState() {
  try {
    const res = await fetch(`${STATE_API}?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!res.ok) return;

    const state = await res.json();

    if (!state.updatedAt) return;
    if (state.updatedAt === lastRemoteUpdate) return;

    lastRemoteUpdate = state.updatedAt;
    if (state.source !== "pdf-controller") return;

    console.log("REMOTE PDF STATE", state);
    console.log("PDF READY?", !!pdf, "ACTION:", state.pdfAction);

    if (!pdf) return;

    if (state.pdfAction === "next") {
      console.log("REMOTE NEXT PAGE");

      pageNum++;

      if (pageNum > pdf.numPages) {
        await nextPdf();
        return;
      }

      await renderPage(pageNum);
    }

    if (state.pdfAction === "prev") {
      console.log("REMOTE PREV PAGE");

      pageNum--;

      if (pageNum < 1) {
        await prevPdf({ goToLastPage: true });
        return;
      }

      await renderPage(pageNum);
    }

    if (state.pdfAction === "nextPdf") {
      console.log("REMOTE NEXT PDF");
      await nextPdf();
    }

    if (state.mode) {
      console.log("REMOTE MODE", state.mode);
      mode = state.mode;
    }

    if (state.filter) {
      console.log("REMOTE FILTER", state.filter);
      overlayColor = state.color || overlayColor;
      applyPdfFilter(state.filter);
    }

    if (state.attack) {
      console.log("REMOTE ATTACK");
      attackBtn?.click();
    }

    if (state.reset) {
      console.log("REMOTE RESET");
      particles = [];
      mode = "laugh";
      overlayColor = "0,255,0";
      applyPdfFilter("raw");
    }

    if (
      typeof state.x === "number" &&
      typeof state.y === "number"
    ) {
      console.log("REMOTE TOUCH", state.x, state.y);

      spawn(
        state.x * fxCanvas.width,
        state.y * fxCanvas.height
      );
    }
  } catch (err) {
    console.warn("PDF remote state offline", err);
  }
}


const channel = new BroadcastChannel("aotu-pdf-live");

channel.onmessage = async (event) => {
  const state = event.data;

  if (state.action === "next") nextBtn?.click();
  if (state.action === "prev") prevBtn?.click();
  if (state.action === "nextPdf") await nextPdf();

  if (state.mode) mode = state.mode;
  if (state.filter) applyPdfFilter(state.filter);
  if (state.attack) attackBtn?.click();

  if (typeof state.x === "number" && typeof state.y === "number") {
    spawn(state.x * fxCanvas.width, state.y * fxCanvas.height);
  }
};

/* ---------------- UI ---------------- */

nextBtn?.addEventListener("click", async () => {
  console.log("NEXT CLICK", pageNum, pdf?.numPages, currentPdfIndex);

  if (!pdf) return;

  if (pageNum >= pdf.numPages) {
    console.log("GO NEXT PDF");
    await nextPdf();
    return;
  }

  pageNum++;
  await renderPage(pageNum);
});

prevBtn?.addEventListener("click", async () => {
  if (!pdf) return;

  if (pageNum <= 1) {
    await prevPdf({ goToLastPage: true });
    return;
  }

  pageNum--;
  await renderPage(pageNum);
});

nextPdfBtn?.addEventListener("click", async () => {
  console.log("loading");
  await nextPdf();
});

starsBtn?.addEventListener("click", () => {
  mode = "laugh";
});

acidBtn?.addEventListener("click", () => {
  mode = "acid";
});

warpBtn?.addEventListener("click", () => {
  mode = "warp";
});

attackBtn?.addEventListener("click", () => {
  for (let i = 0; i < 500; i++) {
    particles.push({
      kind: "star",
      x: Math.random() * fxCanvas.width,
      y: Math.random() * fxCanvas.height,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      size: 4 + Math.random() * 22,
      life: 0.7 + Math.random() * 0.6,
      rot: Math.random() * Math.PI,
    });
  }
});

resetBtn?.addEventListener("click", () => {
  particles = [];
  mode = "laugh";
  overlayColor = "0,255,0";

  currentFilter = "raw";
  pdfCanvas.style.filter = "none";

  document.querySelectorAll(".color-dot").forEach((d) => {
    d.classList.remove("is-active");
  });

  document
    .querySelector('.color-dot[data-filter="raw"]')
    ?.classList.add("is-active");
});

document.querySelectorAll(".color-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    const filterName = dot.dataset.filter || "green";

    overlayColor = dot.dataset.color || "0,255,0";
    applyPdfFilter(filterName);

    document.querySelectorAll(".color-dot").forEach((d) => {
      d.classList.remove("is-active");
    });

    dot.classList.add("is-active");
  });
});

window.addEventListener("resize", () => {
  renderPage(pageNum);
});

/* ---------------- START ---------------- */

applyPdfFilter(currentFilter);

loadPDF().then(() => {
  animate();
  setInterval(pollPdfState, 400);
});