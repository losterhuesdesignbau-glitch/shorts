# Episoden-Warteschlange

- `queue/` – neue Aufträge für Engine 1. Jede `*.json` hier wird nach dem Push auf `main` automatisch gerendert.
- `done/` – fertig gerenderte Aufträge (verschiebt der Workflow automatisch).

Format: normale `episode.json` der Block-Studio-Engine plus optionaler `meta`-Block mit `title`, `description`, `hashtags`, `language`.
Details: `../viralflow/README.md`.
