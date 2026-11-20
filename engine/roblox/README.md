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
Rendern: ca. 0,7 s pro Frame (60 s Video ≈ 21–25 min). `--rs 0.6` = schneller, etwas weicher.

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
| Looks (`cast`) | boy, girl, man, woman, dad, mom, grandpa, grandma, teacher, cop, chef, king, kid, mayor, **gamer, hero, wizard, student, worker, cowboy** – plus Felder: skin, shirt, pants, shoes, sole (Sohlenfarbe), hair (short, spiky, side, messy, long, bob, ponytail, pigtails, bun, afro, curly, buzz, mohawk, cap, beanie, bald), hairColor, eyeColor, hat (crown, tophat, party, chef, helmet, hardhat, cowboy, beret, wizard, santa, viking, grad, bunny, bandana, halo, cap), glasses, shades, eyepatch, beard, mustache, lashes, freckles, logo (star, heart, bolt, smile, flame oder Text), pattern (stripes, dots, plaid, split) + patternColor, sleeves (long, short, none), shorts, boots, skirt, scale |
| Accessoires | `true` oder Farbe: backpack, scarf, tie, bowtie, chain, jacket, vest, hoodie, apron, sash, badge, belt, watch, headphones, headband, bow, flower, earrings, cape, wings, buttons, collar:false – Haare, Zöpfe, Umhang und Flügel schwingen automatisch mit (Laufen, Springen, Wind) |
| Tiere | `"animal"`: dog, cat, fox, lion, pig, bear, sheep, cow, penguin, frog, chicken, croc (Krokodil), shark (Hai, schwebt) |
| `do` | (alle mit Ellbogen/Knien) idle, walk, run, sneak, game (zocken), sitgame, wave, wave2, cheer, jump, hop, point, pointup, talk, dance, sit, sitdesk, lie, yawn, stretch, throw, fall, faint, spin, scared, shrug, clap, think, nod, no, facepalm, look, lookup, carry, hold, laugh, cry, angry, kick, punch, bow, float, freeze – auch zeitlich: `[["walk",0,0.5],["wave",0.5,1]]` |
| `mood` | happy, smile, neutral, talk, grin, laugh, surprised, shock, sad, cry, angry, sleepy, sleep, yawn, scared, cool, smug, wink, love, think, evil, confused, dizzy |
| Figur-Extras | `face` (Grad, "cam" oder Figur-ID), `path`, `move` [t0,t1], `y`, `scale`, `emote` (Emoji oder "zzz"), `bubble` (Sprechblase), `hold` (Requisit; Controller beidhändig: `{"type":"controller","both":true}`), `throw` {item,to,at,arc}, `talk` |
| `cam` | wide, aerial, dolly, group, close:ID, medium:ID, full:ID, low:ID, high:ID, side:ID, back:ID, orbit:ID, ots:A>B, pov:ID, top, free {eye,look,eye2,look2} – Optionen: ang, dist, zoom, pull, fov, shake |
| `props` | sign, board, banner, number, bigtext, coin, coins, apple, banana, carrot, ball, gift, cake, pizza, burger, icecream, phone, book, cup, trophy, crown, star, bed, blanket, chair, table, desk, bench, tree, pine, bush, rock, flower, lamp, fence, car, bus, umbrella, lounger, flag, tv, clock, alarm, bell, cone, trash, balloon, box, door, campfire, sandcastle, palm, mailbox, pool, flashlight, controller, console (`light`: Farbe LED) – Optionen: at, ry, s, text, color, pop, hide, spin, bob, fly {to,t,arc}, on (Figur) |
| `fx` | coins, confetti, poof, snow, rain, hearts, sparkle, emojis, flash, dark, shake, zoom – `{type, t, at, n, dur}` |
| `pops` | Text/Emoji-Einblendung (auch Flaggen 🇳🇿): `{text, x, y, t, color, size, at, rise}` |
| `sfx` | pop, coin, ding, whoosh, boing, poof, boom, riser, tada, tick, snore – `[["ding",0.3]]` |

Zeiten in Shots (`t`, `move`, `pop` …) sind **Anteile** des Shots (0–1), damit sie mit jedem Voiceover-Timing passen.
Koordinaten: Bühne um (0,0), Kamera standardmäßig bei +z; `face: 0` = Richtung Kamera.

