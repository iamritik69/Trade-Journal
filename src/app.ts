/* RITIK Trade Journal — TypeScript source. Build: npm install && npm run build (tsc) */
type Outcome = "TP" | "SL" | "BE" | "Partial" | "Not Taken";
interface Trade {
  date: string; pair: string; session: string; dir: string; tf: string;
  level: string; module: string; risk: string; sl: string; r: number;
  outcome: Outcome; lesson: string; desc: string;
  checklist: string[]; images: string[];
}
interface NewsEvent { title: string; currency: string; date: string; impact: string; forecast: string; previous: string; }

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
const num = (v: string | number): number => { const n = parseFloat(String(v)); return isNaN(n) ? 0 : n; };

let trades: Trade[] = [];
try { trades = JSON.parse(localStorage.getItem("ritik_trades") || "[]"); } catch { trades = []; }
if (!Array.isArray(trades)) trades = [];
function save(): void { try { localStorage.setItem("ritik_trades", JSON.stringify(trades)); } catch { alert("Storage full — screenshots were skipped. Use Backup and clear old entries."); } }

/* ---------- iPhone-style dropdowns ---------- */
const ddValues: Record<string, string> = {};
function buildDropdowns(): void {
  document.querySelectorAll<HTMLElement>(".ios-dd").forEach((el) => {
    const field = el.dataset.field || "";
    const rawOptions = (el.dataset.options || "").split(",").map((s) => s.trim()).filter(Boolean);
    const isFilter = field === "qSession" || field === "aPair" || field === "aSession";
    const options = isFilter ? ["All", ...rawOptions] : rawOptions;
    const attr = el.getAttribute("data-value");
    const value = attr === null ? (options[0] || "") : attr;
    ddValues[field] = value;
    el.innerHTML = "";
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "dd-btn";
    const sheet = document.createElement("div"); sheet.className = "dd-sheet";
    const backdrop = document.createElement("div"); backdrop.className = "dd-backdrop";
    const renderBtn = (): void => { btn.innerHTML = `<span>${esc(ddValues[field] || "All")}</span><span class="dd-chev">⌄</span>`; };
    const close = (): void => { sheet.classList.remove("open"); backdrop.classList.remove("open"); };
    const open = (): void => {
      document.querySelectorAll(".dd-sheet.open").forEach((s) => s.classList.remove("open"));
      document.querySelectorAll(".dd-backdrop.open").forEach((s) => s.classList.remove("open"));
      sheet.innerHTML = options.map((o) => `<button type="button" class="dd-opt ${o === ddValues[field] ? "sel" : ""}" data-v="${esc(o)}"><span>${esc(o)}</span><span>${o === ddValues[field] ? "✓" : ""}</span></button>`).join("");
      sheet.querySelectorAll<HTMLButtonElement>(".dd-opt").forEach((b) => b.addEventListener("click", () => {
        ddValues[field] = b.dataset.v === "All" ? "" : (b.dataset.v || ""); renderBtn(); close();
        if (field === "qSession" || field === "aPair" || field === "aSession") { render(); renderAnalytics(); }
      }));
      sheet.classList.add("open"); backdrop.classList.add("open");
    };
    btn.addEventListener("click", (e) => { e.stopPropagation(); sheet.classList.contains("open") ? close() : open(); });
    backdrop.addEventListener("click", close);
    renderBtn(); el.appendChild(btn); el.appendChild(backdrop); el.appendChild(sheet);
  });
}
function dd(field: string): string { return ddValues[field] || ""; }

/* ---------- Tabs ---------- */
function showTab(id: string, btn: HTMLElement): void {
  ["journal", "analytics", "news", "tools"].forEach((t) => { const el = document.getElementById("tab-" + t); if (el) el.style.display = t === id ? "block" : "none"; });
  document.querySelectorAll("nav button").forEach((b) => b.classList.remove("active")); btn.classList.add("active");
  if (id === "analytics") renderAnalytics();
  if (id === "news") loadNews();
}
(window as unknown as { showTab: typeof showTab }).showTab = showTab;

