'use strict';
// ============ life.js – Leben im Hintergrund ============
// Autos, Passanten (mit Hunden), Jogger, spielende Kinder, Zuschauer, Vögel, Möwen, Flugzeug, Heißluftballon,
// Windräder, Enten, Tauben, Springbrunnen, Segelboote, Brandung, Schmetterlinge, Glühwürmchen, Staub im Licht.
// Alles hängt an der globalen Zeit -> läuft über Schnitte hinweg weiter. Wege, die eine Hauptfigur verdecken
// oder durch sie hindurchlaufen würden, werden pro Shot automatisch abgeschaltet.
// Shot/Episode: "life": false | "calm" | "busy" | { cars, people, birds, extras } (Faktoren, 1 = normal)

const LIFE_SETS = {
  street: {
    lanes: [
      { kind: 'car', pts: [[-130, 0, 6.2], [130, 0, 6.2]], n: 3, speed: 11 },
      { kind: 'car', pts: [[130, 0, 11], [-130, 0, 11]], n: 3, speed: 9.5 },
      { kind: 'ped', pts: [[-70, 0, -3.3], [70, 0, -3.3]], n: 5, speed: 2.7 },
      { kind: 'ped', pts: [[70, 0, 15.5], [-70, 0, 15.5]], n: 4, speed: 2.5 },
    ],
    spots: [{ kind: 'cat', at: [9.5, 1.9, -4.6], face: 0, do: 'sit' }, { kind: 'cat', at: [-33, 1.9, -4.6], face: 20, do: 'sit' }],
    sky: 1, far: 1, flutter: 0, fire: 1,
  },
  house: {
    lanes: [
      { kind: 'car', pts: [[-110, 0, 16], [110, 0, 16]], n: 2, speed: 10 },
      { kind: 'car', pts: [[110, 0, 19.5], [-110, 0, 19.5]], n: 2, speed: 9 },
      { kind: 'ped', pts: [[-60, 0, 10.8], [60, 0, 10.8]], n: 4, speed: 2.6 },
    ],
    spots: [{ kind: 'cat', at: [-9, 1.9, 8], face: 10, do: 'sit' }, { kind: 'npc', at: [-24, 0, -6], face: 10, do: 'talk' }, { kind: 'npc', at: [-21.5, 0, -6.5], face: -60, do: 'nod' }],
    sky: 1, far: 1, flutter: 1, fire: 1,
  },
  park: {
    lanes: [
      { kind: 'jog', pts: [[-90, 0, 8.4], [90, 0, 8.4]], n: 2, speed: 5.5 },
      { kind: 'ped', pts: [[90, 0, 9.6], [-90, 0, 9.6]], n: 4, speed: 2.4 },
      { kind: 'ped', pts: [[-16, 0, -60], [-16, 0, 6]], n: 3, speed: 2.4 },
    ],
    spots: [{ kind: 'npc', at: [-27, 0, -2.5], do: 'hop', kid: 1 }, { kind: 'npc', at: [-31, 0, -6], do: 'cheer', kid: 1 }, { kind: 'npc', at: [-25, 0, -9], face: -60, do: 'wave', kid: 1 },
      { kind: 'npc', at: [8, 0, -26], face: 90, do: 'talk' }, { kind: 'npc', at: [10.5, 0, -26], face: -90, do: 'laugh' }],
    ducks: { c: [18, 0.12, -14], r: 4.6, n: 3 }, sky: 1, far: 1, flutter: 1, fire: 1,
  },
  school: {
    lanes: [{ kind: 'ped', pts: [[-60, 0, 19], [60, 0, 19]], n: 3, speed: 2.5 }],
    circles: [{ c: [14, -6], r: 4.5, n: 3, speed: 5.5, kid: 1 }, { c: [-22, -10], r: 3.2, n: 2, speed: 4.5, kid: 1 }],
    spots: [{ kind: 'npc', at: [-14, 0, 2.6], do: 'hop', kid: 1, face: 30 }, { kind: 'npc', at: [-10, 0, -16.4], do: 'talk', kid: 1, face: 90 }, { kind: 'npc', at: [-7.5, 0, -16.6], do: 'laugh', kid: 1, face: -90 }],
    sky: 1, far: 1, flutter: 0, fire: 0,
  },
  plaza: {
    lanes: [
      { kind: 'ped', pts: [[-60, 0, -31], [60, 0, -31]], n: 5, speed: 2.6 },
      { kind: 'ped', pts: [[50, 0, -33], [-50, 0, -33]], n: 4, speed: 2.3 },
      { kind: 'ped', pts: [[-20, 0, 12], [-20, 0, -45]], n: 3, speed: 2.5 },
      { kind: 'ped', pts: [[21, 0, -45], [21, 0, 12]], n: 3, speed: 2.5 },
    ],
    spots: [{ kind: 'npc', at: [-9, 0, -20], face: 90, do: 'sit', seat: 1 }, { kind: 'npc', at: [9, 0, -6], face: -90, do: 'sit', seat: 1 }],
    pigeons: [[-5, -20], [-3.5, -21.2], [-6.2, -22], [5.5, -24], [6.8, -23], [12, -17]],
    fountain: [0, 0, -13], sky: 1, far: 1, flutter: 0, fire: 0,
  },
  beach: {
    lanes: [{ kind: 'ped', pts: [[-90, 0, -20], [90, 0, -20]], n: 3, speed: 2.2, beach: 1 }],
    spots: [{ kind: 'npc', at: [10, 0.12, -0.5], face: 180, do: 'lie', beach: 1 }, { kind: 'npc', at: [-1, 0.12, -9], face: 30, do: 'lie', beach: 1 }, { kind: 'npc', at: [-24, 0, -14], face: 90, do: 'hop', beach: 1, kid: 1 }],
    boats: 1, foam: 1, sky: 1, gulls: 1, far: 0, flutter: 0, fire: 0,
  },
  backyard: { spots: [{ kind: 'cat', at: [20, 1.9, -4], face: -90, do: 'sit' }], sky: 1, far: 1, flutter: 1, fire: 1 },
  field: {
    lanes: [{ kind: 'jog', pts: [[-13, 0, 6], [-13, 0, -110]], n: 2, speed: 6 }],
    spots: Array.from({ length: 10 }, (_, i) => ({ kind: 'npc', at: [-27.2 + (i % 2) * 1.8, 0.95 + 0.9 * Math.floor(i / 2), 4.4 - 1.2 * Math.floor(i / 2) + (i % 2) * 0], face: 135, do: ['cheer', 'wave', 'clap', 'idle', 'cheer'][i % 5], stand: 1 })),
    sky: 1, far: 1, flutter: 0, fire: 1,
  },
  classroom: { dust: { box: [-10, 10, 0.5, 9, -8, 12] } },
  room: { dust: { box: [-9, 9, 0.5, 8.5, -7, 10] } },
};

