'use strict';
// ============ sets.js – Orte (Bühne um den Ursprung, Kamera standardmäßig bei +z) ============
class SB {
  constructor() { this.mb = new MB(); this.win = new MB(); this.lamp = new MB(); this.ns = new MB(); this.glow = new MB(); this.skywin = new MB(); this.fol = new MB(); this.tx = []; this.items = []; this.bg = 'town'; this.wide = { eye: [0, 10, 26], look: [0, 3, -6] }; this.indoor = false; this.bounds = null; }
  all() { return [this.mb, this.win, this.lamp, this.ns, this.glow, this.skywin, this.fol]; }
  push(m) { for (const b of this.all()) b.push(m); return this; }
  pop() { for (const b of this.all()) b.pop(); return this; }
  at(x, y, z, ry = 0, s = 1) { return this.push(M4.chain(M4.T(x, y, z), M4.RY(ry * DEG), M4.S(s))); }
  sign(text, w, h, o = {}, local = M4.I()) { const mb = new MB(); mb.box(w, h, o.depth || 0.2, '#ffffff', { uv: true }); this.tx.push({ g: GL.geo(mb), m: M4.mul(this.mb.m, local), tex: signTex(text, { ...o, tw: o.tw || 512, th: o.th || Math.max(64, Math.round(512 * h / w)) }), e: o.e || 0 }); }
  texq(tex, w, h, local, e = 0) { const mb = new MB(); mb.tquad(w, h); this.tx.push({ g: GL.geo(mb), m: M4.mul(this.mb.m, local), tex, e }); }
  water(build, a = 0.85, c = null) { const mb = new MB(); mb.S = [this.mb.m.slice()]; build(mb); this.items.push({ g: GL.geo(mb), a, e: 0.06, sh: false, water: 1 }); }
  prop(type, x, z, ry = 0, o = {}) { propItems(this.items, type, o, M4.mul(this.mb.m, M4.chain(M4.T(x, o.y || 0, z), M4.RY(ry * DEG), M4.S(o.s || 1)))); }
}
const P_ = (mb, x, y, z, f) => { mb.push(M4.T(x, y, z)); f(); mb.pop(); };
function groundPlane(mb, c = '#7ccf4a', size = 360) { P_(mb, 0, -0.1, 0, () => mb.box(size, 0.2, size, c)); }
function winPane(S, x, y, z, ww, wh, trim = '#ffffff') {
  P_(S.mb, x, y, z + 0.05, () => S.mb.box(ww + 0.4, wh + 0.4, 0.16, trim));
  P_(S.win, x, y, z + 0.1, () => S.win.box(ww, wh, 0.16, '#ffffff'));
  P_(S.mb, x, y, z + 0.2, () => { S.mb.box(ww, 0.14, 0.06, trim); S.mb.box(0.14, wh, 0.06, trim); });
  P_(S.mb, x, y - wh / 2 - 0.22, z + 0.25, () => S.mb.box(ww + 0.7, 0.18, 0.45, trim));
}
function house(S, x, z, ry, o = {}) {
  const w = o.w || 10, h = o.h || 7, d = o.d || 8, wall = o.wall || '#f6d55c', roof = o.roof || '#d9483b', door = o.door || '#c0392b', trim = o.trim || '#ffffff', mb = S.mb, dx = o.doorX || 0;
  S.at(x, 0, z, ry);
  P_(mb, 0, h / 2, 0, () => mb.box(w, h, d, wall));
  P_(mb, 0, 0.25, 0, () => mb.box(w + 0.3, 0.5, d + 0.3, '#bfc5cc'));
  if (o.flat) { P_(mb, 0, h + 0.3, 0, () => mb.box(w + 0.8, 0.6, d + 0.8, roof)); }
  else { P_(mb, 0, h, 0, () => mb.prism(w + 1.4, Math.min(h * 0.42, 4.2), d + 1.6, roof, { gable: wall })); P_(mb, 0, h - 0.1, 0, () => mb.box(w + 0.5, 0.32, d + 0.5, trim)); }
  if (o.chimney) P_(mb, w * 0.28, h + 1.6, -d * 0.15, () => mb.box(1.0, 2.6, 1.0, '#b5523b'));
  if (o.door !== false) {
    const dw = o.doorW || 1.8;
    P_(mb, dx, 1.95, d / 2 + 0.1, () => mb.box(dw + 0.5, 3.9 + 0.2, 0.2, trim));
    P_(mb, dx, 1.85, d / 2 + 0.18, () => mb.box(dw, 3.6, 0.2, door));
    P_(mb, dx + dw * 0.3, 1.85, d / 2 + 0.34, () => mb.sphere(0.13, 1, '#f5c518'));
    P_(mb, dx, 0.15, d / 2 + 0.8, () => mb.box(dw + 1.2, 0.3, 1.3, '#c9ced6'));
    if (o.awning) P_(mb, dx, 4.3, d / 2 + 0.8, () => mb.box(dw + 1.6, 0.25, 1.6, roof));
  }
  const floors = o.floors || Math.max(1, Math.floor((h - 1) / 3.4)), cols = o.cols || Math.max(1, Math.floor((w - 1.5) / 3.3));
  for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
    const wx = -w / 2 + (c + 0.5) * w / cols, wy = 2.6 + f * 3.4;
    if (f === 0 && o.door !== false && Math.abs(wx - dx) < (o.doorW || 1.8) / 2 + 1.4) continue;
    if (wy + 1 > h) continue;
    winPane(S, wx, wy, d / 2, 1.6, 1.8, trim);
  }
  S.pop();
}
function shop(S, x, z, ry, o) {
  house(S, x, z, ry, { flat: true, w: o.w || 11, h: o.h || 8, d: 8, wall: o.wall, roof: o.roof || '#ffffff', door: o.door || '#2d6a4f', cols: 2, floors: 2 });
  S.at(x, 0, z, ry);
  for (let i = 0; i < 8; i++) P_(S.mb, -(o.w || 11) / 2 + 0.7 + i * ((o.w || 11) - 1.4) / 7, 4.6, 4.9, () => { S.mb.push(M4.RX(0.35)); S.mb.box(((o.w || 11) - 1.4) / 7.6, 0.14, 2.0, i % 2 ? '#ffffff' : (o.stripe || '#e63946')); S.mb.pop(); });
  if (o.text) S.sign(o.text, 6, 1.3, { bg: o.signBg || '#1d1712', fg: '#ffffff', border: null }, M4.T(0, 5.9, 4.2));
  S.pop();
}
const WALLS = ['#ffd23f', '#74b9ff', '#ff9ff3', '#fff1d6', '#55efc4', '#fab1a0', '#a29bfe', '#ffeaa7'];
const ROOFS = ['#e74c3c', '#2d3e8c', '#8e44ad', '#e67e22', '#c0392b', '#16a085'];

