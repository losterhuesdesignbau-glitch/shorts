# VIRALFLOW CLOUD

Skript rein → Video (Engine 1) → automatisch auf **YouTube Shorts, Instagram Reels und TikTok** (Engine 2).
Alles läuft in der Cloud. Dein PC, dein Handy und Claude müssen dafür **nicht** an sein.

```
 Claude / Dashboard
        │  episode.json
        ▼
 ┌──────────────────────┐   VIDEO_READY (HMAC)  ┌──────────────────────────────┐
 │ ENGINE 1 (Actions)   │ ────────────────────► │ ORCHESTRATOR                 │
 │ Block-Studio rendert │                       │ Cloudflare Worker + D1       │
 │ MP4 ──► R2-Speicher  │ ◄──── vf-render ───── │ Plan · Warteschlange · OAuth │
 └──────────────────────┘                       │ Dashboard · Cron (5 min)     │
                                                └──────────────┬───────────────┘
                                   vf-publish (zur Sendezeit)  │  ▲ PUBLISHED / Fehler
                                                               ▼  │
                                                ┌──────────────────────────────┐
                                                │ ENGINE 2 (Actions)           │
                                                │ R2 ─► Prüfung ─► offizielle  │
                                                │ APIs: YouTube · IG · TikTok  │
                                                └──────────────────────────────┘
```

| Teil | Wo | Aufgabe |
|---|---|---|
| Engine 1 | GitHub Actions (`vf-render.yml`) | `engine/roblox/studio.py` **unverändert** ausführen, MP4 nach R2, `VIDEO_READY` senden |
| Orchestrator | Cloudflare Worker (`viralflow/worker`) | Videos registrieren, Texte/Hashtags, Termine, Warteschlange, Wiederholungen, Dashboard, OAuth |
| Datenbank | Cloudflare D1 | Videos, Veröffentlichungen, Verbindungen (Tokens verschlüsselt), Protokoll |
| Speicher | Cloudflare R2 | MP4-Dateien (nicht GitHub) |
| Engine 2 | GitHub Actions (`vf-publish.yml`) | zur Sendezeit hochladen, Status zurückmelden |
| Claude | nur Entwicklung + Skripte | schreibt Skript und `episode.json`, ist **kein** Server |

**Ereignisse:** `VIDEO_READY` → `VIDEO_RECEIVED` → `METADATA_READY` → `SCHEDULED` → `DISPATCHED` → `UPLOAD_STARTED` → `PUBLISHED` (oder `RETRY` / `FAILED`). Alles steht im Dashboard unter *Upload-Protokoll*.

---

## Ein Video in Auftrag geben

**Weg 1 (normal):** Skript an Claude → Claude legt `episodes/queue/<name>.json` ins Repo → fertig.
**Weg 2:** Dashboard → *Video-Produktion* → episode.json einfügen.

Die Datei ist die normale `episode.json` der Engine, optional mit Texten:

```json
{
  "meta": {
    "title": "The 13th Floor 🛗",
    "description": "Nobody talks about the 13th floor. Would you press the button?",
    "hashtags": ["elevator", "creepy", "story"],
    "language": "en"
  },
  "music": "mystery",
  "tts": { "voice": "kokoro:af_heart", "speed": 1.0, "room": 0.06 },
  "shots": [ ... ]
}
```

Fehlt `meta`, erzeugt das System Titel, Beschreibung und Hashtags regelbasiert aus dem Skript (keine bezahlte KI).

**Regeln:** 4 Termine täglich (08:00, 14:00, 16:00, 19:00, Europe/Berlin, im Dashboard oder per Workflow „Sendezeiten setzen“ änderbar), jedes Video auf allen drei Plattformen. Ist ein Video zu spät fertig, bekommt es den nächsten freien Termin. Veröffentlichte Videos werden nie erneut veröffentlicht (eindeutige IDs, Claim-Sperre, Duplikat-Prüfung bei YouTube). Fällt eine Plattform aus, laufen die anderen weiter; Wiederholungen nach 5, 10, 20, 40 min.

---

## Einrichtung Schritt für Schritt

Alles geht im Browser. Plane ca. 1–2 Stunden ein, plus Wartezeit auf die Plattform-Prüfungen.

### 1. Cloudflare (Orchestrator, Datenbank, Speicher)
1. Konto auf **dash.cloudflare.com** anlegen (Free-Plan).
2. **R2** öffnen → ggf. Zahlungsmethode hinterlegen (Verifizierung; der Gratis-Rahmen bleibt) → Bucket **`viralflow-videos`** anlegen.
3. R2 → *API-Tokens verwalten* → Token mit **Objekt lesen & schreiben** nur für `viralflow-videos` → **Access Key ID** und **Secret Access Key** notieren.
4. **Storage & Datenbanken → D1** → Datenbank **`viralflow`** anlegen → **Datenbank-ID** notieren.
5. Rechts oben *Profil → API-Tokens → Token erstellen* → Vorlage **„Cloudflare Workers bearbeiten“** + Berechtigung **D1: Bearbeiten** → Token notieren.
6. Deine **Account-ID** steht auf der Workers-Übersichtsseite rechts.

