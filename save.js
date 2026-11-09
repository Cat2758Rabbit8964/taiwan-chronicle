'use strict';
/* 存檔:用「遊戲 ID」取回進度。透過 Supabase 的資料庫函式(RPC)存取,資料表本身不對外開放列表。
   存的內容:ID、綽號、已收集的人物、每場結果。設定見 hall-config.js、docs/hall-setup.md。 */
const Save = {
  ALPHA: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',   // 去掉容易看錯的 I O 0 1
  KEY: 'taiwan-chronicle-game-id',
  get on() { const c = window.HALL_CONFIG || {}; return !!(c.url && c.key); },
  newId() { const a = new Uint8Array(8); (window.crypto || { getRandomValues: (x) => { for (let i = 0; i < x.length; i++) x[i] = Math.floor(Math.random() * 256); return x; } }).getRandomValues(a); return [...a].map((n) => this.ALPHA[n % 32]).join(''); },
  norm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); },
  fmt(id) { return id; },
  valid(id) { return /^[A-Z0-9]{6,16}$/.test(id); },
  remembered() { try { return localStorage.getItem(this.KEY) || ''; } catch (e) { return ''; } },
  remember(id) { try { if (id) localStorage.setItem(this.KEY, id); else localStorage.removeItem(this.KEY); } catch (e) { /* 無痕模式等,略過 */ } },
  async rpc(fn, args) {
    const c = window.HALL_CONFIG;
    const r = await fetch(`${c.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    if (!r.ok) throw new Error(`${fn} ${r.status}`);
    return r.json();
  },
  // 用指定的 ID 建立存檔;已被使用回傳 false
  async create(nick, id) { return this.rpc('save_create', { p_id: id, p_nick: nick }); },
  // 回傳 { nick, got:[], hist:[] },編號不存在回傳 null
  async load(id) {
    const rows = await this.rpc('save_get', { p_id: id });
    if (!rows || !rows.length) return null;
    const d = rows[0].data || {};
    return { nick: rows[0].nick, got: Array.isArray(d.got) ? d.got : [], hist: Array.isArray(d.hist) ? d.hist : [] };
  },
  async put(id, nick, got, hist) { return this.rpc('save_put', { p_id: id, p_nick: nick, p_data: { got, hist } }); },
  async del(id) { return this.rpc('save_del', { p_id: id }); },
  // 兩邊的進度合併(取聯集),避免不同裝置互相覆蓋
  merge(a, b) {
    const got = [...new Set([...(a.got || []), ...(b.got || [])])];
    const seen = new Set(); const hist = [];
    for (const h of [...(a.hist || []), ...(b.hist || [])]) { const k = `${h.id}|${h.t}`; if (!seen.has(k)) { seen.add(k); hist.push(h); } }
    hist.sort((x, y) => (x.t < y.t ? -1 : 1));
    return { got, hist: hist.slice(-200) };
  },
};
