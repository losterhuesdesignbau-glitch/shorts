# Hinweise für Claude (Repo `shorts`)

- **Engine 1** = `engine/roblox/` (Block-Studio). Nicht unnötig ändern; neue Funktionen nur rückwärtskompatibel.
- **Neues Video produzieren:** episode.json (Format siehe `engine/roblox/README.md`) mit `meta`-Block
  (`title`, `description`, `hashtags`, `language`) als `episodes/queue/<kurzer_name>.json` committen und auf `main` pushen.
  Ab da läuft alles automatisch: Rendern in GitHub Actions → R2 → Orchestrator plant den nächsten freien Termin → Upload.
- **Keine MP4s ins Repo** (`videos/` ist veraltet). Speicher ist Cloudflare R2.
- **Nicht selbst hochladen** (kein ViralSpin, keine Browser-Uploads) – das macht Engine 2 (`viralflow/vf/publish.py`).
- Keine Secrets ins Repo. Doku: `viralflow/README.md`.