### 2. GitHub-Token für den Orchestrator
GitHub → *Settings → Developer settings → Fine-grained tokens* → neuer Token nur für Repo **shorts**, Berechtigungen **Contents: Read and write** und **Actions: Read and write** → notieren. (Damit startet der Orchestrator die Render- und Upload-Jobs.)

### 3. Secrets in GitHub eintragen
Repo **shorts → Settings → Secrets and variables → Actions → New repository secret**. Zufallswerte am besten mit einem Passwort-Generator (40+ Zeichen).

| Secret | Inhalt |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token aus 1.5 |
| `CLOUDFLARE_ACCOUNT_ID` | Account-ID aus 1.6 |
| `D1_DATABASE_ID` | aus 1.4 |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | aus 1.3 |
| `VF_GITHUB_TOKEN` | aus 2 |
| `VF_WEBHOOK_SECRET` | Zufallswert (Signatur zwischen den Engines) |
| `TOKEN_KEY` | Zufallswert (verschlüsselt die Plattform-Logins) – **nie ändern**, sonst neu verbinden |
| `SESSION_SECRET` | Zufallswert |
| `DASHBOARD_PASSWORD` | dein Dashboard-Passwort |
| `VF_API_URL` | kommt in Schritt 4 (Worker-Adresse) |
| `YOUTUBE_…`, `INSTAGRAM_…`, `TIKTOK_…` | kommen in Schritt 5–7 |
| `NTFY_TOPIC` | optional, Schritt 8 |

### 4. Orchestrator + Dashboard starten
1. Den Pull-Request **VIRALFLOW CLOUD** mergen.
2. *Actions → „VIRALFLOW · Orchestrator deployen“ → Run workflow*. Der Job legt die Tabellen an, rollt den Worker aus und überträgt die Secrets.
3. Im Log steht die Adresse, z. B. `https://viralflow.<name>.workers.dev` → als Secret **`VF_API_URL`** eintragen.
4. Adresse im Browser/Handy öffnen → mit `DASHBOARD_PASSWORD` anmelden → *Einstellungen → GitHub-Verbindung testen*.

> Nach jedem neuen/geänderten Secret den Deploy-Workflow einmal neu starten, damit der Worker es bekommt.

### 5. YouTube (offizielle YouTube Data API v3)
1. **console.cloud.google.com** → neues Projekt → *APIs & Dienste → Bibliothek* → **YouTube Data API v3** aktivieren.
2. *OAuth-Zustimmungsbildschirm*: Typ **Extern**, App-Name, deine E-Mail. Danach auf **„In Produktion“** stellen – im Status *Testen* laufen Logins nach 7 Tagen ab. Die Warnung „nicht verifizierte App“ beim eigenen Login ist für dich als einzigen Nutzer in Ordnung.
3. *Anmeldedaten → OAuth-Client-ID → Webanwendung* → Weiterleitungs-URI: `https://<worker>/oauth/youtube/callback` → **Client-ID** und **Client-Secret** als `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` eintragen → Deploy neu starten.
4. Dashboard → *Plattformverbindungen → YouTube → Verbinden*.
5. **Wichtig:** Ohne Google-Prüfung bleiben API-Uploads **privat**. Für öffentliche Uploads das *YouTube API Services – Audit and Quota Extension Form* einreichen. Das Kontingent (10.000 Einheiten/Tag, ca. 1.600 pro Upload) reicht für etwa 6 Uploads am Tag – 5 passen.

### 6. Instagram Reels (offizielle Instagram API, Instagram-Login)
1. In der Instagram-App: Konto auf **Profi-Konto** (Business oder Creator) umstellen.
2. **developers.facebook.com** → *App erstellen* → Typ **Business** → Produkt **Instagram** → *API-Einrichtung mit Instagram-Login*.
3. Unter *Instagram-Login einrichten* die Weiterleitungs-URI `https://<worker>/oauth/instagram/callback` eintragen; Berechtigungen `instagram_business_basic` und `instagram_business_content_publish`.
4. *App-Rollen → Instagram-Tester*: dein Instagram-Konto hinzufügen und in der Instagram-App (Einstellungen → Apps und Websites) annehmen. Für dein eigenes Konto reicht der Entwicklungsmodus.
5. **Instagram-App-ID** und **-Geheimschlüssel** (aus der Instagram-Einrichtung, nicht die Facebook-App-ID) als `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` → Deploy neu → im Dashboard verbinden.

### 7. TikTok (offizielle Content Posting API)
1. **developers.tiktok.com** → App anlegen → Produkte **Login Kit** und **Content Posting API** hinzufügen, bei Content Posting **Direct Post** aktivieren.
2. Redirect-URI `https://<worker>/oauth/tiktok/callback`, Scopes `user.info.basic`, `video.publish`, `video.upload`.
3. **Client Key** / **Client Secret** als `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` → Deploy neu → verbinden.
4. **Wichtig:** Ohne TikTok-Audit gehen Direct Posts nur als *Nur ich* und das Konto muss beim Posten privat sein. Ist dein Konto öffentlich, lädt VIRALFLOW automatisch als **Entwurf** in deinen TikTok-Posteingang (Modus *Automatisch*) – du tippst in der App auf Veröffentlichen. Für echtes öffentliches Direct Posting die App bei TikTok zur Prüfung einreichen.

