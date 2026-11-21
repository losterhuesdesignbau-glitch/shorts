"""Qualitätskontrolle NACH dem Rendern (fertiges MP4).

  python tools/qa.py video.mp4 [--expect 2160x3840] [--json]

Prüft: Auflösung/Bildrate/Länge/Tonspur, Schärfe (Laplace-Varianz), Helligkeit & Kontrast, Schwarzbilder,
eingefrorene Bilder, Bewegung in den ersten 2 s (Hook), Lautheit (LUFS) & Spitzenpegel, Stille.
Exit 0 = ok, 1 = Warnungen, 2 = Fehler (Video kaputt -> nicht hochladen).
"""
import argparse
import json
import re
import subprocess
import sys

import numpy as np


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration',
                          '-of', 'json', str(path)], capture_output=True, text=True, check=True).stdout
    j = json.loads(out); v = next((s for s in j['streams'] if s['codec_type'] == 'video'), {}); a = [s for s in j['streams'] if s['codec_type'] == 'audio']
    num, den = (v.get('r_frame_rate') or '0/1').split('/')
    return {'w': v.get('width'), 'h': v.get('height'), 'fps': float(num) / max(1.0, float(den)), 'dur': float(j['format']['duration']), 'audio': bool(a)}


def frames(path, every=0.5, w=360, h=640):
    """Graustufen-Bilder (alle `every` s) als Array [n, h, w]."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vf', f'fps={1 / every},scale={w}:{h}:flags=area,format=gray', '-f', 'rawvideo', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32) / 255.0


def lap_var(img):
    L = -4 * img[1:-1, 1:-1] + img[:-2, 1:-1] + img[2:, 1:-1] + img[1:-1, :-2] + img[1:-1, 2:]
    return float(L.var())


def loudness(path):
    err = subprocess.run(['ffmpeg', '-v', 'info', '-nostats', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', err); P = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', err)
    return (float(I[-1]) if I else None), (float(P[-1]) if P else None)


def silences(path, min_d=1.5):
    err = subprocess.run(['ffmpeg', '-v', 'info', '-nostats', '-i', str(path), '-af', f'silencedetect=n=-42dB:d={min_d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return [float(x) for x in re.findall(r'silence_duration: ([\d.]+)', err)]


def run(path, expect=None, min_dur=40.0, log=print):
    errs, warns, info = [], [], {}
    p = probe(path); info.update(p)
    if expect:
        ew, eh = (int(x) for x in expect.lower().split('x'))
        if (p['w'], p['h']) != (ew, eh): errs.append(f'Auflösung {p["w"]}x{p["h"]} statt {ew}x{eh}')
    if p['h'] and p['w'] and abs(p['h'] / p['w'] - 16 / 9) > 0.02: errs.append(f'Format nicht 9:16 ({p["w"]}x{p["h"]})')
    if p['fps'] < 24: warns.append(f'Bildrate nur {p["fps"]:.1f}')
    if p['dur'] < min_dur: errs.append(f'zu kurz ({p["dur"]:.1f}s)')
    if not p['audio']: errs.append('keine Tonspur')
    F = frames(path)
    mean, std = F.mean(axis=(1, 2)), F.std(axis=(1, 2))
    sharp = np.array([lap_var(f) for f in F]) * 1e4
    info.update(luma=round(float(mean.mean()), 3), contrast=round(float(std.mean()), 3), sharpness=round(float(np.median(sharp)), 1))
    black = mean < 0.035
    run_b, best = 0, 0
    for b in black: run_b = run_b + 1 if b else 0; best = max(best, run_b)
    if best * 0.5 >= 1.0: errs.append(f'Schwarzbild {best * 0.5:.1f}s')
    if mean.mean() < 0.12: warns.append(f'insgesamt sehr dunkel (Helligkeit {mean.mean():.2f})')
    if mean.mean() > 0.85: warns.append(f'überbelichtet (Helligkeit {mean.mean():.2f})')
    if std.mean() < 0.08: warns.append(f'flaues Bild (Kontrast {std.mean():.2f})')
    soft = np.nonzero(sharp < np.median(sharp) * 0.35)[0]
    if len(soft) > max(2, len(F) * 0.08): warns.append(f'{len(soft)} unscharfe Stellen (z. B. bei {soft[0] * 0.5:.1f}s)')
    diffs = np.abs(np.diff(F, axis=0)).mean(axis=(1, 2))
    frozen, run_f = 0, 0
    for d in diffs: run_f = run_f + 1 if d < 0.0015 else 0; frozen = max(frozen, run_f)
    if frozen * 0.5 >= 3.0: warns.append(f'Bild steht {frozen * 0.5:.1f}s still')
    if len(diffs) >= 4 and diffs[:4].mean() < 0.004: warns.append('Hook: in den ersten 2 s kaum Bewegung')
    if mean[:4].mean() < 0.06: warns.append('Hook: erste 2 s fast schwarz')
    I, P = loudness(path); info.update(lufs=I, peak=P)
    if I is not None and not (-19 <= I <= -11): warns.append(f'Lautheit {I:.1f} LUFS (Ziel -15)')
    if P is not None and P > -0.5: warns.append(f'Spitzenpegel {P:.1f} dBFS (Übersteuerung möglich)')
    sil = silences(path)
    if sil: warns.append(f'{len(sil)} Stille(n) ≥ 1,5 s (längste {max(sil):.1f}s)')
    ok = not errs
    log(f'QA: {"✓" if ok and not warns else ("⚠" if ok else "✗")} {p["w"]}x{p["h"]} {p["fps"]:.0f}fps {p["dur"]:.1f}s · Schärfe {info["sharpness"]} · Helligkeit {info["luma"]} · Kontrast {info["contrast"]} · {I} LUFS')
    for e in errs: log('  ✗ ' + e)
    for w in warns: log('  ⚠ ' + w)
    return {'ok': ok, 'errors': errs, 'warnings': warns, 'info': info}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--expect'); ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    r = run(a.video, a.expect, log=(lambda *x: None) if a.json else print)
    if a.json: print(json.dumps(r, ensure_ascii=False, indent=1))
    sys.exit(2 if not r['ok'] else (1 if r['warnings'] else 0))


if __name__ == '__main__':
    main()
