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

SKINS = ['#ffe4cc', '#f6d2b4', '#ecc3a0', '#ddb08c', '#c99a78', '#a97a5c', '#865c44', '#5e4130']   # weich, wenig gesättigt
HAIRC = ['#1b1b1b', '#2b1b12', '#4a2e1a', '#6d4c41', '#8b5a2b', '#b5523b', '#d4a017', '#e2c17c']
GREY = ['#c9c9c9', '#e0e0e0', '#9e9e9e', '#f2f2f2']
EYEC = ['#3b2416', '#2f2f2f', '#2e6db4', '#3f8f5a', '#6c757d', '#7b4a2e', '#4a90c2']
SHIRTS = ['#e63946', '#fb8500', '#ffd166', '#8ac926', '#2a9d8f', '#1e88e5', '#00bbf9', '#f15bb5', '#9b5de5', '#8d6e63', '#f5f5f5', '#2b2b2b', '#06d6a0', '#ff595e']
PANTS = ['#22355e', '#2b2b2b', '#3d405b', '#264653', '#5c4033', '#1d3557', '#6c757d', '#355070']
FACES = ['egg', 'round', 'oval', 'square', 'wide', 'long', 'heart', 'pear', 'bean']
NOSES = ['button', 'round', 'long', 'wide', 'small', 'pointy', 'big']
EYES = ['round', 'oval', 'almond', 'big', 'narrow']
BROWS = ['thin', 'flat', 'arched', 'thick', 'bushy']

