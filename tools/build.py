#!/usr/bin/env python3
"""
CASADUCHO v2 — generador estático.
Lee assets/data/menus.json + assets/data/delivery-links.json y genera:
  - menus/{concepto}.html  (10 páginas pre-renderizadas, SEO-friendly)
  - menus/index.html       (hub con búsqueda global)
  - assets/js/delivery-links.js  (window.CASADUCHO_DELIVERY)
  - assets/js/menus-data.js      (índice compacto para búsqueda global)
  - sitemap.xml

Uso: python3 tools/build.py   (desde la carpeta v2/)
Cuando cambie un precio: editar menus.json y volver a correr. Nada más.
"""
import json, html, re, unicodedata
from pathlib import Path
from datetime import date

V2 = Path(__file__).resolve().parent.parent
DATA = V2 / 'assets' / 'data'
OUT_MENUS = V2 / 'menus'
BASE_URL = 'https://casaducho.com'

menus = json.loads((DATA / 'menus.json').read_text())['menus']
delivery = json.loads((DATA / 'delivery-links.json').read_text())

META = {
    'wagmi':    {'name': 'WAGMI', 'tagline': 'Classic Street Food', 'logo': 'wagmi.webp', 'desc': 'Smash burgers, Philly cheesesteaks y chicken sandwiches con carne Angus.', 'note': None},
    'cantina':  {'name': 'Cantina La Cuadra', 'tagline': 'Mexican Flavors', 'logo': 'cantina-la-cuadra.webp', 'desc': 'Tacos, quesadillas de birria, bowls y salsas hechas en casa.', 'note': None},
    'pecora':   {'name': 'La Pécora', 'tagline': 'Pizza & Pasta Artesanal', 'logo': 'la-pecora.webp', 'desc': 'Pizza de masa madre y pasta artesanal italiana.', 'note': None},
    'hokkaido': {'name': 'Hokkaido', 'tagline': 'Japanese Cuisine', 'logo': 'hokkaido.webp', 'desc': 'Uramaki rolls, poke bowls, nigiri y new style sashimi.', 'note': None},
    'napa':     {'name': 'Napa Fresh', 'tagline': 'Whole Foods Kitchen', 'logo': 'napa-fresh.webp', 'desc': 'Ensaladas, bowls saludables y pan de masa madre.', 'note': None},
    'bar':      {'name': 'EL BAR', 'tagline': 'Cocteles · Vinos · Spirits', 'logo': None, 'desc': 'Cocteles de autor, cervezas, vinos y spirits. Happy Hour 2x1 L–V 4–7PM.', 'note': 'Happy Hour 2x1 · Lunes a viernes · 4–7 PM'},
    'macro':    {'name': 'Macro Menú', 'tagline': 'Alto en Proteína', 'logo': None, 'desc': 'Platos altos en proteína con macros calculados, de todas las cocinas.', 'note': 'Calorías y macros calculados por porción.'},
    'kids':     {'name': 'Kids Menu', 'tagline': 'Para los más pequeños', 'logo': None, 'desc': 'Lo favorito de los niños, de todas las cocinas de Casaducho.', 'note': None},
    'postres':  {'name': 'Postres', 'tagline': 'El final feliz', 'logo': None, 'desc': 'Brookies, flan y más para cerrar con dulce.', 'note': None},
}
COLORS = {
    'wagmi': '#a8616c', 'cantina': '#b97607', 'pecora': '#3d5a5b', 'hokkaido': '#d6431a',
    'napa': '#00913d', 'bar': '#8f6238', 'macro': '#7d3c98', 'kids': '#c56f00', 'postres': '#c2185b',
}
# Conceptos con tienda de delivery propia → botón Pedir abre el sheet
ORDERABLE = {'wagmi', 'cantina', 'pecora', 'hokkaido', 'bar'}
# Cinemagraphs por concepto (header de menú vivo)
CINEMA = {'wagmi': 'wagmi', 'cantina': 'cantina', 'pecora': 'pecora', 'hokkaido': 'hokkaido', 'bar': 'elbar', 'postres': 'brookie'}  # cinemagraph header por marca
# Orden del hub (napa fuera del hub mientras el concepto esté pausado en el sitio)
HUB_ORDER = ['wagmi', 'cantina', 'pecora', 'hokkaido', 'bar', 'macro', 'kids', 'postres']

