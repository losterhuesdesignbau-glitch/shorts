"""Szenenabhängige Filmmusik je Genre (synthetisch, lizenzfrei) – jedes Video klingt anders.

Genres (Episode-Feld "music"):
  dark      Dark Stories: Drones, tiefe Moll-/Cluster-Akkorde, Herzschlag, Metall-Kratzen, Riser, Stille vor dem Twist
  epic      Survival & Katastrophen: Taiko-Trommeln, Streicher-Ostinato, Blech-Swells, Sub-Bass, Steigerung
  mystery   Weird Towns: Spieluhr/Celesta-Arpeggien, warme Pads, Pizzicato, leise Percussion, filmische Akkorde
  school    School Life: Pluck-Gitarre, Klatscher, Bass, gepfiffene Melodie (lustig) bzw. Piano (emotional, "school_emo")
  battle    X vs Y: treibender Beat, Synth-Stabs, Bass, Riser + Drops an Abschnittswechseln
  trend     Trends: tanzbarer Beat (wird bei Trend-Videos meist durch den Trend-Sound in der App ersetzt)

Regeln: Steigerung über das Video (Intensitätskurve), Akzente exakt auf Schnitten und wichtigen Momenten (hits),
Ducking unter der Stimme (in audio.mix), zufällige aber reproduzierbare Varianten pro Video (seed: Tonart, Tempo, Akkordfolge, Klangfarben).
"""
import numpy as np
from scipy.signal import butter, lfilter

SR = 44100
GENRES = ('dark', 'epic', 'mystery', 'school', 'school_emo', 'battle', 'trend')


def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def _lp(x, f, o=2): b, a = butter(o, min(f / (SR / 2), 0.99), 'low'); return lfilter(b, a, x)
def _hp(x, f, o=2): b, a = butter(o, min(f / (SR / 2), 0.99), 'high'); return lfilter(b, a, x)
def _bp(x, lo, hi): b, a = butter(2, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], 'band'); return lfilter(b, a, x)
def _t(d): return np.arange(int(d * SR)) / SR
def _env(n, a=0.01, r=0.3, hold=0.0):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)); h = max(hold, a)
    return e * np.where(t < h, 1.0, np.exp(-(t - h) / max(r, 1e-3)))
def _adsr(n, a, rel):
    t = np.arange(n) / SR; d = n / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.clip((d - t) / max(rel, 1e-3), 0, 1)
def _noise(d, rng): return rng.uniform(-1, 1, int(d * SR))
def _saw(f, d, detune=0.0, rng=None):
    t = _t(d); ph = rng.uniform(0, 1) if rng is not None else 0.0
    y = 2 * ((t * f * (1 + detune) + ph) % 1.0) - 1
    return y
def _sine(f, d, ph=0.0): return np.sin(2 * np.pi * f * _t(d) + ph)


def _add(buf, y, t, g=1.0, pan=0.0):
    i = int(t * SR)
    if i >= len(buf) or len(y) == 0: return
    if i < 0: y = y[-i:]; i = 0
    y = y[: len(buf) - i] * g
    buf[i:i + len(y), 0] += y * np.cos((pan + 1) * np.pi / 4) * 1.414
    buf[i:i + len(y), 1] += y * np.sin((pan + 1) * np.pi / 4) * 1.414


# ---------- Instrumente ----------
def pad(notes, d, rng, bright=1200, a=1.2, rel=1.2, det=0.006):
    y = np.zeros(int(d * SR))
    for m in notes:
        f = midi(m)
        for k in (-1, 0, 1): y += _saw(f, d, det * k, rng) * 0.33
    y = _lp(y, bright) * _adsr(len(y), a, rel)
    return y / max(1, len(notes))

def drone(m, d, rng, bright=420):
    t = _t(d); f = midi(m)
    y = (_saw(f, d, 0, rng) + _saw(f * 1.003, d, 0, rng) + 0.6 * _saw(f * 0.5, d, 0, rng)) / 2.6
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * t * rng.uniform(0.05, 0.12))
    return _lp(y, bright) * (0.6 + 0.4 * lfo) * _adsr(len(y), 1.5, 1.5)

