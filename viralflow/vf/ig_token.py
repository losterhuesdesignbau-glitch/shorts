"""Instagram-Token (Secret INSTAGRAM_ACCESS_TOKEN) in den Orchestrator übernehmen:  python -m vf.ig_token"""
import os

from .client import Orchestrator


def main():
    tok = os.environ.get('INSTAGRAM_ACCESS_TOKEN', '').strip()
    if not tok:
        raise SystemExit('Secret INSTAGRAM_ACCESS_TOKEN fehlt')
    r = Orchestrator().call('POST', '/api/engine/token/instagram/import', {'access_token': tok})
    print('Instagram verbunden:', r.get('account'), r.get('account_id'))


if __name__ == '__main__':
    main()
