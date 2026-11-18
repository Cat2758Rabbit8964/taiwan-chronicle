'use strict';
/* 藍色的門:戒嚴時期的校園,以及國旗歌 / 雨夜花的節奏遊戲(仿跳舞機)。
   旋律只取音高與節奏(data/music.json,取自公共領域的樂譜),音色由瀏覽器合成,不載入任何錄音,也不顯示歌詞。
   節奏邏輯(muChart、MuSim)與畫面分開,方便用程式模擬。需要 el()、show()(game.js)、Escape.ask()(escape.js)、Hall(hall.js)。 */

const MU_WIN = { good: 0.08, ok: 0.17 };   // 秒:+2、+1 的判定範圍;超過視為 +0
const MU_LEAD = 2;                          // 起拍前先空兩拍
const MU_SPEED = 250;                       // 箭頭每秒飄過的像素
const MU_ARROW = ['←', '↓', '↑', '→'];

// 弦樂和弦的排列:最低音是低音(最低在 C2–B2 之間),其餘和弦音由下往上疊,任兩個音的距離至少是四度(5 個半音),
// 不夠就把中間的音升高八度;在所有排列裡取最緊湊的一種。q: 'M' 大三和弦、'm' 小三和弦、'7' 屬七和弦(只放根音、三音、七音三個音)
function muVoice(tonic, root, q, bass) {
  const set = q === 'm' ? [0, 3, 7] : q === '7' ? [0, 4, 10] : [0, 4, 7];
  const mod = (x) => ((x % 12) + 12) % 12;
  const pcs = [...new Set(set.map((x) => mod(tonic + root + x)))], bpc = mod(tonic + (bass == null ? root : bass));
  const low = 36 + mod(bpc - 36), rest = pcs.filter((p) => p !== bpc);
  const perms = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p])));
  let best = null;
  for (const order of perms(rest)) {
    const notes = [low]; let top = low;
    for (const pc of order) { let p = top + mod(pc - top); while (p - top < 5) p += 12; notes.push(p); top = p; }
    if (!best || top < best[best.length - 1]) best = notes;
  }
  return best;
}
// 一段的每小節和弦:[{ beats, notes }, ...]
function muBars(s) {
  // 每個和弦 [根音, 種類, 低音, 拍數, 指定音高?]:有指定音高就直接用;種類 'r' 是休止(那幾拍不出聲)
  return s.chords.map((bar) => bar.map(([root, q, bass, beats, notes]) => ({ beats, notes: notes || (q === 'r' ? [] : muVoice(s.tonic, root, q, bass)) })));
}

// 把歌曲展開成「段」:國旗歌只有一段;雨夜花有兩段(各 48 拍),每段有自己的調(tonic)、密度與伴奏
function muSections(song) {
  if (!song.sections) { const last = song.notes[song.notes.length - 1]; return [{ base: 0, beats: last[0] + last[1], notes: song.notes, tonic: 0 }]; }
  let base = 0;
  const secs = song.sections.map((s) => { const o = { ...s, base, notes: song.melody.map(([b, d, semi]) => [base + b, d, s.tonic + semi]) }; base += s.beats; return o; });
  // 尾聲:最後兩小節的主旋律改用笛子再重複一次,配和弦,並漸慢收尾(速度變化見 muBeatTime)
  if (song.coda) { const c = song.coda; secs.push({ ...c, base, offsets: [], flute: true, notes: c.melody.map(([b, d, semi]) => [base + b, d, c.tonic + semi]) }); }
  return secs;
}

// 第 b 拍(從歌曲開頭算)的時間,不含起拍前的空拍。尾聲(漸慢):每一拍的長度從 1 倍線性拉長到 coda.rit 倍
function muBeatTime(song, b) {
  const spb = 60 / song.bpm;
  if (!song.coda) return b * spb;
  const r0 = song.sections.reduce((a, s) => a + s.beats, 0);
  if (b <= r0) return b * spb;
  const x = b - r0, k = song.coda.rit - 1;
  return r0 * spb + spb * (x + (k * x * x) / (2 * song.coda.beats));
}
// 全曲共幾拍
function muTotalBeats(song) { return song.sections ? song.sections.reduce((a, s) => a + s.beats, 0) + (song.coda ? song.coda.beats : 0) : 0; }

