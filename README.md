# Démo F&L (PWA)

Fichiers statiques, aucun build. Les produits sont lus à chaque ouverture sur
https://fredrikoglouisa.no/wp-json/wc/store/v1 (API publique WooCommerce).

## Mise en ligne sur GitHub Pages
1. Créer un repo (public, ou privé si ton plan GitHub permet Pages en privé).
2. Y mettre tous ces fichiers à la racine.
3. Settings > Pages > Deploy from a branch > main / (root).
4. Sur l'iPhone, ouvrir l'URL dans Safari > Partager > Sur l'écran d'accueil.

## Si l'écran reste vide avec "Kunne ikke hente produkter"
Le navigateur bloque probablement l'API (CORS). Déployer worker.js sur Cloudflare
(plan gratuit), puis remplacer la constante API en haut de app.js par l'URL du Worker.

## Après la présentation
Supprimer le repo : la page montre la marque et les produits de F&L publiquement.
La page est en noindex mais reste accessible à qui a l'URL.
