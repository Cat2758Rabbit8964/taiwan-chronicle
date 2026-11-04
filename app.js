const TYPES = {
  war: { icon: '⚔️', label: '戰爭', color: 'var(--war)' },
  suppression: { icon: '⛓️', label: '國內鎮壓', color: 'var(--suppression)' },
  politics: { icon: '🏛️', label: '政治', color: 'var(--politics)' },
  society: { icon: '👥', label: '社會', color: 'var(--society)' },
  construction: { icon: '🏗️', label: '建設', color: 'var(--construction)' },
  diplomacy: { icon: '🤝', label: '外交與貿易', color: 'var(--diplomacy)' },
  disaster: { icon: '🌋', label: '災害', color: 'var(--disaster)' },
};
const REGIONS = {
  taiwan: { name: '台灣', chip: [121, 21.2] },
  china: { name: '中國', chip: [105, 33] },
  japan: { name: '日本', chip: [139.5, 39.2] },
  world: { name: '世界', chip: [160, 19] },
};
const THIS_YEAR = new Date().getFullYear();
const MIN_PCT = 8;
const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, html = '') => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.innerHTML = html;
  return e;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 內容完整度規則(scripts/check.py 使用相同規則,修改時請同步):
// 完整 = 背景/經過/數字與各方說法/影響 至少 3 段,且參考資料 ≥ 2;詳細 = 至少 1 段;簡述 = 只有摘要。
// 「含待補」= 內文出現 待補/待核對/待查證/待查。
const LEVELS = { full: { label: '完整', rank: 3 }, detail: { label: '詳細', rank: 2 }, brief: { label: '簡述', rank: 1 } };
const GAP_RE = /待補|待核對|待查證|待查/;
function quality(e) {
  if (e._q) return e._q;
  const secs = ['background', 'process', 'figures', 'impact'].filter((k) => e[k]?.length).length;
  const refs = (e.references || e.sources || []).length;
  const level = secs >= 3 && refs >= 2 ? 'full' : secs >= 1 ? 'detail' : 'brief';
  const gaps = GAP_RE.test(JSON.stringify([e.background, e.process, e.figures, e.impact, e.people]));
  return (e._q = { level, gaps });
}
const qTag = (e) => { const q = quality(e); return `<span class="qtag q-${q.level}">${LEVELS[q.level].label}</span>${q.gaps ? '<span class="qtag gap">含待補</span>' : ''}`; };

let data, events = [], sel = { eraId: null, year: null }, map, markers = [], groups = [], photoIdx = 0, focusId = null;

const eraOf = (y) => data.taiwan.find((e) => (e.from ?? -Infinity) <= y && y < e.to);
const yearLabel = (y) => (y < 0 ? `公元前 ${-y}` : `${y}`);
const fmtYear = (y) => (y < 0 ? `約前${-y}` : `${y}`);
const shortYear = (y) => (y >= 0 ? `${y}` : -y >= 10000 ? `前${-y / 10000}萬` : `前${-y}`);
const span = (e) => (e.endYear && e.endYear !== e.year ? `${fmtYear(e.year)}–${e.endYear < 0 ? fmtYear(e.endYear).replace('約', '') : e.endYear}` : fmtYear(e.year));

async function init() {
  data = await (await fetch('data/eras.json')).json();
  for (const era of data.taiwan) {
    try {
      const r = await fetch(`data/events/${era.id}.json`);
      if (r.ok) events.push(...(await r.json()));
    } catch (_) { /* 該時代尚未收錄 */ }
  }
  events = events.filter((e) => { const rv = data.regionRevealYear[e.region]; return rv == null || e.year >= rv; });
  events.sort((a, b) => a.year - b.year);
  initMap();
  renderTimeline();
  // 深連結:index.html#y=1947 會跳到最接近該年的事件
  const hy = /^#y=(\d{3,4})$/.exec(location.hash);
  if (hy && events.length) {
    const want = Number(hy[1]);
    const near = events.reduce((a, b) => (Math.abs(b.year - want) < Math.abs(a.year - want) ? b : a));
    selectYear(near.year);
    return;
  }
  const first = events[0];
  first ? selectYear(first.year) : selectEra(data.taiwan[0].id);
}

