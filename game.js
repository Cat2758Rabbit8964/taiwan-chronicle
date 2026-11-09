'use strict';
const app = document.getElementById('app');
const CAREER_ORDER = ['law', 'pol', 'med', 'art', 'edu', 'act', 'biz'];
const PRE_SITS = ['A', 'B', 'C', 'D'];   // 最後一章 L 固定放在最後問
const CATS = ['R', 'E', 'S', 'X', 'A'];
const LABEL = 'ABCDE';
const MIN_PEOPLE = 6;      // 一個時間帶至少要有幾位資格人物才會列出
const MIN_PER_CAREER = 2;
const KEEP = 2;            // 選擇之後至少要剩幾位,否則故事會轉折
const MAX_PRE = 3;         // 最後一章之前最多問幾個情境題
const MIN_PRE = 2;         // 最後一章之前至少問幾個(加上最後一章,至少三個情境題)
let data = null;
let exam = null;
let st = null; // { birth, bands, band, pool, career, asked, usedSit }

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
}
function show(...nodes) { app.replaceChildren(...nodes.filter(Boolean)); window.scrollTo(0, 0); }
function hash(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// 同一個生日永遠得到同一個順序
function shuffled(list, salt) { return [...list].sort((a, b) => hash(salt + a) - hash(salt + b) || (a < b ? -1 : 1)); }

// 資格人物:逝世日不晚於使用者生日
function eligible(birth) { return data.people.filter((p) => p.died <= birth); }
function careerCount(pool) {
  const n = {};
  for (const p of pool) for (const c of p.c) n[c] = (n[c] || 0) + 1;
  return n;
}
function careersIn(pool) { const n = careerCount(pool); return CAREER_ORDER.filter((c) => n[c] >= MIN_PER_CAREER); }
function qualifiedBands(birth) {
  const pool = eligible(birth);
  return data.bands.filter((b) => {
    const inBand = pool.filter((p) => p.band === b.id && p.acts.L);
    return inBand.length >= MIN_PEOPLE && careersIn(inBand).length >= 3;
  });
}
function agoLabel(b) {
  const now = new Date().getFullYear();
  const lo = Math.floor((now - b.to) / 5) * 5, hi = Math.ceil((now - b.from) / 5) * 5;
  return lo < 5 ? `不到 ${hi} 年前` : `約 ${lo} 到 ${hi} 年前`;
}

/* ───── 生日:三個下拉選單 ───── */
function daysIn(y, m) { return new Date(y, m, 0).getDate(); }
function birthdayPage() {
  const now = new Date();
  const ySel = el('select', { id: 'by', 'aria-label': '年' }, el('option', { value: '' }, '年'));
  for (let y = now.getFullYear(); y >= 1900; y--) ySel.append(el('option', { value: y }, String(y)));
  const mSel = el('select', { id: 'bm', 'aria-label': '月' }, el('option', { value: '' }, '月'));
  for (let m = 1; m <= 12; m++) mSel.append(el('option', { value: m }, `${m} 月`));
  const dSel = el('select', { id: 'bd', 'aria-label': '日' }, el('option', { value: '' }, '日'));
  const fillDays = () => {
    const keep = dSel.value;
    const y = Number(ySel.value) || 2000, m = Number(mSel.value) || 1;
    dSel.replaceChildren(el('option', { value: '' }, '日'));
    for (let d = 1; d <= daysIn(y, m); d++) dSel.append(el('option', { value: d }, `${d} 日`));
    if (keep && Number(keep) <= daysIn(y, m)) dSel.value = keep;
  };
  fillDays();
  ySel.addEventListener('change', fillDays);
  mSel.addEventListener('change', fillDays);
  const msg = el('p', { class: 'err', role: 'alert' });
  const form = el('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    if (!ySel.value || !mSel.value || !dSel.value) { msg.textContent = '請選擇完整的年、月、日。'; return; }
    const pad = (n) => String(n).padStart(2, '0');
    const birth = `${ySel.value}-${pad(mSel.value)}-${pad(dSel.value)}`;
    if (birth > now.toISOString().slice(0, 10)) { msg.textContent = '生日不能晚於今天。'; return; }
    begin(birth, msg);
  } },
    el('div', {}, el('label', {}, '你的出生年月日'), el('div', { class: 'dates' }, ySel, mSel, dSel)),
    el('button', { class: 'btn', type: 'submit' }, '出發'), msg);
  show(
    el('h1', {}, '尋找你上輩子的樣子'),
    el('p', { class: 'lead' }, '選擇生日,系統會把你帶回過去的某個時間。故事會替你安排一連串的抉擇;你走的每一步,最後都會對回一位真實存在過的人,在歷史上真正做過的事。有時命運不照你的意思走,那也會被寫進故事裡。'),
    el('div', { class: 'card' }, form),
    typeof Hall !== 'undefined' && Hall.on ? el('div', { class: 'row' }, el('button', { class: 'btn ghost', type: 'button', onclick: () => Hall.page(null, birthdayPage) }, '芳名錄')) : null,
    accountBar());
}

