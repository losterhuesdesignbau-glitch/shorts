"""audio.py – Timing (Schätzung oder aus Voiceover), Musik- und Soundeffekt-Synthese, Mix."""
import math, re, subprocess
import numpy as np
from scipy.signal import butter, lfilter

SR = 44100

# ---------------- Text / Wörter ----------------
PUNCT_END = re.compile(r'[.!?…]+["“”»«)]*$')
PUNCT_MID = re.compile(r'[,;:–—-]+["“”»«)]*$')

def syllables(w):
    w = w.lower()
    digits = re.sub(r'\D', '', w)
    if digits:
        return max(2, len(digits) * 2)
    return max(1, len(re.findall(r'[aeiouyäöü]+', w)))

def tokenize(text):
    """'Ein *Wort* hier.' -> [{'w','raw','hi','pause'}]"""
    out = []
    for raw in str(text or '').split():
        hi = '*' in raw
        clean = raw.replace('*', '')
        disp = clean.strip('.,;:!?…"„“”»«()')
        if not disp:
            if out: out[-1]['pause'] = max(out[-1]['pause'], 0.3)
            continue
        pause = 0.0
        if PUNCT_END.search(clean): pause = 0.34
        elif PUNCT_MID.search(clean): pause = 0.18
        out.append({'w': disp, 'raw': clean, 'hi': hi, 'pause': pause, 'syl': syllables(disp)})
    return out

def estimate_times(words, speed=1.0, start=0.3):
    t = start
    for w in words:
        d = (0.1 + 0.1 * w['syl']) / speed
        w['t0'], w['t1'] = t, t + d
        t += d + (0.035 + w['pause']) / speed
    return t

# ---------------- Audio I/O ----------------
def load_audio(path, sr=SR):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

def write_wav(path, x, sr=SR):
    from scipy.io import wavfile
    x = np.clip(x, -1, 1)
    wavfile.write(path, sr, (x * 32767).astype(np.int16))

def energy_db(x, sr=SR):
    hop = int(sr * 0.01); n = len(x) // hop
    fr = x[: n * hop].reshape(n, hop)
    return 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)

def speech_segments(x, sr=SR, min_sil=0.12, min_sp=0.07):
    hop = int(sr * 0.01); n = len(x) // hop
    if n < 3: return []
    fr = x[: n * hop].reshape(n, hop)
    db = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)
    lo, hi = np.percentile(db, 8), np.percentile(db, 97)
    thr = max(lo + 6, lo + 0.3 * (hi - lo))
    sp = db > thr
    segs, i = [], 0
    while i < n:
        if sp[i]:
            j = i
            while j < n and sp[j]: j += 1
            segs.append([i, j]); i = j
        else: i += 1
    merged = []
    for s in segs:
        if merged and (s[0] - merged[-1][1]) * 0.01 < min_sil: merged[-1][1] = s[1]
        else: merged.append(s)
    return [(a * 0.01, b * 0.01) for a, b in merged if (b - a) * 0.01 >= min_sp]

def align_to_voice(words, segs, db=None):
    """Wörter per DP auf Sprachsegmente verteilen (Pausen ≈ Satzzeichen)."""
    N, M = len(words), len(segs)
    if not N or not M: return
    Wt = [0.6 + w['syl'] for w in words]
    pre = np.concatenate([[0], np.cumsum(Wt)])
    dur = [b - a for a, b in segs]
    rate = sum(dur) / pre[-1]
    INF = 1e18
    cost = np.full((M + 1, N + 1), INF); back = np.zeros((M + 1, N + 1), dtype=int)
    cost[0][0] = 0
    for j in range(1, M + 1):
        dj = dur[j - 1]
        for i in range(0, N + 1):
            best, bk = cost[j - 1][i] + 1.5 + dj * 2, i  # Segment ohne Wörter (Geräusch)
            for k in range(max(0, i - 45), i):
                if cost[j - 1][k] >= INF: continue
                exp = rate * (pre[i] - pre[k])
                c = 4 * math.log((dj + 0.08) / (exp + 0.08)) ** 2
                if i < N and words[i - 1]['pause'] == 0: c += 0.9
                v = cost[j - 1][k] + c
                if v < best: best, bk = v, k
            cost[j][i], back[j][i] = best, bk
    groups, i = [], N
    for j in range(M, 0, -1):
        k = back[j][i]; groups.append((j - 1, k, i)); i = k
    for sj, k, i in groups:
        if k == i: continue
        a, b = segs[sj]; tot = pre[i] - pre[k]; t = a
        for q in range(k, i):
            d = (b - a) * Wt[q] / tot
            words[q]['t0'], words[q]['t1'] = t, t + d * 0.92
            t += d
        if db is not None:  # Wortgrenzen auf Energie-Täler im Umkreis von 90 ms schieben
            for q in range(k + 1, i):
                c = words[q]['t0']; lo = max(int((c - 0.09) * 100), int(words[q - 1]['t0'] * 100) + 3); hi = min(int((c + 0.09) * 100), int(words[q]['t1'] * 100) - 3, len(db) - 1)
                if hi > lo:
                    m = (lo + int(np.argmin(db[lo:hi + 1]))) / 100.0
                    words[q]['t0'] = m; words[q - 1]['t1'] = min(words[q - 1]['t1'], m)

