'use strict';
/* Démo F&L : lit l'API Store WooCommerce publique de fredrikoglouisa.no à chaque ouverture.
   Si le navigateur bloque l'API (CORS), mettre ici l'URL du proxy (voir worker.js). */
const API = 'https://fredrikoglouisa.no/wp-json/wc/store/v1';
const SITE = 'https://fredrikoglouisa.no/';
const NEW_TAG = 9764; // tag "Nyheter"
const PER_PAGE = 24;
const FIELDS = 'id,name,permalink,prices,on_sale,images,short_description,attributes,variations,extensions,brands,tags';

const TABS = [
  { key: 'makeup', label: 'Makeup', match: 'makeup', icon: 'M8 21h8v-6H8z M9.5 15V9h5v6 M9.5 9l5-5v5' },
  { key: 'hudpleie', label: 'Hudpleie', match: 'hudpleie', icon: 'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z' },
  { key: 'parfyme', label: 'Parfyme', match: 'parfyme', icon: 'M10 3h4v3h-4z M8 6h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z' },
  { key: 'har', label: 'Hår', match: 'hår', icon: 'M4 6h16v5H4z M6 11v7 M9 11v7 M12 11v7 M15 11v7 M18 11v7' },
  { key: 'herre', label: 'Herre', match: 'herre', icon: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.5-7 8-7s8 3 8 7' },
  { key: 'gavesett', label: 'Gavesett', match: 'gavesett', icon: 'M4 10h16v10H4z M3 7h18v3H3z M12 7v13 M12 7c-1-3-4-4-5-2s2 2 5 2 M12 7c1-3 4-4 5-2s-2 2-5 2' }
];
const FILTERS = [['all', 'Alle'], ['new', 'Nyheter'], ['sale', 'Tilbud']];
const HEART = 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z';
const CLOSE = 'M6 6l12 12 M18 6L6 18';
const NS = 'http://www.w3.org/2000/svg';

/* ---------- utilitaires ---------- */
const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('fl.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fl.' + k, JSON.stringify(v)); } catch (e) { /* quota ou mode privé */ } }
};
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [n, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (n === 'class') e.className = v;
    else if (n.startsWith('on')) e.addEventListener(n.slice(2), v);
    else e.setAttribute(n, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
function icon(path, size, sw) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size || 24);
  s.setAttribute('height', size || 24);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', sw || 1.4);
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', path);
  s.append(p);
  return s;
}
// l'API renvoie du HTML et des entités (&#8211;) : on passe par DOMParser, qui n'exécute rien
function text(s) {
  if (!s) return '';
  return (new DOMParser().parseFromString(String(s), 'text/html').documentElement.textContent || '').replace(/\s+/g, ' ').trim();
}
const fmt = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
const kr = (n) => fmt.format(Math.round(n)).replace(/[  ]/g, ' ') + ' kr';

/* ---------- API ---------- */
async function api(path, params) {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    return { data, pages: Number(r.headers.get('X-WP-TotalPages')) || 0 };
  } finally { clearTimeout(timer); }
}

function mapProduct(p) {
  const pr = p.prices || {};
  const div = Math.pow(10, pr.currency_minor_unit == null ? 2 : pr.currency_minor_unit);
  const price = Number(pr.price) / div;
  const regular = Number(pr.regular_price) / div;
  const range = pr.price_range;
  const attr = (p.attributes || [])[0];
  const shades = attr && attr.terms ? attr.terms.map((t) => text(t.name)) : [];
  const imgs = (p.images || []);
  return {
    id: p.id,
    name: text(p.name),
    brand: text((p.extensions && p.extensions.gtm4wp && p.extensions.gtm4wp.item && p.extensions.gtm4wp.item.item_brand) || (p.brands && p.brands[0] && p.brands[0].name) || ''),
    price,
    regular,
    onSale: !!p.on_sale && regular > price,
    from: range && range.min_amount && Number(range.min_amount) / div < Number(range.max_amount) / div ? Number(range.min_amount) / div : null,
    img: imgs[0] ? (imgs[0].thumbnail || imgs[0].src) : '',
    gallery: imgs.slice(0, 5).map((i) => i.src),
    url: p.permalink,
    desc: text(p.short_description).slice(0, 360),
    isNew: (p.tags || []).some((t) => t.id === NEW_TAG),
    shades,
    shadeLabel: attr && /farge|nyanse|color|colour/i.test(attr.name || '') ? 'nyanser' : 'varianter'
  };
}

/* ---------- état ---------- */
const state = {
  tab: TABS[0].key, cats: {}, subs: [], sub: null, filter: 'all', query: '',
  items: [], page: 1, done: false, loading: false, token: 0
};
let favs = store.get('favs', {});
let cart = store.get('cart', []);
const isFav = (id) => !!favs[id];

