# CASADUCHO v2 — sitio rediseñado

**Preview local:** `cd v2 && python3 -m http.server 8742` → http://localhost:8742

## Estructura
```
v2/
├── index.html              ← home
├── menus/                  ← 8 páginas de menú + hub (GENERADAS, no editar a mano)
├── assets/
│   ├── css/main.css        ← tokens + home (1 solo CSS para todo el sitio)
│   ├── css/menu.css        ← páginas de menú
│   ├── js/main.js          ← nav, sheet de ordenar, estado abierto, promo de hoy
│   ├── js/menu.js          ← búsqueda, scroll-spy, toggle ES/EN
│   ├── js/delivery-links.js  ← GENERADO desde data/delivery-links.json
│   ├── js/menus-data.js    ← GENERADO: índice de búsqueda global
│   ├── data/menus.json     ← ★ FUENTE ÚNICA de los 232 ítems y precios
│   └── data/delivery-links.json ← ★ FUENTE ÚNICA de tiendas PYA/UE/WhatsApp
├── tools/build.py          ← generador estático
├── .htaccess               ← redirects 301 (QRs viejos), cache, HSTS, www→apex
├── robots.txt / sitemap.xml / favicons / og-image
```

## Cambiar un precio o un plato
1. Editar `assets/data/menus.json`
2. `python3 tools/build.py`
3. Subir los archivos regenerados

## Activar/desactivar una tienda de delivery
1. Editar `assets/data/delivery-links.json` (`"activo": true/false`)
2. `python3 tools/build.py`
3. Subir. El sheet de Ordenar y la matriz se actualizan solos.

## Reactivar Napa Fresh
En `tools/build.py` agregar `'napa'` a `HUB_ORDER` y correr el build (los 66 ítems ya están en menus.json). Agregar su card en index.html.

## Pendiente al publicar
- GA4: descomentar snippet en `<head>` de index.html e insertar el ID real.
- Verificar redirects QR: /assets/menus/*-menu.html → /menus/*.html
- Si el hosting es solo-nginx, replicar las reglas de .htaccess en Plesk.
