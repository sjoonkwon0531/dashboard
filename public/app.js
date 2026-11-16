/* 현황판: 세 공개 모니터의 자료를 브라우저에서 직접 읽어 그린다.
   판정은 새로 만들지 않는다. 각 사이트의 규칙·숫자를 그대로 옮기고, 판정이 없는 곳은 기록·공시만 그린다. */
"use strict";

const MEGA = "https://monitor.sjoonkwon.com";
const MEM = "https://memsim.sjoonkwon.com";
const CAP = "https://aicapex.sjoonkwon.com";

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const fmt = (v, d = 0) => v == null || isNaN(v) ? "–" : Number(v).toLocaleString("ko-KR", {minimumFractionDigits: d, maximumFractionDigits: d});
const pct = (v, d = 0) => v == null || isNaN(v) ? "–" : (v * 100).toFixed(d) + "%";
const kstDate = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const kst = iso => iso ? new Date(iso).toLocaleString("ko-KR", {timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"}) : "–";
const hoursSince = iso => iso ? (Date.now() - new Date(iso)) / 3600e3 : Infinity;

async function get(url, as = "json") {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, {cache: "no-cache", signal: ctl.signal});
    if (!r.ok) throw new Error(`${r.status}`);
    return as === "json" ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}

function csv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const keys = head.split(",");
  return rows.map(line => {
    const v = line.split(",");
    const o = {};
    keys.forEach((k, i) => { o[k] = v[i] === undefined || v[i] === "" ? null : (isNaN(+v[i]) ? v[i] : +v[i]); });
    return o;
  });
}

function body(id) { return $(`#${id} .body`); }
function fail(id, what, e) {
  body(id).innerHTML = `<p class="fail">${esc(what)}을(를) 읽지 못했습니다. 원 페이지에서 확인해 주세요.</p><p class="meta">${esc(String(e && e.message || e || ""))}</p>`;
}
function metaLine(parts) { return `<p class="meta">${parts.filter(Boolean).map(p => `<span>${p}</span>`).join("")}</p>`; }

/* ---------- 작은 그림 도구 ---------- */
function bars(vals, labels, {h = 110, unit = "", hiLast = true, partialLast = false, fmtV = v => fmt(v, 0)} = {}) {
  const n = vals.length, W = 320, pad = 18, bw = (W - 8) / n;
  const mx = Math.max(...vals.filter(v => v != null), 1);
  const ys = v => (h - pad - 14) * (v / mx);
  let s = `<svg viewBox="0 0 ${W} ${h}" width="100%" role="img" aria-label="${esc(labels[0])}부터 ${esc(labels[n - 1])}까지 막대 그래프">`;
  vals.forEach((v, i) => {
    if (v == null) return;
    const x = 4 + i * bw + bw * 0.14, w = bw * 0.72, y = h - pad - ys(v);
    const last = i === n - 1;
    const fill = last && hiLast ? "var(--accent)" : "var(--line)";
    s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${ys(v).toFixed(1)}" rx="2" fill="${fill}"${last && partialLast ? ' fill-opacity=".45" stroke="var(--accent)" stroke-dasharray="3 2"' : ""}><title>${esc(labels[i])}: ${esc(fmtV(v))}${unit}</title></rect>`;
    if (last) s += `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="end" font-size="11" font-weight="600" fill="var(--ink)">${esc(fmtV(v))}${unit}</text>`;
  });
  const lab = (i, anchor) => `<text x="${(4 + i * bw + bw / 2).toFixed(1)}" y="${h - 3}" text-anchor="${anchor}" font-size="10" fill="var(--ink-3)">${esc(labels[i])}</text>`;
  s += lab(0, "start") + lab(n - 1, "end");
  return s + `<line x1="2" x2="${W - 2}" y1="${h - pad}" y2="${h - pad}" stroke="var(--line)"/></svg>`;
}