# Charakter-Typen (Lukas 26.11.): Körperbau, Kleidung, Accessoires, Frisur-Tendenzen, typische Mimik
KINDS = {
    'nerd':        dict(build=['slim', 'average'], glasses=1.0, vest=0.6, shirt=['#f5f5f5', '#8ecae6', '#ffd166'], hairM=['side', 'short'], hairW=['bob', 'ponytail'], mood='smile', traits='smart, nervous laugh, knows every fact'),
    'athlete':     dict(build=['athletic'], headband=0.6, sleeves='short', shorts=0.6, shirt=['#e63946', '#1e88e5', '#ffd166', '#06d6a0'], shoes=['#ffffff'], hairM=['buzz', 'short', 'spiky'], hairW=['ponytail'], mood='determined', traits='competitive, energetic, never sits still'),
    'business':    dict(build=['average', 'slim', 'stocky'], jacket=['#2b2b2b', '#22355e', '#5f6b7a'], tie=0.8, shirt=['#f5f5f5', '#bde0fe'], pants=['#2b2b2b', '#22355e'], shoes=['#2b2b2b', '#5c4033'], hairM=['side', 'short'], hairW=['bob', 'bun'], mood='confident', traits='serious, always on the phone, secretly funny'),
    'student':     dict(build=['slim', 'average'], backpack=0.8, hoodie=0.3, hairM=['short', 'messy', 'side'], hairW=['long', 'ponytail', 'pigtails'], mood='happy', traits='curious, a bit lazy, loves snacks'),
    'gamer':       dict(build=['slim', 'chubby', 'average'], headphones=0.9, hoodie=0.7, shirt=['#2b2b2b', '#9b5de5', '#2a9d8f'], hairM=['messy', 'spiky'], hairW=['long', 'bob'], mood='smug', traits='competitive, night owl, talks in gamer slang'),
    'musician':    dict(build=['slim', 'average'], jacket=['#2b2b2b', '#5c4033'], earrings=0.5, shades=0.3, hairM=['long', 'messy', 'spiky'], hairW=['long', 'side'], mood='cool', traits='chill, creative, always humming'),
    'troublemaker': dict(build=['slim', 'average'], cap=0.7, shirt=['#e63946', '#fb8500', '#2b2b2b'], hairM=['spiky', 'messy'], hairW=['side', 'ponytail'], mood='evil', traits='mischievous, loud, pranks everyone'),
    'shy':         dict(build=['slim'], hoodie=0.7, shirt=['#bde0fe', '#cdb4db', '#b7e4c7', '#8d6e63'], hairM=['side', 'long'], hairW=['long', 'bob'], mood='nervous', traits='quiet, kind, blushes easily'),
    'extrovert':   dict(build=['average', 'athletic'], shades=0.4, bowtie=0.15, shirt=['#f15bb5', '#ffd166', '#00bbf9', '#fb8500'], hairM=['spiky', 'side'], hairW=['long', 'pigtails', 'ponytail'], mood='excited', traits='loud, funny, life of the party'),
    'senior':      dict(age='senior', build=['stocky', 'chubby', 'slim'], glasses=0.6, jacket=['#d4a373', '#a3b18a', '#cdb4db'], shirt=['#f5f5f5', '#e9edc9'], hairM=['short', 'side', 'bald'], hairW=['bun', 'bob', 'short'], beard=0.4, mood='smile', traits='wise, slow, surprisingly savage'),
    'chef':        dict(build=['chubby', 'stocky'], hat='chef', apron=1.0, shirt=['#f5f5f5'], hairM=['short'], hairW=['bun'], mustache=0.5, mood='happy', traits='loud, passionate about food'),
    'artist':      dict(build=['slim', 'average'], hat='beret', scarf=0.7, shirt=['#ffadad', '#ffd6a5', '#cdb4db', '#9bf6ff'], hairM=['long', 'messy'], hairW=['bob', 'bun', 'long'], mood='think', traits='dreamy, messy, sees art everywhere'),
    'scientist':   dict(build=['slim', 'average'], glasses=0.9, jacket=['#f5f5f5'], shirt=['#8ecae6', '#e9edc9'], hairM=['messy', 'side', 'bald'], hairW=['bun', 'bob'], mood='think', traits='genius, forgetful, explodes things'),
    'teacher':     dict(build=['average', 'stocky'], glasses=0.6, jacket=['#a3b18a', '#d4a373', '#5f6b7a'], shirt=['#f5f5f5', '#e9edc9'], hairM=['side', 'short'], hairW=['bun', 'bob'], mood='neutral', traits='strict, loves rules, secretly proud'),
    'farmer':      dict(build=['stocky', 'athletic'], hat='cowboy', vest=0.7, shirt=['#e63946', '#2a9d8f'], pants=['#355070'], hairM=['short'], hairW=['pigtails', 'ponytail'], beard=0.4, mood='happy', traits='hardworking, early riser, talks to animals'),
    'influencer':  dict(build=['slim', 'average'], shades=0.6, earrings=0.6, shirt=['#f15bb5', '#ffffff', '#ffd166'], hairM=['side', 'spiky'], hairW=['long', 'ponytail'], mood='grin', traits='always filming, says "guys" a lot'),
    'skater':      dict(build=['slim'], cap=0.5, hoodie=0.5, shorts=0.6, shirt=['#2b2b2b', '#fb8500', '#00bbf9'], hairM=['messy', 'long'], hairW=['side', 'long'], mood='cool', traits='relaxed, daring, falls a lot'),
    'gymbro':      dict(build=['stocky', 'athletic'], sleeves='skin', shirt=['#2b2b2b', '#6c757d', '#e63946'], hairM=['buzz', 'short'], hairW=['ponytail'], mood='confident', traits='flexes, drinks protein, very supportive'),
    'kid':         dict(age='kid', build=['average', 'slim', 'chubby'], backpack=0.4, shirt=SHIRTS, hairM=['short', 'messy', 'spiky', 'curly'], hairW=['pigtails', 'ponytail', 'bob'], mood='excited', traits='hyper, asks "why" all the time'),
    'everyday':    dict(build=['slim', 'average', 'stocky', 'chubby'], shirt=SHIRTS, hairM=['short', 'side', 'messy', 'buzz', 'curly', 'spiky'], hairW=['long', 'ponytail', 'bob', 'bun', 'side', 'curly'], mood='happy', traits='normal Mii Town neighbor'),
}


def load():
    return json.loads(DB.read_text()) if DB.exists() else {}


def save(d):
    DB.write_text(json.dumps(d, ensure_ascii=False, indent=1) + '\n')