esc = html.escape

def slugify(s):
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def fmt_price(p):
    return f"RD$ {p:,.0f}".replace(',', ',')

def head(title, desc, canonical, concept_id):
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(desc)}">
  <link rel="canonical" href="{canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="CASADUCHO">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="{BASE_URL}/assets/img/og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" sizes="32x32" href="../favicon-32.png">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png">
  <meta name="theme-color" content="#fff3de">
  <link rel="preload" as="font" type="font/woff2" href="../assets/fonts/bricolage.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2" href="../assets/fonts/druk-medium.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2" href="../assets/fonts/migra-regular.woff2" crossorigin>
  <link rel="stylesheet" href="../assets/css/main.css">
  <link rel="stylesheet" href="../assets/css/menu.css">
</head>
<body data-concept="{concept_id}" style="padding-bottom:0">
"""

SHEET = """
<dialog class="sheet" id="order-sheet">
  <div class="sheet-inner">
    <div class="sheet-handle"></div>
    <div class="sheet-step active" data-step="1">
      <h3>¿De cuál cocina?</h3>
      <p class="sheet-sub">Cada cocina tiene su propia tienda de delivery.</p>
      <div class="sheet-concepts">
        <button class="sheet-concept" data-concept="wagmi" style="--scc:#a8616c"><span class="sc-dot"></span>WAGMI</button>
        <button class="sheet-concept" data-concept="cantina" style="--scc:#b97607"><span class="sc-dot"></span>Cantina La Cuadra</button>
        <button class="sheet-concept" data-concept="pecora" style="--scc:#3d5a5b"><span class="sc-dot"></span>La Pécora</button>
        <button class="sheet-concept" data-concept="hokkaido" style="--scc:#d6431a"><span class="sc-dot"></span>Hokkaidō</button>
        <button class="sheet-concept" data-concept="bar" style="--scc:#8f6238"><span class="sc-dot"></span>EL BAR</button>
        <button class="sheet-concept" data-concept="general" style="--scc:#0d3d2b"><span class="sc-dot"></span>De todo un poco</button>
      </div>
    </div>
    <div class="sheet-step" data-step="2">
      <button class="sheet-back">← Cambiar cocina</button>
      <h3 class="sheet-concept-name"></h3>
      <p class="sheet-sub">¿Por dónde quieres pedir?</p>
      <div class="sheet-channels"></div>
    </div>
  </div>
</dialog>
"""

def en_attr(item, key_es, key_en):
    en = item.get(key_en)
    return f' data-en="{esc(en, quote=True)}"' if en else ''

def render_item(item, anchor, accent='#cf8408'):
    badges = ''.join(f'<span class="badge {esc(slugify(b))}">{esc(b.replace("-", " "))}</span>' for b in item.get('badges', []))
    price = item.get('price') or 0
    variants = item.get('priceVariants')
    if variants:
        price_html = f'<span class="dish-tile-price">{fmt_price(price)}<small>{esc(variants)}</small></span>'
    elif price:
        price_html = f'<span class="dish-tile-price">{fmt_price(price)}</span>'
    else:
        price_html = '<span class="dish-tile-price">—</span>'
    desc = item.get('descEs', '')
    desc_html = f'<p class="dish-tile-desc"{en_attr(item, "descEs", "descEn")}>{esc(desc)}</p>' if desc else ''
    macros = item.get('macros')
    macros_html = f'<span class="dish-tile-macros">{esc(macros)}</span>' if macros else ''
    photo = item.get('photo')
    if photo:
        media = f'<div class="dish-tile-photo"><img src="../{esc(photo)}" alt="" loading="lazy">{badges}</div>'
        cls = 'dish-tile'
    else:
        media = f'<div class="dish-tile-photo noimg" style="--ph:{accent}">{badges}</div>'
        cls = 'dish-tile no-photo'
    return f"""<article class="{cls}" id="{anchor}" style="--ph:{accent}">
  {media}
  <div class="dish-tile-body">
    <div class="dish-tile-head"><h3{en_attr(item, "nameEs", "nameEn")}>{esc(item['nameEs'])}</h3>{price_html}</div>
    {desc_html}
    {macros_html}
  </div>
