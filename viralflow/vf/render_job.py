"""ENGINE 1 – Cloud-Wrapper um die bestehende Block-Studio-Engine (engine/roblox/studio.py, unverändert).

  python -m vf.render_job --file episodes/queue/mein_video.json      # Auftrag aus dem Repo
  python -m vf.render_job --episode-id 20261119-titel-ab12cd          # Auftrag aus dem Dashboard

Ablauf: beim Orchestrator anmelden (Pause?) -> studio.py rendern -> MP4 prüfen -> nach R2 -> VIDEO_READY.

Episoden-Datei = normale episode.json der Engine, optional mit Block "meta":
  "meta": {"title": "…", "description": "…", "hashtags": ["…"], "script": "…", "language": "en"}
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from .client import Orchestrator, OrchestratorError
from .storage import Storage
from .validate import check, sha256_file

REPO = Path(__file__).resolve().parents[2]
STUDIO = REPO / 'engine' / 'roblox' / 'studio.py'


def slugify(s, n=40):
    s = s.lower()
    for a, b in (('ä', 'ae'), ('ö', 'oe'), ('ü', 'ue'), ('ß', 'ss')):
        s = s.replace(a, b)
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:n].strip('-') or 'video'


def video_id_for(name, raw):
    """Stabile, eindeutige ID: gleicher Inhalt -> gleiche ID (kein doppeltes Video)."""
    return f'{slugify(name)}-{hashlib.sha256(raw).hexdigest()[:8]}'


def script_text(ep):
    meta = ep.get('meta') or {}
    if meta.get('script'):
        return meta['script']
    return ' '.join(re.sub(r'\*', '', s.get('say', '')) for s in ep.get('shots', []) if s.get('say'))


def output(name, value):
    gh = os.environ.get('GITHUB_OUTPUT')
    if gh:
        with open(gh, 'a') as f:
            f.write(f'{name}={value}\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--file')
    ap.add_argument('--episode-id')
    ap.add_argument('--rs', default=os.environ.get('VF_RENDER_SCALE'))  # leer = Engine-Standard (4K-Look: 1.25)
    ap.add_argument('--extra', default=os.environ.get('VF_STUDIO_ARGS', ''), help='zusätzliche studio.py-Argumente, z. B. --force')
    ap.add_argument('--part', default=None, help='verteiltes Rendern: K/N – nur Shots rendern, nach --parts-out kopieren (kein Upload/Orchestrator)')
    ap.add_argument('--parts-out', default='parts_out')
    ap.add_argument('--parts-in', default=os.environ.get('VF_PARTS_IN', ''), help='Ordner mit vorab gerenderten Shots (Matrix-Teile)')
    a = ap.parse_args()
    if a.part:
        return render_part(a)
    api = Orchestrator()

    if a.file:
        path = Path(a.file)
        raw = path.read_bytes()
        ep = json.loads(raw)
        vid = video_id_for(path.stem, raw)
        title = (ep.get('meta') or {}).get('title') or path.stem
        reg = api.register_episode(id=vid, path=str(path), title=title)
        if not reg.get('proceed'):
            print(f'Nicht gerendert: {reg.get("reason")}')
            output('status', 'done' if reg.get('video_exists') else 'waiting')
            return 0
        src_name = path.stem
    else:
        vid = a.episode_id
        r = api.fetch_episode(vid)
        if not r.get('proceed'):
            print(f'Nicht gerendert: {r.get("reason")}'); output('status', 'waiting'); return 0
        if r.get('episode'):
            ep = r['episode']
        else:  # Git-Auftrag, der wegen Pause gewartet hat
            ep = json.loads((REPO / r['path']).read_text(encoding='utf-8'))
        src_name = vid

    work = Path(tempfile.mkdtemp(prefix='vf-render-'))
    if a.parts_in and Path(a.parts_in).is_dir():  # vorab verteilt gerenderte Shots übernehmen (fehlende rendert studio.py selbst)
        import shutil
        sd = work / f'{vid}_shots'; sd.mkdir(parents=True, exist_ok=True); n = 0
        for f in Path(a.parts_in).rglob('shot_*'):
            shutil.copy2(f, sd / f.name); n += 1
        print(f'Verteilte Teile übernommen: {n} Dateien', flush=True)
    ep_path = work / 'episode.json'
    ep_path.write_text(json.dumps(ep, ensure_ascii=False), encoding='utf-8')
    out = work / f'{vid}.mp4'
    cmd = [sys.executable, str(STUDIO), str(ep_path), '-o', str(out)] + (['--rs', str(a.rs)] if a.rs else []) + a.extra.split()
    print('Engine 1:', ' '.join(cmd), flush=True)
    try:
        p = subprocess.run(cmd, cwd=STUDIO.parent, capture_output=False)
        if p.returncode != 0 or not out.exists():
            raise RuntimeError(f'studio.py beendet mit Code {p.returncode}')
        info, warns = check(out)
        for w in warns:
            api.log('VALIDATION_WARNING', w, video_id=vid, level='warn')
        now = dt.datetime.now(dt.timezone.utc)
        key = f'videos/{now:%Y/%m}/{vid}.mp4'
        Storage().upload(out, key)
        meta = dict(ep.get('meta') or {})
        resp = api.video_ready({
            'event': 'VIDEO_READY', 'video_id': vid, 'episode_id': vid, 'idempotency_key': vid,
            'storage_key': key, 'filename': f'{src_name}.mp4', 'duration': round(info['duration'], 2),
            'size_bytes': info['size'], 'sha256': sha256_file(out), 'produced_at': now.isoformat(),
            'script': script_text(ep), 'meta': {k: meta[k] for k in ('title', 'description', 'hashtags', 'language') if k in meta},
        })
        print('Orchestrator:', json.dumps(resp, ensure_ascii=False), flush=True)
        output('status', 'done')
        output('video_id', vid)
        return 0
    except Exception as e:
        print(f'FEHLER: {e}', flush=True)
        try:
            api.episode_status(vid, 'failed', str(e)[:800])
        except OrchestratorError:
            pass
        output('status', 'failed')
        return 1


def render_part(a):
    """Matrix-Teil: nur die eigenen Shots rendern (gleiche episode.json + gleiche ID wie der Haupt-Job)."""
    import shutil
    path = Path(a.file); raw = path.read_bytes(); vid = video_id_for(path.stem, raw)
    work = Path(tempfile.mkdtemp(prefix='vf-part-')); ep_path = work / 'episode.json'
    ep_path.write_text(json.dumps(json.loads(raw), ensure_ascii=False), encoding='utf-8')
    out = work / f'{vid}.mp4'
    cmd = [sys.executable, str(STUDIO), str(ep_path), '-o', str(out), '--rs', str(a.rs), '--part', a.part] + a.extra.split()
    print('Engine 1 (Teil):', ' '.join(cmd), flush=True)
    p = subprocess.run(cmd, cwd=STUDIO.parent)
    dst = Path(a.parts_out); dst.mkdir(parents=True, exist_ok=True)
    for f in (work / f'{vid}_shots').glob('shot_*'):
        if f.suffix in ('.mp4', '.json'): shutil.copy2(f, dst / f.name)
    print(f'Teil {a.part}: {len(list(dst.glob("shot_*.mp4")))} Shots -> {dst}', flush=True)
    return 0  # Fehler eines Teils sind unkritisch: der Haupt-Job rendert fehlende Shots selbst


if __name__ == '__main__':
    sys.exit(main())
