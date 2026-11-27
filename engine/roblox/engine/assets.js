'use strict';
// ============ assets.js – Texturen, Avatare, Tiere, Requisiten ============
let GL = null;
const TEXC = {}, GEOC = {};
function ctex(key, w, h, draw) { if (TEXC[key]) return TEXC[key]; const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); return (TEXC[key] = GL.tex(c)); }
function cgeo(key, build) { if (GEOC[key]) return GEOC[key]; const mb = new MB(); build(mb); return (GEOC[key] = GL.geo(mb)); }
const FONT = 'Poppins, "DejaVu Sans", sans-serif';

// ---------- 2D-Helfer ----------
function ell(x, cx, cy, rx, ry) { x.beginPath(); x.ellipse(cx, cy, Math.max(rx, .1), Math.max(ry, .1), 0, 0, Math.PI * 2); }
function hl(x, cx, cy, r) { x.save(); x.fillStyle = '#ffffff'; ell(x, cx, cy, r, r); x.fill(); x.restore(); }
function heartPath(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy + s * 0.75); x.bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.6, cy - s * 1.0, cx, cy - s * 0.35); x.bezierCurveTo(cx + s * 0.6, cy - s * 1.0, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.75); x.closePath(); }
function drop(x, cx, cy, c, s = 1) { x.save(); x.fillStyle = c; x.beginPath(); x.moveTo(cx, cy - 12 * s); x.quadraticCurveTo(cx + 9 * s, cy + 2 * s, cx, cy + 9 * s); x.quadraticCurveTo(cx - 9 * s, cy + 2 * s, cx, cy - 12 * s); x.fill(); x.restore(); }
function starPath(x, cx, cy, R, r, n = 5) { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; i ? x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q) : x.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); }
function rrect(x, a, b, w, h, r) { x.beginPath(); x.roundRect(a, b, w, h, r); }
function fitFont(x, lines, W, H, max, weight = 'bold') { let s = max; while (s > 10) { x.font = `${weight} ${s}px ${FONT}`; const w = Math.max(...lines.map(l => x.measureText(l).width)); if (w <= W && s * 1.12 * lines.length <= H) break; s -= 3; } return s; }

// ---------- Gesichter ----------
const MOODS = {
  happy: { e: 'dot', b: 'norm', m: 'smile', blush: 1 }, smile: { e: 'dot', b: 'norm', m: 'smile' }, neutral: { e: 'dot', b: 'norm', m: 'flat' },
  talk: { e: 'dot', b: 'norm', m: 'smile' }, grin: { e: 'happy', b: 'norm', m: 'grin', blush: 1 }, laugh: { e: 'happy', b: 'up', m: 'grin', blush: 1 },
  surprised: { e: 'wide', b: 'up', m: 'O' }, shock: { e: 'wide', b: 'up', m: 'yawn', sweat: 1 }, sad: { e: 'dot', b: 'sad', m: 'frown', tear: 1 },
  cry: { e: 'closed', b: 'sad', m: 'wavyopen', tear: 2 }, angry: { e: 'dot', b: 'angry', m: 'frown' }, sleepy: { e: 'half', b: 'norm', m: 'flat' },
  sleep: { e: 'closed', b: 'none', m: 'o' }, yawn: { e: 'closed', b: 'up', m: 'yawn' }, scared: { e: 'wide', b: 'sad', m: 'wavy', sweat: 1 },
  cool: { e: 'half', b: 'angry', m: 'smirk' }, smug: { e: 'half', b: 'norm', m: 'smirk' }, wink: { e: 'wink', b: 'norm', m: 'grin' },
  love: { e: 'heart', b: 'norm', m: 'smile', blush: 1 }, think: { e: 'up', b: 'think', m: 'smirk' }, evil: { e: 'half', b: 'angry', m: 'grin' },
  confused: { e: 'dot', b: 'think', m: 'wavy' }, dizzy: { e: 'x', b: 'none', m: 'wavy' },
  // Neue Emotionen (Generalüberholung 21.11.2026)
  panic: { e: 'wide', b: 'worry', m: 'scream', sweat: 1 }, nervous: { e: 'small', b: 'worry', m: 'wavy', sweat: 1 },
  disgusted: { e: 'half', b: 'angry', m: 'wavy' }, disgust: { e: 'half', b: 'angry', m: 'wavy' }, fear: { e: 'wide', b: 'worry', m: 'wavyopen', sweat: 1 },
  disappointed: { e: 'half', b: 'sad', m: 'frown' }, confident: { e: 'half', b: 'think', m: 'smirk' },
  excited: { e: 'shine', b: 'up', m: 'grin', blush: 1 }, relieved: { e: 'closed', b: 'up', m: 'smile' }, determined: { e: 'dot', b: 'angry', m: 'flat' },
};
// o: { gx: Blickrichtung -1..1, lashes, freckles, eye: Augenfarbe }  – Textur 512px (scharf auch in Nahaufnahmen)
function faceTex(mood, closed, open, kind = 'human', o = {}) {
  const M = MOODS[mood] || MOODS.happy, gx = o.gx || 0, op = open === true ? 1 : (open || 0);
  const MF = o.mii || null;   // Mii-Town-Gesicht: {eye:'round|oval|almond|big|narrow', es, edx, ey, brow:'thin|thick|flat|arched|bushy', mouth, nose, cheeks}
  return ctex(`face|${mood}|${closed ? 1 : 0}|${op}|${kind}|${gx}|${o.lashes ? 1 : 0}|${o.freckles ? 1 : 0}|${o.eye || ''}|${MF ? JSON.stringify(MF) : ''}`, 512, 512, (x) => {
    x.scale(2, 2);
    const A = kind !== 'human', ink = '#1d1712', eyeC = o.eye || ink;
    x.lineCap = 'round'; x.lineJoin = 'round';
    if (kind === 'penguin') { x.fillStyle = '#ffffff'; ell(x, 128, 132, 92, 86); x.fill(); }
    const ES = MF ? (+MF.es || 1) : 1, ESH = MF ? ({ round: [1, 1], oval: [0.9, 1.15], almond: [1.15, 0.8], big: [1.2, 1.25], narrow: [1.1, 0.62] }[MF.eye] || [1, 1]) : [1, 1];
    const ey = A ? 112 : (MF ? 112 + (+MF.ey || 0) : 106), dx = A ? 50 : (MF ? 38 + (+MF.edx || 0) * 0.8 : 42), rx = (A ? 18 : 14.5) * ES * ESH[0], ry = (A ? 23 : 21) * ES * ESH[1], px = gx * 4;
    let eyes = M.e; if (closed && ['dot', 'wide', 'half', 'up', 'heart', 'wink', 'small', 'shine'].includes(eyes)) eyes = 'closed';
    if (kind !== 'frog') for (const s of [-1, 1]) {
      const cx = 128 + s * dx; let e = eyes; if (e === 'wink') e = s > 0 ? 'happy' : 'dot';
      let ez = 0.74; if (MF && ['wide', 'small', 'shine'].includes(e)) { ez = e === 'wide' ? 0.88 : e === 'small' ? 0.6 : 0.76; e = 'dot'; }   // Mii: gleiche Augenform, nur Größe ändert sich
      x.save(); if (MF) { x.translate(cx, ey); x.scale(ez, ez); x.translate(-cx, -ey); }   // Mii: kleine, natürliche Augen
      x.strokeStyle = ink; x.fillStyle = eyeC; x.lineWidth = A ? 7 : 6.5;
      if (MF && (e === 'dot' || e === 'up')) {
        const oy = e === 'up' ? -6 : 0, ix = cx + px * 1.3, iy = ey + oy + 1;
        x.fillStyle = '#ffffff'; ell(x, cx, ey + oy, rx * 1.18, ry * 1.08); x.fill(); x.lineWidth = 2.2; x.strokeStyle = 'rgba(40,25,15,0.55)'; ell(x, cx, ey + oy, rx * 1.18, ry * 1.08); x.stroke();
        x.lineWidth = 5.5; x.strokeStyle = ink; x.beginPath(); x.ellipse(cx, ey + oy, rx * 1.2, ry * 1.1, 0, Math.PI * 1.08, Math.PI * 1.92); x.stroke();   // Oberlid wie bei Mii
        x.save(); ell(x, cx, ey + oy, rx * 1.16, ry * 1.06); x.clip();
        x.fillStyle = o.eye || '#3b2416'; ell(x, ix, iy, rx * 0.9, ry * 0.92); x.fill();
        x.fillStyle = ink; ell(x, ix, iy, rx * 0.4, ry * 0.4); x.fill(); x.restore();
        hl(x, ix - rx * 0.3, iy - ry * 0.32, 5); hl(x, ix + rx * 0.28, iy + ry * 0.28, 2.4);
        if (o.lashes) { x.lineWidth = 4.5; x.strokeStyle = ink; x.beginPath(); x.moveTo(cx + s * rx * 0.9, ey + oy - ry * 0.7); x.lineTo(cx + s * (rx * 1.18 + 7), ey + oy - ry - 3); x.stroke(); }
      }
      else if (e === 'dot' || e === 'up') {
        const oy = e === 'up' ? -6 : 0;
        ell(x, cx + px, ey + oy, rx, ry); x.fill();
        if (eyeC !== ink) { x.fillStyle = ink; ell(x, cx + px, ey + oy + 2, rx * 0.55, ry * 0.55); x.fill(); }
        hl(x, cx + px - rx * 0.32, ey + oy - ry * 0.4, A ? 7.5 : 6); hl(x, cx + px + rx * 0.35, ey + oy + ry * 0.38, A ? 3.5 : 2.8);
        if (o.lashes) { x.lineWidth = 4.5; x.strokeStyle = ink; x.beginPath(); x.moveTo(cx + s * rx * 0.75, ey + oy - ry * 0.7); x.lineTo(cx + s * (rx + 8), ey + oy - ry - 4); x.stroke(); }
      }
      else if (e === 'small') { ell(x, cx + px, ey + 2, rx * 0.62, ry * 0.62); x.fill(); hl(x, cx + px - 2, ey - 3, 3); }
      else if (e === 'shine') { ell(x, cx + px, ey, rx * 1.12, ry * 1.08); x.fill(); hl(x, cx + px - rx * 0.3, ey - ry * 0.42, 8); hl(x, cx + px + rx * 0.38, ey + ry * 0.3, 4); x.fillStyle = '#fff'; starPath(x, cx + px + rx * 0.2, ey - ry * 0.05, 6, 2.5); x.fill(); }
      else if (e === 'wide') { x.fillStyle = '#fff'; ell(x, cx, ey, rx + 8, ry + 6); x.fill(); x.lineWidth = 5; x.stroke(); x.fillStyle = eyeC; ell(x, cx + px * 1.5, ey + 2, rx * 0.6, ry * 0.55); x.fill(); hl(x, cx + px * 1.5 - 3, ey - 4, 4); }
      else if (e === 'half') { x.save(); x.beginPath(); x.rect(cx - 40, ey - ry * 0.1, 80, 80); x.clip(); ell(x, cx + px, ey, rx, ry); x.fill(); x.restore(); hl(x, cx + px - 3, ey + 4, 3.5); x.lineWidth = 6; x.beginPath(); x.moveTo(cx - rx - 4, ey - ry * 0.1); x.quadraticCurveTo(cx, ey - ry * 0.25, cx + rx + 4, ey - ry * 0.1); x.stroke(); }
      else if (e === 'closed') { x.beginPath(); x.arc(cx, ey - 8, 15, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); if (o.lashes) { x.lineWidth = 4; x.beginPath(); x.moveTo(cx + s * 13, ey + 2); x.lineTo(cx + s * 21, ey + 7); x.stroke(); } }
      else if (e === 'happy') { x.beginPath(); x.arc(cx, ey + 10, 15, 1.15 * Math.PI, 1.85 * Math.PI); x.stroke(); }
      else if (e === 'heart') { x.fillStyle = '#e8253f'; heartPath(x, cx, ey, 21); x.fill(); hl(x, cx - 8, ey - 6, 4); }
      else if (e === 'x') { x.beginPath(); x.moveTo(cx - 12, ey - 12); x.lineTo(cx + 12, ey + 12); x.moveTo(cx + 12, ey - 12); x.lineTo(cx - 12, ey + 12); x.stroke(); }
      x.restore();
    }
    // Augenbrauen (leicht gebogen)
    if (M.b !== 'none' && (!A || ['angry', 'sad', 'up', 'worry'].includes(M.b)) && kind !== 'frog') {
      const BS = MF ? MF.brow : null, by = ey - (A ? 42 : 27) - (MF ? ry - 21 : 0) - (BS === 'arched' ? 3 : 0);
      x.lineWidth = A ? 8.5 : (BS === 'thin' ? 5.5 : BS === 'thick' ? 12 : BS === 'bushy' ? 14 : 9.5); x.strokeStyle = (MF && MF.browColor) || '#2a1c12';
      if (MF) x.lineWidth *= 0.55;
      for (const s of [-1, 1]) {
        const cx = 128 + s * dx; let i0 = 0, o0 = 0, arch = -4;
        x.save(); if (MF) { x.translate(cx, by + 10); x.scale(0.72, 0.72); x.translate(-cx, -by + 2); }
        if (M.b === 'up') { i0 = -9; o0 = -7; arch = -6; } else if (M.b === 'sad') { i0 = -10; o0 = 5; arch = -1; } else if (M.b === 'angry') { i0 = 10; o0 = -5; arch = 1; } else if (M.b === 'think' && s > 0) { i0 = -10; o0 = -12; arch = -7; } else if (M.b === 'worry') { i0 = -9; o0 = 6; arch = -2; }
        if (BS === 'flat') arch = 0; else if (BS === 'arched') arch -= 4;
        x.beginPath(); x.moveTo(cx - s * 15, by + i0); x.quadraticCurveTo(cx, by + (i0 + o0) / 2 + arch, cx + s * 15, by + o0); x.stroke(); x.restore();
      }
    }
    if (MF && MF.beard) { x.save(); x.globalAlpha = 0.9; x.fillStyle = MF.beard; x.beginPath(); x.moveTo(52, 132); x.quadraticCurveTo(58, 236, 128, 246); x.quadraticCurveTo(198, 236, 204, 132); x.quadraticCurveTo(190, 196, 128, 200); x.quadraticCurveTo(66, 196, 52, 132); x.fill(); x.restore(); }   // Mii-Bart als Fläche am Kiefer
    if (MF && (MF.stache || MF.beard)) { x.fillStyle = MF.stache || MF.beard; for (const s of [-1, 1]) { x.save(); x.translate(128 + s * 13, 150); x.rotate(s * 0.22); ell(x, 0, 0, 15, 6); x.fill(); x.restore(); } }
    // Mund (op: 0 zu, 1 halb, 2 weit)
    let m = M.m; if (op) m = (m === 'grin' || m === 'yawn' || m === 'scream') ? m : (m === 'frown' || m === 'wavy' ? 'wavyopen' : 'open');
    const my = kind === 'frog' ? 150 : (MF ? 160 + (+MF.my || 0) : 158); x.strokeStyle = ink; x.lineWidth = 7;
    const showMouth = kind === 'human' || kind === 'frog';
    x.save(); if (MF) { const mw = +MF.mw || 1; x.translate(128, my); x.scale(0.86 * mw, 0.86); x.translate(-128, -my); }
    if (showMouth) {
      const fillM = (c = '#6b1a1a') => { x.fillStyle = c; x.fill(); };
      if (m === 'smile' && MF && !op) {   // Mii-Lächeln: offener Mund mit oberen Zähnen
        x.beginPath(); x.moveTo(104, my - 4); x.quadraticCurveTo(128, my + 2, 152, my - 4); x.quadraticCurveTo(128, my + 30, 104, my - 4); x.closePath(); fillM('#7a1f22');
        x.save(); x.clip(); x.fillStyle = '#ffffff'; x.fillRect(96, my - 8, 64, 10); ell(x, 128, my + 20, 14, 7); x.fillStyle = '#e8737a'; x.fill(); x.restore();
        x.beginPath(); x.moveTo(104, my - 4); x.quadraticCurveTo(128, my + 2, 152, my - 4); x.quadraticCurveTo(128, my + 30, 104, my - 4); x.closePath(); x.lineWidth = 4; x.strokeStyle = '#5a1a1a'; x.stroke(); }
      else if (m === 'smile') { x.beginPath(); x.arc(128, my - 22, kind === 'frog' ? 40 : 26, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke(); }
      else if (m === 'flat') { x.beginPath(); x.moveTo(112, my); x.quadraticCurveTo(128, my + 2, 144, my); x.stroke(); }
      else if (m === 'frown') { x.beginPath(); x.arc(128, my + 24, 24, 1.22 * Math.PI, 1.78 * Math.PI); x.stroke(); }
      else if (m === 'open' || m === 'wavyopen') { const w = op > 1 ? 21 : 15, h = op > 1 ? 18 : 10; ell(x, 128, my + 4, w, h); fillM(); ell(x, 128, my + 4 + h * 0.55, w * 0.58, h * 0.42); fillM('#ff8a8a'); x.lineWidth = 5; ell(x, 128, my + 4, w, h); x.stroke(); if (op > 1) { x.save(); ell(x, 128, my + 4, w, h); x.clip(); x.fillStyle = '#fff'; x.fillRect(100, my + 4 - h, 56, 6); x.restore(); } }
      else if (m === 'grin') { x.beginPath(); x.moveTo(98, my - 10); x.quadraticCurveTo(128, my + (op ? 50 : 44), 158, my - 10); x.closePath(); fillM(); x.save(); x.clip(); x.fillStyle = '#fff'; x.fillRect(90, my - 12, 80, 11); ell(x, 128, my + 26, 16, 9); x.fillStyle = '#ff8a8a'; x.fill(); x.restore(); x.lineWidth = 5; x.stroke(); }
      else if (m === 'scream') { const h = 24 + op * 4; ell(x, 128, my + 10, 20, h); fillM(); x.save(); ell(x, 128, my + 10, 20, h); x.clip(); x.fillStyle = '#fff'; x.fillRect(100, my + 10 - h, 56, 8); x.restore(); ell(x, 128, my + 10 + h * 0.6, 12, 7); fillM('#ff8a8a'); x.lineWidth = 5; ell(x, 128, my + 10, 20, h); x.stroke(); }
      else if (m === 'O') { ell(x, 128, my + 4, 10, 13); fillM(); x.lineWidth = 5; x.stroke(); }
      else if (m === 'o') { ell(x, 128, my + 2, 6, 7); fillM(); x.lineWidth = 4; x.stroke(); }
      else if (m === 'yawn') { ell(x, 128, my + 12, 19, 30); fillM(); ell(x, 128, my + 30, 11, 8); fillM('#ff8a8a'); x.lineWidth = 5; ell(x, 128, my + 12, 19, 30); x.stroke(); }
      else if (m === 'wavy') { x.beginPath(); for (let i = 0; i <= 24; i++) { const px2 = 104 + i * 2, py = my + Math.sin(i / 24 * Math.PI * 3) * 5; i ? x.lineTo(px2, py) : x.moveTo(px2, py); } x.stroke(); }
      else if (m === 'smirk') { x.beginPath(); x.moveTo(106, my + 2); x.quadraticCurveTo(134, my + 10, 152, my - 10); x.stroke(); }
    }
    x.restore();
    if (MF && MF.cheeks && !M.blush) { x.fillStyle = 'rgba(255,105,120,0.28)'; ell(x, 128 - dx - 20, ey + 40, 17, 10); x.fill(); ell(x, 128 + dx + 20, ey + 40, 17, 10); x.fill(); }
    if ((M.blush && !(MF && mood !== 'love')) || A) { x.fillStyle = 'rgba(255,105,120,0.36)'; ell(x, 128 - dx - 20, ey + 40, 17, 10); x.fill(); ell(x, 128 + dx + 20, ey + 40, 17, 10); x.fill(); }
    else if (!A && !MF) { x.fillStyle = 'rgba(255,120,120,0.12)'; ell(x, 128 - dx - 18, ey + 40, 16, 9); x.fill(); ell(x, 128 + dx + 18, ey + 40, 16, 9); x.fill(); }
    if (MF && MF.mole) { x.fillStyle = '#5a3a28'; ell(x, 128 + MF.mole * 52, 150, 3.2, 3.2); x.fill(); }
    if (o.freckles) { x.fillStyle = 'rgba(150,80,40,0.55)'; for (const s of [-1, 1]) for (const [fx, fy] of [[0, 0], [9, 5], [-8, 6], [3, 11]]) { ell(x, 128 + s * (dx + 12 + fx), ey + 30 + fy, 2.4, 2.4); x.fill(); } }
    if (M.tear) { drop(x, 128 - dx + 4, ey + 32, '#4fb0ff'); if (M.tear > 1) drop(x, 128 + dx - 4, ey + 36, '#4fb0ff'); }
    if (M.sweat) drop(x, 206, 62, '#7cc8ff', 1.5);
  });
}

// ---------- Logos / Schilder ----------
function logoTex(logo, fg = '#ffd23f', bg = '#1d2b6b') { return ctex(`logo|${logo}|${fg}|${bg}`, 256, 256, logoTexDraw(logo, fg, bg)); }
function logoTexDraw(logo, fg = '#ffd23f', bg = '#1d2b6b') {
  return (x => {
    if (!logo || logo === 'none') return;
    const cx = 128, cy = 98;
    const sym = { star: 1, heart: 1, bolt: 1, smile: 1, dot: 1, flame: 1 };
    if (sym[logo]) {
      x.fillStyle = bg; ell(x, cx, cy, 50, 50); x.fill(); x.fillStyle = fg;
      if (logo === 'star') { starPath(x, cx, cy + 2, 36, 15); x.fill(); }
      else if (logo === 'heart') { heartPath(x, cx, cy + 4, 34); x.fill(); }
      else if (logo === 'bolt') { x.beginPath(); x.moveTo(cx + 8, cy - 36); x.lineTo(cx - 20, cy + 6); x.lineTo(cx - 2, cy + 6); x.lineTo(cx - 10, cy + 38); x.lineTo(cx + 22, cy - 6); x.lineTo(cx + 4, cy - 6); x.closePath(); x.fill(); }
      else if (logo === 'smile') { ell(x, cx, cy, 34, 34); x.fill(); x.fillStyle = bg; ell(x, cx - 12, cy - 8, 5, 8); x.fill(); ell(x, cx + 12, cy - 8, 5, 8); x.fill(); x.strokeStyle = bg; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, 20, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke(); }
      else if (logo === 'flame') { x.beginPath(); x.moveTo(cx, cy - 38); x.bezierCurveTo(cx + 40, cy, cx + 24, cy + 40, cx, cy + 38); x.bezierCurveTo(cx - 24, cy + 40, cx - 40, cy, cx, cy - 38); x.fill(); }
      else { ell(x, cx, cy, 22, 22); x.fill(); }
    } else {
      const t = String(logo); const s = fitFont(x, [t], 190, 120, 110);
      x.font = `bold ${s}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 10; x.strokeStyle = bg; x.lineJoin = 'round'; x.strokeText(t, cx, cy + 4); x.fillStyle = fg; x.fillText(t, cx, cy + 4);
    }
  });
}
function signTex(text, o = {}) {
  const W = o.tw || 512, H = o.th || 256, bg = o.bg || '#ffffff', fg = o.fg || '#d63031', br = o.border === undefined ? fg : o.border;
  return ctex(`sign|${text}|${W}|${H}|${bg}|${fg}|${br}|${o.font || ''}`, W, H, x => {
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    if (br) { x.strokeStyle = br; x.lineWidth = Math.min(W, H) * 0.06; rrect(x, x.lineWidth, x.lineWidth, W - 2 * x.lineWidth, H - 2 * x.lineWidth, H * 0.08); x.stroke(); }
    const lines = String(text).split('\n'); const s = fitFont(x, lines, W * 0.84, H * 0.8, H * 0.62);
    x.font = `bold ${s}px ${o.font || FONT}`; x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((l, i) => x.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * s * 1.08 + s * 0.04));
  });
}
function panelTex(lit = []) {
  const L = new Set((lit || []).map(String));
  return ctex(`elevpanel|${[...L].join(',')}`, 256, 560, x => {
    const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, '#8e959e'); g.addColorStop(0.5, '#c9ced6'); g.addColorStop(1, '#8e959e');
    x.fillStyle = g; x.fillRect(0, 0, 256, 560); x.strokeStyle = '#5b6168'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 550);
    for (let n = 1; n <= 10; n++) {
      const c = (n - 1) % 2, r = Math.floor((n - 1) / 2), cx = 80 + c * 96, cy = 470 - r * 92, on = L.has(String(n));
      x.beginPath(); x.arc(cx, cy, 38, 0, Math.PI * 2); x.fillStyle = '#3b3f45'; x.fill();
      x.beginPath(); x.arc(cx, cy, 31, 0, Math.PI * 2); x.fillStyle = on ? '#ffb703' : '#e9ecef'; x.fill();
      if (on) { x.lineWidth = 6; x.strokeStyle = '#fff3b0'; x.stroke(); }
      x.font = `bold 34px ${FONT}`; x.fillStyle = on ? '#3b2300' : '#2b2f33'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), cx, cy + 2);
    }
    // Extra-Knopf über 10 (z. B. "11" oder "13" – ein Stockwerk, das es nicht geben dürfte): rot glühend oben in der Mitte
    const ex = [...L].map(Number).filter(v => v > 10)[0];
    if (ex) { const cx = 128, cy = 44; x.beginPath(); x.arc(cx, cy, 34, 0, Math.PI * 2); x.fillStyle = '#3b3f45'; x.fill(); x.beginPath(); x.arc(cx, cy, 28, 0, Math.PI * 2); x.fillStyle = '#ff2d2d'; x.fill(); x.lineWidth = 6; x.strokeStyle = '#ffb3b3'; x.stroke();
      x.font = `bold 30px ${FONT}`; x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(ex), cx, cy + 2); }
  });
}
function chatTex(o = {}) {
  const key = 'chat|' + JSON.stringify([o.name, o.sub, o.msgs, o.typing, o.lock, o.notif, o.nameColor, o.stamp, o.time, o.avatar]);
  return ctex(key, 360, 720, x => {
    x.fillStyle = '#0d0d12'; x.fillRect(0, 0, 360, 720);
    x.fillStyle = '#ffffff'; x.font = `bold 18px ${FONT}`; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(o.time || '03:00', 22, 22);
    x.textAlign = 'right'; x.fillText('▮▮▮  ▰', 338, 22);
    const wrap = (t, maxW, font) => { x.font = font; const words = String(t).split(' '); const lines = []; let cur = ''; for (const w of words) { const tt = cur ? cur + ' ' + w : w; if (x.measureText(tt).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tt; } if (cur) lines.push(cur); return lines; };
    if (o.lock) {
      x.textAlign = 'center'; x.fillStyle = '#ffffff'; x.font = `bold 92px ${FONT}`; x.fillText(o.time || '03:00', 180, 170);
      x.font = `bold 20px ${FONT}`; x.fillStyle = '#b8b8c8'; x.fillText(o.date || 'Thursday', 180, 235);
      if (o.notif) { rrect(x, 18, 300, 324, 118, 22); x.fillStyle = 'rgba(255,255,255,0.16)'; x.fill(); x.textAlign = 'left'; x.fillStyle = '#ffffff'; x.font = `bold 21px ${FONT}`; x.fillText(o.notif[0], 40, 334); const ls = wrap(o.notif[1], 280, `22px ${FONT}`); x.fillStyle = '#e8e8f0'; ls.slice(0, 2).forEach((l, i) => x.fillText(l, 40, 370 + i * 28)); }
      return;
    }
    x.fillStyle = '#1b1b24'; x.fillRect(0, 44, 360, 92);
    x.fillStyle = '#4fc3f7'; x.font = `bold 34px ${FONT}`; x.textAlign = 'left'; x.fillText('‹', 16, 90);
    x.beginPath(); x.arc(70, 90, 26, 0, Math.PI * 2); x.fillStyle = '#5a5a6a'; x.fill(); x.fillStyle = '#ffffff'; x.font = `bold 26px ${FONT}`; x.textAlign = 'center'; x.fillText(o.avatar || '?', 70, 91);
    x.textAlign = 'left'; x.fillStyle = o.nameColor || '#ffffff'; x.font = `bold 24px ${FONT}`; x.fillText(o.name || 'Unknown', 108, 80); x.fillStyle = '#9a9aae'; x.font = `17px ${FONT}`; x.fillText(o.sub || '', 108, 107);
    let y = 160; const F = `24px ${FONT}`;
    for (const [side, t] of (o.msgs || [])) {
      const ls = wrap(t, 220, F), h = ls.length * 30 + 22, w = Math.max(...ls.map(l => x.measureText(l).width)) + 30, me = side === 'me';
      const bx = me ? 342 - w : 18; rrect(x, bx, y, w, h, 20); x.fillStyle = me ? '#2f7cf6' : '#34343e'; x.fill();
      x.fillStyle = '#ffffff'; x.font = F; x.textAlign = 'left'; ls.forEach((l, i) => x.fillText(l, bx + 15, y + 26 + i * 30)); y += h + 14;
    }
    if (o.typing) { rrect(x, 18, y, 86, 46, 20); x.fillStyle = '#34343e'; x.fill(); x.fillStyle = '#c8c8d4'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(40 + i * 21, y + 23, 6, 0, Math.PI * 2); x.fill(); } y += 60; }
    if (o.stamp) { x.fillStyle = o.stampColor || '#ff5a5a'; x.font = `bold 18px ${FONT}`; x.textAlign = 'center'; x.fillText(o.stamp, 180, y + 6); }
    x.fillStyle = '#1b1b24'; x.fillRect(0, 650, 360, 70); rrect(x, 16, 664, 280, 42, 21); x.fillStyle = '#2a2a36'; x.fill(); x.fillStyle = '#6a6a7e'; x.font = `18px ${FONT}`; x.textAlign = 'left'; x.fillText('Message', 34, 686);
    x.beginPath(); x.arc(326, 685, 21, 0, Math.PI * 2); x.fillStyle = '#2f7cf6'; x.fill();
  });
}
function clockTex(time = '12:00', o = {}) {
  return ctex(`clock|${time}|${o.digital ? 1 : 0}`, 256, 256, x => {
    if (o.digital) { x.fillStyle = '#111'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#ff3b3b'; const s = fitFont(x, [time], 220, 120, 110); x.font = `bold ${s}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(time, 128, 132); return; }
    x.fillStyle = '#fff'; ell(x, 128, 128, 124, 124); x.fill(); x.strokeStyle = '#222'; x.lineWidth = 10; x.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.lineWidth = i % 3 ? 4 : 8; x.beginPath(); x.moveTo(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96); x.lineTo(128 + Math.sin(a) * 110, 128 - Math.cos(a) * 110); x.stroke(); }
    const [hh, mm] = time.split(':').map(Number); const ha = ((hh % 12) + mm / 60) / 12 * Math.PI * 2, ma = mm / 60 * Math.PI * 2;
    x.lineCap = 'round'; x.lineWidth = 12; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.sin(ha) * 55, 128 - Math.cos(ha) * 55); x.stroke();
    x.lineWidth = 8; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.sin(ma) * 85, 128 - Math.cos(ma) * 85); x.stroke();
    x.fillStyle = '#d63031'; ell(x, 128, 128, 10, 10); x.fill();
  });
}

