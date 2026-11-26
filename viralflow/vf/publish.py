"""ENGINE 2 – VIRALFLOW PUBLISHER (läuft in GitHub Actions, gestartet vom Orchestrator).

  python -m vf.publish --ids "<video_id>:youtube,<video_id>:instagram"

Pro Veröffentlichung: Claim (Idempotenz) -> Download aus R2 -> Prüfung -> Upload über die offizielle API -> Rückmeldung.
Plattformen sind voneinander unabhängig: ein Fehler bei TikTok stoppt YouTube/Instagram nicht.
"""
import argparse
import json
import os
import sys
import tempfile
import traceback
from pathlib import Path

from .client import Orchestrator, OrchestratorError
from .platforms import buffer_tiktok, instagram, tiktok, youtube
from .platforms.base import PublishError
from .storage import Storage
from .validate import InvalidVideo, check

PLATFORMS = {'youtube': youtube, 'instagram': instagram, 'tiktok': tiktok}


def run(ids, api=None, storage=None, run_id=None):
    api = api or Orchestrator()
    storage = storage or Storage()
    run_id = run_id or f'{os.environ.get("GITHUB_RUN_ID", "local")}-{os.environ.get("GITHUB_RUN_ATTEMPT", "1")}'
    tmp = Path(tempfile.mkdtemp(prefix='vf-pub-'))
    files = {}
    results = {}
    for pid in ids:
        platform = pid.rsplit(':', 1)[-1]
        try:
            job = api.claim(pid, run_id)
        except OrchestratorError as e:
            print(f'[{pid}] übersprungen: {e.message}', flush=True)
            results[pid] = 'skipped'
            continue
        pub, video, meta, settings = job['publication'], job['video'], job['metadata'], job['settings']
        try:
            if platform not in PLATFORMS:
                raise PublishError(f'Unbekannte Plattform {platform}', retryable=False)
            key = video['storage_key']
            if platform == 'youtube':  # YouTube bekommt den echten 4K-Master, falls vorhanden
                k4 = key.replace('.mp4', '_4k.mp4')
                try:
                    if k4 in files or storage.exists(k4): key = k4
                except Exception:
                    pass
            if key not in files:
                dst = tmp / Path(key).name
                storage.download(key, dst)
                info, warns = check(dst, video.get('sha256') if key == video['storage_key'] else None)
                for w in warns:
                    api.log('VALIDATION_WARNING', w, video_id=video['id'], level='warn')
                files[key] = (dst, info)
            path, info = files[key]
            # Vorschaubild (Lukas 26.11.): liegt als <video>_thumb.jpg/.json neben dem Video in R2
            tkey = video['storage_key'].replace('.mp4', '_thumb.jpg')
            if tkey not in files:
                try:
                    if storage.exists(tkey):
                        tdst = tmp / Path(tkey).name; storage.download(tkey, tdst); files[tkey] = tdst
                        jk = tkey.replace('.jpg', '.json')
                        if storage.exists(jk): jd = tmp / Path(jk).name; storage.download(jk, jd); files[jk] = json.loads(jd.read_text())
                except Exception as e:
                    print(f'[{pid}] Vorschaubild nicht geladen: {e}', flush=True)
            if files.get(tkey): meta = dict(meta, _thumb_path=str(files[tkey]), _thumb_ms=(files.get(tkey.replace('.jpg', '.json')) or {}).get('ms'))
            tok = api.token(platform)
            print(f'[{pid}] Upload startet ({info["duration"]:.1f}s, {info["size"] / 1e6:.1f} MB)', flush=True)
            mod = PLATFORMS[platform]
            if platform == 'instagram':
                meta = dict(meta, _media_url=buffer_tiktok.media_url(video['id']))
            if platform == 'tiktok' and buffer_tiktok.enabled():
                mod, meta = buffer_tiktok, dict(meta, _media_url=buffer_tiktok.media_url(video['id']))
                print(f'[{pid}] TikTok über Buffer', flush=True)
            res = mod.publish(path, info['size'], tok, meta, settings, pid, pub['attempts'])
            api.report(pid, status='published', run_id=run_id, **res)
            print(f'[{pid}] ✓ veröffentlicht: {res.get("remote_url") or res.get("remote_id")} ({res.get("privacy")})', flush=True)
            results[pid] = 'published'
        except (PublishError, InvalidVideo, OrchestratorError) as e:
            retryable = getattr(e, 'retryable', True) and not isinstance(e, InvalidVideo)
            print(f'[{pid}] ✗ {e}', flush=True)
            _report_fail(api, pid, run_id, str(e), retryable)
            results[pid] = 'failed'
        except Exception as e:  # unerwartet -> trotzdem melden, andere Plattformen laufen weiter
            traceback.print_exc()
            _report_fail(api, pid, run_id, f'Interner Fehler: {e}', True)
            results[pid] = 'failed'
    return results


def _report_fail(api, pid, run_id, error, retryable):
    try:
        api.report(pid, status='failed', run_id=run_id, error=error, retryable=retryable)
    except OrchestratorError as e:
        print(f'[{pid}] Rückmeldung fehlgeschlagen: {e}', flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', required=True, help='Komma-getrennte Veröffentlichungs-IDs')
    a = ap.parse_args()
    ids = [x.strip() for x in a.ids.split(',') if x.strip()]
    res = run(ids)
    print('Ergebnis:', res)
    # Exit 0, auch bei Plattformfehlern: der Orchestrator kümmert sich um Wiederholungen
    sys.exit(0)


if __name__ == '__main__':
    main()
