'use strict';
/* 穿越地圖與逃脫遊戲。黃色門打開後進入:地圖上有新疆、西藏、台灣三個點。
   遊戲邏輯(EscSim)與畫面分開,方便用程式模擬調整難度。需要 el()、show()、confirmLeave()(game.js)與 Hall(hall.js)。 */

const ESC_W = 360, ESC_H = 520, ESC_SECONDS = 100;
const ESC_MODES = {
  up:   { gap: 78, v0: 22, v1: 44, jump: true,  startY: 430, dir: 1, g: 1500, off: 5, span: 30 },    // 新疆:台階往下捲,玩家要往上爬
  down: { gap: 84, v0: 20, v1: 38, jump: false, startY: 110, dir: -1, g: 1000, off: 15, span: 10 },   // 西藏:台階往上捲,玩家要往下逃
};
const ESC_G = 1500, ESC_JUMP = 560, ESC_SPEED = 190, ESC_HW = 9, ESC_PH = 26, ESC_PW = 80;

function escRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

class EscSim {
  constructor(mode, seed) {
    this.cfg = ESC_MODES[mode]; this.mode = mode; this.rnd = escRng(seed);
    this.t = 0; this.score = 0; this.over = null; this.plats = []; this.row = 0; this.lane = 1;
    const wide = this.cfg.dir > 0;   // 往上爬:起點是整條寬台階;往下逃:起點只有一小塊,要走下去
    this.plats.push({ x: wide ? 0 : 140, w: wide ? ESC_W : 80, y: this.cfg.startY, guard: false, row: 0 });
    this.p = { x: ESC_W / 2, y: this.cfg.startY, vy: 0, on: this.plats[0] };
    this.fill();
  }
  speed() { const f = Math.min(1, this.t / ESC_SECONDS); return this.cfg.v0 + (this.cfg.v1 - this.cfg.v0) * f; }
  // 看守者台階的比例:15% 漸增到 40%(三條車道,一條保證安全,其餘兩條各有機率)
  guardChance() { return 0.225 + 0.375 * Math.min(1, this.t / ESC_SECONDS); }
  addRow(y) {
    const r = this.rnd; this.row++;
    const m = r(); this.lane = Math.max(0, Math.min(2, this.lane + (m < 0.3 ? -1 : m < 0.6 ? 1 : 0)));
    for (let L = 0; L < 3; L++) {
      const safe = L === this.lane;
      if (!safe && r() > 0.72) continue;
      this.plats.push({ x: L * 120 + this.cfg.off + r() * this.cfg.span, w: ESC_PW, y, guard: !safe && r() < this.guardChance(), path: safe, row: this.row });
    }
  }
  fill() {
    const c = this.cfg;
    if (c.dir > 0) {   // 台階往下捲:新的一排從上方進來
      let top = Math.min(...this.plats.map((q) => q.y));
      while (top > -c.gap) { top -= c.gap; this.addRow(top); }
      this.plats = this.plats.filter((q) => q.y < ESC_H + 60);
    } else {           // 台階往上捲:新的一排從下方進來
      let bot = Math.max(...this.plats.map((q) => q.y));
      while (bot < ESC_H + c.gap) { bot += c.gap; this.addRow(bot); }
      this.plats = this.plats.filter((q) => q.y > -60);
    }
  }
  step(dt, inp) {
    if (this.over) return;
    dt = Math.min(dt, 0.033); this.t += dt;
    const dy = this.cfg.dir * this.speed() * dt, p = this.p;
    for (const q of this.plats) q.y += dy;
    this.fill();
    p.x = Math.max(0, Math.min(ESC_W, p.x + ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * ESC_SPEED * dt));
    const over = (q) => p.x + ESC_HW > q.x && p.x - ESC_HW < q.x + q.w;
    if (p.on && (!over(p.on) || !this.plats.includes(p.on))) p.on = null;
    if (p.on) {
      p.y = p.on.y; p.vy = 0;
      if (inp.jump && this.cfg.jump) { p.vy = -ESC_JUMP; p.on = null; }
    }
    if (!p.on) {
      const prev = p.y;
      p.vy = Math.min(p.vy + this.cfg.g * dt, 620); p.y += p.vy * dt;
      let hit = null;
      for (const q of this.plats) {
        if (!over(q)) continue;
        if (prev <= q.y - dy + 1 && p.y >= q.y && (!hit || q.y < hit.y)) hit = q;
      }
      if (hit) { p.y = hit.y; p.vy = 0; p.on = hit; if (hit.guard) this.over = 'guard'; else this.score = Math.max(this.score, hit.row); }
    }
    if (p.y > ESC_H + 40) this.over = 'fall';
    else if (this.cfg.dir < 0 && p.y - ESC_PH < 0) this.over = 'crush';
    if (!this.over && this.t >= ESC_SECONDS) this.over = 'win';
  }
}

