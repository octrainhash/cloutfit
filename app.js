// Cloutfit: closet scanning, outfit boards on a mannequin, saved looks, and AI try-on.
import { cutout, colorName, rgb2hex, all, put, del, get, art } from './closet.js';

/* ---------------- catalogue ---------------- */
export const TYPES = {
  tee: { label: 'T-shirt', cat: 'Tops', slot: 'top', tc: 'tops' }, tank: { label: 'Tank', cat: 'Tops', slot: 'top', tc: 'tops' },
  shirt: { label: 'Shirt', cat: 'Tops', slot: 'top', tc: 'tops' }, longsleeve: { label: 'Long sleeve', cat: 'Tops', slot: 'top', tc: 'tops' },
  sweater: { label: 'Sweater', cat: 'Tops', slot: 'top', tc: 'tops' }, hoodie: { label: 'Hoodie', cat: 'Tops', slot: 'top', tc: 'tops' },
  jacket: { label: 'Jacket', cat: 'Outerwear', slot: 'outer', tc: 'tops' }, coat: { label: 'Coat', cat: 'Outerwear', slot: 'outer', tc: 'tops' },
  jeans: { label: 'Jeans', cat: 'Bottoms', slot: 'bottom', tc: 'bottoms' }, trousers: { label: 'Trousers', cat: 'Bottoms', slot: 'bottom', tc: 'bottoms' },
  shorts: { label: 'Shorts', cat: 'Bottoms', slot: 'short', tc: 'bottoms' }, skirt: { label: 'Skirt', cat: 'Bottoms', slot: 'short', tc: 'bottoms' },
  dress: { label: 'Dress', cat: 'Dresses', slot: 'dress', tc: 'one-pieces' },
  sneakers: { label: 'Sneakers', cat: 'Shoes', slot: 'shoes' }, boots: { label: 'Boots', cat: 'Shoes', slot: 'shoes' },
  heels: { label: 'Heels', cat: 'Shoes', slot: 'shoes' }, sandals: { label: 'Sandals', cat: 'Shoes', slot: 'shoes' },
  hat: { label: 'Hat', cat: 'Accessories', slot: 'hat' }, bag: { label: 'Bag', cat: 'Accessories', slot: 'bag' }, accessory: { label: 'Accessory', cat: 'Accessories', slot: 'acc' }
};
const CATS = ['All', 'Tops', 'Outerwear', 'Bottoms', 'Dresses', 'Shoes', 'Accessories', 'Favourites'];
const FAMILIES = [['Black', '#151515'], ['Grey', '#9a9aa0'], ['White', '#f6f6f4'], ['Beige', '#d8c3a5'], ['Brown', '#6b4226'], ['Red', '#c0282f'], ['Pink', '#f0a6ca'], ['Orange', '#e8742a'], ['Yellow', '#f2c94c'], ['Green', '#2f7d4b'], ['Blue', '#2f5d9a'], ['Purple', '#6a3d9a']];
const PALETTE = ['#151515', '#3a3a3c', '#8e8e93', '#f7f7f5', '#efe6d2', '#d8c3a5', '#b08a5a', '#6b4226', '#1f2a44', '#2f5d9a', '#9cc3e6', '#3d5a80', '#2f7d4b', '#6b6b2e', '#a3b18a', '#f2c94c', '#e8742a', '#c0282f', '#6d1a2f', '#f0a6ca', '#c3a6e0', '#6a3d9a'];

/* ---------------- tiny helpers ---------------- */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const day = () => new Date().toISOString().slice(0, 10);
function toast(msg, ms = 2400) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms); }
function hexToRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function family(hex) { const [r, g, b] = hexToRgb(hex); let best = FAMILIES[0][0], bd = 1e9; for (const [n, h] of FAMILIES) { const [R, G, B] = hexToRgb(h); const d = (r - R) ** 2 * 2 + (g - G) ** 2 * 4 + (b - B) ** 2 * 3; if (d < bd) { bd = d; best = n; } } return best; }
function hue(hex) { const [r, g, b] = hexToRgb(hex).map(v => v / 255), M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; if (d < .08) return 400 + (1 - M) * 100; let h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; }
function loadImg(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; }); }
async function shrink(src, max = 360, type = 'image/png', q = .9, bg = null) {
  const img = await loadImg(src); const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  const x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); } x.drawImage(img, 0, 0, c.width, c.height); return c.toDataURL(type, q);
}
function itemArt(it) { return it.thumb || it.photo ? `<img src="${it.thumb || it.photo}" alt="" loading="lazy">` : art(it.type, it.color); }

/* ---------------- state ---------------- */
const S = { items: [], looks: [], tryons: [], settings: {}, cat: 'All', fam: null, q: '', sort: 'new', tab: 'closet',
  board: { mode: 'mannequin', fig: 'woman', layers: [], sel: null, editing: null }, railCat: 'All', picks: [], me: null };
let MQ = null;