// 由旋律產生譜面:音往上出↑、往下出↓;跳進(超過 2 個半音)出→或←;同音左右交替。
// 有 sections 的歌(雨夜花)會在旋律音之間的反拍補上切分的伴奏點,補到每拍的音符數達到該段的 density 為止
function muChart(song) {
  const spb = 60 / song.bpm, lead = MU_LEAD * spb, out = [], secs = muSections(song), BB = song.barBeats || 4;
  let prev = null, alt = 0;
  for (const s of secs) for (const [b, d, n] of s.notes) {
    let lane;
    if (prev == null) lane = 0;
    else if (n === prev) { lane = alt ? 3 : 0; alt ^= 1; }
    else if (n > prev) lane = n - prev > 2 ? 3 : 2;
    else lane = prev - n > 2 ? 0 : 1;
    prev = n; out.push({ t: lead + muBeatTime(song, b), lane, midi: n, dur: muBeatTime(song, b + d) - muBeatTime(song, b), kind: 'm', inst: s.flute ? 'flute' : 'box' });
  }
  if (song.sections) {
    // 切分的撥奏點:固定落在每小節指定的反拍位置(offsets),音高取自「當下那個和弦」的排列(與弦樂和弦一致);與旋律音同時的位置不放
    let k = 0;
    for (const s of secs) {
      const starts = s.notes.map((x) => x[0]), bars = muBars(s);
      for (let bar = 0; bar * BB < s.beats; bar++) {
        for (const off of s.offsets) {
          const b = s.base + bar * BB + off;
          if (starts.some((x) => Math.abs(x - b) < 0.2)) continue;
          let acc = 0, seg = bars[bar % bars.length].slice(-1)[0];
          for (const sg of bars[bar % bars.length]) { if (off < acc + sg.beats) { seg = sg; break; } acc += sg.beats; }
          if (!seg.notes.length) continue;
          const t = lead + muBeatTime(song, b), near = out.find((x) => Math.abs(x.t - t) < 0.3 * spb);
          let lane = (k * 3 + bar) % 4; if (near && near.lane === lane) lane = (lane + 1) % 4;
          let p = seg.notes[k % seg.notes.length]; if (p < 48) p += 12;
          out.push({ t, lane, midi: p, dur: 0.25 * spb, kind: 's' }); k++;
        }
      }
    }
  }
  return out.sort((a, b) => a.t - b.t || a.lane - b.lane);
}

// 不要按的伴奏(只出聲):兩段都有弦樂和弦,第一段小聲、第二段稍大聲(音量在各段的 vol)。和弦依 s.chords,排列見 muVoice
function muAccomp(song) {
  const spb = 60 / song.bpm, lead = MU_LEAD * spb, out = [], BB = song.barBeats || 4;
  if (!song.sections) return out;
  for (const s of muSections(song)) {
    if (!s.chords) continue;
    const bars = muBars(s);
    for (let bar = 0; bar * BB < s.beats; bar++) {
      let off = 0;
      for (const seg of bars[bar % bars.length]) {
        if (seg.notes.length) { const b0 = s.base + bar * BB + off; out.push({ kind: 'bass', t: lead + muBeatTime(song, b0), dur: muBeatTime(song, b0 + seg.beats) - muBeatTime(song, b0), midis: seg.notes, vol: s.vol }); }
        off += seg.beats;
      }
    }
  }
  return out;
}

// 判定:+2、+1、+0(含漏按),逐個累加
class MuSim {
  constructor(chart) { this.notes = chart.map((n) => ({ ...n, done: false })); this.score = 0; this.counts = { good: 0, ok: 0, miss: 0 }; this.last = null; this.lastAt = -9; }
  press(lane, now) {
    let best = null;
    for (const n of this.notes) {
      if (n.done || n.lane !== lane) continue;
      const dt = Math.abs(n.t - now);
      if (dt <= MU_WIN.ok && (!best || dt < best.dt)) best = { n, dt };
    }
    if (!best) return null;
    best.n.done = true;
    const g = best.dt <= MU_WIN.good;
    this.counts[g ? 'good' : 'ok']++; this.score += g ? 2 : 1; this.last = g ? 'good' : 'ok'; this.lastAt = now;
    return this.last;
  }
  tick(now) {
    for (const n of this.notes) if (!n.done && now - n.t > MU_WIN.ok) { n.done = true; this.counts.miss++; this.last = 'miss'; this.lastAt = now; }
  }
  get finished() { return this.notes.every((n) => n.done); }
  get max() { return this.notes.length * 2; }
}

