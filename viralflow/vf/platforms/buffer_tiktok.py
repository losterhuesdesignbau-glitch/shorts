"""TikTok über Buffer (Gratis-Plan, offiziell von TikTok freigegeben) – mit Beschreibung und Hashtags.

Aktiv, sobald das Secret BUFFER_API_KEY gesetzt ist. Buffer holt das Video über einen zeitlich
begrenzten R2-Link (Buffer hat keinen Datei-Upload). Gepostet wird sofort (mode shareNow, automatic).
Optional: BUFFER_TIKTOK_CHANNEL_ID (sonst wird der erste TikTok-Kanal im Buffer-Konto genommen).

Prüfen ohne zu posten:  python -m vf.platforms.buffer_tiktok --check
"""
import json
import os
import sys
import time

from .base import PublishError, http

API = os.environ.get('BUFFER_API_URL', 'https://api.buffer.com')
POLL_S = float(os.environ.get('BUFFER_POLL_SECONDS', '15'))


def media_url(video_id, ttl=6 * 3600):
    """Signierter öffentlicher Link über den Orchestrator (Buffer kann R2-Presigned-Links nicht lesen)."""
    import hashlib
    import hmac
    exp = int(time.time()) + ttl
    sig = hmac.new(os.environ['VF_WEBHOOK_SECRET'].encode(), f'media.{video_id}.{exp}'.encode(), hashlib.sha256).hexdigest()
    return f'{os.environ["VF_API_URL"].rstrip("/")}/m/{exp}/{sig}/{video_id}.mp4'


def enabled():
    return bool(os.environ.get('BUFFER_API_KEY'))


def gql(query, variables=None):
    r = http('POST', API, json={'query': query, 'variables': variables or {}},
             headers={'authorization': f'Bearer {os.environ["BUFFER_API_KEY"]}', 'content-type': 'application/json'})
    try:
        j = r.json()
    except ValueError:
        raise PublishError(f'Buffer: HTTP {r.status_code} {r.text[:200]}')
    if r.status_code in (401, 403):
        raise PublishError(f'Buffer: API-Schlüssel ungültig ({r.status_code})', retryable=False)
    if j.get('errors') and not j.get('data'):
        raise PublishError(f'Buffer: {j["errors"][0].get("message", j["errors"])}')
    return j.get('data') or {}, j.get('errors')


def tiktok_channel():
    cid = os.environ.get('BUFFER_TIKTOK_CHANNEL_ID')
    if cid:
        return cid, None
    d, _ = gql('query { account { id organizations { id name } } }')
    orgs = ((d.get('account') or {}).get('organizations')) or []
    found = []
    for o in orgs:
        cd, _ = gql('query ($org: OrganizationId!) { channels(input: { organizationId: $org }) { id name service isQueuePaused } }', {'org': o['id']})
        for c in cd.get('channels') or []:
            found.append(c)
            if (c.get('service') or '').lower() == 'tiktok':
                return c['id'], c
    raise PublishError(f'Buffer: kein TikTok-Kanal verbunden (gefunden: {[c.get("service") for c in found]})', retryable=False)


CREATE = '''mutation ($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess { post { id status } }
    ... on MutationError { message }
  }
}'''


def _status(post_id):
    try:
        d, errs = gql('query ($id: PostId!) { post(input: { id: $id }) { id status } }', {'id': post_id})
    except PublishError:
        return None
    return ((d or {}).get('post') or {}).get('status')


def publish(path, size, tok, meta, settings, pub_id, attempt):
    url = meta.get('_media_url')
    if not url:
        raise PublishError('Buffer: kein öffentlicher Video-Link (R2) verfügbar', retryable=False)
    channel, _ = tiktok_channel()
    text = meta['tiktok']['title'][:2200]
    d, errs = gql(CREATE, {'input': {'text': text, 'channelId': channel, 'schedulingType': 'automatic', 'mode': 'shareNow',
                                     'assets': [{'video': {'url': url}}]}})
    res = d.get('createPost') or {}
    if 'post' not in res:
        raise PublishError(f'Buffer createPost: {res.get("message") or errs}', retryable=True)
    post_id = res['post']['id']
    # kurz warten, ob Buffer den Post wirklich rausschickt (Status ist nur Zusatzinfo)
    status, deadline = res['post'].get('status'), time.time() + 6 * 60
    while time.time() < deadline and (status or '').lower() not in ('sent', 'published', 'error', 'failed'):
        time.sleep(POLL_S)
        status = _status(post_id) or status
    if (status or '').lower() in ('error', 'failed'):
        raise PublishError(f'Buffer/TikTok: Post fehlgeschlagen (Status {status}) – Details in Buffer', retryable=False)
    return {'remote_id': f'buffer:{post_id}', 'remote_url': None, 'privacy': 'PUBLIC',
            'note': f'über Buffer gepostet (Status {status or "unbekannt"})'}


if __name__ == '__main__' and '--check' in sys.argv:
    cid, ch = tiktok_channel()
    print(json.dumps({'ok': True, 'tiktok_channel_id': cid, 'channel': ch}, ensure_ascii=False))