function begin(birth, msg, round = 0, usedBands = []) {
  let ok = qualifiedBands(birth);
  if (!ok.length) {
    if (msg) msg.textContent = '這個生日太早了,資料庫裡沒有足夠在你出生前就已過世的人物。';
    return;
  }
  const fresh = ok.filter((b) => !usedBands.includes(b.id));
  if (fresh.length) ok = fresh;   // 「再玩一次」盡量換一個時間帶
  // 依各時間帶的資格人物數加權抽籤,每位人物出場的機會才會相近;同一個生日永遠得到同一個結果
  const w = ok.map((b) => eligible(birth).filter((p) => p.band === b.id && p.acts.L).length);
  const total = w.reduce((x, y) => x + y, 0);
  let r = hash(birth + 'b' + round) % total, i = 0;
  while (r >= w[i]) { r -= w[i]; i++; }
  st = { birth, round, usedBands: [...usedBands, ok[i].id], band: null, pool: [], career: null, asked: [], usedSit: [] };
  const chosen = ok[i];
  room(() => chooseBand(chosen));
}

function chooseBand(b) {
  st.band = b;
  st.pool = eligible(st.birth).filter((p) => p.band === b.id && p.acts.L);
  st.career = null; st.asked = []; st.usedSit = [];
  askCareer();
}

/* ───── 故事轉折 ───── */
function interlude(text, then) {
  show(
    el('p', { class: 'persona' }, '命運的轉折'),
    el('h2', {}, '然而……'),
    el('p', { class: 'scene' }, text),
    el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: then }, '繼續')));
}
function ask(kicker, title, scene, opts) {
  show(
    el('p', { class: 'persona' }, kicker),
    el('h2', {}, title),
    scene ? el('p', { class: 'scene' }, scene) : null,
    el('div', { class: 'stack' }, opts.map((o, i) => el('button', { class: 'opt', type: 'button', onclick: o.pick }, el('b', {}, LABEL[i] + '.'), o.t))));
}
// 依權重 wt(平衡用,預設 1)做固定的加權抽籤:同一個 salt 永遠抽到同一個
function weightedPick(list, salt) {
  const total = list.reduce((a, p) => a + (p.wt ?? 1), 0);
  let r = ((hash(salt) % 1000003) / 1000003) * total;
  for (const p of list) { r -= p.wt ?? 1; if (r < 0) return p; }
  return list[list.length - 1];
}
// 轉折時,優先把使用者帶往「目前出場機會較少的人」所在的選項(用 wt 加總當權重)
function pickAltW(options, weightOf, salt) {
  if (!options.length) return null;
  const total = options.reduce((a, o) => a + weightOf(o), 0);
  let r = ((hash(salt) % 1000003) / 1000003) * total;
  for (const o of options) { r -= weightOf(o); if (r < 0) return o; }
  return options[options.length - 1];
}
function pickAlt(options, salt) { return options.length ? shuffled(options, st.birth + salt)[0] : null; }

/* ───── 志向:由考試成績決定 ───── */
const careerName = (c) => data.q1.careers[c].split(':')[0];
function askCareer() {
  Exam.run(exam, careerName, (res) => chooseCareer(res.career, res));
}
function chooseCareer(c, res) {
  // 志向只影響故事與配對優先順序,不限制候選人;但該志向在這個時間帶人太少時,故事仍會轉折
  const count = careerCount(st.pool);
  if ((count[c] || 0) >= KEEP) return applyCareer(c, c, false, res);
  const alt = pickAlt(CAREER_ORDER.filter((x) => x !== c && (count[x] || 0) >= KEEP), 'ca' + c);
  if (!alt) return applyCareer(c, c, false, res);
  const T = data.twist.career;
  interlude(`時機不對。${T[c]}之路比你預期的更難走,幾番波折之後,你最後走向了${T[alt]}之路。`, () => applyCareer(c, alt, true, res));
}
function applyCareer(chosen, eff, twisted, res) {
  st.career = eff;
  st.asked.push({ kind: 'career', chosen, eff, twisted, res, text: careerName(eff), chosenText: careerName(chosen) });
  next();
}

