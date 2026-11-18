'use strict';
// ============ director.js – Shots, Kamera, Figuren, Effekte, Untertitel ============
const R = {}; window.R = R;
let CV, OC, OX;

const ENVS = {
  day: { skyTop: '#4a9be3', skyHor: '#d3ecfb', sun: [-0.36, 0.66, 0.66], sunC: '#fff4e0', sunI: 0.8, ambSky: [0.56, 0.62, 0.72], ambGnd: [0.37, 0.39, 0.33], fog: '#cfe7f7', fogD: 320, night: 0, win: 0, lamp: 0 },
  morning: { skyTop: '#6fb2f0', skyHor: '#fde6c8', sun: [-0.6, 0.45, 0.66], sunC: '#ffe2b8', sunI: 0.8, ambSky: [0.56, 0.58, 0.66], ambGnd: [0.38, 0.36, 0.32], fog: '#f2e3cf', fogD: 300, night: 0, win: 0.1, lamp: 0 },
  sunset: { skyTop: '#4b5ea8', skyHor: '#ffb487', sun: [-0.72, 0.3, 0.62], sunC: '#ffb36b', sunI: 0.85, ambSky: [0.5, 0.45, 0.58], ambGnd: [0.34, 0.28, 0.26], fog: '#f5b996', fogD: 290, night: 0.15, win: 0.55, lamp: 0.6 },
  night: { skyTop: '#060c2e', skyHor: '#22336b', sun: [0.25, 0.7, 0.55], sunC: '#a9bcff', sunI: 0.42, ambSky: [0.3, 0.35, 0.58], ambGnd: [0.14, 0.14, 0.22], fog: '#22336b', fogD: 250, night: 1, win: 1, lamp: 1 },
};
function envMix(a, b, t) { const o = {}; for (const k in a) { const va = a[k], vb = b[k]; if (typeof va === 'number') o[k] = lerp(va, vb, t); else if (Array.isArray(va)) o[k] = va.map((x, i) => lerp(x, vb[i], t)); else if (typeof va === 'string' && va[0] === '#') o[k] = mixc(va, vb, t); else o[k] = t < 0.5 ? va : vb; } return o; }

const LOOKS = {
  boy: { hair: 'spiky', hairColor: '#5a3418', shirt: '#2f6fe0', logo: 'star', pants: '#22355e' },
  girl: { hair: 'ponytail', hairColor: '#7a3e1d', shirt: '#f15bb5', logo: 'heart', logoBg: '#ffffff', logoColor: '#f15bb5', pants: '#3d405b' },
  man: { hair: 'short', hairColor: '#2b1b12', shirt: '#2a9d8f', pants: '#2b2b2b' },
  woman: { hair: 'long', hairColor: '#5a3418', shirt: '#9b5de5', pants: '#22355e' },
  dad: { hair: 'short', hairColor: '#3b2a1a', shirt: '#1e88e5', pants: '#3d405b', mustache: true },
  mom: { hair: 'bun', hairColor: '#7a3e1d', shirt: '#ef476f', pants: '#264653' },
  grandpa: { hair: 'bald', hairColor: '#e0e0e0', shirt: '#8d6e63', pants: '#4e342e', mustache: true, scale: 0.95 },
  grandma: { hair: 'bun', hairColor: '#d6d6d6', shirt: '#b388eb', pants: '#5c4d7d', glasses: true, scale: 0.93 },
  teacher: { hair: 'short', hairColor: '#4a2f1b', shirt: '#ffffff', pants: '#2b2b2b', glasses: true, belt: '#3b3b3b' },
  cop: { hair: 'cap', hatColor: '#1d3557', shirt: '#1d3557', pants: '#14213d', logo: 'star', logoColor: '#ffd23f', logoBg: '#1d3557' },
  chef: { hair: 'short', hat: 'chef', shirt: '#ffffff', pants: '#2b2b2b' },
  king: { hair: 'short', hairColor: '#8b5a2b', hat: 'crown', shirt: '#b5179e', pants: '#3a0ca3', beard: true },
  kid: { hair: 'spiky', shirt: '#ffb703', scale: 0.86 },
  mayor: { hair: 'short', hairColor: '#555555', hat: 'tophat', shirt: '#2b2d42', pants: '#2b2d42', mustache: true, logo: 'none' },
};
const SKINS = ['#f5c79a', '#e0a878', '#c68642', '#8d5524', '#ffdbac', '#f1c27d'];
const SHIRTS = ['#e63946', '#1e88e5', '#2a9d8f', '#ffb703', '#9b5de5', '#f15bb5', '#00bbf9', '#fb8500', '#06d6a0', '#ef476f', '#118ab2', '#ffd166'];
const PANTS = ['#22355e', '#2b2b2b', '#3d405b', '#264653', '#5c4033', '#1d3557'];
const HAIRS = ['short', 'spiky', 'long', 'ponytail', 'bun', 'cap', 'afro', 'beanie', 'short', 'pigtails'];
const HAIRC = ['#2b1b12', '#5a3418', '#8b5a2b', '#d4a017', '#111111', '#b5523b'];
function npcCfg(seed) { const r = rng(seed * 7919 + 13), pk = a => a[Math.floor(r() * a.length)]; return { ...AVDEF, skin: pk(SKINS), shirt: pk(SHIRTS), pants: pk(PANTS), hair: pk(HAIRS), hairColor: pk(HAIRC), hatColor: pk(SHIRTS), logo: r() < 0.35 ? pk(['star', 'heart', 'bolt', 'smile']) : 'none', logoColor: '#ffffff', logoBg: pk(SHIRTS), sleeves: r() < 0.3 ? 'short' : 'long' }; }
function cfgFor(id, a) {
  const c = (R.ep.cast && R.ep.cast[id]) || {};
  const animal = a.animal || c.animal; if (animal) return { animal, scale: a.scale || c.scale || 1 };
  if (a.npc !== undefined) return { ...npcCfg(a.npc), ...(a.look || {}) };
  const base = c.look ? (LOOKS[c.look] || {}) : (Object.keys(c).length ? {} : npcCfg(hash(id)));
  const o = { ...AVDEF, ...base, ...c, ...(a.look && typeof a.look === 'object' ? a.look : {}) }; delete o.look; delete o.name; return o;
}
const MOVERS = { walk: 1, run: 1, sneak: 1, hop: 1, dance: 1, spin: 1 };
const DEFMOOD = { yawn: 'yawn', sleep: 'sleep', lie: 'sleep', cheer: 'grin', laugh: 'laugh', cry: 'cry', scared: 'scared', angry: 'angry', talk: 'talk', think: 'think', dance: 'grin', jump: 'grin', spin: 'grin', fall: 'shock', facepalm: 'sad', shrug: 'confused', wave: 'happy', clap: 'grin' };
function timed(v, u, def) { if (v === undefined || v === null) return [def, u, 0, 1]; if (!Array.isArray(v)) return [v, u, 0, 1]; let cur = [def, 0, 0, 1]; for (const e of v) { const [a, t0 = 0, t1 = 1] = e; if (u >= t0 && u < t1) cur = [a, (u - t0) / Math.max(0.001, t1 - t0), t0, t1]; } if (u >= 1 && v.length) { const e = v[v.length - 1]; if ((e[2] ?? 1) >= 1) cur = [e[0], 1, e[1] ?? 0, e[2] ?? 1]; } return cur; }
function pt3(p, dy = 0) { if (!p) return [0, dy, 0]; return p.length === 3 ? [p[0], p[1], p[2]] : [p[0], dy, p[1]]; }