// ---------- Avatare (R15-artig: Ellbogen + Knie, Accessoires, Haar-/Umhang-Physik) ----------
const AVDEF = { skin: '#f5c79a', shirt: '#2f6fe0', pants: '#22355e', shoes: '#2b2b2b', sole: '#f2f2f2', hair: 'short', hairColor: '#5a3418', logo: 'none', logoColor: '#ffd23f', logoBg: '#1d2b6b', sleeves: 'long', hat: null, hatColor: '#e74c3c', glasses: false, beard: false, scale: 1 };
const AVC = {};
const GOLD = '#f5c518';
const T_ = (mb, x, y, z, f) => { mb.push(M4.T(x, y, z)); f(); mb.pop(); };
const TR_ = (mb, m, f) => { mb.push(m); f(); mb.pop(); };
// Mii Town: glatte Haar-Schale über dem runden Kopf (Kopf ±0.66). keep(d) entscheidet je Richtung, ob dort Haar ist.
function miiShell(mb, C, R, keep, o = {}) {
  // je Längengrad die Haargrenze per Bisektion suchen -> glatter Haaransatz ohne Treppen
  const NU = 96, NV = 26, sy = o.sy || 1.08, sz = o.sz || 1, cy = o.cy || 0.04, cz = o.cz || -0.03;
  const D = (th, ph) => [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
  const Pt = d => [d[0] * R, cy + d[1] * R * sy, cz + d[2] * R * sz], Nn = d => V3.norm([d[0], d[1] / sy, d[2] / sz]);
  const TC = [];
  for (let i = 0; i <= NU; i++) { const ph = i / NU * Math.PI * 2; let lo = 0, hi = Math.PI; if (keep(D(hi, ph))) { TC.push(hi); continue; } for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; if (keep(D(m, ph))) lo = m; else hi = m; } TC.push(lo); }
  for (let i = 0; i < NU; i++) { const p0 = i / NU * Math.PI * 2, p1 = (i + 1) / NU * Math.PI * 2;
    for (let j = 0; j < NV; j++) {
      const a = D(TC[i] * j / NV, p0), b = D(TC[i + 1] * j / NV, p1), c = D(TC[i + 1] * (j + 1) / NV, p1), d = D(TC[i] * (j + 1) / NV, p0);
      mb.triN(Pt(a), Pt(d), Pt(c), Nn(a), Nn(d), Nn(c), C); mb.triN(Pt(a), Pt(c), Pt(b), Nn(a), Nn(c), Nn(b), C);
    } }
}
function miiHairGeo(mb, cfg) {
  const hc = col(cfg.hairColor), st = cfg.hair || 'short', hd = shade(cfg.hairColor, 0.9);
  // Haaransatz: vorne hoch (Stirn frei), seitlich bis über die Ohren, hinten tief
  const line = (front, side, back) => d => { const f = d[2]; const w = smooth((f - 0.3) / 0.3); const yc = f > 0 ? front * w + side * (1 - w) : back * -f + side * (1 + f); return d[1] > yc; };   // Stirn frei, Schläfen bis zum Ohr
  const T = (x, y, z, f) => { mb.push(M4.T(x, y, z)); f(); mb.pop(); };
  if (st === 'bald' || st === 'none') { if (st === 'bald') for (const s of [-1, 1]) T(s * 0.62, 0.0, -0.18, () => mb.sphere(0.24, 2, hc, { sx: 0.5, sy: 0.8 })); return; }
  if (st === 'afro') { T(0, 0.32, -0.1, () => mb.sphere(0.98, 2, hc, { sy: 0.92 })); return; }
  if (st === 'buzz') { miiShell(mb, hc, 0.75, line(0.42, 0.05, -0.3), { sy: 1.04 }); return; }
  if (st === 'cap') { miiShell(mb, hc, 0.77, line(0.3, -0.05, -0.45)); return; }
  const R0 = st === 'long' || st === 'bob' ? 0.8 : 0.78;   // deutlich über der Kopfhaut (kein Flimmern)
  const fr = { side: 0.22, bob: 0.18, long: 0.24, messy: 0.2, spiky: 0.3, curly: 0.26 }[st] ?? 0.3;
  const sd = { long: -0.75, bob: -0.6, pigtails: -0.2, ponytail: -0.1 }[st] ?? -0.05;
  const bk = { long: -0.95, bob: -0.75, ponytail: -0.5, bun: -0.5 }[st] ?? -0.42;
  miiShell(mb, hc, R0, line(fr, sd, bk), { sy: st === 'spiky' ? 1.12 : 1.1 });
  if (st === 'side') { mb.push(M4.chain(M4.T(0.22, 0.56, 0.5), M4.RZ(-0.35), M4.RX(-0.3))); mb.sphere(0.26, 3, hc, { sx: 1.45, sy: 0.42, sz: 0.6 }); mb.pop(); }
  if (st === 'long') { T(0, -0.55, -0.32, () => mb.sphere(0.62, 2, hc, { sx: 1.16, sy: 0.95, sz: 0.62 })); }
  if (st === 'bob') for (const s of [-1, 1]) T(s * 0.55, -0.32, 0.02, () => mb.sphere(0.3, 2, hc, { sx: 0.7, sy: 1.15, sz: 1.3 }));
  if (st === 'bun') T(0, 0.98, -0.32, () => mb.sphere(0.38, 2, hc));
  if (st === 'curly') { for (let i = 0; i < 44; i++) { const ph = i * 2.39996, th = Math.acos(1 - (i + 0.5) / 44 * 1.15), d = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph) - 0.05]; if (d[2] > 0.5 && d[1] < 0.55) continue; T(d[0] * 0.72, 0.04 + d[1] * 0.8, -0.03 + d[2] * 0.72, () => mb.sphere(0.105, 2, i % 3 ? hc : hd)); } }
  if (st === 'messy') { const Rr = rng(hash(cfg.hairColor) + 5); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + Rr() * 0.5; mb.push(M4.chain(M4.T(Math.sin(a) * 0.32, 0.86, Math.cos(a) * 0.3 - 0.08), M4.RY(a), M4.RX(-0.6 - Rr() * 0.4))); mb.cyl(0.16, 0.02, 0.3, 10, i % 2 ? hc : hd, { flat: false }); mb.pop(); } }
  if (false) { const Rr = rng(hash(cfg.hairColor) + 5); for (let i = 0; i < 14; i++) { const ph = Rr() * 6.28, th = 0.15 + Rr() * 1.05, d = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph) - 0.15]; if (d[2] > 0.55 && d[1] < 0.6) continue; T(d[0] * 0.7, 0.04 + d[1] * 0.78, -0.03 + d[2] * 0.7, () => mb.sphere(0.2 + Rr() * 0.06, 2, Rr() > 0.5 ? hc : hd)); } }
  if (st === 'spiky') for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; mb.push(M4.chain(M4.T(Math.sin(a) * 0.3, 0.78, Math.cos(a) * 0.28 - 0.06), M4.RY(a), M4.RX(-0.5))); mb.cyl(0.2, 0.02, 0.38, 10, hc, { flat: false }); mb.pop(); }
  if (st === 'mohawk') for (let i = 0; i < 5; i++) T(0, 0.82 + Math.sin(i / 4 * Math.PI) * 0.12, 0.5 - i * 0.28, () => mb.sphere(0.2, 2, hc, { sy: 1.3 }));
}
function hairGeo(mb, cfg) {
  const MIIH = cfg.style === 'mii'; if (MIIH) { miiHairGeo(mb, cfg); cfg = { ...cfg, hair: 'none', hat: cfg.hat || (cfg.hair === 'cap' ? 'cap' : undefined) }; }
  const hc = cfg.hairColor, st = cfg.hair, P = (x, y, z) => mb.push(M4.T(x, y, z)), Q = () => mb.pop(), hd = shade(hc, 0.86), hl2 = shade(hc, 1.12);
  const base = () => {
    P(0, 0.55, 0); mb.rbox(1.46, 0.44, 1.46, 0.17, hc); Q(); P(0, 0.16, -0.58); mb.rbox(1.46, 1.0, 0.36, 0.13, hc); Q();
    for (const s of [-1, 1]) { P(s * 0.63, 0.3, -0.12); mb.rbox(0.3, 0.6, 1.14, 0.1, hc); Q(); P(s * 0.66, 0.02, 0.32); mb.rbox(0.16, 0.32, 0.3, 0.06, hd); Q(); }
    P(0, 0.47, 0.57); mb.rbox(1.38, 0.26, 0.32, 0.1, hc); Q();
    // Strähnen vorne (Pony) – gibt der Frisur Struktur
    for (let i = 0; i < 4; i++) { mb.push(M4.chain(M4.T(-0.45 + i * 0.3, 0.38, 0.66), M4.RZ((i - 1.5) * 0.12), M4.RX(-0.15))); mb.rbox(0.34, 0.26, 0.16, 0.07, i % 2 ? hl2 : hc); mb.pop(); }
  };
  if (['short', 'spiky', 'long', 'ponytail', 'bun', 'pigtails', 'bob', 'side', 'messy'].includes(st)) base();
  if (st === 'messy') { const R = rng(hash(hc) + 9); for (let i = 0; i < 12; i++) { const a = R() * 6.28, r = 0.2 + R() * 0.4; mb.push(M4.chain(M4.T(Math.sin(a) * r, 0.72 + R() * 0.1, Math.cos(a) * r - 0.05), M4.RY(R() * 6), M4.RZ((R() - 0.5) * 1.1), M4.RX((R() - 0.5) * 1.1))); mb.rbox(0.32, 0.36, 0.32, 0.1, R() > 0.5 ? hc : hl2); mb.pop(); } }
  if (st === 'spiky') { const R = rng(hash(hc) + 3); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, r = 0.28 + R() * 0.14; mb.push(M4.chain(M4.T(Math.sin(a) * r, 0.74, Math.cos(a) * r * 0.9 - 0.05), M4.RY(a), M4.RX((-30 + R() * 40) * DEG), M4.RZ((R() - 0.5) * 40 * DEG))); mb.rbox(0.34, 0.5, 0.34, 0.07, shade(hc, 0.9 + R() * 0.2)); mb.pop(); } P(0.25, 0.62, 0.68); mb.push(M4.RX(-35 * DEG)); mb.rbox(0.5, 0.42, 0.3, 0.06, hc); mb.pop(); Q(); }
  if (st === 'side') { mb.push(M4.chain(M4.T(0.22, 0.72, 0.38), M4.RZ(-0.35), M4.RX(-0.25))); mb.rbox(1.0, 0.34, 0.7, 0.15, hl2); mb.pop(); }
  if (st === 'long') { P(0, -0.38, -0.62); mb.rbox(1.5, 1.95, 0.38, 0.15, hc); Q(); for (const s of [-1, 1]) { P(s * 0.67, -0.2, -0.12); mb.rbox(0.3, 1.55, 0.95, 0.12, hc); Q(); P(s * 0.64, -0.85, 0.22); mb.rbox(0.28, 0.6, 0.36, 0.12, hd); Q(); } }
  if (st === 'bob') { P(0, -0.05, -0.6); mb.rbox(1.52, 1.25, 0.4, 0.17, hc); Q(); for (const s of [-1, 1]) { P(s * 0.68, -0.05, 0.05); mb.rbox(0.32, 1.15, 1.2, 0.15, hc); Q(); } }
  if (st === 'bun') { P(0, 0.9, -0.25); mb.sphere(0.45, 2, hc); Q(); P(0, 0.62, -0.2); mb.cyl(0.3, 0.3, 0.12, 10, '#ff6fa8'); Q(); }
  if (st === 'afro') { P(0, 0.35, -0.12); mb.sphere(1.0, 2, hc, { jit: 0.12, seed: 4 }); Q(); }
  if (st === 'curly') { const R = rng(21); for (let i = 0; i < 22; i++) { const a = R() * 6.28, b = R() * 1.3; P(Math.sin(a) * Math.cos(b * 0.6) * 0.66, 0.25 + Math.sin(b) * 0.45, Math.cos(a) * 0.62 - 0.08); mb.sphere(0.27 + R() * 0.1, 1, R() > 0.5 ? hc : hl2); Q(); } }
  if (st === 'buzz') { P(0, 0.55, -0.02); mb.rbox(1.38, 0.24, 1.4, 0.1, hc); Q(); P(0, 0.2, -0.6); mb.rbox(1.38, 0.7, 0.2, 0.08, hc); Q(); }
  if (st === 'mohawk') { for (let i = 0; i < 5; i++) { P(0, 0.85 + Math.sin(i / 4 * Math.PI) * 0.15, 0.55 - i * 0.3); mb.rbox(0.3, 0.55, 0.32, 0.1, i % 2 ? hl2 : hc); Q(); } }
  if (MIIH) { mb.push(M4.chain(M4.T(0, 0.08, -0.02), M4.S(1.12, 1.08, 1.12))); }   // Mii: Hüte sitzen auf dem höheren Eierkopf
  if (MIIH && cfg.hat === 'cap') { const c = cfg.hatColor || '#e63946'; P(0, 0.5, -0.02); mb.sphere(0.8, 3, c, { sy: 0.52, sz: 0.96 }); Q(); mb.push(M4.chain(M4.T(0, 0.45, 0.7), M4.RX(0.12))); mb.rbox(0.9, 0.06, 0.55, 0.03, shade(c, 0.85)); mb.pop(); cfg = { ...cfg, hat: undefined }; }
  if (st === 'cap' || cfg.hat === 'cap') { if (st === 'cap') { P(0, 0.05, -0.6); mb.rbox(1.42, 0.62, 0.3, 0.1, hc); Q(); } P(0, 0.58, 0); mb.rbox(1.48, 0.52, 1.48, 0.24, cfg.hatColor); Q(); P(0, 0.4, 0.95); mb.rbox(1.3, 0.1, 0.8, 0.04, shade(cfg.hatColor, 0.85)); Q(); P(0, 0.86, 0); mb.sphere(0.1, 1, shade(cfg.hatColor, 0.8)); Q(); if (cfg.hatLogo !== false) { P(0, 0.62, 0.75); mb.box(0.36, 0.28, 0.02, '#ffffff'); Q(); } }
  if (st === 'beanie') { P(0, 0.5, 0); mb.rbox(1.5, 0.78, 1.5, 0.32, cfg.hatColor); Q(); P(0, 0.2, 0); mb.rbox(1.54, 0.22, 1.54, 0.1, shade(cfg.hatColor, 0.82)); Q(); P(0, 1.0, 0); mb.sphere(0.25, 1, '#ffffff'); Q(); }
  const hat = cfg.hat, hcol = cfg.hatColor;
  if (hat === 'crown') { P(0, 0.66, 0); mb.cyl(0.62, 0.62, 0.35, 10, GOLD, { flat: true }); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; mb.push(M4.T(Math.sin(a) * 0.55, 0.35, Math.cos(a) * 0.55)); mb.cyl(0.14, 0, 0.35, 4, GOLD); mb.push(M4.T(0, 0.38, 0)); mb.sphere(0.07, 0, '#ffffff'); mb.pop(); mb.pop(); } for (let i = 0; i < 5; i++) { const a = (i + 0.5) / 5 * Math.PI * 2; T_(mb, Math.sin(a) * 0.63, 0.17, Math.cos(a) * 0.63, () => mb.sphere(0.08, 1, ['#e63946', '#1e88e5', '#2a9d8f'][i % 3])); } Q(); }
  if (hat === 'tophat') { P(0, 0.66, 0); mb.cyl(0.95, 0.95, 0.08, 16, '#1b1b1b', { flat: false }); mb.cyl(0.6, 0.6, 1.0, 16, '#1b1b1b', { flat: false }); mb.push(M4.T(0, 0.12, 0)); mb.cyl(0.62, 0.62, 0.18, 16, '#c0392b', { flat: false }); mb.pop(); Q(); }
  if (hat === 'party') { P(0, 0.66, 0); mb.cyl(0.5, 0, 1.2, 12, hcol, { stripe: '#ffd23f' }); mb.push(M4.T(0, 1.2, 0)); mb.sphere(0.16, 1, '#ffffff'); mb.pop(); Q(); }
  if (hat === 'chef') { P(0, 0.66, 0); mb.cyl(0.6, 0.6, 0.5, 14, '#ffffff', { flat: false }); mb.push(M4.T(0, 0.75, 0)); mb.sphere(0.72, 2, '#ffffff', { sy: 0.6 }); mb.pop(); Q(); }
  if (hat === 'helmet') { P(0, 0.2, 0); mb.sphere(0.95, 2, hcol, { sy: 0.8 }); Q(); P(0, 0.2, 0.6); mb.box(1.1, 0.35, 0.3, '#9fd7ff'); Q(); }
  if (hat === 'hardhat') { P(0, 0.42, 0); mb.sphere(0.86, 2, hcol || '#ffc300', { sy: 0.62 }); mb.cyl(0.98, 0.98, 0.08, 18, hcol || '#ffc300', { flat: false }); T_(mb, 0, 0.45, 0, () => mb.box(0.18, 0.12, 1.5, shade(hcol || '#ffc300', 0.85))); Q(); }
  if (hat === 'cowboy') { P(0, 0.62, 0); mb.cyl(1.3, 1.3, 0.07, 20, hcol, { flat: false }); for (const s of [-1, 1]) T_(mb, s * 1.05, 0.12, 0, () => { mb.push(M4.RZ(s * 0.5)); mb.box(0.5, 0.07, 1.6, hcol); mb.pop(); }); mb.cyl(0.66, 0.56, 0.8, 14, hcol, { flat: false }); T_(mb, 0, 0.08, 0, () => mb.cyl(0.67, 0.65, 0.16, 14, '#3b2a1a', { flat: false })); Q(); }
  if (hat === 'beret') { mb.push(M4.chain(M4.T(0.12, 0.7, 0), M4.RZ(-0.25))); mb.sphere(0.88, 2, hcol, { sy: 0.32 }); T_(mb, 0, 0.28, 0, () => mb.cyl(0.05, 0.03, 0.15, 6, hcol)); mb.pop(); }
  if (hat === 'wizard') { P(0, 0.62, 0); mb.cyl(1.25, 1.25, 0.08, 18, hcol, { flat: false }); mb.push(M4.RZ(-0.12)); mb.cyl(0.72, 0.05, 2.1, 14, hcol, { flat: false }); for (let i = 0; i < 4; i++) T_(mb, Math.sin(i * 2) * 0.4, 0.4 + i * 0.35, 0.42 - i * 0.09, () => mb.sphere(0.08, 0, '#ffd23f')); mb.pop(); Q(); }
  if (hat === 'santa') { P(0, 0.62, 0); mb.cyl(0.78, 0.78, 0.28, 16, '#ffffff', { flat: false }); mb.push(M4.chain(M4.T(0, 0.25, 0), M4.RZ(0.5))); mb.cyl(0.66, 0.12, 1.3, 12, '#e63946', { flat: false }); T_(mb, 0, 1.35, 0, () => mb.sphere(0.2, 1, '#ffffff')); mb.pop(); Q(); }
  if (hat === 'viking') { P(0, 0.25, 0); mb.sphere(0.9, 2, '#9aa3ad', { sy: 0.85 }); mb.cyl(0.92, 0.92, 0.15, 16, '#7a5a2a', { flat: false }); for (const s of [-1, 1]) { mb.push(M4.chain(M4.T(s * 0.75, 0.35, 0), M4.RZ(-s * 1.0))); mb.cyl(0.18, 0.02, 0.9, 8, '#fff3d6', { flat: false }); mb.pop(); } Q(); }
  if (hat === 'grad') { P(0, 0.62, 0); mb.cyl(0.66, 0.66, 0.35, 12, '#1b1b1b', { flat: false }); T_(mb, 0, 0.4, 0, () => { mb.push(M4.RY(Math.PI / 4)); mb.box(1.7, 0.08, 1.7, '#1b1b1b'); mb.pop(); T_(mb, 0, 0.06, 0, () => mb.sphere(0.07, 0, GOLD)); T_(mb, 0.7, -0.28, 0.0, () => mb.box(0.05, 0.6, 0.05, GOLD)); }); Q(); }
  if (hat === 'bunny') { for (const s of [-1, 1]) { mb.push(M4.chain(M4.T(s * 0.35, 0.75, -0.1), M4.RZ(-s * 0.18))); T_(mb, 0, 0.6, 0, () => { mb.rbox(0.32, 1.2, 0.16, 0.12, hcol || '#ffffff'); T_(mb, 0, 0, 0.06, () => mb.rbox(0.18, 0.95, 0.08, 0.06, '#ffb3c6')); }); mb.pop(); } }
  if (hat === 'bandana') { P(0, 0.42, 0); mb.rbox(1.45, 0.42, 1.45, 0.18, hcol); T_(mb, 0, -0.05, -0.8, () => { mb.push(M4.RX(0.6)); mb.rbox(0.3, 0.5, 0.12, 0.05, hcol); mb.pop(); }); Q(); }
  if (cfg.headband) { P(0, 0.36, 0); mb.rbox(1.4, 0.18, 1.4, 0.08, cfg.headband === true ? '#e63946' : cfg.headband); Q(); }
  if (MIIH) mb.pop();
  if (cfg.headphones) { const c = cfg.headphones === true ? '#2b2d42' : cfg.headphones; for (let i = 0; i <= 8; i++) { const a = (i / 8 - 0.5) * Math.PI; T_(mb, Math.sin(a) * 0.78, 0.15 + Math.cos(a) * 0.62, -0.05, () => mb.box(0.2, 0.2, 0.22, c)); } for (const s of [-1, 1]) T_(mb, s * 0.72, 0.0, 0, () => { mb.push(M4.RZ(Math.PI / 2)); mb.cyl(0.32, 0.32, 0.22, 14, c, { flat: false }); mb.pop(); T_(mb, s * 0.12, 0, 0, () => { mb.push(M4.RZ(Math.PI / 2)); mb.cyl(0.2, 0.2, 0.04, 12, '#e63946'); mb.pop(); }); }); }
  if (cfg.bow) { const c = cfg.bow === true ? '#ff4f8b' : cfg.bow; P(0.35, 0.72, 0.2); for (const s of [-1, 1]) { mb.push(M4.chain(M4.T(s * 0.2, 0, 0), M4.RZ(s * 0.35))); mb.rbox(0.36, 0.3, 0.14, 0.1, c); mb.pop(); } mb.sphere(0.09, 1, shade(c, 0.85)); Q(); }
  if (cfg.flower) { P(-0.55, 0.55, 0.35); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; T_(mb, Math.sin(a) * 0.14, Math.cos(a) * 0.14, 0, () => mb.sphere(0.11, 0, cfg.flower === true ? '#ff7eb6' : cfg.flower)); } mb.sphere(0.08, 0, '#ffd23f'); Q(); }
  if (cfg.earrings) for (const s of [-1, 1]) T_(mb, s * 0.68, -0.28, 0.05, () => mb.sphere(0.07, 1, cfg.earrings === true ? GOLD : cfg.earrings));
  if (cfg.shades && MIIH) { const fk = cfg.facekit || {}, eyy = 0.08 - (+fk.ey || 0) * 0.005; P(0, eyy, 0.63); mb.rbox(0.72, 0.2, 0.06, 0.05, '#121212'); Q(); for (const s of [-1, 1]) T_(mb, s * 0.17, eyy + 0.04, 0.665, () => mb.box(0.14, 0.03, 0.01, '#4a5568')); }
  else if (cfg.shades) { P(0, 0.08, 0.7); mb.rbox(1.3, 0.34, 0.12, 0.06, '#121212'); Q(); for (const s of [-1, 1]) T_(mb, s * 0.3, 0.14, 0.77, () => mb.box(0.22, 0.05, 0.01, '#4a5568')); }
  if (cfg.glasses && MIIH) { const gc = cfg.glassesColor || '#2b2b2b', fk = cfg.facekit || {}, ex = 0.155 + (+fk.edx || 0) * 0.004, eyy = 0.08 - (+fk.ey || 0) * 0.005; for (const s of [-1, 1]) { const cx = s * ex; P(cx, eyy + 0.1, 0.63); mb.box(0.27, 0.035, 0.035, gc); Q(); P(cx, eyy - 0.09, 0.63); mb.box(0.27, 0.035, 0.035, gc); Q(); P(cx - 0.135, eyy, 0.63); mb.box(0.035, 0.22, 0.035, gc); Q(); P(cx + 0.135, eyy, 0.63); mb.box(0.035, 0.22, 0.035, gc); Q(); mb.push(M4.chain(M4.T(s * 0.29, eyy + 0.08, 0.57), M4.RY(s * 0.9))); mb.box(0.03, 0.03, 0.12, gc); mb.pop(); } P(0, eyy + 0.05, 0.64); mb.box(0.06, 0.03, 0.03, gc); Q(); }
  else if (cfg.glasses) { const gc = cfg.glassesColor || '#2b2b2b'; for (const s of [-1, 1]) { const cx = s * 0.22; P(cx, 0.26, 0.69); mb.box(0.4, 0.05, 0.05, gc); Q(); P(cx, -0.05, 0.69); mb.box(0.4, 0.05, 0.05, gc); Q(); P(cx - 0.18, 0.105, 0.69); mb.box(0.05, 0.36, 0.05, gc); Q(); P(cx + 0.18, 0.105, 0.69); mb.box(0.05, 0.36, 0.05, gc); Q(); P(s * 0.62, 0.2, 0.36); mb.box(0.05, 0.05, 0.66, gc); Q(); } P(0, 0.2, 0.69); mb.box(0.1, 0.05, 0.05, gc); Q(); }
  if (cfg.eyepatch) { P(0.22, 0.1, 0.68); mb.rbox(0.36, 0.34, 0.06, 0.08, '#111111'); Q(); mb.push(M4.chain(M4.T(0, 0.22, 0.66), M4.RZ(-0.45))); mb.box(1.5, 0.05, 0.03, '#111111'); mb.pop(); }
  if (cfg.beard && !MIIH) { if (MIIH) { const bc = shade(hc, 0.8); P(0, -0.56, 0.36); mb.sphere(0.34, 2, bc, { sy: 0.36, sz: 0.42 }); Q(); for (const s of [-1, 1]) { mb.push(M4.chain(M4.T(s * 0.42, -0.36, 0.36), M4.RZ(s * 0.5))); mb.sphere(0.14, 2, bc, { sy: 1.6, sz: 0.6 }); mb.pop(); } } else { P(0, -0.42, 0.56); mb.rbox(1.34, 0.5, 0.32, 0.14, hc); Q(); P(0, -0.08, 0.69); mb.rbox(0.64, 0.14, 0.12, 0.05, hc); Q(); } }
  if (cfg.mustache && !MIIH) { if (MIIH) { for (const s of [-1, 1]) { mb.push(M4.chain(M4.T(s * 0.09, -0.19, 0.58), M4.RZ(s * 0.3))); mb.sphere(0.1, 2, shade(hc, 0.8), { sy: 0.4, sz: 0.45 }); mb.pop(); } } else { P(0, -0.08, 0.69); mb.rbox(0.66, 0.16, 0.12, 0.05, hc); Q(); } }
  if (cfg.facemask) { const mc = cfg.facemask === true ? '#cfe8f7' : cfg.facemask; P(0, -0.3, 0.68); mb.rbox(1.02, 0.52, 0.12, 0.08, mc); Q(); for (const k of [-0.14, 0.0, 0.14]) { P(0, -0.3 + k, 0.745); mb.box(0.9, 0.025, 0.01, shade(mc, 0.85)); Q(); } for (const s of [-1, 1]) { P(s * 0.62, -0.12, 0.42); mb.box(0.04, 0.04, 0.6, '#f4f4f4'); Q(); } }
  if (cfg.scar) { P(0.2, -0.56, 0.705); mb.push(M4.RZ(0.9)); mb.rbox(0.05, 0.24, 0.03, 0.015, cfg.scarColor || '#e0a092'); for (const k of [-0.07, 0.0, 0.07]) { mb.push(M4.T(0, k, 0.005)); mb.box(0.13, 0.025, 0.03, cfg.scarColor || '#d4887a'); mb.pop(); } mb.pop(); Q(); }
}
function shirtTex(cfg) {
  const pat = cfg.pattern, pc = cfg.patternColor || '#ffffff';
  if (!pat && (!cfg.logo || cfg.logo === 'none')) return null;
  return ctex(`shirt|${cfg.logo}|${cfg.logoColor}|${cfg.logoBg}|${pat}|${pc}|${cfg.shirt}`, 256, 256, x => {
    if (pat) {
      x.fillStyle = cfg.shirt; x.fillRect(0, 0, 256, 256); x.fillStyle = pc;
      if (pat === 'stripes') for (let y = 8; y < 256; y += 40) x.fillRect(0, y, 256, 16);
      if (pat === 'knit') for (let y = 4; y < 256; y += 22) x.fillRect(0, y, 256, 9); // feine Strickstreifen
      if (pat === 'dots') for (let y = 16; y < 256; y += 38) for (let xx = (y / 38 % 2) * 19 + 12; xx < 256; xx += 38) { ell(x, xx, y, 7, 7); x.fill(); }
      if (pat === 'plaid') { x.globalAlpha = 0.35; for (let i = 0; i < 256; i += 48) { x.fillRect(i, 0, 18, 256); x.fillRect(0, i, 256, 18); } x.globalAlpha = 1; }
      if (pat === 'split') x.fillRect(128, 0, 128, 256);
    }
    if (cfg.logo && cfg.logo !== 'none') { const lt = logoTexDraw(cfg.logo, cfg.logoColor, cfg.logoBg); lt(x); }
  });
}
function MB_(cfg) { return { slim: { w: 0.86, t: 0.88 }, average: { w: 1, t: 1 }, athletic: { w: 1.12, t: 1.02 }, stocky: { w: 1.14, t: 1.16 }, chubby: { w: 1.12, t: 1.34 } }[cfg.build] || { w: 1, t: 1 }; }   // Körperbau: w Schulter/Hüfte, t Bauch
function miiHeadShape(f) {
  // Kopfformen (eigene Formen): Halbachsen + Verformung (Kiefer breiter/schmaler, Stirn, eckiger)
  const S = { egg: [0.66, 0.8, 0.64, 0.08, -0.05, 0], round: [0.7, 0.74, 0.66, 0.03, 0, 0], oval: [0.62, 0.82, 0.62, 0.02, -0.02, 0], square: [0.68, 0.76, 0.64, 0.1, 0.02, 0.16],
    wide: [0.76, 0.72, 0.66, 0.08, 0, 0.04], long: [0.6, 0.88, 0.62, 0.04, -0.04, 0.04], heart: [0.68, 0.78, 0.64, -0.16, 0.06, 0], pear: [0.66, 0.78, 0.66, 0.2, -0.08, 0.02], bean: [0.64, 0.8, 0.62, 0.05, -0.03, 0.08] };
  const [sx, sy, sz, jaw, brow, sq] = S[f] || S[{ round: 'round' }[f] || 'egg'];
  const warp = p => { const yn = p[1] / sy, k = yn < 0 ? 1 + jaw * Math.min(1, -yn * 1.6) * (1 - Math.max(0, -yn - 0.75) * 2.2) : 1 + brow * yn;
    let x = p[0] * k, z = p[2] * (yn < 0 ? 1 + jaw * 0.3 * Math.min(1, -yn) : 1);
    if (sq) { const r = Math.hypot(x / sx, z / sz); if (r > 1e-6) { const c = 1 + sq * (1 - Math.abs(yn)) * Math.pow(Math.abs(Math.sin(2 * Math.atan2(z / sz, x / sx))), 2) * 0.5; x *= c; z *= c; } }
    return [x, p[1], z]; };
  return { sx, sy, sz, warp, fx: sx / 0.66, fy: sy / 0.74, fz: sz / 0.64 };
}
function avatarGeo(cfg) {
  const k = JSON.stringify(cfg); if (AVC[k] !== undefined) return AVC[k];
  // Materialien der Figur: Kleidung = Stoff/Jeans/Strick, Haare = Strähnen, Haut/Schuhe ohne
  const prevMap = MAT.map; MAT.map = new Map();
  { const cl = c => c && typeof c === 'string' ? matKey(col(c)) : null, put = (c, id) => { const kk = cl(c); if (kk && cfg.skin !== c) MAT.map.set(kk, id); };
    const isBlue = c => { const q = col(c); return q[2] > q[0] * 1.15 && q[2] > 0.25; };
    put(cfg.shirt, cfg.pattern === 'knit' ? 7 : 5); put(cfg.sleeveColor, 5); put(cfg.jacket, 5); put(cfg.vest, 5); put(cfg.hoodie === true ? cfg.shirt : cfg.hoodie, 5);
    if (cfg.pants) put(cfg.pants, isBlue(cfg.pants) ? 6 : 5); put(cfg.hairColor, 11); put(cfg.scarf, 7); }
  const g = {}, sk = cfg.skin, sh = cfg.shirt, sleeve = cfg.jacket || cfg.sleeveColor || sh, MII = cfg.style === 'mii', RL = MII ? 0.4 : 0;  // Mii Town: runde, weiche Formen
  const gk = cfg.gloves ? (cfg.gloves === true ? '#ffffff' : cfg.gloves) : sk; // Handschuhe färben die Hände
  const hand = MII ? ((mb, y) => { T_(mb, 0, y + 0.02, 0, () => mb.sphere(0.5, 2, gk, { sy: 0.95 })); T_(mb, 0, y + 0.08, 0.36, () => mb.sphere(0.2, 1, shade(gk, 0.96))); }) : (mb, y) => { T_(mb, 0, y + 0.04, 0, () => mb.rbox(0.84, 0.4, 0.84, 0.16, gk)); for (let i = 0; i < 4; i++) T_(mb, -0.3 + i * 0.2, y - 0.2, 0.04, () => mb.rbox(0.18, 0.24, 0.62, 0.08, i % 2 ? shade(gk, 0.96) : gk)); T_(mb, 0, y + 0.02, 0.38, () => mb.rbox(0.26, 0.32, 0.2, 0.1, shade(gk, 0.95))); if (cfg.gloves) T_(mb, 0, y + 0.3, 0, () => mb.rbox(0.96, 0.22, 0.96, 0.08, shade(gk, 0.9))); };
  if (MII) {   // Kopfform: round | oval | square | wide | long (eigener Stil, keine Nintendo-Assets)
    // Neues Mii-Town-Design (Lukas 26.11., nach seinem 3D-Modell): großer Eierkopf, Gesicht vorne aufprojiziert, Kopfform per Verformung
    const HS = miiHeadShape(cfg.face);
    g.head = cgeo('miihead3|' + sk + '|' + (cfg.face || 'egg'), mb => mb.sphere(1, 4, sk, { sx: HS.sx, sy: HS.sy, sz: HS.sz, uvFront: true, warp: HS.warp }));
    g.hs = HS;
    const NS = { button: [0.08, 0.065], round: [0.1, 0.085], long: [0.07, 0.12], wide: [0.12, 0.07], small: [0.06, 0.055], pointy: [0.065, 0.09], big: [0.13, 0.11] }[cfg.nose || 'button'] || [0.08, 0.065];
    g.nose = cgeo('miinose3|' + sk + '|' + (cfg.nose || 'button'), mb => { mb.sphere(NS[0], 2, shade(sk, 0.93), { sy: NS[1] / NS[0] * 1.15, sz: 1.1 }); if (cfg.nose === 'pointy' || cfg.nose === 'long') T_(mb, 0, -NS[1] * 0.3, NS[0] * 0.6, () => mb.sphere(NS[0] * 0.7, 2, shade(sk, 0.93))); });
    const ER = { normal: 0.11, small: 0.085, big: 0.14 }[cfg.ears || 'normal'] || 0.11;
    g.ear = cgeo('miiear|' + sk + '|' + ER, mb => mb.sphere(ER, 1, shade(sk, 0.94), { sx: 0.55 }));
  } else g.head = cgeo('head2|' + sk, mb => mb.rbox(1.32, 1.32, 1.32, 0.38, sk, { uv: true }));
  // Torso + Accessoires am Oberkörper
  g.torso = cgeo('torso2|' + JSON.stringify([MII ? 'm3' + (cfg.build || '') : '', sh, cfg.crop, cfg.belt, cfg.tie, cfg.bowtie, cfg.chain, cfg.backpack, cfg.scarf, cfg.jacket, cfg.vest, cfg.hoodie, cfg.apron, cfg.badge, cfg.sash, cfg.collar, cfg.buttons]), mb => {
    const ch = cfg.crop ? (cfg.crop === true ? 0.44 : +cfg.crop) : 0;
    if (ch) {  // bauchfreies Crop-Top: kürzeres Oberteil, schmalere Taille mit Hautton, Saum, Bauchnabel, leichte Schattierung
      T_(mb, 0, ch / 2, 0, () => mb.rbox(2, 2 - ch, 1, 0.16, sh, { uv: true }));
      T_(mb, 0, -1 + ch + 0.03, 0, () => mb.rbox(2.02, 0.1, 1.02, 0.05, shade(sh, 0.94)));               // Saum
      T_(mb, 0, -1 + (ch + 0.08) / 2, 0, () => mb.rbox(1.84, ch + 0.08, 0.88, 0.2, sk));                  // Taille (schmaler)
      T_(mb, 0, -1 + ch - 0.02, 0, () => mb.rbox(1.9, 0.06, 0.93, 0.03, shade(sk, 0.86)));                // Schatten unter dem Saum
      T_(mb, 0, -1 + ch * 0.42, 0.44, () => mb.sphere(0.045, 1, shade(sk, 0.62), { sz: 0.35, sy: 1.4 }));   // Bauchnabel
    } else {
      if (MII) {   // Mii: schmale Schultern, nach unten weiter (Glocke), keine Ecken
        const jc = cfg.jacket || cfg.vest || sh;   // Mii: offene Jacke/Weste = Körper in Jackenfarbe, vorne Streifen Shirt
        const bw = MB_(cfg), r0 = 0.6 * bw.w * Math.sqrt(bw.t), r1 = 0.5 * bw.w, zq = 0.8 * Math.sqrt(bw.t); mb.push(M4.S(1, 1, zq)); T_(mb, 0, -0.66, 0, () => mb.cyl(r0, r1, 1.5, 32, jc, { flat: false, cap: false })); T_(mb, 0, 0.84, 0, () => mb.sphere(r1, 3, jc, { sy: 0.36 })); mb.pop();
        if (jc !== sh) { const zf = r1 * zq + 0.02; mb.push(M4.chain(M4.T(0, 0.08, zf), M4.RX(-0.05))); mb.rbox(0.34, 1.45, 0.06, 0.03, sh); mb.pop(); for (const s of [-1, 1]) { mb.push(M4.chain(M4.T(s * 0.21, 0.08, zf + 0.01), M4.RX(-0.05))); mb.box(0.05, 1.45, 0.05, shade(jc, 0.8)); mb.pop(); } if (cfg.tie) { mb.push(M4.T(0, 0.3, zf + 0.04)); mb.rbox(0.12, 0.9, 0.04, 0.02, cfg.tie === true ? '#c0392b' : cfg.tie); mb.pop(); } }
      } else { mb.rbox(2, 2, 1, 0.16, sh, { uv: true });
      T_(mb, 0, -0.9, 0, () => mb.rbox(2.03, 0.2, 1.03, 0.08, shade(sh, 0.9))); }          // Saum
    }
    if (cfg.collar !== false && !cfg.hoodie && !MII) T_(mb, 0, 0.97, 0.1, () => mb.rbox(0.9, 0.1, 0.62, 0.05, shade(sh, 0.88)));
    if (cfg.buttons) for (let i = 0; i < 4; i++) T_(mb, 0, 0.7 - i * 0.45, 0.51, () => mb.sphere(0.06, 0, shade(sh, 0.7)));
    if (cfg.belt) { T_(mb, 0, -0.86, 0, () => mb.rbox(2.05, 0.22, 1.05, 0.05, cfg.belt)); T_(mb, 0, -0.86, 0.53, () => mb.box(0.32, 0.2, 0.04, GOLD)); }
    if ((cfg.jacket || cfg.vest) && !MII) { const c = cfg.jacket || cfg.vest, d = shade(c, 0.85); T_(mb, 0, 0, -0.53, () => mb.box(2.1, 2.06, 0.1, c)); for (const s of [-1, 1]) { T_(mb, s * 1.03, 0, 0, () => mb.box(0.1, 2.06, 1.1, c)); T_(mb, s * 0.68, 0.72, 0.53, () => mb.box(0.72, 0.62, 0.08, c)); } if (cfg.jacket) T_(mb, 0, 1.0, -0.35, () => mb.rbox(1.4, 0.24, 0.45, 0.08, d)); }
    if (cfg.hoodie) { const c = cfg.hoodie === true ? shade(sh, 0.92) : cfg.hoodie; T_(mb, 0, 1.12, MII ? -0.34 : -0.38, () => MII ? mb.sphere(0.55, 2, c, { sy: 0.5, sz: 0.6 }) : mb.rbox(1.5, 0.6, 0.62, 0.25, c)); if (!MII) T_(mb, 0, -0.35, 0.52, () => mb.rbox(1.2, 0.55, 0.08, 0.06, shade(c, 0.9))); }   // Mii: keine eckige Bauchtasche (Lukas 26.11.)
    if (cfg.bowtie) { const c = cfg.bowtie === true ? '#c0392b' : cfg.bowtie; for (const s of [-1, 1]) TR_(mb, M4.chain(M4.T(s * 0.2, 0.86, 0.56), M4.RZ(s * 0.3)), () => mb.rbox(0.32, 0.26, 0.1, 0.08, c)); T_(mb, 0, 0.86, 0.6, () => mb.rbox(0.13, 0.15, 0.1, 0.04, shade(c, 0.8))); }
    if (cfg.chain) { const c = cfg.chain === true ? GOLD : cfg.chain; for (let i = 0; i <= 14; i++) { const t = i / 7 - 1; T_(mb, 0.5 * t, 0.98 - 0.5 * (1 - t * t), 0.53, () => mb.sphere(0.05, 0, c)); } T_(mb, 0, 0.4, 0.55, () => { mb.push(M4.RX(Math.PI / 2)); mb.cyl(0.16, 0.16, 0.05, 12, c); mb.pop(); }); }
    if (cfg.apron) { const c = cfg.apron === true ? '#ffffff' : cfg.apron; if (MII) { mb.push(M4.chain(M4.T(0, -0.2, 0.44), M4.RX(-0.06))); mb.rbox(0.82, 1.5, 0.05, 0.03, c); mb.pop(); for (const s of [-1, 1]) T_(mb, s * 0.22, 0.75, 0.25, () => mb.box(0.07, 0.07, 0.4, c)); } else { T_(mb, 0, -0.15, 0.53, () => mb.box(1.5, 1.8, 0.04, c)); T_(mb, 0, -0.45, 0.56, () => mb.box(0.7, 0.4, 0.02, shade(c, 0.92))); for (const s of [-1, 1]) T_(mb, s * 0.55, 0.85, 0.3, () => mb.box(0.1, 0.1, 0.5, c)); } }
    if (cfg.sash) TR_(mb, M4.chain(M4.T(0, 0.05, 0), M4.RZ(-0.75)), () => mb.box(2.8, 0.36, 1.07, cfg.sash === true ? '#e63946' : cfg.sash));
    if (cfg.badge) T_(mb, -0.55, 0.45, 0.53, () => { mb.push(M4.RX(Math.PI / 2)); mb.cyl(0.2, 0.2, 0.05, 6, GOLD); mb.pop(); });
    if (cfg.scarf) { const c = cfg.scarf === true ? '#e63946' : cfg.scarf; if (MII) T_(mb, 0, 0.9, 0, () => mb.sphere(0.56, 2, c, { sy: 0.3, sz: 0.82 })); else T_(mb, 0, 0.98, 0, () => mb.rbox(1.7, 0.36, 1.18, 0.16, c)); }
    if (cfg.backpack) { const c = cfg.backpack === true ? '#e63946' : cfg.backpack; if (MII) { for (const s of [-1, 1]) { T_(mb, s * 0.27, 0.86, 0, () => mb.box(0.14, 0.08, 0.86, shade(c, 0.75))); mb.push(M4.chain(M4.T(s * 0.27, 0.3, 0.37), M4.RX(-0.12))); mb.box(0.14, 1.1, 0.04, shade(c, 0.75)); mb.pop(); } } else for (const s of [-1, 1]) { T_(mb, s * 0.55, 1.02, -0.05, () => mb.box(0.24, 0.08, 1.12, shade(c, 0.75))); T_(mb, s * 0.55, 0.32, 0.525, () => mb.box(0.24, 1.35, 0.05, shade(c, 0.75))); } }
  });
  g.tex = MII ? null : shirtTex(cfg);   // Mii: einfarbiges Oberteil
  // Arme: Oberarm (Schulter) + Unterarm (Ellbogen bei y=-0.95)
  const shortS = cfg.sleeves === 'short' && !cfg.jacket, noS = cfg.sleeves === 'skin' || cfg.sleeves === 'none';
  g.uarm = cgeo(`uarm|${sleeve}|${sk}|${cfg.sleeves}|${!!cfg.jacket}|${MII ? 1 : 0}`, mb => {
    if (MII) { const c = noS ? sk : sleeve; T_(mb, 0, -1.0, 0, () => mb.cyl(0.14, 0.15, 1.0, 16, c, { flat: false, cap: false })); T_(mb, 0, 0, 0, () => mb.sphere(0.155, 2, c)); if (shortS) T_(mb, 0, -0.75, 0, () => mb.cyl(0.13, 0.13, 0.75, 14, sk, { flat: false, cap: false })); return; }
    if (noS) T_(mb, 0, -0.47, 0, () => mb.rbox(0.92, 1.02, 0.92, 0.14, sk));
    else if (shortS) { T_(mb, 0, -0.3, 0, () => mb.rbox(1.0, 0.72, 1.0, 0.13, sleeve)); T_(mb, 0, -0.75, 0, () => mb.rbox(0.88, 0.5, 0.88, 0.12, sk)); }
    else T_(mb, 0, -0.47, 0, () => mb.rbox(0.96, 1.04, 0.96, MII ? 0.42 : 0.13, sleeve));
  });
  const larm = watch => mb => {
    if (MII) { const c = (noS || shortS) ? sk : sleeve; T_(mb, 0, -0.74, 0, () => mb.cyl(0.13, 0.14, 0.8, 16, c, { flat: false, cap: false })); T_(mb, 0, 0.02, 0, () => mb.sphere(0.145, 2, c)); T_(mb, 0, -0.82, 0, () => mb.sphere(0.26, 3, gk)); if (watch) T_(mb, 0, -0.6, 0, () => mb.cyl(0.15, 0.15, 0.1, 14, '#2b2b2b')); return; }
    if (noS || shortS) T_(mb, 0, -0.26, 0, () => mb.rbox(0.86, 0.6, 0.86, 0.12, sk));
    else { T_(mb, 0, -0.25, 0, () => mb.rbox(0.94, 0.56, 0.94, MII ? 0.4 : 0.12, sleeve)); T_(mb, 0, -0.5, 0, () => mb.rbox(0.98, 0.14, 0.98, 0.05, shade(sleeve, 0.85))); }
    hand(mb, -0.78);
    if (watch) { T_(mb, 0, -0.52, 0, () => mb.rbox(0.92, 0.16, 0.92, 0.04, '#2b2b2b')); T_(mb, 0, -0.52, 0.47, () => mb.box(0.3, 0.26, 0.04, watch === true ? '#cfd8dc' : watch)); }
  };
  g.larmL = cgeo(`larm|${sleeve}|${sk}|${cfg.gloves || ''}|${cfg.sleeves}|${!!cfg.jacket}|${cfg.watch || ''}|${MII ? 1 : 0}`, larm(cfg.watch));
  g.larmR = cgeo(`larm|${sleeve}|${sk}|${cfg.gloves || ''}|${cfg.sleeves}|${!!cfg.jacket}||${MII ? 1 : 0}`, larm(false));
  // Beine: Oberschenkel (Hüfte) + Unterschenkel mit Schuh (Knie bei y=-1.0)
  const shorts = cfg.shorts;
  g.thigh = cgeo(`thigh|${cfg.pants}|${sk}|${shorts ? 1 : 0}|${MII ? 1 : 0}`, mb => { if (MII) { T_(mb, 0, -1.04, 0, () => mb.cyl(0.19, 0.2, 1.04, 16, shorts ? sk : cfg.pants, { flat: false, cap: false })); T_(mb, 0, 0, 0, () => mb.sphere(0.2, 2, cfg.pants)); if (shorts) T_(mb, 0, -0.45, 0, () => mb.cyl(0.24, 0.23, 0.45, 16, cfg.pants, { flat: false })); return; } T_(mb, 0, -0.5, 0, () => mb.rbox(0.98, 1.06, 0.98, 0.1, cfg.pants)); if (shorts) T_(mb, 0, -0.98, 0, () => mb.rbox(0.9, 0.2, 0.9, 0.08, sk)); });
  g.shin = cgeo(`shin|${cfg.pants}|${cfg.shoes}|${cfg.sole}|${sk}|${shorts ? 1 : 0}|${cfg.boots ? 1 : 0}|${cfg.flare ? 1 : 0}|${MII ? 1 : 0}`, mb => {
    if (MII) { const c = shorts ? sk : cfg.pants; T_(mb, 0, -0.72, 0, () => mb.cyl(0.18, 0.19, 0.74, 16, c, { flat: false, cap: false })); T_(mb, 0, 0.02, 0, () => mb.sphere(0.19, 2, c)); T_(mb, 0, -0.84, 0.1, () => mb.rbox(0.42, 0.26, 0.66, 0.13, cfg.shoes)); return; }
    T_(mb, 0, -0.3, 0, () => mb.rbox(shorts ? 0.86 : 0.96, 0.64, shorts ? 0.86 : 0.96, 0.1, shorts ? sk : cfg.pants));
    if (cfg.flare && !shorts) T_(mb, 0, -0.6, 0.02, () => mb.rbox(1.22, 0.34, 1.26, 0.1, cfg.pants)); // Schlaghose
    if (cfg.boots) T_(mb, 0, -0.45, 0, () => mb.rbox(1.0, 0.5, 1.0, 0.1, cfg.shoes));
    T_(mb, 0, -0.77, 0.08, () => mb.rbox(1.02, 0.4, 1.16, MII ? 0.19 : 0.15, cfg.shoes));
    T_(mb, 0, -0.93, 0.08, () => mb.rbox(1.06, 0.12, 1.2, 0.05, cfg.sole || '#f2f2f2'));
    if (!cfg.boots) T_(mb, 0, -0.56, 0.42, () => mb.box(0.4, 0.04, 0.3, '#ffffff'));
  });
  if (cfg.skirt) g.skirt = cgeo(`skirt2|${cfg.skirt}`, mb => { mb.push(M4.T(0, -1.1, 0)); mb.cyl(1.38, 1.04, 1.1, 14, cfg.skirt, { flat: false }); mb.pop(); T_(mb, 0, -1.08, 0, () => mb.cyl(1.4, 1.4, 0.08, 14, shade(cfg.skirt, 0.8), { flat: false })); });
  const hk = 'hair3|' + JSON.stringify([cfg.style || '', cfg.hair, cfg.hairColor, cfg.hat, cfg.hatColor, cfg.glasses, cfg.shades, cfg.beard, cfg.mustache, cfg.facemask, cfg.headphones, cfg.bow, cfg.flower, cfg.earrings, cfg.headband, cfg.eyepatch, cfg.hatLogo, cfg.glassesColor, cfg.scar]);
  g.hair = cgeo(hk, mb => hairGeo(mb, cfg));
  // bewegliche Teile (Sekundärbewegung)
  if (MII && cfg.hair === 'ponytail') g.tail = cgeo('mptail|' + cfg.hairColor, mb => { T_(mb, 0, 0, 0, () => mb.sphere(0.2, 2, '#ff6fa8')); T_(mb, 0, -0.6, -0.1, () => mb.sphere(0.34, 2, cfg.hairColor, { sy: 2.0 })); });
  else if (cfg.hair === 'ponytail') g.tail = cgeo('ptail|' + cfg.hairColor, mb => { T_(mb, 0, 0, 0, () => mb.rbox(0.36, 0.26, 0.36, 0.1, '#ff6fa8')); T_(mb, 0, -0.62, -0.08, () => mb.rbox(0.5, 1.2, 0.5, 0.2, cfg.hairColor)); T_(mb, 0, -1.25, -0.1, () => mb.rbox(0.36, 0.3, 0.36, 0.14, shade(cfg.hairColor, 0.88))); });
  if (MII && cfg.hair === 'pigtails') g.ptail = cgeo('mpig|' + cfg.hairColor, mb => { T_(mb, 0, 0, 0, () => mb.sphere(0.17, 2, '#ff6fa8')); T_(mb, 0, -0.5, 0, () => mb.sphere(0.3, 2, cfg.hairColor, { sy: 1.8 })); });
  else if (cfg.hair === 'pigtails') g.ptail = cgeo('pig|' + cfg.hairColor, mb => { T_(mb, 0, 0, 0, () => mb.rbox(0.3, 0.24, 0.3, 0.08, '#ff6fa8')); T_(mb, 0, -0.55, 0, () => mb.rbox(0.45, 1.05, 0.45, 0.2, cfg.hairColor)); });
  if (cfg.cape) { const c = cfg.cape === true ? '#c1121f' : cfg.cape; g.cape = cgeo('cape|' + c, mb => { const cc = col(c), ci = shade(c, 0.7); const A = [-1.05, 0, 0], B = [1.05, 0, 0], C = [1.5, -3.3, 0], D = [-1.5, -3.3, 0]; mb.quad(D, C, B, A, cc); mb.quad(A, B, C, D, ci); T_(mb, 0, 0.05, 0.05, () => mb.rbox(2.2, 0.22, 0.3, 0.1, shade(c, 0.85))); for (const s of [-1, 1]) T_(mb, s * 0.85, 0.02, 0.55, () => mb.sphere(0.13, 1, GOLD)); }); }
  if (cfg.wings) { const c = cfg.wings === true ? '#ffffff' : cfg.wings; g.wing = cgeo('wing|' + c, mb => { for (let i = 0; i < 4; i++) T_(mb, 0.45 + i * 0.35, 0.3 - i * 0.28, 0, () => mb.rbox(0.5, 1.4 - i * 0.22, 0.12, 0.06, shade(c, 1 - i * 0.04))); }); }
  if (cfg.hat === 'halo') g.halo = cgeo('halo', mb => { for (let i = 0; i < 20; i++) { const a = i / 20 * 6.28; T_(mb, Math.sin(a) * 0.7, 1.15, Math.cos(a) * 0.7, () => { mb.push(M4.RY(a)); mb.box(0.25, 0.1, 0.12, '#fff3a0'); mb.pop(); }); } });
  // Körper-Details: Hals, Becken, Schulter-/Ellbogen-/Kniekappen (schließen Lücken bei gebeugten Gelenken)
  g.neck = cgeo('neck|' + sk + (MII ? '|m' : ''), mb => T_(mb, 0, MII ? 0.0 : 0.1, 0, () => mb.cyl(MII ? 0.3 : 0.42, MII ? 0.3 : 0.46, MII ? 0.36 : 0.32, 12, shade(sk, 0.93), { flat: false })));
  g.pelvis = cgeo('pelvis|' + cfg.pants + (MII ? '|m3|' + (cfg.build || '') : ''), mb => T_(mb, 0, 2.0, 0, () => MII ? (T_(mb, 0, 0.14, 0, () => mb.sphere(0.64 * MB_(cfg).w * Math.sqrt(MB_(cfg).t), 3, cfg.pants, { sy: 0.62, sz: 0.82 * Math.sqrt(MB_(cfg).t) })), mb) : mb.rbox(1.98, 0.42, 0.98, 0.14, cfg.pants)));
  g.cap = cgeo('scap|' + (noS ? sk : sleeve) + (MII ? '|m' : ''), mb => mb.sphere(MII ? 0.16 : 0.5, 2, noS ? sk : sleeve));
  g.elbow = cgeo('elb|' + ((noS || shortS) ? sk : sleeve) + (MII ? '|m' : ''), mb => mb.sphere(MII ? 0.145 : 0.45, 2, (noS || shortS) ? sk : sleeve));
  g.knee = cgeo('knee|' + (shorts ? sk : cfg.pants) + (MII ? '|m' : ''), mb => mb.sphere(MII ? 0.2 : 0.48, 2, shorts ? sk : cfg.pants));
  // Kleidung mit Physik (hängt an Drehpunkten, wird von der Stoff-Simulation bewegt)
  if (cfg.tie) { const c = cfg.tie === true ? '#c0392b' : cfg.tie; g.tie = cgeo('tie|' + c, mb => { T_(mb, 0, 0.0, 0.01, () => mb.box(0.3, 0.22, 0.08, shade(c, 0.85))); T_(mb, 0, -0.55, 0, () => mb.box(0.28, 1.0, 0.06, c)); TR_(mb, M4.chain(M4.T(0, -1.05, 0), M4.RZ(Math.PI / 4)), () => mb.box(0.2, 0.2, 0.06, c)); }); }
  if ((cfg.jacket || cfg.vest) && !MII) { const c = cfg.jacket || cfg.vest, d = shade(c, 0.85); g.jflap = cgeo('jflap|' + c, mb => { T_(mb, 0, -0.68, 0, () => mb.box(0.72, 1.36, 0.08, c)); TR_(mb, M4.chain(M4.T(-0.22, -0.12, 0.05), M4.RZ(0.35)), () => mb.box(0.24, 0.8, 0.05, d)); for (let i = 0; i < 2; i++) T_(mb, -0.25, -0.55 - i * 0.45, 0.05, () => mb.sphere(0.06, 0, shade(c, 0.6))); }); }
  if (cfg.scarf) { const c = cfg.scarf === true ? '#e63946' : cfg.scarf; g.scarfT = cgeo('scarft|' + c, mb => { T_(mb, 0, -0.5, 0, () => mb.rbox(0.42, 1.0, 0.12, 0.05, c)); T_(mb, 0, -0.95, 0, () => mb.box(0.44, 0.1, 0.13, shade(c, 0.75))); for (let i = 0; i < 3; i++) T_(mb, -0.14 + i * 0.14, -1.08, 0, () => mb.box(0.06, 0.18, 0.06, shade(c, 0.8))); }); }
  if (cfg.hoodie) g.string = cgeo('hstr', mb => { T_(mb, 0, -0.3, 0, () => mb.box(0.06, 0.6, 0.04, '#f2f2f2')); T_(mb, 0, -0.62, 0, () => mb.sphere(0.06, 0, '#d0d0d0')); });
  if (cfg.backpack) { const c = cfg.backpack === true ? '#e63946' : cfg.backpack; g.pack = cgeo('pack|' + c, mb => { T_(mb, 0, -0.85, -0.38, () => mb.rbox(1.55, 1.65, 0.75, 0.22, c)); T_(mb, 0, -1.25, -0.77, () => mb.rbox(1.05, 0.62, 0.2, 0.1, shade(c, 0.85))); T_(mb, 0, -0.08, -0.38, () => mb.rbox(0.5, 0.14, 0.3, 0.06, shade(c, 0.7))); for (const s of [-1, 1]) T_(mb, s * 0.55, -0.85, -0.02, () => mb.box(0.12, 1.4, 0.1, shade(c, 0.75))); }); }
  MAT.map = prevMap;
  return (AVC[k] = g);
}
// P: Pose in Grad (Gelenke: a*=Schulter, e*=Ellbogen, l*=Hüfte, k*=Knie); S: Zustand {x,y,z,face(rad),scale, sec}
function avatarItems(items, cfg, S, P) {
  const g = avatarGeo(cfg), sc = (cfg.scale || 1) * (S.scale || 1), sq = P.sq || 0;
  const root = M4.chain(M4.T(S.x + (P.dx || 0), S.y + (P.y || 0) * sc, S.z + (P.dz || 0)), M4.RY(S.face + (P.spin || 0) * DEG), M4.RZ((P.rz || 0) * DEG), M4.RX((P.rx || 0) * DEG), M4.S(sc * (1 + sq * 0.5) * (cfg.slim || 1), sc * (1 - sq) * (cfg.tall || 1), sc * (1 + sq * 0.5) * (cfg.slim || 1))); // slim/tall: schlankere, größere Figur
  const tb = P.tb || 0, sh = S.sh, chr = cfg.glow ? { spec: 0.3, rim: 0.9, ao: 0, e: Math.min(1, +cfg.glow || 0.6) } : { spec: 0.3, rim: 0.32, ao: 0 };  // glow: leuchtende Figur (z. B. Hauptfigur im Dunkeln)
  const torso = M4.chain(root, M4.T(0, 3 + tb, 0), M4.RY((P.tw || 0) * DEG), M4.RX((P.bx || 0) * DEG), M4.RZ((P.wz || 0) * DEG)); // wz = seitliche Taillenbeugung
  if (cfg.style === 'mii') { P = { ...P, aLz: (P.aLz || 0) + 12, aRz: (P.aRz || 0) - 12 }; }   // Mii: Arme leicht vom Körper weg
  const SHX = cfg.style === 'mii' ? 0.62 * (MB_(cfg).w) : 1.5;   // Mii: schmale Schultern, dünne Arme
  const armL = M4.chain(torso, M4.T(SHX, 0.82 + (cfg.style === 'mii' ? 0 : 0.06), 0), M4.RZ((P.aLz || 0) * DEG), M4.RX((P.aLx || 0) * DEG), M4.RY((P.aLy || 0) * DEG));
  const armR = M4.chain(torso, M4.T(-SHX, 0.82 + (cfg.style === 'mii' ? 0 : 0.06), 0), M4.RZ((P.aRz || 0) * DEG), M4.RX((P.aRx || 0) * DEG), M4.RY((P.aRy || 0) * DEG));
  const foreL = M4.chain(armL, M4.T(0, -0.95, 0), M4.RX(-(P.eL || 0) * DEG)), foreR = M4.chain(armR, M4.T(0, -0.95, 0), M4.RX(-(P.eR || 0) * DEG));
  const HIPX = cfg.style === 'mii' ? 0.3 * MB_(cfg).w : 0.5;
  const legL = M4.chain(root, M4.T(HIPX, 2, 0), M4.RZ((P.lLz || 0) * DEG), M4.RX((P.lLx || 0) * DEG));
  const legR = M4.chain(root, M4.T(-HIPX, 2, 0), M4.RZ((P.lRz || 0) * DEG), M4.RX((P.lRx || 0) * DEG));
  const shinL = M4.chain(legL, M4.T(0, -1.0, 0), M4.RX((P.kL || 0) * DEG)), shinR = M4.chain(legR, M4.T(0, -1.0, 0), M4.RX((P.kR || 0) * DEG));
  const HF = cfg.style === 'mii' ? 1.2 * (+cfg.headScale || 1.45) : 1;   // Mii: Kopf ≈ Schulterbreite   // Mii Town: großer Kopf
  const head = M4.chain(torso, M4.T(0, 1.0, 0), M4.RY((P.hy || 0) * DEG), M4.RX((P.hx || 0) * DEG), M4.RZ((P.hz || 0) * DEG), M4.T(0, cfg.style === 'mii' ? -0.02 + 0.74 * HF : 0.04 + 0.66 * HF, 0), M4.S(HF, HF, HF));
  const ft = faceTex(P.mood || 'happy', P.closed, P.open, 'human', { gx: P.gx || 0, lashes: cfg.lashes, freckles: cfg.freckles, eye: cfg.eyeColor, mii: cfg.style === 'mii' ? { ...(cfg.facekit || {}), beard: cfg.beard ? (cfg.hairColor || '#3b2416') : null, stache: cfg.mustache ? (cfg.hairColor || '#3b2416') : null } : null });
  const add = (gg, m, o = {}) => items.push({ g: gg, m, sh, ...chr, ...o });
  add(g.torso, torso, { tex: g.tex }); add(g.uarm, armL); add(g.uarm, armR); add(g.larmL, foreL); add(g.larmR, foreR);
  add(g.thigh, legL); add(g.thigh, legR); add(g.shin, shinL); add(g.shin, shinR); add(g.head, head, { tex: ft }); add(g.hair, g.hs ? M4.mul(head, M4.S(g.hs.fx, g.hs.fy * 1.04, g.hs.fz)) : head);
  if (g.nose) { const fk = cfg.facekit || {}; const hs = g.hs || { sx: 0.66, sz: 0.64 }; add(g.nose, M4.chain(head, M4.T(0, -0.1 - (+fk.ny || 0) * 0.004, hs.sz * 0.97))); for (const s of [-1, 1]) add(g.ear, M4.chain(head, M4.T(s * hs.sx * 0.97, -0.04, -0.02))); }
  add(g.neck, M4.chain(torso, M4.T(0, 1.0, 0), M4.RY((P.hy || 0) * 0.5 * DEG), M4.RX((P.hx || 0) * 0.5 * DEG)));
  add(g.pelvis, M4.chain(root, M4.T(0, 0, 0), M4.RY((P.tw || 0) * -0.3 * DEG)), {});
  add(g.cap, M4.chain(armL, M4.T(0, -0.25, 0))); add(g.cap, M4.chain(armR, M4.T(0, -0.25, 0)));
  if ((P.eL || 0) > 8) add(g.elbow, M4.chain(armL, M4.T(0, -0.95, 0))); if ((P.eR || 0) > 8) add(g.elbow, M4.chain(armR, M4.T(0, -0.95, 0)));
  if ((P.kL || 0) > 8) add(g.knee, M4.chain(legL, M4.T(0, -1.0, 0))); if ((P.kR || 0) > 8) add(g.knee, M4.chain(legR, M4.T(0, -1.0, 0)));
  // runde Hüftgelenke, wenn das Bein weit angehoben/abgespreizt ist (keine Lücke zwischen Becken und Oberschenkel)
  if (Math.abs(P.lLx || 0) > 25 || Math.abs(P.lLz || 0) > 15) add(g.knee, M4.chain(legL, M4.T(0, -0.15, 0), M4.S(1.02, 1.02, 1.02))); if (Math.abs(P.lRx || 0) > 25 || Math.abs(P.lRz || 0) > 15) add(g.knee, M4.chain(legR, M4.T(0, -0.15, 0), M4.S(1.02, 1.02, 1.02)));
  // Stoff-Physik: sec.<teil> = [vor/zurück, seitlich] in Grad (positiv = Spitze nach hinten / nach links)
  const sec = S.sec || {}, sw = sec.swing || 0, sd = sec.side || 0, D_ = (k, dx, dz) => sec[k] || [dx, dz];
  const cp = D_('cape', 6 + sw * 1.4, sd * 0.5), tl2 = D_('tail', 18 + sw * 0.9, sd), pg = D_('pig', sw * 0.5, sd * 0.8), ti = D_('tie', -sw * 0.15, sd * 0.4), jf = D_('jacket', -sw * 0.2, 0), sf = D_('scarf', -sw * 0.2, sd * 0.4), st_ = D_('strings', -sw * 0.2, sd * 0.4), pk = D_('pack', sw * 0.12, sd * 0.2), sk_ = D_('skirt', sw * 0.2, sd * 0.3);
  if (g.skirt) { const fl = 1 + Math.min(0.18, Math.abs((P.lLx || 0) - (P.lRx || 0)) / 300); add(g.skirt, M4.chain(root, M4.T(0, 2.05, 0), M4.RX(sk_[0] * 0.4 * DEG), M4.RZ(-sk_[1] * 0.4 * DEG), M4.S(fl, 1, fl))); }
  if (g.tail) add(g.tail, M4.chain(head, M4.T(0, 0.35, -0.82), M4.RX(Math.max(-8, tl2[0]) * DEG), M4.RZ(-tl2[1] * DEG)));
  if (g.ptail) for (const s of [-1, 1]) add(g.ptail, M4.chain(head, M4.T(s * 0.82, 0.25, -0.2), M4.RZ((s * 22 - pg[1] * 0.8) * DEG), M4.RX(Math.max(-15, pg[0]) * DEG)));
  if (g.cape) add(g.cape, M4.chain(torso, M4.T(0, 0.95, -0.56), M4.RX(Math.max(-2, cp[0]) * DEG), M4.RZ(-cp[1] * 0.5 * DEG)), { sh });
  if (g.tie) add(g.tie, M4.chain(torso, M4.T(0, 0.82, 0.56), M4.RX(Math.min(4, ti[0]) * DEG), M4.RZ(-ti[1] * DEG)));
  if (g.jflap) for (const s of [-1, 1]) add(g.jflap, M4.chain(torso, M4.T(s * 0.68, 0.4, 0.54), M4.RX(Math.min(3, jf[0] * (s > 0 ? 1 : 0.85)) * DEG), M4.RZ(-jf[1] * 0.3 * DEG), M4.S(s, 1, 1)));
  if (g.scarfT) add(g.scarfT, M4.chain(torso, M4.T(0.45, 0.88, 0.6), M4.RZ(0.08), M4.RX(Math.min(4, sf[0]) * DEG), M4.RZ(-sf[1] * DEG)));
  if (g.string) for (const s of [-1, 1]) add(g.string, M4.chain(torso, M4.T(s * (cfg.style === 'mii' ? 0.14 : 0.22), cfg.style === 'mii' ? 0.78 : 0.86, cfg.style === 'mii' ? 0.42 : 0.54), M4.RX(Math.min(4, st_[0]) * DEG), M4.RZ(-st_[1] * DEG)));
  if (g.pack) add(g.pack, M4.chain(torso, M4.T(0, 0.92 + (sec.packY || 0), -0.5), M4.RX(Math.max(-3, pk[0]) * DEG), M4.RZ(-pk[1] * DEG)));
  if (g.wing) for (const s of [-1, 1]) add(g.wing, M4.chain(torso, M4.T(s * 0.3, 0.45, -0.6), M4.RY((s > 0 ? -1 : 1) * (25 + (sec.flap || 0)) * DEG + (s > 0 ? 0 : Math.PI))));
  if (g.halo) items.push({ g: g.halo, m: head, e: 1, sh: false });
  const handR = M4.mul(foreR, M4.T(0, -1.0, 0)), handL = M4.mul(foreL, M4.T(0, -1.0, 0));
  return { root, head, torso, armL, armR, foreL, foreR, handR, handL, top: M4.xp(head, [0, 0.9, 0]) };
}

