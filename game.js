'use strict';
const app = document.getElementById('app');
const DIMS = [['r', '抗爭'], ['e', '體制內溝通'], ['s', '專業自守'], ['x', '出走'], ['a', '順應']];
const ZODIAC = '鼠牛虎兔龍蛇馬羊猴雞狗豬';
const LABEL = 'ABCDE';
let data = null;
let st = null; // { birth, era, year, career, trait, q, picks }

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

// "r2e1" -> {r:2,e:1}
function parseW(s) {
  const o = {};
  for (let i = 0; i < s.length; i += 2) o[s[i]] = (o[s[i]] || 0) + Number(s[i + 1]);
  return o;
}
function hash(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function start() {
  const max = new Date().toISOString().slice(0, 10);
  const input = el('input', { type: 'date', id: 'bd', min: '1900-01-01', max, required: '' });
  const go = el('button', { class: 'btn', type: 'submit' }, '出發');
  const msg = el('p', { class: 'err', role: 'alert' });
  const form = el('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    if (!input.value) { msg.textContent = '請先輸入出生年月日。'; return; }
    begin(input.value);
  } },
    el('div', {}, el('label', { for: 'bd' }, '你的出生年月日'), input),
    go, msg);
  show(
    el('h1', {}, '尋找你上輩子的樣子'),
    el('p', { class: 'lead' }, '輸入生日,系統會讓你回到台灣歷史上的三個年代之一。你要面對一連串的抉擇,最後看看你的選擇,最接近哪一位真實存在過的人。'),
    el('div', { class: 'card' }, form));
}

function begin(birth) {
  st = { birth, era: null, year: null, career: null, trait: { r: 0, e: 0, s: 0, x: 0, a: 0 }, q: 0, picks: [] };
  const [y, m, d] = birth.split('-').map(Number);
  const h = hash(birth);
  const cards = Object.entries(data.eras).map(([key, e]) => {
    const [lo, hi] = e.birth;
    const year = lo + (h + key.charCodeAt(0) * 7) % (hi - lo + 1);
    const zod = ZODIAC[(year - 4) % 12];
    return el('button', { class: 'opt', type: 'button', onclick: () => { st.era = key; st.year = year; question(); } },
      el('b', {}, e.name),
      `${e.span}`,
      el('small', {}, `你的前世出生在 ${year} 年,屬${zod}。${e.intro}`));
  });
  show(
    el('h2', {}, '選一個你想回去的年代'),
    el('p', { class: 'lead' }, `生日 ${y} 年 ${m} 月 ${d} 日,對應到三個可能的前世:`),
    el('div', { class: 'stack' }, cards),
    el('div', { class: 'row' }, el('button', { class: 'btn ghost', type: 'button', onclick: start }, '重填生日')));
}

// 第 1 題:志向;第 2 題:依志向分岔;第 3 題:依第 2 題選擇的傾向分岔;第 4 題:時代轉折
function currentQuestion() {
  const e = data.eras[st.era];
  if (st.q === 0) return e.q1;
  if (st.q === 1) return e.q2[st.career];
  if (st.q === 2) return e.q3[st.group];
  return e.q4;
}
function groupOf(w) {
  const g = { R: (w.r || 0) + (w.x || 0), E: (w.e || 0) + (w.a || 0), S: w.s || 0 };
  return Object.entries(g).sort((a, b) => b[1] - a[1])[0][0];
}

function question() {
  const e = data.eras[st.era];
  const q = currentQuestion();
  const bar = el('div', { class: 'progress', 'aria-hidden': 'true' }, [0, 1, 2, 3].map((i) => el('i', { class: i <= st.q ? 'on' : '' })));
  const opts = q.opts.map((o, i) => el('button', { class: 'opt', type: 'button', onclick: () => pick(o) }, el('b', {}, LABEL[i] + '.'), o.t));
  show(bar,
    el('p', { class: 'persona' }, `${e.name} · 你出生於 ${st.year} 年 · 第 ${st.q + 1} / 4 題`),
    el('h2', {}, q.text),
    el('div', { class: 'stack' }, opts));
}

