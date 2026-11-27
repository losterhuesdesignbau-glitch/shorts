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
  boy: { hair: 'spiky', hairColor: '#5a3418', shirt: '#2f6fe0', logo: 'star', pants: '#22355e', shoes: '#e63946', backpack: '#ffb703', watch: true },
  girl: { hair: 'ponytail', hairColor: '#7a3e1d', shirt: '#f15bb5', logo: 'heart', logoBg: '#ffffff', logoColor: '#f15bb5', pants: '#3d405b', shoes: '#ffffff', sole: '#f15bb5', lashes: true, bow: '#ffd23f', earrings: true },
  man: { hair: 'side', hairColor: '#2b1b12', shirt: '#2a9d8f', pants: '#2b2b2b', watch: true, jacket: '#264653', shoes: '#5c4033', sole: '#3b2a1a' },
  woman: { hair: 'long', hairColor: '#5a3418', shirt: '#9b5de5', pants: '#22355e', lashes: true, earrings: true, chain: true, shoes: '#f15bb5' },
  dad: { hair: 'short', hairColor: '#3b2a1a', shirt: '#1e88e5', pants: '#3d405b', mustache: true, pattern: 'plaid', patternColor: '#0d47a1', watch: true, shoes: '#5c4033', sole: '#3b2a1a' },
  mom: { hair: 'bun', hairColor: '#7a3e1d', shirt: '#ef476f', pants: '#264653', lashes: true, earrings: true, apron: '#fff3d6' },
  grandpa: { hair: 'bald', hairColor: '#e0e0e0', shirt: '#8d6e63', pants: '#4e342e', mustache: true, glasses: true, vest: '#6d4c41', buttons: true, scale: 0.95, shoes: '#3b2a1a', sole: '#2b2b2b' },
  grandma: { hair: 'bun', hairColor: '#d6d6d6', shirt: '#b388eb', pants: '#5c4d7d', glasses: true, lashes: true, scarf: '#ef476f', chain: '#ffffff', scale: 0.93 },
  teacher: { hair: 'short', hairColor: '#4a2f1b', shirt: '#ffffff', pants: '#2b2b2b', glasses: true, belt: '#3b3b3b', tie: '#1e6fd9', buttons: true, shoes: '#3b2a1a', sole: '#2b2b2b' },
  cop: { hair: 'cap', hatColor: '#1d3557', shirt: '#1d3557', pants: '#14213d', badge: true, belt: '#111111', shades: true, shoes: '#111111', sole: '#111111' },
  chef: { hair: 'short', hat: 'chef', shirt: '#ffffff', pants: '#2b2b2b', apron: '#f1f1f1', scarf: '#e63946', buttons: true },
  king: { hair: 'short', hairColor: '#8b5a2b', hat: 'crown', shirt: '#b5179e', pants: '#3a0ca3', beard: true, cape: '#c1121f', chain: true, shoes: '#3a0ca3', sole: '#f5c518' },
  kid: { hair: 'spiky', shirt: '#ffb703', scale: 0.86, shorts: true, backpack: '#1e88e5', freckles: true, shoes: '#1e88e5' },
  mayor: { hair: 'short', hairColor: '#555555', hat: 'tophat', shirt: '#2b2d42', pants: '#2b2d42', mustache: true, logo: 'none', sash: '#e63946', bowtie: '#e63946', jacket: '#1b1b2f' },
  gamer: { hair: 'messy', hairColor: '#111111', shirt: '#7209b7', logo: 'bolt', logoBg: '#3a0ca3', headphones: '#2b2d42', hoodie: true, pants: '#1b1b1b', shoes: '#4cc9f0' },
  hero: { hair: 'short', hairColor: '#1b1b1b', shirt: '#1e40af', logo: 'bolt', logoBg: '#facc15', logoColor: '#1e40af', pants: '#1e3a8a', cape: '#dc2626', belt: '#facc15', boots: true, shoes: '#dc2626', sole: '#991b1b' },
  wizard: { hair: 'long', hairColor: '#e0e0e0', hat: 'wizard', hatColor: '#3a0ca3', shirt: '#4c1d95', pants: '#4c1d95', beard: true, cape: '#312e81', sash: '#facc15' },
  student: { hair: 'curly', hairColor: '#3b2a1a', shirt: '#06d6a0', pattern: 'stripes', patternColor: '#ffffff', pants: '#22355e', backpack: '#ef476f', glasses: true, shoes: '#ffffff', sole: '#ef476f' },
  worker: { hair: 'short', hat: 'hardhat', hatColor: '#ffc300', shirt: '#ff7f11', vest: '#ffd23f', pants: '#22355e', boots: true, shoes: '#5c4033', sole: '#2b2b2b', beard: true },
  cowboy: { hair: 'short', hairColor: '#8b5a2b', hat: 'cowboy', hatColor: '#8b5a2b', shirt: '#c0392b', pattern: 'plaid', patternColor: '#7f1d1d', pants: '#1e3a8a', belt: '#5c4033', boots: true, shoes: '#6b3e26', scarf: '#ffd23f' },
};
const SKINS = ['#f5c79a', '#e0a878', '#c68642', '#8d5524', '#ffdbac', '#f1c27d'];
const SHIRTS = ['#e63946', '#1e88e5', '#2a9d8f', '#ffb703', '#9b5de5', '#f15bb5', '#00bbf9', '#fb8500', '#06d6a0', '#ef476f', '#118ab2', '#ffd166'];
const PANTS = ['#22355e', '#2b2b2b', '#3d405b', '#264653', '#5c4033', '#1d3557'];
const HAIRS = ['short', 'spiky', 'long', 'ponytail', 'bun', 'cap', 'afro', 'beanie', 'side', 'pigtails', 'bob', 'curly', 'buzz'];
const HAIRC = ['#2b1b12', '#5a3418', '#8b5a2b', '#d4a017', '#111111', '#b5523b'];
// Mii Town (Lukas 26.11.): Statisten/Passanten sind auch Mii-Figuren (gleicher Stil wie die Hauptfiguren)
const MII_SK = ['#ffe4cc', '#f6d2b4', '#ecc3a0', '#ddb08c', '#c99a78', '#a97a5c', '#865c44', '#5e4130'];
const MII_HC = ['#1b1b1b', '#2b1b12', '#4a2e1a', '#6d4c41', '#8b5a2b', '#b5523b', '#d4a017', '#e2c17c'];
const MII_SH = ['#e63946', '#fb8500', '#ffd166', '#8ac926', '#2a9d8f', '#1e88e5', '#00bbf9', '#f15bb5', '#9b5de5', '#8d6e63', '#f5f5f5', '#2b2b2b'];
function miiNpcCfg(seed, o = {}) {
  const r = rng(seed * 104729 + 7), pk = a => a[Math.floor(r() * a.length)], w = r() < 0.5, kid = o.kid || r() < 0.18, old = !kid && r() < 0.15;
  const hc = old ? pk(['#c9c9c9', '#e0e0e0', '#9e9e9e']) : pk(MII_HC);
  return { ...AVDEF, style: 'mii', skin: pk(MII_SK), hair: old ? pk(w ? ['bun', 'bob', 'short'] : ['short', 'side', 'bald']) : pk(w ? ['long', 'ponytail', 'bob', 'bun', 'pigtails', 'side', 'curly'] : ['short', 'side', 'messy', 'buzz', 'curly', 'spiky']),
    hairColor: hc, eyeColor: pk(['#3b2416', '#2f2f2f', '#2e6db4', '#3f8f5a', '#6c757d']), face: pk(['round', 'oval', 'square', 'wide', 'long']), nose: pk(['button', 'round', 'long', 'wide', 'small']),
    ears: pk(['normal', 'normal', 'small', 'big']), facekit: { eye: pk(['round', 'oval', 'almond', 'big', 'narrow']), es: 0.9 + r() * 0.25, edx: Math.round(r() * 9 - 4), ey: Math.round(r() * 8 - 4), brow: pk(['thin', 'flat', 'arched', 'thick']), browColor: hc, my: Math.round(r() * 7 - 3) },
    shirt: pk(MII_SH), pants: pk(['#22355e', '#2b2b2b', '#3d405b', '#264653', '#5c4033', '#1d3557', '#6c757d']), shoes: pk(['#ffffff', '#2b2b2b', '#5c4033', '#e63946', '#1e88e5']), logo: 'none',
    headScale: kid ? 1.55 : 1.42, scale: kid ? 0.82 : old ? 0.94 : 0.96 + r() * 0.06, lashes: w, glasses: r() < 0.15, beard: !w && !kid && r() < 0.12, hoodie: r() < 0.15 };
}
function npcCfg(seed) { if (R.ep && R.ep.miiTown) return miiNpcCfg(seed); const r = rng(seed * 7919 + 13), pk = a => a[Math.floor(r() * a.length)]; return { ...AVDEF, skin: pk(SKINS), shirt: pk(SHIRTS), pants: pk(PANTS), hair: pk(HAIRS), hairColor: pk(HAIRC), hatColor: pk(SHIRTS), logo: r() < 0.35 ? pk(['star', 'heart', 'bolt', 'smile']) : 'none', logoColor: '#ffffff', logoBg: pk(SHIRTS), sleeves: r() < 0.3 ? 'short' : 'long', shoes: pk(['#2b2b2b', '#ffffff', '#e63946', '#1e88e5', '#5c4033']), ...npcAcc(r, pk) }; }
function npcAcc(r, pk) {
  const o = {}, c = () => pk(SHIRTS);
  if (r() < 0.22) o.backpack = c(); if (r() < 0.15) o.glasses = true; else if (r() < 0.1) o.shades = true;
  if (r() < 0.12) o.headphones = true; if (r() < 0.15) o.watch = true; if (r() < 0.1) o.scarf = c(); if (r() < 0.12) o.jacket = pk(PANTS);
  if (r() < 0.1) o.hoodie = true; if (r() < 0.1) o.pattern = pk(['stripes', 'dots']); if (r() < 0.08) o.chain = true; if (r() < 0.12) o.shorts = true;
  if (r() < 0.07) o.hat = pk(['cowboy', 'beret', 'bandana']); return o;
}
// Mii-Proportionen (Lukas 27.11.: „Person darf nicht so groß wie Bett oder Haus sein“): Miis waren ~6.6–7 Einheiten groß,
// Möbel/Häuser sind für ~5.4 gebaut (Bett 6.2 lang ≈ 2 m). Faktor 0.8 -> Erwachsene ≈ 5.3–5.6, Kinder ≈ 4.2. Pro Folge änderbar: "miiScale".
const MII_K = 0.8;
function miiK(o) { return o && o.style === 'mii' ? { ...o, scale: (o.scale || 1) * (R.ep.miiScale ?? MII_K) } : o; }
function cfgFor(id, a) {
  const c = (R.ep.cast && R.ep.cast[id]) || {};
  const animal = a.animal || c.animal; if (animal) return { animal, scale: a.scale || c.scale || 1 };
  if (a.npc !== undefined) return miiK({ ...npcCfg(a.npc), ...(a.look || {}) });
  const base = c.look ? (LOOKS[c.look] || {}) : (Object.keys(c).length ? {} : npcCfg(hash(id)));
  const o = { ...AVDEF, ...base, ...c, ...(a.look && typeof a.look === 'object' ? a.look : {}) }; delete o.look; delete o.name; return miiK(o);
}
const MOVERS = { walk: 1, run: 1, sneak: 1, hop: 1, dance: 1, spin: 1, strut: 1, jazzhands: 1, salute: 1, twist: 1, mocap: 1 };
const DEFMOOD = { yawn: 'yawn', sleep: 'sleep', lie: 'sleep', cheer: 'grin', laugh: 'laugh', cry: 'cry', scared: 'scared', angry: 'angry', talk: 'talk', think: 'think', dance: 'grin', jump: 'grin', spin: 'grin', fall: 'shock', facepalm: 'sad', shrug: 'confused', wave: 'happy', clap: 'grin' };
function timed(v, u, def) { if (v === undefined || v === null) return [def, u, 0, 1]; if (!Array.isArray(v)) return [v, u, 0, 1]; let cur = [def, 0, 0, 1]; for (const e of v) { const [a, t0 = 0, t1 = 1] = e; if (u >= t0 && u < t1) cur = [a, (u - t0) / Math.max(0.001, t1 - t0), t0, t1]; } if (u >= 1 && v.length) { const e = v[v.length - 1]; if ((e[2] ?? 1) >= 1) cur = [e[0], 1, e[1] ?? 0, e[2] ?? 1]; } return cur; }
function pt3(p, dy = 0) { if (!p) return [0, dy, 0]; return p.length === 3 ? [p[0], p[1], p[2]] : [p[0], dy, p[1]]; }