/* ───── 聲音:瀏覽器自己合成(像音樂盒的音色),不使用任何錄音 ───── */
const muAudio = {
  ctx: null, master: null, tickGain: null, muted: false, metro: true,
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.55; this.master.connect(this.ctx.destination);
      this.tickGain = this.ctx.createGain(); this.tickGain.gain.value = this.metro ? 1 : 0; this.tickGain.connect(this.master);   // 節拍器走自己的音量開關,按下去連已排好的拍子聲一起開關
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  stop() { try { if (this.ctx) this.ctx.close(); } catch (e) { /* 忽略 */ } this.ctx = null; this.master = null; this.tickGain = null; },
  setMetro(on) { this.metro = on; if (this.tickGain) this.tickGain.gain.value = on ? 1 : 0; },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; },
  // 音樂盒:基音加上第 3、6 泛音,起音極快,高泛音衰減得比基音快,像撥動金屬齒片的聲音
  box(midi, when, dur, vol) {
    const c = this.ctx, f = 440 * Math.pow(2, (midi - 69) / 12);
    for (const [mul, amp, decay] of [[1, 1, 2.6], [3, 0.3, 0.9], [6, 0.12, 0.35]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol * amp, when + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, when + decay + Math.min(dur, 2) * 0.5);
      o.connect(g); g.connect(this.master); o.start(when); o.stop(when + decay + 1.3);
    }
  },
  // 笛子:柔和的正弦基音加一點二次泛音,起音慢,延續到音符結束才收,後半帶一點顫音;尾聲重複的主旋律用這個音色
  flute(midi, when, dur, vol) {
    const c = this.ctx, f = 440 * Math.pow(2, (midi - 69) / 12), len = Math.max(0.5, dur);
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = 0.12;
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, when); lg.gain.linearRampToValueAtTime(f * 0.007, when + Math.min(0.6, len * 0.6)); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + 0.07); g.gain.setValueAtTime(vol * 0.92, when + Math.max(0.1, len - 0.1)); g.gain.linearRampToValueAtTime(0.0001, when + len + 0.18);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.master);
    [o, o2, lfo].forEach((x) => { x.start(when); x.stop(when + len + 0.25); });
  },
  // 低音弦樂:兩個略失諧的鋸齒波過低通濾波,起音慢、收音慢,音量放小
  string(midi, when, dur, vol) {
    const c = this.ctx, f = 440 * Math.pow(2, (midi - 69) / 12), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(g);
    const o = [0, 1].map((i) => { const x = c.createOscillator(); x.type = 'sawtooth'; x.frequency.value = f; x.detune.value = i ? 7 : -7; x.connect(lp); return x; });
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + 0.25); g.gain.setValueAtTime(vol, when + Math.max(0.3, dur - 0.3)); g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.25);
    g.connect(this.master); o.forEach((x) => { x.start(when); x.stop(when + dur + 0.3); });
  },
  // 弦樂撥奏:鋸齒波過低通濾波,起音很快、收音也快,像撥弦的低音提琴或大提琴(切分的伴奏點用這個音色,不是鋼琴)
  pluck(midi, when, vol) {
    const c = this.ctx, f = 440 * Math.pow(2, (midi - 69) / 12), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(g);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    g.connect(this.master); o.start(when); o.stop(when + 0.25);
  },
  // 倒數的「滴」聲:短短的高音,走主音量(靜音時也會安靜),不受節拍器開關影響
  beep(when) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 1000; g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.3, when + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
    o.connect(g); g.connect(this.master); o.start(when); o.stop(when + 0.18);
  },
  tick(when) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = 1800; g.gain.setValueAtTime(0.05, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
    o.connect(g); g.connect(this.tickGain); o.start(when); o.stop(when + 0.05);
  },
};

/* ───── 歌曲說明與結局文字 ───── */
const MU_SONGS = {
  flag: {
    title: '國旗歌', short: '國旗歌',
    intro: ['老師在教室裡彈著琴,今天的音樂課要練唱國旗歌。', '跟著節拍,在箭頭飄到最上面的記號時按下對應的方向鍵。'],
    end: ['老師點點頭,說:「很好,下課。」'],
    basis: '旋律取自公共領域的國旗歌樂譜(黃自作曲),只取音高與節奏,音色由瀏覽器合成,沒有使用任何錄音,也不顯示歌詞。',
  },
  rain: {
    title: '雨夜花', short: '雨夜花',
    intro: ['您在校園的角落,發現一張半露在外面的紙,攤開來是一份寫著〈雨夜花〉的樂譜。', '您在心裡小聲地打起拍子,把整首歌唱了兩遍,第二遍升高了調,最後再唱一次收尾。'],
    end: ['教室外傳來腳步聲,您趕緊把樂譜摺起來塞回口袋,低著頭走開。',
      '戒嚴時期,政府從 1958 年起推行「說國語運動」,學生在學校說本土語言(台語、客語等),可能被罰錢或掛上寫著「請說國語」的牌子;《廣播電視法》也規定電台以國語為主,本土語言的節目要逐年減少。',
      '批評者指出,這些政策讓本土語言的使用逐漸減少、本土文化逐漸式微,統治者也藉由學校與媒體,在超過一個世代的人們心中植入了以中國為本位的意識形態。'],
    link: ['專欄:〈逐漸式微的本土語言〉(新分頁開啟)', 'https://cat2758rabbit8964.github.io/niau-niau-tsheh-tiam/columns/native-languages.html'],
    basis: '雨夜花旋律的作曲者鄧雨賢 1944 年過世,旋律已進入公共領域;作詞者的歌詞仍受保護,所以這裡只有旋律。第二段升到 E 大調、尾聲的笛子與漸慢,以及弦樂與撥奏的伴奏,是本遊戲自己編的,音色由瀏覽器合成,沒有使用任何錄音。說國語運動的資料見聯合報〈回顧講方言會被罰錢的年代〉與專欄文章。',
  },
};