## Version 6 – was neu ist
- **Natürlichere Animation:** Aktionen gehen weich ineinander über (0,3 s) statt zu springen; Anlaufen und Abbremsen werden eingeblendet; Rennen hat längere Schritte (kein Rutschen).
- **Blicke:** Wer nicht spricht, dreht Kopf, Augen und Oberkörper zur sprechenden Figur; Sprecher schauen in die Kamera. Eigenes Ziel per `"look": "<id>" | "cam" | false` (auch zeitgesteuert).
- **Gestik beim Reden (`talk`):** Bibliothek aus 7 Gesten (erklären, offene Hände, zeigen, Hand auf Brust, aufzählen, Achselzucken, Hand in Tasche), weich überblendet, mit Betonungs-Schlägen und Nicken.
- **Stehen:** verschiedene Haltungen je Figur (locker, Hände in den Hüften, Hände in den Taschen) – fest setzbar mit `"idle": "relaxed" | "hips" | "pockets" | "pocket"`.
- **Realistischere Körper:** Hals, Becken, Schulter-, Ellbogen- und Kniekappen (keine Lücken mehr beim Beugen), Hände mit Fingern und Daumen.
- **Kleidungs-Physik:** Umhang, Pferdeschwanz, Zöpfe, Krawatte, Jackenschöße, Schalende, Hoodie-Bänder, Rucksack und Rock sind gedämpfte Pendel – sie reagieren auf Anlaufen/Bremsen, Fahrtwind, Drehungen, Sprünge, Körperneigung und Wind.
- **Gegenstände natürlich platziert:** kleine Dinge (Torte, Buch, Tasse, Apfel …) landen automatisch auf Tischen/Pulten/Betten, wenn man sie dort hinstellt; nichts steckt mehr in Figuren, auf ihren Laufwegen oder ineinander (wird sanft weggeschoben, max. 3 Einheiten); leichte Zufallsdrehung; Kontaktschatten. Abschalten pro Gegenstand: `"natural": false` bzw. `"pin": true`. Neu: `"drop": 0.3` (fällt zum Zeitpunkt herunter und prallt ab, Höhe `dropH`).
- **Kamera:** weiches Nachführen bei laufenden Figuren, alle Fahrten mit Easing, leichter Bogen-Drift, sanftes Handkamera-Atmen (`"steady": true` / `"handheld": 0.5`), Vorlauf-Raum in Laufrichtung, Nahaufnahmen mit längerer Brennweite. **Automatisches Ausweichen**, wenn eine andere Figur, Möbel oder eine Wand die Sicht verdecken würde (Winkel/Abstand werden pro Shot angepasst; `"ang"` oder `"fixed": true` schaltet das ab).
  Neue Fahrten: `push:<id>` (ranfahren von halbnah auf nah, `from`/`to`), `crane:<id>` (Kran hoch, `down: true` = runter, `h`), `reveal:<id>` (vom Gesicht weg auf die Szene, `dist`), `arc:<id>` (Halbkreis, `sweep`), `track:<id>` (fährt seitlich mit, `side`, `dist`).

## Version 5
- **Grafik:** weiche Schatten (PCF), Glanzlichter, Randlicht an Figuren, Kontaktschatten unter Füßen, Abdunklung an Hauswänden unten, Bodenmaserung, Sonne/Mond mit Schein am Himmel, Bloom (Fenster/Laternen leuchten nachts), weichere Lichter, schärfere Gesichter (512 px).
- **Wasser:** Teich, Pool, Springbrunnen und Meer bewegen sich und glitzern. **Wind:** Bäume, Büsche, Palmen wiegen sich.
- **Figuren:** Ellbogen + Knie (R15-artig) → natürliches Gehen/Laufen mit Kniebeuge, Sitzen mit hängenden Beinen, Werfen mit Ausholen. Gewichtsverlagerung, Blicke, Atem im Stehen, sanftes Eindrehen beim Loslaufen und in Kurven, Sprünge mit Ausholen/Landung (Squash & Stretch), 3 Mundstufen beim Reden, Hände an Kinn/Gesicht bei think/facepalm/cry.
- **Physik:** Würfe starten an der echten Hand, fliegen auf einer Parabel, prallen vom Ziel (Kopf!) ab, hüpfen und rollen aus. Münzen springen, prallen ab und bleiben flach liegen. Konfetti flattert mit Luftwiderstand und bleibt am Boden liegen. `fly`-Requisiten landen mit Wackeln; nur runde Dinge rollen. Optionen: `throw.bonk:false`, `throw.bounce:false`, `throw.rest`, `fly.bounce`, `fly.spin`.
- **Leben im Hintergrund** (automatisch, läuft über Schnitte weiter): Autos mit drehenden Rädern + Licht, Passanten (teils mit Hund), Jogger, spielende Kinder, Zuschauer auf der Tribüne, Leute im Gespräch, Katzen auf dem Zaun, Vogelschwärme/Möwen, Flugzeug mit Kondensstreifen, Heißluftballon, Windräder, Enten, pickende Tauben, Springbrunnen-Strahlen, Segelboote, Brandung, Schmetterlinge, Glühwürmchen (nachts), Staub im Licht (innen). Alles, was eine Hauptfigur verdecken, berühren oder groß in den Vordergrund laufen würde, wird pro Shot automatisch weggelassen.
  Steuerung (Shot oder Episode): `"life": false` | `"calm"` | `"busy"` | `{"cars":1,"people":1,"birds":1,"extras":1}`. `"bloom": 0.3` pro Shot überschreibt die Leuchtstärke.

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
- `engine/` – WebGL-Renderer + Shader (core.js), Figuren/Accessoires/Requisiten (assets.js), Orte (sets.js), Hintergrund-Leben (life.js), Regie/Posen/Physik/Kamera/Untertitel (director.js)
- `beispiele/gaehn_regel.json` – Demo-Episode (64 s, 38 Shots)
- `beispiele/gaehn_regel_kurz.json` – alte 26-s-Fassung (`"length": false`)