function gauge(v, {ticks = [], max = 1, label = "", fmtV = x => pct(x), colorAt = () => "var(--accent)"} = {}) {
  // 반원 계기판. v는 0..max
  const W = 200, H = 116, cx = 100, cy = 100, r = 80;
  const ang = x => Math.PI * (1 - Math.min(Math.max(x / max, 0), 1));
  const pt = (x, rr = r) => [cx + rr * Math.cos(ang(x)), cy - rr * Math.sin(ang(x))];
  const arc = (a, b, col, wdt = 14) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${wdt}"/>`; };
  let s = `<svg viewBox="0 -14 ${W} ${H + 14}" width="100%" style="max-width:220px" role="img" aria-label="${esc(label)} ${esc(fmtV(v))}">`;
  s += arc(0, max, "var(--sunk)");
  if (v != null) s += arc(0, Math.min(v, max), colorAt(v));
  ticks.forEach(t => { const [x1, y1] = pt(t, r - 10), [x2, y2] = pt(t, r + 10); const [tx, ty] = pt(t, r + 18);
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--ink-2)" stroke-width="1.5"/><text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--ink-3)">${esc(fmtV(t))}</text>`; });
  s += `<text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="26" font-weight="700" fill="var(--ink)">${esc(v == null ? "–" : fmtV(v))}</text>`;
  s += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="11" fill="var(--ink-3)">${esc(label)}</text>`;
  return s + "</svg>";
}

function tank(rate, {manual = false} = {}) {
  const W = 56, H = 72, top = 6, bot = 66, inner = bot - top;
  const lv = rate == null ? 0 : Math.max(0, Math.min(100, rate));
  const y = bot - inner * lv / 100;
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <rect x="6" y="${top}" width="44" height="${inner}" rx="6" fill="var(--sunk)" stroke="${manual ? "var(--ink-3)" : "var(--line)"}" ${manual ? 'stroke-dasharray="4 3"' : ""}/>
    <rect x="6" y="${y.toFixed(1)}" width="44" height="${(bot - y).toFixed(1)}" rx="${lv > 96 ? 6 : 0}" fill="var(--accent)" fill-opacity="${manual ? 0.4 : 0.85}"/>
    <line x1="6" x2="50" y1="${top + inner / 2}" y2="${top + inner / 2}" stroke="var(--ink-3)" stroke-dasharray="2 3" stroke-width=".8"/>
  </svg>`;
}

function funnel(rows, target) {
  // rows: [{name, mw, note, kind}] 가로 막대, 목표 대비 선형 비례(작은 값도 그대로 작게)
  const W = 320, rh = 24, H = rows.length * rh + 4, x0 = 74, wmax = W - x0 - 64;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="단계별 기록 확인 용량">`;
  rows.forEach((r, i) => {
    const y = 2 + i * rh, w = Math.max(r.mw > 0 ? 2 : 0, wmax * r.mw / target);
    const col = r.kind === "target" ? "var(--line)" : r.kind === "ann" ? "var(--accent-soft)" : "var(--accent)";
    s += `<text x="${x0 - 8}" y="${y + 15}" text-anchor="end" font-size="11.5" fill="var(--ink-2)">${esc(r.name)}</text>`;
    s += `<rect x="${x0}" y="${y + 4}" width="${wmax}" height="${rh - 9}" rx="3" fill="var(--sunk)"/>`;
    s += `<rect x="${x0}" y="${y + 4}" width="${w.toFixed(1)}" height="${rh - 9}" rx="3" fill="${col}"><title>${esc(r.name)} ${fmt(r.mw)}MW${r.note ? " · " + esc(r.note) : ""}</title></rect>`;
    s += `<text x="${x0 + wmax + 6}" y="${y + 15}" font-size="11.5" font-weight="600" fill="var(--ink)" class="num">${r.mw >= 1000 ? (r.mw / 1000).toFixed(1) + "GW" : fmt(r.mw) + "MW"}</text>`;
  });
  return s + "</svg>";
}

/* ---------- 카드 ---------- */
const LBL = {ok: "정상", warn: "주의", bad: "병목", idle: "착수 전"};
const st = s => LBL[s] ? s : "idle";

const FAB_SITES = [
  {id: "swfab", name: "서남권", sub: "삼성·SK 팹 4기", data: "/data/swfab.json", page: "/swfab.html"},
  {id: "yongin-ss", name: "용인 국가산단", sub: "삼성 팹 6기", data: "/data/fab_yongin_ss.json", page: "/yongin-ss.html"},
  {id: "yongin-sk", name: "용인 일반산단", sub: "SK 팹 4기", data: "/data/fab_yongin_sk.json", page: "/yongin-sk.html"}
];
const FAB_COLS = [["site", "부지"], ["admin", "행정"], ["power", "전력"], ["water", "용수"], ["law", "법제"], ["corp", "기업"]];

async function cardSwfab() {
  const FL = {...LBL, idle: "미확정"};  // 거점 판정에서 회색은 '착수 전'이 아니라 '판정할 근거 부족'
  try {
    const all = await Promise.all(FAB_SITES.map(s => get(MEGA + s.data).then(d => ({s, d})).catch(() => ({s, d: null}))));
    if (!all.some(x => x.d)) throw new Error("자료 없음");
    const cnt = {bad: 0, warn: 0, ok: 0, idle: 0};
    const rows = all.map(({s, d}) => {
      if (!d) return `<div class="fm-row"><div class="fm-nm"><b>${esc(s.name)}</b><span>읽지 못함</span></div></div>`;
      const by = Object.fromEntries(d.layers.map(l => [l.id, l]));
      d.layers.forEach(l => cnt[st(l.status)]++);
      const cells = FAB_COLS.map(([id, nm]) => { const l = by[id]; const k = l ? st(l.status) : "idle";
        return `<a class="fm-c s-${k}" href="${MEGA}${s.page}#layer-${id}" title="${esc(nm + " · " + FL[k] + (l ? " · " + l.why : ""))}" aria-label="${esc(s.name + " " + nm + " " + FL[k])}"><span class="bulb" aria-hidden="true"></span></a>`; }).join("");
      return `<div class="fm-row"><a class="fm-nm" href="${MEGA}${s.page}"><b>${esc(s.name)}</b><span>${esc(s.sub)}</span></a>${cells}</div>`;
    }).join("");
    const asof = all.filter(x => x.d).map(x => x.d.meta.asof).sort().pop();
    const bads = all.filter(x => x.d).flatMap(x => x.d.layers.filter(l => st(l.status) === "bad").map(l => `${x.s.name} ${l.name}`));
    body("swfab").innerHTML = `
      <div class="tally">${["bad", "warn", "ok", "idle"].filter(k => cnt[k]).map(k => `<span class="chip ${k}">${FL[k]} ${cnt[k]}</span>`).join("")}</div>
      <div class="fm" role="table" aria-label="거점별 여섯 층 판정">
        <div class="fm-row fm-h" role="row"><span></span>${FAB_COLS.map(([, nm]) => `<span>${nm}</span>`).join("")}</div>
        ${rows}
      </div>
      <p class="read">${bads.length ? `<b>${esc(bads.join(", "))}</b>이(가) 병목입니다. ` : ""}칸을 누르면 그 층의 근거로 갑니다. 서남권 용수 층만 규칙 판정이고, 나머지는 운영자 판단입니다. 평택·이천·청주·충남은 판정 없이 <a href="${MEGA}/fab.html#light">팹별 일정</a>만 기록합니다.</p>
      ${metaLine([`판정 기준일 ${esc(asof || "–")}`, "공개 보도·정부 발표 근거"])}`;
  } catch (e) { fail("swfab", "반도체 클러스터 판정", e); }
}

const MIND = [
  ["spot_premium", "스팟 프리미엄"], ["text_score", "실적 문구"], ["tw_acc", "대만 매출 가속도"],
  ["exp_acc", "한국 D램 수출 가속도"], ["p_down", "수출 감소 확률"], ["nand_acc", "NAND 가속도"]];
async function cardMem() {
  try {
    const [txt, meta] = await Promise.all([get(`${MEM}/data/monitor.csv`, "text"), get(`${MEM}/data/meta.json`).catch(() => null)]);
    const rows = csv(txt);
    const latest = k => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i][k] != null) return rows[i]; return null; };
    const cnt = {red: 0, amber: 0, green: 0};
    const dots = MIND.map(([k, nm]) => { const r = latest(k); const s = r && r[k + "_status"]; if (s) cnt[s]++;
      const c = s === "red" ? "bad" : s === "amber" ? "warn" : s === "green" ? "ok" : "idle";
      return `<span title="${esc(nm)}${r ? " · " + esc(r.month) : ""}"><i class="dot ${c}"></i>${esc(nm)}</span>`; }).join("");
    // memsim 첫 화면과 같은 규칙: 빨강이 하나라도 있으면 빨강, 아니면 노랑이 있으면 노랑, 아니면 초록
    const tone = cnt.red ? "r" : cnt.amber ? "a" : "g";
    const toneTxt = {r: "빨강 신호가 켜져 있습니다", a: "노랑 신호가 있어 경계가 필요합니다", g: "모든 신호가 초록입니다"}[tone];
    const months = MIND.filter(([k]) => k !== "text_score").map(([k]) => latest(k)).filter(Boolean).map(r => r.month).sort();
    const asof = months[months.length - 1];
    const p = latest("p_down");
    const gen = meta && meta.generated_at;
    const genIso = gen ? gen.replace(" KST", "+09:00").replace(" ", "T") : null;
    const stale = hoursSince(genIso) > 72;
    body("memsim").innerHTML = `
      <div class="tl-row">
        <div class="tl" role="img" aria-label="${esc(toneTxt)}"><i class="r ${tone === "r" ? "on" : ""}"></i><i class="a ${tone === "a" ? "on" : ""}"></i><i class="g ${tone === "g" ? "on" : ""}"></i></div>
        <div style="flex:1;min-width:0">${gauge(p ? p.p_down : null, {ticks: [0.3, 0.5], label: "6개월 뒤 수출 감소 확률", colorAt: v => v > 0.5 ? "var(--bad)" : v > 0.3 ? "var(--warn)" : "var(--ok)"})}</div>
      </div>
      <div class="tally"><span class="chip bad">빨강 ${cnt.red}</span><span class="chip warn">노랑 ${cnt.amber}</span><span class="chip ok">초록 ${cnt.green}</span></div>
      <div class="ind">${dots}</div>
      <p class="read">기준 월 <b>${esc(asof || "–")}</b>. ${esc(toneTxt)}. HBM은 범용 국면과 따로 움직여 신호등에서 뺍니다.</p>
      ${metaLine([`memsim 갱신 ${esc(gen || "–")}`, stale ? '<span class="stale">갱신 지연</span>' : "", "확률 기준선 30%·50%(사전 고정)"])}`;
  } catch (e) { fail("memsim", "메모리 국면 자료", e); }
}

