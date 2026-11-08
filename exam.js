'use strict';
/* 命運的考場:四科小遊戲,依成績決定志向。
   依賴 game.js 先定義的全域函式 el()、show()(兩個檔案共用同一個頁面)。
   考試過程不告知對錯;交卷後回到考場,再由「查看考試結果」看分數與逐題對照。 */
const SUBJECTS = [
  { id: 'lang', name: '語文', secs: 100, intro: '限時 100 秒,共 12 題單字填空。可以選英文或日文。' },
  { id: 'math', name: '數學', secs: 120, intro: '限時 120 秒。電腦想了 4 個「不含 0、不重複」的數字(1 到 9)。每次猜 4 個數字,A 是數字和位置都對,B 是數字對但位置不對。' },
  { id: 'sci', name: '自然', secs: 60, intro: '限時 60 秒的貪食蛇。方向鍵或螢幕按鈕控制;牆壁會穿過去,撞到自己或時間到就結算。綠色 1 分、橘色 2 分、金蛋 5 分(只出現幾秒)。分數沒有上限。' },
  { id: 'soc', name: '社會', secs: 60, intro: '限時 60 秒,三題歷史題,四選一,題目取自台灣事件簿。' },
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
function playLang(ctx, subject, mount, finish) {
  const jp = ctx.lang === 'jp';
  const words = pickFresh(jp ? ctx.exam.wordsJp : ctx.exam.wordsEn, 12, jp ? ctx.seen.jp : ctx.seen.en, (x) => x.w);
  let i = 0, done = false; const answers = [];
  const prog = el('p', { class: 'persona' }, ''); const hint = el('div', { class: 'big', style: 'font-size:28px;letter-spacing:4px' }, ''); const zh = el('p', { class: 'lead' }, '');
  const body = el('div', { class: 'stack' });
  const KANA = { hira: [...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'], kata: [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン'] };
  let cur = null, blank = -1, opts = [];
  const maskEn = (w) => { const keep = new Set([0]); rshuffle([...w].map((_, k) => k).slice(1)).slice(0, Math.floor(w.length * 0.35)).forEach((k) => keep.add(k)); return [...w].map((c, k) => (keep.has(k) ? c : '_')).join(' '); };
  const next = () => {
    if (i >= words.length) return end();
    cur = words[i]; prog.textContent = `第 ${i + 1} / ${words.length} 題`; zh.textContent = cur.zh;
    if (jp) {
      const chars = [...cur.w]; const isKata = /[ァ-ヶ]/.test(cur.w[0]); const set = isKata ? KANA.kata : KANA.hira;
      const cand = chars.map((c, k) => k).filter((k) => set.includes(chars[k])); blank = cand[Math.floor(Math.random() * cand.length)];
      hint.textContent = chars.map((c, k) => (k === blank ? '＿' : c)).join(' ');
      opts = rshuffle([chars[blank], ...rshuffle(set.filter((c) => c !== chars[blank])).slice(0, 3)]);
      body.replaceChildren(prog, hint, zh, el('div', { class: 'kanagrid' }, opts.map((o) => el('button', { class: 'opt', type: 'button', onclick: () => answer(o) }, o))));
    } else {
      hint.textContent = maskEn(cur.w);
      const input = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', 'aria-label': '填入完整單字', class: 'txt' });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') answer(input.value); });
      body.replaceChildren(prog, hint, zh, input, el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: () => answer(input.value) }, '送出(Enter)'), el('button', { class: 'btn ghost', type: 'button', onclick: () => answer('') }, '跳過這題')));
      input.focus();
    }
  };
  const answer = (v) => { answers.push({ w: cur, blank, given: v }); i++; next(); };
  const isRight = (a) => (jp ? a.given === [...a.w.w][a.blank] : a.given.trim().toLowerCase() === a.w.w);
  const end = () => {
    if (done) return; done = true; t.stop();
    const right = answers.filter(isRight).length;
    const detail = words.map((w, k) => {
      const a = answers[k];
      if (!a) return `${k + 1}. ${w.zh}(${w.w}):未作答 ✘`;
      const mine = jp ? (a.given || '(空白)') : (a.given.trim() || '(空白)');
      return `${k + 1}. ${w.zh}(${w.w}):你的答案 ${mine} ${isRight(a) ? '✔' : '✘'}`;
    });
    finish(Math.round((right / words.length) * 100), `${jp ? '日文' : '英文'},答對 ${right} / ${words.length} 題`, detail);
  };
  const f = frame(subject, jp ? '日文單字填空' : '英文單字填空', body, end);
  mount.replaceChildren(f.node);
  const t = countdown(subject.secs, f.bar, f.label, end); next();
  return () => { done = true; t.stop(); };
}