function anchorsOf(era) {
  const m = new Map();
  for (const e of events) if (eraOf(e.year) === era) m.set(e.year, (m.get(e.year) || 0) + 1);
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

function renderTimeline() {
  const tl = $('#timeline');
  tl.innerHTML = '';
  const infos = data.taiwan.map((era) => ({ era, anchors: anchorsOf(era) }));
  const total = infos.reduce((s, i) => s + i.anchors.reduce((a, [, c]) => a + c, 0), 0) || 1;
  const rest = 100 - MIN_PCT * infos.length;
  for (const { era, anchors } of infos) {
    const count = anchors.reduce((a, [, c]) => a + c, 0);
    const pct = MIN_PCT + rest * (count / total);
    const box = el('div', { class: 'era', 'data-era': era.id, style: `width:${pct}%;--c:${era.color}` });
    const eraEvents = events.filter((e) => eraOf(e.year) === era);
    const cnt = { full: 0, detail: 0, brief: 0 };
    eraEvents.forEach((e) => { cnt[quality(e).level]++; });
    const n = eraEvents.length;
    const head = el('button', { class: 'era-head', title: `${era.name} ${era.range}${n ? `\n共 ${n} 件:完整 ${cnt.full}、詳細 ${cnt.detail}、簡述 ${cnt.brief}` : ''}` }, `${esc(era.name)}<small>${esc(era.range)}</small>`);
    head.onclick = () => selectEra(era.id);
    box.append(head);
    if (n) box.append(el('div', { class: 'cov', title: `完整 ${cnt.full}、詳細 ${cnt.detail}、簡述 ${cnt.brief}` }, `<b class="q-full" style="flex:${cnt.full}"></b><b class="q-detail" style="flex:${cnt.detail}"></b><b class="q-brief" style="flex:${cnt.brief}"></b>`));
    if (anchors.length) {
      const ticks = el('div', { class: 'ticks' });
      for (const [y, c] of anchors) {
        const evs = events.filter((e) => e.year === y);
        const titles = evs.map((e) => `${e.title}(${LEVELS[quality(e).level].label})`).join('、');
        const top = evs.reduce((m, e) => (LEVELS[quality(e).level].rank > LEVELS[m].rank ? quality(e).level : m), 'brief');
        const t = el('button', { class: `tick lv-${top}`, 'data-year': y, style: `--w:${c}`, title: `${fmtYear(y)} 年:${titles}`, 'aria-label': `${fmtYear(y)} 年,${c} 件事件` }, `<i>${'●'.repeat(Math.min(c, 3))}</i>`);
        t.onclick = () => selectYear(y);
        ticks.append(t);
      }
      box.append(ticks);
    } else {
      const b = el('button', { class: 'era-empty' }, '尚未收錄');
      b.onclick = () => selectEra(era.id);
      box.append(b);
    }
    tl.append(box);
  }
}

function selectYear(y) { sel = { eraId: eraOf(y).id, year: y }; focusId = null; renderAll(); }
function selectEra(id) { sel = { eraId: id, year: null }; focusId = null; renderAll(); }
function showTab(name) {
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  $('#tab-events').hidden = name !== 'events';
  $('#tab-era').hidden = name !== 'era';
  $('#panel').classList.toggle('era', name === 'era');
}
function focusEvent(id) {
  focusId = id;
  showTab('events');
  renderEventsTab();
  $('#tab-events').scrollTop = 0;
}
function unfocus() { focusId = null; renderEventsTab(); }
function whyBox(e) {
  const w = e.why;
  let h = `<div class="why-head"><span>🧭 為什麼會發生?<small>${esc(e.title)}</small></span><button class="why-x" aria-label="收起">✕</button></div>`;
  const list = (items) => `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  if (w) {
    if (w.intro) h += `<p class="why-intro">${esc(w.intro)}</p>`;
    for (const sec of w.sections || []) h += `<h5>${esc(sec.title)}</h5>${list(sec.items)}`;
    if (w.check?.length) h += `<h5>常見說法的查證</h5><ul class="check">${w.check.map((c) => `<li><b>${esc(c.claim)}</b>:${esc(c.verdict)}</li>`).join('')}</ul>`;
    const refs = w.references || refsOf(e);
    h += `<h5>資料來源</h5><ul class="refs">${refs.map((r) => `<li>${r.url ? `<a href="${encodeURI(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title)}</li>`).join('')}</ul>`;
  } else if (e.background?.length) {
    h += `<p class="why-intro">專屬的成因說明還沒有補上,以下先列出此事件的背景。</p><h5>時空背景</h5>${list(e.background)}<p class="empty">更多內容請按卡片的「完整背景與參考資料」。</p>`;
  } else {
    h += `<p class="why-intro">這個事件的成因說明尚未補上。</p>`;
  }
  return h;
}

function regionEra(region, year) {
  if (region === 'taiwan') { const e = eraOf(year); return e ? `${e.name}(${e.range})` : '—'; }
  const hit = data.regionEras[region].find((e) => e.from <= year && year < e.to);
  return hit ? `${hit.name}(${yearLabel(hit.from)}–${yearLabel(hit.to > 2026 ? THIS_YEAR : hit.to)})` : '史前時代';
}
function refYear() {
  if (sel.year != null) return sel.year;
  const era = data.taiwan.find((e) => e.id === sel.eraId);
  return Math.floor(((era.from ?? -10000) + Math.min(era.to, THIS_YEAR)) / 2);
}

function renderAll() {
  const era = data.taiwan.find((e) => e.id === sel.eraId);
  document.querySelectorAll('.era').forEach((n) => n.classList.toggle('sel', n.dataset.era === era.id && sel.year == null));
  document.querySelectorAll('.tick').forEach((n) => n.classList.toggle('sel', Number(n.dataset.year) === sel.year));
  $('#year-big').textContent = sel.year != null ? `${fmtYear(sel.year)} 年` : era.name;
  $('#year-era').textContent = sel.year != null ? `${era.name}時代 ${era.range}` : `${era.range}(尚未選擇年份)`;
  renderChips();
  renderMapEvents();
  renderEventsTab();
  renderEraTab();
}


const SECTIONS = [['background', '背景'], ['process', '經過'], ['figures', '數字與各方說法'], ['impact', '影響']];
const hasDetail = (e) => SECTIONS.some(([k]) => e[k]?.length) || e.people?.length;
const refsOf = (e) => e.references || (e.sources || []).map((u, i) => ({ title: `維基百科:${decodeURIComponent(u.split('/wiki/')[1] || u)}`, url: u }));
function detailHtml(e) {
  const t = TYPES[e.type];
  let h = `<div class="badge" style="color:${t.color}">${t.icon} ${t.label} · ${REGIONS[e.region].name} ${qTag(e)}</div><h2>${esc(e.title)}</h2><div class="empty">${esc(span(e))} · ${esc(e.place.name)}</div><p class="lead">${esc(e.summary)}</p>`;
  for (const [k, label] of SECTIONS) if (e[k]?.length) h += `<h3>${label}</h3><ul>${e[k].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  if (e.people?.length) h += `<h3>相關人物</h3><ul>${e.people.map((p) => `<li><b>${esc(p.name)}</b>:${esc(p.desc)}</li>`).join('')}</ul>`;
  h += `<h3>參考資料</h3><ul class="refs">${refsOf(e).map((r) => `<li>${r.url ? `<a href="${encodeURI(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title)}</li>`).join('')}</ul>`;
  return h;
}
function openDetail(id) {
  const e = events.find((x) => x.id === id);
  if (!e) return;
  $('#modal-body').innerHTML = detailHtml(e);
  $('#modal').hidden = false;
  $('#modal-body').scrollTop = 0;
}
$('#modal-close').onclick = () => { $('#modal').hidden = true; };
$('#modal').onclick = (ev) => { if (ev.target.id === 'modal') $('#modal').hidden = true; };
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') $('#modal').hidden = true; });

function eventsOfYear() { return sel.year == null ? [] : events.filter((e) => e.year === sel.year); }

function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] },
    center: [121, 24], zoom: 3.4, minZoom: 2.5, maxZoom: 9, dragRotate: false,
  });
  map.scrollZoom.disable();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
  map.on('move', layout);
  map.on('resize', layout);
  window.addEventListener('resize', layout);
}

