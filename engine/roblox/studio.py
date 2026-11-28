#!/usr/bin/env python3
"""
studio.py – Block-Studio: Episode (JSON) -> 9:16-Video im Roblox-Look.

  python studio.py episode.json -o video.mp4            # komplettes Video, Sprecherstimme automatisch aus dem Skript (Piper)
  python studio.py episode.json --voice stimme.m4a      # eigenes Voiceover statt Computerstimme
  python studio.py episode.json --no-tts                # ohne Stimme (nur Musik + Effekte)
  python studio.py episode.json --stimme                # nur die Sprachspur als WAV (zum Probehören) + Längen-Check
  python studio.py episode.json --stills                # nur Vorschau-Kontaktbogen (schnell)
  python studio.py episode.json --only 3,4              # nur bestimmte Shots neu rendern (Rest aus Cache)

Episode-Format: siehe README.md
"""
import argparse, base64, hashlib, json, math, os, re, shutil, subprocess, sys, time
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import audio as AU
import tts as TTS

ENGINE = (HERE / 'engine' / 'engine.html').as_uri()
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
W, H = 1080, 1920

AUTO_SFX = {'coins': 'coin', 'poof': 'poof', 'confetti': 'tada', 'flash': 'whoosh', 'shake': 'boom', 'zoom': 'whoosh'}

def compile_episode(ep, voice_path=None, speed=1.0, tts=None):
    shots = ep['shots']
    allw = []
    for si, sh in enumerate(shots):
        ws = AU.tokenize(sh.get('say', ''))
        for w in ws: w['shot'] = si
        sh['_w'] = ws; allw += ws
    voice = None
    if voice_path:
        voice = AU.load_audio(voice_path)
        segs = AU.speech_segments(voice)
        AU.align_to_voice(allw, segs, AU.energy_db(voice))
        for w in allw: w['t0'], w['t1'] = float(w['t0']), float(w['t1'])
        print(f'Voiceover: {len(voice)/AU.SR:.1f}s, {len(segs)} Sprachsegmente, {len(allw)} Wörter')
    elif tts is not None:
        try:
            voice = TTS.speak_episode(ep, shots, tts)
        except Exception as e:
            print(f'WARNUNG: Sprecherstimme fehlgeschlagen ({e}) – Video ohne Stimme.', flush=True)
            voice = None
    if voice is None:
        AU.estimate_times(allw, speed=ep.get('speed', speed), start=ep.get('lead', 0.25))
    # stumme Shots (ohne 'say') schieben bei geschätztem Timing die Zeitleiste
    if voice is None:
        for si, sh in enumerate(shots):
            if not sh['_w']:
                d = float(sh.get('dur', 1.2))
                for w in allw:
                    if w['shot'] > si: w['t0'] += d; w['t1'] += d
    # Shot-Grenzen: Schnitt kurz vor dem ersten Wort des Shots
    starts, prev_end = [], 0.0
    for si, sh in enumerate(shots):
        if si == 0: s = 0.0
        elif sh['_w']: s = sh['_w'][0]['t0'] - 0.06
        else: s = prev_end + 0.08
        if si: s = max(s, starts[-1] + 0.3)
        starts.append(s)
        if sh['_w']: prev_end = sh['_w'][-1]['t1']
        else: prev_end = s + float(sh.get('dur', 1.2))
    end = max((allw[-1]['t1'] if allw else 0) + float(ep.get('tail', 1.0)), prev_end, starts[-1] + 0.5)
    if voice is not None: end = max(end, len(voice) / AU.SR + 0.3)
    fps = ep.get('fps', 30)
    out = {'cast': ep.get('cast', {}), 'miiTown': bool(ep.get('miiTown')), 'miiScale': ep.get('miiScale', 0.8), 'capY': ep.get('capY', 0.64), 'capSize': ep.get('capSize', 104), 'shots': []}
    events = []
    for si, sh in enumerate(shots):
        t0 = starts[si]; t1 = starts[si + 1] if si + 1 < len(shots) else end
        f0, f1 = round(t0 * fps), round(t1 * fps)
        dur = max(1, f1 - f0) / fps
        e = {k: v for k, v in sh.items() if not k.startswith('_') and k not in ('say', 'speak', 'voice', 'pause')}
        e['dur'] = dur; e['tg0'] = f0 / fps; e['f0'] = f0; e['nf'] = max(1, f1 - f0)
        e['words'] = [{'w': w['w'], 't0': w['t0'] - f0 / fps, 't1': w['t1'] - f0 / fps, 'hi': w['hi']} for w in sh['_w']]
        out['shots'].append(e)
        for fx in sh.get('fx', []):
            nm = fx.get('sfx', AUTO_SFX.get(fx.get('type')))
            if nm: events.append((nm, f0 / fps + fx.get('t', 0) * dur, fx.get('vol', 1.0)))
        for p in sh.get('pops', []):
            events.append((p.get('sfx', 'pop'), f0 / fps + p.get('t', 0) * dur, 0.8))
        for s in sh.get('sfx', []):
            events.append((s[0], f0 / fps + s[1] * dur, s[2] if len(s) > 2 else 1.0))
        if ep.get('cutSfx') and si: events.append((ep['cutSfx'], f0 / fps, 0.5))
    if ep.get('autoSfx', True): events += auto_sfx(ep, shots, out['shots'], events, fps)
    total = sum(s['nf'] for s in out['shots']) / fps
    return out, events, voice, total, fps

# ---------------- Automatisches Sounddesign (Lukas 22.11.) ----------------
# Liest Stimmung/Aktion/Text jedes Shots und legt passende Effekte darunter – sparsam (mind. 5 s Abstand),
# nie auf Shots, die schon eigene Sounds haben. Comedy-Serien: Meme-Sounds; düstere Serien: Spannungs-Sounds.
# Abschalten: "autoSfx": false in der episode.json.
COMEDY = {'school', 'trend', 'battle', 'happy', 'funny'}
DARKG = {'dark', 'mystery', 'tense'}
def auto_sfx(ep, shots, outs, events, fps):
    genre = ep.get('music', ''); res = []; last = -99.0
    taken = sorted(t for _, t, _ in events)
    def busy(a, b): return any(a - 0.25 <= x <= b for x in taken)
    for sh, o in zip(shots, outs):
        a = o['tg0']; b = a + o['dur']
        if sh.get('sfx') or busy(a, b) or a - last < 5.0: continue
        acts = sh.get('actors') or []
        _fl = lambda v: [y[0] if isinstance(y, list) else y for y in v] if isinstance(v, list) else [v]   # auch Zeitlisten [["walk",0,0.5],…]
        moods = {m for x in acts for m in _fl(x.get('mood'))}; dos = {d for x in acts for d in _fl(x.get('do'))}
        say = (sh.get('say') or '').strip()
        pick = None
        low = say.lower()
        if genre not in DARKG and re.search(r'\b(money|cash|dollars?|\$\d|rich|million|billion|paid|bought|buy)\b', low): pick = ('cash', 0.3, 0.6)
        elif genre in COMEDY and re.search(r'\b(wrong|fail(ed)?|lost|nope|no way|zero)\b', low) and moods & {'disappointed', 'sad', 'cry'}: pick = ('fail', 0.2, 0.7)
        elif genre in COMEDY and re.search(r'\b(correct|right answer|won|wins|point for)\b', low): pick = ('correct', 0.15, 0.6)
        if pick: pass
        elif genre in DARKG:
            if sh.get('pause'): pick = ('drone', 0.0, 0.8)
            elif moods & {'panic', 'scared', 'fear'}: pick = ('heartbeat', 0.05, 0.9)
        elif genre in COMEDY or genre == 'epic':
            if 'facepalm' in dos: pick = ('scratch', 0.08, 0.7)
            elif moods & {'shock', 'panic'} and genre in COMEDY: pick = ('bassboom', 0.06, 0.8)
            elif 'freeze' in dos: pick = ('error', 0.15, 0.6)
            elif say.endswith('?') and moods & {'confused'} and genre in COMEDY: pick = ('crickets', 0.55, 0.8)
            elif dos & {'jump', 'cheer'} and moods & {'excited', 'laugh'}: pick = ('sparkle', 0.1, 0.6)
        if pick:
            res.append((pick[0], a + pick[1] * o['dur'], pick[2])); last = a
    if res: print(f"Auto-Sounddesign: {len(res)} Effekte ({', '.join(sorted({r[0] for r in res}))})", flush=True)
    return res

# ---------------- Länge (Monetarisierung) ----------------
# TikTok Creator Rewards: nur Videos ab 1 Minute. YouTube Shorts: bis 3 Minuten.
LENGTH = {'min': 40.0, 'goal': 61.0, 'max': 175.0, 'hold': 4.0}

def length_rule(src):
    v = src.get('length', {})
    if v is False: return None
    L = dict(LENGTH)
    if isinstance(v, (int, float)): L['goal'] = float(v)
    elif isinstance(v, dict): L.update({k: float(x) for k, x in v.items()})
    return L

