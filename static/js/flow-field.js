/**
 * Flow Field Background Animation
 * Homepage-only canvas background for zzy2357.github.io
 * Adapted from background.html — no dat.gui, transparent field bg, subtle colors
 */
(function () {
  "use strict";

  var fieldCanvas = document.getElementById("field-canvas");
  var particleCanvas = document.getElementById("particle-canvas");
  if (!fieldCanvas || !particleCanvas) return;

  /* =========================================================
   * 1. Perlin Noise (3D)
   * ========================================================= */
  var Perlin = (function () {
    var perm = new Uint8Array(512);
    var p = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180];
    for (var i = 0; i < 256; i++) perm[i] = perm[256 + i] = p[i];
    var fade = function (t) { return t * t * t * (t * (t * 6 - 15) + 10); };
    var lerp = function (t, a, b) { return a + t * (b - a); };
    var grad = function (h, x, y, z) {
      var u = h < 8 ? x : y;
      var v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };
    return function (x, y, z) {
      var X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      var u = fade(x), v = fade(y), w = fade(z);
      var A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
      var B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
      return lerp(w,
        lerp(v, lerp(u, grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z)),
          lerp(u, grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z))),
        lerp(v, lerp(u, grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1)),
          lerp(u, grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1)))
      );
    };
  })();

  function lerpAngle(a, b, t) {
    var diff = b - a;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return a + diff * t;
  }

  /* =========================================================
   * 2. Parameters (hardcoded golden values)
   * ========================================================= */
  var PARTICLE_COUNT = 40;
  var particles = [];
  var FIELD_EVOLVE_SPEED = 0.0008;
  var MOUSE_RADIUS = 160;
  var MOUSE_STRENGTH = 1.0;
  var PARTICLE_MAX_SPEED = 6.0;
  var PARTICLE_MAX_FORCE = 0.25;
  var RES = 38;

  /* =========================================================
   * 3. FlowField
   * ========================================================= */
  function FlowField(resolution) {
    this.resolution = resolution;
    this.cols = Math.ceil(window.innerWidth / resolution) + 1;
    this.rows = Math.ceil(window.innerHeight / resolution) + 1;
    this.field = [];
    this.zoff = 0;
    this.init();
  }
  FlowField.prototype.init = function () {
    for (var i = 0; i < this.cols; i++) {
      this.field[i] = [];
      for (var j = 0; j < this.rows; j++) {
        this.field[i][j] = { angle: 0 };
      }
    }
  };
  FlowField.prototype.update = function (mouse, dt) {
    this.zoff += FIELD_EVOLVE_SPEED * dt;
    var xoffStep = 0.08, yoffStep = 0.08;
    for (var i = 0; i < this.cols; i++) {
      for (var j = 0; j < this.rows; j++) {
        var cx = i * this.resolution;
        var cy = j * this.resolution;
        var n = Perlin(i * xoffStep, j * yoffStep, this.zoff);
        var baseAngle = ((n + 1) * 0.5) * Math.PI * 4;
        if (mouse.active) {
          var dx = cx - mouse.x;
          var dy = cy - mouse.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS) {
            var attractAngle = Math.atan2(-dy, -dx);
            var influence = (1 - dist / MOUSE_RADIUS) * MOUSE_STRENGTH;
            influence = Math.min(1, influence);
            baseAngle = lerpAngle(baseAngle, attractAngle, influence);
          }
        }
        this.field[i][j].angle = baseAngle;
      }
    }
  };
  FlowField.prototype.lookup = function (x, y) {
    var c = Math.floor(x / this.resolution);
    var r = Math.floor(y / this.resolution);
    c = Math.max(0, Math.min(c, this.cols - 1));
    r = Math.max(0, Math.min(r, this.rows - 1));
    return this.field[c][r].angle;
  };

  /* =========================================================
   * 4. Canvas setup
   * ========================================================= */
  var fctx = fieldCanvas.getContext("2d");
  var pctx = particleCanvas.getContext("2d");
  var W, H, field;
  var mouse = { x: -9999, y: -9999, active: false };

  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });
  window.addEventListener("mouseleave", function () { mouse.active = false; });
  window.addEventListener("touchmove", function (e) {
    if (e.touches.length > 0) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.active = true;
    }
  }, { passive: true });
  window.addEventListener("touchend", function () { mouse.active = false; });

  /* =========================================================
   * 5. Draw vector field (subtle, transparent background)
   * ========================================================= */
  function drawField() {
    fctx.clearRect(0, 0, W, H);
    fctx.lineWidth = 1;
    fctx.lineCap = "round";
    var arrowSize = 4;
    for (var i = 0; i < field.cols; i++) {
      for (var j = 0; j < field.rows; j++) {
        var cx = i * field.resolution;
        var cy = j * field.resolution;
        if (cx > W || cy > H) continue;
        var a = field.field[i][j].angle;
        var len = field.resolution * 0.42;
        var dx = Math.cos(a) * len, dy = Math.sin(a) * len;
        /* subtle gray — visible on both light and dark backgrounds */
        var strokeColor = "rgba(128,128,140,0.12)";
        fctx.strokeStyle = strokeColor;
        fctx.fillStyle = strokeColor;
        var startX = cx - dx / 2, startY = cy - dy / 2;
        var endX = cx + dx / 2, endY = cy + dy / 2;
        fctx.beginPath();
        fctx.moveTo(startX, startY);
        fctx.lineTo(endX, endY);
        fctx.stroke();
        fctx.save();
        fctx.translate(endX, endY);
        fctx.rotate(a);
        fctx.beginPath();
        fctx.moveTo(0, 0);
        fctx.lineTo(-arrowSize, -arrowSize / 2);
        fctx.lineTo(-arrowSize, arrowSize / 2);
        fctx.closePath();
        fctx.fill();
        fctx.restore();
      }
    }
  }

  /* =========================================================
   * 6. Particle
   * ========================================================= */
  function Particle() {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    var initAngle = Math.random() * Math.PI * 2;
    var initSpeed = 0.5 + Math.random() * (PARTICLE_MAX_SPEED - 0.5);
    this.vx = Math.cos(initAngle) * initSpeed;
    this.vy = Math.sin(initAngle) * initSpeed;
    this.mass = 0.6 + Math.random() * 2.4;
    var t = Math.random();
    this.r = 50 + (t * 50 | 0);
    this.g = 70 + (t * 40 | 0);
    this.b = 110 + (t * 50 | 0);
    this.size = 3 + this.mass * 3;
  }
  Particle.prototype.wrap = function () {
    if (this.x < -20) this.x = W + 20;
    else if (this.x > W + 20) this.x = -20;
    if (this.y < -20) this.y = H + 20;
    else if (this.y > H + 20) this.y = -20;
  };
  Particle.prototype.update = function (dt) {
    var maxSpeed = PARTICLE_MAX_SPEED;
    var maxForce = PARTICLE_MAX_FORCE;
    var angle = field.lookup(this.x, this.y);
    var desiredVx = Math.cos(angle) * maxSpeed;
    var desiredVy = Math.sin(angle) * maxSpeed;
    var steerX = desiredVx - this.vx;
    var steerY = desiredVy - this.vy;
    var steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
    if (steerMag > maxForce) {
      steerX = (steerX / steerMag) * maxForce;
      steerY = (steerY / steerMag) * maxForce;
    }
    steerX /= this.mass;
    steerY /= this.mass;
    this.vx += steerX * dt;
    this.vy += steerY * dt;
    var speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.wrap();
  };
  Particle.prototype.draw = function (ctx) {
    var heading = Math.atan2(this.vy, this.vx);
    var shaftLength = this.size * 2.2;
    var headLength = this.size * 1.4;
    var headWidth = this.size * 0.9;
    var lineWidth = this.size * 0.35;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(heading);
    ctx.strokeStyle = "rgba(" + this.r + ", " + this.g + ", " + this.b + ", 0.35)";
    ctx.fillStyle = "rgba(" + this.r + ", " + this.g + ", " + this.b + ", 0.35)";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-shaftLength / 2, 0);
    ctx.lineTo(shaftLength / 2, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shaftLength / 2 + headLength, 0);
    ctx.lineTo(shaftLength / 2, -headWidth);
    ctx.lineTo(shaftLength / 2, headWidth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  /* =========================================================
   * 7. Init & animate
   * ========================================================= */
  function resize() {
    W = fieldCanvas.width = particleCanvas.width = window.innerWidth;
    H = fieldCanvas.height = particleCanvas.height = window.innerHeight;
    field = new FlowField(RES);
    if (particles.length === 0) {
      for (var i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
      }
    }
  }

  var lastTime = 0;

  function animate(timestamp) {
    var dt = Math.min((timestamp - lastTime) / 1000, 0.1) * 60;
    lastTime = timestamp;

    field.update(mouse, dt);
    drawField();
    pctx.clearRect(0, 0, W, H);
    for (var i = 0; i < particles.length; i++) {
      particles[i].update(dt);
      particles[i].draw(pctx);
    }
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(animate);
})();
