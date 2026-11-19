"""Geplante Veröffentlichungen abbrechen (ohne Dashboard), z. B. wenn ein Video ersetzt wird.

  python -m vf.cancel --ids "video-id:youtube,video-id:tiktok" [--reason "..."]
Nur Einträge im Status queued/dispatched werden abgebrochen; bereits veröffentlichte bleiben unberührt.
"""
import argparse
import os

from .client import Orchestrator, OrchestratorError


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ids', default='')
    ap.add_argument('--list', action='store_true', help='offene Veröffentlichungen anzeigen')
    ap.add_argument('--platform', default='', help='mit --requeue: alle offenen Einträge dieser Plattform')
    ap.add_argument('--reason', default='Abgebrochen (ersetzt durch neue Version)')
    ap.add_argument('--requeue', action='store_true', help='stattdessen sofort neu einreihen')
    a = ap.parse_args()
    api = Orchestrator()
    if a.list or a.platform:
        items = api.call('POST', '/api/engine/publications/list', {}).get('items', [])
        for it in items:
            print(f"{it['id']}  {it['platform']:9} {it['status']:10} {it['scheduled_at']}  {it['filename']}  {it.get('error') or ''}", flush=True)
        if a.platform and a.requeue:
            a.ids = ','.join(it['id'] for it in items if it['platform'] == a.platform and it['status'] in ('queued', 'failed'))
        elif a.list:
            return
    run_id = f'cancel-{os.environ.get("GITHUB_RUN_ID", "local")}'
    for pid in [x.strip() for x in a.ids.split(',') if x.strip()]:
        if a.requeue:
            try:
                api.call('POST', f'/api/engine/publications/{pid}/requeue', {}); print(f'[{pid}] neu eingereiht', flush=True)
            except OrchestratorError as e:
                print(f'[{pid}] nicht neu eingereiht: {e.message}', flush=True)
            continue
        try:
            api.claim(pid, run_id)
        except OrchestratorError as e:
            print(f'[{pid}] nicht abgebrochen: {e.message}', flush=True)
            continue
        api.report(pid, status='failed', run_id=run_id, error=a.reason, retryable=False)
        print(f'[{pid}] abgebrochen', flush=True)


if __name__ == '__main__':
    main()
