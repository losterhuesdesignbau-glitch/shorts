"""Mii Town – Figuren-Datenbank (episodes/figuren.json).

Jede Figur hat eine feste ID und ein festes Aussehen. Einmal angelegt, ändert sie sich nie wieder
(gleiche Figur = gleiches Gesicht, gleiche Frisur, gleiche Kleidung in jedem Video).

  python tools/figuren.py neu max --name Max --sex m --age kid            # neue Figur (Aussehen aus dem Namen, immer gleich)
  python tools/figuren.py neu mia --name Mia --sex w --age teen --role "best friend"
  python tools/figuren.py auto episodes/queue/x.json                      # fehlende Figuren aus dem Cast anlegen
  python tools/figuren.py liste
  python tools/figuren.py zeige max

In der episode.json:  "cast": {"max": {"char": "max"}}  oder kurz  "cast": {"max": "@max"}
Eigene Abweichungen für EINE Folge (z. B. Schlafanzug) gehen mit "outfit": {...}; Gesicht/Haare bleiben immer gleich.
Figuren-Einträge ohne Datenbank (z. B. Tiere {"animal": "dog"}) funktionieren weiter wie bisher.
"""
import argparse
import datetime as dt
import hashlib
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DB = ROOT / 'episodes' / 'figuren.json'

SKINS = ['#ffdbac', '#f5c79a', '#f1c27d', '#e0a878', '#c68642', '#a0663c', '#8d5524', '#6b3e26']
HAIRC = ['#1b1b1b', '#2b1b12', '#4a2e1a', '#6d4c41', '#8b5a2b', '#b5523b', '#d4a017', '#e2c17c', '#c9c9c9']
EYEC = ['#5b3a21', '#3b2a1a', '#2e6db4', '#3f8f5a', '#6c757d', '#7b4a2e', '#4a90c2', '#2f2f2f']
SHIRTS = ['#e63946', '#1e88e5', '#2a9d8f', '#ffb703', '#9b5de5', '#f15bb5', '#00bbf9', '#fb8500', '#06d6a0', '#ef476f', '#118ab2', '#ffd166', '#8ac926', '#ff595e']
PANTS = ['#22355e', '#2b2b2b', '#3d405b', '#264653', '#5c4033', '#1d3557', '#6c757d', '#355070']
SHOES = ['#ffffff', '#e63946', '#1e88e5', '#2b2b2b', '#ffb703', '#5c4033', '#06d6a0']
HAIR_M = ['short', 'spiky', 'side', 'messy', 'buzz', 'curly', 'afro', 'mohawk']
HAIR_W = ['long', 'ponytail', 'bob', 'bun', 'pigtails', 'curly', 'afro', 'side']
FACES = ['round', 'oval', 'square', 'wide', 'long']
NOSES = ['button', 'round', 'long', 'wide', 'small']
EYES = ['round', 'oval', 'almond', 'big', 'narrow']
BROWS = ['thin', 'flat', 'arched', 'thick', 'bushy']


def load():
    return json.loads(DB.read_text()) if DB.exists() else {}


def save(d):
    DB.write_text(json.dumps(d, ensure_ascii=False, indent=1) + '\n')


