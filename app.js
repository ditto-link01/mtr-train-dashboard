/**
 * MTR Next Train – DRL @ DIS (English-only)
 * References:
 *  - API Spec v1.7: https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf
 *    - Resource URL: https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php
 *    - Optional param: lang = EN | TC (we use EN)
 *  - Data Dictionary v1.7: https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf
 *    - dest = 3-letter station code; DRL UP → SUN (Sunny Bay), DOWN → DIS (Disneyland Resort)
 */

// --- Fixed configuration (DRL → DIS) ---
const LINE = "DRL";   // Disneyland Resort Line
const STA  = "DIS";   // Disneyland Resort Station
const LANG = "EN";    // English-only, per requirement
const API  = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php";

// Commute window (local time)
const COMMUTE_START = { h: 17, m: 30 };
const COMMUTE_END   = { h: 19, m: 0 };

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

// Minimal name map (EN) for DRL destinations in UI only
const STATION_NAME_EN = {
  SUN: "Sunny Bay",
  DIS: "Disneyland Resort",
};
const destLabel = (code) => STATION_NAME_EN[code] || code;

// --- Helpers ---
function withinCommuteWindow(d = new Date()) {
  const mins  = d.getHours() * 60 + d.getMinutes();
  const start = COMMUTE_START.h * 60 + COMMUTE_START.m;
  const end   = COMMUTE_END.h   * 60 + COMMUTE_END.m;
  return mins >= start && mins <= end;
}
function parseHKTime(s) { return new Date(s.replace(" ", "T")); } // "yyyy-MM-dd HH:mm:ss"
function minutesDiff(a, b) {
  const ta = a instanceof Date ? a.getTime() : a;
  const tb = b instanceof Date ? b.getTime() : b;
  return Math.max(0, Math.floor((tb - ta) / 60000)); // steadier UX
}
function setStatus(kind, html) {
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
  if (!withinCommuteWindow()) { els.intervalWarn.hidden = true; return; }
  const gaps = computeIntervals(trains);
  els.intervalWarn.hidden = !gaps.some(g => g >= 11);
}

// --- Render UP list (no platform/seq; show "Sunny Bay") ---
function renderUP(trains, now) {
  els.up.innerHTML = "";
  if (!trains || trains.length === 0) {
    const li = document.createElement("li");
    li.className = "meta";
    li.textContent = "— No trains listed —";
    els.up.appendChild(li);
    return;
  }
  trains.slice(0, 4).forEach((t) => {
    const etaMin  = minutesDiff(now, parseHKTime(t.time));
    const timeStr = new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

// --- API (Spec v1.7) ---
async function fetchSchedule() {
  const url = `${API}?line=${LINE}&sta=${STA}&lang=${LANG}`; // 'lang' per Spec v1.7
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// --- Load cycle ---
async function loadOnce() {
  try {
    setStatus("ok", "Loading…");
    const data = await fetchSchedule();

    // Special arrangements / alert
    if (data.status === 0) {
      const link = data.url ? ` <a href="${data.url}" target="_blank" rel="noopener">More info</a>` : "";
      setStatus("alert", `${data.message ?? "Service alert."}${link}`);
      els.up.innerHTML = "";
      els.intervalWarn.hidden = true;
      return;
    }

    const key = `${LINE}-${STA}`;
    const section = data?.data?.[key] ?? {};
    const now     = data.curr_time ? parseHKTime(data.curr_time) : new Date();
    const delayed = data.isdelay === "Y";
    const sys     = data.sys_time  ?? "-";
    const cur     = data.curr_time ?? "-";

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

// --- Auto-refresh (≈25s, within commute window) ---
function startAuto() {
  stopAuto();
  const tick = async () => {
    if (!els.auto.checked) return;
    if (!withinCommuteWindow()) {
      setStatus("ok", "Auto‑refresh paused (outside 17:30–19:00).");
      els.intervalWarn.hidden = true;
      return;
    }
    await loadOnce();
  };
  tick();
  timer = setInterval(tick, 25_000);
}
function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }

els.auto.addEventListener("change", () => els.auto.checked ? startAuto() : stopAuto());
els.reload.addEventListener("click", loadOnce);
// New behavior: fetch once on first load even if outside commute window
if (!withinCommuteWindow()) { loadOnce(); }
startAuto();
