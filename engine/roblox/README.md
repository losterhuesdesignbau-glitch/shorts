# Block-Studio – Skript rein, 9:16-Video raus

Eigene 3D-Engine im Roblox-Look (Blockfiguren mit Gesichtern, Low-Poly-Stadt, Wort-für-Wort-Untertitel, Musik).
Läuft komplett lokal: WebGL im Headless-Chromium → ffmpeg. Ausgabe: 1080×1920, 30 fps, H.264 + AAC.
**Sprecherstimme automatisch:** Der Skript-Text wird mit Piper (deutsche Stimme „Thorsten“) gesprochen und landet direkt im MP4 – Untertitel und Schnitte laufen exakt synchron.

## Workflow (wie im Anleitungsvideo)
1. **Skript schicken** – *eine seltsame Regel*, einfache Figuren, *Twist am Ende*. **Länge 61–75 s** (TikTok zahlt erst ab 1 min, YouTube Shorts bis 3 min). Unter 40 s wird nicht gerendert.
2. **Stimme:** Standard = Computerstimme aus dem Skript (Piper, offline).
   Optional eigenes **Voiceover** (mp3/m4a/WhatsApp-Sprachnachricht) mit `--voice` → ersetzt die Computerstimme.
3. Claude baut daraus eine Episode (`episode.json`), prüft eine Vorschau und rendert.
4. **Feedback** wie „0:07 Figur läuft durch Wand“ oder „Untertitel zu schnell“ → nächste Runde. Nur geänderte Shots werden neu gerendert.

## Befehle
```bash
python studio.py episode.json -o video.mp4                 # komplettes Video inkl. Sprecherstimme
python studio.py episode.json -o video.mp4 --voice vo.m4a  # eigenes Voiceover statt Computerstimme
python studio.py episode.json --stimme                     # nur Sprachspur als WAV + Längen-Check (~20 s)
python studio.py episode.json --force                      # rendern, auch wenn die Länge nicht passt
python studio.py episode.json --no-tts                     # ohne Stimme (nur Musik + Effekte)
python studio.py episode.json --tts-voice kerstin --tts-speed 1.0   # andere Stimme / Tempo
python studio.py episode.json --stills                     # Kontaktbogen (ein Bild pro Shot, ~10 s)
python studio.py episode.json --frames "3:0.5,7:0.2"       # Einzelbilder (Shot:Anteil)
python studio.py episode.json --only 4                     # Shot 4 neu, Rest aus Cache
```
Rendern: ca. 0,4 s pro Frame (30 s Video ≈ 6 min). `--rs 0.6` = schneller, etwas weicher.

## Episode-Format (Kurzreferenz)
```json
{ "music": "happy|chill|mystery|tense|none", "speed": 1.0,
  "cast": { "eli": {"look": "boy", "shirt": "#2f6fe0", "logo": "star"} },
  "shots": [ { "say": "Text dieses Shots, *Wort* = gelb", "set": "street", "time": "day",
               "actors": [ {"id": "eli", "at": [0,0], "to": [5,0], "do": "wave", "mood": "happy"} ],
               "cam": "close:eli" } ] }
```
**Ein Shot = eine Phrase** (1–2 s). Der Schnitt kommt automatisch kurz vor dem ersten Wort.