/* ---------- rendu : tabs, pills, filtres ---------- */
function renderTabs() {
  const nav = $('#tabs');
  nav.replaceChildren(...TABS.map((t) => h('button', { class: t.key === state.tab && !state.query ? 'on' : '', 'aria-label': t.label, onclick: () => selectTab(t.key) }, icon(t.icon, 24), h('span', {}, t.label))));
}
function renderPills() {
  const box = $('#pills');
  if (state.query) {
    box.replaceChildren(h('button', { class: 'pill on', onclick: clearSearch }, 'Søk: ' + state.query + '  ✕'));
    return;
  }
  const all = [{ id: null, name: 'Alle' }, ...state.subs];
  box.replaceChildren(...all.map((s) => h('button', { class: 'pill' + (state.sub === s.id ? ' on' : ''), onclick: () => { state.sub = s.id; renderPills(); load(); } }, s.name)));
}
function renderFilters() {
  $('#filters').replaceChildren(...FILTERS.map(([k, l]) => h('button', { class: state.filter === k ? 'on' : '', onclick: () => { state.filter = k; renderFilters(); load(); } }, l)));
}

/* ---------- rendu : grille ---------- */
function priceEl(p) {
  const pre = p.from != null && !p.onSale ? 'Fra ' : '';
  if (p.onSale) return h('div', { class: 'price sale' }, h('span', { class: 'now' }, kr(p.price)), h('s', {}, kr(p.regular)));
  return h('div', { class: 'price' }, h('span', {}, pre + kr(p.from != null ? p.from : p.price)));
}
function heartBtn(p, cls) {
  const b = h('button', { class: cls + (isFav(p.id) ? ' on' : ''), 'aria-label': 'Lagre i favoritter' }, icon(HEART, cls === 'heart' ? 20 : 22));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (favs[p.id]) delete favs[p.id]; else favs[p.id] = { id: p.id, name: p.name };
    store.set('favs', favs);
    document.querySelectorAll('[data-fav="' + p.id + '"]').forEach((x) => x.classList.toggle('on', isFav(p.id)));
  });
  b.dataset.fav = p.id;
  return b;
}
function card(p) {
  const pct = p.onSale ? Math.round((1 - p.price / p.regular) * 100) : 0;
  const el = h('article', { class: 'card', role: 'button', tabindex: '0', onclick: () => openProduct(p), onkeydown: (e) => { if (e.key === 'Enter') openProduct(p); } },
    h('div', { class: 'ph' },
      p.img ? h('img', { src: p.img, alt: '', loading: 'lazy', decoding: 'async', onerror: (e) => e.target.remove() }) : null,
      p.onSale ? h('span', { class: 'badge' }, '-' + pct + ' %') : (p.isNew ? h('span', { class: 'badge new' }, 'Nyhet') : null),
      heartBtn(p, 'heart')),
    h('div', { class: 'meta' },
      h('div', { class: 'brand' }, p.brand),
      h('div', { class: 'name' }, p.name),
      priceEl(p),
      p.shades.length > 1 ? h('div', { class: 'var' }, p.shades.length + ' ' + p.shadeLabel) : null));
  return el;
}
function skeleton() {
  $('#grid').replaceChildren(...Array.from({ length: 6 }, () => h('div', { class: 'card sk' }, h('div', { class: 'ph' }), h('div', {}, h('i'), h('i')))));
}
function addCards(items) { $('#grid').append(...items.map(card)); }
function setStatus(msg, retry) {
  const s = $('#status');
  s.replaceChildren();
  if (msg) s.append(msg);
  if (msg && retry) s.append(h('button', { onclick: retry }, 'Prøv igjen'));
}

/* ---------- chargement ---------- */
async function loadCats() {
  const cached = store.get('cats', null);
  if (cached && Date.now() - cached.t < 864e5) { state.cats = cached.map; return; }
  try {
    const { data } = await api('/products/categories', { parent: 0, per_page: 50, _fields: 'id,name,slug,count' });
    const map = {};
    for (const c of data) map[text(c.name).toLowerCase()] = c.id;
    state.cats = map;
    store.set('cats', { t: Date.now(), map });
  } catch (e) {
    if (cached) state.cats = cached.map; else throw e;
  }
}
const catId = () => state.cats[TABS.find((t) => t.key === state.tab).match];

async function loadSubs() {
  const id = catId();
  state.subs = [];
  if (!id) { renderPills(); return; }
  const key = 'sub.' + id;
  const cached = store.get(key, null);
  if (cached) { state.subs = cached; renderPills(); }
  try {
    const { data } = await api('/products/categories', { parent: id, per_page: 50, _fields: 'id,name,count' });
    const subs = data.filter((c) => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 10).map((c) => ({ id: c.id, name: text(c.name) }));
    if (id === catId()) { state.subs = subs; store.set(key, subs); renderPills(); }
  } catch (e) { /* les pills restent celles du cache, ou seulement "Alle" */ }
}

