# Mii Town – Bestandsaufnahme und Umbauplan (Phase 0, 26.11.2026)

**Sicherung:** Branch `sicherung-vor-mii-town-2026-11-26` (Commit `7e42235`). Damit lässt sich jederzeit auf den Stand vor dem Umbau zurück.

## 1. Wie die Videos heute entstehen (Ist-Zustand)

**Kein KI-Bild und kein KI-Video. Es ist echtes 3D-Rendering:**
- Eigener WebGL-Renderer (`engine/core.js`).
- Er läuft in Headless-Chromium (Playwright) und rendert Bild für Bild in echtem 4K (2160×3840, 30 fps).
- Auf GitHub Actions wird jedes Video in 16 Teile aufgeteilt, die parallel rendern.

| Bereich | Ist-Zustand | Datei |
|---|---|---|
| Figuren | Prozedural aus Quadern/abgerundeten Quadern/Kugeln gebaut (Block-Stil). Gleicher Körperbau für alle, Looks über Farben/Frisuren/Hüte/Brillen. 15 Tiermodelle. | `engine/assets.js` (`avatarGeo`) |
| Gelenke | Starre Teile in einer Hierarchie (Forward Kinematics): Becken/Wurzel, Oberkörper (Beugen/Drehen), Kopf (3 Achsen), Schultern (3 Achsen), Ellbogen, Hüften (2 Achsen), Knie. **Kein** Skinning (keine verformten Meshes), **keine** Finger, **kein** IK-Löser. | `engine/director.js` (`pose`) |
| Bewegungen | 71 fest programmierte Aktionen (walk, run, talk, point, shrug, sit, jump …), Laufen entlang Pfaden. | `engine/director.js` |
| Gesicht | Auf den Kopf gemalte Textur: Augen, Brauen, Mund, 20+ Stimmungen. Blinzeln vorhanden. Lippen-Bewegung aus der Lautstärke der Stimme. | `engine/assets.js`, `director.js` |
| Welt | 23 Sets (street, house, school, classroom, plaza, stadium, snow …) mit Tageszeiten und Wetter. Statisten (`life`), Menschenmengen (`crowd`). | `engine/sets.js`, `life.js`, `studio.py` |
| Licht | Schatten, Kontaktschatten (SSAO), Tiefenunschärfe, Glanzlichter, Randlicht, Nebel. Danach Farblook je Serie über ffmpeg. | `engine/core.js`, `studio.py` |
| Stimme | Kokoro (`af_heart`), normales Tempo, De-Esser, Pause bei Uhrzeiten. | `tts.py` |
| Musik/Sound | Eigene Synthese (SoundFont), 30+ eigene Effekte und Meme-Sounds, automatisches Sounddesign. | `score.py`, `audio.py` |
| Regie/QA | Inhalts- und Physikprüfung vor dem Render, Bild/Ton-QA danach, Aussprache-Prüfung. | `regie.py`, `engine/check.js`, `tools/qa.py`, `tools/aussprache.py` |
| Veröffentlichung | ViralFlow (Engine 2): Render → Cloudflare R2 → Zeitplan → YouTube/Instagram/TikTok. | `viralflow/` |

## 2. Was technisch geht – und was nicht (ehrlich)

| Wunsch | Umsetzbar? | Wie |
|---|---|---|
| Mii-artige Figuren (großer Kopf, kleiner Körper, runde Formen) | **Ja** | Neuer Körperbau `style: "mii"` im bestehenden Figurenbau: Kopf ~1,6×, kurzer runder Körper, abgerundete Glieder, eigene Gesichtsformen. Eigenes Design, keine Nintendo-Assets. |
| Variierbare Gesichter (Form, Augen, Pupillen, Brauen, Nase, Mund, Ohren) | **Ja** | Gesichtsform als Kopf-Mesh, Nase/Ohren als kleine Meshes, der Rest in der Gesichtstextur. |
| Feste Identität über alle Videos | **Ja** | Zentrale Figuren-Datenbank `episodes/figuren.json` mit festen IDs. Neue Namen werden einmalig erzeugt (Seed aus dem Namen) und danach nie mehr verändert. |
| Figuren automatisch aus dem Skript | **Ja** | Werkzeug liest Cast/Namen, nutzt vorhandene Figuren, legt neue an. |
| Ausdrücke inkl. angeekelt, Blickrichtung | **Ja** | Neue Stimmungen und Pupillen, die zur Kamera oder zu anderen Figuren schauen. |
| Natürlicheres Gehen/Rennen ohne Fußrutschen | **Ja (deutlich besser)** | Schrittlänge an das echte Tempo koppeln (Fuß bleibt stehen), Gegenschwung der Arme, Hüftschwung, Vorneigung beim Rennen, weiche Übergänge. |
| Idle (Atmen, Gewicht, Blick) | **Ja** | Ruhe-Schicht über allen Aktionen. |
| Gesten passend zum gesprochenen Wort | **Ja** | Wort-Timing der Stimme ist vorhanden: Gesten-Bibliothek (offene Hand, zeigen, zählen, Schulterzucken, Hand auf Brust, Nicken) auf Betonungen legen, mit Abwechslung. |
| Drehen: Kopf zuerst, dann Oberkörper, dann Beine | **Ja** | Zeitversetzte Drehung über die vorhandenen Gelenke. |
| Echtes Skelett mit Skinning, Fingern, IK/FK-Blending | **Teilweise** | FK gibt es schon. Ein einfaches 2-Gelenk-IK für Füße (Bodenkontakt) ist machbar. Verformbare Meshes und Finger würden einen neuen Renderer bedeuten → nicht in diesem Umbau. |
| Kategorie-Intros mit eigenem Satz, Bild und Sound | **Ja** | Kategorie aus der Serie erkennen (überschreibbar), 1–2 s Intro aus den Figuren und Orten der Folge, Logo-Einblendung, eigenes Sound-Motiv in 7 Varianten. |
| Qualitätsbericht (Figuren gleich, Fußrutschen, Übergänge …) | **Ja** | Bestehende Regie/QA erweitern: Figuren-Abgleich mit der Datenbank, Fußrutschen-Messung, Intro-Prüfung. |