def pluck(m, d=0.9, bright=0.5, rng=None):  # Karplus-Strong
    f = midi(m); N = max(2, int(SR / f)); n = int(d * SR)
    buf = (rng.uniform(-1, 1, N) if rng is not None else np.random.uniform(-1, 1, N))
    out = np.zeros(n); damp = 0.5 + 0.495 * bright
    for i in range(0, n, N):
        seg = buf.copy(); out[i:i + N] = seg[: max(0, min(N, n - i))]
        buf = damp * 0.5 * (buf + np.roll(buf, -1))
    return _hp(out, 80)

def bell(m, d=1.6, g=1.0):
    f = midi(m); t = _t(d)
    y = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * (2.2 + i * 1.6)) for i, (r, a) in enumerate(((1, 1), (2.01, 0.45), (3.0, 0.25), (4.2, 0.12))))
    return y * g * np.minimum(1, t / 0.002)

def piano(m, d=1.4):
    f = midi(m); t = _t(d)
    y = sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (1.6 + k * 0.9)) for k, a in ((1, 1), (2, 0.4), (3, 0.18), (4, 0.08)))
    return y * np.minimum(1, t / 0.003)

def kick(rng, punch=1.0):
    t = _t(0.35); f = 42 + 110 * np.exp(-t * 30) * punch
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)

def taiko(rng, pitch=1.0):
    t = _t(0.9); f = (60 + 40 * np.exp(-t * 14)) * pitch
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    return body + _lp(_noise(0.9, rng), 700) * np.exp(-t * 18) * 0.6

def snare(rng, tone_=190):
    t = _t(0.25)
    return _bp(_noise(0.25, rng), 1500, 7000) * np.exp(-t * 18) * 0.8 + np.sin(2 * np.pi * tone_ * t) * np.exp(-t * 25) * 0.4

def hat(rng, open_=False):
    d = 0.18 if open_ else 0.05; t = _t(d)
    return _hp(_noise(d, rng), 7500) * np.exp(-t * (14 if open_ else 70))

def clap(rng):
    t = _t(0.25); y = _bp(_noise(0.25, rng), 900, 4000)
    e = sum(np.exp(-np.clip(t - k * 0.011, 0, None) * 60) * (t >= k * 0.011) for k in range(3)) + np.exp(-t * 14) * 0.5
    return y * e * 0.7

def sub_boom(rng, d=2.2):
    t = _t(d); f = 34 + 30 * np.exp(-t * 3)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) + _lp(_noise(d, rng), 200) * np.exp(-t * 4) * 0.5

def riser(rng, d=2.0, f0=150, f1=2400):
    t = _t(d); k = (t / d) ** 2
    y = np.sin(2 * np.pi * np.cumsum(f0 + (f1 - f0) * k) / SR) * 0.35 + _bp(_noise(d, rng), 900, 9000) * 0.6
    return y * k

def scrape(rng, d=1.4):
    t = _t(d); f = 900 + 300 * np.sin(2 * np.pi * t * 0.7)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + np.sin(2 * np.pi * np.cumsum(f * 1.41) / SR) * 0.25
    return _bp(y + _noise(d, rng) * 0.2, 700, 5000) * np.sin(np.pi * t / d) ** 2

def heartbeat(rng):
    t = _t(0.7); y = np.zeros(len(t))
    for o, g in ((0, 1.0), (0.22, 0.7)):
        tt = np.clip(t - o, 0, None); y += np.sin(2 * np.pi * 48 * tt) * np.exp(-tt * 18) * (t >= o) * g
    return y

