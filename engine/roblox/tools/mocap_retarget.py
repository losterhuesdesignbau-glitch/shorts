"""Gelenkpunkte (tools/mocap_extract.py) -> Rig-Winkel pro Frame (Aktion "mocap").
python tools/mocap_retarget.py kp.json mocap.json [--mirror]
Ergebnis: {"fps":30,"people":[{"keys":[...], "frames":[[...],...]}, ...]} – Person 0 = links im Video."""
import argparse, json, math
import numpy as np

KEYS = ['aLz', 'aLx', 'aLy', 'eL', 'aRz', 'aRx', 'aRy', 'eR', 'lLz', 'lLx', 'kL', 'lRz', 'lRx', 'kR', 'wz', 'tw', 'hz', 'hx', 'hy', 'y', 'dx']
D = 180 / math.pi


def smooth(a, w=5):
    if len(a) < w: return a
    k = np.hanning(w + 2)[1:-1]; k /= k.sum(); pad = w // 2
    ap = np.pad(a, ((pad, pad), (0, 0)), mode='edge')
    return np.stack([np.convolve(ap[:, j], k, mode='valid') for j in range(a.shape[1])], 1)


def rx(t): c, s = math.cos(t), math.sin(t); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def rz(t): c, s = math.cos(t), math.sin(t); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def limb(d):
    """Richtung (Figur-Raum: x=links der Figur, y=oben, z=nach vorn) -> (z-Winkel, x-Winkel) für RZ·RX·(0,-1,0)."""
    d = d / (np.linalg.norm(d) + 1e-9)
    ax = -math.asin(max(-1, min(1, d[2]))); az = math.atan2(d[0], -d[1])
    return az, ax