</article>"""

def render_menu_page(menu):
    cid = menu['conceptId']
    meta = META[cid]
    own_sections = [s for s in menu['sections'] if not s.get('duplicatedFrom')]
    dup_targets = {s['duplicatedFrom'] for s in menu['sections'] if s.get('duplicatedFrom')}
    n_items = sum(len(s['items']) for s in own_sections)

    title = f"Menú {meta['name']} | CASADUCHO"
    canonical = f"{BASE_URL}/menus/{cid}.html"
    out = [head(title, f"{meta['desc']} Menú completo con precios — Casaducho, Acrópolis Business Mall.", canonical, cid)]

    pedir = f'<button class="btn-pedir" data-order="{cid}">Pedir</button>' if cid in ORDERABLE else ''
    out.append(f"""
<header class="menu-topbar">
  <div class="menu-topbar-inner">
    <a class="menu-back" href="../">← Casaducho</a>
    <div class="menu-topbar-actions">
      <div class="lang-toggle"><button data-lang="es" class="active">ES</button><button data-lang="en">EN</button></div>
      {pedir}
    </div>
  </div>
</header>

<section class="menu-hero{' has-cinema' if cid in CINEMA else ''}">
  {f'''<video class="menu-hero-video cinemagraph" autoplay muted loop playsinline preload="none" poster="../assets/video/{CINEMA[cid]}-poster.webp" aria-label=""><source src="../assets/video/{CINEMA[cid]}.mp4" type="video/mp4"></video><img class="cinemagraph-fallback menu-hero-video" src="../assets/video/{CINEMA[cid]}-poster.webp" alt="">''' if cid in CINEMA else ''}
  <div class="menu-hero-inner">
  {f'<img class="menu-logo" src="../assets/img/logos/{meta["logo"]}" alt="">' if meta['logo'] else ''}
  <h1>{esc(meta['name'])}</h1>
  <p class="menu-tagline">{esc(meta['tagline'])}</p>
  {f'<p class="menu-note">{esc(meta["note"])}</p>' if meta.get('note') else ''}
  </div>
</section>

<div class="menu-search"><input type="search" placeholder="Buscar en este menú…" aria-label="Buscar plato"></div>

<nav class="cat-chips" aria-label="Categorías">
""")
    for s in own_sections:
        sid = slugify(s['nameEs'])
        out.append(f'<a class="cat-chip" href="#{sid}"><span data-en="{esc(s.get("nameEn") or s["nameEs"], quote=True)}">{esc(s["nameEs"])}</span></a>')
    out.append('</nav>\n<main class="menu-body">')

    for s in own_sections:
        sid = slugify(s['nameEs'])
        coming = ' coming-soon' if s.get('comingSoon') else ''
        out.append(f'<section class="menu-section{coming}" id="{sid}">')
        name_en = s.get('nameEn') or s['nameEs']
        out.append(f'<h2><span data-en="{esc(name_en, quote=True)}">{esc(s["nameEs"])}</span></h2>')
        if s.get('noteEs'):
            out.append(f'<p class="section-note">{esc(s["noteEs"])}</p>')
        out.append('<div class="menu-grid">')
        for it in s['items']:
            anchor = f"{sid}-{slugify(it['nameEs'])}"
            out.append(render_item(it, anchor, accent=COLORS.get(cid, '#cf8408')))
        out.append('</div></section>')

    out.append('<p class="menu-empty">Nada con ese nombre por aquí.</p>')

    # Cross-links a transversales (reemplazan las secciones duplicadas)
    if dup_targets:
        out.append('<div class="cross-links">')
        for t in ['macro', 'kids', 'napa', 'postres']:
            if t in dup_targets and t in META:
                target = 'wagmi' if t == 'napa' else t  # napa pausado: sus ensaladas viven en macro/wagmi
                if t == 'napa':
                    continue
                out.append(f'<a class="cross-link" href="{t}.html" style="--xc:{COLORS[t]}"><span class="x-dot"></span>Ver {esc(META[t]["name"])} completo →</a>')
        out.append('</div>')

    notes_html = 'Precios en RD$ · ITBIS no incluido'
    out.append(f"""
