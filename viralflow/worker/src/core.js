// Kernlogik des Orchestrators: Einstellungen, Protokoll, VIDEO_READY, Zeitplan, Dispatch, Berichte, Aufräumen
import { nowIso, HttpError, PLATFORMS } from './util.js';
import { nextFreeSlot, normalizeSlots, formatLocal } from './schedule.js';
import { buildMetadata } from './metadata.js';
import { dispatchGithub } from './github.js';
import { notify } from './notify.js';

export const DEFAULT_SETTINGS = {
  slots: ['09:00', '11:30', '14:00', '17:00', '20:00'],
  timezone: 'Europe/Berlin',
  engine1_paused: false,
  engine2_paused: false,
  platforms_enabled: { youtube: true, instagram: true, tiktok: true },
  youtube_privacy: 'public',          // public | unlisted | private
  youtube_category: '24',             // 24 = Entertainment
  tiktok_mode: 'auto',                // auto (Direct Post, sonst Entwurf) | direct | draft
  tiktok_privacy: 'PUBLIC_TO_EVERYONE',
  retention: 'delete',                // delete (nach Veröffentlichung) | keep
  retention_days: 3,                  // Tage nach vollständiger Veröffentlichung, bevor gelöscht wird
  max_attempts: 5,
  base_hashtags: '',
  language: '',                       // leer = automatisch (de/en)
  notify_success: true,
  notify_failure: true,
};

const BOOL_KEYS = ['engine1_paused', 'engine2_paused', 'notify_success', 'notify_failure'];

export async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const s = structuredClone(DEFAULT_SETTINGS);
  for (const r of results) { try { s[r.key] = JSON.parse(r.value); } catch { /* ignorieren */ } }
  s.platforms_enabled = { ...DEFAULT_SETTINGS.platforms_enabled, ...(s.platforms_enabled || {}) };
  return s;
}

export async function saveSettings(env, patch) {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const stmts = [];
  for (const [k, v0] of Object.entries(patch || {})) {
    if (!allowed.includes(k)) continue;
    let v = v0;
    if (k === 'slots') { v = normalizeSlots(v); if (!v.length) throw new HttpError(400, 'Mindestens eine gültige Uhrzeit (HH:MM) nötig'); }
    if (k === 'timezone') { try { new Intl.DateTimeFormat('de', { timeZone: v }); } catch { throw new HttpError(400, 'Unbekannte Zeitzone'); } }
    if (BOOL_KEYS.includes(k)) v = !!v;
    if (k === 'max_attempts') v = Math.min(10, Math.max(1, parseInt(v, 10) || 5));
    if (k === 'retention_days') v = Math.min(365, Math.max(0, parseInt(v, 10) || 0));
    if (k === 'youtube_privacy' && !['public', 'unlisted', 'private'].includes(v)) throw new HttpError(400, 'youtube_privacy ungültig');
    if (k === 'tiktok_mode' && !['auto', 'direct', 'draft'].includes(v)) throw new HttpError(400, 'tiktok_mode ungültig');
    if (k === 'retention' && !['delete', 'keep'].includes(v)) throw new HttpError(400, 'retention ungültig');
    stmts.push(env.DB.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, JSON.stringify(v)));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return getSettings(env);
}

export async function logEvent(env, type, { video_id = null, platform = null, level = 'info', message = '', data = null } = {}) {
  await env.DB.prepare('INSERT INTO events(at, type, video_id, platform, level, message, data) VALUES(?,?,?,?,?,?,?)')
    .bind(nowIso(), type, video_id, platform, level, message, data ? JSON.stringify(data) : null).run();
}

