'use strict';
// ============ core.js – Mathe, Mesh-Builder, WebGL2-Renderer ============
const DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = t => { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); };
const easeIn = t => { t = clamp(t, 0, 1); return t * t; };
const backOut = t => { t = clamp(t, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hash(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function col(c) {
  if (Array.isArray(c)) return c;
  if (typeof c !== 'string') return [1, 0, 1];
  c = c.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join('');
  return [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16) / 255);
}
const shade = (c, f) => col(c).map(x => clamp(x * f, 0, 1));
const mixc = (a, b, t) => { a = col(a); b = col(b); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };

const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
};

const M4 = {
  I() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
  chain(...ms) { let r = ms[0]; for (let i = 1; i < ms.length; i++) r = M4.mul(r, ms[i]); return r; },
  T(x, y, z) { const m = M4.I(); m[12] = x; m[13] = y; m[14] = z; return m; },
  RX(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.I(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  RY(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.I(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  RZ(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.I(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  S(x, y, z) { if (y === undefined) { y = z = x; } const m = M4.I(); m[0] = x; m[5] = y; m[10] = z; return m; },
  persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; },
  ortho(l, r, b, t, n, f) { const m = M4.I(); m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n); m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); return m; },
  look(e, c, up = [0, 1, 0]) {
    const z = V3.norm(V3.sub(e, c)); let x = V3.cross(up, z); if (V3.len(x) < 1e-6) x = [1, 0, 0]; x = V3.norm(x); const y = V3.cross(z, x);
    const m = M4.I(); m[0] = x[0]; m[4] = x[1]; m[8] = x[2]; m[1] = y[0]; m[5] = y[1]; m[9] = y[2]; m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
    m[12] = -V3.dot(x, e); m[13] = -V3.dot(y, e); m[14] = -V3.dot(z, e); return m;
  },
  xp(m, p) { const [x, y, z] = p; return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; },
  xd(m, p) { const [x, y, z] = p; return [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z]; },
  proj(m, p) { const [x, y, z] = p; const w = m[3] * x + m[7] * y + m[11] * z + m[15]; return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, w]; },
  inv(a) {
    const o = new Float32Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return M4.I(); d = 1 / d;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
    return o;
  },
};

// ---------- Icosphere ----------
const _ico = {};
function ICO(det) {
  if (_ico[det]) return _ico[det];
  const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(V3.norm);
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < det; d++) {
    const cache = {}; const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (cache[k] === undefined) { V.push(V3.norm(V3.lerp(V[a], V[b], 0.5))); cache[k] = V.length - 1; } return cache[k]; };
    const NF = []; for (const [a, b, c] of F) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); NF.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); } F = NF;
  }
  return (_ico[det] = { V, F });
}

// ---------- Materialien (für den 4K-Look): Kennung wird in der Vertex-Farbe kodiert (R + 2*id), Shader dekodiert ----------
// 1 Holz, 2 Stein, 3 Ziegel, 4 Putz/Beton, 5 Stoff, 6 Jeans, 7 Strick, 8 Dachschindeln, 9 Gras, 10 Metall, 11 Haar, 12 Holzverkleidung, 13 Schnee, 14 Blätter
const MAT = { auto: true, map: null };
function matKey(c) { return c[0].toFixed(3) + ',' + c[1].toFixed(3) + ',' + c[2].toFixed(3); }
function autoMat(c, n) {
  const r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx, s = mx > 0 ? (mx - mn) / mx : 0;
  let h = 0; if (mx !== mn) { if (mx === r) h = ((g - b) / (mx - mn)) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4; h *= 60; if (h < 0) h += 360; }
  const up = n[1] > 0.7, slope = Math.abs(n[1]) > 0.25 && Math.abs(n[1]) < 0.95;
  if (v > 0.9 && s < 0.07 && up) return 13;
  if (h > 65 && h < 165 && s > 0.3) return up ? 9 : 14;
  if (h >= 18 && h <= 45 && s > 0.35 && v < 0.78 && v > 0.15) return 1;
  if (h >= 25 && h <= 55 && s > 0.1 && s < 0.45 && v > 0.55) return 2;
  if ((h < 18 || h > 340) && s > 0.4 && v > 0.25 && v < 0.75) return slope ? 8 : 3;
  if (s < 0.12 && slope) return 8;
  if (s < 0.14 && v > 0.25) return 4;
  return 0;
}