## Ergänzungen aus dem Shorts-Chat (in Version 5 übernommen)
- **Sets:** elevator (open, lit, light), hallway (name, doorOpen), snow (Antarktis), kitchen (green, top, cabinet, wall; Arbeitsplatte y≈2.45).
- **Requisiten:** controller, console, keys, piano, stool, panel, display, tower, ghostfloors, pen, smartphone (Chat-Bildschirm: name, sub, msgs, typing, lock, notif, stamp, time, avatar, nameColor), pebble, nest, cutboard (Schneidebrett), tray, cabbage, shreds, radish, meat, meatslice, helper (Küchen-Multitool). Tier: guineapig.
- **Requisiten-Animation:** `rx`, `rz` (Grad), `grow: [t0, t1, von, bis]` (Skalierung, auch [x,y,z]), `jig` (Wackeln).
- **Posen:** piano, chop, shred, slice (+ Tier-Pose float). Gesicht: `scar`.
- **Halten:** `hold: {type, dir: 'arm', hand: 'L'}`, `both: true` für Controller.

## Viral-Werkzeuge (mehr Aufrufe)
Episode-Feld `"viral"` – wird automatisch in die Shots eingebaut:
```json
"viral": { "hook": "THIS TOWN\nBANS YAWNING", "series": "WEIRD TOWNS #4", "cta": "YES or NO? 👇", "loop": true }
```
- `hook` – großer, wackelnder Text ab Frame 1 im ersten Shot (die ersten 2 s entscheiden). Titel erscheint erst danach.
- `series` – Serien-Abzeichen oben in jedem Shot (Leute folgen für die nächste Folge).
- `cta` – große Kommentar-Frage im letzten Shot.
- `loop` – die letzten 0,4 s blenden ins erste Bild über → Video läuft nahtlos weiter (mehr Wiederholungen).

**Viral-Check** (bei jedem Lauf, nur Hinweise): Hook vorhanden, kein `pause` im 1. Shot, 1. Shot ≤ 2,2 s, keine Shots > 3 s,
Schluss mit Frage/CTA, 3–6 Hashtags, Loop an.

**Skript-Regeln:** 1. Satz = Hook (Schock-Aussage oder Frage, keine Einleitung wie „Imagine…“) · alle 1–2 s neues Bild ·
Twist erst ganz am Ende · letzter Satz führt in den ersten zurück (Loop) · Ja/Nein-Frage an die Zuschauer ·
3–5 passende Hashtags inkl. Nischen-Tag (z. B. `weirdtowns`, `fortnitelore`).

## Trend-Tänze (Ergänzung)
- Neue Tanz-Aktionen im Takt: `strut` (Stolzier-Schritt), `jazzhands` (Arme weit + Seitenkick), `salute` (Hand an die Stirn), `twist` (Oberkörper-Twist). Pro Figur `bpm` (Standard 120) und `boff` (Versatz in s, damit Schritte auf den Beats liegen); der Takt läuft über Schnitte weiter. Shots ohne Text über `dur` (Sekunden) auf Beats schneiden.
- Look-Feld `gloves` (`true` = weiß oder Farbe) färbt die Hände.
- Set `paris`: Platz bei Nacht mit leuchtendem Gitterturm (Optionen über `setOpts`: `color`, `towerZ`), mit `"time": "night"` verwenden. Neues Leucht-Mesh `S.neon` (wird nachts nicht abgedunkelt).
- Eigene Musik: `"musicFile": "datei.wav"` (relativ zur episode.json), optional `musicStart`, `musicGain` – ersetzt die generierte Musik. Nur Musik mit Nutzungsrechten veröffentlichen; Trend-Sounds bei TikTok/Instagram besser in der App hinzufügen.
- Weitere Aktionen: `turnaround` (eine Drehung über den Zeitabschnitt), `finale` (Schlusspose, Arm hoch). Freie Kamera mit leichtem Handkamera-Wackeln: `"cam": {"type": "free", …, "handheld": 0.6}`.
- Beispiel: `beispiele/trend_tanz.json` (eine durchgehende Einstellung wie Handy-Video) (rendern mit `--no-tts --force`, da kürzer als 40 s).