const CORE4 = ["MSFT", "GOOGL", "AMZN", "META"];
async function cardCapex() {
  try {
    const rows = csv(await get(`${CAP}/capex/data/quarterly.csv`, "text")).filter(r => CORE4.includes(r.ticker));
    const by = {};
    rows.forEach(r => { (by[r.cq] ||= {})[r.ticker] = r; });
    const qs = Object.keys(by).sort().filter(q => CORE4.every(t => by[q][t] && by[q][t].capex != null));
    const sum = (q, k) => CORE4.reduce((a, t) => a + (by[q][t][k] ?? NaN), 0);
    const last = qs[qs.length - 1];
    const yq = q => `${+q.slice(0, 4) - 1}${q.slice(4)}`;
    const series = qs.slice(-12);
    const cap = series.map(q => sum(q, "capex"));
    const yoy = by[yq(last)] && qs.includes(yq(last)) ? sum(last, "capex") / sum(yq(last), "capex") - 1 : null;
    const inten = sum(last, "capex_ttm") / sum(last, "ocf_ttm");
    body("capex").innerHTML = `
      <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">
        <div><div class="big num">$${fmt(sum(last, "capex"), 1)}B</div><div class="sub">${esc(last)} 4사 합계 · 전년 같은 분기 대비 <b class="num" style="color:var(--ink)">${yoy == null ? "–" : (yoy > 0 ? "+" : "") + pct(yoy)}</b></div></div>
      </div>
      ${bars(cap, series, {unit: "", fmtV: v => "$" + fmt(v, 0) + "B"})}
      <div>${gauge(isFinite(inten) ? inten : null, {max: 1.5, ticks: [1], label: "설비투자 ÷ 영업현금흐름(최근 4분기)", colorAt: v => v > 1 ? "var(--warn)" : "var(--accent)"})}</div>
      <p class="read">4사는 마이크로소프트·알파벳·아마존·메타입니다. 계기판이 100%를 넘으면 영업으로 번 현금보다 더 많이 투자한다는 뜻입니다.</p>
      ${metaLine([`최신 분기 ${esc(last)}(달력 분기, SEC 공시)`, "메가프로젝트 AIDC 페이지 숫자와 3시간마다 자동 대조"])}`;
  } catch (e) { fail("capex", "설비투자 자료", e); }
}