/* ───── 情境題:故事式,選項分五類 ───── */
function docs(pool, sit) { return pool.filter((p) => p.acts[sit]); }
function catCount(pool, sit) {
  const n = {};
  for (const p of docs(pool, sit)) for (const c of new Set(p.acts[sit].map((a) => a.c))) n[c] = (n[c] || 0) + 1;
  return n;
}
function feasible(pool, sit, k = KEEP) { return Object.values(catCount(pool, sit)).some((n) => n >= k); }
const byCat = (pool, sit, c) => pool.filter((p) => p.acts[sit] && p.acts[sit].some((a) => a.c === c));
// 這條路走得完嗎?還需要 preNeed 個前置情境題,最後再問「最後一章」。
// 第一個前置情境之後至少要剩 KEEP 位;之後的情境與最後一章只要還剩 1 位就算數(這樣每位人物都有機會走到結果)
const keepFor = (nPreAsked) => (nPreAsked === 0 ? KEEP : 1);
function viable(pool, used, preNeed) {
  if (pool.length < 1) return false;
  if (preNeed === 0) return feasible(pool, 'L', 1);
  return PRE_SITS.some((s) => !used.includes(s) && CATS.some((c) => {
    const nx = byCat(pool, s, c);
    return nx.length >= keepFor(used.length) && viable(nx, [...used, s], preNeed - 1);
  }));
}
const preAsked = () => st.asked.filter((a) => a.kind === 'sit' && a.sit !== 'L').length;
const preNeedNow = () => Math.max(0, MIN_PRE - preAsked());

function next() {
  const nPre = st.asked.filter((a) => a.kind === 'sit' && a.sit !== 'L').length;
  const hasL = st.asked.some((a) => a.sit === 'L');
  if (!hasL && nPre < MAX_PRE && st.pool.length > KEEP) {
    const need = Math.max(0, preNeedNow() - 1);
    const free = PRE_SITS.filter((s) => !st.usedSit.includes(s) && CATS.some((c) => {
      const nx = byCat(st.pool, s, c);
      return nx.length >= keepFor(st.usedSit.length) && viable(nx, [...st.usedSit, s], need);
    }));
    if (free.length) {
      // 以一位「錨點人物」為準,先問他/她有紀錄的情境;前兩題若找不到,就改問其他人有紀錄的情境
      const anchor = weightedPick(shuffled(st.pool.map((p) => p.id), st.birth + 'o' + nPre).map((id) => st.pool.find((x) => x.id === id)), st.birth + 'a' + nPre);
      const mine = free.filter((s) => anchor.acts[s]);
      const pick = mine.length ? mine : (nPre < MIN_PRE ? free : []);
      if (pick.length) return askSituation(shuffled(pick, st.birth + 's' + nPre)[0]);
    }
  }
  if (!hasL && feasible(st.pool, 'L', 1)) return askSituation('L');
  askPlace();
}

// 出生地題:只在「至少兩種類型各有兩位以上」時才問,而且只列這些類型
function askPlace() {
  if (st.asked.some((a) => a.kind === 'place')) return result();
  const n = {};
  for (const p of st.pool) if (p.bp) n[p.bp] = (n[p.bp] || 0) + 1;
  const types = data.bp.opts.filter((o) => (n[o.b] || 0) >= KEEP);
  // 只在剩下的人全都有出生地類型時才問,避免把資料不明的人無聲地排除
  if (types.length < 2 || !st.pool.every((p) => p.bp)) return result();
  ask('最後一個問題', data.bp.text, '', types.map((o) => ({ t: o.t, pick: () => {
    st.pool = st.pool.filter((p) => p.bp === o.b);
    st.asked.push({ kind: 'place', text: o.t });
    result();
  } })));
}

function askSituation(sit) {
  const def = data.sits[sit];
  const n = st.asked.filter((a) => a.kind === 'sit').length + 1;
  // 依稀的最後一刻:沒有人對應的記憶片段直接拿掉,不提供轉折
  const cc = catCount(st.pool, sit);
  const cats = sit === 'L' ? CATS.filter((c) => (cc[c] || 0) > 0) : CATS;
  ask(`情境 ${n}`, def.title, def.text, cats.map((c) => ({ t: def[c], pick: () => chooseCat(sit, c) })));
}
function chooseCat(sit, c) {
  const isL = sit === 'L';
  const need = isL ? 0 : Math.max(0, preNeedNow() - 1);
  const ok = (x) => {
    const nx = byCat(st.pool, sit, x);
    return nx.length >= (isL ? 1 : keepFor(st.usedSit.length)) && (isL || viable(nx, [...st.usedSit, sit], need));
  };
  if (ok(c)) return applyCat(sit, c, c, false);
  const alt = pickAltW(CATS.filter((x) => x !== c && ok(x)), (x) => byCat(st.pool, sit, x).reduce((a, p) => a + (p.wt ?? 1), 0), st.birth + 'sa' + sit + c);
  if (!alt) { // 找不到可行的選項:取剩最多的,再沒有就跳過這題
    const count = catCount(st.pool, sit);
    const best = CATS.filter((x) => (count[x] || 0) > 0).sort((a, b) => count[b] - count[a])[0];
    if (!best) { st.usedSit.push(sit); st.asked.push({ kind: 'skip', sit }); return next(); }
    return applyCat(sit, c, best, best !== c);
  }
  const def = data.sits[sit];
  interlude(isL
    ? `然而記憶是模糊的。你以為自己記得的是「${def[c]}」,浮上心頭的卻是「${def[alt]}」。`
    : `事與願違。你本想「${def[c]}」,局勢卻不容許;幾番周折之後,你走上了另一條路:「${def[alt]}」。`,
  () => applyCat(sit, c, alt, true));
}
function applyCat(sit, chosen, eff, twisted) {
  const def = data.sits[sit];
  st.usedSit.push(sit);
  st.pool = st.pool.filter((p) => p.acts[sit] && p.acts[sit].some((a) => a.c === eff));
  st.asked.push({ kind: 'sit', sit, chosen, eff, twisted, title: def.title, scene: def.text, chosenText: def[chosen], text: def[eff] });
  next();
}