async function takenSlots(env) {
  const { results } = await env.DB.prepare("SELECT DISTINCT scheduled_at FROM publications WHERE status != 'cancelled'").all();
  return new Set(results.map((r) => r.scheduled_at));
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$/;

/** ENGINE 1 -> VIDEO_READY. Idempotent: gleiche Video-ID ergibt dieselbe Antwort, nie eine zweite Einplanung. */
export async function handleVideoReady(env, p) {
  for (const k of ['video_id', 'storage_key', 'filename']) if (!p[k]) throw new HttpError(400, `${k} fehlt`);
  if (!ID_RE.test(p.video_id)) throw new HttpError(400, 'video_id ungültig');
  const idemKey = `video_ready:${p.idempotency_key || p.video_id}`;
  const prev = await env.DB.prepare('SELECT response FROM idempotency WHERE key = ?').bind(idemKey).first();
  if (prev) return { ...JSON.parse(prev.response), duplicate: true };
  const existing = await env.DB.prepare('SELECT id, slot_at, status FROM videos WHERE id = ?').bind(p.video_id).first();
  if (existing) {
    return { event: 'VIDEO_RECEIVED', video_id: existing.id, scheduled_at: existing.slot_at, status: existing.status, duplicate: true };
  }

  const settings = await getSettings(env);
  const ts = nowIso();
  await logEvent(env, 'VIDEO_READY', { video_id: p.video_id, message: p.filename, data: { duration: p.duration, size: p.size_bytes } });
  await env.DB.prepare(`INSERT INTO videos(id, storage_key, filename, duration, size_bytes, sha256, produced_at, script, meta_in, status, created_at, updated_at)
      VALUES(?,?,?,?,?,?,?,?,?, 'received', ?, ?)`)
    .bind(p.video_id, p.storage_key, p.filename, p.duration ?? null, p.size_bytes ?? null, p.sha256 ?? null,
      p.produced_at || ts, p.script ?? null, p.meta ? JSON.stringify(p.meta) : null, ts, ts).run();
  await logEvent(env, 'VIDEO_RECEIVED', { video_id: p.video_id, message: 'Video registriert' });

  const metadata = buildMetadata({ meta: p.meta || {}, script: p.script || '', filename: p.filename, settings });
  await env.DB.prepare('UPDATE videos SET metadata = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(metadata), nowIso(), p.video_id).run();
  await logEvent(env, 'METADATA_READY', { video_id: p.video_id, message: metadata.title, data: { hashtags: metadata.hashtags } });

  const slot = await scheduleVideo(env, p.video_id, settings);
  if (p.episode_id) {
    await env.DB.prepare("UPDATE episodes SET status = 'done', updated_at = ? WHERE id = ?").bind(nowIso(), p.episode_id).run();
  }
  const resp = { event: 'VIDEO_RECEIVED', video_id: p.video_id, metadata_ready: true, scheduled_at: slot, scheduled_local: formatLocal(slot, settings.timezone) };
  await env.DB.prepare('INSERT OR IGNORE INTO idempotency(key, response, created_at) VALUES(?,?,?)').bind(idemKey, JSON.stringify(resp), nowIso()).run();
  return resp;
}

/** Video auf den nächsten freien Termin legen – eine Zeile je Plattform. */
export async function scheduleVideo(env, videoId, settings, from = new Date()) {
  const slot = nextFreeSlot({ slots: settings.slots, tz: settings.timezone, taken: await takenSlots(env), from });
  const ts = nowIso();
  const stmts = [env.DB.prepare("UPDATE videos SET slot_at = ?, status = 'scheduled', updated_at = ? WHERE id = ?").bind(slot, ts, videoId)];
  for (const platform of PLATFORMS) {
    stmts.push(env.DB.prepare(`INSERT INTO publications(id, video_id, platform, scheduled_at, status, created_at, updated_at)
        VALUES(?, ?, ?, ?, 'queued', ?, ?)
        ON CONFLICT(id) DO UPDATE SET scheduled_at = excluded.scheduled_at, updated_at = excluded.updated_at
        WHERE publications.status IN ('queued', 'failed')`)
      .bind(`${videoId}:${platform}`, videoId, platform, slot, ts, ts));
  }
  await env.DB.batch(stmts);
  await logEvent(env, 'SCHEDULED', { video_id: videoId, message: `Geplant für ${formatLocal(slot, settings.timezone)}`, data: { slot } });
  return slot;
}

/** Noch nicht veröffentlichte Plattformen eines Videos auf den nächsten freien Termin verschieben. */
export async function rescheduleVideo(env, videoId, settings, { now = new Date(), onlyStatuses = ['queued', 'failed'], reason = 'Neu geplant' } = {}) {
  const ph = onlyStatuses.map(() => '?').join(',');
  const iso = now.toISOString();
  const r = await env.DB.prepare(`UPDATE publications SET status = 'cancelled', updated_at = ? WHERE video_id = ? AND status IN (${ph})`)
    .bind(iso, videoId, ...onlyStatuses).run();
  if (!r.meta.changes) return null;
  const slot = nextFreeSlot({ slots: settings.slots, tz: settings.timezone, taken: await takenSlots(env), from: now });
  await env.DB.batch([
    env.DB.prepare(`UPDATE publications SET status = 'queued', scheduled_at = ?, attempts = 0, next_attempt_at = NULL, lease_until = NULL, error = NULL, updated_at = ?
                    WHERE video_id = ? AND status = 'cancelled' AND updated_at = ?`).bind(slot, iso, videoId, iso),
    env.DB.prepare('UPDATE videos SET slot_at = ?, updated_at = ? WHERE id = ?').bind(slot, iso, videoId),
  ]);
  await logEvent(env, 'RESCHEDULED', { video_id: videoId, level: 'warn', message: `${reason} – neu geplant für ${formatLocal(slot, settings.timezone)}` });
  await refreshVideoStatus(env, videoId, settings);
  return slot;
}

async function connectedPlatforms(env) {
  const { results } = await env.DB.prepare('SELECT platform FROM connections').all();
  return new Set(results.map((r) => r.platform));
}

/** Cron (alle 5 Minuten): fällige Veröffentlichungen an GitHub Actions übergeben, Leases prüfen, Renders nachholen, aufräumen. */
export async function tick(env, now = new Date()) {
  const settings = await getSettings(env);
  const iso = now.toISOString();
  const report = { dispatched: [], rescheduled: [], expired: [], renders: [], deleted: [] };

  // 1) Abgelaufene Leases (Runner abgestürzt / keine Rückmeldung)
  const { results: stale } = await env.DB.prepare(
    "SELECT * FROM publications WHERE status IN ('dispatched', 'uploading') AND lease_until IS NOT NULL AND lease_until < ?").bind(iso).all();
  for (const p of stale) {
    // 'dispatched' = nie begonnen -> sicher wiederholbar. 'uploading' = Ergebnis unklar:
    // YouTube prüft vor neuem Upload selbst auf Duplikate, Instagram/TikTok nicht -> manuell prüfen statt doppelt posten.
    const safe = p.status === 'dispatched' || p.platform === 'youtube';
    await registerFailure(env, p, safe ? 'Keine Rückmeldung vom Upload-Job (Zeitüberschreitung)' : 'Status unklar – Upload evtl. erfolgt. Bitte auf der Plattform prüfen und im Dashboard „Erneut versuchen“ oder „Als veröffentlicht markieren“.', settings, { retryable: safe });
    report.expired.push(p.id);
  }

  // 2) Fällige Veröffentlichungen
  if (!settings.engine2_paused) {
    const { results: due } = await env.DB.prepare(
      "SELECT * FROM publications WHERE status = 'queued' AND scheduled_at <= ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY scheduled_at LIMIT 30")
      .bind(iso, iso).all();
    const connected = await connectedPlatforms(env);
    const send = [];
    const overdueVideos = new Set();
    for (const p of due) {
      // Termin lange verpasst (z. B. Engine war pausiert) -> nicht nachträglich alles auf einmal posten, sondern neu einplanen
      if (p.attempts === 0 && now.getTime() - Date.parse(p.scheduled_at) > 60 * 60000) { overdueVideos.add(p.video_id); continue; }
      if (!settings.platforms_enabled[p.platform]) continue;
      if (!connected.has(p.platform)) {
        if (p.error !== 'Plattform nicht verbunden') {
          await env.DB.prepare('UPDATE publications SET error = ?, updated_at = ? WHERE id = ?').bind('Plattform nicht verbunden', iso, p.id).run();
          await logEvent(env, 'WAITING', { video_id: p.video_id, platform: p.platform, level: 'warn', message: 'Plattform nicht verbunden – wartet' });
        }
        continue;
      }
      send.push(p);
    }
    for (const vid of overdueVideos) {
      await rescheduleVideo(env, vid, settings, { now, onlyStatuses: ['queued'], reason: 'Termin verpasst' });
      report.rescheduled.push(vid);
    }
    if (send.length) {
      const lease = new Date(now.getTime() + 90 * 60000).toISOString();
      const ids = send.map((p) => p.id);
      await env.DB.batch(send.map((p) => env.DB.prepare(
        "UPDATE publications SET status = 'dispatched', lease_until = ?, error = NULL, updated_at = ? WHERE id = ? AND status = 'queued'").bind(lease, iso, p.id)));
      try {
        await dispatchGithub(env, 'vf-publish', { ids });
        for (const p of send) await logEvent(env, 'DISPATCHED', { video_id: p.video_id, platform: p.platform, message: 'Upload-Job gestartet' });
        report.dispatched = ids;
      } catch (e) {
        // GitHub nicht erreichbar -> zurück in die Warteschlange, nächster Tick versucht es erneut
        await env.DB.batch(send.map((p) => env.DB.prepare(
          "UPDATE publications SET status = 'queued', lease_until = NULL, error = ?, updated_at = ? WHERE id = ?").bind(`GitHub-Dispatch fehlgeschlagen: ${e.message}`, iso, p.id)));
        await logEvent(env, 'DISPATCH_FAILED', { level: 'error', message: e.message });
      }
    }
  }

  // 3) Wartende Render-Aufträge (Engine 1 war pausiert) oder hängengebliebene Renders
  if (!settings.engine1_paused) {
    const { results: eps } = await env.DB.prepare(
      "SELECT * FROM episodes WHERE status = 'waiting' OR (status = 'rendering' AND updated_at < ?) ORDER BY created_at LIMIT 3")
      .bind(new Date(now.getTime() - 4 * 3600000).toISOString()).all();
    for (const ep of eps) {
      if (ep.attempts >= 3) {
        await env.DB.prepare("UPDATE episodes SET status = 'failed', error = 'Render dreimal ohne Rückmeldung', updated_at = ? WHERE id = ?").bind(iso, ep.id).run();
        continue;
      }
      try {
        await dispatchGithub(env, 'vf-render', { episode_id: ep.id, path: ep.path || '' });
        await env.DB.prepare("UPDATE episodes SET status = 'rendering', attempts = attempts + 1, updated_at = ? WHERE id = ?").bind(iso, ep.id).run();
        await logEvent(env, 'RENDER_DISPATCHED', { video_id: ep.id, message: ep.title || ep.path || '' });
        report.renders.push(ep.id);
      } catch (e) {
        await logEvent(env, 'DISPATCH_FAILED', { video_id: ep.id, level: 'error', message: e.message });
      }
    }
  }

  // 4) Speicher aufräumen (Regeln aus den Einstellungen)
  report.deleted = await cleanupStorage(env, settings, now);
  return report;
}

export async function registerFailure(env, pub, error, settings, { retryable = true } = {}) {
  const attempts = pub.attempts + 1;
  const iso = nowIso();
  if (retryable && attempts < settings.max_attempts) {
    const delayMin = 5 * 2 ** (attempts - 1); // 5, 10, 20, 40 … Minuten
    const next = new Date(Date.now() + delayMin * 60000).toISOString();
    await env.DB.prepare("UPDATE publications SET status = 'queued', attempts = ?, next_attempt_at = ?, lease_until = NULL, run_id = NULL, error = ?, updated_at = ? WHERE id = ?")
      .bind(attempts, next, error, iso, pub.id).run();
    await logEvent(env, 'RETRY', { video_id: pub.video_id, platform: pub.platform, level: 'warn', message: `Versuch ${attempts}/${settings.max_attempts} fehlgeschlagen: ${error} – neuer Versuch in ${delayMin} min` });
  } else {
    await env.DB.prepare("UPDATE publications SET status = 'failed', attempts = ?, lease_until = NULL, run_id = NULL, error = ?, updated_at = ? WHERE id = ?")
      .bind(attempts, error, iso, pub.id).run();
    await logEvent(env, 'FAILED', { video_id: pub.video_id, platform: pub.platform, level: 'error', message: error });
    if (settings.notify_failure) await notify(env, `❌ ${pub.platform}: Upload fehlgeschlagen`, `${pub.video_id}\n${error}`, 'high');
  }
  await refreshVideoStatus(env, pub.video_id, settings);
}

/** Publisher holt sich einen Auftrag. Nur wer den Claim bekommt, darf hochladen (Idempotenz). */
export async function claimPublication(env, id, runId) {
  const iso = nowIso();
  const lease = new Date(Date.now() + 60 * 60000).toISOString();
  const r = await env.DB.prepare(
    "UPDATE publications SET status = 'uploading', run_id = ?, lease_until = ?, updated_at = ? WHERE id = ? AND status IN ('dispatched', 'queued') RETURNING *")
    .bind(runId, lease, iso, id).first();
  if (!r) {
    const cur = await env.DB.prepare('SELECT id, status, remote_url FROM publications WHERE id = ?').bind(id).first();
    if (!cur) throw new HttpError(404, 'Veröffentlichung unbekannt');
    throw new HttpError(409, `Nicht verfügbar (Status: ${cur.status})`);
  }
  const video = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(r.video_id).first();
  const settings = await getSettings(env);
  await logEvent(env, 'UPLOAD_STARTED', { video_id: r.video_id, platform: r.platform, message: `Run ${runId}` });
  return {
    publication: r,
    video: {
      id: video.id, storage_key: video.storage_key, filename: video.filename, duration: video.duration,
      size_bytes: video.size_bytes, sha256: video.sha256,
    },
    metadata: JSON.parse(video.metadata || '{}'),
    settings: {
      youtube_privacy: settings.youtube_privacy, youtube_category: settings.youtube_category,
      tiktok_mode: settings.tiktok_mode, tiktok_privacy: settings.tiktok_privacy,
    },
  };
}

/** Rückmeldung des Publishers: PUBLISHED oder Fehler */
export async function reportPublication(env, id, body) {
  const pub = await env.DB.prepare('SELECT * FROM publications WHERE id = ?').bind(id).first();
  if (!pub) throw new HttpError(404, 'Veröffentlichung unbekannt');
  const settings = await getSettings(env);
  const iso = nowIso();
  if (pub.status === 'published') return { ok: true, status: 'published', duplicate: true };
  if (body.run_id && pub.run_id && body.run_id !== pub.run_id) throw new HttpError(409, 'Run passt nicht zum Claim');
  if (body.status === 'published') {
    await env.DB.prepare("UPDATE publications SET status = 'published', remote_id = ?, remote_url = ?, privacy = ?, error = NULL, lease_until = NULL, published_at = ?, updated_at = ? WHERE id = ?")
      .bind(body.remote_id || null, body.remote_url || null, body.privacy || null, iso, iso, id).run();
    await logEvent(env, 'PUBLISHED', { video_id: pub.video_id, platform: pub.platform, message: body.remote_url || body.remote_id || '', data: { privacy: body.privacy, note: body.note } });
  } else {
    await registerFailure(env, pub, String(body.error || 'Unbekannter Fehler').slice(0, 900), settings, { retryable: body.retryable !== false });
    return { ok: true, status: 'failed' };
  }
  const st = await refreshVideoStatus(env, pub.video_id, settings);
  return { ok: true, status: 'published', video_status: st };
}

export async function refreshVideoStatus(env, videoId, settings) {
  const { results } = await env.DB.prepare('SELECT platform, status, error, remote_url FROM publications WHERE video_id = ?').bind(videoId).all();
  const active = results.filter((r) => r.status !== 'cancelled');
  let status = 'scheduled';
  if (active.length && active.every((r) => r.status === 'published')) status = 'published';
  else if (active.some((r) => ['dispatched', 'uploading'].includes(r.status))) status = 'publishing';
  else if (active.length && active.every((r) => ['published', 'failed'].includes(r.status))) status = active.some((r) => r.status === 'published') ? 'partial' : 'failed';
  else if (active.some((r) => r.status === 'published')) status = 'publishing';
  const before = await env.DB.prepare('SELECT status, metadata FROM videos WHERE id = ?').bind(videoId).first();
  if (before && before.status !== status && before.status !== 'archived') {
    await env.DB.prepare('UPDATE videos SET status = ?, updated_at = ? WHERE id = ?').bind(status, nowIso(), videoId).run();
    if (['published', 'partial'].includes(status) && settings) {
      const title = JSON.parse(before.metadata || '{}').title || videoId;
      const lines = active.map((r) => `${r.status === 'published' ? '✅' : '❌'} ${r.platform}${r.error && r.status !== 'published' ? ': ' + r.error : ''}`).join('\n');
      if (status === 'published' && settings.notify_success) await notify(env, 'Hey Lukas, alles hat geklappt ✅', `${title}\n${lines}`);
      if (status === 'partial' && settings.notify_failure) await notify(env, '⚠ Nicht überall veröffentlicht', `${title}\n${lines}`, 'high');
    }
  }
  return status;
}

export async function cleanupStorage(env, settings, now = new Date()) {
  if (settings.retention !== 'delete') return [];
  const cutoff = new Date(now.getTime() - settings.retention_days * 86400000).toISOString();
  const { results } = await env.DB.prepare(`SELECT v.id, v.storage_key FROM videos v
     WHERE v.storage_state = 'stored' AND v.status = 'published'
       AND NOT EXISTS (SELECT 1 FROM publications p WHERE p.video_id = v.id AND p.status NOT IN ('published', 'cancelled'))
       AND (SELECT MAX(published_at) FROM publications p WHERE p.video_id = v.id) <= ? LIMIT 20`).bind(cutoff).all();
  const deleted = [];
  for (const v of results) {
    await env.VIDEOS.delete(v.storage_key);
    await env.DB.prepare("UPDATE videos SET storage_state = 'deleted', status = 'archived', updated_at = ? WHERE id = ?").bind(nowIso(), v.id).run();
    await logEvent(env, 'STORAGE_DELETED', { video_id: v.id, message: `${v.storage_key} gelöscht (Regel: ${settings.retention_days} Tage nach Veröffentlichung)` });
    deleted.push(v.id);
  }
  return deleted;
}
