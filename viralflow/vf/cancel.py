"""Geplante Veröffentlichungen abbrechen (ohne Dashboard), z. B. wenn ein Video ersetzt wird.

  python -m vf.cancel --ids "video-id:youtube,video-id:tiktok" [--reason "..."]
Nur Einträge im Status queued/dispatched werden abgebrochen; bereits veröffentlichte bleiben unberührt.
"""
import argparse
import os

from .client import Orchestrator, OrchestratorError


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', required=True)
    ap.add_argument('--reason', default='Abgebrochen (ersetzt durch neue Version)')
    a = ap.parse_args()
    api = Orchestrator()
    run_id = f'cancel-{os.environ.get("GITHUB_RUN_ID", "local")}'
    for pid in [x.strip() for x in a.ids.split(',') if x.strip()]:
        try:
            api.claim(pid, run_id)
        except OrchestratorError as e:
            print(f'[{pid}] nicht abgebrochen: {e.message}', flush=True)
            continue
        api.report(pid, status='failed', run_id=run_id, error=a.reason, retryable=False)
        print(f'[{pid}] abgebrochen', flush=True)


if __name__ == '__main__':
    main()
