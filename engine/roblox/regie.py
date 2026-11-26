"""regie.py – Szenen-Kontrolle ("Regisseur") + Physik-Kontrolle VOR dem Rendern.

Zwei Stufen, beide prüfen UND korrigieren automatisch (deterministisch -> alle Render-Teile in CI bekommen dieselben Korrekturen):

1) inhalt(src)   – Logik der Geschichte am Episoden-JSON:
   Besetzung vorhanden, Tier-Regel (Tiere nur als Tier-Modelle), Tier-Aktionen, Mimik passend zum Text,
   Tageszeit passend zum Text, Requisiten passend zum Ort, Hook der ersten 2 Sekunden.
2) physik(eng, ep) – Geometrie mit der echten Engine (engine/check.js, gleiche Kamera/Positionen wie beim Rendern):
   Figuren ineinander, in Wänden/Möbeln, schwebend, Hauptfigur nicht/angeschnitten im Bild, Kamera in Figur/Wand.

Abschalten pro Episode: "regie": false. Bericht wird ausgegeben; mit "regie": "strict" bricht ein Fehler ab.
"""
import json
import re

# ---------------------------------------------------------------- Wortlisten
ANIMAL_WORDS = {
    'dog': 'dog', 'dogs': 'dog', 'puppy': 'dog', 'cat': 'cat', 'cats': 'cat', 'kitten': 'cat', 'fox': 'fox', 'lion': 'lion', 'lions': 'lion',
    'tiger': 'tiger', 'tigers': 'tiger', 'pig': 'pig', 'bear': 'bear', 'sheep': 'sheep', 'cow': 'cow', 'penguin': 'penguin', 'penguins': 'penguin',
    'frog': 'frog', 'chicken': 'chicken', 'hen': 'chicken', 'crocodile': 'croc', 'croc': 'croc', 'shark': 'shark', 'sharks': 'shark',
    'guinea pig': 'guineapig', 'ostrich': None, 'elephant': None, 'wolf': None, 'horse': None, 'monkey': None, 'gorilla': None, 'eagle': None,
    'owl': None, 'snake': None, 'rabbit': None, 'bunny': None, 'mouse': None, 'duck': None, 'whale': None, 'dolphin': None, 'giraffe': None,
    'zebra': None, 'hippo': None, 'rhino': None, 'kangaroo': None, 'panda': None, 'koala': None, 'deer': None, 'cheetah': None, 'leopard': None,
    'jaguar': None, 'hyena': None, 'octopus': None, 'spider': None, 'bee': None, 'ant': None, 'parrot': None, 'turtle': None, 'hamster': None,
}
# Aktionen, die Tier-Modelle können (director.js: apose); alles andere wird übersetzt
ANIMAL_ACTS = {'idle', 'walk', 'run', 'hop', 'jump', 'cheer', 'sit', 'sleep', 'lie', 'float', 'spin', 'talk', 'nod', 'look', 'wave', 'clap', 'scared', 'dance', 'sniff', 'sad'}
ANIMAL_MAP = {'point': 'look', 'pointup': 'look', 'facepalm': 'sad', 'cry': 'sad', 'no': 'look', 'shrug': 'look', 'think': 'look', 'laugh': 'cheer',
              'angry': 'idle', 'faint': 'lie', 'fall': 'lie', 'hold': 'idle', 'carry': 'idle', 'kick': 'jump', 'punch': 'jump', 'sitdesk': 'sit',
              'sitgame': 'sit', 'sneak': 'walk', 'freeze': 'idle', 'wave2': 'wave', 'stretch': 'idle', 'yawn': 'idle', 'throw': 'jump', 'game': 'idle',
              'lookup': 'look', 'shock': 'scared'}
