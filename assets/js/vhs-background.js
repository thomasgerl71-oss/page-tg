(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var BG_VERTEX_SRC =
    "attribute vec2 a_position;" +
    "void main() { gl_Position = vec4(a_position, 0.0, 1.0); }";

  var BG_FRAGMENT_SRC = [
    "precision highp float;",
    "uniform vec2 u_resolution;",
    "uniform float u_time;",
    "uniform vec2 u_mouse;",
    "float random(vec2 st) {",
    "  return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);",
    "}",
    "float noise(vec2 st) {",
    "  vec2 i = floor(st);",
    "  vec2 f = fract(st);",
    "  float a = random(i);",
    "  float b = random(i + vec2(1.0, 0.0));",
    "  float c = random(i + vec2(0.0, 1.0));",
    "  float d = random(i + vec2(1.0, 1.0));",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;",
    "}",
    "float fbm(vec2 st) {",
    "  float value = 0.0;",
    "  float amplitude = 0.5;",
    "  for (int i = 0; i < 5; i++) {",
    "    value += amplitude * noise(st);",
    "    st *= 2.0;",
    "    amplitude *= 0.5;",
    "  }",
    "  return value;",
    "}",
    "vec3 distortedColor(vec2 uv) {",
    "  vec2 st = uv * 8.0;",
    "  float t = u_time * 0.5;",
    "  vec2 q = vec2(fbm(st), fbm(st + vec2(5.2, 1.3)));",
    "  vec2 r = vec2(",
    "    fbm(st + 4.0 * q + vec2(1.7 - t * 0.15, 9.2)),",
    "    fbm(st + 4.0 * q + vec2(8.3 - t * 0.126, 2.8)));",
    "  float f = fbm(st + r);",
    "  vec3 col = vec3(",
    "    f * f * f + 0.6 * f * f + 0.5 * f,",
    "    f * f * f * f + 0.4 * f * f + 0.2 * f,",
    "    f * f * f * f * f * f + 0.7 * f * f + 0.5 * f);",
    "  vec2 mouseUv = u_mouse * 0.5 + 0.5;",
    "  float mouseDist = length(uv - mouseUv);",
    "  float mouseEffect = 1.0 - smoothstep(0.0, 0.5, mouseDist);",
    "  col += mouseEffect * vec3(0.28, 0.05, 0.14);",
    "  col += random(uv * 100.0 + t) * 0.08;",
    "  col += sin(uv.y * 800.0) * 0.03;",
    "  return col;",
    "}",
    "void main() {",
    "  vec2 uv = gl_FragCoord.xy / u_resolution;",
    "  vec3 col = distortedColor(uv);",
    "  float glitch = step(0.995, random(vec2(floor(u_time * 8.0), floor(uv.y * 40.0))));",
    "  col += glitch * 0.15;",
    "  col += (random(uv + u_time) - 0.5) * 0.04;",
    "  float vignette = 1.0 - length(uv - 0.5) * 1.15;",
    "  col *= vignette;",
    "  col = pow(clamp(col, 0.0, 1.0), vec3(1.05)) * 0.95;",
    "  vec3 navy = vec3(0.0431, 0.0627, 0.1490);",
    "  col = mix(clamp(col, 0.0, 1.0), navy, 0.65);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  var PT_VERTEX_SRC =
    "attribute vec2 a_position;" +
    "attribute vec3 a_color;" +
    "attribute float a_size;" +
    "varying vec3 v_color;" +
    "void main() {" +
    "  gl_Position = vec4(a_position, 0.0, 1.0);" +
    "  gl_PointSize = a_size;" +
    "  v_color = a_color;" +
    "}";

  var PT_FRAGMENT_SRC =
    "precision mediump float;" +
    "varying vec3 v_color;" +
    "void main() {" +
    "  vec2 c = gl_PointCoord - 0.5;" +
    "  float d = length(c);" +
    "  if (d > 0.5) discard;" +
    "  float alpha = smoothstep(0.5, 0.0, d) * 0.45;" +
    "  gl_FragColor = vec4(v_color, alpha);" +
    "}";

  var PARTICLE_COUNT = prefersReducedMotion ? 0 : 260;

  function compile(gl, type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function link(gl, vsSrc, fsSrc) {
    var vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) {
      return null;
    }
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return null;
    }
    return program;
  }

  function initVhs(canvas) {
    var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      return null;
    }

    var bgProgram = link(gl, BG_VERTEX_SRC, BG_FRAGMENT_SRC);
    var ptProgram = PARTICLE_COUNT > 0 ? link(gl, PT_VERTEX_SRC, PT_FRAGMENT_SRC) : null;
    if (!bgProgram) {
      return null;
    }

    var quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    var bgPositionLoc = gl.getAttribLocation(bgProgram, "a_position");
    var uResolution = gl.getUniformLocation(bgProgram, "u_resolution");
    var uTime = gl.getUniformLocation(bgProgram, "u_time");
    var uMouse = gl.getUniformLocation(bgProgram, "u_mouse");

    var particles = null;
    var ptPositionLoc, ptColorLoc, ptSizeLoc, positionBuffer, colorBuffer, sizeBuffer;

    if (ptProgram) {
      var positions = new Float32Array(PARTICLE_COUNT * 2);
      var colors = new Float32Array(PARTICLE_COUNT * 3);
      var sizes = new Float32Array(PARTICLE_COUNT);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);

      for (var i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 2] = (Math.random() - 0.5) * 2;
        positions[i * 2 + 1] = (Math.random() - 0.5) * 2;

        var choice = Math.random();
        if (choice < 0.34) {
          colors[i * 3] = 1;
          colors[i * 3 + 1] = 0;
          colors[i * 3 + 2] = 0;
        } else if (choice < 0.67) {
          colors[i * 3] = 1;
          colors[i * 3 + 1] = 1;
          colors[i * 3 + 2] = 1;
        } else {
          colors[i * 3] = 0;
          colors[i * 3 + 1] = 1;
          colors[i * 3 + 2] = 1;
        }

        sizes[i] = (Math.random() * 3 + 1.5) * dpr;
      }

      positionBuffer = gl.createBuffer();
      colorBuffer = gl.createBuffer();
      sizeBuffer = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);

      ptPositionLoc = gl.getAttribLocation(ptProgram, "a_position");
      ptColorLoc = gl.getAttribLocation(ptProgram, "a_color");
      ptSizeLoc = gl.getAttribLocation(ptProgram, "a_size");

      particles = { positions: positions };
    }

    var pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    var startTime = performance.now();
    var rafId = null;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function setPointerFromEvent(clientX, clientY) {
      pointer.targetX = (clientX / window.innerWidth - 0.5) * 2;
      pointer.targetY = -((clientY / window.innerHeight - 0.5) * 2);
    }

    function onPointerMove(e) {
      var point = e.touches ? e.touches[0] : e;
      setPointerFromEvent(point.clientX, point.clientY);
    }

    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("resize", resize);

    function updateParticles() {
      var positions = particles.positions;
      for (var i = 0; i < PARTICLE_COUNT; i++) {
        var i2 = i * 2;
        positions[i2] += (Math.random() - 0.5) * 0.003;
        positions[i2 + 1] += (Math.random() - 0.5) * 0.003;

        var dx = positions[i2] - pointer.x;
        var dy = positions[i2 + 1] - pointer.y;
        var distSq = dx * dx + dy * dy;
        if (distSq < 0.09 && distSq > 0.0001) {
          var push = 0.004 / distSq;
          positions[i2] += dx * push * 0.02;
          positions[i2 + 1] += dy * push * 0.02;
        }

        if (positions[i2] > 1 || positions[i2] < -1) positions[i2] *= -0.9;
        if (positions[i2 + 1] > 1 || positions[i2 + 1] < -1) positions[i2 + 1] *= -0.9;
      }
    }

    function render() {
      pointer.x += (pointer.targetX - pointer.x) * 0.06;
      pointer.y += (pointer.targetY - pointer.y) * 0.06;

      var elapsed = prefersReducedMotion
        ? 0
        : (performance.now() - startTime) / 1000;

      gl.disable(gl.BLEND);
      gl.useProgram(bgProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(bgPositionLoc);
      gl.vertexAttribPointer(bgPositionLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uMouse, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (ptProgram && particles) {
        if (!prefersReducedMotion) {
          updateParticles();
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.useProgram(ptProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, particles.positions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(ptPositionLoc);
        gl.vertexAttribPointer(ptPositionLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.enableVertexAttribArray(ptColorLoc);
        gl.vertexAttribPointer(ptColorLoc, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
        gl.enableVertexAttribArray(ptSizeLoc);
        gl.vertexAttribPointer(ptSizeLoc, 1, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);
      }

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(render);
      }
    }

    function start() {
      resize();
      if (prefersReducedMotion) {
        render();
      } else if (rafId === null) {
        rafId = window.requestAnimationFrame(render);
      }
    }

    function stop() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    });

    start();

    return { stop: stop, start: start };
  }

  document.querySelectorAll("[data-vhs-background]").forEach(function (canvas) {
    try {
      initVhs(canvas);
    } catch (e) {
      /* WebGL unavailable: canvas stays transparent, CSS gradient fallback shows. */
    }
  });
})();