def generate(cid, name=None, sex=None, age='adult', role=''):
    """Aussehen deterministisch aus der ID: gleiche ID -> immer exakt dieselbe Figur."""
    R = random.Random(int(hashlib.sha1(cid.lower().encode()).hexdigest()[:12], 16))
    sex = sex or R.choice('mw')
    w = sex.startswith(('w', 'f'))
    hair = R.choice(HAIR_W if w else HAIR_M)
    if age == 'senior': hair = R.choice(['bun', 'short', 'side', 'bald'] if not w else ['bun', 'bob', 'short'])
    hc = R.choice(HAIRC[:-1]) if age != 'senior' else R.choice(['#c9c9c9', '#e0e0e0', '#9e9e9e'])
    c = {
        'style': 'mii', 'name': name or cid.capitalize(), 'sex': 'w' if w else 'm', 'age': age, 'role': role,
        'skin': R.choice(SKINS), 'hair': hair, 'hairColor': hc, 'eyeColor': R.choice(EYEC),
        'face': R.choice(FACES), 'nose': R.choice(NOSES), 'ears': R.choice(['normal', 'normal', 'small', 'big']),
        'facekit': {'eye': R.choice(EYES), 'es': round(R.uniform(0.9, 1.15), 2), 'edx': R.randint(-4, 5), 'ey': R.randint(-4, 4),
                    'brow': R.choice(BROWS), 'browColor': hc if hc not in ('#e2c17c', '#d4a017') else '#6d4c41', 'my': R.randint(-3, 4),
                    'cheeks': R.random() < 0.4},
        'shirt': R.choice(SHIRTS), 'pants': R.choice(PANTS), 'shoes': R.choice(SHOES), 'logo': 'none',
        'headScale': round({'kid': 1.55, 'teen': 1.48, 'adult': 1.42, 'senior': 1.4}.get(age, 1.45), 2),
    }
    if age == 'kid': c['scale'] = 0.82
    elif age == 'teen': c['scale'] = 0.92
    elif age == 'senior': c['scale'] = 0.94
    if w: c['lashes'] = True
    r = R.random()
    if r < 0.22: c['glasses'] = True
    elif r < 0.3 and not w: c['beard'] = age in ('adult', 'senior')
    r = R.random()
    if r < 0.25: c['hoodie'] = True
    elif r < 0.4 and age in ('adult', 'senior'): c['jacket'] = R.choice(PANTS)
    elif r < 0.5: c['pattern'] = R.choice(['stripes', 'plaid'])
    if c.get('pattern'): c['patternColor'] = '#ffffff' if c['pattern'] == 'stripes' else R.choice(PANTS)
    if R.random() < 0.15 and hair not in ('bun', 'ponytail', 'pigtails', 'afro'): c['hair'] = R.choice(['cap', 'beanie']); c['hatColor'] = R.choice(SHIRTS)
    if age == 'kid' and R.random() < 0.5: c['backpack'] = R.choice(SHIRTS)
    if R.random() < 0.2: c['freckles'] = True
    c['created'] = dt.date.today().isoformat()
    return c


def resolve_cast(cast, db=None):
    """Für die Engine: {"max": {"char": "max", "outfit": {...}}} / "@max" -> vollständige Figur aus der Datenbank."""
    db = load() if db is None else db
    out, missing = {}, []
    for k, v in (cast or {}).items():
        ref = v[1:] if isinstance(v, str) and v.startswith('@') else (v.get('char') if isinstance(v, dict) else None)
        if not ref: out[k] = v; continue
        if ref not in db: missing.append(ref); out[k] = v; continue
        c = {kk: vv for kk, vv in db[ref].items() if kk not in ('name', 'sex', 'age', 'role', 'created')}
        if isinstance(v, dict):
            for kk, vv in (v.get('outfit') or {}).items():
                if kk not in ('skin', 'face', 'nose', 'ears', 'facekit', 'eyeColor', 'headScale', 'style', 'hairColor'): c[kk] = vv
        out[k] = c
    return out, missing


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd', required=True)
    a = sp.add_parser('neu'); a.add_argument('id'); a.add_argument('--name'); a.add_argument('--sex'); a.add_argument('--age', default='adult', choices=['kid', 'teen', 'adult', 'senior']); a.add_argument('--role', default='')
    b = sp.add_parser('auto'); b.add_argument('episode')
    z = sp.add_parser('zeige'); z.add_argument('id')
    sp.add_parser('liste')
    x = ap.parse_args(); db = load()
    if x.cmd == 'neu':
        cid = x.id.lower()
        if cid in db: print(f'{cid} gibt es schon – Aussehen bleibt unverändert.'); return
        db[cid] = generate(cid, x.name, x.sex, x.age, x.role); save(db); print(f'neu: {cid} ({db[cid]["name"]}, {db[cid]["sex"]}, {db[cid]["age"]})')
    elif x.cmd == 'auto':
        e = json.loads(Path(x.episode).read_text()); n = 0
        for k, v in (e.get('cast') or {}).items():
            ref = v[1:] if isinstance(v, str) and v.startswith('@') else (v.get('char') if isinstance(v, dict) else None)
            if ref and ref not in db:
                hint = v if isinstance(v, dict) else {}
                db[ref] = generate(ref, hint.get('name'), hint.get('sex'), hint.get('age', 'adult'), hint.get('role', '')); n += 1
                print(f'neu: {ref}')
            elif ref: print(f'vorhanden: {ref} ({db[ref]["name"]})')
        if n: save(db)
    elif x.cmd == 'zeige':
        print(json.dumps(db.get(x.id.lower(), {}), ensure_ascii=False, indent=1))
    else:
        for k, v in db.items(): print(f'{k}: {v["name"]} · {v["sex"]} · {v["age"]} · {v.get("role", "")} · seit {v.get("created")}')


if __name__ == '__main__':
    main()