// ---------- Geometrie ----------
const CAR_COLS = ['#e63946', '#1e88e5', '#ffb703', '#2a9d8f', '#f1f1f1', '#6c757d', '#9b5de5', '#111827'];
function carBodyGeo(c) {
  return cgeo('lifecar|' + c, mb => {
    mb.push(M4.T(0, 1.15, 0)); mb.rbox(3.6, 1.3, 7.2, 0.4, c); mb.pop();
    mb.push(M4.T(0, 2.2, -0.4)); mb.rbox(3.2, 1.1, 3.8, 0.35, c); mb.pop();
    mb.push(M4.T(0, 2.25, -0.4)); mb.box(3.26, 0.75, 3.3, '#2b3a4a'); mb.pop();
    mb.push(M4.T(0, 2.25, -0.4)); mb.box(2.9, 0.82, 3.86, '#2b3a4a'); mb.pop();
    mb.push(M4.T(0, 0.75, 3.62)); mb.box(3.2, 0.3, 0.12, '#cfd4da'); mb.pop(); mb.push(M4.T(0, 0.75, -3.62)); mb.box(3.2, 0.3, 0.12, '#cfd4da'); mb.pop();
    for (const s of [-1, 1]) { mb.push(M4.T(s * 1.81, 1.3, 0.6)); mb.box(0.04, 0.06, 0.5, '#cfd4da'); mb.pop(); mb.push(M4.T(s * 1.7, 2.3, 1.05)); mb.box(0.35, 0.2, 0.1, c); mb.pop(); }
  });
}
function carLightGeo() { return cgeo('lifecarlight', mb => { for (const s of [-1, 1]) { mb.push(M4.T(s * 1.2, 1.25, 3.63)); mb.rbox(0.7, 0.4, 0.1, 0.1, '#fff7c2'); mb.pop(); mb.push(M4.T(s * 1.2, 1.25, -3.63)); mb.rbox(0.7, 0.35, 0.1, 0.1, '#ff3b3b'); mb.pop(); } }); }
function wheelGeo() { return cgeo('lifewheel', mb => { mb.push(M4.RZ(Math.PI / 2)); mb.push(M4.T(0, -0.25, 0)); mb.cyl(0.75, 0.75, 0.5, 14, '#1f1f1f', { flat: false }); mb.pop(); mb.push(M4.T(0, 0.27, 0)); mb.cyl(0.42, 0.42, 0.02, 10, '#b8c0c8'); mb.pop(); mb.push(M4.T(0, -0.27, 0)); mb.cyl(0.42, 0.42, 0.02, 10, '#b8c0c8'); mb.pop(); for (let i = 0; i < 4; i++) { mb.push(M4.chain(M4.T(0, 0.28, 0), M4.RY(i * Math.PI / 4))); mb.box(0.7, 0.03, 0.1, '#8a939c'); mb.pop(); } mb.pop(); }); }
function birdGeo(c) { return { body: cgeo('birdb|' + c, mb => { mb.sphere(0.32, 1, c, { sz: 1.9, sy: 0.8 }); mb.push(M4.T(0, 0.12, 0.6)); mb.sphere(0.2, 1, c); mb.pop(); mb.push(M4.chain(M4.T(0, 0.1, 0.85), M4.RX(Math.PI / 2))); mb.cyl(0.07, 0, 0.22, 5, '#ffb703'); mb.pop(); }), wing: cgeo('birdw|' + c, mb => { mb.push(M4.T(0.6, 0, 0)); mb.box(1.2, 0.05, 0.45, c); mb.pop(); }) }; }
function duckGeo() { return cgeo('duck', mb => { mb.push(M4.T(0, 0.3, 0)); mb.sphere(0.55, 2, '#fff7e0', { sz: 1.4, sy: 0.75 }); mb.pop(); mb.push(M4.T(0, 0.85, 0.55)); mb.sphere(0.33, 2, '#2f8f4e'); mb.pop(); mb.push(M4.chain(M4.T(0, 0.8, 0.85), M4.RX(Math.PI / 2))); mb.cyl(0.13, 0.08, 0.3, 6, '#ff9f1a'); mb.pop(); mb.push(M4.T(0, 0.55, -0.65)); mb.cyl(0.25, 0, 0.35, 5, '#fff7e0'); mb.pop(); }); }
function pigeonGeo() { return { body: cgeo('pigeon', mb => { mb.push(M4.T(0, 0.35, 0)); mb.sphere(0.32, 1, '#8d99ae', { sz: 1.5, sy: 0.85 }); mb.pop(); mb.push(M4.T(0, 0.38, -0.5)); mb.box(0.3, 0.06, 0.4, '#5c677d'); mb.pop(); for (const s of [-1, 1]) { mb.push(M4.T(s * 0.1, 0.08, 0)); mb.box(0.04, 0.16, 0.04, '#e76f51'); mb.pop(); } }), head: cgeo('pigeonh', mb => { mb.sphere(0.17, 1, '#6c7a96'); mb.push(M4.T(0, -0.12, 0.05)); mb.sphere(0.12, 0, '#4f9d8f'); mb.pop(); mb.push(M4.chain(M4.T(0, 0, 0.17), M4.RX(Math.PI / 2))); mb.cyl(0.04, 0, 0.12, 4, '#333'); mb.pop(); }) }; }
function planeGeo() { return cgeo('plane', mb => { mb.push(M4.RX(Math.PI / 2)); mb.cyl(0.9, 0.9, 12, 10, '#f5f7fa', { flat: false }); mb.push(M4.T(0, 12, 0)); mb.cyl(0.9, 0.1, 2.2, 10, '#f5f7fa', { flat: false }); mb.pop(); mb.pop(); mb.push(M4.T(0, 0, 6)); mb.box(15, 0.2, 2.6, '#dfe6ee'); mb.pop(); mb.push(M4.T(0, 1.8, 0.6)); mb.box(0.2, 3, 1.8, '#e63946'); mb.pop(); mb.push(M4.T(0, 0.3, 0.8)); mb.box(5, 0.15, 1.3, '#dfe6ee'); mb.pop(); }); }
function balloonGeo() { return cgeo('hotair', mb => { mb.push(M4.T(0, 7, 0)); mb.sphere(5, 2, '#e63946', { sy: 1.15, colFn: (a, b, c) => ['#e63946', '#ffd23f', '#1e88e5', '#ffd23f'][Math.floor(((Math.atan2(a[0] + b[0] + c[0], a[2] + b[2] + c[2]) + Math.PI) / (Math.PI * 2)) * 8) % 4] }); mb.pop(); mb.push(M4.T(0, 0.8, 0)); mb.box(1.8, 1.4, 1.8, '#8b5a2b'); mb.pop(); for (const [x, z] of [[0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]]) { mb.push(M4.T(x, 2.2, z)); mb.box(0.06, 1.6, 0.06, '#5c4033'); mb.pop(); } }); }
function turbineGeo() { return { tower: cgeo('turbt', mb => { mb.cyl(1.0, 0.55, 34, 10, '#f4f6f8', { flat: false }); mb.push(M4.T(0, 34, 0.6)); mb.rbox(1.6, 1.6, 3.6, 0.5, '#f4f6f8'); mb.pop(); }), rotor: cgeo('turbr', mb => { mb.sphere(0.6, 1, '#f4f6f8'); for (let i = 0; i < 3; i++) { mb.push(M4.chain(M4.RZ(i * Math.PI * 2 / 3), M4.T(0, 7.5, 0))); mb.box(0.9, 15, 0.25, '#f4f6f8'); mb.pop(); } }) }; }
function boatGeo(c) { return cgeo('boat|' + c, mb => { mb.push(M4.T(0, 0.5, 0)); mb.rbox(2.4, 1.0, 7, 0.4, '#ffffff'); mb.pop(); mb.push(M4.T(0, 0.15, 0)); mb.box(2.45, 0.3, 7.05, c); mb.pop(); mb.push(M4.T(0, 1, 0)); mb.cyl(0.1, 0.1, 9, 6, '#8b5a2b'); mb.pop(); const s = col(c === '#1e88e5' ? '#ffffff' : '#fff3d6'); mb.tri([0, 1.6, -2.8], [0, 9.6, 0], [0, 1.6, 0], s); mb.tri([0, 1.6, 0], [0, 9.6, 0], [0, 1.6, -2.8], s); mb.tri([0, 2, 0.4], [0, 8.4, 0.1], [0, 2, 3.0], s); mb.tri([0, 2, 3.0], [0, 8.4, 0.1], [0, 2, 0.4], s); }); }
function butterflyGeo(c) { return cgeo('bfly|' + c, mb => { mb.push(M4.T(0.22, 0, 0)); mb.box(0.42, 0.02, 0.36, c); mb.pop(); }); }
function speckGeo(c) { return cgeo('speck|' + c, mb => mb.sphere(0.05, 0, c)); }