def one_euro(x, fps, mincut=1.0, beta=0.02, dcut=1.0):
    """One-Euro-Filter je Spalte. x: (n, k)."""
    te = 1.0 / fps
    alpha = lambda c: 1.0 / (1.0 + 1.0 / (2 * np.pi * c * te))
    y = x.copy(); dx = np.zeros(x.shape[1]); ad = alpha(dcut)
    for i in range(1, len(x)):
        dx = ad * (x[i] - y[i - 1]) / te + (1 - ad) * dx
        a = alpha(mincut + beta * np.abs(dx))
        y[i] = a * x[i] + (1 - a) * y[i - 1]
    return y


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('kp'); ap.add_argument('out'); ap.add_argument('--mirror', action='store_true')
    ap.add_argument('--euro', type=float, default=0.9, help='One-Euro mincutoff Hz (0=aus)')
    ap.add_argument('--beta', type=float, default=0.004, help='One-Euro beta')
    ap.add_argument('--maxvel', type=float, default=14.0, help='max Grad pro Frame (0=aus)')
    ap.add_argument('--depthnorm', type=int, default=1, help='Größenänderung (Tiefe) je Frame ausgleichen (1=an)')
    ap.add_argument('--ground', type=int, default=1, help='Füße auf den Boden setzen (1=an)')
    ap.add_argument('--smooth', type=float, default=2.5, help='Glättung der Gelenkwinkel (Gauß-Sigma in Frames, gegen Zittern)')
    a = ap.parse_args()
    K = json.load(open(a.kp)); F = K['frames']; n = len(F); npl = max(len(f) for f in F)
    out = {'fps': K['fps'], 'keys': KEYS, 'people': []}
    for p in range(npl):
        P = np.zeros((n, 17, 2)); C = np.zeros((n, 17))
        for i, f in enumerate(F):
            if p < len(f): P[i] = f[p]['k']; C[i] = f[p]['c']
        # schwache Punkte über die Zeit auffüllen
        for j in range(17):
            ok = C[:, j] > 0.35
            if ok.sum() >= 2 and not ok.all():
                for c in range(2): P[~ok, j, c] = np.interp(np.where(~ok)[0], np.where(ok)[0], P[ok, j, c])
        P = smooth(P.reshape(n, 34), 7).reshape(n, 17, 2)
        # Bild -> Figur-Raum: Figur schaut zur Kamera => ihre linke Seite ist rechts im Bild (+x), y nach oben
        V = np.stack([P[..., 0], -P[..., 1]], -1)
        if a.mirror: V[..., 0] *= -1
        if a.depthnorm and n > 10:  # Person läuft auf Kamera zu/weg: Größe je Frame herausrechnen (sonst wirken ferne Glieder verkürzt -> Hocke/Schweben)
            from scipy.ndimage import gaussian_filter1d, median_filter
            tl = np.linalg.norm((V[:, 5] + V[:, 6]) / 2 - (V[:, 11] + V[:, 12]) / 2, axis=1)
            sc = gaussian_filter1d(median_filter(tl, 15, mode='nearest'), 8, mode='nearest'); sc = sc / np.median(sc)
            hc = ((V[:, 11] + V[:, 12]) / 2)[:, None, :]
            V = hc + (V - hc) / sc[:, None, None]
        seg = lambda i, j: V[:, j] - V[:, i]
        segs = {'uaL': (5, 7), 'faL': (7, 9), 'uaR': (6, 8), 'faR': (8, 10), 'thL': (11, 13), 'shL': (13, 15), 'thR': (12, 14), 'shR': (14, 16)}
        Lmax = {k: np.percentile(np.linalg.norm(seg(*v), axis=1), 90) for k, v in segs.items()}
        for s_ in ('ua', 'fa', 'th', 'sh'): m = max(Lmax[s_ + 'L'], Lmax[s_ + 'R']); Lmax[s_ + 'L'] = Lmax[s_ + 'R'] = m
        def d3(k, sign=1):
            v = seg(*segs[k]); L = Lmax[k]; pr = np.linalg.norm(v, axis=1)
            rr = np.clip(pr / (L * 0.9), 0, 1)  # Totzone: fast volle Länge = in der Bildebene
            z = np.sqrt(np.clip(1 - rr ** 2, 0, 1)) * L * sign
            return np.concatenate([v, z[:, None]], 1)
        torso = (V[:, 5] + V[:, 6]) / 2 - (V[:, 11] + V[:, 12]) / 2; tlen = np.median(np.linalg.norm(torso, axis=1))
        swmax = np.percentile(np.abs(V[:, 5, 0] - V[:, 6, 0]), 92)
        hipc = (V[:, 11] + V[:, 12]) / 2; base = np.median(hipc[: max(5, n // 10)], 0)
        rows = []; last = {}
        for i in range(n):
            r = {}
            for side, s in (('L', 1), ('R', -1)):
                ua = d3('ua' + side)[i]; fa = d3('fa' + side)[i]
                az, ax = limb(ua); R = rz(az) @ rx(ax)
                fl = R.T @ (fa / (np.linalg.norm(fa) + 1e-9))
                e = math.acos(max(-1, min(1, -fl[1]))); key = 'ay' + side
                if e > 0.35: last[key] = math.atan2(fl[0], fl[2])
                ay = last.get(key, 0.0) * min(1.0, e / 0.35)  # bei fast gestrecktem Arm Drehung halten statt springen
                r['a' + side + 'z'] = az * D; r['a' + side + 'x'] = ax * D; r['a' + side + 'y'] = ay * D; r['e' + side] = min(150, e * D)
                th = d3('th' + side)[i]; lz, lx = limb(th); RL = rz(lz) @ rx(lx)
                best = None
                for sg in (1, -1):
                    sh = d3('sh' + side, sg)[i]; sl = RL.T @ (sh / (np.linalg.norm(sh) + 1e-9))
                    k = math.atan2(-sl[2], -sl[1]); score = abs(sl[0]) + (0.5 if k < -0.1 else 0) + (0 if last.get('k' + side, 0) * k >= 0 else 0.25)
                    if best is None or score < best[0]: best = (score, k)
                last['k' + side] = best[1]
                r['l' + side + 'z'] = lz * D; r['l' + side + 'x'] = lx * D; r['k' + side] = max(0, min(150, best[1] * D))
            r['wz'] = max(-30, min(30, -math.degrees(math.atan2(torso[i, 0], torso[i, 1]))))
            sw = abs(V[i, 5, 0] - V[i, 6, 0]); smid = (V[i, 5, 0] + V[i, 6, 0]) / 2
            q = math.degrees(math.acos(max(0.0, min(1.0, sw / (swmax + 1e-6))))) if swmax else 0.0
            sgn = 1 if (V[i, 0, 0] - smid) > 0 else -1  # Nase vor der Schultermitte verschoben -> Drehrichtung
            r['tw'] = max(-40, min(40, sgn * max(0.0, q - 22) * 0.7))  # Totzone: Schulterbreite schwankt auch durch Armbewegung
            emid = (V[i, 3, 0] + V[i, 4, 0]) / 2; ew = abs(V[i, 3, 0] - V[i, 4, 0]) + 1e-6
            r['hy'] = max(-40, min(40, (V[i, 0, 0] - emid) / ew * 70 - r['tw'] * 0.5))
            eye = V[i, 1] - V[i, 2]; shl = V[i, 5] - V[i, 6]
            r['hz'] = max(-25, min(25, math.degrees(math.atan2(eye[1], eye[0]) - math.atan2(shl[1], shl[0]))))
            r['hx'] = 0.0
            u = 1.88 / tlen  # Figur-Einheiten pro Pixel (Rumpflänge)
            r['y'] = max(-0.6, min(0.8, (hipc[i, 1] - base[1]) * u)); r['dx'] = max(-2, min(2, (hipc[i, 0] - base[0]) * u))
            rows.append([round(float(r[k]), 1) for k in KEYS])
        arr = np.array(rows, dtype=float)
        for j, key in enumerate(KEYS):  # Winkel entfalten: Sprünge über ±180° sind keine echten Bewegungen (Hauptursache für Zucken)
            if key not in ('y', 'dx'): arr[:, j] = np.degrees(np.unwrap(np.radians(arr[:, j])))
        try:  # Savitzky-Golay erhält Spitzen (Kicks, Armschwünge) besser als reine Mittelung
            from scipy.signal import savgol_filter
            w = max(5, int(a.smooth * 4) | 1)
            if len(arr) > w: arr = savgol_filter(arr, w, 2, axis=0, mode='interp')
        except ImportError:
            pass
        if a.smooth > 0 and len(arr) > 3:  # Gauß-Glättung über die Zeit (gegen Zittern), Ränder gespiegelt
            r = int(a.smooth * 3); xs = np.arange(-r, r + 1); kern = np.exp(-0.5 * (xs / a.smooth) ** 2); kern /= kern.sum()
            pad = np.pad(arr, ((r, r), (0, 0)), mode='reflect')
            arr = np.stack([np.convolve(pad[:, j], kern, mode='valid') for j in range(arr.shape[1])], 1)
        if a.euro > 0 and len(arr) > 3:  # One-Euro-Filter (Casiez 2012): ruhig bei langsamer, scharf bei schneller Bewegung; vor+zurück = keine Verzögerung
            arr = 0.5 * (one_euro(arr, K['fps'], a.euro, a.beta) + one_euro(arr[::-1], K['fps'], a.euro, a.beta)[::-1])
        if a.maxvel > 0:  # max. Winkeländerung pro Frame (Ausreißer kappen)
            for i in range(1, len(arr)):
                arr[i] = arr[i - 1] + np.clip(arr[i] - arr[i - 1], -a.maxvel, a.maxvel)
        if a.ground:  # Bodenkontakt: tiefster Fuß steht immer auf dem Boden (kein Schweben, kein Einsinken)
            ix = {k: KEYS.index(k) for k in KEYS}
            def drop(s_):
                ax, az, k = np.radians(arr[:, ix['l' + s_ + 'x']]), np.radians(arr[:, ix['l' + s_ + 'z']]), np.radians(arr[:, ix['k' + s_]])
                return (np.cos(ax) + np.cos(ax + k)) * np.cos(az)  # Oberschenkel + Schienbein (je 1.0 Einheiten)
            gy = np.maximum(drop('L'), drop('R')) - 2.0
            from scipy.ndimage import gaussian_filter1d
            arr[:, ix['y']] = gaussian_filter1d(gy, 1.5, mode='nearest')
        out['people'].append({'frames': np.round(arr, 2).tolist()})
    json.dump(out, open(a.out, 'w'))
    print(f'{n} Frames, {npl} Personen -> {a.out}')


if __name__ == '__main__':
    main()
