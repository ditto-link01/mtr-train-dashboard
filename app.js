// --- Fixed configuration (DRL → DIS) ---
const LINE = "DRL";   // Disneyland Resort Line
const STA  = "DIS";   // Disneyland Resort Station
const LANG = "EN";    // English only per requirement
const API  = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php";

// Commute window (local time)
const COMMUTE_START = { h: 17, m: 30 };
const COMMUTE_END   = { h: 18, m: 30 };

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

// --- Helpers ---
function withinCommuteWindow(d = new Date()) {
  const mins  = d.getHours() * 60 + d.getMinutes();
  const start = COMMUTE_START.h * 60 + COMMUTE_START.m;
  const end   = COMMUTE_END.h   * 60 + COMMUTE_END.m;
  return mins >= start && mins <= end;
}

function parseHKTime(s) {
  // API: "yyyy-MM-dd HH:mm:ss"
  return new Date(s.replace(" ", "T"));
}

function minutesDiff(a, b) {
  const ta = a instanceof Date ? a.getTime() : a;
  const tb = b instanceof Date ? b.getTime() : b;
  // Use floor to avoid 0↔1 minute bouncing
  return Math.max(0, Math.floor((tb - ta) / 60000));
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

// RENDER: no “Next/Following/Later” tags — just ETA/time/dest/platform
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
    const timeStr = new Date(t.time).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit'
    });

    // Show original API fields only: dest (station code), plat, seq
    const li = document.createElement("li");
    li.className = "train";
    li.innerHTML = `
      <div class="etaBox">
        <div class="mins">${etaMin}<small>min</small></div>
        <div class="time">ETA ${timeStr}</div>
      </div>
      <div class="info">
        <div class="dest">${t.dest}</div>
        <div class="meta">Platform ${t.plat}${t.seq ? ` • Seq ${t.seq}` : ""}</div>
      </div>
    `;
    els.up.appendChild(li);
  });
}