/* ───── 文字 ───── */
const ESC_GAMES = {
  xj: {
    id: 'xj', name: '新疆(東突厥斯坦)', mode: 'up', unit: '階', verb: '爬上',
    entry: '進入再教育營',
    caution: '接下來是依公開調查報導改寫的虛構情境,內容涉及強制拘禁與骨肉分離。',
    story: ['您是一位進到再教育營的維吾爾族族人,在八年前被強制入營。那一刻和自己五歲的女兒分開,從此之後不被允許見面。', '今天是她的生日,您趁著管理員疏失,從建築物死角逃出……', '一百秒內,往上爬,避開每一個站著管理員的台階。'],
    keys: '←/→ 移動,空白鍵或↑跳躍',
    lose: ['您被再教育營的管理員發現,被押回原本的營區。'],
    win: ['您逃出了再教育營,外面的世界卻與以往不同。街上只有說中文的人,小時候常去的清真寺已經消失,回家的路也不知去向。',
      '過了一個街角後,巡邏的政府官員正在四處稽查,您只能躲著,肚子也不自覺地餓了起來。',
      '您望向用簡體字招牌的維吾爾傳統料理,賣著伊斯蘭教徒明明就不吃的豬五花。攤販的老闆有著中亞人的臉孔,兩眼無神,像是個機器一樣重複著切肉,油煎,包裝。',
      '路過的遊客買了五花肉,付了錢,手提袋上大紅色的新疆兩個字彷彿像一道咒語刺進了您的眼眸。',
      '最後您回到了再教育營內,至少回去不會餓死,然後再過三年職訓就會結束,應該就可以看到女兒了……'],
    basis: '本故事為虛構情境,依據聯合國人權事務高級專員辦事處 2022 年 8 月 31 日發布的新疆評估報告(認為任意拘禁的規模「可能構成國際罪行,特別是危害人類罪」)與相關調查報導改寫。中國政府否認指控,稱相關設施為職業技能教育培訓中心。',
  },
  tb: {
    id: 'tb', name: '西藏(圖博)', mode: 'down', unit: '階', verb: '逃下',
    entry: '1959 年・逃出關押處',
    caution: '接下來是依史料與難民證詞改寫的虛構情境,內容涉及武力鎮壓、拘禁與骨肉分離。',
    story: ['1959 年三月,拉薩爆發抗暴,炮火落在羅布林卡一帶。您是一位藏族牧民,事發後被抓去關押,寺院被封,家裡的牲畜也被收走。',
      '被帶走的那一刻,您和自己五歲的兒子分開了,此後再沒有見過面。今天是他的生日,您趁著夜裡看守疏忽,從關押處逃出。',
      '只有往南,翻過雪山,才到得了印度。一百秒內,往下逃,避開每一個站著士兵的台階,也別被山壁擠到頭頂。'],
    keys: '←/→ 移動',
    lose: ['您被巡邏的士兵發現,被押回原來的關押處。'],
    win: ['您翻過了山口,抵達邊境,雪地裡全是赤腳的腳印。',
      '難民營裡聚著從各地逃來的藏人,口音各不相同。有人帶來消息:家鄉的寺院被關閉,有些已經被拆毀,牧民被編進公社,牲畜歸了公家。',
      '您領到一碗熱茶,雙手還在發抖。您望向北方的雪山,孩子現在在哪裡、過得好不好,您一無所知,也不知道還有沒有回去的一天。'],
    basis: '本故事為虛構情境,依據 1959 年拉薩抗暴、達賴喇嘛流亡印度與其後大批藏人外逃的歷史改寫。傷亡與外逃人數各方估計差異很大,故事中不引用數字。中國政府的立場是 1959 年平息的是上層叛亂,並稱此後推動了民主改革與發展。',
  },
};

