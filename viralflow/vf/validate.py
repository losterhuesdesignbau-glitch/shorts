"""Videodatei prüfen, bevor sie hochgeladen wird (ffprobe)."""
import hashlib
import json
import subprocess


class InvalidVideo(Exception):
    pass


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', str(path)],
                         capture_output=True, text=True)
    if out.returncode != 0:
        raise InvalidVideo(f'ffprobe kann die Datei nicht lesen: {out.stderr.strip()[:200]}')
    j = json.loads(out.stdout)
    v = next((s for s in j['streams'] if s['codec_type'] == 'video'), None)
    a = next((s for s in j['streams'] if s['codec_type'] == 'audio'), None)
    if not v:
        raise InvalidVideo('Keine Videospur')
    return {
        'duration': float(j['format'].get('duration', 0)),
        'size': int(j['format'].get('size', 0)),
        'width': int(v['width']), 'height': int(v['height']),
        'vcodec': v.get('codec_name'), 'acodec': a.get('codec_name') if a else None,
        'fps': eval_fps(v.get('avg_frame_rate', '0/1')),
    }


def eval_fps(s):
    try:
        n, d = s.split('/'); return float(n) / float(d) if float(d) else 0.0
    except Exception:
        return 0.0


# Gemeinsame Schnittmenge von YouTube Shorts, Instagram Reels und TikTok
RULES = {'min_s': 3.0, 'max_s': 180.0, 'max_bytes': 1_000_000_000}


def check(path, expected_sha=None):
    """-> (info, warnings). Wirft InvalidVideo bei harten Fehlern."""
    info = probe(path)
    warn = []
    if expected_sha and sha256_file(path) != expected_sha:
        raise InvalidVideo('Prüfsumme stimmt nicht – Datei beschädigt oder unvollständig')
    if info['vcodec'] not in ('h264', 'hevc'):
        raise InvalidVideo(f'Video-Codec {info["vcodec"]} wird nicht überall unterstützt (H.264 nötig)')
    if not (RULES['min_s'] <= info['duration'] <= RULES['max_s']):
        raise InvalidVideo(f'Länge {info["duration"]:.1f}s außerhalb 3–180 s (YouTube Shorts max. 3 min)')
    if info['size'] > RULES['max_bytes']:
        raise InvalidVideo('Datei größer als 1 GB')
    ratio = info['width'] / info['height']
    if abs(ratio - 9 / 16) > 0.02:
        warn.append(f'Seitenverhältnis {info["width"]}x{info["height"]} ist nicht 9:16')
    if info['height'] < 960:
        warn.append('Auflösung unter 540x960')
    if not info['acodec']:
        warn.append('Keine Tonspur')
    elif info['acodec'] != 'aac':
        warn.append(f'Audio-Codec {info["acodec"]} (empfohlen: AAC)')
    return info, warn