// ---------- Posen ----------
// glattes Rauschen (für Blicke, Gewichtsverlagerung) – deterministisch
function n1(t, seed) { const i = Math.floor(t), f = t - i, a = rng(i * 131 + seed * 7 + 1)(), b = rng((i + 1) * 131 + seed * 7 + 1)(); return lerp(a, b, f * f * (3 - 2 * f)) * 2 - 1; }
// Sprung mit Ausholen, Flugparabel und Landung (Squash & Stretch). p: Phase 0..1
function jumpArc(p, H) {
  const o = { y: 0, k: 4, c: 0, air: 0, sq: 0 };
  if (p < 0.18) { const c = smooth(p / 0.18); o.y = -0.42 * c; o.k = 70 * c; o.c = c; o.sq = 0.1 * c; }
  else if (p < 0.8) { const q = (p - 0.18) / 0.62; o.y = H * 4 * q * (1 - q); o.air = Math.sin(q * Math.PI); o.k = 18 + 14 * q; o.sq = -0.09 * Math.max(0, 1 - q * 3) - 0.04 * Math.max(0, q * 3 - 2); }
  else { const l = (p - 0.8) / 0.2, c = Math.sin(l * Math.PI) * (1 - l * 0.4); o.y = -0.36 * c; o.k = 62 * c; o.c = c; o.sq = 0.13 * c; }
  return o;
}
function pose(act, t, k, A) {
  const P = { y: 0, tb: 0, aLx: 0, aLz: 5, aRx: 0, aRz: -5, eL: 8, eR: 8, lLx: 0, lRx: 0, kL: 2, kR: 2, hx: 0, hy: 0, hz: 0, rx: 0, rz: 0, spin: 0, sq: 0, gx: 0 };
  const s = Math.sin, ph = A.ph, sd = Math.floor(ph * 1000);
  const idle = (calm = 1) => {
    const w = s(t * 0.7 + ph);
    P.tb = 0.035 * s(t * 2.0 + ph); P.rz = 1.3 * w * calm; P.kL = 3 + 6 * Math.max(0, w) * calm; P.kR = 3 + 6 * Math.max(0, -w) * calm; P.y = -0.03 * Math.abs(w) * calm;
    P.aLz = 5 + 2 * s(t * 2.0 + ph) + 1.5 * w; P.aRz = -5 - 2 * s(t * 2.0 + ph) + 1.5 * w; P.aLx = -4 + 3 * s(t * 0.9 + ph); P.aRx = -4 + 3 * s(t * 0.8 + ph + 1);
    P.eL = 12 + 4 * s(t * 1.1 + ph); P.eR = 12 + 4 * s(t * 1.2 + ph + 2);
    P.hx = 2 * s(t * 1.3 + ph) + 3 * n1(t * 0.35, sd + 3); P.hy = 10 * n1(t * 0.45, sd) * calm; P.hz = -P.rz * 0.6;
    const g = n1(t * 0.55, sd + 9); P.gx = g > 0.55 ? 1 : g < -0.55 ? -1 : 0;
  };
  const walkC = (amp, lean, kn, el) => {
    const q = s(A.cyc), c = Math.cos(A.cyc), r = amp / 32;
    P.lLx = amp * q; P.lRx = -amp * q; P.kL = 8 + kn * Math.max(0, -c) * (0.4 + 0.6 * Math.max(0, -q)); P.kR = 8 + kn * Math.max(0, c) * (0.4 + 0.6 * Math.max(0, q));
    P.aLx = -amp * 0.8 * q; P.aRx = amp * 0.8 * q; P.eL = el + 14 * Math.max(0, -q) * r; P.eR = el + 14 * Math.max(0, q) * r; P.aLz = 6; P.aRz = -6;
    P.y = (Math.abs(c) * 0.16 - 0.06) * r; P.rx = lean; P.tw = 7 * q * r; P.hy = -P.tw * 0.7; P.hx = -lean * 0.5 + 2 * Math.abs(c); P.rz = 2 * q * r;
  };
  switch (act) {
    case 'walk': walkC(32, 3, 38, 14); break;
    case 'run': walkC(58, 14, 85, 80); P.aLz = 12; P.aRz = -12; break;
    case 'sneak': walkC(20, 18, 30, 60); P.y -= 0.45; P.kL += 40; P.kR += 40; P.lLx -= 25; P.lRx -= 25; P.aLx = -50; P.aRx = -50; P.aLz = -8; P.aRz = 8; break;
    case 'wave': idle(); P.aRz = -110; P.aRy = -90; P.aRx = 0; P.eR = 75 + 28 * s(t * 11); P.hz = 6; break;
    case 'wave2': idle(); P.aRz = -110; P.aRy = -90; P.eR = 75 + 28 * s(t * 11); P.aLz = 110; P.aLy = 90; P.eL = 75 + 28 * s(t * 11 + 1); break;
    case 'cheer': { const j = jumpArc(((t + ph * 0.1) / 0.62) % 1, 0.9); P.y = j.y; P.kL = P.kR = j.k; P.lLx = P.lRx = -j.k * 0.45; P.sq = j.sq; P.aLz = 160 + 10 * s(t * 13); P.aRz = -160 - 10 * s(t * 13); P.eL = P.eR = 15 + 15 * s(t * 13); P.hx = -8; P.lift = Math.max(0, j.y); break; }
    case 'jump': { const j = jumpArc(((t + ph * 0.1) / 0.95) % 1, 2.6); P.y = j.y; P.kL = P.kR = j.k; P.lLx = P.lRx = -j.k * 0.5; P.sq = j.sq; P.bx = 12 * j.c; P.aLz = 20 + 140 * j.air; P.aRz = -P.aLz; P.aLx = P.aRx = 35 * j.c; P.eL = P.eR = 15; P.hx = -6 * j.air; P.lift = Math.max(0, j.y); break; }
    case 'hop': { const j = jumpArc(((t + ph * 0.1) / 0.5) % 1, 1.1); P.y = j.y; P.kL = P.kR = j.k; P.lLx = P.lRx = -j.k * 0.45; P.sq = j.sq; P.aLz = 30 + 20 * j.air; P.aRz = -P.aLz; P.eL = P.eR = 30; P.lift = Math.max(0, j.y); break; }
    case 'point': idle(0.5); P.aRx = -88; P.aRz = -4; P.eR = 4; P.hy = 0; break;
    case 'pointup': idle(0.5); P.aRx = -170; P.aRz = -10; P.eR = 5; P.hx = -12; break;
    case 'talk': { idle(0.7); const W = (A.shot && A.shot.words) || []; const G = gestureP(t, ph, sd, W), beat = Math.max(0, s(t * 7.3 + ph)) ** 2; Object.assign(P, G);
      // Betonung: auf hervorgehobenen Wörtern (*Wort*) eine deutliche Geste + Kopfnicken, genau zum Wort
      let em = 0; for (const w of W) if (w.hi) em = Math.max(em, Math.exp(-(((t - w.t0 - 0.06) / 0.17) ** 2)));
      if (em > 0.02) { const E = GEST[(hash('e' + sd + Math.round(t)) % 2) ? 2 : 0]; Object.assign(P, blendP(P, E, em * 0.85)); P.hx += 7 * em; } P.eR = (P.eR || 0) + 10 * beat; P.eL = (P.eL || 0) + 7 * beat; P.aRx = (P.aRx || 0) - 4 * beat; P.hx += 3 * beat + 2; P.hz = 3 * s(t * 2.1); P.tb += 0.02 * beat; break; }
    case 'turnaround': { const w = smooth(k); P.spin = 360 * w; const q = s(w * Math.PI); P.aLz = 40 + 50 * q; P.aRz = -40 - 50 * q; P.eL = P.eR = 20; P.kL = P.kR = 15 + 25 * q; P.y = 0.25 * q - 0.05; P.lLz = 10 * q; break; }
    case 'finale': { const w = smooth(Math.min(1, k * 3)); P.aRz = -140 * w; P.aRx = -20 * w; P.eR = 10; P.aRy = -60; P.aLz = 55 * w; P.aLx = -15 * w; P.eL = 25; P.aLy = 70; P.lLx = (A.a.finaleKnee ? -95 : -8) * w; P.lLz = (A.a.finaleKnee ? 10 : 18) * w; P.kL = (A.a.finaleKnee ? 115 : 14) * w; P.rz = -6 * w; P.hz = 8 * w; P.hx = -6 * w; P.y = 0.08 * w; break; }
    // Motion-Capture: Winkel pro Frame aus tools/mocap_retarget.py (actor.mocap = {fps, keys, frames, start?, gain?})
    case 'mocap': {
      const M = A.a.mocap; if (!M || !M.frames || !M.frames.length) break;
      const fi = clamp(((A.tg ?? t) - (M.start || 0)) * (M.fps || 30), 0, M.frames.length - 1), i0 = Math.floor(fi), i1 = Math.min(M.frames.length - 1, i0 + 1), w = fi - i0;
      const f0 = M.frames[i0], f1 = M.frames[i1], g = M.gain ?? 1;
      M.keys.forEach((key, j) => { const v = f0[j] * (1 - w) + f1[j] * w; P[key] = (key === 'dx' || key === 'dz') ? 0 : key === 'y' ? v * (M.move ?? 1) : v * (key[0] === 'a' || key[0] === 'e' || key[0] === 'l' || key[0] === 'k' ? g : 1); });
      break;
    }
    // Trend-Tänze im Takt: bpm (Standard 120) und boff (Versatz in s) pro Figur; Takt läuft über Schnitte weiter
    case 'strut': case 'jazzhands': case 'salute': case 'twist': case 'cross': case 'chicken': case 'kneelift': case 'kickback': case 'wavearms': case 'figure4': case 'stand': case 'headhand': {
      const bt = ((A.tg ?? t) + (A.a.boff || 0)) * (A.a.bpm || 120) / 60, i = Math.floor(bt), f = bt - i, sd2 = i % 2 ? 1 : -1;
      const lift = s(f * Math.PI), snap = Math.max(0, 1 - f * 3);
      // Beine: Schritt pro Schlag, Knie hoch, Fuß nach außen geschnippt
      P.lLx = sd2 < 0 ? -48 * lift : 6 * lift; P.lRx = sd2 > 0 ? -48 * lift : 6 * lift;
      P.kL = sd2 < 0 ? 75 * lift : 8; P.kR = sd2 > 0 ? 75 * lift : 8;
      P.lLz = sd2 < 0 ? 14 * lift : 0; P.lRz = sd2 > 0 ? -14 * lift : 0;
      P.y = 0.22 * lift - 0.08 - 0.06 * snap; P.rz = 4 * sd2 * lift; P.tw = 8 * sd2 * lift; P.hz = -3 * sd2 * lift; P.hx = -4 * snap;
      P.aLz = 22 + 12 * lift; P.aRz = -22 - 12 * lift; P.eL = P.eR = 22 + 18 * snap; P.aLx = -10 * sd2 * lift; P.aRx = 10 * sd2 * lift; P.aLy = 40; P.aRy = -40;
      if (act === 'jazzhands') {
        P.aLz = 82 + 10 * s(bt * Math.PI * 2); P.aRz = -82 - 10 * s(bt * Math.PI * 2 + 1); P.eL = P.eR = 12; P.aLx = -15 + 12 * s(bt * Math.PI * 4); P.aRx = -15 - 12 * s(bt * Math.PI * 4); P.aLy = 80; P.aRy = -80;
        P.lLx = sd2 < 0 ? -20 * lift : 0; P.lRx = sd2 > 0 ? -20 * lift : 0; P.lLz = sd2 < 0 ? 38 * lift : 0; P.lRz = sd2 > 0 ? -38 * lift : 0;
        P.kL = sd2 < 0 ? 30 * lift : 10; P.kR = sd2 > 0 ? 30 * lift : 10; P.rz = -9 * sd2 * lift; P.hz = 6 * sd2 * lift;
      }
      if (act === 'cross') { const w = s(bt * Math.PI); P.aLx = -70; P.aRx = -70; P.aLz = -18 + 6 * w; P.aRz = 18 - 6 * w; P.eL = P.eR = 60; P.aLy = 30; P.aRy = -30; P.lLx = P.lRx = 0; P.kL = P.kR = 12 + 10 * lift; P.lLz = P.lRz = 0; P.y = -0.08 + 0.05 * lift; P.tw = 10 * sd2 * lift; }
      if (act === 'chicken') { P.aLz = 70 + 12 * lift; P.aRz = -70 - 12 * lift; P.aLx = -20; P.aRx = -20; P.eL = P.eR = 125; P.aLy = 60; P.aRy = -60; P.lLx = P.lRx = 0; P.lLz = P.lRz = 0; P.kL = P.kR = 14 + 14 * lift; P.y = -0.1 + 0.08 * lift; P.hz = 6 * sd2 * lift; }
      // gehaltene Posen: weich ein-/ausblenden über den Abschnitt (k), leichtes Wippen im Takt
      const hold = Math.min(1, k / 0.18, (1 - k) / 0.18), hb = 0.15 * lift;
      if (act === 'kneelift') { const q = smooth(clamp(hold, 0, 1)); P.lRx = -100 * q; P.kR = 120 * q; P.lRz = -12 * q; P.lLx = 3; P.kL = 8 + 6 * hb; P.lLz = 0; P.aLx = -55; P.aRx = -40; P.aLz = 25; P.aRz = -35; P.eL = 95; P.eR = 80; P.aLy = 40; P.aRy = -40; P.y = 0.04 * q; P.rz = -4 * q; P.hx = -3; P.tw = 0; if (A.a.headhand) { P.aLz = 140; P.aLx = -40; P.eL = 120; P.aLy = 20; P.hz = 6; } }
      if (act === 'figure4' || act === 'kickback') { const q = smooth(clamp(hold, 0, 1)); P.lRx = 24 * q; P.lRz = -55 * q; P.kR = 125 * q; P.lLx = 2; P.kL = 10 + 8 * hb; P.lLz = 4 * q; P.rz = 9 * q; P.hz = -6 * q; P.tw = -8 * q;
        const w = s(bt * Math.PI); P.aLz = 55 + 15 * w; P.aRz = -55 + 15 * w; P.eL = P.eR = 85; P.aLx = -30 - 15 * w; P.aRx = -30 + 15 * w; P.aLy = 40; P.aRy = -40; P.y = 0.05 * q; }
      if (act === 'stand') { const w = s((A.tg ?? t) * 1.1); P.lLx = P.lRx = 0; P.lLz = 0; P.lRz = 0; P.kL = 20; P.kR = 3; P.lLx = -6; P.rz = 4 + w; P.hz = -3; P.y = -0.06; P.aLz = 6; P.aRz = -6; P.eL = P.eR = 8; P.aLx = P.aRx = 0; P.aLy = P.aRy = 0; P.tw = 3; if (A.a.headhand && k < 0.5) { P.aRz = -140; P.aRx = -40; P.eR = 120; P.hz = 6; } }
      if (act === 'headhand') { P.aRz = -140; P.aRx = -40; P.eR = 120; P.aRy = -20; P.aLz = 12; P.eL = 10; P.aLx = 0; P.lLx = P.lRx = 0; P.lLz = P.lRz = 0; P.kL = 14; P.kR = 4; P.rz = 4; P.hz = 7; P.hx = -4; P.y = -0.04; }
      if (act === 'wavearms') { const w = s(bt * Math.PI * 2); P.aLz = 80 + 18 * w; P.aRz = -80 + 18 * w; P.eL = 30 - 25 * w; P.eR = 30 + 25 * w; P.aLx = -10; P.aRx = -10; P.aLy = 60; P.aRy = -60; P.lLx = P.lRx = 0; P.lLz = P.lRz = 0; P.kL = P.kR = 10 + 10 * lift; P.y = -0.05 + 0.05 * lift; P.rz = 4 * w; P.hz = -3 * w; }
      if (act === 'salute') { P.aRx = -105; P.aRz = -50; P.eR = 128; P.aRy = -35; P.aLz = 45 + 8 * lift; P.eL = 15; P.hz = 9; P.hx = -8; P.hy = -8; }
      if (act === 'twist') {
        const w = s(bt * Math.PI); P.tw = 32 * w; P.hy = -14 * w; P.kL = P.kR = 32 + 10 * lift; P.lLx = P.lRx = -14; P.y = -0.22 + 0.08 * lift; P.rz = 5 * w;
        P.aLx = 55 * w; P.aRx = -55 * w; P.eL = 70 + 20 * w; P.eR = 70 - 20 * w; P.aLz = 30; P.aRz = -30; P.aLy = 50; P.aRy = -50; P.lLz = P.lRz = 0;
      }
      break;
    }
    case 'dance': { const b = s(t * 8 + ph), c = Math.abs(b); P.rz = 7 * b; P.y = c * 0.3 - 0.2; P.kL = P.kR = 20 + 20 * c; P.lLx = P.lRx = -10 * c; P.aLz = 70 + 35 * s(t * 8); P.aRz = -70 + 35 * s(t * 8); P.eL = P.eR = 70 + 20 * b; P.aLy = 60; P.aRy = -60; P.lLz = 10 * Math.max(0, b); P.lRz = 10 * Math.min(0, b); P.hz = -6 * b; P.tw = 10 * s(t * 4 + ph); break; }
    case 'sit': idle(0); P.y = -0.85; P.lLx = -90; P.lRx = -90; P.kL = 88; P.kR = 88; P.aLx = -28; P.aRx = -28; P.eL = 40; P.eR = 40; P.rz = 0; break;
    case 'sitdesk': idle(0); P.y = -0.85; P.lLx = -90; P.lRx = -90; P.kL = 85; P.kR = 85; P.aLx = -42; P.aRx = -42; P.eL = 52; P.eR = 52; P.aLz = -6; P.aRz = 6; P.hx = 8 + 2 * s(t * 1.3 + ph); P.rz = 0; break;
    case 'sleep': case 'lie': P.y = 0.55; P.rx = -90; P.aLz = 8; P.aRz = -8; P.eL = P.eR = 15; P.kL = 12; P.kR = 4; P.tb = 0.05 * s(t * 1.6); P.hz = 8; break;
    case 'yawn': { const e = smooth(Math.min(1, k * 4)) * (1 - smooth((k - 0.8) * 5)); idle(); P.aLz = 5 + 150 * e; P.aRz = -P.aLz; P.eL = P.eR = 12 + 35 * e; P.hx = -9 * e; P.tb = 0.12 * e; P.bx = -6 * e; break; }
    case 'stretch': { const e = smooth(Math.min(1, k * 4)); idle(); P.aLz = 5 + 160 * e; P.aRz = -P.aLz; P.eL = P.eR = 5; P.hx = -10 * e; P.y = 0.15 * e; P.bx = -8 * e; break; }
    case 'throw': {
      const r = A.rel ?? 0.5; let a, el, tw;
      if (k < r) { const w = smooth(k / r); a = lerp(0, 80, w); el = lerp(10, 70, w); tw = lerp(0, -28, w); }
      else { const w = smooth((k - r) / 0.12); a = lerp(80, -125, w); el = lerp(70, 0, Math.min(1, w * 1.4)); tw = lerp(-28, 22, w); }
      P.aRx = a; P.eR = el; P.aRz = -12; P.tw = tw; P.hy = -tw * 0.6; P.rx = k < r ? -6 : 10; P.lLx = k >= r ? -26 : -8; P.kR = k >= r ? 22 : 10; P.aLx = -45; P.eL = 30; break;
    }
    case 'fall': { const k2 = k * 2.5, e = easeIn(Math.min(1, k2)), b = k2 > 1 ? 0.45 * Math.exp(-(k2 - 1) * 5) * Math.abs(s((k2 - 1) * 11)) : 0; P.rx = -90 * e + b * 18; P.y = 0.55 * e + b; P.aLz = 5 + 80 * e; P.aRz = -P.aLz; P.lLx = -20 * e; P.kL = 25 * e; P.kR = 10 * e; P.eL = P.eR = 20; break; }
    case 'faint': { const k2 = k * 2.5, buck = smooth(k2 / 0.35) * (1 - smooth((k2 - 0.6) / 0.4)), e = easeIn(clamp((k2 - 0.25) / 0.75, 0, 1)), b = k2 > 1 ? 0.35 * Math.exp(-(k2 - 1) * 5) * Math.abs(s((k2 - 1) * 11)) : 0; P.kL = P.kR = 45 * buck; P.y = -0.35 * buck + 1.0 * e + b; P.rz = 90 * e - b * 15; P.aLz = 5 + 40 * e; P.aRz = -P.aLz; P.eL = P.eR = 20; P.hx = 10 * buck; break; }
    case 'spin': P.spin = t * 720; P.aLz = 85; P.aRz = -85; P.eL = P.eR = 10; P.y = 0.3 * Math.abs(s(t * 6)); break;
    case 'scared': idle(0.3); P.dx = 0.07 * s(t * 60); P.aLx = -110; P.aRx = -110; P.eL = 70; P.eR = 70; P.aLz = -12; P.aRz = 12; P.hx = 8; P.kL = P.kR = 22; P.y = -0.15; break;
    case 'shrug': { idle(0.5); const e = 0.5 + 0.5 * s(t * 3); P.aLz = 18 + 10 * e; P.aRz = -P.aLz; P.aLx = -15; P.aRx = -15; P.eL = P.eR = 85; P.aLy = 55; P.aRy = -55; P.hz = 10 * e; P.tb = 0.1 * e; break; }
    case 'clap': { idle(0.5); const c = s(t * 18); P.aLx = -55; P.aRx = -55; P.eL = 45; P.eR = 45; P.aLz = -12 - 9 * c; P.aRz = 12 + 9 * c; break; }
    case 'think': idle(0.4); P.aRx = -50; P.eR = 60; P.aRz = 50; P.aRy = 90; P.aLx = -30; P.eL = 80; P.aLz = -20; P.hz = 8; P.hx = -6; P.gx = 1; break;
    case 'nod': idle(0.4); P.hx = 12 * s(t * 9); break;
    case 'no': idle(0.4); P.hy = 24 * s(t * 9); break;
    case 'facepalm': idle(0.3); P.aRx = -145; P.eR = 40; P.aRz = -30; P.aRy = 90; P.hx = 12; break;
    case 'look': idle(0.5); P.hy = 42 * s(t * 1.8); P.gx = Math.sign(s(t * 1.8)); break;
    case 'lookup': idle(0.5); P.hx = -25; break;
    case 'carry': idle(0.4); P.aLx = -70; P.aRx = -70; P.eL = P.eR = 25; P.aLz = -8; P.aRz = 8; break;
    case 'hold': idle(0.25); P.aRx = -38; P.eR = 40; P.aRz = -8; break;
    case 'game': { idle(0.4); const m = s(t * 17 + ph); P.aLx = -26 + 2 * m; P.aRx = -26 - 2 * m; P.eL = 72 + 4 * m; P.eR = 72 - 4 * m; P.aLz = -16; P.aRz = 16; P.hx = 10; P.tb = 0.03 * Math.abs(s(t * 7 + ph)); break; }
    case 'sitgame': { idle(0); const m = s(t * 17 + ph); P.y = -0.85; P.lLx = -90; P.lRx = -90; P.kL = P.kR = 86; P.aLx = -30 + 2 * m; P.aRx = -30 - 2 * m; P.eL = 70 + 4 * m; P.eR = 70 - 4 * m; P.aLz = -16; P.aRz = 16; P.hx = 8 + 2 * s(t * 1.3 + ph); P.rz = 0; break; }
    case 'laugh': idle(0.3); P.tb = 0.08 * Math.abs(s(t * 14)); P.hx = -14 + 4 * s(t * 14); P.aLx = -30; P.aRx = -30; P.eL = P.eR = 70; P.aLz = -12; P.aRz = 12; P.bx = -5 + 3 * s(t * 14); break;
    case 'cry': idle(0.3); P.aLx = P.aRx = -100 + 4 * s(t * 9); P.eL = P.eR = 100 + 6 * s(t * 12); P.aLz = 10; P.aRz = -10; P.aLy = -45; P.aRy = 45; P.hx = 14; P.tb = 0.04 * s(t * 12); P.bx = 8; break;
    case 'angry': idle(0.3); P.aLz = 22; P.aRz = -22; P.aLx = -12; P.aRx = -12; P.eL = P.eR = 35; P.tb = 0.03 * s(t * 20); P.dx = 0.03 * s(t * 40); P.bx = 6; break;
    case 'kick': { idle(0.3); const w = clamp(k * 2, 0, 1), up = s(w * Math.PI); P.lRx = -85 * up; P.kR = w < 0.35 ? 90 * smooth(w / 0.35) : 90 * (1 - smooth((w - 0.35) / 0.25)); P.aLx = 25 * up; P.aRx = -30 * up; P.rx = -6 * up; P.kL = 12; break; }
    case 'punch': { idle(0.3); const p = Math.max(0, s(t * 10)); P.aRx = -90 * p; P.eR = 95 * (1 - p) + 5; P.aLx = -40; P.eL = 100; P.tw = 15 * p; break; }
    case 'bow': idle(0.2); P.rx = 0; P.bx = 38 * s(clamp(k, 0, 1) * Math.PI); P.aLx = P.aRx = 10; break;
    case 'float': P.y = 2 + 0.4 * s(t * 2); P.aLz = 60 + 6 * s(t * 2); P.aRz = -P.aLz; P.lLx = 10; P.lRx = -10; P.kL = 25; P.kR = 15; P.eL = P.eR = 20; P.lift = P.y; break;
    case 'freeze': P.aLz = 30; P.aRz = -30; P.aLx = -20; P.aRx = -20; P.eL = P.eR = 30; break;
    case 'piano': { const m = s(t * 13 + ph), m2 = s(t * 11 + ph + 1.7); idle(0); P.y = -0.85; P.lLx = -90; P.lRx = -90; P.kL = P.kR = 86; P.aLx = -40 + 4 * m; P.aRx = -40 + 4 * m2; P.eL = 42 - 6 * m; P.eR = 42 - 6 * m2; P.aLz = -8; P.aRz = 8; P.hx = 8 + 3 * s(t * 2.4 + ph); P.hz = 4 * s(t * 1.2 + ph); P.rz = 2.5 * s(t * 1.2 + ph); break; }
    case 'chop': { idle(0.4); const k = Math.max(0, s(t * 18 + ph)); P.aRx = -60 - 32 * k; P.eR = 12 + 10 * k; P.aRz = 10; P.aLx = -62; P.eL = 14; P.aLz = -24; P.hx = 22; P.tb = 0.02 * k; break; }
    case 'shred': { idle(0.4); const k = (t * 2.6 + ph) % 1; P.aRx = -100 + 40 * k; P.eR = 10; P.aRz = 18; P.aLx = -82; P.eL = 14; P.aLz = -10; P.hx = 20; break; }
    case 'slice': { idle(0.4); const k = s(t * 9 + ph); P.aRx = -64 + 6 * k; P.eR = 12; P.aRz = 14 + 7 * k; P.aLx = -62; P.eL = 14; P.aLz = -18; P.hx = 22; break; }
    default: { idle(); const iv = IDLES[A.idleStyle || 0]; if (iv && act === 'idle') Object.assign(P, iv); }
  }
  return P;
}
function apose(act, t, k, A, type) {
  const s = Math.sin, bip = (ANIMALS[type] || {}).biped;
  const P = { y: 0, tb: 0.05 * s(t * 2.4 + A.ph), leg: 0, wag: 25 * s(t * 8 + A.ph), hx: 3 * s(t * 1.5 + A.ph) + 4 * n1(t * 0.4, 77), hy: 10 * n1(t * 0.35, Math.floor(A.ph * 100)), hz: 0, flap: 8, rx: 0, rz: 0, spin: 0 };
  if (A.moving || act === 'walk' || act === 'run') { const amp = act === 'run' ? 45 : 30; P.leg = amp * s(A.cyc); P.tb = Math.abs(Math.cos(A.cyc)) * 0.12; P.hy = 0; if (bip === 'penguin') { P.rz = 9 * s(A.cyc); P.flap = 25 + 12 * s(A.cyc * 2); } if (bip === 'frog') { P.y = Math.abs(s(A.cyc)) * 1.2; P.leg = 0; } }
  if (act === 'hop' || act === 'jump' || act === 'cheer') { const j = jumpArc(((t + A.ph * 0.1) / (act === 'jump' ? 0.9 : 0.55)) % 1, act === 'jump' ? 2.2 : 1.0); P.y = j.y; P.sq = j.sq; P.leg = -20 * j.c; P.flap = 60 * Math.abs(s(t * 13)); P.lift = Math.max(0, j.y); }
  if (act === 'sit') { P.rx = -16; P.y = -0.3; }
  if (act === 'sleep' || act === 'lie') { P.y = -0.6; P.hx = 18; P.hy = 0; P.leg = 0; P.wag = 0; }
  if (act === 'float') { P.y = 0.4 + t * 1.5; P.rz = 6 * s(t * 2.2 + A.ph); P.leg = 12 * s(t * 3); P.wag = 0; }
  if (act === 'spin') P.spin = t * 600;
  if (act === 'talk' || act === 'nod') P.hx = 10 * s(t * 8);
  if (act === 'look') P.hy = 40 * s(t * 1.8);
  if (act === 'wave' || act === 'clap') P.flap = 55 + 35 * s(t * 12);
  if (act === 'scared') P.dx = 0.07 * s(t * 60);
  if (act === 'dance') { P.rz = 10 * s(t * 8); P.y = Math.abs(s(t * 8)) * 0.4; P.flap = 50 + 30 * s(t * 8); }
  return P;
}