async function cardAidc() {
  try {
    const R = await get(`${MEGA}/data/aidc_registry.json`);
    const stages = R.stages.map(s => s.key);
    const gov = [], other = [];
    R.projects.forEach(p => p.units.forEach(u => {
      if (!u.mw) return;
      let hi = -1;
      stages.forEach((k, i) => { if (u.stages[k] && u.stages[k].s === "rec") hi = Math.max(hi, i); });
      (String(p.program || "").startsWith("1단계") ? gov : other).push({p, u, hi});
    }));
    const recAt = (list, key) => list.filter(x => x.hi >= stages.indexOf(key)).reduce((a, x) => a + x.u.mw, 0);
    const TARGET = 8400;
    const rows = [
      {name: "정부 목표", mw: TARGET, kind: "target", note: "1단계(정부 자료)"},
      {name: "용량 발표", mw: gov.reduce((a, x) => a + x.u.mw, 0), kind: "ann", note: "용량이 공개된 단위 합계(발표 포함)"},
      ...[["site", "부지"], ["permit", "인허가"], ["fid", "투자 결정"], ["build", "착공"], ["live", "가동"]].map(([k, nm]) => ({name: nm, mw: recAt(gov, k), kind: "rec", note: "기록으로 확인된 누적"}))];
    const built = recAt(gov, "build"), permit = recAt(gov, "permit");
    const otherBuild = other.filter(x => x.hi >= stages.indexOf("build"));
    body("aidc").innerHTML = `
      ${funnel(rows, TARGET)}
      <p class="read">정부 1단계 목표 8.4GW 가운데 행정·공시 기록으로 착공이 확인된 것은 <b class="num">${fmt(built)}MW(${(built / TARGET * 100).toFixed(1)}%)</b>, 인허가까지 확인된 것은 <b class="num">${fmt(permit)}MW</b>입니다. 막대는 목표에 비례해 그렸습니다.${otherBuild.length ? ` 정부 1단계 포함 여부가 확인되지 않은 사업 중 착공 기록이 있는 것: ${otherBuild.map(x => `${esc(x.p.name.replace(/\(.*?\)/, ""))} ${fmt(x.u.mw)}MW`).join(", ")}.` : ""}</p>
      ${metaLine([`기록 기준일 ${esc(R.asof)}`, "더 높은 단계 기록이 있으면 아래 단계도 함께 셈(원 페이지 규칙)"])}`;
  } catch (e) { fail("aidc", "AI 데이터센터 기록", e); }
}