function renderChips() {
  const c = $('#chips');
  c.innerHTML = '';
  const y = refYear();
  for (const [key, r] of Object.entries(REGIONS)) {
    const reveal = data.regionRevealYear[key];
    const dim = reveal != null && y < reveal;
    const chip = el('div', { class: 'chip' + (dim ? ' dim' : ''), tabindex: 0, 'data-region': key }, `${r.name}<span class="tip">${esc(r.name)}:${esc(regionEra(key, y))}${dim ? `<br>事件自 ${reveal} 年起顯示` : ''}</span>`);
    c.append(chip);
  }
  layout();
}

function renderMapEvents() {
  markers.forEach((m) => m.remove());
  markers = [];
  const map1 = new Map();
  for (const e of eventsOfYear()) {
    const key = e.region === 'world' ? 'world' : `${e.region}|${e.place.name}`;
    if (!map1.has(key)) map1.set(key, { region: e.region, place: e.place, events: [] });
    map1.get(key).events.push(e);
  }
  groups = [...map1.values()];
  const layer = $('#callouts');
  layer.innerHTML = '';
  for (const g of groups) {
    const t = TYPES[g.events[0].type];
    const box = el('div', { class: 'callout', style: `--c:${t.color}`, 'data-ids': g.events.map((e) => e.id).join(' ') });
    box.innerHTML = g.events.map((e) => `<div class="evrow" data-eid="${e.id}"><b>${TYPES[e.type].icon} ${esc(e.title)}</b><div class="meta">${esc(span(e))} · ${esc(e.place.name)} ${qTag(e)}</div><div class="more">${esc(e.summary)}${hasDetail(e) ? ` <a href="#" class="dl" data-id="${e.id}">完整背景 ›</a>` : ''}</div></div>`).join('');
    box.onclick = (ev) => {
      const a = ev.target.closest('.dl');
      if (a) { ev.preventDefault(); openDetail(a.dataset.id); return; }
      const row = ev.target.closest('[data-eid]');
      box.classList.add('open');
      focusEvent(row ? row.dataset.eid : g.events[0].id);
    };
    box.onmouseenter = () => highlight(g.events.map((e) => e.id), true);
    box.onmouseleave = () => highlight(g.events.map((e) => e.id), false);
    g.box = box;
    layer.append(box);
    if (g.region !== 'world') {
      const dot = el('div', { class: 'dot', style: `--c:${t.color}` });
      markers.push(new maplibregl.Marker({ element: dot }).setLngLat([g.place.lng, g.place.lat]).addTo(map));
    }
  }
  layout();
}