// ---------- Tiere ----------
const ANIMALS = {
  dog: { c: '#b9824a', c2: '#f3e2c7', ears: 'flop', tail: 'up', snout: 1, s: 1 },
  cat: { c: '#f0a04b', c2: '#fff1dc', ears: 'point', tail: 'long', snout: 0, s: 0.8 },
  fox: { c: '#f07a2a', c2: '#ffffff', ears: 'point', tail: 'bushy', snout: 1, s: 0.95 },
  lion: { c: '#e7a94a', c2: '#f6d9a0', ears: 'round', tail: 'tuft', snout: 1, mane: '#9a4a1c', s: 1.3 },
  tiger: { c: '#ee8a2a', c2: '#fff3e2', ears: 'round', tail: 'stripe', snout: 1, stripes: '#1d1712', s: 1.35 },
  pig: { c: '#f7a8b8', c2: '#f28aa0', ears: 'point', tail: 'curl', snout: 2, s: 1.0 },
  bear: { c: '#8a5a33', c2: '#c99b6d', ears: 'round', tail: 'stub', snout: 1, s: 1.35 },
  sheep: { c: '#f5f5f5', c2: '#3b3b3b', ears: 'flop', tail: 'stub', snout: 0, wool: 1, s: 1.05 },
  cow: { c: '#ffffff', c2: '#f7b6c2', ears: 'flop', tail: 'tuft', snout: 2, spots: '#2b2b2b', s: 1.4 },
  guineapig: { guinea: 1, c: '#b5652b', c2: '#ffffff', c3: '#3b2a1a', s: 0.62 },
  guineapig2: { guinea: 1, c: '#f0a04b', c2: '#ffffff', c3: '#f0a04b', s: 0.58 },
  guineapig3: { guinea: 1, c: '#2b2b2b', c2: '#ffffff', c3: '#d9a066', s: 0.6 },
  croc: { croc: 1, c: '#4f8a3c', c2: '#c9d88a', s: 1.15 }, shark: { shark: 1, c: '#6f8fa8', c2: '#f2f4f6', s: 1.2 },
  penguin: { biped: 'penguin', s: 1 }, frog: { biped: 'frog', s: 1 }, chicken: { biped: 'chicken', s: 0.8 },
};
const ANC = {};
function animalGeo(type) {
  if (ANC[type]) return ANC[type];
  const A = ANIMALS[type] || ANIMALS.dog, parts = [];
  const part = (kind, p, build, o = {}) => { const mb = new MB(); build(mb); parts.push({ kind, p, g: GL.geo(mb), ...o }); };
  const T = (mb, x, y, z, f) => { mb.push(M4.T(x, y, z)); f(); mb.pop(); };
  if (A.croc) { // Krokodil: lang, flach, kurze gespreizte Beine, lange Schnauze mit Zähnen, langer Schwanz
    const c = A.c, c2 = A.c2;
    part('body', [0, 0.95, 0], mb => { mb.rbox(1.9, 0.95, 3.4, 0.38, c); T(mb, 0, -0.28, 0.1, () => mb.rbox(1.5, 0.45, 2.9, 0.2, c2)); for (let i = 0; i < 7; i++) for (const sx of [-0.45, 0.45]) T(mb, sx, 0.52, -1.4 + i * 0.45, () => mb.rbox(0.28, 0.22, 0.3, 0.08, shade(c, 0.8))); });
    part('head', [0, 1.05, 1.7], mb => { T(mb, 0, 0.12, 0.45, () => { mb.rbox(1.45, 0.85, 1.0, 0.32, c, { uv: true }); T(mb, 0, -0.2, 1.0, () => mb.rbox(1.0, 0.45, 1.5, 0.18, c)); T(mb, 0, -0.45, 1.0, () => mb.rbox(0.95, 0.18, 1.45, 0.08, c2));
      for (let i = 0; i < 6; i++) for (const sx of [-0.45, 0.45]) T(mb, sx, -0.36, 0.45 + i * 0.22, () => mb.box(0.08, 0.16, 0.08, '#fffbe6'));
      for (const sx of [-0.12, 0.12]) T(mb, sx, 0.05, 1.7, () => mb.sphere(0.06, 0, '#1d1712')); }); }, { face: 'animal' });
    for (const [x, z, ph] of [[0.95, 1.15, 0], [-0.95, 1.15, 1], [0.95, -1.1, 1], [-0.95, -1.1, 0]]) part('leg', [x, 0.75, z], mb => { mb.push(M4.RZ((x > 0 ? 1 : -1) * 35 * DEG)); T(mb, 0, -0.35, 0, () => mb.rbox(0.45, 0.75, 0.5, 0.15, c)); T(mb, 0, -0.72, 0.15, () => mb.rbox(0.5, 0.16, 0.7, 0.06, shade(c, 0.75))); mb.pop(); }, { ph });
    part('tail', [0, 1.0, -1.7], mb => { for (let i = 0; i < 6; i++) { const w = 1.3 * (1 - i / 7), h = 0.75 * (1 - i / 8); T(mb, 0, -0.12 * i / 5, -0.45 - i * 0.55, () => { mb.rbox(w, h, 0.62, 0.15, c); T(mb, 0, h / 2 + 0.08, 0, () => mb.rbox(0.18, 0.18, 0.4, 0.05, shade(c, 0.8))); }); } });
    return (ANC[type] = { parts, A });
  }
  if (A.shark) { // Hai: schwebt über dem Boden (schwimmt in der Luft), Rückenflosse, Brustflossen, Schwanzflosse
    const c = A.c, c2 = A.c2;
    part('body', [0, 2.1, 0], mb => { T(mb, 0, 0, -0.4, () => mb.sphere(1.05, 2, c, { sz: 2.1, sy: 0.95 })); T(mb, 0, -0.38, -0.2, () => mb.sphere(0.85, 2, c2, { sz: 1.85, sy: 0.6 }));
      T(mb, 0, 1.0, -0.4, () => { mb.push(M4.RX(-25 * DEG)); mb.cyl(0.55, 0.05, 1.2, 4, c, { rot: Math.PI / 4 }); mb.pop(); });
      for (const sx of [-1, 1]) T(mb, sx * 1.0, -0.35, 0.4, () => { mb.push(M4.chain(M4.RZ(sx * -55 * DEG), M4.RX(25 * DEG))); mb.rbox(0.18, 1.1, 0.7, 0.08, shade(c, 0.9)); mb.pop(); });
      for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) T(mb, sx * 0.9, 0.05, 0.55 - i * 0.22, () => mb.box(0.04, 0.45, 0.06, shade(c, 0.6))); });
    part('head', [0, 2.15, 1.3], mb => { T(mb, 0, 0.02, 0.35, () => { mb.rbox(1.55, 1.45, 1.1, 0.55, c, { uv: true }); T(mb, 0, -0.45, 0.45, () => mb.rbox(1.1, 0.35, 0.45, 0.15, c2)); for (let i = 0; i < 7; i++) T(mb, -0.42 + i * 0.14, -0.3, 0.7, () => { mb.push(M4.RX(180 * DEG)); mb.cyl(0.06, 0, 0.16, 4, '#ffffff'); mb.pop(); }); }); }, { face: 'animal' });
    part('tail', [0, 2.1, -2.3], mb => { T(mb, 0, 0, -0.4, () => mb.sphere(0.5, 1, c, { sz: 1.6, sy: 0.8 })); for (const sy of [1, -1]) T(mb, 0, sy * 0.55, -1.05, () => { mb.push(M4.RX(sy * 35 * DEG)); mb.rbox(0.14, 1.2 * (sy > 0 ? 1 : 0.75), 0.5, 0.06, c); mb.pop(); }); });
    return (ANC[type] = { parts, A });
  }
  if (A.guinea) {
    const c = A.c, c2 = A.c2, c3 = A.c3 || c;
    part('body', [0, 0, 0], mb => {
      T(mb, 0, 0.95, -0.1, () => mb.rbox(2.0, 1.55, 2.7, 0.7, c));
      T(mb, 0.3, 1.22, -0.55, () => mb.rbox(1.5, 1.12, 1.45, 0.5, c2));
      T(mb, -0.45, 1.12, 0.35, () => mb.rbox(1.2, 1.26, 1.25, 0.5, c3));
      T(mb, 0, 0.5, 0.25, () => mb.rbox(1.55, 0.55, 1.9, 0.27, '#fff3e0'));
    });
    part('head', [0, 1.0, 1.15], mb => {
      T(mb, 0, 0.32, 0.25, () => {
        mb.rbox(1.55, 1.3, 1.15, 0.5, c2 === '#ffffff' ? c : c2, { uv: true });
        T(mb, 0, -0.3, 0.55, () => mb.rbox(0.72, 0.42, 0.22, 0.15, '#fff3e0'));
        T(mb, 0, -0.14, 0.68, () => mb.sphere(0.11, 1, '#e88a9a', { sx: 1.3 }));
        for (const s of [-1, 1]) T(mb, s * 0.62, 0.62, -0.18, () => mb.sphere(0.25, 1, shade(c, 0.75), { sz: 0.45 }));
      });
    }, { face: 'animal' });
    for (const [x, z, ph] of [[0.6, 0.85, 0], [-0.6, 0.85, 1], [0.6, -0.95, 1], [-0.6, -0.95, 0]]) part('leg', [x, 0.32, z], mb => T(mb, 0, -0.16, 0.05, () => mb.rbox(0.42, 0.32, 0.52, 0.12, '#f2c2b0')), { ph });
  } else if (!A.biped) {
    const c = A.c, c2 = A.c2;
    part('body', [0, 1.75, 0], mb => { mb.rbox(1.7, 1.35, 2.8, 0.42, c); T(mb, 0, -0.25, 0.3, () => mb.rbox(1.2, 0.9, 1.9, 0.35, c2)); if (A.wool) { const R = rng(5); for (let i = 0; i < 14; i++) T(mb, (R() - .5) * 1.3, 0.35 + R() * .3, (R() - .5) * 2.2, () => mb.sphere(0.55, 1, '#fafafa')); } if (A.stripes) for (const z of [-1.0, -0.5, 0, 0.5, 0.95]) { T(mb, 0, 0.665, z, () => mb.rbox(0.95, 0.06, 0.16, 0.02, A.stripes)); for (const s of [-1, 1]) T(mb, s * 0.845, 0.2, z, () => mb.rbox(0.06, 0.62, 0.16, 0.02, A.stripes)); } if (A.spots) { T(mb, 0.55, 0.3, 0.4, () => mb.rbox(0.7, 0.75, 0.9, 0.2, A.spots)); T(mb, -0.6, 0.1, -0.7, () => mb.rbox(0.6, 0.7, 0.8, 0.2, A.spots)); } });
    part('head', [0, 2.35, 1.35], mb => {
      mb.push(M4.T(0, 0.45, 0.35)); mb.rbox(1.45, 1.35, 1.3, 0.4, type === 'sheep' ? '#3b3b3b' : c, { uv: true });
      if (A.snout === 1) { T(mb, 0, -0.28, 0.72, () => mb.rbox(0.82, 0.55, 0.55, 0.2, c2)); T(mb, 0, -0.12, 1.0, () => mb.sphere(0.15, 1, '#1d1712', { sx: 1.3 })); }
      if (A.snout === 2) { T(mb, 0, -0.2, 0.72, () => mb.rbox(0.75, 0.55, 0.3, 0.2, c2)); for (const s of [-1, 1]) T(mb, s * 0.14, -0.2, 0.88, () => mb.sphere(0.07, 0, '#7a2a3a')); }
      for (const s of [-1, 1]) {
        if (A.ears === 'flop') T(mb, s * 0.78, 0.25, -0.05, () => { mb.push(M4.RZ(s * 18 * DEG)); mb.rbox(0.28, 0.85, 0.55, 0.1, type === 'sheep' ? '#3b3b3b' : shade(c, 0.75)); mb.pop(); });
        if (A.ears === 'point') T(mb, s * 0.45, 0.6, -0.1, () => { mb.push(M4.RZ(-s * 12 * DEG)); mb.cyl(0.32, 0, 0.6, 4, c, { rot: Math.PI / 4 }); mb.pop(); });
        if (A.ears === 'round') T(mb, s * 0.55, 0.65, -0.15, () => mb.sphere(0.27, 1, shade(c, 0.85), { sz: 0.6 }));
      }
      if (A.mane) { for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; mb.push(M4.chain(M4.T(Math.sin(a) * 0.85, Math.cos(a) * 0.85, -0.25), M4.RZ(-a), M4.RX(0))); mb.cyl(0.38, 0, 0.75, 4, i % 2 ? A.mane : shade(A.mane, 1.15)); mb.pop(); } T(mb, 0, 0, -0.35, () => mb.rbox(1.9, 1.9, 0.5, 0.4, A.mane)); }
      if (A.stripes) { for (const x of [-0.25, 0, 0.25]) T(mb, x, 0.6, 0.2, () => mb.rbox(0.09, 0.08, 0.7, 0.03, A.stripes)); for (const s of [-1, 1]) for (const y of [-0.05, 0.2]) T(mb, s * 0.71, y, 0.1, () => mb.rbox(0.06, 0.08, 0.55, 0.03, A.stripes)); }
      if (type === 'cow') for (const s of [-1, 1]) T(mb, s * 0.6, 0.75, 0, () => mb.cyl(0.12, 0.05, 0.4, 6, '#f2e6c9'));
      mb.pop();
    }, { face: 'animal' });
    for (const [x, z, ph] of [[0.55, 0.95, 0], [-0.55, 0.95, 1], [0.55, -0.95, 1], [-0.55, -0.95, 0]]) part('leg', [x, 1.25, z], mb => { T(mb, 0, -0.62, 0, () => mb.rbox(0.5, 1.25, 0.5, 0.15, c)); T(mb, 0, -1.15, 0.05, () => mb.rbox(0.54, 0.22, 0.6, 0.08, shade(c, 0.7))); if (A.stripes) for (const y of [-0.3, -0.7]) T(mb, 0, y, 0, () => mb.rbox(0.53, 0.12, 0.53, 0.04, A.stripes)); }, { ph });
    part('tail', [0, 2.15, -1.35], mb => {
      if (A.tail === 'up') { mb.push(M4.RX(-40 * DEG)); T(mb, 0, 0, -0.45, () => mb.rbox(0.25, 0.25, 0.9, 0.1, c)); mb.pop(); }
      if (A.tail === 'long') { mb.push(M4.RX(-70 * DEG)); T(mb, 0, 0, -0.75, () => mb.rbox(0.22, 0.22, 1.5, 0.1, c)); mb.pop(); }
      if (A.tail === 'bushy') { mb.push(M4.RX(-25 * DEG)); T(mb, 0, 0, -0.8, () => mb.rbox(0.6, 0.6, 1.4, 0.28, c)); T(mb, 0, 0, -1.55, () => mb.rbox(0.5, 0.5, 0.35, 0.2, '#ffffff')); mb.pop(); }
      if (A.tail === 'tuft') { mb.push(M4.RX(30 * DEG)); T(mb, 0, 0, -0.6, () => mb.rbox(0.18, 0.18, 1.2, 0.08, c)); T(mb, 0, 0, -1.25, () => mb.sphere(0.25, 1, A.mane || '#3b2a1a')); mb.pop(); }
      if (A.tail === 'stripe') { mb.push(M4.RX(-60 * DEG)); T(mb, 0, 0, -0.75, () => mb.rbox(0.24, 0.24, 1.5, 0.1, c)); for (const z of [-0.35, -0.75, -1.15]) T(mb, 0, 0, z, () => mb.rbox(0.27, 0.27, 0.12, 0.04, A.stripes)); T(mb, 0, 0, -1.5, () => mb.rbox(0.27, 0.27, 0.2, 0.08, A.stripes)); mb.pop(); }
      if (A.tail === 'curl') T(mb, 0, 0, -0.1, () => mb.sphere(0.2, 1, A.c2));
      if (A.tail === 'stub') T(mb, 0, 0, -0.05, () => mb.sphere(0.25, 1, c));
    });
  } else if (A.biped === 'penguin') {
    part('body', [0, 0.4, 0], mb => { T(mb, 0, 1.3, 0, () => mb.sphere(1.2, 2, '#22252b', { sy: 1.25, sz: 1.0 })); T(mb, 0, 1.15, 0.42, () => mb.sphere(0.95, 2, '#ffffff', { sy: 1.05, sz: 0.75 })); });
    part('head', [0, 2.2, 0], mb => { T(mb, 0, 0.55, 0.05, () => { mb.rbox(1.65, 1.3, 1.4, 0.6, '#22252b', { uv: true }); T(mb, 0, -0.12, 0.72, () => { mb.push(M4.RX(90 * DEG)); mb.cyl(0.22, 0, 0.45, 8, '#ff9f1a'); mb.pop(); }); }); }, { face: 'penguin' });
    for (const s of [-1, 1]) part('arm', [s * 1.05, 2.0, 0], mb => { mb.push(M4.RZ(s * 12 * DEG)); T(mb, 0, -0.6, 0, () => mb.rbox(0.25, 1.3, 0.7, 0.12, '#22252b')); mb.pop(); }, { side: s });
    for (const [s, ph] of [[1, 0], [-1, 1]]) part('leg', [s * 0.45, 0.4, 0.1], mb => T(mb, 0, -0.32, 0.2, () => mb.rbox(0.55, 0.16, 0.8, 0.07, '#ff9f1a')), { ph });
  } else if (A.biped === 'frog') {
    part('body', [0, 0, 0], mb => { T(mb, 0, 0.75, 0, () => mb.rbox(2.0, 1.1, 1.9, 0.5, '#5cc84a')); T(mb, 0, 0.62, 0.35, () => mb.rbox(1.5, 0.75, 1.3, 0.35, '#c9f08a')); });
    part('head', [0, 1.3, 0.35], mb => { T(mb, 0, 0.32, 0.12, () => mb.rbox(1.85, 0.9, 1.25, 0.42, '#5cc84a', { uv: true })); for (const s of [-1, 1]) T(mb, s * 0.5, 0.85, 0.25, () => { mb.sphere(0.36, 2, '#5cc84a'); T(mb, 0, 0.05, 0.25, () => mb.sphere(0.24, 2, '#ffffff')); T(mb, 0, 0.07, 0.42, () => mb.sphere(0.12, 1, '#1d1712')); }); }, { face: 'frog' });
    for (const [x, z, ph] of [[0.75, 0.6, 0], [-0.75, 0.6, 1], [0.95, -0.55, 1], [-0.95, -0.55, 0]]) part('leg', [x, 0.5, z], mb => T(mb, 0, -0.25, 0.1, () => mb.rbox(0.5, 0.5, 0.75, 0.18, '#4fb03f')), { ph });
  } else if (A.biped === 'chicken') {
    part('body', [0, 1.0, 0], mb => { T(mb, 0, 0.75, -0.1, () => mb.sphere(1.0, 2, '#ffffff', { sz: 1.25 })); for (const s of [-1, 1]) T(mb, s * 0.85, 0.85, -0.1, () => mb.sphere(0.45, 1, '#f1f1f1', { sz: 1.6, sx: 0.5 })); T(mb, 0, 1.0, -1.1, () => mb.cyl(0.4, 0.1, 0.7, 5, '#f1f1f1')); });
    part('head', [0, 2.2, 0.55], mb => { T(mb, 0, 0.35, 0.1, () => { mb.rbox(0.95, 0.95, 0.9, 0.38, '#ffffff', { uv: true }); T(mb, 0, 0.6, 0, () => mb.rbox(0.18, 0.4, 0.7, 0.08, '#e63946')); T(mb, 0, -0.08, 0.5, () => { mb.push(M4.RX(90 * DEG)); mb.cyl(0.18, 0, 0.35, 6, '#ffb703'); mb.pop(); }); T(mb, 0, -0.38, 0.45, () => mb.sphere(0.12, 1, '#e63946', { sy: 1.5 })); }); }, { face: 'animal' });
    for (const [s, ph] of [[1, 0], [-1, 1]]) part('leg', [s * 0.35, 1.0, 0], mb => { T(mb, 0, -0.5, 0, () => mb.rbox(0.14, 1.0, 0.14, 0.05, '#ffb703')); T(mb, 0, -0.98, 0.15, () => mb.rbox(0.4, 0.08, 0.5, 0.03, '#ffb703')); }, { ph });
  }
  return (ANC[type] = { parts, A });
}
function animalItems(items, type, S, P, t) {
  const { parts, A } = animalGeo(type); const sc = (A.s || 1) * (S.scale || 1);
  const sq = P.sq || 0; const root = M4.chain(M4.T(S.x + (P.dx || 0), S.y + (P.y || 0), S.z), M4.RY(S.face + (P.spin || 0) * DEG), M4.RX((P.rx || 0) * DEG), M4.RZ((P.rz || 0) * DEG), M4.S(sc * (1 + sq * 0.5), sc * (1 - sq), sc * (1 + sq * 0.5)));
  let headM = null;
  for (const pt of parts) {
    let m; const [px, py, pz] = pt.p;
    if (pt.kind === 'leg') m = M4.chain(root, M4.T(px, py, pz), M4.RX((pt.ph ? -1 : 1) * (P.leg || 0) * DEG));
    else if (pt.kind === 'arm') m = M4.chain(root, M4.T(px, py + (P.tb || 0), pz), M4.RZ(pt.side * (P.flap || 0) * DEG));
    else if (pt.kind === 'tail') m = M4.chain(root, M4.T(px, py + (P.tb || 0), pz), M4.RY((P.wag || 0) * DEG));
    else if (pt.kind === 'head') { m = M4.chain(root, M4.T(px, py + (P.tb || 0), pz), M4.RY((P.hy || 0) * DEG), M4.RX((P.hx || 0) * DEG), M4.RZ((P.hz || 0) * DEG)); headM = m; }
    else m = M4.chain(root, M4.T(px, py + (P.tb || 0), pz));
    const it = { g: pt.g, m, sh: S.sh, spec: 0.25, rim: 0.3, ao: 0 };
    if (pt.face) it.tex = faceTex(P.mood || 'happy', P.closed, P.open, pt.face);
    items.push(it);
  }
  return { root, head: headM, handR: headM, handL: headM, top: M4.xp(root, A.guinea ? [0, 2.5, 0.9] : [0, A.biped ? 4.0 : 4.4, A.biped ? 0 : 1.4]) };
}