</main>
<footer class="menu-footer">
  <p>{notes_html}</p>
  <p style="margin-top:8px">CASADUCHO · Acrópolis Business Mall, Primer Nivel, Santo Domingo · <a href="../">casaducho.com</a></p>
</footer>
{SHEET}
<script src="../assets/js/delivery-links.js"></script>
<script src="../assets/js/main.js"></script>
<script src="../assets/js/menu.js"></script>
</body>
</html>""")

    # JSON-LD Menu schema
    sections_ld = []
    for s in own_sections:
        items_ld = []
        for it in s['items']:
            entry = {"@type": "MenuItem", "name": it['nameEs']}
            if it.get('descEs'): entry['description'] = it['descEs']
            if it.get('price'):
                entry['offers'] = {"@type": "Offer", "price": str(it['price']), "priceCurrency": "DOP"}
            items_ld.append(entry)
        sections_ld.append({"@type": "MenuSection", "name": s['nameEs'], "hasMenuItem": items_ld})
    ld = {"@context": "https://schema.org", "@type": "Menu", "name": f"Menú {meta['name']} — CASADUCHO",
          "inLanguage": "es", "hasMenuSection": sections_ld}
    ld_tag = f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>'
    html_out = ''.join(out).replace('</head>', ld_tag + '\n</head>')

    # NFC: macrones y acentos como caracteres precompuestos (evita glyphs rotos en Fraunces)
    (OUT_MENUS / f'{cid}.html').write_text(unicodedata.normalize('NFC', html_out))
    return n_items

def render_hub(counts):
    title = "Menús | CASADUCHO — 6 cocinas, un techo"
    canonical = f"{BASE_URL}/menus/"
    out = [head(title, "Todos los menús de Casaducho con precios: WAGMI, Cantina La Cuadra, La Pécora, Hokkaidō, EL BAR, Macro, Kids y Postres.", canonical, 'hub')]
    out.append("""
<header class="menu-topbar">
  <div class="menu-topbar-inner">
    <a class="menu-back" href="../">← Casaducho</a>
    <button class="btn-pedir" data-order>Ordenar 🛵</button>
  </div>
</header>
<section class="menu-hero">
  <h1>Los menús</h1>
  <p class="menu-tagline">6 cocinas · un techo</p>
</section>
<div class="menu-search hub-search" style="max-width:980px"><input type="search" placeholder="Busca un plato en todo el mercado: birria, sushi, burger…" aria-label="Buscar en todos los menús"></div>
<div class="hub-results"></div>
<div class="hub-grid">
""")
    kinds = {'wagmi': 'Street Food', 'cantina': 'Mexicano', 'pecora': 'Italiano', 'hokkaido': 'Japonés',
             'bar': 'Cocteles & Vinos', 'macro': 'Alto en proteína', 'kids': 'Niños', 'postres': 'Dulce'}
    for cid in HUB_ORDER:
        m = META[cid]
        out.append(f"""<a class="hub-card" href="{cid}.html" style="--hc:{COLORS[cid]};--hcd:{COLORS[cid]}">
  <span class="hub-kind">{esc(kinds[cid])}</span>
  <h2>{esc(m['name'])}</h2>
  <p>{esc(m['desc'])}</p>
  <span class="hub-count">{counts.get(cid, 0)} platos →</span>
</a>""")
    out.append(f"""
</div>
<footer class="menu-footer" style="margin-top:32px">
  <p>Precios en RD$ · ITBIS no incluido</p>
  <p style="margin-top:8px">CASADUCHO · Acrópolis Business Mall, Primer Nivel, Santo Domingo · <a href="../">casaducho.com</a></p>
