const STATE_API =
  window.__AOTU_STATE_API_URL ||
  "https://thearchiveoftheuntamed.xyz/wp/wp-json/aotu/v1/state";

const TAGS_API =
  window.__AOTU_TAGS_API_URL ||
  "https://thearchiveoftheuntamed.xyz/wp/wp-json/wp/v2/tags?per_page=100";

const state = {
  tag: "",
  mode: "acid",
  speed: 6000,
  screen: "all",
};

function $(sel) {
  return document.querySelector(sel);
}

const logBox = $("#logBox");
const connectionState = $("#connectionState");

function log(msg) {
  console.log(msg);
  if (logBox) {
    logBox.textContent =
      `[${new Date().toLocaleTimeString()}] ${msg}\n` + logBox.textContent;
  }
}

async function sendState(next = {}) {
  const payload = { ...state, ...next };
  Object.assign(state, payload);

  try {
    const res = await fetch(STATE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      log(`STATE ERROR ${res.status}`);
      return;
    }

    const data = await res.json();

    if (connectionState) {
      connectionState.textContent = "online";
      connectionState.classList.add("is-online");
    }

    log(`STATE SENT mode:${data.mode} tag:#${data.tag || "none"} → ${data.screen}`);
  } catch (err) {
    console.error(err);

    if (connectionState) {
      connectionState.textContent = "offline";
      connectionState.classList.remove("is-online");
    }

    log("STATE SEND FAILED");
  }
}

async function loadTags() {
  const wrap = $("#tagCloud");

  if (!wrap) return;

  wrap.innerHTML = `<span class="muted">loading tags…</span>`;

  try {
    let page = 1;
    let totalPages = 1;
    let allTags = [];

    do {
      const res = await fetch(
        `${TAGS_API}&page=${page}&orderby=count&order=desc&_fields=id,name,slug,count&t=${Date.now()}`,
        { cache: "no-store" }
      );

      if (!res.ok) throw new Error(`Tags error ${res.status}`);

      const tags = await res.json();

      totalPages = Number(res.headers.get("X-WP-TotalPages") || 1);
      allTags.push(...tags);

      page++;
    } while (page <= totalPages);

    // allTags = allTags.filter((tag) => Number(tag.count || 0) > 0);

    wrap.innerHTML = "";

    allTags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag";
      btn.dataset.tag = tag.slug;
      btn.textContent = `#${tag.name}`;

      btn.addEventListener("click", () => {
        document
          .querySelectorAll("#tagCloud .is-active")
          .forEach((b) => b.classList.remove("is-active"));

        btn.classList.add("is-active");

        sendState({
          tag: tag.slug,
          mode: "acid",
          screen: state.screen,
        });
      });

      wrap.appendChild(btn);
    });

    log(`TAGS LOADED ${allTags.length}`);
  } catch (err) {
    console.error(err);
    wrap.innerHTML = `<span class="muted">tags error</span>`;
    log("TAGS ERROR");
  }
}

function bindTargets() {
  document.querySelectorAll("[data-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-target]")
        .forEach((b) => b.classList.remove("is-active"));

      btn.classList.add("is-active");
      state.screen = btn.dataset.target || "all";
      log(`TARGET ${state.screen}`);
    });
  });
}

function sendMode(mode) {
  sendState({
    mode,
    screen: state.screen,
  });
}

function bindActions() {
  $("#cmdRandom")?.addEventListener("click", () => {
    sendState({
      tag: "",
      mode: "random",
      screen: state.screen,
    });
  });

  // $("#cmdPulse")?.addEventListener("click", () => sendMode("pulse"));
  $("#cmdBlackout")?.addEventListener("click", () => sendMode("blackout"));

  $("#cmdWake")?.addEventListener("click", () => {
    sendState({
      mode: "acid",
      screen: state.screen,
    });
  });

  $("#cmdStop")?.addEventListener("click", () => {
  sendState({
    mode: "stop",
    tag: state.tag || "",
    screen: state.screen || "all",
  });
});

$("#cmdPlay")?.addEventListener("click", () => {
  sendState({
    mode: "sync",
    tag: state.tag || "",
    screen: state.screen || "all",
  });
});

  // $("#cmdPixel")?.addEventListener("click", () => sendMode("pixel"));
  // $("#cmdMosaic")?.addEventListener("click", () => sendMode("mosaic"));
  // $("#cmdInvert")?.addEventListener("click", () => sendMode("invert"));
  // $("#cmdBlur")?.addEventListener("click", () => sendMode("blur"));
  // $("#cmdAcid")?.addEventListener("click", () => sendMode("acid"));

  $("#cmdReset")?.addEventListener("click", () => {
    document
      .querySelectorAll(".is-active")
      .forEach((b) => b.classList.remove("is-active"));

    const allBtn = document.querySelector('[data-target="all"]');
    allBtn?.classList.add("is-active");

    Object.assign(state, {
      tag: "",
      mode: "acid",
      speed: 6000,
      screen: "all",
    });

    sendState({
      tag: "",
      mode: "acid",
      speed: 6000,
      screen: "all",
    });
  });

  $("#reloadTags")?.addEventListener("click", loadTags);

  $("#tagSearch")?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();

    document.querySelectorAll("#tagCloud .tag").forEach((btn) => {
      btn.style.display = btn.textContent.toLowerCase().includes(q)
        ? ""
        : "none";
    });
  });

  $("#cmdStrike")?.addEventListener("click", () => {
    sendState({
      tag: "sciopero",
      mode: "sciopero",
      screen: "all",
    });
  });
}

function initController() {
  bindTargets();
  bindActions();
  loadTags();

  // appena apri il controller, sveglia gli screen se erano rimasti in blackout
  sendState({
    mode: "acid",
    screen: "all",
  });

  log("AOTU controller ready");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initController);
} else {
  initController();
}