/* ---------- Stats / render ---------- */
function stats() {
  const done = trades.filter((t) => t.outcome !== "Not Taken");
  const wins = done.filter((t) => t.r > 0);
  const net = done.reduce((s, t) => s + t.r, 0);
  let streak = 0, dir = 0;
  for (let i = trades.length - 1; i >= 0; i--) { const r = trades[i].r; if (r === 0) continue; const d = r > 0 ? 1 : -1; if (dir === 0) dir = d; if (d !== dir) break; streak++; }
  const pos = done.filter((t) => t.r > 0).reduce((s, t) => s + t.r, 0);
  const neg = Math.abs(done.filter((t) => t.r < 0).reduce((s, t) => s + t.r, 0));
  let peak = 0, ddMax = 0, run = 0; done.forEach((t) => { run += t.r; peak = Math.max(peak, run); ddMax = Math.max(ddMax, peak - run); });
  return { n: trades.length, win: done.length ? Math.round(wins.length / done.length * 100) : 0, net, streak: streak ? ((dir > 0 ? "W" : "L") + streak) : "—", pf: neg ? (pos / neg).toFixed(2) : "—", exp: done.length ? (net / done.length).toFixed(2) : "0", dd: ddMax.toFixed(2) };
}
function render(): void {
  const s = stats();
  $("stats").innerHTML = [["TRADES", String(s.n)], ["WIN RATE", s.win + "%"], ["NET R", s.net.toFixed(2)], ["STREAK", s.streak], ["PROFIT FACTOR", s.pf], ["EXPECTANCY", s.exp + "R"], ["MAX DD", s.dd + "R"]].map((x) => `<div class="card"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
  const q = ($("q") as HTMLInputElement).value.toLowerCase();
  const qs = dd("qSession");
  const rows = trades.map((t, i) => ({ ...t, i })).reverse().filter((t) => (!qs || t.session === qs) && (!q || JSON.stringify(t).toLowerCase().includes(q)));
  $("history").innerHTML = rows.map((t) => `<tr><td>${esc(t.date)}</td><td>${esc(t.pair)}<br><span class="small">${esc(t.session)}</span></td><td>${esc(t.dir)}<br><span class="small">${esc(t.level)} ${esc(t.tf)}</span></td><td>${esc(t.risk)}%<br><b class="${t.r >= 0 ? "win" : "loss"}">${t.r}R</b></td><td>${esc(t.outcome)}</td><td>${esc(t.lesson)}<br><span class="small">${esc(t.desc)}</span><br>${t.images.map((im) => `<img src="${im}" style="width:60px;height:40px;object-fit:cover;border-radius:8px;margin:2px">`).join("")}</td><td><button class="btn" data-del="${t.i}">Delete</button></td></tr>`).join("") || '<tr><td colspan="7">No entries yet. Add your first entry above.</td></tr>';
  document.querySelectorAll<HTMLButtonElement>("[data-del]").forEach((b) => b.addEventListener("click", () => { if (confirm("Delete this entry?")) { trades.splice(Number(b.dataset.del), 1); save(); render(); renderAnalytics(); } }));
  calc(); challenge();
}
function breakdown(key: keyof Trade): string {
  const m: Record<string, { n: number; w: number; net: number }> = {};
  const fp = dd("aPair"), fs = dd("aSession");
  trades.filter((t) => (!fp || t.pair === fp) && (!fs || t.session === fs)).forEach((t) => { const k = String(t[key] || "—"); m[k] = m[k] || { n: 0, w: 0, net: 0 }; m[k].n++; if (t.r > 0) m[k].w++; m[k].net += t.r; });
  return Object.entries(m).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${v.n ? Math.round(v.w / v.n * 100) : 0}%</td><td>${v.net.toFixed(2)}R</td></tr>`).join("");
}
function renderAnalytics(): void {
  const s = stats();
  $("advStats").innerHTML = `Max drawdown: <b>${s.dd}R</b> • Expectancy: <b>${s.exp}R</b> • Profit factor: <b>${s.pf}</b>`;
  const c = $("curve") as HTMLCanvasElement, ctx = c.getContext("2d"); if (!ctx) return;
  ctx.clearRect(0, 0, 1000, 280); ctx.strokeStyle = "#33456e"; ctx.beginPath(); ctx.moveTo(0, 140); ctx.lineTo(1000, 140); ctx.stroke();
  let run = 0; const pts: [number, number][] = [[0, 140]];
  trades.forEach((t, i) => { run += t.r; pts.push([(i + 1) / Math.max(1, trades.length) * 980, 140 - run * 20]); });
  ctx.strokeStyle = "#f5b301"; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
  const now = new Date(), ym = now.toISOString().slice(0, 7), days: Record<string, number> = {};
  trades.forEach((t) => { if (t.date.startsWith(ym)) days[t.date] = (days[t.date] || 0) + t.r; });
  let html = ""; const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) { const k = ym + "-" + String(d).padStart(2, "0"), v = days[k] || 0; html += `<span class="day ${v > 0 ? "pos" : v < 0 ? "neg" : ""}" title="${k}: ${v.toFixed(2)}R">${d}</span>`; }
  $("heatmap").innerHTML = html;
  $("breakdowns").innerHTML = `<h3>By pair</h3><table><tr><th>Pair</th><th>Trades</th><th>Win %</th><th>Net R</th></tr>${breakdown("pair")}</table><h3>By session</h3><table><tr><th>Session</th><th>Trades</th><th>Win %</th><th>Net R</th></tr>${breakdown("session")}</table><h3>By level</h3><table><tr><th>Level</th><th>Trades</th><th>Win %</th><th>Net R</th></tr>${breakdown("level")}</table>`;
  const counts: Record<string, number> = {}; trades.forEach((t) => { if (t.lesson) counts[t.lesson] = (counts[t.lesson] || 0) + 1; });
  $("mistakes").innerHTML = Object.entries(counts).filter((x) => x[1] > 1).map((x) => `<p>${esc(x[0])} — <b>${x[1]} times</b></p>`).join("") || '<p class="small">No repeated lesson yet.</p>';
}

