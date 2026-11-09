'use strict';
/* 芳名錄:每科一張榜,各取前五名。以 Supabase REST (fetch) 存取,沒有任何外部函式庫。
   需要 el()、show()(game.js)。設定見 hall-config.js、docs/hall-setup.md。 */
const HALL_SUBJECTS = [['lang_en', '語文科・英文', '分數'], ['lang_jp', '語文科・日文', '分數'], ['math', '數學科', '分數'], ['sci', '自然科', '分數'], ['soc', '社會科', '分數']];
const Hall = {
  get on() { const c = window.HALL_CONFIG || {}; return !!(c.url && c.key); },
  _h() { const c = window.HALL_CONFIG; return { apikey: c.key, Authorization: `Bearer ${c.key}`, 'Content-Type': 'application/json' }; },
  async top(subject, n = 5) {
    const c = window.HALL_CONFIG;
    const r = await fetch(`${c.url}/rest/v1/hall?subject=eq.${encodeURIComponent(subject)}&select=name,score,created_at&order=score.desc,created_at.asc&limit=${n}`, { headers: this._h() });
    if (!r.ok) throw new Error('讀取失敗');
    return r.json();
  },
  async submit(subject, name, score) {
    const c = window.HALL_CONFIG;
    const r = await fetch(`${c.url}/rest/v1/hall`, { method: 'POST', headers: { ...this._h(), Prefer: 'return=minimal' }, body: JSON.stringify({ subject, name, score }) });
    if (!r.ok) throw new Error('送出失敗');
  },
  qualifies(rows, score) { return score > 0 && (rows.length < 5 || score > rows[rows.length - 1].score); },
  // 顯示「進榜」頁:輸入名字後送出;done() 回到考場
  async offer(subjectId, raw, done) {
    const meta = HALL_SUBJECTS.find((x) => x[0] === subjectId);
    if (!this.on || !(raw > 0)) return done();
    show(el('p', { class: 'lead' }, '正在查詢芳名錄…'));
    let rows;
    try { rows = await this.top(subjectId); } catch (e) { return done(); }
    if (!this.qualifies(rows, raw)) return done();
    const input = el('input', { type: 'text', maxlength: '12', autocomplete: 'off', class: 'txt', 'aria-label': '你的名字(最多 12 字)', placeholder: '名字或暱稱' });
    const msg = el('p', { class: 'err', role: 'alert' });
    const send = el('button', { class: 'btn', type: 'button', onclick: async () => {
      const name = input.value.trim();
      if (!name) { msg.textContent = '請輸入名字,或選擇「不留名」。'; return; }
      send.disabled = true; msg.textContent = '';
      try { await this.submit(subjectId, name, raw); this.page(subjectId, done); } catch (e) { msg.textContent = '送出失敗,請稍後再試。'; send.disabled = false; }
    } }, '留名到芳名錄');
    show(el('p', { class: 'persona' }, `${meta[1]} · 芳名錄`), el('h2', {}, `恭喜!你的${meta[2]} ${raw},進入前五名`),
      el('p', { class: 'lead' }, '要不要把名字寫在芳名錄上?送出後全站玩家都看得到。請不要使用真實姓名以外的個資,也不要輸入不當字詞;站長可能移除不適當的名字。只會送出你輸入的名字、科目和成績。'),
      input, msg, el('div', { class: 'row' }, send, el('button', { class: 'btn ghost', type: 'button', onclick: done }, '不留名')));
  },
  // 芳名錄頁:四科各前五名
  async page(focus, back) {
    show(el('p', { class: 'lead' }, '正在讀取芳名錄…'));
    const cards = [];
    for (const [id, name, unit] of HALL_SUBJECTS) {
      let rows = null; try { rows = await this.top(id); } catch (e) { /* 顯示讀取失敗 */ }
      cards.push(el('div', { class: 'card', style: id === focus ? 'border-color:var(--accent)' : '' }, el('h3', {}, `${name}(${unit})`),
        rows === null ? el('p', { class: 'err' }, '讀取失敗') : rows.length ? el('ol', { class: 'detail' }, rows.map((r) => el('li', {}, `${r.name}:${r.score}`))) : el('p', { class: 'persona' }, '還沒有人留名,等你來寫下第一筆。')));
    }
    show(el('h2', {}, '芳名錄'), el('p', { class: 'lead' }, '每一科的前五名。'), el('div', { class: 'stack' }, cards), el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: back }, '回上一頁')));
  },
};