## 3. Umbauplan (schrittweise, jeder Schritt mit privatem Testvideo)

1. **Figuren-Datenbank + Mii-Körperbau + Gesichtsbaukasten.** Test: 3 deutlich verschiedene Figuren, eine davon in mehreren Szenen.
2. **Bewegung.** Idle-Schicht, neues Gehen/Rennen ohne Rutschen, Drehen in Stufen, Gesten zum Text. Test: Idle, Walk, Run, Talk, Gesten, Drehen, Reaktionen.
3. **Mii-Town-Welt + Intros + Sound-Motiv.** Logo, Kategorie-Farben, 7 Intro-Varianten. Test: 7 Beispiel-Intros.
4. **Szenen-Integration.** Figuren reagieren mit Körper, Kopf, Blick und Gesicht. Automatische Figurenwahl aus dem Skript.
5. **QA-Erweiterung + Qualitätsbericht.**
6. **Komplettes Testvideo (35–40 s)**, danach Doku, Abnahme durch Lukas und erst dann Umstellung der täglichen Läufe.

Die bisherigen Episoden bleiben renderbar: Der alte Block-Stil bleibt als `style: "block"` erhalten.

## Stand 26.11. (Schritte 2+3)
- Schritt 2 Bewegung: Schrittlänge passt zur Figurgröße (kein Fußrutschen), Gesten wechseln an Wortgrenzen (alle 3 Wörter, nie 2× gleich), Betonungsgeste auf `*Wort*`, Kopf dreht vor dem Körper. Test 2 (Gehen/Rennen/Reden/Drehen/Warten) gerendert, QA ✓.
- Schritt 3 Universum: `sfx motif_<kategorie>` (7 eigene Motive), `mii_intro()` in studio.py – Kategorie aus `category` oder Musik/Serie/Titel, Intro-Satz, „MII TOWN“-Logo in Kategorie-Farbe, Bild aus eigenen Figuren/Orten der Folge. Aus mit `"intro": false`. Nur bei Mii-Figuren (`style: mii`) automatisch. Hook/Viral-Check/Regie zählen ab dem ersten echten Shot.
- Test 5: 7 Intros als Standbilder geprüft (Innenräume: Figur bleibt auf ihrem Platz aus Shot 1).

## Stand 26.11. (Schritte 4+5)
- Schritt 4 Szenen: Zuhörer reagieren mit Körper, Kopf und Blick (Nicken im Gesprächstakt, Ruck auf betonte Wörter, je Figur versetzt). Neue Figuren aus dem Skript (`"@id"` oder `{"char": "id", "age": …}`) werden automatisch erzeugt – deterministisch aus der id, also immer gleich; festschreiben mit `python tools/figuren.py auto <episode>`.
- Schritt 5 QA: `mii_check` vor dem Rendern (Identität gegen Datenbank, Fußrutschen = Bewegung ohne walk/run, fehlendes Intro), Qualitätsbericht `<video>_bericht.md` nach dem Rendern. Fix: auto_sfx mit Zeitlisten in `do`/`mood`.
- Schritt 6: Testvideo `episodes/tests/mii_town_test.json` (24 Shots, 40 s, Kategorie comedy).

## Offene Punkte (26.11.)
- Testvideo nur über Standbilder + automatische Prüfung kontrolliert; das fertige MP4 kann ich hier nicht herunterladen (Netz-Sperre) → Abnahme durch Lukas.
- Gruppen-Shots wirken weit weg (Viral-Kamera `camFar 1.4`); evtl. für Mii Town näher.
- Mias Blockfrisur verdeckt teils die Augen; Rosas Dutt wirkt wie ein Helm.
- Ladenschilder am Platz sind deutsch (BÄCKEREI, KIOSK) – für englische Videos umstellen.
- Nach Abnahme: tägliche Läufe neu planen, ABLAUF/AUFTRAEGE auf Mii-Figuren umstellen.

## 26.11. Mii-Look nachgeschärft (Lukas: „mehr wie originale Mii“)
- Kopf fast kugelrund, glatte Haar-Schalen statt Klötzchen (Haaransatz: Stirn frei, Schläfen bis zum Ohr), Dutt/Locken/Zöpfe rund.
- Körper: glockenförmiger Oberkörper mit schmalen Schultern, einfarbiges Oberteil (keine Muster/Logos), dünne Arme, Kugelhände, schlanke Beine, runde Schuhe.
- Regenschirm wird am Griff gehalten (`hold.off`).
- Offen: Haaransatz an den Schläfen noch leicht stufig.

## 26.11. Mii-Look v2 (Referenzbild von Lukas: klassische Mii-Menge)
- Kopf kleiner (×0,82, ≈ Schulterbreite), kleine natürliche Augen (großer dunkler Iris-Anteil), dünne kurze Brauen, kleiner Mund, keine Dauer-Röte, kleinere Ohren.
- Schlanker Körper: Schultern ±0,9, dünne Arme/Beine, kleine Kugelhände, kleine Füße; Jacke/Weste ohne Kastenteile.
- Hautfarben weich und wenig gesättigt (Palette in figuren.py, bestehende Figuren umgestellt).
- Haaransatz glatt (Grenze je Längengrad per Bisektion).