// ---------- Posen ----------
function pose(act, t, k, A) {
  const P = { y: 0, tb: 0, aLx: 0, aLz: 5, aRx: 0, aRz: -5, lLx: 0, lRx: 0, hx: 0, hy: 0, hz: 0, rx: 0, rz: 0, spin: 0 };
  const s = Math.sin, ph = A.ph;
  const idle = () => { P.tb = 0.04 * s(t * 2.2 + ph); P.aLz = 5 + 2 * s(t * 2.2 + ph); P.aRz = -P.aLz; P.hx = 2 * s(t * 1.3 + ph); P.hy = 5 * s(t * 0.7 + ph); };
  const walkC = (amp, lean) => { const q = s(A.cyc); P.lLx = amp * q; P.lRx = -amp * q; P.aLx = -amp * 0.85 * q; P.aRx = amp * 0.85 * q; P.y = Math.abs(Math.cos(A.cyc)) * 0.13 * amp / 32; P.rx = lean; P.hx = -lean * 0.5; };
  switch (act) {
    case 'walk': walkC(32, 2); break;
    case 'run': walkC(58, 12); P.aLz = 12; P.aRz = -12; break;
    case 'sneak': walkC(22, 16); P.y -= 0.35; P.aLx = -55; P.aRx = -55; break;
    case 'wave': idle(); P.aRz = -150 + 18 * s(t * 11); P.aRx = 0; P.hz = 6; break;
    case 'wave2': idle(); P.aRz = -150 + 18 * s(t * 11); P.aLz = 150 - 18 * s(t * 11 + 1); break;
    case 'cheer': { const j = Math.abs(s(t * 6.5 + ph)); P.y = j * 0.9; P.aLz = 155 + 12 * s(t * 13); P.aRz = -155 - 12 * s(t * 13); P.lLx = -12 * j; P.lRx = -12 * j; break; }
    case 'jump': { const j = Math.abs(s(t * 4.6 + ph)); P.y = j * 2.6; P.aLz = 40 + 110 * j; P.aRz = -P.aLz; P.lLx = -25 * j; P.lRx = 25 * j; break; }
    case 'point': idle(); P.aRx = -90; P.aRz = -4; break;
    case 'pointup': idle(); P.aRx = -170; P.aRz = -10; P.hx = -12; break;
    case 'talk': idle(); P.aRx = -28 - 16 * s(t * 3.1 + ph); P.aRz = -12; P.aLx = -10 - 8 * s(t * 2.3); P.hx = 3 * s(t * 6.5); P.hz = 3 * s(t * 2.1); break;
    case 'dance': { const b = s(t * 8 + ph); P.rz = 7 * b; P.y = Math.abs(b) * 0.35; P.aLz = 100 + 40 * s(t * 8); P.aRz = -100 + 40 * s(t * 8); P.lLz = 12 * Math.max(0, b); P.lRz = 12 * Math.min(0, b); P.hz = -6 * b; break; }
    case 'sit': P.y = -0.85; P.lLx = -90; P.lRx = -90; P.aLx = -35; P.aRx = -35; P.hx = 2 * s(t * 1.3 + ph); P.tb = 0.03 * s(t * 2.2 + ph); break;
    case 'sitdesk': P.y = -0.85; P.lLx = -90; P.lRx = -90; P.aLx = -75; P.aRx = -75; P.aLz = -6; P.aRz = 6; P.hx = 6 + 2 * s(t * 1.3 + ph); break;
    case 'sleep': case 'lie': P.y = 0.55; P.rx = -90; P.aLz = 8; P.aRz = -8; P.tb = 0.05 * s(t * 1.6); break;
    case 'yawn': { const e = smooth(Math.min(1, k * 4)) * (1 - smooth((k - 0.8) * 5)); idle(); P.aLz = 5 + 150 * e; P.aRz = -P.aLz; P.hx = -7 * e; P.tb = 0.12 * e; break; }
    case 'stretch': { const e = smooth(Math.min(1, k * 4)); idle(); P.aLz = 5 + 160 * e; P.aRz = -P.aLz; P.hx = -10 * e; P.y = 0.15 * e; break; }
    case 'throw': { const r = A.rel ?? 0.5; let a; if (k < r) a = lerp(0, 75, smooth(k / r)); else a = lerp(75, -135, smooth((k - r) / 0.12)); P.aRx = a; P.aRz = -10; P.rx = k < r ? -5 : 9; P.lLx = k >= r ? -22 : 0; P.aLx = -35; break; }
    case 'fall': { const e = easeIn(Math.min(1, k * 2.5)); P.rx = -90 * e; P.y = 0.55 * e; P.aLz = 5 + 80 * e; P.aRz = -P.aLz; P.lLx = -20 * e; break; }
    case 'faint': { const e = easeIn(Math.min(1, k * 2.5)); P.rz = 90 * e; P.y = 1.0 * e; P.aLz = 5 + 40 * e; P.aRz = -P.aLz; break; }
    case 'spin': P.spin = t * 720; P.aLz = 85; P.aRz = -85; P.y = 0.3 * Math.abs(s(t * 6)); break;
    case 'scared': idle(); P.dx = 0.07 * s(t * 60); P.aLx = -130; P.aRx = -130; P.aLz = -22; P.aRz = 22; P.hx = 8; break;
    case 'shrug': { idle(); const e = 0.5 + 0.5 * s(t * 3); P.aLz = 35 + 15 * e; P.aRz = -P.aLz; P.aLx = -40; P.aRx = -40; P.hz = 10 * e; P.tb = 0.08 * e; break; }
    case 'clap': { idle(); const c = s(t * 18); P.aLx = -70; P.aRx = -70; P.aLz = -14 - 10 * c; P.aRz = 14 + 10 * c; break; }
    case 'think': idle(); P.aRx = -140; P.aRz = 24; P.hz = 8; P.hx = -6; break;
    case 'nod': idle(); P.hx = 12 * s(t * 9); break;
    case 'no': idle(); P.hy = 24 * s(t * 9); break;
    case 'facepalm': idle(); P.aRx = -158; P.aRz = 26; P.hx = 15; break;
    case 'look': idle(); P.hy = 42 * s(t * 1.8); break;
    case 'lookup': idle(); P.hx = -25; break;
    case 'carry': idle(); P.aLx = -80; P.aRx = -80; P.aLz = -8; P.aRz = 8; break;
    case 'hold': idle(); P.aRx = -60; break;
    case 'piano': { const m = s(t * 13 + ph), m2 = s(t * 11 + ph + 1.7); P.y = -0.85; P.lLx = -90; P.lRx = -90; P.aLx = -66 + 5 * m; P.aRx = -66 + 5 * m2; P.aLz = -8; P.aRz = 8; P.hx = 8 + 3 * s(t * 2.4 + ph); P.hz = 4 * s(t * 1.2 + ph); P.rz = 2.5 * s(t * 1.2 + ph); break; }
    case 'game': { idle(); const m = s(t * 17 + ph); P.aLx = -42 + 3 * m; P.aRx = -42 - 3 * m; P.aLz = -36; P.aRz = 36; P.hx = 4; P.tb = 0.03 * Math.abs(s(t * 7 + ph)); break; }
    case 'sitgame': { const m = s(t * 17 + ph); P.y = -0.85; P.lLx = -90; P.lRx = -90; P.aLx = -55 + 3 * m; P.aRx = -55 - 3 * m; P.aLz = -36; P.aRz = 36; P.hx = 4 + 2 * s(t * 1.3 + ph); P.tb = 0.03 * s(t * 2.2 + ph); break; }
    case 'laugh': idle(); P.tb = 0.08 * Math.abs(s(t * 14)); P.hx = -14 + 4 * s(t * 14); P.aLx = -40; P.aRx = -40; P.aLz = -15; P.aRz = 15; break;
    case 'cry': idle(); P.aLx = -150; P.aRx = -150; P.aLz = -18; P.aRz = 18; P.hx = 14; P.tb = 0.04 * s(t * 12); break;
    case 'angry': idle(); P.aLz = 25; P.aRz = -25; P.aLx = -15; P.aRx = -15; P.tb = 0.03 * s(t * 20); P.dx = 0.03 * s(t * 40); break;
    case 'kick': { idle(); const e = s(clamp(k * 2, 0, 1) * Math.PI); P.lRx = -85 * e; P.aLx = 25 * e; P.rx = -6 * e; break; }
    case 'punch': idle(); P.aRx = -90 * Math.max(0, s(t * 10)); P.aLx = -40; break;
    case 'hop': P.y = Math.abs(s(t * 6 + ph)) * 1.2; P.aLz = 30; P.aRz = -30; break;
    case 'bow': idle(); P.rx = 32 * s(clamp(k, 0, 1) * Math.PI); break;
    case 'float': P.y = 2 + 0.4 * s(t * 2); P.aLz = 60; P.aRz = -60; P.lLx = 10; P.lRx = -10; break;
    case 'freeze': P.aLz = 30; P.aRz = -30; P.aLx = -20; P.aRx = -20; break;
    default: idle();
  }
  return P;
}
function apose(act, t, k, A, type) {
  const s = Math.sin, bip = (ANIMALS[type] || {}).biped;
  const P = { y: 0, tb: 0.05 * s(t * 2.4 + A.ph), leg: 0, wag: 25 * s(t * 8 + A.ph), hx: 3 * s(t * 1.5 + A.ph), hy: 0, hz: 0, flap: 8, rx: 0, rz: 0, spin: 0 };
  if (A.moving || act === 'walk' || act === 'run') { const amp = act === 'run' ? 45 : 30; P.leg = amp * s(A.cyc); P.tb = Math.abs(Math.cos(A.cyc)) * 0.12; if (bip === 'penguin') { P.rz = 9 * s(A.cyc); P.flap = 25 + 12 * s(A.cyc * 2); } if (bip === 'frog') { P.y = Math.abs(s(A.cyc)) * 1.2; P.leg = 0; } }
  if (act === 'hop' || act === 'jump' || act === 'cheer') { P.y = Math.abs(s(t * 6.5 + A.ph)) * (act === 'jump' ? 2.2 : 1.0); P.flap = 60 * Math.abs(s(t * 13)); }
  if (act === 'sit') { P.rx = -16; P.y = -0.3; }
  if (act === 'sleep' || act === 'lie') { P.y = -0.6; P.hx = 18; P.leg = 0; P.wag = 0; }
  if (act === 'float') { P.y = 0.4 + t * 1.5; P.rz = 6 * s(t * 2.2 + A.ph); P.leg = 12 * s(t * 3); P.wag = 0; }
  if (act === 'spin') P.spin = t * 600;
  if (act === 'talk' || act === 'nod') P.hx = 10 * s(t * 8);
  if (act === 'look') P.hy = 40 * s(t * 1.8);
  if (act === 'wave' || act === 'clap') P.flap = 55 + 35 * s(t * 12);
  if (act === 'scared') P.dx = 0.07 * s(t * 60);
  if (act === 'dance') { P.rz = 10 * s(t * 8); P.y = Math.abs(s(t * 8)) * 0.4; P.flap = 50 + 30 * s(t * 8); }
  return P;
}