def generate(cid, name=None, sex=None, age='adult', role='', kind=None):
    """Aussehen deterministisch aus der ID (+ Typ): gleiche ID -> immer exakt dieselbe Figur. Jede Figur bekommt eigene
    Kopfform, Gesichtszüge, Körperbau, Größe, Frisur und Kleidung (nicht nur andere Haarfarbe auf gleichem Modell)."""
    R = random.Random(int(hashlib.sha1(cid.lower().encode()).hexdigest()[:12], 16))
    K = KINDS.get(kind or '', None) or KINDS['kid' if age == 'kid' else 'senior' if age == 'senior' else 'everyday']
    kind = kind or ('kid' if age == 'kid' else 'senior' if age == 'senior' else 'everyday')
    age = K.get('age', age)
    sex = sex or R.choice('mw'); w = sex.startswith(('w', 'f'))
    p = lambda k, d=0.0: R.random() < K.get(k, d)
    hair = R.choice(K.get('hairW' if w else 'hairM') or (['long'] if w else ['short']))
    hc = R.choice(GREY) if age == 'senior' else R.choice(HAIRC)
    build = R.choice(K.get('build', ['average']))
    c = {
        'style': 'mii', 'name': name or cid.capitalize(), 'sex': 'w' if w else 'm', 'age': age, 'role': role, 'kind': kind,
        'personality': K.get('traits', ''), 'mood': K.get('mood', 'happy'),
        'skin': R.choice(SKINS), 'hair': hair, 'hairColor': hc, 'eyeColor': R.choice(EYEC),
        'face': R.choice(FACES), 'nose': R.choice(NOSES), 'ears': R.choice(['normal', 'normal', 'small', 'big']), 'build': build,
        'facekit': {'eye': R.choice(EYES), 'es': round(R.uniform(0.85, 1.2), 2), 'edx': R.randint(-5, 6), 'ey': R.randint(-6, 6),
                    'brow': R.choice(BROWS if not w else ['thin', 'arched', 'flat']), 'browColor': hc if hc not in ('#e2c17c', '#d4a017') else '#6d4c41',
                    'my': R.randint(-4, 6), 'mw': round(R.uniform(0.8, 1.2), 2), 'cheeks': R.random() < 0.25},
        'shirt': R.choice(K.get('shirt', SHIRTS)), 'pants': R.choice(K.get('pants', PANTS)), 'shoes': R.choice(K.get('shoes', ['#2b2b2b', '#ffffff', '#5c4033', '#e63946', '#1e88e5'])), 'logo': 'none',
        'headScale': round({'kid': 1.5, 'teen': 1.44}.get(age, 1.38) * R.uniform(0.95, 1.06), 2),
        'scale': round({'kid': 0.74, 'teen': 0.88, 'senior': 0.9}.get(age, 1.0) * R.uniform(0.94, 1.08), 2),
    }
    if w: c['lashes'] = True
    if R.random() < 0.12: c['facekit']['mole'] = R.choice([-1, 1])
    if R.random() < 0.15 and age in ('kid', 'teen'): c['freckles'] = True
    if K.get('sleeves'): c['sleeves'] = K['sleeves']
    if p('glasses'): c['glasses'] = True; c['glassesColor'] = R.choice(['#2b2b2b', '#8b5a2b', '#1e88e5', '#e63946'])
    if p('shades'): c['shades'] = True
    if p('headphones'): c['headphones'] = R.choice(['#2b2d42', '#e63946', '#f5f5f5'])
    if p('hoodie'): c['hoodie'] = True
    if p('backpack'): c['backpack'] = R.choice(SHIRTS)
    if p('headband'): c['headband'] = R.choice(['#ffffff', '#e63946', '#1e88e5'])
    if p('earrings'): c['earrings'] = True
    if p('scarf'): c['scarf'] = R.choice(SHIRTS)
    if p('apron'): c['apron'] = '#ffffff'
    if p('bowtie'): c['bowtie'] = True
    if p('shorts'): c['shorts'] = True
    if p('tie') and 'jacket' in K: c['tie'] = R.choice(['#c0392b', '#1e88e5', '#2b2b2b'])
    if 'jacket' in K: c['jacket'] = R.choice(K['jacket'])
    elif p('vest'): c['vest'] = R.choice(['#8d6e63', '#a3b18a', '#22355e'])
    if K.get('hat'): c['hat'] = K['hat']; c['hatColor'] = R.choice(['#8b5a2b', '#2b2b2b', '#e63946', '#22355e'])
    if p('cap') and hair not in ('bun', 'ponytail', 'pigtails'): c['hair'] = 'cap'; c['hatColor'] = R.choice(SHIRTS)
    if not w and age in ('adult', 'senior'):
        if p('beard', 0.12): c['beard'] = True
        elif p('mustache', 0.1): c['mustache'] = True
    c['created'] = dt.date.today().isoformat()
    return c


