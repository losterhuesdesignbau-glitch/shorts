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

class Engine:
    def __init__(self, ep, rs=0.75):
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        self.b = self.pw.chromium.launch(args=ARGS)
        self.pg = self.b.new_page(viewport={'width': W, 'height': H})
        self.errs = []
        self.pg.on('pageerror', lambda e: self.errs.append(str(e)))
        self.pg.on('console', lambda m: self.errs.append(m.text) if m.type == 'error' else None)
        self.pg.goto(ENGINE)
        self.pg.evaluate(f'R.init({W},{H},{rs})')
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

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('episode'); ap.add_argument('-o', '--out', default=None)
    ap.add_argument('--voice'); ap.add_argument('--stills', action='store_true'); ap.add_argument('--frames', default=None, help='z.B. "3:0.5,7:0.2" (Shot:Anteil) als Einzelbilder')
    ap.add_argument('--only', default=None); ap.add_argument('--rs', type=float, default=0.75)
    ap.add_argument('--no-music', action='store_true'); ap.add_argument('--work', default=None)
    ap.add_argument('--no-tts', action='store_true', help='keine Computerstimme')
    ap.add_argument('--tts-voice', default=None, help='z.B. thorsten, kerstin, thorsten-emo:whisper')
    ap.add_argument('--tts-speed', type=float, default=None, help='Sprechtempo (Standard 1.05)')
    ap.add_argument('--stimme', action='store_true', help='nur Sprachspur als WAV schreiben (+ Längen-Check)')
    ap.add_argument('--force', action='store_true', help='auch rendern, wenn die Länge nicht passt')
    a = ap.parse_args()
    src = json.load(open(a.episode, encoding='utf-8'))
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
    out = Path(a.out or Path(a.episode).with_suffix('.mp4'))
    if a.stimme:
        if voice is None: sys.exit('Keine Stimme erzeugt.')
        p = out.with_name(out.stem + '_stimme.wav'); AU.write_wav(str(p), voice); print('Stimme:', p); return
    work = Path(a.work or out.with_suffix('')) .with_name(out.stem + '_shots'); work.mkdir(parents=True, exist_ok=True)
    print(f'{len(ep["shots"])} Shots, {total:.1f}s, {sum(s["nf"] for s in ep["shots"])} Frames')
    eng = Engine(ep, a.rs)
    try:
        if a.stills:
            p = out.with_name(out.stem + '_vorschau.jpg'); contact_sheet(eng, ep, p); print('Vorschau:', p); return
        if a.frames:
            for k, spec in enumerate(a.frames.split(',')):
                si, fr = spec.split(':'); si = int(si) - 1; t = float(fr) * ep['shots'][si]['dur']
                p = out.with_name(f'{out.stem}_shot{si + 1}_{fr}.jpg'); open(p, 'wb').write(eng.frame(si, t)); print(p)
            return
        only = {int(x) - 1 for x in a.only.split(',')} if a.only else None
        sig = json.dumps(ep['shots'], sort_keys=True)
        t0 = time.time()
        for si, sh in enumerate(ep['shots']):
            path = work / f'shot_{si + 1:03d}.mp4'
            key = work / f'shot_{si + 1:03d}.json'
            cur = json.dumps({'shot': sh, 'cast': ep['cast'], 'cap': [ep['capY'], ep['capSize']]}, sort_keys=True)
            if path.exists() and key.exists() and key.read_text() == cur and (only is None or si not in only):
                continue
            ts = time.time(); render_shot(eng, ep, si, path, fps); key.write_text(cur)
            print(f'Shot {si + 1}/{len(ep["shots"])}: {sh["nf"]} Frames in {time.time() - ts:.0f}s', flush=True)
        print(f'Rendern fertig in {time.time() - t0:.0f}s')
    finally:
        eng.close()
    lst = work / 'list.txt'
    lst.write_text(''.join(f"file '{(work / f'shot_{i + 1:03d}.mp4').resolve()}'\n" for i in range(len(ep['shots']))))
    vid = work / 'video_only.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(vid)], check=True)
    mixbuf = AU.mix(total, events, voice, src.get('music', 'happy'), not a.no_music and src.get('music', 'happy') != 'none', src.get('seed', 3))
    wav = work / 'mix.wav'; AU.write_wav(str(wav), mixbuf)
    tmp = str(out) + '.part.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(vid), '-i', str(wav), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, out)
    print('Fertig:', out)

if __name__ == '__main__':
    main()
