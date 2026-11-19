"""YouTube Shorts über die offizielle YouTube Data API v3 (resumable Upload).

Hinweis: Uploads aus nicht geprüften (unverified) API-Projekten bleiben privat, bis das Projekt
Googles Audit bestanden hat. Der tatsächliche Status wird ans Dashboard zurückgemeldet.
"""
import hashlib
import os

from .base import PublishError, http, err_text

API = os.environ.get('YT_API_BASE', 'https://www.googleapis.com')
CHUNK = 8 * 1024 * 1024  # Vielfaches von 256 KiB


def marker(pub_id):
    """Unsichtbarer Erkennungs-Tag gegen Doppel-Uploads nach unklarem Abbruch."""
    return 'vf' + hashlib.sha1(pub_id.encode()).hexdigest()[:10]


def find_existing(token, mark):
    h = {'authorization': f'Bearer {token}'}
    r = http('GET', f'{API}/youtube/v3/channels?part=contentDetails&mine=true', headers=h)
    if r.status_code != 200:
        return None
    uploads = r.json()['items'][0]['contentDetails']['relatedPlaylists']['uploads']
    r = http('GET', f'{API}/youtube/v3/playlistItems?part=contentDetails&maxResults=15&playlistId={uploads}', headers=h)
    if r.status_code != 200:
        return None
    ids = [i['contentDetails']['videoId'] for i in r.json().get('items', [])]
    if not ids:
        return None
    r = http('GET', f'{API}/youtube/v3/videos?part=snippet,status&id={",".join(ids)}', headers=h)
    for v in r.json().get('items', []) if r.status_code == 200 else []:
        if mark in (v['snippet'].get('tags') or []):
            return v
    return None


def publish(path, size, tok, meta, settings, pub_id, attempt):
    token = tok['access_token']
    md = meta['youtube']
    mark = marker(pub_id)
    if attempt > 0:
        prev = find_existing(token, mark)
        if prev:
            return {'remote_id': prev['id'], 'remote_url': f'https://youtube.com/shorts/{prev["id"]}',
                    'privacy': prev['status']['privacyStatus'], 'note': 'Bereits hochgeladen (Duplikat verhindert)'}
    body = {
        'snippet': {
            'title': md['title'][:100], 'description': md['description'][:5000],
            'tags': (md.get('tags') or [])[:30] + [mark], 'categoryId': str(md.get('categoryId') or settings.get('youtube_category') or '24'),
            'defaultLanguage': md.get('defaultLanguage'), 'defaultAudioLanguage': md.get('defaultLanguage'),
        },
        'status': {'privacyStatus': settings.get('youtube_privacy', 'public'), 'selfDeclaredMadeForKids': False, 'embeddable': True},
    }
    h = {'authorization': f'Bearer {token}', 'content-type': 'application/json; charset=UTF-8',
         'x-upload-content-length': str(size), 'x-upload-content-type': 'video/mp4'}
    r = http('POST', f'{API}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', headers=h, json=body)
    if r.status_code != 200 or 'location' not in r.headers:
        txt = err_text(r)
        fatal = r.status_code in (400, 401, 403) and 'quota' not in txt.lower()
        raise PublishError(f'YouTube Upload-Start: {txt}', retryable=not fatal)
    loc = r.headers['location']

    offset = 0
    resumes = 0
    with open(path, 'rb') as f:
        while True:
            f.seek(offset)
            chunk = f.read(CHUNK)
            end = offset + len(chunk) - 1
            r = http('PUT', loc, headers={'content-length': str(len(chunk)), 'content-range': f'bytes {offset}-{end}/{size}'}, data=chunk, retries=2)
            if r.status_code in (200, 201):
                v = r.json()
                return {'remote_id': v['id'], 'remote_url': f'https://youtube.com/shorts/{v["id"]}',
                        'privacy': v.get('status', {}).get('privacyStatus')}
            if r.status_code == 308:
                rng = r.headers.get('range')
                offset = int(rng.split('-')[1]) + 1 if rng else 0
                continue
            # Unterbrochen -> Stand abfragen und fortsetzen
            resumes += 1
            if resumes > 5:
                raise PublishError(f'YouTube Upload abgebrochen: {err_text(r)}')
            q = http('PUT', loc, headers={'content-length': '0', 'content-range': f'bytes */{size}'})
            if q.status_code in (200, 201):
                v = q.json()
                return {'remote_id': v['id'], 'remote_url': f'https://youtube.com/shorts/{v["id"]}', 'privacy': v.get('status', {}).get('privacyStatus')}
            rng = q.headers.get('range')
            offset = int(rng.split('-')[1]) + 1 if rng else 0