# ---------------- Synthese ----------------
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def env(n, a=0.004, tau=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / tau)
def tone(f, d, harm=(1, 0.5, 0.25), tau=0.2, a=0.004):
    n = int(d * SR); t = np.arange(n) / SR
    y = sum(h * np.sin(2 * np.pi * f * (i + 1) * t) for i, h in enumerate(harm))
    return y * env(n, a, tau)
def noise(d, seed=0): return np.random.default_rng(seed).uniform(-1, 1, int(d * SR))
def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], 'band'); return lfilter(b, a, x)
def hp(x, f): b, a = butter(2, f / (SR / 2), 'high'); return lfilter(b, a, x)
def lp(x, f): b, a = butter(2, f / (SR / 2), 'low'); return lfilter(b, a, x)

def add(buf, y, t, pan=0.0, g=1.0):
    i = int(t * SR)
    if i >= len(buf) or i < 0: return
    y = y[: len(buf) - i] * g
    buf[i:i + len(y), 0] += y * math.cos((pan + 1) * math.pi / 4) * 1.414
    buf[i:i + len(y), 1] += y * math.sin((pan + 1) * math.pi / 4) * 1.414

MOODS = {
    'happy': dict(bpm=116, prog=[(0, 'M'), (7, 'M'), (9, 'm'), (5, 'M')], key=60, scale=[0, 2, 4, 7, 9]),
    'chill': dict(bpm=92, prog=[(0, 'M'), (9, 'm'), (5, 'M'), (7, 'M')], key=60, scale=[0, 2, 4, 7, 9]),
    'mystery': dict(bpm=98, prog=[(9, 'm'), (5, 'M'), (0, 'M'), (7, 'M')], key=57, scale=[0, 3, 5, 7, 10]),
    'tense': dict(bpm=124, prog=[(9, 'm'), (9, 'm'), (5, 'M'), (4, 'M')], key=57, scale=[0, 3, 5, 7, 10]),
}