/* ───── 介面 ───── */
const Escape = {
  keyHandler: null,
  // 是非窗:繼續 / 返回
  ask(title, lines, yes, no, onYes) {
    const back = el('div', { class: 'modal-back' });
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const go = el('button', { class: 'btn', type: 'button', onclick: () => { close(); onYes(); } }, yes);
    const stay = el('button', { class: 'btn ghost', type: 'button', onclick: close }, no);
    back.append(el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, el('h2', {}, title),
      ...lines.map((x) => el('p', {}, x)), el('div', { class: 'row' }, go, stay)));
    document.body.append(back); document.addEventListener('keydown', onKey); stay.focus();
  },
  // 穿越地圖:←/→ 切換,Enter 或點擊確認
  slip(proceed) {
    if (typeof st !== 'undefined' && st) backdrop(st.band.id, st.birth + 'slip');
    // 約略經緯度投影(東經 70–125、北緯 18–50),只放位置,不畫國界
    const at = (lon, lat) => [((lon - 70) / 55) * 100, ((50 - lat) / 32) * 100];
    const spots = [
      { id: 'xj', name: '新疆', alias: '東突厥斯坦', pos: at(84, 42) },
      { id: 'tb', name: '西藏', alias: '圖博', pos: at(91, 31) },
      { id: 'tw', name: '台灣', alias: '繼續主線任務', pos: at(121, 24) },
    ];
    let sel = 2;
    const pins = spots.map((s, i) => el('button', { class: 'pin', type: 'button', style: `left:${s.pos[0]}%;top:${s.pos[1]}%`, 'aria-label': `${s.name}(${s.alias})`, onclick: () => { sel = i; paint(); choose(); } },
      el('i', { 'aria-hidden': 'true' }), el('b', {}, s.name), el('small', {}, s.alias)));
    const paint = () => pins.forEach((b, i) => b.classList.toggle('sel', i === sel));
    const leaveMap = () => { document.removeEventListener('keydown', this.keyHandler); this.keyHandler = null; };
    const choose = () => {
      const s = spots[sel];
      if (s.id === 'tw') { this.ask('回到原本的社會?', ['要離開這個時空,回到原本的社會,繼續你的故事嗎?'], '繼續', '返回', () => { leaveMap(); proceed(); }); return; }
      const g = ESC_GAMES[s.id];
      this.ask(g.entry, [g.caution, ...g.story], '繼續', '返回', () => { leaveMap(); this.play(g, proceed); });
    };
    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = (e) => {
      if (!document.querySelector('.tmap')) { leaveMap(); return; }
      if (document.querySelector('.modal-back')) return;
      if (e.key === 'ArrowLeft') { sel = (sel + 2) % 3; paint(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { sel = (sel + 1) % 3; paint(); e.preventDefault(); }
      else if (e.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('pin')) { sel = pins.indexOf(document.activeElement); paint(); }
      else if (e.key === 'Enter') { choose(); e.preventDefault(); }
    };
    document.addEventListener('keydown', this.keyHandler);
    show(el('p', { class: 'persona' }, '黃色的門'), el('h2', {}, '您穿越時空到現代'),
      el('p', { class: 'scene' }, '門後不是房間,而是一張攤開的地圖。三個地方亮著光,您要去哪裡?'),
      el('div', { class: 'tmap', role: 'group', 'aria-label': '穿越地圖:新疆、西藏、台灣' }, el('div', { class: 'grid', 'aria-hidden': 'true' }), ...pins),
      el('p', { class: 'persona' }, '用 ←/→ 選擇,按 Enter 或點擊前往。位置為示意,不代表任何邊界。'));
    paint();
  },

  play(g, proceed) {
    const sim = new EscSim(g.mode, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const cv = el('canvas', { class: 'escv', width: ESC_W, height: ESC_H, role: 'img', 'aria-label': `${g.name}逃脫遊戲畫面` });
    const hud = el('div', { class: 'hud' });
    const inp = { left: false, right: false, jump: false };
    const hold = (label, key, cls) => {
      const b = el('button', { class: `btn ghost ctl ${cls || ''}`, type: 'button', 'aria-label': label }, label);
      const on = (v) => (e) => { inp[key] = v; e.preventDefault(); };
      b.addEventListener('pointerdown', on(true)); b.addEventListener('pointerup', on(false)); b.addEventListener('pointerleave', on(false)); b.addEventListener('pointercancel', on(false));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    };
    const pad = el('div', { class: 'pad' }, hold('◀', 'left'), g.mode === 'up' ? hold('跳', 'jump', 'jmp') : null, hold('▶', 'right'));
    show(el('p', { class: 'persona' }, g.name), hud, cv, pad, el('p', { class: 'persona' }, g.keys));
    const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', ' ': 'jump', w: 'jump', W: 'jump' };
    const kd = (v) => (e) => { const k = map[e.key]; if (k) { inp[k] = v; e.preventDefault(); } };
    const down = kd(true), up = kd(false);
    document.addEventListener('keydown', down); document.addEventListener('keyup', up);
    const ctx = cv.getContext('2d');
    let last = performance.now();
    const finish = () => {
      document.removeEventListener('keydown', down); document.removeEventListener('keyup', up);
      this.ending(g, sim, proceed);
    };
    const frame = (now) => {
      if (!cv.isConnected) { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); return; }
      const dt = (now - last) / 1000; last = now;
      if (!document.querySelector('.modal-back')) sim.step(dt, inp);   // 跳出確認窗時暫停
      this.draw(ctx, sim, g);
      hud.textContent = `剩 ${Math.max(0, Math.ceil(ESC_SECONDS - sim.t))} 秒　${g.verb} ${sim.score} ${g.unit}`;
      if (sim.over) { setTimeout(finish, 400); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  draw(c, sim, g) {
    const cold = g.mode === 'up';
    c.fillStyle = cold ? '#c9ccc6' : '#dfe3ea'; c.fillRect(0, 0, ESC_W, ESC_H);
    c.fillStyle = cold ? 'rgba(80,84,80,.10)' : 'rgba(60,70,110,.10)';
    for (let i = 0; i < 6; i++) c.fillRect(0, ((i * 97 + sim.t * 6 * sim.cfg.dir) % ESC_H + ESC_H) % ESC_H, ESC_W, 2);
    for (const q of sim.plats) {
      c.fillStyle = q.guard ? '#7d1d17' : (cold ? '#8d806a' : '#6f7a96'); c.fillRect(q.x, q.y, q.w, 8);
      c.fillStyle = q.guard ? '#a3322a' : (cold ? '#b3a68c' : '#9aa5c2'); c.fillRect(q.x, q.y, q.w, 3);
      if (q.guard) {   // 看守者剪影:帽子、頭、身體
        const cx = q.x + q.w / 2;
        c.fillStyle = '#2b1210'; c.fillRect(cx - 9, q.y - 30, 18, 4); c.beginPath(); c.arc(cx, q.y - 22, 6, 0, 7); c.fill(); c.fillRect(cx - 8, q.y - 16, 16, 16);
      }
    }
    const p = sim.p;
    c.fillStyle = '#1d1b17'; c.beginPath(); c.arc(p.x, p.y - ESC_PH + 5, 5, 0, 7); c.fill(); c.fillRect(p.x - 6, p.y - ESC_PH + 11, 12, ESC_PH - 11);
    if (sim.cfg.dir < 0) { c.fillStyle = 'rgba(120,30,20,.55)'; c.fillRect(0, 0, ESC_W, 6); }
    if (sim.t > ESC_SECONDS - 10) { c.fillStyle = 'rgba(30,110,60,.85)'; c.font = '16px serif'; c.textAlign = 'center'; c.fillText('出口就在前方……', ESC_W / 2, cold ? 24 : ESC_H - 14); }
  },

  ending(g, sim, proceed) {
    const win = sim.over === 'win', score = sim.score;
    const again = () => this.play(g, proceed), toMap = () => this.slip(proceed);
    const board = () => { if (Hall.on) Hall.offer(g.id, score, () => Hall.page(g.id, again0)); };
    const again0 = () => this.ending(g, sim, proceed);
    show(el('p', { class: 'persona' }, g.name), el('h2', {}, win ? '您逃出來了' : (sim.over === 'fall' ? '失足掉落' : sim.over === 'crush' ? '被山壁擠住' : '被發現了')),
      el('p', { class: 'lead' }, `${g.verb} ${score} ${g.unit}${win ? ',撐滿一百秒。' : '。'}`),
      ...(win ? g.win : g.lose).map((x) => el('p', { class: 'scene' }, x)),
      el('p', { class: 'persona' }, g.basis),
      el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: again }, '再玩一次'),
        Hall.on ? el('button', { class: 'btn ghost', type: 'button', onclick: board }, '芳名錄') : null,
        el('button', { class: 'btn ghost', type: 'button', onclick: toMap }, '回到地圖')));
  },
};
