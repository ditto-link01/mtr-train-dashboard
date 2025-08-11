// Fixed configuration for Marco (DRL → DIS in EN)
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
  up: document.getElementById("up"),
  down: document.getElementById("down"),
  auto: document.getElementById("auto"),
  reload: document.getElementById("reload"),
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

function minutesDiff(now, target) {
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
}

function codeToName(code) { return NAME[code] || code; }

function setStatus(text, cls="ok") {
  els.status.className = cls;
  els.status.innerHTML = text;
}

function renderTrains(container, trains, now) {
  container.innerHTML = "";
  if (!trains || trains.length === 0) {
    const li = document.createElement("li");
    li.className = "meta";
    li.textContent = "— No trains listed —";
    container.appendChild(li);
    return;
  }
  trains.slice(0, 4).forEach(t => {
    const etaMin = minutesDiff(now, parseHKTime(t.time));
    const dest = codeToName(t.dest);
    const plat = t.plat ? ` • Platform ${t.plat}` : "";
    const li = document.createElement("li");
    li.innerHTML = `
      <div><strong>${dest}</strong> <span class="badge">${etaMin} min${etaMin===1?"":"s"}</span></div>
      <div class="meta">ETA ${new Date(t.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}${plat}</div>
    `;
    container.appendChild(li);
  });
}

async function fetchSchedule() {
  // Spec: GET with line+sta+lang, JSON payload includes status/UP/DOWN/etc.
  // https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf
  const url = `${API}?line=${LINE}&sta=${STA}&lang=${LANG}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadOnce() {
  try {
    setStatus("Loading…", "ok");
    const data = await fetchSchedule();

    // Service alert / suspension
    if (data.status === 0) {
      const link = data.url ? ` <a href="${data.url}" target="_blank" rel="noopener">More info</a>` : "";
      setStatus(`${data.message || "Service alert."}${link}`, "alert");
      els.up.innerHTML = ""; els.down.innerHTML = "";
      return;
    }

    const key = `${LINE}-${STA}`;
    const section = data.data && data.data[key] ? data.data[key] : {};
    const now = data.curr_time ? parseHKTime(data.curr_time) : new Date();

    const delayed = data.isdelay === "Y";
    const sys = data.sys_time || "-";
    const cur = data.curr_time || "-";
    setStatus(
      `System: ${sys} • Server: ${cur}${delayed ? " • <b>Delay reported</b> ⚠️" : ""}`,
      "ok"
    );

    renderTrains(els.up, section.UP, now);
    renderTrains(els.down, section.DOWN, now);
  } catch (e) {
    setStatus(`Error: ${e.message}`, "error");
    console.error(e);
  }
}

function startAuto() {
  stopAuto();
  const tick = async () => {
    if (!els.auto.checked) return; // manually disabled
    if (!withinCommuteWindow()) {
      setStatus("Auto‑refresh paused (outside 17:30–18:30).", "ok");
      return;
    }
    await loadOnce();
  };
  tick();                               // first run
  timer = setInterval(tick, 25_000);    // polite cadence to avoid 429
}

function stopAuto() { if (timer) clearInterval(timer); timer = null; }

// Wire up
els.auto.addEventListener("change", () => els.auto.checked ? startAuto() : stopAuto());
els.reload.addEventListener("click", loadOnce);

// Kick off
startAuto();