// ---------- Mesh-Builder (pos3 nor3 col3 uv2) ----------
class MB {
  constructor() { this.a = []; this.S = [M4.I()]; }
  get m() { return this.S[this.S.length - 1]; }
  push(m) { this.S.push(M4.mul(this.m, m)); return this; }
  pop() { this.S.pop(); return this; }
  at(x, y, z, ry = 0, s = 1) { return this.push(M4.chain(M4.T(x, y, z), M4.RY(ry * DEG), M4.S(s))); }
  fixMat(C, f) { const sv = this.mat; if (sv === undefined && !MAT.map) this.mat = MAT.auto && !this.nomat ? autoMat(col(C), [1, 0, 0]) : 0; f(); this.mat = sv; return this; }  // runde Formen: ein Material für das ganze Teil
  mid(C, fn) { return this.mat ?? (MAT.map ? (MAT.map.get(matKey(C)) || 0) : (MAT.auto && !this.nomat ? autoMat(C, V3.norm(M4.xd(this.m, fn))) : 0)); }  // eine Material-Kennung pro Dreieck (sonst Farbfehler)
  v(p, n, c, t, id = 0) { const m = this.m, P = M4.xp(m, p), N = V3.norm(M4.xd(m, n)); this.a.push(P[0], P[1], P[2], N[0], N[1], N[2], c[0] + 2 * id, c[1], c[2], t ? t[0] : 0, t ? t[1] : 0); }
  tri(a, b, c, C, ta, tb, tc) { const n = V3.norm(V3.cross(V3.sub(b, a), V3.sub(c, a))), id = this.mid(C, n); this.v(a, n, C, ta, id); this.v(b, n, C, tb, id); this.v(c, n, C, tc, id); }
  triN(a, b, c, na, nb, nc, C, ta, tb, tc) { const id = this.mid(C, V3.norm(V3.add(V3.add(na, nb), nc))); this.v(a, na, C, ta, id); this.v(b, nb, C, tb, id); this.v(c, nc, C, tc, id); }
  quad(a, b, c, d, C, ta, tb, tc, td) { this.tri(a, b, c, C, ta, tb, tc); this.tri(a, c, d, C, ta, tc, td); return this; }
  box(sx, sy, sz, C, o = {}) {
    C = col(C); const x = sx / 2, y = sy / 2, z = sz / 2, y0 = o.base ? y : 0; const P = (a, b, c) => [a, b + y0, c];
    const top = o.top ? col(o.top) : C, front = o.front ? col(o.front) : C, uv = o.uv;
    this.quad(P(-x, -y, z), P(x, -y, z), P(x, y, z), P(-x, y, z), front, uv && [0, 1], uv && [1, 1], uv && [1, 0], uv && [0, 0]);
    this.quad(P(x, -y, -z), P(-x, -y, -z), P(-x, y, -z), P(x, y, -z), C);
    this.quad(P(x, -y, z), P(x, -y, -z), P(x, y, -z), P(x, y, z), C);
    this.quad(P(-x, -y, -z), P(-x, -y, z), P(-x, y, z), P(-x, y, -z), C);
    this.quad(P(-x, y, z), P(x, y, z), P(x, y, -z), P(-x, y, -z), top);
    this.quad(P(-x, -y, -z), P(x, -y, -z), P(x, -y, z), P(-x, -y, z), C);
    return this;
  }
  rbox(sx, sy, sz, r, C, o = {}) { return this.fixMat(C, () => this._rbox(sx, sy, sz, r, C, o)); }
  _rbox(sx, sy, sz, r, C, o = {}) {
    C = col(C); const h = [sx / 2, sy / 2, sz / 2]; r = Math.min(r, h[0] * .98, h[1] * .98, h[2] * .98);
    const inner = h.map(v => v - r), k = 0.5858 * r, y0 = o.base ? h[1] : 0;
    const samp = hv => [-hv, -hv + k, -hv + r, hv - r, hv - k, hv];
    for (const [ax, sg] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
      const u = (ax + 1) % 3, w = (ax + 2) % 3, su = samp(h[u]), sw = samp(h[w]);
      const P = [], N = [], T = [];
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
        const q = [0, 0, 0]; q[ax] = sg * h[ax]; q[u] = su[i]; q[w] = sw[j];
        const c = q.map((x, kk) => clamp(x, -inner[kk], inner[kk])); const d = V3.sub(q, c), dl = V3.len(d);
        let n, p; if (dl < 1e-6) { n = [0, 0, 0]; n[ax] = sg; p = q.slice(); } else { n = V3.mul(d, 1 / dl); p = V3.add(c, V3.mul(n, r)); }
        p[1] += y0; P.push(p); N.push(n);
        T.push(o.uv && ax === 2 && sg === 1 ? [q[0] / sx + 0.5, 0.5 - q[1] / sy] : [0, 0]);
      }
      const fc = (ax === 1 && sg === 1 && o.top) ? col(o.top) : C;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        const a = i * 6 + j, b = a + 6, c = a + 7, d = a + 1;
        // Wicklung so, dass sie nach außen zeigt (für Konsistenz; Licht nutzt Normalen)
        this.triN(P[a], P[b], P[c], N[a], N[b], N[c], fc, T[a], T[b], T[c]);
        this.triN(P[a], P[c], P[d], N[a], N[c], N[d], fc, T[a], T[c], T[d]);
      }
    }
    return this;
  }
  cyl(r1, r2, h, seg, C, o = {}) { return this.fixMat(C, () => this._cyl(r1, r2, h, seg, C, o)); }
  _cyl(r1, r2, h, seg, C, o = {}) {
    C = col(C); const flat = o.flat !== false, top = o.top ? col(o.top) : C, k = (r1 - r2) / h, rot = o.rot || 0;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2 + rot, a1 = (i + 1) / seg * Math.PI * 2 + rot;
      const p0 = [Math.sin(a0) * r1, 0, Math.cos(a0) * r1], p1 = [Math.sin(a1) * r1, 0, Math.cos(a1) * r1];
      const q0 = [Math.sin(a0) * r2, h, Math.cos(a0) * r2], q1 = [Math.sin(a1) * r2, h, Math.cos(a1) * r2];
      const cc = o.stripe && (i % 2) ? col(o.stripe) : C;
      if (flat) { this.tri(p0, p1, q1, cc); if (r2 > 0) this.tri(p0, q1, q0, cc); }
      else {
        const n0 = V3.norm([Math.sin(a0), k, Math.cos(a0)]), n1 = V3.norm([Math.sin(a1), k, Math.cos(a1)]);
        this.triN(p0, p1, q1, n0, n1, n1, cc); if (r2 > 0) this.triN(p0, q1, q0, n0, n1, n0, cc);
      }
      if (o.cap !== false) { if (r2 > 0) this.tri([0, h, 0], q0, q1, top); this.tri([0, 0, 0], p1, p0, C); }
    }
    return this;
  }
  sphere(r, det, C, o = {}) { return this.fixMat(C, () => this._sphere(r, det, C, o)); }
  _sphere(r, det, C, o = {}) {
    C = col(C); const sx = (o.sx || 1) * r, sy = (o.sy || 1) * r, sz = (o.sz || 1) * r; const { V, F } = ICO(det); const R = o.jit ? rng(o.seed || 7) : null;
    const P = V.map(v => { const k = R ? 1 + (R() - 0.5) * o.jit : 1; return [v[0] * sx * k, v[1] * sy * k, v[2] * sz * k]; });
    for (const f of F) {
      const a = P[f[0]], b = P[f[1]], c = P[f[2]];
      let cc = C; if (o.colFn) cc = col(o.colFn(a, b, c));
      if (o.flat) this.tri(a, b, c, cc);
      else { const n = i => V3.norm([P[i][0] / (sx * sx), P[i][1] / (sy * sy), P[i][2] / (sz * sz)]); this.triN(a, b, c, n(f[0]), n(f[1]), n(f[2]), cc); }
    }
    return this;
  }
  prism(w, h, d, C, o = {}) {
    C = col(C); const g = o.gable ? col(o.gable) : C; const x = w / 2, z = d / 2;
    const A = [-x, 0, z], B = [x, 0, z], Ct = [x, h, 0], D = [-x, h, 0], E = [-x, 0, -z], F = [x, 0, -z];
    this.quad(A, B, Ct, D, C); this.quad(F, E, D, Ct, C); this.tri(B, F, Ct, g); this.tri(E, A, D, g); this.quad(E, F, B, A, C);
    return this;
  }
  disc(r, seg, C) { C = col(C); for (let i = 0; i < seg; i++) { const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2; this.tri([0, 0, 0], [Math.sin(a0) * r, 0, Math.cos(a0) * r], [Math.sin(a1) * r, 0, Math.cos(a1) * r], C); } return this; }
  hquad(w, d, C) { C = col(C); const x = w / 2, z = d / 2; return this.quad([-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z], C); }
  tquad(w, h, C) { C = col(C || '#ffffff'); const x = w / 2, y = h / 2; return this.quad([-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], C, [0, 1], [1, 1], [1, 0], [0, 0]); }
}

