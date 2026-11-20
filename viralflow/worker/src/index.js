// VIRALFLOW CLOUD – Orchestrator (Cloudflare Worker)
// Routen: Dashboard (Login), Dashboard-API, Engine-API (HMAC-signiert), OAuth, Cron.
import dashboardHtml from './dashboard.html';
import { json, HttpError, nowIso, verifySignedRequest, hmacHex, safeEqual, PLATFORMS } from './util.js';
import {
  getSettings, saveSettings, logEvent, handleVideoReady, claimPublication, reportPublication, tick,
  rescheduleVideo, refreshVideoStatus,
} from './core.js';
import { upcomingSlots, formatLocal } from './schedule.js';
import { oauthStart, oauthCallback, accessToken, importInstagramToken } from './oauth.js';
import { dispatchGithub } from './github.js';

const SESSION_DAYS = 30;
const sessionSecret = (env) => env.SESSION_SECRET || env.TOKEN_KEY;

async function makeSession(env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  return `${exp}.${await hmacHex(sessionSecret(env), `session.${exp}`)}`;
}
async function isLoggedIn(env, req) {
  const c = (req.headers.get('cookie') || '').match(/(?:^|;\s*)vf_session=([^;]+)/)?.[1];
  if (!c) return false;
  const [exp, sig] = c.split('.');
  if (!exp || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmacHex(sessionSecret(env), `session.${exp}`));
}

const SECURITY_HEADERS = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'strict-transport-security': 'max-age=31536000',
};

export default {
  async fetch(req, env, ctx) {
    try {
      const res = await route(req, env, ctx);
      const h = new Headers(res.headers);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!h.has(k)) h.set(k, v);
      return new Response(res.body, { status: res.status, headers: h });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e.stack || e);
      return json({ error: e.message || 'Fehler' }, status);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env).catch((e) => logEvent(env, 'CRON_ERROR', { level: 'error', message: e.message })));
  },
};