async function load(opts) {
  const append = opts && opts.append;
  if (append && (state.loading || state.done)) return;
  const my = ++state.token;
  state.loading = true;
  if (!append) { state.page = 1; state.items = []; state.done = false; skeleton(); setStatus(''); }
  const params = { per_page: PER_PAGE, page: state.page, _fields: FIELDS };
  let key;
  if (state.query) {
    params.search = state.query;
    key = 'q.s.' + state.query.toLowerCase();
  } else {
    const cat = state.sub || catId();
    if (!cat) { state.loading = false; showError(); return; }
    params.category = cat;
    params.orderby = 'popularity';
    params.order = 'desc';
    if (state.filter === 'new') params.tag = NEW_TAG;
    if (state.filter === 'sale') params.on_sale = 'true';
    key = 'q.' + cat + '.' + state.filter;
  }
  try {
    const { data, pages } = await api('/products', params);
    if (my !== state.token) return;
    const items = data.map(mapProduct);
    if (!append) { $('#grid').replaceChildren(); store.set(key, items); }
    state.items.push(...items);
    state.done = pages ? state.page >= pages : items.length < PER_PAGE;
    state.page++;
    if (!state.items.length) $('#grid').replaceChildren(h('div', { class: 'empty' }, 'Ingen produkter funnet'));
    else addCards(items);
    setStatus('');
  } catch (e) {
    if (my !== state.token) return;
    if (append) { setStatus('Kunne ikke hente flere produkter.', () => load({ append: true })); }
    else {
      const cached = store.get(key, null);
      if (cached && cached.length) {
        $('#grid').replaceChildren();
        state.items = cached; state.done = true;
        addCards(cached);
        setStatus('Viser lagrede produkter. Ingen kontakt med fredrikoglouisa.no.', () => load());
      } else showError();
    }
  } finally { if (my === state.token) state.loading = false; }
}
function showError() {
  $('#grid').replaceChildren();
  setStatus('Kunne ikke hente produkter.', async () => { try { await loadCats(); } catch (e) { } loadSubs(); load(); });
}

/* ---------- navigation ---------- */
function selectTab(key) {
  const same = key === state.tab && !state.query;
  state.tab = key; state.sub = null; state.filter = 'all'; state.query = '';
  $('#q').value = '';
  renderTabs(); renderFilters(); renderPills();
  $('#scroller').scrollTop = 0;
  if (!same) loadSubs();
  load();
}
function clearSearch() {
  state.query = ''; $('#q').value = '';
  renderTabs(); renderPills(); load();
}
$('#search').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#q').value.trim();
  $('#q').blur();
  if (!v) { if (state.query) clearSearch(); return; }
  state.query = v; state.sub = null; state.filter = 'all';
  renderTabs(); renderPills(); renderFilters();
  $('#scroller').scrollTop = 0;
  load();
});

/* ---------- feuilles (produit, panier) ---------- */
let sheetEl = null;
function openSheet(content) {
  closeSheet(true);
  const wrap = h('div', { class: 'wrap' },
    h('div', { class: 'backdrop', onclick: () => closeSheet() }),
    h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'grab' }, h('i')), content));
  $('#layer').append(wrap);
  sheetEl = wrap;
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('show')));
}
function closeSheet(now) {
  if (!sheetEl) return;
  const el = sheetEl; sheetEl = null;
  el.classList.remove('show');
  if (now) el.remove(); else setTimeout(() => el.remove(), 280);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
const closeBtn = () => h('button', { class: 'close', 'aria-label': 'Lukk', onclick: () => closeSheet() }, icon(CLOSE, 20, 1.5));

function openProduct(p) {
  let shade = p.shades.length ? p.shades[0] : '';
  const chips = p.shades.length > 1 ? p.shades.slice(0, 40).map((s, i) => {
    const b = h('button', { class: 'chip' + (i === 0 ? ' on' : ''), onclick: () => { shade = s; chipBox.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b)); } }, s);
    return b;
  }) : [];
  const chipBox = h('div', { class: 'chips' }, chips);
  const imgs = p.gallery.length ? p.gallery : (p.img ? [p.img] : []);
  const add = h('button', { class: 'cta' }, 'Legg i handlekurv');
  add.addEventListener('click', () => {
    addToCart(p, shade);
    add.textContent = 'Lagt i handlekurven';
    add.classList.add('done');
    setTimeout(() => { add.textContent = 'Legg i handlekurv'; add.classList.remove('done'); }, 1600);
  });
  openSheet([
    h('div', { class: 'sbody' },
      h('div', { class: 'gwrap' }, h('div', { class: 'gallery' }, imgs.map((src) => h('img', { src, alt: p.name, onerror: (e) => e.target.remove() }))), closeBtn()),
      h('div', { class: 'info' }, h('div', { class: 'brand' }, p.brand), h('h1', { class: 'title' }, p.name), priceEl(p)),
      chips.length ? h('div', { class: 'info' }, h('div', { class: 'lbl' }, p.shadeLabel === 'nyanser' ? 'Nyanse' : 'Variant'), chipBox) : null,
      p.desc ? h('div', { class: 'desc' }, p.desc) : null,
      h('a', { class: 'site', href: p.url, target: '_blank', rel: 'noopener' }, 'Se på fredrikoglouisa.no')),
    h('div', { class: 'actions' }, add, heartBtn(p, 'sq'))
  ]);
}