POSITIVE = {'happy', 'smile', 'grin', 'laugh', 'love', 'cool', 'smug', 'wink', 'excited', 'confident'}
NEGATIVE = {'scared', 'panic', 'sad', 'cry', 'angry', 'shock', 'nervous', 'disappointed'}
# Text -> Gesicht (erste passende Regel gewinnt). Neue Emotionen (panic, nervous, ...) nur, wenn die Engine sie kennt.
MOOD_RULES = [
    (r'\b(panic|panics|run!|help!|oh no|trapped)\b', ['panic', 'scared']),
    (r'\b(terrified|scared|afraid|frightened|fear|creepy|horror|nightmare|trembl\w*|shiver\w*|scream\w*)\b', ['scared']),
    (r'\b(nervous|nervously|sweat\w*|gulp\w*|awkward)\b', ['nervous', 'scared']),
    (r'\b(disappointed|let down|failed|fail|lost again)\b', ['disappointed', 'sad']),
    (r'\b(cries|crying|cried|tears|sobs?|heartbroken|lonely|sad)\b', ['cry', 'sad']),
    (r'\b(furious|angry|mad|rage|yells?|shouts?)\b', ['angry']),
    (r'\b(shocked|can\'t believe|what\?!|gasps?|no way)\b', ['shock']),
    (r'\b(confused|huh\?|weird|strange|makes no sense)\b', ['confused']),
    (r'\b(thinks?|wonders?|wondering|an idea|a plan|remembers?)\b', ['think']),
    (r'\b(excited|can\'t wait|yes!|wins?|won|winner)\b', ['excited', 'grin']),
    (r'\b(confident|proud|easy|smirks?)\b', ['confident', 'smug']),
    (r'\b(laughs?|laughing|funny|lol|hilarious)\b', ['laugh']),
    (r'\b(tired|exhausted|sleepy|yawns?)\b', ['sleepy']),
]
NIGHT = r'\b(midnight|at night|tonight|that night|in the dark|moonlight|full moon|[1-4] ?a\.?m\.?|nightfall)\b'
MORNING = r'\b(sunrise|this morning|in the morning|breakfast|dawn)\b'
EVENING = r'\b(sunset|evening|dusk)\b'
OUTDOOR_ONLY = {'car', 'bus', 'tree', 'pine', 'bush', 'rock', 'fence', 'lounger', 'umbrella', 'snowman'}
INDOOR_ONLY = {'bed', 'blanket', 'desk', 'tv', 'stool'}
BORING_START = r'^(hi|hello|hey (guys|everyone)|welcome|today (we|i)|in this video|so,? )'


def _txt(sh):
    return re.sub(r'[*]', '', str(sh.get('say', ''))).lower()


def _main_actor(sh):
    acts = [a for a in sh.get('actors') or [] if a.get('id')]
    cam = sh.get('cam')
    if isinstance(cam, str) and ':' in cam:
        tid = cam.split(':', 1)[1].split('>')[0]
        for a in acts:
            if a['id'] == tid: return a
    if isinstance(cam, dict) and cam.get('target'):
        for a in acts:
            if a['id'] == cam['target']: return a
    return acts[0] if len(acts) == 1 else None