// ---------- Requisiten ----------
// jede Funktion baut Geometrie (lokal, Boden bei y=0) – Rückgabe {parts:[{g,m?,tex?,e?,a?}]}
const PROPS = {
  // Pommes in roter Schachtel
  fries: o => ({ parts: [{ g: cgeo('fries|' + (o.color || '#e63a2e'), mb => { mb.push(M4.T(0, 0.55, 0)); mb.rbox(1.0, 1.1, 0.6, 0.06, o.color || '#e63a2e'); mb.pop(); mb.push(M4.T(0, 0.7, 0.31)); mb.box(0.5, 0.4, 0.02, '#ffd23f'); mb.pop(); const R = rng(9); for (let i = 0; i < 16; i++) { mb.push(M4.chain(M4.T((R() - 0.5) * 0.8, 1.25 + R() * 0.35, (R() - 0.5) * 0.4), M4.RZ((R() - 0.5) * 0.4), M4.RX((R() - 0.5) * 0.3))); mb.box(0.12, 0.9, 0.12, i % 3 ? '#f4c542' : '#e8b030'); mb.pop(); } }) }] }),
  // Becher mit Deckel und Strohhalm
  soda: o => ({ parts: [{ g: cgeo('soda|' + (o.color || '#e63a2e'), mb => { mb.cyl(0.45, 0.55, 1.4, 14, o.color || '#e63a2e', { flat: false }); mb.push(M4.T(0, 1.4, 0)); mb.cyl(0.6, 0.6, 0.12, 14, '#f4f4f4', { flat: false }); mb.pop(); mb.push(M4.chain(M4.T(0.15, 1.9, 0), M4.RZ(-0.2))); mb.box(0.1, 1.0, 0.1, '#ffffff'); mb.pop(); }) }] }),
  // Tribüne mit Zuschauern (bunte Köpfe/Oberkörper als günstige Masse)
  bleachers: o => ({ parts: [{ g: cgeo('bleach|' + (o.w || 30) + '|' + (o.rows || 6), mb => { const w = o.w || 30, rows = o.rows || 6, R = rng(4 + rows); const C = ['#e63946', '#3a86ff', '#ffd23f', '#2a9d8f', '#ff006e', '#8338ec', '#fb5607', '#f4f4f4']; const SK = ['#f5c79a', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
      for (let r = 0; r < rows; r++) { mb.push(M4.T(0, r * 1.1 + 0.55, -r * 1.6)); mb.box(w, 1.1, 1.6, r % 2 ? '#9aa3ad' : '#b5bcc5'); mb.pop();
        for (let x = -w / 2 + 0.8; x < w / 2 - 0.5; x += 1.15 + R() * 0.25) { if (R() < 0.12) continue; const y0 = r * 1.1 + 1.1, z0 = -r * 1.6 - 0.1; mb.push(M4.T(x, y0 + 0.55, z0)); mb.box(0.9, 1.0, 0.6, C[Math.floor(R() * C.length)]); mb.pop(); mb.push(M4.T(x, y0 + 1.4, z0)); mb.rbox(0.72, 0.72, 0.72, 0.12, SK[Math.floor(R() * SK.length)]); mb.pop(); } } }) }] }),
  // Lichtstrahl (additiv, halbtransparent): w Breite, l Länge, Richtung über ry/rx der Prop-Optionen; a = Deckkraft
  lightbeam: o => ({ parts: [{ g: cgeo('beam|' + (o.color || '#fff2c8') + '|' + (o.w || 3) + '|' + (o.l || 14), mb => { for (let i = 0; i < 6; i++) { const q = i / 5; mb.push(M4.chain(M4.RX((o.tilt ?? -38) * DEG), M4.T(0, -(o.l || 14) / 2, 0))); mb.box((o.w || 3) * (1 + q * 0.35), o.l || 14, 0.18 + q * 0.9, o.color || '#fff2c8'); mb.pop(); } }), e: 1, a: o.a ?? 0.07, sh: false, add: true }] }),
  // schwebender Staub im Licht (mit bob/spin animieren)
  motes: o => ({ parts: [{ g: cgeo('motes|' + (o.n || 70) + '|' + (o.r || 4), mb => { const R = rng(77 + (o.n || 70)); for (let i = 0; i < (o.n || 70); i++) { mb.push(M4.T((R() - 0.5) * (o.r || 4) * 2, R() * (o.h || 6), (R() - 0.5) * (o.r || 4))); mb.sphere(0.02 + R() * 0.02, 0, '#ffe9b8'); mb.pop(); } }), e: 1, a: 0.45, sh: false, add: true }] }),
  // Topfpflanze
  potplant: o => ({ parts: [{ g: cgeo('potplant|' + (o.color || '#e7e1d6'), mb => { mb.cyl(0.7, 0.55, 1.2, 14, o.color || '#e7e1d6', { flat: false }); const R = rng(5); for (let i = 0; i < 9; i++) { const a = R() * 6.28, h = 1.6 + R() * 2.2, r = 0.2 + R() * 0.5; mb.push(M4.chain(M4.T(Math.sin(a) * r, h, Math.cos(a) * r), M4.RY(a), M4.RZ((R() - 0.5) * 0.9))); mb.sphere(0.55 + R() * 0.35, 1, i % 3 ? '#3f8f4a' : '#2f7a3d'); mb.pop(); } for (let i = 0; i < 4; i++) { mb.push(M4.chain(M4.T(0, 1.2, 0), M4.RZ((i - 1.5) * 0.25))); mb.box(0.08, 1.8, 0.08, '#4a6b2a'); mb.pop(); } }) }] }),
  // Fenster mit hellem Himmel (leuchtend) und Rahmen
  window: o => ({ parts: [{ g: cgeo('winframe|' + (o.w || 4) + '|' + (o.h || 5), mb => { const w = o.w || 4, h = o.h || 5; for (const x of [-w / 2, 0, w / 2]) { mb.push(M4.T(x, h / 2, 0.05)); mb.box(0.18, h + 0.2, 0.2, '#f4f4f2'); mb.pop(); } for (const y of [0, h / 2, h]) { mb.push(M4.T(0, y, 0.05)); mb.box(w + 0.2, 0.18, 0.2, '#f4f4f2'); mb.pop(); } }) }, { g: cgeo('winpane|' + (o.w || 4) + '|' + (o.h || 5), mb => { mb.push(M4.T(0, (o.h || 5) / 2, 0)); mb.box(o.w || 4, o.h || 5, 0.06, '#dff1ff'); mb.pop(); }), e: 1 }] }),
  // Teppich
  rug: o => ({ parts: [{ g: cgeo('rug|' + (o.color || '#c9b49a') + '|' + (o.w || 7), mb => { mb.push(M4.T(0, 0.02, 0)); mb.rbox(o.w || 7, 0.04, (o.w || 7) * 0.62, 0.02, o.color || '#c9b49a'); mb.pop(); mb.push(M4.T(0, 0.045, 0)); mb.rbox((o.w || 7) - 0.6, 0.02, (o.w || 7) * 0.62 - 0.6, 0.01, shade(o.color || '#c9b49a', 0.85)); mb.pop(); }) }] }),
  sign: o => ({ parts: [{ g: cgeo('signpost', mb => { mb.push(M4.T(0, 0, -0.05)); mb.cyl(0.14, 0.14, 2.6, 8, '#8b5a2b'); mb.pop(); }) }, { g: cgeo('signboard|' + (o.w || 3.4) + '|' + (o.h || 1.8), mb => { mb.push(M4.T(0, 2.4 + (o.h || 1.8) / 2, 0.1)); mb.box(o.w || 3.4, o.h || 1.8, 0.2, '#ffffff', { uv: true }); mb.pop(); }), tex: signTex(o.text || '!', { ...o, tw: 512, th: Math.round(512 * (o.h || 1.8) / (o.w || 3.4)) }) }] }),
  board: o => { const w = o.w || 6, h = o.h || 3; return { parts: [{ g: cgeo('boardposts|' + w, mb => { for (const s of [-1, 1]) { mb.push(M4.T(s * w * 0.4, 0, 0)); mb.cyl(0.16, 0.16, 3.2 + h * 0.4, 8, '#7a4a24'); mb.pop(); } }) }, { g: cgeo(`boardpanel|${w}|${h}`, mb => { mb.push(M4.T(0, 2.6 + h / 2, 0.2)); mb.box(w, h, 0.25, '#ffffff', { uv: true }); mb.pop(); }), tex: signTex(o.text || '', { ...o, tw: 512, th: Math.round(512 * h / w) }) }] }; },
  banner: o => { const w = o.w || 8; return { parts: [{ g: cgeo('bannerposts|' + w, mb => { for (const s of [-1, 1]) { mb.push(M4.T(s * w / 2, 0, 0)); mb.cyl(0.18, 0.18, 5.6, 8, o.pole || '#1e88e5'); mb.push(M4.T(0, 5.6, 0)); mb.sphere(0.3, 1, '#ffd23f'); mb.pop(); mb.pop(); } }) }, { g: cgeo('bannercloth|' + w, mb => { mb.push(M4.T(0, 4.6, 0)); mb.box(w, 1.5, 0.12, '#ffffff', { uv: true }); mb.pop(); }), tex: signTex(o.text || '', { bg: o.bg || '#ff7a1a', fg: o.fg || '#ffffff', border: o.border || '#ffffff', tw: 1024, th: 192 }) }] }; },
  number: o => ({ parts: [{ g: cgeo('numpanel', mb => { mb.push(M4.T(0, 1, 0)); mb.box(2, 2, 0.15, '#ffffff', { uv: true }); mb.pop(); }), tex: signTex(o.text || '1', { bg: o.bg || '#ffd23f', fg: o.fg || '#1d1712', border: o.border || '#1d1712', tw: 256, th: 256 }) }] }),
  coin: o => ({ parts: [{ g: cgeo('coin', mb => { mb.push(M4.chain(M4.T(0, 0.75, -0.09), M4.RX(90 * DEG))); mb.cyl(0.7, 0.7, 0.18, 18, '#f7c331', { top: '#ffd95a' }); mb.pop(); mb.push(M4.T(0, 0.75, 0.1)); mb.box(0.18, 0.7, 0.04, '#e0a400'); mb.pop(); }), e: 0.18 }] }),
  coins: o => ({ parts: [{ g: cgeo('coinpile', mb => { const R = rng(9); for (let i = 0; i < 40; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * 2.2; mb.push(M4.chain(M4.T(Math.sin(a) * r, 0.1 + (2.2 - r) * 0.45 + R() * 0.3, Math.cos(a) * r), M4.RX((R() - .5) * 0.8), M4.RZ((R() - .5) * 0.8))); mb.cyl(0.6, 0.6, 0.16, 12, '#f7c331', { top: '#ffd95a' }); mb.pop(); } }), e: 0.15 }] }),
  apple: o => ({ parts: [{ g: cgeo('apple', mb => { mb.push(M4.T(0, 0.45, 0)); mb.sphere(0.45, 2, '#e8262a', { sy: 0.92 }); mb.push(M4.T(0, 0.38, 0)); mb.cyl(0.04, 0.04, 0.25, 5, '#5b3a1e'); mb.push(M4.chain(M4.T(0.12, 0.15, 0), M4.RZ(-0.8))); mb.box(0.25, 0.06, 0.14, '#3fa34d'); mb.pop(); mb.pop(); mb.pop(); }) }] }),
  egg: o => ({ parts: [{ g: cgeo('egg|' + (o.color || '#ffd23f') + '|' + (o.spots || ''), mb => { const c = o.color || '#ffd23f'; mb.push(M4.T(0, 0.62, 0)); mb.sphere(0.45, 2, c, { sy: 1.38 }); mb.pop(); if (o.spots) { const R = rng(7); for (let i = 0; i < 7; i++) { const a = R() * 6.28, y = 0.35 + R() * 0.55; mb.push(M4.T(Math.sin(a) * 0.43, y, Math.cos(a) * 0.43)); mb.sphere(0.09, 1, o.spots); mb.pop(); } } }), e: o.glow ? 0.45 : 0 }] }),
  banana: o => ({ parts: [{ g: cgeo('banana', mb => { for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.28; mb.push(M4.chain(M4.T(Math.sin(a) * 0.9, 0.35 + (1 - Math.cos(a)) * 0.9, 0), M4.RZ(-a))); mb.rbox(0.3, 0.32, 0.3, 0.12, i === 0 || i === 5 ? '#6b4a1e' : '#ffd93b'); mb.pop(); } }) }] }),
  carrot: o => ({ parts: [{ g: cgeo('carrot', mb => { mb.push(M4.chain(M4.T(0, 0.35, 0.8), M4.RX(90 * DEG))); mb.cyl(0.32, 0.02, 1.8, 7, '#ff7f11'); mb.pop(); mb.push(M4.T(0, 0.35, -1.0)); for (let i = 0; i < 3; i++) { mb.push(M4.RY(i * 1.1)); mb.box(0.12, 0.12, 0.6, '#3fa34d'); mb.pop(); } mb.pop(); }) }] }),
  ball: o => ({ parts: [{ g: cgeo('ball|' + (o.color || 'beach'), mb => { mb.push(M4.T(0, 0.65, 0)); const cs = ['#e63946', '#ffffff', '#1e88e5', '#ffd23f', '#2a9d8f', '#ffffff']; mb.sphere(0.65, 2, o.color || '#e63946', { colFn: o.color ? null : (a, b, c) => cs[Math.floor(((Math.atan2(a[0] + b[0] + c[0], a[2] + b[2] + c[2]) + Math.PI) / (Math.PI * 2)) * 6) % 6] }); mb.pop(); }) }] }),
  gift: o => ({ parts: [{ g: cgeo('gift|' + (o.color || '#e63946'), mb => { const c = o.color || '#e63946'; mb.push(M4.T(0, 0.6, 0)); mb.rbox(1.2, 1.2, 1.2, 0.06, c); mb.box(1.24, 1.24, 0.25, '#ffd23f'); mb.box(0.25, 1.24, 1.24, '#ffd23f'); mb.push(M4.T(0, 0.7, 0)); for (const s of [-1, 1]) { mb.push(M4.chain(M4.RZ(s * 0.6), M4.T(s * 0.2, 0.1, 0))); mb.rbox(0.35, 0.25, 0.25, 0.1, '#ffd23f'); mb.pop(); } mb.pop(); mb.pop(); }) }] }),
  cake: o => ({ parts: [{ g: cgeo('cake', mb => { mb.cyl(1.0, 1.0, 0.6, 18, '#f7d6e0', { flat: false, top: '#ffffff' }); mb.push(M4.T(0, 0.6, 0)); mb.cyl(0.75, 0.75, 0.5, 18, '#f28aa0', { flat: false, top: '#ffffff' }); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; mb.push(M4.T(Math.sin(a) * 0.45, 0.5, Math.cos(a) * 0.45)); mb.cyl(0.05, 0.05, 0.4, 6, ['#1e88e5', '#ffd23f', '#2a9d8f', '#e63946', '#9b5de5'][i]); mb.pop(); } mb.pop(); }) }, { g: cgeo('cakeflames', mb => { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; mb.push(M4.T(Math.sin(a) * 0.45, 1.55, Math.cos(a) * 0.45)); mb.sphere(0.08, 1, '#ffb703', { sy: 1.6 }); mb.pop(); } }), e: 1 }] }),
  // Film-Requisiten (27.11.): hängender Farbeimer, Murmeln, geschmückter Weihnachtsbaum
  paintcan: o => ({ parts: [{ g: cgeo('paintcan|' + (o.color || '#e63946') + '|' + (o.rope || 0), mb => { const c = o.color || '#e63946'; mb.cyl(0.42, 0.38, 0.72, 16, '#c9ccd1', { flat: false, top: c }); mb.push(M4.T(0, 0.5, 0.4)); mb.cyl(0.13, 0.1, 0.3, 8, c); mb.pop(); for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; mb.push(M4.T(Math.cos(a) * 0.4, 0.72 + Math.sin(a) * 0.38, 0)); mb.sphere(0.04, 1, '#666'); mb.pop(); } if (o.rope) { mb.push(M4.T(0, 1.1, 0)); mb.cyl(0.035, 0.035, o.rope, 6, '#c8a165'); mb.pop(); } }) }] }),
  marbles: o => ({ parts: [{ g: cgeo('marbles|' + (o.n || 14), mb => { const R = rng(5); const C = ['#1e88e5', '#e63946', '#ffd23f', '#2a9d8f', '#9b5de5', '#ff8fab']; for (let i = 0; i < (o.n || 14); i++) { mb.push(M4.T((R() - 0.5) * 3.2, 0.18, (R() - 0.5) * 2.0)); mb.sphere(0.18, 1, C[i % C.length]); mb.pop(); } }) }] }),
  xmastree: o => ({ parts: [{ g: cgeo('xmastree', mb => { setPine(mb, 0, 0, 1); const R = rng(9); const C = ['#e63946', '#ffd23f', '#1e88e5', '#ff8fab', '#ffffff']; for (let i = 0; i < 26; i++) { const y = 1.5 + R() * 4.6, r = Math.max(0.25, 2.1 * (1 - (y - 1.2) / 5.6)) * 0.98, a = R() * 6.28; mb.push(M4.T(Math.sin(a) * r, y, Math.cos(a) * r)); mb.sphere(0.16, 1, C[i % C.length]); mb.pop(); } mb.push(M4.T(0, 6.75, 0)); mb.sphere(0.32, 1, '#ffd23f', { sy: 1.2 }); mb.pop(); }) }, { g: cgeo('xmaslights', mb => { const R = rng(11); for (let i = 0; i < 30; i++) { const y = 1.4 + R() * 4.8, r = Math.max(0.2, 2.15 * (1 - (y - 1.2) / 5.6)), a = R() * 6.28; mb.push(M4.T(Math.sin(a) * r, y, Math.cos(a) * r)); mb.sphere(0.07, 1, '#fff3b0'); mb.pop(); } }), e: 1 }] }),
  pizza: o => ({ parts: [{ g: cgeo('pizza', mb => { mb.push(M4.T(0, 0.05, 0)); mb.cyl(1.1, 1.1, 0.12, 20, '#e9b872', { top: '#f6c453' }); const R = rng(3); for (let i = 0; i < 9; i++) { const a = R() * 6.28, r = R() * 0.8; mb.push(M4.T(Math.sin(a) * r, 0.13, Math.cos(a) * r)); mb.cyl(0.14, 0.14, 0.04, 8, '#c62828'); mb.pop(); } mb.pop(); }) }] }),
  burger: o => ({ parts: [{ g: cgeo('burger', mb => { mb.push(M4.T(0, 0.15, 0)); mb.cyl(0.7, 0.7, 0.25, 16, '#e0a458', { flat: false }); mb.push(M4.T(0, 0.25, 0)); mb.cyl(0.75, 0.75, 0.22, 16, '#6b3e26', { flat: false }); mb.push(M4.T(0, 0.22, 0)); mb.cyl(0.8, 0.8, 0.06, 12, '#7bc950'); mb.cyl(0.72, 0.72, 0.1, 4, '#ffd23f'); mb.push(M4.T(0, 0.1, 0)); mb.sphere(0.72, 2, '#e8a457', { sy: 0.55 }); mb.pop(); mb.pop(); mb.pop(); mb.pop(); }) }] }),
  icecream: o => ({ parts: [{ g: cgeo('icecream', mb => { mb.push(M4.chain(M4.T(0, 1.1, 0), M4.RX(Math.PI))); mb.cyl(0.4, 0.02, 1.1, 10, '#d9a066'); mb.pop(); mb.push(M4.T(0, 1.3, 0)); mb.sphere(0.45, 2, '#ff8fab'); mb.push(M4.T(0, 0.5, 0)); mb.sphere(0.4, 2, '#fff3b0'); mb.push(M4.T(0, 0.42, 0)); mb.sphere(0.12, 1, '#e63946'); mb.pop(); mb.pop(); mb.pop(); }) }] }),
  housekeys: o => ({ parts: [{ g: cgeo('housekeys', mb => { mb.push(M4.chain(M4.T(0, 0.75, 0), M4.RX(90 * DEG))); mb.cyl(0.26, 0.26, 0.06, 14, '#c9ccd1'); mb.pop(); for (const [x, r, c] of [[-0.18, -20, '#d4af37'], [0.2, 25, '#b8bcc4']]) { mb.push(M4.chain(M4.T(x, 0.38, 0), M4.RZ(r * DEG))); mb.rbox(0.14, 0.55, 0.05, 0.02, c); mb.push(M4.T(0, 0.3, 0)); mb.rbox(0.3, 0.2, 0.06, 0.04, c); mb.pop(); mb.pop(); } }), e: 0.05 }] }),  // Schlüsselbund (keys = Klaviertastatur!)
  phone: o => ({ parts: [{ g: cgeo('phone', mb => { mb.push(M4.T(0, 0.6, 0)); mb.rbox(0.6, 1.15, 0.1, 0.05, '#1b1b1b'); mb.pop(); }) }, { g: cgeo('phonescreen', mb => { mb.push(M4.T(0, 0.62, 0.056)); mb.box(0.5, 0.95, 0.01, '#4fc3f7'); mb.pop(); }), e: 0.9 }] }),
  book: o => ({ parts: [{ g: cgeo('book|' + (o.color || '#1e88e5'), mb => { mb.push(M4.T(0, 0.15, 0)); mb.box(1.0, 0.3, 1.3, o.color || '#1e88e5'); mb.push(M4.T(0.04, 0, 0)); mb.box(0.96, 0.24, 1.22, '#fffaf0'); mb.pop(); mb.pop(); }) }] }),
  cup: o => ({ parts: [{ g: cgeo('cup|' + (o.color || '#ffffff'), mb => { mb.cyl(0.35, 0.42, 0.8, 14, o.color || '#ffffff', { flat: false }); mb.push(M4.T(0, 0.79, 0)); mb.disc(0.38, 14, '#6b3e26'); mb.pop(); mb.push(M4.T(0.45, 0.4, 0)); mb.rbox(0.15, 0.4, 0.12, 0.05, o.color || '#ffffff'); mb.pop(); }) }] }),
  trophy: o => ({ parts: [{ g: cgeo('trophy', mb => { mb.box(1.0, 0.3, 1.0, '#5b3a1e', { base: true }); mb.push(M4.T(0, 0.3, 0)); mb.cyl(0.15, 0.15, 0.6, 8, '#f5c518'); mb.push(M4.T(0, 0.6, 0)); mb.cyl(0.25, 0.65, 0.9, 14, '#f5c518', { flat: false }); for (const s of [-1, 1]) { mb.push(M4.T(s * 0.7, 0.5, 0)); mb.rbox(0.2, 0.5, 0.15, 0.07, '#f5c518'); mb.pop(); } mb.pop(); mb.pop(); }), e: 0.2 }] }),
  crown: o => ({ parts: [{ g: cgeo('crownprop', mb => { mb.cyl(0.7, 0.7, 0.4, 12, '#f5c518'); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; mb.push(M4.T(Math.sin(a) * 0.62, 0.4, Math.cos(a) * 0.62)); mb.cyl(0.15, 0, 0.4, 4, '#f5c518'); mb.pop(); } }), e: 0.25 }] }),
  star: o => ({ parts: [{ g: cgeo('star3d|' + (o.color || '#ffd23f'), mb => { const c = col(o.color || '#ffd23f'), pts = []; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? 0.45 : 1.1; pts.push([Math.sin(a) * r, Math.cos(a) * r]); } mb.push(M4.T(0, 1.2, 0)); for (let i = 0; i < 10; i++) { const p = pts[i], q = pts[(i + 1) % 10]; mb.tri([0, 0, 0.3], [p[0], p[1], 0.12], [q[0], q[1], 0.12], c); mb.tri([0, 0, -0.3], [q[0], q[1], -0.12], [p[0], p[1], -0.12], c); mb.quad([p[0], p[1], -0.12], [q[0], q[1], -0.12], [q[0], q[1], 0.12], [p[0], p[1], 0.12], c); } mb.pop(); }), e: 0.25 }] }),
  bed: o => ({ parts: [{ g: cgeo('bed|' + (o.color || '#4f8ef7'), mb => { mb.push(M4.T(0, 0.6, 0)); mb.rbox(3.6, 1.2, 6.2, 0.12, '#8b5a2b'); mb.push(M4.T(0, 0.75, 0.1)); mb.rbox(3.3, 0.45, 5.8, 0.18, '#ffffff'); mb.push(M4.T(0, 0.2, 0.8)); mb.rbox(3.4, 0.25, 4.0, 0.12, o.color || '#4f8ef7'); mb.pop(); mb.push(M4.T(0, 0.3, -2.2)); mb.rbox(2.4, 0.4, 1.0, 0.2, '#ffffff'); mb.pop(); mb.pop(); mb.push(M4.T(0, 0.7, -3.0)); mb.rbox(3.6, 2.6, 0.3, 0.1, '#8b5a2b'); mb.pop(); mb.pop(); }) }] }),
  chair: o => ({ parts: [{ g: cgeo('chair|' + (o.color || '#c0392b'), mb => { const c = o.color || '#c0392b'; mb.push(M4.T(0, 1.0, 0)); mb.rbox(1.8, 0.22, 1.8, 0.06, c); mb.pop(); mb.push(M4.T(0, 2.0, -0.82)); mb.rbox(1.8, 2.0, 0.2, 0.06, c); mb.pop(); for (const [x, z] of [[0.75, 0.75], [-0.75, 0.75], [0.75, -0.75], [-0.75, -0.75]]) { mb.push(M4.T(x, 0.5, z)); mb.box(0.18, 1.0, 0.18, '#555'); mb.pop(); } }) }] }),
  table: o => ({ parts: [{ g: cgeo('table|' + (o.color || '#c08552') + '|' + (o.w || 4) + '|' + (o.d || 2.6), mb => { mb.push(M4.T(0, 2.3, 0)); mb.rbox(o.w || 4, 0.25, o.d || 2.6, 0.06, o.color || '#c08552'); mb.pop(); for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { mb.push(M4.T(x * ((o.w || 4) / 2 - 0.3), 1.1, z * ((o.d || 2.6) / 2 - 0.3))); mb.box(0.22, 2.2, 0.22, '#7a4a24'); mb.pop(); } }) }] }),
  desk: o => PROPS.table({ w: 3.2, d: 2.0, color: '#d9a066' }),
  bench: o => ({ parts: [{ g: cgeo('bench', mb => { for (let i = 0; i < 3; i++) { mb.push(M4.T(0, 1.0, -0.35 + i * 0.36)); mb.box(4.4, 0.16, 0.3, '#b5713c'); mb.pop(); } for (let i = 0; i < 2; i++) { mb.push(M4.chain(M4.T(0, 1.8 + i * 0.4, -0.75), M4.RX(-0.15))); mb.box(4.4, 0.28, 0.14, '#b5713c'); mb.pop(); } for (const s of [-1, 1]) { mb.push(M4.T(s * 1.9, 0.5, 0)); mb.box(0.2, 1.0, 1.2, '#3b3b3b'); mb.pop(); mb.push(M4.T(s * 1.9, 1.5, -0.8)); mb.box(0.2, 1.2, 0.15, '#3b3b3b'); mb.pop(); } }) }] }),
  snowman: o => ({ parts: [{ g: cgeo('snowman|' + (o.scarf || '#d62839'), mb => {
    const P = (x, y, z, f, r = M4.I()) => { mb.push(M4.mul(M4.T(x, y, z), r)); f(); mb.pop(); };
    P(0, 1.0, 0, () => mb.sphere(1.05, 2, '#f7fbff')); P(0, 2.55, 0, () => mb.sphere(0.78, 2, '#f7fbff')); P(0, 3.65, 0, () => mb.sphere(0.56, 2, '#f7fbff'));
    for (const x of [-0.2, 0.2]) P(x, 3.78, 0.5, () => mb.sphere(0.08, 1, '#111111'));
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.32; P(Math.sin(a) * 0.32, 3.42 - Math.cos(a) * 0.08 + 0.08, 0.5, () => mb.sphere(0.05, 1, '#111111')); }
    P(0, 3.62, 0.62, () => mb.cyl(0.08, 0.0, 0.5, 8, '#f08a24', { flat: false }), M4.RX(Math.PI / 2));
    for (const y of [2.4, 2.75, 1.0]) P(0, y, 0.78 + (y < 2 ? 0.28 : 0), () => mb.sphere(0.07, 1, '#111111'));
    P(0, 3.15, 0, () => mb.cyl(0.62, 0.62, 0.2, 14, o.scarf || '#d62839'));
    for (const sd of [-1, 1]) P(sd * 1.2, 2.75, 0, () => mb.box(1.3, 0.09, 0.09, '#5a3a22'), M4.RZ(sd * 0.45));
  }) }] }),
  tree: o => ({ parts: [{ g: cgeo('tree|' + (o.v || 0), mb => setTree(mb, 0, 0, 1, o.v || 0)) }] }),
  pine: o => ({ parts: [{ g: cgeo('pine', mb => setPine(mb, 0, 0, 1)) }] }),
  bush: o => ({ parts: [{ g: cgeo('bush', mb => setBush(mb, 0, 0, 1)) }] }),
  rock: o => ({ parts: [{ g: cgeo('rock', mb => { mb.push(M4.T(0, 0.4, 0)); mb.sphere(1.0, 1, '#9aa0a6', { flat: true, jit: 0.4, sy: 0.6, seed: 11 }); mb.pop(); }) }] }),
  flower: o => ({ parts: [{ g: cgeo('flower|' + (o.color || '#ff5c8a'), mb => setFlower(mb, 0, 0, o.color || '#ff5c8a')) }] }),
  lamp: o => ({ parts: [{ g: cgeo('lamppost', mb => setLampPost(mb, null)) }, { g: cgeo('lampbulb', mb => { mb.push(M4.T(0, 6.6, 0)); mb.sphere(0.45, 1, '#fff3b0'); mb.pop(); }), e: 0.9 }] }),
  fence: o => ({ parts: [{ g: cgeo('fence|' + (o.len || 8), mb => setFence(mb, -(o.len || 8) / 2, 0, (o.len || 8) / 2, 0)) }] }),
  car: o => ({ parts: [{ g: cgeo('car|' + (o.color || '#e63946'), mb => setCar(mb, o.color || '#e63946')) }] }),
  bus: o => ({ parts: [{ g: cgeo('bus', mb => { mb.push(M4.T(0, 2.4, 0)); mb.rbox(4.6, 3.8, 12, 0.5, '#ffc300'); mb.pop(); for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { mb.push(M4.T(s * 2.32, 3.2, -4.4 + i * 2.1)); mb.box(0.05, 1.3, 1.6, '#9fd7ff'); mb.pop(); } mb.push(M4.T(0, 3.0, 6.02)); mb.box(3.8, 1.6, 0.05, '#9fd7ff'); mb.pop(); for (const [x, z] of [[2.2, 3.8], [-2.2, 3.8], [2.2, -3.8], [-2.2, -3.8]]) { mb.push(M4.chain(M4.T(x, 0.85, z), M4.RZ(Math.PI / 2))); mb.cyl(0.85, 0.85, 0.5, 14, '#222', { flat: false }); mb.pop(); } }) }] }),
  umbrella: o => ({ parts: [{ g: cgeo('umbrella|' + (o.color || '#e63946'), mb => { mb.cyl(0.08, 0.08, 4.4, 6, '#ddd'); mb.push(M4.T(0, 3.6, 0)); mb.cyl(3.0, 0.08, 1.1, 12, o.color || '#e63946', { stripe: '#ffffff' }); mb.pop(); }) }] }),
  lounger: o => ({ parts: [{ g: cgeo('lounger', mb => { mb.push(M4.T(0, 0.7, 0.6)); mb.rbox(1.8, 0.25, 3.6, 0.1, '#ffd23f'); mb.pop(); mb.push(M4.chain(M4.T(0, 1.4, -1.6), M4.RX(-0.9))); mb.rbox(1.8, 0.25, 1.9, 0.1, '#ffd23f'); mb.pop(); mb.push(M4.T(0, 0.35, 0)); mb.box(1.6, 0.7, 4.0, '#ffffff'); mb.pop(); }) }] }),
  flag: o => ({ parts: [{ g: cgeo('flag|' + (o.color || '#e63946'), mb => { mb.cyl(0.1, 0.1, 7, 8, '#dddddd'); mb.push(M4.T(1.2, 6.2, 0)); mb.box(2.4, 1.5, 0.06, o.color || '#e63946'); mb.push(M4.T(0, 0, 0.01)); mb.box(2.4, 0.5, 0.07, '#ffffff'); mb.pop(); mb.pop(); }) }] }),
  tv: o => ({ parts: [{ g: cgeo('tvbody', mb => { mb.push(M4.T(0, 1.9, 0)); mb.rbox(4.2, 2.6, 0.35, 0.1, '#1b1b1b'); mb.pop(); mb.push(M4.T(0, 0.3, 0)); mb.box(1.2, 0.6, 0.6, '#333', { base: false }); mb.pop(); }) }, { g: cgeo('tvscreen', mb => { mb.push(M4.T(0, 1.9, 0.18)); mb.box(3.9, 2.3, 0.02, '#ffffff', { uv: true }); mb.pop(); }), tex: signTex(o.text || 'NEWS', { bg: o.bg || '#1e88e5', fg: '#ffffff', border: null }), e: 0.7 }] }),
  clock: o => ({ parts: [{ g: cgeo('clockbody', mb => { mb.push(M4.T(0, 1.6, -0.1)); mb.rbox(2.6, 2.6, 0.3, 1.0, '#c0392b'); mb.pop(); }) }, { g: cgeo('clockface', mb => { mb.push(M4.T(0, 1.6, 0.07)); mb.box(2.2, 2.2, 0.02, '#ffffff', { uv: true }); mb.pop(); }), tex: clockTex(o.time || '07:00', o) }] }),
  alarm: o => ({ parts: [{ g: cgeo('alarmbody', mb => { mb.push(M4.T(0, 0.75, 0)); mb.rbox(1.3, 1.3, 0.7, 0.5, '#e63946'); mb.pop(); for (const s of [-1, 1]) { mb.push(M4.T(s * 0.45, 1.55, 0)); mb.sphere(0.3, 1, '#f5c518', { sy: 0.7 }); mb.pop(); mb.push(M4.T(s * 0.4, 0.05, 0)); mb.cyl(0.08, 0.08, 0.2, 6, '#333'); mb.pop(); } }) }, { g: cgeo('alarmface', mb => { mb.push(M4.T(0, 0.75, 0.36)); mb.box(1.0, 1.0, 0.02, '#ffffff', { uv: true }); mb.pop(); }), tex: clockTex(o.time || '07:00', o) }] }),
  bell: o => ({ parts: [{ g: cgeo('bell', mb => { mb.cyl(0.9, 0.35, 1.2, 14, '#f5c518', { flat: false }); mb.push(M4.T(0, 1.2, 0)); mb.sphere(0.35, 1, '#f5c518'); mb.pop(); }), e: 0.15 }] }),
  cone: o => ({ parts: [{ g: cgeo('trafficcone', mb => { mb.box(1.0, 0.12, 1.0, '#ff7f11', { base: true }); mb.cyl(0.42, 0.08, 1.4, 12, '#ff7f11', { flat: false }); mb.push(M4.T(0, 0.55, 0)); mb.cyl(0.3, 0.26, 0.22, 12, '#ffffff', { flat: false }); mb.pop(); }) }] }),
  trash: o => ({ parts: [{ g: cgeo('trashcan', mb => { mb.cyl(0.8, 0.9, 2.0, 14, '#6c757d', { flat: false }); mb.push(M4.T(0, 2.0, 0)); mb.cyl(0.95, 0.85, 0.2, 14, '#495057', { flat: false }); mb.pop(); }) }] }),
  balloon: o => ({ parts: [{ g: cgeo('balloon|' + (o.color || '#e63946'), mb => { mb.push(M4.T(0, 4.5, 0)); mb.sphere(0.9, 2, o.color || '#e63946', { sy: 1.15 }); mb.pop(); mb.cyl(0.02, 0.02, 3.5, 3, '#eeeeee'); }), e: 0.1 }] }),
  box: o => ({ parts: [{ g: cgeo('crate', mb => { mb.push(M4.T(0, 1, 0)); mb.box(2, 2, 2, '#c08552'); for (const s of [-1, 1]) { mb.push(M4.T(0, s * 0.85, 0)); mb.box(2.06, 0.3, 2.06, '#8b5a2b'); mb.pop(); } mb.pop(); }) }] }),
  door: o => ({ parts: [{ g: cgeo('doorframe|' + (o.color || '#c0392b'), mb => { mb.push(M4.T(0, 2.0, 0)); mb.box(2.6, 4.2, 0.4, '#ffffff'); mb.push(M4.T(0, -0.1, 0.15)); mb.box(2.0, 3.8, 0.2, o.color || '#c0392b'); mb.pop(); mb.push(M4.T(0.7, -0.1, 0.32)); mb.sphere(0.14, 1, '#f5c518'); mb.pop(); mb.pop(); }) }] }),
  campfire: o => ({ parts: [{ g: cgeo('logs', mb => { for (let i = 0; i < 4; i++) { mb.push(M4.chain(M4.T(0, 0.25, 0), M4.RY(i * Math.PI / 4), M4.RZ(Math.PI / 2), M4.T(0, -1, 0))); mb.cyl(0.22, 0.22, 2, 7, '#6b3e26'); mb.pop(); } }) }, { g: cgeo('flames', mb => { mb.push(M4.T(0, 0.3, 0)); mb.cyl(0.7, 0, 1.6, 6, '#ff7f11'); mb.push(M4.T(0, 0.1, 0)); mb.cyl(0.4, 0, 1.2, 5, '#ffd23f'); mb.pop(); mb.pop(); }), e: 1 }] }),
  sandcastle: o => ({ parts: [{ g: cgeo('sandcastle', mb => { mb.box(3, 1, 3, '#e8c97a', { base: true }); for (const [x, z] of [[1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2]]) { mb.push(M4.T(x, 0, z)); mb.cyl(0.5, 0.5, 2.0, 8, '#e8c97a'); mb.push(M4.T(0, 2, 0)); mb.cyl(0.55, 0, 0.7, 8, '#d9b45f'); mb.pop(); mb.pop(); } mb.push(M4.T(0, 1, 0)); mb.cyl(0.8, 0.8, 1.6, 8, '#e8c97a'); mb.pop(); }) }] }),
  palm: o => ({ parts: [{ g: cgeo('palm', mb => setPalm(mb, 0, 0, 1)) }] }),
  mailbox: o => ({ parts: [{ g: cgeo('mailbox', mb => setMailbox(mb)) }] }),
  pool: o => ({ parts: [{ g: cgeo('poolrim|' + (o.w || 10) + '|' + (o.d || 6), mb => setPoolRim(mb, o.w || 10, o.d || 6)) }, { g: cgeo('poolwater|' + (o.w || 10) + '|' + (o.d || 6), mb => { mb.push(M4.T(0, 0.35, 0)); mb.hquad(o.w || 10, o.d || 6, '#3ec1ff'); mb.pop(); }), a: 0.82, e: 0.1, sh: false, water: 1 }] }),
  flashlight: o => ({ parts: [{ g: cgeo('flbody', mb => { mb.cyl(0.22, 0.22, 1.0, 10, '#2b2b2b', { flat: false }); mb.push(M4.T(0, 1.0, 0)); mb.cyl(0.22, 0.34, 0.3, 10, '#555555', { flat: false }); mb.pop(); }) }, { g: cgeo('flhead', mb => { mb.push(M4.T(0, 1.31, 0)); mb.disc(0.32, 12, '#fff6b0'); mb.pop(); }), e: 1 }, { g: cgeo('flbeam', mb => { mb.push(M4.T(0, 1.33, 0)); mb.cyl(0.32, 2.3, 12, 20, '#ffe9a0', { flat: false, cap: false }); mb.pop(); }), e: 1, a: 0.32, sh: false, add: true }] }),
  blanket: o => { const w = o.w || 3.5, d = o.d || 4.2, c = o.color || '#e76f51'; return { parts: [{ g: cgeo(`blanket|${c}|${w}|${d}`, mb => { mb.rbox(w, 0.55, d, 0.25, c); mb.push(M4.T(0, 0.01, -d / 2 + 0.35)); mb.rbox(w + 0.06, 0.56, 0.62, 0.2, '#ffffff'); mb.pop(); }) }] }; },
  controller: o => ({ parts: [{ g: cgeo('controller|' + (o.color || '#2b2d42'), mb => { const c = o.color || '#2b2d42'; mb.push(M4.T(0, 0.3, 0)); mb.rbox(1.5, 0.32, 0.8, 0.14, c); for (const s of [-1, 1]) { mb.push(M4.chain(M4.T(s * 0.62, -0.02, 0.34), M4.RY(s * 0.35))); mb.rbox(0.46, 0.3, 0.8, 0.15, c); mb.pop(); } for (const s of [-1, 1]) { mb.push(M4.T(s * 0.26, 0.17, 0.12)); mb.cyl(0.13, 0.13, 0.1, 8, '#4a4e69'); mb.pop(); } mb.push(M4.T(-0.5, 0.16, -0.12)); mb.box(0.3, 0.06, 0.1, '#ced4da'); mb.box(0.1, 0.06, 0.3, '#ced4da'); mb.pop(); for (const [x, z, k] of [[0.5, -0.24, '#ffd23f'], [0.62, -0.12, '#e63946'], [0.38, -0.12, '#1e88e5'], [0.5, 0.0, '#2ecc71']]) { mb.push(M4.T(x, 0.17, z)); mb.cyl(0.06, 0.06, 0.06, 8, k); mb.pop(); } mb.pop(); }) }] }),
  console: o => ({ parts: [{ g: cgeo('gameconsole|' + (o.color || '#1b1b1b'), mb => { mb.push(M4.T(0, 0.3, 0)); mb.rbox(2.2, 0.6, 1.5, 0.12, o.color || '#1b1b1b'); mb.pop(); }) }, { g: cgeo('consolelight|' + (o.light || '#4fc3f7'), mb => { mb.push(M4.T(0, 0.3, 0.76)); mb.box(1.6, 0.06, 0.02, o.light || '#4fc3f7'); mb.pop(); }), e: 1 }] }),
  keys: o => ({ parts: [{ g: cgeo('keys|' + JSON.stringify([o.oct, o.hi, o.hi2, o.hiColor, o.hi2Color, o.stand, o.upright, o.body, o.h]), mb => keysGeo(mb, o)) }] }),
  piano: o => PROPS.keys({ upright: true, oct: 3, ...o }),
  stool: o => ({ parts: [{ g: cgeo('stool|' + (o.color || '#3b3b3b'), mb => { mb.push(M4.T(0, 1.0, 0)); mb.cyl(0.85, 0.85, 0.22, 14, o.color || '#3b3b3b', { flat: false }); mb.pop(); mb.push(M4.T(0, 0.5, 0)); mb.cyl(0.14, 0.14, 1.0, 8, '#777'); mb.pop(); mb.cyl(0.6, 0.6, 0.08, 12, '#555'); }) }] }),
  panel: o => ({ parts: [{ g: cgeo('elevpanelbox', mb => { mb.push(M4.T(0, 1.5, 0)); mb.box(1.3, 2.85, 0.08, '#ffffff', { uv: true }); mb.pop(); }), tex: panelTex(o.lit || []), e: o.e ?? 0.35 }] }),
  display: o => ({ parts: [{ g: cgeo('elevdisplay|' + (o.w || 1.8) + '|' + (o.h || 1.1), mb => { mb.push(M4.T(0, (o.h || 1.1) / 2, 0)); mb.box(o.w || 1.8, o.h || 1.1, 0.08, '#ffffff', { uv: true }); mb.pop(); }), tex: signTex(String(o.text ?? ''), { bg: '#0b0b0b', fg: o.fg || '#ff3b30', border: o.border || '#3a3a3a', tw: 256, th: Math.round(256 * (o.h || 1.1) / (o.w || 1.8)) }), e: o.e ?? 1 }] }),
  tower: o => { const n = o.floors || 10, w = o.w || 14, d = o.d || 12, fh = 3.4, H = n * fh + 1.2, body = o.color || '#8d99ae', R = rng(hash(String(n) + body)); return { parts: [
    { g: cgeo('tower|' + n + '|' + w + '|' + body, mb => { mb.push(M4.T(0, H / 2, 0)); mb.box(w, H, d, body); mb.pop(); mb.push(M4.T(0, H + 0.35, 0)); mb.box(w + 0.6, 0.7, d + 0.6, shade(body, 0.8)); mb.pop(); mb.push(M4.T(0, 1.6, d / 2 + 0.1)); mb.box(3.2, 3.2, 0.2, '#2b2d42'); mb.pop(); mb.push(M4.T(0, 3.5, d / 2 + 0.6)); mb.box(4.4, 0.25, 1.2, shade(body, 0.7)); mb.pop();
      for (let f = 0; f < n; f++) { mb.push(M4.T(0, (f + 1) * fh + 0.6, d / 2 + 0.06)); mb.box(w + 0.1, 0.18, 0.12, shade(body, 0.85)); mb.pop(); } }) },
    { g: cgeo('towerwin|' + n + '|' + w + '|' + body + '|dark', mb => { const cols = Math.floor(w / 2.6); for (let f = 0; f < n; f++) for (let c = 0; c < cols; c++) { if (f === 0 && Math.abs(-w / 2 + (c + 0.5) * w / cols) < 2.2) continue; if (R() < (o.lit ?? 0.35)) continue; mb.push(M4.T(-w / 2 + (c + 0.5) * w / cols, f * fh + 2.2, d / 2 + 0.05)); mb.box(1.5, 1.7, 0.1, '#25324a'); mb.pop(); } }) },
    { g: cgeo('towerwin|' + n + '|' + w + '|' + body + '|lit', mb => { const R2 = rng(hash(String(n) + body)), cols = Math.floor(w / 2.6); for (let f = 0; f < n; f++) for (let c = 0; c < cols; c++) { if (f === 0 && Math.abs(-w / 2 + (c + 0.5) * w / cols) < 2.2) continue; if (!(R2() < (o.lit ?? 0.35))) continue; mb.push(M4.T(-w / 2 + (c + 0.5) * w / cols, f * fh + 2.2, d / 2 + 0.05)); mb.box(1.5, 1.7, 0.1, '#ffe8a3'); mb.pop(); } }), e: 1 }] }; },
  ghostfloors: o => { const n = o.floors || 3, w = o.w || 14, d = o.d || 12, fh = 3.4; return { parts: [
    { g: cgeo('ghost|' + n + '|' + w, mb => { mb.push(M4.T(0, n * fh / 2, 0)); mb.box(w - 0.4, n * fh, d - 0.4, '#2b2140'); mb.pop(); mb.push(M4.T(0, n * fh + 0.3, 0)); mb.box(w + 0.2, 0.6, d + 0.2, '#1c1530'); mb.pop(); const cols = Math.floor(w / 2.6); for (let f = 0; f < n; f++) for (let c = 0; c < cols; c++) { if (f === n - 1 && c === Math.floor(cols / 2)) continue; mb.push(M4.T(-w / 2 + (c + 0.5) * w / cols, f * fh + 1.8, d / 2 - 0.15)); mb.box(1.5, 1.7, 0.1, '#120d1f'); mb.pop(); } }) },
    { g: cgeo('ghostwin|' + n + '|' + w, mb => { const cols = Math.floor(w / 2.6); mb.push(M4.T(-w / 2 + (Math.floor(cols / 2) + 0.5) * w / cols, (n - 1) * fh + 1.8, d / 2 - 0.15)); mb.box(1.5, 1.7, 0.1, o.glow || '#ff2a2a'); mb.pop(); }), e: 1 }] }; },
  pen: o => { const w = o.w || 7, d = o.d || 5, wood = o.color || '#c08552'; return { parts: [{ g: cgeo('pen|' + w + '|' + d + '|' + wood, mb => {
    mb.push(M4.T(0, 0.06, 0)); mb.box(w, 0.12, d, '#e9d27a'); mb.pop();
    const R = rng(7); for (let i = 0; i < 26; i++) { mb.push(M4.chain(M4.T((R() - 0.5) * (w - 0.6), 0.14, (R() - 0.5) * (d - 0.6)), M4.RY(R() * 3))); mb.box(0.7, 0.04, 0.06, '#d4b24c'); mb.pop(); }
    for (const [x, z, lw, ld] of [[0, -d / 2, w, 0.16], [0, d / 2, w, 0.16], [-w / 2, 0, 0.16, d], [w / 2, 0, 0.16, d]]) for (const y of [0.35, 0.8]) { mb.push(M4.T(x, y, z)); mb.box(lw, 0.22, ld, wood); mb.pop(); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { mb.push(M4.T(sx * w / 2, 0.5, sz * d / 2)); mb.box(0.24, 1.0, 0.24, shade(wood, 0.8)); mb.pop(); }
    if (o.hut !== false) { mb.push(M4.T(-w / 2 + 1.1, 0, -d / 2 + 1.0)); mb.push(M4.T(0, 0.55, 0)); mb.box(1.6, 1.1, 1.4, '#a0622d'); mb.pop(); mb.push(M4.T(0, 1.1, 0)); mb.prism(1.9, 0.7, 1.7, '#7a4a22'); mb.pop(); mb.push(M4.T(0, 0.42, 0.71)); mb.box(0.7, 0.75, 0.04, '#3b2412'); mb.pop(); mb.pop(); }
    mb.push(M4.T(w / 2 - 1.0, 0.2, d / 2 - 0.9)); mb.cyl(0.45, 0.4, 0.25, 12, '#4f8ef7'); mb.pop();
  }) }] }; },
  smartphone: o => ({ parts: [{ g: cgeo('smartphonebody', mb => { mb.push(M4.T(0, 2.2, 0)); mb.rbox(2.25, 4.45, 0.22, 0.25, '#111114'); mb.pop(); }) }, { g: cgeo('smartphonescreen', mb => { mb.push(M4.T(0, 2.2, 0.115)); mb.box(2.0, 4.0, 0.01, '#ffffff', { uv: true }); mb.pop(); }), tex: chatTex(o), e: o.e ?? 0.95 }] }),
  pebble: o => ({ parts: [{ g: cgeo('pebble|' + (o.color || '#8d939b'), mb => { mb.push(M4.T(0, 0.22, 0)); mb.rbox(0.62, 0.42, 0.5, 0.18, o.color || '#8d939b'); mb.pop(); mb.push(M4.T(-0.1, 0.36, 0.12)); mb.box(0.16, 0.06, 0.12, shade(o.color || '#8d939b', 1.3)); mb.pop(); }) }] }),
  nest: o => { const n = o.n || (o.big ? 46 : 22), R0 = o.r || 1.25; return { parts: [{ g: cgeo('nest|' + n + '|' + R0 + '|' + !!o.big + '|' + !!o.egg, mb => {
    const R = rng(n * 7 + (o.big ? 3 : 0)), cols = ['#7d838c', '#959ba3', '#6b7078', '#a3a8ae', '#858a91'];
    for (let i = 0; i < n; i++) { const layer = o.big ? Math.floor(i / 18) : 0, a = R() * 6.283, r = R0 * (0.55 + 0.45 * R()) - layer * 0.25, sz = 0.32 + R() * 0.22;
      mb.push(M4.chain(M4.T(Math.cos(a) * r, 0.14 + layer * 0.3, Math.sin(a) * r), M4.RY(R() * 3))); mb.rbox(sz * 1.3, sz * 0.8, sz, sz * 0.3, cols[i % cols.length]); mb.pop(); }
    if (o.egg) { mb.push(M4.T(0, 0.4, 0)); mb.sphere(0.32, 1, '#f5f0e6', { sy: 1.3 }); mb.pop(); }
  }) }] }; },
  cutboard: o => ({ parts: [{ g: cgeo('cutboard|' + (o.w || 6) + '|' + (o.d || 3.6) + '|' + (o.color || '#c8955a'), mb => { const w = o.w || 6, d = o.d || 3.6, c = o.color || '#c8955a'; mb.push(M4.T(0, 0.15, 0)); mb.rbox(w, 0.3, d, 0.08, c); mb.pop(); for (let i = 0; i < 6; i++) { mb.push(M4.T(0, 0.305, -d / 2 + 0.35 + i * (d - 0.7) / 5)); mb.box(w - 0.4, 0.01, 0.03, shade(c, 0.9)); mb.pop(); } }) }] }),
  tray: o => ({ parts: [{ g: cgeo('tray|' + (o.w || 7) + '|' + (o.d || 4.4), mb => { const w = o.w || 7, d = o.d || 4.4; mb.push(M4.T(0, 0.04, 0)); mb.box(w, 0.08, d, '#b9c0c7'); mb.pop(); for (const [x, z, lw, ld] of [[0, -d / 2, w, 0.12], [0, d / 2, w, 0.12], [-w / 2, 0, 0.12, d], [w / 2, 0, 0.12, d]]) { mb.push(M4.T(x, 0.16, z)); mb.box(lw, 0.24, ld, '#d5dbe0'); mb.pop(); } }) }] }),
  cabbage: o => ({ parts: [{ g: cgeo('cabbage|' + (o.color || '#6a2c70'), mb => { const c = o.color || '#6a2c70'; mb.push(M4.T(0, 1.0, -0.5)); mb.sphere(1.25, 2, c, { sz: 0.55 }); mb.pop();
    const rings = [[1.18, c], [1.02, '#efe1f0'], [0.9, '#8a3a91'], [0.76, '#f3e7f4'], [0.62, '#7a2f80'], [0.48, '#efe1f0'], [0.34, '#93449a'], [0.2, '#f6eef7']];
    rings.forEach(([r, col], i) => { mb.push(M4.chain(M4.T(0, 1.0, 0.19 + i * 0.012), M4.RX(Math.PI / 2))); mb.cyl(r, r, 0.02, 20, col); mb.pop(); }); }) }] }),
  shreds: o => { const n = o.n || 150, r = o.r || 1.4, c = o.color || '#7b2d8b', c2 = o.color2 || shade(c, 1.35); return { parts: [{ g: cgeo('shreds|' + n + '|' + r + '|' + c, mb => { const R = rng(n + Math.round(r * 10));
    for (let i = 0; i < n; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * r, h = (1 - d / r) * r * 0.55 * (0.6 + 0.4 * R()); mb.push(M4.chain(M4.T(Math.cos(a) * d, 0.04 + h, Math.sin(a) * d * 0.8), M4.RY(R() * 6.283), M4.RZ((R() - 0.5) * 0.5))); mb.box(0.03 + R() * 0.025, 0.025, 0.35 + R() * 0.55, i % 3 ? c : c2); mb.pop(); } }) }] }; },
  radish: o => ({ parts: [{ g: cgeo('radish|' + (o.len || 2.4), mb => { const L = o.len || 2.4; mb.cyl(0.42, 0.38, L, 16, '#f5f2e8', { flat: false, top: '#e9f2dc' }); mb.push(M4.T(0, L, 0)); mb.cyl(0.3, 0.3, 0.05, 14, '#a8c97f'); mb.pop(); }) }] }),
  meat: o => ({ parts: [{ g: cgeo('meatroll|' + (o.len || 3.2), mb => { const L = o.len || 3.2; mb.push(M4.chain(M4.T(L / 2, 0.95, 0), M4.RZ(Math.PI / 2))); mb.cyl(0.95, 0.95, L, 22, '#e7a3a0', { flat: false }); mb.pop();
    for (const [r, col] of [[0.95, '#f4d7d3'], [0.8, '#e08f8c'], [0.62, '#f3d3cf'], [0.5, '#d97f7c'], [0.3, '#f0c8c3']]) { mb.push(M4.chain(M4.T(L / 2 + 0.02 + (0.95 - r) * 0.02, 0.95, 0), M4.RZ(Math.PI / 2))); mb.cyl(r, r, 0.02, 22, col); mb.pop(); } }) }] }),
  meatslice: o => ({ parts: [{ g: cgeo('meatslice', mb => { mb.push(M4.T(0, 0.05, 0)); mb.cyl(0.95, 0.95, 0.1, 22, '#e7a3a0', { flat: false, top: '#e9a8a5' }); mb.pop(); for (const [r, col] of [[0.8, '#f4d7d3'], [0.66, '#e29895'], [0.42, '#f3d3cf']]) { mb.push(M4.T(0, 0.105, 0)); mb.cyl(r, r, 0.01, 22, col); mb.pop(); } }) }] }),
  helper: o => ({ parts: [{ g: cgeo('kitchenhelper', mb => { mb.push(M4.T(0, -0.55, 0)); mb.rbox(0.26, 1.2, 0.3, 0.1, '#8a5a34'); mb.pop(); mb.push(M4.T(0, 0.12, 0)); mb.box(0.18, 0.2, 0.22, '#9aa1a8'); mb.pop();
    mb.push(M4.T(0, 0.42, 0)); mb.box(1.1, 0.42, 0.06, '#d9dee3'); mb.pop(); for (let i = 0; i < 9; i++) { mb.push(M4.T(-0.48 + i * 0.12, 0.68, 0)); mb.box(0.05, 0.12, 0.05, '#c3c9cf'); mb.pop(); } mb.push(M4.T(0, 0.42, 0.035)); mb.box(0.9, 0.05, 0.01, '#7d858d'); mb.pop(); }) }] }),
  tunnel: o => ({ parts: [{ g: cgeo('tunnel2', mb => {
    const rock = '#7d8590', con = '#c4c8ce', sn = '#f4f7fb';
    mb.push(M4.chain(M4.T(0, 0, -8), M4.S(1.7, 1, 1))); mb.sphere(10, 2, rock); mb.pop();
    mb.push(M4.chain(M4.T(0, 6.2, -9.2), M4.S(1.5, 0.55, 1))); mb.sphere(8.4, 2, sn); mb.pop();
    T_(mb, -3.5, 3.4, 2.8, () => mb.box(1.3, 6.8, 1.8, con)); T_(mb, 3.5, 3.4, 2.8, () => mb.box(1.3, 6.8, 1.8, con));
    T_(mb, 0, 7.3, 2.8, () => mb.box(8.4, 1.3, 2.0, con)); T_(mb, 0, 3.2, 2.15, () => mb.box(5.8, 6.4, 0.5, '#07090d'));
    T_(mb, 0, 0.03, 9.0, () => mb.box(5.6, 0.06, 13, '#3a3d44'));
    for (let i = 0; i < 5; i++) T_(mb, 0, 0.07, 4.4 + i * 2.4, () => mb.box(0.18, 0.02, 1.1, '#ffd23f'));
  }) }] }),
  airdrop: o => ({ parts: [{ g: cgeo('airdrop|' + (o.color || '#2a9d8f') + '|' + (o.balloon === false ? 0 : 1), mb => {
    const c = o.color || '#2a9d8f', e = '#ffd23f';
    T_(mb, 0, 1.1, 0, () => mb.rbox(2.2, 2.2, 2.2, 0.12, c));
    for (const y of [0.25, 1.95]) T_(mb, 0, y, 0, () => mb.box(2.28, 0.22, 2.28, e));
    for (const x of [-1, 1]) for (const z of [-1, 1]) T_(mb, x * 1.05, 1.1, z * 1.05, () => mb.box(0.22, 2.24, 0.22, e));
    T_(mb, 0, 1.1, 1.13, () => mb.box(0.9, 0.9, 0.06, '#ffffff'));
    if (o.balloon !== false) { for (const x of [-0.8, 0.8]) T_(mb, x, 2.2, 0, () => mb.cyl(0.02, 0.02, 3.2, 3, '#eeeeee')); T_(mb, 0, 6.3, 0, () => mb.sphere(1.25, 2, o.balloonColor || '#e63946', { sy: 1.15 })); }
  }), e: 0.05 }] }),
  pickaxe: o => ({ parts: [{ g: cgeo('pickaxe|' + (o.color || '#4cc9f0'), mb => {
    const c = o.color || '#4cc9f0';
    T_(mb, 0, -0.5, 0, () => mb.cyl(0.09, 0.09, 2.3, 8, '#5b3a1e', { flat: false }));
    T_(mb, 0, -0.55, 0, () => mb.cyl(0.12, 0.12, 0.5, 8, '#2b2b2b', { flat: false }));
    T_(mb, 0, 1.85, 0, () => mb.rbox(0.36, 0.42, 0.36, 0.08, '#2b2b2b'));
    for (const sx of [-1, 1]) { mb.push(M4.chain(M4.T(sx * 0.62, 1.78, 0), M4.RZ(sx * -0.28))); mb.rbox(1.0, 0.28, 0.26, 0.08, c); mb.pop();
      mb.push(M4.chain(M4.T(sx * 1.2, 1.55, 0), M4.RZ(sx * -0.75))); mb.rbox(0.42, 0.2, 0.2, 0.06, shade(c, 1.25)); mb.pop(); }
  }) }] }),
  buildwall: o => ({ parts: [{ g: cgeo('buildwall|' + (o.ramp ? 1 : 0), mb => {
    const w = '#c8935a', d = '#8b5a2b';
    mb.push(M4.chain(M4.T(0, o.ramp ? 0 : 2.1, 0), M4.RX(o.ramp ? -0.75 : 0), M4.T(0, o.ramp ? 2.1 : 0, 0)));
    for (let i = 0; i < 4; i++) T_(mb, 0, -1.6 + i * 1.07, 0, () => mb.box(4.1, 0.95, 0.22, i % 2 ? w : shade(w, 0.92)));
    for (const x of [-2.0, 2.0]) T_(mb, x, 0, 0.05, () => mb.box(0.28, 4.3, 0.34, d));
    T_(mb, 0, 0, 0.05, () => mb.box(4.2, 0.26, 0.34, d));
    mb.pop();
  }) }] }),
  stormwall: o => ({ parts: [{ g: cgeo('stormwall|' + (o.r || 30), mb => { mb.cyl(o.r || 30, o.r || 30, o.h || 40, 48, '#9d4edd', { flat: false, cap: false }); }), e: 0.7, a: o.a || 0.38, sh: false }] }),
  islandmap: o => ({ parts: [{ g: cgeo('islandmap|' + (o.storm || 5), mb => {
    T_(mb, 0, 0.02, 0, () => mb.cyl(10, 10, 0.06, 40, '#2a6fdb'));
    T_(mb, 0, 0.06, 0, () => mb.cyl(7.6, 7.2, 0.25, 22, '#e9d8a6'));
    T_(mb, 0, 0.2, 0, () => mb.cyl(7.0, 6.6, 0.3, 22, '#55a630'));
    for (const [x, z, r, c] of [[-3, -2, 1.6, '#2d6a4f'], [2.5, 2.8, 1.3, '#2d6a4f'], [3, -3, 1.0, '#b08968'], [-2.4, 3.2, 1.1, '#adb5bd']]) T_(mb, x, 0.45, z, () => mb.cyl(r, r, 0.12, 14, c));
    for (const [x, z] of [[-0.5, 0.5], [0.4, -0.2], [1.2, 0.8], [-3.1, 3.3], [3.2, -2.9]]) T_(mb, x, 0.75, z, () => mb.box(0.45, 0.6, 0.45, '#f1faee'));
  }) }, { g: cgeo('islandstorm|' + (o.storm || 5), mb => { const r = o.storm || 5; T_(mb, o.sx || 0.8, 0, o.sz || -0.4, () => mb.cyl(r, r, 1.6, 40, '#9d4edd', { flat: false, cap: false })); }), e: 0.8, a: 0.55, sh: false }] }),
  // Klassenarbeit/Test-Blatt mit Note (grade, gradeColor), liegend (Standard) oder stehend (up: true); crumpled: true = zerknüllte Papierkugel
  paper: o => {
    if (o.crumpled) return { parts: [{ g: cgeo('paperball', mb => { mb.push(M4.T(0, 0.32, 0)); mb.sphere(0.32, 1, '#f2f0ea', { jit: 0.35, seed: 5, flat: true }); mb.pop(); }) }] };
    const gr = o.grade || '', gc = o.gradeColor || (/^[AB]/.test(gr) ? '#1f8a3b' : '#d62828'), w = o.w || 1.3, h = o.h || 1.7;
    const tex = ctex('paper|' + gr + '|' + gc + '|' + (o.marks || ''), 256, 336, (x, W, H) => {
      x.fillStyle = '#f7f5ef'; x.fillRect(0, 0, W, H); x.fillStyle = '#c9c6bd';
      for (let i = 0; i < 11; i++) { const y = 70 + i * 22; x.fillRect(24, y, i % 3 === 2 ? 120 : 200, 5); if (o.marks) { x.fillStyle = o.marks === 'x' ? '#d62828' : '#1f8a3b'; x.font = 'bold 18px sans-serif'; x.fillText(o.marks === 'x' ? '✗' : '✓', 228, y + 8); x.fillStyle = '#c9c6bd'; } }
      x.fillRect(24, 24, 90, 8);
      if (gr) { x.strokeStyle = gc; x.lineWidth = 9; x.beginPath(); x.ellipse(W - 70, 70, 52, 44, -0.1, 0, Math.PI * 2); x.stroke(); x.fillStyle = gc; x.font = 'bold 64px Poppins, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(gr, W - 70, 74); }
    });
    return { parts: [{ g: cgeo('paper|' + w + '|' + h + '|' + (o.up ? 1 : 0), mb => { if (o.up) { mb.push(M4.T(0, h / 2, 0)); mb.box(w, h, 0.02, '#ffffff', { uv: true }); } else { mb.push(M4.chain(M4.T(0, 0.02, 0), M4.RX(-Math.PI / 2))); mb.box(w, h, 0.02, '#ffffff', { uv: true }); } mb.pop(); }), tex, sh: false }] };
  },
  bigtext: o => ({ parts: [{ g: cgeo('bigtext|' + (o.w || 6) + '|' + (o.h || 2), mb => { mb.push(M4.T(0, (o.h || 2) / 2, 0)); mb.box(o.w || 6, o.h || 2, 0.1, '#ffffff', { uv: true }); mb.pop(); }), tex: signTex(o.text || '', { bg: o.bg || '#ffd23f', fg: o.fg || '#1d1712', border: o.border === undefined ? '#1d1712' : o.border, tw: 512, th: Math.round(512 * (o.h || 2) / (o.w || 6)) }) }] }),
};

// Klaviatur: oct Oktaven (+ C am Ende), hi/hi2 = markierte Tasten ("C", "E", "G", "C#", "C2", "A#2" …)
function keysGeo(mb, o) {
  const oct = o.oct || 2, nw = oct * 7 + 1, kw = 0.42, W = nw * kw, x0 = -W / 2 + kw / 2, H = o.h ?? 2.4;
  const norm = a => new Set((a || []).map(x => String(x).toUpperCase()));
  const hi = norm(o.hi), hi2 = norm(o.hi2), hc = o.hiColor || '#ffd23f', hc2 = o.hi2Color || '#4fc3f7';
  const NM = ['C', 'D', 'E', 'F', 'G', 'A', 'B'], body = o.body || (o.upright ? '#4a2c1d' : '#262626');
  const colFor = (n, ov, def) => { const a = n + (ov + 1), b = ov === 0 ? n : null; if (hi.has(a) || (b && hi.has(b))) return hc; if (hi2.has(a) || (b && hi2.has(b))) return hc2; return def; };
  mb.push(M4.T(0, H - 0.27, -0.15)); mb.rbox(W + 0.7, 0.42, 2.6, 0.08, body); mb.pop();
  if (!o.upright) { mb.push(M4.T(0, H + 0.08, -1.2)); mb.rbox(W + 0.7, 0.55, 0.5, 0.08, body); mb.pop(); for (const s of [-1, 1]) { mb.push(M4.T(s * (W / 2 + 0.2), H + 0.02, -0.15)); mb.rbox(0.3, 0.42, 2.6, 0.06, body); mb.pop(); } }
  for (let i = 0; i < nw; i++) { const n = NM[i % 7], ov = Math.floor(i / 7); mb.push(M4.T(x0 + i * kw, H, 0.15)); mb.box(kw - 0.045, 0.16, 1.7, colFor(n, ov, '#fbfbfb')); mb.pop(); }
  for (let i = 0; i < nw - 1; i++) { const n = i % 7; if (n === 2 || n === 6) continue; const ov = Math.floor(i / 7); mb.push(M4.T(x0 + i * kw + kw / 2, H + 0.13, -0.25)); mb.box(0.25, 0.2, 1.0, colFor(NM[n] + '#', ov, '#1b1b1b')); mb.pop(); }
  if (o.stand) for (const s of [-1, 1]) { const x = s * (W / 2 - 0.5); for (const d of [-1, 1]) { mb.push(M4.chain(M4.T(x, (H - 0.45) / 2, -0.15), M4.RX(d * 0.42))); mb.box(0.14, (H - 0.45) / Math.cos(0.42), 0.14, '#555555'); mb.pop(); } }
  if (o.upright) {
    mb.push(M4.T(0, 2.9, -1.95)); mb.rbox(W + 1.0, 5.8, 1.6, 0.1, body); mb.pop();
    mb.push(M4.T(0, 5.9, -1.85)); mb.rbox(W + 1.2, 0.25, 1.9, 0.08, shade(body, 1.15)); mb.pop();
    for (const s of [-1, 1]) { mb.push(M4.T(s * (W / 2 + 0.35), (H - 0.45) / 2 + 0.2, 0.5)); mb.box(0.3, H - 0.25, 0.3, body); mb.pop(); mb.push(M4.T(s * (W / 2 + 0.35), H - 0.1, -0.2)); mb.rbox(0.42, 0.7, 2.7, 0.08, body); mb.pop(); }
    mb.push(M4.T(0, H + 1.0, -1.1)); mb.box(1.6, 1.0, 0.1, '#fffaf0'); mb.pop();
    mb.push(M4.T(0, 0.15, -1.6)); mb.box(W * 0.9, 0.3, 0.5, shade(body, 0.85)); mb.pop();
  }
}

// ---------- gemeinsame Bauteile für Sets und Requisiten ----------
function setTree(mb, x, z, s = 1, v = 0) {
  mb.at(x, 0, z, 0, s);
  mb.cyl(0.4, 0.3, 3.4, 7, '#8b5a2b');
  const greens = [['#56b947', '#4aa83f'], ['#6cc551', '#5ab544'], ['#3fae5a', '#35994d']][v % 3];
  mb.push(M4.T(0, 4.6, 0)); mb.sphere(2.2, 1, greens[0], { flat: true, jit: 0.25, seed: 3 + v }); mb.pop();
  mb.push(M4.T(1.1, 3.8, 0.4)); mb.sphere(1.4, 1, greens[1], { flat: true, jit: 0.2, seed: 5 + v }); mb.pop();
  mb.push(M4.T(-1.0, 4.0, -0.3)); mb.sphere(1.5, 1, greens[1], { flat: true, jit: 0.2, seed: 7 + v }); mb.pop();
  mb.pop();
}
function setPine(mb, x, z, s = 1) {
  mb.at(x, 0, z, 0, s);
  mb.cyl(0.35, 0.3, 1.6, 6, '#7a4a24');
  mb.push(M4.T(0, 1.2, 0)); mb.cyl(2.2, 0, 3.2, 7, '#2f9e55'); mb.pop();
  mb.push(M4.T(0, 2.8, 0)); mb.cyl(1.7, 0, 2.8, 7, '#38b061'); mb.pop();
  mb.push(M4.T(0, 4.3, 0)); mb.cyl(1.2, 0, 2.4, 7, '#41bf6a'); mb.pop();
  mb.pop();
}
function setBush(mb, x, z, s = 1, c = '#4cb944') { mb.at(x, 0, z, 0, s); mb.push(M4.T(0, 0.6, 0)); mb.sphere(1.0, 1, c, { flat: true, jit: 0.25, seed: Math.floor(x * 7 + z * 3) & 255, sy: 0.8 }); mb.pop(); mb.push(M4.T(0.7, 0.45, 0.2)); mb.sphere(0.7, 1, shade(c, 1.1), { flat: true, jit: 0.2 }); mb.pop(); mb.pop(); }
function setFlower(mb, x, z, c) { mb.at(x, 0, z); mb.cyl(0.05, 0.05, 0.8, 4, '#3fa34d'); mb.push(M4.T(0, 0.85, 0)); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; mb.push(M4.T(Math.sin(a) * 0.18, 0, Math.cos(a) * 0.18)); mb.sphere(0.14, 0, c, { flat: true }); mb.pop(); } mb.sphere(0.1, 0, '#ffd23f', { flat: true }); mb.pop(); mb.pop(); }
function setFence(mb, x0, z0, x1, z1, c = '#ffffff') {
  const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2, n = Math.max(1, Math.round(L / 1.1));
  mb.push(M4.chain(M4.T(x0, 0, z0), M4.RY(ang)));
  for (let i = 0; i <= n; i++) { mb.push(M4.T(i * L / n, 0, 0)); mb.box(0.32, 1.9, 0.18, c, { base: true }); mb.push(M4.chain(M4.T(0, 1.9, 0), M4.RZ(Math.PI / 4))); mb.box(0.226, 0.226, 0.18, c); mb.pop(); mb.pop(); }
  for (const y of [0.55, 1.35]) { mb.push(M4.T(L / 2, y, -0.12)); mb.box(L, 0.2, 0.08, c); mb.pop(); }
  mb.pop();
}
function setLampPost(mb, lampMB, x = 0, z = 0) {
  mb.at(x, 0, z); mb.cyl(0.38, 0.38, 0.5, 8, '#3a3f47'); mb.cyl(0.16, 0.14, 6.2, 8, '#3a3f47'); mb.push(M4.T(0, 6.2, 0)); mb.cyl(0.55, 0.2, 0.3, 8, '#3a3f47'); mb.push(M4.T(0, 0.75, 0)); mb.cyl(0.65, 0.1, 0.4, 8, '#3a3f47'); mb.pop(); mb.pop(); mb.pop();
  if (lampMB) { lampMB.at(x, 0, z); lampMB.push(M4.T(0, 6.6, 0)); lampMB.sphere(0.45, 1, '#fff3b0'); lampMB.pop(); lampMB.pop(); }
}
function setMailbox(mb) { mb.box(0.2, 2.2, 0.2, '#7a4a24', { base: true }); mb.push(M4.T(0, 2.5, 0)); mb.rbox(0.8, 0.7, 1.2, 0.3, '#1e88e5'); mb.pop(); mb.push(M4.T(0.45, 2.8, 0.1)); mb.box(0.06, 0.6, 0.15, '#e63946'); mb.pop(); }
function setCar(mb, c) {
  mb.push(M4.T(0, 1.15, 0)); mb.rbox(3.6, 1.3, 7.2, 0.4, c); mb.pop();
  mb.push(M4.T(0, 2.2, -0.4)); mb.rbox(3.2, 1.1, 3.8, 0.35, c); mb.pop();
  mb.push(M4.T(0, 2.25, -0.4)); mb.box(3.26, 0.75, 3.3, '#a7dcff'); mb.pop();
  mb.push(M4.T(0, 2.25, -0.4)); mb.box(2.9, 0.82, 3.86, '#a7dcff'); mb.pop();
  for (const s of [-1, 1]) { mb.push(M4.T(s * 1.2, 1.25, 3.62)); mb.rbox(0.7, 0.4, 0.1, 0.1, '#fff7c2'); mb.pop(); mb.push(M4.T(s * 1.2, 1.25, -3.62)); mb.rbox(0.7, 0.35, 0.1, 0.1, '#e63946'); mb.pop(); }
  for (const [x, z] of [[1.7, 2.3], [-1.7, 2.3], [1.7, -2.3], [-1.7, -2.3]]) { mb.push(M4.chain(M4.T(x - Math.sign(x) * 0.25, 0.75, z), M4.RZ(Math.PI / 2), M4.T(0, -0.25, 0))); mb.cyl(0.75, 0.75, 0.5, 14, '#222222', { flat: false }); mb.pop(); }
}
function setPalm(mb, x, z, s = 1) {
  mb.at(x, 0, z, 0, s);
  for (let i = 0; i < 7; i++) { mb.push(M4.chain(M4.T(i * 0.18, i * 1.05, 0), M4.RZ(-0.08 * i))); mb.cyl(0.42 - i * 0.03, 0.38 - i * 0.03, 1.1, 7, i % 2 ? '#a0703a' : '#8b5e2f'); mb.pop(); }
  mb.push(M4.T(1.3, 7.3, 0));
  for (let i = 0; i < 7; i++) { mb.push(M4.chain(M4.RY(i / 7 * 6.28), M4.RZ(0.35), M4.T(1.6, 0, 0))); mb.box(3.4, 0.12, 0.9, i % 2 ? '#3fae45' : '#4cc552'); mb.pop(); }
  mb.sphere(0.35, 1, '#6b4a1e'); mb.pop(); mb.pop();
}
function setPoolRim(mb, w, d) { for (const [x, z, sx, sz] of [[0, d / 2 + 0.4, w + 1.6, 0.8], [0, -d / 2 - 0.4, w + 1.6, 0.8], [w / 2 + 0.4, 0, 0.8, d], [-w / 2 - 0.4, 0, 0.8, d]]) { mb.push(M4.T(x, 0.3, z)); mb.box(sx, 0.6, sz, '#f1f1f1'); mb.pop(); } mb.push(M4.T(0, 0.05, 0)); mb.box(w, 0.1, d, '#1f8fd6'); mb.pop(); }

