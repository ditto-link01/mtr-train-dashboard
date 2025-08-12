// Extracted texts for easier localization
const texts = {
  loading: "Loading…",
  errorPrefix: "Error:",
  headsUp: "Heads up: wait time is <strong>≥ 11 minutes</strong>. You may want to leave a bit earlier.",
  toSunnyBay: "To Sunny Bay",
  autoRefresh: "Auto‑refresh (17:30–19:00)",
  reloadNow: "Reload now",
  refreshing: "Refreshing…",
  fixedTo: "Fixed to",
  autoRefreshExplain: "Auto refresh ~25s within window.",
  dataCopyright: "Data © MTR Corporation via DATA.GOV.HK.",
  apiSpec: "API Spec",
  dataDict: "Data Dictionary",
  jsRequired: "This app requires JavaScript to display live train information."
};

const API_URL = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=DRL&sta=DIS&lang=EN";
const COMMUTE_START = 17 * 60 + 30; // 17:30 in minutes
const COMMUTE_END = 19 * 60; // 19:00 in minutes
const REFRESH_INTERVAL = 25_000; // 25 seconds
const MAX_RETRIES = 3;

let auto = true;
let timer = null;
let loadErrorCount = 0;

function nowInMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function isCommuteWindow() {
  const now = nowInMinutes();
  return now >= COMMUTE_START && now <= COMMUTE_END;
}

function parseHKTime(s) {
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d) ? new Date() : d; // fallback to current time if invalid
}

function setStatus(type, msg) {
  const status = document.getElementById("status");
  status.className = `status status--${type}`;
  status.innerHTML = msg;
}

function setStatusDot(type) {
  const dot = document.getElementById("statusDot");
  dot.className = `status-dot status-dot--${type}`;
}

function renderTrains(trains) {
  const up = document.getElementById("up");
  up.innerHTML = "";
  for (const t of trains.slice(0, 4)) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${t.time}</strong> (${t.dest}) ${t.platform ? `— Platform ${t.platform}` : ""}`;
    up.appendChild(li);
  }
}

async function fetchSchedule() {
  const r = await fetch(API_URL);
  if (!r.ok) throw new Error(`${texts.errorPrefix} ${r.status}`);
  const json = await r.json();
  if (!json.data?.DRL?.DIS?.UP) throw new Error(`${texts.errorPrefix} Malformed data`);
  return json.data.DRL.DIS.UP;
}

async function loadOnce() {
  setStatusDot("ok");
  setStatus("ok", texts.loading);
  document.getElementById("reload").disabled = true;
  document.getElementById("reload").textContent = texts.refreshing;
  try {
    const trains = await fetchSchedule();
    loadErrorCount = 0;
    // Process and display train info
    const processedTrains = trains.map(t => ({
      time: t.time ? parseHKTime(t.time).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) : "-",
      dest: t.dest_en || "-",
      platform: t.plat || ""
    }));
    renderTrains(processedTrains);

    // Show warning if interval >= 11 min
    const intervalWarn = document.getElementById("intervalWarn");
    if (processedTrains.length >= 2) {
      const t0 = parseHKTime(trains[0].time);
      const t1 = parseHKTime(trains[1].time);
      const diff = Math.round((t1 - t0) / 60000);
      intervalWarn.hidden = !(diff >= 11);
    } else {
      intervalWarn.hidden = true;
    }

    setStatus("ok", "");
    setStatusDot("ok");
  } catch (e) {
    setStatus("alert", `${texts.errorPrefix} ${e.message}`);
    setStatusDot("alert");
    loadErrorCount++;
    if (loadErrorCount < MAX_RETRIES) {
      setTimeout(loadOnce, 10000); // Retry after 10s
    }
    console.error(e);
  } finally {
    document.getElementById("reload").disabled = false;
    document.getElementById("reload").textContent = texts.reloadNow;
  }
}

function setupAutoReload() {
  if (timer) clearInterval(timer);
  if (auto && isCommuteWindow()) {
    timer = setInterval(loadOnce, REFRESH_INTERVAL);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  // Set up texts for localization
  document.querySelector("label.switch").lastChild.textContent = ` ${texts.autoRefresh}`;
  document.getElementById("reload").textContent = texts.reloadNow;
  document.getElementById("intervalWarn").innerHTML = texts.headsUp;

  loadOnce();
  setupAutoReload();

  document.getElementById("auto").addEventListener("change", e => {
    auto = e.target.checked;
    setupAutoReload();
    if (auto) loadOnce();
  });

  document.getElementById("reload").addEventListener("click", () => {
    loadOnce();
  });

  // Optional: update auto-reload if time window changes (e.g., at 17:30 or 19:00)
  setInterval(setupAutoReload, 60_000);
});
