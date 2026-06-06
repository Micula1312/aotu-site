const WP_API =
  window.__WP_API_URL ||
  "https://thearchiveoftheuntamed.xyz/wp/wp-json";

const MEDIA_API = `${WP_API.replace(/\/$/, "")}/wp/v2/media`;
const TAGS_API = `${WP_API.replace(/\/$/, "")}/wp/v2/tags`;
const STATE_API = `${WP_API.replace(/\/$/, "")}/aotu/v1/state`;

const $ = (id) => document.getElementById(id);

function tickClock() {
  const now = new Date();

  $("monitorDate").textContent = now.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  $("monitorTime").textContent = now.toLocaleTimeString("it-IT");
}

function typeOf(item) {
  const mime = item.mime_type || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

function thumb(item) {
  return (
    item.media_details?.sizes?.thumbnail?.source_url ||
    item.media_details?.sizes?.medium?.source_url ||
    item.source_url
  );
}

async function loadMedia() {
  let page = 1;
  let totalPages = 1;
  let total = 0;
  const all = [];

  do {
    const url = `${MEDIA_API}?per_page=100&page=${page}&orderby=date&order=desc&_fields=id,date,title,mime_type,media_type,source_url,media_details,tags`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`Media API error ${res.status}`);
    }

    const items = await res.json();

    total = Number(res.headers.get("X-WP-Total") || items.length);
    totalPages = Number(res.headers.get("X-WP-TotalPages") || 1);

    all.push(...items);
    page++;
  } while (page <= totalPages);

  return {
    total,
    items: all,
  };
}

async function loadTags() {
  let page = 1;
  let totalPages = 1;
  const all = [];

  do {
    const res = await fetch(
      `${TAGS_API}?per_page=100&page=${page}&orderby=count&order=desc&_fields=id,name,slug,count&t=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!res.ok) break;

    const tags = await res.json();
    totalPages = Number(res.headers.get("X-WP-TotalPages") || 1);

    all.push(...tags);
    page++;
  } while (page <= totalPages);

  return all
    .filter((tag) => Number(tag.count || 0) > 0)
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0));
}

function renderStats(media) {
  const items = media.items;

  $("totalMedia").textContent = media.total;
  $("imageCount").textContent = items.filter((i) => typeOf(i) === "image").length;
  $("videoCount").textContent = items.filter((i) => typeOf(i) === "video").length;

  const audioEl = $("audioCount");
  if (audioEl) audioEl.textContent = items.filter((i) => typeOf(i) === "audio").length;

  const fileEl = $("fileCount");
  if (fileEl) fileEl.textContent = items.filter((i) => typeOf(i) === "file").length;
}

function renderLatest(items) {
  const latest = items.slice(0, 12);

  if (latest[0]) {
    const d = new Date(latest[0].date);
    $("lastUpload").textContent = d.toLocaleDateString("it-IT");
  }

  $("latestList").innerHTML = latest
    .map((item) => {
      const title = item.title?.rendered || "untitled";
      const date = new Date(item.date).toLocaleDateString("it-IT");
      const type = typeOf(item);

      return `
        <article class="latest-row">
          <span>${type}</span>
          <strong>${title}</strong>
          <time>${date}</time>
        </article>
      `;
    })
    .join("");
}

function renderTags(tags) {
  $("tagActivity").innerHTML = tags
    .filter((tag) => tag.count > 0)
    .slice(0, 28)
    .map(
      (tag) => `
        <span class="tag-chip">
          #${tag.name}
          <small>${tag.count}</small>
        </span>
      `
    )
    .join("");
}

function renderPreview(items) {
  const media = items.filter((item) => typeOf(item) === "image").slice(0, 24);

  $("previewStrip").innerHTML = media
    .map(
      (item) => `
        <figure>
          <img src="${thumb(item)}" alt="${item.title?.rendered || ""}" loading="lazy" />
        </figure>
      `
    )
    .join("");
}

async function initMonitor() {
  tickClock();
  setInterval(tickClock, 1000);
  await checkStateEndpoint();
  setInterval(checkStateEndpoint, 1000);

  try {
    $("apiStatus").textContent = "online";
    $("apiStatus").classList.add("online");

    const [media, tags] = await Promise.all([loadMedia(), loadTags()]);

    renderStats(media);
    renderLatest(media.items);
    renderTags(tags);
    renderPreview(media.items);
  } catch (err) {
    console.error(err);
    $("apiStatus").textContent = "offline";
    $("apiStatus").classList.add("offline");
  }
}

initMonitor();


async function checkStateEndpoint() {
  try {
    const res = await fetch(`${STATE_API}?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`State error ${res.status}`);

    const state = await res.json();

    $("stateStatus").textContent = "online";
    $("stateStatus").classList.add("online");

    $("currentMode").textContent = state.mode || "--";
    $("currentTag").textContent = state.tag ? `#${state.tag}` : "none";

    if (state.updatedAt) {
      $("lastSignal").textContent = new Date(state.updatedAt).toLocaleTimeString("it-IT");
    }
  } catch (err) {
    console.error(err);
    $("stateStatus").textContent = "offline";
    $("stateStatus").classList.add("offline");
  }
}