/* ───── 數學:猜數字 4A0B(1–9、不重複) ───── */
function playMath(ctx, subject, mount, finish) {
  const secret = rshuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4); const guesses = []; let done = false;
  const input = el('input', { type: 'text', inputmode: 'numeric', maxlength: '4', autocomplete: 'off', 'aria-label': '輸入 4 個數字', class: 'txt' });
  const log = el('ol', { class: 'guesslog' }); const msg = el('p', { class: 'persona' }, '');
  const judge = (g) => { let a = 0, b = 0; g.forEach((d, k) => { if (d === secret[k]) a++; else if (secret.includes(d)) b++; }); return [a, b]; };
  const submit = () => {
    const s = input.value.trim();
    if (!/^[1-9]{4}$/.test(s) || new Set(s).size !== 4) { msg.textContent = '請輸入 4 個 1 到 9 的數字,不含 0、不重複'; return; }
    const g = [...s].map(Number); const [a, b] = judge(g); guesses.push({ s, a, b }); msg.textContent = '';
    log.prepend(el('li', {}, `${s}  →  ${a}A${b}B`)); input.value = '';
    if (a === 4) end();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  const score = () => {
    const solved = guesses.some((g) => g.a === 4);
    if (solved) { const n = guesses.length; return n <= 4 ? 100 : n <= 6 ? 85 : n <= 8 ? 70 : n <= 10 ? 55 : n <= 12 ? 40 : 30; }
    const best = guesses.reduce((m, g) => Math.max(m, 15 * g.a + 5 * g.b), 0);
    return clamp(best > 0 ? 20 + best : 0, 0, 60);
  };
  const end = () => {
    if (done) return; done = true; t.stop(); const solved = guesses.some((g) => g.a === 4);
    finish(score(), solved ? `猜了 ${guesses.length} 次猜中` : `沒有猜中,共猜了 ${guesses.length} 次`,
      [`正確答案:${secret.join('')}`, ...guesses.map((g, k) => `第 ${k + 1} 次:${g.s} → ${g.a}A${g.b}B`)]);
  };
  const f = frame(subject, '猜數字 4A0B', el('div', { class: 'stack' }, el('p', { class: 'persona' }, '數字 1–9,不含 0、不重複'), input, el('button', { class: 'btn', type: 'button', onclick: submit }, '猜'), msg, log), end);
  mount.replaceChildren(f.node);
  const t = countdown(subject.secs, f.bar, f.label, end); input.focus();
  return () => { done = true; t.stop(); };
}

/* ───── 自然:貪食蛇(穿牆、多種食物、分數無上限) ───── */
function playSci(ctx, subject, mount, finish) {
  const N = 20, C = 17, SIZE = N * C; let done = false;
  const cv = el('canvas', { width: String(SIZE), height: String(SIZE), class: 'snake', 'aria-label': '貪食蛇遊戲畫面' }); const g2 = cv.getContext('2d');
  let snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], dir = { x: 1, y: 0 }, pending = { x: 1, y: 0 }, grow = 0, points = 0;
  const KINDS = { green: { pts: 1, grow: 1, color: '#3f9d5a' }, orange: { pts: 2, grow: 1, color: '#e08a1e' }, gold: { pts: 5, grow: 2, color: '#e9c21b', ttl: 6000 } };
  const eaten = { green: 0, orange: 0, gold: 0 };
  let foods = [];
  const free = () => { for (let n = 0; n < 200; n++) { const p = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; if (!snake.some((s) => s.x === p.x && s.y === p.y) && !foods.some((f) => f.x === p.x && f.y === p.y)) return p; } return { x: 0, y: 0 }; };
  const addFood = (kind) => foods.push({ ...free(), kind, born: Date.now() });
  addFood('green'); addFood('orange');
  const scoreEl = el('p', { class: 'persona' }, '得分 0');
  const turn = (x, y) => { if (x === -dir.x && y === -dir.y) return; pending = { x, y }; };
  const onKey = (e) => { const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[e.key]; if (m) { e.preventDefault(); turn(...m); } };
  document.addEventListener('keydown', onKey);
  const draw = () => {
    g2.fillStyle = '#1f2a24'; g2.fillRect(0, 0, SIZE, SIZE);
    foods.forEach((f) => { g2.fillStyle = KINDS[f.kind].color; g2.beginPath(); g2.arc(f.x * C + C / 2, f.y * C + C / 2, f.kind === 'gold' ? C * 0.46 : C * 0.38, 0, 7); g2.fill(); });
    snake.forEach((s, k) => { g2.fillStyle = k === 0 ? '#9fe3b4' : '#5fbf84'; g2.fillRect(s.x * C + 1, s.y * C + 1, C - 2, C - 2); });
  };
  const step = () => {
    if (done) return; dir = pending;
    const h = { x: (snake[0].x + dir.x + N) % N, y: (snake[0].y + dir.y + N) % N };
    const body = grow > 0 ? snake : snake.slice(0, -1);
    if (body.some((s) => s.x === h.x && s.y === h.y)) return end('撞到自己了');
    snake.unshift(h); if (grow > 0) grow--; else snake.pop();
    const k = foods.findIndex((f) => f.x === h.x && f.y === h.y);
    if (k >= 0) { const f = foods.splice(k, 1)[0]; points += KINDS[f.kind].pts; grow += KINDS[f.kind].grow; eaten[f.kind]++; scoreEl.textContent = `得分 ${points}`; if (f.kind !== 'gold') addFood(f.kind); }
    foods = foods.filter((f) => !KINDS[f.kind].ttl || Date.now() - f.born < KINDS[f.kind].ttl);
    if (!foods.some((f) => f.kind === 'gold') && Math.random() < 0.02) addFood('gold');
    draw();
  };
  const loop = setInterval(step, 120);
  const end = (why) => {
    if (done) return; done = true; clearInterval(loop); t.stop(); document.removeEventListener('keydown', onKey);
    finish(points * 4, `${why || '時間到'},共得 ${points} 分(換算 ${points * 4} 分,沒有上限)`,
      [`結束原因:${why || '時間到'}`, `綠 ${eaten.green} 顆(各 1 分)、橘 ${eaten.orange} 顆(各 2 分)、金蛋 ${eaten.gold} 顆(各 5 分)`, `蛇的長度:${snake.length}`]);
  };
  const pad = el('div', { class: 'dpad' },
    el('button', { type: 'button', class: 'btn ghost', 'aria-label': '上', onclick: () => turn(0, -1) }, '↑'),
    el('div', {}, el('button', { type: 'button', class: 'btn ghost', 'aria-label': '左', onclick: () => turn(-1, 0) }, '←'), el('button', { type: 'button', class: 'btn ghost', 'aria-label': '下', onclick: () => turn(0, 1) }, '↓'), el('button', { type: 'button', class: 'btn ghost', 'aria-label': '右', onclick: () => turn(1, 0) }, '→')));
  const f = frame(subject, '貪食蛇', el('div', { class: 'stack' }, scoreEl, cv, pad), () => end('中途交卷'));
  mount.replaceChildren(f.node); draw();
  const t = countdown(subject.secs, f.bar, f.label, () => end('時間到'));
  return () => { done = true; clearInterval(loop); t.stop(); document.removeEventListener('keydown', onKey); };
}

