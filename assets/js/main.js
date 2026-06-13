/* CASADUCHO v2 — main.js (vanilla, sin dependencias) */
(function () {
  'use strict';

  /* ---------- Nav scroll shadow ---------- */
  var nav = document.querySelector('.nav');
  if (nav) {
    addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', scrollY > 8);
    }, { passive: true });
  }

  /* ---------- Mobile menu ---------- */
  var burger = document.querySelector('.nav-burger');
  var mobileMenu = document.querySelector('.mobile-menu');
  if (burger && mobileMenu) {
    burger.addEventListener('click', function () {
      mobileMenu.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
    var closeMenu = function () {
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    };
    mobileMenu.querySelector('.mobile-menu-close').addEventListener('click', closeMenu);
    mobileMenu.querySelectorAll('nav a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
  }

  /* ---------- Bottom bar: esconder al bajar, mostrar al subir ---------- */
  var bar = document.querySelector('.bottombar');
  if (bar) {
    var lastY = scrollY, barHidden = false;
    addEventListener('scroll', function () {
      var y = scrollY;
      if (y > lastY + 24 && y > 320 && !barHidden) { bar.classList.add('hidden'); barHidden = true; lastY = y; }
      else if (y < lastY - 16 && barHidden) { bar.classList.remove('hidden'); barHidden = false; lastY = y; }
      else if ((y > lastY) !== (y > lastY - 1)) { lastY = y; }
      if (Math.abs(y - lastY) > 80) lastY = y;
    }, { passive: true });
  }

  /* ---------- Estado abierto/cerrado — fuente única compartida (Dom–Jue 11:30–23:00, Vie–Sáb 11:30–24:00) ---------- */
  function computeOpen() {
    var now = new Date();
    var day = now.getDay(); // 0=Dom ... 6=Sáb
    var mins = now.getHours() * 60 + now.getMinutes();
    var open = 11 * 60 + 30;
    var close = (day === 5 || day === 6) ? 24 * 60 : 23 * 60;
    var isOpen = mins >= open && mins < close;
    var fmt = function (m) {
      var h = Math.floor(m / 60) % 24, mm = m % 60;
      var ap = h >= 12 ? 'PM' : 'AM';
      var h12 = h % 12 === 0 ? 12 : h % 12;
      return h12 + (mm ? ':' + String(mm).padStart(2, '0') : ':00') + ' ' + ap;
    };
    return {
      isOpen: isOpen,
      full: isOpen ? 'Abierto ahora · cierra ' + fmt(close)
                   : 'Cerrado ahora · abre ' + (mins >= close ? 'mañana ' : '') + fmt(open),
      short: isOpen ? 'Abierto' : 'Cerrado'
    };
  }
  var st = computeOpen();
  var chip = document.querySelector('.open-chip');
  if (chip) {
    var label = chip.querySelector('.open-label');
    if (label) label.textContent = st.full;
    if (!st.isOpen) chip.classList.add('closed');
  }
  var bbStatus = document.querySelector('.bb-status');
  if (bbStatus) {
    var bl = bbStatus.querySelector('.bb-status-label');
    if (bl) bl.textContent = st.short;
    if (!st.isOpen) bbStatus.classList.add('closed');
  }

  /* ---------- Promo de HOY ---------- */
  // data-days="2" (martes) | "4" (jueves) | "1,2,3,4,5" (L-V)
  var today = new Date().getDay();
  document.querySelectorAll('.promo-card[data-days]').forEach(function (card) {
    var days = card.getAttribute('data-days').split(',').map(Number);
    if (days.indexOf(today) !== -1) {
      card.classList.add('today');
      var b = document.createElement('span');
      b.className = 'today-badge';
      b.textContent = 'ES HOY';
      card.appendChild(b);
    }
  });

  /* ---------- Carrusel "¿Qué se te antoja hoy?" — todos los platos ---------- */
  var strip = document.getElementById('dishes-strip');
  if (strip && window.CASADUCHO_CAROUSEL) {
    var html = '';
    window.CASADUCHO_CAROUSEL.forEach(function (d) {
      var price = d.p ? 'RD$ ' + d.p.toLocaleString('en-US') : '';
      html += '<a class="dish-card reveal in" href="' + d.u + '" style="--dc:' + d.cc + '">' +
        '<img src="' + d.photo + '" alt="' + d.n.replace(/"/g, '') + '" loading="lazy" width="460" height="345">' +
        '<div class="dish-info"><span class="dish-concept">' + d.c + '</span><strong>' + d.n + '</strong>' +
        '<span class="price">' + price + '</span></div></a>';
    });
    strip.innerHTML = html;
  }

  /* ---------- Cinemagraphs: reproducir solo en viewport ---------- */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cines = document.querySelectorAll('video.cinemagraph');
  if (reduceMotion) {
    cines.forEach(function (v) { v.removeAttribute('autoplay'); try { v.pause(); } catch (e) {} });
  } else if (cines.length && 'IntersectionObserver' in window) {
    var conn = navigator.connection || {};
    var lowData = conn.saveData || /(^|-)2g/.test(conn.effectiveType || '');
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (lowData) return; // en ahorro de datos: queda el poster, no se baja el video
          if (v.preload === 'none') v.preload = 'auto';
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else { try { v.pause(); } catch (err) {} }
      });
    }, { threshold: 0.25 });
    cines.forEach(function (v) { vio.observe(v); });
  }

  /* ---------- Reveal on scroll ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Order sheet (2 pasos: cocina → canal) ---------- */
  var DELIVERY = window.CASADUCHO_DELIVERY || null;
  var sheet = document.getElementById('order-sheet');
  if (sheet && DELIVERY) {
    var step1 = sheet.querySelector('[data-step="1"]');
    var step2 = sheet.querySelector('[data-step="2"]');
    var chTitle = step2.querySelector('.sheet-concept-name');
    var chWrap = step2.querySelector('.sheet-channels');

    var CONCEPT_NAMES = {
      wagmi: 'WAGMI', cantina: 'Cantina La Cuadra', pecora: 'La Pécora',
      hokkaido: 'Hokkaido', bar: 'EL BAR', general: 'Todo el mercado'
    };

    var stepMesa = sheet.querySelector('[data-step="mesa"]');
    var openSheet = function (conceptId, mode) {
      if (mode === 'mesa') { showMesa(); }
      else if (conceptId) { showChannels(conceptId); }
      else { showStep1(); }
      if (typeof sheet.showModal === 'function') { if (!sheet.open) sheet.showModal(); }
      else sheet.setAttribute('open', '');
    };
    var clearSteps = function () {
      step1.classList.remove('active'); step2.classList.remove('active');
      if (stepMesa) stepMesa.classList.remove('active');
    };
    var showStep1 = function () { clearSteps(); step1.classList.add('active'); };
    var showMesa = function () { clearSteps(); if (stepMesa) stepMesa.classList.add('active'); };
    var showChannels = function (id) {
      var c = DELIVERY.conceptos[id];
      if (!c) return;
      chTitle.textContent = CONCEPT_NAMES[id] || id;
      chWrap.innerHTML = '';
      if (c.pedidosya && c.pedidosya.activo && c.pedidosya.url) {
        chWrap.insertAdjacentHTML('beforeend',
          '<a class="sheet-channel pya" href="' + c.pedidosya.url + '" target="_blank" rel="noopener noreferrer"><span>PedidosYa</span><span>→</span></a>');
      }
      if (c.ubereats && c.ubereats.activo && c.ubereats.url) {
        chWrap.insertAdjacentHTML('beforeend',
          '<a class="sheet-channel ue" href="' + c.ubereats.url + '" target="_blank" rel="noopener noreferrer"><span>Uber Eats</span><span>→</span></a>');
      }
      if (c.whatsapp && c.whatsapp.activo) {
        var name = CONCEPT_NAMES[id] || 'Casaducho';
        var txt = encodeURIComponent('¡Hola! Quiero ordenar de ' + name);
        chWrap.insertAdjacentHTML('beforeend',
          '<a class="sheet-channel wa" href="https://wa.me/' + DELIVERY.whatsapp.pidebot + '?text=' + txt + '" target="_blank" rel="noopener noreferrer"><span>WhatsApp · PideBot</span><span>→</span></a>');
      }
      clearSteps(); step2.classList.add('active');
      /* GA4: gtag('event','order_sheet_open',{concept:id}) — activar cuando haya GA */
    };

    document.querySelectorAll('[data-order]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        openSheet(el.getAttribute('data-order') || null, el.getAttribute('data-order-mode') || null);
      });
    });
    step1.querySelectorAll('.sheet-concept').forEach(function (b) {
      b.addEventListener('click', function () { showChannels(b.getAttribute('data-concept')); });
    });
    sheet.querySelectorAll('.sheet-back').forEach(function (b) {
      b.addEventListener('click', showStep1);
    });
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) sheet.close ? sheet.close() : sheet.removeAttribute('open');
    });
    /* QR físico: casaducho.com/?mesa=N → abre modo mesa directo */
    try {
      if (new URLSearchParams(location.search).get('mesa')) openSheet(null, 'mesa');
    } catch (e) {}
  }

  /* ===================== AUTO-GLIDE / SWIPE CUE — carruseles vivos ===================== */
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setupGlide(track, opts) {
    if (!track) return;
    opts = opts || {};
    var section = track.closest('section');
    var SPEED = opts.speed || 22;
    var RESUME_MS = 2500;
    function updateEdges() {
      if (!section) return;
      var max = track.scrollWidth - track.clientWidth;
      section.classList.toggle('edge-l', track.scrollLeft > 4);
      section.classList.toggle('edge-r', track.scrollLeft < max - 4);
    }
    track.addEventListener('scroll', updateEdges, { passive: true });
    updateEdges();
    function isScroller() {
      return getComputedStyle(track).overflowX !== 'visible' && track.scrollWidth > track.clientWidth + 8;
    }
    if (prefersReduced || !isScroller()) return;
    var originalWidth = 0;
    (function buildLoop() {
      if (track.dataset.looped === '1') return;
      var kids = Array.prototype.slice.call(track.children);
      originalWidth = 0;
      kids.forEach(function (k) { originalWidth += k.getBoundingClientRect().width; });
      var styles = getComputedStyle(track);
      var gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
      originalWidth += gap * kids.length;
      kids.forEach(function (k) { var c = k.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; track.appendChild(c); });
      track.dataset.looped = '1';
    })();
    var paused = false, resumeTimer = null, last = 0;
    function pause() { paused = true; track.classList.remove('gliding'); }
    function scheduleResume() { clearTimeout(resumeTimer); resumeTimer = setTimeout(function () { paused = false; track.classList.add('gliding'); }, RESUME_MS); }
    function bump() { pause(); scheduleResume(); }
    track.addEventListener('mouseenter', pause);
    track.addEventListener('mouseleave', scheduleResume);
    track.addEventListener('focusin', pause);
    track.addEventListener('focusout', scheduleResume);
    ['touchstart', 'pointerdown', 'wheel'].forEach(function (ev) { track.addEventListener(ev, bump, { passive: true }); });
    ['touchend', 'pointerup'].forEach(function (ev) { track.addEventListener(ev, scheduleResume, { passive: true }); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else scheduleResume(); });
    var inView = true;
    if ('IntersectionObserver' in window) { new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }, { threshold: 0.01 }).observe(track); }
    function step(t) {
      if (!last) last = t;
      var dt = (t - last) / 1000; last = t;
      if (!paused && inView && originalWidth > 0) {
        track.scrollLeft += SPEED * dt;
        if (track.scrollLeft >= originalWidth) track.scrollLeft -= originalWidth;
        updateEdges();
      }
      requestAnimationFrame(step);
    }
    track.classList.add('gliding');
    requestAnimationFrame(step);
  }

  function setupCue(track) {
    if (!track) return;
    var section = track.closest('section');
    if (!section) return;
    var cue = section.querySelector('.strip-cue');
    if (!cue) {
      cue = document.createElement('div');
      cue.className = 'strip-cue'; cue.setAttribute('aria-hidden', 'true');
      cue.innerHTML = '<span>Desliza</span><span class="strip-cue-arrow">→</span>';
      track.parentNode.insertBefore(cue, track.nextSibling);
    }
    var hide = function () { cue.classList.add('gone'); };
    ['touchstart', 'pointerdown', 'wheel'].forEach(function (ev) { track.addEventListener(ev, hide, { passive: true, once: true }); });
    track.addEventListener('scroll', function () { if (track.scrollLeft > 12) hide(); }, { passive: true });
  }

  (function initGlides() {
    var dishes = document.getElementById('dishes-strip');
    var concepts = document.querySelector('.concepts-grid');
    setupCue(dishes);
    setupGlide(dishes, { speed: 22 });
    setupGlide(concepts, { speed: 18 });
  })();
})();