// ---------- Shader ----------
// Licht: Halbkugel-Umgebung + Sonne mit weichen PCF-Schatten, Glanzlicht, Randlicht, Kontakt-Abdunklung,
// Bodenmaserung, Wasser (bewegte Normalen + Glitzern), Wind (Bäume wiegen sich), weiche Lichter-Kompression.
const VS = `#version 300 es
layout(location=0) in vec3 aP;layout(location=1) in vec3 aN;layout(location=2) in vec3 aC;layout(location=3) in vec2 aT;
uniform mat4 uM,uVP,uLVP;uniform vec3 uEye;uniform float uFogD,uTime,uSway;out vec3 vN,vC,vW,vO,vON;out vec2 vT;out vec4 vL;out float vF;
vec3 sway(vec3 w){float h=max(0.0,w.y-1.2);float k=uSway*h*h/(1.0+h);
 w.x+=(sin(uTime*1.7+w.x*0.31+w.z*0.17)+0.4*sin(uTime*3.9+w.z*0.7))*0.035*k;w.z+=sin(uTime*1.3+w.x*0.23)*0.025*k;return w;}
void main(){vec4 w=uM*vec4(aP,1.0);if(uSway>0.0)w.xyz=sway(w.xyz);vN=mat3(uM)*aN;vC=aC;vT=aT;vO=aP;vON=aN;vW=w.xyz;vL=uLVP*w;
 float d=length(w.xyz-uEye)/uFogD;vF=clamp(1.0-exp(-d*d),0.0,1.0);gl_Position=uVP*w;}`;