function highlight(ids, on) {
  document.querySelectorAll('.callout,.card').forEach((n) => {
    const mine = (n.dataset.ids || '').split(' ');
    if (ids.some((i) => mine.includes(i))) n.classList.toggle('hl', on);
  });
}

function layout() {
  if (!map || !data) return;
  const wrap = $('#map-wrap'), W = wrap.clientWidth, H = wrap.clientHeight;
  for (const chip of document.querySelectorAll('.chip')) {
    const p = map.project(REGIONS[chip.dataset.region].chip);
    chip.style.left = `${p.x}px`; chip.style.top = `${p.y}px`;
  }
  const svg = $('#lines');
  svg.innerHTML = '';
  const tw = map.project([121, 23.7]);
  const cols = {
    taiwan: { x: Math.min(tw.x + 70, W - 230) },
    china: { x: 12 },
    japan: { x: Math.max(W * 0.58, tw.x + 90) },
    world: { x: W - 226 },
  };
  for (const region of Object.keys(cols)) {
    const gs = groups.filter((g) => g.region === region);
    if (!gs.length) continue;
    const heights = gs.map((g) => g.box.offsetHeight);
    const total = heights.reduce((a, b) => a + b, 0) + 6 * (gs.length - 1);
    let y = region === 'taiwan' ? tw.y - total / 2 : region === 'china' ? 12 : region === 'japan' ? 10 : H * 0.55;
    y = Math.max(6, Math.min(y, H - total - 6));
    gs.forEach((g, i) => {
      g.box.style.left = `${cols[region].x}px`;
      g.box.style.top = `${y}px`;
      if (region !== 'world') {
        const p = map.project([g.place.lng, g.place.lat]);
        const bx = cols[region].x + (cols[region].x + 105 < p.x ? 210 : 0);
        const by = y + heights[i] / 2;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', p.x); line.setAttribute('y1', p.y);
        line.setAttribute('x2', bx); line.setAttribute('y2', by);
        line.setAttribute('stroke', getComputedStyle(g.box).borderLeftColor);
        line.setAttribute('stroke-width', 1.5);
        svg.append(line);
      }
      y += heights[i] + 6;
    });
  }
}