/* ───── 結果:把使用者實際走上的每一步,對回人物真正做過的事 ───── */
function result() {
  const order = shuffled(st.pool.map((p) => p.id), st.birth + 'r' + st.round);
  const byId = (id) => st.pool.find((x) => x.id === id);
  // 志向相符的人優先;同組內依權重固定抽一位,其餘依生日固定洗牌
  const tier = (q) => (q.c.includes(st.career) ? 1 : 0);
  const top = Math.max(...st.pool.map(tier));
  const p = weightedPick(order.map(byId).filter((q) => tier(q) === top), st.birth + 'f' + st.round);
  const others = order.map(byId).filter((q) => q !== p).sort((x, y) => tier(y) - tier(x)).slice(0, 3);
  const b = st.band;

  const chain = st.asked.filter((a) => a.kind !== 'skip').map((a) => {
    const rows = [];
    const isL = a.kind === 'sit' && a.sit === 'L';
    if (a.kind === 'sit') rows.push(el('div', { class: 'q' }, a.title));
    if (a.twisted) {
      rows.push(el('div', { class: 'you off' }, isL ? '你原本以為記得的是:' : a.kind === 'career' ? '考試成績原本指向:' : '你原本選了:', a.chosenText));
      rows.push(el('div', { class: 'twist' }, isL ? '記憶模糊了,浮上來的是:' : '故事轉折了,你實際走上的是:'));
    }
    if (a.kind === 'career' && a.res) {
      const n = { lang: '語文', math: '數學', sci: '自然', soc: '社會' };
      rows.push(el('div', { class: 'q' }, '命運的考場'));
      rows.push(el('div', { class: 'you' }, `考試成績:${Object.entries(a.res.scores).map(([k, v]) => `${n[k]} ${v}`).join('、')}`));
    }
    rows.push(el('div', { class: 'you' }, a.twisted ? a.text : (isL ? `你依稀記得:${a.text}` : a.kind === 'career' ? `志向:${a.text}` : `你選了:${a.text}`)));
    if (a.kind === 'career') rows.push(el('div', { class: 'real' }, p.c.includes(a.eff) ? `他/她的職業:${p.job}` : `他/她的職業是${p.job},不是這條志向,但他/她走過和你一樣的情境選擇`));
    else if (a.kind === 'place') rows.push(el('div', { class: 'real' }, '他/她出生地的類型與此相符(這是本遊戲自行的分類,不是史實)'));
    else p.acts[a.sit].filter((x) => x.c === a.eff).forEach((x) => rows.push(el('div', { class: 'real' }, isL ? '他/她真正的結局:' : '他/她真正做的:', x.ev)));
    return el('li', {}, rows);
  });
  const sources = [el('a', { href: p.ref, target: '_blank', rel: 'noopener' }, `${p.src}「${p.name}」`),
    ...(p.refs || []).map((r) => el('a', { href: r.url, target: '_blank', rel: 'noopener' }, `${r.label}`))];
  const sourceLine = el('p', { class: 'persona' }, '資料出處:', sources.flatMap((x, i) => (i ? [' · ', x] : [x])));
  // 最後一頁底下:與這位人物同一時期、因政治事件而離世的人(被處決、遇害、自焚、死於拘禁等),附簡介與連結
  const WINDOW = 8, MIN_SHOWN = 3, MAX_SHOWN = 10;
  const gap = (q) => Math.abs(q.ly - p.ly);
  const pool = data.people.filter((q) => q.id !== p.id && q.acts.L && q.acts.L[0].c === 'R').sort((x, y) => gap(x) - gap(y) || (x.died < y.died ? -1 : 1));
  const near = pool.filter((q) => gap(q) <= WINDOW);
  const fallen = (near.length >= MIN_SHOWN ? near : pool.slice(0, MIN_SHOWN)).slice(0, MAX_SHOWN).sort((x, y) => (x.died < y.died ? -1 : 1));
  const brief = (q) => `${q.fate.split('。')[0]}。`;
  const span = fallen.length ? `${fallen[0].ly} 至 ${fallen[fallen.length - 1].ly} 年間` : '';
  const memorial = fallen.length ? el('details', { class: 'sec memorial', open: '' },
    el('summary', {}, `同一時期,也因政治事件而離世的人(${span},${fallen.length} 位)`),
    el('p', { class: 'persona' }, '只列與這位人物離世時間相近、且有可查證記載的人,並不代表所有受難者。連結可以進一步閱讀。'),
    el('ul', { class: 'fallen' }, fallen.map((q) => el('li', {},
      el('b', {}, q.name), ` (${q.life} · ${q.job})`, el('div', {}, brief(q)),
      el('div', { class: 'links' }, el('a', { href: q.ref, target: '_blank', rel: 'noopener' }, q.src),
        ...(q.refs || []).flatMap((r) => [' · ', el('a', { href: r.url, target: '_blank', rel: 'noopener' }, r.label.replace(/「.*」/, ''))])))))) : null;
  // 主要人物若不是因政治事件離世,最後一頁底下放「與他/她有關聯的人」(條目互相提到,或同屬一個事件/團體)
  const political = (q) => (q.acts.L && q.acts.L[0].c === 'R') || q.id === 'chen-yi';
  const byIdAll = (id) => data.people.find((x) => x.id === id);
  const relMap = new Map();
  (p.rel || []).forEach((r) => relMap.set(r.id, r.why));
  data.groups.filter((g) => g.members.includes(p.id)).sort((x, y) => x.members.length - y.members.length)
    .forEach((g) => g.members.slice().sort((a, b) => Math.abs(byIdAll(a).ly - p.ly) - Math.abs(byIdAll(b).ly - p.ly))
      .forEach((id) => { if (id !== p.id && !relMap.has(id)) relMap.set(id, `同屬「${g.label}」`); }));
  const relList = [...relMap.entries()].slice(0, 6);
  const relatedBox = relList.length ? el('details', { class: 'sec memorial', open: '' },
    el('summary', {}, `與${p.name}有關聯的人(${relList.length} 位)`),
    el('p', { class: 'persona' }, '依資料出處裡彼此提到的紀錄,或同屬一個事件、團體挑選;連結可以進一步閱讀。'),
    el('ul', { class: 'fallen' }, relList.map(([id, why]) => { const q = byIdAll(id); return el('li', {},
      el('b', {}, q.name), ` (${q.life} · ${q.job})`, el('div', { class: 'persona' }, why), el('div', {}, brief(q)),
      el('div', { class: 'links' }, el('a', { href: q.ref, target: '_blank', rel: 'noopener' }, q.src),
        ...(q.refs || []).flatMap((r) => [' · ', el('a', { href: r.url, target: '_blank', rel: 'noopener' }, r.label.replace(/「.*」/, ''))]))); }))) : null;
  const bottom = political(p) ? memorial : relatedBox;
  const otherLine = (q) => el('div', {}, el('a', { href: q.ref, target: '_blank', rel: 'noopener' }, q.name), `(${q.life},${q.job})`);

  let outcome = null, saveMsg = '', saveEl = null;
  const render = () => show(
    el('p', { class: 'persona' }, `你回到的是 ${b.to >= 2026 ? `${b.from} 年以後` : `${b.from} 到 ${b.to} 年前後`} · 你的上輩子是`),
    el('div', { class: 'card' },
      el('div', { class: 'big' }, p.name),
      el('p', {}, el('span', { class: 'tag' }, p.country), el('span', { class: 'tag' }, p.life), el('span', { class: 'tag' }, p.job)),
      el('div', { class: 'sec' }, el('h3', {}, '你走過的路,與他/她實際做過的事'), el('ol', { class: 'chain' }, chain)),
      el('div', { class: 'sec' }, el('h3', {}, '他/她做過的事'), el('p', {}, p.story)),
      el('div', { class: 'sec' }, el('h3', {}, '後來的遭遇'), el('p', {}, p.fate)),
      p.note ? el('div', { class: 'sec' }, el('h3', {}, '資料註記'), el('p', { class: 'note' }, p.note)) : null,
      sourceLine),
    others.length ? el('div', { class: 'sec' }, el('h3', {}, '走過同一條路的其他人'), el('div', { class: 'also' }, others.map(otherLine))) : null,
    bottom,
    el('div', { class: 'row' },
      el('a', { class: 'btn', href: `index.html#y=${p.ly}`, style: 'text-decoration:none' }, `到台灣事件簿,看 ${p.ly} 年前後的台灣`),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => begin(st.birth, null, st.round + 1, st.usedBands) }, '再玩一次(換一個時間)'),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => treasure(render) }, '查看尋寶狀態'),
      el('button', { class: 'btn ghost', type: 'button', onclick: birthdayPage }, '重新開始')),
    (saveEl = el('p', { class: 'persona' }, saveMsg)),
    el('p', { class: 'persona sec' }, '這是娛樂用的配對,不代表你「真的」是誰。故事的轉折是為了讓你走完全程而設計的虛構情節;「他/她真正做的」都取自出處條目已載的事實,條目沒寫的就不列。歷史人物的選擇受限於當時的處境,我們無法以今天的角度簡單評斷。'));
  const reveal = () => {
    render();
    if (outcome) return;
    outcome = collect(p); announce(p, outcome);
    persist().then((m) => { saveMsg = m; if (saveEl) saveEl.textContent = m; });
  };
  story(p, reveal);
}