/* ---------- Entry form ---------- */
function readFiles(files: FileList | null): Promise<string[]> {
  const list = files ? Array.from(files).slice(0, 10) : [];
  return Promise.all(list.map((f) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => res(""); r.readAsDataURL(f); }))).then((arr) => arr.filter(Boolean));
}
$("entryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const images = await readFiles(($("fImg") as HTMLInputElement).files);
  const total = images.reduce((s, im) => s + im.length, 0);
  const kept = total > 3500000 ? [] : images;
  if (total > 3500000) alert("Screenshots too large for browser storage — entry saved without images. Use smaller images.");
  const t: Trade = {
    date: ($("fDate") as HTMLInputElement).value || new Date().toISOString().slice(0, 10),
    pair: dd("pair"), session: dd("session"), dir: dd("dir"), tf: dd("tf"), level: dd("level"),
    module: ($("fModule") as HTMLInputElement).value, risk: ($("fRisk") as HTMLInputElement).value,
    sl: ($("fSl") as HTMLInputElement).value, r: num(($("fR") as HTMLInputElement).value),
    outcome: dd("outcome") as Outcome, lesson: ($("fLesson") as HTMLInputElement).value,
    desc: ($("fDesc") as HTMLInputElement).value,
    checklist: ["c1", "c2", "c3", "c4"].filter((id) => ($ (id) as HTMLInputElement).checked),
    images: kept,
  };
  trades.push(t); save(); render(); renderAnalytics();
  (document.getElementById("entryForm") as HTMLFormElement).reset(); buildDropdowns(); alert("Entry saved.");
});
(window as unknown as { backup: () => void }).backup = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(trades, null, 2)], { type: "application/json" })); a.download = "trade-journal-backup.json"; a.click(); };
(window as unknown as { exportCsv: () => void }).exportCsv = () => { const rows: string[][] = [["date", "pair", "session", "direction", "level", "risk", "r", "outcome", "lesson"]]; trades.forEach((t) => rows.push([t.date, t.pair, t.session, t.dir, t.level, t.risk, String(t.r), t.outcome, (t.lesson || "").replace(/,/g, " ")])); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" })); a.download = "trade-journal.csv"; a.click(); };
(window as unknown as { restore: (f: File | undefined) => void }).restore = (f) => { if (!f) return; const r = new FileReader(); r.onload = () => { try { const v = JSON.parse(String(r.result)); if (!Array.isArray(v)) throw new Error("bad"); trades = v; save(); render(); alert("Restored."); } catch { alert("Invalid backup file."); } }; r.readAsText(f); };
(window as unknown as { printReport: () => void }).printReport = () => window.print();

/* ---------- Calculators (live, oninput) ---------- */
function calc(): void {
  const a = num(($("acc") as HTMLInputElement).value), r = num(($("riskPct") as HTMLInputElement).value), sl = num(($("slPips") as HTMLInputElement).value);
  const amt = a * r / 100; $("calcOut").innerHTML = `Risk amount: <b>$${amt.toFixed(2)}</b> • Size per pip: <b>$${sl ? (amt / sl).toFixed(2) : "—"}</b>`;
}
function challenge(): void {
  const st = num(($("chStart") as HTMLInputElement).value), tg = num(($("chTarget") as HTMLInputElement).value), ddT = num(($("chTotal") as HTMLInputElement).value), ddD = num(($("chDaily") as HTMLInputElement).value);
  let bal = st; trades.forEach((t) => { bal *= 1 + (num(t.risk) * t.r / 100); });
  const target = st * (1 + tg / 100);
  $("chOut").innerHTML = `Estimated balance: <b>$${bal.toFixed(2)}</b> • Target: <b>$${target.toFixed(2)}</b> • Daily DD amount: <b>$${(st * ddD / 100).toFixed(2)}</b> • Total DD amount: <b>$${(st * ddT / 100).toFixed(2)}</b> • Remaining to target: <b>$${Math.max(0, target - bal).toFixed(2)}</b>`;
}
["acc", "riskPct", "slPips", "chStart", "chTarget", "chDaily", "chTotal"].forEach((id) => $(id).addEventListener("input", () => { calc(); challenge(); }));
$("q").addEventListener("input", render);

/* ---------- PIN lock ---------- */
async function sha(s: string): Promise<string> { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
(window as unknown as { setPin: () => Promise<void> }).setPin = async () => { const p = ($("pinSet") as HTMLInputElement).value; if (!p) return alert("Enter a PIN first."); localStorage.setItem("ritik_pin_hash", await sha(p)); alert("PIN set in this browser."); };
(window as unknown as { lockNow: () => void }).lockNow = () => { if (localStorage.getItem("ritik_pin_hash")) $("lockScreen").style.display = "block"; else alert("Set a PIN first."); };
(window as unknown as { unlock: () => Promise<void> }).unlock = async () => { if (await sha(($("pinIn") as HTMLInputElement).value) === localStorage.getItem("ritik_pin_hash")) $("lockScreen").style.display = "none"; else alert("Wrong PIN."); };
if (localStorage.getItem("ritik_pin_hash")) $("lockScreen").style.display = "block";

/* ---------- Forex News: direct, then CORS proxies, never invented ---------- */
async function fetchJson(url: string): Promise<unknown> { const res = await fetch(url); if (!res.ok) throw new Error("feed failed"); return res.json(); }
async function loadNews(): Promise<void> {
  const box = $("news"); box.textContent = "Loading…";
  const urls = [
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://api.codetabs.com/v1/proxy?quest=https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://nfs.faireconomy.media/ff_calendar_thisweek.json"),
  ];
  let raw: unknown = null, lastErr = "";
  for (const u of urls) { try { raw = await fetchJson(u); break; } catch (e) { lastErr = String(e); } }
  if (!Array.isArray(raw)) { box.innerHTML = `<p>Live calendar feed could not be loaded in this browser (${esc(lastErr)}). Open the source link below for the current calendar. No events have been invented here.</p>`; return; }
  let ev = (raw as Record<string, unknown>[]).map((e) => ({ title: String(e.title || ""), currency: String(e.country || e.currency || ""), date: String(e.date || ""), impact: String(e.impact || ""), forecast: String(e.forecast || ""), previous: String(e.previous || "") })).filter((e) => ["USD", "EUR", "GBP"].includes(e.currency));
  if (($("highOnly") as HTMLInputElement).checked) ev = ev.filter((e) => e.impact === "High");
  ev.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const now = new Date();
  box.innerHTML = ev.map((e) => { const d = new Date(new Date(e.date).getTime() + 5.5 * 3600 * 1000); return `<p><b>${d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</b> • ${esc(e.currency)} • ${esc(e.impact)} • ${esc(e.title)} • Forecast: ${esc(e.forecast || "—")} • Previous: ${esc(e.previous || "—")} ${d < now ? '<span class="small">(past)</span>' : ""}</p>`; }).join("") || "<p>No events match this filter this week.</p>";
}
(window as unknown as { loadNews: () => Promise<void> }).loadNews = loadNews;

/* ---------- Reminders ---------- */
function reminders(): void {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const nextAt = (h: number, m: number): Date => { const d = new Date(now); d.setHours(h, m, 0, 0); if (d <= now) d.setDate(d.getDate() + 1); return d; };
  const fmt = (ms: number): string => Math.floor(ms / 3600000) + "h " + Math.floor(ms % 3600000 / 60000) + "m";
  $("reminders").innerHTML = `London open (1:30 PM IST) in <b>${fmt(nextAt(13, 30).getTime() - now.getTime())}</b> • New York open (6:30 PM IST, from 2 Nov) in <b>${fmt(nextAt(18, 30).getTime() - now.getTime())}</b> • Asia open (5:30 AM IST) in <b>${fmt(nextAt(5, 30).getTime() - now.getTime())}</b>`;
}
setInterval(reminders, 60000); reminders(); buildDropdowns(); render();
