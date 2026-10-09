// Cloudflare Worker, à déployer seulement si le navigateur bloque l'API de F&L (erreur CORS).
// Ensuite, dans app.js, remplacer API par l'URL du Worker, sans slash final.
// Les réponses sont gardées 15 minutes, ce qui évite de solliciter leur serveur à chaque ouverture.
const ORIGIN_API = 'https://fredrikoglouisa.no/wp-json/wc/store/v1';

/* Galeries d'images des fiches produit : le site les injecte par script dans la page (elles n'existent pas dans l'API).
   On lit la page produit une fois (puis cache 1 h) et on en sort { "slug-de-variante": [urls...], "": [urls par défaut] }. */
function extractGalleries(html) {
  const out = {};
  const m = html.match(/wc_variation_gallery_defaults\s*\|\|\s*\{\}\)\[\d+\]\s*=\s*("(?:[^"\\]|\\.)*")\s*;/);
  if (!m) return out;
  let inner;
  try { inner = JSON.parse(m[1]); } catch (e) { return out; }
  const un = (s) => { try { return JSON.parse('"' + s + '"'); } catch (e) { return s; } };
  const defaults = [...inner.matchAll(/<li class='splide__slide fl-single-product-gallery-image'><img src='([^']+)'/g)].map((x) => x[1]);
  const singles = {}, slides = {};
  for (const x of inner.matchAll(/flpgSingle\["([^"]*)"\]\s*=\s*"((?:[^"\\]|\\.)*)"/g)) singles[x[1]] = un(x[2]);
  for (const x of inner.matchAll(/flpgVariationGallerySlides\["([^"]*)"\]\s*=\s*(\[[^\]]*\])/g)) {
    try { slides[x[1]] = JSON.parse(x[2]).filter((s) => s.kind === 'image' && s.single).map((s) => s.single); } catch (e) { /* ignorer */ }
  }
  for (const k of new Set([...Object.keys(singles), ...Object.keys(slides)])) {
    const list = [singles[k], ...(slides[k] || [])].filter(Boolean);
    if (list.length) out[k] = list;
  }
  if (defaults.length) out[''] = defaults.concat((out[''] || []).filter((u) => !defaults.includes(u)));
  return out;
}

/* Boutiques et stock par boutique : on réutilise ce que fait la page produit du site (plugin « click & collect »).
   - la liste des boutiques est lue dans le code de n'importe quelle page produit ;
   - le stock vient de deux appels internes du site : un jeton, puis la disponibilité d'un produit ou d'une variante. */
const STORES_PAGE = 'https://fredrikoglouisa.no/produkt/gloss-bomb-universal-lip-luminizer-9ml/';
const AJAX = 'https://fredrikoglouisa.no/wp-admin/admin-ajax.php';
const dec = (s) => (s || '').replace(/&#0?38;|&amp;/g, '&').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const lines = (h) => dec(h).split(/<br\s*\/?>/i).map((x) => x.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
function extractStores(html) {
  const out = [];
  for (const p of html.split('<div class="store-container"').slice(1)) {
    const g = (re) => { const m = p.match(re); return m ? m[1] : ''; };
    const n = Number(g(/data-storenumber="(\d+)"/));
    const name = dec(g(/<p class="storename">([^<]*)<\/p>/)).trim();
    if (!n || !name) continue;
    out.push({
      n, name, short: name.replace(/^Fredrik\s*&\s*Louisa\s*/i, '') || name,
      lat: Number(g(/data-latitude="([^"]*)"/)) || null, lng: Number(g(/data-longitude="([^"]*)"/)) || null,
      addr: lines(g(/<div class="address"><h3>[^<]*<\/h3><p>([\s\S]*?)<\/p>/)).join(', '),
      phone: dec(g(/href="tel:([^"]*)"/)).trim(),
      hours: lines(g(/<div class="opening-hours"><h3>[^<]*<\/h3>([\s\S]*?)<\/div>/))
    });
  }
  return out;
}
async function getNonce(cache, ctx, fresh) {
  const key = new Request('https://cache.local/fl-nonce');
  if (!fresh) { const c = await cache.match(key); if (c) return c.text(); }
  const r = await fetch(AJAX + '?action=cc_get_nonce', { headers: { Accept: '*/*' } });
  const n = (await r.text()).trim();
  if (/^[a-f0-9]{6,}$/i.test(n)) ctx.waitUntil(cache.put(key, new Response(n, { headers: { 'Cache-Control': 'max-age=1500' } })));
  return n;
}
async function askStock(id, type, nonce) {
  const r = await fetch(AJAX, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ action: 'availability_action', security: nonce, type, id }).toString() });
  try { const j = JSON.parse(await r.text()); return j && typeof j === 'object' ? j : null; } catch (e) { return null; }
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } });
    }
    const cache = caches.default;
    const u0 = new URL(req.url);
    /* photos des produits (seulement celles du site), pour que l'app puisse en lire la couleur */
    if (u0.pathname === '/_img') {
      const src = u0.searchParams.get('u') || '';
      if (!src.startsWith('https://fredrikoglouisa.no/wp-content/uploads/')) return new Response('forbidden', { status: 403 });
      let im = await cache.match(req);
      if (!im) {
        const up = await fetch(src);
        im = new Response(up.body, up);
        im.headers.delete('Set-Cookie');
        im.headers.set('Cache-Control', 'public, max-age=86400');
        im.headers.set('Access-Control-Allow-Origin', '*');
        if (up.ok) ctx.waitUntil(cache.put(req, im.clone()));
      }
      return im;
    }
    if (u0.pathname === '/_stores') {
      let r0 = await cache.match(req);
      if (!r0) {
        const up = await fetch(STORES_PAGE, { headers: { Accept: 'text/html' } });
        const list = up.ok ? extractStores(await up.text()) : [];
        r0 = new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' } });
        if (list.length) ctx.waitUntil(cache.put(req, r0.clone()));
      }
      return r0;
    }
    if (u0.pathname === '/_stock') {
      const id = u0.searchParams.get('id') || '', type = u0.searchParams.get('type') || '';
      if (!/^\d+$/.test(id) || !['variable', 'simple'].includes(type)) return new Response('bad request', { status: 400 });
      let r1 = await cache.match(req);
      if (!r1) {
        let data = await askStock(id, type, await getNonce(cache, ctx, false));
        if (!data) data = await askStock(id, type, await getNonce(cache, ctx, true));
        r1 = new Response(JSON.stringify(data || {}), { status: data ? 200 : 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' } });
        if (data) ctx.waitUntil(cache.put(req, r1.clone()));
      }
      return r1;
    }
    if (u0.pathname === '/_gallery') {
      const page = u0.searchParams.get('u') || '';
      if (!page.startsWith('https://fredrikoglouisa.no/produkt/')) return new Response('forbidden', { status: 403 });
      let g = await cache.match(req);
      if (!g) {
        const up = await fetch(page, { headers: { Accept: 'text/html' } });
        const html = up.ok ? await up.text() : '';
        g = new Response(JSON.stringify(extractGalleries(html)), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' } });
        if (up.ok) ctx.waitUntil(cache.put(req, g.clone()));
      }
      return g;
    }
    let res = await cache.match(req);
    if (!res) {
      const u = new URL(req.url);
      const up = await fetch(ORIGIN_API + u.pathname + u.search, { headers: { Accept: 'application/json' } });
      res = new Response(up.body, up);
      res.headers.delete('Set-Cookie');
      res.headers.set('Cache-Control', 'public, max-age=900');
      res.headers.set('Access-Control-Allow-Origin', '*');
      res.headers.set('Access-Control-Expose-Headers', 'X-WP-TotalPages, X-WP-Total');
      if (up.ok) ctx.waitUntil(cache.put(req, res.clone()));
    }
    return res;
  }
};