/* ───── 登入、存檔、房間與尋寶 ───── */
const KEYS = [
  { k: 'y', name: '黃色', label: '日治時期台灣人', need: 5, cls: 'ky' },
  { k: 'b', name: '淺藍色', label: '戰後遭國民政府迫害的政治受難者', need: 10, cls: 'kb' },
  { k: 'p', name: '粉紅色', label: '女性人物', need: 5, cls: 'kp' },
];
let acct = null;   // { id|null(訪客), nick, got:[人物 id], hist:[{id,t}] }
const personById = (id) => data.people.find((q) => q.id === id);
const keyHave = (K) => acct.got.map(personById).filter((q) => q && (q.k || '').includes(K.k));
function setAcct(a) { acct = a; if (typeof Hall !== 'undefined') Hall.nick = a && a.id ? a.nick : null; if (a && a.id) Save.remember(a.id); }

function modal(title, lines, onClose) {
  const back = el('div', { class: 'modal-back' });
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const ok = el('button', { class: 'btn', type: 'button', onclick: close }, '好');
  back.append(el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, el('h2', {}, title), ...lines.map((x) => (typeof x === 'string' ? el('p', {}, x) : x)), el('div', { class: 'row' }, ok)));
  document.body.append(back); document.addEventListener('keydown', onKey); ok.focus();
}