// ---------- Figuren-Zustand ----------
function actorTop(cfg) { if (cfg.animal) { const A = ANIMALS[cfg.animal] || {}; return (A.biped ? 3.6 : 4.0) * (A.s || 1) * (cfg.scale || 1); } return 5.4 * (cfg.scale || 1); }
function actorState(a, tl, D, idx, sh) {
  const u = clamp(tl / D, 0, 1), id = a.id || ('_a' + idx), cfg = cfgFor(id, a);
  const st = { id, a, cfg, ph: (hash(id) % 1000) / 1000 * 6.28, y: a.y || 0, scale: a.scale || 1, sh: a.shadow !== false };
  let pts = [pt3(a.at)]; if (a.to) pts.push(pt3(a.to)); if (a.path) pts = [pts[0], ...a.path.map(p => pt3(p))];
  st.x = pts[0][0]; st.z = pts[0][2]; st.moving = false; st.dir = null; st.cyc = 0;
  if (pts.length > 1) {
    const [t0, t1] = a.move || [0, 1]; const k = clamp((u - t0) / Math.max(0.01, t1 - t0), 0, 1); st.moving = u > t0 && u < t1;
    const ke = a.ease === 'linear' ? k : lerp(k, smooth(k), 0.35);
    const L = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]); L.push(l); tot += l; }
    let d = ke * tot; st.cyc = d / 4.2 * Math.PI * 2 + st.ph;
    for (let i = 0; i < L.length; i++) { if (d <= L[i] || i === L.length - 1) { const f = L[i] ? clamp(d / L[i], 0, 1) : 1; st.x = lerp(pts[i][0], pts[i + 1][0], f); st.z = lerp(pts[i][2], pts[i + 1][2], f); st.dir = [pts[i + 1][0] - pts[i][0], pts[i + 1][2] - pts[i][2]]; break; } d -= L[i]; }
  }
  if (!st.moving) st.cyc = tl * Math.PI * 2 * 1.7 + st.ph;
  let [act, k] = timed(a.do, u, 'idle');
  if (st.moving && !MOVERS[act]) act = 'walk';
  st.act = act; st.k = k; st.rel = a.throw ? (a.throw.at ?? 0.5) : 0.5;
  if (act === 'throw' && Array.isArray(a.do)) { const e = a.do.find(e => e[0] === 'throw'); if (e) st.rel = clamp(((a.throw ? a.throw.at : 0.5) - (e[1] ?? 0)) / Math.max(0.01, (e[2] ?? 1) - (e[1] ?? 0)), 0.05, 0.95); }
  const [md] = timed(a.mood, u, DEFMOOD[act] || 'happy'); st.mood = md;
  st.h = actorTop(cfg) * st.scale; st.seat = (act === 'sit' || act === 'sitdesk' || act === 'sitgame' || act === 'piano') ? -0.85 * st.scale * (cfg.scale || 1) : 0;
  const [em] = timed(a.emote, u, null); st.emote = em;
  const [bb] = timed(a.bubble, u, null); st.bubble = bb;
  return st;
}
function faceOf(st, map, cam, u) {
  const a = st.a;
  let f = a.face;
  if (Array.isArray(f)) f = timed(f, u, 0)[0];
  if (st.moving && st.dir && (st.dir[0] || st.dir[1])) return Math.atan2(st.dir[0], st.dir[1]);
  if (typeof f === 'number') return f * DEG;
  if (f === 'cam' && cam) return Math.atan2(cam.eye[0] - st.x, cam.eye[2] - st.z);
  if (typeof f === 'string' && map[f]) { const o = map[f]; return Math.atan2(o.x - st.x, o.z - st.z); }
  if (st.dir) return Math.atan2(st.dir[0], st.dir[1]);
  return 0;
}

