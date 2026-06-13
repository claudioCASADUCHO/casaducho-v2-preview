/* ==========================================================================
   Pano360 — Visor 360 equirectangular WebGL vanilla — CASADUCHO
   Sin dependencias. Self-hosted. Shaders inline. Esfera por código.
   Contrato: window.Pano360 = { open, close }
   open({ image, label, onClose?, fallbackImage? })
   Diseño: crema #fff3de, verde #006838, rosa #ec008c (CTAs).
   Foco: mapeo esférico correcto (UV explícito), gestos sólidos, degradación
   impecable, cleanup total (cero leaks, cero pantalla en blanco).
   ========================================================================== */
(function () {
  'use strict';

  if (window.Pano360 && window.Pano360.__casaducho) return;

  var ACTIVE = null;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  var REDUCED_MOTION = false;
  try {
    REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { REDUCED_MOTION = false; }

  // Detección de WebGL sin dejar contexto residual.
  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      var ok = !!(gl && gl.getShaderPrecisionFormat);
      if (gl) {
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) { try { lose.loseContext(); } catch (e2) {} }
      }
      return ok;
    } catch (e) { return false; }
  }

  // ----- Estilos (una vez) ---------------------------------------------------
  var STYLE_ID = 'pano360-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = '' +
      '.p360-root{position:fixed;inset:0;z-index:2147483000;background:#fff3de;' +
        'opacity:0;transition:opacity .42s cubic-bezier(.22,.61,.36,1);' +
        'touch-action:none;-webkit-user-select:none;user-select:none;overflow:hidden;' +
        '-webkit-tap-highlight-color:transparent;contain:strict;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}' +
      '.p360-root.p360-in{opacity:1;}' +
      '.p360-root *{box-sizing:border-box;}' +
      '.p360-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;' +
        'cursor:grab;touch-action:none;background:#fff3de;}' +
      '.p360-canvas.p360-grabbing{cursor:grabbing;}' +
      // Fallback plano
      '.p360-flat{position:absolute;inset:0;overflow:hidden;background:#fff3de;}' +
      '.p360-flat-img{position:absolute;top:50%;left:50%;height:118%;width:auto;min-width:118%;' +
        'will-change:transform;transform:translate3d(-50%,-50%,0);' +
        'animation:p360pan 28s ease-in-out infinite alternate;}' +
      '@keyframes p360pan{from{transform:translate3d(-58%,-50%,0) scale(1.04);}' +
        'to{transform:translate3d(-42%,-50%,0) scale(1.04);}}' +
      // Vignette cálida
      '.p360-vignette{position:absolute;inset:0;pointer-events:none;' +
        'background:radial-gradient(120% 90% at 50% 42%,rgba(0,0,0,0) 52%,rgba(20,8,0,.30) 100%);}' +
      // Botón cerrar (CTA rosa)
      '.p360-close{position:absolute;top:max(16px,env(safe-area-inset-top));' +
        'right:max(16px,env(safe-area-inset-right));width:46px;height:46px;border:none;' +
        'border-radius:50%;background:#ec008c;color:#fff;cursor:pointer;z-index:6;' +
        'display:flex;align-items:center;justify-content:center;padding:0;' +
        '-webkit-appearance:none;appearance:none;' +
        'box-shadow:0 6px 22px rgba(236,0,140,.40),0 2px 6px rgba(0,0,0,.18);' +
        'transition:transform .18s ease,box-shadow .18s ease,background .18s ease;' +
        '-webkit-tap-highlight-color:transparent;}' +
      '.p360-close:hover{transform:scale(1.06);background:#ff1aa0;}' +
      '.p360-close:active{transform:scale(.94);}' +
      '.p360-close svg{width:20px;height:20px;display:block;}' +
      // Label inferior
      '.p360-label{position:absolute;left:50%;transform:translateX(-50%);' +
        'bottom:max(22px,calc(env(safe-area-inset-bottom) + 14px));z-index:5;' +
        'text-align:center;pointer-events:none;max-width:86%;padding:0 16px;}' +
      '.p360-kicker{font-family:"Druk Wide","Bricolage",-apple-system,sans-serif;' +
        'font-weight:700;text-transform:uppercase;letter-spacing:.22em;font-size:10px;' +
        'color:#006838;opacity:.95;margin:0 0 5px;line-height:1;' +
        'text-shadow:0 1px 0 rgba(255,243,222,.85);}' +
      '.p360-title{font-family:"Bricolage","Bricolage Grotesque",-apple-system,sans-serif;' +
        'font-weight:700;font-size:clamp(19px,5.4vw,26px);color:#1a0f06;margin:0;' +
        'line-height:1.05;letter-spacing:-.01em;text-shadow:0 1px 8px rgba(255,243,222,.7);}' +
      // Hint "arrastra para mirar"
      '.p360-hint{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;' +
        'display:flex;flex-direction:column;align-items:center;gap:12px;pointer-events:none;' +
        'transition:opacity .6s ease;opacity:1;}' +
      '.p360-hint.p360-faded{opacity:0;}' +
      '.p360-hand{width:54px;height:54px;border-radius:50%;background:rgba(255,243,222,.86);' +
        'display:flex;align-items:center;justify-content:center;' +
        'box-shadow:0 8px 26px rgba(20,8,0,.22);animation:p360sway 2.6s ease-in-out infinite;}' +
      '.p360-hand svg{width:26px;height:26px;color:#006838;display:block;}' +
      '@keyframes p360sway{0%,100%{transform:translateX(-9px);}50%{transform:translateX(9px);}}' +
      '.p360-hint-text{font-family:"Druk Wide","Bricolage",-apple-system,sans-serif;' +
        'font-weight:700;text-transform:uppercase;letter-spacing:.2em;font-size:10.5px;' +
        'color:#1a0f06;background:rgba(255,243,222,.78);padding:7px 14px;border-radius:999px;' +
        'box-shadow:0 4px 16px rgba(20,8,0,.14);}' +
      // Badge "360 próximamente"
      '.p360-badge{position:absolute;top:max(18px,env(safe-area-inset-top));' +
        'left:max(16px,env(safe-area-inset-left));z-index:5;' +
        'font-family:"Druk Wide","Bricolage",-apple-system,sans-serif;font-weight:700;' +
        'text-transform:uppercase;letter-spacing:.16em;font-size:10px;color:#fff3de;' +
        'background:#006838;padding:8px 13px;border-radius:999px;' +
        'box-shadow:0 4px 16px rgba(0,104,56,.34);}' +
      // Loader
      '.p360-loader{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;' +
        'display:flex;flex-direction:column;align-items:center;gap:16px;transition:opacity .4s ease;}' +
      '.p360-loader.p360-gone{opacity:0;pointer-events:none;}' +
      '.p360-ring{width:42px;height:42px;border-radius:50%;border:3px solid rgba(0,104,56,.18);' +
        'border-top-color:#006838;animation:p360spin .9s linear infinite;}' +
      '@keyframes p360spin{to{transform:rotate(360deg);}}' +
      '.p360-loading-text{font-family:"Druk Wide","Bricolage",-apple-system,sans-serif;' +
        'font-weight:700;text-transform:uppercase;letter-spacing:.2em;font-size:10px;color:#006838;}' +
      '@media (prefers-reduced-motion: reduce){' +
        '.p360-flat-img{animation:none!important;}' +
        '.p360-hand{animation:none!important;}' +
        '.p360-root{transition:none!important;}}';
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(s);
  }

  // ----- SVG -----------------------------------------------------------------
  function svgClose() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  }
  function svgHand() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 12h14"/><path d="M9 8l-4 4 4 4"/><path d="M15 8l4 4-4 4"/></svg>';
  }

  // ----- Shaders inline ------------------------------------------------------
  var VS_SRC =
    'attribute vec3 aPos;' +
    'attribute vec2 aUV;' +
    'uniform mat4 uProj;' +
    'uniform mat4 uView;' +
    'varying vec2 vUV;' +
    'void main(){vUV=aUV;gl_Position=uProj*uView*vec4(aPos,1.0);}';
  var FS_SRC =
    'precision mediump float;' +
    'varying vec2 vUV;' +
    'uniform sampler2D uTex;' +
    'void main(){gl_FragColor=texture2D(uTex,vUV);}';

  // ----- Matrices ------------------------------------------------------------
  function mat4Perspective(out, fovyRad, aspect, near, far) {
    var f = 1.0 / Math.tan(fovyRad / 2);
    var nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = (2 * far * near) * nf; out[15] = 0;
    return out;
  }
  // Vista desde el centro: R = Rx(pitch) * Ry(yaw), sin traslación (column-major).
  function mat4View(out, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    out[0] = cy;  out[1] = sy * sp;  out[2] = -sy * cp; out[3] = 0;
    out[4] = 0;   out[5] = cp;       out[6] = sp;       out[7] = 0;
    out[8] = sy;  out[9] = -cy * sp; out[10] = cy * cp; out[11] = 0;
    out[12] = 0;  out[13] = 0;       out[14] = 0;       out[15] = 1;
    return out;
  }

  function isPow2(n) { return (n & (n - 1)) === 0; }

  // ==========================================================================
  //  VIEWER
  // ==========================================================================
  function Viewer(opts) {
    opts = opts || {};
    this.opts = opts;
    this.image = (opts.image || '').toString();
    this.fallbackImage = (opts.fallbackImage || '').toString();
    this.label = (opts.label || '').toString();
    this.onClose = (typeof opts.onClose === 'function') ? opts.onClose : null;

    this.destroyed = false;
    this.raf = 0;
    this.gl = null;
    this.glProgram = null;
    this.glBuffers = null;
    this.glTexture = null;
    this.glLoseExt = null;
    this.loc = null;
    this.indexCount = 0;

    // Cámara
    this.yaw = 0;
    this.pitch = 0;
    this.fov = 75;
    this.targetFov = 75;

    // Interacción / inercia
    this.dragging = false;
    this.pointers = {};
    this.lastX = 0;
    this.lastY = 0;
    this.velYaw = 0;
    this.velPitch = 0;
    this.lastMoveT = 0;
    this.pinchDist = 0;
    this.userInteracted = false;
    this.autoRotate = !REDUCED_MOTION;
    this.lastFrameT = now();
    this.aspect = 1;

    this._listeners = [];
    this._imgEls = [];

    this.root = null;
    this.canvas = null;
    this.loader = null;
    this.hint = null;

    this._proj = new Float32Array(16);
    this._view = new Float32Array(16);

    this._prevHtmlOverflow = '';
    this._prevBodyOverflow = '';

    this._bound = {
      pointerdown: this._onPointerDown.bind(this),
      pointermove: this._onPointerMove.bind(this),
      pointerup: this._onPointerUp.bind(this),
      pointercancel: this._onPointerUp.bind(this),
      wheel: this._onWheel.bind(this),
      keydown: this._onKeyDown.bind(this),
      resize: this._onResize.bind(this),
      ctxlost: this._onContextLost.bind(this),
      ctxrestored: this._onContextRestored.bind(this),
      tick: this._tick.bind(this),
      gesturestart: function (e) { if (e && e.preventDefault) e.preventDefault(); },
      touchstart: this._onTouchStart.bind(this),
      touchmove: this._onTouchMove.bind(this),
      touchend: this._onTouchEnd.bind(this),
      closeClick: this._onCloseClick.bind(this)
    };
  }

  Viewer.prototype._on = function (target, type, fn, opt) {
    if (!target) return;
    target.addEventListener(type, fn, opt);
    this._listeners.push({ target: target, type: type, fn: fn, opt: opt });
  };

  Viewer.prototype._removeAllListeners = function () {
    for (var i = 0; i < this._listeners.length; i++) {
      var L = this._listeners[i];
      try { L.target.removeEventListener(L.type, L.fn, L.opt); } catch (e) {}
    }
    this._listeners.length = 0;
  };

  // ----- DOM -----------------------------------------------------------------
  Viewer.prototype.build = function () {
    injectStyles();

    var root = document.createElement('div');
    root.className = 'p360-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', this.label ? ('Vista 360: ' + this.label) : 'Vista 360');
    this.root = root;

    var loader = document.createElement('div');
    loader.className = 'p360-loader';
    loader.innerHTML = '<div class="p360-ring"></div>' +
      '<div class="p360-loading-text">Cargando vista</div>';
    this.loader = loader;
    root.appendChild(loader);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'p360-close';
    btn.setAttribute('aria-label', 'Cerrar vista 360');
    btn.innerHTML = svgClose();
    this._on(btn, 'click', this._bound.closeClick);
    root.appendChild(btn);

    if (this.label) {
      var lab = document.createElement('div');
      lab.className = 'p360-label';
      lab.innerHTML = '<p class="p360-kicker">Tu vista desde</p><h2 class="p360-title"></h2>';
      lab.querySelector('.p360-title').textContent = this.label;
      root.appendChild(lab);
    }

    document.body.appendChild(root);

    // Bloquear scroll del fondo (evita atrapar/perder scroll de la página).
    this._prevHtmlOverflow = document.documentElement.style.overflow;
    this._prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    // Escape global.
    this._on(document, 'keydown', this._bound.keydown);
    // iOS Safari: matar pinch-zoom de página.
    this._on(root, 'gesturestart', this._bound.gesturestart, { passive: false });

    var self = this;
    requestAnimationFrame(function () {
      if (!self.destroyed && self.root) self.root.classList.add('p360-in');
    });
  };

  Viewer.prototype._onCloseClick = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    this.close();
  };

  // ----- Decisión WebGL / fallback ------------------------------------------
  Viewer.prototype.start = function () {
    var self = this;
    if (!this.image || !hasWebGL()) { this._startFlatFallback(); return; }

    this._loadImage(this.image, function (img) {
      if (self.destroyed) return;
      try {
        self._initGL(img);
        self._addInteraction();
        self._hideLoader();
        self._startLoop();
      } catch (e) {
        self._teardownGL();
        self._startFlatFallback();
      }
    }, function () {
      if (self.destroyed) return;
      self._startFlatFallback();
    });
  };

  Viewer.prototype._loadImage = function (url, onOk, onErr) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    var done = false;
    var self = this;
    var clean = function () {
      img.onload = null; img.onerror = null;
      var idx = self._imgEls.indexOf(img);
      if (idx >= 0) self._imgEls.splice(idx, 1);
    };
    img.onload = function () {
      if (done) return; done = true; clean();
      if (!img.naturalWidth || !img.naturalHeight) { if (onErr) onErr(); return; }
      if (onOk) onOk(img);
    };
    img.onerror = function () {
      if (done) return; done = true; clean();
      if (onErr) onErr();
    };
    this._imgEls.push(img);
    try { img.src = url; }
    catch (e) { if (!done) { done = true; clean(); if (onErr) onErr(); } }
    if (img.complete && img.naturalWidth) {
      if (!done) { done = true; clean(); if (onOk) onOk(img); }
    }
  };

  // ----- FALLBACK PLANO ------------------------------------------------------
  Viewer.prototype._startFlatFallback = function () {
    if (this.destroyed) return;
    var self = this;
    var src = this.fallbackImage || this.image;

    var badge = document.createElement('div');
    badge.className = 'p360-badge';
    badge.textContent = '360 próximamente';

    if (!src) {
      this._hideLoader();
      var vg0 = document.createElement('div');
      vg0.className = 'p360-vignette';
      this.root.insertBefore(vg0, this.root.firstChild);
      this.root.appendChild(badge);
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'p360-flat';
    var img = document.createElement('img');
    img.className = 'p360-flat-img';
    img.alt = this.label || 'Casaducho';
    img.decoding = 'async';
    img.draggable = false;

    this._loadImage(src, function (loaded) {
      if (self.destroyed) return;
      img.src = loaded.src;
      wrap.appendChild(img);
      var vg = document.createElement('div'); vg.className = 'p360-vignette';
      self.root.insertBefore(wrap, self.root.firstChild);
      self.root.appendChild(vg);
      self.root.appendChild(badge);
      self._hideLoader();
    }, function () {
      if (self.destroyed) return;
      self._hideLoader();
      var vg2 = document.createElement('div'); vg2.className = 'p360-vignette';
      self.root.insertBefore(vg2, self.root.firstChild);
      self.root.appendChild(badge);
    });
  };

  // ----- WebGL init ----------------------------------------------------------
  Viewer.prototype._initGL = function (img) {
    var canvas = document.createElement('canvas');
    canvas.className = 'p360-canvas';
    this.canvas = canvas;
    this.root.insertBefore(canvas, this.root.firstChild);

    var attrs = { alpha: false, antialias: true, depth: true, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false };
    var gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (!gl) throw new Error('no-webgl-context');
    this.gl = gl;
    this.glLoseExt = gl.getExtension('WEBGL_lose_context') || null;

    this._on(canvas, 'webglcontextlost', this._bound.ctxlost, false);
    this._on(canvas, 'webglcontextrestored', this._bound.ctxrestored, false);

    this._buildGLResources(gl, img);

    gl.clearColor(1, 0.953, 0.871, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK); // vemos la cara interior de la esfera

    this._resizeCanvas();
  };

  // Reconstruye programa + geometría + textura (también usado en context-restore).
  Viewer.prototype._buildGLResources = function (gl, img) {
    var prog = this._buildProgram(gl, VS_SRC, FS_SRC);
    this.glProgram = prog;
    gl.useProgram(prog);
    this.loc = {
      aPos: gl.getAttribLocation(prog, 'aPos'),
      aUV: gl.getAttribLocation(prog, 'aUV'),
      uProj: gl.getUniformLocation(prog, 'uProj'),
      uView: gl.getUniformLocation(prog, 'uView'),
      uTex: gl.getUniformLocation(prog, 'uTex')
    };
    this._buildSphere(gl);
    this._uploadTexture(gl, img);
  };

  Viewer.prototype._buildProgram = function (gl, vsSrc, fsSrc) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        var log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error('shader-compile: ' + log);
      }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, vsSrc);
    var fs = sh(gl.FRAGMENT_SHADER, fsSrc);
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      var plog = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('program-link: ' + plog);
    }
    return p;
  };

  // Esfera UV por código. UV explícito = mapeo equirectangular exacto, sin
  // espejado ni artefactos en los polos.
  Viewer.prototype._buildSphere = function (gl) {
    var SEG = 64, RING = 48, R = 50;
    var pos = [], uv = [], idx = [];
    for (var y = 0; y <= RING; y++) {
      var v = y / RING;
      var theta = v * Math.PI;          // 0..PI (polo a polo)
      var sinT = Math.sin(theta), cosT = Math.cos(theta);
      for (var x = 0; x <= SEG; x++) {
        var u = x / SEG;
        var phi = u * 2 * Math.PI;       // 0..2PI
        var sinP = Math.sin(phi), cosP = Math.cos(phi);
        pos.push(R * sinT * cosP, R * cosT, R * sinT * sinP);
        // U invertido: panorama no sale espejado visto desde adentro.
        uv.push(u, v);
      }
    }
    var rowLen = SEG + 1;
    for (var yy = 0; yy < RING; yy++) {
      for (var xx = 0; xx < SEG; xx++) {
        var a = yy * rowLen + xx;
        var b = a + rowLen;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    this.indexCount = idx.length;

    var posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);

    var uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);

    var idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

    this.glBuffers = { pos: posBuf, uv: uvBuf, idx: idxBuf };
  };

  Viewer.prototype._uploadTexture = function (gl, img) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    var maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    var src = img;
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (w > maxSize || h > maxSize) {
      var scale = Math.min(maxSize / w, maxSize / h);
      var cw = Math.max(1, Math.floor(w * scale));
      var ch = Math.max(1, Math.floor(h * scale));
      try {
        var off = document.createElement('canvas');
        off.width = cw; off.height = ch;
        off.getContext('2d').drawImage(img, 0, 0, cw, ch);
        src = off; w = cw; h = ch;
      } catch (e) { src = img; }
    }

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);

    if (isPow2(w) && isPow2(h)) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.glTexture = tex;
  };

  // ----- Render loop ---------------------------------------------------------
  Viewer.prototype._startLoop = function () {
    this.lastFrameT = now();
    this.raf = requestAnimationFrame(this._bound.tick);
  };

  Viewer.prototype._tick = function () {
    if (this.destroyed || !this.gl) return;
    var gl = this.gl;

    if (gl.isContextLost && gl.isContextLost()) {
      this.raf = requestAnimationFrame(this._bound.tick);
      return;
    }

    var t = now();
    var dt = Math.min(0.05, (t - this.lastFrameT) / 1000);
    this.lastFrameT = t;

    // Auto-rotación elegante hasta primera interacción.
    if (this.autoRotate && !this.userInteracted) {
      this.yaw += 0.09 * dt; // ~5°/s
    }

    // Inercia al soltar (frame-rate independiente).
    if (!this.dragging) {
      this.yaw += this.velYaw * dt;
      this.pitch += this.velPitch * dt;
      var decay = Math.pow(0.0025, dt);
      this.velYaw *= decay;
      this.velPitch *= decay;
      if (Math.abs(this.velYaw) < 0.0004) this.velYaw = 0;
      if (Math.abs(this.velPitch) < 0.0004) this.velPitch = 0;
    }

    // Easing de FOV (zoom suave).
    this.fov += (this.targetFov - this.fov) * Math.min(1, dt * 10);

    // Clamps.
    var lim = (Math.PI / 2) - (5 * Math.PI / 180); // ~85°
    this.pitch = clamp(this.pitch, -lim, lim);
    var TWO_PI = Math.PI * 2;
    if (this.yaw > TWO_PI) this.yaw -= TWO_PI;
    else if (this.yaw < -TWO_PI) this.yaw += TWO_PI;

    this._renderFrame();
    this.raf = requestAnimationFrame(this._bound.tick);
  };

  Viewer.prototype._renderFrame = function () {
    var gl = this.gl;
    if (!gl || !this.canvas || !this.glProgram || !this.glBuffers) return;
    var w = this.canvas.width, h = this.canvas.height;
    if (!w || !h) return;

    mat4Perspective(this._proj, this.fov * Math.PI / 180, this.aspect || (w / h), 0.1, 100);
    mat4View(this._view, this.yaw, this.pitch);

    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.glProgram);

    gl.uniformMatrix4fv(this.loc.uProj, false, this._proj);
    gl.uniformMatrix4fv(this.loc.uView, false, this._view);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
    gl.uniform1i(this.loc.uTex, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffers.pos);
    gl.enableVertexAttribArray(this.loc.aPos);
    gl.vertexAttribPointer(this.loc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffers.uv);
    gl.enableVertexAttribArray(this.loc.aUV);
    gl.vertexAttribPointer(this.loc.aUV, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.glBuffers.idx);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  };

  // ----- Resize (DPR-aware, cap 2) -------------------------------------------
  Viewer.prototype._resizeCanvas = function () {
    if (!this.canvas || !this.gl) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = this.root.getBoundingClientRect();
    var cw = rect.width || window.innerWidth;
    var ch = rect.height || window.innerHeight;
    var w = Math.max(1, Math.floor(cw * dpr));
    var h = Math.max(1, Math.floor(ch * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.aspect = w / h;
    this.gl.viewport(0, 0, w, h);
  };

  Viewer.prototype._onResize = function () { this._resizeCanvas(); };

  // ----- Interacción ---------------------------------------------------------
  Viewer.prototype._addInteraction = function () {
    var c = this.canvas;
    if (!c) return;

    var hint = document.createElement('div');
    hint.className = 'p360-hint';
    hint.innerHTML = '<div class="p360-hand">' + svgHand() + '</div>' +
      '<div class="p360-hint-text">Arrastra para mirar</div>';
    this.hint = hint;
    this.root.appendChild(hint);

    this._on(window, 'resize', this._bound.resize);
    this._on(window, 'orientationchange', this._bound.resize);
    if (window.visualViewport) this._on(window.visualViewport, 'resize', this._bound.resize);

    if ('PointerEvent' in window) {
      // down en canvas; move/up en window -> el drag no se pierde si el dedo
      // sale del canvas. setPointerCapture refuerza esto.
      this._on(c, 'pointerdown', this._bound.pointerdown);
      this._on(window, 'pointermove', this._bound.pointermove, { passive: false });
      this._on(window, 'pointerup', this._bound.pointerup);
      this._on(window, 'pointercancel', this._bound.pointercancel);
    } else {
      this._on(c, 'touchstart', this._bound.touchstart, { passive: false });
      this._on(c, 'touchmove', this._bound.touchmove, { passive: false });
      this._on(window, 'touchend', this._bound.touchend);
      this._on(window, 'touchcancel', this._bound.touchend);
      this._on(c, 'mousedown', this._bound.pointerdown);
      this._on(window, 'mousemove', this._bound.pointermove);
      this._on(window, 'mouseup', this._bound.pointerup);
    }
    this._on(c, 'wheel', this._bound.wheel, { passive: false });
  };

  Viewer.prototype._markInteracted = function () {
    if (this.userInteracted) return;
    this.userInteracted = true;
    this.autoRotate = false;
    if (this.hint) this.hint.classList.add('p360-faded');
  };

  Viewer.prototype._pointerCount = function () {
    var n = 0;
    for (var k in this.pointers) if (this.pointers.hasOwnProperty(k)) n++;
    return n;
  };

  Viewer.prototype._onPointerDown = function (e) {
    if (this.destroyed) return;
    if (e.pointerType === 'mouse' && e.button !== undefined && e.button !== 0) return;
    this._markInteracted();
    var id = (e.pointerId != null) ? e.pointerId : 'mouse';
    this.pointers[id] = { x: e.clientX, y: e.clientY };
    var n = this._pointerCount();
    if (n === 1) {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.lastMoveT = now();
      this.velYaw = 0; this.velPitch = 0;
      if (this.canvas) this.canvas.classList.add('p360-grabbing');
      if (e.pointerId != null && this.canvas && this.canvas.setPointerCapture) {
        try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }
    } else if (n === 2) {
      this.dragging = false;
      this.pinchDist = this._currentPinch();
    }
    if (e.cancelable) e.preventDefault();
  };

  Viewer.prototype._onPointerMove = function (e) {
    if (this.destroyed) return;
    var id = (e.pointerId != null) ? e.pointerId : 'mouse';
    if (!this.pointers[id]) return;
    this.pointers[id].x = e.clientX;
    this.pointers[id].y = e.clientY;

    var n = this._pointerCount();
    if (n >= 2) {
      var d = this._currentPinch();
      if (this.pinchDist > 0 && d > 0) {
        this.targetFov = clamp(this.targetFov * (this.pinchDist / d), 50, 100);
      }
      this.pinchDist = d;
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (!this.dragging) return;
    var dx = e.clientX - this.lastX;
    var dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    // Sensibilidad escalada por FOV (zoom in = giro más fino).
    var ch = (this.canvas && this.canvas.clientHeight) || window.innerHeight || 1;
    var k = (this.fov * Math.PI / 180) / Math.max(1, ch);
    var dYaw = -dx * k;
    var dPitch = -dy * k;
    this.yaw += dYaw;
    this.pitch += dPitch;

    // Velocidad para inercia: rad/s reales con EMA (no asume 60fps).
    var t = now();
    var elapsed = t - (this.lastMoveT || t);
    this.lastMoveT = t;
    if (elapsed > 0) {
      var vy = dYaw / (elapsed / 1000);
      var vp = dPitch / (elapsed / 1000);
      this.velYaw = this.velYaw * 0.6 + vy * 0.4;
      this.velPitch = this.velPitch * 0.6 + vp * 0.4;
    }

    if (e.cancelable) e.preventDefault();
  };

  Viewer.prototype._onPointerUp = function (e) {
    if (this.destroyed) return;
    var id = (e.pointerId != null) ? e.pointerId : 'mouse';
    if (this.pointers[id]) delete this.pointers[id];
    if (e.pointerId != null && this.canvas && this.canvas.releasePointerCapture) {
      try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    var n = this._pointerCount();
    if (n === 0) {
      this.dragging = false;
      if (this.canvas) this.canvas.classList.remove('p360-grabbing');
    } else if (n === 1) {
      // De pinch a drag de 1 dedo: re-anclar sin salto.
      this.dragging = true;
      for (var key in this.pointers) {
        if (this.pointers.hasOwnProperty(key)) {
          this.lastX = this.pointers[key].x;
          this.lastY = this.pointers[key].y;
          break;
        }
      }
      this.lastMoveT = now();
      this.velYaw = 0; this.velPitch = 0;
      this.pinchDist = 0;
    }
  };

  Viewer.prototype._currentPinch = function () {
    var pts = [];
    for (var k in this.pointers) {
      if (this.pointers.hasOwnProperty(k)) pts.push(this.pointers[k]);
      if (pts.length === 2) break;
    }
    if (pts.length < 2) return 0;
    var dx = pts[0].x - pts[1].x;
    var dy = pts[0].y - pts[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  Viewer.prototype._onWheel = function (e) {
    if (this.destroyed) return;
    this._markInteracted();
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= (window.innerHeight || 800);
    // Exponencial = sensación uniforme; clamp 50..100.
    this.targetFov = clamp(this.targetFov * Math.exp(delta * 0.0012), 50, 100);
    if (e.cancelable) e.preventDefault();
  };

  // ----- Touch legacy --------------------------------------------------------
  Viewer.prototype._onTouchStart = function (e) {
    if (this.destroyed) return;
    this._markInteracted();
    var t = e.touches;
    if (t.length === 1) {
      this.dragging = true;
      this.lastX = t[0].clientX;
      this.lastY = t[0].clientY;
      this.lastMoveT = now();
      this.velYaw = 0; this.velPitch = 0;
    } else if (t.length === 2) {
      this.dragging = false;
      var dx = t[0].clientX - t[1].clientX;
      var dy = t[0].clientY - t[1].clientY;
      this.pinchDist = Math.sqrt(dx * dx + dy * dy);
    }
    if (e.cancelable) e.preventDefault();
  };

  Viewer.prototype._onTouchMove = function (e) {
    if (this.destroyed) return;
    var t = e.touches;
    if (t.length === 2) {
      var dx = t[0].clientX - t[1].clientX;
      var dy = t[0].clientY - t[1].clientY;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (this.pinchDist > 0 && d > 0) {
        this.targetFov = clamp(this.targetFov * (this.pinchDist / d), 50, 100);
      }
      this.pinchDist = d;
      if (e.cancelable) e.preventDefault();
      return;
    }
    if (this.dragging && t.length === 1) {
      var mx = t[0].clientX - this.lastX;
      var my = t[0].clientY - this.lastY;
      this.lastX = t[0].clientX;
      this.lastY = t[0].clientY;
      var ch = (this.canvas && this.canvas.clientHeight) || window.innerHeight || 1;
      var k = (this.fov * Math.PI / 180) / Math.max(1, ch);
      var dYaw = -mx * k, dPitch = -my * k;
      this.yaw += dYaw;
      this.pitch += dPitch;
      var tt = now();
      var elapsed = tt - (this.lastMoveT || tt);
      this.lastMoveT = tt;
      if (elapsed > 0) {
        this.velYaw = this.velYaw * 0.6 + (dYaw / (elapsed / 1000)) * 0.4;
        this.velPitch = this.velPitch * 0.6 + (dPitch / (elapsed / 1000)) * 0.4;
      }
      if (e.cancelable) e.preventDefault();
    }
  };

  Viewer.prototype._onTouchEnd = function (e) {
    if (this.destroyed) return;
    if (!e.touches || e.touches.length === 0) {
      this.dragging = false;
      this.pinchDist = 0;
    } else if (e.touches.length === 1) {
      this.dragging = true;
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
      this.lastMoveT = now();
      this.pinchDist = 0;
    }
  };

  Viewer.prototype._onKeyDown = function (e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      if (e.preventDefault) e.preventDefault();
      this.close();
    }
  };

  // ----- Contexto WebGL: pérdida / restauración ------------------------------
  Viewer.prototype._onContextLost = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  };

  Viewer.prototype._onContextRestored = function () {
    if (this.destroyed || !this.gl) return;
    var self = this;
    this.glProgram = null; this.glBuffers = null; this.glTexture = null; this.loc = null;
    this._loadImage(this.image, function (img) {
      if (self.destroyed || !self.gl) return;
      try {
        var gl = self.gl;
        self._buildGLResources(gl, img);
        gl.clearColor(1, 0.953, 0.871, 1);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        self._resizeCanvas();
        self._startLoop();
      } catch (err) {
        self._teardownGL();
        self._startFlatFallback();
      }
    }, function () {
      self._teardownGL();
      self._startFlatFallback();
    });
  };

  // ----- Loader --------------------------------------------------------------
  Viewer.prototype._hideLoader = function () {
    if (!this.loader) return;
    var l = this.loader;
    var self = this;
    l.classList.add('p360-gone');
    setTimeout(function () {
      if (l && l.parentNode) l.parentNode.removeChild(l);
      if (self.loader === l) self.loader = null;
    }, 450);
  };

  // ----- Teardown GL ---------------------------------------------------------
  Viewer.prototype._teardownGL = function () {
    var gl = this.gl;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    if (this.canvas) {
      try { this.canvas.removeEventListener('webglcontextlost', this._bound.ctxlost, false); } catch (e) {}
      try { this.canvas.removeEventListener('webglcontextrestored', this._bound.ctxrestored, false); } catch (e) {}
    }
    if (gl) {
      try {
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        if (this.glTexture) gl.deleteTexture(this.glTexture);
        if (this.glBuffers) {
          if (this.glBuffers.pos) gl.deleteBuffer(this.glBuffers.pos);
          if (this.glBuffers.uv) gl.deleteBuffer(this.glBuffers.uv);
          if (this.glBuffers.idx) gl.deleteBuffer(this.glBuffers.idx);
        }
        if (this.glProgram) gl.deleteProgram(this.glProgram);
        if (this.glLoseExt) { try { this.glLoseExt.loseContext(); } catch (e2) {} }
      } catch (e) {}
    }
    this.glTexture = null;
    this.glBuffers = null;
    this.glProgram = null;
    this.glLoseExt = null;
    this.loc = null;
    this.gl = null;
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
  };

  // ----- Cierre + cleanup TOTAL ----------------------------------------------
  Viewer.prototype.close = function () {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }

    // Abortar imágenes en vuelo.
    for (var i = 0; i < this._imgEls.length; i++) {
      var im = this._imgEls[i];
      try { im.onload = null; im.onerror = null; im.src = ''; } catch (e) {}
    }
    this._imgEls.length = 0;

    this._removeAllListeners();
    this._teardownGL();

    // Restaurar scroll.
    try {
      document.documentElement.style.overflow = this._prevHtmlOverflow || '';
      document.body.style.overflow = this._prevBodyOverflow || '';
    } catch (e) {}

    var root = this.root;
    var self = this;
    if (root) {
      root.classList.remove('p360-in');
      var removed = false;
      var doRemove = function () {
        if (removed) return; removed = true;
        if (root && root.parentNode) root.parentNode.removeChild(root);
        self.root = null;
      };
      root.addEventListener('transitionend', doRemove);
      setTimeout(doRemove, 520);
    }

    this.loader = null;
    this.hint = null;
    this.pointers = {};

    if (ACTIVE === this) ACTIVE = null;

    var cb = this.onClose;
    this.onClose = null;
    this.opts = null;
    if (cb) { try { cb(); } catch (e) {} }
  };

  // ==========================================================================
  //  API PÚBLICA
  // ==========================================================================
  function open(opts) {
    opts = opts || {};
    if (ACTIVE) { try { ACTIVE.close(); } catch (e) {} ACTIVE = null; }
    var v = new Viewer(opts);
    ACTIVE = v;
    try {
      v.build();
      v.start();
    } catch (e) {
      try { v._startFlatFallback(); }
      catch (e2) { try { v.close(); } catch (e3) {} }
    }
  }

  function close() {
    if (ACTIVE) { try { ACTIVE.close(); } catch (e) {} ACTIVE = null; }
  }

  window.Pano360 = { open: open, close: close, __casaducho: true };
})();