'use strict';
/* Démo F&L : lit l'API Store WooCommerce publique de fredrikoglouisa.no à chaque ouverture.
   Si le navigateur bloque l'API (CORS), mettre ici l'URL du proxy (voir worker.js). */
const API = 'https://lively-leaf-cd06.yannis-montreer.workers.dev';
const SITE = 'https://fredrikoglouisa.no/';
const NEW_TAG = 9764; // tag "Nyheter"
const PER_PAGE = 24;
const FIELDS = 'id,name,permalink,prices,on_sale,images,short_description,description,attributes,variations,extensions,brands,tags';

const TABS = [
  { key: 'makeup', label: 'Makeup', match: 'makeup', icon: 'M8 21h8v-6H8z M9.5 15V9h5v6 M9.5 9l5-5v5' },
  { key: 'hudpleie', label: 'Hudpleie', match: 'hudpleie', icon: 'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z' },
  { key: 'parfyme', label: 'Parfyme', match: 'parfyme', icon: 'M10 3h4v3h-4z M8 6h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z' },
  { key: 'har', label: 'Hår', match: 'hår', icon: 'M4 6h16v5H4z M6 11v7 M9 11v7 M12 11v7 M15 11v7 M18 11v7' },
  { key: 'herre', label: 'Herre', match: 'herre', icon: 'M12 10c-1.5-1.8-4-2-6-1C4 10 2.8 12 2.5 14.5c2-1.2 4-1.3 6-.5 1.5.6 2.5.2 3.5-.8 1 1 2 1.4 3.5.8 2-.8 4-.7 6 .5C21.2 12 20 10 18 9c-2-1-4.500-.8-6 1z' },
  { key: 'mer', label: 'Mer', icon: 'M5 12a1.2 1.2 0 1 0 .01 0 M12 12a1.2 1.2 0 1 0 .01 0 M19 12a1.2 1.2 0 1 0 .01 0' }
];
const VERSION = 'Demo 1.1';
const FILTERS = [['all', 'all'], ['new', 'f_new'], ['sale', 'f_sale']];
const HEART = 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z';
const CLOSE = 'M6 6l12 12 M18 6L6 18';
const CARTP = 'M3 4h2.5l2.2 10.5h10.3l2-7.5H6.4 M9.5 19h.01 M16.5 19h.01';
const NS = 'http://www.w3.org/2000/svg';

