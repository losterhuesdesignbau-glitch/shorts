# Aufträge der 6 täglichen Sendeplätze (Lukas, 22.11.2026)

Alle Läufe laufen in **Lukas' Haupt-Chat** (eine Claude-Sitzung), nicht in neuen Chats.
Seit 28.11.: EIN Tages-Paket-Lauf um 05:00 (siehe unten), der sich Tag für Tag selbst weiterplant.
Komplett automatisch, ohne Freigabe.

## TAGES-PAKET (seit 28.11., Lukas: „Nutzung soll nicht so schnell weg gehen“)
Statt 6 einzelner Läufe gibt es **einen Lauf pro Tag um 05:00** (Berlin), der ALLE 6 Videos des Tages baut.
Name der Nachricht: `Tages-Paket · TT.MM.` · Text: `jetzt – Tages-Paket: alle 6 Videos für heute (komplett automatisch, ohne Freigabe). /home/claude/shorts: git pull, dann engine/roblox/AUFTRAEGE.md Abschnitt „TAGES-PAKET“ und engine/roblox/ABLAUF.md befolgen.`

Ablauf des Pakets:
1. **Weiterplanen zuerst:** `send_later` für das Paket von MORGEN anlegen (`at` = `<morgen>T05:00:00[Europe/Berlin]`, `initiation` = `human_schedule`, Name/Text wie oben). Keine einzelnen `Short HH:MM`-Läufe mehr anlegen.
2. Die 6 Folgen in Slot-Reihenfolge schreiben (Inhalte: Abschnitte 08:00 … 21:00 unten). In jede `meta` **`"slot": "HH:MM"`** eintragen – der Render-Job legt das Video damit fest auf diese Sendezeit (render_job.py → reschedule).
3. Je Folge: themen.py check, `--stills` (EINE verkleinerte Vorschau ansehen, nur gezielt nachbessern), aussprache.py, alle ABLAUF-Prüfungen (Länge ≥ 45 s, Mii-Check, BILD≠TEXT = 0).
4. **Reihenfolge Push:** 08:00 sofort pushen, sobald fertig (muss bis ~06:30 rendern), dann die übrigen nacheinander (jeweils eigener Commit, nicht gleichzeitig dieselbe Datei).
5. themen.py add für alle 6.
6. Kontrollen wie bisher: pro Video ein `send_later` um SLOT+10 Min. (Render-Run-ID, Titel, Plattformen). Genau EINE Push je Video.
7. Kurze Zusammenfassung an Lukas (6 Titel in 6 Zeilen).

Fällt das Paket aus/kommt zu spät: Videos, deren Slot schon vorbei ist, NICHT nachholen; die restlichen bauen.

## (alt) Einzel-Läufe – nur noch Referenz für die Slot-Abschnitte
1. `list_triggers` (recurring=false) ansehen: Für **jeden** der 6 Sendeplätze unten muss der nächste Termin
   (heute später oder morgen) als ausstehende Nachricht existieren. Name: `Short HH:MM · TT.MM.`
2. Fehlt einer (auch der eigene für morgen): mit `send_later` anlegen:
   - `at` = `<Datum>T<START>:00[Europe/Berlin]`
   - `initiation` = `human_schedule`
   - `name` = `Short <SLOT> · <TT.MM.>`
   - `message` = der Nachrichtentext aus der Tabelle (genau so).
3. Doppelte Termine nicht anlegen. Keine wiederkehrenden Aufgaben anlegen oder ändern (kein create_trigger/update_trigger).