const FS_SRC = `
precision highp float;precision highp sampler2DShadow;
in vec3 vN,vC,vW,vO,vON;in vec2 vT;in vec4 vL;in float vF;
uniform sampler2D uTex;uniform sampler2DShadow uSh;
uniform vec3 uTint,uSun,uSunC,uSkyC,uGndC,uFogC,uEye;uniform float uEmi,uAlpha,uSR,uRecv,uHT,uTA,uTime,uSpec,uRim,uGrain,uWater,uAO,uNight;
out vec4 o;
#ifdef GRAIN
uniform sampler2D uNz;
#endif
#ifdef HQ
#ifndef GRAIN
uniform sampler2D uNz;
#endif
float hh(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float tn(vec2 q){return texture(uNz,q*0.0625).r;}
float tg(vec2 q){return texture(uNz,q*0.0625).g;}
vec3 matC(float id,vec3 c,vec3 p,vec3 on){vec3 a=abs(on);vec2 uv=a.y>a.x&&a.y>a.z?p.xz:(a.x>a.z?p.zy:p.xy);float k=1.0;
 if(id<1.5){float g=tn(vec2(uv.x*0.5,uv.y*5.0));k=0.86+0.22*g+0.06*sin(uv.y*26.0+g*9.0);float pl=fract(uv.x*1.1);k*=mix(0.82,1.0,smoothstep(0.0,0.04,pl)*smoothstep(1.0,0.96,pl));}
 else if(id<2.5){vec2 q=uv*vec2(1.6,2.4);q.x+=step(1.0,mod(q.y,2.0))*0.5;vec2 f=fract(q);float m=smoothstep(0.0,0.06,f.x)*smoothstep(1.0,0.94,f.x)*smoothstep(0.0,0.08,f.y)*smoothstep(1.0,0.92,f.y);
  k=mix(0.72,0.9+0.2*hh(vec3(floor(q),3.0))+0.08*tg(uv*3.0),m);}
 else if(id<3.5){vec2 q=uv*vec2(2.6,5.2);q.x+=step(1.0,mod(q.y,2.0))*0.5;vec2 f=fract(q);float m=smoothstep(0.0,0.08,f.x)*smoothstep(1.0,0.92,f.x)*smoothstep(0.0,0.12,f.y)*smoothstep(1.0,0.88,f.y);
  k=mix(0.78,0.88+0.22*hh(vec3(floor(q),5.0)),m);}
 else if(id<4.5){k=0.93+0.1*tn(uv*1.6)+0.05*(tg(uv*14.0)-0.5);}
 else if(id<5.5){k=0.95+0.05*sin(uv.x*90.0)*sin(uv.y*90.0)+0.08*(tn(uv*1.3)-0.5);}
 else if(id<6.5){float f=tn(uv*1.4);k=0.9+0.08*sin((uv.x+uv.y)*70.0)+0.12*(f-0.4);c=mix(c,c*vec3(1.08,1.1,1.18),f*0.5);}
 else if(id<7.5){vec2 q=uv*vec2(9.0,12.0);float v=abs(fract(q.x)-0.5)*2.0;k=0.86+0.2*smoothstep(0.2,0.8,abs(fract(q.y+v*0.5)-0.5)*2.0);}
 else if(id<8.5){vec2 q=uv*vec2(1.4,3.2);q.x+=step(1.0,mod(q.y,2.0))*0.5;vec2 f=fract(q);k=(0.82+0.22*hh(vec3(floor(q),9.0)))*mix(0.7,1.0,smoothstep(0.0,0.2,f.y));}
 else if(id<9.5){float g=tn(uv*0.35);k=0.82+0.3*g+0.1*(tg(uv*6.0)-0.5);c=mix(c,c*vec3(1.15,1.05,0.75),smoothstep(0.55,0.8,tg(uv*0.12))*0.5);}
 else if(id<10.5){k=0.94+0.06*tn(vec2(uv.x*30.0,uv.y*1.0));}
 else if(id<11.5){k=0.85+0.22*tn(vec2((p.x+p.z)*20.0,p.y*1.5));}
 else if(id<12.5){float y=fract(p.y*1.8);k=mix(0.8,1.04,smoothstep(0.0,0.12,y))*(0.96+0.06*tn(uv*2.0));}
 else if(id<13.5){k=0.97+0.05*tn(uv*0.8);if(hh(floor(p*22.0))>0.985)k=1.25;}
 else {k=0.75+0.45*tn(uv*1.2);}
 return c*k;}
#endif
void main(){vec3 n=normalize(vN);
 float mid=floor(vC.r*0.5+0.0001);vec3 vc=vec3(vC.r-2.0*mid,vC.g,vC.b);
#ifdef HQ
 if(mid>0.5&&uEmi<0.5)vc=matC(mid,vc,vO,normalize(vON));
#endif
 vec4 tx=uHT>0.5?texture(uTex,vT):vec4(0.0);vec3 base=uTA>0.5?vc*uTint:vc*uTint*(1.0-tx.a)+tx.rgb;
 vec3 V=normalize(uEye-vW);
#ifdef GRAIN
 if(n.y>0.8){float g=texture(uNz,vW.xz*0.006).r*0.65+texture(uNz,vW.xz*0.05).g*0.35;base*=1.0+uGrain*1.4*(g-0.5);}
#endif
#ifdef WATER
 {vec2 q=vW.xz;float a=uTime;
  vec3 dn=vec3(sin(q.x*1.7+a*1.9)+0.6*sin(q.x*0.6-q.y*1.1+a*1.3)+0.4*sin(q.x*3.3+q.y*2.7-a*2.6),0.0,
               cos(q.y*1.5-a*1.6)+0.6*cos(q.y*0.7+q.x*0.9+a*1.1)+0.4*cos(q.y*3.1-q.x*2.3+a*2.2));
  n=normalize(n+dn*0.09);base*=0.92+0.16*(0.5+0.5*sin(q.x*0.31+q.y*0.23+a*0.6)*sin(q.y*0.37-a*0.45));}
#endif
 float d=max(dot(n,uSun),0.0);float sh=1.0;
 if(uRecv>0.5&&d>0.0){vec3 p=vL.xyz/vL.w*0.5+0.5;if(p.x>0.0&&p.x<1.0&&p.y>0.0&&p.y<1.0&&p.z<1.0){float bz=p.z-0.0005-0.0018*(1.0-d);
#ifdef HQ
 float t=0.0;vec2 px=vec2(1.6/uSR);for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)t+=texture(uSh,vec3(p.xy+vec2(float(i),float(j))*px*1.4,bz));sh=t/9.0;
#else
 sh=texture(uSh,vec3(p.xy,bz));
#endif
}}
 vec3 hemi=mix(uGndC,uSkyC,n.y*0.5+0.5);
 float ao=(uAO>0.0&&n.y<0.6)?mix(0.72,1.0,clamp(vW.y*0.9,0.0,1.0)):1.0;
 vec3 c=base*(hemi*ao+uSunC*d*sh);
 vec3 H=normalize(uSun+V);float nh=max(dot(n,H),0.0);
#ifdef WATER
 float sp=pow(nh,140.0)*2.2*sh;
#else
 float n2=nh*nh;n2*=n2;n2*=n2;n2*=n2;float sp=n2*n2*uSpec*sh;
#endif
 c+=uSunC*sp*0.5*step(0.0,d);
 float r=1.0-max(dot(n,V),0.0);float rim=r*r*r*uRim;c+=mix(uSkyC,vec3(1.0),0.3)*rim*(0.6+0.4*sh);
#ifdef WATER
 c=mix(c,uSkyC*1.25,r*r*r*r*0.55);
#endif
#ifdef HQ
 if(n.y>0.9){float fr=pow(1.0-max(dot(n,V),0.0),5.0);c=mix(c,uSkyC*1.15+uSunC*0.08,fr*0.35);}
 c*=mix(0.9,1.0,sh)*1.0;
#endif
 c=mix(c,base,uEmi);
 c=mix(c,uFogC,vF);
 #ifdef HQ
 vec3 e=max(c-0.8,0.0);c=c-e+e/(1.0+e*4.5);c=clamp(c,0.0,1.0);c=c*c*(3.0-2.0*c)*0.38+c*0.62;float l=dot(c,vec3(0.299,0.587,0.114));c=mix(vec3(l),c,1.28);
#else
 vec3 e=max(c-0.82,0.0);c=c-e+e/(1.0+e*5.5);float l=dot(c,vec3(0.299,0.587,0.114));c=mix(vec3(l),c,1.12);
#endif
 o=vec4(c,uTA>0.5?uAlpha*tx.a:uAlpha);}`;
