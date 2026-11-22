"""tts.py – Sprecherstimme direkt aus dem Skript (Piper, offline, Deutsch).

Die `say`-Texte der Shots werden satzweise mit Piper gesprochen. Die Wortzeiten kommen
exakt aus Pipers Phonem-Alignment, dadurch laufen Untertitel und Schnitte synchron zur Stimme.

Stimme beim ersten Gebrauch automatisch: `pip install piper-tts onnx` + Modell-Download
(GitHub, sherpa-onnx-Release) nach ~/.cache/block_studio/voices. Eigene Modelle: roblox/voices/.
"""
import hashlib, importlib, json, os, re, shutil, subprocess, sys, tarfile, unicodedata, urllib.request
from pathlib import Path
import numpy as np
from scipy.signal import resample_poly

import audio as AU

HERE = Path(__file__).resolve().parent
CACHE = Path(os.environ.get('BLOCK_STUDIO_CACHE', Path.home() / '.cache' / 'block_studio'))
URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-{name}.tar.bz2'

DEFAULT_VOICE = 'thorsten'
VOICES = {  # Kurzname -> Piper-Modell (alle Deutsch)
    'thorsten': 'de_DE-thorsten-high',            # männlich, beste Qualität (Standard)
    'thorsten-medium': 'de_DE-thorsten-medium',
    'thorsten-emo': 'de_DE-thorsten_emotional-medium',  # Sprecher: amused, angry, disgusted, drunk, neutral, sleepy, surprised, whisper
    'kerstin': 'de_DE-kerstin-low',               # weiblich
    'ramona': 'de_DE-ramona-low',                 # weiblich
    'eva': 'de_DE-eva_k-x_low',                   # weiblich
    'karlsson': 'de_DE-karlsson-low',
    'pavoque': 'de_DE-pavoque-low',
}

PUNCT = set('.,!?;:…—–-‐"\'()[]«»„“”‚‘’¡¿*')
SENT_END = re.compile(r'[.!?…]+["“”»«)]*$')
LEAD_STRIP = '…."„“”»«‚‘(-–—'

# ---------------- Installation / Modelle ----------------
def _pip(*pkgs):
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '--break-system-packages', '--root-user-action=ignore', *pkgs], check=True)
    importlib.invalidate_caches()

def ensure_piper():
    try:
        import piper  # noqa: F401
    except ImportError:
        print('Installiere Piper-TTS …', flush=True)
        _pip('piper-tts', 'onnx')
    try:
        import onnx  # noqa: F401  (nötig für exaktes Wort-Timing)
    except ImportError:
        try: _pip('onnx')
        except Exception: print('Hinweis: onnx fehlt – Wort-Timing wird aus der Lautstärke geschätzt.')

def _download(name):
    dst = CACHE / 'voices'; dst.mkdir(parents=True, exist_ok=True)
    url = URL.format(name=name); tmp = dst / f'{name}.tar.bz2.part'
    print(f'Lade Stimme {name} (einmalig) …', flush=True)
    try:
        with urllib.request.urlopen(url, timeout=120) as r, open(tmp, 'wb') as f:
            shutil.copyfileobj(r, f, 1 << 20)
    except Exception:
        if not shutil.which('curl'): raise
        subprocess.run(['curl', '-fsSL', '-o', str(tmp), url], check=True)
    want = {f'{name}.onnx', f'{name}.onnx.json'}
    with tarfile.open(tmp, 'r:bz2') as tf:
        for m in tf:
            base = os.path.basename(m.name)
            if m.isfile() and base in want:
                out = dst / base
                with tf.extractfile(m) as src, open(str(out) + '.part', 'wb') as f: shutil.copyfileobj(src, f)
                os.replace(str(out) + '.part', out)
    tmp.unlink(missing_ok=True)
    p = dst / f'{name}.onnx'
    if not p.exists(): raise RuntimeError(f'Stimme {name} nicht im Download gefunden ({url})')
    return p

def resolve(spec):
    """'thorsten' | 'thorsten-emo:whisper' | 'de_DE-…' | '/pfad/stimme.onnx'  ->  (Modellpfad, Sprecher)"""
    name, _, speaker = str(spec or DEFAULT_VOICE).partition(':')
    name = VOICES.get(name, name)
    if name.endswith('.onnx'):
        p = Path(name)
        if p.exists(): return p, speaker or None
        raise FileNotFoundError(name)
    for d in (HERE / 'voices', CACHE / 'voices'):
        p = d / f'{name}.onnx'
        if p.exists() and Path(str(p) + '.json').exists(): return p, speaker or None
    return _download(name), speaker or None