| SLOT | START | Nachrichtentext |
|---|---|---|
| 08:00 | 06:45 | `jetzt – automatischer Lauf für den 08:00-Post (komplett automatisch, ohne Freigabe). /home/claude/shorts: git pull, dann engine/roblox/AUFTRAEGE.md Abschnitt „08:00“ und engine/roblox/ABLAUF.md befolgen.` |
| 10:00 | 08:45 | `jetzt – automatischer Lauf für den 10:00-Post (komplett automatisch, ohne Freigabe). /home/claude/shorts: git pull, dann engine/roblox/AUFTRAEGE.md Abschnitt „10:00“ und engine/roblox/ABLAUF.md befolgen.` |
| 12:30 | 11:15 | `jetzt – automatischer Lauf für den 12:30-Post (komplett automatisch, ohne Freigabe). /home/claude/shorts: git pull, dann engine/roblox/AUFTRAEGE.md Abschnitt „12:30“ und engine/roblox/ABLAUF.md befolgen.` |
| 15:30 | 14:15 | `jetzt – automatischer Lauf für den 15:30-Post (komplett automatisch, ohne Freigabe). /home/claude/shorts: git pull, dann engine/roblox/AUFTRAEGE.md Abschnitt „15:30“ und engine/roblox/ABLAUF.md befolgen.` |
| 18:30 | 17:15 | `jetzt – automatischer Lauf für den 18:30-Post (komplett automatisch, ohne Freigabe). /home/claude/shorts: git pull, dann engine/roblox/AUFTRAEGE.md Abschnitt „18:30“ und engine/roblox/ABLAUF.md befolgen.` |
| 21:00 | 19:45 | `jetzt – automatischer Lauf für den 21:00-Post (komplett automatisch, ohne Freigabe). /home/claude/shorts: git pull, dann engine/roblox/AUFTRAEGE.md Abschnitt „21:00“ und engine/roblox/ABLAUF.md befolgen.` |

Fehlt das Repo (neue Umgebung): add_repo losterhuesdesignbau-glitch/shorts mit push, nach /home/claude/shorts klonen.

**Kommt ein Lauf zu spät** (Nachricht kommt erst nach PUSH an, z. B. weil ein anderer Lauf noch lief): Schritt 0 trotzdem machen.
Danach das Video nicht mehr bauen (Ausfall-Regel: nicht nachholen). Lukas mit **einer** Push-Nachricht informieren:
„⚠️ HH:MM-Video fällt aus (zu spät gestartet)“.

**Pflicht für alle Slots** (Details in ABLAUF.md):
- keine Wiederholungen (themen.json + themen.py), Suchbegriff-Katalog (suchbegriffe.py)
- starker Hook in den ersten 2 s, Mimik in jedem Shot, Szenen-Logik, Tier-Regel
- Regie-Bericht 0 Fehler, Aussprache-Prüfung OK, Musik/Sounddesign, Viral-Regeln
- Ausfall-Regel (nicht nachholen)
- nach dem Push Chat freigeben (Prüfung per send_later um SLOT+10)
- GENAU EINE Push-Nachricht, erst wenn das Video online ist („✅ HH:MM-Video online …“ / „⚠️ …“); danach im Chat kurz Titel, Links, Status

## 08:00
SLOT = 08:00 · START = 06:45 · PUSH = spätestens 07:20 · SERIE = IN MII TOWN · MUSIK = mystery · HASHTAG = miitown (+ weirdtowns)

