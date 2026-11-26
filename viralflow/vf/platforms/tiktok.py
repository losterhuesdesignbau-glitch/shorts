"""TikTok über die offizielle Content Posting API.

Modus 'direct': Direct Post (Scope video.publish). Ohne bestandenes TikTok-Audit sind Posts nur 'Nur ich'
(SELF_ONLY) möglich und das Konto muss beim Posten privat sein.
Modus 'draft': offizieller Upload in den TikTok-Posteingang (Scope video.upload); du veröffentlichst in der App.
Modus 'auto': Direct Post, bei fehlender Freigabe automatisch Entwurf.
"""
import os
import time

from .base import PublishError, http, err_text

API = os.environ.get('TIKTOK_API_BASE', 'https://open.tiktokapis.com')
POLL_S = float(os.environ.get('TIKTOK_POLL_SECONDS', '5'))
FALLBACK_CODES = {'unaudited_client_can_only_post_to_private_accounts', 'scope_not_authorized', 'scope_permission_missed',
                  'privacy_level_option_mismatch', 'access_denied'}


def _h(token):
    return {'authorization': f'Bearer {token}', 'content-type': 'application/json; charset=UTF-8'}


def _call(url, token, body):
    r = http('POST', url, headers=_h(token), json=body)
    try:
        j = r.json()
    except ValueError:
        raise PublishError(f'TikTok: HTTP {r.status_code} {r.text[:200]}')
    code = (j.get('error') or {}).get('code', 'ok')
    return r.status_code, code, j


def _chunks(size):
    if size <= 64 * 1024 * 1024:
        return size, 1
    chunk = 10 * 1024 * 1024
    return chunk, size // chunk


def _upload(upload_url, path, size, chunk, count):
    with open(path, 'rb') as f:
        for i in range(count):
            start = i * chunk
            end = size - 1 if i == count - 1 else start + chunk - 1
            f.seek(start)
            data = f.read(end - start + 1)
            r = http('PUT', upload_url, data=data, timeout=600, headers={
                'content-type': 'video/mp4', 'content-length': str(len(data)), 'content-range': f'bytes {start}-{end}/{size}'})
            if r.status_code not in (200, 201, 206):
                raise PublishError(f'TikTok Datei-Upload: {err_text(r)}')


def _wait(token, publish_id, draft):
    deadline = time.time() + 15 * 60
    while time.time() < deadline:
        st, code, j = _call(f'{API}/v2/post/publish/status/fetch/', token, {'publish_id': publish_id})
        d = j.get('data') or {}
        s = d.get('status')
        if s == 'PUBLISH_COMPLETE' or (draft and s == 'SEND_TO_USER_INBOX'):
            ids = d.get('publicaly_available_post_id') or d.get('publicly_available_post_id') or []
            return s, (str(ids[0]) if ids else None)
        if s == 'FAILED':
            raise PublishError(f'TikTok-Verarbeitung fehlgeschlagen: {d.get("fail_reason", "unbekannt")}', retryable=False)
        time.sleep(POLL_S)
    raise PublishError('TikTok-Verarbeitung dauert zu lange (>15 min)')


def publish(path, size, tok, meta, settings, pub_id, attempt):
    token = tok['access_token']
    mode = settings.get('tiktok_mode', 'auto')
    chunk, count = _chunks(size)
    source = {'source': 'FILE_UPLOAD', 'video_size': size, 'chunk_size': chunk, 'total_chunk_count': count}
    note = None

    if mode in ('auto', 'direct'):
        st, code, info = _call(f'{API}/v2/post/publish/creator_info/query/', token, {})
        if code == 'ok':
            d = info['data']
            options = d.get('privacy_level_options') or []
            want = settings.get('tiktok_privacy', 'PUBLIC_TO_EVERYONE')
            privacy = want if want in options else ('SELF_ONLY' if 'SELF_ONLY' in options else (options[0] if options else 'SELF_ONLY'))
            body = {
                'post_info': {
                    'title': meta['tiktok']['title'][:2200], 'privacy_level': privacy,
                    'disable_comment': bool(d.get('comment_disabled')), 'disable_duet': bool(d.get('duet_disabled')),
                    'disable_stitch': bool(d.get('stitch_disabled')), 'video_cover_timestamp_ms': int(meta.get('_thumb_ms') or 1000),
                },
                'source_info': source,
            }
            st, code, j = _call(f'{API}/v2/post/publish/video/init/', token, body)
            if code == 'ok':
                _upload(j['data']['upload_url'], path, size, chunk, count)
                status, post_id = _wait(token, j['data']['publish_id'], draft=False)
                url = f'https://www.tiktok.com/@{tok.get("account_name", "")}/video/{post_id}' if post_id and privacy == 'PUBLIC_TO_EVERYONE' else None
                return {'remote_id': post_id or j['data']['publish_id'], 'remote_url': url, 'privacy': privacy,
                        'note': None if privacy == want else f'Sichtbarkeit {privacy} (gewünscht {want} – TikTok-Audit nötig)'}
            if mode == 'direct' or code not in FALLBACK_CODES:
                raise PublishError(f'TikTok Direct Post: {code} – {(j.get("error") or {}).get("message", "")}',
                                   retryable=code in ('rate_limit_exceeded', 'internal_error', 'spam_risk_too_many_pending_share'))
            note = f'Direct Post nicht freigegeben ({code}) – als Entwurf hochgeladen'
        elif mode == 'direct':
            raise PublishError(f'TikTok creator_info: {code}', retryable=code not in FALLBACK_CODES)
        else:
            note = f'Direct Post nicht verfügbar ({code}) – als Entwurf hochgeladen'

    st, code, j = _call(f'{API}/v2/post/publish/inbox/video/init/', token, {'source_info': source})
    if code != 'ok':
        raise PublishError(f'TikTok Entwurf: {code} – {(j.get("error") or {}).get("message", "")}',
                           retryable=code not in FALLBACK_CODES)
    _upload(j['data']['upload_url'], path, size, chunk, count)
    _wait(token, j['data']['publish_id'], draft=True)
    return {'remote_id': j['data']['publish_id'], 'remote_url': None, 'privacy': 'DRAFT',
            'note': note or 'Als Entwurf im TikTok-Posteingang – in der App veröffentlichen'}