// ---------- Kamera ----------
const DEFANG = [16, -20, 26, -12, 8, -26, 20, -8];
function parseCam(c, sh) { if (!c) { const a = (sh.actors || []).find(x => x.id); c = a ? 'medium:' + a.id : 'wide'; } if (typeof c === 'string') { const [type, rest] = c.split(':'); c = { type }; if (rest) { const [x, y] = rest.split('>'); c.target = x; if (y) c.target2 = y; } } return c; }
function camera(sh, si, tl, D, set, map) {
  const c = parseCam(sh.cam, sh), u = clamp(tl / D, 0, 1), zoom = c.zoom ?? 0.1, push = c.pull ? 1 + zoom * u : 1 - zoom * u;
  const A = c.target ? map[c.target] : null, B = c.target2 ? map[c.target2] : null;
  const f = A ? [A.x, A.y + (A.seat || 0), A.z] : pt3(c.at), fs = A ? (A.cfg.animal ? Math.max(A.h / 5.4, 0.95) : A.h / 5.4) : 1, face = A ? A.face : 0, hy = A ? A.y + (A.seat || 0) + A.h * 0.86 : 3;
  let ang = face + (c.ang ?? DEFANG[si % DEFANG.length]) * DEG, eye, look, fov = 45;
  const around = (dist, ey, ly, a = ang) => { eye = [f[0] + Math.sin(a) * dist, f[1] + ey, f[2] + Math.cos(a) * dist]; look = [f[0], f[1] + ly, f[2]]; };
  switch (c.type) {
    case 'close': around((c.dist || 6.2) * fs * push, hy - f[1] - 0.15 * fs, hy - f[1] - 0.95 * fs); fov = 42; break;
    case 'medium': around((c.dist || 10.5) * fs * push, 3.9 * fs, 3.0 * fs); break;
    case 'full': around((c.dist || 14) * push, 4.8 * fs, 2.7 * fs); break;
    case 'low': around((c.dist || 6.5) * fs * push, 0.9, A ? A.h * 0.75 : 3); fov = 52; break;
    case 'high': around((c.dist || 7) * fs * push, (A ? A.h : 5) + 8, 1.6); fov = 50; break;
    case 'side': around((c.dist || 9) * fs * push, 3.9 * fs, 3.0 * fs, face + (c.ang ?? 90) * DEG); break;
    case 'back': case 'follow': { const a2 = face + Math.PI + (c.ang ?? 12) * DEG, d = (c.dist || 9) * push; eye = [f[0] + Math.sin(a2) * d, f[1] + 6, f[2] + Math.cos(a2) * d]; look = [f[0] + Math.sin(face) * 6, f[1] + 3, f[2] + Math.cos(face) * 6]; break; }
    case 'ots': { const T = B || { x: f[0] + Math.sin(face) * 8, z: f[2] + Math.cos(face) * 8, y: 0, h: 5.4 }; const dx = T.x - f[0], dz = T.z - f[2], L = Math.hypot(dx, dz) || 1, nx = dx / L, nz = dz / L; const side = c.side ?? 1; eye = [f[0] - nx * 3.4 * fs + nz * 1.8 * side, f[1] + 5.6 * fs, f[2] - nz * 3.4 * fs - nx * 1.8 * side]; look = [T.x, T.y + T.h * 0.8, T.z]; break; }
    case 'orbit': { const a2 = face + ((c.ang ?? -40) + (c.sweep ?? 80) * u) * DEG; around((c.dist || 11) * fs, 4.6 * fs, 3 * fs, a2); break; }
    case 'aerial': { const a2 = ((c.ang ?? 20) + 14 * u) * DEG, Rr = (c.dist || 40) * push; eye = [f[0] + Math.sin(a2) * Rr, f[1] + (c.h || 34) * push, f[2] + Math.cos(a2) * Rr]; look = [f[0], f[1], f[2] - 4]; fov = 50; break; }
    case 'dolly': { const dx = c.dx ?? 9, d = c.dist ?? 15, off = lerp(-dx, dx, u) * (c.dir === -1 ? -1 : 1); eye = [f[0] + off, f[1] + (c.h ?? 5), f[2] + d]; look = [f[0] + off * 0.6, f[1] + 3, f[2]]; fov = 48; break; }
    case 'top': eye = [f[0], f[1] + (c.h || 26) * push, f[2] + 0.6]; look = [f[0], f[1], f[2]]; fov = 50; break;
    case 'pov': { const fw = [Math.sin(face), Math.cos(face)]; eye = [f[0] + fw[0] * 0.8, f[1] + A.h * 0.85, f[2] + fw[1] * 0.8]; look = [f[0] + fw[0] * 12, f[1] + A.h * 0.6, f[2] + fw[1] * 12]; fov = 55; break; }
    case 'group': case 'two': {
      const L = Object.values(map).filter(s => !s.a.npcCrowd); if (!L.length) { eye = set.wide.eye; look = set.wide.look; break; }
      let cx = 0, cz = 0, mh = 0; for (const s of L) { cx += s.x; cz += s.z; mh = Math.max(mh, s.h); } cx /= L.length; cz /= L.length;
      const a2 = (c.ang ?? 0) * DEG, rx = Math.cos(a2), rz = -Math.sin(a2); let ext = 0; for (const s of L) ext = Math.max(ext, Math.abs((s.x - cx) * rx + (s.z - cz) * rz));
      fov = c.fov || 46; const hf = Math.atan(Math.tan(fov / 2 * DEG) * R.W / R.H); const d = clamp((ext + 2.2) / Math.tan(hf), 9, 70) * push;
      eye = [cx + Math.sin(a2) * d, 3.2 + d * 0.12, cz + Math.cos(a2) * d]; look = [cx, mh * 0.5, cz]; break;
    }
    case 'free': { const uu = c.move ? Math.max(0, Math.min(1, (u - c.move[0]) / Math.max(1e-3, c.move[1] - c.move[0]))) : u; eye = c.eye2 ? V3.lerp(c.eye, c.eye2, smooth(uu)) : c.eye; look = c.look2 ? V3.lerp(c.look, c.look2, smooth(uu)) : c.look; break; }
    case 'wide': default: { const dx = (c.drift ?? 3) * (u - 0.5) * (si % 2 ? 1 : -1); eye = [set.wide.eye[0] + dx, set.wide.eye[1], set.wide.eye[2] * push + (1 - push) * set.wide.look[2]]; look = [set.wide.look[0] + dx * 0.5, set.wide.look[1], set.wide.look[2]]; fov = 50; }
  }
  if (c.fov) fov = c.fov;
  if (set.bounds) { const [x0, x1, z0, z1, ym] = set.bounds; eye = [clamp(eye[0], x0, x1), clamp(eye[1], 0.5, ym), clamp(eye[2], z0, z1)]; }
  let shake = c.shake || 0;
  for (const fx of sh.fx || []) { if (fx.type === 'shake') { const t0 = (fx.t || 0) * D, d = fx.dur || 0.5; if (tl >= t0 && tl < t0 + d) shake = Math.max(shake, (fx.amp || 0.4) * (1 - (tl - t0) / d)); } if (fx.type === 'zoom') { const t0 = (fx.t || 0) * D, d = fx.dur || 0.6; if (tl >= t0) fov *= 1 - (fx.amp || 0.3) * Math.max(0, 1 - (tl - t0) / d) * smooth((tl - t0) / 0.08); } }
  if (shake) { const n = (a) => Math.sin(tl * 47 + a) * 0.6 + Math.sin(tl * 83 + a * 2) * 0.4; eye = [eye[0] + n(1) * shake, eye[1] + n(2) * shake, eye[2] + n(3) * shake]; look = [look[0] + n(4) * shake * 0.5, look[1] + n(5) * shake * 0.5, look[2]]; }
  return { eye, look, fov };
}

