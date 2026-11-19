"""Instagram Reels über die offizielle Instagram API (Instagram-Login, Content Publishing).

Ablauf: Container anlegen (REELS, resumable) -> Datei zu rupload.facebook.com -> Status FINISHED abwarten -> media_publish.
Voraussetzung: Instagram-Profi-Konto (Business oder Creator) und Berechtigung instagram_business_content_publish.
"""
import os
import time

from .base import PublishError, http, err_text

GRAPH = os.environ.get('IG_GRAPH_BASE', 'https://graph.instagram.com')
RUPLOAD = os.environ.get('IG_UPLOAD_BASE', 'https://rupload.facebook.com')
POLL_S = float(os.environ.get('IG_POLL_SECONDS', '10'))


def publish(path, size, tok, meta, settings, pub_id, attempt):
    token, ig_id, ver = tok['access_token'], tok['account_id'], tok.get('graph_version', 'v24.0')
    g = f'{GRAPH}/{ver}'

    lim = http('GET', f'{g}/{ig_id}/content_publishing_limit', params={'fields': 'quota_usage,config', 'access_token': token})
    if lim.status_code == 200:
        d = (lim.json().get('data') or [{}])[0]
        total = (d.get('config') or {}).get('quota_total')
        if total and d.get('quota_usage', 0) >= total:
            raise PublishError('Instagram-Tageslimit für API-Posts erreicht')

    r = http('POST', f'{g}/{ig_id}/media', data={
        'media_type': 'REELS', 'upload_type': 'resumable', 'caption': meta['instagram']['caption'][:2200],
        'share_to_feed': 'true', 'access_token': token,
    })
    if r.status_code != 200:
        raise PublishError(f'Instagram Container: {err_text(r)}', retryable=r.status_code not in (400, 401, 403))
    cid = r.json()['id']

    with open(path, 'rb') as f:
        data = f.read()
    r = http('POST', f'{RUPLOAD}/ig-api-upload/{ver}/{cid}', data=data, timeout=600,
             headers={'authorization': f'OAuth {token}', 'offset': '0', 'file_size': str(size)})
    if r.status_code != 200:
        raise PublishError(f'Instagram Upload: {err_text(r)}')

    deadline = time.time() + 15 * 60
    while True:
        s = http('GET', f'{g}/{cid}', params={'fields': 'status_code,status', 'access_token': token})
        code = s.json().get('status_code') if s.status_code == 200 else None
        if code == 'FINISHED':
            break
        if code in ('ERROR', 'EXPIRED'):
            raise PublishError(f'Instagram-Verarbeitung: {s.json().get("status", code)}', retryable=code == 'EXPIRED')
        if time.time() > deadline:
            raise PublishError('Instagram-Verarbeitung dauert zu lange (>15 min)')
        time.sleep(POLL_S)

    r = http('POST', f'{g}/{ig_id}/media_publish', data={'creation_id': cid, 'access_token': token}, retries=1)
    if r.status_code != 200:
        raise PublishError(f'Instagram Veröffentlichen: {err_text(r)}', retryable=False)
    mid = r.json()['id']
    url = None
    p = http('GET', f'{g}/{mid}', params={'fields': 'permalink', 'access_token': token})
    if p.status_code == 200:
        url = p.json().get('permalink')
    return {'remote_id': mid, 'remote_url': url, 'privacy': 'public'}