## Großes Update (20.11.2026)
- **Rauszoomen:** Viral-Folgen zeigen automatisch mehr Umgebung (`camFar`, Standard 1.4; close ×1.55, medium ×1.25 zusätzlich). Pro Episode `"camFar": 1.0` = alter Look, pro Kamera `"far": 2`.
- **Motion-Capture:** `tools/mocap_extract.py video.mp4 kp.json --people 2` (YOLO-Pose, Gewichte `yolo11m-pose.pt` von GitHub/ultralytics) → `tools/mocap_retarget.py kp.json mocap.json [--smooth 3]` (Glättung gegen Zittern, Standard 3 Frames) → Figur mit `"do": "mocap", "mocap": {"fps", "keys", "frames", "start", "gain", "move"}` (frames = `people[i].frames`, Person 0 = links im Video). Bewegung wird 1:1 aus dem Video übernommen.
- **Rig:** Look-Felder `slim` (z. B. 0.8) und `tall` (z. B. 1.12) für schlankere/größere Figuren; Taillenbeugung `wz`, runde Ellbogen/Knie ab 8°, Hüftkugeln bei angehobenem Bein.
- **Tanz-Posen:** `cross`, `chicken`, `kneelift`, `figure4`, `kickback`, `wavearms`, `stand`, `headhand` (im Takt über `bpm`/`boff`); Figur-Felder `headhand`, `finaleKnee`. Look: `flare` (Schlaghose), Muster `knit`.
- **Sets:** `danceroom` (heller Raum, Holztür, Holzdecke, Fliesen), `stadium` (Rasen, Linien, Tore, volle Tribünen, Flutlicht).
- **Props:** `lightbeam`, `motes` (Staub im Licht), `potplant`, `window`, `rug`, `fries`, `soda`, `bleachers`. Höhe über `"at": [x, y, z]`.
- **Overlays:** Figur `"counter": {"from", "to", "t0", "t1", "suffix"}` (Zahl-Pille über dem Kopf), Shot `"score": {"home", "away", "a", "b", "from": [a0, b0], "t"}` (Anzeigetafel), Shot `"counter": {"label", "from", "to"}` (großer Zähler).
- **Look-Nachbearbeitung:** Episode `"grade": {"bloom": 0.35, "vignette": 0.3, "warm": 0.04, "sat": 1.08}`.
- **Qualitätsprüfung** nach jedem Export: Auflösung, Länge, Tonspur, schwarze Bilder, Standbilder (Log „Qualitätsprüfung: ✓ ok“ oder ⚠ mit Grund).
- **Verteiltes Rendern:** `studio.py … --part K/N` rendert nur Teil K von N (Shots nach Bildanzahl verteilt); ein normaler Lauf danach setzt aus dem Cache zusammen (bildgleich geprüft). In GitHub Actions automatisch 4 Teile (Repo-Variable `VF_RENDER_PARTS`); fehlende Teile rendert der Haupt-Job selbst.

