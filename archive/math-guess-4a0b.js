'use strict';
/* 暫存區:數學 A 卷「猜數字 4A0B」。2026-11 暫時下架,日後要再用時:
   1) 把下面的 playMathA 貼回 exam.js(放在 playMathB 之前);
   2) PLAYERS.math 改回以 ctx.variant 區分 A/B;intro() 的數學按鈕加回「A 卷:猜數字」;SUBJECTS.math.intro 補回 A 卷說明。
   計分規則:8 次內猜中 100 分,每多猜 1 次扣 10 分,猜中最低 80 分;未猜中依最接近的一次給部分分(最高 60)。
   依賴 exam.js 的 el、rshuffle、clamp、frame、countdown。 */
/* ───── 數學:猜數字 4A0B(1–9、不重複) ───── */
function playMathA(ctx, subject, mount, finish) {
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
    if (solved) return clamp(100 - (guesses.length - 8) * 10, 80, 100);   // 8 次內猜中滿分,每多猜 1 次扣 10 分,只要猜中最低 80 分
    const best = guesses.reduce((m, g) => Math.max(m, 15 * g.a + 5 * g.b), 0);
    return clamp(best > 0 ? 20 + best : 0, 0, 60);
  };
  const end = () => {
    if (done) return; done = true; t.stop(); const solved = guesses.some((g) => g.a === 4);
    finish(score(), solved ? `猜了 ${guesses.length} 次猜中` : `沒有猜中,共猜了 ${guesses.length} 次`,
      [`正確答案:${secret.join('')}`, ...guesses.map((g, k) => `第 ${k + 1} 次:${g.s} → ${g.a}A${g.b}B`)]);
  };
  const f = frame(subject, 'A 卷 · 猜數字 4A0B', el('div', { class: 'stack' }, el('p', { class: 'persona' }, '數字 1–9,不含 0、不重複'), input, el('button', { class: 'btn', type: 'button', onclick: submit }, '猜'), msg, log), end);
  mount.replaceChildren(f.node);
  const t = countdown(subject.secs, f.bar, f.label, end); input.focus();
  return () => { done = true; t.stop(); };
}