def whistle(m, d, vib=5.5):
    t = _t(d); f = midi(m) * (1 + 0.012 * np.sin(2 * np.pi * vib * t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * _adsr(len(t), 0.04, 0.08) * (1 + 0.15 * np.sin(2 * np.pi * 3 * t))

def stab(notes, d, rng, bright=3000):
    y = np.zeros(int(d * SR))
    for m in notes:
        for k in (-1, 0, 1): y += _saw(midi(m), d, 0.008 * k, rng)
    return _lp(y / (3 * len(notes)), bright) * _env(len(y), 0.005, d * 0.5)

def bassnote(m, d, rng, bright=500):
    return _lp(_saw(midi(m), d, 0, rng) * 0.7 + _sine(midi(m), d) * 0.6, bright) * _env(int(d * SR), 0.006, d * 0.6)


# ---------- Genre-Partituren ----------
PROGS = {
    'minor': [[0, 8, 3, 10], [0, 5, 8, 7], [0, 10, 8, 7], [0, 3, 8, 5], [0, 8, 5, 7]],
    'major': [[0, 7, 9, 5], [0, 5, 7, 5], [0, 9, 5, 7], [0, 4, 5, 7], [5, 0, 7, 9]],
}

def chord(root, minor, ext=False):
    th = 3 if minor else 4
    return [root, root + th, root + 7] + ([root + 10 if minor else root + 11] if ext else [])


def score(dur, genre='dark', seed=3, cuts=(), hits=(), twist=None):
    rng = np.random.default_rng(seed * 7919 + hash(genre) % 1000)
    buf = np.zeros((int((dur + 3) * SR), 2))
    twist = twist if twist is not None else dur * 0.78
    inten = lambda t: float(np.clip(0.25 + 0.75 * (t / max(twist, 1)) ** 1.3, 0, 1)) if t < twist else 0.85  # Steigerung bis zum Twist
    minor = genre in ('dark', 'epic', 'mystery', 'school_emo') or (genre == 'battle' and rng.random() < 0.6)
    key = int(rng.integers(36, 44)) if genre in ('dark', 'epic') else int(rng.integers(45, 53))
    prog = PROGS['minor' if minor else 'major'][int(rng.integers(0, 5))]
    bpm = {'dark': rng.uniform(60, 72), 'epic': rng.uniform(84, 100), 'mystery': rng.uniform(78, 96), 'school': rng.uniform(104, 122),
           'school_emo': rng.uniform(70, 84), 'battle': rng.uniform(120, 132), 'trend': rng.uniform(100, 124)}[genre]
    beat = 60 / bpm; bar = 4 * beat; nb = int(dur / bar) + 2

    if genre == 'dark':
        _add(buf, drone(key - 12, dur + 2, rng, 300), 0, 0.5)
        _add(buf, drone(key - 5, dur + 2, rng, 220), 0, 0.22, 0.3)
        for b in range(0, nb, 2):
            t0 = b * bar; r = key + prog[(b // 2) % 4]
            notes = [r + 12, r + 13 if rng.random() < 0.35 else r + 15, r + 19]  # Cluster/Moll
            _add(buf, pad(notes, bar * 2.2, rng, 600 + 900 * inten(t0), 1.6, 1.4), t0, 0.22 * (0.5 + inten(t0)), rng.uniform(-0.4, 0.4))
            if t0 > dur * 0.25 and t0 < twist - 1:
                for k in range(int(2 * bar / (60 / 66))): _add(buf, heartbeat(rng), t0 + k * 60 / 66, 0.35 * inten(t0))
            if rng.random() < 0.5 and t0 > 3: _add(buf, scrape(rng), t0 + rng.uniform(0, bar), 0.12, rng.uniform(-0.7, 0.7))
        for k in range(int(dur / 1.7)):  # verstreute Spieluhr-Töne (unheimlich)
            if rng.random() < 0.45: _add(buf, bell(key + 24 + [0, 3, 7, 8, 10][int(rng.integers(0, 5))], 2.5, 0.25), k * 1.7 + rng.uniform(0, 0.6), 0.18, rng.uniform(-0.6, 0.6))
        _add(buf, riser(rng, 2.4, 80, 1600), twist - 2.4, 0.4)
        buf[int((twist - 0.25) * SR):int(twist * SR)] *= 0.08  # Stille vor dem Twist
        _add(buf, sub_boom(rng, 2.8), twist, 1.1)

    elif genre == 'epic':
        for b in range(nb):
            t0 = b * bar; r = key + prog[b % 4]; I = inten(t0)
            _add(buf, pad(chord(r + 12, True) + [r + 24], bar * 1.05, rng, 900 + 1800 * I, 0.6, 0.6, 0.008), t0, 0.2 + 0.18 * I)
            for k in range(8 if I > 0.45 else 4):  # Streicher-Ostinato
                n = r + 24 + [0, 7, 3, 7, 0, 7, 3, 10][k]
                _add(buf, _lp(_saw(midi(n), beat / 2 * 0.9, 0, rng), 2500) * _env(int(beat / 2 * 0.9 * SR), 0.005, 0.12), t0 + k * beat / (2 if I > 0.45 else 1), 0.07 + 0.07 * I, 0.3 if k % 2 else -0.3)
            _add(buf, bassnote(r, bar * 0.95, rng, 300), t0, 0.35)
            if b >= 1:
                pat = [0, 1.5, 2, 3, 3.5] if I > 0.6 else [0, 2, 3]
                for p in pat: _add(buf, taiko(rng, 1.0 if p % 2 == 0 else 1.3), t0 + p * beat, 0.45 * (0.5 + I))
                if I > 0.7: _add(buf, snare(rng, 160), t0 + 2 * beat, 0.25)
        _add(buf, riser(rng, 2.0, 120, 3000), twist - 2.0, 0.45)
        _add(buf, sub_boom(rng), twist, 0.9)
        _add(buf, pad(chord(key + 12, True) + [key + 24, key + 31], 4.0, rng, 3000, 0.05, 3.0), twist, 0.35)

    elif genre == 'mystery':
        arp = [0, 7, 12, 15, 19, 15, 12, 7] if minor else [0, 7, 12, 16, 19, 16, 12, 7]
        for b in range(nb):
            t0 = b * bar; r = key + prog[b % 4]; I = inten(t0)
            _add(buf, pad(chord(r + 12, minor, True), bar * 1.1, rng, 900 + 600 * I, 0.8, 0.8), t0, 0.16)
            for k in range(8):
                _add(buf, bell(r + 24 + arp[(k + b) % 8], 1.4, 1.0), t0 + k * beat / 2, 0.075, -0.4 + 0.1 * k)
            if b >= 2:
                for k in (0, 2.5): _add(buf, pluck(r - 12 + 12, 0.5, 0.3, rng), t0 + k * beat, 0.25)
                if I > 0.45:
                    for k in range(4): _add(buf, hat(rng), t0 + (k + 0.5) * beat, 0.08)
                    _add(buf, kick(rng, 0.6), t0, 0.25)
        _add(buf, riser(rng, 1.6, 300, 2600), twist - 1.6, 0.3)
        _add(buf, bell(key + 12, 3.0, 1.0) + bell(key + 19, 3.0, 0.7), twist, 0.4)

    elif genre in ('school', 'school_emo'):
        emo = genre == 'school_emo'
        mel = [0, 2, 4, 7, 4, 2, 0, 7] if not minor else [0, 3, 5, 7, 5, 3, 0, 10]
        for b in range(nb):
            t0 = b * bar; r = key + prog[b % 4]; I = inten(t0); ch = chord(r + 12, minor, emo)
            if emo:
                for k, n in enumerate([ch[0], ch[1], ch[2], ch[1]] * 2): _add(buf, piano(n + 12, 1.6), t0 + k * beat / 2, 0.11)
                _add(buf, pad(ch, bar * 1.1, rng, 1100, 1.0, 1.0), t0, 0.1 + 0.08 * I)
                _add(buf, piano(r, 2.5), t0, 0.18)
            else:
                for k in (0, 1, 1.5, 2.5, 3):
                    for j, n in enumerate(ch): _add(buf, pluck(n, 0.6, 0.55, rng), t0 + k * beat + j * 0.012, 0.11)
                _add(buf, bassnote(r, beat * 0.9, rng, 600), t0, 0.3); _add(buf, bassnote(r + 7, beat * 0.9, rng, 600), t0 + 2 * beat, 0.25)
                if b >= 1:
                    _add(buf, kick(rng, 0.8), t0, 0.35); _add(buf, kick(rng, 0.8), t0 + 2.5 * beat, 0.25)
                    for k in (1, 3): _add(buf, clap(rng), t0 + k * beat, 0.25)
                if b >= 4 and (b // 4) % 2 == 1:
                    for k in range(8):
                        if (k + b) % 3 != 2: _add(buf, whistle(r + 24 + mel[k], beat / 2 * 0.9), t0 + k * beat / 2, 0.06)
        _add(buf, riser(rng, 1.4, 400, 3000), twist - 1.4, 0.25)

    elif genre in ('battle', 'trend'):
        drop_every = 8
        for b in range(nb):
            t0 = b * bar; r = key + prog[b % 4]; I = inten(t0); sec = b % drop_every
            pre = sec >= drop_every - 1
            ch = chord(r + 12, minor)
            for k in (0, 0.75, 1.5, 2.5, 3.25) if genre == 'battle' else (0, 1.5, 3):
                _add(buf, stab(ch + [ch[0] + 12], beat * 0.5, rng, 2500 + 3000 * I), t0 + k * beat, 0.1 + 0.06 * I, 0.25 * (1 if k % 1 else -1))
            for k in range(8): _add(buf, bassnote(r if k % 4 else r, beat / 2 * 0.85, rng, 400 + 400 * I), t0 + k * beat / 2, 0.22)
            if b >= 1 and not pre:
                for k in range(4): _add(buf, kick(rng, 1.0), t0 + k * beat, 0.5)
                for k in (1, 3): _add(buf, clap(rng) + snare(rng) * 0.5, t0 + k * beat, 0.28)
                for k in range(8): _add(buf, hat(rng, k % 2 == 1), t0 + k * beat / 2, 0.07)
            if pre:  # Snare-Wirbel + Riser vor dem Drop
                for k in range(16): _add(buf, snare(rng), t0 + k * beat / 4, 0.06 + 0.012 * k)
                _add(buf, riser(rng, bar, 200, 4000), t0, 0.3)
        _add(buf, sub_boom(rng, 1.8), twist, 0.7)

    # Akzente: dezente Impulse auf Schnitten, deutliche auf wichtigen Momenten (Szenen-Synchronität)
    accent = {'dark': lambda: _lp(_noise(0.5, rng), 300) * np.exp(-_t(0.5) * 9) * 0.8,
              'epic': lambda: taiko(rng, 0.8), 'battle': lambda: _hp(_noise(0.3, rng), 2000) * np.exp(-_t(0.3) * 12) * 0.5,
              }.get(genre, lambda: _hp(_noise(0.15, rng), 3000) * np.exp(-_t(0.15) * 30) * 0.3)
    for c in cuts:
        if 0.5 < c < dur - 0.3: _add(buf, accent(), c, 0.1)
    for h in hits:
        if 0 < h < dur: _add(buf, sub_boom(rng, 1.4) if genre in ('dark', 'epic') else accent(), h, 0.35)

    buf = buf[: int(dur * SR)]
    buf = _hp(buf.T, 30).T
    fade = int(min(2.0, dur / 5) * SR)
    if fade: buf[-fade:] *= np.linspace(1, 0, fade)[:, None]
    pk = np.max(np.abs(buf)) + 1e-9
    return np.tanh(buf / pk * 1.3) / 1.3 * 0.9