_VOICES = {}
def load(spec):
    path, speaker = resolve(spec)
    if path not in _VOICES:
        ensure_piper()
        import logging; logging.getLogger('piper').setLevel(logging.ERROR)
        from piper import PiperVoice
        try: v = PiperVoice.load(str(path), include_alignments=True)
        except Exception: v = PiperVoice.load(str(path))
        _VOICES[path] = v
    v = _VOICES[path]
    sid = None
    if speaker:
        m = v.config.speaker_id_map or {}
        if speaker not in m: raise ValueError(f'Sprecher "{speaker}" gibt es in {path.stem} nicht. Verfügbar: {", ".join(m) or "-"}')
        sid = m[speaker]
    return v, path.stem, sid

# ---------------- Kokoro (sehr natürlich, Englisch u. a.) ----------------
# Stimme z. B. "kokoro:af_heart" (US, weiblich, beste Qualität), "kokoro:am_michael" (US, männlich),
# "kokoro:bf_emma" / "kokoro:bm_george" (britisch). Modell (~350 MB) einmalig von GitHub (sherpa-onnx-Release).
KOKORO_PKG = 'kokoro-multi-lang-v1_0'
KOKORO_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/{name}.tar.bz2'
KOKORO_DEFAULT = 'af_heart'

def is_kokoro(spec):
    return str(spec or '').split(':')[0] == 'kokoro'

def ensure_kokoro():
    try:
        import onnxruntime, onnx  # noqa: F401
    except ImportError:
        _pip('onnxruntime', 'onnx')
    d = CACHE / 'kokoro' / KOKORO_PKG
    if (d / 'model.onnx').exists() and (d / 'voices.bin').exists(): return d
    (CACHE / 'kokoro').mkdir(parents=True, exist_ok=True)
    tmp = CACHE / 'kokoro' / f'{KOKORO_PKG}.tar.bz2'
    if not tmp.exists():
        print('Lade Kokoro-Stimmen (einmalig, ~350 MB) …', flush=True)
        part = Path(str(tmp) + '.part')
        subprocess.run(['curl', '-fsSL', '-o', str(part), KOKORO_URL.format(name=KOKORO_PKG)], check=True)
        os.replace(part, tmp)
    with tarfile.open(tmp, 'r:bz2') as tf: tf.extractall(CACHE / 'kokoro')
    tmp.unlink(missing_ok=True)
    return d

_KOK = {}
def load_kokoro(spec):
    """'kokoro:af_heart' -> (Session, Stil-Tabelle, Token-Map, Sprecher-ID, Sprache, Name). Läuft direkt per onnxruntime,
    damit die Lautdauern (exaktes Wort-Timing) mit herauskommen."""
    name = str(spec).partition(':')[2] or KOKORO_DEFAULT
    lang = 'en-gb' if name[:1] == 'b' else 'en-us'
    d = ensure_kokoro()
    if 'sess' not in _KOK:
        import onnxruntime as ort, onnx
        so = ort.SessionOptions(); so.intra_op_num_threads = max(1, min(8, os.cpu_count() or 4))
        _KOK['sess'] = ort.InferenceSession(str(d / 'model.onnx'), so, providers=['CPUExecutionProvider'])
        _KOK['V'] = np.fromfile(d / 'voices.bin', dtype=np.float32).reshape(-1, 510, 256)
        tok = {}
        for line in open(d / 'tokens.txt', encoding='utf-8'):
            line = line.rstrip('\n')
            if not line.strip(): continue
            sym, _, i = line.rpartition(' ')
            tok[sym if sym else ' '] = int(i)
        _KOK['tok'] = tok
        m = onnx.load(str(d / 'model.onnx'), load_external_data=False)
        _KOK['ids'] = dict(x.split('->') for x in {p.key: p.value for p in m.metadata_props}['speaker2id'].split(','))
    ids = _KOK['ids']
    if name not in ids: raise ValueError(f'Kokoro-Stimme "{name}" unbekannt. Verfügbar: {", ".join(k for k in ids if k[:1] in "ab")}')
    return _KOK['sess'], _KOK['V'], _KOK['tok'], int(ids[name]), lang, name