### 8. Push aufs Handy (optional, kostenlos)
App **ntfy** installieren → Thema mit langem Zufallsnamen abonnieren → denselben Namen als Secret `NTFY_TOPIC` → Deploy neu. Du bekommst „Hey Lukas, alles hat geklappt ✅“ oder eine Fehlermeldung je Plattform.

### 9. Umstellung abschließen
1. *Actions → „VIRALFLOW · Alte Videos nach R2 verschieben“* → `VERSCHIEBEN` eingeben (die 6 MP4s wandern nach `archive/` in R2).
2. Die alten ViralSpin-Posting-Aufgaben (8/12/16/20 Uhr) stoppen, sobald alle drei Plattformen verbunden sind – sonst gibt es Doppel-Posts. Die automatischen Skripte von Claude legen ab dann nur noch Dateien in `episodes/queue/` ab.
3. Probelauf: eine Episode in `episodes/queue/` ablegen → im Dashboard zusehen.

---

## Kostenübersicht (Stand 19.11.2026, ohne Garantie)

Ziel ist 0 €. Keiner der Dienste garantiert, dass sein Gratis-Rahmen dauerhaft so bleibt.

| Dienst | Gratis-Rahmen | Unser Verbrauch (5 Videos/Tag) | Mögliche Kosten |
|---|---|---|---|
| GitHub Actions (öffentliches Repo) | Standard-Runner unbegrenzt gratis | ca. 5 × 20–25 min Rendern + 5 × 2–5 min Upload pro Tag | 0 €, solange das Repo öffentlich bleibt. Privat: 2.000 Min/Monat frei, danach ca. 0,006 $/Min → ca. 20–25 $/Monat |
| Cloudflare R2 | 10 GB Speicher, 1 Mio. Schreib-, 10 Mio. Lese-Vorgänge/Monat, kein Traffic-Preis | ca. 5 × 15–40 MB/Tag; mit „Löschen nach 3 Tagen“ unter 1 GB | darüber 0,015 $/GB-Monat |
| Cloudflare Workers | 100.000 Anfragen/Tag, 10 ms CPU pro Aufruf, Cron inklusive | ca. 300 Cron-Läufe + Dashboard/Tag | Bei CPU-Limit-Fehlern: Workers Paid 5 $/Monat |
| Cloudflare D1 | 5 GB, 5 Mio. gelesene / 100.000 geschriebene Zeilen pro Tag | wenige Tausend Zeilen/Tag | darüber nutzungsabhängig |
| YouTube Data API | 10.000 Einheiten/Tag | ca. 8.000 (5 Uploads) | kostenlos; mehr nur per Antrag |
| Instagram API | kostenlos, Limit pro Konto (50–100 API-Posts/24 h) | 5/Tag | – |
| TikTok Content Posting API | kostenlos | 5/Tag | – |
| ntfy.sh | kostenlos | wenige Nachrichten/Tag | – |
| Piper/Kokoro-Stimmen, ffmpeg, Playwright | Open Source | – | – |

**Risiken:** Ein privates Repo kostet Actions-Minuten. Die Videos und Skripte im öffentlichen Repo sind öffentlich sichtbar (Secrets nicht – die liegen nur in GitHub-Secrets und im Worker).

---

## Bedienung

* **Dashboard** (Browser/Handy): Übersicht, Video-Produktion, Bibliothek mit Vorschau, Warteschlange (Jetzt / Erneut / Abbrechen / „Ist online“), Veröffentlichungsplan (Zeiten ändern), Plattformverbindungen, Protokoll, Einstellungen (Sichtbarkeit, TikTok-Modus, Löschregeln, Benachrichtigungen).
* **Pausieren:** Engine 1 (keine neuen Renders, Aufträge warten) und Engine 2 (keine Uploads) getrennt. Verpasste Termine werden nach dem Fortsetzen neu eingeplant statt alles auf einmal zu posten.
* **Unklarer Upload** (Job abgestürzt mitten im Upload): YouTube prüft selbst auf Duplikate; bei Instagram/TikTok markiert das System „Status unklar“ und wartet auf dich, statt doppelt zu posten.

## Entwicklung & Tests

```bash
cd viralflow/worker && npm ci && npm test                         # Orchestrator: Zeitplan, Sommerzeit, Texte, Krypto
PYTHONPATH=viralflow python -m unittest discover -s viralflow/tests  # Publisher gegen Plattform-Mocks
```
`viralflow/tests/mock_cloud.py` bildet YouTube, Instagram, TikTok und GitHub-Dispatch nach (inkl. nicht geprüfter Apps und Ausfällen) – damit lässt sich der ganze Ablauf lokal mit `wrangler dev` durchspielen.
