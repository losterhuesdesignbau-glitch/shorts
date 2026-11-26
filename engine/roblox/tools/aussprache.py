"""Aussprache-Prüfung: hört die Computerstimme mit Spracherkennung (Whisper tiny.en, offline) ab und vergleicht mit dem Skript.

  python tools/aussprache.py episode.json            # Bericht: falsch/undeutlich gesprochene Wörter je Shot
  python tools/aussprache.py episode.json --json     # maschinenlesbar

Ergebnis je Satz: erkannt vs. Skript, Trefferquote. Wörter, die nicht erkannt werden, bekommen einen Vorschlag für
"speak" (Lautschrift-Ersatz im Shot). Grenze: < 85 % Treffer im ganzen Video oder ein Satz < 60 % = Fehler (Exit 2).
Modell: sherpa-onnx whisper tiny.en (GitHub-Release, ~118 MB, wird nach ~/.cache/block_studio/asr geladen).
"""
import argparse
import difflib
import json
import os
import re
import sys
import tarfile
import urllib.request
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
CACHE = Path(os.environ.get('BLOCK_STUDIO_CACHE', Path.home() / '.cache' / 'block_studio'))
MODEL_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.en.tar.bz2'
MDIR = CACHE / 'asr' / 'sherpa-onnx-whisper-tiny.en'

# gleich klingende Wörter (Spracherkennung kann sie nicht unterscheiden)
HOMO = {'ok': 'okay', 'threw': 'through', 'two': 'to', 'too': 'to', 'their': 'there', "they're": 'there', 'its': "it's", 'right': 'write', 'knew': 'new', 'know': 'no', 'hear': 'here', 'four': 'for', 'one': 'won', 'eight': 'ate', 'whole': 'hole', 'night': 'knight', 'sea': 'see', 'by': 'buy', 'bye': 'buy'}
ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split()