def _en_weight(word, lang='en-us'):
    """Sprechdauer-Gewicht eines Wortes: Lautzahl per espeak (über Piper), sonst Silben-Schätzung."""
    try:
        from piper.phonemize_espeak import EspeakPhonemizer
        import piper
        global _ESPK
        if '_ESPK' not in globals(): _ESPK = EspeakPhonemizer(str(Path(piper.__file__).parent / 'espeak-ng-data'))
        ph = [c for sent in _ESPK.phonemize(lang, word) for c in sent if c not in PUNCT and c not in ' ˈˌː']
        if ph: return len(ph)
    except Exception:
        pass
    w = re.sub(r'[^a-z]', '', word.lower())
    syl = max(1, len(re.findall(r'[aeiouy]+', w)) - (1 if w.endswith('e') and len(w) > 3 else 0))
    return 2.6 * syl

def _custom_lex_path(lang):
    return CACHE / 'kokoro' / f'custom-{lang}.txt'

_LEX = {}
def _lexicon(lang):
    """Wörterbuch des Modells + eigene Ergänzungen (Kleinschreibung) -> Lautliste."""
    if lang not in _LEX:
        d = CACHE / 'kokoro' / KOKORO_PKG; L = {}
        _custom_lex_path(lang).touch()
        for f in (d / ('lexicon-gb-en.txt' if lang == 'en-gb' else 'lexicon-us-en.txt'), _custom_lex_path(lang)):
            if f.exists():
                for line in open(f, encoding='utf-8'):
                    parts = line.split()
                    if len(parts) > 1: L.setdefault(parts[0].lower(), parts[1:])
        _LEX[lang] = L
    return _LEX[lang]

_VOICELESS = set('ptkfθ')
_SIBIL = set('szʃʒʧʤ')
def _espeak_to_kokoro(ipa, lang):
    rep = [('eɪ', 'A'), ('aɪ', 'I'), ('aʊ', 'W'), ('ɔɪ', 'Y'), ('dʒ', 'ʤ'), ('tʃ', 'ʧ'), ('ɚ', 'əɹ'), ('ɝ', 'ɜɹ'), ('ɐ', 'ə'), ('r', 'ɹ'), ('ː', ''), ('ɡ', 'ɡ')]
    rep.insert(0, ('oʊ', 'O') if lang == 'en-us' else ('əʊ', 'Q'))
    for a, b in rep: ipa = ipa.replace(a, b)
    toks = set(l.split()[0] for l in open(CACHE / 'kokoro' / KOKORO_PKG / 'tokens.txt', encoding='utf-8') if l.strip())
    return [c for c in ipa if c in toks and c not in ' ']

def _guess_phonemes(word, lang):
    """Unbekanntes Wort: Endungen (-s, -es, -ed, -ing) / Zusammensetzungen aus dem Wörterbuch, sonst espeak."""
    L = _lexicon(lang); w = word.lower()
    def plural(ph):
        last = [c for c in ph if c not in 'ˈˌ'][-1]
        return ph + (['ᵻ', 'z'] if last in _SIBIL else ['s'] if last in _VOICELESS else ['z'])
    if w.endswith("'s") and w[:-2] in L: return plural(L[w[:-2]])
    if w.endswith('s') and w[:-1] in L: return plural(L[w[:-1]])
    if w.endswith('es') and w[:-2] in L: return plural(L[w[:-2]])
    if w.endswith('ing') and w[:-3] in L: return L[w[:-3]] + ['ɪ', 'ŋ']
    if w.endswith('ed') and w[:-2] in L:
        ph = L[w[:-2]]; last = [c for c in ph if c not in 'ˈˌ'][-1]
        return ph + (['ᵻ', 'd'] if last in 'td' else ['t'] if last in _VOICELESS | set('ʃʧ') else ['d'])
    for i in range(1, len(w)):
        a, b = w[:i], w[i:]
        if a in L and b in L and min(len(a), len(b)) >= (1 if len(a) == 1 else 3): return L[a] + L[b]
    try:
        from piper.phonemize_espeak import EspeakPhonemizer
        import piper
        global _ESPK
        if '_ESPK' not in globals(): _ESPK = EspeakPhonemizer(str(Path(piper.__file__).parent / 'espeak-ng-data'))
        ipa = ''.join(''.join(x) for x in _ESPK.phonemize(lang, word))
        return _espeak_to_kokoro(ipa, lang)
    except Exception:
        return []