/* ───── 介面 ───── */
const Music = {
  data: null,
  // 音畫同步:聲音從喇叭出來比 AudioContext 的時鐘晚(藍牙耳機更明顯),所以箭頭與按鍵判定都以「聽到的時間」為準;
  // 自動取瀏覽器回報的輸出延遲,再加上玩家在開始頁自己微調的毫秒數
  get offsetMs() { try { return Number(localStorage.getItem('taiwan-chronicle-mu-offset')) || 0; } catch (e) { return 0; } },
  setOffset(v) { try { localStorage.setItem('taiwan-chronicle-mu-offset', String(v)); } catch (e) { /* 略過 */ } },
  async load() {
    if (this.data) return this.data;
    try { const r = await fetch('data/music.json?v=20261176'); this.data = r.ok ? await r.json() : {}; } catch (e) { this.data = {}; }
    return this.data;
  },
  // 校園:滑鼠移上去顯示地名;「教室」是國旗歌,「校門」是出口。國旗歌過關後,校園裡才會隨機出現一張半遮住的紙(雨夜花樂譜)
  // 「曾經唱完國旗歌」的紀錄:登入的玩家存在遊戲 ID 的存檔裡,訪客存在這個瀏覽器
  get flagDone() {
    if (typeof acct !== 'undefined' && acct && acct.id) return !!(acct.flags && acct.flags.flag);
    try { return localStorage.getItem('taiwan-chronicle-flag-played') === '1'; } catch (e) { return !!this._flag; }
  },
  markFlag() {
    this._flag = true;
    if (typeof acct !== 'undefined' && acct && acct.id) { acct.flags = { ...(acct.flags || {}), flag: true }; persist(); return; }
    try { localStorage.setItem('taiwan-chronicle-flag-played', '1'); } catch (e) { /* 無痕模式等,略過 */ }
  },
  async campus(proceed) {
    const data = await this.load();
    if (typeof st !== 'undefined' && st) backdrop(st.band.id, st.birth + 'campus');
    const NS = 'http://www.w3.org/2000/svg';
    const S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); kids.forEach((c) => c && n.append(c)); return n; };
    const tip = el('div', { class: 'tip', 'aria-hidden': 'true' });
    const made = [];
    const spot = (name, onclick, ...shapes) => {
      const g = S('g', { class: 'spot', tabindex: '0', role: 'button', 'aria-label': name, 'data-name': name }, ...shapes);
      g.addEventListener('click', onclick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onclick(); } });
      made.push({ name, g });
      return g;
    };
    const leave = () => Escape.ask('離開校園?', ['要離開這所校園,回到原本的社會,繼續你的故事嗎?'], '是', '否', proceed);
    const R = (x, y, w, h, fill, extra = {}) => S('rect', { x, y, width: w, height: h, fill, ...extra });
    const svg = S('svg', { viewBox: '0 0 640 400', class: 'campus', role: 'group', 'aria-label': '戒嚴時期的校園' },
      S('defs', {}, S('linearGradient', { id: 'sky', x1: '0', y1: '0', x2: '0', y2: '1' }, S('stop', { offset: '0', 'stop-color': '#1b202c' }), S('stop', { offset: '1', 'stop-color': '#5a5144' }))),
      R(0, 0, 640, 400, 'url(#sky)'),
      S('path', { d: 'M0,200 Q80,150 170,190 T340,185 T520,180 T640,195 V260 H0 Z', fill: '#2a2d2a', opacity: '.8' }),   // 遠山與樹影
      R(0, 250, 640, 150, '#38392b'),                                                                                      // 地面
      S('ellipse', { cx: '360', cy: '345', rx: '270', ry: '44', fill: 'none', stroke: '#8a6a52', 'stroke-width': '6', opacity: '.5' }),
      S('ellipse', { cx: '360', cy: '345', rx: '240', ry: '30', fill: 'none', stroke: '#8a6a52', 'stroke-width': '1.2', opacity: '.5' }));
    // 操場(放在最下面,讓其他地點蓋在上面)
    svg.append(spot('操場', () => {}, R(110, 300, 520, 96, 'transparent')));
    // 校舍:教室
    svg.append(spot('教室', () => this.enter('flag', () => this.campus(proceed)),
      R(130, 120, 270, 150, '#6a5d4a', { stroke: '#2a2218', 'stroke-width': 2 }),
      S('polygon', { points: '118,120 412,120 384,92 146,92', fill: '#4a3a30', stroke: '#2a2218', 'stroke-width': 2 }),
      ...[0, 1, 2, 3, 4].map((i) => R(148 + i * 50, 138, 34, 34, '#d8c98a', { opacity: i === 2 ? '.95' : '.6', stroke: '#2a2218' })),
      ...[0, 1, 2, 3, 4].map((i) => R(148 + i * 50, 196, 34, 34, '#d8c98a', { opacity: i === 3 ? '.9' : '.5', stroke: '#2a2218' })),
      R(244, 222, 36, 48, '#2d2118', { stroke: '#14100b' })));
    // 校門(唯一的出口)
    svg.append(spot('校門', leave,
      R(14, 200, 18, 80, '#7a7468', { stroke: '#2a2a24' }), R(98, 200, 18, 80, '#7a7468', { stroke: '#2a2a24' }),
      R(32, 222, 66, 52, 'none', { stroke: '#2a2a24', 'stroke-width': 2.5 }),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => S('line', { x1: 40 + i * 8, y1: 222, x2: 40 + i * 8, y2: 274, stroke: '#2a2a24', 'stroke-width': 2 })),
      R(8, 192, 114, 10, '#8a8478', { stroke: '#2a2a24' })));
    // 銅像:基座與站姿的人像(青銅色)
    svg.append(spot('銅像', () => modal('銅像', ['校園裡的銅像立在基座上,底下的石板刻著字。']),
      R(420, 246, 44, 30, '#7a7a70', { stroke: '#2a2a24' }), R(414, 270, 56, 10, '#6a6a60', { stroke: '#2a2a24' }),
      S('circle', { cx: '442', cy: '196', r: '9', fill: '#6f8068', stroke: '#2a3028' }),
      S('path', { d: 'M428,206 h28 l6,40 h-40 z', fill: '#6f8068', stroke: '#2a3028' }),
      S('rect', { x: '424', y: '212', width: '8', height: '30', fill: '#5f7058' })));
    // 升旗台
    svg.append(spot('升旗台', () => modal('升旗台', ['每週一的升旗典禮,全校師生在這裡向國旗行禮、唱國旗歌。']),
      R(476, 252, 70, 22, '#6a6a60', { stroke: '#2a2a24' }), R(483, 262, 56, 12, '#55554c'),
      R(506, 96, 4, 160, '#cfcfc4'),
      R(510, 100, 46, 30, '#a63a30'), R(510, 100, 20, 15, '#2c4f8a'), S('circle', { cx: '520', cy: '107.5', r: '4.4', fill: '#f2f2f2' })));
    // 遊戲區:鞦韆與溜滑梯
    svg.append(spot('遊戲區', () => modal('遊戲區', ['鞦韆在風裡輕輕晃著。']),
      R(562, 236, 4, 38, '#5a5a52'), R(584, 236, 4, 38, '#5a5a52'), R(560, 234, 30, 4, '#5a5a52'),
      S('line', { x1: 570, y1: 238, x2: 570, y2: 260, stroke: '#9a9a90', 'stroke-width': 1 }), S('line', { x1: 580, y1: 238, x2: 580, y2: 260, stroke: '#9a9a90', 'stroke-width': 1 }), R(567, 259, 16, 3, '#8a6a42'),
      R(598, 216, 14, 6, '#6a5a40'), R(600, 222, 4, 52, '#6a5a40'), R(608, 222, 4, 52, '#6a5a40'),
      S('polygon', { points: '608,220 616,220 636,274 624,274', fill: '#8a7a5a', stroke: '#2a2218' })));
    // 草叢:幾叢深綠的灌木,點了只有蟲鳴
    const bush = (cx, cy, s) => spot('草叢', () => {},
      S('ellipse', { cx, cy, rx: 26 * s, ry: 14 * s, fill: '#2c4a30' }), S('ellipse', { cx: cx - 14 * s, cy: cy + 4 * s, rx: 16 * s, ry: 10 * s, fill: '#355a38' }), S('ellipse', { cx: cx + 15 * s, cy: cy + 3 * s, rx: 17 * s, ry: 11 * s, fill: '#2a4430' }));
    svg.append(bush(170, 292, 1), bush(332, 288, 0.8), bush(480, 300, 1.1), bush(80, 318, 0.9));
    // 唱完國旗歌(有紀錄)之後,校園裡會出現一張紙(雨夜花樂譜),每次進校園隨機換一個地方,
    // 半個藏在遮蔽物(草叢、升旗台、銅像基座、校門柱子、溜滑梯)後面,只露出約一半;點露出來的部分進入
    if (this.flagDone) {
      const bushes = made.filter((x) => x.name === '草叢').map((x) => x.g), one = (n) => made.find((x) => x.name === n).g;
      const spots = [[bushes[0], 180, 292], [bushes[1], 338, 284], [bushes[2], 442, 292], [bushes[3], 89, 312],
        [one('升旗台'), 466, 262], [one('銅像'), 402, 262], [one('校門'), 108, 258], [one('遊戲區'), 588, 258]];
      const [cover, px, py] = spots[Math.floor(Math.random() * spots.length)], rot = (Math.random() - 0.5) * 24;
      const sheet = S('g', { class: 'sheet', role: 'button', 'aria-label': '一張紙', transform: `rotate(${rot.toFixed(1)} ${px + 12} ${py + 9})` },
        R(px, py, 24, 18, '#f6f3ea', { stroke: '#a9a287', 'stroke-width': 1 }),
        ...[5, 9, 13].map((dy) => S('line', { x1: px + 4, y1: py + dy, x2: px + 20, y2: py + dy, stroke: '#b9b29a', 'stroke-width': 0.8 })));
      sheet.addEventListener('click', () => (data.rain ? this.enter('rain', () => this.campus(proceed)) : modal('一張紙', ['(雨夜花的旋律資料還沒備齊。)'])));
      svg.insertBefore(sheet, cover);
    }
    const wrap = el('div', { class: 'campuswrap' }, svg, tip);
    svg.addEventListener('pointermove', (e) => {
      const g = e.target.closest && e.target.closest('.spot');
      if (!g) { tip.style.display = 'none'; return; }
      const r = wrap.getBoundingClientRect();
      tip.textContent = g.getAttribute('data-name'); tip.style.display = 'block';
      // 文字框不超出圖的範圍:靠右或靠下時改放到游標的左邊或上方
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let x = e.clientX - r.left + 12, y = e.clientY - r.top + 12;
      if (x + w > r.width - 4) x = e.clientX - r.left - w - 12;
      if (y + h > r.height - 4) y = e.clientY - r.top - h - 12;
      tip.style.left = `${Math.max(4, x)}px`; tip.style.top = `${Math.max(4, y)}px`;
    });
    svg.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
    show(el('p', { class: 'persona' }, '淺藍色的門'), el('h2', {}, '戒嚴時期的校園'),
      el('p', { class: 'scene' }, '您走進一所學校。暮色裡,校舍的窗口亮著燈,操場上沒有什麼人。把滑鼠移到各處看看,想離開的話,要從校門出去。'), wrap);
  },

  // 從校園進入節奏遊戲之前,先提醒會播出音樂:確定才進入,返回就留在校園
  enter(id, back) {
    Escape.ask('提醒', ['本遊戲會播出音樂,請先確定不會打擾到周遭的人。'], '確定', '返回', () => this.play(id, back));
  },

  // 開始前的說明頁(瀏覽器要有人點過才能出聲,所以先放一個「開始」鈕)
  play(id, back) {
    const song = this.data[id], meta = MU_SONGS[id];
    show(el('p', { class: 'persona' }, meta.title), el('h2', {}, `節奏遊戲:${meta.title}`),
      ...meta.intro.map((x) => el('p', { class: 'scene' }, x)),
      el('p', { class: 'lead' }, '←↓↑→ 對應方向鍵(手機用畫面上的按鈕)。按對時機得 +2,稍有偏差得 +1,沒按到或差太多得 +0。'),
      (() => {
        const val = el('b', {}, `${this.offsetMs} 毫秒`);
        const sl = el('input', { type: 'range', min: '-200', max: '300', step: '10', value: String(this.offsetMs), 'aria-label': '音畫同步微調(毫秒)' });
        sl.addEventListener('input', () => { this.setOffset(Number(sl.value)); val.textContent = `${sl.value} 毫秒`; });
        return el('div', { class: 'sync' }, el('p', { class: 'persona' }, '音畫同步微調:覺得箭頭比聲音早到,就往右調大;箭頭比聲音晚,就往左調小。藍牙耳機通常要調大。'), el('div', { class: 'row' }, sl, val));
      })(),
      (() => {
        // 切換器:開的時候「開」亮綠燈、「關」是灰色;關的時候「開」是灰色、「關」亮紅燈
        const sw = el('button', { type: 'button', role: 'switch', 'aria-label': '節拍器' }, el('span', { class: 'on' }, '開'), el('span', { class: 'off' }, '關'));
        const paint = () => { sw.className = `toggle ${muAudio.metro ? 'is-on' : 'is-off'}`; sw.setAttribute('aria-checked', String(muAudio.metro)); };
        sw.addEventListener('click', () => { muAudio.metro = !muAudio.metro; paint(); });
        paint();
        return el('div', { class: 'sync' }, el('p', { class: 'persona' }, '節拍器:預設開,點一下切換開或關;關掉之後,遊戲裡就不會有節拍器的聲音。'), el('div', { class: 'row' }, el('b', {}, '節拍器'), sw));
      })(),
      el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: () => this.run(id, back) }, '開始'),
        el('button', { class: 'btn ghost', type: 'button', onclick: back }, '回校園')));
  },

  run(id, back) {
    const song = this.data[id], meta = MU_SONGS[id];
    muAudio.init();
    const ctx = muAudio.ctx, chart = muChart(song), sim = new MuSim(chart), spb = 60 / song.bpm;
    const COUNT = 3;   // 開始前先倒數 3、2、1,倒數結束後才進入起拍的空拍
    const base = ctx.currentTime + COUNT + 0.5;
    for (let i = 0; i < COUNT; i++) muAudio.beep(ctx.currentTime + i);   // 滴、滴、滴:對應畫面上的 3、2、1
    const lat = () => (ctx.baseLatency || 0) + (ctx.outputLatency || 0) + this.offsetMs / 1000;
    const clock = () => ctx.currentTime - lat() - base;   // 玩家聽到聲音的時間
    chart.filter((n) => n.kind === 'm').forEach((n) => (n.inst === 'flute' ? muAudio.flute(n.midi, base + n.t, n.dur, 0.3) : muAudio.box(n.midi, base + n.t, n.dur, 0.36)));
    chart.filter((n) => n.kind === 's').forEach((n) => muAudio.pluck(n.midi, base + n.t, 0.09));
    muAccomp(song).forEach((e) => e.midis.forEach((p) => muAudio.string(p, base + e.t, e.dur, e.vol)));
    // 全曲結束後空一個小節(依結尾的速度),這段時間畫面顯示「來賓請掌聲鼓勵」,再進入結果
    const total = song.sections ? muTotalBeats(song) : Math.ceil(song.notes[song.notes.length - 1][0] + song.notes[song.notes.length - 1][1]);
    const songEnd = MU_LEAD * spb + (song.sections ? muBeatTime(song, total) : total * spb);
    const lastBeat = song.sections ? muBeatTime(song, total) - muBeatTime(song, total - 1) : spb;
    const restEnd = songEnd + (song.barBeats || 4) * lastBeat;
    if (song.sections) { for (let x = -MU_LEAD; x <= muTotalBeats(song); x++) muAudio.tick(base + MU_LEAD * spb + (x < 0 ? x * spb : muBeatTime(song, x))); }
    else for (let b = 0; b <= total + MU_LEAD; b++) muAudio.tick(base + b * spb);
    const cv = el('canvas', { class: 'escv', width: 360, height: 520, role: 'img', 'aria-label': `${meta.title}節奏遊戲畫面` });
    const hud = el('div', { class: 'hud' });
    const mute = el('button', { class: 'btn ghost', type: 'button', onclick: () => { muAudio.setMuted(!muAudio.muted); mute.textContent = muAudio.muted ? '開啟聲音' : '靜音'; } }, muAudio.muted ? '開啟聲音' : '靜音');
    const handIn = el('button', { class: 'btn ghost', type: 'button', onclick: () => Escape.ask('交卷?', [`現在交卷,目前的分數是 ${sim.score}。還沒按到的箭頭不算分。`], '是', '否', () => finish(true)) }, '交卷');
    const press = (lane) => { sim.press(lane, clock()); };
    const pad = el('div', { class: 'pad' }, MU_ARROW.map((a, lane) => {
      const b = el('button', { class: 'btn ghost ctl', type: 'button', 'aria-label': `方向 ${a}` }, a);
      b.addEventListener('pointerdown', (e) => { press(lane); e.preventDefault(); });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    }));
    show(el('p', { class: 'persona' }, meta.title), hud, cv, pad, el('div', { class: 'row' }, mute, handIn));
    const keyMap = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, a: 0, s: 1, w: 2, d: 3 };
    const kd = (e) => { if (e.repeat) return; const l = keyMap[e.key]; if (l != null) { press(l); e.preventDefault(); } };
    document.addEventListener('keydown', kd);
    const c2 = cv.getContext('2d'), X = [52, 140, 228, 316], RY = 70;
    let ended = false;
    // 交卷(early)或曲子結束:停掉聲音,算分數。交卷時還沒按到的箭頭記為 +0;只有唱完國旗歌才留下「曾經唱過」的紀錄
    const finish = (early) => {
      if (ended === 'done') return;
      ended = 'done';
      document.removeEventListener('keydown', kd); muAudio.stop();
      if (early === true) sim.notes.forEach((n) => { if (!n.done) { n.done = true; sim.counts.miss++; } });
      else if (id === 'flag') this.markFlag();
      this.ending(id, sim, back);
    };
    const frame = () => {
      if (ended === 'done') return;
      if (!cv.isConnected) { document.removeEventListener('keydown', kd); muAudio.stop(); return; }
      if (document.querySelector('.modal-back')) { if (ctx.state === 'running') ctx.suspend(); requestAnimationFrame(frame); return; }
      if (ctx.state === 'suspended') ctx.resume();
      const now = clock();
      sim.tick(now);
      this.draw(c2, sim, now, X, RY, now >= songEnd);
      const left = base - ctx.currentTime - 0.5;   // 距離倒數結束還有幾秒
      if (left > 0) { c2.fillStyle = 'rgba(20,16,12,.6)'; c2.fillRect(110, 190, 140, 120); c2.fillStyle = '#f3ead2'; c2.font = '80px serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(String(Math.ceil(left)), 180, 252); }
      hud.textContent = `分數 ${sim.score}　+2 ×${sim.counts.good}　+1 ×${sim.counts.ok}　+0 ×${sim.counts.miss}`;
      if (!ended && sim.finished && now > restEnd + 0.3) { ended = true; finish(false); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  draw(c, sim, now, X, RY, applause) {
    c.fillStyle = '#1d1a16'; c.fillRect(0, 0, 360, 520);
    for (const x of X) { c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(x - 38, 0, 76, 520); }
    c.font = '30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    X.forEach((x, i) => { c.strokeStyle = '#b9a77a'; c.lineWidth = 2; c.strokeRect(x - 26, RY - 26, 52, 52); c.fillStyle = 'rgba(185,167,122,.35)'; c.fillText(MU_ARROW[i], x, RY); });
    const col = ['#8fa8c0', '#a8c08f', '#c08f8f', '#c0b08f'];
    for (const n of sim.notes) {
      if (n.done) continue;
      const y = RY + (n.t - now) * MU_SPEED;
      if (y > 560 || y < -30) continue;
      c.fillStyle = n.kind === 's' ? '#b08fc0' : col[n.lane]; c.globalAlpha = 0.95;
      c.fillRect(X[n.lane] - 24, y - 24, 48, 48); c.globalAlpha = 1; c.fillStyle = '#1d1a16'; c.fillText(MU_ARROW[n.lane], X[n.lane], y);
    }
    if (sim.last && now - sim.lastAt < 0.5) {
      const T = { good: ['+2', '#e8d27a'], ok: ['+1', '#8fc0a0'], miss: ['+0', '#c06a6a'] }[sim.last];
      c.fillStyle = T[1]; c.font = '40px serif'; c.fillText(T[0], 180, 300);
    }
    if (applause) { c.fillStyle = 'rgba(20,16,12,.75)'; c.fillRect(20, 230, 320, 60); c.fillStyle = '#e8d27a'; c.font = '22px serif'; c.fillText('～～來賓請掌聲鼓勵～～', 180, 260); }
  },

  ending(id, sim, back) { this.ending2(id, sim, back, true); },
  ending2(id, sim, back, popup) {
    const meta = MU_SONGS[id], score = sim.score, c = sim.counts;
    const join = () => Hall.offer('music', score, () => this.ending2(id, sim, back), true, meta.short);
    const canAsk = Hall.on && score > 0;
    show(el('p', { class: 'persona' }, meta.title), el('h2', {}, '曲子結束了'),
      el('p', { class: 'lead' }, `分數 ${score}(+2 有 ${c.good} 個、+1 有 ${c.ok} 個、+0 有 ${c.miss} 個;滿分 ${sim.max})`),
      ...meta.end.map((x) => el('p', { class: 'scene' }, x)),
      meta.link ? el('p', {}, el('a', { href: meta.link[1], target: '_blank', rel: 'noopener' }, meta.link[0])) : null,
      el('p', { class: 'persona' }, meta.basis),
      el('div', { class: 'row' }, el('button', { class: 'btn', type: 'button', onclick: () => this.play(id, back) }, '再玩一次'),
        canAsk ? el('button', { class: 'btn ghost', type: 'button', onclick: join }, '加進芳名錄') : null,
        Hall.on ? el('button', { class: 'btn ghost', type: 'button', onclick: () => Hall.page('music', () => this.ending2(id, sim, back)) }, '看芳名錄') : null,
        el('button', { class: 'btn ghost', type: 'button', onclick: back }, '回校園')));
    if (popup && canAsk) Escape.ask('要加進芳名錄嗎?', [`這次的成績是 ${score} 分(${meta.short})。要把它加進「音樂科」的芳名錄嗎?`], '加進芳名錄', '不加入', join);
  },
};
