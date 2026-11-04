'use strict';
const app = document.getElementById('app');
const DIMS = [['r', '抗爭'], ['e', '體制內溝通'], ['s', '專業自守'], ['x', '出走'], ['a', '順應']];
const CAREER_ORDER = ['law', 'pol', 'med', 'art', 'edu', 'act', 'biz'];
const LABEL = 'ABCDE';
const MIN_PEOPLE = 6;   // 一個時間帶至少要有幾位資格人物才會列出
const MIN_PER_CAREER = 2;
let data = null;
let st = null; // { birth, bands, band, pool, step, bp, career, group, trait }

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
function show(...nodes) { app.replaceChildren(...nodes); window.scrollTo(0, 0); }

function parseW(s) { // "r2e1" -> {r:2,e:1}
  const o = {};
  for (let i = 0; i < s.length; i += 2) o[s[i]] = (o[s[i]] || 0) + Number(s[i + 1]);
  return o;
}
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

function start() {
  const max = new Date().toISOString().slice(0, 10);
  const input = el('input', { type: 'date', id: 'bd', min: '1900-01-01', max, required: '' });
  const msg = el('p', { class: 'err', role: 'alert' });
  const form = el('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    if (!input.value) { msg.textContent = '請先輸入出生年月日。'; return; }
    begin(input.value, msg);
  } },
    el('div', {}, el('label', { for: 'bd' }, '你的出生年月日'), input),
    el('button', { class: 'btn', type: 'submit' }, '出發'), msg);
  show(
    el('h1', {}, '尋找你上輩子的樣子'),
    el('p', { class: 'lead' }, '輸入生日,系統會讓你回到過去的三個時間點之一。你要面對一連串的抉擇,最後看看你的選擇,最接近哪一位真實存在過的人。'),
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
  st = { birth, bands, band: null, pool: [], step: 0, bp: null, career: null, group: null, trait: { r: 0, e: 0, s: 0, x: 0, a: 0 } };
  const cards = bands.map((b) => el('button', { class: 'opt', type: 'button', onclick: () => chooseBand(b) }, agoLabel(b)));
  const [y, m, d] = birth.split('-').map(Number);
  show(
    el('h2', {}, '選一個你想回去的時間'),
    el('p', { class: 'lead' }, `生日 ${y} 年 ${m} 月 ${d} 日。你要回到:`),
    el('div', { class: 'stack' }, cards),
    el('div', { class: 'row' }, el('button', { class: 'btn ghost', type: 'button', onclick: start }, '重填生日')));
}

function chooseBand(b) {
  st.band = b;
  st.pool = eligible(st.birth).filter((p) => p.band === b.id);
  st.step = 0;
  question();
}

// 0 出生地 → 1 志向 → 2 依志向分岔 → 3 依第 2 題傾向分岔 → 4 共同轉折
function currentQuestion() {
  if (st.step === 0) return { text: data.bp.text, opts: data.bp.opts };
  if (st.step === 1) {
    const avail = careersIn(st.pool);
    const keep = avail.length > 5 ? CAREER_ORDER.filter((c) => shuffled(avail, st.birth + 'c').slice(0, 5).includes(c)) : avail;
    return { text: data.q1.text, opts: keep.map((c) => ({ t: data.q1.careers[c], c })) };
  }
  if (st.step === 2) return data.q2[st.career];
  if (st.step === 3) return data.q3[st.group];
  return data.q4;
}
function groupOf(w) {
  const g = { R: (w.r || 0) + (w.x || 0), E: (w.e || 0) + (w.a || 0), S: w.s || 0 };
  return Object.entries(g).sort((a, b) => b[1] - a[1])[0][0];
}

function question() {
  const q = currentQuestion();
  const bar = el('div', { class: 'progress', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4].map((i) => el('i', { class: i <= st.step ? 'on' : '' })));
  const opts = q.opts.map((o, i) => el('button', { class: 'opt', type: 'button', onclick: () => pick(o) }, el('b', {}, LABEL[i] + '.'), o.t));
  show(bar,
    el('p', { class: 'persona' }, `第 ${st.step + 1} / 5 題`),
    el('h2', {}, q.text),
    el('div', { class: 'stack' }, opts));
}