// ---------- Animation 6: Überblendung, Gesten, Blicke, Stoff-Physik ----------
function blendP(A, B, w) {
  if (w >= 1) return B; if (w <= 0) return A;
  const o = { ...B };
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) { const a = A[k], b = B[k]; if (typeof a === 'number' || typeof b === 'number') o[k] = lerp(typeof a === 'number' ? a : 0, typeof b === 'number' ? b : 0, w); }
  return o;
}
// vorheriges Segment einer timed-Liste: [wert, startzeit des aktuellen Segments in u]
function prevSeg(v, u, def) {
  if (!Array.isArray(v)) return null; let cur = null;
  for (const e of v) { const [a, s0 = 0, t = 1] = e; if (u >= s0 && u < t) cur = { a, s: s0 }; }
  if (!cur) { let last = null; for (const e of v) { const [a, s0 = 0, t = 1] = e; if (t <= u && (!last || t > last.t)) last = { a, t }; } return last ? { prev: last.a, cur: def, t0: last.t } : null; }
  let prev = def, bt = -1; for (const e of v) { const [a, s0 = 0, t = 1] = e; if (t <= cur.s + 1e-6 && t > bt) { bt = t; prev = Math.abs(t - cur.s) < 1e-3 ? a : def; } }
  return { prev, cur: cur.a, t0: cur.s };
}
// Redegesten-Bibliothek (rechter Arm R, linker Arm L gespiegelt)
const GEST = [
  { aRx: -35, aRz: -8, aRy: -30, eR: 70, aLx: -35, aLz: 8, aLy: 30, eL: 70 },               // erklären mit beiden Händen
  { aRx: -30, aRz: -20, aRy: -40, eR: 45, aLx: -30, aLz: 20, aLy: 40, eL: 45 },             // offene Handflächen
  { aRx: -75, aRz: -5, eR: 15, aLx: -8, aLz: 6, eL: 18 },                                    // nach vorn zeigen
  { aRx: -35, aRz: 35, aRy: 90, eR: 60, aLx: -6, aLz: 6, eL: 16 },                           // Hand auf die Brust
  { aLx: -40, aLz: 10, eL: 100, aRx: -10, aRz: -8, eR: 25 },                                 // eine Hand oben (aufzählen)
  { aLz: 18, aRz: -18, aLx: -15, aRx: -15, eL: 80, eR: 80, aLy: 55, aRy: -55 },              // kleines Achselzucken
  { aRx: -40, aRz: -5, eR: 75, aLz: -20, aLy: 30, eL: 30 },                                  // erklären, andere Hand in der Tasche
];
function gestureP(t, ph, sd, W) {
  // Gesten wechseln an Wortgrenzen (alle 3 Wörter), sonst im Zeittakt; nie zweimal dieselbe hintereinander
  if (W && W.length > 2) {
    let n = 0; for (const w of W) if (w.t0 <= t) n++;
    const i = Math.floor(n / 3), wb = W[Math.min(W.length - 1, (i + 1) * 3)], wa = W[Math.min(W.length - 1, i * 3)];
    const g0 = GEST[(hash('g' + sd + '|' + i) + (i % 2)) % GEST.length], g1 = GEST[(hash('g' + sd + '|' + (i + 1)) + ((i + 1) % 2)) % GEST.length];
    const f = wb.t0 > wa.t0 ? clamp((t - wa.t0) / (wb.t0 - wa.t0), 0, 1) : 0;
    return blendP(g0 === g1 ? GEST[(GEST.indexOf(g0) + 1) % GEST.length] : g0, g1, smooth((f - 0.7) / 0.3));
  }
  const segL = 1.35 + (sd % 5) * 0.12, k = (t + ph) / segL, i = Math.floor(k), f = k - i;
  const g0 = GEST[hash('g' + sd + '|' + i) % GEST.length], g1 = GEST[hash('g' + sd + '|' + (i + 1)) % GEST.length];
  return blendP(g0, g1, smooth((f - 0.72) / 0.28));
}
const IDLES = [null, { aRz: 30, aRx: 0, aRy: -75, eR: 50, aLz: -30, aLy: 75, eL: 50 }, { aRz: 20, aRx: 0, aRy: -30, eR: 30, aLz: -20, aLy: 30, eL: 30 }, { aRz: 20, aRx: 0, aRy: -30, eR: 30 }];
function talkingAt(s, u) { const tk = s.a.talk; if (tk === true) return true; if (Array.isArray(tk)) return tk.some(w => u >= w[0] && u < w[1]); const [ac] = timed(s.a.do, u, 'idle'); const [md] = timed(s.a.mood, u, 'happy'); return ac === 'talk' || md === 'talk'; }
// Blick-Ziel: explizit (look), sonst der gerade Sprechende, sonst (als Sprecher) die Kamera
function lookRel(s, list, map, cam, u) {
  const a = s.a; let T = null;
  let lk = a.look; if (Array.isArray(lk)) lk = timed(lk, u, null)[0];
  if (lk === 'cam') T = cam.eye; else if (lk === false || lk === 'none') return null; else if (typeof lk === 'string' && map[lk]) { const o = map[lk]; T = [o.x, o.y + o.h * 0.85, o.z]; }
  else if (Array.isArray(lk)) T = pt3(lk, 3);
  if (!T) { const me = talkingAt(s, u); if (!me) { const sp = list.find(o => o !== s && !o.a.npcCrowd && talkingAt(o, u)); if (sp) T = [sp.x, sp.y + sp.h * 0.85, sp.z]; } else if (s.a.face !== undefined || list.length === 1) T = cam.eye; }
  if (!T) return null;
  let yaw = Math.atan2(T[0] - s.x, T[2] - s.z) - s.face; yaw = ((yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const dist = Math.hypot(T[0] - s.x, T[2] - s.z), pitch = Math.atan2(T[1] - (s.y + s.h * 0.85), dist);
  if (Math.abs(yaw) > 2.2) return null;                            // Ziel hinter dem Rücken: nicht den Kopf verdrehen
  return { yaw: clamp(yaw / DEG, -65, 65), pitch: clamp(pitch / DEG, -30, 30) };
}
// ---- Stoff-/Haar-Physik: gedämpfte Pendel, angetrieben von Beschleunigung, Fahrtwind, Schwerkraft (Neigung), Wind ----
const CLOTHP = { cape: [4.2, 0.32, 1, 7], tail: [6.5, 0.22, 1, 4], pig: [7.5, 0.25, 1, 3], pack: [9, 0.45, 1, 0.8], skirt: [9, 0.4, 1, 1.5], tie: [9.5, 0.28, -1, 1.2], jacket: [10, 0.35, -1, 1.5], scarf: [8, 0.3, -1, 1.2], strings: [12, 0.25, -1, 0.8] };
const CLOTH = {};
function clothSim(s, si, sh, tl, D, map) {
  const key = si + '|' + s.id, c = s.cfg; if (c.animal) return null;
  const need = c.cape || c.hair === 'ponytail' || c.hair === 'pigtails' || c.tie || c.jacket || c.vest || c.scarf || c.hoodie || c.backpack || c.skirt; if (!need) return null;
  const idx = (sh.actors || []).indexOf(s.a);
  const smp = t => { const st = actorState(s.a, Math.max(0, t), D, idx < 0 ? 0 : idx, sh); st.face = faceOf(st, map, null, clamp(t / D, 0, 1)); const P = pose(st.act, t, st.k, st); return { x: st.x, z: st.z, y: st.y + (P.y || 0) * st.scale, f: st.face, lean: (P.rx || 0) + (P.bx || 0), rz: P.rz || 0 }; };
  const h = 1 / 120; let S = CLOTH[key];
  if (!S || tl < S.t - 1e-6 || tl - S.t > 0.6) {
    const t0 = Math.max(-1.0, tl - 1.2), a = smp(t0 - h), b = smp(t0);
    S = CLOTH[key] = { t: t0, p: b, v: [(b.x - a.x) / h, (b.y - a.y) / h, (b.z - a.z) / h], fv: 0, st: {} };
    for (const k in CLOTHP) S.st[k] = [0, 0, 0, 0];
  }
  while (S.t < tl - 1e-6) {
    const dt = Math.min(h, tl - S.t), t = S.t + dt, p = smp(t), v = [(p.x - S.p.x) / dt, (p.y - S.p.y) / dt, (p.z - S.p.z) / dt], acc = [(v[0] - S.v[0]) / dt, (v[1] - S.v[1]) / dt, (v[2] - S.v[2]) / dt];
    let df = p.f - S.p.f; df = ((df + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; const om = df / dt;
    const fw = [Math.sin(p.f), Math.cos(p.f)], rt = [fw[1], -fw[0]];
    const aF = clamp(acc[0] * fw[0] + acc[2] * fw[1], -60, 60), aS = clamp(acc[0] * rt[0] + acc[2] * rt[1], -60, 60), vF = v[0] * fw[0] + v[2] * fw[1], vY = clamp(v[1], -20, 20);
    const wind = 3 * n1(t * 0.6, 3) + 1.5 * Math.sin(t * 2.3 + s.ph);
    for (const k in CLOTHP) {
      const [w, z, side, kv] = CLOTHP[k], X = S.st[k];
      const eqX = -p.lean + side * clamp(vF * kv, -10, 70) + side * clamp(-vY * 2.2, -15, 40) + (side > 0 ? wind : wind * 0.3);
      const eqZ = -p.rz + clamp(om * vF * 1.2, -25, 25) + wind * 0.5;
      X[1] += (-w * w * (X[0] - eqX) - 2 * z * w * X[1] + aF * 5.5 * (side > 0 ? 1 : 0.6) / 1) * dt; X[0] += X[1] * dt;
      X[3] += (-w * w * (X[2] - eqZ) - 2 * z * w * X[3] - aS * 4.5) * dt; X[2] += X[3] * dt;
      X[0] = clamp(X[0], -60, 85); X[2] = clamp(X[2], -45, 45);
    }
    S.packY = clamp(-(acc[1]) * 0.002, -0.08, 0.08);
    S.t = t; S.p = p; S.v = v;
  }
  const o = { packY: S.packY || 0 }; for (const k in CLOTHP) o[k] = [S.st[k][0] + (k === 'cape' ? 6 : k === 'tail' ? 18 : 0), S.st[k][2]];
  return o;
}

// ---------- Figuren-Zustand ----------
function actorTop(cfg) { if (cfg.animal) { const A = ANIMALS[cfg.animal] || {}; return (A.biped ? 3.6 : 4.0) * (A.s || 1) * (cfg.scale || 1); } return (cfg.style === 'mii' ? 3.98 + 1.94 * (+cfg.headScale || 1.45) : 5.4) * (cfg.scale || 1); }   // Mii Town: großer Kopf -> größere Figur
const angLerp = (a, b, t) => { const d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; };
// Weg (Polylinie) → Position nach Strecke d
function polyAt(pts, L, d) {
  for (let i = 0; i < L.length; i++) { if (d <= L[i] || i === L.length - 1) { const f = L[i] ? clamp(d / L[i], 0, 1) : 1; return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][2], pts[i + 1][2], f)]; } d -= L[i]; }
  return [pts[0][0], pts[0][2]];
}
function pathOf(a) {
  let pts = [pt3(a.at)]; if (a.to) pts.push(pt3(a.to)); if (a.path) pts = [pts[0], ...a.path.map(p => pt3(p))];
  const L = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]); L.push(l); tot += l; }
  return { pts, L, tot };
}
function pathDist(a, u, tot) { const [t0, t1] = a.move || [0, 1]; const k = clamp((u - t0) / Math.max(0.01, t1 - t0), 0, 1); const ke = a.ease === 'linear' ? k : lerp(k, smooth(k), 0.35); return ke * tot; }
function actorState(a, tl, D, idx, sh) {
  const u = clamp(tl / D, 0, 1), id = a.id || ('_a' + idx), cfg = cfgFor(id, a);
  const st = { id, a, cfg, ph: (hash(id) % 1000) / 1000 * 6.28, y: a.y || 0, scale: a.scale || 1, sh: a.shadow !== false, D, tl };
  const pa = pathOf(a); st.path = pa;
  st.x = pa.pts[0][0]; st.z = pa.pts[0][2]; st.moving = false; st.dir = null; st.cyc = 0; st.speed = 0;
  if (pa.pts.length > 1 && pa.tot > 0.01) {
    const [t0, t1] = a.move || [0, 1]; st.moving = u > t0 && u < t1; st.t0 = t0 * D; st.t1 = t1 * D;
    const d = pathDist(a, u, pa.tot), p = polyAt(pa.pts, pa.L, d); st.x = p[0]; st.z = p[1]; st.d = d;
    // geglättete Laufrichtung (Kurven werden weich durchlaufen)
    const pA = polyAt(pa.pts, pa.L, Math.max(0, d - 0.9)), pB = polyAt(pa.pts, pa.L, Math.min(pa.tot, d + 0.9)); st.dir = [pB[0] - pA[0], pB[1] - pA[1]];
    const dt = 0.05, d2 = pathDist(a, clamp((tl - dt) / D, 0, 1), pa.tot); st.speed = (d - d2) / dt;
    const f0 = polyAt(pa.pts, pa.L, Math.min(1, pa.tot)), fe = polyAt(pa.pts, pa.L, Math.max(0, pa.tot - 1));
    st.dir0 = [f0[0] - pa.pts[0][0], f0[1] - pa.pts[0][2]]; const last = pa.pts[pa.pts.length - 1]; st.dir1 = [last[0] - fe[0], last[2] - fe[1]];
  }
  let [act, k] = timed(a.do, u, 'idle');
  if (st.moving && !MOVERS[act]) act = st.speed > 8 ? 'run' : 'walk';
  st.shot = sh;   // für wortgenaue Gesten
  if (st.d !== undefined) st.cyc = st.d / ((act === 'run' ? 6.4 : act === 'sneak' ? 3.4 : 4.2) * (cfg.scale || 1) * st.scale) * Math.PI * 2 + st.ph;   // Schrittlänge passt zur Beinlänge -> Füße rutschen nicht
  if (!st.moving) st.cyc = (st.cyc || 0) + 0;
  st.idleStyle = a.idle !== undefined ? ({ relaxed: 0, hips: 1, pockets: 2, pocket: 3 }[a.idle] ?? 0) : (cfg.animal ? 0 : [0, 0, 0, 1, 2, 3, 0, 2][hash(id) % 8]);
  st.act = act; st.k = k; st.rel = a.throw ? (a.throw.at ?? 0.5) : 0.5;
  if (act === 'throw' && Array.isArray(a.do)) { const e = a.do.find(e => e[0] === 'throw'); if (e) st.rel = clamp(((a.throw ? a.throw.at : 0.5) - (e[1] ?? 0)) / Math.max(0.01, (e[2] ?? 1) - (e[1] ?? 0)), 0.05, 0.95); }
  const [md] = timed(a.mood, u, DEFMOOD[act] || 'happy'); st.mood = md;
  st.h = actorTop(cfg) * st.scale; st.seat = (act === 'sit' || act === 'sitdesk' || act === 'sitgame' || act === 'piano') ? -0.85 * st.scale * (cfg.scale || 1) : 0;
  const [em] = timed(a.emote, u, null); st.emote = em;
  const [bb] = timed(a.bubble, u, null); st.bubble = bb;
  return st;
}
// Blickrichtung: sanftes Eindrehen vor dem Loslaufen, weiche Kurven, sanftes Ausdrehen am Ziel
function faceOf(st, map, cam, u) {
  const a = st.a; let f = a.face;
  if (Array.isArray(f)) f = timed(f, u, 0)[0];
  const ang = v => Math.atan2(v[0], v[1]);
  let fs = null;
  if (typeof f === 'number') fs = f * DEG;
  else if (f === 'cam' && cam) fs = Math.atan2(cam.eye[0] - st.x, cam.eye[2] - st.z);
  else if (f === 'cam') fs = 0;
  else if (typeof f === 'string' && map[f]) { const o = map[f]; fs = Math.atan2(o.x - st.x, o.z - st.z); }
  if (!st.dir) return fs ?? 0;
  const tl = st.tl, before = fs ?? ang(st.dir0), after = fs ?? ang(st.dir1), mv = ang(st.dir);
  const wIn = smooth((tl - (st.t0 - 0.12)) / 0.3), wOut = smooth((tl - st.t1) / 0.35);
  if (wOut > 0) return angLerp(ang(st.dir1), after, wOut);
  return angLerp(before, mv, wIn);
}

