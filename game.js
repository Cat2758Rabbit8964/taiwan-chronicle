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
function start() {
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
    el('p', { class: 'lead' }, '選擇生日,系統會讓你回到過去的三個時間點之一。故事會替你安排一連串的抉擇;你走的每一步,最後都會對回一位真實存在過的人,在歷史上真正做過的事。有時命運不照你的意思走,那也會被寫進故事裡。'),
    el('div', { class: 'card' }, form));
}

function begin(birth, msg) {
  const ok = qualifiedBands(birth);
  if (!ok.length) {
    if (msg) msg.textContent = '這個生日太早了,資料庫裡沒有足夠在你出生前就已過世的人物。';
    return;
  }
  const picked = shuffled(ok.map((b) => String(b.id)), birth).slice(0, 3).map(Number);
  const bands = data.bands.filter((b) => picked.includes(b.id));
  st = { birth, bands, band: null, pool: [], career: null, asked: [], usedSit: [] };
  const cards = bands.map((b) => el('button', { class: 'opt', type: 'button', onclick: () => chooseBand(b) }, agoLabel(b)));
  const [y, m, d] = birth.split('-').map(Number);
  show(
    el('h2', {}, '選一個你想回去的時間'),
    el('p', { class: 'lead' }, `生日 ${y} 年 ${m} 月 ${d} 日。你要回到:`),
    el('div', { class: 'stack' }, cards),
    el('div', { class: 'row' }, el('button', { class: 'btn ghost', type: 'button', onclick: start }, '重選生日')));
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
function pickAlt(options, salt) { return options.length ? shuffled(options, st.birth + salt)[0] : null; }

/* ───── 志向 ───── */
function askCareer() {
  const shown = shuffled(CAREER_ORDER, st.birth + 'c').slice(0, 5);
  const keep = CAREER_ORDER.filter((c) => shown.includes(c));
  ask('故事開始', '求學階段,你的志向是?', '', keep.map((c) => ({ t: data.q1.careers[c], pick: () => chooseCareer(c) })));
}
function chooseCareer(c) {
  // 志向只影響故事與配對加分,不限制候選人;但該志向在這個時間帶人太少時,故事仍會轉折
  const count = careerCount(st.pool);
  if ((count[c] || 0) >= KEEP) return applyCareer(c, c, false);
  const alt = pickAlt(CAREER_ORDER.filter((x) => x !== c && (count[x] || 0) >= KEEP), 'ca' + c);
  if (!alt) return applyCareer(c, c, false);
  const T = data.twist.career;
  interlude(`時機不對。${T[c]}之路比你預期的更難走,幾番波折之後,你最後走向了${T[alt]}之路。`, () => applyCareer(c, alt, true));
}
function applyCareer(chosen, eff, twisted) {
  st.career = eff;
  st.asked.push({ kind: 'career', chosen, eff, twisted, text: data.q1.careers[eff], chosenText: data.q1.careers[chosen] });
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
// 這條路走得完嗎?還需要 preNeed 個前置情境題,最後再問「最後一章」,每一步都至少要剩 KEEP 位
function viable(pool, used, preNeed) {
  if (pool.length < KEEP) return false;
  if (preNeed === 0) return feasible(pool, 'L', 1);   // 最後一章可以只剩一位
  return PRE_SITS.some((s) => !used.includes(s) && CATS.some((c) => {
    const nx = byCat(pool, s, c);
    return nx.length >= KEEP && viable(nx, [...used, s], preNeed - 1);
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
      return nx.length >= KEEP && viable(nx, [...st.usedSit, s], need);
    }));
    if (free.length) {
      // 以一位「錨點人物」為準,先問他/她有紀錄的情境;前兩題若找不到,就改問其他人有紀錄的情境
      const anchor = st.pool.find((x) => x.id === shuffled(st.pool.map((p) => p.id), st.birth + 'a' + nPre)[0]);
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
  if (types.length < 2) return result();
  ask('最後一個問題', data.bp.text, '', types.map((o) => ({ t: o.t, pick: () => {
    st.pool = st.pool.filter((p) => p.bp === o.b);
    st.asked.push({ kind: 'place', text: o.t });
    result();
  } })));
}

function askSituation(sit) {
  const def = data.sits[sit];
  const n = st.asked.filter((a) => a.kind === 'sit').length + 1;
  ask(`情境 ${n}`, def.title, def.text, CATS.map((c) => ({ t: def[c], pick: () => chooseCat(sit, c) })));
}
function chooseCat(sit, c) {
  const isL = sit === 'L';
  const need = isL ? 0 : Math.max(0, preNeedNow() - 1);
  const ok = (x) => {
    const nx = byCat(st.pool, sit, x);
    return nx.length >= (isL ? 1 : KEEP) && (isL || viable(nx, [...st.usedSit, sit], need));
  };
  if (ok(c)) return applyCat(sit, c, c, false);
  const alt = pickAlt(CATS.filter((x) => x !== c && ok(x)), 'sa' + sit + c);
  if (!alt) { // 找不到可行的選項:取剩最多的,再沒有就跳過這題
    const count = catCount(st.pool, sit);
    const best = CATS.filter((x) => (count[x] || 0) > 0).sort((a, b) => count[b] - count[a])[0];
    if (!best) { st.usedSit.push(sit); st.asked.push({ kind: 'skip', sit }); return next(); }
    return applyCat(sit, c, best, best !== c);
  }
  const def = data.sits[sit];
  interlude(`事與願違。你本想「${def[c]}」,局勢卻不容許;幾番周折之後,你走上了另一條路:「${def[alt]}」。`, () => applyCat(sit, c, alt, true));
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
  const order = shuffled(st.pool.map((p) => p.id), st.birth + 'r');
  const byId = (id) => st.pool.find((x) => x.id === id);
  // 志向相符的人排前面;同組內仍依生日固定洗牌
  const ranked = [...order].sort((a, b) => (byId(b).c.includes(st.career) ? 1 : 0) - (byId(a).c.includes(st.career) ? 1 : 0));
  const p = byId(ranked[0]);
  const others = ranked.slice(1, 4).map(byId);
  const b = st.band;

  const chain = st.asked.filter((a) => a.kind !== 'skip').map((a) => {
    const rows = [];
    if (a.kind === 'sit') rows.push(el('div', { class: 'q' }, a.title));
    if (a.twisted) {
      rows.push(el('div', { class: 'you off' }, '你原本選了:', a.chosenText));
      rows.push(el('div', { class: 'twist' }, '故事轉折了,你實際走上的是:'));
    }
    rows.push(el('div', { class: 'you' }, a.twisted ? a.text : `你選了:${a.text}`));
    if (a.kind === 'career') rows.push(el('div', { class: 'real' }, p.c.includes(a.eff) ? `他/她的職業:${p.job}` : `他/她的職業是${p.job},不是這條志向,但他/她走過和你一樣的情境選擇`));
    else if (a.kind === 'place') rows.push(el('div', { class: 'real' }, '他/她出生地的類型與此相符(這是本遊戲自行的分類,不是史實)'));
    else p.acts[a.sit].filter((x) => x.c === a.eff).forEach((x) => rows.push(el('div', { class: 'real' }, '他/她真正做的:', x.ev)));
    return el('li', {}, rows);
  });

  show(
    el('p', { class: 'persona' }, `你回到的是 ${b.from} 到 ${b.to} 年前後 · 你的上輩子是`),
    el('div', { class: 'card' },
      el('div', { class: 'big' }, p.name),
      el('p', {}, el('span', { class: 'tag' }, p.country), el('span', { class: 'tag' }, p.life), el('span', { class: 'tag' }, p.job)),
      el('div', { class: 'sec' }, el('h3', {}, '你走過的路,與他/她實際做過的事'), el('ol', { class: 'chain' }, chain)),
      el('div', { class: 'sec' }, el('h3', {}, '他/她做過的事'), el('p', {}, p.story)),
      el('div', { class: 'sec' }, el('h3', {}, '後來的遭遇'), el('p', {}, p.fate)),
      p.note ? el('div', { class: 'sec' }, el('h3', {}, '資料註記'), el('p', { class: 'note' }, p.note)) : null,
      el('p', { class: 'persona' }, '資料出處:', el('a', { href: p.ref, target: '_blank', rel: 'noopener' }, `${p.src}「${p.name}」`))),
    others.length ? el('div', { class: 'sec' }, el('h3', {}, '走過同一條路的其他人'), el('div', { class: 'also' }, others.map((q) => el('div', {}, `${q.name}(${q.life},${q.job})`)))) : null,
    el('div', { class: 'row' },
      el('a', { class: 'btn', href: `index.html#y=${p.ly}`, style: 'text-decoration:none' }, `到台灣事件簿,看 ${p.ly} 年前後的台灣`),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => begin(st.birth) }, '換一個時間再試'),
      el('button', { class: 'btn ghost', type: 'button', onclick: start }, '重新開始')),
    el('p', { class: 'persona sec' }, '這是娛樂用的配對,不代表你「真的」是誰。故事的轉折是為了讓你走完全程而設計的虛構情節;「他/她真正做的」都取自出處條目已載的事實,條目沒寫的就不列。歷史人物的選擇受限於當時的處境,我們無法以今天的角度簡單評斷。'));
}

fetch('data/game.json')
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((d) => { data = d; start(); })
  .catch(() => show(el('h1', {}, '尋找你上輩子的樣子'),
    el('p', { class: 'err' }, '資料載入失敗。若是從檔案直接開啟,請改用本機伺服器或公開網址瀏覽。')));