function start() {
  const msg = el('p', { class: 'err', role: 'alert' });
  const idIn = el('input', { type: 'text', class: 'txt', maxlength: '12', autocomplete: 'off', 'aria-label': '遊戲 ID', placeholder: 'XXXX-XXXX' });
  idIn.value = Save.on ? (Save.remembered() ? Save.fmt(Save.remembered()) : '') : '';
  const nickIn = el('input', { type: 'text', class: 'txt', maxlength: '12', autocomplete: 'off', 'aria-label': '綽號(最多 12 字)', placeholder: '你的綽號' });
  const login = el('button', { class: 'btn', type: 'button', onclick: async () => {
    const id = Save.norm(idIn.value); msg.textContent = '';
    if (!Save.valid(id)) { msg.textContent = '遊戲 ID 是 8 個英數字(例如 AB3D-K7MQ)。'; return; }
    login.disabled = true;
    try { const rec = await Save.load(id); if (!rec) { msg.textContent = '找不到這個遊戲 ID,請確認有沒有抄錯。'; login.disabled = false; return; } setAcct({ id, ...rec }); welcome(); }
    catch (e) { msg.textContent = '連線失敗,請稍後再試。'; login.disabled = false; }
  } }, '登入');
  const create = el('button', { class: 'btn', type: 'button', onclick: async () => {
    const nick = nickIn.value.trim(); msg.textContent = '';
    if (!nick) { msg.textContent = '請先填綽號,芳名錄會用到。'; return; }
    create.disabled = true;
    try { const id = await Save.create(nick); setAcct({ id, nick, got: [], hist: [] }); showNewId(); }
    catch (e) { msg.textContent = '建立失敗,請稍後再試。'; create.disabled = false; }
  } }, '創建新的遊戲 ID');
  const guest = () => { setAcct({ id: null, nick: '', got: [], hist: [] }); birthdayPage(); };
  show(
    el('a', { class: 'corner', href: 'index.html' }, '前往台灣事件簿'),
    el('h1', {}, '尋找你上輩子的樣子'),
    el('p', { class: 'lead' }, '請輸入或創建您的遊戲 ID 以及綽號(芳名錄會用到)。遊戲 ID 能讓你下次接著收集。'),
    Save.on ? el('div', { class: 'stack' },
      el('div', { class: 'card stack' }, el('label', {}, '我已經有遊戲 ID'), idIn, el('div', { class: 'row' }, login)),
      el('div', { class: 'card stack' }, el('label', {}, '我是新玩家:綽號'), nickIn, el('div', { class: 'row' }, create)),
      msg) : el('p', { class: 'persona' }, '存檔功能目前尚未開放,可以先不登入直接玩。'),
    el('div', { class: 'row' }, el('button', { class: 'btn ghost', type: 'button', onclick: guest }, '不登入,直接玩')),
    el('p', { class: 'persona' }, '不登入也能玩,但收集到的鑰匙碎片不會保存。')) ;
}
function showNewId() {
  const code = Save.fmt(acct.id);
  const copy = el('button', { class: 'btn ghost', type: 'button', onclick: () => { try { navigator.clipboard.writeText(code).then(() => { copy.textContent = '已複製'; }, () => { copy.textContent = '請手動抄下'; }); } catch (e) { copy.textContent = '請手動抄下'; } } }, '複製');
  show(el('p', { class: 'persona' }, `歡迎你,${acct.nick}`), el('h2', {}, '你的遊戲 ID'), el('div', { class: 'big idbox' }, code),
    el('div', { class: 'row' }, copy),
    el('p', { class: 'lead' }, '請抄下來或截圖保存。下次輸入這組編號,就能接著收集。知道編號的人都能讀寫你的進度,所以不要公開張貼;編號弄丟了無法找回。'),
    el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: birthdayPage }, '我已記下,開始')));
}
function welcome() {
  const nickIn = el('input', { type: 'text', class: 'txt', maxlength: '12', 'aria-label': '綽號', value: acct.nick });
  nickIn.value = acct.nick;
  const msg = el('p', { class: 'err', role: 'alert' });
  const go = el('button', { class: 'btn', type: 'button', onclick: async () => {
    const nick = nickIn.value.trim(); if (!nick) { msg.textContent = '綽號不能是空的。'; return; }
    if (nick !== acct.nick) { acct.nick = nick; Hall.nick = nick; try { await Save.put(acct.id, nick, acct.got, acct.hist); } catch (e) { msg.textContent = '綽號沒有存成功,但可以繼續玩。'; } }
    birthdayPage();
  } }, '繼續');
  show(el('p', { class: 'persona' }, `遊戲 ID ${Save.fmt(acct.id)}`), el('h2', {}, '歡迎回來'),
    el('p', { class: 'lead' }, `已收集 ${acct.got.length} 位人物,玩過 ${acct.hist.length} 場。綽號可以修改:`), nickIn, msg, el('div', { class: 'row' }, go));
}
function accountBar() {
  if (!acct) return null;
  const box = el('div', { class: 'acct' });
  const render = () => {
    if (!acct.id) { box.replaceChildren(el('span', {}, '目前是訪客,收集不會保存。'), el('button', { class: 'btn ghost', type: 'button', onclick: start }, '登入或創建 ID')); return; }
    box.replaceChildren(el('span', {}, `${acct.nick} · ID ${Save.fmt(acct.id)}`),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => { setAcct(null); start(); } }, '登出'),
      el('button', { class: 'btn ghost', type: 'button', onclick: confirmDel }, '刪除我的存檔'));
  };
  const confirmDel = () => box.replaceChildren(el('span', {}, '確定刪除這份存檔嗎?收集的人物與紀錄都會消失,無法復原。'),
    el('button', { class: 'btn', type: 'button', onclick: async () => { try { await Save.del(acct.id); Save.remember(''); setAcct(null); start(); } catch (e) { box.replaceChildren(el('span', { class: 'err' }, '刪除失敗,請稍後再試。')); } } }, '確定刪除'),
    el('button', { class: 'btn ghost', type: 'button', onclick: render }, '取消'));
  render(); return box;
}