// ---------- Kamera ----------
const DEFANG = [16, -20, 26, -12, 8, -26, 20, -8];
function parseCam(c, sh) { if (!c) { const a = (sh.actors || []).find(x => x.id); c = a ? 'medium:' + a.id : 'wide'; } if (typeof c === 'string') { const [type, rest] = c.split(':'); c = { type }; if (rest) { const [x, y] = rest.split('>'); c.target = x; if (y) c.target2 = y; } } return c; }
// weich nachgeführter Fokus: Mittel über die letzten ~0,5 s (Kamera "zieht" nach statt starr zu kleben)
function smoothFocus(A, tl, D, sh) {
  if (!A || !A.path || A.path.pts.length < 2) return null;
  const idx = Math.max(0, (sh.actors || []).indexOf(A.a)); let x = 0, z = 0, sx = 0, cx = 0, W = 0;
  for (let i = 0; i < 6; i++) { const t = tl - i * 0.1, w = 1 - i * 0.13, st = actorState(A.a, Math.max(0, t), D, idx, sh); st.face = faceOf(st, {}, null, clamp(t / D, 0, 1)); x += st.x * w; z += st.z * w; sx += Math.sin(st.face) * w; cx += Math.cos(st.face) * w; W += w; }
  return { x: x / W, z: z / W, face: Math.atan2(sx, cx) };
}
const CAMOFF = {};
const ease = u => u * u * u * (u * (u * 6 - 15) + 10);
function camera(sh, si, tl, D, set, map) {
  const c = parseCam(sh.cam, sh), u = clamp(tl / D, 0, 1), ue = ease(u), zoom = c.zoom ?? 0.1, push = c.pull ? 1 + zoom * ue : 1 - zoom * ue;
  const A = c.target ? map[c.target] : null, B = c.target2 ? map[c.target2] : null;
  const SF = c.lock ? null : smoothFocus(A, tl, D, sh), f = A ? [SF ? SF.x : A.x, A.y + (A.seat || 0), SF ? SF.z : A.z] : pt3(c.at), fs = A ? (A.cfg.animal ? Math.max(A.h / 5.4, 0.95) : A.h / 5.4) : 1, face = A ? (SF ? SF.face : A.face) : 0, hy = A ? A.y + (A.seat || 0) + A.h * 0.86 : 3;
  let ang, eye, look, fov;
  let DM = 1;
  const FAR0 = c.far ?? sh.camFar ?? 1, FAR = FAR0 === 1 || c.far ? FAR0 : FAR0 * ({ close: 1.55, medium: 1.25, pov: 1, ots: 1.15 }[c.type] || 1); // >1 = weiter rausgezoomt (mehr Umgebung sichtbar)
  const shoot = (off, dm = 1) => { DM = dm; ang = face + ((c.ang ?? DEFANG[si % DEFANG.length]) + off + (c.arc ?? (si % 2 ? 5 : -5)) * (ue - 0.5)) * DEG; fov = 45; eye = look = null;
  const around = (dist, ey, ly, a = ang + 0) => { dist *= DM; eye = [f[0] + Math.sin(a) * dist, f[1] + ey, f[2] + Math.cos(a) * dist]; look = [f[0], f[1] + ly, f[2]]; };
  switch (c.type) {
    case 'close': around((c.dist || 7.0) * fs * push, hy - f[1] - 0.15 * fs, hy - f[1] - 0.95 * fs); fov = 37.5; break;
    case 'face': { const MI = A && A.cfg && A.cfg.style === 'mii'; around((c.dist || (MI ? 7.0 : 5.0)) * fs * push, hy - f[1] + (MI ? -0.25 : 0.05) * fs, hy - f[1] - (MI ? 0.5 : 0.32) * fs); fov = 34; break; } // Großaufnahme Gesicht (Emotionen)
    case 'medium': around((c.dist || 10.5) * fs * push, 3.9 * fs, 3.0 * fs); break;
    case 'full': around((c.dist || 14) * push, 4.8 * fs, 2.7 * fs); break;
    case 'low': around((c.dist || 6.5) * fs * push, 0.9, A ? A.h * 0.75 : 3); fov = 52; break;
    case 'high': around((c.dist || 7) * fs * push, (A ? A.h : 5) + 8, 1.6); fov = 50; break;
    case 'side': around((c.dist || 9) * fs * push, 3.9 * fs, 3.0 * fs, face + ((c.ang ?? 90) + off) * DEG); break;
    case 'back': case 'follow': { const a2 = face + Math.PI + (c.ang ?? 12) * DEG, d = (c.dist || 9) * push; eye = [f[0] + Math.sin(a2) * d, f[1] + 6, f[2] + Math.cos(a2) * d]; look = [f[0] + Math.sin(face) * 6, f[1] + 3, f[2] + Math.cos(face) * 6]; break; }
    case 'ots': { const T = B || { x: f[0] + Math.sin(face) * 8, z: f[2] + Math.cos(face) * 8, y: 0, h: 5.4 }; const dx = T.x - f[0], dz = T.z - f[2], L = Math.hypot(dx, dz) || 1, nx = dx / L, nz = dz / L; const side = c.side ?? 1; eye = [f[0] - nx * 3.4 * fs + nz * 1.8 * side, f[1] + 5.6 * fs, f[2] - nz * 3.4 * fs - nx * 1.8 * side]; look = [T.x, T.y + T.h * 0.8, T.z]; break; }
    case 'orbit': { const a2 = face + ((c.ang ?? -40) + off + (c.sweep ?? 80) * ue) * DEG; around((c.dist || 11) * fs, 4.6 * fs, 3 * fs, a2); break; }
    case 'aerial': { const a2 = ((c.ang ?? 20) + 14 * ue) * DEG, Rr = (c.dist || 40) * push; eye = [f[0] + Math.sin(a2) * Rr, f[1] + (c.h || 34) * push, f[2] + Math.cos(a2) * Rr]; look = [f[0], f[1], f[2] - 4]; fov = 50; break; }
    case 'dolly': { const dx = c.dx ?? 9, d = c.dist ?? 15, off = lerp(-dx, dx, ue) * (c.dir === -1 ? -1 : 1); eye = [f[0] + off, f[1] + (c.h ?? 5), f[2] + d]; look = [f[0] + off * 0.6, f[1] + 3, f[2]]; fov = 48; break; }
    case 'top': eye = [f[0], f[1] + (c.h || 26) * push, f[2] + 0.6]; look = [f[0], f[1], f[2]]; fov = 50; break;
    case 'pov': { const fw = [Math.sin(face), Math.cos(face)]; eye = [f[0] + fw[0] * 0.8, f[1] + A.h * 0.85, f[2] + fw[1] * 0.8]; look = [f[0] + fw[0] * 12, f[1] + A.h * 0.6, f[2] + fw[1] * 12]; fov = 55; break; }
    case 'group': case 'two': {
      const L = Object.values(map).filter(s => !s.a.npcCrowd); if (!L.length) { eye = set.wide.eye; look = set.wide.look; break; }
      let cx = 0, cz = 0, mh = 0; for (const s of L) { cx += s.x; cz += s.z; mh = Math.max(mh, s.h); } cx /= L.length; cz /= L.length;
      const a2 = (c.ang ?? 0) * DEG, rx = Math.cos(a2), rz = -Math.sin(a2); let ext = 0; for (const s of L) ext = Math.max(ext, Math.abs((s.x - cx) * rx + (s.z - cz) * rz));
      fov = c.fov || 46; const hf = Math.atan(Math.tan(fov / 2 * DEG) * R.W / R.H); const d = clamp((ext + 2.2) / Math.tan(hf), 9, 70) * push;
      eye = [cx + Math.sin(a2) * d, 3.2 + d * 0.12, cz + Math.cos(a2) * d]; look = [cx, mh * 0.5, cz]; break;
    }
    case 'push': { const d = lerp(c.from ?? 13, c.to ?? 6.6, ease(u)) * fs, hh = lerp(3.9, hy - f[1] - 0.15, ease(u)), lh = lerp(3.0, hy - f[1] - 0.95, ease(u)); around(d, hh, lh); fov = lerp(45, 38, ease(u)); break; }
    case 'crane': { const e2 = ease(u), up = c.down ? 1 - e2 : e2; around((c.dist || 11) * fs, lerp(set.indoor ? 3.2 : 1.2, c.h ?? 11, up), lerp(3.6 * fs, 1.8 * fs, up)); fov = 46; break; }
    case 'reveal': { const e2 = ease(clamp((u - 0.08) / 0.84, 0, 1)), d = lerp(4.6, c.dist ?? 22, e2) * fs; around(d, lerp(hy - f[1], 7, e2), lerp(hy - f[1] - 0.3, 2.8, e2)); fov = lerp(40, 48, e2); break; }
    case 'arc': { const a2 = face + ((c.ang ?? -60) + off + (c.sweep ?? 120) * ease(u)) * DEG; around((c.dist || 10) * fs, 4.2 * fs, 3.0 * fs, a2); break; }
    case 'track': { const wv = set.wide.eye, sA = Math.sin(face + 75 * DEG) * (wv[0] - f[0]) + Math.cos(face + 75 * DEG) * (wv[2] - f[2]), sd2 = c.side ?? (sA >= 0 ? 1 : -1), a2 = face + (sd2 * (c.ang ?? 75) + off) * DEG, d = (c.dist || 14) * fs; eye = [f[0] + Math.sin(a2) * d, f[1] + 4.6 * fs, f[2] + Math.cos(a2) * d]; look = [f[0] + Math.sin(face) * 1.2, f[1] + 2.8 * fs, f[2] + Math.cos(face) * 1.2]; fov = 44; break; }
    case 'free': { const ee = c.move ? ease(clamp((u - c.move[0]) / Math.max(1e-3, c.move[1] - c.move[0]), 0, 1)) : ue; eye = c.eye2 ? V3.lerp(c.eye, c.eye2, ee) : c.eye; look = c.look2 ? V3.lerp(c.look, c.look2, ee) : c.look; break; }
    case 'wide': default: { const dx = (c.drift ?? 3) * (u - 0.5) * (si % 2 ? 1 : -1); eye = [set.wide.eye[0] + dx, set.wide.eye[1], set.wide.eye[2] * push + (1 - push) * set.wide.look[2]]; look = [set.wide.look[0] + dx * 0.5, set.wide.look[1], set.wide.look[2]]; fov = 50; }
  }
  };
  // Verdeckung vermeiden: andere Figuren und Möbel zwischen Kamera und Ziel -> Winkel ausweichen
  const AROUND = { close: 1, medium: 1, full: 1, low: 1, side: 1, orbit: 1, arc: 1, push: 1, crane: 1, reveal: 1, track: 1 };
  const occl = () => { if (!A) return 0; const tgt = [A.x, A.y + (A.seat || 0) + A.h * 0.7, A.z]; let k = 0;
    for (const o of Object.values(map)) { if (o === A || o.a.npcCrowd) continue; for (const yy of [0.3, 0.6, 0.9]) { const [d, t] = segDist([o.x, o.y + o.h * yy, o.z], eye, tgt); if (t > 0.04 && t < 0.97 && d < 2.4 * o.scale) k += 2; } }
    for (const sf of [...(set.surf || []), ...(map.__surf || [])]) { for (let i = 0; i < 12; i++) { const p = V3.lerp(eye, tgt, i / 12); if (p[1] > (sf.occ || sf.top) + 0.5) continue; const pad = i === 0 ? 1.4 : 0; const dx = p[0] - sf.x, dz = p[2] - sf.z, cc = Math.cos(sf.ry || 0), ss = Math.sin(sf.ry || 0), lx = cc * dx - ss * dz, lz = ss * dx + cc * dz; if (Math.abs(lx) < sf.w / 2 + pad && Math.abs(lz) < sf.d / 2 + pad) { k += 1; break; } } }
    if (set.bounds) { const [x0, x1, z0, z1] = set.bounds, m = 2.2; if (eye[0] < x0 + m || eye[0] > x1 - m || eye[2] < z0 + m || eye[2] > z1 - m) k += 3; }
    return k; };
  shoot(0);
  if (A && AROUND[c.type] && c.ang === undefined && !c.fixed) {
    let off = CAMOFF[si];
    if (off === undefined) { let best = [occl(), [0, 1]]; if (best[0] > 0) { outer: for (const dm of [1, 0.78, 0.62]) for (const o of [0, 25, -25, 45, -45, 65, -65, 90, -90]) { if (dm === 1 && o === 0) continue; shoot(o, dm); const k = occl() + (dm < 1 ? 0.5 : 0); if (k < best[0]) best = [k, [o, dm]]; if (k <= 0.5) break outer; } } off = CAMOFF[si] = best[1]; }
    shoot(off[0], off[1]);
  }
  if (c.fov) fov = c.fov;
  // Vorlauf-Raum: bei Bewegung schaut die Kamera etwas in Laufrichtung
  if (A && A.moving && c.type !== 'pov' && c.type !== 'free') { const L = clamp((A.speed || 0) * 0.35, 0, 2.2); look = [look[0] + Math.sin(face) * L, look[1], look[2] + Math.cos(face) * L]; }
  // Handkamera-"Atmen": sehr leichtes, langsames Schweben (abschaltbar mit "steady": true)
  if (!c.steady && (c.type !== 'free' || c.handheld) && !(sh.camSteady)) { const dd = V3.len(V3.sub(eye, look)), amp = clamp(dd * 0.006, 0.02, 0.16) * (c.handheld ?? 1), tg2 = (sh.tg0 || 0) + tl, q = k => n1(tg2 * 0.45 + k * 7.3, 11 + k) * 0.7 + n1(tg2 * 1.1 + k * 3.1, 23 + k) * 0.3;
    eye = [eye[0] + q(1) * amp, eye[1] + q(2) * amp * 0.7, eye[2] + q(3) * amp]; look = [look[0] + q(4) * amp * 0.5, look[1] + q(5) * amp * 0.4, look[2] + q(6) * amp * 0.5]; }
  if (set.bounds) { const [x0, x1, z0, z1, ym] = set.bounds; eye = [clamp(eye[0], x0, x1), clamp(eye[1], 0.5, ym), clamp(eye[2], z0, z1)]; }
  let shake = c.shake || 0;
  for (const fx of sh.fx || []) { if (fx.type === 'shake') { const t0 = (fx.t || 0) * D, d = fx.dur || 0.5; if (tl >= t0 && tl < t0 + d) shake = Math.max(shake, (fx.amp || 0.4) * (1 - (tl - t0) / d)); } if (fx.type === 'zoom') { const t0 = (fx.t || 0) * D, d = fx.dur || 0.6; if (tl >= t0) fov *= 1 - (fx.amp || 0.3) * Math.max(0, 1 - (tl - t0) / d) * smooth((tl - t0) / 0.08); } }
  if (shake) { const n = (a) => Math.sin(tl * 47 + a) * 0.6 + Math.sin(tl * 83 + a * 2) * 0.4; eye = [eye[0] + n(1) * shake, eye[1] + n(2) * shake, eye[2] + n(3) * shake]; look = [look[0] + n(4) * shake * 0.5, look[1] + n(5) * shake * 0.5, look[2]]; }
  // weiter rausgezoomt: Bildwinkel vergrößern (kollidiert nicht mit Wänden/Figuren wie Zurückfahren)
  if (FAR !== 1) { const f0 = fov ?? 45; fov = Math.min(100, 2 * Math.atan(Math.tan(f0 / 2 * DEG) * FAR) / DEG); }
  return { eye, look, fov };
}