async function cardWater() {
  try {
    const [w, sla] = await Promise.all([get(`${MEGA}/data/feeds/water.json`), get(`${MEGA}/data/feed_sla.json`).catch(() => null)]);
    const items = (w.items || []).filter(i => i.latest && i.latest.rate != null);
    const short = n => n.replace("주암댐(본댐)", "주암 본댐").replace("주암댐(조절지)", "주암 조절지").replace("동복댐 (보도값)", "동복댐*");
    const tanks = items.map(i => { const manual = /보도값/.test(i.name);
      return `<div class="tank">${tank(i.latest.rate, {manual})}<div class="v">${fmt(i.latest.rate, 1)}%</div><div class="n">${esc(short(i.name))}</div><div class="d">${esc(i.latest.date.slice(5))}</div></div>`; }).join("");
    const y = w.rain && (w.rain.sums || []).find(s => s.days === 365);
    const m30 = w.rain && (w.rain.sums || []).find(s => s.days === 30);
    const lim = sla && sla.feeds.water ? sla.feeds.water.max_age_h : 30;
    body("water").innerHTML = `
      <div class="tanks">${tanks}</div>
      <p class="read">점선은 50%입니다. *동복댐은 공개 API가 없어 보도값(기준일 미기재)을 옮겼고, 원자료는 정보공개청구 중입니다.${y && y.prev_year_mm ? ` 광주 강수는 최근 1년 <b class="num">${fmt(y.mm)}mm</b>로 1년 전 같은 기간의 <b class="num">${Math.round(y.mm / y.prev_year_mm * 100)}%</b>입니다${m30 && m30.prev_year_mm ? `(최근 30일은 ${Math.round(m30.mm / m30.prev_year_mm * 100)}%)` : ""}.` : ""}</p>
      ${metaLine([`수집 ${kst(w.fetched_at)}`, hoursSince(w.fetched_at) > lim ? '<span class="stale">갱신 지연</span>' : "", "K-water·농어촌공사·기상청"])}`;
  } catch (e) { fail("water", "저수율 자료", e); }
}

// 진도 판정: 원 사이트 assets/pace.js와 같은 규칙(출발점→목표 직선 경로 대비 최근 공개치)
function paceJudge(it) {
  if (it.color === false || !it.target) return {s: "rec"};
  if (!it.base || !it.latest) return {s: "idle"};
  const D = 86400000, t0 = Date.parse(it.base.date), t1 = Date.parse(it.target.date), tl = Date.parse(it.latest.date);
  if (Date.parse(kstDate()) - tl > 365 * D) return {s: "idle"};
  const now = Date.parse(kstDate()), tc = now - tl > 182 * D ? now : tl;  // 6개월 넘은 공개치는 오늘 경로와 비교
  const path = it.base.v + (it.target.v - it.base.v) * Math.min(1, Math.max(0, (tc - t0) / (t1 - t0)));
  const r = path > 0 ? it.latest.v / path : 1;
  return {s: r >= 0.9 ? "ok" : r >= 0.5 ? "warn" : "bad", r};
}