function pick(o) {
  if (st.step === 0) st.bp = o.b;
  else if (st.step === 1) st.career = o.c;
  else {
    const w = parseW(o.w);
    for (const k in w) st.trait[k] += w[k];
    if (st.step === 2) st.group = groupOf(w);
  }
  st.step += 1;
  if (st.step < 5) question(); else result();
}

function match() {
  const total = Object.values(st.trait).reduce((a, b) => a + b, 0) || 1;
  return st.pool
    .map((p) => {
      // 傾向換成比例,比較「分布」而不是總量
      const ft = Object.values(p.style).reduce((a, b) => a + b, 0) || 1;
      let d2 = 0;
      for (const [k] of DIMS) d2 += (st.trait[k] / total - (p.style[k] || 0) / ft) ** 2;
      const careerBonus = p.c.includes(st.career) ? 6 : 0;
      const placeBonus = p.bp && p.bp === st.bp ? 3 : 0;
      const jitter = ((hash(st.birth + p.id) % 100) / 100) * 0.4; // 同生日同結果,近分時不同生日會有變化
      return { p, score: careerBonus + placeBonus - 4 * Math.sqrt(d2) + (p.adj || 0) + jitter };
    })
    .sort((a, b) => b.score - a.score);
}

function result() {
  const ranked = match();
  const { p } = ranked[0];
  const b = st.band;
  const total = Object.values(st.trait).reduce((a, c) => a + c, 0) || 1;
  const traits = el('div', { class: 'traits' });
  for (const [k, name] of DIMS) {
    const pct = Math.round((st.trait[k] / total) * 100);
    traits.append(el('span', {}, name), el('span', { class: 'bar' }, el('i', { style: `width:${pct}%` })), el('span', {}, pct + '%'));
  }
  const also = ranked.slice(1, 4).map(({ p: q }) => el('div', {}, `${q.name}(${q.life},${q.job})`));

  show(
    el('p', { class: 'persona' }, `你回到的是 ${b.from} 到 ${b.to} 年前後 · 你的上輩子最接近`),
    el('div', { class: 'card' },
      el('div', { class: 'big' }, p.name),
      el('p', {}, el('span', { class: 'tag' }, p.country), el('span', { class: 'tag' }, p.life), el('span', { class: 'tag' }, p.job)),
      el('div', { class: 'sec' }, el('h3', {}, '他/她做過的事'), el('p', {}, p.story)),
      el('div', { class: 'sec' }, el('h3', {}, '後來的遭遇'), el('p', {}, p.fate)),
      p.note ? el('div', { class: 'sec' }, el('h3', {}, '資料註記'), el('p', { class: 'note' }, p.note)) : null,
      el('p', { class: 'persona' }, '資料出處:', el('a', { href: p.ref, target: '_blank', rel: 'noopener' }, `${p.src}「${p.name}」`))),
    el('div', { class: 'sec' }, el('h3', {}, '你這一路的選擇傾向'), traits),
    el('div', { class: 'sec' }, el('h3', {}, '同一個時間帶,也和你相近的人'), el('div', { class: 'also' }, also)),
    el('div', { class: 'row' },
      el('a', { class: 'btn', href: `index.html#y=${p.ly}`, style: 'text-decoration:none' }, `到台灣事件簿,看 ${p.ly} 年前後的台灣`),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => begin(st.birth) }, '換一個時間再試'),
      el('button', { class: 'btn ghost', type: 'button', onclick: start }, '重新開始')),
    el('p', { class: 'persona sec' }, '這是娛樂用的配對,不代表你「真的」是誰。出生地類型是本遊戲自行的分類,只用來加分,不是史實。歷史人物的選擇受限於當時的處境,我們無法以今天的角度簡單評斷。'));
}

fetch('data/game.json')
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((d) => { data = d; start(); })
  .catch(() => show(el('h1', {}, '尋找你上輩子的樣子'),
    el('p', { class: 'err' }, '資料載入失敗。若是從檔案直接開啟,請改用本機伺服器或公開網址瀏覽。')));