// ---------- Effekte ----------
const CONF = ['#e63946', '#ffd23f', '#1e88e5', '#2a9d8f', '#f15bb5', '#ff7f11'];
function fxItems(items, sh, tl, D, map) {
  for (const fx of sh.fx || []) {
    const t0 = (fx.t || 0) * D, dt = tl - t0; if (dt < 0) continue;
    const P = fx.at && typeof fx.at === 'string' && map[fx.at] ? [map[fx.at].x, map[fx.at].y + map[fx.at].h + 0.3, map[fx.at].z] : pt3(fx.at, 3);
    const Rr = rng(hash(JSON.stringify(fx)));
    if (fx.type === 'coins') {
      const n = fx.n || 14, g = PROPS.coin({}).parts[0].g;
      for (let i = 0; i < n; i++) { const vx = (Rr() - .5) * 9, vz = (Rr() - .5) * 9, vy = 9 + Rr() * 7, d = dt - i * 0.02; if (d < 0) continue; let y = P[1] + vy * d - 13 * d * d; if (y < 0.3) y = 0.3; items.push({ g, m: M4.chain(M4.T(P[0] + vx * Math.min(d, 1.2), y - 0.6, P[2] + vz * Math.min(d, 1.2)), M4.RY(d * 12 + i), M4.S(0.7)), e: 0.2 }); }
    }
    if (fx.type === 'confetti') {
      const n = fx.n || 80;
      for (let i = 0; i < n; i++) { const c = CONF[i % 6], g = cgeo('conf|' + c, mb => mb.box(0.35, 0.35, 0.03, c)); const x = P[0] + (Rr() - .5) * 16, z = P[2] + (Rr() - .5) * 10, y = P[1] + 9 + Rr() * 6 - dt * (2.5 + Rr() * 2); if (y < 0.05) continue; items.push({ g, m: M4.chain(M4.T(x + Math.sin(dt * 3 + i) * 0.6, y, z), M4.RX(dt * 5 + i), M4.RY(dt * 3 + i * 2)), e: 0.3, sh: false }); }
    }
    if (fx.type === 'poof' && dt < 0.8) {
      const k = dt / 0.8, g = cgeo('puff', mb => mb.sphere(1, 1, '#ffffff'));
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28, r = 0.5 + 3 * easeOut(k); items.push({ g, m: M4.chain(M4.T(P[0] + Math.sin(a) * r, P[1] - 1 + (i % 3) * 0.8 + k, P[2] + Math.cos(a) * r), M4.S(0.8 + k * 1.2)), a: 1 - k, e: 0.5, sh: false }); }
    }
    if (fx.type === 'snow' || fx.type === 'rain') {
      const n = fx.n || 160, g = fx.type === 'snow' ? cgeo('flake', mb => mb.sphere(0.12, 0, '#ffffff')) : cgeo('drop', mb => mb.box(0.04, 0.7, 0.04, '#9fd3ff'));
      for (let i = 0; i < n; i++) { const sp = fx.type === 'snow' ? 2 + Rr() * 1.5 : 22 + Rr() * 8; const x = P[0] + (Rr() - .5) * 40, z = P[2] + (Rr() - .5) * 30, y = ((Rr() * 18 - dt * sp) % 18 + 18) % 18; items.push({ g, m: M4.T(x + Math.sin(dt + i) * 0.4, y, z), e: 0.6, sh: false }); }
    }
  }
}
function propState(items, p, tl, D, map, u) {
  let pos = pt3(p.at), s = p.s || p.scale || 1, ry = (p.ry || 0) * DEG + (p.spin ? tl * p.spin * DEG : 0), rx = 0;
  if (p.pop !== undefined) { const k = (tl - p.pop * D) / 0.3; if (k < 0) return; s *= backOut(k); }
  if (p.hide !== undefined) { const k = (tl - p.hide * D) / 0.2; if (k > 1) return; if (k > 0) s *= 1 - k; }
  if (p.bob) pos[1] += Math.sin(tl * 3) * p.bob;
  if (p.fly) { const [a, b] = p.fly.t || [0, 1], k = clamp((u - a) / Math.max(0.01, b - a), 0, 1), from = pt3(p.fly.from || p.at), to = pt3(p.fly.to); pos = V3.lerp(from, to, k); pos[1] += (p.fly.arc ?? 4) * 4 * k * (1 - k); if (k > 0 && k < 1) rx = tl * 9; }
  if (p.on && map[p.on]) { const A = map[p.on]; if (p.head) pos = [A.x, A.y + A.h + 0.1, A.z]; else if (A.rig) { propItems(items, p.type, p, M4.mul(A.rig.handR, M4.chain(M4.RX(Math.PI / 2), M4.S(s), M4.T(0, -0.5, 0)))); return; } }
  propItems(items, p.type, p, M4.chain(M4.T(pos[0], pos[1], pos[2]), M4.RY(ry), M4.RX(rx), M4.S(s)));
}

