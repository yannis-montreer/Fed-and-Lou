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
