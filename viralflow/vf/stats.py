"""Statistik-Job: Aufrufe/Likes/Kommentare pro veröffentlichtem Video + Follower + YouTube-Verdienst -> Orchestrator.
python -m vf.stats      (läuft alle 6 h über .github/workflows/vf-stats.yml)
YouTube: Data API (youtube.readonly) für Zahlen; Verdienst über YouTube Analytics (nur mit yt-analytics-monetary + Partnerprogramm).
Instagram: Graph API (like_count, comments_count; Aufrufe/Reichweite nur mit Insights-Berechtigung).
TikTok: Uploads über Buffer; Zahlen über Display API (user.info.stats, video.list) der eigenen Sandbox-App. Zuordnung zum Video über Veröffentlichungszeit."""
import datetime as dt

import requests

from .client import Orchestrator


def chunks(a, n):
    for i in range(0, len(a), n): yield a[i:i + n]


def youtube(api, pubs, out):
    try:
        tok = api.token('youtube')
    except Exception as e:
        print('YouTube: kein Token –', e); return
    H = {'Authorization': f"Bearer {tok['access_token']}"}
    ids = {p['remote_id']: p for p in pubs if p['platform'] == 'youtube' and p.get('remote_id')}
    for part in chunks(list(ids), 50):
        r = requests.get('https://www.googleapis.com/youtube/v3/videos', params={'part': 'statistics', 'id': ','.join(part)}, headers=H, timeout=30)
        if r.status_code != 200: print('YouTube videos.list:', r.status_code, r.text[:200]); break
        for it in r.json().get('items', []):
            s = it.get('statistics', {})
            out['videos'].append({'platform': 'youtube', 'remote_id': it['id'], 'video_id': ids[it['id']]['video_id'], 'views': int(s.get('viewCount', 0)), 'likes': int(s.get('likeCount', 0)), 'comments': int(s.get('commentCount', 0))})
    r = requests.get('https://www.googleapis.com/youtube/v3/channels', params={'part': 'statistics', 'mine': 'true'}, headers=H, timeout=30)
    if r.status_code == 200 and r.json().get('items'):
        s = r.json()['items'][0]['statistics']
        out['accounts'].append({'platform': 'youtube', 'followers': int(s.get('subscriberCount', 0)), 'total_views': int(s.get('viewCount', 0)), 'media_count': int(s.get('videoCount', 0))})
    if 'yt-analytics-monetary' in (tok.get('scopes') or ''):
        end = dt.date.today(); start = end - dt.timedelta(days=90)
        r = requests.get('https://youtubeanalytics.googleapis.com/v2/reports', params={'ids': 'channel==MINE', 'startDate': str(start), 'endDate': str(end), 'metrics': 'estimatedRevenue', 'dimensions': 'day', 'currency': 'EUR'}, headers=H, timeout=30)
        if r.status_code == 200:
            for day, rev in r.json().get('rows', []) or []:
                if rev: out['earnings'].append({'platform': 'youtube', 'day': day, 'amount': round(float(rev), 2), 'currency': 'EUR', 'note': 'YouTube Analytics (geschätzt)'})
        else:
            print('YouTube Analytics (Verdienst):', r.status_code, r.text[:200])
    else:
        print('YouTube-Verdienst: Berechtigung fehlt – im Dashboard YouTube neu verbinden')


def instagram(api, pubs, out):
    try:
        tok = api.token('instagram')
    except Exception as e:
        print('Instagram: kein Token –', e); return
    g = f"{tok.get('graph_base') or 'https://graph.instagram.com'}/{tok.get('graph_version', 'v24.0')}"; T = tok['access_token']
    ins_ok = True
    for p in pubs:
        if p['platform'] != 'instagram' or not p.get('remote_id'): continue
        r = requests.get(f"{g}/{p['remote_id']}", params={'fields': 'like_count,comments_count', 'access_token': T}, timeout=30)
        if r.status_code != 200: print('Instagram media:', r.status_code, r.text[:160]); continue
        d = r.json(); row = {'platform': 'instagram', 'remote_id': p['remote_id'], 'video_id': p['video_id'], 'likes': d.get('like_count'), 'comments': d.get('comments_count')}
        if ins_ok:
            q = requests.get(f"{g}/{p['remote_id']}/insights", params={'metric': 'views,reach,saved,shares', 'access_token': T}, timeout=30)
            if q.status_code == 200:
                m = {x['name']: (x.get('values') or [{}])[0].get('value') for x in q.json().get('data', [])}
                row.update(views=m.get('views'), reach=m.get('reach'), saves=m.get('saved'), shares=m.get('shares'))
            else:
                ins_ok = False; print('Instagram Insights nicht verfügbar (Berechtigung instagram_manage_insights fehlt):', q.status_code)
        out['videos'].append(row)
    r = requests.get(f"{g}/{tok['account_id']}", params={'fields': 'followers_count,media_count', 'access_token': T}, timeout=30)
    if r.status_code == 200:
        d = r.json(); out['accounts'].append({'platform': 'instagram', 'followers': d.get('followers_count'), 'media_count': d.get('media_count')})


