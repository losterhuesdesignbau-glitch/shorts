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
};
function faceTex(mood, closed, open, kind = 'human') {
  const M = MOODS[mood] || MOODS.happy;
  return ctex(`face|${mood}|${closed ? 1 : 0}|${open ? 1 : 0}|${kind}`, 256, 256, (x) => {
    const A = kind !== 'human', ink = '#1d1712';
    x.lineCap = 'round'; x.lineJoin = 'round';
    if (kind === 'penguin') { x.fillStyle = '#ffffff'; ell(x, 128, 132, 92, 86); x.fill(); }
    const ey = A ? 112 : 108, dx = A ? 50 : 42, rx = A ? 18 : 13, ry = A ? 23 : 20;
    let eyes = M.e; if (closed && ['dot', 'wide', 'half', 'up', 'heart', 'wink'].includes(eyes)) eyes = 'closed';
    if (kind !== 'frog') for (const s of [-1, 1]) {
      const cx = 128 + s * dx; let e = eyes; if (e === 'wink') e = s > 0 ? 'happy' : 'dot';
      x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = A ? 7 : 6.5;
      if (e === 'dot' || e === 'up') { const oy = e === 'up' ? -6 : 0; ell(x, cx, ey + oy, rx, ry); x.fill(); hl(x, cx - rx * 0.3, ey + oy - ry * 0.38, A ? 7.5 : 5.5); if (A) hl(x, cx + rx * 0.35, ey + oy + ry * 0.35, 3.5); }
      else if (e === 'wide') { x.fillStyle = '#fff'; ell(x, cx, ey, rx + 8, ry + 6); x.fill(); x.lineWidth = 5; x.stroke(); x.fillStyle = ink; ell(x, cx, ey + 2, rx * 0.6, ry * 0.55); x.fill(); hl(x, cx - 3, ey - 4, 4); }
      else if (e === 'half') { x.save(); x.beginPath(); x.rect(cx - 40, ey - ry * 0.1, 80, 80); x.clip(); ell(x, cx, ey, rx, ry); x.fill(); x.restore(); x.lineWidth = 6; x.beginPath(); x.moveTo(cx - rx - 4, ey - ry * 0.1); x.lineTo(cx + rx + 4, ey - ry * 0.1); x.stroke(); }
      else if (e === 'closed') { x.beginPath(); x.arc(cx, ey - 8, 15, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); }
      else if (e === 'happy') { x.beginPath(); x.arc(cx, ey + 10, 15, 1.15 * Math.PI, 1.85 * Math.PI); x.stroke(); }
      else if (e === 'heart') { x.fillStyle = '#e8253f'; heartPath(x, cx, ey, 21); x.fill(); hl(x, cx - 8, ey - 6, 4); }
      else if (e === 'x') { x.beginPath(); x.moveTo(cx - 12, ey - 12); x.lineTo(cx + 12, ey + 12); x.moveTo(cx + 12, ey - 12); x.lineTo(cx - 12, ey + 12); x.stroke(); }
    }
    // Augenbrauen
    if (M.b !== 'none' && (!A || ['angry', 'sad', 'up'].includes(M.b)) && kind !== 'frog') {
      const by = ey - (A ? 42 : 37); x.lineWidth = 8; x.strokeStyle = '#2a1c12';
      for (const s of [-1, 1]) {
        const cx = 128 + s * dx; let i0 = 0, o0 = 0;
        if (M.b === 'up') { i0 = -8; o0 = -8; } else if (M.b === 'sad') { i0 = -9; o0 = 4; } else if (M.b === 'angry') { i0 = 10; o0 = -5; } else if (M.b === 'think' && s > 0) { i0 = -10; o0 = -12; }
        x.beginPath(); x.moveTo(cx - s * 15, by + i0); x.lineTo(cx + s * 15, by + o0); x.stroke();
      }
    }
    // Mund
    let m = M.m; if (open) m = (m === 'grin' || m === 'yawn') ? m : (m === 'frown' || m === 'wavy' ? 'wavyopen' : 'open');
    const my = kind === 'frog' ? 150 : 160; x.strokeStyle = ink; x.lineWidth = 7;
    const showMouth = kind === 'human' || kind === 'frog' || kind === 'penguin' && false;
    if (showMouth) {
      const fillM = (c = '#6b1a1a') => { x.fillStyle = c; x.fill(); };
      if (m === 'smile') { x.beginPath(); x.arc(128, my - 22, kind === 'frog' ? 40 : 26, 0.18 * Math.PI, 0.82 * Math.PI); x.stroke(); }
      else if (m === 'flat') { x.beginPath(); x.moveTo(110, my); x.lineTo(146, my); x.stroke(); }
      else if (m === 'frown') { x.beginPath(); x.arc(128, my + 24, 24, 1.2 * Math.PI, 1.8 * Math.PI); x.stroke(); }
      else if (m === 'open' || m === 'wavyopen') { ell(x, 128, my + 4, 19, 15); fillM(); ell(x, 128, my + 12, 11, 6); fillM('#ff8a8a'); x.lineWidth = 5; ell(x, 128, my + 4, 19, 15); x.stroke(); }
      else if (m === 'grin') { x.beginPath(); x.moveTo(98, my - 10); x.quadraticCurveTo(128, my + 44, 158, my - 10); x.closePath(); fillM(); x.save(); x.clip(); x.fillStyle = '#fff'; x.fillRect(90, my - 12, 80, 11); x.restore(); x.lineWidth = 5; x.stroke(); }
      else if (m === 'O') { ell(x, 128, my + 4, 10, 13); fillM(); x.lineWidth = 5; x.stroke(); }
      else if (m === 'o') { ell(x, 128, my + 2, 6, 7); fillM(); x.lineWidth = 4; x.stroke(); }
      else if (m === 'yawn') { ell(x, 128, my + 12, 19, 30); fillM(); ell(x, 128, my + 30, 11, 8); fillM('#ff8a8a'); x.lineWidth = 5; ell(x, 128, my + 12, 19, 30); x.stroke(); }
      else if (m === 'wavy') { x.beginPath(); for (let i = 0; i <= 24; i++) { const px = 104 + i * 2, py = my + Math.sin(i / 24 * Math.PI * 3) * 5; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
      else if (m === 'smirk') { x.beginPath(); x.moveTo(106, my + 2); x.quadraticCurveTo(134, my + 10, 152, my - 10); x.stroke(); }
    }
    if (M.blush || A) { x.fillStyle = 'rgba(255,105,120,0.38)'; ell(x, 128 - dx - 20, ey + 40, 17, 10); x.fill(); ell(x, 128 + dx + 20, ey + 40, 17, 10); x.fill(); }
    if (M.tear) { drop(x, 128 - dx + 4, ey + 32, '#4fb0ff'); if (M.tear > 1) drop(x, 128 + dx - 4, ey + 36, '#4fb0ff'); }
    if (M.sweat) drop(x, 206, 62, '#7cc8ff', 1.5);
  });
}

// ---------- Logos / Schilder ----------
function logoTex(logo, fg = '#ffd23f', bg = '#1d2b6b') {
  return ctex(`logo|${logo}|${fg}|${bg}`, 256, 256, x => {
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

// ---------- Avatare ----------
const AVDEF = { skin: '#f5c79a', shirt: '#2f6fe0', pants: '#22355e', shoes: '#2b2b2b', hair: 'short', hairColor: '#5a3418', logo: 'none', logoColor: '#ffd23f', logoBg: '#1d2b6b', sleeves: 'long', hat: null, hatColor: '#e74c3c', glasses: false, beard: false, scale: 1 };
const AVC = {};
function hairGeo(mb, cfg) {
  const hc = cfg.hairColor, st = cfg.hair, P = (x, y, z) => mb.push(M4.T(x, y, z)), Q = () => mb.pop();
  const base = () => { P(0, 0.55, 0); mb.rbox(1.46, 0.44, 1.46, 0.17, hc); Q(); P(0, 0.16, -0.58); mb.rbox(1.46, 1.0, 0.36, 0.13, hc); Q(); for (const s of [-1, 1]) { P(s * 0.63, 0.3, -0.12); mb.rbox(0.3, 0.6, 1.14, 0.1, hc); Q(); } P(0, 0.47, 0.57); mb.rbox(1.38, 0.26, 0.32, 0.1, hc); Q(); };
  if (st === 'short' || st === 'spiky' || st === 'long' || st === 'ponytail' || st === 'bun' || st === 'pigtails') base();
  if (st === 'spiky') { const R = rng(hash(hc) + 3); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, r = 0.3 + R() * 0.12; mb.push(M4.chain(M4.T(Math.sin(a) * r, 0.74, Math.cos(a) * r * 0.9 - 0.05), M4.RY(a), M4.RX((-30 + R() * 40) * DEG), M4.RZ((R() - 0.5) * 40 * DEG))); mb.rbox(0.34, 0.5, 0.34, 0.07, shade(hc, 0.9 + R() * 0.2)); mb.pop(); } P(0.25, 0.62, 0.68); mb.push(M4.RX(-35 * DEG)); mb.rbox(0.5, 0.42, 0.3, 0.06, hc); mb.pop(); Q(); }
  if (st === 'long') { P(0, -0.38, -0.62); mb.rbox(1.5, 1.95, 0.38, 0.15, hc); Q(); for (const s of [-1, 1]) { P(s * 0.67, -0.2, -0.12); mb.rbox(0.3, 1.55, 0.95, 0.12, hc); Q(); } }
  if (st === 'ponytail') { mb.push(M4.chain(M4.T(0, 0.05, -0.95), M4.RX(22 * DEG))); mb.rbox(0.5, 1.3, 0.5, 0.2, hc); mb.pop(); P(0, 0.42, -0.8); mb.rbox(0.3, 0.2, 0.3, 0.06, '#ff6fa8'); Q(); }
  if (st === 'pigtails') { for (const s of [-1, 1]) { mb.push(M4.chain(M4.T(s * 0.85, 0.05, -0.3), M4.RZ(s * 25 * DEG))); mb.rbox(0.45, 1.1, 0.45, 0.2, hc); mb.pop(); } }
  if (st === 'bun') { P(0, 0.9, -0.25); mb.sphere(0.45, 2, hc); Q(); }
  if (st === 'afro') { P(0, 0.35, -0.12); mb.sphere(1.0, 2, hc, { jit: 0.12, seed: 4 }); Q(); }
  if (st === 'mohawk') { P(0, 0.85, -0.05); mb.rbox(0.3, 0.55, 1.45, 0.1, hc); Q(); }
  if (st === 'cap') { P(0, 0.58, 0); mb.rbox(1.48, 0.52, 1.48, 0.24, cfg.hatColor); Q(); P(0, 0.4, 0.95); mb.box(1.3, 0.1, 0.8, cfg.hatColor); Q(); P(0, 0.05, -0.6); mb.rbox(1.42, 0.62, 0.3, 0.1, hc); Q(); }
  if (st === 'beanie') { P(0, 0.5, 0); mb.rbox(1.5, 0.78, 1.5, 0.32, cfg.hatColor); Q(); P(0, 1.0, 0); mb.sphere(0.25, 1, '#ffffff'); Q(); }
  const hat = cfg.hat;
  if (hat === 'crown') { P(0, 0.66, 0); mb.cyl(0.62, 0.62, 0.35, 10, '#f5c518', { flat: true }); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; mb.push(M4.T(Math.sin(a) * 0.55, 0.35, Math.cos(a) * 0.55)); mb.cyl(0.14, 0, 0.35, 4, '#f5c518'); mb.pop(); } Q(); }
  if (hat === 'tophat') { P(0, 0.66, 0); mb.cyl(0.95, 0.95, 0.08, 16, '#1b1b1b', { flat: false }); mb.cyl(0.6, 0.6, 1.0, 16, '#1b1b1b', { flat: false }); mb.push(M4.T(0, 0.12, 0)); mb.cyl(0.62, 0.62, 0.18, 16, '#c0392b', { flat: false }); mb.pop(); Q(); }
  if (hat === 'party') { P(0, 0.66, 0); mb.cyl(0.5, 0, 1.2, 12, cfg.hatColor, { stripe: '#ffd23f' }); mb.push(M4.T(0, 1.2, 0)); mb.sphere(0.16, 1, '#ffffff'); mb.pop(); Q(); }
  if (hat === 'chef') { P(0, 0.66, 0); mb.cyl(0.6, 0.6, 0.5, 14, '#ffffff', { flat: false }); mb.push(M4.T(0, 0.75, 0)); mb.sphere(0.72, 2, '#ffffff', { sy: 0.6 }); mb.pop(); Q(); }
  if (hat === 'helmet') { P(0, 0.2, 0); mb.sphere(0.95, 2, cfg.hatColor, { sy: 0.8 }); Q(); }
  if (cfg.shades) { P(0, 0.06, 0.7); mb.rbox(1.3, 0.34, 0.12, 0.06, '#121212'); Q(); }
  if (cfg.glasses) { const gc = cfg.glassesColor || '#2b2b2b'; for (const s of [-1, 1]) { const cx = s * 0.22; P(cx, 0.26, 0.69); mb.box(0.4, 0.05, 0.05, gc); Q(); P(cx, -0.05, 0.69); mb.box(0.4, 0.05, 0.05, gc); Q(); P(cx - 0.18, 0.105, 0.69); mb.box(0.05, 0.36, 0.05, gc); Q(); P(cx + 0.18, 0.105, 0.69); mb.box(0.05, 0.36, 0.05, gc); Q(); P(s * 0.62, 0.2, 0.36); mb.box(0.05, 0.05, 0.66, gc); Q(); } P(0, 0.2, 0.69); mb.box(0.1, 0.05, 0.05, gc); Q(); }
  if (cfg.beard) { P(0, -0.42, 0.56); mb.rbox(1.34, 0.5, 0.32, 0.14, hc); Q(); P(0, -0.08, 0.69); mb.rbox(0.64, 0.14, 0.12, 0.05, hc); Q(); }
  if (cfg.mustache) { P(0, -0.08, 0.69); mb.rbox(0.66, 0.16, 0.12, 0.05, hc); Q(); }
  if (cfg.scar) { P(0.2, -0.56, 0.705); mb.push(M4.RZ(0.9)); mb.rbox(0.05, 0.24, 0.03, 0.015, cfg.scarColor || '#e0a092'); for (const k of [-0.07, 0.0, 0.07]) { mb.push(M4.T(0, k, 0.005)); mb.box(0.13, 0.025, 0.03, cfg.scarColor || '#d4887a'); mb.pop(); } mb.pop(); Q(); }
}
function avatarGeo(cfg) {
  const k = JSON.stringify(cfg); if (AVC[k]) return AVC[k];
  const g = {};
  g.head = cgeo('head|' + cfg.skin, mb => mb.rbox(1.32, 1.32, 1.32, 0.34, cfg.skin, { uv: true }));
  g.torso = cgeo(`torso|${cfg.shirt}|${cfg.belt || ''}`, mb => { mb.rbox(2, 2, 1, 0.16, cfg.shirt, { uv: true }); if (cfg.belt) { mb.push(M4.T(0, -0.86, 0)); mb.box(2.04, 0.22, 1.04, cfg.belt); mb.pop(); } });
  g.logo = logoTex(cfg.logo, cfg.logoColor, cfg.logoBg);
  g.arm = cgeo(`arm|${cfg.shirt}|${cfg.skin}|${cfg.sleeves}`, mb => {
    if (cfg.sleeves === 'short') { mb.push(M4.T(0, -0.32, 0)); mb.rbox(1.0, 0.78, 1.0, 0.12, cfg.shirt); mb.pop(); mb.push(M4.T(0, -1.13, 0)); mb.rbox(0.88, 1.56, 0.88, 0.15, cfg.skin); mb.pop(); }
    else { const c = cfg.sleeves === 'skin' ? cfg.skin : cfg.shirt; mb.push(M4.T(0, -0.68, 0)); mb.rbox(0.96, 1.5, 0.96, 0.13, c); mb.pop(); mb.push(M4.T(0, -1.62, 0)); mb.rbox(0.86, 0.56, 0.86, 0.16, cfg.skin); mb.pop(); }
  });
  g.leg = cgeo(`leg|${cfg.pants}|${cfg.shoes}|${cfg.skirt ? 1 : 0}`, mb => { mb.push(M4.T(0, -0.8, 0)); mb.rbox(0.98, 1.62, 0.98, 0.1, cfg.pants); mb.pop(); mb.push(M4.T(0, -1.77, 0.07)); mb.rbox(1.02, 0.46, 1.14, 0.15, cfg.shoes); mb.pop(); });
  if (cfg.skirt) g.skirt = cgeo(`skirt|${cfg.skirt}`, mb => { mb.push(M4.T(0, 1.55, 0)); mb.cyl(1.35, 1.02, 0.9, 12, cfg.skirt, { flat: false }); mb.pop(); });
  const hk = `hair|${cfg.hair}|${cfg.hairColor}|${cfg.hat}|${cfg.hatColor}|${cfg.glasses}|${cfg.shades}|${cfg.beard}|${cfg.mustache}|${cfg.scar}`;
  g.hair = cgeo(hk, mb => hairGeo(mb, cfg));
  return (AVC[k] = g);
}
// P: Pose in Grad; S: Zustand {x,y,z,face(rad),scale}
function avatarItems(items, cfg, S, P) {
  const g = avatarGeo(cfg), sc = (cfg.scale || 1) * (S.scale || 1);
  const root = M4.chain(M4.T(S.x + (P.dx || 0), S.y + (P.y || 0) * sc, S.z + (P.dz || 0)), M4.RY(S.face + (P.spin || 0) * DEG), M4.RZ((P.rz || 0) * DEG), M4.RX((P.rx || 0) * DEG), M4.S(sc));
  const tb = P.tb || 0, sh = S.sh;
  const torso = M4.chain(root, M4.T(0, 3 + tb, 0), M4.RY((P.tw || 0) * DEG));
  const armL = M4.chain(root, M4.T(1.5, 3.88 + tb, 0), M4.RZ((P.aLz || 0) * DEG), M4.RX((P.aLx || 0) * DEG));
  const armR = M4.chain(root, M4.T(-1.5, 3.88 + tb, 0), M4.RZ((P.aRz || 0) * DEG), M4.RX((P.aRx || 0) * DEG));
  const legL = M4.chain(root, M4.T(0.5, 2, 0), M4.RZ((P.lLz || 0) * DEG), M4.RX((P.lLx || 0) * DEG));
  const legR = M4.chain(root, M4.T(-0.5, 2, 0), M4.RZ((P.lRz || 0) * DEG), M4.RX((P.lRx || 0) * DEG));
  const head = M4.chain(root, M4.T(0, 4.0 + tb, 0), M4.RY((P.hy || 0) * DEG), M4.RX((P.hx || 0) * DEG), M4.RZ((P.hz || 0) * DEG), M4.T(0, 0.7, 0));
  const ft = faceTex(P.mood || 'happy', P.closed, P.open, 'human');
  items.push({ g: g.torso, m: torso, tex: g.logo, sh }, { g: g.arm, m: armL, sh }, { g: g.arm, m: armR, sh }, { g: g.leg, m: legL, sh }, { g: g.leg, m: legR, sh }, { g: g.head, m: head, tex: ft, sh }, { g: g.hair, m: head, sh });
  if (g.skirt) items.push({ g: g.skirt, m: root, sh });
  return { root, head, armL, armR, handR: M4.mul(armR, M4.T(0, -1.95, 0)), handL: M4.mul(armL, M4.T(0, -1.95, 0)), top: M4.xp(root, [0, 5.6, 0]) };
}

// ---------- Tiere ----------
const ANIMALS = {
  dog: { c: '#b9824a', c2: '#f3e2c7', ears: 'flop', tail: 'up', snout: 1, s: 1 },
  cat: { c: '#f0a04b', c2: '#fff1dc', ears: 'point', tail: 'long', snout: 0, s: 0.8 },
  fox: { c: '#f07a2a', c2: '#ffffff', ears: 'point', tail: 'bushy', snout: 1, s: 0.95 },
  lion: { c: '#e7a94a', c2: '#f6d9a0', ears: 'round', tail: 'tuft', snout: 1, mane: '#9a4a1c', s: 1.3 },
  pig: { c: '#f7a8b8', c2: '#f28aa0', ears: 'point', tail: 'curl', snout: 2, s: 1.0 },
  bear: { c: '#8a5a33', c2: '#c99b6d', ears: 'round', tail: 'stub', snout: 1, s: 1.35 },
  sheep: { c: '#f5f5f5', c2: '#3b3b3b', ears: 'flop', tail: 'stub', snout: 0, wool: 1, s: 1.05 },
  cow: { c: '#ffffff', c2: '#f7b6c2', ears: 'flop', tail: 'tuft', snout: 2, spots: '#2b2b2b', s: 1.4 },
  guineapig: { guinea: 1, c: '#b5652b', c2: '#ffffff', c3: '#3b2a1a', s: 0.62 },
  guineapig2: { guinea: 1, c: '#f0a04b', c2: '#ffffff', c3: '#f0a04b', s: 0.58 },
  guineapig3: { guinea: 1, c: '#2b2b2b', c2: '#ffffff', c3: '#d9a066', s: 0.6 },
  penguin: { biped: 'penguin', s: 1 }, frog: { biped: 'frog', s: 1 }, chicken: { biped: 'chicken', s: 0.8 },
};
const ANC = {};
function animalGeo(type) {
  if (ANC[type]) return ANC[type];
  const A = ANIMALS[type] || ANIMALS.dog, parts = [];
  const part = (kind, p, build, o = {}) => { const mb = new MB(); build(mb); parts.push({ kind, p, g: GL.geo(mb), ...o }); };
  const T = (mb, x, y, z, f) => { mb.push(M4.T(x, y, z)); f(); mb.pop(); };
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
    part('body', [0, 1.75, 0], mb => { mb.rbox(1.7, 1.35, 2.8, 0.42, c); T(mb, 0, -0.25, 0.3, () => mb.rbox(1.2, 0.9, 1.9, 0.35, c2)); if (A.wool) { const R = rng(5); for (let i = 0; i < 14; i++) T(mb, (R() - .5) * 1.3, 0.35 + R() * .3, (R() - .5) * 2.2, () => mb.sphere(0.55, 1, '#fafafa')); } if (A.spots) { T(mb, 0.55, 0.3, 0.4, () => mb.rbox(0.7, 0.75, 0.9, 0.2, A.spots)); T(mb, -0.6, 0.1, -0.7, () => mb.rbox(0.6, 0.7, 0.8, 0.2, A.spots)); } });
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
      if (type === 'cow') for (const s of [-1, 1]) T(mb, s * 0.6, 0.75, 0, () => mb.cyl(0.12, 0.05, 0.4, 6, '#f2e6c9'));
      mb.pop();
    }, { face: 'animal' });
    for (const [x, z, ph] of [[0.55, 0.95, 0], [-0.55, 0.95, 1], [0.55, -0.95, 1], [-0.55, -0.95, 0]]) part('leg', [x, 1.25, z], mb => { T(mb, 0, -0.62, 0, () => mb.rbox(0.5, 1.25, 0.5, 0.15, c)); T(mb, 0, -1.15, 0.05, () => mb.rbox(0.54, 0.22, 0.6, 0.08, shade(c, 0.7))); }, { ph });
    part('tail', [0, 2.15, -1.35], mb => {
      if (A.tail === 'up') { mb.push(M4.RX(-40 * DEG)); T(mb, 0, 0, -0.45, () => mb.rbox(0.25, 0.25, 0.9, 0.1, c)); mb.pop(); }
      if (A.tail === 'long') { mb.push(M4.RX(-70 * DEG)); T(mb, 0, 0, -0.75, () => mb.rbox(0.22, 0.22, 1.5, 0.1, c)); mb.pop(); }
      if (A.tail === 'bushy') { mb.push(M4.RX(-25 * DEG)); T(mb, 0, 0, -0.8, () => mb.rbox(0.6, 0.6, 1.4, 0.28, c)); T(mb, 0, 0, -1.55, () => mb.rbox(0.5, 0.5, 0.35, 0.2, '#ffffff')); mb.pop(); }
      if (A.tail === 'tuft') { mb.push(M4.RX(30 * DEG)); T(mb, 0, 0, -0.6, () => mb.rbox(0.18, 0.18, 1.2, 0.08, c)); T(mb, 0, 0, -1.25, () => mb.sphere(0.25, 1, A.mane || '#3b2a1a')); mb.pop(); }
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
  const root = M4.chain(M4.T(S.x + (P.dx || 0), S.y + (P.y || 0), S.z), M4.RY(S.face + (P.spin || 0) * DEG), M4.RX((P.rx || 0) * DEG), M4.RZ((P.rz || 0) * DEG), M4.S(sc));
  let headM = null;
  for (const pt of parts) {
    let m; const [px, py, pz] = pt.p;
    if (pt.kind === 'leg') m = M4.chain(root, M4.T(px, py, pz), M4.RX((pt.ph ? -1 : 1) * (P.leg || 0) * DEG));
    else if (pt.kind === 'arm') m = M4.chain(root, M4.T(px, py + (P.tb || 0), pz), M4.RZ(pt.side * (P.flap || 0) * DEG));
    else if (pt.kind === 'tail') m = M4.chain(root, M4.T(px, py + (P.tb || 0), pz), M4.RY((P.wag || 0) * DEG));
    else if (pt.kind === 'head') { m = M4.chain(root, M4.T(px, py + (P.tb || 0), pz), M4.RY((P.hy || 0) * DEG), M4.RX((P.hx || 0) * DEG), M4.RZ((P.hz || 0) * DEG)); headM = m; }
    else m = M4.chain(root, M4.T(px, py + (P.tb || 0), pz));
    const it = { g: pt.g, m, sh: S.sh };
    if (pt.face) it.tex = faceTex(P.mood || 'happy', P.closed, P.open, pt.face);
    items.push(it);
  }
  return { root, head: headM, handR: headM, handL: headM, top: M4.xp(root, A.guinea ? [0, 2.5, 0.9] : [0, A.biped ? 4.0 : 4.4, A.biped ? 0 : 1.4]) };
}

// ---------- Requisiten ----------
// jede Funktion baut Geometrie (lokal, Boden bei y=0) – Rückgabe {parts:[{g,m?,tex?,e?,a?}]}
const PROPS = {
  sign: o => ({ parts: [{ g: cgeo('signpost', mb => { mb.push(M4.T(0, 0, -0.05)); mb.cyl(0.14, 0.14, 2.6, 8, '#8b5a2b'); mb.pop(); }) }, { g: cgeo('signboard|' + (o.w || 3.4) + '|' + (o.h || 1.8), mb => { mb.push(M4.T(0, 2.4 + (o.h || 1.8) / 2, 0.1)); mb.box(o.w || 3.4, o.h || 1.8, 0.2, '#ffffff', { uv: true }); mb.pop(); }), tex: signTex(o.text || '!', { ...o, tw: 512, th: Math.round(512 * (o.h || 1.8) / (o.w || 3.4)) }) }] }),
  board: o => { const w = o.w || 6, h = o.h || 3; return { parts: [{ g: cgeo('boardposts|' + w, mb => { for (const s of [-1, 1]) { mb.push(M4.T(s * w * 0.4, 0, 0)); mb.cyl(0.16, 0.16, 3.2 + h * 0.4, 8, '#7a4a24'); mb.pop(); } }) }, { g: cgeo(`boardpanel|${w}|${h}`, mb => { mb.push(M4.T(0, 2.6 + h / 2, 0.2)); mb.box(w, h, 0.25, '#ffffff', { uv: true }); mb.pop(); }), tex: signTex(o.text || '', { ...o, tw: 512, th: Math.round(512 * h / w) }) }] }; },
  banner: o => { const w = o.w || 8; return { parts: [{ g: cgeo('bannerposts|' + w, mb => { for (const s of [-1, 1]) { mb.push(M4.T(s * w / 2, 0, 0)); mb.cyl(0.18, 0.18, 5.6, 8, o.pole || '#1e88e5'); mb.push(M4.T(0, 5.6, 0)); mb.sphere(0.3, 1, '#ffd23f'); mb.pop(); mb.pop(); } }) }, { g: cgeo('bannercloth|' + w, mb => { mb.push(M4.T(0, 4.6, 0)); mb.box(w, 1.5, 0.12, '#ffffff', { uv: true }); mb.pop(); }), tex: signTex(o.text || '', { bg: o.bg || '#ff7a1a', fg: o.fg || '#ffffff', border: o.border || '#ffffff', tw: 1024, th: 192 }) }] }; },
  number: o => ({ parts: [{ g: cgeo('numpanel', mb => { mb.push(M4.T(0, 1, 0)); mb.box(2, 2, 0.15, '#ffffff', { uv: true }); mb.pop(); }), tex: signTex(o.text || '1', { bg: o.bg || '#ffd23f', fg: o.fg || '#1d1712', border: o.border || '#1d1712', tw: 256, th: 256 }) }] }),
  coin: o => ({ parts: [{ g: cgeo('coin', mb => { mb.push(M4.chain(M4.T(0, 0.75, -0.09), M4.RX(90 * DEG))); mb.cyl(0.7, 0.7, 0.18, 18, '#f7c331', { top: '#ffd95a' }); mb.pop(); mb.push(M4.T(0, 0.75, 0.1)); mb.box(0.18, 0.7, 0.04, '#e0a400'); mb.pop(); }), e: 0.18 }] }),
  coins: o => ({ parts: [{ g: cgeo('coinpile', mb => { const R = rng(9); for (let i = 0; i < 40; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * 2.2; mb.push(M4.chain(M4.T(Math.sin(a) * r, 0.1 + (2.2 - r) * 0.45 + R() * 0.3, Math.cos(a) * r), M4.RX((R() - .5) * 0.8), M4.RZ((R() - .5) * 0.8))); mb.cyl(0.6, 0.6, 0.16, 12, '#f7c331', { top: '#ffd95a' }); mb.pop(); } }), e: 0.15 }] }),
  apple: o => ({ parts: [{ g: cgeo('apple', mb => { mb.push(M4.T(0, 0.45, 0)); mb.sphere(0.45, 2, '#e8262a', { sy: 0.92 }); mb.push(M4.T(0, 0.38, 0)); mb.cyl(0.04, 0.04, 0.25, 5, '#5b3a1e'); mb.push(M4.chain(M4.T(0.12, 0.15, 0), M4.RZ(-0.8))); mb.box(0.25, 0.06, 0.14, '#3fa34d'); mb.pop(); mb.pop(); mb.pop(); }) }] }),
  banana: o => ({ parts: [{ g: cgeo('banana', mb => { for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.28; mb.push(M4.chain(M4.T(Math.sin(a) * 0.9, 0.35 + (1 - Math.cos(a)) * 0.9, 0), M4.RZ(-a))); mb.rbox(0.3, 0.32, 0.3, 0.12, i === 0 || i === 5 ? '#6b4a1e' : '#ffd93b'); mb.pop(); } }) }] }),
  carrot: o => ({ parts: [{ g: cgeo('carrot', mb => { mb.push(M4.chain(M4.T(0, 0.35, 0.8), M4.RX(90 * DEG))); mb.cyl(0.32, 0.02, 1.8, 7, '#ff7f11'); mb.pop(); mb.push(M4.T(0, 0.35, -1.0)); for (let i = 0; i < 3; i++) { mb.push(M4.RY(i * 1.1)); mb.box(0.12, 0.12, 0.6, '#3fa34d'); mb.pop(); } mb.pop(); }) }] }),
  ball: o => ({ parts: [{ g: cgeo('ball|' + (o.color || 'beach'), mb => { mb.push(M4.T(0, 0.65, 0)); const cs = ['#e63946', '#ffffff', '#1e88e5', '#ffd23f', '#2a9d8f', '#ffffff']; mb.sphere(0.65, 2, o.color || '#e63946', { colFn: o.color ? null : (a, b, c) => cs[Math.floor(((Math.atan2(a[0] + b[0] + c[0], a[2] + b[2] + c[2]) + Math.PI) / (Math.PI * 2)) * 6) % 6] }); mb.pop(); }) }] }),
  gift: o => ({ parts: [{ g: cgeo('gift|' + (o.color || '#e63946'), mb => { const c = o.color || '#e63946'; mb.push(M4.T(0, 0.6, 0)); mb.rbox(1.2, 1.2, 1.2, 0.06, c); mb.box(1.24, 1.24, 0.25, '#ffd23f'); mb.box(0.25, 1.24, 1.24, '#ffd23f'); mb.push(M4.T(0, 0.7, 0)); for (const s of [-1, 1]) { mb.push(M4.chain(M4.RZ(s * 0.6), M4.T(s * 0.2, 0.1, 0))); mb.rbox(0.35, 0.25, 0.25, 0.1, '#ffd23f'); mb.pop(); } mb.pop(); mb.pop(); }) }] }),
  cake: o => ({ parts: [{ g: cgeo('cake', mb => { mb.cyl(1.0, 1.0, 0.6, 18, '#f7d6e0', { flat: false, top: '#ffffff' }); mb.push(M4.T(0, 0.6, 0)); mb.cyl(0.75, 0.75, 0.5, 18, '#f28aa0', { flat: false, top: '#ffffff' }); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; mb.push(M4.T(Math.sin(a) * 0.45, 0.5, Math.cos(a) * 0.45)); mb.cyl(0.05, 0.05, 0.4, 6, ['#1e88e5', '#ffd23f', '#2a9d8f', '#e63946', '#9b5de5'][i]); mb.pop(); } mb.pop(); }) }, { g: cgeo('cakeflames', mb => { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; mb.push(M4.T(Math.sin(a) * 0.45, 1.55, Math.cos(a) * 0.45)); mb.sphere(0.08, 1, '#ffb703', { sy: 1.6 }); mb.pop(); } }), e: 1 }] }),
  pizza: o => ({ parts: [{ g: cgeo('pizza', mb => { mb.push(M4.T(0, 0.05, 0)); mb.cyl(1.1, 1.1, 0.12, 20, '#e9b872', { top: '#f6c453' }); const R = rng(3); for (let i = 0; i < 9; i++) { const a = R() * 6.28, r = R() * 0.8; mb.push(M4.T(Math.sin(a) * r, 0.13, Math.cos(a) * r)); mb.cyl(0.14, 0.14, 0.04, 8, '#c62828'); mb.pop(); } mb.pop(); }) }] }),
  burger: o => ({ parts: [{ g: cgeo('burger', mb => { mb.push(M4.T(0, 0.15, 0)); mb.cyl(0.7, 0.7, 0.25, 16, '#e0a458', { flat: false }); mb.push(M4.T(0, 0.25, 0)); mb.cyl(0.75, 0.75, 0.22, 16, '#6b3e26', { flat: false }); mb.push(M4.T(0, 0.22, 0)); mb.cyl(0.8, 0.8, 0.06, 12, '#7bc950'); mb.cyl(0.72, 0.72, 0.1, 4, '#ffd23f'); mb.push(M4.T(0, 0.1, 0)); mb.sphere(0.72, 2, '#e8a457', { sy: 0.55 }); mb.pop(); mb.pop(); mb.pop(); mb.pop(); }) }] }),
  icecream: o => ({ parts: [{ g: cgeo('icecream', mb => { mb.push(M4.chain(M4.T(0, 1.1, 0), M4.RX(Math.PI))); mb.cyl(0.4, 0.02, 1.1, 10, '#d9a066'); mb.pop(); mb.push(M4.T(0, 1.3, 0)); mb.sphere(0.45, 2, '#ff8fab'); mb.push(M4.T(0, 0.5, 0)); mb.sphere(0.4, 2, '#fff3b0'); mb.push(M4.T(0, 0.42, 0)); mb.sphere(0.12, 1, '#e63946'); mb.pop(); mb.pop(); mb.pop(); }) }] }),
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
  pool: o => ({ parts: [{ g: cgeo('poolrim|' + (o.w || 10) + '|' + (o.d || 6), mb => setPoolRim(mb, o.w || 10, o.d || 6)) }, { g: cgeo('poolwater|' + (o.w || 10) + '|' + (o.d || 6), mb => { mb.push(M4.T(0, 0.35, 0)); mb.hquad(o.w || 10, o.d || 6, '#3ec1ff'); mb.pop(); }), a: 0.82, e: 0.25, sh: false }] }),
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

function propItems(items, type, o, M) {
  const f = PROPS[type]; if (!f) return;
  const P = f(o);
  for (const p of P.parts) items.push({ g: p.g, m: M, tex: p.tex, e: p.e !== undefined ? p.e : (o.glow || 0), a: p.a !== undefined ? p.a : o.alpha, sh: p.sh !== undefined ? p.sh : true, add: p.add, tint: o.tint ? col(o.tint) : undefined });
}
