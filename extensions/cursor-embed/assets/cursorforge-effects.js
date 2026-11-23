// CursorForge celebration effects: particles falling over the whole page, plus a confetti burst.
// Loaded on the storefront by the app embed (blocks/cursor.liquid), and imported by the editor
// (src/routes/index.tsx) for its live preview so both always match.
(function () {
  if (typeof window === "undefined") return;

  // Keep in sync with EFFECT_STYLES in src/lib/cursor-config.ts.
  var STYLES = ["stars", "snow", "confetti", "hearts", "leaves"];
  var DEFAULT_COLORS = { stars: "#f5c518", snow: "#ffffff", hearts: "#e63950" };
  var CONFETTI_COLORS = ["#f4511e", "#f5c518", "#1f8a4c", "#2f80ed", "#e63950", "#9b51e0"];
  var LEAF_COLORS = ["#c0392b", "#d35400", "#e67e22", "#b7950b", "#8e5a2b"];
  // Particles per density step on a 1280x800 viewport; scaled by the viewport's area.
  var PER_DENSITY = 6;
  var MAX_RATIO = 2;

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.min(Math.max(number, min), max);
  }

  function normalize(options) {
    options = options || {};
    var style = STYLES.indexOf(options.style) >= 0 ? options.style : null;
    var color = /^#[0-9a-f]{6}$/i.test(options.color || "") ? options.color : null;
    return {
      style: style,
      color: color || (style && DEFAULT_COLORS[style]) || "#f5c518",
      density: Math.round(clamp(options.density, 1, 10, 5)),
      speed: Math.round(clamp(options.speed, 1, 10, 4)),
      size: Math.round(clamp(options.size, 6, 32, 14)),
    };
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function drawStar(ctx, radius) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? radius : radius * 0.45;
      var angle = (Math.PI / 5) * i - Math.PI / 2;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawSnowflake(ctx, radius) {
    ctx.lineWidth = Math.max(1, radius / 4);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (var i = 0; i < 3; i++) {
      var angle = (Math.PI / 3) * i;
      ctx.moveTo(-Math.cos(angle) * radius, -Math.sin(angle) * radius);
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.stroke();
  }

  function drawHeart(ctx, radius) {
    var r = radius;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.7, -r * 1.2, 0, -r * 0.45);
    ctx.bezierCurveTo(r * 0.7, -r * 1.2, r * 1.4, -r * 0.1, 0, r * 0.9);
    ctx.fill();
  }

  function drawLeaf(ctx, radius) {
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.quadraticCurveTo(radius * 0.8, 0, 0, radius);
    ctx.quadraticCurveTo(-radius * 0.8, 0, 0, -radius);
    ctx.fill();
  }

  function drawConfetti(ctx, radius, flip) {
    // Flip squashes the piece vertically so it looks like it's tumbling.
    ctx.fillRect(-radius * 0.5, -radius * 0.3 * flip, radius, radius * 0.6 * flip);
  }

  /**
   * Draws effects on `canvas`, which should cover the area they fall over.
   * Returns { update(options), burst(), destroy() }. options.style null = no falling effect (bursts only).
   */
  function create(config) {
    var canvas = config.canvas;
    var ctx = canvas.getContext("2d");
    var opts = normalize(config.options);
    var width = 0;
    var height = 0;
    var flakes = [];
    var confetti = [];
    var frame = 0;
    var lastTime = 0;
    var paused = false;

    function resize() {
      var box = canvas.getBoundingClientRect();
      var ratio = Math.min(window.devicePixelRatio || 1, MAX_RATIO);
      width = box.width;
      height = box.height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      fill(true);
    }

    function targetCount() {
      if (!opts.style || !width || !height) return 0;
      var scale = Math.min(Math.max((width * height) / (1280 * 800), 0.3), 1.5);
      return Math.max(3, Math.round(opts.density * PER_DENSITY * scale));
    }

    function newFlake(anywhere) {
      var scale = 0.6 + Math.random() * 0.8;
      var fall = (0.015 + opts.speed * 0.011) * (0.7 + Math.random() * 0.6);
      return {
        x: Math.random() * width,
        // At the start, spread flakes above the page so they drift in rather than appear at once.
        y: anywhere ? -Math.random() * height : -opts.size * 2,
        vy: opts.style === "snow" ? fall * 0.7 : opts.style === "leaves" ? fall * 0.8 : fall,
        size: opts.size * scale,
        sway: 0.2 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * (opts.style === "leaves" || opts.style === "confetti" ? 0.006 : 0.002),
        color: opts.style === "confetti" ? pick(CONFETTI_COLORS) : opts.style === "leaves" ? pick(LEAF_COLORS) : opts.color,
        age: 0,
      };
    }

    function fill(anywhere) {
      var count = targetCount();
      if (flakes.length > count) flakes.length = count;
      while (flakes.length < count) flakes.push(newFlake(anywhere));
    }

    function drawShape(style, particle, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      ctx.strokeStyle = particle.color;
      var radius = particle.size / 2;
      if (style === "stars") drawStar(ctx, radius);
      else if (style === "snow") drawSnowflake(ctx, radius);
      else if (style === "hearts") drawHeart(ctx, radius);
      else if (style === "leaves") drawLeaf(ctx, radius);
      else drawConfetti(ctx, particle.size, Math.cos(particle.age / 120 + particle.phase));
      ctx.restore();
    }

    function drawFlakes(dt) {
      if (!opts.style) return false;
      // A faint shadow keeps white snow visible on white pages.
      if (opts.style === "snow") {
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = 2;
      }
      for (var i = 0; i < flakes.length; i++) {
        var flake = flakes[i];
        flake.age += dt;
        flake.y += flake.vy * dt;
        flake.x += Math.sin(flake.age / 900 + flake.phase) * flake.sway * 0.03 * dt;
        flake.rotation += flake.spin * dt;
        if (flake.y > height + flake.size * 2) {
          flakes[i] = newFlake(false);
          continue;
        }
        if (flake.x < -flake.size * 2) flake.x = width + flake.size;
        else if (flake.x > width + flake.size * 2) flake.x = -flake.size;
        var alpha = opts.style === "stars" ? 0.65 + 0.35 * Math.sin(flake.age / 260 + flake.phase) : 0.9;
        drawShape(opts.style, flake, alpha);
      }
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      return flakes.length > 0;
    }

    function drawConfettiBurst(dt) {
      for (var i = confetti.length - 1; i >= 0; i--) {
        var piece = confetti[i];
        piece.age += dt;
        if (piece.age >= piece.life || piece.y > height + 40) {
          confetti.splice(i, 1);
          continue;
        }
        // Gravity plus strong air drag, so pieces shoot up, slow, then flutter down at about 150 px/s.
        var drag = Math.pow(0.96, dt / 16);
        piece.vx *= drag;
        piece.vy = piece.vy * drag + 0.0004 * dt;
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.rotation += piece.spin * dt;
        var remaining = 1 - piece.age / piece.life;
        drawShape("confetti", piece, Math.min(1, remaining * 3));
      }
      return confetti.length > 0;
    }

    function step(time) {
      var dt = lastTime ? Math.min(time - lastTime, 50) : 16;
      lastTime = time;
      ctx.clearRect(0, 0, width, height);
      var falling = drawFlakes(dt);
      var bursting = drawConfettiBurst(dt);
      ctx.globalAlpha = 1;
      if ((falling || bursting) && !paused) {
        frame = requestAnimationFrame(step);
      } else {
        frame = 0;
        lastTime = 0;
        if (!falling && !bursting) ctx.clearRect(0, 0, width, height);
      }
    }

    function start() {
      if (!frame && !paused) frame = requestAnimationFrame(step);
    }

    // Two party poppers from the bottom corners, aimed up and inward.
    function burst() {
      if (!width || !height) resize();
      var pieces = Math.round(Math.min(160, 50 + width / 12));
      var power = Math.min(Math.max(height / 700, 0.7), 1.4);
      for (var i = 0; i < pieces; i++) {
        var fromLeft = i % 2 === 0;
        var angle = (fromLeft ? -1 : 1) * (0.25 + Math.random() * 0.45);
        var speed = (1.1 + Math.random() * 0.6) * power;
        confetti.push({
          x: fromLeft ? 0 : width,
          y: height,
          vx: Math.sin(-angle) * speed,
          vy: -Math.cos(angle) * speed,
          size: 8 + Math.random() * 6,
          phase: Math.random() * Math.PI * 2,
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.02,
          color: pick(CONFETTI_COLORS),
          age: 0,
          life: 2600 + Math.random() * 1200,
        });
      }
      start();
    }

    function onVisibility() {
      paused = document.hidden;
      if (paused && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
      } else {
        start();
      }
    }

    resize();
    var observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(canvas);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return {
      update: function (options) {
        var previous = opts;
        opts = normalize(options);
        if (opts.style !== previous.style) flakes = [];
        // Same effect: adjust the flakes already falling so slider changes show right away.
        var fallScale = (0.015 + opts.speed * 0.011) / (0.015 + previous.speed * 0.011);
        var sizeScale = opts.size / previous.size;
        flakes.forEach(function (flake) {
          flake.vy *= fallScale;
          flake.size *= sizeScale;
          if (opts.style !== "confetti" && opts.style !== "leaves") flake.color = opts.color;
        });
        fill(true);
        start();
      },
      burst: burst,
      destroy: function () {
        if (frame) cancelAnimationFrame(frame);
        if (observer) observer.disconnect();
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVisibility);
      },
    };
  }

  window.CursorForgeEffects = { create: create };

  var config = document.getElementById("cursorforge-effects");
  if (!config) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var data = config.dataset;

  // Dates are compared in the visitor's local time, so the effect starts at their midnight.
  function localDate() {
    var now = new Date();
    var month = String(now.getMonth() + 1);
    var day = String(now.getDate());
    return now.getFullYear() + "-" + (month.length < 2 ? "0" : "") + month + "-" + (day.length < 2 ? "0" : "") + day;
  }
  var today = localDate();
  var inSchedule = (!data.start || today >= data.start) && (!data.end || today <= data.end);
  var style = data.style && inSchedule ? data.style : null;
  var cartBurst = data.cartBurst === "true";
  if (!style && !cartBurst) return;

  var BURST_KEY = "cursorforge-burst";
  var CART_ADD = /\/cart\/add(\.js)?(\?|#|$)/;
  var effects = null;

  function mount() {
    if (effects) return effects;
    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646";
    document.body.appendChild(canvas);
    effects = create({
      canvas: canvas,
      options: { style: style, color: data.color, density: data.density, speed: data.speed, size: data.size },
    });
    return effects;
  }

  if (style) mount();
  if (!cartBurst) return;

  // Themes that add to cart without leaving the page (fetch or XHR to /cart/add).
  if (typeof PerformanceObserver === "function") {
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var ok = !entry.responseStatus || entry.responseStatus < 400;
          if (ok && CART_ADD.test(entry.name.split("?")[0])) {
            mount().burst();
            return;
          }
        }
      }).observe({ type: "resource", buffered: false });
    } catch (error) {
      // Older browsers without resource timing: no burst for AJAX carts.
    }
  }

  // Themes that submit the product form and load a new page: celebrate on the next page.
  window.addEventListener("submit", function (event) {
    var form = event.target;
    if (event.defaultPrevented || !form || !form.action || !CART_ADD.test(String(form.action).split("?")[0])) return;
    try {
      sessionStorage.setItem(BURST_KEY, "1");
    } catch (error) {
      // Storage blocked: skip the burst.
    }
  });
  try {
    if (sessionStorage.getItem(BURST_KEY)) {
      sessionStorage.removeItem(BURST_KEY);
      mount().burst();
    }
  } catch (error) {
    // Storage blocked: skip the burst.
  }
})();