// ---------- 2D-Overlay ----------
function proj(p) { const q = M4.proj(GL.VP, p); return [(q[0] * 0.5 + 0.5) * R.W, (0.5 - q[1] * 0.5) * R.H, q[2]]; }
function outlined(x, txt, X, Y, size, fill = '#ffffff', stroke = '#000000', lw = 0.2) { x.font = `bold ${size}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = size * lw; x.strokeStyle = stroke; x.strokeText(txt, X, Y); x.fillStyle = fill; x.fillText(txt, X, Y); }
function drawCaption(x, words, tl) {
  let cur = null;
  for (let i = 0; i < words.length; i++) { const w = words[i], nx = words[i + 1]; const end = nx ? Math.min(nx.t0, w.t1 + 0.7) : w.t1 + 0.7; if (tl >= w.t0 - 0.02 && tl < end) cur = w; }
  if (!cur) return;
  const k = (tl - cur.t0) / 0.15, sc = lerp(0.55, 1, backOut(k));
  let size = R.ep.capSize || 104; x.font = `bold ${size}px ${FONT}`; const tw = x.measureText(cur.w).width; if (tw > R.W * 0.88) size *= R.W * 0.88 / tw;
  x.save(); x.translate(R.W / 2, R.H * (R.ep.capY || 0.64)); x.scale(sc, sc);
  x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowOffsetY = size * 0.08;
  outlined(x, cur.w, 0, 0, size, cur.hi ? '#ffe14d' : '#ffffff', '#000', 0.2);
  x.restore();
}
function drawOverlay(sh, tl, D, map, list) {
  const x = OX, u = tl / D;
  // Vignette
  const g = x.createRadialGradient(R.W / 2, R.H / 2, R.H * 0.35, R.W / 2, R.H / 2, R.H * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.22)'); x.fillStyle = g; x.fillRect(0, 0, R.W, R.H);
  for (const A of list) {
    if (!A.emote && !A.bubble && !(A.a.zzz)) continue;
    const hp = A.rig && A.rig.head && !A.cfg.animal ? M4.xp(A.rig.head, [0, 0, 0]) : [A.x, A.y + (A.seat || 0) + A.h - 0.7, A.z]; const p = proj([hp[0], hp[1] + 1.6, hp[2]]); if (p[2] <= 0.1) continue; const sz = clamp(1300 / p[2], 50, 170); p[0] = clamp(p[0], sz * 0.8, R.W - sz * 0.8); p[1] = clamp(p[1], sz * 1.4, R.H * 0.55);
    if (A.emote === 'zzz' || A.a.zzz) { for (let i = 0; i < 3; i++) { const q = ((tl * 0.7 + i / 3) % 1); x.globalAlpha = Math.sin(q * Math.PI); outlined(x, 'Z', p[0] + q * sz * 0.9 + i * 8, p[1] - q * sz * 1.4, sz * (0.5 + q * 0.5), '#ffffff', '#1d2b6b', 0.18); } x.globalAlpha = 1; }
    else if (A.emote) { const b = Math.sin(tl * 6) * sz * 0.06; x.font = `${sz}px "Noto Color Emoji", ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; const isEmoji = /\p{Extended_Pictographic}/u.test(A.emote); if (isEmoji) x.fillText(A.emote, p[0], p[1] - sz * 0.5 + b); else outlined(x, A.emote, p[0], p[1] - sz * 0.5 + b, sz * 1.1, '#ffe14d', '#000', 0.2); }
    if (A.bubble) {
      const fs = 50; x.font = `bold ${fs}px ${FONT}`; const words = String(A.bubble).split(' '), lines = []; let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > R.W * 0.6 && cur) { lines.push(cur); cur = w; } else cur = t; } lines.push(cur);
      const bw = Math.max(...lines.map(l => x.measureText(l).width)) + 60, bh = lines.length * fs * 1.2 + 40; let bx = clamp(p[0] - bw / 2, 30, R.W - bw - 30), by = clamp(p[1] - bh - 70, 60, R.H - bh - 60);
      x.fillStyle = '#ffffff'; x.strokeStyle = '#1d1712'; x.lineWidth = 7; rrect(x, bx, by, bw, bh, 34); x.fill(); x.stroke();
      const tx = clamp(p[0], bx + 50, bx + bw - 50); x.beginPath(); x.moveTo(tx - 22, by + bh - 4); x.lineTo(p[0], Math.min(p[1] - 10, by + bh + 60)); x.lineTo(tx + 24, by + bh - 4); x.closePath(); x.fill(); x.stroke(); x.fillRect(tx - 18, by + bh - 12, 40, 10);
      x.fillStyle = '#1d1712'; x.textAlign = 'center'; x.textBaseline = 'middle'; lines.forEach((l, i) => x.fillText(l, bx + bw / 2, by + 20 + fs * 0.6 + i * fs * 1.2));
    }
  }
  for (const fx of sh.fx || []) {
    const t0 = (fx.t || 0) * D, dt = tl - t0; if (dt < 0) continue;
    const A = typeof fx.at === 'string' ? map[fx.at] : null;
    const base = A ? proj([A.x, A.y + A.h * 0.8, A.z]) : (fx.at ? proj(pt3(fx.at, 3)) : [R.W / 2, R.H * 0.45, 10]);
    if ((fx.type === 'hearts' || fx.type === 'sparkle' || fx.type === 'emojis') && dt < (fx.dur || 1.6)) {
      const em = fx.type === 'hearts' ? '❤️' : fx.type === 'sparkle' ? '✨' : (fx.e || '😂'), Rr = rng(hash(JSON.stringify(fx)));
      for (let i = 0; i < (fx.n || 7); i++) { const d = dt - i * 0.08; if (d < 0) continue; const k = d / (fx.dur || 1.6); const px = base[0] + (Rr() - .5) * 360, py = base[1] - k * 380 - Rr() * 60; x.globalAlpha = clamp(1.4 - k * 1.4, 0, 1); x.font = `${70 + Rr() * 40}px "Noto Color Emoji"`; x.textAlign = 'center'; x.fillText(em, px, py); } x.globalAlpha = 1;
    }
    if (fx.type === 'flash' && dt < (fx.dur || 0.35)) { x.fillStyle = fx.color || '#ffffff'; x.globalAlpha = 0.9 * (1 - dt / (fx.dur || 0.35)); x.fillRect(0, 0, R.W, R.H); x.globalAlpha = 1; }
    if (fx.type === 'dark') { x.fillStyle = '#000'; x.globalAlpha = clamp(dt / (fx.dur || 0.6), 0, 1) * (fx.amp || 0.6); x.fillRect(0, 0, R.W, R.H); x.globalAlpha = 1; }
  }
  for (const p of sh.pops || []) {
    const t0 = (p.t || 0) * D, dt = tl - t0, dur = p.dur || 1.2; if (dt < 0 || dt > dur) continue;
    let X = (p.x ?? 0.5) * R.W, Y = (p.y ?? 0.32) * R.H;
    if (p.at && map[p.at]) { const A = map[p.at], q = proj([A.x, A.y + A.h + 1.2, A.z]); X = q[0]; Y = q[1]; }
    const k = dt / dur, sc = backOut(dt / 0.18); x.save(); x.globalAlpha = clamp((1 - k) * 4, 0, 1); x.translate(X, Y - (p.rise ?? 120) * k); x.scale(sc, sc); x.rotate((p.rot || 0) * DEG);
    if (/^(\p{Extended_Pictographic}|\p{Regional_Indicator})/u.test(p.text)) { x.font = `${p.size || 150}px "Noto Color Emoji"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.text, 0, 0); }
    else outlined(x, p.text, 0, 0, p.size || 120, p.color || '#ffe14d', '#000', 0.2);
    x.restore();
  }
  if (sh.title) { const lines = String(sh.title).split('\n'); lines.forEach((l, i) => outlined(x, l, R.W / 2, R.H * 0.14 + i * 110, 92, '#ffffff', '#000', 0.2)); }
  drawCaption(x, sh.words || [], tl);
}

// ---------- Shot rendern ----------
function renderShot(sh, si, tl) {
  const D = sh.dur, u = clamp(tl / D, 0, 1), tg = (sh.tg0 || 0) + tl;
  const set = getSet(sh.set || 'street', sh.setOpts || {});
  let E = ENVS[sh.time || 'day'] || ENVS.day;
  if (sh.timeTo) { const [a, b] = sh.timeAt || [0.25, 0.75]; E = envMix(E, ENVS[sh.timeTo] || ENVS.night, smooth((u - a) / Math.max(0.01, b - a))); }
  E = { ...E };
  if (set.indoor) { const nf = E.night; E.sunI = lerp(0.42, 0.2, nf); E.ambSky = [lerp(0.8, 0.34, nf), lerp(0.79, 0.37, nf), lerp(0.8, 0.56, nf)]; E.ambGnd = [lerp(0.5, 0.16, nf), lerp(0.47, 0.16, nf), lerp(0.44, 0.24, nf)]; E.fogD = 9000; }
  // Figuren
  const list = (sh.actors || []).map((a, i) => actorState(a, tl, D, i, sh));
  if (sh.crowd) { const c = sh.crowd, Rr = rng(c.seed || si * 31 + 7), [x0, z0, x1, z1] = c.area || [-10, -8, 10, -2]; for (let i = 0; i < (c.n || 8); i++) list.push(actorState({ id: `_npc${c.seed || si}_${i}`, npc: (c.seed || si) * 100 + i, at: [lerp(x0, x1, Rr()), lerp(z0, z1, Rr())], do: c.do || 'idle', face: c.face ?? 'cam', mood: c.mood, npcCrowd: true, scale: c.scale }, tl, D, 100 + i, sh)); }
  const map = {}; for (const s of list) map[s.id] = s;
  for (const s of list) s.face = faceOf(s, map, null, u);
  const cam = camera(sh, si, tl, D, set, map);
  for (const s of list) if (s.a.face === 'cam' && !s.moving) s.face = faceOf(s, map, cam, u);
  const dl = V3.len(V3.sub(cam.eye, cam.look)); cam.shadowAt = cam.look;
  E.shR = clamp(dl * 1.1, 20, 80);
  // Szene
  const items = [];
  const bg = getBG(set.bg);
  const tintFor = k => {
    if (k === 'win') return { tint: mixc('#bfe3ff', '#ffd27a', E.win), e: lerp(0.12, 1, E.win) };
    if (k === 'lamp') return { tint: mixc('#fffbe0', '#ffe9a8', E.lamp), e: lerp(0.35, 1, E.lamp) };
    if (k === 'sky') return { tint: col(E.skyHor), e: 1 };
    if (k === 'bgwin') return { tint: mixc('#cfe0f5', '#ffd27a', E.win), e: lerp(0.1, 0.9, E.win) };
    if (k === 'cloud') return { tint: mixc('#ffffff', '#2a3560', E.night), e: lerp(0.5, 0.1, E.night) };
    if (k === 'glow') return { tint: mixc('#ffffff', '#4a5070', E.night), e: lerp(1, 0.5, E.night) };
    return {};
  };
  for (const it of bg.items) items.push({ ...it, ...tintFor(it.kind) });
  if (bg.clouds) items.push({ ...bg.clouds, m: M4.T((tg * 1.5) % 200 - 40, 0, 0), ...tintFor('cloud') });
  for (const it of set.items) items.push({ ...it, ...tintFor(it.kind) });
  for (const s of list) {
    const P = s.cfg.animal ? apose(s.act, tl, s.k, s, s.cfg.animal) : pose(s.act, tl, s.k, s);
    const blink = ((tg + s.ph) % 3.4) < 0.12;
    P.mood = s.mood; P.closed = blink;
    const tk = s.a.talk, talking = s.act === 'talk' || s.mood === 'talk' || tk === true || (Array.isArray(tk) && tk.some(w => u >= w[0] && u < w[1]));
    P.open = talking && (Math.sin(tl * 15 + s.ph) + 0.5 * Math.sin(tl * 23)) > 0.15;
    const S = { x: s.x, y: s.y, z: s.z, face: s.face, scale: s.scale, sh: s.sh };
    s.rig = s.cfg.animal ? animalItems(items, s.cfg.animal, S, P, tl) : avatarItems(items, s.cfg, S, P);
    const hold = s.a.hold, th = s.a.throw;
    if (hold) { const ho = typeof hold === 'string' ? { type: hold } : hold; if (ho.both && !s.cfg.animal) { const a = s.rig.handL, b = s.rig.handR; propItems(items, ho.type, ho, M4.chain(M4.T((a[12] + b[12]) / 2, (a[13] + b[13]) / 2 - 0.1, (a[14] + b[14]) / 2), M4.RY(s.face + Math.PI), M4.RX((ho.tilt ?? 30) * DEG), M4.S(ho.s || 0.8), M4.T(0, -0.3, 0))); } else if (s.cfg.animal) propItems(items, ho.type, ho, M4.mul(s.rig.head, M4.chain(M4.T(0, 0.1, 1.4), M4.S(ho.s || 0.6)))); else propItems(items, ho.type, ho, M4.mul(ho.hand === 'L' ? s.rig.handL : s.rig.handR, ho.dir === 'arm' ? M4.chain(M4.T(0, 0.2, 0), M4.RX(Math.PI), M4.S(ho.s || 0.8)) : M4.chain(M4.T(0, 0, 0.1), M4.RX(Math.PI / 2), M4.S(ho.s || 0.7), M4.T(0, -0.6, 0)))); }
    if (th && !s.cfg.animal) {
      const rel = (th.at ?? 0.5), flight = th.dur ?? 0.35, o = { type: th.item || 'ball', ...th };
      if (u < rel) propItems(items, o.type, o, M4.mul(s.rig.handR, M4.chain(M4.RX(Math.PI / 2), M4.S(th.s || 0.7), M4.T(0, -0.6, 0))));
      else {
        const k = clamp((u - rel) / flight, 0, 1);
        const fw = [Math.sin(s.face), Math.cos(s.face)], from = [s.x + fw[0] * 1.2 - Math.cos(s.face) * 1.5, s.y + 6.2, s.z + fw[1] * 1.2 + Math.sin(s.face) * 1.5];
        let to = th.to; to = typeof to === 'string' && map[to] ? [map[to].x, map[to].y + map[to].h * 0.8, map[to].z] : (to ? pt3(to, 0.5) : [s.x + fw[0] * 30, 0.5, s.z + fw[1] * 30]);
        const pos = V3.lerp(from, to, k); pos[1] += (th.arc ?? 6) * 4 * k * (1 - k);
        if (!(k >= 1 && th.vanish)) propItems(items, o.type, o, M4.chain(M4.T(pos[0], pos[1], pos[2]), M4.RY(s.face), M4.RX(k < 1 ? tl * 12 : 0), M4.S(th.s || 0.9)));
      }
    }
  }
  for (const p of sh.props || []) propState(items, p, tl, D, map, u);
  fxItems(items, sh, tl, D, map);
  GL.render(items, cam, E);
  OX.setTransform(1, 0, 0, 1, 0, 0); OX.drawImage(CV, 0, 0, R.W, R.H);
  drawOverlay(sh, tl, D, map, list);
}

R.init = async function (W = 1080, H = 1920, rs = 0.75) {
  CV = document.getElementById('gl'); CV.width = Math.round(W * rs); CV.height = Math.round(H * rs); GL = new GLR(CV);
  OC = document.getElementById('out'); OC.width = W; OC.height = H; OX = OC.getContext('2d'); OX.imageSmoothingEnabled = true; OX.imageSmoothingQuality = 'high';
  R.W = W; R.H = H;
  await document.fonts.load(`bold 100px Poppins`); await document.fonts.load(`100px "Noto Color Emoji"`);
  return true;
};
R.load = function (ep) { R.ep = ep; R.cast = ep.cast || {}; return ep.shots.length; };
R.frame = function (si, tl, q = 0.92) { renderShot(R.ep.shots[si], si, tl); return OC.toDataURL('image/jpeg', q); };
R.info = () => ({ sets: Object.keys(SETS), props: Object.keys(PROPS), animals: Object.keys(ANIMALS), looks: Object.keys(LOOKS), moods: Object.keys(MOODS) });
