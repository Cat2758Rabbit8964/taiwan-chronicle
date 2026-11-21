'use strict';
/* 芳名錄:每科一張榜,各取前五名。以 Supabase REST (fetch) 存取,沒有任何外部函式庫。
   需要 el()、show()(game.js)。設定見 hall-config.js、docs/hall-setup.md。 */
const HALL_SUBJECTS = [['lang_en', '語文科・英文', '分數'], ['lang_jp', '語文科・日文', '分數'], ['math', '數學科', '分數'], ['sci', '自然科', '分數'], ['soc', '社會科', '分數'], ['xj', '逃脫・新疆', '階數'], ['tb', '逃脫・西藏', '階數'], ['music', '音樂科', '分數']];
const Hall = {
  id: null,     // 登入的遊戲 ID(訪客為 null);只用來向伺服器證明身分,不會顯示
  nick: null,   // 登入後由 game.js 設定:有綽號就用綽號留名
  get on() { const c = window.HALL_CONFIG || {}; return !!(c.url && c.key); },
  _h() { const c = window.HALL_CONFIG; return { apikey: c.key, Authorization: `Bearer ${c.key}`, 'Content-Type': 'application/json' }; },
  _best: {},
  // 目前登入者在這一科的最高紀錄(依榜上的名字比對);訪客或讀取失敗回傳 null
  async best(subject) {
    if (!this.on || !this.id || !this.nick) return null;
    const k = `${subject}|${this.nick}`;
    if (k in this._best) return this._best[k];
    const c = window.HALL_CONFIG;
    try {
      const r = await fetch(`${c.url}/rest/v1/hall_board?subject=eq.${encodeURIComponent(subject)}&name=eq.${encodeURIComponent(this.nick)}&select=score&order=score.desc&limit=1`, { headers: this._h() });
      if (!r.ok) return null;
      const rows = await r.json();
      return (this._best[k] = rows.length ? rows[0].score : 0);
    } catch (e) { return null; }
  },
  // 結算畫面的「加進芳名錄」按鈕:沒破自己的紀錄時,改顯示「您的紀錄:N 分」,點了沒有反應
  joinBtn(subject, score, unit, join) {
    let locked = false;
    const b = el('button', { class: 'btn ghost', type: 'button', onclick: () => { if (!locked) join(); } }, '加進芳名錄');
    this.best(subject).then((v) => {
      if (v !== null && v >= score && b.isConnected !== false) { locked = true; b.textContent = `您的紀錄:${v} ${unit}`; b.classList.add('is-static'); b.setAttribute('aria-disabled', 'true'); }
    });
    return b;
  },
  // 結算後的詢問視窗只在破了自己的紀錄(或沒有紀錄)時才跳出
  async worthAsking(subject, score) { const v = await this.best(subject); return v === null || v < score; },
  async top(subject, n = 5) {
    const c = window.HALL_CONFIG;
    const r = await fetch(`${c.url}/rest/v1/hall_board?subject=eq.${encodeURIComponent(subject)}&select=name,score,note,created_at&order=score.desc,created_at.asc&limit=${n}`, { headers: this._h() });
    if (!r.ok) throw new Error('讀取失敗');
    return r.json();
  },
  // 以遊戲 ID 留名:每個帳號在每個科目只有一筆,只在新成績較高時更新。回傳 'saved' 或 'kept'(沒有超過自己的紀錄)
  async submit(subject, score, note) {
    const c = window.HALL_CONFIG;
    const r = await fetch(`${c.url}/rest/v1/rpc/hall_submit`, { method: 'POST', headers: this._h(), body: JSON.stringify({ p_id: this.id, p_subject: subject, p_name: this.nick, p_score: score, p_note: note || null }) });
    if (!r.ok) throw new Error('送出失敗');
    this._best = {};
    return r.json();
  },
  qualifies(rows, score) { return score > 0 && (rows.length < 5 || score > rows[rows.length - 1].score); },
  // 顯示「進榜」頁;done() 回到考場。只有登入遊戲 ID 的玩家能留名(訪客不能)。say=true:玩家剛按了「加進芳名錄」
  async offer(subjectId, raw, done, say, note) {
    const meta = HALL_SUBJECTS.find((x) => x[0] === subjectId);
    if (!this.on || !(raw > 0)) return done();
    show(el('p', { class: 'lead' }, '正在查詢芳名錄…'));
    let rows;
    try { rows = await this.top(subjectId); } catch (e) { return done(); }
    const notice = (title, text) => show(el('p', { class: 'persona' }, `${meta[1]} · 芳名錄`), el('h2', {}, title), el('p', { class: 'lead' }, text),
      el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: () => this.page(subjectId, done) }, '看芳名錄'), el('button', { class: 'btn ghost', type: 'button', onclick: done }, '返回')));
    if (!this.qualifies(rows, raw)) {
      if (!say) return done();
      return notice('這次還沒進前五名', `芳名錄只收各榜前五名。你這次的成績是 ${raw},再接再厲。`);
    }
    if (!this.id) return notice('登入遊戲 ID 才能留名', `你的成績 ${raw} 已經進得了前五名,但訪客不能上芳名錄。回到開頭用遊戲 ID 登入(或新建一個),下次就能留名。`);
    const mine = rows.find((r) => r.name === this.nick);
    if (mine && mine.score >= raw) { if (!say) return done(); return notice('還沒破你自己的紀錄', `你在這一科的最高紀錄是 ${mine.score},這次是 ${raw}。每個人在每一科只留最高分。`); }
    const go = async (btn) => {
      btn.disabled = true;
      try { const res = await this.submit(subjectId, raw, note); if (res === 'kept') return notice('還沒破你自己的紀錄', '每個人在每一科只留最高分,這次沒有超過你之前的紀錄。'); this.page(subjectId, done); }
      catch (e) { show(el('p', { class: 'err', role: 'alert' }, '送出失敗,請稍後再試。'), el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: done }, '返回'))); }
    };
    if (say) { const tmp = { disabled: false }; return go(tmp); }
    const send = el('button', { class: 'btn', type: 'button', onclick: () => go(send) }, `以「${this.nick}」留名`);
    show(el('p', { class: 'persona' }, `${meta[1]} · 芳名錄`), el('h2', {}, `恭喜!你的${meta[2]} ${raw},進入前五名`),
      el('p', { class: 'lead' }, '要不要把綽號寫在芳名錄上?送出後全站玩家都看得到;每個人在每一科只留最高分。只會送出你的綽號、科目和成績。'),
      el('div', { class: 'row' }, send, el('button', { class: 'btn ghost', type: 'button', onclick: done }, '不留名')));
  },
  // 芳名錄頁:四科各前五名
  async page(focus, back) {
    show(el('p', { class: 'lead' }, '正在讀取芳名錄…'));
    const cards = [];
    for (const [id, name, unit] of HALL_SUBJECTS) {
      let rows = null; try { rows = await this.top(id); } catch (e) { /* 顯示讀取失敗 */ }
      cards.push(el('div', { class: 'card', style: id === focus ? 'border-color:var(--accent)' : '' }, el('h3', {}, `${name}(${unit})`),
        rows === null ? el('p', { class: 'err' }, '讀取失敗') : rows.length ? el('ol', { class: 'detail' }, rows.map((r) => el('li', {}, `${r.name}:${r.score}${r.note ? `(${r.note})` : ''}`))) : el('p', { class: 'persona' }, '還沒有人留名,等你來寫下第一筆。')));
    }
    show(el('h2', {}, '芳名錄'), el('p', { class: 'lead' }, '每一科的前五名。'), el('div', { class: 'stack' }, cards), el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: back }, '回上一頁')));
  },
};