// Stellflächen von Möbeln (für automatisches Abstellen von Gegenständen)
function surfOf(type, o = {}) {
  const sc = o.s || 1, S = { table: [o.w || 4, o.d || 2.6, 2.43], desk: [3.2, 2.0, 2.43], bed: [3.6, 6.2, 1.62], chair: [1.8, 1.8, 1.12], bench: [4.4, 1.0, 1.1], box: [2, 2, 2.0], lounger: [1.8, 3.6, 0.85], trash: [1.6, 1.6, 2.12] }[type];
  return S ? { w: S[0] * sc, d: S[1] * sc, top: S[2] * sc, occ: ({ chair: 3.05, bench: 2.5, bed: 2.6, lounger: 1.6 }[type] || S[2]) * sc, type } : null;
}
const SMALLP = { egg: 1, housekeys: 1, coin: 1, coins: 1, apple: 1, banana: 1, carrot: 1, ball: 1, gift: 1, cake: 1, pizza: 1, burger: 1, icecream: 1, phone: 1, book: 1, cup: 1, trophy: 1, crown: 1, star: 1, alarm: 1, clock: 1, bell: 1, flashlight: 1, controller: 1, console: 1 };
const NOJIT = { sign: 1, board: 1, banner: 1, number: 1, bigtext: 1, door: 1, fence: 1, tv: 1, car: 1, bus: 1, bed: 1, pool: 1, flag: 1, blanket: 1, table: 1, desk: 1, lamp: 1, star: 1, balloon: 1 };
const SEATP = { chair: 1, bench: 1, bed: 1, lounger: 1, table: 1, desk: 1, pool: 1, blanket: 1, car: 1, bus: 1, door: 1, fence: 1, banner: 1, bigtext: 1 };
const PROPR = { paintcan: 0.5, marbles: 1.3, xmastree: 2.2, gift: 1.0, cake: 1.1, pizza: 1.0, box: 1.5, chair: 1.3, table: 2.2, desk: 1.8, bench: 2.3, trash: 1.0, cone: 0.7, mailbox: 0.8, campfire: 1.3, sandcastle: 2.2, tree: 2.2, pine: 1.8, bush: 1.4, rock: 1.3, umbrella: 0.6, sign: 0.9, lamp: 0.6, tv: 2.2, trophy: 0.8, flag: 0.5, ball: 0.7 };
const SWAYP = { tree: 1, pine: 1, palm: 1, bush: 1, flower: 1 };
function propItems(items, type, o, M) {
  const f = PROPS[type]; if (!f) return;
  const P = f(o);
  const sway = SWAYP[type] ? 1 : 0;
  for (const p of P.parts) items.push({ g: p.g, m: M, tex: p.tex, e: p.e !== undefined ? p.e : (o.glow || 0), a: p.a !== undefined ? p.a : o.alpha, sh: p.sh !== undefined ? p.sh : true, add: p.add, tint: o.tint ? col(o.tint) : undefined, sway, water: p.water, spec: p.spec, rim: p.rim });
}