const SETS = {
  street(S, o) {
    const mb = S.mb; groundPlane(mb);
    P_(mb, 0, 0.08, -0.4, () => mb.box(320, 0.16, 7.6, '#d5dae0'));
    P_(mb, 0, 0.13, 3.5, () => mb.box(320, 0.26, 0.4, '#b5bac2'));
    P_(mb, 0, 0.03, 8.6, () => mb.box(320, 0.06, 9.8, '#4b5058'));
    for (let x = -150; x < 150; x += 7) P_(mb, x, 0.07, 8.6, () => mb.box(3.4, 0.02, 0.32, '#f4f4f4'));
    P_(mb, 0, 0.08, 15.5, () => mb.box(320, 0.16, 3.8, '#d5dae0'));
    for (let i = -7; i <= 7; i++) {
      const x = i * 14, R = rng(i + 40);
      house(S, x, -14, 0, { wall: WALLS[(i + 70) % WALLS.length], roof: ROOFS[(i + 71) % ROOFS.length], w: 10 + R() * 1.5, h: 7 + R() * 2.4, d: 8, chimney: R() > 0.5, awning: R() > 0.6 });
      setFence(mb, x - 7, -4.6, x - 1.7, -4.6); setFence(mb, x + 1.7, -4.6, x + 7, -4.6);
      P_(mb, x, 0.05, -7.4, () => mb.box(2.4, 0.1, 5.6, '#cfd4da'));
      if (i % 2 === 0) setTree(S.fol, x + 7, -8, 0.9, Math.abs(i) % 3); else { setBush(S.fol, x + 4.4, -6.2, 1); setBush(S.fol, x - 4.4, -6.2, 0.9); }
      if (i % 3 === 0) { mb.at(x + 2.6, 0, -5.4); setMailbox(mb); mb.pop(); }
    }
    for (let k = -6; k <= 5; k++) setLampPost(mb, S.lamp, k * 16 + 10, 2.9);
    for (let i = -6; i <= 6; i++) house(S, i * 15 + 5, 37, 180, { wall: WALLS[(i + 73) % WALLS.length], roof: ROOFS[(i + 74) % ROOFS.length], w: 11, h: 8 });
    for (let x = -90; x <= 90; x += 18) setTree(S.fol, x, 24, 0.9, (x / 18) & 3);
    mb.push(M4.chain(M4.T(-22, 0, 6.2), M4.RY(Math.PI / 2))); setCar(mb, '#e63946'); mb.pop();
    mb.push(M4.chain(M4.T(30, 0, 11), M4.RY(-Math.PI / 2))); setCar(mb, '#1e88e5'); mb.pop();
    S.wide = { eye: [-15, 12, 25], look: [2, 3.5, -6] };
  },
  house(S, o) {
    const mb = S.mb; groundPlane(mb);
    house(S, 0, -12, 0, { w: 14, h: 8.5, d: 9, wall: o.color || '#ffd23f', roof: o.roof || '#e74c3c', door: '#d62828', awning: true, chimney: true });
    if (o.name !== '') { S.at(0, 0, -7.5); S.sign(o.name || 'ELI', 4.2, 1.5, { bg: '#1d1712', fg: '#ffd23f', border: '#ffd23f' }, M4.T(0, 5.55, 0.25)); S.pop(); }
    P_(mb, 0, 0.05, 0.5, () => mb.box(2.6, 0.1, 15, '#d6d9de'));
    for (const x of [-6, -3.4, 3.4, 6]) setBush(S.fol, x, -6.4, 0.85);
    for (let i = 0; i < 10; i++) setFlower(mb, -6.5 + i * 1.45 + (i > 4 ? 1.2 : -1.2), -5.2, ['#ff5c8a', '#ffd23f', '#9b5de5', '#ffffff'][i % 4]);
    setFence(mb, -16, 8, -1.8, 8); setFence(mb, 1.8, 8, 16, 8); setFence(mb, -16, 8, -16, -6); setFence(mb, 16, 8, 16, -6);
    mb.at(3, 0, 8.8); setMailbox(mb); mb.pop();
    P_(mb, 0, 0.08, 10.8, () => mb.box(200, 0.16, 3.6, '#d5dae0'));
    P_(mb, 0, 0.03, 17.5, () => mb.box(200, 0.06, 10, '#4b5058'));
    house(S, -24, -12, 0, { wall: '#74b9ff', roof: '#2d3e8c', w: 12, h: 7.5 }); house(S, 24, -12, 0, { wall: '#ff9ff3', roof: '#8e44ad', w: 12, h: 7.5 });
    setTree(S.fol, -11, -3, 1, 0); setTree(S.fol, 12, -2, 0.9, 1); setTree(S.fol, -19, 3, 0.8, 2);
    setLampPost(mb, S.lamp, -8, 10.5); setLampPost(mb, S.lamp, 10, 10.5);
    S.wide = { eye: [7, 6.5, 22], look: [0, 4.5, -4] };
  },
  park(S, o) {
    const mb = S.mb; groundPlane(mb, '#7fd34e');
    P_(mb, 0, 0.04, 9, () => mb.box(220, 0.08, 3.2, '#e9d6a6'));
    P_(mb, -16, 0.045, -26, () => mb.box(3.2, 0.09, 70, '#e9d6a6'));
    S.water(m => { m.push(M4.T(18, 0.08, -14)); m.disc(8, 28, '#36b3f0'); m.pop(); }, 0.88);
    P_(mb, 18, 0.02, -14, () => mb.disc(8.6, 28, '#5a8f3a'));
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; P_(mb, 18 + Math.sin(a) * 8.4, 0.2, -14 + Math.cos(a) * 8.4, () => mb.sphere(0.7, 0, '#a7adb3', { flat: true, jit: 0.4, seed: i })); }
    const R = rng(77);
    for (let i = 0; i < 46; i++) { const x = (R() - 0.5) * 120, z = -10 - R() * 60; if (Math.abs(x - 18) < 11 && Math.abs(z + 14) < 11) continue; if (Math.abs(x + 16) < 3) continue; if (R() < 0.45) setPine(S.fol, x, z, 0.8 + R() * 0.5); else setTree(S.fol, x, z, 0.8 + R() * 0.4, i % 3); }
    for (let i = 0; i < 14; i++) { const x = (R() - 0.5) * 100, z = 14 + R() * 30; setTree(S.fol, x, z, 0.9, i % 3); }
    S.prop('bench', -7, 11.2, 180); S.prop('bench', 7, 11.2, 180);
    // Spielplatz
    S.at(-28, 0, -6);
    P_(mb, 0, 3, 0, () => mb.box(3, 0.3, 3, '#e63946')); for (const [x, z] of [[1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3]]) P_(mb, x, 1.5, z, () => mb.box(0.25, 3.0, 0.25, '#1e88e5'));
    mb.push(M4.chain(M4.T(0, 1.55, 3.5), M4.RX(0.62))); mb.box(2.2, 0.2, 5.0, '#ffd23f'); mb.pop();
    for (let i = 0; i < 6; i++) P_(mb, 0, 0.5 + i * 0.5, -1.7, () => mb.box(1.8, 0.14, 0.14, '#ffffff'));
    S.pop();
    S.at(-38, 0, -2, 90);
    for (const s of [-1, 1]) { mb.push(M4.chain(M4.T(s * 3, 0, 0), M4.RX(0.25))); mb.cyl(0.15, 0.15, 5, 6, '#1e88e5'); mb.pop(); mb.push(M4.chain(M4.T(s * 3, 0, 0), M4.RX(-0.25))); mb.cyl(0.15, 0.15, 5, 6, '#1e88e5'); mb.pop(); }
    P_(mb, 0, 4.85, 0, () => mb.box(6.4, 0.25, 0.25, '#1e88e5'));
    for (const x of [-1.4, 1.4]) { for (const s of [-0.4, 0.4]) P_(mb, x + s, 3.3, 0, () => mb.box(0.05, 3.1, 0.05, '#888')); P_(mb, x, 1.7, 0, () => mb.box(1.1, 0.12, 0.5, '#e63946')); }
    S.pop();
    for (let x = -60; x <= 60; x += 20) setLampPost(mb, S.lamp, x + 10, 7.0);
    for (let i = 0; i < 16; i++) setFlower(mb, -12 + (i % 8) * 0.9, -6 - Math.floor(i / 8) * 0.9, ['#ff5c8a', '#ffd23f', '#9b5de5', '#ff7f11'][i % 4]);
    S.wide = { eye: [0, 12, 28], look: [0, 2, -6] };
  },
  school(S, o) {
    const mb = S.mb; groundPlane(mb);
    P_(mb, 0, 0.05, -6, () => mb.box(74, 0.1, 44, '#a3acb5'));
    for (const [x, z, sx, sz] of [[14, -12, 14, 0.25], [14, 0, 14, 0.25], [7, -6, 0.25, 12], [21, -6, 0.25, 12]]) P_(mb, x, 0.12, z, () => mb.box(sx, 0.02, sz, '#ffffff'));
    for (let i = 0; i < 6; i++) P_(mb, -14 + (i % 2) * 1.3, 0.12, 4 - i * 1.3, () => mb.box(1.15, 0.02, 1.15, i % 2 ? '#ffd23f' : '#ff7f11'));
    house(S, 0, -31, 0, { w: 50, h: 14, d: 12, wall: o.color || '#f2c14e', roof: '#c0392b', door: false, cols: 12, floors: 3 });
    S.at(0, 0, -24.4);
    P_(mb, 0, 4.2, 0.8, () => mb.box(11, 8.4, 2.4, shade(o.color || '#f2c14e', 0.92)));
    P_(mb, 0, 8.5, 1.0, () => mb.box(12, 0.4, 3.0, '#c0392b'));
    for (const s of [-1, 1]) P_(mb, s * 1.25, 2.1, 2.05, () => mb.box(2.3, 4.2, 0.2, '#1e6fd9'));
    P_(mb, 0, 0.2, 2.9, () => mb.box(9, 0.4, 1.8, '#c9ced6'));
    S.sign(o.name || 'SCHULE', 8, 1.7, { bg: '#ffffff', fg: '#1e6fd9', border: '#1e6fd9' }, M4.T(0, 6.6, 2.1));
    S.texq(clockTex(o.time || '08:00'), 2.6, 2.6, M4.T(0, 11.8, 0.25));
    S.pop();
    S.prop('flag', -20, -18, 0, { color: '#e63946' });
    S.at(24, 0, -14);
    mb.cyl(0.25, 0.25, 6.6, 8, '#666'); P_(mb, 0, 6.8, 0.5, () => mb.box(3.4, 2.2, 0.2, '#ffffff')); P_(mb, 0, 6.4, 0.62, () => mb.box(1.2, 0.9, 0.05, '#ff7f11'));
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; P_(mb, Math.sin(a) * 0.65, 5.9, 1.4 + Math.cos(a) * 0.65, () => mb.box(0.18, 0.1, 0.18, '#ff5a1f')); }
    S.pop();
    setFence(mb, -37, 16, -4, 16, '#2f7d4f'); setFence(mb, 4, 16, 37, 16, '#2f7d4f'); setFence(mb, -37, 16, -37, -24, '#2f7d4f'); setFence(mb, 37, 16, 37, -24, '#2f7d4f');
    for (let x = -36; x <= 36; x += 12) { setTree(S.fol, x, 20, 0.95, (x & 3)); }
    for (const x of [-44, 44]) for (let z = -20; z <= 10; z += 10) setTree(S.fol, x, z, 0.9, 1);
    S.prop('bench', -10, -18, 0); S.prop('bench', 10, -18, 0);
    S.wide = { eye: [0, 15, 30], look: [0, 5, -14] };
  },
  classroom(S, o) {
    S.bg = 'none'; S.indoor = true; S.bounds = [-11.4, 11.4, -9.4, 13.5, 9.4];
    const mb = S.mb, ns = S.ns;
    P_(mb, 0, -0.1, 2, () => mb.box(24, 0.2, 24, '#c99a63'));
    for (let x = -11; x <= 11; x += 1.6) P_(mb, x, 0.005, 2, () => mb.box(0.06, 0.02, 24, '#a87b4a'));
    P_(ns, 0, 5, -10.2, () => ns.box(24, 10.4, 0.4, '#fff1d6')); P_(ns, 0, 5, 14.2, () => ns.box(24, 10.4, 0.4, '#fff1d6'));
    P_(ns, -12.2, 5, 2, () => ns.box(0.4, 10.4, 24.8, '#cfe6ff')); P_(ns, 12.2, 5, 2, () => ns.box(0.4, 10.4, 24.8, '#cfe6ff'));
    P_(ns, 0, 10.2, 2, () => ns.box(24.8, 0.4, 24.8, '#ffffff'));
    for (const z of [-4, 3, 10]) { P_(ns, -11.95, 5.4, z, () => ns.box(0.2, 4.4, 4.2, '#ffffff')); P_(S.skywin, -11.8, 5.4, z, () => S.skywin.box(0.1, 3.8, 3.6, '#ffffff')); P_(ns, -11.7, 5.4, z, () => { ns.box(0.08, 3.8, 0.14, '#ffffff'); ns.box(0.08, 0.14, 3.6, '#ffffff'); }); }
    P_(mb, 0, 5.4, -9.85, () => mb.box(13.2, 5.8, 0.3, '#8b5a2b'));
    S.sign(o.board || '', 12.4, 5.0, { bg: '#2f5d46', fg: '#ffffff', border: null, depth: 0.1, tw: 1024, th: 412 }, M4.T(0, 5.4, -9.65));
    P_(mb, 0, 2.5, -9.6, () => mb.box(12, 0.2, 0.6, '#8b5a2b'));
    S.texq(clockTex(o.time || '08:00'), 1.8, 1.8, M4.T(9.0, 8.0, -9.95));
    for (const [x, c] of [[8.5, '#ffd23f'], [-8.5, '#ff9ff3']]) P_(mb, x, 5.0, -9.95, () => mb.box(2.6, 3.4, 0.08, c));
    S.prop('table', 7, -6.5, 0, { w: 4.5, d: 2.4, color: '#a0622d' });
    for (let r = 0; r < 3; r++) for (const c of [-1, 0, 1]) { if (o.desks === false) continue; S.prop('table', c * 6.2, -1.6 + r * 4.6, 0, { w: 3.0, d: 2.0, color: '#d9a066' }); S.prop('chair', c * 6.2, 0.2 + r * 4.6, 180, { color: ['#1e88e5', '#e63946', '#2a9d8f'][(r + c + 3) % 3] }); }
    P_(mb, 11.4, 3.5, 4, () => mb.box(1.4, 7, 6, '#a0622d'));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 7; j++) P_(mb, 10.6, 1.4 + i * 2.2, 1.6 + j * 0.75, () => mb.box(0.3, 1.3, 0.55, ['#e63946', '#1e88e5', '#ffd23f', '#2a9d8f'][(i + j) % 4]));
    for (const x of [-6, 6]) for (const z of [-3, 8]) P_(S.glow, x, 9.95, z, () => S.glow.box(4.5, 0.12, 1.2, '#fffbe8'));
    S.wide = { eye: [0, 9.2, 13.3], look: [0, 2.4, -5] };
  },
  room(S, o) {
    S.bg = 'none'; S.indoor = true; S.bounds = [-10.4, 10.4, -8.4, 11.5, 8.6];
    const mb = S.mb, ns = S.ns, wc = o.color || '#ffd6e7';
    P_(mb, 0, -0.1, 1.5, () => mb.box(22, 0.2, 21, '#d9b38c'));
    for (let x = -10; x <= 10; x += 1.4) P_(mb, x, 0.005, 1.5, () => mb.box(0.05, 0.02, 21, '#b88f66'));
    P_(ns, 0, 4.5, -9.2, () => ns.box(22, 9.4, 0.4, wc)); P_(ns, 0, 4.5, 12.2, () => ns.box(22, 9.4, 0.4, wc));
    P_(ns, -11.2, 4.5, 1.5, () => ns.box(0.4, 9.4, 21.8, shade(wc, 0.93))); P_(ns, 11.2, 4.5, 1.5, () => ns.box(0.4, 9.4, 21.8, shade(wc, 0.93)));
    P_(ns, 0, 9.2, 1.5, () => ns.box(22.8, 0.4, 21.8, '#ffffff'));
    P_(ns, 2, 5.2, -8.95, () => ns.box(5.4, 4.4, 0.2, '#ffffff')); P_(S.skywin, 2, 5.2, -8.85, () => S.skywin.box(4.8, 3.8, 0.1, '#ffffff')); P_(ns, 2, 5.2, -8.75, () => { ns.box(0.14, 3.8, 0.08, '#ffffff'); ns.box(4.8, 0.14, 0.08, '#ffffff'); });
    for (const s of [-1, 1]) P_(mb, 2 + s * 3.2, 5.0, -8.6, () => mb.rbox(1.2, 5.4, 0.3, 0.12, o.curtain || '#4f8ef7'));
    S.prop('bed', -6.6, -4.8, 0, { color: o.blanket || '#4f8ef7' });
    P_(mb, 0, 0.03, 1.8, () => mb.disc(4.2, 24, o.rug || '#ffd23f'));
    S.prop('table', 7.4, -6.6, 0, { w: 4.2, d: 2.2, color: '#ffffff' });
    P_(mb, 7.4, 3.3, -7.2, () => mb.rbox(2.4, 1.6, 0.2, 0.08, '#1b1b1b')); P_(S.glow, 7.4, 3.3, -7.08, () => S.glow.box(2.1, 1.3, 0.04, '#7fd1ff'));
    S.prop('chair', 7.4, -4.6, 180, { color: '#e63946' });
    P_(mb, 10.2, 3.6, 2.5, () => mb.box(1.6, 7.2, 4.5, '#a0622d'));
    S.sign(o.poster || '★', 3.0, 3.8, { bg: '#9b5de5', fg: '#ffd23f', border: '#ffffff' }, M4.chain(M4.T(-10.9, 5.2, 4), M4.RY(Math.PI / 2)));
    P_(S.glow, 0, 8.8, 1.5, () => S.glow.sphere(0.8, 1, '#fffbe8', { sy: 0.5 }));
    S.wide = { eye: [0, 7.6, 10.6], look: [0, 3, -4] };
  },
  elevator(S, o) {
    S.bg = 'none'; S.indoor = true; S.bounds = [-4.4, 4.4, -4.5, 6.2, 8.4];
    const mb = S.mb, ns = S.ns, st = o.color || '#b8bec6', op = Math.max(0, Math.min(1, o.open || 0));
    P_(mb, 0, -0.1, 0.6, () => mb.box(10.4, 0.2, 12.4, '#3d3d3d'));
    for (let z = -4.5; z <= 6; z += 1.5) P_(mb, 0, 0.005, z, () => mb.box(10, 0.02, 0.06, '#2a2a2a'));
    for (const sx of [-1, 1]) { P_(ns, sx * 5.2, 4.5, 0.6, () => ns.box(0.4, 9.4, 12.4, st)); for (let z = -3.6; z <= 6; z += 2.4) P_(ns, sx * 4.98, 4.5, z, () => ns.box(0.05, 9.0, 0.06, shade(st, 0.8))); P_(mb, sx * 4.7, 3.2, 0.8, () => mb.box(0.16, 0.16, 8.4, '#e0e3e7')); }
    P_(ns, 0, 4.5, 6.9, () => ns.box(10.4, 9.4, 0.4, shade(st, 0.95)));
    P_(ns, 0, 9.1, 0.6, () => ns.box(10.4, 0.4, 12.4, '#8c939b'));
    P_(S.glow, 0, 8.86, 0.8, () => S.glow.box(5.0, 0.08, 6.0, o.light || '#fff6e0'));
    // Rückwand mit Türöffnung (z = -5)
    P_(ns, -3.7, 4.5, -5.1, () => ns.box(2.6, 9.4, 0.4, st)); P_(ns, 3.7, 4.5, -5.1, () => ns.box(2.6, 9.4, 0.4, st)); P_(ns, 0, 8.1, -5.1, () => ns.box(4.8, 2.4, 0.4, st));
    P_(mb, 0, 3.45, -4.95, () => { mb.box(4.9, 0.18, 0.14, '#7d848c'); }); P_(mb, 0, 6.9, -4.92, () => mb.box(4.9, 0.14, 0.14, '#7d848c'));
    P_(mb, 0, 7.75, -4.9, () => mb.box(2.1, 1.3, 0.1, '#1b1b1b'));
    for (const sx of [-1, 1]) P_(mb, sx * (1.1 + op * 2.2), 3.45, -5.25, () => mb.box(2.18, 6.9, 0.16, shade(st, 1.05)));
    // dahinter: dunkler Flur
    P_(ns, 0, -0.1, -14, () => ns.box(6, 0.2, 18, o.carpet || '#5b1a24')); P_(ns, -2.6, 3.5, -14, () => ns.box(0.3, 7, 18, o.hall || '#a7b39e')); P_(ns, 2.6, 3.5, -14, () => ns.box(0.3, 7, 18, o.hall || '#a7b39e')); P_(ns, 0, 7.0, -14, () => ns.box(6, 0.3, 18, '#6f7868')); P_(ns, 0, 3.5, -23, () => ns.box(6, 7, 0.3, '#6f7868'));
    P_(S.glow, 0, 6.8, -9, () => S.glow.box(1.2, 0.06, 0.8, '#d8f5c8'));
    // Bedienfeld rechts neben der Tür
    if (o.panel !== false) S.tx.push({ g: GL.geo((() => { const m = new MB(); m.box(1.3, 2.85, 0.08, '#ffffff', { uv: true }); return m; })()), m: M4.mul(S.mb.m, M4.chain(M4.T(4.95, 4.2, -3.4), M4.RY(-Math.PI / 2))), tex: panelTex(o.lit || []), e: 0.35 });
    S.wide = { eye: [0, 5.4, 5.9], look: [0, 4.0, -5] };
  },
  hallway(S, o) {
    S.bg = 'none'; S.indoor = true; S.bounds = [-3.4, 3.4, -38, 5.4, 7.4];
    const mb = S.mb, ns = S.ns, wc = o.color || '#c4cfb8', L = 50, zc = -18;
    P_(mb, 0, -0.1, zc, () => mb.box(8.4, 0.2, L, o.carpet || '#6b1e2a'));
    for (const sx of [-1, 1]) P_(mb, sx * 3.2, 0.005, zc, () => mb.box(0.25, 0.02, L, '#c9a227'));
    for (const sx of [-1, 1]) {
      P_(ns, sx * 4.2, 4.2, zc, () => ns.box(0.4, 8.6, L, wc));
      P_(ns, sx * 3.98, 1.5, zc, () => ns.box(0.06, 3.0, L, shade(wc, 0.72)));
      P_(mb, sx * 3.94, 3.05, zc, () => mb.box(0.1, 0.16, L, '#e8e2d0'));
      P_(mb, sx * 3.94, 0.2, zc, () => mb.box(0.12, 0.4, L, '#4a3428'));
    }
    P_(ns, 0, 8.4, zc, () => ns.box(8.8, 0.4, L, '#e6e1d3'));
    for (let z = 2; z > -42; z -= 7) if (!(o.flicker && Math.abs(z + 26) < 1)) P_(S.glow, 0, 8.18, z, () => S.glow.box(1.4, 0.06, 0.9, '#fff0c8'));
    // Anfang: Aufzugtür
    P_(ns, 0, 4.2, 6.6, () => ns.box(8.8, 8.6, 0.4, wc)); P_(mb, 0, 3.45, 6.35, () => mb.box(4.6, 6.9, 0.14, '#b8bec6'));
    // Ende: Tür mit Namensschild
    const ze = -42.6; P_(ns, 0, 4.2, ze - 0.2, () => ns.box(8.8, 8.6, 0.4, wc));
    P_(mb, 0, 2.2, ze + 0.05, () => mb.box(3.0, 4.6, 0.3, '#e8e2d0'));
    if (o.doorOpen) { P_(S.glow, 0, 2.0, ze - 0.02, () => S.glow.box(2.3, 4.0, 0.05, o.inside || '#ffcf87')); mb.push(M4.chain(M4.T(-1.15, 2.0, ze + 0.2), M4.RY(-1.25), M4.T(1.15, 0, 0))); mb.box(2.3, 4.0, 0.16, '#5b3a29'); mb.pop(); }
    else { P_(mb, 0, 2.0, ze + 0.22, () => mb.box(2.3, 4.0, 0.16, '#5b3a29')); P_(mb, 0.8, 2.0, ze + 0.36, () => mb.sphere(0.14, 1, '#d4af37')); }
    S.sign(o.name || 'MARK', 1.9, 0.62, { bg: '#d4af37', fg: '#1d1712', border: '#6b4e00', depth: 0.06 }, M4.T(0, 4.85, ze + 0.25));
    S.wide = { eye: [0, 4.6, 5], look: [0, 3.2, -40] };
  },
  snow(S, o) {
    S.bg = 'beach'; const mb = S.mb;
    P_(mb, 0, -0.05, 6, () => mb.box(300, 0.2, 64, o.ground || '#eef3f9'));
    P_(mb, 0, -0.06, -27, () => mb.box(300, 0.2, 4, '#d6e2ee'));
    P_(mb, 0, 0.0, -25.4, () => mb.box(300, 0.1, 0.7, '#ffffff'));
    const R = rng(11);
    for (let i = 0; i < 9; i++) { const x = -60 + i * 15 + R() * 6, z = -36 - R() * 30, w = 4 + R() * 7; P_(mb, x, 0.2, z, () => mb.rbox(w, 0.9, w * 0.7, 0.3, '#f7fbff')); }
    for (const [x, z, h] of [[-26, -14, 5], [-34, -6, 7], [30, -12, 6], [40, -2, 8], [-44, 6, 6], [46, 10, 5]]) { P_(mb, x, h / 2, z, () => mb.rbox(h * 1.6, h, h * 1.3, h * 0.3, '#e6edf5')); P_(mb, x + 1, h * 0.35, z + h * 0.5, () => mb.rbox(h * 0.9, h * 0.7, 0.6, 0.2, '#9aa3ad')); }
    for (let i = 0; i < 40; i++) { const x = (R() - 0.5) * 50, z = -20 + R() * 34; if (Math.abs(x) < 9 && z > -8 && z < 8) continue; P_(mb, x, 0.12, z, () => mb.rbox(0.4 + R() * 0.3, 0.25, 0.35, 0.1, '#8d939b')); }
    S.wide = { eye: [0, 7, 22], look: [0, 2, -4] };
  },
  kitchen(S, o) {
    S.bg = 'none'; S.indoor = true; S.bounds = [-11, 11, -5.6, 14, 10.5];
    const mb = S.mb, ns = S.ns, cab = o.cabinet || '#2e3238', top = o.top || '#3b3f45', wall = o.wall || '#ebe6de';
    for (let i = 0; i < 12; i++) P_(mb, -14 + i * 2.6, -0.1, 4, () => mb.box(2.5, 0.2, 22, i % 2 ? '#a0703f' : '#a8784a'));
    P_(ns, 0, 6, -7.4, () => ns.box(30, 12, 0.4, wall));
    if (!o.green) for (let r = 0; r < 9; r++) for (let c = 0; c < 30; c++) P_(ns, -14.5 + c + (r % 2) * 0.5, 3.4 + r * 0.5, -7.18, () => ns.box(0.96, 0.46, 0.02, shade(wall, r % 2 ? 1.0 : 1.03)));
    else { P_(ns, 0, 6.2, -7.18, () => ns.box(30, 5.6, 0.02, '#9c5a3c')); for (let r = 0; r < 11; r++) P_(ns, 0, 3.5 + r * 0.5, -7.16, () => ns.box(30, 0.04, 0.02, '#7d4630')); }
    P_(mb, 0, 1.2, -5.9, () => mb.box(30, 2.4, 2.6, o.green ? '#5d7a5c' : cab)); P_(mb, 0, 2.48, -5.9, () => mb.box(30, 0.16, 2.8, top));
    for (let i = 0; i < 10; i++) P_(mb, -13.5 + i * 3, 1.2, -4.58, () => mb.box(2.8, 2.0, 0.04, shade(o.green ? '#5d7a5c' : cab, 1.1)));
    P_(mb, 0, 8.6, -6.6, () => mb.box(30, 2.6, 1.4, o.green ? '#5d7a5c' : cab));
    if (o.green) for (let i = 0; i < 6; i++) { P_(mb, -7 + i * 2.8, 6.4, -6.8, () => { mb.push(M4.RX(Math.PI / 2)); mb.cyl(0.7, 0.7, 0.2, 16, '#c27a46'); mb.pop(); }); P_(mb, -7 + i * 2.8, 7.3, -6.95, () => mb.box(0.12, 0.9, 0.12, '#8a5a34')); }
    else { for (const x of [-9, 7.5]) P_(mb, x, 2.56, -6.0, () => mb.cyl(0.35, 0.35, 1.0, 12, '#c8a46a')); }
    P_(mb, 0, 1.2, 0, () => mb.box(18, 2.4, 3.8, cab)); P_(mb, 0, 2.45, 0, () => mb.box(18.4, 0.2, 4.2, top));
    for (const x of [-6, 0, 6]) { P_(S.glow, x, 10.2, -1, () => S.glow.cyl(0.6, 0.9, 0.6, 14, '#ffe2a8')); P_(mb, x, 11.5, -1, () => mb.box(0.06, 2, 0.06, '#222')); }
    S.wide = { eye: [0, 7, 10], look: [0, 3.2, -1] };
  },
  backyard(S, o) {
    const mb = S.mb; groundPlane(mb, '#7fd34e');
    house(S, 0, -22, 0, { w: 30, h: 9, d: 10, wall: o.color || '#a8d8ea', roof: '#34495e', door: '#ffffff', doorX: -5, doorW: 3.2 });
    P_(mb, 0, 0.12, -12.5, () => mb.box(30, 0.24, 9, '#c08552'));
    for (let x = -14.5; x <= 14.5; x += 1.2) P_(mb, x, 0.245, -12.5, () => mb.box(0.06, 0.02, 9, '#9a6a3e'));
    setFence(mb, -20, -17, -20, 18, '#a0703a'); setFence(mb, 20, -17, 20, 18, '#a0703a');
    S.prop('pool', 8, 3, 0, { w: 10, d: 6 });
    S.prop('lounger', -7, 3, 0); S.prop('umbrella', -9.6, 2, 0, { color: '#e63946' });
    S.at(-14, 0, -8); mb.cyl(1.1, 1.1, 1.2, 12, '#222'); P_(mb, 0, 0, 0, () => { for (const [x, z] of [[0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) P_(mb, x, -0.0, z, () => mb.box(0.12, 2.4, 0.12, '#333')); }); S.pop();
    const cols = ['#e63946', '#ffd23f', '#1e88e5', '#2a9d8f', '#f15bb5'];
    for (let i = 0; i < 24; i++) { const x = -18 + i * 1.55, y = 7.6 - Math.sin(i / 23 * Math.PI) * 1.4; P_(mb, x, y, -9, () => mb.tri([-0.55, 0, 0], [0.55, 0, 0], [0, -0.9, 0], col(cols[i % 5]))); }
    for (let x = -30; x <= 30; x += 10) setTree(S.fol, x, 26, 1, (x / 10) & 3);
    S.wide = { eye: [0, 11, 24], look: [0, 2, -4] };
  },
  plaza(S, o) {
    const mb = S.mb; groundPlane(mb, '#7ccf4a');
    P_(mb, 0, 0.04, -8, () => mb.box(110, 0.08, 90, '#eadfc8'));
    for (let i = -13; i <= 13; i++) { P_(mb, i * 4, 0.085, -8, () => mb.box(0.12, 0.02, 90, '#d8c9ab')); P_(mb, 0, 0.085, -8 + i * 3.4, () => mb.box(110, 0.02, 0.12, '#d8c9ab')); }
    S.at(0, 0, -13);
    mb.cyl(5.4, 5.4, 1.1, 24, '#cfd5dc', { flat: false, top: '#e3e7ec' }); mb.cyl(0.7, 0.6, 3.6, 10, '#cfd5dc', { flat: false });
    P_(mb, 0, 3.2, 0, () => mb.cyl(1.2, 2.2, 0.6, 16, '#cfd5dc', { flat: false }));
    S.water(m => { m.push(M4.T(0, 0.95, 0)); m.disc(4.9, 24, '#36b3f0'); m.pop(); m.push(M4.T(0, 3.75, 0)); m.disc(2.0, 16, '#36b3f0'); m.pop(); }, 0.85);
    S.pop();
    const shops = [['BÄCKEREI', '#ffd6a5', '#e63946'], ['EIS', '#caffbf', '#f15bb5'], ['KIOSK', '#9bf6ff', '#1e88e5'], ['PIZZA', '#ffc6ff', '#2a9d8f'], ['BLUMEN', '#fdffb6', '#ff7f11']];
    shops.forEach(([t, w, s], i) => shop(S, -26 + i * 13, -40, 0, { text: (o.shops && o.shops[i]) || t, wall: w, stripe: s }));
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) house(S, s * 40, -24 + i * 13, s > 0 ? -90 : 90, { w: 12, h: 10, wall: WALLS[(i + (s > 0 ? 3 : 0)) % 8], roof: ROOFS[i % 6], flat: i === 1 });
    S.at(-30, 0, -50); P_(mb, 0, 11, 0, () => mb.box(6, 22, 6, '#d8c3a5')); P_(mb, 0, 22, 0, () => mb.cyl(4.6, 0, 5, 4, '#c0392b', { rot: Math.PI / 4 }));
    S.texq(clockTex(o.time || '12:00'), 4, 4, M4.T(0, 18.5, 3.05)); S.pop();
    for (const [x, z, r] of [[-9, -6, 90], [9, -6, -90], [-9, -20, 90], [9, -20, -90]]) S.prop('bench', x, z, r);
    for (const [x, z] of [[-14, 0], [14, 0], [-14, -26], [14, -26]]) { P_(mb, x, 0, z, () => mb.cyl(1.6, 1.6, 1.0, 10, '#b0896b')); setTree(S.fol, x, z, 0.75, 1); }
    for (const [x, z] of [[-18, -10], [18, -10], [-18, 4], [18, 4]]) setLampPost(mb, S.lamp, x, z);
    S.wide = { eye: [0, 13, 24], look: [0, 4, -12] };
  },
  beach(S, o) {
    S.bg = 'beach'; const mb = S.mb;
    P_(mb, 0, -0.05, 6, () => mb.box(300, 0.2, 64, '#f3dfa2'));
    P_(mb, 0, -0.06, -27, () => mb.box(300, 0.2, 4, '#e3c98a'));
    P_(mb, 0, 0.0, -25.4, () => mb.box(300, 0.1, 0.7, '#ffffff'));
    for (const [x, z, s] of [[-15, -8, 1], [14, -12, 1.1], [24, 3, 0.9], [-25, 4, 1], [-36, -14, 1.2], [38, -6, 1]]) setPalm(S.fol, x, z, s);
    S.prop('umbrella', -7, -5, 0, { color: '#e63946' }); S.prop('umbrella', 10, -3, 0, { color: '#1e88e5' });
    for (const [x, z, c] of [[-7, -2.5, '#ffd23f'], [10, -0.5, '#f15bb5'], [-1, -9, '#2a9d8f']]) P_(mb, x, 0.07, z, () => mb.box(2.2, 0.06, 4, c));
    S.prop('ball', 4, -4); S.prop('sandcastle', 7, -9, 20);
    for (let i = 0; i < 8; i++) P_(mb, -40 + i * 11, 0.3, -22 + (i % 3), () => mb.sphere(1.0 + (i % 3) * 0.4, 0, '#9aa0a6', { flat: true, jit: 0.4, seed: i + 3, sy: 0.6 }));
    S.wide = { eye: [0, 9, 24], look: [0, 2, -10] };
  },
  field(S, o) {
    const mb = S.mb; groundPlane(mb, '#79d64a');
    for (let i = 0; i < 12; i++) P_(mb, 0, 0.02, -i * 10, () => mb.box(30, 0.04, 10, i % 2 ? '#6fcf42' : '#82dd55'));
    for (const x of [-15, 15]) P_(mb, x, 0.06, -55, () => mb.box(0.3, 0.04, 120, '#ffffff'));
    for (let i = 0; i < 6; i++) P_(mb, 0, 0.06, -i * 20, () => mb.box(30, 0.04, 0.3, '#ffffff'));
    P_(mb, 0, 0.07, 2, () => mb.disc(3, 24, '#ffd23f')); P_(mb, 0, 0.08, 2, () => mb.disc(2.4, 24, '#ff9f1a'));
    const dist = o.marks || ['10 M', '25 M', '50 M', '100 M'];
    dist.forEach((t, i) => S.prop('sign', 17, -12 - i * 22, -20, { text: t, bg: '#ffffff', fg: '#1d1712', border: '#1d1712', w: 3, h: 1.6 }));
    if (o.banner !== '') S.prop('banner', 0, -6, 0, { text: o.banner || 'WURF-CHALLENGE', w: 12 });
    for (let i = 0; i < 5; i++) P_(mb, -26, 0.5 + i * 0.9, -10 - i * 1.2, () => mb.box(4, 0.9, 30, i % 2 ? '#d9dde3' : '#c4cad2'));
    const R = rng(31); for (let i = 0; i < 30; i++) { const x = (R() - 0.5) * 140, z = -70 - R() * 50; if (R() < 0.6) setPine(S.fol, x, z, 0.9 + R() * 0.5); else setTree(S.fol, x, z, 1, i % 3); }
    for (const x of [-40, 40]) for (let z = -60; z <= 10; z += 14) setTree(S.fol, x + (z % 3), z, 1, 2);
    S.prop('flag', -16, -40, 0, { color: '#2a9d8f' }); S.prop('flag', 16, -80, 0, { color: '#1e88e5' });
    S.wide = { eye: [8, 10, 18], look: [0, 3, -20] };
  },
};
const SETC = {};
function getSet(name, o = {}) {
  const key = name + '|' + JSON.stringify(o); if (SETC[key]) return SETC[key];
  const S = new SB(); (SETS[name] || SETS.street)(S, o);
  const out = { bg: S.bg, wide: S.wide, indoor: S.indoor, bounds: S.bounds, items: [] };
  const add = (mb, extra) => { if (mb.a.length) out.items.push({ g: GL.geo(mb), ...extra }); };
  add(S.mb, { grain: 0.16 }); add(S.fol, { sway: 1, spec: 0.08, rim: 0.12 }); add(S.ns, { sh: false, kind: 'ns', grain: 0.05 }); add(S.win, { kind: 'win' }); add(S.lamp, { kind: 'lamp' }); add(S.glow, { e: 1, sh: false, kind: 'glow' }); add(S.skywin, { kind: 'sky', sh: false });
  out.items.push(...S.tx, ...S.items);
  return (SETC[key] = out);
}

