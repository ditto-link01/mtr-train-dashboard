// --- Fixed configuration for Marco (DRL → DIS in EN) ---
const LINE = "DRL";      // Disneyland Resort Line
const STA  = "DIS";      // Disneyland Resort Station
const LANG = "EN";       // English
const API  = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php";

// Commute window (local time)
const COMMUTE_START = { h: 17, m: 30 };
const COMMUTE_END   = { h: 18, m: 30 };

// DLR names (UP/DOWN meaning per Data Dictionary: UP→SUN, DOWN→DIS)
const NAME = { DIS: "Disneyland Resort", SUN: "Sunny Bay" };

// Elements
const els = {
  status: document.getElementById("status"),
  statusDot: document.getElementById("statusDot"),
  intervalWarn: document.getElementById("intervalWarn"),
  up: document.getElementById("up"),
  auto: document.getElementById("auto"),
  reload: document.getElementById("reload"),
  spinner: document.getElementById("spinner"),
  themeToggle: document.getElementById("themeToggle"),
};

let timer = null;

// --- helpers ---
function withinCommuteWindow(d = new Date()) {
  const mins = d.getHours() * 60 + d.getMinutes();
  const start = COMMUTE_START.h * 60 + COMMUTE_START.m;
  const end   = COMMUTE_END.h * 60 + COMMUTE_END.m;
  return mins >= start && mins <= end;
}

function parseHKTime(s) {
  // API returns "YYYY-MM-DD HH:mm:ss" (HK local). Construct a local Date.
  return new Date(s.replace(" ", "T"));
}

function minutesDiff(a, b) { // b - a in minutes (non-negative)
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

function codeToName(code) { return NAME[code] || code; }

function setStatus(kind, text) {
  // kind: 'ok' | 'delay' | 'alert'
  els.status.className = `status status--${kind}`;
  els.status.innerHTML = text;

  // header dot
  els.statusDot.classList.remove("dot-delay", "dot-alert");
  if (kind === "delay") els.statusDot.classList.add("dot-delay");
  if (kind === "alert") els.statusDot.classList.add("dot-alert");
}

function setLoading(on) {
  document.body.classList.toggle("loading", on);
}

function renderUP(trains, now) {
  els.up.innerHTML = "";
  if (!trains || trains.length === 0) {
    const li = document.createElement("li");
    li.className = "meta";
    li.textContent = "— No trains listed —";
    els.up.appendChild(li);
    return;
  }

  trains.slice(0, 4).forEach(t => {
    const etaMin = minutesDiff(now, parseHKTime(t.time));
    const dest = codeToName(t.dest);
    const li = document.createElement("li");
    // No platform numbers (removed per request)
    li.innerHTML = `
      <div><strong>${dest}</strong></div>
      <div class="meta">ETA ${new Date(t.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • ${etaMin} min${etaMin===1?"":"s"}</div>
    `;
    els.up.appendChild(li);
  });
}

function computeIntervals(trains, now) {
  // returns array of minutes between consecutive listed trains
  if (!trains || trains.length < 2) return [];
  // sort by sequence if present, otherwise by time
  const sorted = [...trains].sort((a, b) => {
    if (a.seq && b.seq) return Number(a.seq) - Number(b.seq);
    return parseHKTime(a.time) - parseHKTime(b.time);
  });
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseHKTime(sorted[i-1].time);
    const next = parseHKTime(sorted[i].time);
    gaps.push(minutesDiff(prev, next));
  }
  return gaps;
}

function updateHeadwayWarning(trains, now) {
  // Show message during commute window if any interval ≥ 11 minutes
  if (!withinCommuteWindow()) {
    els.intervalWarn.hidden = true;
    return;
  }
  const gaps = computeIntervals(trains, now);
  const hasLargeGap = gaps.some(g => g >= 11);
  els.intervalWarn.hidden = !hasLargeGap;
}

// --- data fetch ---
async function fetchSchedule() {
  const url = `${API}?line=${LINE}&sta=${STA}&lang=${LANG}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// --- main load ---
async function loadOnce() {
  try {
    setLoading(true);
    setStatus("ok", "Loading…");

    const data = await fetchSchedule();

    // Service alert / suspension cases (status: 0)
    if (data.status === 0) {
      const link = data.url ? ` <a href="${data.url}" target="_blank" rel="noopener">More info</a>` : "";
      setStatus("alert", `${data.message || "Service alert."}${link}`);
      els.up.innerHTML = "";
      els.intervalWarn.hidden = true;
      return;
    }

    const key = `${LINE}-${STA}`;
    const section = data.data && data.data[key] ? data.data[key] : {};
    const now = data.curr_time ? parseHKTime(data.curr_time) : new Date();

    const delayed = data.isdelay === "Y";
    const sys = data.sys_time || "-";
    const cur = data.curr_time || "-";
    setStatus(delayed ? "delay" : "ok",
      `System: ${sys} • Server: ${cur}${delayed ? " • <b>Delay reported</b> ⚠️" : ""}`
    );

    renderUP(section.UP, now);
    updateHeadwayWarning(section.UP, now);

  } catch (e) {
    setStatus("alert", `Error: ${e.message}`);
    console.error(e);
  } finally {
    setLoading(false);
  }
}

// --- auto refresh loop ---
function startAuto() {
  stopAuto();
  const tick = async () => {
    if (!els.auto.checked) return; // manually disabled
    if (!withinCommuteWindow()) {
      setStatus("ok", "Auto‑refresh paused (outside 17:30–18:30).");
      els.intervalWarn.hidden = true;
      return;
    }
    await loadOnce();
  };
  tick();                               // first run
  timer = setInterval(tick, 25_000);    // polite cadence to avoid 429
}
function stopAuto() { if (timer) clearInterval(timer); timer = null; }

// --- theme toggle ---
(function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.body.classList.add("theme-dark");
    els.themeToggle.checked = true;
  }
  els.themeToggle.addEventListener("change", () => {
    if (els.themeToggle.checked) {
      document.body.classList.add("theme-dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("theme-dark");
      localStorage.removeItem("theme"); // fall back to system
    }
  });
})();

// --- wire up ---
els.auto.addEventListener("change", () => els.auto.checked ? startAuto() : stopAuto());
els.reload.addEventListener("click", loadOnce);

// Kick off
startAuto();