def _fill_oov(text, lang):
    """Fehlende Wörter ins eigene Wörterbuch schreiben (Kokoro würde sie sonst stumm überspringen)."""
    L = _lexicon(lang); new = []
    for w in re.findall(r"[A-Za-z][A-Za-z']*|\d+", text):
        k = w.lower().strip("'")
        if k in L or not k: continue
        ph = _guess_phonemes(k, lang)
        if ph: L[k] = ph; new.append(f"{k} {' '.join(ph)}")
    if new:
        with open(_custom_lex_path(lang), 'a', encoding='utf-8') as f: f.write('\n'.join(new) + '\n')
        print('Kokoro: Aussprache ergänzt für ' + ', '.join(x.split()[0] for x in new), flush=True)

def _kokoro_ids(text, L, tok):
    """Text -> Token-IDs + Wortspannen [(token_start, token_end)] in Sprechreihenfolge."""
    text = text.replace('’', "'").replace('‘', "'")
    ids, spans = [], []
    for m in re.finditer(r"[A-Za-z][A-Za-z']*|\d+|[,.!?;:…—]", text):
        t = m.group(0)
        if t[0].isalnum():
            ph = ['ə'] if t == 'a' else L.get(t.lower().strip("'"))   # Artikel "a" = Schwa (Großes "A" = Buchstabe)
            if not ph: print(f'Kokoro: "{t}" übersprungen (keine Aussprache)', flush=True); continue
            if ids and ids[-1] != tok[' ']: ids.append(tok[' '])
            a = len(ids); ids += [tok[c] for c in ph if c in tok]; spans.append((a, len(ids)))
        elif t in tok:
            ids.append(tok[t]); ids.append(tok[' '])
    while ids and ids[-1] == tok[' ']: ids.pop()
    return ids, spans