// ---------- Physik ----------
// Wurf/Fall mit Schwerkraft, Abprallen (Restitution) und Ausrollen – analytisch, deterministisch pro Frame
function ballistic(p0, v0, g, t, o = {}) {
  const rest = o.rest ?? 0.45, gy = o.ground ?? 0, fr = o.fric ?? 6; let p = p0.slice(), v = v0.slice(), tt = t, b = 0, air = 0;
  for (let i = 0; i < 10; i++) {
    const A = -g / 2, B = v[1], C = p[1] - gy, disc = B * B - 4 * A * C, tau = disc < 0 ? Infinity : (-B - Math.sqrt(disc)) / (2 * A);
    if (!(tau > 1e-4) || tt <= tau) return { p: [p[0] + v[0] * tt, Math.max(gy, p[1] + v[1] * tt - g / 2 * tt * tt), p[2] + v[2] * tt], b, air: air + tt, rolling: 0, imp: 0 };
    p = [p[0] + v[0] * tau, gy, p[2] + v[2] * tau]; tt -= tau; air += tau;
    const vy = -(v[1] - g * tau) * rest; v = [v[0] * 0.72, vy, v[2] * 0.72]; b++;
    if (vy < 1.4) { const sp = Math.hypot(v[0], v[2]), tr = Math.min(tt, sp / fr), d = sp * tr - fr / 2 * tr * tr, n = sp ? [v[0] / sp, v[2] / sp] : [0, 0]; return { p: [p[0] + n[0] * d, gy, p[2] + n[1] * d], b, air, rolling: d, imp: tt }; }
  }
  return { p, b, air, rolling: 0, imp: tt };
}
// Parabel von a nach b mit Scheitelhöhe arc in T Sekunden -> Startgeschwindigkeit + Schwerkraft
function launch(a, b, arc, T) { arc = Math.max(0.05, arc); return { v: [(b[0] - a[0]) / T, (b[1] - a[1]) / T + 4 * arc / T, (b[2] - a[2]) / T], g: 8 * arc / (T * T) }; }
// Wackeln nach Aufprall (Squash & Stretch)
const ROUND = { ball: 1, apple: 1, coin: 1, balloon: 1 };
function jiggle(dt, amp = 0.22) { if (dt < 0) return 0; return amp * Math.exp(-dt * 7) * Math.sin(dt * 26); }

