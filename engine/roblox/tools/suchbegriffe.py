"""Suchbegriff-Katalog aus TikTok „Creator Search Insights“ (Lukas, 22.11.2026).

Katalog: episodes/suchbegriffe.json – Suchbegriffe, nach denen auf TikTok gesucht wird
(Quelle: Creator Search Insights in der TikTok-App, v. a. Filter „Content gap“ = viel gesucht, wenig Videos).
Lukas schickt Screenshots → Begriffe hier eintragen. Die täglichen Läufe bauen ihre Idee um den besten
passenden Begriff und setzen ihn als erstes "meta.keywords".

  python tools/suchbegriffe.py add "lion vs tiger who wins" --series "VS BATTLE" --volume 234K --trend 1000% --gap
  python tools/suchbegriffe.py vorschlag --series "VS BATTLE"        # beste passende Begriffe (Content gap, unbenutzt, viel gesucht zuerst)
  python tools/suchbegriffe.py benutzt "lion vs tiger who wins" --file episodes/queue/x.json
  python tools/suchbegriffe.py check episodes/queue/x.json           # nutzt die Folge einen Katalog-Begriff?
  python tools/suchbegriffe.py liste

--series: Serienname wie in themen.json (WEIRD TOWNS, SCHOOL LIFE, VS BATTLE, TRENDING NOW, SURVIVAL, DARK STORIES)
oder ALLE. Mehrere mit Komma.
"""
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] if (Path(__file__).resolve().parents[3] / 'episodes').exists() else Path.cwd()
KAT = ROOT / 'episodes' / 'suchbegriffe.json'


def load():
    if KAT.exists():
        d = json.loads(KAT.read_text())
        return d if isinstance(d, dict) else {'begriffe': d}
    return {'info': 'TikTok Creator Search Insights – siehe engine/roblox/tools/suchbegriffe.py', 'begriffe': []}


def save(d):
    KAT.parent.mkdir(parents=True, exist_ok=True); KAT.write_text(json.dumps(d, ensure_ascii=False, indent=1) + '\n')


def norm(s):
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9äöüß ]+', ' ', (s or '').lower())).strip()


def zahl(v):
    """'234K' → 234000, '7.40M' → 7400000, '1000%+' → 1000."""
    m = re.match(r'\s*([\d.,]+)\s*([kKmMbB]?)', str(v or ''))
    if not m: return 0.0
    x = float(m.group(1).replace(',', '.')) if m.group(1).count(',') == 1 and '.' not in m.group(1) else float(m.group(1).replace(',', ''))
    return x * {'k': 1e3, 'm': 1e6, 'b': 1e9}.get(m.group(2).lower(), 1)


def series_of(x):
    return [s.strip().upper() for s in str(x or 'ALLE').split(',') if s.strip()]


def passt(b, serie):
    if not serie: return True
    want = re.sub(r'\s*#\d+$', '', serie).strip().upper()
    for s in b.get('series', ['ALLE']):
        if s == 'ALLE' or s in want or want in s: return True
    return False


def rang(b):
    return (not b.get('gap'), len(b.get('benutzt', [])), -zahl(b.get('volume')), -zahl(b.get('trend')), -int((b.get('datum') or '0').replace('-', '')))


def zeile(b):
    tags = [f"{b.get('volume')} Suchen" if b.get('volume') else '', f"Trend {b.get('trend')}" if b.get('trend') else '',
            'CONTENT GAP' if b.get('gap') else '', f"{len(b.get('benutzt', []))}× benutzt", ','.join(b.get('series', []))]
    return f"„{b['term']}“  – " + ' · '.join(t for t in tags if t)


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd', required=True)
    a = sp.add_parser('add'); a.add_argument('term'); a.add_argument('--series', default='ALLE'); a.add_argument('--volume', default='')
    a.add_argument('--trend', default=''); a.add_argument('--gap', action='store_true'); a.add_argument('--note', default='')
    v = sp.add_parser('vorschlag'); v.add_argument('--series', default=''); v.add_argument('-n', type=int, default=5)
    u = sp.add_parser('benutzt'); u.add_argument('term'); u.add_argument('--file', default='')
    c = sp.add_parser('check'); c.add_argument('episode'); c.add_argument('--strict', action='store_true')
    sp.add_parser('liste')
    x = ap.parse_args(); d = load(); bl = d.setdefault('begriffe', [])
    idx = {norm(b['term']): b for b in bl}

    if x.cmd == 'add':
        b = idx.get(norm(x.term))
        neu = b is None
        if neu: b = {'term': x.term.strip(), 'benutzt': []}; bl.append(b)
        b.update({'series': series_of(x.series), 'datum': dt.date.today().isoformat(), 'quelle': 'TikTok Creator Search Insights'})
        for k in ('volume', 'trend', 'note'):
            if getattr(x, k): b[k] = getattr(x, k)
        if x.gap: b['gap'] = True
        save(d); print(('neu: ' if neu else 'aktualisiert: ') + zeile(b))

    elif x.cmd == 'vorschlag':
        cand = sorted((b for b in bl if passt(b, x.series)), key=rang)[:x.n]
        if not cand:
            print('Keine Katalog-Begriffe für diese Serie – eigenes Suchwort wählen (so wie Leute tippen).'); return
        print('Suchbegriffe (bester zuerst) – Idee um einen davon bauen, wenn er zur Serie und zu den Regeln passt:')
        for b in cand: print('  ' + zeile(b))

    elif x.cmd == 'benutzt':
        b = idx.get(norm(x.term))
        if not b: print(f'„{x.term}“ steht nicht im Katalog – nichts eingetragen.'); return
        b.setdefault('benutzt', []).append({'datum': dt.date.today().isoformat(), 'file': x.file})
        save(d); print('eingetragen: ' + zeile(b))

    elif x.cmd == 'check':
        e = json.loads(Path(x.episode).read_text()); m = e.get('meta') or {}; serie = (e.get('viral') or {}).get('series', '')
        kws = m.get('keywords') or []
        kws = [k for k in (kws if isinstance(kws, list) else str(kws).split(','))]
        nk = [norm(k) for k in kws if norm(k)]
        hit = [b for b in bl if any(norm(b['term']) == k or norm(b['term']) in k or k in norm(b['term']) for k in nk)]
        pool = [b for b in bl if passt(b, serie)]
        if hit: print('✓ Suchbegriff aus dem Katalog: ' + ', '.join(f"„{b['term']}“" for b in hit)); return
        if not pool: print('– kein Katalog-Begriff für diese Serie vorhanden (ok)'); return
        print(f'⚠ meta.keywords {kws} nutzt keinen Katalog-Begriff. Passende: ' + '; '.join(f"„{b['term']}“" for b in sorted(pool, key=rang)[:3]))
        if x.strict: sys.exit(1)

    else:
        if not bl: print('Katalog leer.'); return
        for b in sorted(bl, key=rang): print(zeile(b))


if __name__ == '__main__':
    main()