const HQD = () => (typeof window !== 'undefined' && window._hq) ? '#define HQ\n' : '';
const FS = () => '#version 300 es\n' + HQD() + FS_SRC, FSG = () => '#version 300 es\n#define GRAIN\n' + HQD() + FS_SRC, FSW = () => '#version 300 es\n#define WATER\n' + HQD() + FS_SRC;
const DVS = `#version 300 es
layout(location=0) in vec3 aP;uniform mat4 uM,uLVP;uniform float uTime,uSway;
void main(){vec4 w=uM*vec4(aP,1.0);if(uSway>0.0){float h=max(0.0,w.y-1.2);float k=uSway*h*h/(1.0+h);w.x+=(sin(uTime*1.7+w.x*0.31+w.z*0.17)+0.4*sin(uTime*3.9+w.z*0.7))*0.035*k;w.z+=sin(uTime*1.3+w.x*0.23)*0.025*k;}gl_Position=uLVP*w;}`;
const DFS = `#version 300 es
precision mediump float;out vec4 o;void main(){o=vec4(1.0);}`;
const SVS = `#version 300 es
out vec2 vP;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.0-1.0;vP=p;gl_Position=vec4(p,0.999,1.0);}`;
const SFS_SRC = `precision highp float;in vec2 vP;uniform mat4 uIVP;uniform vec3 uTop,uHor,uSunD,uSunC;uniform float uNight;out vec4 o;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
void main(){vec4 a=uIVP*vec4(vP,-1.0,1.0);vec4 b=uIVP*vec4(vP,1.0,1.0);vec3 d=normalize(b.xyz/b.w-a.xyz/a.w);
 float y=d.y;vec3 c=mix(uHor,uTop,pow(clamp(y,0.0,1.0),0.55));
 c=mix(c,uHor*1.06,exp(-max(y,0.0)*14.0)*0.5);
 float sd=max(dot(d,normalize(uSunD)),0.0);
 c+=uSunC*(pow(sd,8.0)*0.18+pow(sd,90.0)*0.35)*(1.0-uNight*0.6);
 c=mix(c,mix(vec3(1.0,0.98,0.9),vec3(0.92,0.95,1.0),uNight),smoothstep(0.9993,0.9997,sd));
 if(uNight>0.01&&y>0.04){vec2 g=vec2(atan(d.z,d.x)*90.0,y*110.0);vec2 id=floor(g);float s=h21(id);
  if(s>0.982){vec2 f=fract(g)-0.5;float m=smoothstep(0.32,0.0,length(f));c+=vec3(m*uNight*0.9*(0.6+0.4*h21(id+3.1)));}}
#ifdef HQ
 if(y>0.0){vec2 q=d.xz/(y+0.12)*1.6;float f=0.0,a=0.5;vec2 z=q;for(int i=0;i<5;i++){f+=a*vn(z);z=z*2.03+vec2(1.7,9.2);a*=0.5;}
  float cl=smoothstep(0.48,0.78,f)*smoothstep(0.0,0.18,y);vec3 cc=mix(vec3(1.0),uHor*0.92,0.25)*(1.0-uNight*0.85);
  cc*=0.82+0.25*smoothstep(0.45,0.9,f);c=mix(c,cc,cl*0.85);}
#endif
 o=vec4(c,1.0);}`;
