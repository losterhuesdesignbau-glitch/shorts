// Regie- & Physik-Prüfung (ohne Rendern): Figuren im Bild, Kollisionen, Schweben, Möbel, Raumgrenzen.
// R.check(si) -> Liste von Befunden {shot, u, typ, id, info, fix}
// Nutzt dieselben Funktionen wie das Rendern (actorState, camera, getSet) -> prüft genau das, was später zu sehen ist.

const CHK_SIT = new Set(['sit', 'sitdesk', 'sitgame', 'lie', 'sleep', 'piano', 'float', 'fly', 'swim', 'mocap']);
const CHK_AIR = new Set(['jump', 'hop', 'cheer', 'fall', 'faint', 'throw', 'spin', 'dance']);

function chkRadius(s) {
  const sc = s.scale * (s.cfg.scale || 1);
  if (s.cfg.animal) { const A = ANIMALS[s.cfg.animal] || {}; return (A.biped ? 0.9 : 1.15) * (A.s || 1) * sc; }
  return 0.88 * sc;
}

function chkVP(cam) {
  const view = M4.look(cam.eye, cam.look, cam.up || [0, 1, 0]);
  const pr = M4.persp(cam.fov * DEG, R.W / R.H, cam.near || 0.25, cam.far || 1400);
  return M4.mul(pr, view);
}

function chkProj(VP, p) {
  const v = [p[0], p[1], p[2], 1], m = VP;
  const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], w = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15];
  if (w <= 0.05) return null; // hinter der Kamera
  return [(x / w * 0.5 + 0.5) * R.W, (0.5 - y / w * 0.5) * R.H, w];
}

function chkBox(VP, s, r) {
  const pts = []; let behind = 0;
  for (const dy of [0, s.h]) for (const dx of [-r, r]) for (const dz of [-r, r]) { const q = chkProj(VP, [s.x + dx, s.y + dy, s.z + dz]); if (q) pts.push(q); else behind++; }
  if (!pts.length) return null;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), behind };
}


// Sichtlinie Kamera -> Punkt durch Möbel (Tische, Stühle, Betten = Flächen mit Oberkante) verdeckt?
function chkBlocked(eye, p, surfs) {
  for (let k = 1; k < 24; k++) { const f = k / 24, x = eye[0] + (p[0] - eye[0]) * f, y = eye[1] + (p[1] - eye[1]) * f, z = eye[2] + (p[2] - eye[2]) * f;
    if (Math.hypot(x - p[0], z - p[2]) < 0.9) break; // direkt an der Figur: eigener Platz
    for (const s of surfs) { const dx = x - s.x, dz = z - s.z, c = Math.cos(s.ry || 0), si = Math.sin(s.ry || 0), lx = c * dx - si * dz, lz = si * dx + c * dz;
      const top = s.top > 0.9 && s.top < 1.4 ? 2.7 : s.top; /* Stuhl: Lehne ragt über die Sitzfläche */ if (Math.abs(lx) < s.w / 2 && Math.abs(lz) < s.d / 2 && y < top + 0.05) return true; } }
  return false;
}
function chkCover(cam, A, surfs) { const chest = [A.x, A.y + (A.seat || 0) + A.h * 0.55, A.z], head = [A.x, A.y + (A.seat || 0) + A.h * 0.86, A.z]; return chkBlocked(cam.eye, chest, surfs) || chkBlocked(cam.eye, head, surfs); }