/* ---------- utilitaires ---------- */
const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('fl.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fl.' + k, JSON.stringify(v)); } catch (e) { /* quota ou mode privé */ } }
};
/* ---------- langue (interface seulement : les produits restent ceux du site) ---------- */
const I18N = {
  no: {
    tab_makeup: 'Makeup', tab_hudpleie: 'Hudpleie', tab_parfyme: 'Parfyme', tab_har: 'Hår', tab_herre: 'Herre', tab_mer: 'Mer',
    all: 'Alle', f_new: 'Nyheter', f_sale: 'Tilbud', new: 'Nyhet', from: 'Fra ',
    search: 'Søk', search_ph: 'Søk på produkt eller merke', search_pill: 'Søk: ', categories: 'Kategorier',
    shades: 'nyanser', variants: 'varianter', shade: 'Nyanse', variant: 'Variant',
    retry: 'Prøv igjen', none: 'Ingen produkter funnet', err_more: 'Kunne ikke hente flere produkter.',
    offline: 'Viser lagrede produkter. Ingen kontakt med fredrikoglouisa.no.', err: 'Kunne ikke hente produkter.',
    close: 'Lukk', add: 'Legg i handlekurv', see_site: 'Se på fredrikoglouisa.no', cart: 'Handlekurv', cart_empty: 'Handlekurven er tom.',
    fewer: 'Færre', more: 'Flere', sum: 'Sum', cart_note: 'Demo: handlekurven lagres bare på denne enheten. Betalingen gjøres hos fredrikoglouisa.no.',
    checkout: 'Fullfør på fredrikoglouisa.no', ptr_go: 'Slipp for å oppdatere', ptr: 'Dra for å oppdatere', fav_save: 'Lagre i favoritter',
    mer: 'Mer', favorites: 'Favoritter', fav_count: (n) => n + (n === 1 ? ' produkt' : ' produkter'), fav_empty: 'Ingen favoritter ennå',
    fav_empty_sub: 'Trykk på hjertet på et produkt for å lagre det her.', back: 'Tilbake',
    language: 'Språk', info: 'Informasjon', data: 'Data', clear: 'Tøm lagrede data',
    clear_q: 'Tømme favoritter, handlekurv og lagrede data på denne enheten?', unofficial: 'Uoffisiell demo',
    legal: [
      ['Om demoen', [
        ['', 'Dette er en uoffisiell demo av en mobilapp for Fredrik & Louisa. Den viser hvordan nettbutikken kan oppleves som en app på mobilen.'],
        ['Produkter og innhold', 'Produkter, bilder, priser og beskrivelser hentes direkte fra fredrikoglouisa.no hver gang appen åpnes, og tilhører Fredrik & Louisa og de respektive merkevarene.'],
        ['Status', 'Demoen er ikke bestilt av eller godkjent av Fredrik & Louisa. Den er laget som et utgangspunkt for en samtale.']]],
      ['Personvern', [
        ['', 'Demoen har ingen brukerkonto, ingen sporing og ingen analyseverktøy.'],
        ['Lagret på enheten', 'Favoritter, handlekurv, språkvalg og sist viste produkter lagres bare på denne enheten, i nettleserens lokale lagring. Ingenting sendes videre. Du kan slette alt under «Tøm lagrede data».'],
        ['Tredjeparter', 'Produktdata hentes via en mellomtjener hos Cloudflare, som bare videresender offentlige produktdata fra fredrikoglouisa.no. Cloudflare ser teknisk sett IP-adressen din. Skrifttyper lastes fra Google Fonts, som også ser IP-adressen din.']]],
      ['Vilkår og juridisk info', [
        ['', 'Demoen er kun til visning. Handlekurven er lokal og brukes bare for å vise hvordan den kan fungere: ingen bestilling, ingen betaling og ingen kundedata.'],
        ['Kjøp', '«Fullfør på fredrikoglouisa.no» sender deg til den ordinære nettbutikken. Der skjer kjøpet på butikkens egne vilkår.'],
        ['Priser og lager', 'Priser, tilbud og lagerstatus hentes fra nettbutikken, men kan avvike fra det som gjelder der. Det som står på fredrikoglouisa.no er gjeldende.'],
        ['Varemerker', 'Varemerker, produktnavn, bilder og tekster tilhører sine respektive eiere.']]]
    ]
  },
  en: {
    tab_makeup: 'Makeup', tab_hudpleie: 'Skincare', tab_parfyme: 'Fragrance', tab_har: 'Hair', tab_herre: 'Men', tab_mer: 'More',
    all: 'All', f_new: 'New', f_sale: 'Offers', new: 'New', from: 'From ',
    search: 'Search', search_ph: 'Search for a product or brand', search_pill: 'Search: ', categories: 'Categories',
    shades: 'shades', variants: 'variants', shade: 'Shade', variant: 'Variant',
    retry: 'Try again', none: 'No products found', err_more: "Couldn't load more products.",
    offline: 'Showing saved products. No connection to fredrikoglouisa.no.', err: "Couldn't load products.",
    close: 'Close', add: 'Add to cart', see_site: 'View on fredrikoglouisa.no', cart: 'Cart', cart_empty: 'Your cart is empty.',
    fewer: 'Fewer', more: 'More', sum: 'Total', cart_note: 'Demo: the cart is only stored on this device. Payment is made at fredrikoglouisa.no.',
    checkout: 'Complete at fredrikoglouisa.no', ptr_go: 'Release to refresh', ptr: 'Pull to refresh', fav_save: 'Save to favorites',
    mer: 'More', favorites: 'Favorites', fav_count: (n) => n + (n === 1 ? ' product' : ' products'), fav_empty: 'No favorites yet',
    fav_empty_sub: 'Tap the heart on a product to save it here.', back: 'Back',
    language: 'Language', info: 'Information', data: 'Data', clear: 'Clear saved data',
    clear_q: 'Clear favorites, cart and saved data on this device?', unofficial: 'Unofficial demo',
    legal: [
      ['About the demo', [
        ['', 'This is an unofficial demo of a mobile app for Fredrik & Louisa. It shows how the online store could feel as an app on your phone.'],
        ['Products and content', 'Products, images, prices and descriptions are fetched directly from fredrikoglouisa.no every time the app is opened, and belong to Fredrik & Louisa and the respective brands. Product content is shown in Norwegian.'],
        ['Status', 'The demo has not been commissioned or approved by Fredrik & Louisa. It was made as a starting point for a conversation.']]],
      ['Privacy', [
        ['', 'The demo has no user account, no tracking and no analytics tools.'],
        ['Stored on the device', 'Favorites, cart, language choice and recently viewed products are stored only on this device, in the browser\'s local storage. Nothing is sent on. You can delete everything under "Clear saved data".'],
        ['Third parties', 'Product data is fetched through an intermediary server at Cloudflare, which only forwards public product data from fredrikoglouisa.no. Cloudflare technically sees your IP address. Fonts are loaded from Google Fonts, which also sees your IP address.']]],
      ['Terms and legal information', [
        ['', 'The demo is for display only. The cart is local and only shows how it could work: no ordering, no payment and no customer data.'],
        ['Purchases', '"Complete at fredrikoglouisa.no" takes you to the regular online store. Purchases there are made under the store\'s own terms.'],
        ['Prices and stock', 'Prices, offers and stock status are fetched from the online store but may differ from what applies there. What is shown on fredrikoglouisa.no is binding.'],
        ['Trademarks', 'Trademarks, product names, images and texts belong to their respective owners.']]]
    ]
  }
};
let LANG = store.get('lang', 'no');
if (!I18N[LANG]) LANG = 'no';
const t = (k, ...a) => { const v = I18N[LANG][k] != null ? I18N[LANG][k] : (I18N.no[k] != null ? I18N.no[k] : k); return typeof v === 'function' ? v(...a) : v; };

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
function paras(s) {
  if (!s) return [];
  const doc = new DOMParser().parseFromString(String(s), 'text/html');
  const out = [...doc.querySelectorAll('p, li')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const all = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  return out.length ? out : (all ? [all] : []);
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
    paras: paras(p.description).slice(0, 8),
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
  nav.replaceChildren(...TABS.map((tb) => h('button', { class: tb.key === state.tab && !state.query ? 'on' : '', 'aria-label': t('tab_' + tb.key), onclick: () => selectTab(tb.key) }, icon(tb.icon, 24), h('span', {}, t('tab_' + tb.key)))));
}
function renderPills() {
  const box = $('#pills');
  if (state.query) {
    box.replaceChildren(h('button', { class: 'pill on', onclick: clearSearch }, t('search_pill') + state.query + '  ✕'));
    return;
  }
  const all = [{ id: null, name: t('all') }, ...state.subs];
  box.replaceChildren(...all.map((s) => h('button', { class: 'pill' + (state.sub === s.id ? ' on' : ''), onclick: () => { state.sub = s.id; renderPills(); load(); } }, s.name)));
}
function renderFilters() {
  $('#filters').replaceChildren(...FILTERS.map(([k, lk]) => h('button', { class: state.filter === k ? 'on' : '', onclick: () => { state.filter = k; renderFilters(); load(); } }, t(lk))));
}

/* ---------- rendu : grille ---------- */
function priceEl(p) {
  const pre = p.from != null && !p.onSale ? t('from') : '';
  if (p.onSale) return h('div', { class: 'price sale' }, h('span', { class: 'now' }, kr(p.price)), h('s', {}, kr(p.regular)));
  return h('div', { class: 'price' }, h('span', {}, pre + kr(p.from != null ? p.from : p.price)));
}
function heartBtn(p, cls) {
  const b = h('button', { class: cls + (isFav(p.id) ? ' on' : ''), 'aria-label': t('fav_save') }, icon(HEART, cls === 'heart' ? 20 : 22));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (favs[p.id]) delete favs[p.id]; else favs[p.id] = p;
    store.set('favs', favs);
    document.querySelectorAll('[data-fav="' + p.id + '"]').forEach((x) => x.classList.toggle('on', isFav(p.id)));
    if (state.tab === 'mer') renderMer();
  });
  b.dataset.fav = p.id;
  return b;
}
function card(p) {
  const pct = p.onSale ? Math.round((1 - p.price / p.regular) * 100) : 0;
  const el = h('article', { class: 'card', role: 'button', tabindex: '0', onclick: () => openProduct(p), onkeydown: (e) => { if (e.key === 'Enter') openProduct(p); } },
    h('div', { class: 'ph' },
      p.img ? h('img', { src: p.img, alt: '', loading: 'lazy', decoding: 'async', onerror: (e) => e.target.remove() }) : null,
      p.onSale ? h('span', { class: 'badge' }, '-' + pct + ' %') : (p.isNew ? h('span', { class: 'badge new' }, t('new')) : null),
      heartBtn(p, 'heart')),
    h('div', { class: 'meta' },
      h('div', { class: 'brand' }, p.brand),
      h('div', { class: 'name' }, p.name),
      priceEl(p),
      p.shades.length > 1 ? h('div', { class: 'var' }, p.shades.length + ' ' + t(p.shadeLabel === 'nyanser' ? 'shades' : 'variants')) : null));
  return el;
}
function skeleton() {
  $('#grid').replaceChildren(...Array.from({ length: 6 }, () => h('div', { class: 'card sk' }, h('div', { class: 'ph' }), h('div', {}, h('i'), h('i')))));
}
function addCards(items) {
  const g = $('#grid');
  const pend = g.querySelector('.card.pend');
  if (pend) pend.classList.remove('pend');
  g.append(...items.map(card));
  /* tant que la suite n'est pas là, on ne montre pas un produit seul sur sa ligne */
  if (!state.done) {
    const cs = g.querySelectorAll('.card:not(.sk)');
    if (cs.length % 2 === 1) cs[cs.length - 1].classList.add('pend');
  }
}
function setStatus(msg, retry) {
  const s = $('#status');
  s.replaceChildren();
  if (msg) s.append(msg);
  if (msg && retry) s.append(h('button', { onclick: retry }, t('retry')));
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
    const items = data.map(mapProduct).filter((p) => p.price > 0 && p.img);
    if (!append) { $('#grid').replaceChildren(); store.set(key, items); }
    state.items.push(...items);
    state.done = pages ? state.page >= pages : items.length < PER_PAGE;
    state.page++;
    if (!state.items.length && state.done) $('#grid').replaceChildren(h('div', { class: 'empty' }, t('none')));
    else addCards(items);
    setStatus('');
    if (!items.length && !state.done) { state.loading = false; load({ append: true }); return; }
  } catch (e) {
    if (my !== state.token) return;
    if (append) { const pd = $('#grid .card.pend'); if (pd) pd.classList.remove('pend'); setStatus(t('err_more'), () => load({ append: true })); }
    else {
      const cached = store.get(key, null);
      if (cached && cached.length) {
        $('#grid').replaceChildren();
        state.items = cached; state.done = true;
        addCards(cached);
        setStatus(t('offline'), () => load());
      } else showError();
    }
  } finally { if (my === state.token) state.loading = false; }
}
function showError() {
  $('#grid').replaceChildren();
  setStatus(t('err'), async () => { try { await loadCats(); } catch (e) { } loadSubs(); load(); });
}

