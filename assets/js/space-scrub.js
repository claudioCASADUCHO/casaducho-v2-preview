/* CASADUCHO — scroll-cinematic del espacio físico.
   Desktop ancho: frame-scrub en <canvas> (premium, suave).
   Mobile / save-data / reduced-motion: video loop liviano (sin precargar 120 frames).
   Sección esperada:
   <section class="cine-space" data-frames="121" data-path="assets/scroll/space/f_">
     <div class="cine-sticky">
       <canvas></canvas>
       <video class="cine-video" muted loop playsinline preload="none" poster="...">...</video>
       <div class="cine-overlay">...<span class="cine-line" data-in=".." data-out="..">...</span>...</div>
     </div>
   </section> */
(function () {
  'use strict';
  var sec = document.querySelector('.cine-space');
  if (!sec) return;

  var sticky = sec.querySelector('.cine-sticky');
  var canvas = sec.querySelector('canvas');
  var video = sec.querySelector('.cine-video');
  var lines = [].slice.call(sec.querySelectorAll('.cine-line'));
  var frameCount = parseInt(sec.getAttribute('data-frames'), 10) || 0;
  var base = sec.getAttribute('data-path') || '';
  var bg = sec.getAttribute('data-bg') || '#120b08';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  var lightMode = reduce || saveData || (window.matchMedia && window.matchMedia('(max-width: 820px)').matches);

  function framePath(i) { return base + String(i).padStart(4, '0') + '.jpg'; }

  /* ---- overlay copy fade (común a ambos modos) ---- */
  function updateLines(p) {
    for (var k = 0; k < lines.length; k++) {
      var el = lines[k];
      var a = parseFloat(el.dataset.in), b = parseFloat(el.dataset.out);
      var mid = (a + b) / 2, half = (b - a) / 2 || 0.001;
      var o = 1 - Math.abs(p - mid) / half;
      o = Math.max(0, Math.min(1, o));
      el.style.opacity = o.toFixed(3);
      el.style.transform = 'translateY(' + ((1 - o) * 24).toFixed(1) + 'px)';
    }
  }
  function progress() {
    var rect = sec.getBoundingClientRect();
    var scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return 0;
    return Math.min(Math.max(-rect.top / scrollable, 0), 1);
  }

  if (lightMode) {
    /* ---------- MOBILE: video liviano, sin canvas ---------- */
    if (canvas) canvas.remove();
    if (video) {
      video.preload = 'metadata';
      if ('IntersectionObserver' in window) {
        var vio = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) { video.preload = 'auto'; var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); }
            else { try { video.pause(); } catch (x) {} }
          });
        }, { threshold: 0.2 });
        vio.observe(sec);
      }
    }
    var tickingM = false;
    addEventListener('scroll', function () {
      if (tickingM) return; tickingM = true;
      requestAnimationFrame(function () { updateLines(progress()); tickingM = false; });
    }, { passive: true });
    updateLines(0);
    return;
  }

  /* ---------- DESKTOP: frame-scrub en canvas ---------- */
  if (video) video.remove();
  var ctx = canvas.getContext('2d', { alpha: false });
  var images = new Array(frameCount);
  var current = -1, firstDrawn = false;

  function draw(index) {
    var img = images[index];
    if (!img || !img.complete || !img.naturalWidth) return;
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    var ir = img.naturalWidth / img.naturalHeight, cr = cw / ch, dw, dh, dx, dy;
    if (ir > cr) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
    else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(current < 0 ? 0 : current);
  }
  /* precargar frames sólo cuando la sección se acerca (no en load) */
  var loaded = false;
  function preload() {
    if (loaded) return; loaded = true;
    for (var i = 0; i < frameCount; i++) {
      var img = new Image();
      img.src = framePath(i + 1);
      if (i === 0) img.onload = function () { if (!firstDrawn) { firstDrawn = true; draw(0); } };
      images[i] = img;
    }
  }
  if ('IntersectionObserver' in window) {
    var pio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { preload(); pio.disconnect(); } });
    }, { rootMargin: '1200px 0px' });
    pio.observe(sec);
  } else { preload(); }

  function update() {
    var p = progress();
    var idx = Math.min(frameCount - 1, Math.max(0, Math.floor(p * (frameCount - 1))));
    if (idx !== current) { current = idx; draw(idx); }
    updateLines(p);
  }
  var ticking = false;
  addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { update(); ticking = false; });
  }, { passive: true });
  addEventListener('resize', resize);
  resize(); update();
})();