const SFS = '#version 300 es\n' + SFS_SRC;

const PFS = `#version 300 es
precision highp float;in vec2 vP;uniform sampler2D uC,uD;uniform vec2 uPx;uniform float uN,uF,uFoc,uDof,uAo,uNight;out vec4 o;
float lz(vec2 t){float d=texture(uD,t).r*2.0-1.0;return 2.0*uN*uF/(uF+uN-d*(uF-uN));}
void main(){vec2 t=vP*0.5+0.5;float z=lz(t);vec3 c=texture(uC,t).rgb;
 // SSAO (Bildraum): Nachbarn deutlich näher an der Kamera -> Ecke/Kontakt -> abdunkeln
 float occ=0.0;float rad=clamp(0.9/z/uPx.y*0.02,2.0,40.0);
 for(int i=0;i<12;i++){float a=float(i)*2.399+fract(sin(dot(t,vec2(12.9,78.2)))*43758.5)*6.28;float r=rad*(0.35+0.65*fract(float(i)*0.618));
  vec2 s=t+vec2(cos(a),sin(a))*r*uPx;float zs=lz(s);float dz=z-zs;occ+=smoothstep(0.02*z,0.12*z,dz)*(1.0-smoothstep(0.6*z,1.2*z,dz))*step(z,uF*0.9);}
 c*=1.0-uAo*occ/12.0;
 // Tiefenunschärfe: nur Hintergrund (hinter dem Fokus), Kinolook
 float coc=clamp((z-uFoc*1.15)/max(z,1.0),0.0,1.0)*uDof/uPx.y*0.012;
 if(coc>0.6){vec3 acc=c;float w=1.0;for(int i=0;i<16;i++){float a=float(i)*2.399;float r=sqrt((float(i)+0.5)/16.0)*coc;vec2 s=t+vec2(cos(a),sin(a))*r*uPx;
   float zs=lz(s);if(zs>uFoc*0.9){acc+=texture(uC,s).rgb;w+=1.0;}}c=acc/w;}
 o=vec4(c,1.0);}`;