function pick(o) {
  if (st.q === 0) st.career = o.c;
  else {
    const w = parseW(o.w);
    for (const k in w) st.trait[k] += w[k];
    if (st.q === 1) st.group = groupOf(w);
  }
  st.picks.push(o.t);
  st.q += 1;
  if (st.q < 4) question(); else result();
}

function match() {
  const total = Object.values(st.trait).reduce((a, b) => a + b, 0) || 1;
  const scored = data.people
    .filter((p) => p.eras[st.era])
    .map((p) => {
      // 把使用者與人物的傾向都換成比例,比較「分布」而不是總量
      const ft = Object.values(p.style).reduce((a, b) => a + b, 0) || 1;
      let d2 = 0;
      for (const [k] of DIMS) d2 += (st.trait[k] / total - (p.style[k] || 0) / ft) ** 2;
      const bonus = p.eras[st.era].includes(st.career) ? 6 : 0;
      const jitter = ((hash(st.birth + p.id) % 100) / 100) * 0.4; // 同生日同結果,近分時不同生日會有變化
      return { p, score: bonus - 4 * Math.sqrt(d2) + jitter };
    })
    .sort((a, b) => b.score - a.score);
  return scored;
}

function result() {
  const ranked = match();
  const { p } = ranked[0];
  const e = data.eras[st.era];
  const total = Object.values(st.trait).reduce((a, b) => a + b, 0) || 1;

  const traits = el('div', { class: 'traits' });
  for (const [k, name] of DIMS) {
    const pct = Math.round((st.trait[k] / total) * 100);
    traits.append(el('span', {}, name), el('span', { class: 'bar' }, el('i', { style: `width:${pct}%` })), el('span', {}, pct + '%'));
  }
  const also = ranked.slice(1, 4).map(({ p: q }) => el('div', {}, `${q.name}(${q.life},${q.job})`));

  show(
    el('p', { class: 'persona' }, `${e.name} · 你出生於 ${st.year} 年 · 你的上輩子最接近`),
    el('div', { class: 'card' },
      el('div', { class: 'big' }, p.name),
      el('p', {}, el('span', { class: 'tag' }, p.life), el('span', { class: 'tag' }, p.job)),
      el('div', { class: 'sec' }, el('h3', {}, '他/她做過的事'), el('p', {}, p.story)),
      el('div', { class: 'sec' }, el('h3', {}, '後來的遭遇'), el('p', {}, p.fate)),
      p.note ? el('div', { class: 'sec' }, el('h3', {}, '資料註記'), el('p', { class: 'note' }, p.note)) : null,
      el('p', { class: 'persona' }, '資料出處:', el('a', { href: p.ref, target: '_blank', rel: 'noopener' }, '維基百科「' + p.name + '」'))),
    el('div', { class: 'sec' }, el('h3', {}, '你這一路的選擇傾向'), traits),
    el('div', { class: 'sec' }, el('h3', {}, '同一個年代,也和你相近的人'), el('div', { class: 'also' }, also)),
    el('div', { class: 'row' },
      el('a', { class: 'btn', href: 'index.html', style: 'text-decoration:none' }, '到台灣事件簿,讀這個時代的事件'),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => begin(st.birth) }, '換一個年代再試'),
      el('button', { class: 'btn ghost', type: 'button', onclick: start }, '重新開始')),
    el('p', { class: 'persona sec' }, '這是娛樂用的配對,不代表你「真的」是誰。歷史人物的選擇受限於當時的處境,我們無法以今天的角度簡單評斷。'));
}

fetch('data/game.json')
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((d) => { data = d; start(); })
  .catch(() => show(el('h1', {}, '尋找你上輩子的樣子'),
    el('p', { class: 'err' }, '資料載入失敗。若是從檔案直接開啟,請改用本機伺服器或公開網址瀏覽。')));