def tiktok(api, pubs, out):
    try:
        tok = api.token('tiktok')
    except Exception as e:
        print('TikTok: kein Token –', e); return
    H = {'Authorization': f"Bearer {tok['access_token']}"}
    r = requests.get('https://open.tiktokapis.com/v2/user/info/', params={'fields': 'follower_count,likes_count,video_count'}, headers=H, timeout=30)
    if r.status_code == 200 and (r.json().get('data') or {}).get('user'):
        u = r.json()['data']['user']
        out['accounts'].append({'platform': 'tiktok', 'followers': u.get('follower_count'), 'media_count': u.get('video_count')})
    else:
        print('TikTok user.info:', r.status_code, r.text[:200]); return
    vids, cursor = [], None
    for _ in range(10):  # bis 200 Videos
        body = {'max_count': 20}
        if cursor: body['cursor'] = cursor
        r = requests.post('https://open.tiktokapis.com/v2/video/list/', params={'fields': 'id,create_time,view_count,like_count,comment_count,share_count'}, json=body, headers=H, timeout=30)
        if r.status_code != 200: print('TikTok video.list:', r.status_code, r.text[:200]); break
        d = r.json().get('data') or {}
        vids += d.get('videos') or []
        if not d.get('has_more'): break
        cursor = d.get('cursor')
    # TikTok-Video -> unser Video: nächste Veröffentlichung (±45 min)
    tp = [(dt.datetime.fromisoformat(p['published_at'].replace('Z', '+00:00')).timestamp(), p) for p in pubs if p['platform'] == 'tiktok' and p.get('published_at')]
    for v in vids:
        best = min(tp, key=lambda x: abs(x[0] - v.get('create_time', 0)), default=None)
        vid = best[1]['video_id'] if best and abs(best[0] - v.get('create_time', 0)) < 2700 else None
        out['videos'].append({'platform': 'tiktok', 'remote_id': str(v['id']), 'video_id': vid, 'views': v.get('view_count'), 'likes': v.get('like_count'), 'comments': v.get('comment_count'), 'shares': v.get('share_count')})


def main():
    api = Orchestrator()
    pubs = api.call('POST', '/api/engine/publications/list', {'statuses': ['published']}).get('items', [])
    out = {'videos': [], 'accounts': [], 'earnings': []}
    youtube(api, pubs, out); instagram(api, pubs, out); tiktok(api, pubs, out)
    r = api.call('POST', '/api/engine/stats', out)
    print(f"Statistik: {len(out['videos'])} Videos, {len(out['accounts'])} Konten, {len(out['earnings'])} Verdienst-Tage -> {r}")
    bericht(pubs, out)


def bericht(pubs, out):
    """Leistungsbericht im Log (für die Optimierung): je Plattform alle Videos mit Aufrufen und Interaktionsraten."""
    pt = {(p['video_id'], p['platform']): p.get('published_at', '') for p in pubs}
    for a in out['accounts']:
        print(f"KONTO {a['platform']}: Follower {a.get('followers')} · Videos {a.get('media_count')}")
    for plat in ('tiktok', 'youtube', 'instagram'):
        rows = [v for v in out['videos'] if v['platform'] == plat]
        rows.sort(key=lambda v: -(v.get('views') or 0))
        print(f'--- BERICHT {plat}: {len(rows)} Videos ---')
        for v in rows:
            vw = v.get('views') or 0; lk = v.get('likes') or 0; cm = v.get('comments') or 0; sh = v.get('shares') or 0
            rate = lambda x: f'{100 * x / vw:.1f}%' if vw else '-'
            when = (pt.get((v.get('video_id'), plat)) or '')[:16]
            print(f"BERICHT {plat} | {v.get('video_id') or v.get('remote_id')} | {when} | Aufrufe {vw} | Likes {lk} ({rate(lk)}) | Kommentare {cm} ({rate(cm)}) | Shares {sh} ({rate(sh)})"
                  + (f" | Ø Wiedergabe {v.get('avg_view_s')}s" if v.get('avg_view_s') is not None else ''))


if __name__ == '__main__':
    main()