class GLR {
  constructor(canvas) {
    const gl = this.gl = canvas.getContext('webgl2', { antialias: !window._noaa, preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('WebGL2 fehlt');
    this.W = canvas.width; this.H = canvas.height;
    this.p = this.mk(VS, FS()); this.pg = this.mk(VS, FSG()); this.pw = this.mk(VS, FSW()); this.dp = this.mk(DVS, DFS); this.sp = this.mk(SVS, (window._hq ? '#version 300 es\n#define HQ\n' : '#version 300 es\n') + SFS_SRC);
    this.SR = window._hq ? 2048 : 2048;
    this.stex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.stex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.SR, this.SR, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.sfb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.sfb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.stex, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const c = document.createElement('canvas'); c.width = c.height = 1; this.blank = this.tex(c);
    { const N = 256, nc = document.createElement('canvas'); nc.width = nc.height = N; const x = nc.getContext('2d'), R0 = rng(4242), id = x.createImageData(N, N);
      const grid = (k, s) => { const g = []; for (let i = 0; i < k * k; i++) g.push(R0()); return (px, py) => { const fx = px / N * k, fy = py / N * k, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sm = t => t * t * (3 - 2 * t), G = (a, b) => g[((b % k + k) % k) * k + ((a % k + k) % k)]; return lerp(lerp(G(ix, iy), G(ix + 1, iy), sm(tx)), lerp(G(ix, iy + 1), G(ix + 1, iy + 1), sm(tx)), sm(ty)); }; };
      const A = grid(8), B = grid(32), C = grid(16), D = grid(64);
      for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) { const o = (py * N + px) * 4; id.data[o] = 255 * (A(px, py) * 0.7 + B(px, py) * 0.3); id.data[o + 1] = 255 * (C(px, py) * 0.6 + D(px, py) * 0.4); id.data[o + 2] = 128; id.data[o + 3] = 255; }
      x.putImageData(id, 0, 0); this.nz = this.tex(nc); gl.bindTexture(gl.TEXTURE_2D, this.nz); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); }
    this.evao = gl.createVertexArray(); this.I = M4.I();
    if (window._hq) this.initPost();
  }
  initPost() {
    const gl = this.gl, W = this.W, H = this.H;
    this.pp = this.mk(SVS, PFS);
    this.msfb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.msfb);
    const ns = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    const cr = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, cr); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, ns, gl.RGBA8, W, H); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, cr);
    const dr = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, dr); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, ns, gl.DEPTH_COMPONENT24, W, H); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, dr);
    const mkT = (ifmt, fmt, type) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, W, H, 0, fmt, type, null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
    this.ctex = mkT(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE); this.dtex = mkT(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
    gl.bindTexture(gl.TEXTURE_2D, this.ctex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.rfb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.rfb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.ctex, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.dtex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  post(cam, env) {
    const gl = this.gl, W = this.W, H = this.H;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msfb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.rfb);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    const u = this.pp.u; gl.useProgram(this.pp.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.ctex); gl.uniform1i(u.uC, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.dtex); gl.uniform1i(u.uD, 1);
    gl.uniform2f(u.uPx, 1 / W, 1 / H); gl.uniform1f(u.uN, cam.near || 0.25); gl.uniform1f(u.uF, cam.far || 1400);
    const foc = cam.focus || Math.hypot(cam.look[0] - cam.eye[0], cam.look[1] - cam.eye[1], cam.look[2] - cam.eye[2]);
    gl.uniform1f(u.uFoc, foc); gl.uniform1f(u.uDof, cam.dof ?? env.dof ?? 0.55); gl.uniform1f(u.uAo, env.ssao ?? 0.55); gl.uniform1f(u.uNight, env.night || 0);
    gl.bindVertexArray(this.evao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  }
  mk(vs, fs) {
    const gl = this.gl, p = gl.createProgram();
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p, u };
  }
  geo(mb) {
    const gl = this.gl, data = new Float32Array(mb.a || mb), vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const st = 44; [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 2, 36]].forEach(([l, n, o]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, st, o); });
    gl.bindVertexArray(null); return { vao, n: data.length / 11 };
  }
  tex(canvas) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // items: {g, m, tex, tint, e (emissiv 0..1), a (alpha), sh (wirft Schatten)}
  render(items, cam, env) {
    const gl = this.gl, I = this.I;
    const view = M4.look(cam.eye, cam.look, cam.up || [0, 1, 0]);
    const proj = M4.persp(cam.fov * DEG, this.W / this.H, cam.near || 0.25, cam.far || 1400);
    const VP = M4.mul(proj, view); this.VP = VP;
    const S = env.shR || 34; const sd0 = V3.norm(env.sun), sd = sd0, c = cam.shadowAt || cam.look;
    const LV = M4.look(V3.add(c, V3.mul(sd, 140)), c, Math.abs(sd[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0]);
    const LVP = M4.mul(M4.ortho(-S, S, -S, S, 1, 300), LV);
    // Schatten
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sfb); gl.viewport(0, 0, this.SR, this.SR); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.dp.p); gl.uniformMatrix4fv(this.dp.u.uLVP, false, LVP); gl.uniform1f(this.dp.u.uTime, env.time || 0);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.6, 3.0);
    for (const it of items) { if (it.sh === false || (it.a !== undefined && it.a < 0.99)) continue; gl.uniformMatrix4fv(this.dp.u.uM, false, it.m || I); gl.uniform1f(this.dp.u.uSway, it.sway || 0); gl.bindVertexArray(it.g.vao); gl.drawArrays(gl.TRIANGLES, 0, it.g.n); }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    // Haupt
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msfb || null); gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.useProgram(this.sp.p);
    gl.uniformMatrix4fv(this.sp.u.uIVP, false, M4.inv(VP)); gl.uniform3fv(this.sp.u.uTop, col(env.skyTop)); gl.uniform3fv(this.sp.u.uHor, col(env.skyHor)); gl.uniform1f(this.sp.u.uNight, env.night || 0); gl.uniform3fv(this.sp.u.uSunD, sd); gl.uniform3fv(this.sp.u.uSunC, V3.mul(col(env.sunC), env.sunI));
    gl.bindVertexArray(this.evao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    for (const P of [this.p, this.pg, this.pw]) { const u = P.u; gl.useProgram(P.p);
      gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniformMatrix4fv(u.uLVP, false, LVP);
      gl.uniform3fv(u.uSun, sd); gl.uniform3fv(u.uSunC, V3.mul(col(env.sunC), env.sunI)); gl.uniform3fv(u.uSkyC, env.ambSky); gl.uniform3fv(u.uGndC, env.ambGnd);
      gl.uniform3fv(u.uFogC, col(env.fog)); gl.uniform1f(u.uFogD, env.fogD); gl.uniform3fv(u.uEye, cam.eye); gl.uniform1f(u.uSR, this.SR);
      gl.uniform1i(u.uTex, 0); gl.uniform1i(u.uSh, 1); if (u.uNz) gl.uniform1i(u.uNz, 2); gl.uniform1f(u.uTime, env.time || 0); gl.uniform1f(u.uNight, env.night || 0); }
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.nz);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.stex);
    let cur = null, u = null;
    const draw = it => {
      const P = it.water ? this.pw : (it.grain ? this.pg : this.p); if (P !== cur) { cur = P; u = P.u; gl.useProgram(P.p); }
      gl.uniformMatrix4fv(u.uM, false, it.m || I); gl.uniform3fv(u.uTint, it.tint || [1, 1, 1]); gl.uniform1f(u.uEmi, it.e || 0); gl.uniform1f(u.uAlpha, it.a === undefined ? 1 : it.a); gl.uniform1f(u.uRecv, it.recv === false ? 0 : 1); gl.uniform1f(u.uHT, it.tex ? 1 : 0); gl.uniform1f(u.uTA, it.ta ? 1 : 0);
      gl.uniform1f(u.uSpec, it.spec ?? 0.18); gl.uniform1f(u.uRim, it.rim ?? 0.08); gl.uniform1f(u.uGrain, it.grain || 0); gl.uniform1f(u.uWater, it.water || 0); gl.uniform1f(u.uAO, it.ao ?? 1); gl.uniform1f(u.uSway, it.sway || 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, it.tex || this.blank);
      gl.bindVertexArray(it.g.vao); gl.drawArrays(gl.TRIANGLES, 0, it.g.n);
    };
    const tr = [];
    for (const it of items) { if (it.a !== undefined && it.a < 0.99) tr.push(it); else draw(it); }
    if (tr.length) {
      const ds = it => { const m = it.m || I; return Math.hypot(m[12] - cam.eye[0], m[13] - cam.eye[1], m[14] - cam.eye[2]) + (it.zb || 0); };
      tr.sort((a, b) => ds(b) - ds(a)); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      for (const it of tr) if (it.a > 0.003) { gl.blendFunc(gl.SRC_ALPHA, it.add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); draw(it); }
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    if (this.msfb) this.post(cam, env);
  }
}