| Feld | Werte |
|---|---|
| `set` | street, house, park, school, classroom, room, backyard, plaza, beach, field |
| `setOpts` | `name` (Hausschild), `board` (Tafeltext), `time` (Uhr), `color`, `shops`, `marks`, `banner` |
| `time` / `timeTo` / `timeAt` | day, morning, sunset, night – Übergang z. B. `"timeTo":"night","timeAt":[0.2,0.5]` |
| Looks (`cast`) | boy, girl, man, woman, dad, mom, grandpa, grandma, teacher, cop, chef, king, kid, mayor – plus Felder: skin, shirt, pants, shoes, hair (short, spiky, long, ponytail, pigtails, bun, afro, mohawk, cap, beanie, bald), hairColor, hat (crown, tophat, party, chef, helmet), glasses, shades, beard, mustache, logo (star, heart, bolt, smile, flame oder Text), scale |
| Tiere | `"animal"`: dog, cat, fox, lion, pig, bear, sheep, cow, penguin, frog, chicken |
| `do` | idle, walk, run, sneak, game (zocken), sitgame, wave, wave2, cheer, jump, hop, point, pointup, talk, dance, sit, sitdesk, lie, yawn, stretch, throw, fall, faint, spin, scared, shrug, clap, think, nod, no, facepalm, look, lookup, carry, hold, laugh, cry, angry, kick, punch, bow, float, freeze – auch zeitlich: `[["walk",0,0.5],["wave",0.5,1]]` |
| `mood` | happy, smile, neutral, talk, grin, laugh, surprised, shock, sad, cry, angry, sleepy, sleep, yawn, scared, cool, smug, wink, love, think, evil, confused, dizzy |
| Figur-Extras | `face` (Grad, "cam" oder Figur-ID), `path`, `move` [t0,t1], `y`, `scale`, `emote` (Emoji oder "zzz"), `bubble` (Sprechblase), `hold` (Requisit; Controller beidhändig: `{"type":"controller","both":true}`), `throw` {item,to,at,arc}, `talk` |
| `cam` | wide, aerial, dolly, group, close:ID, medium:ID, full:ID, low:ID, high:ID, side:ID, back:ID, orbit:ID, ots:A>B, pov:ID, top, free {eye,look,eye2,look2} – Optionen: ang, dist, zoom, pull, fov, shake |
| `props` | sign, board, banner, number, bigtext, coin, coins, apple, banana, carrot, ball, gift, cake, pizza, burger, icecream, phone, book, cup, trophy, crown, star, bed, blanket, chair, table, desk, bench, tree, pine, bush, rock, flower, lamp, fence, car, bus, umbrella, lounger, flag, tv, clock, alarm, bell, cone, trash, balloon, box, door, campfire, sandcastle, palm, mailbox, pool, flashlight, controller, console (`light`: Farbe LED) – Optionen: at, ry, s, text, color, pop, hide, spin, bob, fly {to,t,arc}, on (Figur) |
| `fx` | coins, confetti, poof, snow, rain, hearts, sparkle, emojis, flash, dark, shake, zoom – `{type, t, at, n, dur}` |
| `pops` | Text/Emoji-Einblendung (auch Flaggen 🇳🇿): `{text, x, y, t, color, size, at, rise}` |
| `sfx` | pop, coin, ding, whoosh, boing, poof, boom, riser, tada, tick, snore – `[["ding",0.3]]` |

Zeiten in Shots (`t`, `move`, `pop` …) sind **Anteile** des Shots (0–1), damit sie mit jedem Voiceover-Timing passen.
Koordinaten: Bühne um (0,0), Kamera standardmäßig bei +z; `face: 0` = Richtung Kamera.

## Länge (Monetarisierung)
Nach dem Timing prüft `studio.py` die Länge und schreibt z. B. `✓ Länge 64.1s` oder `⚠ … ca. 40 Wörter (~8 Shots) mehr`.

| `length` (Episode) | Standard | Wirkung |
|---|---|---|
| `min` | 40 | darunter: kein Rendern (außer `--force`) |
| `goal` | 61 | darunter: Warnung (TikTok Creator Rewards erst ab 1 min) |
| `hold` | 4 | fehlen bis zu so viele Sekunden zum Ziel, wird der Schluss-Shot (Frage an Zuschauer) länger gehalten |
| `max` | 175 | darüber: kein Rendern (YouTube Shorts max. 3 min) |