function room(proceed) {
  const door = (cls, tag, state, sub, onclick, aria) => el('button', { class: `door ${cls}`, type: 'button', onclick, 'aria-label': aria }, el('span', { class: 'dtag' }, tag), el('b', {}, state), el('small', {}, sub));
  const doors = [door('d0', '第一扇門', '🚪 開著', '尋找你上輩子的樣子', proceed, '第一扇門,開著,通往尋找你上輩子的樣子'),
    ...KEYS.map((K, i) => {
      const n = keyHave(K).length, open = n >= K.need;
      return door(K.cls, `第${['二', '三', '四'][i]}扇門`, open ? '🔓 已解鎖' : '🔒 上鎖', `${K.name}的門 ${Math.min(n, K.need)} / ${K.need}`, () => {
        if (open) modal(`${K.name}的門打開了`, ['鑰匙完成,門鎖喀的一聲開了。', '不過這扇門後面的世界,還沒有開放。']);
        else modal(`${K.name}的門上了鎖`, [`需要集滿 ${K.need} 位${K.label},才能解開這道鎖。`, `目前集到 ${n} 位。每一場遊戲揭曉的人物若屬於這一類,就會得到一個鑰匙碎片。`]);
      }, `${K.name}的門,${open ? '已解鎖' : '上鎖'}`);
    })];
  show(el('p', { class: 'persona' }, '房間'), el('h2', {}, '你在一個陌生的房間醒來'),
    el('p', { class: 'scene' }, '四周有四扇門。其中一扇敞開著,門縫透出光;另外三扇都上了鎖,鎖的顏色各不相同。'),
    el('div', { class: 'doors' }, doors),
    el('div', { class: 'row' }, el('button', { class: 'btn ghost', type: 'button', onclick: () => treasure(() => room(proceed)) }, '查看尋寶狀態')));
}

