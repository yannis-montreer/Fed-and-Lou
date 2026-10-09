// Cloudflare Worker, à déployer seulement si le navigateur bloque l'API de F&L (erreur CORS).
// Ensuite, dans app.js, remplacer API par l'URL du Worker, sans slash final.
// Les réponses sont gardées 15 minutes, ce qui évite de solliciter leur serveur à chaque ouverture.
const ORIGIN_API = 'https://fredrikoglouisa.no/wp-json/wc/store/v1';

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