/* ---------- navigation ---------- */
function selectTab(key) {
  if (key === 'mer') {
    if (state.tab !== 'mer') state.prevTab = state.tab;
    closeSheet(true);
    leaveFav();
    state.tab = 'mer';
    $('#app').classList.add('mer'); $('#mer').hidden = false;
    renderTabs(); renderMer(); $('#mer').scrollTop = 0;
    return;
  }
  const fromMer = state.tab === 'mer';
  leaveFav();
  $('#app').classList.remove('mer'); $('#mer').hidden = true;
  if (fromMer && key === state.prevTab) { state.tab = key; renderTabs(); return; }
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
let sheetPushed = false, skipPop = 0, merPage = null;
function openSheet(content) {
  closeSheet(true, true);
  const grab = h('div', { class: 'grab' }, h('i'));
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, grab, content);
  const backdrop = h('div', { class: 'backdrop', onclick: () => closeSheet() });
  const wrap = h('div', { class: 'wrap' }, backdrop, sheet);
  $('#layer').append(wrap);
  sheetEl = wrap;
  if (!sheetPushed) { history.pushState({ sheet: 1 }, ''); sheetPushed = true; }
  enableDrag(sheet, backdrop, grab);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('show')));
}
/* tirer la pastille (ou l'image, depuis le haut de la fiche) vers le bas pour fermer */
function enableDrag(sheet, backdrop, grab) {
  let y0 = 0, dy = 0, drag = false, lastY = 0, lastT = 0, v = 0;
  const start = (y, t) => {
    drag = true; y0 = lastY = y; lastT = t; dy = 0; v = 0;
    sheet.style.transition = 'none';
    backdrop.style.transition = 'none';
  };
  const move = (y, t) => {
    dy = Math.max(0, y - y0);
    const dt = t - lastT;
    if (dt > 0) v = (y - lastY) / dt;
    lastY = y; lastT = t;
    sheet.style.transform = 'translateY(' + dy + 'px)';
    backdrop.style.opacity = String(Math.max(0, 1 - dy / sheet.offsetHeight));
  };
  const end = () => {
    if (!drag) return;
    drag = false;
    sheet.style.transition = 'transform .24s ease';
    backdrop.style.transition = 'opacity .24s';
    if (dy > Math.min(110, sheet.offsetHeight * 0.15) || (v > 0.6 && dy > 30)) {
      sheet.style.transform = 'translateY(100%)';
      backdrop.style.opacity = '0';
      closeSheet();
    } else {
      sheet.style.transform = '';
      backdrop.style.opacity = '';
    }
  };
  grab.addEventListener('pointerdown', (e) => { grab.setPointerCapture(e.pointerId); start(e.clientY, e.timeStamp); });
  grab.addEventListener('pointermove', (e) => { if (drag) move(e.clientY, e.timeStamp); });
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);

  /* depuis l'image : seulement si le geste commence alors que la fiche est tout en haut,
     donc jamais en prolongement d'un défilement */
  const area = sheet.querySelector('.gwrap'), body = sheet.querySelector('.sbody');
  if (!area || !body) return;
  let armed = false, active = false, tx = 0, ty = 0;
  area.addEventListener('touchstart', (e) => {
    armed = e.touches.length === 1 && body.scrollTop <= 0;
    active = false;
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  area.addEventListener('touchmove', (e) => {
    if (!armed) return;
    const t = e.touches[0];
    if (!active) {
      const ax = Math.abs(t.clientX - tx), ay = t.clientY - ty;
      if (Math.max(ax, Math.abs(ay)) < 8) return;
      if (ay > 0 && ay > ax && body.scrollTop <= 0) { active = true; start(ty, e.timeStamp); }
      else { armed = false; return; }
    }
    e.preventDefault();
    move(t.clientY, e.timeStamp);
  }, { passive: false });
  const fin = () => { if (active) { active = false; end(); } armed = false; };
  area.addEventListener('touchend', fin);
  area.addEventListener('touchcancel', fin);
}
function closeSheet(now, keepHistory) {
  if (!sheetEl) return;
  const el = sheetEl; sheetEl = null;
  el.classList.remove('show');
  if (now) el.remove(); else setTimeout(() => el.remove(), 280);
  if (sheetPushed && !keepHistory) { sheetPushed = false; skipPop++; history.back(); }
}
/* geste ou bouton retour : ferme la fiche au lieu de quitter l'app */
window.addEventListener('popstate', () => {
  if (skipPop > 0) { skipPop--; return; }
  if (sheetEl) { sheetPushed = false; closeSheet(); return; }
  sheetPushed = false;
  if (merPage) { merPage = null; if (state.tab === 'mer') { renderMer(); $('#mer').scrollTop = 0; } }
});
function leaveFav() { if (merPage) { merPage = null; skipPop++; history.back(); } }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
const closeBtn = () => h('button', { class: 'close', 'aria-label': t('close'), onclick: () => closeSheet() }, icon(CLOSE, 20, 1.5));

function openProduct(p) {
  let shade = p.shades.length ? p.shades[0] : '';
  const countOf = (sh) => cart.filter((l) => l.key === p.id + '|' + sh).reduce((n, l) => n + l.qty, 0);
  const chipEls = [];
  const chips = p.shades.length > 1 ? p.shades.slice(0, 40).map((sh, i) => {
    const n = h('span', { class: 'n', hidden: true });
    const b = h('button', { class: 'chip' + (i === 0 ? ' on' : ''), onclick: () => { shade = sh; showCount(); } }, sh, n);
    chipEls.push({ b, n, sh });
    return b;
  }) : [];
  const chipBox = h('div', { class: 'chips' }, chips);
  const imgs = p.gallery.length ? p.gallery : (p.img ? [p.img] : []);
  const cnt = h('span', { class: 'cnt' });
  const showCount = () => {
    const n = countOf(shade);
    cnt.textContent = n; cnt.hidden = !n;
    chipEls.forEach(({ b, n: bn, sh }) => {
      const on = sh === shade, k = countOf(sh);
      b.classList.toggle('on', on);
      bn.textContent = k; bn.hidden = !k;
    });
  };
  const fx = h('span', { class: 'fx', 'aria-hidden': 'true' }, h('i', { class: 'bar' }), h('i', { class: 'dot' }), h('span', { class: 'bk' }, icon(CARTP, 22, 1.6)));
  const add = h('button', { class: 'cta' }, h('span', { class: 'lbl' }, t('add')), cnt, fx);
  showCount();
  let running = null;
  add.addEventListener('click', () => {
    addToCart(p, shade);
    showCount();
    if (running) return;
    add.classList.add('run');
    running = setTimeout(() => { add.classList.remove('run'); running = null; cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop'); }, 1520);
  });
  openSheet([
    h('div', { class: 'sbody' },
      h('div', { class: 'gwrap' }, h('div', { class: 'gallery' }, imgs.map((src) => h('img', { src, alt: p.name, onerror: (e) => e.target.remove() })))),
      h('div', { class: 'info' }, h('div', { class: 'brand' }, p.brand), h('h1', { class: 'title' }, p.name), priceEl(p)),
      chips.length ? h('div', { class: 'info' }, h('div', { class: 'lbl' }, p.shadeLabel === 'nyanser' ? t('shade') : t('variant')), chipBox) : null,
      p.paras && p.paras.length ? h('div', { class: 'desc' }, p.paras.map((t) => h('p', null, t))) : (p.desc ? h('div', { class: 'desc' }, p.desc) : null),
      h('a', { class: 'site', href: p.url, target: '_blank', rel: 'noopener' }, t('see_site'))),
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
    body.replaceChildren(h('div', { class: 'shead' }, h('h2', {}, t('cart')), closeBtn()));
    foot.replaceChildren();
    if (!cart.length) { body.append(h('div', { class: 'void' }, t('cart_empty'))); return; }
    for (const l of cart) {
      body.append(h('div', { class: 'line' },
        h('div', { class: 'th' }, l.img ? h('img', { src: l.img, alt: '', onerror: (e) => e.target.remove() }) : null),
        h('div', { class: 'lm' },
          h('div', { class: 'brand' }, l.brand), h('div', { class: 'name' }, l.name),
          l.shade ? h('div', { class: 'var' }, l.shade) : null,
          h('div', { class: 'price' }, kr(l.price * l.qty)),
          h('div', { class: 'qty' },
            h('button', { 'aria-label': t('fewer'), onclick: () => { l.qty--; if (l.qty <= 0) cart = cart.filter((x) => x !== l); saveCart(); draw(); } }, '−'),
            h('span', {}, l.qty),
            h('button', { 'aria-label': t('more'), onclick: () => { l.qty++; saveCart(); draw(); } }, '+')))));
    }
    const sum = cart.reduce((s, l) => s + l.price * l.qty, 0);
    body.append(h('div', { class: 'total' }, h('span', {}, t('sum')), h('span', {}, kr(sum))));
    body.append(h('div', { class: 'note' }, t('cart_note')));
    foot.append(h('div', { class: 'actions' }, h('a', { class: 'cta', href: SITE, target: '_blank', rel: 'noopener' }, t('checkout'))));
  };
  draw();
  openSheet([body, foot]);
}
$('#cartBtn').addEventListener('click', openCart);

/* ---------- page Mer ---------- */
const CHEV = 'M9 6l6 6-6 6';
function openInfo(i) {
  const [title, secs] = t('legal')[i];
  openSheet(h('div', { class: 'sbody' },
    h('div', { class: 'shead' }, h('h2', {}, title), closeBtn()),
    h('div', { class: 'legal' }, secs.flatMap(([hd, p]) => [hd ? h('h3', {}, hd) : null, h('p', {}, p)]))));
}
function clearData() {
  if (!confirm(t('clear_q'))) return;
  try { Object.keys(localStorage).filter((k) => k.startsWith('fl.') && k !== 'fl.lang').forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignorer */ }
  favs = {}; cart = []; renderCartCount(); renderMer();
}
function setLang(l) {
  if (l === LANG) return;
  LANG = l; store.set('lang', l);
  applyLang();
}
function applyLang() {
  document.documentElement.lang = LANG === 'en' ? 'en' : 'nb';
  $('#q').placeholder = t('search_ph');
  $('#q').setAttribute('aria-label', t('search'));
  $('#search button').setAttribute('aria-label', t('search'));
  $('#cartBtn').setAttribute('aria-label', t('cart'));
  $('#tabs').setAttribute('aria-label', t('categories'));
  renderTabs(); renderFilters(); renderPills();
  if (state.items.length) { $('#grid').replaceChildren(); addCards(state.items); }
  if (state.tab === 'mer') renderMer();
}
function renderMer() {
  const list = Object.values(favs).filter((f) => f && f.img && f.shades);
  if (merPage === 'fav' && !list.length) { merPage = null; skipPop++; history.back(); }
  if (merPage === 'fav') {
    $('#merBody').replaceChildren(
      h('div', { class: 'fhead' },
        h('button', { class: 'back', 'aria-label': t('back'), onclick: () => history.back() }, icon('M15 6l-6 6 6 6', 22, 1.5)),
        h('h1', {}, t('favorites')), h('span', { class: 'ct' }, String(list.length))),
      h('div', { class: 'grid' }, list.map(card)));
    return;
  }
  const row = (label, fn, cls) => h('button', { class: 'mrow' + (cls ? ' ' + cls : ''), onclick: fn }, h('span', {}, label), cls ? null : icon(CHEV, 18, 1.5));
  const openFav = () => { history.pushState({ fav: 1 }, ''); merPage = 'fav'; renderMer(); $('#mer').scrollTop = 0; };
  $('#merBody').replaceChildren(
    h('div', { class: 'mtitle' }, t('mer')),
    h('section', { class: 'msec' },
      h('h2', {}, t('favorites')),
      list.length
        ? h('div', { class: 'mlist' }, h('button', { class: 'mrow fav', onclick: openFav },
          h('span', { class: 'fl' }, h('span', {}, t('favorites')), h('small', {}, t('fav_count', list.length))),
          h('span', { class: 'thumbs' }, list.slice(0, 3).map((f) => h('img', { src: f.img, alt: '' }))),
          icon(CHEV, 18, 1.5)))
        : h('div', { class: 'mempty' }, icon(HEART, 30, 1.2), h('p', {}, t('fav_empty')), h('p', { class: 'sub' }, t('fav_empty_sub')))),
    h('section', { class: 'msec' },
      h('h2', {}, t('language')),
      h('div', { class: 'seg' }, h('button', { class: LANG === 'no' ? 'on' : '', onclick: () => setLang('no') }, 'Norsk'), h('button', { class: LANG === 'en' ? 'on' : '', onclick: () => setLang('en') }, 'English'))),
    h('section', { class: 'msec' },
      h('h2', {}, t('info')),
      h('div', { class: 'mlist' }, t('legal').map((x, i) => row(x[0], () => openInfo(i))))),
    h('section', { class: 'msec' },
      h('h2', {}, t('data')),
      h('div', { class: 'mlist' }, row(t('clear'), clearData, 'danger'))),
    h('p', { class: 'mfoot' }, h('b', {}, 'Fredrik & Louisa'), t('unofficial') + ' · ' + VERSION));
}

/* ---------- en-tête : recherche et filtres se cachent en descendant, reviennent en remontant ---------- */
(function () {
  const sc = $('#scroller'), tools = $('#tools');
  let last = 0;
  sc.addEventListener('scroll', () => {
    const y = Math.max(0, sc.scrollTop), d = y - last;
    if (y <= 2 || document.activeElement === $('#q')) { tools.classList.remove('hide'); last = y; }
    else if (d > 6) { tools.classList.add('hide'); last = y; }
    else if (d < -6) { tools.classList.remove('hide'); last = y; }
  }, { passive: true });
})();

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
      ptr.textContent = dist > 120 ? t('ptr_go') : t('ptr');
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
  applyLang(); renderCartCount();
  skeleton();
  try { await loadCats(); } catch (e) { showError(); return; }
  loadSubs();
  load();
})();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