/* ---------- panier (local à la démo) ---------- */
function saveCart() { store.set('cart', cart); renderCartCount(); }
function renderCartCount() {
  const n = cart.reduce((s, l) => s + l.qty, 0);
  const el = $('#cartCount');
  el.hidden = !n;
  el.textContent = n;
}
function addToCart(p, shade) {
  const key = p.id + '|' + shade;
  const line = cart.find((l) => l.key === key);
  if (line) line.qty++;
  else cart.push({ key, name: p.name, brand: p.brand, img: p.img, price: p.price, shade, qty: 1 });
  saveCart();
}
function openCart() {
  const body = h('div', { class: 'sbody' });
  const foot = h('div', {});
  const draw = () => {
    body.replaceChildren(h('div', { class: 'shead' }, h('h2', {}, 'Handlekurv'), closeBtn()));
    foot.replaceChildren();
    if (!cart.length) { body.append(h('div', { class: 'void' }, 'Handlekurven er tom.')); return; }
    for (const l of cart) {
      body.append(h('div', { class: 'line' },
        h('div', { class: 'th' }, l.img ? h('img', { src: l.img, alt: '', onerror: (e) => e.target.remove() }) : null),
        h('div', { class: 'lm' },
          h('div', { class: 'brand' }, l.brand), h('div', { class: 'name' }, l.name),
          l.shade ? h('div', { class: 'var' }, l.shade) : null,
          h('div', { class: 'price' }, kr(l.price * l.qty)),
          h('div', { class: 'qty' },
            h('button', { 'aria-label': 'Færre', onclick: () => { l.qty--; if (l.qty <= 0) cart = cart.filter((x) => x !== l); saveCart(); draw(); } }, '−'),
            h('span', {}, l.qty),
            h('button', { 'aria-label': 'Flere', onclick: () => { l.qty++; saveCart(); draw(); } }, '+')))));
    }
    const sum = cart.reduce((s, l) => s + l.price * l.qty, 0);
    body.append(h('div', { class: 'total' }, h('span', {}, 'Sum'), h('span', {}, kr(sum))));
    body.append(h('div', { class: 'note' }, 'Demo: handlekurven lagres bare på denne enheten. Betalingen gjøres hos fredrikoglouisa.no.'));
    foot.append(h('div', { class: 'actions' }, h('a', { class: 'cta', href: SITE, target: '_blank', rel: 'noopener' }, 'Fullfør på fredrikoglouisa.no')));
  };
  draw();
  openSheet([body, foot]);
}
$('#cartBtn').addEventListener('click', openCart);

/* ---------- pull to refresh ---------- */
(function () {
  const sc = $('#scroller'), ptr = $('#ptr');
  let y0 = null, dist = 0;
  sc.addEventListener('touchstart', (e) => { y0 = sc.scrollTop <= 0 ? e.touches[0].clientY : null; dist = 0; }, { passive: true });
  sc.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dist = e.touches[0].clientY - y0;
    if (dist > 0 && sc.scrollTop <= 0) {
      ptr.style.height = Math.min(dist / 2, 60) + 'px';
      ptr.textContent = dist > 120 ? 'Slipp for å oppdatere' : 'Dra for å oppdatere';
    }
  }, { passive: true });
  sc.addEventListener('touchend', () => {
    const go = y0 != null && dist > 120;
    y0 = null; dist = 0;
    ptr.style.height = '0'; ptr.textContent = '';
    if (go) load();
  });
})();

/* ---------- scroll infini ---------- */
if ('IntersectionObserver' in window) {
  new IntersectionObserver((en) => { if (en[0].isIntersecting && state.items.length) load({ append: true }); }, { root: $('#scroller'), rootMargin: '600px' }).observe($('#more'));
}

/* ---------- démarrage ---------- */
(async function boot() {
  renderTabs(); renderFilters(); renderPills(); renderCartCount();
  skeleton();
  try { await loadCats(); } catch (e) { showError(); return; }
  loadSubs();
  load();
})();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