def inhalt(src, info=None):
    """Prüft/korrigiert die Logik am Episoden-JSON (in place). info = R.info() der Engine (Moods, Tiere, Sets)."""
    info = info or {}
    moods = set(info.get('moods') or [])
    animals = set(info.get('animals') or [])
    indoor = set(info.get('indoor') or ['room', 'classroom', 'house_in', 'danceroom', 'mall', 'hallway', 'kitchen'])
    cast = src.setdefault('cast', {})
    fixes, warns, errors = [], [], []
    shots = src.get('shots') or []

    # Besetzung: jede Figur braucht einen Eintrag
    for i, sh in enumerate(shots):
        for a in sh.get('actors') or []:
            aid = a.get('id')
            if aid and aid not in cast and not a.get('animal') and not a.get('look'):
                base = aid.rstrip('0123456789')
                if base in animals:
                    cast[aid] = {'animal': base}; fixes.append(f'Besetzung: "{aid}" als Tier-Modell {base} angelegt')
                else:
                    warns.append(f'Shot {i + 1}: Figur "{aid}" ohne Besetzung (Standard-Look)')

    # Tier-Regel: Tiere nie als Menschen darstellen
    title = ' '.join(str(x) for x in [(src.get('meta') or {}).get('title', ''), (src.get('viral') or {}).get('hook', ''), src.get('title', '')]).lower()
    star_animals = {w for w in ANIMAL_WORDS if re.search(r'\b' + re.escape(w) + r'\b', title)}
    cast_animals = {c.get('animal') for c in cast.values() if isinstance(c, dict) and c.get('animal')}
    for w in sorted(star_animals):
        model = ANIMAL_WORDS[w]
        if model is None or (animals and model not in animals):
            errors.append(f'Tier-Regel: "{w}" spielt die Hauptrolle, aber es gibt kein Tier-Modell dafür (anderes Tier wählen oder Modell bauen)')
        elif model not in cast_animals:
            # Mensch als Tier verkleidet? -> Cast-Eintrag mit passendem Namen umstellen
            for cid, c in cast.items():
                if isinstance(c, dict) and not c.get('animal') and (cid.lower().startswith(model[:4]) or cid.lower() == w):
                    cast[cid] = {'animal': model}; cast_animals.add(model)
                    fixes.append(f'Tier-Regel: "{cid}" war ein Mensch -> jetzt Tier-Modell {model}')
                    break
            else:
                errors.append(f'Tier-Regel: "{w}" im Titel, aber kein {model}-Tier-Modell in der Besetzung')
    animal_ids = {cid for cid, c in cast.items() if isinstance(c, dict) and c.get('animal')}

    for i, sh in enumerate(shots):
        t = _txt(sh)
        # Tier-Aktionen übersetzen (Tiere können nicht zeigen, sich ans Gesicht fassen …)
        for a in sh.get('actors') or []:
            if a.get('id') in animal_ids or a.get('animal'):
                d = a.get('do')
                if isinstance(d, str) and d not in ANIMAL_ACTS:
                    nd = ANIMAL_MAP.get(d, 'idle'); a['do'] = nd; fixes.append(f'Shot {i + 1}: Tier "{a["id"]}" kann nicht "{d}" -> "{nd}"')
                if a.get('hold'):
                    a.pop('hold'); fixes.append(f'Shot {i + 1}: Tier "{a["id"]}" kann nichts halten -> entfernt')
        # Mimik passend zum Text
        m = _main_actor(sh)
        if m is not None and isinstance(m.get('mood', ''), str):
            want = None
            for rx, cands in MOOD_RULES:
                if re.search(rx, t):
                    want = next((c for c in cands if not moods or c in moods), None); break
            cur = m.get('mood')
            posw = re.search(r'\b(best|love|loves|happy|yay|awesome|amazing|wins?|won|great|perfect)\b', t)
            strong = want in ('scared', 'panic', 'cry', 'sad', 'angry', 'disappointed', 'nervous')
            if want and (cur is None or (cur in POSITIVE and strong and not posw) or (cur in NEGATIVE and want in POSITIVE and want not in ('think',))):
                if cur != want:
                    m['mood'] = want; fixes.append(f'Shot {i + 1}: Gesicht von "{m["id"]}" {cur or "-"} -> {want} (Text: "{sh.get("say", "")[:40]}")')
        # Requisiten-Logik: 'keys' ist eine Klaviertastatur – in der Hand / bei Tür-/Haus-Schlüsseln ist der Schlüsselbund gemeint
        for a in sh.get('actors') or []:
            h = a.get('hold')
            if h == 'keys' or (isinstance(h, dict) and h.get('type') == 'keys'):
                a['hold'] = 'housekeys' if h == 'keys' else dict(h, type='housekeys'); fixes.append(f'Shot {i + 1}: "{a.get("id")}" hält Schlüssel -> Schlüsselbund statt Keyboard')
        # Dialog in Anführungszeichen: sprechende Figur bewegt den Mund (lippensynchron zur Stimme)
        say = str(sh.get('say', '')).strip()
        prev = _txt(shots[i - 1]) if i else ''
        offscreen = re.search(r'\b(text|texts|message|voice|heard|hears|reads?|sign|note|letter|whisper\w*|calls?|radio|speaker)\b', prev) or isinstance(m.get('hold') if m else None, str) and 'phone' in str(m.get('hold'))
        if m is not None and re.match(r'^["“„«]', say) and 'talk' not in m and m.get('do') not in ('talk',) and not offscreen:
            m['talk'] = True; fixes.append(f'Shot {i + 1}: "{m["id"]}" spricht -> Mund lippensynchron')
        # unbekannte Gesichter
        for a in sh.get('actors') or []:
            if moods and isinstance(a.get('mood'), str) and a['mood'] and a['mood'] not in moods:
                fixes.append(f'Shot {i + 1}: unbekanntes Gesicht "{a["mood"]}" -> happy'); a['mood'] = 'happy'
        # Tageszeit passend zum Text
        tm = sh.get('time') or 'day'
        if re.search(NIGHT, t) and tm in ('day', 'morning') and not sh.get('timeTo'):
            sh['time'] = 'night'; fixes.append(f'Shot {i + 1}: Text sagt Nacht -> time night')
        elif re.search(MORNING, t) and tm == 'night' and not sh.get('timeTo'):
            sh['time'] = 'morning'; fixes.append(f'Shot {i + 1}: Text sagt Morgen -> time morning')
        elif re.search(EVENING, t) and tm == 'day' and not sh.get('timeTo'):
            sh['time'] = 'sunset'; fixes.append(f'Shot {i + 1}: Text sagt Abend -> time sunset')
        # Requisiten passend zum Ort
        st = sh.get('set') or 'street'
        for p in sh.get('props') or []:
            ty = p.get('type')
            if st in indoor and ty in OUTDOOR_ONLY: warns.append(f'Shot {i + 1}: "{ty}" steht drinnen ({st})')
            if st not in indoor and ty in INDOOR_ONLY and st not in ('house', 'backyard', 'patio'): warns.append(f'Shot {i + 1}: "{ty}" steht draußen ({st})')

    # Kleidung passend zum Ort: Schulrucksack zuhause/nachts im Haus wirkt unlogisch
    home = {'room', 'kitchen', 'hallway'}
    if all((s.get('set') in home) for s in shots if s.get('actors')) and shots:
        for cid, c in cast.items():
            if isinstance(c, dict) and c.get('backpack') not in (None, False) or (isinstance(c, dict) and c.get('look') in ('boy', 'girl', 'kid', 'student') and 'backpack' not in c):
                if isinstance(c, dict) and not c.get('animal'):
                    c['backpack'] = False; fixes.append(f'Kleidung: "{cid}" trägt zuhause keinen Rucksack')
    # Tageszeit springt ohne Grund (gleicher Ort, direkt hintereinander)
    for i in range(1, len(shots)):
        a, b = shots[i - 1], shots[i]
        if a.get('set') == b.get('set') and {a.get('time') or 'day', b.get('time') or 'day'} == {'day', 'night'} and not (a.get('timeTo') or b.get('timeTo')):
            if not (re.search(NIGHT, _txt(a) + ' ' + _txt(b)) or re.search(MORNING + '|' + EVENING, _txt(a) + ' ' + _txt(b)) or re.search(r'\b(next|later|hours|that night|morning)\b', _txt(b))):
                warns.append(f'Shot {i}->{i + 1}: Tag/Nacht wechselt am selben Ort ohne Zeitsprung im Text')

    # Musik passend zur Serie/Geschichte
    series = ((src.get('viral') or {}).get('series', '') + ' ' + ' '.join((src.get('meta') or {}).get('hashtags') or [])).lower()
    want_music = [(r'dark', ('dark',)), (r'weird|inthistown|mystery', ('mystery',)), (r'school', ('school', 'school_emo')), (r'vs|battle', ('battle',)),
                  (r'survival|whatif', ('epic',)), (r'trend|genz', ('trend',))]
    for rx, ok in want_music:
        if re.search(rx, series):
            if src.get('music') not in ok and not src.get('musicFile'):
                warns.append(f'Musik: Serie passt zu {"/".join(ok)}, gesetzt ist "{src.get("music")}"')
            break
    # Hook: die ersten 2 Sekunden
    if shots:
        h0 = next((s for s in shots if not s.get('intro')), shots[0])   # Mii-Town-Intro zählt nicht als Hook
        t0 = _txt(h0)
        if re.search(BORING_START, t0): errors.append(f'Hook: Einstieg "{h0.get("say")}" ist eine Begrüßung/Einleitung – direkt in die Handlung!')
        if h0.get('pause'): fixes.append('Hook: Pause vor dem Hook-Shot entfernt'); h0.pop('pause')
        if len(t0.split()) > 7: warns.append('Hook: erster Satz > 7 Wörter (passt kaum in 2 s)')
        if not (src.get('viral') or {}).get('hook'): warns.append('Hook: kein großer Hook-Text (viral.hook)')
    return {'fixes': fixes, 'warns': warns, 'errors': errors}