def synth_kokoro(spec, tokens, speed):
    spoken = [_speech_token(w) for w in tokens]
    text = ' '.join(x for x in spoken if x)
    sess, V, tok, sid, lang, name = load_kokoro(spec)
    _fill_oov(text, lang)
    key = _cache_key('kokoro-ort', name, sid, round(speed, 4), text, 4)
    cdir = CACHE / 'tts'; cdir.mkdir(parents=True, exist_ok=True); cf = cdir / f'{key}.npz'
    if cf.exists():
        z = np.load(cf, allow_pickle=False)
        return z['audio'], [tuple(x) for x in z['times']], str(z['how']), True
    L = _lexicon(lang)
    ids, _ = _kokoro_ids(text, L, tok)
    ids = ids[:508]
    out = sess.run(None, {'tokens': np.array([[0] + ids + [0]], np.int64), 'style': V[sid, min(len(ids), 509)][None], 'speed': np.array([speed], np.float32)})
    audio, dur = out[0].reshape(-1).astype(np.float32), out[1].reshape(-1).astype(np.int64)
    sr, hop = 24000, len(out[0].reshape(-1)) / max(1, int(dur.sum()))   # 600 Samples pro Dauer-Einheit
    edges = np.concatenate([[0], np.cumsum(dur)]) * hop / sr            # Startzeit jedes Tokens (inkl. Pad vorne)
    # Wortzeiten exakt aus den Lautdauern; jedes Untertitel-Token bekommt die Spanne seiner Laute
    times, how = [None] * len(tokens), 'exakt'
    punct_ids = {tok[c] for c in tok if c in PUNCT or c == ' '}
    flat = [k + 1 for k, c in enumerate(ids) if c not in punct_ids]   # Laute im Tokenstrom (+1 wegen Pad vorne)
    i = 0
    for q, sp in enumerate(spoken):
        if not sp: continue
        n = len([c for c in _kokoro_ids(sp, L, tok)[0] if c not in punct_ids])
        if n == 0 or i + n > len(flat): how = 'teilweise'; continue
        times[q] = (float(edges[flat[i]]), float(edges[flat[i + n - 1] + 1])); i += n
    if i != len(flat): how = 'teilweise'
    # Stille vorne/hinten (Pads) kürzen
    lead = max(0.0, float(edges[1]) - 0.05); tail_end = float(edges[-2]) + 0.12
    audio = audio[int(lead * sr): int(tail_end * sr)]
    times = [(t[0] - lead, t[1] - lead) if t else None for t in times]
    last = 0.0
    for q in range(len(times)):
        if times[q] is None: times[q] = (last, last + 0.05)
        last = times[q][1]
    g = np.gcd(AU.SR, sr)
    audio44 = resample_poly(audio, AU.SR // g, sr // g).astype(np.float32)
    np.savez(cf, audio=audio44, times=np.array(times, dtype=np.float64), how=how)
    return audio44, times, how, False

# ---------------- Synthese + Alignment ----------------
def _speakable(s):
    """Emojis/Symbole nicht vorlesen (Währungszeichen wie € bleiben)."""
    return ''.join(c for c in s if unicodedata.category(c) not in ('So', 'Sk', 'Cs', 'Co', 'Mn', 'Cf') or c in '\u0308\u0301')

def _speech_token(w):
    s = _speakable(w['raw']).lstrip(LEAD_STRIP)
    if not any(c.isalnum() for c in s): return ''
    if w.get('pause') and not re.search(r'[.,;:!?…]["“”»«)]*$', s): s += ','
    return s

def _groups(phonemes_per_sentence):
    """Phoneme -> Anzahl Wortgruppen und Laute (ohne Leerzeichen/Satzzeichen)."""
    n = p = 0
    for sent in phonemes_per_sentence:
        cur = False
        for ph in sent:
            if ph == ' ': cur = False
            elif ph in PUNCT: continue
            else:
                p += 1
                if not cur: n += 1; cur = True
    return n, p

def _synth(voice, text, sid, speed, noise, noise_w, chunk_gap=0.12):
    from piper import SynthesisConfig
    sc = SynthesisConfig(speaker_id=sid, length_scale=1.0 / speed, noise_scale=noise, noise_w_scale=noise_w)
    sr = voice.config.sample_rate
    pieces, groups, phones, aligned, t = [], [], [], True, 0.0
    for k, ch in enumerate(voice.synthesize(text, sc, include_alignments=True)):
        if k:
            pieces.append(np.zeros(int(chunk_gap * sr), np.float32)); t += chunk_gap
        a = ch.audio_float_array; pieces.append(a)
        al = ch.phoneme_alignments
        if not al: aligned = False
        else:
            tot = sum(x.num_samples for x in al); sc_ = len(a) / tot if tot else 1.0
            tt, cur = t, None
            for x in al:
                d = x.num_samples * sc_ / sr; ph = x.phoneme
                if ph == ' ': cur = None
                elif ph in ('^', '$') or ph in PUNCT: pass
                else:
                    if cur is None: cur = [tt, tt + d]; groups.append(cur)
                    else: cur[1] = tt + d
                    phones.append((tt, tt + d))
                tt += d
        t += len(a) / sr
    audio = np.concatenate(pieces) if pieces else np.zeros(1, np.float32)
    return audio, sr, (groups if aligned else None), (phones if aligned else None)

def _word_times(voice, tokens, spoken, audio44, groups, phones):
    cnt = [_groups(voice.phonemize(s)) for s in spoken]
    times = [None] * len(tokens)
    if groups is not None and sum(c[0] for c in cnt) == len(groups):
        i = 0
        for q, (n, _) in enumerate(cnt):
            if n: times[q] = (groups[i][0], groups[i + n - 1][1]); i += n
        how = 'exakt'
    elif phones:
        S, N, cum = len(phones), sum(c[1] for c in cnt) or 1, 0
        for q, (_, p) in enumerate(cnt):
            a = min(S - 1, int(round(cum / N * S))); cum += p
            b = min(S, max(a + 1, int(round(cum / N * S))))
            if p: times[q] = (phones[a][0], phones[b - 1][1])
        how = 'lautanteilig'
    else:
        ws = [dict(w) for w in tokens]
        segs = AU.speech_segments(audio44)
        if segs:
            AU.align_to_voice(ws, segs, AU.energy_db(audio44))
            times = [(float(w['t0']), float(w['t1'])) if 't0' in w else None for w in ws]
        how = 'geschätzt'
    # stumme Tokens (z. B. Emoji) zwischen die Nachbarn setzen
    last = 0.0
    for q in range(len(times)):
        if times[q] is None: times[q] = (last, last + 0.05)
        last = times[q][1]
    return times, how

# ---------------- Natürlichkeit ----------------
def _jit(text, salt, amp):
    """Deterministische kleine Abweichung (gleicher Text = gleiches Ergebnis, Cache bleibt gültig)."""
    h = int(hashlib.md5((salt + text).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    return (h * 2 - 1) * amp

def _end(tokens):
    m = re.search(r'([.!?…]+)["“”»«)]*$', tokens[-1]['raw'])
    return m.group(1) if m else ''

def sentence_speed(tokens, base, first=False):
    """Fragen etwas langsamer, Ausrufe etwas schneller, '…' gedehnt, Hook zügig."""
    e, text = _end(tokens), ' '.join(w['raw'] for w in tokens)
    f = 1.0
    if '?' in e: f = 0.97
    elif '…' in e or '...' in e: f = 0.95
    if len(tokens) <= 2: f *= 0.97          # kurze Ausrufe nicht hetzen
    ws = [re.sub(r'[^a-z]', '', w['raw'].lower()) for w in tokens]
    if ws and all(w in ('huss', '') for w in ws): f = 1.45   # „Huss, huss, huss!“ (Lukas: Hustler-Ruf) schnell hintereinander
    return base * f * (1 + _jit(text, 'v', 0.012))   # nie schneller als normal (Lukas 22.11.)

def sentence_pause(tokens, cfg):
    """Pause NACH einem Satz (Stille im Audio ist schon abgeschnitten): kurz und natürlich wie ein Sprecher,
    Frage/… etwas länger, Ausruf kürzer; innerhalb eines Satzes (Komma, Satz läuft über mehrere Shots) fast nahtlos."""
    e, text = _end(tokens), ' '.join(w['raw'] for w in tokens)
    trim = cfg.get('trim', True)
    if not e: return float(cfg.get('gap', 0.06 if trim else 0.08))
    p = float(cfg.get('pause', 0.22 if trim else 0.3))
    if '?' in e: p += 0.1
    elif '…' in e or '...' in e: p += 0.16
    elif '!' in e: p -= 0.03
    return max(0.06, p + _jit(text, 'p', 0.04))

def _biquad(x, kind, f0, gain_db=0.0, q=0.9, sr=AU.SR):
    from scipy.signal import lfilter
    A, w = 10 ** (gain_db / 40), 2 * np.pi * f0 / sr
    cw, sw = np.cos(w), np.sin(w); al = sw / (2 * q)
    if kind == 'peak':
        b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    else:  # 'high' shelf
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sq)]
        a = [(A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sq]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x)

def polish(x, room=0.12, sr=AU.SR):
    """Sprecher-Klangkette: Trittschall raus, Mulm -2 dB, Präsenz +2.5 dB, Höhen +1.5 dB,
    sanfter Kompressor (gleichmäßige Lautstärke), kleiner Raum (klingt aufgenommen statt 'im Kopf')."""
    from scipy.signal import butter, sosfilt, fftconvolve
    if not np.any(np.abs(x) > 1e-4): return x
    y = sosfilt(butter(2, 70 / (sr / 2), 'high', output='sos'), x)
    y = _biquad(y, 'peak', 300, -2.0, 1.0)
    y = _biquad(y, 'peak', 3200, 2.5, 0.9)
    y = _biquad(y, 'high', 7000, 1.5)
    # Kompressor 2.5:1, 5-ms-Frames, Attack 10 ms / Release 150 ms
    hop = int(sr * 0.005); n = len(y) // hop + 1
    pad = np.zeros(n * hop); pad[:len(y)] = y
    lev = 10 * np.log10((pad.reshape(n, hop) ** 2).mean(1) + 1e-12)
    act = lev > np.percentile(lev, 30) + 6
    thr = np.percentile(lev[act], 55) if act.any() else -20
    target = -np.maximum(0, lev - thr) * (1 - 1 / 2.5)
    g, cur = np.empty(n), 0.0
    ka, kr = 1 - np.exp(-0.005 / 0.010), 1 - np.exp(-0.005 / 0.150)
    for i in range(n):
        cur += (target[i] - cur) * (ka if target[i] < cur else kr); g[i] = cur
    gs = np.interp(np.arange(len(y)), np.arange(n) * hop + hop / 2, 10 ** (g / 20))
    y = y * gs
    # De-Esser: Zischlaute (5–9 kHz) dynamisch absenken, wenn sie deutlich über dem Rest liegen
    from scipy.signal import butter as _b, sosfilt as _sf
    sib = _sf(_b(4, [5000 / (sr / 2), min(9000, sr / 2 - 100) / (sr / 2)], 'band', output='sos'), y)
    fr = int(sr * 0.004); m = len(y) // fr
    if m > 4:
        es = np.sqrt((sib[:m * fr].reshape(m, fr) ** 2).mean(1) + 1e-12); ef = np.sqrt((y[:m * fr].reshape(m, fr) ** 2).mean(1) + 1e-12)
        ratio = es / ef; red = np.clip((ratio - 0.35) / 0.35, 0, 1) * 0.6       # bis -8 dB im Zischband
        gk = np.interp(np.arange(len(y)), np.arange(m) * fr + fr / 2, red)
        y = y - sib * gk
    if room > 0:  # kleiner Raum: RT60 ~0.28 s, 12 ms Vorverzögerung, dumpf
        rng = np.random.default_rng(7); L = int(0.35 * sr); t = np.arange(L) / sr
        ir = rng.standard_normal(L) * np.exp(-6.9 * t / 0.28)
        ir = sosfilt(butter(2, 5000 / (sr / 2), 'low', output='sos'), ir)
        ir = np.concatenate([np.zeros(int(0.012 * sr)), ir])
        wet = fftconvolve(y, ir)[:len(y)]
        wet *= np.sqrt(np.mean(y ** 2) / (np.mean(wet ** 2) + 1e-12))
        y = y + room * wet
    return (y / (np.max(np.abs(y)) + 1e-9) * 0.95).astype(np.float32)

def _cache_key(*parts):
    return hashlib.sha1(json.dumps(parts, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:20]

def synth_utterance(spec, tokens, speed, noise, noise_w):
    if is_kokoro(spec): return synth_kokoro(spec, tokens, speed)
    voice, vname, sid = load(spec)
    spoken = [_speech_token(w) for w in tokens]
    text = ' '.join(x for x in spoken if x)
    key = _cache_key(vname, sid, round(speed, 4), noise, noise_w, text, 2)
    cdir = CACHE / 'tts'; cdir.mkdir(parents=True, exist_ok=True); cf = cdir / f'{key}.npz'
    if cf.exists():
        z = np.load(cf, allow_pickle=False)
        return z['audio'], [tuple(x) for x in z['times']], str(z['how']), True
    audio, sr, groups, phones = _synth(voice, text, sid, speed, noise, noise_w)
    g = np.gcd(AU.SR, sr)
    audio44 = resample_poly(audio, AU.SR // g, sr // g).astype(np.float32) if sr != AU.SR else audio.astype(np.float32)
    times, how = _word_times(voice, tokens, spoken, audio44, groups, phones)
    np.savez(cf, audio=audio44, times=np.array(times, dtype=np.float64), how=how)
    return audio44, times, how, False

# ---------------- Episode ----------------
def _spread(words, a, b):
    """Untertitel-Wörter gleichmäßig (nach Silben) über [a, b] verteilen."""
    if not words: return
    wt = [0.6 + w['syl'] for w in words]; tot = sum(wt); t = a
    for w, x in zip(words, wt):
        d = (b - a) * x / tot; w['t0'], w['t1'] = t, t + d * 0.92; t += d

def speak_episode(ep, shots, opts=None):
    """Setzt w['t0'], w['t1'] aller Untertitel-Wörter und liefert die Sprachspur (mono, AU.SR)."""
    cfg = dict(ep['tts']) if isinstance(ep.get('tts'), dict) else {}
    cfg.update({k: v for k, v in (opts or {}).items() if v is not None})
    vdef = cfg.get('voice', DEFAULT_VOICE)
    GENRE_SPEED = {'dark': 0.97, 'mystery': 1.0, 'epic': 1.0, 'battle': 1.0, 'trend': 1.0, 'school': 1.0, 'school_emo': 0.98}  # Lukas 22.11.: normales Sprechtempo (1x), nichts beschleunigen
    speed = float(cfg.get('speed') or GENRE_SPEED.get(ep.get('music'), 1.0)) * float(ep.get('speed', 1.0))  # Tempo passend zur Serie
    natural = cfg.get('natural', True)
    noise = cfg.get('noise', 0.7 if natural else None)
    noise_w = cfg.get('noiseW', 0.9 if natural else None)
    chunked = cfg.get('chunk', True) and is_kokoro(vdef); chunk_chars = int(cfg.get('chunkChars', 220))
    # 1) Äußerungen bilden: Blöcke aus mehreren Sätzen (Kokoro), Bruch bei Stimmwechsel, 'pause' oder stummen Shots
    utts, cur = [], None
    for si, sh in enumerate(shots):
        spk = sh['_w'] if 'speak' not in sh else AU.tokenize(sh['speak'])
        sh['_spk'] = spk
        v = sh.get('voice', vdef)
        if not spk:
            est = sum(0.1 + 0.1 * w['syl'] + 0.035 + w['pause'] for w in sh['_w']) + 0.3
            utts.append({'silence': float(sh.get('dur', est if sh['_w'] else 1.2)), 'shot': si}); cur = None; continue
        if cur is not None and (cur['voice'] != v or sh.get('pause')): cur = None
        pre = float(sh.get('pause', 0) or 0)
        for w in spk:
            if cur is None: cur = {'voice': v, 'tokens': [], 'pre': pre}; utts.append(cur); pre = 0.0
            cur['tokens'].append(w)
            # Mehrere Sätze am Stück sprechen lassen (natürlicher Satzfluss/Betonung, keine abgehackten Einzelsätze);
            # neuer Block erst nach ~220 Zeichen (Kokoro-Grenze 510 Laute), bei Stimmwechsel, "pause" oder stummem Shot
            if SENT_END.search(w['raw']) and (not chunked or sum(len(x['raw']) + 1 for x in cur['tokens']) > chunk_chars): cur = None
    # 2) synthetisieren und auf die Zeitleiste legen
    t, parts, hows, cached, used = float(ep.get('lead', 0.3)), [], {}, 0, []
    last = t
    for u in utts:
        if 'silence' in u:
            sh = shots[u['shot']]; _spread(sh['_w'], t + 0.1, t + u['silence'] - 0.1)
            t += u['silence']; last = t; continue
        if not any(_speech_token(w) for w in u['tokens']):  # nur Emojis o. Ä.: nichts zu sprechen
            for w in u['tokens']: w['t0'], w['t1'] = last, last + 0.05
            continue
        t += u['pre']
        sp = sentence_speed(u['tokens'], speed, first=not parts) if natural else speed
        audio, times, how, hit = synth_utterance(u['voice'], u['tokens'], sp, noise, noise_w)
        if cfg.get('trim', True):  # Stille vor/nach jedem Satz abschneiden (Kokoro hängt ~0,3 s an) -> flüssige Übergänge
            env = np.abs(audio); pk = env.max() if len(env) else 0
            if pk > 0:
                on = np.nonzero(env > pk * 0.04)[0]
                a0 = max(0, int(on[0] - 0.025 * AU.SR)); a1 = min(len(audio), int(on[-1] + 0.07 * AU.SR))
                fade = min(int(0.01 * AU.SR), max(1, a1 - a0) // 4)
                audio = audio[a0:a1].copy(); audio[:fade] *= np.linspace(0, 1, fade); audio[-fade:] *= np.linspace(1, 0, fade)
                sh0 = a0 / AU.SR; dmax = len(audio) / AU.SR
                times = [(min(max(0.0, a - sh0), dmax), min(max(0.0, b - sh0), dmax)) for a, b in times]
        act = np.abs(audio) > 0.02  # jeden Satz auf gleiche Sprechlautstärke
        if act.any(): audio = audio * (0.1 / (np.sqrt(np.mean(audio[act] ** 2)) + 1e-9))
        cached += hit; hows[how] = hows.get(how, 0) + 1
        if u['voice'] not in used: used.append(u['voice'])
        for w, (a, b) in zip(u['tokens'], times): w['t0'], w['t1'] = t + a, t + b
        last = u['tokens'][-1]['t1']
        parts.append((t, audio)); t += len(audio) / AU.SR
        if natural: t += sentence_pause(u['tokens'], cfg)
        else: t += float(cfg.get('pause', 0.25)) if SENT_END.search(u['tokens'][-1]['raw']) else float(cfg.get('gap', 0.08))
    # 3) Shots mit eigenem 'speak'-Text: Untertitel über die gesprochene Spanne verteilen
    for sh in shots:
        if 'speak' in sh and sh['_spk'] and sh['_w']:
            _spread(sh['_w'], sh['_spk'][0]['t0'], sh['_spk'][-1]['t1'])
    voice = np.zeros(int((t + 0.4) * AU.SR) + 1, np.float32)
    for t0, a in parts:
        i = int(round(t0 * AU.SR)); n = min(len(a), len(voice) - i); voice[i:i + n] += a[:n]
    if cfg.get('fx', True): voice = polish(voice, float(cfg.get('room', 0.12)))
    info = f'{len(parts)} Sätze, Timing ' + ', '.join(f'{k} {v}' for k, v in hows.items())
    if cached: info += f', {cached} aus Cache'
    print(f'Stimme: {" + ".join(map(str, used or [vdef]))} – {t:.1f}s, {info}', flush=True)
    return voice