async function route(req, env) {
  const url = new URL(req.url);
  const { pathname: path } = url;
  const method = req.method;

  // ---------- Öffentlich ----------
  if (path === '/' || path === '/index.html') {
    return new Response(dashboardHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; media-src 'self' blob:; img-src 'self' data:",
      },
    });
  }
  if (path === '/tiktokIFUBXv6cR6Cy0z3e3d4aSb4357fJRqQJ.txt') return new Response('tiktok-developers-site-verification=IFUBXv6cR6Cy0z3e3d4aSb4357fJRqQJ', { headers: { 'content-type': 'text/plain' } });
  if (path === '/health') return json({ ok: true, at: nowIso() });
  if (path === '/privacy' || path === '/datenschutz') return htmlPage('Datenschutz – viralflow', PRIVACY);
  if (path === '/about') return htmlPage('viralflow', ABOUT);
  if (path === '/terms') return htmlPage('Nutzungsbedingungen – viralflow', TERMS);

  if (path === '/api/login' && method === 'POST') {
    const { password } = await req.json().catch(() => ({}));
    if (!env.DASHBOARD_PASSWORD) throw new HttpError(500, 'DASHBOARD_PASSWORD nicht gesetzt');
    const a = await hmacHex(sessionSecret(env), `pw.${password || ''}`);
    const b = await hmacHex(sessionSecret(env), `pw.${env.DASHBOARD_PASSWORD}`);
    if (!safeEqual(a, b)) {
      await new Promise((r) => setTimeout(r, 1200)); // bremst Passwort-Raten
      await logEvent(env, 'LOGIN_FAILED', { level: 'warn', message: req.headers.get('cf-connecting-ip') || '' });
      throw new HttpError(401, 'Falsches Passwort');
    }
    return json({ ok: true }, 200, { 'set-cookie': `vf_session=${await makeSession(env)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}` });
  }
  if (path === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': 'vf_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
  }

  // ---------- Öffentlicher, signierter Video-Link (für Buffer/TikTok): /m/<ablauf>/<signatur>/<video-id>.mp4 ----------
  const mm = path.match(/^\/m\/(\d+)\/([0-9a-f]{64})\/([^/]+)\.mp4$/);
  if (mm && (method === 'GET' || method === 'HEAD')) {
    const [, exp, sig, vid] = mm;
    if (Number(exp) < Date.now() / 1000) throw new HttpError(410, 'Link abgelaufen');
    const want = await hmacHex(env.VF_WEBHOOK_SECRET, `media.${vid}.${exp}`);
    if (!safeEqual(sig, want)) throw new HttpError(403, 'Ungültige Signatur');
    const v = await env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(decodeURIComponent(vid)).first();
    if (!v) throw new HttpError(404, 'Video unbekannt');
    if (method === 'HEAD') {
      const h = await env.VIDEOS.head(v.storage_key);
      if (!h) throw new HttpError(404, 'Datei fehlt im Speicher');
      return new Response(null, { headers: { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': String(h.size) } });
    }
    return streamVideo(env, req, v);
  }

  // ---------- Engine-API (HMAC) ----------
  if (path.startsWith('/api/engine/') || path === '/api/events/video-ready') {
    const body = method === 'GET' ? '' : await req.text();
    await verifySignedRequest(req, env.VF_WEBHOOK_SECRET, body);
    const data = body ? JSON.parse(body) : {};
    return engineApi(env, method, path, data);
  }

  // ---------- OAuth ----------
  const om = path.match(/^\/oauth\/(youtube|instagram|tiktok)\/(start|callback)$/);
  if (om) {
    // Start nur mit Dashboard-Login. Der Rücksprung von Google/Meta/TikTok ist eine seitenübergreifende Weiterleitung,
    // bei der das (SameSite=Strict) Login-Cookie nicht mitkommt – dort schützt das einmalige OAuth-State-Cookie,
    // das nur beim eingeloggten Start gesetzt wird.
    if (om[2] === 'callback') return oauthCallback(env, req, om[1]);
    if (!(await isLoggedIn(env, req))) return new Response(null, { status: 302, headers: { location: '/' } });
    return oauthStart(env, req, om[1]);
  }

  // ---------- Dashboard-API (Session) ----------
  if (path.startsWith('/api/')) {
    if (!(await isLoggedIn(env, req))) throw new HttpError(401, 'Bitte anmelden');
    if (method !== 'GET' && req.headers.get('x-vf') !== '1') throw new HttpError(403, 'CSRF-Schutz');
    return dashboardApi(env, req, method, path, url);
  }
  return json({ error: 'Nicht gefunden' }, 404);
}

// ================= Engine-API =================
async function engineApi(env, method, path, data) {
  if (path === '/api/events/video-ready' && method === 'POST') return json(await handleVideoReady(env, data));

  if (path === '/api/engine/status') {
    const s = await getSettings(env);
    return json({ engine1_paused: s.engine1_paused, engine2_paused: s.engine2_paused });
  }

  // Render-Auftrag anmelden (Quelle: Git). Antwort: darf gerendert werden?
  if (path === '/api/engine/episodes/register' && method === 'POST') {
    const s = await getSettings(env);
    const ts = nowIso();
    const existing = await env.DB.prepare('SELECT * FROM episodes WHERE id = ?').bind(data.id).first();
    const video = await env.DB.prepare('SELECT id FROM videos WHERE id = ?').bind(data.id).first();
    if (video) return json({ proceed: false, reason: 'Video existiert bereits', video_exists: true });
    // Läuft schon ein Render für denselben Inhalt (z. B. doppelt ausgelöster Workflow)? -> nicht doppelt rendern
    if (existing?.status === 'rendering' && Date.now() - Date.parse(existing.updated_at) < 3 * 3600000 && !data.force) {
      return json({ proceed: false, reason: 'Wird bereits gerendert' });
    }
    if (!existing) {
      await env.DB.prepare("INSERT INTO episodes(id, source, path, title, status, created_at, updated_at) VALUES(?, 'git', ?, ?, ?, ?, ?)")
        .bind(data.id, data.path || null, data.title || null, s.engine1_paused ? 'waiting' : 'rendering', ts, ts).run();
    } else if (!s.engine1_paused) {
      await env.DB.prepare("UPDATE episodes SET status = 'rendering', updated_at = ? WHERE id = ?").bind(ts, data.id).run();
    }
    if (s.engine1_paused) {
      if (existing?.status !== 'waiting') await env.DB.prepare("UPDATE episodes SET status = 'waiting', updated_at = ? WHERE id = ?").bind(ts, data.id).run();
      await logEvent(env, 'RENDER_WAITING', { video_id: data.id, level: 'warn', message: 'Engine 1 pausiert – Auftrag wartet' });
      return json({ proceed: false, reason: 'Engine 1 pausiert' });
    }
    await logEvent(env, 'RENDER_STARTED', { video_id: data.id, message: data.title || data.path || '' });
    return json({ proceed: true });
  }
  const em = path.match(/^\/api\/engine\/episodes\/([^/]+)\/(fetch|status)$/);
  if (em) {
    const ep = await env.DB.prepare('SELECT * FROM episodes WHERE id = ?').bind(em[1]).first();
    if (!ep) throw new HttpError(404, 'Auftrag unbekannt');
    if (em[2] === 'fetch') {
      const s = await getSettings(env);
      if (s.engine1_paused) return json({ proceed: false, reason: 'Engine 1 pausiert' });
      await env.DB.prepare("UPDATE episodes SET status = 'rendering', updated_at = ? WHERE id = ?").bind(nowIso(), ep.id).run();
      return json({ proceed: true, id: ep.id, path: ep.path, title: ep.title, episode: ep.body ? JSON.parse(ep.body) : null });
    }
    const status = ['failed', 'done', 'rendering'].includes(data.status) ? data.status : 'failed';
    await env.DB.prepare('UPDATE episodes SET status = ?, error = ?, updated_at = ? WHERE id = ?').bind(status, data.error || null, nowIso(), ep.id).run();
    await logEvent(env, status === 'failed' ? 'RENDER_FAILED' : 'RENDER_STATUS', { video_id: ep.id, level: status === 'failed' ? 'error' : 'info', message: data.error || status });
    return json({ ok: true });
  }

  // Termine (Sendezeiten) setzen, z. B. aus GitHub Actions
  if (path === '/api/engine/settings/slots' && method === 'POST') {
    await saveSettings(env, { slots: data.slots });
    const s = await getSettings(env);
    await logEvent(env, 'SETTINGS', { message: `Sendezeiten: ${s.slots.join(', ')}` });
    return json({ ok: true, slots: s.slots });
  }
  // Abgebrochene/fehlgeschlagene Veröffentlichung sofort neu einreihen (nie bereits veröffentlichte)
  const rq = path.match(/^\/api\/engine\/publications\/([^/]+)\/requeue$/);
  if (rq && method === 'POST') {
    const id = decodeURIComponent(rq[1]), ts = nowIso();
    const r = await env.DB.prepare("UPDATE publications SET status = 'queued', scheduled_at = ?, attempts = 0, next_attempt_at = NULL, lease_until = NULL, error = NULL, updated_at = ? WHERE id = ? AND status IN ('cancelled', 'failed', 'queued') RETURNING id, video_id, platform").bind(ts, ts, id).first();
    if (!r) throw new HttpError(409, 'Nicht neu einreihbar (unbekannt oder schon veröffentlicht/aktiv)');
    await logEvent(env, 'REQUEUED', { video_id: r.video_id, platform: r.platform, message: 'per Engine-API neu eingereiht' });
    await tick(env);
    return json({ ok: true, id });
  }
  const pm = path.match(/^\/api\/engine\/publications\/([^/]+)\/(claim|report)$/);
  if (pm && method === 'POST') {
    const id = decodeURIComponent(pm[1]);
    if (pm[2] === 'claim') return json(await claimPublication(env, id, data.run_id || 'unknown'));
    return json(await reportPublication(env, id, data));
  }
  if (path === '/api/engine/publications/list' && method === 'POST') {
    const st = Array.isArray(data.statuses) && data.statuses.length ? data.statuses.map(String) : ['queued', 'failed', 'dispatched'];
    const r = await env.DB.prepare(`SELECT p.id, p.platform, p.status, p.scheduled_at, p.error, p.remote_id, p.remote_url, p.published_at, p.video_id, v.filename FROM publications p JOIN videos v ON v.id = p.video_id
        WHERE p.status IN (${st.map(() => '?').join(',')}) ORDER BY p.scheduled_at`).bind(...st).all();
    return json({ items: r.results });
  }
  if (path === '/api/engine/stats' && method === 'POST') { // Statistik-Job: {videos:[{platform,remote_id,video_id,views,...}], accounts:[{platform,followers,...}], earnings:[{platform,day,amount,currency}]}
    const ts = nowIso(), st = [];
    for (const v of (data.videos || []).slice(0, 500)) st.push(env.DB.prepare('INSERT INTO stats(platform, remote_id, video_id, taken_at, views, likes, comments, shares, saves, reach) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(String(v.platform), String(v.remote_id), v.video_id || null, ts, v.views ?? null, v.likes ?? null, v.comments ?? null, v.shares ?? null, v.saves ?? null, v.reach ?? null));
    for (const a of (data.accounts || []).slice(0, 10)) st.push(env.DB.prepare('INSERT INTO account_stats(platform, taken_at, followers, total_views, media_count) VALUES(?,?,?,?,?)').bind(String(a.platform), ts, a.followers ?? null, a.total_views ?? null, a.media_count ?? null));
    for (const e of (data.earnings || []).slice(0, 400)) st.push(env.DB.prepare(`INSERT INTO earnings(platform, day, amount, currency, source, note, created_at) VALUES(?,?,?,?, 'auto', ?, ?)
        ON CONFLICT(platform, day, source) WHERE source = 'auto' DO UPDATE SET amount = excluded.amount, currency = excluded.currency`).bind(String(e.platform), String(e.day), Number(e.amount) || 0, e.currency || 'EUR', e.note || null, ts));
    if (st.length) await env.DB.batch(st);
    return json({ ok: true, rows: st.length });
  }
  if (path === '/api/engine/token/instagram/import' && method === 'POST') return json(await importInstagramToken(env, data.access_token, data.account_id));
  const tm = path.match(/^\/api\/engine\/token\/(youtube|instagram|tiktok)$/);
  if (tm && method === 'POST') return json(await accessToken(env, tm[1]));

  if (path === '/api/engine/log' && method === 'POST') {
    await logEvent(env, String(data.type || 'NOTE').slice(0, 40), { video_id: data.video_id, platform: data.platform, level: data.level || 'info', message: String(data.message || '').slice(0, 900) });
    return json({ ok: true });
  }
  throw new HttpError(404, 'Unbekannter Engine-Endpunkt');
}

// ================= Dashboard-API =================
async function dashboardApi(env, req, method, path, url) {
  const body = method === 'GET' ? {} : await req.json().catch(() => ({}));
  const s = await getSettings(env);
  const all = (q, ...b) => env.DB.prepare(q).bind(...b).all().then((r) => r.results);
  const one = (q, ...b) => env.DB.prepare(q).bind(...b).first();

  if (path === '/api/overview') {
    const counts = Object.fromEntries((await all('SELECT status, COUNT(*) n FROM videos GROUP BY status')).map((r) => [r.status, r.n]));
    const pubs = Object.fromEntries((await all('SELECT status, COUNT(*) n FROM publications GROUP BY status')).map((r) => [r.status, r.n]));
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    return json({
      settings: s,
      produced: Object.values(counts).reduce((a, b) => a + b, 0),
      videos_by_status: counts,
      publications_by_status: pubs,
      waiting: (await one("SELECT COUNT(DISTINCT video_id) n FROM publications WHERE status IN ('queued','dispatched','uploading')")).n,
      published_today: (await one("SELECT COUNT(*) n FROM publications WHERE status = 'published' AND published_at >= ?", today.toISOString())).n,
      episodes: Object.fromEntries((await all('SELECT status, COUNT(*) n FROM episodes GROUP BY status')).map((r) => [r.status, r.n])),
      next: await all(`SELECT p.*, v.metadata FROM publications p JOIN videos v ON v.id = p.video_id
                       WHERE p.status IN ('queued','dispatched','uploading') ORDER BY p.scheduled_at LIMIT 9`),
      recent_published: await all("SELECT p.*, v.metadata FROM publications p JOIN videos v ON v.id = p.video_id WHERE p.status = 'published' ORDER BY p.published_at DESC LIMIT 9"),
      failed: await all("SELECT p.*, v.metadata FROM publications p JOIN videos v ON v.id = p.video_id WHERE p.status = 'failed' ORDER BY p.updated_at DESC LIMIT 20"),
      connections: await all('SELECT platform, account_name, connected_at, updated_at FROM connections'),
    });
  }
  if (path === '/api/videos') {
    const vids = await all('SELECT id, filename, duration, size_bytes, produced_at, metadata, slot_at, status, storage_state, created_at FROM videos ORDER BY created_at DESC LIMIT ?', Math.min(200, +url.searchParams.get('limit') || 60));
    const pubs = await all('SELECT id, video_id, platform, status, remote_url, error, privacy FROM publications');
    for (const v of vids) v.publications = pubs.filter((p) => p.video_id === v.id);
    return json({ videos: vids });
  }
  const vm = path.match(/^\/api\/videos\/([^/]+)\/(file|reschedule|metadata)$/);
  if (vm) {
    const v = await one('SELECT * FROM videos WHERE id = ?', decodeURIComponent(vm[1]));
    if (!v) throw new HttpError(404, 'Video unbekannt');
    if (vm[2] === 'file') return streamVideo(env, req, v);
    if (vm[2] === 'metadata' && method === 'PUT') {
      const md = { ...JSON.parse(v.metadata || '{}'), ...body };
      await env.DB.prepare('UPDATE videos SET metadata = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(md), nowIso(), v.id).run();
      await logEvent(env, 'METADATA_EDITED', { video_id: v.id, message: 'Metadaten im Dashboard geändert' });
      return json({ ok: true });
    }
    if (vm[2] === 'reschedule' && method === 'POST') {
      const slot = await rescheduleVideo(env, v.id, s, { onlyStatuses: ['queued', 'failed', 'cancelled'], reason: 'Im Dashboard' });
      if (!slot) throw new HttpError(409, 'Nichts mehr einzuplanen');
      return json({ ok: true, scheduled_at: slot });
    }
  }
  if (path === '/api/queue') {
    return json({
      items: await all(`SELECT p.*, v.metadata, v.filename FROM publications p JOIN videos v ON v.id = p.video_id
                        WHERE p.status IN ('queued','dispatched','uploading','failed') ORDER BY p.scheduled_at LIMIT 200`),
    });
  }
  const qm = path.match(/^\/api\/publications\/([^/]+)\/(retry|cancel|now|mark-published)$/);
  if (qm && method === 'POST') {
    const id = decodeURIComponent(qm[1]);
    const p = await one('SELECT * FROM publications WHERE id = ?', id);
    if (!p) throw new HttpError(404, 'Unbekannt');
    if (p.status === 'published') throw new HttpError(409, 'Bereits veröffentlicht – wird nie erneut veröffentlicht');
    const ts = nowIso();
    if (qm[2] === 'cancel') await env.DB.prepare("UPDATE publications SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(ts, id).run();
    if (qm[2] === 'retry') await env.DB.prepare("UPDATE publications SET status = 'queued', attempts = 0, next_attempt_at = NULL, lease_until = NULL, error = NULL, updated_at = ? WHERE id = ?").bind(ts, id).run();
    if (qm[2] === 'now') await env.DB.prepare("UPDATE publications SET status = 'queued', scheduled_at = ?, attempts = 0, next_attempt_at = NULL, lease_until = NULL, error = NULL, updated_at = ? WHERE id = ?").bind(new Date(Date.now() - 60000).toISOString(), ts, id).run();
    if (qm[2] === 'mark-published') await env.DB.prepare("UPDATE publications SET status = 'published', published_at = ?, error = NULL, lease_until = NULL, updated_at = ? WHERE id = ?").bind(ts, ts, id).run();
    await logEvent(env, `MANUAL_${qm[2].toUpperCase().replace('-', '_')}`, { video_id: p.video_id, platform: p.platform, message: 'Im Dashboard ausgelöst' });
    await refreshVideoStatus(env, p.video_id, s);
    if (qm[2] === 'now') await tick(env);
    return json({ ok: true });
  }
  if (path === '/api/plan') {
    return json({
      slots: s.slots, timezone: s.timezone,
      upcoming: upcomingSlots({ slots: s.slots, tz: s.timezone, count: 15 }).map((iso) => ({ iso, local: formatLocal(iso, s.timezone) })),
      scheduled: await all(`SELECT v.id, v.slot_at, v.status, v.metadata, GROUP_CONCAT(p.platform || ':' || p.status) pubs
                            FROM videos v JOIN publications p ON p.video_id = v.id
                            WHERE v.slot_at >= ? GROUP BY v.id ORDER BY v.slot_at LIMIT 50`, new Date(Date.now() - 86400000).toISOString()),
    });
  }
  if (path === '/api/connections') {
    const rows = await all('SELECT platform, account_id, account_name, scopes, connected_at, updated_at FROM connections');
    return json({
      connections: PLATFORMS.map((p) => ({
        platform: p, enabled: s.platforms_enabled[p], connection: rows.find((r) => r.platform === p) || null,
        app_configured: !!({ youtube: env.YOUTUBE_CLIENT_ID, instagram: env.INSTAGRAM_APP_ID, tiktok: env.TIKTOK_CLIENT_KEY }[p]),
      })),
      redirect_base: env.PUBLIC_URL || url.origin,
    });
  }
  const cm = path.match(/^\/api\/connections\/(youtube|instagram|tiktok)$/);
  if (cm && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM connections WHERE platform = ?').bind(cm[1]).run();
    await logEvent(env, 'DISCONNECTED', { platform: cm[1], level: 'warn', message: 'Verbindung getrennt' });
    return json({ ok: true });
  }
  if (path === '/api/events') {
    const before = +url.searchParams.get('before') || 1e15;
    const lvl = url.searchParams.get('level');
    const rows = lvl
      ? await all('SELECT * FROM events WHERE id < ? AND level = ? ORDER BY id DESC LIMIT 100', before, lvl)
      : await all('SELECT * FROM events WHERE id < ? ORDER BY id DESC LIMIT 100', before);
    return json({ events: rows });
  }
  if (path === '/api/settings') {
    if (method === 'PUT') { const ns = await saveSettings(env, body); await logEvent(env, 'SETTINGS_CHANGED', { message: Object.keys(body).join(', ') }); return json(ns); }
    return json(s);
  }
  if (path === '/api/control' && method === 'POST') {
    const key = { engine1: 'engine1_paused', engine2: 'engine2_paused' }[body.engine];
    if (!key || !['pause', 'start'].includes(body.action)) throw new HttpError(400, 'engine/action ungültig');
    await saveSettings(env, { [key]: body.action === 'pause' });
    await logEvent(env, body.action === 'pause' ? 'ENGINE_PAUSED' : 'ENGINE_STARTED', { message: body.engine });
    if (body.action === 'start') await tick(env);
    return json(await getSettings(env));
  }
  if (path === '/api/tick' && method === 'POST') return json(await tick(env));
  if (path === '/api/episodes') {
    if (method === 'POST') {
      let ep = body.episode;
      if (typeof ep === 'string') { try { ep = JSON.parse(ep); } catch { throw new HttpError(400, 'episode.json ist kein gültiges JSON'); } }
      if (!ep || !Array.isArray(ep.shots) || !ep.shots.length) throw new HttpError(400, 'episode.json braucht "shots"');
      const title = String(body.title || ep.meta?.title || 'Episode').slice(0, 120);
      const slug = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'episode';
      const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const id = `${d}-${slug}-${(await hmacHex('id', JSON.stringify(ep))).slice(0, 6)}`;
      if (await one('SELECT id FROM episodes WHERE id = ?', id)) throw new HttpError(409, 'Diese Episode ist schon eingereicht');
      const ts = nowIso();
      await env.DB.prepare("INSERT INTO episodes(id, source, title, body, status, created_at, updated_at) VALUES(?, 'dashboard', ?, ?, 'waiting', ?, ?)")
        .bind(id, title, JSON.stringify(ep), ts, ts).run();
      await logEvent(env, 'EPISODE_SUBMITTED', { video_id: id, message: title });
      if (!s.engine1_paused) await tick(env);
      return json({ ok: true, id });
    }
    return json({ episodes: await all('SELECT id, source, path, title, status, attempts, error, created_at, updated_at FROM episodes ORDER BY created_at DESC LIMIT 100') });
  }
  const rm = path.match(/^\/api\/episodes\/([^/]+)\/retry$/);
  if (rm && method === 'POST') {
    await env.DB.prepare("UPDATE episodes SET status = 'waiting', attempts = 0, error = NULL, updated_at = ? WHERE id = ?").bind(nowIso(), decodeURIComponent(rm[1])).run();
    await tick(env);
    return json({ ok: true });
  }
  if (path === '/api/analytics') { // ?platform=all|youtube|instagram|tiktok&days=7|30|365
    const days = Math.min(730, Math.max(1, +(url.searchParams.get('days') || 30))), pf = url.searchParams.get('platform') || 'all';
    const since = new Date(Date.now() - days * 86400000).toISOString(), pq = pf === 'all' ? '' : ' AND s.platform = ?', pb = pf === 'all' ? [] : [pf];
    // pro Video der neueste Stand
    const vids = await all(`SELECT s.platform, s.remote_id, s.video_id, s.views, s.likes, s.comments, s.shares, s.saves, s.reach, s.taken_at, v.metadata, p.remote_url, p.published_at
        FROM stats s JOIN (SELECT platform, remote_id, MAX(id) mid FROM stats GROUP BY platform, remote_id) m ON m.mid = s.id
        LEFT JOIN videos v ON v.id = s.video_id LEFT JOIN publications p ON p.video_id = s.video_id AND p.platform = s.platform WHERE 1=1${pq} ORDER BY p.published_at DESC LIMIT 300`, ...pb);
    // Zuwachs pro Tag: Differenz des letzten Stands je Tag und Video
    const rows = await all(`SELECT s.platform, s.remote_id, substr(s.taken_at, 1, 10) d, MAX(s.views) v, MAX(s.likes) l, MAX(s.comments) c, MAX(s.shares) sh FROM stats s WHERE s.taken_at >= ?${pq} GROUP BY s.platform, s.remote_id, d ORDER BY d`, since, ...pb);
    const prev = {}, daily = {};
    const base = await all(`SELECT s.platform, s.remote_id, MAX(s.views) v, MAX(s.likes) l, MAX(s.comments) c, MAX(s.shares) sh FROM stats s WHERE s.taken_at < ?${pq} GROUP BY s.platform, s.remote_id`, since, ...pb);
    for (const b of base) prev[b.platform + b.remote_id] = b;
    for (const r of rows) { const k = r.platform + r.remote_id, p0 = prev[k] || { v: 0, l: 0, c: 0, sh: 0 }, d = daily[r.d] || (daily[r.d] = { day: r.d, views: 0, likes: 0, comments: 0, shares: 0 });
      d.views += Math.max(0, (r.v || 0) - (p0.v || 0)); d.likes += Math.max(0, (r.l || 0) - (p0.l || 0)); d.comments += Math.max(0, (r.c || 0) - (p0.c || 0)); d.shares += Math.max(0, (r.sh || 0) - (p0.sh || 0)); prev[k] = r; }
    const acc = await all(`SELECT platform, substr(taken_at, 1, 10) d, MAX(followers) f FROM account_stats WHERE taken_at >= ?${pf === 'all' ? '' : ' AND platform = ?'} GROUP BY platform, d ORDER BY d`, since, ...pb);
    const sum = (k) => vids.reduce((a, v) => a + (v[k] || 0), 0);
    const per = {}; for (const v of vids) { const q = per[v.platform] || (per[v.platform] = { videos: 0, views: 0, likes: 0, comments: 0, shares: 0 }); q.videos++; q.views += v.views || 0; q.likes += v.likes || 0; q.comments += v.comments || 0; q.shares += v.shares || 0; }
    const lastAt = (await one('SELECT MAX(taken_at) t FROM stats'))?.t || null;
    return json({ days, platform: pf, totals: { videos: vids.length, views: sum('views'), likes: sum('likes'), comments: sum('comments'), shares: sum('shares'), saves: sum('saves') }, per, daily: Object.values(daily), followers: acc, videos: vids, updated_at: lastAt });
  }
  if (path === '/api/earnings' && method === 'GET') {
    const rows = await all('SELECT id, platform, day, amount, currency, source, note FROM earnings ORDER BY day DESC, id DESC LIMIT 2000');
    const now = Date.now(), win = (d) => { const since = new Date(now - d * 86400000).toISOString().slice(0, 10); const o = { total: 0, youtube: 0, tiktok: 0, instagram: 0 }; for (const r of rows) if (r.day >= since) { o.total += r.amount; o[r.platform] = (o[r.platform] || 0) + r.amount; } return o; };
    const monthly = {}; for (const r of rows) { const m = r.day.slice(0, 7); const o = monthly[m] || (monthly[m] = { month: m, youtube: 0, tiktok: 0, instagram: 0, total: 0 }); o[r.platform] = (o[r.platform] || 0) + r.amount; o.total += r.amount; }
    return json({ rows, sums: { d7: win(7), d30: win(30), d365: win(365), all: win(100000) }, monthly: Object.values(monthly).sort((a, b) => a.month < b.month ? -1 : 1) });
  }
  if (path === '/api/earnings' && method === 'POST') {
    const p = String(body.platform || ''), d = String(body.day || '').slice(0, 10), amt = Number(String(body.amount ?? '').replace(',', '.'));
    if (!PLATFORMS.includes(p) || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !isFinite(amt)) throw new HttpError(400, 'Plattform, Datum und Betrag angeben');
    await env.DB.prepare("INSERT INTO earnings(platform, day, amount, currency, source, note, created_at) VALUES(?,?,?,?, 'manual', ?, ?)").bind(p, d, amt, body.currency || 'EUR', body.note || null, nowIso()).run();
    return json({ ok: true });
  }
  const erm = path.match(/^\/api\/earnings\/(\d+)$/);
  if (erm && method === 'DELETE') { await env.DB.prepare("DELETE FROM earnings WHERE id = ? AND source = 'manual'").bind(+erm[1]).run(); return json({ ok: true }); }
  if (path === '/api/test-dispatch' && method === 'POST') {
    await dispatchGithub(env, 'vf-ping', { at: nowIso() });
    return json({ ok: true });
  }
  throw new HttpError(404, 'Unbekannter Endpunkt');
}

async function streamVideo(env, req, v) {
  if (v.storage_state !== 'stored') throw new HttpError(410, 'Video wurde nach der Veröffentlichung gelöscht');
  const range = req.headers.get('range');
  let obj;
  if (range) {
    const m = range.match(/bytes=(\d+)-(\d*)/);
    if (m) {
      const offset = +m[1];
      const end = m[2] ? +m[2] : undefined;
      obj = await env.VIDEOS.get(v.storage_key, { range: end !== undefined ? { offset, length: end - offset + 1 } : { offset } });
      if (!obj) throw new HttpError(404, 'Datei fehlt im Speicher');
      const total = obj.size;
      const last = end !== undefined ? Math.min(end, total - 1) : total - 1;
      return new Response(obj.body, {
        status: 206,
        headers: { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-range': `bytes ${offset}-${last}/${total}`, 'content-length': String(last - offset + 1) },
      });
    }
  }
  obj = await env.VIDEOS.get(v.storage_key);
  if (!obj) throw new HttpError(404, 'Datei fehlt im Speicher');
  return new Response(obj.body, { headers: { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': String(obj.size) } });
}

const PAGE_CSS = 'body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 18px;background:#0e0f13;color:#e9ebf0}a{color:#a48bff}h1{font-size:24px}h2{font-size:18px;margin-top:28px}';
function htmlPage(title, body) {
  return new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${PAGE_CSS}</style></head><body>${body}</body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
const ABOUT = `<h1>viralflow</h1><p>viralflow ist ein privates Werkzeug, mit dem der Betreiber seine eigenen, selbst produzierten Kurzvideos automatisch auf seinen eigenen Kanälen bei YouTube, Instagram und TikTok veröffentlicht. Es gibt keine weiteren Nutzer.</p><p><a href="/privacy">Datenschutz / Privacy Policy</a></p>`;
const PRIVACY = `<h1>Datenschutzerklärung / Privacy Policy</h1>
<p>Stand: 19.11.2026</p>
<h2>Zweck</h2><p>viralflow ist eine private Anwendung. Sie wird ausschließlich vom Betreiber genutzt, um eigene Videos auf den eigenen Kanälen (YouTube, Instagram, TikTok) zu veröffentlichen.</p>
<h2>Welche Daten verarbeitet werden</h2><p>Nach der Anmeldung über die offiziellen Login-Verfahren (OAuth) von Google/YouTube, Instagram und TikTok speichert viralflow Zugriffs-Tokens, die Kanal- bzw. Konto-ID und den Kontonamen. Die Tokens werden verschlüsselt gespeichert und nur verwendet, um Videos hochzuladen und den Veröffentlichungsstatus abzufragen. Passwörter werden nicht gespeichert. Es werden keine Daten anderer Personen erhoben, nicht verkauft und nicht an Dritte weitergegeben.</p>
<h2>YouTube API Services</h2><p>viralflow nutzt die YouTube API Services. Es gelten die <a href="https://www.youtube.com/t/terms">YouTube-Nutzungsbedingungen</a> und die <a href="https://policies.google.com/privacy">Google-Datenschutzerklärung</a>. Der Zugriff kann jederzeit unter <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> widerrufen werden.</p>
<h2>Speicherort und Löschung</h2><p>Daten liegen bei Cloudflare (Datenbank, Dateispeicher). Videodateien werden nach der Veröffentlichung nach einstellbarer Frist gelöscht. Verbindungen können im Dashboard getrennt werden; dabei werden die gespeicherten Tokens gelöscht.</p>
<h2>Kontakt</h2><p>Betreiber: Lukas, über das GitHub-Konto losterhuesdesignbau-glitch.</p>
<hr><p><b>English summary:</b> viralflow is a private tool used only by its operator to publish his own videos to his own YouTube, Instagram and TikTok accounts via official OAuth APIs. It stores encrypted access tokens and account IDs only for uploading; no passwords, no third-party data, nothing is sold or shared. Access can be revoked at any time via the platforms or by disconnecting in the dashboard.</p>`;
const TERMS = `<h1>Nutzungsbedingungen / Terms of Service</h1><p>Stand: 19.11.2026</p>
<p>viralflow ist ein privates Werkzeug des Betreibers zur Veröffentlichung eigener, selbst produzierter Videos auf den eigenen Kanälen bei YouTube, Instagram und TikTok. Es gibt keine öffentliche Registrierung und keine weiteren Nutzer.</p>
<p>Alle Inhalte werden ausschließlich über die offiziellen Schnittstellen der Plattformen und unter Einhaltung deren Nutzungsbedingungen veröffentlicht. Der Betreiber ist für die veröffentlichten Inhalte selbst verantwortlich. Der Zugriff kann jederzeit über die jeweilige Plattform widerrufen werden.</p>
<p><a href="/privacy">Datenschutz / Privacy Policy</a></p><hr>
<p><b>English:</b> viralflow is a private tool used solely by its operator to publish his own videos to his own YouTube, Instagram and TikTok accounts through the platforms' official APIs, in compliance with their terms. There is no public sign-up and no other users.</p>`;
