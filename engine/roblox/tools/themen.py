"""Themen-Register gegen Wiederholungen (Engine-Regel 1).

Register: episodes/themen.json – jede produzierte Folge mit Serie, Titel, Thema, Hook, Handlung, Twist.

  python tools/themen.py sync                         # fehlende Folgen aus episodes/queue + episodes/done nachtragen
  python tools/themen.py check "Idee: Thema, Hook, Handlung, Twist"   # Ähnlichkeit zu allen bisherigen Folgen
  python tools/themen.py add --series "DARK STORIES" --title "…" --topic "…" --hook "…" --plot "…" --twist "…" --file episodes/queue/x.json

check gibt die ähnlichsten Folgen aus und endet mit Code 1, wenn die Idee zu ähnlich ist (Ähnlichkeit ≥ 0.2) –
dann Idee verwerfen und eine komplett neue finden (nicht nur Namen/Orte tauschen).
"""
import argparse
import datetime as dt
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] if (Path(__file__).resolve().parents[3] / 'episodes').exists() else Path.cwd()
REG = ROOT / 'episodes' / 'themen.json'
STOP = set('the a an and or of to in on at for with is are was were be it this that you your i we they he she his her their our my me not no yes do did does from by as but so if then than just very can will would could into over about what who how why when where there here one two all any each more most some such only own same too s t don now get got like make made'.split())
THRESH = 0.2


def toks(s):
    w = [x for x in re.findall(r"[a-zäöüß]+", (s or '').lower()) if len(x) > 2 and x not in STOP]
    return w + [a + '_' + b for a, b in zip(w, w[1:])]  # Wortpaare erkennen gleiche Handlungen besser


def text_of(e):
    return ' '.join(str(e.get(k, '')) for k in ('title', 'topic', 'hook', 'plot', 'twist'))


def load():
    return json.loads(REG.read_text()) if REG.exists() else []


def save(reg):
    REG.parent.mkdir(parents=True, exist_ok=True); REG.write_text(json.dumps(reg, ensure_ascii=False, indent=1))


def sim(a, b, df, n):
    ca, cb = Counter(toks(a)), Counter(toks(b))
    w = lambda t: math.log((n + 1) / (df.get(t, 0) + 1)) + 1
    num = sum(ca[t] * cb[t] * w(t) ** 2 for t in ca if t in cb)
    da = math.sqrt(sum((c * w(t)) ** 2 for t, c in ca.items())); db = math.sqrt(sum((c * w(t)) ** 2 for t, c in cb.items()))
    return num / (da * db + 1e-9)


def from_episode(p):
    e = json.loads(Path(p).read_text()); m = e.get('meta') or {}; v = e.get('viral') or {}
    says = ' '.join(s.get('say', '') for s in e.get('shots', []))
    return {'date': dt.date.today().isoformat(), 'series': re.sub(r'\s*#\d+$', '', v.get('series', '')), 'title': m.get('title') or e.get('title', ''),
            'topic': m.get('description', ''), 'hook': (v.get('hook') or '').replace('\n', ' '), 'plot': re.sub(r'\*', '', says)[:900], 'twist': '', 'file': str(p)}


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd', required=True)
    sp.add_parser('sync')
    c = sp.add_parser('check'); c.add_argument('idea')
    a = sp.add_parser('add')
    for k in ('series', 'title', 'topic', 'hook', 'plot', 'twist', 'file'): a.add_argument('--' + k, default='')
    x = ap.parse_args(); reg = load()
    if x.cmd == 'sync':
        have = {r.get('file') for r in reg}; n0 = len(reg)
        for d in ('done', 'queue'):
            for p in sorted((ROOT / 'episodes' / d).glob('*.json')):
                rel = str(p.relative_to(ROOT)); alt = rel.replace('/done/', '/queue/') if '/done/' in rel else rel.replace('/queue/', '/done/')
                if rel in have or alt in have: continue
                if not (json.loads(p.read_text()).get('shots')): continue
                e = from_episode(p); e['file'] = rel; reg.append(e)
        save(reg); print(f'Register: {len(reg)} Folgen (+{len(reg) - n0})')
    elif x.cmd == 'add':
        reg.append({'date': dt.date.today().isoformat(), **{k: getattr(x, k) for k in ('series', 'title', 'topic', 'hook', 'plot', 'twist', 'file')}})
        save(reg); print(f'eingetragen ({len(reg)} Folgen)')
    else:
        docs = [text_of(r) for r in reg]; n = len(docs); df = Counter(t for d in docs for t in set(toks(d)))
        sc = sorted(((sim(x.idea, d, df, n), r) for d, r in zip(docs, reg)), key=lambda q: -q[0])[:5]
        for s_, r in sc: print(f'{s_:.2f}  [{r.get("series")}] {r.get("title")}')
        top = sc[0][0] if sc else 0
        if top >= THRESH: print(f'ZU ÄHNLICH ({top:.2f} ≥ {THRESH}) – Idee verwerfen, komplett neue Idee finden.'); sys.exit(1)
        print(f'OK – neue Idee (max. Ähnlichkeit {top:.2f})')


if __name__ == '__main__':
    main()
