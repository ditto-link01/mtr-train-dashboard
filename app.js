/**
 * MTR Next Train — DRL @ DIS (English) + TCL @ SUN → HOK (English)
 * Endpoint: https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php
 */

// --- Fixed configuration (DRL → DIS) ---
const LINE = "DRL";   // Disneyland Resort Line
const STA  = "DIS";   // Disneyland Resort Station
const LANG = "EN";    // English-only per requirement
const API  = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php";

// Commute window (local time)
const COMMUTE_START = { h: 17, m: 30 };
const COMMUTE_END   = { h: 19, m:  0  };

// Elements
const els = {
  status:      document.getElementById("status"),
  statusDot:   document.getElementById("statusDot"),
  intervalWarn:document.getElementById("intervalWarn"),
  up:          document.getElementById("up"),
  auto:        document.getElementById("auto"),
  reload:      document.getElementById("reload"),
};

let timer = null;

// Minimal name map (EN) for DRL/TCL destinations (UI only)
const STATION_NAME_EN = {
  SUN: "Sunny Bay",
  DIS: "Disneyland Resort",
  HOK: "Hong Kong",
  TUC: "Tung Chung",
};

const destLabel = (code) => STATION_NAME_EN[code] ?? code;

// --- Helpers ---
function withinCommuteWindow(d = new Date()) {
  const mins = d.getHours() * 60 + d.getMinutes();
  const start = COMMUTE_START.h * 60 + COMMUTE_START.m;
  const end   = COMMUTE_END.h   * 60 + COMMUTE_END.m;
  return mins >= start && mins <= end;
}

// API returns "yyyy-MM-dd HH:mm:ss"
function parseHKTime(s) { return new Date(s.replace(" ", "T")); }

function minutesDiff(a, b) {
  const ta = a instanceof Date ? a.getTime() : a;
  const tb = b instanceof Date ? b.getTime() : b;
  return Math.max(0, Math.floor((tb - ta) / 60000));
}

function setStatus(kind, html) {
  if (!els.status || !els.statusDot) return;
  els.status.className = `status status--${kind}`;
  els.status.innerHTML = html;
  els.statusDot.classList.remove("dot-delay", "dot-alert");
  if (kind === "delay") els.statusDot.classList.add("dot-delay");
  if (kind === "alert") els.statusDot.classList.add("dot-alert");
}

function computeIntervals(trains) {
  if (!trains || trains.length < 2) return [];
  const sorted = [...trains].sort((a, b) =>
    (a.seq && b.seq) ? Number(a.seq) - Number(b.seq)
                     : parseHKTime(a.time) - parseHKTime(b.time)
  );
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseHKTime(sorted[i - 1].time);
    const next = parseHKTime(sorted[i].time);
    gaps.push(minutesDiff(prev, next));
  }
  return gaps;
}

function updateHeadwayWarning(trains) {
  if (!els.intervalWarn) return;
  if (!withinCommuteWindow()) { els.intervalWarn.hidden = true; return; }
  const gaps = computeIntervals(trains);
  els.intervalWarn.hidden = !gaps.some(g => g >= 11);
}

// --- Render UP list (DRL) ---
function renderUP(trains, now) {
  if (!els.up) return;
  els.up.innerHTML = "";
  if (!trains || trains.length === 0) {
    const li = document.createElement("li");
    li.className = "meta";
    li.textContent = "— No trains listed —";
    els.up.appendChild(li);
    return;
  }
  trains.slice(0, 4).forEach((t) => {
    const etaMin = minutesDiff(now, parseHKTime(t.time));
    const timeStr = parseHKTime(t.time).toLocaleTimeString('en-HK', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const li = document.createElement("li");
    li.className = "train";
    li.innerHTML = `
      <div class="etaBox">
        <div class="mins">${etaMin}<small>min</small></div>
        <div class="time">ETA ${timeStr}</div>
      </div>
      <div class="info">
        <div class="dest">${destLabel(t.dest)}</div>
      </div>
    `;
    els.up.appendChild(li);
  });
}

// --- API (Spec) ---
async function fetchSchedule() {
  const url = `${API}?line=${LINE}&sta=${STA}&lang=${LANG}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// --- Load cycle (DRL @ DIS) ---
async function loadOnce() {
  try {
    setStatus("ok", "Loading…");
    const data = await fetchSchedule();

    // Special arrangements / alert
    if (data.status === 0) {
      const link = data.url ? ` <a href="${data.url}" target="_blank" rel="noopener">More info</a>` : "";
      setStatus("alert", `${data.message ?? "Service alert."}${link}`);
      if (els.up) els.up.innerHTML = "";
      if (els.intervalWarn) els.intervalWarn.hidden = true;
      return;
    }

    const key = `${LINE}-${STA}`;
    const section = data?.data?.[key] ?? {};
    const now = data.curr_time ? parseHKTime(data.curr_time) : new Date();
    const delayed = data.isdelay === "Y";
    const sys = data.sys_time ?? "-";
    const cur = data.curr_time ?? "-";
    setStatus(delayed ? "delay" : "ok",
      `System: ${sys} • Server: ${cur}${delayed ? " • <strong>Delay reported</strong> ⚠️" : ""}`
    );

    renderUP(section.UP, now);
    updateHeadwayWarning(section.UP);
  } catch (e) {
    setStatus("alert", `Error: ${e.message}`);
    console.error(e);
  }
}

// ======================
// Extra: TCL @ SUN → HOK
// ======================

async function fetchScheduleFor(line, sta, lang = LANG) {
  const url = `${API}?line=${line}&sta=${sta}&lang=${lang}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderGenericList(targetUL, trains, now) {
  targetUL.innerHTML = "";
  if (!trains || trains.length === 0) {
    const li = document.createElement("li");
    li.className = "meta";
    li.textContent = "— No trains listed —";
    targetUL.appendChild(li);
    return;
  }
  trains.slice(0, 4).forEach((t) => {
    const etaMin = minutesDiff(now, parseHKTime(t.time));
    const timeStr = parseHKTime(t.time).toLocaleTimeString('en-HK', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const li = document.createElement("li");
    li.className = "train";
    li.innerHTML = `
      <div class="etaBox">
        <div class="mins">${etaMin}<small>min</small></div>
        <div class="time">ETA ${timeStr}</div>
      </div>
      <div class="info">
        <div class="dest">${destLabel(t.dest)}</div>
      </div>
    `;
    targetUL.appendChild(li);
  });
}

async function loadTCL_SUN_to_HOK() {
  const list = document.getElementById("tclSun");
  const meta = document.getElementById("tclSunMeta");
  if (!list || !meta) return;

  try {
    const data = await fetchScheduleFor("TCL", "SUN", "EN");
    if (data.status === 0) {
      list.innerHTML = "";
      const li = document.createElement("li");
      li.className = "meta";
      const link = data.url ? ` <a href="${data.url}" target="_blank" rel="noopener">More info</a>` : "";
      li.innerHTML = `Service alert: ${data.message ?? "Special train arrangement."}${link}`;
      list.appendChild(li);
      meta.textContent = "";
     