async function boot() {
  [S.items, S.looks, S.tryons] = await Promise.all([all('items'), all('outfits'), all('tryons')]);
  S.settings = (await get('kv', 'settings')) || {};
  S.me = (await get('kv', 'me')) || null;
  S.board.fig = S.settings.fig || 'woman';
  try { MQ = await fetch('assets/mannequins.json').then(r => r.json()); } catch (e) { MQ = null; }
  bind(); renderAll(); setFig(S.board.fig);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
function saveSettings() { return put('kv', S.settings, 'settings'); }
function renderAll() { renderCloset(); renderRail(); renderLooks(); renderTryon(); }

/* ---------------- tabs ---------------- */
function go(tab) {
  S.tab = tab; $$('.view').forEach(v => v.classList.toggle('on', v.id === tab)); $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  scrollTo({ top: 0 }); if (tab === 'style') requestAnimationFrame(drawBoard);
}

/* ---------------- closet ---------------- */
function filtered() {
  let L = S.items.slice();
  if (S.cat === 'Favourites') L = L.filter(i => i.fav); else if (S.cat !== 'All') L = L.filter(i => TYPES[i.type]?.cat === S.cat);
  if (S.fam) L = L.filter(i => family(i.color) === S.fam);
  if (S.q) { const q = S.q.toLowerCase(); L = L.filter(i => [i.name, i.brand, i.colorName, TYPES[i.type]?.label, i.notes, i.size].join(' ').toLowerCase().includes(q)); }
  const by = { new: (a, b) => b.created - a.created, worn: (a, b) => (b.wears || 0) - (a.wears || 0), least: (a, b) => (a.wears || 0) - (b.wears || 0), colour: (a, b) => hue(a.color) - hue(b.color), name: (a, b) => a.name.localeCompare(b.name) }[S.sort];
  return L.sort(by);
}
function renderCloset() {
  const n = S.items.length, never = S.items.filter(i => !i.wears).length;
  $('#closetSub').textContent = n ? `${n} piece${n > 1 ? 's' : ''}${never ? ` · ${never} never worn` : ''}` : 'Everything you own, in one place.';
  $('#cats').innerHTML = CATS.filter(c => c === 'All' || c === 'Favourites' ? true : S.items.some(i => TYPES[i.type]?.cat === c) || !n).map(c => `<button class="chip ${S.cat === c ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('');
  const fams = [...new Set(S.items.map(i => family(i.color)))];
  $('#colours').innerHTML = fams.length > 1 ? FAMILIES.filter(f => fams.includes(f[0])).map(([nm, h]) => `<button class="dot ${S.fam === nm ? 'on' : ''}" data-fam="${nm}" style="background:${h}" aria-label="${nm}" title="${nm}"></button>`).join('') : '';
  const L = filtered();
  $('#count').textContent = n ? `${L.length} shown` : '';
  $('#empty').hidden = !!n; $('.sortrow').hidden = !n; $('.search').hidden = !n; $('#colours').hidden = !n;
  $('#grid').innerHTML = L.map(i => `<button class="card" data-id="${i.id}">
      <div class="ph">${itemArt(i)}</div>
      ${i.wears ? '' : '<span class="badge">New</span>'}
      <span class="fav ${i.fav ? 'on' : ''}" data-fav="${i.id}" role="button" aria-label="Favourite"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></span>
      <div class="meta"><div class="nm">${esc(i.name)}</div><div class="ds"><span class="sw" style="background:${i.color}"></span>${esc(i.colorName)} · ${esc(TYPES[i.type]?.label || '')}${i.wears ? ` · worn ${i.wears}×` : ''}</div></div></button>`).join('');
}

/* ---------------- adding clothes ---------------- */
let queue = [];
async function addFiles(files) {
  files = [...files].filter(f => f.type.startsWith('image/')); if (!files.length) return;
  closeSheet(); toast(`Cutting out ${files.length} photo${files.length > 1 ? 's' : ''}…`, 60000);
  for (const [k, f] of files.entries()) {
    try {
      const raw = await fileToDataURL(f);
      const c = await cutout(f);
      queue.push({ id: uid(), raw, cut: c.photo, keepBg: c.failed, photo: c.failed ? await shrink(raw, 600, 'image/jpeg', .88) : c.photo, color: c.color, colorName: c.colorName, type: c.guess, name: '', brand: '', size: '', notes: '' });
      toast(`Cutting out ${k + 1} of ${files.length}…`, 60000);
    } catch (e) { console.error(e); }
  }
  toast(`${queue.length} ready to review`);
  reviewNext();
}
function fileToDataURL(f) { return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); }); }
function defaultName(d) { return `${d.colorName} ${TYPES[d.type]?.label.toLowerCase() || 'piece'}`.replace(/^./, c => c.toUpperCase()); }
function reviewNext() {
  const d = queue[0]; if (!d) { closeSheet(); return; }
  const left = queue.length;
  openSheet(`<div class="shead"><h2>${left > 1 ? `New piece <small style="font:600 14px var(--sans);color:var(--ink3)">1 of ${left}</small>` : 'New piece'}</h2><button class="ic" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    ${itemForm(d, true)}
    <div class="sactions">${left > 1 ? `<button class="ghost" id="saveAll">Save all ${left}</button>` : ''}<button class="ghost danger" id="skip">Skip</button><button class="primary" id="saveOne">Save to closet</button></div>`);
  wireForm(d);
  $('#saveOne').onclick = async () => { readForm(d); await saveDraft(d); queue.shift(); reviewNext(); };
  $('#skip').onclick = () => { queue.shift(); reviewNext(); };
  const sa = $('#saveAll'); if (sa) sa.onclick = async () => { readForm(d); for (const q of queue) await saveDraft(q); toast(`Saved ${queue.length} pieces`); queue = []; closeSheet(); };
}
async function saveDraft(d) {
  const it = { id: d.id, name: (d.name || '').trim() || defaultName(d), type: d.type, color: d.color, colorName: d.colorName, photo: d.photo, thumb: await shrink(d.photo, 360, d.keepBg ? 'image/jpeg' : 'image/png', .85), keepBg: d.keepBg, brand: d.brand, size: d.size, notes: d.notes, fav: false, wears: 0, created: Date.now() };
  S.items.push(it); await put('items', it); renderCloset(); renderRail();
}
function itemForm(d, isNew) {
  const groups = {}; for (const [k, v] of Object.entries(TYPES)) (groups[v.cat] ||= []).push(k);
  return `<div class="big-ph ${d.keepBg ? '' : 'check'}" id="fPh"><img src="${d.photo}" alt=""></div>
    ${d.cut || d.raw ? `<label class="toggle"><span><b>Remove background</b><br><small style="color:var(--ink3)">Turn off if the cut-out missed part of the piece</small></span><input type="checkbox" id="fBg" ${d.keepBg ? '' : 'checked'}></label>` : ''}
    <div class="field"><label>Type</label><div class="types" id="fType">${Object.entries(groups).map(([, ks]) => ks.map(k => `<button data-t="${k}" class="${d.type === k ? 'on' : ''}">${TYPES[k].label}</button>`).join('')).join('')}</div></div>
    <div class="field"><label>Colour · <span id="fCname">${esc(d.colorName)}</span></label><div class="swatches" id="fCol"><button class="on" data-c="${d.color}" style="background:${d.color}" aria-label="Detected colour"></button>${PALETTE.map(c => `<button data-c="${c}" style="background:${c}" aria-label="${colorName(c)}"></button>`).join('')}<input type="color" id="fColor" value="${d.color}" aria-label="Custom colour"></div></div>
    <div class="field"><label>Name</label><input id="fName" placeholder="${esc(defaultName(d))}" value="${esc(isNew ? '' : d.name)}" maxlength="60"></div>
    <div class="row2"><div class="field"><label>Brand</label><input id="fBrand" value="${esc(d.brand || '')}" maxlength="40"></div><div class="field"><label>Size</label><input id="fSize" value="${esc(d.size || '')}" maxlength="12"></div></div>
    <div class="field"><label>Notes</label><textarea id="fNotes" maxlength="300" placeholder="Where it's from, care, what it goes with…">${esc(d.notes || '')}</textarea></div>`;
}
function wireForm(d) {
  $('#fType').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; d.type = b.dataset.t; $$('#fType button').forEach(x => x.classList.toggle('on', x === b)); $('#fName').placeholder = defaultName(d); };
  const setC = c => { d.color = c; d.colorName = colorName(c); $('#fCname').textContent = d.colorName; $('#fName').placeholder = defaultName(d); $$('#fCol button').forEach(x => x.classList.toggle('on', x.dataset.c === c)); $('#fColor').value = c; };
  $('#fCol').onclick = e => { const b = e.target.closest('[data-c]'); if (b) setC(b.dataset.c); };
  $('#fColor').oninput = e => setC(e.target.value);
  const bg = $('#fBg'); if (bg) bg.onchange = async () => {
    d.keepBg = !bg.checked;
    d.photo = d.keepBg ? (d.raw ? await shrink(d.raw, 600, 'image/jpeg', .88) : d.photo) : (d.cut || d.photo);
    $('#fPh').classList.toggle('check', !d.keepBg); $('#fPh img').src = d.photo;
  };
}
function readForm(d) { d.name = $('#fName').value.trim(); d.brand = $('#fBrand').value.trim(); d.size = $('#fSize').value.trim(); d.notes = $('#fNotes').value.trim(); }

/* ---------------- item detail ---------------- */
function openItem(id) {
  const it = S.items.find(i => i.id === id); if (!it) return;
  const looks = S.looks.filter(l => l.layers.some(x => x.item === id)).length;
  openSheet(`<div class="shead"><h2>${esc(it.name)}</h2><button class="ic" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="big-ph"><img src="${it.photo}" alt=""></div>
    <div class="kv"><div><b>${it.wears || 0}×</b>worn</div><div><b>${it.lastWorn ? new Date(it.lastWorn).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'}</b>last worn</div><div><b>${looks}</b>looks</div><div><b style="display:flex;align-items:center;gap:6px"><span class="sw" style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${it.color};box-shadow:0 0 0 1px rgba(0,0,0,.12)"></span>${esc(it.colorName)}</b>${esc(TYPES[it.type]?.label)}${it.brand ? ' · ' + esc(it.brand) : ''}${it.size ? ' · ' + esc(it.size) : ''}</div></div>
    ${it.notes ? `<p style="color:var(--ink2);margin:0 0 6px">${esc(it.notes)}</p>` : ''}
    <div class="sactions"><button class="ghost" id="iWore">Wore it today</button><button class="ghost" id="iEdit">Edit</button><button class="ghost danger" id="iDel">Delete</button></div>
    <div class="sactions" style="margin-top:8px"><button class="ghost" id="iTry">Try it on</button><button class="primary" id="iStyle">Style it</button></div>`);
  $('#iWore').onclick = async () => { await wore([id]); toast('Logged as worn today'); openItem(id); };
  $('#iEdit').onclick = () => editItem(id);
  $('#iDel').onclick = async () => { if (!confirm(`Delete “${it.name}” from your closet?`)) return; S.items = S.items.filter(i => i.id !== id); await del('items', id); S.board.layers = S.board.layers.filter(l => l.item !== id); S.picks = S.picks.filter(p => p !== id); closeSheet(); renderAll(); drawBoard(); toast('Deleted'); };
  $('#iStyle').onclick = () => { closeSheet(); go('style'); addLayer(id); };
  $('#iTry').onclick = () => { closeSheet(); setPick(id); go('tryon'); };
}
function editItem(id) {
  const it = S.items.find(i => i.id === id), d = { ...it };
  openSheet(`<div class="shead"><h2>Edit piece</h2><button class="ic" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>${itemForm(d, false)}<div class="sactions"><button class="ghost" data-close>Cancel</button><button class="primary" id="eSave">Save</button></div>`);
  wireForm(d);
  $('#eSave').onclick = async () => { readForm(d); Object.assign(it, { name: d.name || defaultName(d), type: d.type, color: d.color, colorName: d.colorName, brand: d.brand, size: d.size, notes: d.notes }); await put('items', it); renderAll(); drawBoard(); openItem(id); toast('Saved'); };
}
async function wore(ids) { const t = Date.now(); for (const id of ids) { const it = S.items.find(i => i.id === id); if (!it) continue; it.wears = (it.wears || 0) + 1; it.lastWorn = t; await put('items', it); } renderCloset(); }

/* ---------------- style board ---------------- */
const board = () => $('#board');
function setFig(f) {
  S.board.fig = f; S.settings.fig = f; saveSettings();
  $('#fig').src = `assets/mannequin-${f}.webp`; $$('#figSeg button').forEach(b => b.classList.toggle('on', b.dataset.f === f));
}
function setMode(m) {
  S.board.mode = m; board().classList.toggle('flat', m === 'flat'); $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === m)); $('#figSeg').style.visibility = m === 'flat' ? 'hidden' : '';
  autoLayout(true); drawBoard();
}
// mannequin landmark -> board fraction
function mq(pt) {
  const m = MQ?.[S.board.fig]; if (!m) return [.5, .5];
  const bw = 3, bh = 4, ih = .94 * bh, iw = ih * m.w / m.h, p = m.pts[pt];
  return [.5 + (p[0] - .5) * iw / bw, .03 + p[1] * .94];
}
function slotOf(id) { const it = S.items.find(i => i.id === id); return TYPES[it?.type]?.slot || 'acc'; }
function aspectOf(id) { return new Promise(ok => { const it = S.items.find(i => i.id === id); if (!it) return ok(1); loadImg(it.thumb || it.photo).then(i => ok(i.height / i.width)).catch(() => ok(1)); }); }
const Z = { bottom: 1, short: 1, shoes: 2, dress: 3, top: 4, outer: 6, hat: 7, bag: 8, acc: 9 };
async function placeOnMannequin(L) {
  const slot = slotOf(L.item), ar = L.ar || (L.ar = await aspectOf(L.item));
  const sL = mq('shoulderL'), sR = mq('shoulderR'), neck = mq('neck'), waist = mq('waist'), hipL = mq('hipL'), hipR = mq('hipR'), aL = mq('ankleL'), aR = mq('ankleR'), kn = mq('kneeL'), top = mq('headTop'), wr = mq('wristL');
  const shW = sL[0] - sR[0], bA = 4 / 3;   // board height/width in width units
  const fitTop = (w, yTop) => { L.w = w; L.x = .5; L.y = yTop + w * ar / bA / 2; };
  const fitH = (h, yTop) => { L.w = h * bA / ar; L.x = .5; L.y = yTop + h / 2; };
  if (slot === 'top') fitTop(shW * 1.75, neck[1] - .01);
  else if (slot === 'outer') fitTop(shW * 1.95, neck[1] - .015);
  else if (slot === 'dress') { fitH(clamp((kn[1] - neck[1]) * 1.05, .2, .7), neck[1] - .005); L.w = Math.min(L.w, shW * 2.2); }
  else if (slot === 'bottom') { fitH(aL[1] - waist[1] + .02, waist[1] - .005); L.w = Math.min(L.w, (hipL[0] - hipR[0]) * 3.2); }
  else if (slot === 'short') { L.w = (hipL[0] - hipR[0]) * 2.7; L.x = .5; L.y = waist[1] - .005 + L.w * ar / bA / 2; }
  else if (slot === 'shoes') { L.w = (aL[0] - aR[0]) * 2.5; L.x = .5; L.y = (aL[1] + aR[1]) / 2 + .035; }
  else if (slot === 'hat') { L.w = shW * .72; L.x = .5; L.y = top[1] + .03; }
  else if (slot === 'bag') { L.w = shW * .7; L.x = wr[0] + .06; L.y = wr[1] + .03; }
  else { L.w = shW * .4; L.x = neck[0]; L.y = neck[1] + .06; }
  L.z = Z[slot] ?? 5; L.rot = 0;
}
async function placeFlat(Ls) {
  // magazine-style flat lay: tops upper left, bottoms lower left, shoes lower right, the rest on the right
  const cols = { top: [.34, .27, .46], outer: [.66, .25, .42], dress: [.34, .42, .5], bottom: [.36, .68, .42], short: [.36, .62, .38], shoes: [.72, .82, .3], hat: [.72, .1, .24], bag: [.74, .55, .3], acc: [.76, .66, .18] };
  const used = {};
  for (const L of Ls) { const s = slotOf(L.item), c = cols[s] || cols.acc, n = used[s] = (used[s] || 0) + 1; L.ar = L.ar || await aspectOf(L.item); L.w = c[2]; const hMax = .34 * 4 / 3; if (L.w * L.ar > hMax) L.w = hMax / L.ar; L.x = c[0] + (n - 1) * .06; L.y = c[1] + (n - 1) * .05; L.rot = (Math.random() - .5) * 8; L.z = Z[s] ?? 5; }
}
async function autoLayout(all) { if (S.board.mode === 'flat') await placeFlat(S.board.layers); else for (const L of S.board.layers) if (all || L.auto) await placeOnMannequin(L); drawBoard(); }
async function addLayer(id) {
  const ex = S.board.layers.find(l => l.item === id); if (ex) { S.board.layers = S.board.layers.filter(l => l !== ex); select(null); drawBoard(); renderRail(); return; }
  const slot = slotOf(id);
  // one per slot (tops can sit under outerwear; dress replaces top + bottoms)
  const clash = { top: ['top', 'dress'], outer: ['outer'], dress: ['dress', 'top', 'bottom', 'short'], bottom: ['bottom', 'short', 'dress'], short: ['bottom', 'short', 'dress'], shoes: ['shoes'], hat: ['hat'], bag: ['bag'] }[slot] || [];
  S.board.layers = S.board.layers.filter(l => !clash.includes(slotOf(l.item)));
  const L = { item: id, x: .5, y: .5, w: .4, rot: 0, flip: false, z: 5 };
  S.board.layers.push(L);
  if (S.board.mode === 'flat') await placeFlat(S.board.layers); else await placeOnMannequin(L);
  select(L); drawBoard(); renderRail();
}
function drawBoard() {
  const el = $('#layers'); if (!el) return; const W = board().clientWidth, H = board().clientHeight; if (!W) return;
  const sorted = S.board.layers.slice().sort((a, b) => a.z - b.z);
  el.innerHTML = sorted.map(L => { const it = S.items.find(i => i.id === L.item); if (!it) return ''; const i = S.board.layers.indexOf(L);
    return `<div class="lay ${S.board.sel === L ? 'sel' : ''}" data-i="${i}" style="left:${(L.x - L.w / 2) * W}px;top:${L.y * H - L.w * W * (L.ar || 1) / 2}px;width:${L.w * W}px;z-index:${L.z};transform:rotate(${L.rot || 0}deg) scaleX(${L.flip ? -1 : 1})"><img src="${it.photo}" alt="${esc(it.name)}"><i class="h"></i></div>`; }).join('');
  $('#layerBar').hidden = !S.board.sel;
}
function select(L) { S.board.sel = L; drawBoard(); }
function bindBoard() {
  const el = board(), pts = new Map(); let mode = null, start = null, L = null;
  el.addEventListener('pointerdown', e => {
    const lay = e.target.closest('.lay');
    if (!lay) { select(null); return; }
    L = S.board.layers[+lay.dataset.i]; if (S.board.sel !== L) select(L);
    el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = el.getBoundingClientRect();
    mode = e.target.classList.contains('h') ? 'resize' : pts.size === 2 ? 'pinch' : 'move';
    start = { x: L.x, y: L.y, w: L.w, rot: L.rot || 0, px: e.clientX, py: e.clientY, r, cx: r.left + L.x * r.width, cy: r.top + L.y * r.height };
    if (mode === 'pinch') { const [a, b] = [...pts.values()]; start.d = Math.hypot(a[0] - b[0], a[1] - b[1]); start.a = Math.atan2(b[1] - a[1], b[0] - a[0]); }
    L.auto = false; e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    if (!L || !pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); const r = start.r;
    if (mode === 'move' && pts.size === 1) { L.x = clamp(start.x + (e.clientX - start.px) / r.width, -.1, 1.1); L.y = clamp(start.y + (e.clientY - start.py) / r.height, -.1, 1.1); }
    else if (mode === 'resize') { const d0 = Math.hypot(start.px - start.cx, start.py - start.cy), d1 = Math.hypot(e.clientX - start.cx, e.clientY - start.cy); L.w = clamp(start.w * d1 / (d0 || 1), .05, 1.6); }
    else if (pts.size === 2) { if (mode !== 'pinch') { mode = 'pinch'; const [a, b] = [...pts.values()]; start.d = Math.hypot(a[0] - b[0], a[1] - b[1]); start.a = Math.atan2(b[1] - a[1], b[0] - a[0]); start.w = L.w; start.rot = L.rot || 0; }
      const [a, b] = [...pts.values()]; L.w = clamp(start.w * Math.hypot(a[0] - b[0], a[1] - b[1]) / (start.d || 1), .05, 1.6); L.rot = start.rot + (Math.atan2(b[1] - a[1], b[0] - a[0]) - start.a) * 180 / Math.PI; }
    drawBoard();
  });
  const end = e => { pts.delete(e.pointerId); if (!pts.size) { L = null; mode = null; } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', e => { const s = S.board.sel; if (!s) return; e.preventDefault(); s.w = clamp(s.w * (e.deltaY < 0 ? 1.06 : .94), .05, 1.6); drawBoard(); }, { passive: false });
  $('#layerBar').onclick = e => {
    const b = e.target.closest('[data-l]'), s = S.board.sel; if (!b || !s) return;
    const zs = S.board.layers.map(l => l.z);
    if (b.dataset.l === 'front') s.z = Math.max(...zs) + 1; else if (b.dataset.l === 'back') s.z = Math.min(...zs) - 1;
    else if (b.dataset.l === 'flip') s.flip = !s.flip; else { S.board.layers = S.board.layers.filter(l => l !== s); S.board.sel = null; renderRail(); }
    drawBoard();
  };
  new ResizeObserver(drawBoard).observe(el);
}
function renderRail() {
  const cats = ['All', ...CATS.slice(1, 7).filter(c => S.items.some(i => TYPES[i.type]?.cat === c))];
  if (!cats.includes(S.railCat)) S.railCat = 'All';
  $('#railCats').innerHTML = cats.map(c => `<button class="chip ${S.railCat === c ? 'on' : ''}" data-rc="${c}">${c}</button>`).join('');
  const L = S.items.filter(i => S.railCat === 'All' || TYPES[i.type]?.cat === S.railCat).sort((a, b) => (Z[TYPES[b.type]?.slot] ?? 9) - (Z[TYPES[a.type]?.slot] ?? 9));
  const on = new Set(S.board.layers.map(l => l.item));
  $('#railGrid').innerHTML = L.length ? L.map(i => `<button class="rit ${on.has(i.id) ? 'on' : ''}" data-add="${i.id}" title="${esc(i.name)}">${itemArt(i)}</button>`).join('') : `<div class="railempty">Add clothes to your closet to style them here.</div>`;
}
async function shuffle() {
  const pick = slots => { const c = S.items.filter(i => slots.includes(TYPES[i.type]?.slot)); return c.length ? c[Math.floor(Math.random() * c.length)] : null; };
  const out = []; const useDress = Math.random() < .3 && pick(['dress']);
  if (useDress) out.push(useDress); else { const t = pick(['top']); const b = pick(['bottom', 'short']); t && out.push(t); b && out.push(b); }
  const o = Math.random() < .5 && pick(['outer']); o && out.push(o);
  const s = pick(['shoes']); s && out.push(s);
  if (!out.length) { toast('Add some clothes first'); return; }
  S.board.layers = []; S.board.sel = null; for (const it of out) await addLayer(it.id); select(null);
}
async function renderBoardImage(W = 900) {
  const H = W * 4 / 3, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const g = x.createRadialGradient(W * .5, H * .3, 10, W * .5, H * .5, H * .7); g.addColorStop(0, '#FFF9F4'); g.addColorStop(.7, '#F6EDE5'); g.addColorStop(1, '#EFE3D8'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (S.board.mode === 'mannequin') { const f = await loadImg($('#fig').src), fh = H * .94, fw = fh * f.width / f.height; x.drawImage(f, (W - fw) / 2, H * .03, fw, fh); }
  for (const L of S.board.layers.slice().sort((a, b) => a.z - b.z)) {
    const it = S.items.find(i => i.id === L.item); if (!it) continue; const img = await loadImg(it.photo); const w = L.w * W, h = w * img.height / img.width;
    x.save(); x.translate(L.x * W, L.y * H); x.rotate((L.rot || 0) * Math.PI / 180); x.scale(L.flip ? -1 : 1, 1); x.shadowColor = 'rgba(0,0,0,.16)'; x.shadowBlur = W * .012; x.shadowOffsetY = W * .005; x.drawImage(img, -w / 2, -h / 2, w, h); x.restore();
  }
  return c.toDataURL('image/jpeg', .9);
}
async function saveLook() {
  if (!S.board.layers.length) { toast('Add some clothes to the board first'); return; }
  const editing = S.board.editing && S.looks.find(l => l.id === S.board.editing);
  const name = prompt('Name this look', editing?.name || suggestName()); if (name === null) return;
  S.board.sel = null; drawBoard();
  const img = await renderBoardImage(720);
  const look = editing || { id: uid(), created: Date.now(), worn: [] };
  Object.assign(look, { name: name.trim() || suggestName(), mode: S.board.mode, fig: S.board.fig, layers: S.board.layers.map(({ item, x, y, w, rot, flip, z, ar }) => ({ item, x, y, w, rot, flip, z, ar })), img, updated: Date.now() });
  if (!editing) S.looks.unshift(look); await put('outfits', look); S.board.editing = look.id; renderLooks(); toast('Look saved');
}
function suggestName() { const d = new Date(); return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()] + ' look'; }

/* ---------------- looks ---------------- */
function renderLooks() {
  $('#looksSub').textContent = S.looks.length ? `${S.looks.length} saved` : 'Outfits you have put together.';
  $('#lookEmpty').hidden = !!S.looks.length;
  $('#lookGrid').innerHTML = S.looks.map(l => `<button class="look" data-look="${l.id}"><img src="${l.img}" alt="" loading="lazy"><div class="meta"><div class="nm">${esc(l.name)}</div><div class="ds">${l.layers.length} pieces${l.worn?.length ? ` · worn ${l.worn.length}×` : ''}</div></div></button>`).join('');
}
function openLook(id) {
  const l = S.looks.find(x => x.id === id); if (!l) return;
  openSheet(`<div class="shead"><h2>${esc(l.name)}</h2><button class="ic" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <img src="${l.img}" alt="" style="border-radius:18px;width:100%;max-height:60vh;object-fit:contain;background:var(--tile)">
    <div class="kv"><div><b>${l.layers.length}</b>pieces</div><div><b>${l.worn?.length || 0}×</b>worn</div><div><b>${l.worn?.length ? new Date(l.worn[l.worn.length - 1]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'}</b>last worn</div></div>
    <div class="sactions"><button class="ghost" id="lWore">Wore it today</button><button class="ghost" id="lShare">Share</button><button class="ghost danger" id="lDel">Delete</button></div>
    <div class="sactions" style="margin-top:8px"><button class="ghost" id="lTry">Try it on</button><button class="primary" id="lEdit">Edit look</button></div>`);
  $('#lWore').onclick = async () => { (l.worn ||= []).push(day()); await put('outfits', l); await wore(l.layers.map(x => x.item)); renderLooks(); toast('Logged as worn today'); openLook(id); };
  $('#lShare').onclick = () => shareImage(l.img, l.name);
  $('#lDel').onclick = async () => { if (!confirm(`Delete the look “${l.name}”?`)) return; S.looks = S.looks.filter(x => x.id !== id); await del('outfits', id); if (S.board.editing === id) S.board.editing = null; closeSheet(); renderLooks(); toast('Deleted'); };
  $('#lEdit').onclick = () => { closeSheet(); S.board.layers = l.layers.filter(x => S.items.some(i => i.id === x.item)).map(x => ({ ...x })); S.board.editing = id; S.board.sel = null; setFig(l.fig || 'woman'); go('style'); S.board.mode = l.mode || 'mannequin'; board().classList.toggle('flat', S.board.mode === 'flat'); $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === S.board.mode)); drawBoard(); renderRail(); };
  $('#lTry').onclick = () => { closeSheet(); S.picks = []; for (const x of l.layers) setPick(x.item, true); go('tryon'); renderTryon(); };
}
async function shareImage(dataUrl, name) {
  try { const blob = await (await fetch(dataUrl)).blob(), file = new File([blob], `${(name || 'look').replace(/[^\w-]+/g, '-')}.jpg`, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = dataUrl; a.download = `${(name || 'look').replace(/[^\w-]+/g, '-')}.jpg`; a.click();
}

/* ---------------- try-on ---------------- */
function setPick(id, quiet) {
  const tc = TYPES[S.items.find(i => i.id === id)?.type]?.tc;
  if (!tc) { if (!quiet) toast('Try-on works with tops, jackets, bottoms and dresses'); return; }
  const keep = S.picks.filter(p => { const t = TYPES[S.items.find(i => i.id === p)?.type]?.tc; return tc === 'one-pieces' ? false : t !== tc && t !== 'one-pieces'; });
  S.picks = [...keep, id].slice(-2); renderTryon();
}
function renderTryon() {
  $('#mePhoto').innerHTML = S.me ? `<img src="${S.me}" alt="Your photo"><button class="ghost sm chg" id="meChange">Change</button>`
    : `<div class="ph"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg><p>Full-length, standing straight, facing the camera, arms a little away from your body. Good light, plain background, fitted clothes.</p><button class="primary" id="mePick">Choose a photo</button></div>`;
  $('#tryPicks').innerHTML = S.picks.map(id => { const it = S.items.find(i => i.id === id); return it ? `<div class="pick">${itemArt(it)}<button class="x" data-unpick="${id}" aria-label="Remove">×</button></div>` : ''; }).join('');
  const ready = S.me && S.picks.length, conn = S.settings.endpoint || S.settings.fashnKey;
  $('#tryGo').disabled = !ready;
  $('#tryNote').innerHTML = !conn ? 'Try-on needs a connection to the AI service. <a href="#" id="tryConnect">Set it up</a>.' : !S.me ? 'Add your photo first.' : !S.picks.length ? 'Pick at least one piece.' : `Takes about ${S.picks.length * 15}–${S.picks.length * 30} seconds.`;
  $('#tryGalHead').hidden = !S.tryons.length;
  $('#tryGallery').innerHTML = S.tryons.map(t => `<button class="look" data-try="${t.id}"><img src="${t.img}" alt="" loading="lazy"><div class="meta"><div class="ds">${new Date(t.created).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div></div></button>`).join('');
}
async function garmentImage(it) { return shrink(it.photo, 1024, 'image/jpeg', .92, '#ffffff'); }
async function fashn(model, garment, category, onStatus) {
  if (S.settings.endpoint) {
    const r = await fetch(S.settings.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(S.settings.anonKey ? { Authorization: 'Bearer ' + S.settings.anonKey, apikey: S.settings.anonKey } : {}) }, body: JSON.stringify({ model_image: model, garment_image: garment, category }) });
    const j = await r.json().catch(() => ({})); if (!r.ok || !j.image) throw new Error(j.error || `Server error ${r.status}`); return j.image;
  }
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.settings.fashnKey };
  const r = await fetch('https://api.fashn.ai/v1/run', { method: 'POST', headers: H, body: JSON.stringify({ model_name: 'tryon-v1.6', inputs: { model_image: model, garment_image: garment, category, garment_photo_type: 'flat-lay', mode: 'balanced', output_format: 'jpeg', return_base64: true } }) });
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.id) throw new Error(j.error?.message || j.error || j.message || `Try-on service error ${r.status}`);
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    await new Promise(ok => setTimeout(ok, 2500));
    const s = await fetch(`https://api.fashn.ai/v1/status/${j.id}`, { headers: H }).then(r => r.json()).catch(() => ({}));
    onStatus?.(s.status);
    if (s.status === 'completed') { const o = s.output?.[0]; if (!o) throw new Error('No image came back'); return o.startsWith('data:') || o.startsWith('http') ? o : 'data:image/jpeg;base64,' + o; }
    if (s.status === 'failed' || s.status === 'canceled') throw new Error(s.error?.message || s.error?.name || 'The try-on failed');
  }
  throw new Error('Timed out. Please try again');
}
async function runTryOn() {
  if (!S.settings.endpoint && !S.settings.fashnKey) { openSettings(true); return; }
  const btn = $('#tryGo'); btn.disabled = true; const res = $('#tryRes');
  res.innerHTML = `<div class="progress"><i></i></div><p class="hint" id="tryStat">Preparing your photo…</p>`;
  try {
    let model = await shrink(S.me, 1024, 'image/jpeg', .92);
    const items = S.picks.map(id => S.items.find(i => i.id === id)).filter(Boolean)
      .sort((a, b) => (TYPES[a.type].tc === 'bottoms' ? 0 : 1) - (TYPES[b.type].tc === 'bottoms' ? 0 : 1));   // bottoms first, then the top over them
    for (const [k, it] of items.entries()) {
      $('#tryStat').textContent = `Putting on the ${TYPES[it.type].label.toLowerCase()}${items.length > 1 ? ` (${k + 1} of ${items.length})` : ''}…`;
      model = await fashn(model, await garmentImage(it), TYPES[it.type].tc, st => { if (st === 'in_queue' || st === 'starting') $('#tryStat').textContent = 'Waiting in line…'; });
    }
    let img = model; if (img.startsWith('http')) { try { const b = await (await fetch(img)).blob(); img = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); }); } catch (e) {} }
    const rec = { id: uid(), img, items: S.picks.slice(), created: Date.now() }; S.tryons.unshift(rec); await put('tryons', rec);
    res.innerHTML = `<img src="${img}" alt="You wearing the chosen clothes"><div class="sactions"><button class="ghost" id="trShare">Save / share</button></div>`;
    $('#trShare').onclick = () => shareImage(img, 'cloutfit-try-on');
    renderTryon();
  } catch (e) { console.error(e); res.innerHTML = `<div class="note">${esc(e.message || e)}</div>`; }
  btn.disabled = !(S.me && S.picks.length);
}
function chooseForTryon() {
  const ok = S.items.filter(i => TYPES[i.type]?.tc);
  openSheet(`<div class="shead"><h2>What to wear</h2><button class="ic" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    ${ok.length ? `<div class="pickgrid">${ok.map(i => `<button class="rit ${S.picks.includes(i.id) ? 'on' : ''}" data-pk="${i.id}" title="${esc(i.name)}">${itemArt(i)}</button>`).join('')}</div>` : '<p class="hint">Add tops, bottoms or dresses to your closet first.</p>'}
    <div class="sactions"><button class="primary" data-close>Done</button></div>`);
  $('#sheet').querySelector('.pickgrid')?.addEventListener('click', e => { const b = e.target.closest('[data-pk]'); if (!b) return; const id = b.dataset.pk; if (S.picks.includes(id)) S.picks = S.picks.filter(p => p !== id); else setPick(id); $$('[data-pk]').forEach(x => x.classList.toggle('on', S.picks.includes(x.dataset.pk))); renderTryon(); });
}

/* ---------------- settings ---------------- */
function openSettings(fromTry) {
  openSheet(`<div class="shead"><h2>Settings</h2><button class="ic" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <h3>AI try-on</h3>
    <p class="hint">Cloutfit uses FASHN, a fashion AI, to put your clothes on your photo. It costs about $0.075 per piece tried on, paid to FASHN.</p>
    <div class="field"><label>FASHN API key</label><input id="sKey" type="password" autocomplete="off" placeholder="fa-…" value="${esc(S.settings.fashnKey || '')}"></div>
    <div class="note">Get a key at <a href="https://app.fashn.ai/api" target="_blank" rel="noopener">app.fashn.ai/api</a>. It is saved only on this device. ${fromTry ? '' : ''}</div>
    <details style="margin-top:12px"><summary style="font-weight:700;cursor:pointer">Use your own server instead (for a public app)</summary>
      <p class="hint">Deploy <code>server/tryon</code> as a Supabase Edge Function with your key stored as a secret, then paste its URL here. Your key then never leaves the server.</p>
      <div class="field"><label>Server URL</label><input id="sEnd" placeholder="https://xxxx.supabase.co/functions/v1/tryon" value="${esc(S.settings.endpoint || '')}"></div>
      <div class="field"><label>Supabase anon key (optional)</label><input id="sAnon" value="${esc(S.settings.anonKey || '')}"></div></details>
    <h3 style="margin-top:22px">Your data</h3>
    <p class="hint">Everything is stored privately on this device. Back it up to move it to another phone.</p>
    <div class="sactions"><button class="ghost" id="sExport">Back up</button><button class="ghost" id="sImport">Restore</button><button class="ghost danger" id="sWipe">Delete everything</button></div>
    <div class="sactions"><button class="primary" id="sSave">Save</button></div>`);
  $('#sSave').onclick = async () => { S.settings.fashnKey = $('#sKey').value.trim(); S.settings.endpoint = $('#sEnd').value.trim(); S.settings.anonKey = $('#sAnon').value.trim(); await saveSettings(); closeSheet(); renderTryon(); toast('Saved'); };
  $('#sExport').onclick = async () => { const data = JSON.stringify({ app: 'cloutfit', v: 1, items: S.items, looks: S.looks, tryons: S.tryons, me: S.me }); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = `cloutfit-backup-${day()}.json`; a.click(); };
  $('#sImport').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json'; i.onchange = async () => { try { const d = JSON.parse(await i.files[0].text()); if (d.app !== 'cloutfit') throw 0; for (const it of d.items || []) { await put('items', it); } for (const l of d.looks || []) await put('outfits', l); for (const t of d.tryons || []) await put('tryons', t); if (d.me) await put('kv', d.me, 'me'); toast('Restored'); setTimeout(() => location.reload(), 600); } catch (e) { toast('That is not a Cloutfit backup'); } }; i.click(); };
  $('#sWipe').onclick = async () => { if (!confirm('Delete your whole closet, looks and try-ons from this device? This cannot be undone.')) return; indexedDB.deleteDatabase('cloutfit'); toast('Deleted'); setTimeout(() => location.reload(), 700); };
}

/* ---------------- sheet ---------------- */
let lastFocus = null;
function openSheet(html) { lastFocus = document.activeElement; const s = $('#sheet'); s.innerHTML = `<div class="grab"></div>` + html; s.hidden = false; $('#scrim').hidden = false; document.body.classList.add('sheet-open'); s.scrollTop = 0; (s.querySelector('[data-close]') || s).focus?.({ preventScroll: true }); }
function closeSheet() { $('#sheet').hidden = true; $('#scrim').hidden = true; document.body.classList.remove('sheet-open'); lastFocus?.focus?.({ preventScroll: true }); }

/* ---------------- events ---------------- */
function bind() {
  $('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); };
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); if (e.target.closest('[data-close]')) closeSheet(); });
  $('#scrim').onclick = closeSheet;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  const pickFiles = () => $('#files').click();
  $('#addBtn').onclick = pickFiles; $('#emptyAdd').onclick = pickFiles;
  $('#files').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  $('#cats').onclick = e => { const b = e.target.closest('[data-cat]'); if (b) { S.cat = b.dataset.cat; renderCloset(); } };
  $('#colours').onclick = e => { const b = e.target.closest('[data-fam]'); if (b) { S.fam = S.fam === b.dataset.fam ? null : b.dataset.fam; renderCloset(); } };
  $('#q').oninput = e => { S.q = e.target.value.trim(); renderCloset(); };
  $('#sort').onchange = e => { S.sort = e.target.value; renderCloset(); };
  $('#grid').onclick = async e => {
    const f = e.target.closest('[data-fav]'); if (f) { e.stopPropagation(); const it = S.items.find(i => i.id === f.dataset.fav); it.fav = !it.fav; await put('items', it); renderCloset(); return; }
    const c = e.target.closest('[data-id]'); if (c) openItem(c.dataset.id);
  };
  // style
  bindBoard();
  $('#modeSeg').onclick = e => { const b = e.target.closest('[data-m]'); if (b) setMode(b.dataset.m); };
  $('#figSeg').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { setFig(b.dataset.f); autoLayout(false); } };
  $('#railCats').onclick = e => { const b = e.target.closest('[data-rc]'); if (b) { S.railCat = b.dataset.rc; renderRail(); } };
  $('#railGrid').onclick = e => { const b = e.target.closest('[data-add]'); if (b) addLayer(b.dataset.add); };
  $('#shuffleBtn').onclick = shuffle;
  $('#clearBtn').onclick = () => { S.board.layers = []; S.board.sel = null; S.board.editing = null; drawBoard(); renderRail(); };
  $('#saveLookBtn').onclick = saveLook;
  $('#fig').addEventListener('load', () => drawBoard());
  // looks
  $('#lookGrid').onclick = e => { const b = e.target.closest('[data-look]'); if (b) openLook(b.dataset.look); };
  // try on
  $('#tryon').addEventListener('click', async e => {
    if (e.target.closest('#mePick') || e.target.closest('#meChange')) $('#meFile').click();
    const u = e.target.closest('[data-unpick]'); if (u) { S.picks = S.picks.filter(p => p !== u.dataset.unpick); renderTryon(); }
    if (e.target.closest('#tryConnect')) { e.preventDefault(); openSettings(true); }
    const t = e.target.closest('[data-try]'); if (t) { const rec = S.tryons.find(x => x.id === t.dataset.try); if (rec) openSheet(`<div class="shead"><h2>Try-on</h2><button class="ic" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><img src="${rec.img}" alt="" style="border-radius:18px;width:100%"><div class="sactions"><button class="ghost danger" id="tDel">Delete</button><button class="primary" id="tShare">Save / share</button></div>`), $('#tShare').onclick = () => shareImage(rec.img, 'cloutfit-try-on'), $('#tDel').onclick = async () => { S.tryons = S.tryons.filter(x => x !== rec); await del('tryons', rec.id); closeSheet(); renderTryon(); }; }
  });
  $('#meFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; S.me = await shrink(await fileToDataURL(f), 1400, 'image/jpeg', .9); await put('kv', S.me, 'me'); renderTryon(); };
  $('#tryChoose').onclick = chooseForTryon;
  $('#tryGo').onclick = runTryOn;
  $('#settingsBtn').onclick = () => openSettings(false);
  // drag & drop photos anywhere
  addEventListener('dragover', e => e.preventDefault()); addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });
}

boot();