/* ───── 社會:三題歷史題(作答時不告知對錯) ───── */
function playSoc(ctx, subject, mount, finish) {
  const qs = pickFresh(ctx.exam.social, 3, ctx.seen.soc, (x) => x.q); let i = 0, done = false; const picks = [];
  const box = el('div', { class: 'stack' }); let shown = [];
  const end = () => {
    if (done) return; done = true; t.stop();
    const right = qs.filter((q, k) => picks[k] === q.right).length;
    finish(Math.round((right / qs.length) * 100), `答對 ${right} / ${qs.length} 題`,
      qs.map((q, k) => `${k + 1}. ${q.q} 你的答案:${picks[k] || '未作答'}(正解:${q.right})${picks[k] === q.right ? ' ✔' : ' ✘'}`));
  };
  const show1 = () => {
    if (i >= qs.length) return end();
    const q = qs[i]; shown = rshuffle([q.right, ...q.wrong]);
    box.replaceChildren(el('p', { class: 'persona' }, `第 ${i + 1} / ${qs.length} 題`), el('h2', {}, q.q),
      ...shown.map((o, k) => el('button', { class: 'opt', type: 'button', onclick: () => { picks[i] = o; i++; show1(); } }, el('b', {}, 'ABCD'[k] + '.'), o)));
  };
  const f = frame(subject, '歷史題', box, end);
  mount.replaceChildren(f.node);
  const t = countdown(subject.secs, f.bar, f.label, end); show1();
  return () => { done = true; t.stop(); };
}

const PLAYERS = { lang: playLang, math: playMath, sci: playSci, soc: playSoc };

/* ───── 考場:四科並排、跳過、補考、查看結果、成績單 ───── */
const Exam = {
  // exam: exam.json;careerLabel(c): 志向文字;onDone({ scores, career, top, second })
  run(exam, careerLabel, onDone) {
    const state = Object.fromEntries(SUBJECT_ORDER.map((id) => [id, { status: 'todo', score: 0, note: '', detail: [] }]));
    const seen = { en: new Set(), jp: new Set(), soc: new Set() };
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
        el('div', { class: 'examgrid' }, cols), el('div', { class: 'row' }, goBtn));
    };
    const intro = (s) => {
      const startBtns = s.id === 'lang'
        ? [el('button', { class: 'btn', type: 'button', onclick: () => start(s, 'en') }, '用英文應考'), el('button', { class: 'btn', type: 'button', onclick: () => start(s, 'jp') }, '用日文應考')]
        : [el('button', { class: 'btn', type: 'button', onclick: () => start(s) }, '開始作答')];
      show(el('p', { class: 'persona' }, `${s.name}科`), el('h2', {}, '考卷在你面前攤開'), el('p', { class: 'scene' }, s.intro),
        el('p', { class: 'persona' }, '作答時不會告訴你對錯;交卷後回到考場,按「查看考試結果」才看得到。'),
        el('div', { class: 'row' }, ...startBtns, el('button', { class: 'btn ghost', type: 'button', onclick: hub }, '回考場')));
    };
    const start = (s, lang) => {
      const mount = el('div'); show(mount);
      cleanup = PLAYERS[s.id]({ exam, seen, lang }, s, mount, (score, note, detail) => {
        cleanup = null; state[s.id] = { status: 'taken', score, note, detail }; hub();
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