// ---------- Hilfen ----------
function lifeOpt(sh) {
  let v = sh.life ?? (R.ep && R.ep.life);
  if (v === false || v === 'off' || v === 0) return null;
  const o = { cars: 1, people: 1, birds: 1, extras: 1 };
  if (v === 'calm') { o.cars = 0.5; o.people = 0.5; o.birds = 0.6; }
  if (v === 'busy') { o.cars = 1.6; o.people = 1.8; o.birds = 1.5; }
  if (v && typeof v === 'object') Object.assign(o, v);
  return o;
}
function segDist(p, a, b) { const ab = V3.sub(b, a), t = clamp(V3.dot(V3.sub(p, a), ab) / Math.max(1e-6, V3.dot(ab, ab)), 0, 1); return [V3.len(V3.sub(p, V3.add(a, V3.mul(ab, t)))), t]; }
// Würde etwas an Punkt p (Höhe h, Radius w) eine Figur verdecken oder sie berühren?
function lifeBlocked(p, h, w, ctx, eyeClear) {
  const e = ctx.cam.eye, de = Math.hypot(p[0] - e[0], p[2] - e[2]);
  if (de < eyeClear) return true;
  // nichts groß im Vordergrund vor den Figuren
  let near = Infinity; for (const q of ctx.obs) if (q.r > 0.5) near = Math.min(near, Math.hypot(q.p[0] - e[0], q.p[2] - e[2]));
  if (near < Infinity && de < near * 0.8) return true;
  for (const q of ctx.obs) {
    if (Math.hypot(p[0] - q.p[0], p[2] - q.p[2]) < q.r + w) return true;
    for (const y of [0.4, h * 0.5, h - 0.2]) { const [d, t] = segDist([p[0], p[1] + y, p[2]], e, q.t); if (t > 0.02 && t < 0.98 && d < w + 0.5) return true; }
  }
  return false;
}
function lifeCtx(sh, si, set) {
  const D = sh.dur, tm = D * 0.5;
  const list = (sh.actors || []).map((a, i) => actorState(a, tm, D, i, sh));
  const map = {}; for (const s of list) map[s.id] = s; for (const s of list) s.face = faceOf(s, map, null, 0.5);
  const cams = [0.02, 0.5, 0.98].map(f => camera(sh, si, D * f, D, set, map));
  const obs = [];
  for (const a of sh.actors || []) { const pa = pathOf(a); for (const p of pa.pts) obs.push({ p, r: 1.6, t: [p[0], p[1] + 4.2, p[2]] }); for (let i = 1; i < pa.pts.length; i++) for (let k = 1; k < 4; k++) { const p = V3.lerp(pa.pts[i - 1], pa.pts[i], k / 4); obs.push({ p, r: 1.6, t: [p[0], 4.2, p[2]] }); } }
  if (sh.crowd) { const [x0, z0, x1, z1] = sh.crowd.area || [-10, -8, 10, -2]; obs.push({ p: [(x0 + x1) / 2, 0, (z0 + z1) / 2], r: Math.hypot(x1 - x0, z1 - z0) / 2 + 1, t: [(x0 + x1) / 2, 3, (z0 + z1) / 2] }); }
  for (const p of sh.props || []) { const q = pt3(p.at); obs.push({ p: q, r: 1.8 * (p.s || 1), t: [q[0], q[1] + 2, q[2]] }); if (p.fly && p.fly.to) { const q2 = pt3(p.fly.to); obs.push({ p: q2, r: 1.5, t: [q2[0], 1.5, q2[2]] }); } }
  if (!obs.length) { const l = cams[1].look; obs.push({ p: [l[0], 0, l[2]], r: 0.1, t: l }); }
  return { obs, cams, get cam() { return this.cams[1]; } };
}
function blockedAll(p, h, w, ctx, eyeClear) { for (const c of ctx.cams) if (lifeBlocked(p, h, w, { cam: c, obs: ctx.obs }, eyeClear)) return true; return false; }
function laneOK(L, ctx) {
  const pts = L.pts, isCar = L.kind === 'car', h = isCar ? 3 : 5.6, w = isCar ? 2.2 : 0.9, look = ctx.cam.look;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    for (let d = 0; d <= len; d += 2) { const p = V3.lerp(a, b, d / len); if (Math.hypot(p[0] - look[0], p[2] - look[2]) > 75) continue; if (blockedAll(p, h, w, ctx, isCar ? 12 : 5)) return false; }
  }
  return true;
}
const LIFEC = {};
function inView(cam, p, r = 4) { const f = V3.norm(V3.sub(cam.look, cam.eye)), v = V3.sub(p, cam.eye), d = V3.dot(v, f); return d > -r && d < 260; }