def num_words(n):
    n = int(n)
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10 - 2] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
    if n < 1000: return ONES[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' ' + num_words(n % 100))
    if 1100 <= n < 2100 and n % 100 and n >= 1100:  # Jahreszahlen: nineteen eighty-four
        return num_words(n // 100) + ' ' + (('oh ' + ONES[n % 100]) if n % 100 < 10 else num_words(n % 100))
    if n < 1_000_000: return num_words(n // 1000) + ' thousand' + ('' if n % 1000 == 0 else ' ' + num_words(n % 1000))
    return num_words(n // 1_000_000) + ' million' + ('' if n % 1_000_000 == 0 else ' ' + num_words(n % 1_000_000))


def norm_words(text):
    t = text.lower().replace('’', "'").replace('-', ' ')
    t = re.sub(r'\b([ap])\.\s?m\b\.?', r'\1m', t); t = re.sub(r'(\d)\s?([ap]m)\b', r'\1 \2', t)
    ORD = {'1st': 'first', '2nd': 'second', '3rd': 'third', '4th': 'fourth', '5th': 'fifth', '6th': 'sixth', '7th': 'seventh', '8th': 'eighth', '9th': 'ninth', '10th': 'tenth', '11th': 'eleventh', '12th': 'twelfth', '13th': 'thirteenth', '20th': 'twentieth'}
    t = re.sub(r'\b(\d+(?:st|nd|rd|th))\b', lambda m: ORD.get(m.group(1), m.group(1)), t)
    t = re.sub(r"(\w)'(s|re|ll|ve|d|t|m)\b", r'\1\2', t)  # Apostrophe: door's = doors (gleich gesprochen)
    t = re.sub(r'(\d+)[.,](\d+)', lambda m: num_words(m.group(1)) + ' point ' + ' '.join(ONES[int(c)] for c in m.group(2)), t)
    t = re.sub(r'\d+', lambda m: ' ' + num_words(m.group(0)) + ' ', t)
    t = re.sub(r"[^a-z' ]+", ' ', t)
    out = []
    for w in t.split():
        w = w.strip("'")
        if w: out.append(HOMO.get(w, w))
    return out


def load_model():
    import sherpa_onnx
    if not (MDIR / 'tiny.en-encoder.int8.onnx').exists():
        MDIR.parent.mkdir(parents=True, exist_ok=True); arc = MDIR.parent / 'w.tar.bz2'
        print('Lade Spracherkennung (Whisper tiny.en) …', flush=True)
        urllib.request.urlretrieve(MODEL_URL, arc)
        with tarfile.open(arc) as tf: tf.extractall(MDIR.parent)
        arc.unlink()
    return sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=str(MDIR / 'tiny.en-encoder.int8.onnx'), decoder=str(MDIR / 'tiny.en-decoder.int8.onnx'),
        tokens=str(MDIR / 'tiny.en-tokens.txt'), language='en', task='transcribe', num_threads=max(1, os.cpu_count() or 1))


def resample16k(x, sr):
    from scipy.signal import resample_poly
    from math import gcd
    g = gcd(16000, sr)
    return resample_poly(x, 16000 // g, sr // g).astype(np.float32)


def sentences(ep, src):
    """Sätze aus den kompilierten Shots (Wortzeiten global); Satzende = Shot-Text endet mit . ! ? … (max. ~20 s je Stück)."""
    out, cur = [], None
    for si, sh in enumerate(ep['shots']):
        ws = sh.get('words') or []
        for w in ws:
            if cur is None: cur = {'shots': [], 'words': [], 't0': sh['tg0'] + w['t0']}
            if si not in cur['shots']: cur['shots'].append(si)
            cur['words'].append(w['w']); cur['t1'] = sh['tg0'] + w['t1']
        say = str(src['shots'][si].get('say', '')).strip()
        if cur and ws and (re.search(r'[.!?…]["”»)*]*$', say) or cur['t1'] - cur['t0'] > 20): out.append(cur); cur = None
    if cur: out.append(cur)
    return out


def check(src, voice=None, ep=None, rec=None, log=print):
    import studio, audio as AU
    if voice is None or ep is None:
        ep, _, voice, _, _ = studio.compile_episode(src, None, tts={'voice': None, 'speed': None})
    v = np.asarray(voice, dtype=np.float32)
    if v.ndim == 2: v = v.mean(axis=1)
    rec = rec or load_model()
    spoken = {}  # Shot -> gesprochener Text (speak ersetzt say)
    for si, sh in enumerate(src['shots']):
        spoken[si] = sh.get('speak', sh.get('say', ''))
    res, tot_exp, tot_ok = [], 0, 0
    for s in sentences(ep, src):
        a = max(0, int((s['t0'] - 0.12) * AU.SR)); b = min(len(v), int((s['t1'] + 0.2) * AU.SR))
        seg = resample16k(v[a:b], AU.SR)
        st = rec.create_stream(); st.accept_waveform(16000, seg); rec.decode_stream(st)
        heard = st.result.text.strip()
        exp_txt = ' '.join(re.sub(r'[*]', '', w) for w in s['words'])
        # gesprochener Text (speak) der beteiligten Shots als zweite gültige Lesart
        alt = ' '.join(spoken[i] for i in s['shots'] if 'speak' in src['shots'][i])
        E, H = norm_words(exp_txt), norm_words(heard)
        if not E: continue
        E2 = norm_words(alt) if alt else None
        def score(E, H):
            sm = difflib.SequenceMatcher(None, E, H, autojunk=False)
            ok = sum(bl.size for bl in sm.get_matching_blocks()); miss = []
            for op, i1, i2, j1, j2 in sm.get_opcodes():
                if op in ('replace', 'delete'): miss.append((' '.join(E[i1:i2]), ' '.join(H[j1:j2])))
            return ok, miss
        ok, miss = score(E, H)
        if E2:
            ok2, miss2 = score(E2, H)
            if ok2 / max(1, len(E2)) > ok / max(1, len(E)): ok, miss, E = ok2, miss2, E2
        tot_exp += len(E); tot_ok += ok
        res.append({'shots': [i + 1 for i in s['shots']], 'script': exp_txt, 'heard': heard, 'rate': round(ok / max(1, len(E)), 2), 'miss': miss})
    rate = tot_ok / max(1, tot_exp)
    bad = [r for r in res if r['rate'] < 0.6]
    log(f'Aussprache: {rate * 100:.0f} % der Wörter verstanden ({tot_ok}/{tot_exp}), {len(bad)} Sätze unklar')
    for r in res:
        if r['miss'] and r['rate'] < 0.9:
            log(f"  Shot {','.join(map(str, r['shots']))}: „{r['script']}“ → gehört „{r['heard']}“  ({int(r['rate'] * 100)} %)")
            for exp, got in r['miss']:
                if exp: log(f'     · „{exp}“ klang wie „{got or "—"}“ → evtl. "speak" mit Lautschrift')
    return {'rate': round(rate, 3), 'sentences': res, 'ok': rate >= 0.85 and not bad}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('episode'); ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    src = json.load(open(a.episode, encoding='utf-8'))
    r = check(src, log=(lambda *x: None) if a.json else print)
    if a.json: print(json.dumps(r, ensure_ascii=False, indent=1))
    sys.exit(0 if r['ok'] else 2)


if __name__ == '__main__':
    main()
