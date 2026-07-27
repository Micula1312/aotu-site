// src/scripts/pdf-controller.js
console.log("PDF CONTROLLER JS LOADED");

const STATE_API =
  "https://thearchiveoftheuntamed.xyz/wp/wp-json/aotu/v1/pdf-state";

let lastPayload = {};

async function sendState(payload) {
  lastPayload = {
    ...lastPayload,
    ...payload,
    updatedAt: Date.now(),
    source: "pdf-controller",
  };

  try {
    await fetch(STATE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lastPayload),
    });

    console.log("PDF STATE SENT", lastPayload);
  } catch (err) {
    console.warn("PDF CONTROLLER OFFLINE", err);
  }
}

/* ---------------- BUTTONS ---------------- */

document.querySelectorAll("[data-action]").forEach((btn) => {
  btn.addEventListener("click", () => {
    sendState({
      pdfAction: btn.dataset.action,
    });
  });
});

document.querySelectorAll("[data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    sendState({
      mode: btn.dataset.mode,
    });
  });
});

document.querySelectorAll("[data-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    sendState({
      filter: btn.dataset.filter,
      color: btn.dataset.color || "0,255,0",
    });
  });
});

document.getElementById("attackBtn")?.addEventListener("click", () => {
  sendState({
    attack: Date.now(),
  });
});

document.getElementById("resetBtn")?.addEventListener("click", () => {
  sendState({
    reset: Date.now(),
    mode: "laugh",
    filter: "raw",
    color: "0,255,0",
  });
});

/* ---------------- TOUCH PAD ---------------- */

const pad = document.getElementById("touchPad");

function sendPadPosition(e) {
  if (!pad) return;

  const rect = pad.getBoundingClientRect();
  const touch = e.touches?.[0] || e;

  const x = (touch.clientX - rect.left) / rect.width;
  const y = (touch.clientY - rect.top) / rect.height;

  sendState({
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    gesture: Date.now(),
  });
}

pad?.addEventListener("pointerdown", sendPadPosition);
pad?.addEventListener("pointermove", (e) => {
  if (e.buttons === 1) sendPadPosition(e);
});