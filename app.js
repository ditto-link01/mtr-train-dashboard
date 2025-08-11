// --- Fixed configuration (DRL → DIS in EN) ---
const LINE = "DRL";      // Disneyland Resort Line
const STA  = "DIS";      // Disneyland Resort Station
const LANG = "EN";       // English
const API  = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php";

// Commute window (local time)
const COMMUTE_START = { h: 17, m: 30 };
const COMMUTE_END   = { h: 18, m: 30 };

// Names for DLR
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
};

let timer = null;

// --- helpers ---
function withinCommuteWindow(d = new Date()) {
  const mins = d.getHours() * 60 + d.getMinutes();
  const start = COMMUTE_START.h * 60 + COMMUTE_START.m;
  const end   = COMMUTE_END.h * 60 + COMMUTE_END.m;
  return mins >= start && mins <= end;
}

function parseHKTime(s) { return new Date(s.replace(" ", "T")); }

function minutesDiff(a, b) { return Math.max(0, Math.round((b - a) / 60000)); }

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

function setLoading(on) { document.body.classList.toggle("loading", on); }

function labelForIndex(i) {
  return i === 0 ? "Next service" : i === 1 ? "Following service" : "Later service";
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

  trains.slice(0, 4).forEach((t, i) => {
    const etaMin = minutesDiff(now, parseHKTime(t.time));
    const timeStr = new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dest = codeToName(t.dest);

    const li = document.createElement("li");
    li.className = "train";
    // Large ETA on the left, destination and label on the right
    li.innerHTML = `
      <div class="etaBox">
        <div class="mins">${etaMin}<small>min</small></div>
        <div class="time">ETA ${timeStr}</div>
      </div>
      <div class="info">
        <div class="dest">${dest}</div>
        <div class="meta">${labelForIndex(i)}</div>
      </div>
    `;
    els.up.appendChild(li);
  });
}

function computeIntervals(trains) {
  if (!trains || trains.length < 2) return [];
  const sorted = [...trains].sort((a, b) => (a.seq && b.seq) ? Number(a.seq) - Number(b.seq)
                                                             : parseHKTime(a.time) - parseHKTime(b.time));
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseHKTime(sorted[i-1].time);
    const next = parseHKTime(sorted[i].time);
    gaps.push(minutesDiff(prev, next));
  }
  return gaps;
}

function updateHeadwayWarning(trains) {
  if (!withinCommuteWindow()) { els.intervalWarn.hidden = true; return; }
  const gaps = computeIntervals(trains);
  els.intervalWarn.hidden = !gaps.some(g => g >= 11);
}

async function fetchSchedule() {
  const url = `${API}?line=${LINE}&sta=${STA}&lang=${LANG}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadOnce() {
  try {
    setLoading(true);
    setStatus("ok", "Loading…");
    const data = await fetchSchedule();

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
    updateHeadwayWarning(section.UP);
  } catch (e) {
    setStatus("alert", `Error: ${e.message}`);
    console.error(e);
  } finally {
    setLoading(false);
  }
}

function startAuto() {
  stopAuto();
  const tick = async () => {
    if (!els.auto.checked) return;
    if (!withinCommuteWindow()) {
      setStatus("ok", "Auto‑refresh paused (outside 17:30–18:30).");
      els.intervalWarn.hidden = true;
      return;
    }
    await loadOnce();
  };
  tick();
  timer = setInterval(tick, 25_000);
}
function stopAuto() { if (timer) clearInterval(timer); timer = null; }

// Wire up
els.auto.addEventListener("change", () => els.auto.checked ? startAuto() : stopAuto());
els.reload.addEventListener("click", loadOnce);

// Kick off
startAuto();