function collect(p) {
  if (!acct) setAcct({ id: null, nick: '', got: [], hist: [] });
  const first = !acct.got.includes(p.id);
  acct.hist.push({ id: p.id, t: new Date().toISOString().slice(0, 10) });
  if (first) acct.got.push(p.id);
  return { first, hit: KEYS.filter((K) => (p.k || '').includes(K.k)) };
}
function announce(p, r) {
  if (!r.hit.length) return;
  if (!r.first) { modal('這位人物你已經收集過了', [`${p.name}已經在你的名冊裡,不會重複計算。`]); return; }
  const lines = r.hit.map((K) => { const n = keyHave(K).length; return `${K.name}鑰匙碎片:${Math.min(n, K.need)} / ${K.need}(${K.label})${n >= K.need ? ' ——鑰匙集滿了!回到房間,那扇門已經可以打開。' : ''}`; });
  if (!acct.id) lines.push('你目前是訪客,關掉網頁後這些碎片就不見了。');
  modal(`恭喜!你得到了鑰匙碎片`, [`${p.name}符合:`, ...lines]);
}
async function persist() {
  if (!acct || !acct.id) return acct && acct.hist.length ? '未登入,這次的收集不會被保存。' : '';
  try {
    const cur = await Save.load(acct.id);
    if (!cur) return '存檔失敗:這個遊戲 ID 已不存在。';
    const m = Save.merge(acct, cur); acct.got = m.got; acct.hist = m.hist;
    return (await Save.put(acct.id, acct.nick, acct.got, acct.hist)) ? '已存檔。' : '存檔失敗:這個遊戲 ID 已不存在。';
  } catch (e) { return '存檔失敗(網路問題),下次揭曉人物時會再試一次。'; }
}
// 尋寶狀態:各類收集進度,與仿戒嚴時期公文的名冊
function treasure(back) {
  const sections = KEYS.map((K) => {
    const have = keyHave(K), n = have.length, pct = Math.min(100, Math.round((n / K.need) * 100));
    return el('section', { class: 'sec' },
      el('h3', {}, `${K.name}鑰匙 · ${K.label}`),
      el('div', { class: 'keybar' }, el('i', { class: K.cls, style: `width:${pct}%` })),
      el('p', { class: 'persona' }, `${n} / ${K.need}${n >= K.need ? ' · 鑰匙已完成' : ''}`),
      el('div', { class: 'register', role: 'region', 'aria-label': `${K.name}鑰匙名冊` },
        el('div', { class: 'stamp', 'aria-hidden': 'true' }, '密'),
        el('div', { class: 'rtitle' }, `${K.label}　名冊`),
        have.length ? el('ol', {}, have.map((q) => el('li', {}, el('span', { class: 'rname' }, q.name), `　${q.life}　${q.job}`))) : el('p', { class: 'rempty' }, '(尚無人名)')));
  });
  show(el('h2', {}, '尋寶狀態'), el('p', { class: 'lead' }, `已收集 ${acct.got.length} 位人物。同一個人符合多類時,每一類都會算。名冊的樣式是仿戒嚴時期公文的設計,只列姓名、生卒與職業。`),
    !acct.id ? el('p', { class: 'persona' }, '你目前是訪客,這些收集不會保存。') : null,
    ...sections, el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: back }, '回上一頁')));
}


/* ───── 放榜之後:從成績單說起,一路引導到這個人最後的行業 ───── */
const SUBJ = { lang: '語文', math: '數學', sci: '自然', soc: '社會' };
const FLAVOR = { lang: '你總能在字句裡讀出世界的形狀', math: '你習慣在數字與規則裡找答案', sci: '你對生命與自然,永遠有問不完的問題', soc: '你比別人更在意人與人之間的規矩' };
function story(p, reveal) {
  const a = st.asked.find((x) => x.kind === 'career'); const r = a.res;
  const lines = [`放榜那天,成績單上寫著:${SUBJ[r.top]}最高,${SUBJ[r.second]}其次。${FLAVOR[r.top]}。`,
    `老師看著成績單,對你說:「你最適合走『${careerName(a.chosen)}』這條路。」`];
  if (a.twisted) lines.push(`可是時機不對,幾番波折之後,你改走了「${careerName(a.eff)}」之路。`);
  lines.push(p.c.includes(st.career)
    ? `你循著這條路,一步一步走下去。多年以後,你成了「${p.job}」。`
    : `然而命運另有安排——時局與機緣一再改寫你的計畫,你最後走上的,是「${p.job}」的人生。`);
  lines.push('這是怎樣的一生?翻到下一頁,就知道你是誰。');
  show(el('p', { class: 'persona' }, '放榜之後'), el('h2', {}, '你的故事'),
    ...lines.map((x) => el('p', { class: 'scene' }, x)),
    el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: reveal }, '揭曉你的上輩子')));
}


Promise.all([fetch('data/game.json?v=20261121').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  fetch('data/exam.json?v=20261121').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })])
  .then(([d, ex]) => { data = d; exam = ex; start(); })
  .catch(() => show(el('h1', {}, '尋找你上輩子的樣子'),
    el('p', { class: 'err' }, '資料載入失敗。若是從檔案直接開啟,請改用本機伺服器或公開網址瀏覽。')));
