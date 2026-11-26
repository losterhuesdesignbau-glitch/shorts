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
| Stimme | Kokoro (`af_heart`), normales Tempo, De-Esser, Huss-Rhythmus, Pause bei Uhrzeiten. | `tts.py` |
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
