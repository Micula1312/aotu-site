// mosaic/ui.js
export function mountMosaicUI({ mountEl, params, engine }) {
  const $ = (s, r = document) => r.querySelector(s);

  const ui = document.createElement("div");
  ui.className = "ui";
  ui.innerHTML = `
    <h3>AOTU • Mosaic</h3>

    <label>Pixel (cell)
      <input id="uCell" type="range" min="0" max="40" step="1">
      <div class="row"><span class="val" id="vCell"></span><span class="pill">0 = nitido</span></div>
    </label>

    <label>Dwell (ms)
      <input id="uDwell" type="number" min="300" max="8000" step="100">
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

    <label>Rallenta (cooldown)
      <input id="uCool" type="range" min="120" max="2500" step="20">
      <div class="row"><span class="val" id="vCool"></span><span class="val">ms</span></div>
    </label>

    <label class="row" style="gap:10px; align-items:center;">
      <span style="font:12px system-ui; opacity:.85;">Micro Blur</span>
      <input id="uMicro" type="checkbox">
    </label>

    <button id="uFit" type="button"></button>

    <div class="row" style="gap:10px;">
      <button id="uRun" type="button" class="btn">Pausa</button>
      <button id="uReload" type="button" class="btn">Reload</button>
    </div>

    <button id="uFS" type="button" class="btn attack">ATTACK</button>
  `;
  mountEl.appendChild(ui);

  const uCell = $("#uCell", ui), vCell = $("#vCell", ui);
  const uDwell = $("#uDwell", ui);
  const uBlur = $("#uBlur", ui), vBlur = $("#vBlur", ui);
  const uInv = $("#uInv", ui), vInv = $("#vInv", ui);
  const uOrder = $("#uOrder", ui);
  const uCool = $("#uCool", ui), vCool = $("#vCool", ui);
  const uMicro = $("#uMicro", ui);

  const uFit = $("#uFit", ui);
  const uRun = $("#uRun", ui);
  const uReload = $("#uReload", ui);
  const uFS = $("#uFS", ui);

  // init values
  uCell.value = String(params.cell);
  vCell.textContent = `${params.cell}px`;

  uDwell.value = String(params.dwell);

  uBlur.value = String(params.blur || 0);
  vBlur.textContent = `${params.blur || 0}`;

  uInv.value = String(params.invert || 0);
  vInv.textContent = (params.invert || 0).toFixed(2);

  uOrder.value = params.order;

  params.cooldown ??= 420;
  uCool.value = String(params.cooldown);
  vCool.textContent = String(params.cooldown);

  params.microBlur ??= false;
  uMicro.checked = !!params.microBlur;

  uFit.textContent = `Fit: ${params.fit}`;

  uCell.addEventListener("input", () => {
    params.cell = parseInt(uCell.value, 10) || 0;
    vCell.textContent = `${params.cell}px`;
    engine.setParam("cell", params.cell);
  });

  uDwell.addEventListener("input", () => {
    params.dwell = Math.max(300, Math.min(8000, parseInt(uDwell.value, 10) || 1200));
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

  uMicro.addEventListener("change", () => {
    params.microBlur = !!uMicro.checked;
    engine.setParam("microBlur", params.microBlur);
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
    // ATTACK resta ATTACK, ma se vuoi feedback:
    uFS.setAttribute("data-fs", document.fullscreenElement ? "1" : "0");
  }
  document.addEventListener("fullscreenchange", updateFSButton);
  document.addEventListener("webkitfullscreenchange", updateFSButton);
  updateFSButton();

  return { ui };
}