def length_report(ep, total, L):
    """-> (ok, Text). ok=False heißt: nicht rendern (außer --force)."""
    ws = [(w['t0'] + s['tg0'], w['t1'] + s['tg0']) for s in ep['shots'] for w in s['words']]
    wps = len(ws) / max(1.0, ws[-1][1] - ws[0][0]) if len(ws) > 1 else 2.8
    need = lambda sec: f'ca. {math.ceil(sec * wps / 5) * 5} Wörter (~{max(1, round(sec / 1.6))} Shots) mehr'
    if total < L['min']:
        return False, f'❌ Länge {total:.1f}s – Minimum {L["min"]:.0f}s. Für ≥ {L["goal"]:.0f}s: {need(L["goal"] - total)}.'
    if total > L['max']:
        return False, f'❌ Länge {total:.1f}s – Maximum {L["max"]:.0f}s (YouTube Shorts ≤ 3 min). Kürzen.'
    if total < L['goal']:
        return True, f'⚠ Länge {total:.1f}s – unter {L["goal"]:.0f}s (TikTok zahlt erst ab 1 min). Für ≥ {L["goal"]:.0f}s: {need(L["goal"] - total)}.'
    return True, f'✓ Länge {total:.1f}s (Ziel ≥ {L["goal"]:.0f}s, {len(ws)} Wörter, {wps:.1f} Wörter/s)'

_META = None
def engine_meta():
    """Moods/Tiere/Sets/Requisiten der Engine (statisch aus den JS-Dateien gelesen, ohne Browser)."""
    global _META
    if _META is None:
        import re as _re
        A = (HERE / 'engine' / 'assets.js').read_text(encoding='utf-8')
        def keys(name, src):
            i = src.index('const ' + name + ' = {'); j = src.index('\n};', i); return _re.findall(r'(?:^|[\s{,])([a-z0-9_]+): *\{', src[i + len(name) + 9:j])
        _META = {'moods': keys('MOODS', A), 'animals': keys('ANIMALS', A),
                 'indoor': ['classroom', 'danceroom', 'room', 'elevator', 'hallway', 'kitchen', 'mall']}
    return _META

