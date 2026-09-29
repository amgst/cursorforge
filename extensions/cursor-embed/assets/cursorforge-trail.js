// CursorForge trail engine. Loaded on the storefront by the app embed (blocks/cursor.liquid),
// and imported by the editor (src/routes/index.tsx) for its live preview so both always match.
(function () {
  if (typeof window === "undefined") return;

  var STYLES = ["dots", "comet", "sparkles", "bubbles"];

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.min(Math.max(number, min), max);
  }

  function normalize(options) {
    options = options || {};
    return {
      style: STYLES.indexOf(options.style) >= 0 ? options.style : "dots",
      color: /^#[0-9a-f]{6}$/i.test(options.color || "") ? options.color : "#f4511e",
      length: Math.round(clamp(options.length, 3, 20, 8)),
      size: Math.round(clamp(options.size, 2, 16, 6)),
    };
  }

  function drawSparkle(ctx, x, y, radius, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var r = i % 2 === 0 ? radius : radius * 0.35;
      var angle = (Math.PI / 4) * i;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draws a cursor trail on `canvas`, following pointer moves on `target`.
   * Returns { update(options), destroy() }.
   */
  function create(config) {
    var canvas = config.canvas;
    var target = config.target || window;
    var ctx = canvas.getContext("2d");
    var opts = normalize(config.options);
    var width = 0;
    var height = 0;
    var pointer = null;
    var chain = [];
    var particles = [];
    var lastSpawn = null;
    var frame = 0;
    var lastTime = 0;

    function resize() {
      var box = canvas.getBoundingClientRect();
      var ratio = window.devicePixelRatio || 1;
      width = box.width;
      height = box.height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function resetChain() {
      chain = [];
      if (!pointer) return;
      for (var i = 0; i < opts.length; i++) chain.push({ x: pointer.x, y: pointer.y });
    }

    function spawn(point) {
      var dx = point.x - lastSpawn.x;
      var dy = point.y - lastSpawn.y;
      var distance = Math.sqrt(dx * dx + dy * dy);
      var spacing = Math.max(4, opts.size * 1.2);
      if (distance < spacing) return;
      var steps = Math.min(Math.floor(distance / spacing), 4);
      var life = 300 + opts.length * 40;
      for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        particles.push({
          x: lastSpawn.x + dx * t,
          y: lastSpawn.y + dy * t,
          vx: (Math.random() - 0.5) * 0.06,
          vy: opts.style === "bubbles" ? -0.02 - Math.random() * 0.03 : (Math.random() - 0.5) * 0.06,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.01,
          age: 0,
          life: life * (0.7 + Math.random() * 0.6),
        });
      }
      var max = opts.length * 8;
      if (particles.length > max) particles.splice(0, particles.length - max);
      lastSpawn = point;
    }

    function drawChain(dt) {
      var ease = 1 - Math.pow(1 - 0.45, dt / 16);
      var x = pointer.x;
      var y = pointer.y;
      var moving = false;
      for (var i = 0; i < chain.length; i++) {
        var node = chain[i];
        node.x += (x - node.x) * ease;
        node.y += (y - node.y) * ease;
        if (Math.abs(x - node.x) > 0.3 || Math.abs(y - node.y) > 0.3) moving = true;
        x = node.x;
        y = node.y;
      }
      if (!moving) return false;

      ctx.fillStyle = opts.color;
      ctx.strokeStyle = opts.color;
      ctx.lineCap = "round";
      var previous = pointer;
      for (var j = 0; j < chain.length; j++) {
        var scale = 1 - j / chain.length;
        if (opts.style === "comet") {
          ctx.globalAlpha = 0.8 * scale;
          ctx.lineWidth = Math.max(0.5, opts.size * scale);
          ctx.beginPath();
          ctx.moveTo(previous.x, previous.y);
          ctx.lineTo(chain[j].x, chain[j].y);
          ctx.stroke();
          previous = chain[j];
        } else {
          ctx.globalAlpha = 0.7 * scale;
          ctx.beginPath();
          ctx.arc(chain[j].x, chain[j].y, (opts.size / 2) * scale + 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return true;
    }

    function drawParticles(dt) {
      ctx.fillStyle = opts.color;
      ctx.strokeStyle = opts.color;
      ctx.lineWidth = 1.5;
      for (var i = particles.length - 1; i >= 0; i--) {
        var particle = particles[i];
        particle.age += dt;
        if (particle.age >= particle.life) {
          particles.splice(i, 1);
          continue;
        }
        var remaining = 1 - particle.age / particle.life;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.rotation += particle.spin * dt;
        if (opts.style === "bubbles") {
          ctx.globalAlpha = 0.8 * remaining;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, opts.size * (0.4 + (1 - remaining) * 1.2), 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.globalAlpha = remaining;
          drawSparkle(ctx, particle.x, particle.y, opts.size * (0.5 + 0.5 * remaining), particle.rotation);
        }
      }
      return particles.length > 0;
    }

    function step(time) {
      var dt = lastTime ? Math.min(time - lastTime, 50) : 16;
      lastTime = time;
      ctx.clearRect(0, 0, width, height);
      var active = opts.style === "sparkles" || opts.style === "bubbles"
        ? drawParticles(dt)
        : pointer && chain.length ? drawChain(dt) : false;
      ctx.globalAlpha = 1;
      if (active) {
        frame = requestAnimationFrame(step);
      } else {
        frame = 0;
        lastTime = 0;
        ctx.clearRect(0, 0, width, height);
      }
    }

    function start() {
      if (!frame) frame = requestAnimationFrame(step);
    }

    function onMove(event) {
      if (config.mouseOnly && event.pointerType && event.pointerType !== "mouse") return;
      var box = canvas.getBoundingClientRect();
      var point = { x: event.clientX - box.left, y: event.clientY - box.top };
      if (!pointer) {
        pointer = point;
        lastSpawn = point;
        resetChain();
      } else {
        pointer = point;
      }
      if (opts.style === "sparkles" || opts.style === "bubbles") spawn(point);
      start();
    }

    function onLeave() {
      pointer = null;
      chain = [];
    }

    resize();
    var observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(canvas);
    window.addEventListener("resize", resize);
    target.addEventListener("pointermove", onMove, { passive: true });
    if (target !== window) target.addEventListener("pointerleave", onLeave);

    return {
      update: function (options) {
        opts = normalize(options);
        particles = [];
        resetChain();
      },
      destroy: function () {
        if (frame) cancelAnimationFrame(frame);
        if (observer) observer.disconnect();
        window.removeEventListener("resize", resize);
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerleave", onLeave);
      },
    };
  }

  window.CursorForgeTrail = { create: create };

  var config = document.getElementById("cursorforge-trail");
  if (!config) return;
  if (!window.matchMedia("(pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647";
  document.body.appendChild(canvas);
  create({
    canvas: canvas,
    target: window,
    mouseOnly: true,
    options: {
      style: config.dataset.style,
      color: config.dataset.color,
      length: config.dataset.length,
      size: config.dataset.size,
    },
  });
})();
