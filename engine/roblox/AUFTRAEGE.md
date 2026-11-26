# Aufträge der 6 täglichen Sendeplätze (Lukas, 22.11.2026)

Alle Läufe laufen in **Lukas' Haupt-Chat** (eine Claude-Sitzung), nicht in neuen Chats.
Sie kommen als einmalige Nachrichten (send_later), die sich Tag für Tag selbst weiterplanen.
Komplett automatisch, ohne Freigabe.

## Schritt 0 jedes Laufs: Weiterplanen (zuerst, vor allem anderen)
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
- Twist am Ende
- familienfreundlich, keine echten Personen, keine Marken-Figuren

## 10:00
SLOT = 10:00 · START = 08:45 · PUSH = spätestens 09:20 · SERIE = SCHOOL LIFE · MUSIK = school (lustig) oder school_emo (emotional/dramatisch) · HASHTAG = schoollife

THEMA = SCHOOL LIFE & SCHULGESCHICHTEN:
- lustige, peinliche, dramatische und unerwartete Situationen aus dem Schulalltag (Klassenzimmer, Pause, Prüfung, Lehrer, Klassenfahrt …)
- familienfreundlich, kein Mobbing verherrlichen, keine echten Personen/Schulen
- Schule muss wie Schule aussehen: Sets classroom/hallway/school, Requisit paper für Noten

## 12:30
SLOT = 12:30 · START = 11:15 · PUSH = spätestens 11:50 · SERIE = VS BATTLE · MUSIK = battle · HASHTAG = vsbattle

THEMA = X VS Y:
- spannende Vergleiche, direkte Duelle und Gegenüberstellungen (Tiere, Rollen, Alltag, Natur/Technik)
- Runde für Runde vergleichen, echte Fakten per Websuche prüfen, überraschender Sieger als Twist
- Anzeigetafel (Shot "score"), Set "stadium"; "cta": "TEAM X or TEAM Y? 👇"
- kein Blut/keine Gewaltdetails, keine echten Personen, keine Marken-Figuren

LUKAS' REGEL (ganz wichtig):
- Tiere IMMER als echte Tier-Modelle (cast {"animal": "…"}, wie episodes/done/vs_cat_dog.json und vs_tiger_lion.json), NIEMALS Menschen als Tiere. Menschen nur als Moderator.
- Verfügbar: dog, cat, fox, lion, tiger, pig, bear, sheep, cow, penguin, frog, chicken, croc, shark, guineapig.
- Fehlt ein Tier: anderes Duell wählen oder Modell rückwärtskompatibel in engine/assets.js bauen und per Stills prüfen.

## 15:30
SLOT = 15:30 · START = 14:15 · PUSH = spätestens 14:50 · SERIE = GENZ TRENDS · MUSIK = trend · HASHTAG = der passende Trend-Hashtag (+ genztrends)

THEMA = GENZ TRENDS:
- aktuelle Trends der jungen Generation: Roblox-Trends, Gaming-Trends, aktuelle Internet-Trends, GenZ-Themen, virale Situationen und Challenges, interessante Entwicklungen aus der Gaming-Welt
- Quellen: TikTok/YouTube Shorts/Instagram Reels, TikTok Creative Center, offizielle Spiele-/Roblox-Seiten und Gaming-Seiten (Websuche mode extended, Fakten prüfen)
- KEINE Nachrichten-/Politik-/Wirtschafts-/Erwachsenen-Themen, keine Zeitungen (Tagesspiegel, Spiegel, Bild …)

LUKAS' REGELN:
- KEINE Tanzvideos, keine Musik-/Song-Trends, keine urheberrechtlich geschützte Musik, keine kopierten Inhalte.
- Trends kreativ und eigenständig in unserem Stil nachstellen/neu interpretieren (eigene Geschichte, eigene Figuren).
- Keine Marken-Figuren, Logos oder Spielfiguren aus fremden Spielen nachbauen; Spielnamen dürfen im Text genannt werden.
- Sprache locker/jugendlich.
- Hat Lukas heute im Chat einen Trend genannt, diesen nehmen.
- Im Chat zusätzlich den Trend (+ Quelle) nennen.

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