function renderEventsTab() {
  const body = $('#tab-events');
  $('#panel').classList.remove('tall');
  if (sel.year == null) {
    const era = data.taiwan.find((e) => e.id === sel.eraId);
    body.innerHTML = anchorsOf(era).length ? '<p class="empty">請點選時間軸上的年份。</p>' : `<p class="empty">${esc(era.name)}時代的事件尚未收錄。</p>`;
    return;
  }
  const order = ['taiwan', 'china', 'japan', 'world'];
  const list = eventsOfYear().sort((a, b) => order.indexOf(a.region) - order.indexOf(b.region));
  const focused = list.find((e) => e.id === focusId);
  $('#panel').classList.toggle('tall', !!focused);
  body.innerHTML = (focused ? `<aside class="why" style="--c:${TYPES[focused.type].color}">${whyBox(focused)}</aside>` : '') + '<div class="cards"></div>';
  if (focused) body.querySelector('.why-x').onclick = unfocus;
  const cards = body.querySelector('.cards');
  for (const e of list) {
    const t = TYPES[e.type];
    const c = el('article', { class: 'card', style: `--c:${t.color}`, 'data-ids': e.id });
    c.innerHTML = `<div class="badge">${t.icon} ${t.label} · ${REGIONS[e.region].name} ${qTag(e)}</div><h4>${esc(e.title)}</h4><div class="empty">${esc(span(e))} · ${esc(e.place.name)}</div><p>${esc(e.summary)}</p><div class="src"><button class="more-btn" data-id="${e.id}">${hasDetail(e) ? '完整背景與參考資料' : '參考資料'}</button></div>`;
    c.querySelector('.more-btn').onclick = () => openDetail(e.id);
    c.onmouseenter = () => highlight([e.id], true);
    c.onmouseleave = () => highlight([e.id], false);
    c.onclick = (ev) => { if (!ev.target.closest('button')) focusEvent(e.id); };
    if (e.id === focusId) c.classList.add('focus');
    cards.append(c);
  }
}

const fileUrl = (f, w) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=${w}`;
const filePage = (f) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f)}`;

let eraSub = 'life';
function renderEraTab() {
  const body = $('#tab-era');
  const content = data.content[sel.eraId];
  if (!content) { body.innerHTML = '<p class="empty">這個時代的生活相片與歷史反思尚未收錄。</p>'; return; }
  const era = data.taiwan.find((e) => e.id === sel.eraId);
  const mid = Math.floor(((era.from ?? -10000) + Math.min(era.to, THIS_YEAR)) / 2);
  const fig = (p, w = 420) => `<figure><a href="${filePage(p.file)}" target="_blank" rel="noopener" title="在 Wikimedia Commons 開啟原圖與授權"><img loading="lazy" alt="${esc(p.caption)}" src="${fileUrl(p.file, w)}"></a><figcaption>${esc(p.caption)}<br><span class="empty">${esc(p.license)}</span></figcaption></figure>`;
  const life = `<h3 class="rg-title">${esc(era.name)}時代的台灣生活<small>${content.photos.length} 張,點圖可看原圖與授權</small></h3><div class="gallery">${content.photos.map((p) => fig(p, 480)).join('')}</div>`;
  let cmp = '';
  if (content.regional) {
    const cols = ['china', 'japan'].filter((k) => content.regional[k]?.length).map((k) =>
      `<section class="rg-col"><h4>${REGIONS[k].name}<small>${esc(regionEra(k, mid))}</small></h4><div class="rg-figs">${content.regional[k].map((p) => fig(p)).join('')}</div></section>`).join('');
    cmp += `<h3 class="rg-title">同時期的中國與日本</h3><div class="rg-grid">${cols}</div>`;
  }
  const w = content.whatif;
  if (w) {
    cmp += `<h3 class="rg-title">歷史反思</h3><section class="reflect"><h4>🤔 ${esc(w.question)}?</h4><p><span class="tag">推測情境</span>${esc(w.speculation)}</p><p class="empty">${esc(w.basis)}</p>${w.contrastPhoto ? `<div class="reflect-photo">${fig(w.contrastPhoto, 640)}</div>` : ''}</section>`;
  }
  const subs = [['life', '生活相片', life], ['cmp', '中國日本與歷史反思', cmp], ['art', '這個時代的文章', '<h3 class="rg-title">這個時代的文章<small>以事件深度內容為主,點卡片會跳到該事件</small></h3><div id="articles"></div>']].filter((x) => x[2]);
  if (!subs.some((x) => x[0] === eraSub)) eraSub = subs[0][0];
  const h = `<nav class="subtabs">${subs.map(([k, l]) => `<button data-sub="${k}"${k === eraSub ? ' class="on"' : ''}>${l}</button>`).join('')}</nav>` + subs.map(([k, , html]) => `<div class="subpane" data-pane="${k}"${k === eraSub ? '' : ' hidden'}>${html}</div>`).join('');
  body.innerHTML = h;
  body.querySelectorAll('.subtabs button').forEach((b) => b.onclick = () => {
    eraSub = b.dataset.sub;
    body.querySelectorAll('.subtabs button').forEach((x) => x.classList.toggle('on', x === b));
    body.querySelectorAll('.subpane').forEach((x) => (x.hidden = x.dataset.pane !== eraSub));
    body.scrollTop = 0;
  });
  renderArticles();
}

