'use strict';
/* 命運的考場:四科小遊戲,依成績決定志向。
   依賴 game.js 先定義的全域函式 el()、show()(兩個檔案共用同一個頁面)。
   考試過程不告知對錯;交卷後回到考場,再由「查看考試結果」看分數與逐題對照。 */
const SUBJECTS = [
  { id: 'lang', name: '語文', secs: 100, intro: '限時 100 秒,題目不限數量,一題接一題,答對越多越好。英文為單字填空;日文為單字、動詞形容詞活用與文法選擇題。答錯不扣分。英文每答對 1 題 10 分,日文每答對 1 題 5 分。成績單最多計 100 分,芳名錄以實際分數計(沒有上限)。' },
  { id: 'math', name: '數學', secs: 120, intro: '限時 120 秒,四則運算湊目標。電腦給你 4 個 1 到 10 的數字和一個目標數字(1 到 100),用 + − × ÷ 和括號把 4 個數字各用一次,算出目標。題目一題接一題出,解得越多分越高:每題 20 分。成績單最多計 100 分,芳名錄以實際分數計(沒有上限)。' },
  { id: 'sci', name: '自然', secs: 60, intro: '限時 60 秒,養一隻貓。用方向鍵或螢幕按鈕帶貓去吃東西,吃到東西貓就會長大(身體變長)。牆壁會穿過去,貓撞到自己的身體或時間到就結算。小魚乾 1 分、罐頭 2 分、金魚 5 分(只出現幾秒)。每 1 分換算 2 分;成績單最多計 100 分,芳名錄以實際分數計(沒有上限)。' },
  { id: 'soc', name: '社會', secs: 90, intro: '限時 90 秒,題目不限數量,一題接一題(事件細節,不考年份),四選一,題目取自台灣事件簿。答錯不扣分。每答對 1 題 5 分。成績單最多計 100 分,芳名錄以實際分數計(沒有上限)。' },
];
const SUBJECT_ORDER = ['lang', 'math', 'sci', 'soc'];   // 同分時的固定順序
// 最高分科目 → 第二高分科目 → 志向
const CAREER_BY_PAIR = {
  lang: { math: 'art', sci: 'art', soc: 'edu' },
  math: { lang: 'biz', sci: 'med', soc: 'biz' },
  sci: { lang: 'med', math: 'med', soc: 'act' },
  soc: { lang: 'law', math: 'pol', sci: 'act' },
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s % 60) % 60).padStart(2, '0')}`;
function rshuffle(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
// 每次考試抽不同的題:先從「這場考試還沒出過」的題裡抽,抽完了才重新洗牌
function pickFresh(list, n, seen, key) {
  let pool = list.filter((x) => !seen.has(key(x)));
  if (pool.length < n) { seen.clear(); pool = list; }
  const got = rshuffle(pool).slice(0, n); got.forEach((x) => seen.add(key(x))); return got;
}
function careerFromScores(scores) {
  const order = [...SUBJECT_ORDER].sort((a, b) => scores[b] - scores[a] || SUBJECT_ORDER.indexOf(a) - SUBJECT_ORDER.indexOf(b));
  return { top: order[0], second: order[1], career: CAREER_BY_PAIR[order[0]][order[1]] };
}

/* ───── 倒數計時(以截止時間計算,分頁切換也準) ───── */
function countdown(secs, bar, label, onEnd) {
  const end = Date.now() + secs * 1000; let stopped = false;
  const tick = () => {
    if (stopped) return;
    const left = Math.max(0, (end - Date.now()) / 1000);
    label.textContent = `剩餘 ${mmss(left)}`;
    bar.style.width = `${(left / secs) * 100}%`;
    if (left <= 0) { stopped = true; clearInterval(h); onEnd(); }
  };
  const h = setInterval(tick, 200); tick();
  return { stop() { stopped = true; clearInterval(h); } };
}

/* 每個小遊戲:play(ctx, subject, mount, finish) → 回傳清理函式;finish(score, 摘要, 逐題明細[]) 只會被呼叫一次 */
function frame(subject, title, body, onSubmit) {
  const bar = el('i'); const label = el('span', {}, '');
  let armed = false, timer = null;
  const submit = el('button', { class: 'btn ghost', type: 'button', onclick: () => {
    if (!armed) { armed = true; submit.textContent = '確定要交卷嗎?再按一次'; timer = setTimeout(() => { armed = false; submit.textContent = '交卷'; }, 3000); return; }
    if (timer) clearTimeout(timer); onSubmit();
  } }, '交卷');
  return {
    bar, label,
    node: el('div', {},
      el('p', { class: 'persona' }, `${subject.name}科 · ${title}`),
      el('div', { class: 'timer' }, label, el('span', { class: 'track' }, bar)),
      body,
      el('div', { class: 'row' }, submit)),
  };
}

/* ───── 語文:單字填空(英文打字、日文選假名) ───── */
// 無限題庫:一題接一題,抽完一輪才重新洗牌(同一場考試內不重複)
function stream(list, seen, key) {
  let q = [];
  return () => {
    if (!q.length) { let pool = list.filter((x) => !seen.has(key(x))); if (!pool.length) { seen.clear(); pool = list; } q = rshuffle(pool); }
    const x = q.pop(); seen.add(key(x)); return x;
  };
}
// 限時無限題的共同外殼:q = next() 回傳 {stem,kind,a,opts?};答對題數即成績
function playEndless(ctx, subject, mount, finish, cfg) {
  let done = false, n = 0, right = 0; const log = []; let cur = null;
  const body = el('div', { class: 'stack' }); const prog = el('p', { class: 'persona' }, '');
  const give = (v) => {
    log.push(`${log.length + 1}. ${cur.stem.replace(/\n/g, ' ')} 你的答案 ${v || '(空白)'} ${cfg.same(v, cur) ? '✔' : `✘(正解 ${cur.a})`}`);
    if (cfg.same(v, cur)) right++;
    next();
  };
  const next = () => {
    if (done) return; cur = cfg.next(); n++; prog.textContent = `第 ${n} 題 · ${cur.kind}(不限題數,時間到即交卷)`;
    cfg.render(body, prog, cur, give);
  };
  const end = () => {
    if (done) return; done = true; t.stop();
    const pts = right * cfg.per;
    finish(pts, `${cfg.label},限時內答對 ${right} 題(共作答 ${log.length} 題),每題 ${cfg.per} 分,共 ${pts} 分${pts > 100 ? '(成績單最多計 100 分,芳名錄以實際分數計)' : ''}`, log.length ? log : ['沒有作答任何一題'], pts);
  };
  const f = frame(subject, cfg.label, body, end);
  mount.replaceChildren(f.node);
  const t = countdown(subject.secs, f.bar, f.label, end); next();
  return () => { done = true; t.stop(); };
}
const mcq = (body, prog, q, give, big) => body.replaceChildren(prog, el(big ? 'h2' : 'p', { class: big ? '' : 'scene', style: big ? '' : 'white-space:pre-line;font-size:19px' }, q.stem),
  big ? el('div', { class: 'stack' }, q.opts.map((o, k) => el('button', { class: 'opt', type: 'button', onclick: () => give(o) }, el('b', {}, 'ABCD'[k] + '.'), o)))
    : el('div', { class: 'kanagrid' }, q.opts.map((o) => el('button', { class: 'opt', type: 'button', onclick: () => give(o) }, o))));

function playJp(ctx, subject, mount, finish) {
  const W = ctx.exam.wordsJp, G = ctx.exam.grammarJp;
  const ng = stream(G, ctx.seen.jpg, (x) => x.zh + x.a);
  const nv = stream(W.filter((x) => x.t), ctx.seen.jp, (x) => x.w), nn = stream(W.filter((x) => !x.t), ctx.seen.jp, (x) => x.w);
  const wq = (x) => { const pool = W.filter((y) => y.w !== x.w && !!y.t === !!x.t); return { stem: `「${x.zh}」的日文是?`, kind: x.t ? '動詞・形容詞' : '名詞', a: x.w, opts: rshuffle([x.w, ...rshuffle(pool).slice(0, 3).map((y) => y.w)]) }; };
  return playEndless(ctx, subject, mount, finish, {
    label: '日文(單字・活用・文法)', per: 5, same: (v, q) => v === q.a,
    next: () => { const r = Math.random(); if (r < 0.42) { const g = ng(); return { stem: g.s ? `${g.zh}\n${g.s}` : g.zh, kind: g.s ? '助詞・文法填空' : '活用變化', a: g.a, opts: rshuffle([g.a, ...g.w]) }; } return r < 0.77 ? wq(nv()) : wq(nn()); },
    render: (body, prog, q, give) => mcq(body, prog, q, give, false),
  });
}
function playLang(ctx, subject, mount, finish) {
  if (ctx.lang === 'jp') return playJp(ctx, subject, mount, finish);
  const nw = stream(ctx.exam.wordsEn, ctx.seen.en, (x) => x.w);
  const maskEn = (w) => { const keep = new Set([0]); rshuffle([...w].map((_, k) => k).slice(1)).slice(0, Math.floor(w.length * 0.35)).forEach((k) => keep.add(k)); return [...w].map((c, k) => (keep.has(k) ? c : '_')).join(' '); };
  return playEndless(ctx, subject, mount, finish, {
    label: '英文單字填空', per: 10, same: (v, q) => (v || '').trim().toLowerCase() === q.a,
    next: () => { const w = nw(); return { stem: `${w.zh}(${maskEn(w.w)})`, kind: '單字', a: w.w }; },
    render: (body, prog, q, give) => {
      const input = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': '填入完整單字', class: 'txt' });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') give(input.value); });
      body.replaceChildren(prog, el('div', { class: 'big', style: 'font-size:28px;letter-spacing:4px' }, q.stem.slice(q.stem.indexOf('(') + 1, -1)), el('p', { class: 'lead' }, q.stem.slice(0, q.stem.indexOf('('))), input,
        el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: () => give(input.value) }, '送出(Enter)'), el('button', { class: 'btn ghost', type: 'button', onclick: () => give('') }, '跳過這題')));
      input.focus();
    },
  });
}

/* ───── 數學 B 卷:四則運算湊目標 ───── */
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const frac = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return [n / g, d / g]; };
const fAdd = (a, b) => frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const fSub = (a, b) => frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const fMul = (a, b) => frac(a[0] * b[0], a[1] * b[1]);
const fDiv = (a, b) => (b[0] === 0 ? null : frac(a[0] * b[1], a[1] * b[0]));
// 四個數字能湊出的所有 1–100 整數
function reachable(nums) {
  const out = new Set();
  const go = (list) => {
    if (list.length === 1) { const [n, d] = list[0]; if (d === 1 && n >= 1 && n <= 100) out.add(n); return; }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const rest = list.filter((_, k) => k !== i && k !== j); const a = list[i], b = list[j];
      const cands = [fAdd(a, b), fSub(a, b), fSub(b, a), fMul(a, b), fDiv(a, b), fDiv(b, a)].filter(Boolean);
      cands.forEach((c) => go([...rest, c]));
    }
  };
  go(nums.map((n) => frac(n))); return out;
}
// 解析算式:+ − × ÷ 與括號;回傳 { value: [n,d], used: [數字…] },不合法回傳 null
function evalExpr(src) {
  const t = src.replace(/\s+/g, '').replace(/[×xX*]/g, '*').replace(/[÷/]/g, '/').replace(/[−–-]/g, '-').replace(/[()]/g, (c) => c);
  const toks = t.match(/\d+|[+\-*/()]/g); if (!toks || toks.join('') !== t) return null;
  let p = 0; const used = [];
  const peek = () => toks[p];
  const expr = () => { let v = term(); while (v && (peek() === '+' || peek() === '-')) { const op = toks[p++]; const r = term(); if (!r) return null; v = op === '+' ? fAdd(v, r) : fSub(v, r); } return v; };
  const term = () => { let v = factor(); while (v && (peek() === '*' || peek() === '/')) { const op = toks[p++]; const r = factor(); if (!r) return null; v = op === '*' ? fMul(v, r) : fDiv(v, r); if (!v) return null; } return v; };
  const factor = () => {
    const x = toks[p];
    if (x === undefined) return null;
    if (x === '(') { p++; const v = expr(); if (!v || toks[p] !== ')') return null; p++; return v; }
    if (/^\d+$/.test(x)) { p++; used.push(Number(x)); return frac(Number(x)); }
    return null;
  };
  const v = expr(); if (!v || p !== toks.length) return null;
  return { value: v, used };
}
const sameNumbers = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).every((x, i) => x === [...b].sort((p, q) => p - q)[i]);

function playMathB(ctx, subject, mount, finish) {
  let done = false, solved = 0; const log = [];
  let nums = [], target = 0;
  const newQ = () => {
    for (let k = 0; k < 200; k++) {
      const n = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 10)); const r = [...reachable(n)];
      if (r.length >= 3) { nums = n; target = r[Math.floor(Math.random() * r.length)]; return; }
    }
  };
  const info = el('div', { class: 'big', style: 'font-size:26px' }, ''); const live = el('p', { class: 'persona' }, '');
  const input = el('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': '輸入算式', class: 'txt', placeholder: '例:(3+4)×2-1' });
  const numRow = el('div', { class: 'opgrid' }); const opRow = el('div', { class: 'opgrid' });
  const refresh = () => {
    const r = evalExpr(input.value);
    live.textContent = !input.value.trim() ? '用下面的按鈕或鍵盤組出算式' : r ? `目前算式的值:${r.value[1] === 1 ? r.value[0] : `${r.value[0]}/${r.value[1]}`}` : '算式還不完整';
  };
  const add = (c) => { input.value += c; refresh(); input.focus(); };
  const render = () => {
    info.textContent = `${nums.join('  ')}  →  目標 ${target}`; input.value = ''; refresh();
    numRow.replaceChildren(...nums.map((n) => el('button', { class: 'btn ghost', type: 'button', onclick: () => add(String(n)) }, String(n))));
  };
  ['+', '−', '×', '÷', '(', ')'].forEach((o) => opRow.append(el('button', { class: 'btn ghost', type: 'button', onclick: () => add(o) }, o)));
  const record = (skipped) => {
    const r = evalExpr(input.value); const ok = !skipped && r && r.value[1] === 1 && r.value[0] === target && sameNumbers(r.used, nums);
    if (ok) solved++;
    log.push(`${nums.join('、')} → 目標 ${target}:${skipped ? '換題' : `你的算式 ${input.value.trim() || '(空白)'} ${ok ? '✔' : '✘'}`}`);
    newQ(); render();
  };
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') record(false); });
  const end = () => {
    if (done) return; done = true; t.stop();
    finish(solved * 20, `共解出 ${solved} 題,每題 20 分,共 ${solved * 20} 分${solved > 5 ? '(成績單最多計 100 分,芳名錄以實際分數計)' : ''}`, log.length ? log : ['沒有送出任何一題']);
  };
  newQ();
  const body = el('div', { class: 'stack' }, el('p', { class: 'persona' }, '把 4 個數字各用一次,用 + − × ÷ 與括號算出目標'), info, numRow, opRow, input, live,
    el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: () => record(false) }, '送出,下一題'),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => { input.value = input.value.slice(0, -1); refresh(); input.focus(); } }, '退格'),
      el('button', { class: 'btn ghost', type: 'button', onclick: () => record(true) }, '換一題')));
  const f = frame(subject, '四則運算', body, end);
  mount.replaceChildren(f.node); render();
  const t = countdown(subject.secs, f.bar, f.label, end);
  return () => { done = true; t.stop(); };
}

/* ───── 自然:養貓(穿牆、多種食物、分數無上限) ───── */
function playSci(ctx, subject, mount, finish) {
  const N = 16, C = 22, SIZE = N * C; let done = false;
  const cv = el('canvas', { width: String(SIZE), height: String(SIZE), class: 'snake', 'aria-label': '養貓遊戲畫面' }); const g2 = cv.getContext('2d');
  let cat = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }], dir = { x: 1, y: 0 }, pending = { x: 1, y: 0 }, grow = 0, points = 0;
  const KINDS = { fish: { pts: 1, grow: 1, color: '#6fb7d9', name: '小魚乾' }, can: { pts: 2, grow: 1, color: '#e08a1e', name: '罐頭' }, gold: { pts: 5, grow: 2, color: '#e9c21b', ttl: 6000, name: '金魚' } };
  const eaten = { fish: 0, can: 0, gold: 0 };
  let foods = [];
  const free = () => { for (let n = 0; n < 200; n++) { const p = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; if (!cat.some((s) => s.x === p.x && s.y === p.y) && !foods.some((f) => f.x === p.x && f.y === p.y)) return p; } return { x: 0, y: 0 }; };
  const addFood = (kind) => foods.push({ ...free(), kind, born: Date.now() });
  addFood('fish'); addFood('can');
  const scoreEl = el('p', { class: 'persona' }, '得分 0');
  const turn = (x, y) => { if (x === -dir.x && y === -dir.y) return; pending = { x, y }; };
  const onKey = (e) => { const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[e.key]; if (m) { e.preventDefault(); turn(...m); } };
  document.addEventListener('keydown', onKey);
  const ctr = (p) => [p.x * C + C / 2, p.y * C + C / 2];
  const drawFood = (f) => {
    const [cx, cy] = ctr(f); g2.fillStyle = KINDS[f.kind].color; g2.beginPath();
    if (f.kind === 'can') g2.rect(cx - C * 0.32, cy - C * 0.28, C * 0.64, C * 0.56);
    else { g2.ellipse(cx, cy, C * (f.kind === 'gold' ? 0.44 : 0.36), C * 0.22, 0, 0, 7); g2.moveTo(cx + C * 0.3, cy); g2.lineTo(cx + C * 0.5, cy - C * 0.18); g2.lineTo(cx + C * 0.5, cy + C * 0.18); }
    g2.fill();
  };
  // 貓頭:圓臉、兩隻尖耳朵、眼睛、粉紅鼻子
  const drawHead = (p) => {
    const [cx, cy] = ctr(p); const r = C * 0.46;
    g2.fillStyle = '#f0a955';
    g2.beginPath(); g2.moveTo(cx - r * 0.95, cy - r * 0.2); g2.lineTo(cx - r * 0.7, cy - r * 1.25); g2.lineTo(cx - r * 0.05, cy - r * 0.7); g2.fill();
    g2.beginPath(); g2.moveTo(cx + r * 0.95, cy - r * 0.2); g2.lineTo(cx + r * 0.7, cy - r * 1.25); g2.lineTo(cx + r * 0.05, cy - r * 0.7); g2.fill();
    g2.beginPath(); g2.arc(cx, cy, r, 0, 7); g2.fill();
    g2.fillStyle = '#2b2b2b'; g2.beginPath(); g2.arc(cx - r * 0.38, cy - r * 0.1, r * 0.14, 0, 7); g2.arc(cx + r * 0.38, cy - r * 0.1, r * 0.14, 0, 7); g2.fill();
    g2.fillStyle = '#e8788a'; g2.beginPath(); g2.moveTo(cx - r * 0.12, cy + r * 0.15); g2.lineTo(cx + r * 0.12, cy + r * 0.15); g2.lineTo(cx, cy + r * 0.3); g2.fill();
  };
  const draw = () => {
    g2.fillStyle = '#f6efe2'; g2.fillRect(0, 0, SIZE, SIZE);
    foods.forEach(drawFood);
    cat.forEach((s, k) => { if (k === 0) return; g2.fillStyle = k % 2 ? '#e69a3c' : '#f0a955'; g2.fillRect(s.x * C + 1, s.y * C + 1, C - 2, C - 2); });
    drawHead(cat[0]);
  };
  const step = () => {
    if (done) return; dir = pending;
    const h = { x: (cat[0].x + dir.x + N) % N, y: (cat[0].y + dir.y + N) % N };
    const body = grow > 0 ? cat : cat.slice(0, -1);
    if (body.some((s) => s.x === h.x && s.y === h.y)) return end('貓撞到自己的身體了');
    cat.unshift(h); if (grow > 0) grow--; else cat.pop();
    const k = foods.findIndex((f) => f.x === h.x && f.y === h.y);
    if (k >= 0) { const f = foods.splice(k, 1)[0]; points += KINDS[f.kind].pts; grow += KINDS[f.kind].grow; eaten[f.kind]++; scoreEl.textContent = `得分 ${points}`; if (f.kind !== 'gold') addFood(f.kind); }
    foods = foods.filter((f) => !KINDS[f.kind].ttl || Date.now() - f.born < KINDS[f.kind].ttl);
    if (!foods.some((f) => f.kind === 'gold') && Math.random() < 0.02) addFood('gold');
    draw();
  };
  const loop = setInterval(step, 130);
  const end = (why) => {
    if (done) return; done = true; clearInterval(loop); t.stop(); document.removeEventListener('keydown', onKey);
    finish(points * 2, `${why || '時間到'},共得 ${points} 分(換算 ${points * 2} 分,沒有上限)`,
      [`結束原因:${why || '時間到'}`, `小魚乾 ${eaten.fish} 條(各 1 分)、罐頭 ${eaten.can} 罐(各 2 分)、金魚 ${eaten.gold} 條(各 5 分)`, `貓的長度:${cat.length} 格`]);
  };
  const pad = el('div', { class: 'dpad' },
    el('button', { type: 'button', class: 'btn ghost', 'aria-label': '上', onclick: () => turn(0, -1) }, '↑'),
    el('div', {}, el('button', { type: 'button', class: 'btn ghost', 'aria-label': '左', onclick: () => turn(-1, 0) }, '←'), el('button', { type: 'button', class: 'btn ghost', 'aria-label': '下', onclick: () => turn(0, 1) }, '↓'), el('button', { type: 'button', class: 'btn ghost', 'aria-label': '右', onclick: () => turn(1, 0) }, '→')));
  const f = frame(subject, '養貓', el('div', { class: 'stack' }, scoreEl, cv, pad), () => end('中途交卷'));
  mount.replaceChildren(f.node); draw();
  const t = countdown(subject.secs, f.bar, f.label, () => end('時間到'));
  return () => { done = true; clearInterval(loop); t.stop(); document.removeEventListener('keydown', onKey); };
}

/* ───── 社會:五題歷史題(前四題各 25 分,第五題加分題) ───── */
function playSoc(ctx, subject, mount, finish) {
  const ns = stream(ctx.exam.social, ctx.seen.soc, (x) => x.q);
  return playEndless(ctx, subject, mount, finish, {
    label: '歷史題', per: 5, same: (v, q) => v === q.a,
    next: () => { const x = ns(); return { stem: x.q, kind: x.hard ? '較難' : '歷史', a: x.right, opts: rshuffle([x.right, ...x.wrong]) }; },
    render: (body, prog, q, give) => mcq(body, prog, q, give, true),
  });
}
const PLAYERS = { lang: playLang, math: playMathB, sci: playSci, soc: playSoc };

/* ───── 考場:四科並排、跳過、補考、查看結果、成績單 ───── */
const Exam = {
  // exam: exam.json;careerLabel(c): 志向文字;onDone({ scores, career, top, second })
  run(exam, careerLabel, onDone) {
    const state = Object.fromEntries(SUBJECT_ORDER.map((id) => [id, { status: 'todo', score: 0, note: '', detail: [] }]));
    const seen = { en: new Set(), jp: new Set(), jpg: new Set(), soc: new Set(), socHard: new Set() };
    let cleanup = null;
    const stop = () => { if (cleanup) { cleanup(); cleanup = null; } };
    const hub = () => {
      stop();
      const allDecided = SUBJECT_ORDER.every((id) => state[id].status !== 'todo');
      const cols = SUBJECTS.map((s) => {
        const st0 = state[s.id];
        const status = st0.status === 'taken' ? '已交卷' : st0.status === 'skipped' ? '已跳過' : '尚未作答';
        return el('div', { class: 'card examcol' },
          el('div', { class: 'subj' }, s.name), el('p', { class: 'persona' }, status),
          el('button', { class: 'btn', type: 'button', onclick: () => intro(s) }, st0.status === 'taken' ? '補考' : '應考'),
          st0.status === 'taken' ? el('button', { class: 'btn ghost', type: 'button', onclick: () => viewResult(s) }, '查看考試結果') : null,
          st0.status === 'todo' ? el('button', { class: 'btn ghost', type: 'button', onclick: () => { st0.status = 'skipped'; st0.score = 0; st0.detail = []; hub(); } }, '跳過') : null);
      });
      const goBtn = el('button', { class: 'btn', type: 'button', onclick: () => { if (allDecided) report(); } }, allDecided ? '公布成績單' : '每科都應考或跳過後,才能公布成績單');
      goBtn.disabled = !allDecided;
      show(el('h2', {}, '命運的考場'), el('p', { class: 'lead' }, '求學階段,你要面對四科考試。每科一次,可以跳過,也可以單科補考(以最後一次為準)。交卷後的成績,會決定你走上的志向。'),
        el('div', { class: 'examgrid' }, cols), el('div', { class: 'row' }, goBtn, typeof Hall !== 'undefined' && Hall.on ? el('button', { class: 'btn ghost', type: 'button', onclick: () => Hall.page(null, hub) }, '芳名錄') : null));
    };
    const intro = (s) => {
      const startBtns = s.id === 'lang'
        ? [el('button', { class: 'btn', type: 'button', onclick: () => start(s, { lang: 'en' }) }, '用英文應考'), el('button', { class: 'btn', type: 'button', onclick: () => start(s, { lang: 'jp' }) }, '用日文應考')]
        : [el('button', { class: 'btn', type: 'button', onclick: () => start(s) }, '開始作答')];
      show(el('p', { class: 'persona' }, `${s.name}科`), el('h2', {}, '考卷在你面前攤開'), el('p', { class: 'scene', style: 'white-space:pre-line' }, s.intro),
        el('p', { class: 'persona' }, '作答時不會告訴你對錯;交卷後回到考場,按「查看考試結果」才看得到。'),
        el('div', { class: 'row' }, ...startBtns, el('button', { class: 'btn ghost', type: 'button', onclick: hub }, '回考場')));
    };
    const start = (s, opt = {}) => {
      const mount = el('div'); show(mount);
      cleanup = PLAYERS[s.id]({ exam, seen, ...opt }, s, mount, (score, note, detail, raw) => {
        cleanup = null; state[s.id] = { status: 'taken', score: Math.min(100, score), note, detail };
        const board = s.id === 'lang' ? `lang_${opt.lang}` : s.id;
        if (typeof Hall !== 'undefined') Hall.offer(board, raw === undefined ? score : raw, hub); else hub();
      });
    };
    const viewResult = (s) => {
      const r = state[s.id];
      show(el('p', { class: 'persona' }, `${s.name}科 · 考試結果`), el('div', { class: 'big' }, `${r.score} 分`), el('p', { class: 'lead' }, r.note),
        el('ol', { class: 'detail' }, r.detail.map((x) => el('li', {}, x))),
        el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: hub }, '回考場'), el('button', { class: 'btn ghost', type: 'button', onclick: () => intro(s) }, '補考(這次成績作廢)')));
    };
    const report = () => {
      const scores = Object.fromEntries(SUBJECT_ORDER.map((id) => [id, state[id].score]));
      const r = careerFromScores(scores); const name = (id) => SUBJECTS.find((s) => s.id === id).name;
      show(el('p', { class: 'persona' }, '成績單'), el('h2', {}, '考試結束'),
        el('div', { class: 'card' }, SUBJECT_ORDER.map((id) => el('p', {}, `${name(id)}:${scores[id]} 分${state[id].status === 'skipped' ? '(跳過)' : ''}`))),
        el('p', { class: 'scene' }, `老師看著成績單說:你最擅長${name(r.top)},其次是${name(r.second)}。你最適合的志向是——「${careerLabel(r.career)}」。`),
        el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: () => onDone({ scores, ...r }) }, '帶著成績單出發'), el('button', { class: 'btn ghost', type: 'button', onclick: hub }, '回考場(補考)')));
    };
    hub();
  },
};
