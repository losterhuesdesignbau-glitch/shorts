"""Tanz-Video nachbauen in einem Schritt: Video -> Pose (YOLO) -> Figuren-Bewegung -> fertige episode.json.

python tools/tanz_nachbauen.py tanz.mp4 ordner/ [--people 2] [--set mall] [--time day] [--pin 0|1]
Danach: python studio.py ordner/episode.json -o ordner/tanz.mp4 --force   (kürzer als 40 s, keine Stimme)

Enthält alle Verbesserungen: schnelle, natürliche Glättung (One-Euro + Savitzky-Golay), Tiefenausgleich,
Bodenkontakt (kein Schweben), Vor/Zurück-Bewegung (dz), feste Kamera, leichte Bewegungsunschärfe.
Der Original-Sound wird nur als Vorschau eingebunden (musicFile) – nicht mit fremdem Sound veröffentlichen.
Aussehen der Figuren (Kleidung, Haare) danach in episode.json unter "cast" anpassen.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video'); ap.add_argument('out')
    ap.add_argument('--people', type=int, default=1)
    ap.add_argument('--set', default='danceroom', help='z. B. danceroom, mall, hallway, xmasmarket, paris, stadium')
    ap.add_argument('--time', default='day')
    ap.add_argument('--pin', type=int, default=None, help='Figuren am Platz halten (Standard: 1 bei mehreren Personen)')
    ap.add_argument('--model', default='yolo11x-pose.pt')
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    kp, mc = out / 'kp.json', out / 'mocap.json'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', a.video, '-vn', '-ac', '2', '-ar', '44100', str(out / 'sound.wav')], check=False)
    if not kp.exists():
        subprocess.run([sys.executable, str(HERE / 'mocap_extract.py'), a.video, str(kp), '--people', str(a.people), '--model', a.model], check=True)
    pin = a.pin if a.pin is not None else int(a.people > 1)
    subprocess.run([sys.executable, str(HERE / 'mocap_retarget.py'), str(kp), str(mc), '--pin', str(pin)], check=True)
    M = json.load(open(mc)); n = len(M['people'][0]['frames']); fps = M['fps']
    looks = ['woman', 'man', 'girl', 'kid']; shirts = ['#f2f2f2', '#2a9d8f', '#d62839', '#ffd23f']
    cast, actors = {}, []
    np_ = len(M['people'])
    for i, p in enumerate(M['people']):
        pid = f'p{i}'; x = (i - (np_ - 1) / 2) * 4.2
        cast[pid] = {'look': looks[i % 4], 'hair': 'long' if i % 2 == 0 else 'short', 'shirt': shirts[i % 4], 'logo': 'none', 'jacket': False, 'slim': 0.85}
        actors.append({'id': pid, 'at': [x, -9], 'do': 'mocap', 'face': 0, 'mood': 'grin',
                       'mocap': {'fps': fps, 'keys': M['keys'], 'frames': p['frames'], 'start': 0, 'gain': 1.0}})
    ep = {'music': 'none', 'musicFile': 'sound.wav', 'musicGain': 1.0, 'tts': False, 'camFar': 1.0, 'motionBlur': True,
          'grade': {'bloom': 0.25, 'vignette': 0.2, 'warm': 0.02, 'sat': 1.06}, 'cast': cast,
          'shots': [{'dur': round(n / fps, 2), 'set': a.set, 'time': a.time, 'actors': actors,
                     'cam': {'type': 'free', 'eye': [0, 5.2, 13], 'look': [0, 4.4, -14], 'fov': 54, 'handheld': 0}}]}
    json.dump(ep, open(out / 'episode.json', 'w'))
    print(f'{np_} Person(en), {n / fps:.1f}s -> {out / "episode.json"}')
    print(f'Rendern: python {HERE.parent / "studio.py"} {out / "episode.json"} -o {out / "tanz.mp4"} --force')


if __name__ == '__main__':
    main()