R.check = function (si) {
  const sh = R.ep.shots[si], D = sh.dur || 1, out = [];
  const set = getSet(sh.set || 'street', sh.setOpts || {});
  const surfs = [...(set.surf || [])];
  for (const p of sh.props || []) { const sf = typeof surfOf === 'function' ? surfOf(p.type, p) : null; if (sf && !p.fly && !p.on) { const q = pt3(p.at); surfs.push({ x: q[0], z: q[2], ry: (p.ry || 0) * DEG, ...sf, top: sf.top + q[1] }); } }
  const seen = new Set(), add = (u, typ, id, info, fix) => { const k = typ + '|' + id; if (seen.has(k)) return; seen.add(k); out.push({ shot: si, u: +u.toFixed(2), typ, id, info, fix: fix || null }); };
  const c0 = parseCam(sh.cam, sh);
  for (const u of [0.08, 0.5, 0.92]) {
    const tl = u * D;
    const list = (sh.actors || []).map((a, i) => actorState(a, tl, D, i, sh));
    const map = {}; for (const s of list) map[s.id] = s;
    for (const s of list) s.face = faceOf(s, map, null, u);
    let cam; try { cam = camera(sh, si, tl, D, set, map); } catch (e) { add(u, 'kamera_fehler', '', String(e)); continue; }
    const VP = chkVP(cam);
    // 1) Physik: Kollisionen Figur–Figur
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j], d = Math.hypot(A.x - B.x, A.z - B.z), m = (chkRadius(A) + chkRadius(B)) * 0.78;
      if (d < m && Math.abs(A.y - B.y) < 1.5) add(u, 'kollision', A.id + '+' + B.id, `Figuren stecken ineinander (Abstand ${d.toFixed(2)} < ${m.toFixed(2)})`, { push: +((chkRadius(A) + chkRadius(B)) - d + 0.1).toFixed(2), a: A.id, b: B.id });
    }
    for (const s of list) {
      const act = s.act || s.a.do || 'idle', r = chkRadius(s);
      // 2) Raumgrenzen (Innenräume)
      if (set.bounds) { const [x0, x1, z0, z1] = set.bounds; if (s.x < x0 + r || s.x > x1 - r || s.z < z0 + r || s.z > z1 - r) add(u, 'ausserhalb', s.id, `steht in/hinter der Wand (x ${s.x.toFixed(1)}, z ${s.z.toFixed(1)})`, { clamp: [x0 + r + 0.2, x1 - r - 0.2, z0 + r + 0.2, z1 - r - 0.2] }); }
      // 3) Möbel: steht in einem Tisch/Bett/Pult
      const rb = r * 0.55, top = Math.max(surfTop(s.x, s.z, surfs), surfTop(s.x + rb, s.z, surfs), surfTop(s.x - rb, s.z, surfs), surfTop(s.x, s.z + rb, surfs), surfTop(s.x, s.z - rb, surfs));   // Körper, nicht nur Mittelpunkt (Lukas 26.11.: nie in Objekten)
      if (top > 0.5 && !CHK_SIT.has(act) && s.y < top - 0.25) {
        // nächste freie Stelle suchen (Ringe um die Figur): kein Möbel, im Raum, nicht in anderen Figuren
        let best = null;
        for (let rr = 0.6; rr <= 4.2 && !best; rr += 0.6) for (let k = 0; k < 16 && !best; k++) {
          const ang = k / 16 * Math.PI * 2 + (k % 2 ? 0 : Math.PI / 16), x = s.x + Math.sin(ang) * rr, z = s.z + Math.cos(ang) * rr;
          if (surfTop(x, z, surfs) > 0.3 || surfTop(x + r * 0.7, z, surfs) > 0.3 || surfTop(x - r * 0.7, z, surfs) > 0.3 || surfTop(x, z + r * 0.7, surfs) > 0.3 || surfTop(x, z - r * 0.7, surfs) > 0.3) continue;
          if (set.bounds) { const [x0, x1, z0, z1] = set.bounds; if (x < x0 + r + 0.2 || x > x1 - r - 0.2 || z < z0 + r + 0.2 || z > z1 - r - 0.2) continue; }
          if (list.some(o => o !== s && Math.hypot(o.x - x, o.z - z) < chkRadius(o) + r)) continue;
          best = [+x.toFixed(2), +z.toFixed(2)];
        }
        add(u, 'in_moebel', s.id, `steht in einem Möbelstück (Oberkante ${top.toFixed(1)})`, best ? { to: best } : null);
      }
      // 3b) Sitzen braucht eine Sitzfläche (Stuhl/Bank/Bett) – sonst sitzt die Figur in der Luft
      if (['sit', 'sitgame', 'sitdesk', 'piano'].includes(act) && !s.cfg.animal) {
        const st = surfTop(s.x, s.z, surfs), want = 1.12 * s.scale * (s.cfg.scale || 1);
        if (st < want - 0.35) add(u, 'sitzt_in_luft', s.id, 'sitzt ohne Stuhl in der Luft', { chair: [+s.x.toFixed(2), +s.z.toFixed(2)], ry: Math.round((s.face || 0) * 180 / Math.PI) });
        else if (st > want + 0.3) add(u, 'sitz_zu_hoch', s.id, `Sitzfläche ${st.toFixed(2)} höher als Sitzhöhe`, { y: +(st - want).toFixed(2) });
      }
      // 4) Schwerkraft: schwebt ohne Grund
      const baseY = s.a.y || 0, A = s.cfg.animal ? ANIMALS[s.cfg.animal] || {} : null;
      if (baseY > 0.35 && !CHK_SIT.has(act) && !CHK_AIR.has(act) && !(A && A.shark) && top < baseY - 0.3) add(u, 'schwebt', s.id, `schwebt ${baseY.toFixed(1)} über dem Boden`, { y: top });
      // 5) Bild: Figur sichtbar / angeschnitten / Kopf
      const bx = chkBox(VP, s, r);
      if (!bx) { if (c0.target === s.id) add(u, 'fokus_hinter_kamera', s.id, 'Hauptfigur hinter der Kamera'); continue; }
      const w = Math.max(1, bx.x1 - bx.x0), vis = Math.max(0, Math.min(bx.x1, R.W) - Math.max(bx.x0, 0)) / w;
      const backCam = ['back', 'follow', 'pov', 'top', 'aerial', 'track'].includes(c0.type); // Rücken-/Draufsicht: Gesicht absichtlich nicht zu sehen
      if ((c0.target === s.id || c0.target2 === s.id) && !backCam) {
        const hp = chkProj(VP, [s.x, s.y + s.h * 0.86, s.z]);
        if (!hp || hp[0] < R.W * 0.04 || hp[0] > R.W * 0.96 || hp[1] < R.H * 0.03 || hp[1] > R.H * 0.97) add(u, 'kopf_nicht_im_bild', s.id, 'Gesicht der Hauptfigur nicht im Bild', { far: 1.25 });
        else if (hp[1] > R.H * ((R.ep.capY || 0.64) - 0.07) && hp[1] < R.H * ((R.ep.capY || 0.64) + 0.05)) add(u, 'untertitel_verdeckt', s.id, 'Untertitel liegt auf dem Gesicht');
        if (bx.y0 < -R.H * 0.02 && !['close', 'face'].includes(c0.type)) add(u, 'kopf_abgeschnitten', s.id, 'Kopf oben angeschnitten', { far: 1.2 });
      } else if (vis > 0.08 && vis < 0.55 && !['close', 'face'].includes(c0.type) && bx.y1 - bx.y0 > R.H * 0.25) add(u, 'angeschnitten', s.id, `nur ${(vis * 100) | 0}% im Bild (Rand)`);
      if (bx.behind && bx.behind < 8 && Math.hypot(cam.eye[0] - s.x, cam.eye[2] - s.z) < r + 0.4) add(u, 'kamera_in_figur', s.id, 'Kamera steckt in der Figur', { far: 1.3 });
    }
    // 5b) Figur durch andere Figur verdeckt (Kopf hinter einer näheren Figur) -> seitlich versetzen
    { const vis = list.map(s => { const hp = chkProj(VP, [s.x, s.y + (s.seat || 0) + s.h * 0.86, s.z]); return { s, hp, bx: chkBox(VP, s, chkRadius(s)) }; });
      for (const A of vis) { if (!A.hp) continue; for (const B of vis) { if (A === B || !B.bx || !B.hp || B.hp[2] >= A.hp[2] - 0.3) continue;
        const m = (B.bx.x1 - B.bx.x0) * 0.08; if (A.hp[0] > B.bx.x0 + m && A.hp[0] < B.bx.x1 - m && A.hp[1] > B.bx.y0 && A.hp[1] < B.bx.y1) {
          const fx = cam.look[0] - cam.eye[0], fz = cam.look[2] - cam.eye[2], fl = Math.hypot(fx, fz) || 1, sx = -fz / fl, sz = fx / fl, side = (A.s.x - B.s.x) * sx + (A.s.z - B.s.z) * sz >= 0 ? 1 : -1, d = (chkRadius(A.s) + chkRadius(B.s)) * 1.15;
          add(u, 'verdeckt_figur', A.s.id, `von ${B.s.id} verdeckt`, { dx: +(sx * side * d).toFixed(2), dz: +(sz * side * d).toFixed(2), by: B.s.id }); } } } }
    // 6) Hauptfigur durch Möbel verdeckt -> anderen Kamerawinkel suchen, der über die ganze Einstellung frei ist
    const F = c0.target ? map[c0.target] : null;
    if (F && surfs.length && chkCover(cam, F, surfs)) {
      let best = null;
      for (const da of [25, -25, 50, -50, 75, -75, 105, -105, 0]) {
        const sh2 = { ...sh, cam: { ...c0, ang: (c0.ang ?? 0) + da } }; let ok = true;
        for (const uu of [0.08, 0.5, 0.92]) { const L2 = (sh.actors || []).map((a, i) => actorState(a, uu * D, D, i, sh)), M2 = {}; for (const s of L2) M2[s.id] = s; for (const s of L2) s.face = faceOf(s, M2, null, uu);
          let cm; try { cm = camera(sh2, si, uu * D, D, set, M2); } catch (e) { ok = false; break; } if (chkCover(cm, M2[c0.target], surfs)) { ok = false; break; } }
        if (ok) { best = (c0.ang ?? 0) + da; break; }
      }
      add(u, 'verdeckt', F.id, 'Hauptfigur durch Möbel verdeckt', best !== null ? { ang: best } : { far: 1.3 });
    }
    // 7) Kamera in Wand/außerhalb
    if (set.bounds) { const [x0, x1, z0, z1, ym] = set.bounds; const e = cam.eye; if (e[0] < x0 - 0.3 || e[0] > x1 + 0.3 || e[2] < z0 - 0.3 || e[2] > z1 + 0.3 || e[1] > (ym || 99) + 0.3) add(u, 'kamera_in_wand', '', 'Kamera außerhalb des Raums'); }
  }
  return out;
};

R.checkAll = function () { const all = []; for (let i = 0; i < R.ep.shots.length; i++) all.push(...R.check(i)); return all; };

R.meta = () => ({ moods: Object.keys(MOODS), animals: Object.keys(ANIMALS), props: Object.keys(PROPS), sets: Object.keys(SETS),
  indoor: ['classroom', 'danceroom', 'room', 'elevator', 'hallway', 'kitchen', 'mall'] });
