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
    ap.add_argument('--rs', default=os.environ.get('VF_RENDER_SCALE', '0.75'))
    ap.add_argument('--extra', default=os.environ.get('VF_STUDIO_ARGS', ''), help='zusätzliche studio.py-Argumente, z. B. --force')
    a = ap.parse_args()
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
    ep_path = work / 'episode.json'
    ep_path.write_text(json.dumps(ep, ensure_ascii=False), encoding='utf-8')
    out = work / f'{vid}.mp4'
    cmd = [sys.executable, str(STUDIO), str(ep_path), '-o', str(out), '--rs', str(a.rs)] + a.extra.split()
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


if __name__ == '__main__':
    sys.exit(main())