async function cardPhysai() {
  try {
    const [pr, b, ph] = await Promise.all([get(`${MEGA}/data/feeds/procure.json`), get(`${MEGA}/data/feeds/bids.json`).catch(() => null), get(`${MEGA}/data/physai.json`).catch(() => null)]);
    const FL = {...LBL, idle: "미확정"};
    const pace = ph && ph.pace ? ph.pace.items.map(it => ({it, j: paceJudge(it)})).filter(x => x.j.s !== "rec") : [];
    const paceHtml = pace.length ? `<div class="tally" aria-label="목표 진도 판정">${pace.map(({it, j}) => `<a class="chip ${j.s}" href="${MEGA}/physai.html#pace" style="text-decoration:none" title="${esc(j.r != null ? "경로 대비 " + Math.round(j.r * 100) + "%" : "공개치 없음")}">${esc(it.label)} ${FL[j.s]}</a>`).join("")}</div>` : "";
    const S = (pr.summary || []).slice(-12);
    const thisMonth = kstDate().slice(0, 7);
    const yr = kstDate().slice(0, 4);
    const ytd = (pr.summary || []).filter(s => s.month.startsWith(yr));
    const nY = ytd.reduce((a, s) => a + s.n, 0), aY = ytd.reduce((a, s) => a + s.amount_eok, 0);
    let clause = "";
    if (b && b.summary) {
      const cur = b.summary || [];
      const read = cur.reduce((a, s) => a + (s.read || 0), 0), own = cur.reduce((a, s) => a + (s.data_own || 0), 0);
      if (read) clause = `입찰 첨부를 읽은 <b class="num">${fmt(read)}</b>건 가운데 데이터 소유·반출 제한 문구가 걸린 것은 <b class="num">${fmt(own)}</b>건(${(own / read * 100).toFixed(1)}%)입니다. 낱말로 찾은 값이라 운영자 검토 전입니다.`;
    }
    body("physai").innerHTML = `${paceHtml}
      <div><div class="big num">${fmt(nY)}건</div><div class="sub">${esc(yr)}년 나라장터 로봇 관련 계약 · ${fmt(aY, 0)}억원</div></div>
      ${bars(S.map(s => s.n), S.map(s => s.month.slice(2).replace("-", ".")), {unit: "건", partialLast: S.length && S[S.length - 1].month === thisMonth})}
      <p class="read">월별 계약 건수(계약명 낱말 기준)입니다. 이번 달 막대는 아직 집계 중입니다. ${clause}</p>
      ${metaLine([`계약 수집 ${kst(pr.fetched_at)}`, b ? `입찰 수집 ${kst(b.fetched_at)}` : ""])}`;
  } catch (e) { fail("physai", "피지컬 AI 수집 자료", e); }
}