def _cam_far(sh, f):
    c = sh.get('cam')
    if isinstance(c, str) or c is None:
        if c and ':' in c:
            ty, rest = c.split(':', 1); tg = rest.split('>')
            c = {'type': ty, 'target': tg[0], **({'target2': tg[1]} if len(tg) > 1 else {})}
        else:
            c = {'type': c or 'wide'}
    c = dict(c); c['far'] = round(min(1.9, float(c.get('far', 1.0)) * f), 2); sh['cam'] = c
    return c['far']


SEAT_PROPS = ('chair', 'bench', 'stool', 'box', 'sofa', 'couch', 'bed', 'lounger', 'toilet', 'bleachers')
def _sits(a):
    d = a.get('do'); ds = [d] if isinstance(d, str) else [x[0] if isinstance(x, list) else x for x in (d or [])]
    return any(str(x).startswith('sit') for x in ds)
def _move(sh, a, new):
    """Figur umstellen; sitzt sie, wandert ihr Sitz (Stuhl/Bank/Kiste) mit – nie neben dem Stuhl in der Luft (Lukas 26.11.)."""
    old = a.get('at'); a['at'] = new
    if old and _sits(a):
        dx, dz = new[0] - old[0], new[-1] - old[-1]
        for p in sh.get('props') or []:
            if p.get('type') in SEAT_PROPS and p.get('at'):
                pa = p['at']; px, pz = pa[0], pa[-1]
                if (px - old[0]) ** 2 + (pz - old[-1]) ** 2 < 1.6 ** 2:
                    p['at'] = [round(px + dx, 2), pa[1], round(pz + dz, 2)] if len(pa) == 3 else [round(px + dx, 2), round(pz + dz, 2)]