// 「這個時代的文章」:精選(eras.json 的 featured)+ 其餘詳細/完整事件,可依類型、區域篩選;簡述事件不列。
const art = { era: null, type: null, region: null, all: false };
function renderArticles() {
  const box = $('#articles');
  if (!box) return;
  if (art.era !== sel.eraId) Object.assign(art, { era: sel.eraId, type: null, region: null, all: false });
  const feat = data.content[sel.eraId]?.featured || [];
  const fids = new Set(feat.map((f) => f.id));
  const pool = events.filter((e) => eraOf(e.year)?.id === sel.eraId && quality(e).level !== 'brief');
  const card = (e, why) => {
    const t = TYPES[e.type];
    const first = (e.summary.split('。')[0] || e.summary) + '。';
    return `<button class="acard" data-id="${e.id}" style="--c:${t.color}"><div class="badge">${t.icon} ${t.label} · ${REGIONS[e.region].name} ${qTag(e)}</div><h4>${esc(e.title)}</h4>${why ? `<p class="awhy">★ ${esc(why)}</p>` : ''}<p>${esc(first)}</p><div class="empty">${esc(span(e))} · 參考資料 ${refsOf(e).length} 筆</div></button>`;
  };
  let h = '';
  const picks = feat.map((f) => [events.find((e) => e.id === f.id), f.why]).filter(([e]) => e);
  if (picks.length) h += `<h4 class="art-sub">從這篇讀起</h4><div class="acards">${picks.map(([e, w]) => card(e, w)).join('')}</div>`;
  const rest = pool.filter((e) => !fids.has(e.id));
  const types = [...new Set(rest.map((e) => e.type))], regions = [...new Set(rest.map((e) => e.region))];
  const chip = (kind, val, label) => `<button class="achip${art[kind] === val ? ' on' : ''}" data-kind="${kind}" data-val="${val ?? ''}">${label}</button>`;
  const shown = rest.filter((e) => (!art.type || e.type === art.type) && (!art.region || e.region === art.region))
    .sort((a, b) => LEVELS[quality(b).level].rank - LEVELS[quality(a).level].rank || a.year - b.year);
  if (rest.length) {
    h += `<h4 class="art-sub">本時代其他深度內容<small>${shown.length} / ${rest.length} 篇</small></h4><div class="achips">`
      + chip('type', null, '全部類型') + types.map((k) => chip('type', k, `${TYPES[k].icon} ${TYPES[k].label}`)).join('')
      + (regions.length > 1 ? '<span class="sep"></span>' + chip('region', null, '全部區域') + regions.map((k) => chip('region', k, REGIONS[k].name)).join('') : '')
      + '</div>';
    const vis = art.all ? shown : shown.slice(0, 6);
    h += vis.length ? `<div class="acards">${vis.map((e) => card(e)).join('')}</div>` : '<p class="empty">沒有符合條件的文章。</p>';
    if (shown.length > 6) h += `<button class="amore">${art.all ? '收合' : `顯示全部 ${shown.length} 篇`}</button>`;
  }
  if (!h) h = '<p class="empty">這個時代還沒有可列出的深度內容。</p>';
  box.innerHTML = h;
  box.querySelectorAll('.acard').forEach((b) => b.onclick = () => {
    const e = events.find((x) => x.id === b.dataset.id);
    selectYear(e.year);
    focusEvent(e.id);
  });
  box.querySelectorAll('.achip').forEach((b) => b.onclick = () => { art[b.dataset.kind] = b.dataset.val || null; art.all = false; renderArticles(); });
  const more = box.querySelector('.amore');
  if (more) more.onclick = () => { art.all = !art.all; renderArticles(); };
}

document.querySelectorAll('#tabs button').forEach((b) => b.onclick = () => showTab(b.dataset.tab));

init();