// ---------- Effekte ----------
const CONF = ['#e63946', '#ffd23f', '#1e88e5', '#2a9d8f', '#f15bb5', '#ff7f11'];
function fxItems(items, sh, tl, D, map) {
  for (const fx of sh.fx || []) {
    const t0 = (fx.t || 0) * D, dt = tl - t0; if (dt < 0) continue;
    const P = fx.at && typeof fx.at === 'string' && map[fx.at] ? [map[fx.at].x, map[fx.at].y + map[fx.at].h + 0.3, map[fx.at].z] : pt3(fx.at, 3);
    const Rr = rng(hash(JSON.stringify(fx)));
    if (fx.type === 'coins') {
      const n = fx.n || 14, g = PROPS.coin({}).parts[0].g;
      for (let i = 0; i < n; i++) {
        const d = dt - i * 0.025; if (d < 0) continue;
        const v = [(Rr() - .5) * 9, 9 + Rr() * 7, (Rr() - .5) * 9], r = ballistic([P[0], P[1] - 0.6, P[2]], v, 24, d, { rest: 0.38, fric: 9 });
        const air = Math.min(d, r.air), spin = air * (10 + i), settle = r.b ? smooth((d - r.air) / 0.25) : 0;
        items.push({ g, m: M4.chain(M4.T(r.p[0], r.p[1] + lerp(0.5, 0.08, settle), r.p[2]), M4.RY(spin * 0.3 + i), M4.RX(lerp(spin % 6.283, Math.PI / 2, settle)), M4.S(0.7), M4.T(0, -0.75, 0)), e: 0.2, spec: 0.9 });
      }
    }
    if (fx.type === 'confetti') {
      const n = fx.n || 80;
      for (let i = 0; i < n; i++) {
        const c = CONF[i % 6], g = cgeo('conf|' + c, mb => mb.box(0.35, 0.35, 0.03, c));
        // Ausstoß nach oben, dann flattern mit Luftwiderstand (Endgeschwindigkeit) bis zum Boden – dort liegen bleiben
        const x0 = P[0] + (Rr() - .5) * 3, z0 = P[2] + (Rr() - .5) * 3, vx = (Rr() - .5) * 14, vz = (Rr() - .5) * 8, vy = 8 + Rr() * 9, tau = 0.35, vt = 1.6 + Rr() * 1.2, ph = Rr() * 6.28;
        const e = Math.exp(-dt / tau), y0 = P[1] + 6 + Rr() * 3;
        let y = y0 + (vy + vt) * tau * (1 - e) - vt * dt;
        const x = x0 + vx * tau * (1 - e) + Math.sin(dt * 3.2 + ph) * 0.7, z = z0 + vz * tau * (1 - e) + Math.cos(dt * 2.7 + ph) * 0.5;
        const landed = y <= 0.03; if (landed) y = 0.03;
        const rot = landed ? M4.chain(M4.RX(Math.PI / 2), M4.RZ(ph)) : M4.chain(M4.RX(dt * 6 + ph), M4.RY(dt * 4 + i * 2), M4.RZ(Math.sin(dt * 5 + ph)));
        items.push({ g, m: M4.chain(M4.T(x, y, z), rot), e: 0.25, sh: false, spec: 0.4 });
      }
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
// ---------- Natürliche Platzierung von Gegenständen ----------
// kleine Dinge landen auf Tischen/Möbeln, nichts steckt in Figuren oder ineinander, leichte Zufallsdrehung, Kontaktschatten
const LAYC = {};
function surfTop(x, z, surfs) { let top = 0; for (const f of surfs) { const dx = x - f.x, dz = z - f.z, c = Math.cos(f.ry || 0), s = Math.sin(f.ry || 0), lx = c * dx - s * dz, lz = s * dx + c * dz; if (Math.abs(lx) < f.w / 2 - 0.15 && Math.abs(lz) < f.d / 2 - 0.15) top = Math.max(top, f.top); } return top; }
// Eigene Requisiten aus dem Shorts-Chat: genau dort lassen, wo sie gesetzt sind (kein Wegschieben/Zufallsdrehen)
const FIXP = { lightbeam: 1, motes: 1, potplant: 1, window: 1, rug: 1, pickaxe: 1, buildwall: 1, stormwall: 1, islandmap: 1, airdrop: 1, tunnel: 1, cutboard: 1, tray: 1, cabbage: 1, shreds: 1, radish: 1, meat: 1, meatslice: 1, helper: 1, nest: 1, pebble: 1, piano: 1, keys: 1, stool: 1, panel: 1, display: 1, tower: 1, ghostfloors: 1, controller: 1, console: 1, pen: 1, smartphone: 1 };
function propLayout(sh, si, set) {
  const key = si + '|' + (sh.set || ''); if (LAYC[key]) return LAYC[key];
  const props = sh.props || [], surfs = [...(set.surf || [])];
  props.forEach(p => { const sf = surfOf(p.type, p); if (sf && !p.fly && !p.on) { const q = pt3(p.at); surfs.push({ x: q[0], z: q[2], ry: (p.ry || 0) * DEG, ...sf, top: sf.top + q[1] }); } });
  const obs = []; for (const a of sh.actors || []) { const pa = pathOf(a); for (const q of pa.pts) obs.push(q); for (let i = 1; i < pa.pts.length; i++) for (let k = 1; k < 4; k++) obs.push(V3.lerp(pa.pts[i - 1], pa.pts[i], k / 4)); }
  const L = props.map((p, i) => {
    const q = pt3(p.at), small = SMALLP[p.type], r = (PROPR[p.type] ?? (small ? 0.6 : 1.2)) * (p.s || p.scale || 1);
    const free = !p.fly && !p.on && !p.head && p.natural !== false && !FIXP[p.type];
    let y = q[1]; if (free && p.at && p.at.length === 2 && small && p.y === undefined) y = surfTop(q[0], q[2], surfs);
    const jit = (p.ry === undefined && !NOJIT[p.type] && !FIXP[p.type] && p.natural !== false) ? ((hash(p.type + '|' + i + '|' + si) % 1000) / 1000 - 0.5) * (small ? 50 : 18) * DEG : 0;
    const seatOf = (sh.actors || []).some(a => { const ds = Array.isArray(a.do) ? a.do.map(x => Array.isArray(x) ? x[0] : x) : [a.do]; if (!ds.some(d => String(d).startsWith('sit'))) return false; const ap = pt3(a.at); return Math.hypot(ap[0] - q[0], ap[2] - q[2]) < 1.6; });   // Sitzplatz einer sitzenden Figur bleibt, wo er ist (Lukas 26.11.)
    return { x: q[0], y, z: q[2], r, jit, push: free && !SEATP[p.type] && p.pin !== true && !seatOf, small };
  });
  // Abstoßen: von Figuren-Positionen/Wegen und voneinander (wenige Relaxations-Schritte, max. 3 Einheiten)
  for (let it = 0; it < 6; it++) for (let i = 0; i < L.length; i++) {
    const A = L[i]; if (!A.push) continue; const q0 = pt3(props[i].at);
    if (A.y < 0.3) for (const o of obs) { const dx = A.x - o[0], dz = A.z - o[2], d = Math.hypot(dx, dz), m = A.r + 1.35; if (d < m) { const n = d > 1e-3 ? [dx / d, dz / d] : [1, 0]; A.x += n[0] * (m - d); A.z += n[1] * (m - d); } }
    for (let j = 0; j < L.length; j++) { if (j === i) continue; const B = L[j]; if (Math.abs(B.y - A.y) > 1) continue; const dx = A.x - B.x, dz = A.z - B.z, d = Math.hypot(dx, dz), m = (A.r + B.r) * 0.8; if (d < m) { const n = d > 1e-3 ? [dx / d, dz / d] : [Math.cos(i), Math.sin(i)], k = B.push ? 0.5 : 1; A.x += n[0] * (m - d) * k; A.z += n[1] * (m - d) * k; } }
    const ox = A.x - q0[0], oz = A.z - q0[2], od = Math.hypot(ox, oz); if (od > 3) { A.x = q0[0] + ox / od * 3; A.z = q0[2] + oz / od * 3; }
  }
  return (LAYC[key] = L);
}
function propState(items, p, tl, D, map, u, L) {
  let pos = L ? [L.x, L.y, L.z] : pt3(p.at), s = p.s || p.scale || 1, ry = (p.ry || 0) * DEG + (L ? L.jit : 0) + (p.spin ? tl * p.spin * DEG : 0), rx = 0;
  if (p.drop !== undefined) { const t0 = p.drop * D, dt = tl - t0; if (dt < 0) return; const H = p.dropH ?? 5, r = ballistic([0, H, 0], [0, 0, 0], 32, dt, { rest: ROUND[p.type] ? 0.5 : 0.28 }); pos = [pos[0], pos[1] + r.p[1], pos[2]]; if (r.b) var dropSq = jiggle(dt - Math.sqrt(2 * H / 32), 0.22); }
  let sq = typeof dropSq === 'number' ? dropSq : 0; if (p.pop !== undefined) { const k = (tl - p.pop * D) / 0.3; if (k < 0) return; s *= backOut(k); sq = jiggle(tl - p.pop * D - 0.2, 0.16); }
  if (p.hide !== undefined) { const k = (tl - p.hide * D) / 0.2; if (k > 1) return; if (k > 0) s *= 1 - k; }
  if (p.bob) pos[1] += Math.sin(tl * 3) * p.bob;
  if (p.fly) {
    const [a, b] = p.fly.t || [0, 1], T = Math.max(0.05, (b - a) * D), from = pt3(p.fly.from || p.at), to = pt3(p.fly.to), dt = tl - a * D;
    if (dt <= 0) pos = from;
    else { const L = launch(from, to, p.fly.arc ?? 4, T), bounce = p.fly.bounce ?? (to[1] < 0.3), rnd = ROUND[p.type], spn = p.fly.spin ?? (rnd ? 9 : 0);
      if (dt <= T || !bounce) { const tt = Math.min(dt, T); pos = [from[0] + L.v[0] * tt, from[1] + L.v[1] * tt - L.g / 2 * tt * tt, from[2] + L.v[2] * tt]; rx = spn * tt; if (dt > T) sq = jiggle(dt - T); }
      else { const r = ballistic(from, L.v, L.g, dt, { ground: to[1], rest: p.fly.rest ?? (rnd ? 0.45 : 0.25), fric: rnd ? 6 : 16 }); pos = r.p; rx = rnd ? spn * Math.min(r.air, dt) * (r.b ? 0 : 1) + r.rolling * 1.4 : (r.b ? 0 : spn * dt); if (r.b) sq = jiggle(dt - T, 0.25); }
    }
  }
  if (p.on && map[p.on]) { const A = map[p.on]; if (p.head) pos = [A.x, A.y + A.h + 0.1, A.z]; else if (A.rig) { propItems(items, p.type, p, M4.mul(A.rig.handR, M4.chain(M4.RX(Math.PI / 2), M4.S(s), M4.T(0, -0.5, 0)))); return; } }
  let sv = [s, s, s];
  if (p.grow) { const [a, b, f, t] = p.grow, k0 = clamp((u - a) / Math.max(0.01, b - a), 0, 1), k = k0 * k0 * (3 - 2 * k0), F = Array.isArray(f) ? f : [f, f, f], T = Array.isArray(t) ? t : [t, t, t]; sv = sv.map((v, i) => v * (F[i] + (T[i] - F[i]) * k)); }
  if (p.jig) { pos = [pos[0] + Math.sin(tl * 37) * p.jig, pos[1] + Math.abs(Math.sin(tl * 23)) * p.jig, pos[2]]; }
  if (L && (L.small || PROPR[p.type]) && !p.on && p.blob !== false && !NOJIT[p.type]) { const gy = L.y, air = Math.max(0, pos[1] - gy), r = L.r * 1.05 * (L.small ? 1.3 : 1) / (1 + air * 0.3); items.push({ g: cgeo('blobq', mb => { mb.push(M4.RX(-Math.PI / 2)); mb.tquad(2, 2, '#000000'); mb.pop(); }), m: M4.chain(M4.T(pos[0], gy + 0.035, pos[2]), M4.S(r, 1, r)), tex: blobTex(), ta: 1, a: 0.32 / (1 + air * 0.4), e: 1, sh: false, recv: false, zb: 50 }); }
  propItems(items, p.type, p, M4.chain(M4.T(pos[0], pos[1], pos[2]), M4.RY(ry), M4.RX(rx + (p.rx || 0) * DEG), M4.RZ((p.rz || 0) * DEG), M4.S(sv[0] * (1 + sq * 0.5), sv[1] * (1 - sq), sv[2] * (1 + sq * 0.5))));
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
    if (!A.emote && !A.bubble && !(A.a.zzz) && !A.a.counter) continue;
    const hp = A.rig && A.rig.head && !A.cfg.animal ? M4.xp(A.rig.head, [0, 0, 0]) : [A.x, A.y + (A.seat || 0) + A.h - 0.7, A.z]; const p = proj([hp[0], hp[1] + 1.6, hp[2]]); if (p[2] <= 0.1) continue; const sz = clamp(1300 / p[2], 50, 170); p[0] = clamp(p[0], sz * 0.8, R.W - sz * 0.8); p[1] = clamp(p[1], sz * 1.4, R.H * 0.55);
    if (A.emote === 'zzz' || A.a.zzz) { for (let i = 0; i < 3; i++) { const q = ((tl * 0.7 + i / 3) % 1); x.globalAlpha = Math.sin(q * Math.PI); outlined(x, 'Z', p[0] + q * sz * 0.9 + i * 8, p[1] - q * sz * 1.4, sz * (0.5 + q * 0.5), '#ffffff', '#1d2b6b', 0.18); } x.globalAlpha = 1; }
    else if (A.emote) { const b = Math.sin(tl * 6) * sz * 0.06; x.font = `${sz}px "Noto Color Emoji", ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; const isEmoji = /\p{Extended_Pictographic}/u.test(A.emote); if (isEmoji) x.fillText(A.emote, p[0], p[1] - sz * 0.5 + b); else outlined(x, A.emote, p[0], p[1] - sz * 0.5 + b, sz * 1.1, '#ffe14d', '#000', 0.2); }
    if (A.a.counter) { // Zahl-Pille über dem Kopf (z. B. Schritte, Punkte): {from, to, t0, t1, suffix, color}
      const c = typeof A.a.counter === 'object' ? A.a.counter : { to: A.a.counter }, q = smooth(clamp((u - (c.t0 ?? 0)) / Math.max(0.01, (c.t1 ?? 1) - (c.t0 ?? 0)), 0, 1));
      const v = Math.round((c.from ?? c.to ?? 0) + ((c.to ?? 0) - (c.from ?? c.to ?? 0)) * q), txt = v.toLocaleString('de-DE') + (c.suffix || ''), fs2 = 46;
      x.save(); x.font = `900 ${fs2}px ${FONT}`; const w2 = x.measureText(txt).width + 44, yy = A.bubble ? p[1] - 230 : p[1] - 40;
      x.fillStyle = c.color || '#ffffff'; x.strokeStyle = '#1d1712'; x.lineWidth = 6; rrect(x, p[0] - w2 / 2, yy - 34, w2, 68, 34); x.fill(); x.stroke();
      x.fillStyle = '#1d1712'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, p[0], yy + 2); x.restore();
    }
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
  if (sh.badge) { x.save(); x.font = `bold 44px ${FONT}`; const w = x.measureText(sh.badge).width + 48; x.fillStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.roundRect ? x.roundRect(R.W / 2 - w / 2, R.H * 0.035, w, 66, 33) : x.rect(R.W / 2 - w / 2, R.H * 0.035, w, 66); x.fill(); x.restore(); outlined(x, sh.badge, R.W / 2, R.H * 0.035 + 34, 44, '#ffe14d', '#000', 0.12); }
  if (sh.score) { // Anzeigetafel oben: {home, away, a, b, from:[a0,b0], t:Anteil wann der Stand wechselt}
    const S2 = sh.score, ch = u >= (S2.t ?? 0), a = ch ? S2.a ?? 0 : (S2.from || [S2.a ?? 0])[0], b = ch ? S2.b ?? 0 : (S2.from || [0, S2.b ?? 0])[1], pk = ch && S2.t !== undefined ? backOut(clamp((u - S2.t) * D / 0.3, 0, 1)) : 1;
    const W2 = 520, H2 = 170, X2 = R.W / 2 - W2 / 2, Y2 = sh.badge ? 130 : 70; x.save(); x.fillStyle = 'rgba(14,18,30,0.92)'; rrect(x, X2, Y2, W2, H2, 22); x.fill(); x.strokeStyle = '#ffd23f'; x.lineWidth = 5; x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#cfd8e6'; x.font = `bold 34px ${FONT}`; x.fillText(String(S2.home || 'HOME').toUpperCase(), X2 + W2 * 0.22, Y2 + 40); x.fillText(String(S2.away || 'AWAY').toUpperCase(), X2 + W2 * 0.78, Y2 + 40);
    x.translate(R.W / 2, Y2 + 112); x.scale(pk, pk); x.fillStyle = '#ffffff'; x.font = `900 92px ${FONT}`; x.fillText(`${a} : ${b}`, 0, 0); x.restore(); }
  if (sh.counter) { // großer Zähler: {label, from, to, t0, t1, suffix}
    const c = sh.counter, q = smooth(clamp((u - (c.t0 ?? 0)) / Math.max(0.01, (c.t1 ?? 1) - (c.t0 ?? 0)), 0, 1)), v = Math.round((c.from ?? 0) + ((c.to ?? 0) - (c.from ?? 0)) * q);
    const txt = v.toLocaleString('de-DE') + (c.suffix || ''), Y3 = (c.y ?? 0.2) * R.H; x.save(); x.textAlign = 'center'; x.textBaseline = 'middle';
    if (c.label) { x.font = `bold 40px ${FONT}`; const lw = x.measureText(c.label).width + 40; x.fillStyle = 'rgba(0,0,0,0.6)'; rrect(x, R.W / 2 - lw / 2, Y3 - 110, lw, 56, 28); x.fill(); x.fillStyle = '#ffd23f'; x.fillText(c.label, R.W / 2, Y3 - 82); }
    outlined(x, txt, R.W / 2, Y3, 120, c.color || '#ffffff', '#000', 0.16); x.restore(); }
  if (sh.hook && tl < (sh.hookDur || 2.2)) { const k = backOut(Math.min(1, tl / 0.22)), fade = clamp(((sh.hookDur || 2.2) - tl) / 0.25, 0, 1); x.save(); x.globalAlpha = fade; x.translate(R.W / 2, R.H * 0.34); x.scale(k, k); x.rotate(-2.5 * DEG); const hl = String(sh.hook).split('\n'); x.font = `bold 116px ${FONT}`; const fit = Math.min(116, 116 * (R.W * 0.86) / Math.max(...hl.map(l => x.measureText(l).width))); hl.forEach((l, i, arr) => outlined(x, l, 0, (i - (arr.length - 1) / 2) * fit * 1.1, fit, '#ffe14d', '#000', 0.22)); x.restore(); }
  if (sh.title && !(sh.hook && tl < (sh.hookDur || 2.2))) { const lines = String(sh.title).split('\n'); lines.forEach((l, i) => outlined(x, l, R.W / 2, R.H * 0.14 + i * 110, 92, '#ffffff', '#000', 0.2)); }
  drawCaption(x, sh.words || [], tl);
}

// ---------- Kontaktschatten + Bloom ----------
function blobTex() { return ctex('blob', 128, 128, x => { const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }); }
function blobShadow(items, s) {
  if (s.sh === false || s.a.blob === false) return;
  const air = Math.max(0, (s.lift || 0)), lying = s.act === 'lie' || s.act === 'sleep' || s.act === 'fall' || s.act === 'faint';
  const r = (s.cfg.animal ? 2.0 : 1.75) * s.scale * (s.cfg.scale || 1) / (1 + air * 0.25) * (lying ? 1.6 : 1);
  const g = cgeo('blobq', mb => { mb.push(M4.RX(-Math.PI / 2)); mb.tquad(2, 2, '#000000'); mb.pop(); });
  items.push({ g, m: M4.chain(M4.T(s.x, s.y + 0.045, s.z), M4.RY(s.face || 0), M4.S(r, 1, lying ? r * 1.5 : r)), tex: blobTex(), ta: 1, a: 0.42 / (1 + air * 0.5), e: 1, sh: false, recv: false, zb: 50 });
}
let BC1, BX1, BC2, BX2;
function bloom(k) {
  if (!(k > 0.01) || window._nobloom) return;
  const w = Math.round(R.W / 6), h = Math.round(R.H / 6);
  if (!BC1) { BC1 = document.createElement('canvas'); BC1.width = w; BC1.height = h; BX1 = BC1.getContext('2d'); BC2 = document.createElement('canvas'); BC2.width = w; BC2.height = h; BX2 = BC2.getContext('2d'); }
  BX1.globalCompositeOperation = 'copy'; BX1.filter = 'brightness(0.8) contrast(3.4) saturate(1.25)'; BX1.drawImage(CV, 0, 0, w, h);
  BX2.globalCompositeOperation = 'copy'; BX2.filter = 'blur(7px)'; BX2.drawImage(BC1, 0, 0);
  OX.save(); OX.globalCompositeOperation = 'screen'; OX.globalAlpha = clamp(k, 0, 1); OX.drawImage(BC2, 0, 0, R.W, R.H); OX.restore();
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
  for (const s of list) if (s.a.face === 'cam') s.face = faceOf(s, map, cam, u);
  const dl = V3.len(V3.sub(cam.eye, cam.look)); cam.shadowAt = cam.look;
  E.shR = clamp(dl * 1.1, 20, 80); E.time = tg;
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
  if (!window._nolife) lifeItems(items, sh, si, set, tg, E, cam);
  for (const s of list) {
    s.tg = tg;
    if (s.a.do === 'mocap' && s.a.mocap && s.a.mocap.frames && !s.mocapShift) { // Mocap-Verschiebung (dx/dz) bewegt die Figur selbst -> Schatten folgt, kein Schweben
      const M = s.a.mocap, jx = M.keys.indexOf('dx'), jz = M.keys.indexOf('dz');
      if (jz >= 0 || jx >= 0) { const fi = clamp((tg - (M.start || 0)) * (M.fps || 30), 0, M.frames.length - 1), i0 = Math.floor(fi), i1 = Math.min(M.frames.length - 1, i0 + 1), w = fi - i0, v = j => j < 0 ? 0 : (M.frames[i0][j] * (1 - w) + M.frames[i1][j] * w) * (M.move ?? 1);
        s.x += v(jx); s.z += v(jz); s.mocapShift = true; }
    }
    let P = s.cfg.animal ? apose(s.act, tl, s.k, s, s.cfg.animal) : pose(s.act, tl, s.k, s);
    // Gegenstand in der Hand: Haltearm ruhig (kein Zittern/Wackeln des Handys), nur langsame, kleine Bewegung
    if (s.a.hold && !s.cfg.animal && !MOVERS[s.act] && !['throw', 'wave', 'wave2', 'cheer', 'jump', 'dance', 'spin', 'fall', 'faint', 'game', 'sitgame'].includes(s.act)) {
      const slow = Math.sin(tl * 0.8 + s.ph);
      P.aRx = (s.act === 'hold' ? -38 : Math.min(P.aRx, -30)) + 1.2 * slow; P.eR = Math.max(P.eR, 40); P.aRz = -8 + 0.6 * slow; P.rz = (P.rz || 0) * 0.3; P.tb = (P.tb || 0) * 0.4; P.aRy = 0;
      const ht = typeof s.a.hold === 'string' ? s.a.hold : (s.a.hold.type || '');
      if (['phone', 'smartphone', 'book', 'paper', 'map', 'note', 'letter'].includes(ht) && ['hold', 'idle', 'talk', 'think', 'scared', 'freeze', 'look'].includes(s.act)) {
        // Lesen/aufs Handy schauen: Unterarm angewinkelt, Gerät vor der Brust, Blick nach unten
        P.aRx = -52 + 0.8 * slow; P.eR = 88; P.aRz = 34; P.aRy = 75; P.hx = Math.max(P.hx || 0, 16); P.gx = 0;
      }
    }
    if (!s.cfg.animal) {
      // weiche Übergänge zwischen Aktionen (0,3 s) und beim Loslaufen/Anhalten
      const ps = prevSeg(s.a.do, u, 'idle');
      if (ps && ps.prev !== ps.cur && ps.t0 > 0) { const w = smooth((tl - ps.t0 * D) / 0.32); if (w < 1) P = blendP(pose(ps.prev, tl, 1, s), P, w); }
      if (s.t0 !== undefined && MOVERS[s.act] && !MOVERS[timed(s.a.do, u, 'idle')[0]]) { const w = Math.min(smooth((tl - s.t0) / 0.35), smooth((s.t1 - tl) / 0.3)); if (w < 1) { const Pi = pose('idle', tl, 0, s); P = blendP(Pi, P, w); } }
      if (s.t1 !== undefined && !s.moving && tl > s.t1 && tl - s.t1 < 0.35) P = blendP(pose('walk', tl, 0, { ...s, cyc: s.cyc }), P, smooth((tl - s.t1) / 0.35));
      // Kopf + Augen zum Gesprächspartner / zur Kamera (mit leichter Verzögerung)
      if (s.act !== 'sleep' && s.act !== 'lie' && s.act !== 'fall' && s.act !== 'faint' && s.act !== 'spin') {
        let yw = 0, pt = 0, n = 0; for (const dtl of [0, 0.12, 0.25]) { const r = lookRel(s, list, map, cam, clamp((tl - dtl) / D, 0, 1)); if (r) { yw += r.yaw; pt += r.pitch; } n++; }
        yw /= n; pt /= n; if (Math.abs(yw) > 0.5 || Math.abs(pt) > 0.5) { P.hy = (P.hy || 0) * 0.35 + yw * 0.62; P.tw = (P.tw || 0) + yw * 0.18; P.hx = (P.hx || 0) - pt * 0.5; if (Math.abs(yw) > 14) P.gx = Math.sign(yw) * (yw > 0 ? 1 : 1); }
      }
      // Zuhörer reagieren (Mii Town Schritt 4): leichtes Nicken im Gesprächstakt, auf betonte Wörter des Sprechers
      // kurzer Ruck mit Kopf + Oberkörper (versetzt 0,15–0,35 s, jede Figur anders) – Körper, Kopf und Blick gemeinsam
      if (!talkingAt(s, u) && ['idle', 'look', 'hold', 'think', 'sitdesk', 'sit', 'stand', 'wait', 'nervous', 'scared'].includes(s.act) && list.some(o => o !== s && !o.a.npcCrowd && talkingAt(o, u))) {
        const W = sh.words || [], dl = 0.15 + (s.ph % 1) * 0.2;
        let r = 0; for (const w of W) if (w.hi) r = Math.max(r, Math.exp(-(((tl - w.t0 - dl - 0.1) / 0.16) ** 2)));
        const nod = Math.max(0, Math.sin((tl + s.ph) * 2 * Math.PI / 2.3)) ** 6;
        P.hx = (P.hx || 0) + 5 * nod - 6 * r; P.bx = (P.bx || 0) - 3 * r; P.tb = (P.tb || 0) - 0.03 * r;
        if (!/^sit/.test(s.act)) { P.aLz = (P.aLz || 0) + 6 * r; P.aRz = (P.aRz || 0) - 6 * r; }
      }
      // Drehen im Stand: erst Blick/Kopf, dann Oberkörper, zuletzt die Beine (Körper folgt verzögert)
      if (!s.moving && Array.isArray(s.a.face)) {
        const fNow = faceOf(s, map, cam, u), fAhead = faceOf(s, map, cam, clamp((tl + 0.3) / D, 0, 1));
        let df = ((fAhead - fNow + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; df /= DEG;
        if (Math.abs(df) > 4) { P.hy = (P.hy || 0) + clamp(df * 0.7, -55, 55); P.tw = (P.tw || 0) + clamp(df * 0.25, -20, 20); P.gx = Math.sign(df); }
      }
    }
    const blink = ((tg + s.ph) % 3.4) < 0.12 || ((tg + s.ph * 3) % 7.3) < 0.1;
    P.mood = s.mood; P.closed = blink;
    const tk = s.a.talk, talking = s.act === 'talk' || s.mood === 'talk' || tk === true || (Array.isArray(tk) && tk.some(w => u >= w[0] && u < w[1]));
    if (talking) { const L = sh.lip; // Lippensynchron: Mundöffnung aus der echten Sprachspur (studio.py), sonst Ersatz-Bewegung
      if (L && L.length) { const i = Math.min(L.length - 1, Math.max(0, Math.floor(tl * (sh.lipFps || 30)))); P.open = +L[i]; }
      else { const v = Math.sin(tl * 15 + s.ph) + 0.5 * Math.sin(tl * 23) + 0.35 * Math.sin(tl * 6.3 + 1); P.open = v > 1.0 ? 2 : v > 0.1 ? 1 : 0; } }
    s.lift = (P.lift || 0) * s.scale;
    // Sekundärbewegung (Haare, Umhang, Flügel) aus Tempo, Sprung und Wind
    const sec = clothSim(s, si, sh, tl, D, map) || { swing: 5 * Math.sin(tl * 1.9 + s.ph), side: 4 * Math.sin(tl * 1.3 + s.ph) };
    sec.flap = 10 + 8 * Math.sin(tl * 3 + s.ph) + (s.lift > 0.2 ? 25 * Math.sin(tl * 14) : 0);
    const S = { x: s.x, y: s.y, z: s.z, face: s.face, scale: s.scale, sh: s.sh, sec };
    s.rig = s.cfg.animal ? animalItems(items, s.cfg.animal, S, P, tl) : avatarItems(items, s.cfg, S, P);
    const hold = s.a.hold, th = s.a.throw;
    if (hold) { const ho = typeof hold === 'string' ? { type: hold } : hold; if (ho.both && !s.cfg.animal) { const a = s.rig.handL, b = s.rig.handR; propItems(items, ho.type, ho, M4.chain(M4.T((a[12] + b[12]) / 2, (a[13] + b[13]) / 2 - 0.1, (a[14] + b[14]) / 2), M4.RY(s.face + Math.PI), M4.RX((ho.tilt ?? 30) * DEG), M4.S(ho.s || 0.8), M4.T(0, -0.3, 0))); } else if (s.cfg.animal) propItems(items, ho.type, ho, M4.mul(s.rig.head, M4.chain(M4.T(0, 0.1, 1.4), M4.S(ho.s || 0.6)))); else propItems(items, ho.type, ho, M4.mul(ho.hand === 'L' ? s.rig.handL : s.rig.handR, ho.dir === 'arm' ? M4.chain(M4.T(0, 0.2, 0), M4.RX(Math.PI), M4.S(ho.s || 0.8)) : M4.chain(M4.T(0, 0, 0.1), M4.RX(Math.PI / 2), M4.S(ho.s || 0.7), M4.T(0, ho.off ?? (ho.type === 'umbrella' ? 0.75 : -0.6), 0)))); }
    if (th && !s.cfg.animal) {
      const rel = (th.at ?? 0.5), o = { type: th.item || 'ball', ...th }, sc = th.s || 0.8;
      if (u < rel) propItems(items, o.type, o, M4.mul(s.rig.handR, M4.chain(M4.RX(Math.PI / 2), M4.S(th.s || 0.7), M4.T(0, -0.6, 0))));
      else {
        // Startpunkt = echte Handposition im Abwurfmoment
        const tR = rel * D, sR = actorState(s.a, tR, D, 0, sh); sR.face = s.face;
        const rigR = avatarItems([], sR.cfg, { x: sR.x, y: sR.y, z: sR.z, face: s.face, scale: sR.scale, sh: false }, pose(sR.act, tR, sR.k, sR));
        const from = M4.xp(rigR.handR, [0, -0.3, 0]); from[1] -= 0.65 * sc;
        const fw = [Math.sin(s.face), Math.cos(s.face)], tgtA = typeof th.to === 'string' ? map[th.to] : null;
        const to = tgtA ? [tgtA.x, tgtA.y + tgtA.h * 0.8 - 0.65 * sc, tgtA.z] : (th.to ? pt3(th.to, 0) : [s.x + fw[0] * 30, 0, s.z + fw[1] * 30]);
        const T = Math.max(0.12, (th.dur ?? 0.35) * D), dt = tl - tR, L = launch(from, to, th.arc ?? 6, T);
        let pos, rx = 0, sq = 0;
        if (dt <= T) { pos = [from[0] + L.v[0] * dt, from[1] + L.v[1] * dt - L.g / 2 * dt * dt, from[2] + L.v[2] * dt]; rx = dt * 14; }
        else if (th.vanish) pos = null;
        else if (tgtA && th.bonk !== false) { // prallt vom Ziel ab und fällt zu Boden
          const v = [-L.v[0] * 0.22, 5.5, -L.v[2] * 0.22], r = ballistic(to, v, 26, dt - T, { rest: 0.42 }); pos = r.p; rx = T * 14 + (dt - T) * (r.b ? 0 : 8) + r.rolling * 1.4; if (r.b) sq = jiggle(dt - T - r.air, 0.2);
        } else if (to[1] < 0.6 && th.bounce !== false) { const r = ballistic(from, L.v, L.g, dt, { rest: th.rest ?? 0.45 }); pos = r.p; rx = Math.min(r.air, dt) * 14 * (r.b ? 0.3 : 1) + r.rolling * 1.4; if (r.b) sq = jiggle(dt - r.air, 0.22); }
        else pos = to;
        if (pos) propItems(items, o.type, o, M4.chain(M4.T(pos[0], pos[1], pos[2]), M4.RY(s.face), M4.RX(rx), M4.S(sc * (1 + sq * 0.5), sc * (1 - sq), sc * (1 + sq * 0.5))));
      }
    }
  }
  const LAY = propLayout(sh, si, set); (sh.props || []).forEach((p, i) => propState(items, p, tl, D, map, u, LAY[i]));
  fxItems(items, sh, tl, D, map);
  for (const s of list) blobShadow(items, s);
  GL.render(items, cam, E);
  OX.setTransform(1, 0, 0, 1, 0, 0); OX.drawImage(CV, 0, 0, OC.width, OC.height); OX.setTransform(R.K || 1, 0, 0, R.K || 1, 0, 0);
  bloom(sh.bloom ?? (set.indoor ? 0.16 : lerp(0.09, 0.6, E.night)));
  if (!R.clean) drawOverlay(sh, tl, D, map, list);   // R.clean: Bild ohne Untertitel/Text (Vorschaubild)
}

R.init = async function (W = 1080, H = 1920, rs = 0.75, out = 1) {
  // out = Ausgabe-Faktor (2 = echtes 4K 2160x3840). Logische Größe bleibt W x H -> Untertitel/Grafiken unverändert, nur schärfer.
  CV = document.getElementById('gl'); CV.width = Math.round(W * rs); CV.height = Math.round(H * rs); GL = new GLR(CV);
  R.K = out; OC = document.getElementById('out'); OC.width = Math.round(W * out); OC.height = Math.round(H * out); OX = OC.getContext('2d'); OX.imageSmoothingEnabled = true; OX.imageSmoothingQuality = 'high';
  R.W = W; R.H = H;
  await document.fonts.load(`bold 100px Poppins`); await document.fonts.load(`100px "Noto Color Emoji"`);
  return true;
};
R.load = function (ep) { R.ep = ep; R.cast = ep.cast || {}; return ep.shots.length; };
R.frame = function (si, tl, q = 0.92) { renderShot(R.ep.shots[si], si, tl); return OC.toDataURL('image/jpeg', q); };
R.info = () => ({ sets: Object.keys(SETS), props: Object.keys(PROPS), animals: Object.keys(ANIMALS), looks: Object.keys(LOOKS), moods: Object.keys(MOODS) });
