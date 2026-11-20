-- VIRALFLOW CLOUD – D1-Datenbank (SQLite)
-- Anwenden: npx wrangler d1 execute viralflow --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Aufträge für Engine 1 (Skript/Episode -> Video)
CREATE TABLE IF NOT EXISTS episodes (
  id          TEXT PRIMARY KEY,            -- = spätere Video-ID
  source      TEXT NOT NULL,               -- 'git' (episodes/queue/*.json) | 'dashboard'
  path        TEXT,                        -- Pfad im Repo (bei source=git)
  title       TEXT,
  body        TEXT,                        -- episode.json (nur bei source=dashboard)
  status      TEXT NOT NULL DEFAULT 'queued', -- queued | waiting (Engine pausiert) | rendering | done | failed
  attempts    INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Fertige Videos (VIDEO_READY)
CREATE TABLE IF NOT EXISTS videos (
  id            TEXT PRIMARY KEY,
  storage_key   TEXT NOT NULL,             -- Schlüssel im R2-Bucket
  filename      TEXT NOT NULL,
  duration      REAL,
  size_bytes    INTEGER,
  sha256        TEXT,
  produced_at   TEXT,
  script        TEXT,
  meta_in       TEXT,                      -- JSON: Titel/Beschreibung/Hashtags aus dem Skript (optional)
  metadata      TEXT,                      -- JSON: fertige Metadaten je Plattform
  slot_at       TEXT,                      -- geplanter Veröffentlichungszeitpunkt (UTC ISO)
  status        TEXT NOT NULL DEFAULT 'received', -- received | scheduled | publishing | published | partial | failed | archived
  storage_state TEXT NOT NULL DEFAULT 'stored',   -- stored | deleted
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Eine Zeile pro Video und Plattform. UNIQUE verhindert doppelte Veröffentlichung.
CREATE TABLE IF NOT EXISTS publications (
  id               TEXT PRIMARY KEY,       -- <video_id>:<platform> = Idempotenzschlüssel
  video_id         TEXT NOT NULL REFERENCES videos(id),
  platform         TEXT NOT NULL,          -- youtube | instagram | tiktok
  scheduled_at     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'queued', -- queued | dispatched | uploading | published | failed | cancelled
  attempts         INTEGER NOT NULL DEFAULT 0,
  next_attempt_at  TEXT,
  lease_until      TEXT,
  run_id           TEXT,
  remote_id        TEXT,
  remote_url       TEXT,
  privacy          TEXT,
  error            TEXT,
  published_at     TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (video_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_pub_due ON publications(status, scheduled_at);

-- OAuth-Verbindungen (Tokens AES-GCM-verschlüsselt)
CREATE TABLE IF NOT EXISTS connections (
  platform      TEXT PRIMARY KEY,
  account_id    TEXT,
  account_name  TEXT,
  token_enc     TEXT NOT NULL,             -- verschlüsseltes JSON {access_token, refresh_token, expires_at, ...}
  scopes        TEXT,
  connected_at  TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Protokoll aller Schritte
CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL,
  type       TEXT NOT NULL,                -- VIDEO_READY, VIDEO_RECEIVED, METADATA_READY, SCHEDULED, DISPATCHED, PUBLISHED, FAILED, RETRY, ...
  video_id   TEXT,
  platform   TEXT,
  level      TEXT NOT NULL DEFAULT 'info', -- info | warn | error
  message    TEXT,
  data       TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_at ON events(at);

-- Einmal-Schlüssel gegen doppelte Webhooks
CREATE TABLE IF NOT EXISTS idempotency (
  key        TEXT PRIMARY KEY,
  response   TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Statistik-Schnappschüsse pro veröffentlichtem Video (alle paar Stunden vom Statistik-Job)
CREATE TABLE IF NOT EXISTS stats (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  platform    TEXT NOT NULL,
  remote_id   TEXT NOT NULL,
  video_id    TEXT,
  taken_at    TEXT NOT NULL,
  views       INTEGER, likes INTEGER, comments INTEGER, shares INTEGER, saves INTEGER, reach INTEGER
);
CREATE INDEX IF NOT EXISTS idx_stats_vid ON stats(platform, remote_id, taken_at);
-- Kontowerte (Follower/Abonnenten, Gesamtaufrufe)
CREATE TABLE IF NOT EXISTS account_stats (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  platform    TEXT NOT NULL,
  taken_at    TEXT NOT NULL,
  followers   INTEGER, total_views INTEGER, media_count INTEGER
);
CREATE INDEX IF NOT EXISTS idx_acc ON account_stats(platform, taken_at);
-- Verdienst: YouTube automatisch (wenn Partnerprogramm + Berechtigung), TikTok/Instagram manuell
CREATE TABLE IF NOT EXISTS earnings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  platform    TEXT NOT NULL,
  day         TEXT NOT NULL,          -- YYYY-MM-DD
  amount      REAL NOT NULL,          -- Betrag in Währung
  currency    TEXT NOT NULL DEFAULT 'EUR',
  source      TEXT NOT NULL DEFAULT 'manual', -- manual | auto
  note        TEXT,
  created_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_earn_auto ON earnings(platform, day, source) WHERE source = 'auto';
