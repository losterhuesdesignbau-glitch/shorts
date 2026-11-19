"""Signierte Kommunikation mit dem Orchestrator (Cloudflare Worker).

Jede Anfrage trägt X-VF-Timestamp und X-VF-Signature = HMAC-SHA256(VF_WEBHOOK_SECRET, f"{ts}.{body}").
"""
import hashlib
import hmac
import json
import os
import time

import requests


class OrchestratorError(Exception):
    def __init__(self, status, message):
        super().__init__(f'{status}: {message}')
        self.status = status
        self.message = message


class Orchestrator:
    def __init__(self, base=None, secret=None, timeout=60):
        self.base = (base or os.environ['VF_API_URL']).rstrip('/')
        self.secret = secret or os.environ['VF_WEBHOOK_SECRET']
        self.timeout = timeout
        self.s = requests.Session()

    def _headers(self, body):
        ts = str(int(time.time()))
        sig = hmac.new(self.secret.encode(), f'{ts}.{body}'.encode(), hashlib.sha256).hexdigest()
        return {'content-type': 'application/json', 'x-vf-timestamp': ts, 'x-vf-signature': sig, 'user-agent': 'viralflow-runner'}

    def call(self, method, path, data=None, retries=4):
        body = json.dumps(data or {}, ensure_ascii=False) if method != 'GET' else ''
        delay = 3
        for attempt in range(retries + 1):
            try:
                r = self.s.request(method, self.base + path, data=body.encode('utf-8') if body else None,
                                   headers=self._headers(body), timeout=self.timeout)
            except requests.RequestException as e:
                if attempt == retries:
                    raise OrchestratorError(0, f'Orchestrator nicht erreichbar: {e}')
                time.sleep(delay); delay *= 2
                continue
            if r.status_code >= 500 and attempt < retries:
                time.sleep(delay); delay *= 2
                continue
            try:
                j = r.json()
            except ValueError:
                j = {'error': r.text[:300]}
            if r.status_code >= 400:
                raise OrchestratorError(r.status_code, j.get('error', r.text[:300]))
            return j

    # Kurzformen
    def video_ready(self, payload): return self.call('POST', '/api/events/video-ready', payload)
    def register_episode(self, **kw): return self.call('POST', '/api/engine/episodes/register', kw)
    def fetch_episode(self, eid): return self.call('POST', f'/api/engine/episodes/{eid}/fetch', {})
    def episode_status(self, eid, status, error=None): return self.call('POST', f'/api/engine/episodes/{eid}/status', {'status': status, 'error': error})
    def claim(self, pid, run_id): return self.call('POST', f'/api/engine/publications/{requests.utils.quote(pid, safe="")}/claim', {'run_id': run_id}, retries=2)
    def report(self, pid, **kw): return self.call('POST', f'/api/engine/publications/{requests.utils.quote(pid, safe="")}/report', kw, retries=6)
    def token(self, platform): return self.call('POST', f'/api/engine/token/{platform}', {})
    def log(self, type_, message, **kw):
        try:
            self.call('POST', '/api/engine/log', {'type': type_, 'message': message, **kw}, retries=1)
        except OrchestratorError:
            pass
