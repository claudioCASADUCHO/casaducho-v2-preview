/* CASADUCHO v2 — menu.js: búsqueda, scroll-spy de categorías, toggle ES/EN */
(function () {
  'use strict';

  /* ---------- Toggle ES/EN ---------- */
  var langBtns = document.querySelectorAll('.lang-toggle button');
  var setLang = function (lang) {
    document.querySelectorAll('[data-en]').forEach(function (el) {
      if (!el.hasAttribute('data-es')) el.setAttribute('data-es', el.textContent);
      var txt = lang === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-es');
      if (txt) el.textContent = txt;
    });
    langBtns.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-lang') === lang); });
    try { localStorage.setItem('cd-lang', lang); } catch (e) {}
  };
  langBtns.forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
  });
  try {
    var saved = localStorage.getItem('cd-lang');
    if (saved === 'en') setLang('en');
  } catch (e) {}

  /* ---------- Búsqueda dentro del menú ---------- */
  var input = document.querySelector('.menu-search input');
  var empty = document.querySelector('.menu-empty');
  if (input) {
    var norm = function (s) {
      return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    };
    input.addEventListener('input', function () {
      var q = norm(input.value.trim());
      var any = false;
      document.querySelectorAll('.menu-section').forEach(function (sec) {
        var vis = 0;
        sec.querySelectorAll('.dish-tile').forEach(function (it) {
          var hit = !q || norm(it.textContent).indexOf(q) !== -1;
          it.classList.toggle('hidden', !hit);
          if (hit) vis++;
        });
        sec.style.display = vis ? '' : 'none';
        if (vis) any = true;
      });
      if (empty) empty.style.display = any ? 'none' : 'block';
    });
  }

  /* ---------- Scroll-spy de chips ---------- */
  var chips = document.querySelectorAll('.cat-chip[href^="#"]');
  if (chips.length && 'IntersectionObserver' in window) {
    var map = {};
    chips.forEach(function (c) { map[c.getAttribute('href').slice(1)] = c; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          chips.forEach(function (c) { c.classList.remove('active'); });
          var chip = map[e.target.id];
          if (chip) {
            chip.classList.add('active');
            chip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
          }
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    document.querySelectorAll('.menu-section[id]').forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Búsqueda global (hub) ---------- */
  var hubInput = document.querySelector('.hub-search input');
  var hubResults = document.querySelector('.hub-results');
  var DATA = window.CASADUCHO_MENUS || null;
  if (hubInput && hubResults && DATA) {
    var hnorm = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
    hubInput.addEventListener('input', function () {
      var q = hnorm(hubInput.value.trim());
      hubResults.innerHTML = '';
      if (q.length < 2) return;
      var hits = DATA.filter(function (d) { return hnorm(d.n + ' ' + (d.d || '')).indexOf(q) !== -1; }).slice(0, 30);
      hits.forEach(function (h) {
        var price = h.v ? h.v : (h.p ? 'RD$ ' + h.p.toLocaleString('en-US') : '');
        hubResults.insertAdjacentHTML('beforeend',
          '<a class="hub-result" style="--rc:' + h.cc + '" href="' + h.u + '">' +
          '<span class="r-concept">' + h.c + ' · ' + h.s + '</span>' +
          '<strong>' + h.n + '</strong><span class="r-price">' + price + '</span></a>');
      });
      if (!hits.length) hubResults.innerHTML = '<p style="text-align:center;color:var(--ink-soft);padding:20px 0">Nada con ese nombre. Prueba "birria", "sushi", "burger"…</p>';
    });
  }
})();
