"""Lokale Nachbildung der externen Dienste für Tests (keine echten Konten nötig):

- YouTube Data API (resumable Upload) – verhält sich wie ein nicht geprüftes Projekt (Upload landet 'private')
- Instagram API (Container -> rupload -> Status -> media_publish)
- TikTok Content Posting API – wie eine nicht auditierte App: Direct Post abgelehnt -> Entwurf
- GitHub repository_dispatch – führt die Workflow-Befehle (render/publish) lokal aus, wie GitHub Actions

Fehler-Injektion: MockCloud.fail_once = {'tiktok'} lässt den ersten TikTok-Upload mit 500 scheitern.
"""
import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


class MockCloud:
    def __init__(self, port=0, run_dispatch=False, env=None):
        self.uploads = {'youtube': [], 'instagram': [], 'tiktok': []}
        self.dispatches = []
        self.fail_once = set()
        self.run_dispatch = run_dispatch
        self.child_env = env or {}
        self.jobs = []
        self.lock = threading.Lock()
        mc = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _body(self):
                n = int(self.headers.get('content-length') or 0)
                return self.rfile.read(n) if n else b''

            def _json(self, code, obj, headers=None):
                b = json.dumps(obj).encode()
                self.send_response(code)
                self.send_header('content-type', 'application/json')
                self.send_header('content-length', str(len(b)))
                for k, v in (headers or {}).items():
                    self.send_header(k, v)
                self.end_headers()
                self.wfile.write(b)

            def do_GET(self):
                mc.handle(self, 'GET')

            def do_POST(self):
                mc.handle(self, 'POST')

            def do_PUT(self):
                mc.handle(self, 'PUT')

        self.srv = ThreadingHTTPServer(('127.0.0.1', port), H)
        self.port = self.srv.server_address[1]
        self.base = f'http://127.0.0.1:{self.port}'
        self.t = threading.Thread(target=self.srv.serve_forever, daemon=True)

    def start(self):
        self.t.start()
        return self

    def stop(self):
        self.srv.shutdown()

    def env(self):
        return {'YT_API_BASE': self.base, 'IG_GRAPH_BASE': self.base, 'IG_UPLOAD_BASE': self.base,
                'TIKTOK_API_BASE': self.base, 'IG_POLL_SECONDS': '0.1', 'TIKTOK_POLL_SECONDS': '0.1'}

    # ------------------------------------------------------------------
    def handle(self, h, method):
        u = urlparse(h.path)
        p, q = u.path, parse_qs(u.query)
        body = h._body()

        # ---- GitHub ----
        if p.startswith('/repos/') and p.endswith('/dispatches'):
            d = json.loads(body)
            with self.lock:
                self.dispatches.append(d)
            h.send_response(204); h.end_headers()
            if self.run_dispatch:
                threading.Thread(target=self.run_job, args=(d,), daemon=True).start()
            return

        # ---- YouTube ----
        if p == '/upload/youtube/v3/videos' and method == 'POST':
            meta = json.loads(body)
            sid = f'yt{len(self.uploads["youtube"]) + 1}'
            self._yt = getattr(self, '_yt', {})
            self._yt[sid] = {'meta': meta, 'size': int(h.headers['x-upload-content-length']), 'got': 0}
            return h._json(200, {}, {'location': f'{self.base}/yt-session/{sid}'})
        if p.startswith('/yt-session/') and method == 'PUT':
            sid = p.rsplit('/', 1)[1]
            s = self._yt[sid]
            s['got'] += len(body)
            if s['got'] < s['size']:
                h.send_response(308); h.send_header('range', f'bytes=0-{s["got"] - 1}'); h.end_headers(); return
            vid = 'YT' + sid
            self.uploads['youtube'].append({'id': vid, 'title': s['meta']['snippet']['title'], 'bytes': s['got'], 'tags': s['meta']['snippet']['tags']})
            return h._json(200, {'id': vid, 'status': {'privacyStatus': 'private'}})  # nicht geprüftes Projekt
        if p == '/youtube/v3/channels':
            return h._json(200, {'items': [{'contentDetails': {'relatedPlaylists': {'uploads': 'UU1'}}}]})
        if p == '/youtube/v3/playlistItems':
            return h._json(200, {'items': [{'contentDetails': {'videoId': u['id']}} for u in self.uploads['youtube']]})
        if p == '/youtube/v3/videos':
            ids = q.get('id', [''])[0].split(',')
            return h._json(200, {'items': [{'id': u['id'], 'snippet': {'tags': u['tags']}, 'status': {'privacyStatus': 'private'}}
                                           for u in self.uploads['youtube'] if u['id'] in ids]})

        # ---- Instagram ----
        parts = p.strip('/').split('/')
        if len(parts) >= 3 and parts[0].startswith('v') and parts[2] == 'content_publishing_limit':
            return h._json(200, {'data': [{'quota_usage': len(self.uploads['instagram']), 'config': {'quota_total': 100}}]})
        if len(parts) == 3 and parts[2] == 'media' and method == 'POST':
            if 'instagram' in self.fail_once:
                self.fail_once.discard('instagram')
                return h._json(400, {'error': {'message': 'simulierter Fehler: Konto vorübergehend gesperrt'}})
            f = parse_qs(body.decode())
            assert f['media_type'] == ['REELS'] and f['upload_type'] == ['resumable']
            cid = f'c{len(self.uploads["instagram"]) + 1}'
            self._ig = getattr(self, '_ig', {})
            self._ig[cid] = {'caption': f['caption'][0], 'bytes': 0}
            return h._json(200, {'id': cid})
        if p.startswith('/ig-api-upload/'):
            cid = parts[-1]
            assert h.headers.get('authorization', '').startswith('OAuth ')
            self._ig[cid]['bytes'] = len(body)
            return h._json(200, {'success': True})
        if len(parts) == 2 and parts[1].startswith('c') and method == 'GET':
            return h._json(200, {'status_code': 'FINISHED'})
        if len(parts) == 3 and parts[2] == 'media_publish':
            cid = parse_qs(body.decode())['creation_id'][0]
            mid = 'IG' + cid
            self.uploads['instagram'].append({'id': mid, 'caption': self._ig[cid]['caption'], 'bytes': self._ig[cid]['bytes']})
            return h._json(200, {'id': mid})
        if len(parts) == 2 and parts[1].startswith('IG'):
            return h._json(200, {'permalink': f'https://www.instagram.com/reel/{parts[1]}/'})

        # ---- TikTok (nicht auditierte App) ----
        if p == '/v2/post/publish/creator_info/query/':
            return h._json(200, {'data': {'privacy_level_options': ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'], 'max_video_post_duration_sec': 600},
                                 'error': {'code': 'ok'}})
        if p == '/v2/post/publish/video/init/':
            if 'tiktok' in self.fail_once:
                self.fail_once.discard('tiktok')
                return h._json(500, {'error': {'code': 'internal_error', 'message': 'simulierter Ausfall'}})
            return h._json(403, {'error': {'code': 'unaudited_client_can_only_post_to_private_accounts', 'message': 'unaudited'}})
        if p == '/v2/post/publish/inbox/video/init/':
            src = json.loads(body)['source_info']
            n = len(self.uploads['tiktok']) + 1
            self._tt = getattr(self, '_tt', {})
            self._tt[f'tt{n}'] = {'size': src['video_size'], 'got': 0}
            return h._json(200, {'data': {'publish_id': f'tt{n}', 'upload_url': f'{self.base}/tt-upload/tt{n}'}, 'error': {'code': 'ok'}})
        if p.startswith('/tt-upload/'):
            pid = parts[-1]
            self._tt[pid]['got'] += len(body)
            if self._tt[pid]['got'] == self._tt[pid]['size']:
                self.uploads['tiktok'].append({'id': pid, 'bytes': self._tt[pid]['got']})
            return h._json(201, {})
        if p == '/v2/post/publish/status/fetch/':
            return h._json(200, {'data': {'status': 'SEND_TO_USER_INBOX'}, 'error': {'code': 'ok'}})

        return h._json(404, {'error': f'mock: {method} {p}'})

    # Ein "GitHub-Actions-Runner": führt dieselben Befehle aus wie die Workflows
    def run_job(self, d):
        env = {**os.environ, **self.env(), **self.child_env, 'PYTHONPATH': ROOT, 'GITHUB_RUN_ID': str(len(self.jobs) + 1)}
        if d['event_type'] == 'vf-publish':
            cmd = [sys.executable, '-m', 'vf.publish', '--ids', ','.join(d['client_payload']['ids'])]
        elif d['event_type'] == 'vf-render':
            cmd = [sys.executable, '-m', 'vf.render_job', '--episode-id', d['client_payload']['episode_id']]
        else:
            return
        r = subprocess.run(cmd, env=env, capture_output=True, text=True)
        with self.lock:
            self.jobs.append({'event': d['event_type'], 'rc': r.returncode, 'out': r.stdout[-3000:], 'err': r.stderr[-3000:]})


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    extra = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    mc = MockCloud(port, run_dispatch=True, env=extra).start()
    if os.environ.get('FAIL_ONCE'):
        mc.fail_once = set(os.environ['FAIL_ONCE'].split(','))
    print('mock cloud on', mc.base, flush=True)
    import time
    while True:
        time.sleep(1)
        state = {'uploads': {k: len(v) for k, v in mc.uploads.items()}, 'dispatches': len(mc.dispatches), 'jobs': mc.jobs}
        with open(os.environ.get('MOCK_STATE', '/tmp/mock_state.json'), 'w') as f:
            json.dump({**state, 'detail': mc.uploads}, f, indent=1)
