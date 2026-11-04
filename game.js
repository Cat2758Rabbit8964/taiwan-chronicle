'use strict';
const app = document.getElementById('app');
const CAREER_ORDER = ['law', 'pol', 'med', 'art', 'edu', 'act', 'biz'];
const SIT_ORDER = ['A', 'B1', 'B2', 'B3', 'D'];
const CATS = ['R', 'E', 'S', 'X', 'A'];
const LABEL = 'ABCDE';
const MIN_PEOPLE = 6;      // 一個時間帶至少要有幾位資格人物才會列出
const MIN_PER_CAREER = 2;
const MAX_SIT = 3;         // 最多問幾個情境題
const STOP_AT = 2;         // 剩下幾位以內就不再追問
let data = null;
let st = null; // { birth, bands, band, pool, career, asked:[{kind,sit,cat,optText}], bp }

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
function careersIn(pool) {
  const n = {};
  for (const p of pool) for (const c of p.c) n[c] = (n[c] || 0) + 1;
  return CAREER_ORDER.filter((c) => n[c] >= MIN_PER_CAREER);
}
function qualifiedBands(birth) {
  const pool = eligible(birth);
  return data.bands.filter((b) => {
    const inBand = pool.filter((p) => p.band === b.id);
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
    el('p', { class: 'lead' }, '選擇生日,系統會讓你回到過去的三個時間點之一。你要面對一連串的抉擇,而你的每個選擇,都會對應到最後那位真實存在過的人,在歷史上真正做過的事。'),
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
  st = { birth, bands, band: null, pool: [], career: null, asked: [], bp: null, usedSit: [] };
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
  st.pool = eligible(st.birth).filter((p) => p.band === b.id);
  st.career = null; st.asked = []; st.bp = null; st.usedSit = [];
  askCareer();
}

/* ───── 問題流程:每一題的選項,都只來自「剩下的人物裡真的有人做過」的選擇 ───── */
function docs(pool, sit) { return pool.filter((p) => p.acts[sit]); }
function catsOf(pool, sit) {
  const s = new Set();
  for (const p of docs(pool, sit)) for (const a of p.acts[sit]) s.add(a.c);
  return CATS.filter((c) => s.has(c));
}
function stepNo() { return st.asked.length + (st.career ? 1 : 0) + 1; }

function askCareer() {
  const avail = careersIn(st.pool);
  const keep = avail.length > 5 ? CAREER_ORDER.filter((c) => shuffled(avail, st.birth + 'c').slice(0, 5).includes(c)) : avail;
  ask('求學階段,你的志向是?', keep.map((c) => ({ t: data.q1.careers[c], pick: () => {
    st.career = c;
    st.pool = st.pool.filter((p) => p.c.includes(c));
    st.asked.push({ kind: 'career', text: data.q1.careers[c], career: c });
    next();
  } })));
}

function next() {
  const nSit = st.asked.filter((a) => a.kind === 'sit').length;
  if (st.pool.length > STOP_AT && nSit < MAX_SIT) {
    // 以一位「錨點人物」為準,只問他/她有紀錄的情境,這樣每個人都有機會走到最後
    const id = shuffled(st.pool.map((p) => p.id), st.birth + 'a' + nSit)[0];
    const p = st.pool.find((x) => x.id === id);
    const cand = SIT_ORDER.filter((s) => p.acts[s] && !st.usedSit.includes(s) && catsOf(st.pool, s).length >= 2 && docs(st.pool, s).length >= 2);
    if (cand.length) return askSituation(shuffled(cand, st.birth + 's' + nSit + id)[0]);
  }
  askPlace();
}

function askSituation(sit) {
  const def = data.sits[sit];
  const opts = catsOf(st.pool, sit).map((c) => ({ t: def[c], pick: () => {
    st.usedSit.push(sit);
    st.pool = st.pool.filter((p) => p.acts[sit] && p.acts[sit].some((a) => a.c === c));
    st.asked.push({ kind: 'sit', sit, cat: c, text: def[c], q: def.text });
    next();
  } }));
  ask(def.text, opts);
}

function askPlace() {
  // 出生地題只在「剩下的人都有出生地類型」時才問,避免把資料不明的人無聲地排除
  const types = new Set(st.pool.map((p) => p.bp).filter(Boolean));
  if (st.pool.length > 1 && st.pool.every((p) => p.bp) && types.size >= 2) {
    const opts = data.bp.opts.filter((o) => types.has(o.b)).map((o) => ({ t: o.t, pick: () => {
      st.bp = o.b;
      st.pool = st.pool.filter((p) => p.bp === o.b);
      st.asked.push({ kind: 'place', bp: o.b, text: o.t });
      result();
    } }));
    return ask(data.bp.text, opts);
  }
  result();
}

function ask(text, opts) {
  const bar = el('div', { class: 'progress', 'aria-hidden': 'true' }, Array.from({ length: Math.min(stepNo(), 5) }, () => el('i', { class: 'on' })));
  show(bar,
    el('p', { class: 'persona' }, `第 ${stepNo()} 題`),
    el('h2', {}, text),
    el('div', { class: 'stack' }, opts.map((o, i) => el('button', { class: 'opt', type: 'button', onclick: o.pick }, el('b', {}, LABEL[i] + '.'), o.t))));
}

/* ───── 結果:把使用者的每個選擇,對回人物真正做過的事 ───── */
function result() {
  const ranked = shuffled(st.pool.map((p) => p.id), st.birth + 'r');
  const p = st.pool.find((x) => x.id === ranked[0]);
  const others = ranked.slice(1, 4).map((id) => st.pool.find((x) => x.id === id));
  const b = st.band;

  const chain = st.asked.map((a) => {
    if (a.kind === 'career') {
      return el('li', {}, el('div', { class: 'you' }, '你選了:', a.text), el('div', { class: 'real' }, `他/她的職業:${p.job}`));
    }
    if (a.kind === 'place') {
      return el('li', {}, el('div', { class: 'you' }, '你選了:', a.text), el('div', { class: 'real' }, '他/她出生地的類型與此相符(這是本遊戲自行的分類,不是史實)'));
    }
    const evs = p.acts[a.sit].filter((x) => x.c === a.cat);
    return el('li', {}, el('div', { class: 'q' }, a.q), el('div', { class: 'you' }, '你選了:', a.text),
      evs.map((x) => el('div', { class: 'real' }, '他/她真正做的:', x.ev)));
  });

  show(
    el('p', { class: 'persona' }, `你回到的是 ${b.from} 到 ${b.to} 年前後 · 你的上輩子是`),
    el('div', { class: 'card' },
      el('div', { class: 'big' }, p.name),
      el('p', {}, el('span', { class: 'tag' }, p.country), el('span', { class: 'tag' }, p.life), el('span', { class: 'tag' }, p.job)),
      el('div', { class: 'sec' }, el('h3', {}, '你的選擇,與他/她實際做過的事'), el('ol', { class: 'chain' }, chain)),
      el('div', { class: 'sec' }, el('h3', {}, '他/她做過的事'), el('p', {}, p.story)),
      el('div', { class: 'sec' }, el('h3', {}, '後來的遭遇'), el('p', {}, p.fate)),
      p.note ? el('div', { class: 'sec' }, el('h3', {}, '資料註記'), el('p', { class: 'note' }, p.note)) : null,
      el('p', { class: 'persona' }, '資料出處:', el('a', { href: p.ref, target: '_blank', rel: 'noopener' }, `${p.src}「${p.name}」`))),
    others.length ? el('div', { class: 'sec' }, el('h3', {}, '做過同樣選擇的其他人'), el('div', { class: 'also' }, others.map((q) => el('div', {}, `${q.name}(${q.life},${q.job})`)))) : null,
    el('div', { class: 'row' },
      el('a', { class: 'btn', href: `index.html#y=${p.ly}`, style: 'text-decoration:none' }, `到台灣事件簿,看 ${p.ly} 年前後的台灣`),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => begin(st.birth) }, '換一個時間再試'),
      el('button', { class: 'btn ghost', type: 'button', onclick: start }, '重新開始')),
    el('p', { class: 'persona sec' }, '這是娛樂用的配對,不代表你「真的」是誰。每個選項只列出「這個時間帶、這個志向裡,確實有人做過」的選擇;「他/她真正做的」都取自出處條目已載的事實,條目沒寫的就不列。歷史人物的選擇受限於當時的處境,我們無法以今天的角度簡單評斷。'));
}

fetch('data/game.json')
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((d) => { data = d; start(); })
  .catch(() => show(el('h1', {}, '尋找你上輩子的樣子'),
    el('p', { class: 'err' }, '資料載入失敗。若是從檔案直接開啟,請改用本機伺服器或公開網址瀏覽。')));
