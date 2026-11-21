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
import argparse, base64, json, math, os, shutil, subprocess, sys, time
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
    out = {'cast': ep.get('cast', {}), 'capY': ep.get('capY', 0.64), 'capSize': ep.get('capSize', 104), 'shots': []}
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
    total = sum(s['nf'] for s in out['shots']) / fps
    return out, events, voice, total, fps

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
    def frame(self, si, t, q=0.92):
        d = self.pg.evaluate('([s,t,q]) => R.frame(s,t,q)', [si, t, q])
        if self.errs: raise RuntimeError('Engine-Fehler: ' + ' | '.join(self.errs[:3]))
        return base64.b64decode(d.split(',', 1)[1])
    def close(self):
        self.b.close(); self.pw.stop()

def render_shot(eng, ep, si, path, fps):
    sh = ep['shots'][si]
    tmp = str(path) + '.part.mp4'
    cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-',
           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(fps), tmp]
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
        if not vs or (vs[0].get('width'), vs[0].get('height')) != (W, H): probs.append(f"Auflösung {vs[0].get('width') if vs else '?'}x{vs[0].get('height') if vs else '?'}")
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
    if v.get('hook'): shots[0]['hook'] = v['hook']
    if v.get('series'):
        for sh in shots: sh['badge'] = v['series']
    if v.get('cta'):
        last = shots[-1]; last.setdefault('pops', [])
        if not any(p.get('_cta') for p in last['pops']):
            last['pops'] = last['pops'] + [{'text': v['cta'], 'x': 0.5, 'y': 0.3, 't': 0.25, 'dur': 30, 'rise': 0, 'size': 96, 'color': '#ffe14d', '_cta': 1}]
    return v

def viral_check(src, ep, total):
    """Kurzer Check der Viral-Regeln (nur Hinweise, bricht nie ab)."""
    tips, shots = [], ep['shots']
    v = src.get('viral') or {}
    if not v.get('hook'): tips.append('kein "viral.hook" (großer Text in den ersten 2 s)')
    if shots and shots[0].get('pause'): tips.append('erster Shot hat eine Pause – sofort mit dem Hook starten')
    if shots and shots[0].get('dur', 0) > 2.2: tips.append(f'erster Shot {shots[0]["dur"]:.1f}s – Hook-Shot ≤ 2 s halten')
    long_ = [i + 1 for i, sh in enumerate(shots) if sh.get('dur', 0) > 3.0]
    if long_: tips.append(f'lange Shots (> 3 s, besser teilen): {long_[:8]}')
    lastsay = ' '.join(sh.get('say', '') for sh in shots[-2:])
    if '?' not in lastsay and not v.get('cta'): tips.append('Schluss ohne Frage/CTA – Kommentare anregen')
    tags = (src.get('meta') or {}).get('hashtags') or []
    if tags and not 3 <= len(tags) <= 6: tips.append(f'{len(tags)} Hashtags – besser 3–6 passende')
    if not v.get('loop'): tips.append('"viral.loop" aus – Ende nicht nahtlos mit Anfang verbunden')
    print('✓ Viral-Check: alles drin' if not tips else '⚠ Viral-Check: ' + ' · '.join(tips), flush=True)

def loop_end(vid, out_vid, total, fade=0.4):
    """Letzte `fade` Sekunden ins erste Bild überblenden (Loop)."""
    first = str(vid) + '.first.png'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(vid), '-frames:v', '1', first], check=True)
    st = max(0.0, total - fade)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(vid), '-loop', '1', '-t', f'{total:.3f}', '-i', first, '-filter_complex',
                    f'[1:v]format=rgba,fade=in:st={st:.3f}:d={fade}:alpha=1[f];[0:v][f]overlay=shortest=1,format=yuv420p[v]',
                    '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', str(30), str(out_vid)], check=True)

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
    eng = Engine(ep, rs, hq, out_k)
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
        for si, sh in enumerate(ep['shots']):
            path = work / f'shot_{si + 1:03d}.mp4'
            key = work / f'shot_{si + 1:03d}.json'
            cur = json.dumps({'shot': sh, 'cast': ep['cast'], 'cap': [ep['capY'], ep['capSize']], 'engine': ENGINE_SIG, 'q': [hq, rs, out_k]}, sort_keys=True)  # Engine-Stand im Cache-Schlüssel: nach Engine-Änderungen wird neu gerendert
            if mine is not None and si not in mine: continue
            if path.exists() and key.exists() and key.read_text() == cur and (only is None or si not in only):
                continue
            ts = time.time(); render_shot(eng, ep, si, path, fps); key.write_text(cur)
            print(f'Shot {si + 1}/{len(ep["shots"])}: {sh["nf"]} Frames in {time.time() - ts:.0f}s', flush=True)
        print(f'Rendern fertig in {time.time() - t0:.0f}s')
    finally:
        eng.close()
    if a.part:
        print('Teil fertig (Zusammenbau macht der Haupt-Job):', work); return
    lst = work / 'list.txt'
    lst.write_text(''.join(f"file '{(work / f'shot_{i + 1:03d}.mp4').resolve()}'\n" for i in range(len(ep['shots']))))
    vid = work / 'video_only.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(vid)], check=True)
    if viral.get('loop'):
        lv = work / 'video_loop.mp4'; loop_end(vid, lv, total); vid = lv
    gr = src.get('grade')
    if gr:  # Look-Nachbearbeitung: Glühen (bloom), Vignette, Sättigung/Kontrast, Wärme
        gr = gr if isinstance(gr, dict) else {}
        b, vg = float(gr.get('bloom', 0.35)), float(gr.get('vignette', 0.35)); sat, con = gr.get('sat', 1.08), gr.get('contrast', 1.04); warm = float(gr.get('warm', 0.04))
        fc = (f"[0:v]format=gbrp,split[a][b];[b]curves=all='0/0 0.62/0 1/1',gblur=sigma={26 * out_k}[g];[a][g]blend=all_mode=screen:all_opacity={b:.2f},"
              f"eq=saturation={sat}:contrast={con},colorbalance=rs={warm:.3f}:bs={-warm:.3f}:rm={warm/2:.3f}:bm={-warm/2:.3f},vignette=angle={0.2 + vg:.2f},format=yuv420p[v]")
        gv = work / 'video_grade.mp4'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(vid), '-filter_complex', fc, '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', str(gv)], check=True); vid = gv
    if hq and src.get('post', True) is not False:  # 4K-Look: feines Nachschärfen + leichtes Filmkorn
        pv = work / 'video_post.mp4'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(vid), '-vf', ('unsharp=5:5:0.55:5:5:0.0' if out_k < 2 else 'unsharp=7:7:0.6:7:7:0.0') + ',noise=c0s=5:c0f=t+u,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', str(pv)], check=True); vid = pv
    mbl = src.get('motionBlur')
    if mbl:  # leichte Bewegungsunschärfe wie bei echter Kamera: schnelle Bewegungen fließender, Rest-Zittern verdeckt
        w = 2 if mbl is True else max(1, int(round(3 - float(mbl) * 2)))
        mv = work / 'video_blur.mp4'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(vid), '-vf', f"tmix=frames=2:weights='1 {w}'", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', str(mv)], check=True); vid = mv
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
    quality_check(out, total)
    print('Fertig:', out)

if __name__ == '__main__':
    main()