def music(dur, mood='happy', seed=3):
    M = MOODS.get(mood, MOODS['happy']); bpm = M['bpm']; beat = 60 / bpm; bar = 4 * beat
    rng = np.random.default_rng(seed)
    buf = np.zeros((int((dur + 2) * SR), 2))
    kick = (lambda n: np.sin(2 * np.pi * np.cumsum(45 + 95 * np.exp(-np.arange(n) / SR * 32)) / SR) * np.exp(-np.arange(n) / SR * 9))(int(0.3 * SR))
    snare = bp(noise(0.22, 1), 1200, 6000) * env(int(0.22 * SR), 0.001, 0.06) * 0.8 + tone(190, 0.22, (1,), 0.05) * 0.4
    hat = hp(noise(0.06, 2), 7000) * env(int(0.06 * SR), 0.001, 0.015)
    mk = lambda: [(rng.integers(0, 5), rng.integers(0, 2)) if rng.random() < 0.6 else None for _ in range(16)]
    motifs = [mk(), mk()]  # A/B-Teil im 8-Takt-Wechsel, damit lange Videos nicht eintönig werden
    nbars = int(dur / bar) + 2
    for b in range(nbars):
        t0 = b * bar; root, q = M['prog'][b % 4]
        third = 3 if q == 'm' else 4
        chord = [M['key'] + root + iv for iv in (0, third, 7, 12)]
        for k, off in enumerate((0, 1.5, 2, 3.5)):
            add(buf, tone(midi(M['key'] - 24 + root), 0.45, (1, 0.35, 0.12), 0.22), t0 + off * beat, 0, 0.32 if k % 2 == 0 else 0.22)
        for s in range(8):
            n = chord[[0, 1, 2, 3, 2, 1, 2, 3][s]]
            add(buf, tone(midi(n), 0.35, (1, 0.45, 0.2, 0.1), 0.16), t0 + s * beat / 2, -0.35 if s % 2 else 0.35, 0.09)
        motif = motifs[(b // 8) % 2]
        drums = b >= 1 and b % 16 != 8  # alle 16 Takte ein Takt ohne Schlagzeug (Atempause)
        if b >= 1:
            for s in range(8):
                m = motif[(s + (b % 2) * 8) % 16]
                if m is None: continue
                deg, octv = m
                n = M['key'] + 12 + M['scale'][deg] + 12 * octv * 0
                add(buf, tone(midi(n), 0.4, (1, 0, 0, 0.3), 0.2, 0.002), t0 + s * beat / 2, 0.15, 0.085)
        if drums:
            for k in (0, 2): add(buf, kick, t0 + k * beat, 0, 0.5)
            if b % 4 == 3: add(buf, kick, t0 + 3.5 * beat, 0, 0.35)
            for k in (1, 3): add(buf, snare, t0 + k * beat, 0, 0.22)
            for s in range(8): add(buf, hat, t0 + s * beat / 2 + 0.005, 0.3, 0.12 if s % 2 else 0.07)
    buf = buf[: int(dur * SR)]
    fade = int(min(1.5, dur / 4) * SR)
    if fade: buf[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return np.tanh(buf * 1.2) / 1.2

def sfx(name):
    if name == 'pop':
        n = int(0.1 * SR); t = np.arange(n) / SR; f = 900 * np.exp(-t * 25) + 300
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.04)
    if name == 'coin':
        return np.concatenate([tone(988, 0.07, (1, 0, 0.3), 0.2, 0.001), tone(1319, 0.35, (1, 0, 0.3), 0.12, 0.001)]) * 0.7
    if name == 'ding':
        return sum(tone(880 * r, 1.2, (1,), 0.5 / (i + 1), 0.001) * (0.6 / (i + 1)) for i, r in enumerate((1, 2.76, 5.4)))
    if name == 'whoosh':
        n = int(0.45 * SR); t = np.linspace(0, 1, n); e = np.sin(np.pi * t) ** 2
        return (bp(noise(0.45, 5), 400, 2500) * e * 0.7 + bp(noise(0.45, 6), 2000, 8000) * e * t * 0.4)
    if name == 'boing':
        n = int(0.45 * SR); t = np.arange(n) / SR; f = 180 + 220 * t / 0.45 + 40 * np.sin(2 * np.pi * 14 * t)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.18)
    if name == 'poof':
        return lp(noise(0.5, 7), 900) * env(int(0.5 * SR), 0.005, 0.12) * 2.5
    if name == 'boom':
        n = int(0.9 * SR); t = np.arange(n) / SR
        return (np.sin(2 * np.pi * np.cumsum(55 + 40 * np.exp(-t * 6)) / SR) * env(n, 0.002, 0.35) + lp(noise(0.9, 8), 400) * env(n, 0.001, 0.15)) * 0.9
    if name == 'riser':
        n = int(1.0 * SR); t = np.arange(n) / SR; f = 200 + 900 * (t / 1.0) ** 2
        e = (t / 1.0) ** 2
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + hp(noise(1.0, 9), 3000) * 0.5) * e
    if name == 'tada':
        out = np.zeros(int(1.0 * SR))
        for k, m in enumerate((72, 76, 79, 84)):
            y = tone(midi(m), 0.8 - k * 0.1, (1, 0.5, 0.3), 0.3); i = int(k * 0.09 * SR); out[i:i + len(y)] += y[: len(out) - i] * 0.35
        return out
    if name == 'chop':
        n = int(0.09 * SR); t = np.arange(n) / SR
        return (hp(noise(0.09, 12), 1800) * env(n, 0.0005, 0.018) * 0.9 + np.sin(2 * np.pi * 140 * t) * np.exp(-t * 60) * 0.5)
    if name == 'shred':
        n = int(0.22 * SR); t = np.linspace(0, 1, n)
        return bp(noise(0.22, 13), 2500, 7000) * (np.sin(np.pi * t) ** 0.6) * (0.6 + 0.4 * np.sin(2 * np.pi * 38 * t)) * 0.8
    if name == 'tick':
        return hp(noise(0.03, 10), 3000) * env(int(0.03 * SR), 0.0005, 0.006)
    if name == 'snore':
        n = int(1.0 * SR); t = np.arange(n) / SR
        return lp(noise(1.0, 11), 300) * (np.sin(np.pi * t) ** 2) * 1.5
    return np.zeros(10)

def mix(total, events, voice=None, mood='happy', music_on=True, seed=3, music_gain=None):
    buf = np.zeros((int(total * SR) + 1, 2))
    if music_on:
        m = music(total, mood, seed)
        g = music_gain if music_gain is not None else (0.33 if voice is not None else 0.75)
        if voice is not None and len(voice):  # Ducking: Musik leiser, solange gesprochen wird
            from scipy.ndimage import uniform_filter1d
            e = np.zeros(len(m)); n = min(len(m), len(voice)); e[:n] = np.abs(voice[:n])
            e = uniform_filter1d(e, int(0.3 * SR))
            ref = np.percentile(e[e > 1e-4], 90) if np.any(e > 1e-4) else 1.0
            m = m * (1 - 0.4 * np.clip(e / (0.5 * ref + 1e-9), 0, 1))[:, None]
        buf[: len(m)] += m * g
    for name, t, g in events:
        add(buf, sfx(name), t, 0, 0.5 * g)
    if voice is not None:
        v = hp(voice, 80)
        rms = np.sqrt(np.mean(v[np.abs(v) > 1e-4] ** 2) + 1e-9)
        v = np.tanh(v * (0.12 / rms) * 1.6) / 1.6 * 1.0
        n = min(len(v), len(buf)); buf[:n, 0] += v[:n]; buf[:n, 1] += v[:n]
    peak = np.max(np.abs(buf)) + 1e-9
    if peak > 0.97: buf *= 0.97 / peak
    return buf