// ---------- Hintergründe ----------
const BGC = {};
function getBG(type) {
  if (BGC[type]) return BGC[type];
  const mb = new MB(), cl = new MB(), win = new MB(), out = { items: [], clouds: null };
  if (type === 'none') return (BGC[type] = out);
  const R = rng(type === 'beach' ? 91 : 17);
  if (type === 'beach') {
    { const sea = new MB(); P_(sea, 0, -0.12, -474, () => sea.box(1800, 0.1, 900, '#2a9fe0')); out.items.push({ g: GL.geo(sea), sh: false, recv: false, water: 1, spec: 1 }); }
    for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.6, d = 260 + R() * 80; P_(mb, Math.sin(a) * d, -1, -Math.cos(a) * d, () => { mb.cyl(40 + R() * 30, 0, 28 + R() * 20, 7, '#5fa86a'); }); }
  } else {
    for (let i = 0; i < 48; i++) { const a0 = i / 48 * Math.PI * 2, a1 = (i + 1) / 48 * Math.PI * 2, r0 = 172, r1 = 900, c = col('#78c850'); mb.quad([Math.sin(a0) * r0, -0.14, Math.cos(a0) * r0], [Math.sin(a0) * r1, -0.14, Math.cos(a0) * r1], [Math.sin(a1) * r1, -0.14, Math.cos(a1) * r1], [Math.sin(a1) * r0, -0.14, Math.cos(a1) * r0], c); }
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + R() * 0.3, d = 125 + R() * 50; P_(mb, Math.sin(a) * d, -6, Math.cos(a) * d, () => mb.sphere(45 + R() * 30, 2, i % 2 ? '#69c14b' : '#5db544', { sy: 0.32 + R() * 0.12 })); }
    for (let i = 0; i < 40; i++) { const a = R() * Math.PI * 2, d = 105 + R() * 60; setPine(mb, Math.sin(a) * d, Math.cos(a) * d, 2.2 + R() * 1.6); }
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + R() * 0.25, d = 300 + R() * 70, r = 60 + R() * 35, h = 75 + R() * 55, rot = R() * 3;
      P_(mb, Math.sin(a) * d, -2, Math.cos(a) * d, () => { mb.cyl(r, 0, h, 6, '#8fa5bd', { rot }); P_(mb, 0, h * 0.62, 0, () => mb.cyl(r * 0.38 * 1.03, 0, h * 0.38 * 1.01, 6, '#f4f8fb', { rot })); });
    }
    if (type === 'town') for (let i = 0; i < 26; i++) {
      const a = -1.1 + i / 25 * 2.2 + (R() - 0.5) * 0.05, d = 205 + R() * 40, w = 12 + R() * 12, h = 26 + R() * 55;
      const x = Math.sin(a) * d, z = -Math.cos(a) * d;
      mb.push(M4.chain(M4.T(x, 0, z), M4.RY(-a))); P_(mb, 0, h / 2, 0, () => mb.box(w, h, w, R() > 0.5 ? '#b7cde8' : '#c9d9ee')); P_(mb, 0, h + 0.6, 0, () => mb.box(w + 0.6, 1.2, w + 0.6, '#9fb6d6'));
      win.push(mb.m.slice ? M4.I() : M4.I()); win.S[win.S.length - 1] = mb.m.slice();
      for (let yy = 4; yy < h - 2; yy += 4) P_(win, 0, yy, w / 2 + 0.05, () => win.box(w - 3, 1.6, 0.1, '#ffffff'));
      win.pop(); mb.pop();
    }
  }
  for (let i = 0; i < 18; i++) {
    const a = R() * Math.PI * 2, d = 140 + R() * 140, y = 70 + R() * 50, n = 4 + Math.floor(R() * 3), s = 7 + R() * 6;
    for (let j = 0; j < n; j++) P_(cl, Math.sin(a) * d + (j - n / 2) * s * 1.1, y + (j % 2) * s * 0.4, Math.cos(a) * d + (R() - 0.5) * s, () => cl.sphere(s * (0.8 + R() * 0.5), 1, '#ffffff', { sy: 0.85 }));
  }
  out.items.push({ g: GL.geo(mb), sh: false, recv: false });
  if (win.a.length) out.items.push({ g: GL.geo(win), sh: false, recv: false, kind: 'bgwin' });
  out.clouds = { g: GL.geo(cl), sh: false, recv: false, kind: 'cloud' };
  return (BGC[type] = out);
}