// ---------- Hauptfunktion ----------
function lifeItems(items, sh, si, set, tg, E, cam) {
  const opt = lifeOpt(sh); if (!opt) return;
  const name = sh.set || 'street', L = LIFE_SETS[name]; if (!L) return;
  const key = si + '|' + name;
  if (!LIFEC[key]) { const ctx = lifeCtx(sh, si, set); LIFEC[key] = { lanes: (L.lanes || []).map(l => laneOK(l, ctx)), spots: (L.spots || []).map(s => !blockedAll(pt3(s.at), s.kind === 'cat' ? 1.5 : 5.4, s.kind === 'cat' ? 0.6 : 1.0, ctx, 3)), circles: (L.circles || []).map(c => { for (let a = 0; a < 6.28; a += 0.5) if (blockedAll([c.c[0] + Math.sin(a) * c.r, 0, c.c[1] + Math.cos(a) * c.r], 4.6, 0.9, ctx, 3)) return false; return true; }), ctx }; }
  const C = LIFEC[key], night = E.night || 0, day = 1 - night;
  // Fahrspuren / Gehwege
  (L.lanes || []).forEach((ln, li) => {
    if (!C.lanes[li]) return;
    const pa = pathOf({ at: ln.pts[0], path: ln.pts.slice(1) }), isCar = ln.kind === 'car', f = isCar ? opt.cars : opt.people * (night > 0.6 ? 0.5 : 1);
    const n = Math.round(ln.n * f); if (!n) return;
    for (let i = 0; i < n; i++) {
      const R2 = rng(li * 97 + i * 13 + 5), sp = ln.speed * (0.9 + R2() * 0.25), d = ((tg * sp + pa.tot * (i + R2() * 0.6) / n) % pa.tot + pa.tot) % pa.tot;
      const p = polyAt(pa.pts, pa.L, d), q = polyAt(pa.pts, pa.L, Math.min(pa.tot, d + 0.5)), face = Math.atan2(q[0] - p[0], q[1] - p[1]), pos = [p[0], 0, p[1]];
      if (!inView(cam, pos, 8)) continue;
      if (isCar) {
        const c = CAR_COLS[(li * 3 + i * 5) % CAR_COLS.length], root = M4.chain(M4.T(p[0], 0.08 * Math.abs(Math.sin(tg * 9 + i)) * 0.3, p[1]), M4.RY(face));
        items.push({ g: carBodyGeo(c), m: root, spec: 0.7, rim: 0.15 }, { g: carLightGeo(), m: root, e: lerp(0.25, 1, night) });
        const rot = d / 0.75;
        for (const [x, z] of [[1.45, 2.3], [-1.45, 2.3], [1.45, -2.3], [-1.45, -2.3]]) items.push({ g: wheelGeo(), m: M4.chain(root, M4.T(x, 0.75, z), M4.RX(rot)) });
      } else {
        const seed = 5000 + li * 50 + i, cfg = { ...npcCfg(seed), ...(ln.beach ? { shorts: true, sleeves: 'short', jacket: undefined, hoodie: undefined } : {}) };
        const A = { ph: (seed % 100) / 16, cyc: d / (ln.kind === 'jog' ? 5.4 : 4.2) * Math.PI * 2, moving: true }, act = ln.kind === 'jog' ? 'run' : 'walk';
        const P = pose(act, tg, 0, A); P.mood = 'happy'; P.closed = ((tg + A.ph) % 3.7) < 0.12;
        const S = { x: p[0], y: 0, z: p[1], face, scale: R2() < 0.25 ? 0.85 : 1, sh: true, sec: { swing: 15 + 6 * Math.sin(A.cyc * 2), side: 4 * Math.sin(A.cyc) } };
        avatarItems(items, cfg, S, P);
        if (ln.kind === 'ped' && i % 3 === 0 && !ln.beach) { // Hund an der Leine
          const dd = Math.max(0, d - 1.4), pd = polyAt(pa.pts, pa.L, dd), side = 1.1, dx = Math.cos(face) * side, dz = -Math.sin(face) * side;
          animalItems(items, 'dog', { x: pd[0] + dx, y: 0, z: pd[1] + dz, face, scale: 0.75, sh: true }, apose('walk', tg, 0, { ph: A.ph, cyc: dd / 2.6 * Math.PI * 2, moving: true }, 'dog'), tg);
        }
      }
    }
  });
  // Kreise (rennende Kinder)
  (L.circles || []).forEach((c, ci) => {
    if (!C.circles[ci] || opt.people <= 0) return;
    for (let i = 0; i < c.n; i++) {
      const a = tg * c.speed / c.r + i * 6.28 / c.n, x = c.c[0] + Math.sin(a) * c.r, z = c.c[1] + Math.cos(a) * c.r, seed = 7000 + ci * 20 + i;
      const A = { ph: i, cyc: a * c.r / 5.4 * Math.PI * 2, moving: true }, P = pose('run', tg, 0, A); P.mood = 'grin';
      avatarItems(items, { ...npcCfg(seed), scale: 0.82 }, { x, y: 0, z, face: a + Math.PI / 2, scale: 1, sh: true, sec: { swing: 25, side: 0 } }, P);
    }
  });
  // feste Plätze (Katze auf dem Zaun, Leute die sich unterhalten, Zuschauer …)
  (L.spots || []).forEach((sp, k) => {
    if (!C.spots[k] || opt.extras <= 0) return;
    const p = pt3(sp.at); if (!inView(cam, p)) return;
    const ph = k * 1.7 + 0.3;
    if (sp.kind === 'cat') { const P = apose(sp.do || 'sit', tg, 0, { ph, cyc: 0 }, 'cat'); P.closed = ((tg + ph) % 4.1) < 0.14; animalItems(items, 'cat', { x: p[0], y: p[1], z: p[2], face: (sp.face || 0) * DEG, scale: 0.6, sh: true }, P, tg); return; }
    const seed = 9000 + k * 7 + name.length, cfg = { ...npcCfg(seed), ...(sp.kid ? { scale: 0.82 } : {}), ...(sp.beach ? { shorts: true, sleeves: 'short', jacket: undefined, hoodie: undefined, shades: true } : {}) };
    const A = { ph, cyc: 0 }, P = pose(sp.do || 'idle', tg, (tg * 0.3) % 1, A); P.mood = sp.do === 'lie' ? 'sleep' : (sp.do === 'laugh' ? 'laugh' : 'happy'); P.closed = sp.do === 'lie' || ((tg + ph) % 3.9) < 0.12;
    if (sp.do === 'talk') { const v = Math.sin(tg * 15 + ph) + 0.5 * Math.sin(tg * 23); P.open = v > 0.1 ? 1 : 0; }
    let y = p[1]; if (sp.do === 'sit') { P.y = sp.seat ? -0.85 : P.y; }
    avatarItems(items, cfg, { x: p[0], y, z: p[2], face: (sp.face || 0) * DEG, scale: 1, sh: true, sec: { swing: 4 * Math.sin(tg * 2 + ph), side: 0 } }, P);
  });
  const isOut = !set.indoor;
  // Vögel / Möwen
  if (isOut && L.sky && opt.birds > 0 && night < 0.7) {
    const gull = !!L.gulls, bg = birdGeo(gull ? '#f4f6f8' : '#33363f'), nfl = gull ? 2 : 2, R0 = rng(name.length * 31 + 7);
    for (let fl = 0; fl < Math.round(nfl * opt.birds); fl++) {
      const per = 22 + fl * 9, ph = R0() * per, q = ((tg + ph) % per) / per, dirS = fl % 2 ? -1 : 1;
      const base = gull ? [Math.sin(tg * 0.25 + fl * 2) * 30 + fl * 12, 16 + fl * 4, -40 - fl * 15] : [dirS * lerp(-110, 110, q), 20 + fl * 6 + Math.sin(q * 6) * 2, -55 - fl * 20 + R0() * 10];
      const fw = gull ? tg * 0.25 + fl * 2 + Math.PI / 2 : (dirS > 0 ? Math.PI / 2 : -Math.PI / 2), nb = gull ? 3 : 5 + fl;
      for (let b = 0; b < nb; b++) {
        const off = [((b % 2) ? 1 : -1) * Math.ceil(b / 2) * 1.6, Math.sin(tg * 2 + b) * 0.4, -Math.ceil(b / 2) * 1.8], c = Math.cos(fw), s = Math.sin(fw);
        const pos = [base[0] + off[0] * c + off[2] * s, base[1] + off[1], base[2] - off[0] * s + off[2] * c];
        if (!inView(cam, pos, 10)) continue;
        const flap = Math.sin(tg * (gull ? 5 : 11) + b * 1.3) * (gull ? 0.5 : 0.9), root = M4.chain(M4.T(pos[0], pos[1], pos[2]), M4.RY(fw), M4.S(gull ? 1.3 : 1));
        items.push({ g: bg.body, m: root, sh: false, recv: false, rim: 0.2 }, { g: bg.wing, m: M4.chain(root, M4.RZ(flap)), sh: false, recv: false }, { g: bg.wing, m: M4.chain(root, M4.RY(Math.PI), M4.RZ(flap)), sh: false, recv: false });
      }
    }
  }
  // Fernes: Flugzeug mit Kondensstreifen, Heißluftballon, Windräder
  if (isOut && L.far && opt.extras > 0) {
    const pq = (tg % 46) / 46, px = lerp(-320, 320, pq), pp = [px, 78, -170];
    if (day > 0.3 && inView(cam, pp, 40)) {
      items.push({ g: planeGeo(), m: M4.chain(M4.T(px, 78, -170), M4.RY(Math.PI / 2)), sh: false, recv: false, spec: 0.8 });
      const len = Math.min(140, (px + 320) * 0.9); if (len > 2) items.push({ g: cgeo('trail', mb => mb.box(1, 0.6, 0.6, '#ffffff')), m: M4.chain(M4.T(px - 8 - len / 2, 78, -170), M4.S(len, 1, 1)), a: 0.45 * day, e: 0.8, sh: false, recv: false, zb: 400 });
    }
    const bx = 60 + Math.sin(tg * 0.02) * 30 + (tg * 0.6) % 120 - 60, by = 46 + Math.sin(tg * 0.3) * 2;
    if (day > 0.2) items.push({ g: balloonGeo(), m: M4.chain(M4.T(bx, by, -135), M4.RY(tg * 0.05)), sh: false, recv: false, rim: 0.2 });
    const tb = turbineGeo();
    for (const [x, z, s, o] of [[-95, -150, 1, 0], [-62, -175, 0.9, 1.3], [-125, -175, 1.1, 2.1], [105, -160, 1, 0.7]]) {
      const base = M4.chain(M4.T(x, -1, z), M4.S(s));
      items.push({ g: tb.tower, m: base, sh: false, recv: false }, { g: tb.rotor, m: M4.chain(base, M4.T(0, 34, 2.6), M4.RZ(tg * 1.4 + o)), sh: false, recv: false });
    }
  }
  // Enten auf dem Teich
  if (L.ducks && opt.extras > 0) { const d = L.ducks; for (let i = 0; i < d.n; i++) { const a = tg * (0.22 + i * 0.05) * (i % 2 ? -1 : 1) + i * 2.1, r = d.r * (0.55 + i * 0.18); items.push({ g: duckGeo(), m: M4.chain(M4.T(d.c[0] + Math.sin(a) * r, d.c[1] + Math.sin(tg * 3 + i) * 0.04, d.c[2] + Math.cos(a) * r), M4.RY(a + (i % 2 ? -1 : 1) * Math.PI / 2), M4.RZ(Math.sin(tg * 2.3 + i) * 0.06), M4.S(0.9)), spec: 0.4 }); } }
  // Tauben (picken, hüpfen)
  if (L.pigeons && opt.extras > 0) { const pg = pigeonGeo(); L.pigeons.forEach(([x, z], i) => { const p = [x, 0, z]; if (!inView(cam, p)) return; for (const q of C.ctx.obs) if (Math.hypot(q.p[0] - x, q.p[2] - z) < q.r + 0.8) return; const peck = Math.max(0, Math.sin(tg * 5 + i * 2)) ** 3, hop = Math.max(0, Math.sin(tg * 0.9 + i * 1.7)) > 0.97 ? Math.abs(Math.sin(tg * 14)) * 0.3 : 0, face = Math.floor(tg * 0.4 + i) * 1.9 + i; const root = M4.chain(M4.T(x, hop, z), M4.RY(face), M4.S(1.2)); items.push({ g: pg.body, m: root }, { g: pg.head, m: M4.chain(root, M4.T(0, 0.65 - peck * 0.35, 0.38 + peck * 0.15), M4.RX(peck * 1.2)) }); }); }
  // Springbrunnen: Wasserstrahlen als Tropfen-Parabeln
  if (L.fountain && opt.extras > 0) {
    const F = L.fountain, g = cgeo('drip', mb => mb.sphere(0.13, 1, '#bfe9ff'));
    for (let j = 0; j < 10; j++) { const a = j / 10 * 6.28, from = [F[0] + Math.sin(a) * 0.6, 4.4, F[2] + Math.cos(a) * 0.6], to = [F[0] + Math.sin(a) * 4.0, 1.0, F[2] + Math.cos(a) * 4.0], T = 0.85, Lc = launch(from, to, 1.2, T); for (let k = 0; k < 7; k++) { const q = ((tg / T + k / 7) % 1) * T; items.push({ g, m: M4.T(from[0] + Lc.v[0] * q, from[1] + Lc.v[1] * q - Lc.g / 2 * q * q, from[2] + Lc.v[2] * q), a: 0.75, e: 0.35, sh: false, spec: 1.2, zb: -5 }); } }
    for (let k = 0; k < 10; k++) { const q = ((tg / 1.1 + k / 10) % 1), y = 4.4 + 9 * q * 1.1 - 4.9 * (q * 1.1) ** 2 * 1.6; items.push({ g, m: M4.chain(M4.T(F[0] + Math.sin(k * 2.4) * 0.15, Math.max(3.8, y), F[2] + Math.cos(k * 2.4) * 0.15), M4.S(1.3)), a: 0.7, e: 0.35, sh: false, zb: -5 }); }
  }
  // Meer: Segelboote, Brandung
  if (L.boats && opt.extras > 0) { [['#e63946', -1, 0.9, -95], ['#1e88e5', 1, 0.6, -150], ['#ffb703', -1, 0.45, -210]].forEach(([c, dir, sp, z], i) => { const x = ((tg * sp * 2.2 * dir + i * 90) % 300 + 300) % 300 - 150; items.push({ g: boatGeo(c), m: M4.chain(M4.T(x, -0.3 + Math.sin(tg * 1.2 + i) * 0.15, z), M4.RY(dir * Math.PI / 2), M4.RZ(Math.sin(tg * 0.9 + i) * 0.06)), sh: false, recv: false }); }); }
  if (L.foam) { const g = cgeo('foam', mb => mb.box(300, 0.05, 0.9, '#ffffff')); for (let k = 0; k < 2; k++) { const q = ((tg * 0.18 + k * 0.5) % 1); items.push({ g, m: M4.T(0, 0.03, -25.2 - 2.2 * (1 - q) + 0.6 * Math.sin(q * Math.PI)), a: 0.75 * Math.sin(q * Math.PI), e: 0.5, sh: false, recv: false, zb: 30 }); } }
  // Schmetterlinge (Tag) / Glühwürmchen (Nacht)
  if (isOut && L.flutter && day > 0.5 && opt.extras > 0) { for (let i = 0; i < 3; i++) { const c = ['#ffb703', '#f15bb5', '#4cc9f0'][i], b = [-6 + i * 6 + Math.sin(tg * 0.5 + i) * 3, 1.6 + Math.sin(tg * 1.3 + i * 2) * 0.6, -6 - i * 2 + Math.cos(tg * 0.4 + i) * 2.5]; let ok = true; for (const q of C.ctx.obs) if (Math.hypot(q.p[0] - b[0], q.p[2] - b[2]) < 2.2) ok = false; if (!ok) continue; const flap = Math.sin(tg * 22 + i) * 1.1, root = M4.chain(M4.T(b[0], b[1], b[2]), M4.RY(tg * 0.7 + i)); items.push({ g: butterflyGeo(c), m: M4.chain(root, M4.RZ(flap)), sh: false, e: 0.15 }, { g: butterflyGeo(c), m: M4.chain(root, M4.RY(Math.PI), M4.RZ(flap)), sh: false, e: 0.15 }); } }
  if (isOut && L.fire && night > 0.5 && opt.extras > 0) { const g = speckGeo('#fff3a0'), Rf = rng(name.length * 5 + 3); for (let i = 0; i < 26; i++) { const x = (Rf() - 0.5) * 50, z = -4 - Rf() * 24, y = 0.8 + Rf() * 2.5, bl = Math.max(0, Math.sin(tg * (1.5 + Rf()) + i * 2)); if (bl < 0.05) continue; items.push({ g, m: M4.chain(M4.T(x + Math.sin(tg * 0.6 + i) * 0.8, y + Math.sin(tg * 0.9 + i * 3) * 0.4, z + Math.cos(tg * 0.5 + i) * 0.8), M4.S(1.6)), e: 1, a: bl, sh: false, add: true }); } }
  // Staub im Licht (innen)
  if (L.dust && opt.extras > 0) { const g = speckGeo('#fffbe8'), [x0, x1, y0, y1, z0, z1] = L.dust.box, Rd = rng(11); for (let i = 0; i < 40; i++) { const x = lerp(x0, x1, Rd()), z = lerp(z0, z1, Rd()), y = y0 + ((Rd() * (y1 - y0) - tg * 0.08 * (0.5 + Rd())) % (y1 - y0) + (y1 - y0)) % (y1 - y0); items.push({ g, m: M4.chain(M4.T(x + Math.sin(tg * 0.3 + i) * 0.4, y, z + Math.cos(tg * 0.25 + i) * 0.4), M4.S(0.45)), e: 1, a: 0.2, sh: false, add: true }); } }
}