THEMA = IN MII TOWN (Lukas 26.11.: statt „In this town“ immer „In Mii Town“; Folgen-Zähler neu ab „IN MII TOWN #1“):
- mysteriöse Geschichten, besondere Ereignisse und ungewöhnliche Situationen in Mii Town (erster Satz beginnt mit „In Mii Town, …“)
- skurrile Regel, rätselhaftes Ereignis, seltsame Bewohner
- KREATIV (Lukas 26.11.: „bessere und kreative Sachen“): jede Folge eine wirklich absurde, NEUE Idee mit Kettenreaktion – nicht nur „X ist verboten“. Beispiele für das Niveau: „the moon is on a schedule“, „every pet can vote“, „the mayor got replaced by a toaster“, „gravity takes Sundays off“, „your shadow goes to work for you“, „the town has one shared umbrella“. Regel → wie die Stadt damit lebt (3–4 witzige Folgen) → eine Figur bricht sie → Chaos → überraschender Twist, der die Regel neu erklärt.
- feste Mii-Town-Gesichter mit Wiedererkennung: Bürgermeister Rex (Ansagen), Oma Pearl (weiß immer mehr), Prankster Leo, schüchterne Lily, Nerd Noah – plus jeweils neue Figuren aus der Sammlung
- Twist darf man nicht kommen sehen; Schluss-Frage mit Meinung („Would YOU …?“)
- Twist am Ende
- familienfreundlich, keine echten Personen, keine Marken-Figuren

## 10:00
SLOT = 10:00 · START = 08:45 · PUSH = spätestens 09:20 · SERIE = BUILD AN EMPIRE (Zähler „BUILD AN EMPIRE #n“, ab 28.11. bei #1) · MUSIK = epic · HASHTAG = buildanempire (+ business)

THEMA = BUILD AN EMPIRE – vom kleinen Geschäft zur Weltfirma (seit 27.11., ersetzt SCHOOL LIFE):
- JEDES MAL EINE ANDERE ECHTE FIRMA, wie sie aus dem Nichts groß wurde (z. B. Garage, Küchentisch, Imbissbude). Titel-Muster: „From Zero to the World's Biggest ___ Company“ / „How ONE ___ Became a Billion-Dollar Empire“.
- Die Gründer-Geschichte mit Mii-Figuren nachspielen: Start → Rückschläge → Durchbruch → Imperium. Zahlen per „counter“ (Jahr, Umsatz, Läden, Nutzer). Twist: ein überraschender, ECHTER Fakt (z. B. fast pleite, verrückter erster Name).
- ALLE Fakten (Jahr, Ort, Zahlen, Namen) per Websuche prüfen; nichts erfinden. Firmennamen dürfen genannt werden.
- KEINE Logos, Markenmaskottchen, Original-Produktdesigns oder Werbesprüche nachbauen; Schilder nur mit Firmenname in neutraler Schrift.
- Gründer werden als Mii-Figuren dargestellt (generisch, kein Promi-Doppelgänger); keine Politik, kein Skandal-Fokus.
- Sets: street/plaza/room/kitchen/bakery …; Schluss-Frage z. B. „Which company should we do next? 👇“.
- Wiederholungen: Firma nie doppelt (themen.py check).

## 12:30
SLOT = 12:30 · START = 11:15 · PUSH = spätestens 11:50 · SERIE = MII TOWN MYSTERY · MUSIK = mystery · HASHTAG = miitownmystery (+ mystery)

THEMA = MII TOWN MYSTERY (Lukas 26.11., ersetzt „X vs Y“): Krimi zum Mitraten
- Etwas verschwindet oder passiert in Mii Town (z. B. der Kuchen vom Stadtfest, Rex' goldene Krawatte, alle Socken der Stadt, die Uhr vom Rathaus)
- Detektiv-Figur (z. B. Noah oder Dr. Kim) befragt GENAU 3 Verdächtige aus der Figuren-Sammlung, jeder mit Motiv und Alibi
- 2–3 faire Hinweise im Bild (Requisiten, Fußspuren, Farbe, Uhrzeit-Pop) – der Täter muss sich aus den Hinweisen erraten lassen
- Ab ~40 s: „Who did it? Comment 1, 2 or 3 👇“ (viral.mid) + kurze Pause, dann Auflösung mit Rückblende auf die Hinweise
- Twist erlaubt (z. B. es war gar kein Verbrechen), muss aber zu den Hinweisen passen
- familienfreundlich, keine Gewalt; Tiere als echte Tier-Modelle
- "cta": "Did you guess it? 👇", "meta.question": "Who did YOU suspect – 1, 2 or 3? 👇"

## 15:30
SLOT = 15:30 · START = 14:15 · PUSH = spätestens 14:50 · SERIE = GUESS THE MII TOWN MOVIE (Zähler „GUESS THE MII TOWN MOVIE #n“, ab 28.11. bei #1) · MUSIK = mystery · HASHTAG = guessthemovie (+ miitown)

THEMA = GUESS THE MII TOWN MOVIE (seit 27.11., ersetzt GENZ TRENDS):
- Die Mii-Town-Figuren spielen die Handlung eines BEKANNTEN Films oder einer bekannten Serie nach – die Zuschauer müssen erraten, welcher es ist.
- Aufbau: Hook „Can YOU guess this movie?“ → 3–4 Szenen mit typischen Handlungs-Momenten, vom schwersten zum leichtesten Hinweis → Mitte „Which movie is it? 👇“ (viral.mid, midAt ≈ 0.75) → kurze Pause → Auflösung mit Titel → Schluss „Did you get it? 👇“.
- REQUISITEN & ORTE MÜSSEN GENAU ZUM FILM PASSEN (Lukas, 27.11.): jede Szene braucht die typischen Gegenstände, Orte, Tageszeiten und Farben des Films (z. B. großes Schiff + Eisberg + Abendrot; Dinos + Dschungel + Jeep; Besen + Zauberstab + Schloss). Fehlt ein Requisit → vorher als generisches Objekt in engine/assets.js bauen (rückwärtskompatibel) und in den Stills prüfen. Lieber einen anderen Film nehmen, als mit unpassenden Ersatz-Requisiten zu drehen.
- Filme wählen, die man an Handlung, Orten und Gegenständen erkennt – nicht nur an einem geschützten Kostüm (Superhelden-Anzüge u. ä. nicht nachbauen).
- Lustig und auf Mii-Art (z. B. das Schiff ist eine Badewanne, der Dino ist Gus im Kostüm) – Parodie, eigene Worte.
- URHEBERRECHT: Titel darf genannt werden, aber KEINE Original-Zitate/Dialoge, keine Filmmusik, keine Logos/Poster, KEINE originalgetreuen Figuren-Kostüme oder -Designs (nur angedeutet über die Handlung). Nur unsere Mii-Figuren.
- Familienfreundliche, weltweit bekannte Filme/Serien; keine Horror-/Ab-18-Titel. Film nie doppelt (themen.py check).
- Im Video-Titel den Film NICHT verraten (z. B. „Can YOU Guess This Movie? 🎬 (Mii Town Edition)“).

## 18:30
SLOT = 18:30 · START = 17:15 · PUSH = spätestens 17:50 · SERIE = SURVIVAL · MUSIK = epic · HASHTAG = survival

THEMA = SURVIVAL & KATASTROPHEN:
- „Was wäre, wenn du …?“-Situationen, direkt an den Zuschauer („What if YOU …?“)
- z. B. plötzlich allein auf einer verlassenen Insel, die Welt plötzlich ohne Strom, eine Naturkatastrophe trifft deine Stadt, du musst eine gefährliche Situation überleben
- spannend, realistisch und visuell beeindruckend: Zähler für Tage/Zeit per Shot "counter", fx shake/flash/snow/rain/dark, passende Sets und Tageszeiten
- wissenschaftliche Fakten per Websuche prüfen
- ohne Gore, ohne Leid echter Menschen, keine echten aktuellen Katastrophen mit Opfern

## 21:00
SLOT = 21:00 · START = 19:45 · PUSH = spätestens 20:20 · SERIE = DARK STORIES · MUSIK = dark · HASHTAG = darkstories

THEMA = DARK STORIES:
- düstere, spannende, überraschende und emotional packende Geschichten (Horror, Mystery, psychologische Thriller, unerwartete Wendungen)
- Gänsehaut ohne Gewalt- oder Gore-Details, keine echten Personen, keine Marken-Figuren

Atmosphäre muss stimmen:
- "time" night/dusk, "grade" mit Vignette/Bloom und kühlen Farben, lightbeam/motes/window
- langsame Kamera, Großaufnahmen (face:ID) mit Angst/Panik/Nervosität im Gesicht
- Look-Feld glow für die Hauptfigur im Dunkeln, Stille vor dem Twist
- Stimme von Unsichtbaren mit "talk": false