</footer>
{SHEET}
<script src="../assets/js/delivery-links.js"></script>
<script src="../assets/js/menus-data.js"></script>
<script src="../assets/js/main.js"></script>
<script src="../assets/js/menu.js"></script>
</body>
</html>""")
    (OUT_MENUS / 'index.html').write_text(unicodedata.normalize('NFC', ''.join(out)))

CNAME = {'wagmi':'WAGMI','cantina':'Cantina La Cuadra','pecora':'La Pécora','hokkaido':'Hokkaidō','bar':'EL BAR','macro':'Macro','kids':'Kids','postres':'Postres'}
def build_carousel():
    items = []
    seen = set()
    for menu in menus:
        cid = menu['conceptId']
        if cid not in HUB_ORDER: continue
        for s in menu['sections']:
            if s.get('duplicatedFrom'): continue
            for it in s['items']:
                ph = it.get('photo')
                if not ph: continue
                key = (cid, it['nameEs'])
                if key in seen: continue
                seen.add(key)
                items.append({'n': it['nameEs'], 'c': CNAME.get(cid, cid), 'cc': COLORS.get(cid,'#cf8408'),
                              'p': it.get('price') or 0, 'photo': ph, 'u': f'menus/{cid}.html'})
    # intercalar por concepto para variar el orden visual
    from itertools import zip_longest
    bucket = {}
    for x in items: bucket.setdefault(x['c'], []).append(x)
    mixed = [x for grp in zip_longest(*bucket.values()) for x in grp if x]
    js = 'window.CASADUCHO_CAROUSEL = ' + json.dumps(mixed, ensure_ascii=False, separators=(',',':')) + ';'
    (V2 / 'assets' / 'js' / 'carousel-data.js').write_text(js)
    return len(mixed)

def build_search_index():
    idx = []
    for menu in menus:
        cid = menu['conceptId']
        if cid not in HUB_ORDER:
            continue
        for s in menu['sections']:
            if s.get('duplicatedFrom'):
                continue
            sid = slugify(s['nameEs'])
            for it in s['items']:
                anchor = f"{sid}-{slugify(it['nameEs'])}"
                entry = {'c': META[cid]['name'], 'cc': COLORS[cid], 's': s['nameEs'],
                         'n': it['nameEs'], 'p': it.get('price') or 0,
                         'u': f'{cid}.html#{anchor}'}
                if it.get('priceVariants'): entry['v'] = it['priceVariants']
                if it.get('descEs'): entry['d'] = it['descEs'][:80]
                idx.append(entry)
    js = 'window.CASADUCHO_MENUS = ' + json.dumps(idx, ensure_ascii=False, separators=(',', ':')) + ';'
    (V2 / 'assets' / 'js' / 'menus-data.js').write_text(js)
    return len(idx)

def build_delivery_js():
    clean = {k: v for k, v in delivery.items() if not k.startswith('_')}
    js = ('/* GENERADO por tools/build.py desde assets/data/delivery-links.json — editar el JSON, no este archivo */\n'
          'window.CASADUCHO_DELIVERY = ' + json.dumps(clean, ensure_ascii=False, separators=(',', ':')) + ';')
    (V2 / 'assets' / 'js' / 'delivery-links.js').write_text(js)

def build_sitemap():
    today = date.today().isoformat()
    urls = [f'{BASE_URL}/', f'{BASE_URL}/menus/'] + [f'{BASE_URL}/menus/{c}.html' for c in HUB_ORDER]
    body = ''.join(f'<url><loc>{u}</loc><lastmod>{today}</lastmod></url>' for u in urls)
    (V2 / 'sitemap.xml').write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>')

if __name__ == '__main__':
    OUT_MENUS.mkdir(exist_ok=True)
    build_delivery_js()
    counts = {}
    for m in menus:
        if m['conceptId'] in HUB_ORDER:
            counts[m['conceptId']] = render_menu_page(m)
    n = build_search_index()
    ncar = build_carousel()
    render_hub(counts)
    build_sitemap()
    print(f"OK: {len(counts)} páginas, índice {n}, carrusel {ncar}, hub, sitemap, delivery-links.js")
    print({k: v for k, v in counts.items()})