def resolve_cast(cast, db=None):
    """Für die Engine: {"max": {"char": "max", "outfit": {...}}} / "@max" -> vollständige Figur aus der Datenbank."""
    db = load() if db is None else db
    out, missing = {}, []
    for k, v in (cast or {}).items():
        ref = v[1:] if isinstance(v, str) and v.startswith('@') else (v.get('char') if isinstance(v, dict) else None)
        if not ref: out[k] = v; continue
        if ref not in db:   # neue Figur aus dem Skript: deterministisch aus der id erzeugen (gleiche id = gleiches Aussehen, auch ohne Speichern)
            missing.append(ref); h = v if isinstance(v, dict) else {}
            src = generate(ref, h.get('name'), h.get('sex'), h.get('age', 'adult'), h.get('role', ''), h.get('kind'))
        else: src = db[ref]
        c = {kk: vv for kk, vv in src.items() if kk not in ('name', 'sex', 'age', 'role', 'created', 'kind', 'personality', 'mood')}
        if isinstance(v, dict):
            for kk, vv in (v.get('outfit') or {}).items():
                if kk not in ('skin', 'face', 'nose', 'ears', 'facekit', 'eyeColor', 'headScale', 'style', 'hairColor', 'build'): c[kk] = vv
        out[k] = c
    return out, missing


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd', required=True)
    a = sp.add_parser('neu'); a.add_argument('id'); a.add_argument('--name'); a.add_argument('--sex'); a.add_argument('--age', default='adult', choices=['kid', 'teen', 'adult', 'senior']); a.add_argument('--role', default=''); a.add_argument('--kind', default=None, choices=sorted(KINDS))
    b = sp.add_parser('auto'); b.add_argument('episode')
    z = sp.add_parser('zeige'); z.add_argument('id')
    sp.add_parser('liste')
    x = ap.parse_args(); db = load()
    if x.cmd == 'neu':
        cid = x.id.lower()
        if cid in db: print(f'{cid} gibt es schon – Aussehen bleibt unverändert.'); return
        db[cid] = generate(cid, x.name, x.sex, x.age, x.role, x.kind); save(db); print(f'neu: {cid} ({db[cid]["name"]}, {db[cid]["sex"]}, {db[cid]["age"]})')
    elif x.cmd == 'auto':
        e = json.loads(Path(x.episode).read_text()); n = 0
        for k, v in (e.get('cast') or {}).items():
            ref = v[1:] if isinstance(v, str) and v.startswith('@') else (v.get('char') if isinstance(v, dict) else None)
            if ref and ref not in db:
                hint = v if isinstance(v, dict) else {}
                db[ref] = generate(ref, hint.get('name'), hint.get('sex'), hint.get('age', 'adult'), hint.get('role', ''), hint.get('kind')); n += 1
                print(f'neu: {ref}')
            elif ref: print(f'vorhanden: {ref} ({db[ref]["name"]})')
        if n: save(db)
    elif x.cmd == 'zeige':
        print(json.dumps(db.get(x.id.lower(), {}), ensure_ascii=False, indent=1))
    else:
        for k, v in db.items(): print(f'{k}: {v["name"]} · {v["sex"]} · {v["age"]} · {v.get("role", "")} · seit {v.get("created")}')


if __name__ == '__main__':
    main()