// --- API ---
async function fetchSchedule() {
  // Correctly pass lang=EN (MTR API supports EN/TC; EN default) [1](https://twdc-my.sharepoint.com/personal/marco_p_yu_disney_com/_layouts/15/download.aspx?UniqueId=54ebf479-de0b-4693-bb52-dff0687b9946&Translate=false&tempauth=v1.eyJzaXRlaWQiOiJmYzRiMGJhNC05ZTkwLTRjZjAtOTU4NC01Yzc5ZDgwNTI2ZDkiLCJhcHBfZGlzcGxheW5hbWUiOiJPZmZpY2UgMzY1IFNlYXJjaCBTZXJ2aWNlIiwiYXBwaWQiOiI2NmE4ODc1Ny0yNThjLTRjNzItODkzYy0zZThiZWQ0ZDY4OTkiLCJhdWQiOiIwMDAwMDAwMy0wMDAwLTBmZjEtY2UwMC0wMDAwMDAwMDAwMDAvdHdkYy1teS5zaGFyZXBvaW50LmNvbUA1NmI3MzFhOC1hMmFjLTRjMzItYmY2Yi02MTY4MTBlOTEzYzYiLCJleHAiOiIxNzU0OTMxNjgwIn0.CkAKDGVudHJhX2NsYWltcxIwQ0xDUDZNUUdFQUFhRmtKVFNtRlRlRGxLVEd0TFVYSkxkMUJSVlUxTlFVRXFBQT09CjIKCmFjdG9yYXBwaWQSJDAwMDAwMDAzLTAwMDAtMDAwMC1jMDAwLTAwMDAwMDAwMDAwMAoKCgRzbmlkEgI2NBILCLiszoXLvqw-EAUaDjIwLjE5MC4xNTEuMTAwKixqdC9zeEV6N1J0aVJNdFNidlU5MFVCN2htREhuL2swYlh0TGlGdWx3OWRVPTCVATgBQhChusCj04AAkMXYuXaAX4rUShBoYXNoZWRwcm9vZnRva2VuaiQwMDdiYzc5OS00ZDg3LTFjMjgtNTQ4NC02NWY0NTRmZWEzYTlyKTBoLmZ8bWVtYmVyc2hpcHwxMDAzMjAwMmYzMDdmYzVjQGxpdmUuY29tegEyggESCagxt1asojJMEb9rYWgQ6RPGkgEFTWFyY2-aAQJZdaIBFW1hcmNvLnAueXVAZGlzbmV5LmNvbaoBEDEwMDMyMDAyRjMwN0ZDNUOyAU1hbGxmaWxlcy53cml0ZSBteWZpbGVzLndyaXRlIG15ZmlsZXMucmVhZCBjb250YWluZXIuc2VsZWN0ZWQgYWxscHJvZmlsZXMucmVhZMgBAQ.EeSKzIRJxXoHxaiFAt4GSkizLicKgQCHo_9pu6Y8f5c&ApiVersion=2.0&web=1)
  const url = `${API}?line=${LINE}&sta=${STA}&lang=${LANG}`;
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// --- Load cycle ---
async function loadOnce() {
  try {
    setStatus("ok", "Loading…");
    const data = await fetchSchedule();

    // Service alert or special arrangement (status === 0)
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
  // ~25s cadence keeps us well below rate limits; the spec mentions 429 if too frequent. [1](https://twdc-my.sharepoint.com/personal/marco_p_yu_disney_com/_layouts/15/download.aspx?UniqueId=54ebf479-de0b-4693-bb52-dff0687b9946&Translate=false&tempauth=v1.eyJzaXRlaWQiOiJmYzRiMGJhNC05ZTkwLTRjZjAtOTU4NC01Yzc5ZDgwNTI2ZDkiLCJhcHBfZGlzcGxheW5hbWUiOiJPZmZpY2UgMzY1IFNlYXJjaCBTZXJ2aWNlIiwiYXBwaWQiOiI2NmE4ODc1Ny0yNThjLTRjNzItODkzYy0zZThiZWQ0ZDY4OTkiLCJhdWQiOiIwMDAwMDAwMy0wMDAwLTBmZjEtY2UwMC0wMDAwMDAwMDAwMDAvdHdkYy1teS5zaGFyZXBvaW50LmNvbUA1NmI3MzFhOC1hMmFjLTRjMzItYmY2Yi02MTY4MTBlOTEzYzYiLCJleHAiOiIxNzU0OTMxNjgwIn0.CkAKDGVudHJhX2NsYWltcxIwQ0xDUDZNUUdFQUFhRmtKVFNtRlRlRGxLVEd0TFVYSkxkMUJSVlUxTlFVRXFBQT09CjIKCmFjdG9yYXBwaWQSJDAwMDAwMDAzLTAwMDAtMDAwMC1jMDAwLTAwMDAwMDAwMDAwMAoKCgRzbmlkEgI2NBILCLiszoXLvqw-EAUaDjIwLjE5MC4xNTEuMTAwKixqdC9zeEV6N1J0aVJNdFNidlU5MFVCN2htREhuL2swYlh0TGlGdWx3OWRVPTCVATgBQhChusCj04AAkMXYuXaAX4rUShBoYXNoZWRwcm9vZnRva2VuaiQwMDdiYzc5OS00ZDg3LTFjMjgtNTQ4NC02NWY0NTRmZWEzYTlyKTBoLmZ8bWVtYmVyc2hpcHwxMDAzMjAwMmYzMDdmYzVjQGxpdmUuY29tegEyggESCagxt1asojJMEb9rYWgQ6RPGkgEFTWFyY2-aAQJZdaIBFW1hcmNvLnAueXVAZGlzbmV5LmNvbaoBEDEwMDMyMDAyRjMwN0ZDNUOyAU1hbGxmaWxlcy53cml0ZSBteWZpbGVzLndyaXRlIG15ZmlsZXMucmVhZCBjb250YWluZXIuc2VsZWN0ZWQgYWxscHJvZmlsZXMucmVhZMgBAQ.EeSKzIRJxXoHxaiFAt4GSkizLicKgQCHo_9pu6Y8f5c&ApiVersion=2.0&web=1)
  timer = setInterval(tick, 25_000);
}

function stopAuto() {
  if (timer) clearInterval(timer);
  timer = null;
}

els.auto.addEventListener("change", () => els.auto.checked ? startAuto() : stopAuto());
els.reload.addEventListener("click", loadOnce);
startAuto();
