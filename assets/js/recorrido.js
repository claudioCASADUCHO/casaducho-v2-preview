/* CASADUCHO — Recorrido del Local. Mapa + viaje entre zonas. Sin dependencias. */
(function () {
  'use strict';
  var stage = document.getElementById('rl-stage');
  if (!stage) return;

  var IMG = 'assets/img/interior/';
  /* Cada zona: label, title (gancho), y fotos en orden de recorrido.
     Ajusta los nombres a tus archivos reales en assets/img/interior/. */
  var RL_TOUR = {
    entrada: { label: 'Entrada · Pasillo', title: 'Cruzas la puerta y se abre el mercado',
               photos: ['pasillo.webp'] },
    wagmi:   { label: 'WAGMI', title: 'Smash burgers, a la vista',
               photos: ['wagmi.webp', 'wagmi-v.webp', 'wagmi2.webp'] },
    pecora:  { label: 'La Pécora', title: 'Masa madre y horno de pizza',
               photos: ['pecora.webp'] },
    cantina: { label: 'Pizzería', title: 'El horno, en plena acción',
               photos: ['pecora.webp'] },
    bar:     { label: 'El Bar', title: 'Cocteles, vinos y la hora feliz',
               photos: ['bar.webp'] },
    comedor: { label: 'Comedor', title: 'La mesa para venir con quien quieras',
               photos: ['comedor-1.webp', 'comedor-2.webp', 'comedor-3.webp', 'comedor-4.webp'] }
  };

  var map   = document.getElementById('rl-map');
  var zone  = document.getElementById('rl-zone');
  var imgA  = document.getElementById('rl-zone-img-a');
  var imgB  = document.getElementById('rl-zone-img-b');
  var scrim = document.querySelector('.rl-zone-scrim');
  var label = document.getElementById('rl-zone-label');
  var title = document.getElementById('rl-zone-title');
  var nav   = document.getElementById('rl-zone-nav');
  var flash = document.getElementById('rl-flash');
  var back  = document.getElementById('rl-back');
  var prev  = document.getElementById('rl-prev');
  var next  = document.getElementById('rl-next');

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FLASH_MS = reduce ? 120 : 260;

  var state = { zone: null, photos: [], idx: 0, frontIsA: true, timer: null };

  function frontEl() { return state.frontIsA ? imgA : imgB; }
  function backEl()  { return state.frontIsA ? imgB : imgA; }

  function preloadAll() {
    Object.keys(RL_TOUR).forEach(function (k) {
      RL_TOUR[k].photos.forEach(function (p) { var i = new Image(); i.src = IMG + p; });
    });
  }
  /* precargar solo cuando la sección se acerca (no en load) */
  if ('IntersectionObserver' in window) {
    var pio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { preloadAll(); pio.disconnect(); } });
    }, { rootMargin: '900px 0px' });
    pio.observe(stage);
  } else { preloadAll(); }

  function setPhoto(i, instant) {
    if (!state.photos.length) return;
    state.idx = (i + state.photos.length) % state.photos.length;
    var url = IMG + state.photos[state.idx];
    var fEl = frontEl(), bEl = backEl();
    bEl.style.backgroundImage = "url('" + url + "')";
    bEl.classList.remove('kb'); bEl.style.transform = '';   /* reset Ken Burns */
    /* doble rAF para que el navegador registre scale(1.18) antes de animar a 1 */
    requestAnimationFrame(function () {
      bEl.classList.add('show');
      requestAnimationFrame(function () { if (!reduce) bEl.classList.add('kb'); });
    });
    fEl.classList.remove('show');
    state.frontIsA = !state.frontIsA;
    /* dots */
    nav.querySelectorAll('button').forEach(function (d, di) { d.classList.toggle('on', di === state.idx); });
  }

  function buildNav() {
    nav.innerHTML = '';
    var multi = state.photos.length > 1;
    prev.hidden = !multi; next.hidden = !multi;
    if (!multi) return;
    state.photos.forEach(function (_, di) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Foto ' + (di + 1));
      b.addEventListener('click', function () { stopAuto(); setPhoto(di); startAuto(); });
      nav.appendChild(b);
    });
  }

  function startAuto() {
    if (reduce || state.photos.length < 2) return;
    state.timer = setInterval(function () { setPhoto(state.idx + 1); }, 4200);
  }
  function stopAuto() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }

  /* ---- VIAJE: mapa -> zona ---- */
  function enter(key) {
    var z = RL_TOUR[key];
    if (!z) return;
    state.zone = key; state.photos = z.photos.slice(); state.idx = 0; state.frontIsA = true;
    flash.classList.add('on');
    setTimeout(function () {
      label.textContent = z.label; title.textContent = z.title;
      buildNav();
      imgA.classList.remove('show', 'kb'); imgB.classList.remove('show', 'kb');
      imgA.style.transform = ''; imgB.style.transform = '';
      stage.classList.add('zoomed');
      zone.setAttribute('aria-hidden', 'false');
      setPhoto(0);
      startAuto();
      flash.classList.remove('on');
      back.focus();
    }, FLASH_MS);
  }

  /* ---- VIAJE inverso: zona -> mapa ---- */
  function exit() {
    stopAuto();
    flash.classList.add('on');
    setTimeout(function () {
      stage.classList.remove('zoomed');
      zone.setAttribute('aria-hidden', 'true');
      flash.classList.remove('on');
      var hs = map.querySelector('[data-zone="' + state.zone + '"]');
      if (hs) hs.focus();
      state.zone = null;
    }, FLASH_MS);
  }

  /* ---- wiring ---- */
  map.querySelectorAll('.rl-hotspot').forEach(function (b) {
    b.addEventListener('click', function () { enter(b.getAttribute('data-zone')); });
  });
  back.addEventListener('click', exit);
  prev.addEventListener('click', function () { stopAuto(); setPhoto(state.idx - 1); startAuto(); });
  next.addEventListener('click', function () { stopAuto(); setPhoto(state.idx + 1); startAuto(); });

  document.addEventListener('keydown', function (e) {
    if (!stage.classList.contains('zoomed')) return;
    if (e.key === 'Escape') exit();
    else if (e.key === 'ArrowRight') { stopAuto(); setPhoto(state.idx + 1); startAuto(); }
    else if (e.key === 'ArrowLeft')  { stopAuto(); setPhoto(state.idx - 1); startAuto(); }
  });

  /* swipe en móvil */
  var sx = 0;
  zone.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  zone.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50 && state.photos.length > 1) {
      stopAuto(); setPhoto(state.idx + (dx < 0 ? 1 : -1)); startAuto();
    }
  }, { passive: true });

  /* pausar autoplay si la pestaña se oculta */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopAuto(); else if (stage.classList.contains('zoomed')) startAuto();
  });
})();