def physik(eng, ep, runden=4):
    """Geometrie-Prüfung mit der Engine; korrigiert Kollisionen, Wände, Schweben, Bildausschnitt. ep wird geändert."""
    fixes, warns = [], []
    for rnd in range(runden):
        res = eng.pg.evaluate('ep => { R.load(ep); return R.checkAll(); }', ep)
        changed = False
        for b in res:
            sh = ep['shots'][b['shot']]; acts = {a.get('id'): a for a in sh.get('actors') or []}
            typ, fx = b['typ'], b.get('fix') or {}
            label = f'Shot {b["shot"] + 1}: {b["info"]}' + (f' [{b["id"]}]' if b['id'] else '')
            if typ == 'kollision' and fx:
                A, B = acts.get(fx['a']), acts.get(fx['b'])
                if A and B and A.get('at') and B.get('at') and not (A.get('path') and B.get('path')):
                    ax, az = A['at'][0], A['at'][-1]; bx, bz = B['at'][0], B['at'][-1]
                    dx, dz = bx - ax, bz - az; d = (dx * dx + dz * dz) ** 0.5
                    if d < 1e-3: dx, dz, d = 1.0, 0.0, 1.0
                    nx, nz = dx / d, dz / d; p = fx['push']
                    wa, wb = (0.0, 1.0) if (A.get('path') or _sits(A)) and not _sits(B) else (1.0, 0.0) if (B.get('path') or _sits(B)) and not _sits(A) else (0.5, 0.5)   # wer sitzt, bleibt sitzen
                    _move(sh, A, [round(ax - nx * p * wa, 2), round(az - nz * p * wa, 2)]); _move(sh, B, [round(bx + nx * p * wb, 2), round(bz + nz * p * wb, 2)])
                    fixes.append(label + ' -> auseinandergestellt'); changed = True; continue
            if typ == 'ausserhalb' and fx and acts.get(b['id']) and acts[b['id']].get('at') and not acts[b['id']].get('path'):
                a = acts[b['id']]; x0, x1, z0, z1 = fx['clamp']
                _move(sh, a, [round(min(max(a['at'][0], x0), x1), 2), round(min(max(a['at'][-1], z0), z1), 2)])
                fixes.append(label + ' -> in den Raum gestellt'); changed = True; continue
            if typ == 'in_moebel' and fx.get('to') and acts.get(b['id']) and not acts[b['id']].get('path'):
                _move(sh, acts[b['id']], fx['to']); fixes.append(label + f' -> umgestellt auf {fx["to"]}'); changed = True; continue
            if typ == 'verdeckt_figur' and acts.get(b['id']) and acts[b['id']].get('at') and not acts[b['id']].get('path'):
                a = acts[b['id']]
                if _sits(a): warns.append(label); continue   # sitzende Figur nicht vom Stuhl schieben
                _move(sh, a, [round(a['at'][0] + fx['dx'], 2), round(a['at'][-1] + fx['dz'], 2)])
                fixes.append(label + ' -> seitlich versetzt'); changed = True; continue
            if typ == 'verdeckt' and 'ang' in fx:
                c = sh.get('cam'); _cam_far(sh, 1.0); sh['cam']['ang'] = fx['ang']; fixes.append(label + f' -> Kamerawinkel {fx["ang"]}°'); changed = True; continue
            if typ == 'sitzt_in_luft' and fx.get('chair'):
                props = sh.setdefault('props', [])
                if not any(p.get('type') in ('chair', 'bench', 'stool') and p.get('_auto') == b['id'] for p in props):
                    props.append({'type': 'chair', 'at': fx['chair'], 'ry': fx.get('ry', 0), 'color': '#6d4c41', 'pin': True, '_auto': b['id']})
                    fixes.append(label + ' -> Stuhl daruntergestellt'); changed = True; continue
            if typ == 'sitz_zu_hoch' and acts.get(b['id']):
                acts[b['id']]['y'] = fx['y']; fixes.append(label + f' -> auf die Sitzfläche gesetzt (y {fx["y"]})'); changed = True; continue
            if typ == 'schwebt' and acts.get(b['id']):
                acts[b['id']]['y'] = round(float(fx.get('y', 0)), 2); fixes.append(label + ' -> auf den Boden gestellt'); changed = True; continue
            if typ in ('kopf_nicht_im_bild', 'kopf_abgeschnitten', 'kamera_in_figur', 'verdeckt') and fx.get('far'):
                c = sh.get('cam'); cur = float(c.get('far', 1)) if isinstance(c, dict) else 1.0
                if cur < 1.85:
                    nf = _cam_far(sh, fx['far']); fixes.append(label + f' -> Kamera weiter weg (far {nf})'); changed = True; continue
            warns.append(label)
        if not changed: break
        warns = []  # nach Korrekturen neu prüfen; Rest-Hinweise der letzten Runde zählen
    # doppelte Hinweise zusammenfassen
    return {'fixes': fixes, 'warns': list(dict.fromkeys(warns))}


def bericht(r1, r2=None, out=print):
    fx = r1['fixes'] + (r2['fixes'] if r2 else []); ws = r1['warns'] + (r2['warns'] if r2 else []); er = r1.get('errors', [])
    out(f'Regie: {len(fx)} Korrekturen, {len(ws)} Hinweise, {len(er)} Fehler')
    for f in fx: out('  ✎ ' + f)
    for w in ws: out('  ⚠ ' + w)
    for e in er: out('  ✗ ' + e)
    return {'fixes': fx, 'warns': ws, 'errors': er}