### Mocap gegen Zittern (20.11.2026)
`tools/mocap_retarget.py` filtert jetzt in 4 Stufen:
1. Winkel entfalten (`np.unwrap`) – Sprünge über ±180° waren die Hauptursache fürs Zucken.
2. Savitzky-Golay (erhält Spitzen wie Kicks).
3. One-Euro-Filter vor+zurück (`--euro 0.9 --beta 0.004`): ruhig bei langsamen, scharf bei schnellen Bewegungen, ohne Verzögerung.
4. Geschwindigkeitsgrenze `--maxvel 14` (Grad/Frame).
Ergebnis Tanz-Test: max. Sprung 37°→14°, Zittern (2. Ableitung) −45 %, Bewegungsumfang ~95 % erhalten.
Abschalten: `--euro 0 --maxvel 0`.
- **Set `xmasmarket`** (20.11.2026): weihnachtliche Altstadt bei Nacht mit Weihnachtsmarkt – Buden mit Lichterketten, großer Baum mit Stern, verschneite Dächer. Mit `"time": "night"` + fx `snow` verwenden; Passanten als Figuren mit `do: walk`, `at`/`to`, `move: [0,1]`, `ease: linear` bei z ≈ −10…−21.
- **Set `snowyard`** + Prop **`snowman`** (Option `scarf`-Farbe): verschneiter Garten am Waldrand mit Haus, Zaun, Schaukel.
- **Mocap realistischer (20.11.2026):** `mocap_retarget.py` gleicht jetzt die Größe je Frame aus (`--depthnorm 1`, Person läuft auf Kamera zu/weg → keine falsche Hocke) und setzt den tiefsten Fuß immer auf den Boden (`--ground 1`, kein Schweben/Einsinken). Neue Mocap-Spur `dz` (Vor/Zurück); `dx`/`dz` bewegen jetzt die Figur selbst, Schatten folgt. Für schnelle Tänze: `--euro 1.8 --beta 0.05 --maxvel 0 --smooth 1.4`.
- **Set `mall`** (20.11.2026): Einkaufszentrum – langer Gang entlang z (Kamera bei z≈5, Blick nach −z), Läden mit Leuchtschildern auf zwei Etagen, Galerie mit Glasgeländer, Oberlichter, Pflanzen, Brunnen. Passanten mit `do: walk`, `at`/`to`.

## Tanz nachbauen in einem Schritt (20.11.2026)
`python tools/tanz_nachbauen.py tanz.mp4 ordner/ [--people 2] [--set mall|danceroom|hallway|xmasmarket|…] [--pin 0|1]` → `ordner/episode.json`, dann `python studio.py ordner/episode.json -o ordner/tanz.mp4 --force`.
Alle Verbesserungen sind jetzt Standard:
- `mocap_retarget.py`: schnelle, natürliche Glättung (`--euro 1.8 --beta 0.05 --maxvel 0 --smooth 1.4`), Winkel-Entfaltung, Savitzky-Golay, Oberkörper-/Kopf-Glättung (`--bodysmooth 3`), Tiefenausgleich (`--depthnorm 1`), Bodenkontakt (`--ground 1`), Vor/Zurück-Spur `dz` (`--depth 1`, `--camdist 14`), Seitwärts `dx` größennormiert, `--pin 1` = Figur bleibt am Platz.
- Director: `dx`/`dz` bewegen die Figur selbst (Schatten folgt, kein Schweben).
- `studio.py`: Episode-Feld `"motionBlur": true` (leichte Bewegungsunschärfe); Shot-Cache enthält den Engine-Stand (nach Engine-Änderungen wird automatisch neu gerendert).
- Neue Orte: `xmasmarket`, `snowyard`, `mall` (Option `width`); Requisit `snowman`.
- **Set `patio`** (Terrasse vor großem Landhaus mit Giebel, Balkon, Steinsäulen; Option `z` für Hausabstand) und Look-Feld **`crop`** (bauchfreies Crop-Top, `true` oder Streifenhöhe).

## 4K-Look (HQ) (20.11.2026)
`studio.py` rendert standardmäßig im 4K-Look (`--quality hq`, Episode-Feld `"quality": "classic"` oder Umgebungsvariable `VF_QUALITY=classic` für den alten Look):
- Render-Skala 1.25 (Supersampling, `VF_RS`), MSAA, weiche PCF-Schatten, Wolkenhimmel, Tiefenunschärfe hinter dem Fokus (Kamera-Feld `dof`, `focus`), Bildraum-Umgebungsverdeckung (SSAO), Tonkurve, Glanz auf Böden, Nachschärfen + Filmkorn (`"post": false` schaltet ab).
- **Materialien:** Holz, Stein, Ziegel, Putz/Beton, Stoff, Jeans, Strick, Dachschindeln, Gras, Metall, Haar, Holzverkleidung, Schnee, Blätter – prozedural im Shader. Kulissen/Requisiten werden automatisch nach Farbe/Ausrichtung zugeordnet, Figuren nach Kleidungsfarben (`MAT`, `autoMat` in core.js; eigenes Material: `mb.mat = <id>`).
- In GitHub Actions per `VF_QUALITY` in `.github/workflows/vf-render.yml` schaltbar; Rendern auf 12 Teile verteilt. Test ohne Upload: Workflow „Engine-Test (ohne Upload)“.
- **Requisit `paper`** (20.11.2026): Test-/Klassenarbeitsblatt mit Note (`grade`, `gradeColor`, `marks`: "x" oder "v"), liegend oder `up: true`; `crumpled: true` = zerknüllte Papierkugel.