`"length": false` schaltet die Prüfung ab. Faustregel: **160–190 gesprochene Wörter ≈ 61–75 s**, 35–45 Shots.
Aufbau für 60+ s: Hook (Regel) → wo sie überall gilt → 3–4 Folgen/Gags → Strafe/Durchsetzung → Held + Plan → Ausführung → Twist → zweiter Twist → Frage + „Schreib's in die Kommentare!“.

## Stimme (Piper)
Beim ersten Rendern automatisch: `pip install piper-tts onnx` + Modell-Download von GitHub (~115 MB, einmalig nach `~/.cache/block_studio/voices`).
Eigene `.onnx`-Modelle (+ `.onnx.json`) können in `roblox/voices/` liegen. Gesprochene Sätze werden gecacht.

| Feld | Wirkung |
|---|---|
| `"tts": {...}` (Episode) | `voice` (Standard `thorsten`), `speed` (Standard 1.05), `pause` (Grundpause nach Satzende, 0.3 s), `noise` (0.7, Satzmelodie), `noiseW` (0.9, Rhythmus), `natural` (true), `fx` (true, Klangkette), `room` (0.12, Raumanteil) – `"tts": false` = ohne Stimme |
| `speak` (Shot) | anderer Sprechtext als der Untertitel, z. B. `"say": "20€ Strafe", "speak": "zwanzig Euro Strafe"`; `"speak": ""` = Untertitel ohne Stimme |
| `pause` (Shot) | Sekunden Stille *vor* diesem Shot (Spannungspause vor dem Twist) |
| `voice` (Shot) | andere Stimme nur für diesen Shot, z. B. `"thorsten-emo:whisper"` |

**Englisch / sehr natürlich (Kokoro):** `"tts": {"voice": "kokoro:af_heart", "speed": 1.0, "room": 0.06}` – Modell (~350 MB) lädt beim ersten Mal automatisch von GitHub. Wortzeiten exakt aus den Lautdauern des Modells. Fehlende Wörter (z. B. „Xbox“) bekommen automatisch eine Aussprache. Englische Stimmen: `af_heart` (US, weiblich, beste), `af_bella`, `am_michael`, `am_fenrir`, `am_puck` (US, männlich), `bf_emma`, `bm_george`, `bm_fable` (britisch). Abkürzungen per `speak` buchstabieren: `"speak": "G T A six"`, Zahlen ausschreiben.
Deutsche Stimmen (Piper): `thorsten` (männlich, beste Qualität), `thorsten-medium`, `thorsten-emo:<amused|angry|disgusted|drunk|neutral|sleepy|surprised|whisper>`, `kerstin`, `ramona`, `eva` (weiblich), `karlsson`, `pavoque`.
Satzweise gesprochen (natürliche Betonung); ein Satz darf über mehrere Shots gehen. Emojis werden nicht vorgelesen.
**Natürlicher Klang** (`natural`): Fragen etwas langsamer, Ausrufe schneller, „…“ gedehnt; Pausen je Satzzeichen (Frage/„…“ länger); leichte, feste Variation pro Satz; mehr Satzmelodie.
**Klangkette** (`fx`): Trittschallfilter, weniger Mulm, mehr Präsenz und Höhen, sanfter Kompressor, kleiner Raum. Musik wird unter der Stimme automatisch leiser.
Abkürzungen („z.B.“, „Dr.“) und englische Namen ggf. per `speak` ausschreiben.

## Dateien
- `studio.py` – Pipeline (Timing → Rendern pro Shot → concat → Ton)
- `audio.py` – Timing aus Text/Voiceover, Musik- und Soundeffekt-Synthese
- `tts.py` – Sprecherstimme (Piper): Installation, Stimmen-Download, Synthese, exaktes Wort-Timing
- `engine/` – WebGL-Renderer (core.js), Figuren/Requisiten (assets.js), Orte (sets.js), Regie/Kamera/Untertitel (director.js)
- `beispiele/gaehn_regel.json` – Demo-Episode (64 s, 38 Shots)
- `beispiele/gaehn_regel_kurz.json` – alte 26-s-Fassung (`"length": false`)
