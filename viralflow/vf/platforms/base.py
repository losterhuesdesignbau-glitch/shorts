import time

import requests


class PublishError(Exception):
    """retryable=False: Wiederholen bringt nichts (z. B. fehlende Berechtigung) -> sofort 'failed'."""

    def __init__(self, message, retryable=True):
        super().__init__(message)
        self.retryable = retryable


def http(method, url, retries=3, ok=(200, 201, 202, 204, 308), **kw):
    """HTTP mit Wiederholung bei Netzwerkfehlern, 429 und 5xx."""
    delay = 4
    kw.setdefault('timeout', 120)
    for attempt in range(retries + 1):
        try:
            r = requests.request(method, url, **kw)
        except requests.RequestException as e:
            if attempt == retries:
                raise PublishError(f'Netzwerkfehler: {e}')
            time.sleep(delay); delay *= 2
            continue
        if r.status_code in (429, 500, 502, 503, 504) and attempt < retries:
            wait = float(r.headers.get('retry-after', delay)) if r.headers.get('retry-after', '').isdigit() else delay
            time.sleep(min(wait, 120)); delay *= 2
            continue
        return r
    return r


def err_text(r):
    try:
        j = r.json()
    except ValueError:
        return f'HTTP {r.status_code}: {r.text[:300]}'
    e = j.get('error', j)
    if isinstance(e, dict):
        return f'HTTP {r.status_code}: {e.get("message") or e.get("error_user_msg") or e.get("code") or e}'
    return f'HTTP {r.status_code}: {str(e)[:300]}'
