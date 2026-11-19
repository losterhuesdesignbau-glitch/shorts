"""Sendezeiten des Orchestrators setzen:  python -m vf.settings --slots "08:00,14:00,16:00,19:00" """
import argparse

from .client import Orchestrator


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--slots', required=True)
    a = ap.parse_args()
    r = Orchestrator().call('POST', '/api/engine/settings/slots', {'slots': [x.strip() for x in a.slots.split(',') if x.strip()]})
    print('Sendezeiten:', r.get('slots'))


if __name__ == '__main__':
    main()
