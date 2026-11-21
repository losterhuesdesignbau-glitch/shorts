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
    ap.add_argument('--requeue', action='store_true', help='stattdessen SOFORT veröffentlichen (Achtung: nicht zum Verschieben!)')
    ap.add_argument('--reschedule', default='', help='Video-IDs (Komma) auf einen Termin legen; mit --at HH:MM, sonst nächster freier Termin')
    ap.add_argument('--at', default='', help='Uhrzeit HH:MM für --reschedule')
    a = ap.parse_args()
    api = Orchestrator()
    if a.list or a.platform:
        items = api.call('POST', '/api/engine/publications/list', {'statuses': ['queued', 'failed', 'dispatched', 'uploading', 'cancelled', 'published'] if a.list else []}).get('items', [])
        for it in items:
            print(f"{it['id']}  {it['platform']:9} {it['status']:10} {it['scheduled_at']}  {it['filename']}  {it.get('error') or ''}", flush=True)
        if a.platform and a.requeue:
            a.ids = ','.join(it['id'] for it in items if it['platform'] == a.platform and it['status'] in ('queued', 'failed'))
        elif a.list:
            return
    for vid in [x.strip() for x in a.reschedule.split(',') if x.strip()]:
        try:
            r = api.call('POST', f'/api/engine/videos/{vid}/reschedule', {'at': a.at} if a.at else {})
            print(f'[{vid}] verschoben auf {r.get("scheduled_local")}', flush=True)
        except OrchestratorError as e:
            print(f'[{vid}] nicht verschoben: {e.message}', flush=True)
    run_id = f'cancel-{os.environ.get("GITHUB_RUN_ID", "local")}'
    for pid in [x.strip() for x in a.ids.split(',') if x.strip()]:
        if a.requeue:
            try:
                api.call('POST', f'/api/engine/publications/{pid}/requeue', {}); print(f'[{pid}] neu eingereiht', flush=True)
            except OrchestratorError as e:
                print(f'[{pid}] nicht neu eingereiht: {e.message}', flush=True)
            continue
        try:  # echter Abbruch: Status 'cancelled' -> Termin wird wieder frei (früher: 'failed', Termin blieb belegt)
            api.call('POST', f'/api/engine/publications/{pid}/cancel', {'reason': a.reason})
            print(f'[{pid}] abgebrochen (Termin frei)', flush=True)
        except OrchestratorError as e:
            print(f'[{pid}] nicht abgebrochen: {e.message}', flush=True)


if __name__ == '__main__':
    main()