def add_lipsync(ep, voice, fps):
    """Mundöffnung je Bild (0 zu, 1 halb, 2 weit) aus der Lautstärke der Sprachspur -> shot['lip'] (Lippensynchronität)."""
    import numpy as np
    if voice is None: return
    v = np.asarray(voice, dtype=np.float32)
    if v.ndim == 2: v = v.mean(axis=1)
    sr = AU.SR; hop = sr / fps; win = int(sr * 0.045)
    n = int(len(v) / hop) + 1
    rms = np.array([float(np.sqrt(np.mean(v[max(0, int(k * hop) - win // 2):int(k * hop) + win // 2] ** 2) + 1e-12)) for k in range(n)])
    voiced = rms[rms > rms.max() * 0.05] if rms.max() > 0 else rms
    ref = float(np.percentile(voiced, 85)) if len(voiced) else 1.0
    lv = rms / max(ref, 1e-6)
    lab = np.where(lv > 0.62, 2, np.where(lv > 0.2, 1, 0))
    for k in range(1, n - 1):  # Einzelbild-Flackern glätten
        if lab[k - 1] == lab[k + 1] != lab[k]: lab[k] = lab[k - 1]
    for sh in ep['shots']:
        f0 = int(round(sh.get('tg0', 0) * fps)); nf = int(sh.get('nf') or round(sh['dur'] * fps))
        sh['lip'] = ''.join(str(int(x)) for x in lab[f0:f0 + nf]); sh['lipFps'] = fps

class Engine:
    def __init__(self, ep, rs=0.75, hq=False, out=1):
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        self.b = self.pw.chromium.launch(args=ARGS)
        self.pg = self.b.new_page(viewport={'width': W, 'height': H})
        self.errs = []
        self.pg.on('pageerror', lambda e: self.errs.append(str(e)))
        self.pg.on('console', lambda m: self.errs.append(m.text) if m.type == 'error' else None)
        self.pg.goto(ENGINE)
        if hq: self.pg.evaluate('window._hq = true')
        self.pg.evaluate(f'R.init({W},{H},{rs},{out})')
        self.pg.evaluate('ep => R.load(ep)', ep)
        if os.environ.get('VF_CLEAN'): self.pg.evaluate('R.clean = true')   # Bilder ohne Untertitel/Text (Vorschaubild-Tests)
    def frame(self, si, t, q=0.92):
        d = self.pg.evaluate('([s,t,q]) => R.frame(s,t,q)', [si, t, q])
        if self.errs: raise RuntimeError('Engine-Fehler: ' + ' | '.join(self.errs[:3]))
        return base64.b64decode(d.split(',', 1)[1])
    def close(self):
        self.b.close(); self.pw.stop()

def _keyround(o):
    """Cache-Schlüssel robust machen: Kommazahlen auf 0,02 runden (Sprachsynthese schwankt je Server im Mikrosekunden-Bereich)."""
    if isinstance(o, float): return round(o * 50) / 50
    if isinstance(o, dict): return {k: _keyround(v) for k, v in o.items()}
    if isinstance(o, list): return [_keyround(v) for v in o]
    return o


GRADE_PRESETS = {   # automatischer Look je Serie (überschreibbar mit "grade" in der episode.json, aus mit "autoGrade": false)
    'dark':       {'bloom': 0.25, 'vignette': 0.5, 'sat': 0.96, 'contrast': 1.08, 'warm': -0.05, 'vibrance': 0.08, 'split': 0.03, 'clarity': 0.25},
    'mystery':    {'bloom': 0.3, 'vignette': 0.4, 'sat': 1.05, 'contrast': 1.06, 'warm': -0.02, 'vibrance': 0.15, 'split': 0.025, 'clarity': 0.3},
    'school':     {'bloom': 0.3, 'vignette': 0.22, 'sat': 1.12, 'contrast': 1.05, 'warm': 0.05, 'vibrance': 0.25, 'clarity': 0.3},
    'school_emo': {'bloom': 0.35, 'vignette': 0.38, 'sat': 1.02, 'contrast': 1.04, 'warm': 0.06, 'vibrance': 0.15, 'clarity': 0.25},
    'trend':      {'bloom': 0.3, 'vignette': 0.2, 'sat': 1.14, 'contrast': 1.06, 'warm': 0.04, 'vibrance': 0.28, 'clarity': 0.32},
    'battle':     {'bloom': 0.35, 'vignette': 0.32, 'sat': 1.1, 'contrast': 1.08, 'warm': 0.02, 'vibrance': 0.22, 'split': 0.035, 'clarity': 0.35},
    'epic':       {'bloom': 0.35, 'vignette': 0.35, 'sat': 1.08, 'contrast': 1.08, 'warm': 0.03, 'vibrance': 0.2, 'split': 0.04, 'clarity': 0.35},
    '_':          {'bloom': 0.3, 'vignette': 0.3, 'sat': 1.08, 'contrast': 1.05, 'warm': 0.04, 'vibrance': 0.2, 'clarity': 0.3},
}

def post_filter(src, hq, out_k, sh=None):
    """Nachbearbeitung je Bild (Grading/Glühen, Nachschärfen + Korn, Bewegungsunschärfe) als ffmpeg-Filterkette.
    Läuft direkt beim Kodieren jedes Shots -> in CI auf alle Render-Teile verteilt, kein extra 4K-Durchlauf am Ende."""
    parts = []
    gr = src.get('grade')
    if gr is None and src.get('autoGrade', True):   # Lichtstimmung automatisch je Serie (Lukas 22.11.: jede Szene eigene Stimmung)
        gr = dict(GRADE_PRESETS.get(src.get('music'), GRADE_PRESETS['_']))
    if gr:  # Look: Glühen (bloom, auf 1/4 Größe weichgezeichnet), Vignette, Sättigung/Kontrast, Wärme
        gr = gr if isinstance(gr, dict) else {}
        b, vg = float(gr.get('bloom', 0.35)), float(gr.get('vignette', 0.35)); sat, con = gr.get('sat', 1.08), gr.get('contrast', 1.04); warm = float(gr.get('warm', 0.04))
        # Kontrast als sanfte S-Kurve (eq contrast drückt dunkle Bilder ins Schwarze); Nacht/Dämmerung: Schatten anheben, damit Gesichter lesbar bleiben
        dark = sh is not None and (sh.get('time') in ('night', 'dusk', 'sunset') or sh.get('timeTo') in ('night', 'dusk'))
        k = max(0.0, float(con) - 1.0)
        curve = "0/0.01 0.08/0.13 0.25/0.33 0.6/0.66 1/1" if dark else f"0/0 0.25/{0.25 - k * 0.25:.3f} 0.75/{0.75 + k * 0.3:.3f} 1/1"
        parts.append(f"format=gbrp,split[ga][gb];[gb]scale=iw/4:ih/4:flags=bilinear,curves=all='0/0 0.62/0 1/1',gblur=sigma={26 / 4:.2f},scale=iw*4:ih*4:flags=bilinear[gg];"
                     f"[ga][gg]blend=all_mode=screen:all_opacity={b:.2f},colorbalance=rs={warm:.3f}:bs={-warm:.3f}:rm={warm/2:.3f}:bm={-warm/2:.3f},curves=all='{curve}',format=yuv420p,"
                     f"eq=saturation={sat},vignette=angle={0.15 + vg * 0.6:.2f}")
        vib, tone = float(gr.get('vibrance', 0.18)), float(gr.get('split', 0.0))
        if vib > 0: parts.append(f"vibrance=intensity={vib:.2f}")   # schwache Farben kräftiger, Hauttöne/kräftige Farben bleiben
        if tone: parts.append(f"colorbalance=rs={-tone:.3f}:gs={tone * 0.2:.3f}:bs={tone:.3f}:rh={tone * 0.8:.3f}:gh={tone * 0.2:.3f}:bh={-tone:.3f}")  # Teal & Orange
        if hq and float(gr.get('clarity', 0.3)) > 0: parts.append(f"unsharp=13:13:{float(gr.get('clarity', 0.3)):.2f}:5:5:0.0")   # lokaler Kontrast (Klarheit)
    if hq and src.get('post', True) is not False:  # 4K-Look: feines Nachschärfen + leichtes Filmkorn
        parts.append('unsharp=5:5:0.55:5:5:0.0' + ',noise=c0s=5:c0f=t+u')
    mbl = src.get('motionBlur')
    if mbl:
        w = 2 if mbl is True else max(1, int(round(3 - float(mbl) * 2)))
        parts.append(f"tmix=frames=2:weights='1 {w}'")
    return ','.join(parts) if parts else None


def render_shot(eng, ep, si, path, fps, vf=None):
    sh = ep['shots'][si]
    tmp = str(path) + '.part.mp4'
    cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-'] + (['-vf', vf] if vf else []) + \
          ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(fps), tmp]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(sh['nf']):
        p.stdin.write(eng.frame(si, f / fps))
    p.stdin.close()
    if p.wait() != 0: raise RuntimeError(f'ffmpeg-Fehler bei Shot {si + 1}')
    os.replace(tmp, path)

def contact_sheet(eng, ep, path, cols=5):
    from PIL import Image
    import io
    n = len(ep['shots']); rows = math.ceil(n / cols); tw, th = 216, 384
    sheet = Image.new('RGB', (cols * tw, rows * (th + 30)), (20, 20, 20))
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for si, sh in enumerate(ep['shots']):
        t = sh['dur'] * 0.6
        if sh['words']: t = min(sh['dur'] - 0.01, sh['words'][len(sh['words']) // 2]['t0'] + 0.12)
        im = Image.open(io.BytesIO(eng.frame(si, t, 0.85))).resize((tw, th))
        x, y = (si % cols) * tw, (si // cols) * (th + 30)
        sheet.paste(im, (x, y + 30)); d.text((x + 6, y + 8), f'{si + 1}  {sh["dur"]:.1f}s  {sh.get("set", "street")}', fill=(255, 255, 255))
    sheet.save(path, quality=88)


# ---------------- Viral-Werkzeuge (Hook, Serie, Kommentar-Frage, Loop, Check) ----------------
def quality_check(path, total):
    """Automatische Qualitätsprüfung: Auflösung, Länge, schwarze und eingefrorene Stellen, Ton vorhanden."""
    import re
    try:
        pr = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-show_entries', 'format=duration', '-of', 'json', str(path)], capture_output=True, text=True).stdout
        info = json.loads(pr); vs = [x for x in info.get('streams', []) if x.get('codec_type') == 'video']; aus = [x for x in info.get('streams', []) if x.get('codec_type') == 'audio']
        probs = []
        if not vs or (vs[0].get('width'), vs[0].get('height')) not in ((W, H), (2 * W, 2 * H)): probs.append(f"Auflösung {vs[0].get('width') if vs else '?'}x{vs[0].get('height') if vs else '?'}")
        if not aus: probs.append('keine Tonspur')
        dur = float(info.get('format', {}).get('duration', 0))
        if abs(dur - total) > 1.0: probs.append(f'Länge {dur:.1f}s statt {total:.1f}s')
        lg = subprocess.run(['ffmpeg', '-v', 'info', '-i', str(path), '-vf', 'blackdetect=d=0.4:pix_th=0.06,freezedetect=n=0.002:d=1.6', '-an', '-f', 'null', '-'], capture_output=True, text=True).stderr
        for m in re.finditer(r'black_start:([\d.]+) black_end:([\d.]+)', lg): probs.append(f'schwarzes Bild {float(m.group(1)):.1f}–{float(m.group(2)):.1f}s')
        for m in re.finditer(r'freeze_start: ([\d.]+)', lg):
            t = float(m.group(1))
            if t < total - 2.5: probs.append(f'Standbild ab {t:.1f}s')
        print('Qualitätsprüfung: ' + ('✓ ok' if not probs else '⚠ ' + ' · '.join(probs)), flush=True)
        return probs
    except Exception as e:
        print(f'Qualitätsprüfung übersprungen ({e})', flush=True); return []


def apply_viral(src):
    """Episode-Feld "viral": {"hook": "...", "series": "Weird Town #3", "cta": "YES or NO? 👇", "loop": true}.
    hook  = großer Text ab Frame 1 im ersten Shot (die ersten 2 Sekunden entscheiden)
    series= kleines Serien-Abzeichen oben in jedem Shot (Leute folgen für die nächste Folge)
    cta   = große Kommentar-Frage im letzten Shot
    loop  = letzte 0,4 s blenden in das erste Bild über (Video läuft nahtlos weiter -> Wiederholungen)"""
    far = src.get('camFar', 1.4 if src.get('viral') else None)  # Viral-Folgen: standardmäßig weiter raus (Umgebung + Person sichtbar)
    if far:
        for sh in src.get('shots', []): sh.setdefault('camFar', far)
    v = src.get('viral') or {}
    shots = src.get('shots') or []
    if not shots or not v: return v
    if v.get('hook'): next((s for s in shots if not s.get('intro')), shots[0])['hook'] = v['hook']   # Hook nie auf das Mii-Town-Intro
    if v.get('series'):
        for sh in shots: sh['badge'] = v['series']
    if v.get('cta'):
        last = shots[-1]; last.setdefault('pops', [])
        if not any(p.get('_cta') for p in last['pops']):
            last['pops'] = last['pops'] + [{'text': v['cta'], 'x': 0.5, 'y': 0.3, 't': 0.25, 'dur': 30, 'rise': 0, 'size': 96, 'color': '#ffe14d', '_cta': 1}]
    # TikTok-Wachstum (Kommentare/Shares sind nach Wiedergabezeit die stärksten Signale):
    # mid   = Kommentar-Aufforderung mitten im Video (z. B. "Guess the twist in the comments 👇") – auf dem Shot bei ~40 %
    # share = Teilen-Aufforderung im letzten Shot (z. B. "Send this to a friend who'd press it 📲")
    if v.get('mid') and len(shots) > 4:
        sh = shots[max(1, int(len(shots) * float(v.get('midAt', 0.4))))]; sh.setdefault('pops', [])
        if not any(p.get('_mid') for p in sh['pops']):
            sh['pops'] = sh['pops'] + [{'text': v['mid'], 'x': 0.5, 'y': 0.2, 't': 0.05, 'dur': 2.6, 'rise': 0, 'size': 58, 'color': '#ffffff', '_mid': 1}]
    if v.get('share'):
        last = shots[-1]; last.setdefault('pops', [])
        if not any(p.get('_share') for p in last['pops']):
            last['pops'] = last['pops'] + [{'text': v['share'], 'x': 0.5, 'y': 0.4, 't': 0.35, 'dur': 30, 'rise': 0, 'size': 54, 'color': '#ffffff', '_share': 1}]
    return v

def viral_check(src, ep, total):
    """Kurzer Check der Viral-Regeln (nur Hinweise, bricht nie ab)."""
    tips, shots = [], ep['shots']
    v = src.get('viral') or {}
    if not v.get('hook'): tips.append('kein "viral.hook" (großer Text in den ersten 2 s)')
    h0 = next((s for s in shots if not s.get('intro')), shots[0]) if shots else None
    if h0 and h0.get('pause'): tips.append('erster Shot hat eine Pause – sofort mit dem Hook starten')
    if h0 and h0.get('dur', 0) > 2.2: tips.append(f'erster Shot {h0["dur"]:.1f}s – Hook-Shot ≤ 2 s halten')
    long_ = [i + 1 for i, sh in enumerate(shots) if sh.get('dur', 0) > 3.0]
    if long_: tips.append(f'lange Shots (> 3 s, besser teilen): {long_[:8]}')
    lastsay = ' '.join(sh.get('say', '') for sh in shots[-2:])
    if '?' not in lastsay and not v.get('cta'): tips.append('Schluss ohne Frage/CTA – Kommentare anregen')
    tags = (src.get('meta') or {}).get('hashtags') or []
    if tags and not 3 <= len(tags) <= 6: tips.append(f'{len(tags)} Hashtags – besser 3–6 passende')
    if not v.get('loop'): tips.append('"viral.loop" aus – Ende nicht nahtlos mit Anfang verbunden')
    # TikTok-Suche: Suchbegriff muss in den ersten 3 s gesprochen UND als Text zu sehen sein
    meta = src.get('meta') or {}
    kws = [k.lower() for k in (meta.get('keywords') or [])]
    if not kws: tips.append('keine "meta.keywords" (Suchbegriffe, so wie Leute auf TikTok suchen)')
    else:
        import re as _re
        words = lambda s: set(w for w in _re.findall(r"[a-z0-9']+", str(s).lower()) if len(w) > 3)
        first = words(' '.join(sh.get('say', '') for sh in shots[:2])) | words(v.get('hook', ''))
        if not any(words(k) & first for k in kws): tips.append(f'Suchbegriff ({kws[0]}) kommt in den ersten 2 Shots/Hook nicht vor')
    if not v.get('mid'): tips.append('kein "viral.mid" (Kommentar-Aufforderung mitten im Video)')
    if not v.get('share'): tips.append('kein "viral.share" (Teilen-Aufforderung am Ende)')
    # Re-Hooks: im Mittelteil braucht es Wendungen ("But…", "Then…", Fragen), sonst springen Zuschauer ab
    n = len(shots); mid_txt = ' '.join(sh.get('say', '') for sh in shots[n // 4: n * 3 // 4]).lower()
    if n > 8 and not any(w in mid_txt for w in ('but ', 'then ', 'suddenly', 'wait', '?', 'until ', 'except')): tips.append('Mittelteil ohne Re-Hook („But…“, „Then…“, Frage)')
    print('✓ Viral-Check: alles drin' if not tips else '⚠ Viral-Check: ' + ' · '.join(tips), flush=True)

def loop_end(vid, out_vid, total, fade=0.4):
    """Letzte `fade` Sekunden ins erste Bild überblenden (Loop)."""
    first = str(vid) + '.first.png'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(vid), '-frames:v', '1', first], check=True)
    st = max(0.0, total - fade)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(vid), '-loop', '1', '-t', f'{total:.3f}', '-i', first, '-filter_complex',
                    f'[1:v]format=rgba,fade=in:st={st:.3f}:d={fade}:alpha=1[f];[0:v][f]overlay=shortest=1,format=yuv420p[v]',
                    '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', str(30), str(out_vid)], check=True)

# ---------------- Mii Town: Kategorie + Intro (Lukas 26.11.) ----------------
# Jede Folge beginnt mit einem 1–2-s-Intro aus IHREN eigenen Figuren und Orten (nie derselbe Clip),
# Kategorie-Satz, „MII TOWN“-Logo in der Kategorie-Farbe und eigenem Sound-Motiv.
# Steuerung: "category": "battle" (überschreibt die Erkennung), "intro": false (kein Intro).
MII_CAT = {
    'standard':  ('Welcome to Mii Town…', '#ffd23f'),
    'battle':    ('Mii Town battle! Who will win?', '#ff4d4d'),
    'horror':    ("It's haunting Mii Town again…", '#9b5de5'),
    'comedy':    ('Another crazy day in Mii Town…', '#ffb703'),
    'mystery':   ("Something isn't right in Mii Town…", '#4cc9f0'),
    'survival':  ('Can anyone survive Mii Town?', '#fb8500'),
    'challenge': ('One challenge. One winner. Mii Town.', '#06d6a0'),
    'movie':     ('Lights, camera… Mii Town!', '#ff5d8f'),
    'empire':    ('Big dreams in Mii Town…', '#ffd23f'),
}
# Neugier-Sätze fürs Intro (Lukas 28.11.: „an jedem Anfang so ein Satz wie ‚Something isn't right‘, damit die Leute bleiben“).
# Je Kategorie mehrere Varianten (lang mit „Mii Town“, kurz ohne) – Auswahl fest je Titel, damit es nicht immer gleich klingt.
MII_HOOKS = {
    'standard':  [("This town is NOT normal… welcome to Mii Town.", "This town is NOT normal…"), ("You won't believe this rule in Mii Town…", "You won't believe this rule…"), ("Wait until you hear what happens in Mii Town…", "Wait until you hear this…")],
    'mystery':   [("Something isn't right in Mii Town…", "Something isn't right…"), ("Someone in Mii Town is lying…", "Someone is lying…"), ("Nobody in Mii Town saw this coming…", "Nobody saw this coming…")],
    'horror':    [("Don't watch this alone… Mii Town after dark.", "Don't watch this alone…"), ("Something is watching Mii Town…", "Something is watching…"), ("This really happened in Mii Town…", "This really happened…")],
    'comedy':    [("This went horribly wrong in Mii Town…", "This went horribly wrong…"), ("Nobody in Mii Town expected this…", "Nobody expected this…")],
    'survival':  [("Would YOU survive this in Mii Town?", "Would YOU survive this?"), ("Most people get this wrong…", "Most people get this wrong…"), ("One mistake could cost everything…", "One mistake could cost everything…")],
    'empire':    [("Nobody believed in them…", "Nobody believed in them…"), ("It started with almost nothing…", "It started with almost nothing…"), ("They almost lost everything…", "They almost lost everything…")],
    'movie':     [("Only real fans get this one…", "Only real fans get this one…"), ("Bet you can't guess this movie…", "Bet you can't guess this movie…"), ("Can you guess it before the end?", "Can you guess it before the end?")],
    'battle':    [("Mii Town battle! Who will win?", "Battle time! Who will win?")],
    'challenge': [("One challenge. One winner. Mii Town.", "One challenge. One winner.")],
}
MII_SHORT = {   # Intro-Satz ohne „Mii Town“, wenn der erste Satz es schon sagt (Lukas 28.11.)
    'standard': 'Welcome back…', 'battle': 'Battle time! Who will win?', 'horror': "It's happening again…",
    'comedy': 'Another crazy day…', 'mystery': "Something isn't right…", 'survival': 'Can anyone survive this?',
    'challenge': 'One challenge. One winner.', 'movie': 'Lights, camera…', 'empire': 'Big dreams…',
}
MII_MOTIF = {'movie': 'comedy', 'empire': 'standard'}   # neue Kategorien nutzen vorhandene Erkennungs-Sounds
def mii_category(src):
    if src.get('category') in MII_CAT: return src['category']
    ser = ((src.get('viral') or {}).get('series') or '').upper(); mu = src.get('music', ''); title = ((src.get('meta') or {}).get('title') or src.get('title') or '').lower()
    if 'MOVIE' in ser: return 'movie'
    if 'IN MII TOWN' in ser or 'WEIRD' in ser: return 'standard'   # 08:00-Serie: seltsame Stadt-Regel
    if 'MYSTERY' in ser: return 'mystery'
    if 'EMPIRE' in ser: return 'empire'
    if 'challenge' in title: return 'challenge'
    if 'VS' in ser or mu == 'battle' or ' vs ' in title: return 'battle'
    if 'DARK' in ser or mu == 'dark': return 'horror'
    if 'SURVIV' in ser or 'what if you' in title: return 'survival'
    if 'WEIRD' in ser or mu == 'mystery': return 'mystery'
    if mu in ('school', 'trend', 'funny', 'happy') or 'SCHOOL' in ser or 'TREND' in ser: return 'comedy'
    return 'standard'

# ---------------- Liegen im Bett (Lukas 27.11.) ----------------
# Mii-Figuren lagen mit dem alten Wert y 1.55 sichtbar ÜBER der Matratze. Gemessen (Seitenansicht, 27.11.):
# Figur y 1.10 liegt flach auf der Matratze, Decke ("blanket") y 1.60 deckt sie zu. Gilt für das Bett im Set "room"
# und für jedes "bed"-Requisit; wird automatisch gesetzt, egal was im Skript steht.
BED_LIE_Y, BED_BLANKET_Y = 1.10, 1.60
def snap_beds(src):
    n = 0
    for s in src.get('shots') or []:
        beds = [(-6.6, -4.8, 0)] if s.get('set') == 'room' else []
        for p in s.get('props') or []:
            if p.get('type') == 'bed' and p.get('at'): beds.append((p['at'][0], p['at'][-1], p.get('ry', 0) or 0))
        if not beds: continue
        def bed_of(x, z): return next(((bx, bz, ry) for bx, bz, ry in beds if abs(x - bx) <= 1.9 and abs(z - bz) <= 3.3), None)
        for a in s.get('actors') or []:
            b = bed_of(a['at'][0], a['at'][-1]) if a.get('at') and str(a.get('do', '')) in ('lie', 'sleep') and not src.get('_noBedSnap') else None
            if not b: continue
            mk = float(src.get('miiScale', 0.8)); ly = round(BED_LIE_Y + (1 - mk), 2)   # kleinere Miis (0.8) -> 1.30, gemessen 27.11.
            a['y'] = ly; n += 1
            if not b[2]:   # Bett ohne Drehung: Kopfende bei -z -> Füße auf Matratze, Kopf direkt vor dem Kissen, Gesicht nach oben (gemessen 27.11.)
                cf = (src.get('cast') or {}).get(a.get('id')) or {}
                hs, sc = float(cf.get('headScale', 1.3) or 1.3), float(cf.get('scale', 1.0) or 1.0) * (float(src.get('miiScale', 0.8)) if cf.get('style') == 'mii' else 1.0)
                hz = b[1] - 1.5                                    # Kopf liegt direkt vor dem Kissen
                a['at'] = [b[0], round(hz + 0.84 * (3.98 + 0.74 * hs) * sc, 2)]; a['face'] = 0   # Abstand Füße->Kopf je nach Größe (gemessen 27.11.)
                if s.get('bedCam', True) is not False:   # Kamera schräg von oben aufs Gesicht (sonst sieht man nur Haare/Decke)
                    s['cam'] = {'type': 'free', 'eye': [b[0] + 0.9, 7.4, hz + 1.5], 'look': [b[0], 1.8, hz - 0.1]}
                for p in s.get('props') or []:
                    if p.get('type') == 'blanket' and p.get('at') and len(p['at']) == 3 and bed_of(p['at'][0], p['at'][2]):
                        p['at'] = [b[0], round(ly + 0.5, 2), round(hz + hs * sc + 2.3, 2)]; p['_snap'] = True   # Decke bis zum Hals, Gesicht frei
        for p in s.get('props') or []:
            if p.get('type') == 'blanket' and p.get('at') and len(p['at']) == 3 and bed_of(p['at'][0], p['at'][2]) and not p.get('_snap'):
                p['at'] = [p['at'][0], round(BED_BLANKET_Y + (1 - float(src.get('miiScale', 0.8))), 2), p['at'][2]]
    if n: print(f'Bett: {n}× Liegehöhe angepasst (Figur liegt auf der Matratze)', flush=True)

def mii_intro(src):
    if src.get('intro') is False or src.get('_introDone'): return
    if not any(isinstance(v, dict) and v.get('style') == 'mii' for v in (src.get('cast') or {}).values()) and not src.get('intro'): return   # nur Mii-Town-Folgen
    shots = src.get('shots') or []
    if not shots: return
    cat = mii_category(src); line, colr = MII_CAT[cat]
    # Lukas 28.11.: „Something isn't right in Mii Town, in Mii Town …“ klingt kacke -> (1) kein doppeltes „Mii Town“:
    # nennt der erste Satz selbst Mii Town, spricht das Intro die Kurzform; (2) klare Pause nach dem Intro;
    # (3) „In Mii Town,“ am Satzanfang mit hörbarer Pause nach dem Komma.
    s0 = shots[0]; t0 = re.sub(r'[*_]', '', s0.get('say') or '')
    hv = MII_HOOKS.get(cat)
    if hv:
        k = int(hashlib.sha1(str(src.get('title') or (src.get('meta') or {}).get('title') or t0).encode()).hexdigest(), 16) % len(hv)
        line = hv[k][1] if re.search(r'mii town', t0[:60], re.I) else hv[k][0]
    elif re.search(r'mii town', t0[:60], re.I): line = MII_SHORT.get(cat, line)
    s0['pause'] = max(float(s0.get('pause') or 0), 0.6)
    if not s0.get('speak') and re.match(r'\s*in mii town,', t0, re.I):
        s0['speak'] = re.sub(r'^(\s*in mii town),', r'\1…', t0, flags=re.I)
    first = next((s for s in shots if s.get('set')), {}); sset, stime = first.get('set', 'plaza'), first.get('time', 'day')
    humans = [k for k, v in src['cast'].items() if isinstance(v, dict) and not v.get('animal')]
    seen = []
    for s in shots:
        for a in s.get('actors') or []:
            if a.get('id') in src['cast'] and a['id'] not in seen and not str(a['id']).startswith('crowd'): seen.append(a['id'])
    main = seen or humans
    first_at = {}
    for s in shots:   # wo/wie steht die Figur in ihrem ersten echten Shot? (Innenräume: Möbel!)
        for a in s.get('actors') or []:
            if a.get('id') in main and a['id'] not in first_at and s.get('set', sset) == sset: first_at[a['id']] = a
    def A(i, at, do, mood, **k):
        f = first_at.get(i)
        if f and (re.search('sit|lie', str(f.get('do', ''))) or sset in ('classroom', 'room', 'kitchen', 'office')):
            k = {kk: vv for kk, vv in k.items() if kk != 'path'}   # sitzt/liegt oder Innenraum -> Platz und Haltung aus dem ersten Shot
            keep = {kk: f[kk] for kk in ('at', 'y', 'face', 'hold') if kk in f}
            return dict({'id': i, 'do': f.get('do', 'idle') if re.search('sit|lie', str(f.get('do', ''))) else 'idle', 'mood': mood}, **dict(k, **keep))
        return dict({'id': i, 'at': at, 'do': do, 'mood': mood}, **k)
    sh = {'say': line, 'set': sset, 'time': stime, 'intro': True, 'sfx': [['motif_' + MII_MOTIF.get(cat, cat), 0.0]],
          'pops': [{'text': 'MII TOWN', 'x': 0.5, 'y': 0.12, 't': 0.05, 'dur': 3, 'rise': 0, 'size': 130, 'color': colr}]}
    if cat == 'battle' and len(main) >= 2:
        sh.update(cam='group', actors=[A(main[0], [-1.8, 1], 'idle', 'angry', face=45), A(main[1], [1.8, 1], 'idle', 'angry', face=-45)], fx=[{'type': 'flash', 't': 0.05}])
    elif cat == 'horror':
        sh.update(time='night', cam='aerial', fx=[{'type': 'dark', 't': 0.0}], grade={'bloom': 0.2, 'vignette': 0.6, 'sat': 0.85, 'contrast': 1.1, 'warm': -0.08})
        if main: sh['actors'] = [A(main[0], [0, 1], 'look', 'scared', face=0)]
    elif cat in ('comedy', 'movie', 'empire') and main:
        sh.update(cam='medium:' + main[0], actors=[A(main[0], [0, 1], 'jump', 'laugh', face=0)], fx=[{'type': 'confetti', 't': 0.1}])
    elif cat == 'mystery':
        sh.update(time='dusk' if stime in ('day', 'morning') else stime, cam='reveal' if main else 'aerial')
        if main: sh['actors'] = [A(main[0], [0, 1], 'look', 'confused', face=15)]
    elif cat == 'survival':
        sh.update(cam='track:' + main[0] if main else 'wide', fx=[{'type': 'shake', 't': 0.1}])
        if main: sh['actors'] = [A(main[0], [-3, 1], 'run', 'panic', path=[[-3, 1], [3, 1]])]
    elif cat == 'challenge' and main:
        sh.update(cam='group', actors=[A(m, [(i - (min(4, len(main)) - 1) / 2) * 2.2, 1], 'cheer', 'excited', face=0) for i, m in enumerate(main[:4])])
    else:
        sh.update(cam='aerial', life=True)
    # Kamera fürs Intro (Lukas 27.11.: „am Anfang sind die komisch“): Hauptfigur IMMER ganz im Bild –
    # langsame Fahrt auf die Figur zu statt seitlicher Schwenks/Luftbild; Innenräume kurze Distanz (keine Wände im Bild).
    acts = sh.get('actors') or []
    if acts and cat != 'battle' and cat != 'challenge':
        tgt = acts[0]['id']
        if cat == 'survival' and sset not in ('classroom', 'room', 'kitchen', 'office', 'hallway', 'elevator'): sh['cam'] = 'track:' + tgt
        elif sset in ('classroom', 'room', 'kitchen', 'office', 'hallway', 'elevator'): sh['cam'] = {'type': 'push', 'target': tgt, 'from': 9.5, 'to': 7.4}
        else: sh['cam'] = {'type': 'push', 'target': tgt, 'from': 12.5, 'to': 8.5}
    src['shots'] = [sh] + shots; src['_introDone'] = True; src['_category'] = cat
    print(f"Mii-Town-Intro: Kategorie {cat} – „{line}“", flush=True)

# ---------------- Menschenmengen (Lukas 22.11., wie in den Referenzvideos) ----------------
# Shot-Feld "crowd": {"n": 24, "area": [x0, z0, x1, z1], "teams": ["#1e88e5", "#fb8c00"], "do": "cheer", "face": 0, "mood": "excited"}
# erzeugt automatisch viele Statisten (eigene Cast-IDs crowd1…), Teams nach Seite eingefärbt (links Team 1, rechts Team 2).
# Bleiben über Shots gleich (gleiche n/Seed -> gleiche Leute). "seed" ändert die Mischung.
CROWD_LOOKS = ['boy', 'girl', 'man', 'woman', 'kid', 'student', 'worker', 'gamer']
CROWD_HAIR = ['short', 'spiky', 'side', 'messy', 'long', 'bob', 'ponytail', 'pigtails', 'bun', 'afro', 'curly', 'buzz', 'cap', 'beanie']
CROWD_HC = ['#1b1b1b', '#3b2a1a', '#6d4c41', '#c68642', '#e2c17c', '#b23a48', '#d9d9d9']
CROWD_SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0522d']
CROWD_SHIRT = ['#e63946', '#2a9d8f', '#e9c46a', '#f4a261', '#457b9d', '#8338ec', '#ff006e', '#3a86ff', '#06d6a0', '#ffbe0b']
MOVE_ACTS = {'walk', 'run', 'sneak', 'hop', 'dance', 'spin', 'strut', 'jazzhands', 'salute', 'twist', 'mocap', 'swim', 'fly', 'skate', 'ride', 'drive', 'chase', 'flee'}
def mii_check(src):
    """Mii-Town-Prüfung vor dem Rendern: Figuren-Identität gegen die Datenbank, Fußrutschen (Bewegung ohne Lauf-Aktion), Intro."""
    out = []
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent / 'tools')); import figuren as _fig
        db = _fig.load()
        for k, v in (src.get('cast') or {}).items():
            if isinstance(v, dict) and v.get('style') == 'mii' and k in db:
                diff = [f for f in ('skin', 'face', 'nose', 'ears', 'facekit', 'eyeColor', 'headScale', 'hairColor') if f in db[k] and v.get(f) != db[k][f]]
                if diff: out.append(f'Figur {k}: weicht von der Datenbank ab ({", ".join(diff)}) – Identität muss gleich bleiben')
    except Exception as e: out.append(f'Figuren-Datenbank nicht prüfbar ({e})')
    for i, sh in enumerate(src.get('shots') or [], 1):
        for a in sh.get('actors') or []:
            moves = a.get('to') or a.get('path')
            acts = [a.get('do')] if isinstance(a.get('do'), str) else [x[0] if isinstance(x, list) else x for x in (a.get('do') or [])]
            if moves and not any(str(x) in MOVE_ACTS for x in acts) and not (src.get('cast', {}).get(a.get('id'), {}) or {}).get('animal') and not a.get('npcCrowd'):
                out.append(f'Shot {i}: {a.get("id")} bewegt sich mit do={a.get("do")} – Füße würden rutschen (walk/run setzen)')
    # Bild passt zum Text (Lukas 26.11.: Handlung logisch): genanntes Tier/Ding muss im Shot zu sehen sein
    ANIM = {'dog', 'cat', 'fox', 'lion', 'tiger', 'pig', 'bear', 'sheep', 'cow', 'penguin', 'frog', 'chicken', 'croc', 'shark'}
    THING = {'cake', 'pizza', 'burger', 'carrot', 'apple', 'banana', 'egg', 'phone', 'book', 'ball', 'gift', 'trophy', 'umbrella', 'icecream', 'coin', 'flashlight', 'controller', 'crown'}
    castA = {k: (v or {}).get('animal') for k, v in (src.get('cast') or {}).items() if isinstance(v, dict)}
    for i, sh in enumerate(src.get('shots') or [], 1):
        if sh.get('intro'): continue
        words = set(re.findall(r'[a-z]+', (sh.get('say') or '').lower())); words |= {w[:-1] for w in words if w.endswith('s')}
        seen = {castA.get(a.get('id')) for a in sh.get('actors') or []} | {a.get('animal') for a in sh.get('actors') or []}
        for a in sh.get('actors') or []:
            for k in ('hold', 'throw'):
                h = a.get(k); seen.add(h if isinstance(h, str) else (h or {}).get('type') or (h or {}).get('item'))
        seen |= {p.get('type') for p in sh.get('props') or []}
        for w in sorted((words & ANIM) | (words & THING)):
            if w not in seen and not sh.get('noCheck'): out.append(f'Shot {i}: Text nennt „{w}“, im Bild fehlt es')
    # HANDLUNG = BILD (Lukas 28.11.: „wenn gesagt wird I run downstairs, dann zeigt das Video genau das – immer das zeigen, was gesagt wird“)
    # Jedes Verb/Orts-Wort im Text braucht die passende Aktion, Bewegung oder das Requisit im SELBEN Shot.
    def _acts(a):
        d = a.get('do'); return {d} if isinstance(d, str) else {x[0] if isinstance(x, list) else x for x in (d or [])}
    def _holds(a):
        r = set()
        for k in ('hold', 'throw'):
            h = a.get(k); r.add(h if isinstance(h, str) else (h or {}).get('type') or (h or {}).get('item'))
        return r
    FOOD = {'pizza', 'burger', 'cake', 'apple', 'banana', 'carrot', 'icecream', 'egg', 'cookie', 'donut', 'sandwich'}
    RULES = [  # (Wörter im Text, Prüfung, was fehlt)
        ({'run', 'runs', 'ran', 'running', 'rush', 'rushes', 'rushed', 'sprint', 'sprints', 'chase', 'chases', 'chased'}, lambda A, P: any(('run' in _acts(a)) and (a.get('path') or a.get('to')) for a in A), 'Figur rennt wirklich (do run + path)'),
        ({'walk', 'walks', 'walked', 'walking', 'sneak', 'sneaks', 'sneaked', 'tiptoe', 'tiptoes'}, lambda A, P: any(a.get('path') or a.get('to') for a in A), 'Figur geht wirklich (path/to)'),
        ({'downstairs', 'upstairs', 'stairs', 'staircase', 'steps'}, lambda A, P: 'stairs' in P, 'Treppe (prop stairs, Weg mit Höhe [x,y,z])'),
        ({'door', 'doorbell', 'knock', 'knocks', 'knocked'}, lambda A, P: 'door' in P or 'house' in P or any('phone' in _holds(a) for a in A), 'Tür im Bild (prop door / Set house) – bei Türkamera Handy'),
        ({'sit', 'sits', 'sat', 'seated'}, lambda A, P: any(_acts(a) & {'sit', 'sitdesk', 'sitgame'} for a in A), 'Figur sitzt (sit/sitdesk) auf echtem Sitz'),
        ({'asleep', 'sleep', 'sleeps', 'sleeping', 'bed'}, lambda A, P: any(_acts(a) & {'lie', 'sleep', 'yawn'} for a in A) or 'bed' in P or 'room' in P, 'Figur liegt/schläft (lie) bzw. Bett im Bild'),
        ({'jump', 'jumps', 'jumped', 'jumping'}, lambda A, P: any(_acts(a) & {'jump', 'hop'} for a in A), 'Sprung (jump)'),
        ({'dance', 'dances', 'danced', 'dancing'}, lambda A, P: any(_acts(a) & {'dance', 'shred', 'twist', 'jazzhands'} for a in A), 'Tanz (dance)'),
        ({'wave', 'waves', 'waved', 'waving'}, lambda A, P: any(_acts(a) & {'wave', 'wavearms'} for a in A), 'Winken (wave)'),
        ({'cry', 'cries', 'cried', 'crying', 'tears'}, lambda A, P: any('cry' in _acts(a) or a.get('mood') == 'cry' for a in A), 'Weinen (do/mood cry)'),
        ({'laugh', 'laughs', 'laughed', 'laughing'}, lambda A, P: any('laugh' in _acts(a) or a.get('mood') == 'laugh' for a in A), 'Lachen (laugh)'),
        ({'fall', 'falls', 'fell', 'trip', 'trips', 'tripped', 'slip', 'slips', 'slipped'}, lambda A, P: any(_acts(a) & {'fall', 'faint'} for a in A), 'Hinfallen (fall)'),
        ({'throw', 'throws', 'threw', 'throwing'}, lambda A, P: any('throw' in _acts(a) or a.get('throw') for a in A), 'Werfen (throw)'),
        ({'clap', 'claps', 'clapped'}, lambda A, P: any('clap' in _acts(a) for a in A), 'Klatschen (clap)'),
        ({'eat', 'eats', 'ate', 'eating', 'bite', 'bites'}, lambda A, P: any(_holds(a) & FOOD for a in A), 'Essen in der Hand (hold Essen)'),
        ({'call', 'calls', 'called', 'phone', 'texts', 'texted', 'buzzed', 'buzzes', 'voicemail'}, lambda A, P: any('phone' in _holds(a) for a in A) or 'phone' in P, 'Handy in der Hand (hold phone)'),
        ({'scream', 'screams', 'screamed', 'yell', 'yells', 'yelled'}, lambda A, P: any(a.get('mood') in ('panic', 'scared', 'shock', 'angry', 'fear') for a in A), 'Schrei-Gesicht (mood panic/shock)'),
        ({'point', 'points', 'pointed'}, lambda A, P: any(_acts(a) & {'point', 'pointup'} for a in A), 'Zeigen (point)'),
    ]
    for i, sh in enumerate(src.get('shots') or [], 1):
        if sh.get('intro') or sh.get('noCheck') or sh.get('noActCheck'): continue
        said = re.sub(r'["“”][^"“”]*["“”]', ' ', sh.get('say') or '')   # wörtliche Rede („I was asleep!“) ist Behauptung, keine Handlung
        said = re.sub(r'(?i)next[ -]door', ' ', said)   # „next door“ = nebenan, keine Tür
        words = set(re.findall(r"[a-z]+", said.lower().replace("'", '')))
        A = sh.get('actors') or []
        P = {p.get('type') for p in sh.get('props') or []} | {sh.get('set')}
        for ws, ok, need in RULES:
            hit = sorted(words & ws)
            if hit and not ok(A, P): out.append(f'Shot {i}: BILD≠TEXT – sagt „{hit[0]}“, fehlt: {need}')
    mii = any(isinstance(v, dict) and v.get('style') == 'mii' for v in (src.get('cast') or {}).values())
    if mii and src.get('intro') is not False and not any(s.get('intro') for s in src.get('shots') or []): out.append('Mii-Town-Folge ohne Intro')
    src['_miiCheck'] = out
    print('Mii-Town-Prüfung: ' + ('✓ ok' if not out else '⚠ ' + ' · '.join(out)), flush=True)
    bt = [x for x in out if 'BILD≠TEXT' in x]
    if bt: print(f'❌❌ BILD≠TEXT in {len(bt)} Shot(s) – vor dem Einreihen beheben (Lukas 28.11.)', flush=True)
    return out

THUMB_MOODS = ('shock', 'panic', 'scared', 'surprised', 'angry', 'excited', 'cry', 'fear', 'laugh', 'evil', 'love')
def pick_thumb(src, ep):
    """(Shot-Index, Zeit im Shot, Zeit im Video) des stärksten Gesichts in der ersten Hälfte."""
    shots, comp = src.get('shots') or [], ep.get('shots') or []
    total = sum(s.get('dur', 0) for s in comp) or 1
    best, bs = (0, 0.5, 1.0), -1e9
    for i, (s, c) in enumerate(zip(shots, comp)):
        if s.get('intro'): continue
        t0 = c.get('tg0', 0)
        if t0 > total * 0.6: break
        cam = s.get('cam') if isinstance(s.get('cam'), str) else ''
        moods = [str(a.get('mood')) for a in s.get('actors') or []]
        sc = (3 if cam.startswith('face:') else 2 if cam.startswith('close:') else 0) + (3 if any(m in THUMB_MOODS for m in moods) else 0) + (1 if s.get('hook') else 0) - t0 / total
        if sc > bs: bs, best = sc, (i, c.get('dur', 1) * 0.55, t0 + c.get('dur', 1) * 0.55)
    return best

def make_thumbnail(out, src, ep, clean=None):
    """Vorschaubild (Lukas 26.11.): stärkstes Gesicht aus der ersten Hälfte (face:/close:-Kamera, starke Mimik), groß der Hook-Text.
    Schreibt <video>_thumb.jpg (1080x1920, < 2 MB) und <video>_thumb.json {"ms": Zeitpunkt} für Instagram/TikTok-Cover."""
    try:
        from PIL import Image, ImageDraw, ImageFont, ImageFilter
        si, tl, tt = pick_thumb(src, ep)
        jpg = Path(str(out)).with_name(Path(str(out)).stem + '_thumb.jpg'); raw = jpg.with_suffix('.raw.png')
        if clean and Path(clean).exists(): subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(clean), '-vf', 'scale=1080:1920', str(raw)], check=True)   # sauberes Bild ohne Untertitel
        else: subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{tt:.2f}', '-i', str(out), '-frames:v', '1', '-vf', 'scale=1080:1920', str(raw)], check=True)
        im = Image.open(raw).convert('RGB'); W, H = im.size
        hook = ((src.get('viral') or {}).get('hook') or (src.get('meta') or {}).get('title') or '').upper()
        hook = ''.join(ch for ch in hook if ord(ch) < 0x2000 or ch in '…–—').replace('…', '...').strip()
        lines = [l.strip() for l in hook.split('\n') if l.strip()] or [hook]
        font_p = Path(__file__).resolve().parent / 'fonts' / 'Poppins-Bold.ttf'
        sz = 150
        while sz > 70:
            F = ImageFont.truetype(str(font_p), sz)
            if all(F.getlength(l) <= W * 0.9 for l in lines): break
            sz -= 8
        shade = Image.new('L', (W, H), 0); ImageDraw.Draw(shade).rectangle([0, 0, W, int(H * 0.42)], fill=150)
        shade = shade.filter(ImageFilter.GaussianBlur(120)); im = Image.composite(Image.new('RGB', (W, H), (0, 0, 0)), im, shade.point(lambda v: v * 0.55))
        d = ImageDraw.Draw(im); y = int(H * 0.11)
        cols = ['#ffe14d', '#ffffff']
        for k, l in enumerate(lines[:3]):
            w = F.getlength(l); d.text(((W - w) / 2, y), l, font=F, fill=cols[k % 2], stroke_width=max(8, sz // 11), stroke_fill='#111111'); y += int(sz * 1.12)
        im.save(jpg, 'JPEG', quality=88, optimize=True); raw.unlink(missing_ok=True)
        jpg.with_suffix('.json').write_text(json.dumps({'ms': int(tt * 1000)}))
        print(f'Vorschaubild: {jpg} (Bild bei {tt:.1f}s)', flush=True)
        return jpg
    except Exception as e:
        print('Vorschaubild übersprungen:', e, flush=True); return None

def write_report(out, src, probs, total):
    """Qualitätsbericht neben dem Video (<name>_bericht.md)."""
    try:
        sh = src.get('shots') or []; intro = next((s for s in sh if s.get('intro')), None)
        L = [f'# Qualitätsbericht – {(src.get("meta") or {}).get("title") or src.get("title") or Path(out).stem}', '',
             f'- Länge: {total:.1f} s · Shots: {len(sh)} · Kategorie: {src.get("_category", "–")}',
             f'- Intro: {("„" + intro["say"] + "“, " + str(round(intro.get("dur", 0), 1)) + " s") if intro else "keins"}',
             f'- Figuren: {", ".join(k for k in (src.get("cast") or {}))}',
             f'- Mii-Town-Prüfung: {"✓ ok" if not src.get("_miiCheck") else "; ".join(src["_miiCheck"])}',
             f'- Video-Prüfung (Auflösung, Ton, Länge, schwarz/Standbild): {"✓ ok" if not probs else "; ".join(probs)}']
        p = Path(str(out)).with_name(Path(str(out)).stem + '_bericht.md'); p.write_text('\n'.join(L) + '\n', encoding='utf-8')
        print('Qualitätsbericht:', p, flush=True)
    except Exception as e: print('Qualitätsbericht nicht geschrieben:', e, flush=True)

def expand_crowd(src):
    import random
    cast = src.setdefault('cast', {})
    for sh in src.get('shots', []):
        c = sh.get('crowd')
        if not c: continue
        c = c if isinstance(c, dict) else {'n': int(c)}
        n = max(1, min(80, int(c.get('n', 20))))
        x0, z0, x1, z1 = c.get('area', [-7, -4, 7, 4])
        teams = c.get('teams') or []
        R = random.Random(int(c.get('seed', 7)))
        cols = max(1, int(round(math.sqrt(n * abs(x1 - x0) / max(0.5, abs(z1 - z0))))))
        rows = int(math.ceil(n / cols))
        acts = sh.setdefault('actors', [])
        for k in range(n):
            i, j = k % cols, k // cols
            x = x0 + (i + 0.5) * (x1 - x0) / cols + R.uniform(-0.35, 0.35)
            z = z0 + (j + 0.5) * (z1 - z0) / rows + R.uniform(-0.35, 0.35)
            cid = f"crowd{int(c.get('seed', 7))}_{k + 1}"
            if cid not in cast and src.get('miiTown'):   # Mii Town: Menge aus Mii-Figuren
                sys.path.insert(0, str(Path(__file__).resolve().parent / 'tools')); import figuren as _fg
                look = {kk: vv for kk, vv in _fg.generate(cid, age=R.choice(['kid', 'teen', 'adult', 'adult', 'senior'])).items() if kk not in ('name', 'sex', 'age', 'role', 'created')}
                if teams: look['shirt'] = teams[0] if (len(teams) == 1 or x < (x0 + x1) / 2) else teams[1]
                cast[cid] = look
            if cid not in cast:
                look = {'look': R.choice(CROWD_LOOKS), 'hair': R.choice(CROWD_HAIR), 'hairColor': R.choice(CROWD_HC),
                        'skin': R.choice(CROWD_SKIN), 'shirt': R.choice(CROWD_SHIRT), 'logo': 'none'}
                if teams: look['shirt'] = teams[0] if (len(teams) == 1 or x < (x0 + x1) / 2) else teams[1]
                cast[cid] = look
            a = {'id': cid, 'at': [round(x, 2), round(z, 2)], 'do': c.get('do') or R.choice(['cheer', 'idle', 'wave', 'look', 'clap']),
                 'mood': c.get('mood') or R.choice(['happy', 'excited', 'smile', 'laugh']), 'face': c.get('face', 0), 'extra': True}
            acts.append(a)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('episode'); ap.add_argument('-o', '--out', default=None)
    ap.add_argument('--voice'); ap.add_argument('--stills', action='store_true'); ap.add_argument('--frames', default=None, help='z.B. "3:0.5,7:0.2" (Shot:Anteil) als Einzelbilder')
    ap.add_argument('--part', default=None, help='verteiltes Rendern: K/N = nur Teil K (0-basiert) von N rendern, ohne Zusammenbau');
    ap.add_argument('--only', default=None); ap.add_argument('--rs', type=float, default=None); ap.add_argument('--quality', default=None, help='hq (Standard: 4K-Look) oder classic')
    ap.add_argument('--no-music', action='store_true'); ap.add_argument('--work', default=None)
    ap.add_argument('--no-tts', action='store_true', help='keine Computerstimme')
    ap.add_argument('--tts-voice', default=None, help='z.B. thorsten, kerstin, thorsten-emo:whisper')
    ap.add_argument('--tts-speed', type=float, default=None, help='Sprechtempo (Standard 1.05)')
    ap.add_argument('--stimme', action='store_true', help='nur Sprachspur als WAV schreiben (+ Längen-Check)')
    ap.add_argument('--force', action='store_true', help='auch rendern, wenn die Länge nicht passt')
    a = ap.parse_args()
    src = json.load(open(a.episode, encoding='utf-8'))
    try:   # Mii Town: Figuren aus der zentralen Datenbank (feste Identität über alle Videos)
        sys.path.insert(0, str(Path(__file__).resolve().parent / 'tools')); import figuren as _fig
        src['cast'], _miss = _fig.resolve_cast(src.get('cast'))
        if _miss: print('Neue Figuren automatisch erzeugt (noch nicht in episodes/figuren.json – zum Festschreiben: python tools/figuren.py auto <episode>): ' + ', '.join(_miss), flush=True)
    except Exception as _e: print('Figuren-Datenbank nicht geladen:', _e, flush=True)
    src['miiTown'] = any(isinstance(v, dict) and v.get('style') == 'mii' for v in (src.get('cast') or {}).values()) or bool(src.get('miiTown'))   # Statisten im Mii-Stil
    mii_intro(src)
    if src['miiTown']: snap_beds(src)
    expand_crowd(src)
    mii_check(src)
    regie_on = src.get('regie', True) is not False
    r_inhalt = None
    if regie_on:  # Regie-Kontrolle 1: Logik der Geschichte (Tier-Regel, Mimik zum Text, Tageszeit, Hook) – korrigiert src
        import regie; r_inhalt = regie.inhalt(src, engine_meta())
    viral = apply_viral(src)
    use_tts = not a.voice and not a.no_tts and src.get('tts', True) is not False
    tts = {'voice': a.tts_voice, 'speed': a.tts_speed} if use_tts else None
    ep, events, voice, total, fps = compile_episode(src, a.voice, tts=tts)
    L = length_rule(src)
    if L:
        short = L['goal'] - total
        if 0 < short <= L['hold']:  # knapp zu kurz: Schluss-Einstellung (Frage an Zuschauer) länger halten
            src['tail'] = float(src.get('tail', 1.0)) + short + 0.4
            ep, events, voice, total, fps = compile_episode(src, a.voice, tts=tts)
            print(f'Länge: Schluss-Shot um {short + 0.4:.1f}s verlängert')
        ok, msg = length_report(ep, total, L); print(msg, flush=True)
        if not ok and (a.stills or a.frames):
            print('❌❌ ACHTUNG: Der echte Render (GitHub Actions) bricht wegen der Länge ab – Skript vor dem Einreihen verlängern/kürzen!', flush=True)
        if not ok and not (a.force or a.stimme or a.stills or a.frames):
            sys.exit('Abbruch: Länge passt nicht (Skript anpassen oder --force).')
    viral_check(src, ep, total)
    add_lipsync(ep, voice, fps)  # Lippensynchronität: Mund folgt der echten Stimme
    out = Path(a.out or Path(a.episode).with_suffix('.mp4'))
    if a.stimme:
        if voice is None: sys.exit('Keine Stimme erzeugt.')
        p = out.with_name(out.stem + '_stimme.wav'); AU.write_wav(str(p), voice); print('Stimme:', p); return
    work = Path(a.work or out.with_suffix('')) .with_name(out.stem + '_shots'); work.mkdir(parents=True, exist_ok=True)
    print(f'{len(ep["shots"])} Shots, {total:.1f}s, {sum(s["nf"] for s in ep["shots"])} Frames')
    qual = a.quality or src.get('quality') or os.environ.get('VF_QUALITY') or 'hq'
    hq = qual != 'classic'
    rs = a.rs if a.rs is not None else (float(os.environ.get('VF_RS', 1.25)) if hq else 0.75)
    out_k = 1 if (a.stills or a.frames) else int(float(os.environ.get('VF_OUT', src.get('out', 1)) or 1))  # 2 = echtes 4K (2160x3840)
    print(f'Qualität: {"4K-Look (HQ)" if hq else "klassisch"}, Render-Skala {rs}, Ausgabe {W * out_k}x{H * out_k}')
    eng = Engine(ep, rs, hq, out_k); thumb_clean = None
    try:
        if regie_on:  # Regie-Kontrolle 2: Physik/Bild mit der echten Engine (Kollisionen, Wände, Schweben, Bildausschnitt) – korrigiert ep
            import regie; rep = regie.bericht(r_inhalt, regie.physik(eng, ep)); eng.pg.evaluate('ep => R.load(ep)', ep)
            if rep['errors'] and src.get('regie') == 'strict' and not (a.stills or a.frames): sys.exit('Abbruch: Regie-Fehler (siehe oben).')
        if a.stills:
            p = out.with_name(out.stem + '_vorschau.jpg'); contact_sheet(eng, ep, p); print('Vorschau:', p); return
        if a.frames:
            for k, spec in enumerate(a.frames.split(',')):
                si, fr = spec.split(':'); si = int(si) - 1; t = float(fr) * ep['shots'][si]['dur']
                p = out.with_name(f'{out.stem}_shot{si + 1}_{fr}.jpg'); open(p, 'wb').write(eng.frame(si, t)); print(p)
            return
        only = {int(x) - 1 for x in a.only.split(',')} if a.only else None
        mine = None
        if a.part:  # Shots nach Bildanzahl gleichmäßig auf N Teile verteilen (größte zuerst, deterministisch)
            k, n = (int(x) for x in a.part.split('/')); bins = [[0, []] for _ in range(n)]
            for si in sorted(range(len(ep['shots'])), key=lambda i: (-ep['shots'][i]['nf'], i)):
                b = min(bins, key=lambda x: x[0]); b[0] += ep['shots'][si]['nf']; b[1].append(si)
            mine = set(bins[k][1]); print(f'Teil {k + 1}/{n}: Shots {sorted(i + 1 for i in mine)} ({bins[k][0]} Frames)', flush=True)
        sig = json.dumps(ep['shots'], sort_keys=True)
        import hashlib
        ENGINE_SIG = hashlib.sha1(b''.join(f.read_bytes() for f in sorted((Path(__file__).parent / 'engine').glob('*.js')))).hexdigest()[:12]
        t0 = time.time()
        vf = post_filter(src, hq, out_k)
        for si, sh in enumerate(ep['shots']):
            path = work / f'shot_{si + 1:03d}.mp4'
            key = work / f'shot_{si + 1:03d}.json'
            cur = json.dumps({'shot': _keyround({k: v for k, v in sh.items() if k not in ('lip', 'lipFps')}), 'cast': ep['cast'], 'cap': [ep['capY'], ep['capSize']], 'engine': ENGINE_SIG, 'q': [hq, rs, out_k], 'post': post_filter(src, hq, out_k, sh)}, sort_keys=True)  # Engine-Stand im Cache-Schlüssel: nach Engine-Änderungen wird neu gerendert
            if mine is not None and si not in mine: continue
            if path.exists() and key.exists() and key.read_text() == cur and (only is None or si not in only):
                continue
            ts = time.time(); render_shot(eng, ep, si, path, fps, post_filter(src, hq, out_k, sh)); key.write_text(cur)
            print(f'Shot {si + 1}/{len(ep["shots"])}: {sh["nf"]} Frames in {time.time() - ts:.0f}s', flush=True)
        print(f'Rendern fertig in {time.time() - t0:.0f}s')
        if not a.part and src.get('thumbnail', True) is not False:   # sauberes Bild (ohne Untertitel/Text) fürs Vorschaubild
            try:
                si_t, tl_t, _ = pick_thumb(src, ep); eng.pg.evaluate('R.clean = true')
                cl = work / 'thumb_clean.jpg'; cl.write_bytes(eng.frame(si_t, tl_t, 0.95)); eng.pg.evaluate('R.clean = false')
                thumb_clean = cl
                try:
                    vf_t = post_filter(src, hq, out_k, ep['shots'][si_t])
                    if vf_t: subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(cl), '-vf', vf_t, str(work / 'thumb_clean_g.jpg')], check=True); thumb_clean = work / 'thumb_clean_g.jpg'
                except Exception as e: print('Vorschaubild ohne Farb-Look:', e, flush=True)
            except Exception as e: print('Vorschaubild-Rohbild übersprungen:', e, flush=True)
    finally:
        eng.close()
    if a.part:
        print('Teil fertig (Zusammenbau macht der Haupt-Job):', work); return
    lst = work / 'list.txt'
    lst.write_text(''.join(f"file '{(work / f'shot_{i + 1:03d}.mp4').resolve()}'\n" for i in range(len(ep['shots']))))
    vid = work / 'video_only.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(vid)], check=True)
    # Loop: nur der LETZTE Shot wird neu kodiert (erstes Bild blendet ein) – der Rest wird nur aneinandergehängt (kein 4K-Neu-Kodieren)
    if viral.get('loop'):
        n = len(ep['shots']); last = work / f'shot_{n:03d}.mp4'; lastl = work / f'shot_{n:03d}_loop.mp4'
        first = str(work / 'first.png')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(work / 'shot_001.mp4'), '-frames:v', '1', first], check=True)
        dl = ep['shots'][-1]['dur']; st = max(0.0, dl - 0.4)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(last), '-loop', '1', '-t', f'{dl:.3f}', '-i', first, '-filter_complex',
                        f'[1:v]format=rgba,fade=in:st={st:.3f}:d=0.4:alpha=1[f];[0:v][f]overlay=shortest=1,format=yuv420p[v]',
                        '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', str(fps), str(lastl)], check=True)
        lst.write_text(''.join(f"file '{(work / (f'shot_{i + 1:03d}.mp4' if i < n - 1 else lastl.name)).resolve()}'\n" for i in range(n)))
        vid = work / 'video_loop.mp4'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(vid)], check=True)
    mf = src.get('musicFile')
    cuts = [sh['tg0'] for sh in ep['shots'][1:]]
    hits = [t for (nm, t, g) in events if nm in ('boom', 'tada', 'riser')]
    tw = src.get('twistAt')
    if tw is None and len(ep['shots']) > 4:  # Twist = letzter Shot mit "boom" im letzten Drittel, sonst 78 %
        late = [t for t in hits if t > total * 0.6]; tw = late[-1] if late else None
    sd = src.get('seed', (sum(map(ord, json.dumps((src.get('meta') or {}).get('title') or src.get('title') or ''))) % 9973) or 3)  # jedes Video eigene Musik-Variante
    mixbuf = AU.mix(total, events, voice, src.get('music', 'happy'), not a.no_music and not mf and src.get('music', 'happy') != 'none', sd, cuts=cuts, hits=hits, twist=tw)
    if mf and not a.no_music:  # eigene Musikdatei (z. B. Trend-Sound) statt generierter Musik
        mp = Path(mf) if Path(mf).is_absolute() else Path(a.episode).parent / mf
        tr = AU.load_audio(str(mp))[int(float(src.get('musicStart', 0)) * AU.SR):] * float(src.get('musicGain', 0.9))
        n = min(len(tr), len(mixbuf)); mixbuf[:n] += tr[:n, None] if mixbuf.ndim == 2 else tr[:n]
    wav = work / 'mix.wav'; AU.write_wav(str(wav), mixbuf)
    tmp = str(out) + '.part.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(vid), '-i', str(wav), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, out)
    write_report(out, src, quality_check(out, total), total)
    if src.get('thumbnail', True) is not False: make_thumbnail(out, src, ep, locals().get('thumb_clean'))
    print('Fertig:', out)

if __name__ == '__main__':
    main()