async function cardEvents() {
  try {
    const E = await get(`${MEGA}/data/events.json`);
    const today = kstDate();
    const dday = d => Math.round((Date.parse(d + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 864e5);
    const recent = E.events.filter(e => e.status === "resolved" && dday(e.date) >= -10);
    const up = E.events.filter(e => e.status !== "resolved").sort((a, b) => a.date.localeCompare(b.date));
    const list = [...up.slice(0, 6), ...recent.slice(0, 2)];
    body("events").innerHTML = `<ul class="ev">${list.map(e => { const n = dday(e.date);
      const tag = e.status === "resolved" ? `<span class="dd past">결과</span>` : n > 0 ? `<span class="dd${n <= 14 ? " soon" : ""}">D-${n}</span>` : n === 0 ? `<span class="dd soon">오늘</span>` : `<span class="dd past">진행</span>`;
      const res = e.status === "resolved" && e.outcome ? `<br><span class="res">${esc(e.outcome.split(/(?<=[.다])\s/)[0])}</span>` : "";
      return `<li>${tag}<span class="date">${esc(e.date)}</span><span>${esc(e.title)}${res}</span></li>`; }).join("")}</ul>
      ${metaLine(["날짜·결과는 1차 자료로 확인한 것만 적습니다", `오늘(KST) ${esc(today)}`])}`;
  } catch (e) { fail("events", "이벤트 목록", e); }
}

async function cardHealth() {
  try {
    const sla = (await get(`${MEGA}/data/feed_sla.json`)).feeds;
    const keys = Object.keys(sla);
    const res = await Promise.all(keys.map(k => get(`${MEGA}/data/feeds/${k}.json`).then(f => [k, f]).catch(() => [k, null])));
    let nOk = 0;
    const items = res.map(([k, f]) => {
      const s = sla[k];
      let c = "ok", why = "정상";
      if (!f) { c = "bad"; why = "읽지 못함"; }
      else if (!f.ok || f.last_error) { c = "bad"; why = "최근 수집 실패"; }
      else if (hoursSince(f.fetched_at) > s.max_age_h) { c = "warn"; why = "갱신 지연"; }
      else if (s.max_errors != null && (f.error_count || 0) > s.max_errors) { c = "warn"; why = `조회 오류 ${f.error_count}건`; }
      if (c === "ok") nOk++;
      return `<span title="${esc(s.label)} · ${esc(why)} · 마지막 수집 ${esc(f ? kst(f.fetched_at) : "–")} · 허용 ${s.max_age_h}시간"><i class="dot ${c}"></i>${esc(s.label)}</span>`;
    });
    body("health").innerHTML = `
      <div><div class="big num">${nOk}/${keys.length}</div><div class="sub">메가프로젝트 수집 자료가 정해진 주기 안에 갱신됨</div></div>
      <div class="feeds">${items.join("")}</div>
      <p class="read">기준은 자료마다 정한 허용 지연입니다(뉴스 6시간, 용수 30시간, 월간 통계 35일 등). 이상이 생기면 운영자에게 경보가 갑니다. 메모리 국면·설비투자 카드는 각 카드 아래에 갱신 시점을 적었습니다.</p>`;
  } catch (e) { fail("health", "수집 상태", e); }
}

function pwBar(segs, need) {
  // segs: [{mw, kind}] kind: live|build|confirm|agree|plan, hatch=true면 보도 1곳(C). 필요량 대비 선형.
  const W = 300, H = 22, sc = W / Math.max(need, segs.reduce((a, s) => a + s.mw, 0), 1);
  const F = {live: ["var(--ok)", 1], build: ["var(--ok)", 0.55], confirm: ["var(--accent)", 1], agree: ["var(--accent)", 0.5], plan: ["var(--accent)", 0.18]};
  let x = 0, r = "";
  segs.forEach(s => { if (!s.mw) return; const [c, op] = F[s.kind];
    r += `<rect x="${(x * sc).toFixed(1)}" y="3" width="${Math.max(1, s.mw * sc).toFixed(1)}" height="16" ${s.hatch ? `fill="url(#pwh-${s.kind})"` : `fill="${c}" fill-opacity="${op}"`} stroke="var(--surface)"/>`; x += s.mw; });
  const pats = Object.entries(F).map(([k, [c]]) => `<pattern id="pwh-${k}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--surface)"/><line x1="0" y1="0" x2="0" y2="5" stroke="${c}" stroke-width="2.5"/></pattern>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none" aria-hidden="true"><defs>${pats}</defs><rect x="0.5" y="3" width="${W - 1}" height="16" rx="3" fill="var(--sunk)" stroke="var(--line)" stroke-dasharray="3 3"/>${r}</svg>`;
}
const gwf = mw => mw >= 1000 ? (mw / 1000).toFixed(mw % 1000 ? 1 : 0) + "GW" : Math.round(mw) + "MW";
async function cardLedger() {
  try {
    const L = await get(`${MEGA}/v2/data/milestones.json`);
    const S = L.summary;
    // 90일 안 목표일은 날짜에 따라 바뀌므로 여기서 센다(기간 표기의 끝 날짜 기준)
    const end = s => { const [y, m, d] = s.split("-").map(Number); return d ? Date.UTC(y, m - 1, d) : m ? Date.UTC(y, m, 0) : Date.UTC(y, 11, 31); };
    const now = Date.parse(kstDate());
    const soon = L.milestones.filter(m => m.target && m.status !== "complete" && end(m.target.date) >= now && end(m.target.date) - now <= 90 * 86400000).length;
    const overdue = L.milestones.filter(m => m.target && m.status !== "complete" && end(m.target.date) < now).length;
    const it = [[S.conflicts, "선행 일정과 어긋남", S.conflicts ? "bad" : ""], [overdue, "목표일 지남·미완료", overdue ? "bad" : ""], [S.unbacked, "앞당겼지만 집행 근거 없음", "warn"],
      [S.later, "기준보다 늦어짐", S.later ? "bad" : ""], [S.earlier, "기준보다 앞당겨짐", ""], [S.open, "목표일 미공개·출처 상충", "idle"], [soon, "90일 안 목표일", ""], [S.complete + "/" + S.milestones, "완료/전체", ""]];
    body("ledger").innerHTML = `<div class="lg-strip">${it.map(([v, l, c]) => `<span class="${c}"><b class="num">${v}</b>${esc(l)}</span>`).join("")}</div>
      <p class="read">${esc(L.sites.map(s => s.name).join(", "))}의 이정표를 처음 약속한 날짜(2026-06-29 기준)와 함께 기록한 원장입니다.</p>
      ${metaLine([`원장 기준일 ${esc(L.asof)}`, "v2 시험 화면"])}`;
  } catch (e) { fail("ledger", "일정 원장", e); }
}

async function cardPower() {
  try {
    const [P, R] = await Promise.all([get(`${MEGA}/data/power.json`), get(`${MEGA}/data/aidc_registry.json`)]);
    const strong = g => g === "A" || g === "B";
    const ORDER = ["need", "plan", "agree", "confirm", "build", "live"];
    const segsOf = units => {
      const out = [];
      ["live", "build", "confirm", "agree"].forEach(k => [false, true].forEach(h => out.push({kind: k, hatch: h, mw: units.filter(u => u.level === k && strong(u.grade) === !h).reduce((a, u) => a + u.mw, 0)})));
      out.push({kind: "plan", hatch: false, mw: units.filter(u => u.level === "plan").reduce((a, u) => a + u.mw, 0)});
      return out;
    };
    const geRec = (units, lv) => units.filter(u => ORDER.indexOf(u.level) >= ORDER.indexOf(lv) && strong(u.grade)).reduce((a, u) => a + u.mw, 0);
    const S = P.sectors.swfab;
    const unitsOf = S2 => S2.units.map(u => ({mw: u.mw, level: u.level, grade: u.level_grade}));
    const sw = unitsOf(S);
    const YS = P.sectors.yongin_ss, YK = P.sectors.yongin_sk;
    const A = P.sectors.aidc, ov = A.overrides || [];
    const ai = [];
    R.projects.filter(p => String(p.program || "").startsWith("1단계")).forEach(p => p.units.forEach(u => {
      if (!u.mw) return;
      const pw = u.stages && u.stages.power || {};
      const o = ov.find(x => x.project === p.id && x.unit === u.label);
      ai.push(o ? {mw: o.mw || u.mw, level: o.level, grade: o.grade} : {mw: u.mw, level: pw.s === "rec" ? "confirm" : pw.s === "claim" ? "plan" : "need", grade: pw.s === "rec" ? "B" : "C"});
    }));
    const K = (P.kepco_margin && P.kepco_margin.rows) || [];
    const kTxt = sec => { const r = K.filter(x => x.sector === sec); return r.length ? ` · 한전 공개 변전소 여유(참고) ${r.map(x => `${esc(x.substation)} <b>${x.margin_mw.toLocaleString("ko-KR")}MW</b>`).join(", ")}` : ""; };
    const row = (name, sub, units, need, link, sec) => {
      const pc = v => (v / need * 100).toFixed(v && v / need < 0.1 ? 1 : 0) + "%";
      const ag = geRec(units, "agree"), cf = geRec(units, "confirm"), bd = geRec(units, "build"), lv = geRec(units, "live");
      return `<div class="pw-row"><div class="lab"><b><a href="${link}" style="color:inherit">${esc(name)}</a></b><span>필요 ${gwf(need)} · ${esc(sub)}</span></div>
        <div>${pwBar(segsOf(units), need)}</div>
        <div class="nums">공급 확정 <b>${gwf(cf)} · ${pc(cf)}</b> · 설비 착공 <b>${gwf(bd)}</b> · 공급 완료 <b>${gwf(lv)}</b> · 협약 이상 ${gwf(ag)}${kTxt(sec)}</div></div>`;
    };
    body("power").innerHTML = `
      ${row("서남권 메가팹", "팹 4기", sw, S.need_mw, MEGA + "/swfab.html#power-ready", "swfab")}
      ${YS ? row("용인 국가산단", "삼성 팹 6기(보도 추산)", unitsOf(YS), YS.need_mw, MEGA + "/yongin-ss.html#power-ready", "yongin_ss") : ""}
      ${YK ? row("용인 일반산단", "SK 팹 4기", unitsOf(YK), YK.need_mw, MEGA + "/yongin-sk.html#power-ready", "yongin_sk") : ""}
      ${row("AI 데이터센터", "1단계 목표", ai, A.need_mw, MEGA + "/aidc.html#power-ready", "aidc")}
      <div class="pw-row"><div class="lab"><b><a href="${MEGA}/physai.html#power-ready" style="color:inherit">피지컬 AI</a></b><span>필요량 미공개</span></div><div class="read" style="font-size:12.5px">거점별 전력 수요가 발표되지 않아 막대를 그리지 않습니다. 새만금은 송전망 문제로 데이터센터가 멈춘 전례가 있어 감시 중입니다.</div></div>
      <p class="pw-leg"><span><i style="background:var(--ok)"></i>공급 완료</span><span><i style="background:var(--ok);opacity:.55"></i>설비 착공</span><span><i style="background:var(--accent)"></i>공급 확정</span><span><i style="background:var(--accent);opacity:.5"></i>공급 협약</span><span><i style="background:repeating-linear-gradient(45deg,var(--accent) 0 2px,var(--surface) 2px 4px)"></i>보도 1곳뿐</span><span><i style="background:var(--accent);opacity:.18"></i>공급 계획</span><span><i style="background:var(--sunk);border:1px dashed var(--line)"></i>필요량만</span></p>
      <p class="read">공개된 이정표(협약 → 확정 → 착공 → 완료) 기준의 확보 정도이며, 물리적 부족량이 아닙니다. 한전 변전소 여유는 한전이 공개한 참고자료(345kV 기준)입니다.</p>
      ${metaLine([`기준일 ${esc(P.asof)}`, `AIDC 등록부 ${esc(R.asof)}`])}`;
  } catch (e) { fail("power", "전력 준비성 자료", e); }
}

(async function main() {
  $("#loaded").textContent = `이 화면을 연 시각 ${new Date().toLocaleString("ko-KR", {timeZone: "Asia/Seoul"})} (KST). 자료는 세 사이트에서 직접 읽습니다.`;
  await Promise.all([cardSwfab(), cardMem(), cardCapex(), cardAidc(), cardWater(), cardPhysai(), cardEvents(), cardHealth(), cardPower(), cardLedger()]);
})();
