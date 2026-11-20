// OAuth-Verbindungen zu YouTube, Instagram und TikTok (nur offizielle Endpunkte).
// Tokens liegen AES-GCM-verschlüsselt in D1; Upload-Jobs bekommen nur kurzlebige Access-Tokens.
import { nowIso, HttpError, encryptJson, decryptJson, randomId } from './util.js';
import { logEvent } from './core.js';

const IG_GRAPH = (env) => `https://graph.instagram.com/${env.IG_GRAPH_VERSION || 'v24.0'}`;

const PROVIDERS = {
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: (env) => env.YOUTUBE_CLIENT_ID,
    clientSecret: (env) => env.YOUTUBE_CLIENT_SECRET,
    scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly', 'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'],
    authParams: (env, redirect, state) => ({
      client_id: env.YOUTUBE_CLIENT_ID, redirect_uri: redirect, response_type: 'code', state,
      scope: PROVIDERS.youtube.scopes.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
    }),
    async exchange(env, code, redirect) {
      const t = await form('https://oauth2.googleapis.com/token', {
        code, client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET, redirect_uri: redirect, grant_type: 'authorization_code',
      });
      if (!t.refresh_token) throw new HttpError(400, 'Google hat kein Refresh-Token geliefert – Zugriff unter myaccount.google.com/permissions entfernen und neu verbinden');
      const ch = await getJson('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', t.access_token);
      const c = ch.items?.[0];
      if (!c) throw new HttpError(400, 'Kein YouTube-Kanal in diesem Google-Konto gefunden');
      return { token: { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + t.expires_in * 1000 }, account_id: c.id, account_name: c.snippet.title, scopes: t.scope };
    },
    async refresh(env, tok) {
      const t = await form('https://oauth2.googleapis.com/token', {
        client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET, refresh_token: tok.refresh_token, grant_type: 'refresh_token',
      });
      return { ...tok, access_token: t.access_token, expires_at: Date.now() + t.expires_in * 1000 };
    },
  },

  // Instagram API mit Instagram-Login (Business- oder Creator-Konto, keine Facebook-Seite nötig)
  instagram: {
    authUrl: 'https://www.instagram.com/oauth/authorize',
    scopes: ['instagram_business_basic', 'instagram_business_content_publish'],
    authParams: (env, redirect, state) => ({
      client_id: env.INSTAGRAM_APP_ID, redirect_uri: redirect, response_type: 'code', state,
      scope: PROVIDERS.instagram.scopes.join(','), enable_fb_login: '0', force_authentication: '1',
    }),
    async exchange(env, code, redirect) {
      const short = await form('https://api.instagram.com/oauth/access_token', {
        client_id: env.INSTAGRAM_APP_ID, client_secret: env.INSTAGRAM_APP_SECRET, grant_type: 'authorization_code', redirect_uri: redirect, code,
      });
      const shortTok = short.access_token || short.data?.[0]?.access_token;
      const long = await getJson(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(env.INSTAGRAM_APP_SECRET)}&access_token=${encodeURIComponent(shortTok)}`);
      const me = await getJson(`${IG_GRAPH(env)}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(long.access_token)}`);
      return {
        token: { access_token: long.access_token, expires_at: Date.now() + (long.expires_in || 5184000) * 1000 },
        account_id: String(me.user_id || me.id), account_name: me.username + (me.account_type ? ` (${me.account_type})` : ''), scopes: PROVIDERS.instagram.scopes.join(','),
      };
    },
    async refresh(env, tok) {
      // Langlebige Tokens (60 Tage) lassen sich verlängern, solange sie gültig und mind. 24 h alt sind
      const r = await getJson(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(tok.access_token)}`);
      return { ...tok, access_token: r.access_token, expires_at: Date.now() + (r.expires_in || 5184000) * 1000 };
    },
    refreshBeforeMs: 10 * 86400000, // 10 Tage vor Ablauf verlängern
  },

  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    scopes: ['user.info.basic', 'user.info.stats', 'video.list'], // nur Statistik – Uploads laufen über Buffer
    authParams: (env, redirect, state) => ({
      client_key: (env.TIKTOK_CLIENT_KEY || '').trim(), redirect_uri: redirect, response_type: 'code', state, scope: PROVIDERS.tiktok.scopes.join(','),
    }),
    async exchange(env, code, redirect) {
      const t = await form('https://open.tiktokapis.com/v2/oauth/token/', {
        client_key: (env.TIKTOK_CLIENT_KEY || '').trim(), client_secret: (env.TIKTOK_CLIENT_SECRET || '').trim(), code, grant_type: 'authorization_code', redirect_uri: redirect,
      });
      if (t.error) throw new HttpError(400, `TikTok: ${t.error_description || t.error}`);
      let name = t.open_id;
      try {
        const u = await getJson('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', t.access_token);
        name = u.data?.user?.display_name || name;
      } catch { /* Name ist optional */ }
      return {
        token: { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + t.expires_in * 1000, refresh_expires_at: Date.now() + t.refresh_expires_in * 1000 },
        account_id: t.open_id, account_name: name, scopes: t.scope,
      };
    },
    async refresh(env, tok) {
      const t = await form('https://open.tiktokapis.com/v2/oauth/token/', {
        client_key: (env.TIKTOK_CLIENT_KEY || '').trim(), client_secret: (env.TIKTOK_CLIENT_SECRET || '').trim(), grant_type: 'refresh_token', refresh_token: tok.refresh_token,
      });
      if (t.error) throw new Error(`TikTok-Refresh: ${t.error_description || t.error}`);
      return { ...tok, access_token: t.access_token, refresh_token: t.refresh_token || tok.refresh_token, expires_at: Date.now() + t.expires_in * 1000 };
    },
  },
};

async function form(url, params) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(400, `Token-Anfrage fehlgeschlagen (${r.status}): ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
async function getJson(url, bearer) {
  const r = await fetch(url, { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(400, `Abfrage fehlgeschlagen (${r.status}): ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

const redirectUri = (env, req, platform) => `${env.PUBLIC_URL || new URL(req.url).origin}/oauth/${platform}/callback`;

export function oauthStart(env, req, platform) {
  const p = PROVIDERS[platform];
  if (!p) throw new HttpError(404, 'Unbekannte Plattform');
  const params = p.authParams(env, redirectUri(env, req, platform), '');
  if (!params.client_id && !params.client_key) throw new HttpError(400, `App-Zugangsdaten für ${platform} fehlen (siehe Einrichtung)`);
  const state = randomId(18);
  params.state = state;
  const url = `${p.authUrl}?${new URLSearchParams(params)}`;
  return new Response(null, {
    status: 302,
    headers: { location: url, 'set-cookie': `vf_oauth=${platform}.${state}; Path=/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=900` },
  });
}

export async function oauthCallback(env, req, platform) {
  const p = PROVIDERS[platform];
  if (!p) throw new HttpError(404, 'Unbekannte Plattform');
  const url = new URL(req.url);
  const cookie = (req.headers.get('cookie') || '').match(/(?:^|;\s*)vf_oauth=([^;]+)/)?.[1];
  if (url.searchParams.get('error')) throw new HttpError(400, `Abgebrochen: ${url.searchParams.get('error_description') || url.searchParams.get('error')}`);
  if (!cookie || cookie !== `${platform}.${url.searchParams.get('state')}`) throw new HttpError(400, 'Ungültiger OAuth-Status – bitte erneut verbinden');
  const code = url.searchParams.get('code');
  const res = await p.exchange(env, code, redirectUri(env, req, platform));
  const ts = nowIso();
  await env.DB.prepare(`INSERT INTO connections(platform, account_id, account_name, token_enc, scopes, connected_at, updated_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(platform) DO UPDATE SET account_id = excluded.account_id, account_name = excluded.account_name, token_enc = excluded.token_enc,
      scopes = excluded.scopes, updated_at = excluded.updated_at`)
    .bind(platform, res.account_id, res.account_name, await encryptJson(env.TOKEN_KEY, res.token), res.scopes || '', ts, ts).run();
  await logEvent(env, 'CONNECTED', { platform, message: res.account_name });
  return new Response(null, { status: 302, headers: { location: '/#verbindungen', 'set-cookie': 'vf_oauth=; Path=/oauth; Max-Age=0' } });
}

/** Instagram-Token aus dem Meta-Dashboard ("Token generieren") übernehmen – für neue Apps ohne Instagram-Login-OAuth. */
export async function importInstagramToken(env, accessTok, igId) {
  if (!accessTok) throw new HttpError(400, 'Token fehlt');
  const ver = env.IG_GRAPH_VERSION || 'v24.0';
  let token, id, name;
  try {
    // Instagram-User-Token (IGAA…): graph.instagram.com, 60 Tage, verlängerbar
    const me = await getJson(`${IG_GRAPH(env)}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(accessTok)}`);
    token = { access_token: accessTok, expires_at: Date.now() + 50 * 86400000 };
    try { token = await PROVIDERS.instagram.refresh(env, token); } catch { /* frisch: erst nach 24 h verlängerbar */ }
    id = String(me.user_id || me.id); name = me.username + (me.account_type ? ` (${me.account_type})` : '');
  } catch (e) {
    // Systemnutzer-Token (EAA…, Unified Login): graph.facebook.com, läuft nicht ab
    if (!igId) throw new HttpError(400, `Token nicht als Instagram-Token lesbar und keine Konto-ID angegeben: ${e.message}`);
    const u = await getJson(`https://graph.facebook.com/${ver}/${igId}?fields=id,username&access_token=${encodeURIComponent(accessTok)}`);
    token = { access_token: accessTok, graph_base: 'https://graph.facebook.com', never_expires: true };
    id = String(u.id); name = `${u.username} (Systemnutzer)`;
  }
  const ts = nowIso();
  await env.DB.prepare(`INSERT INTO connections(platform, account_id, account_name, token_enc, scopes, connected_at, updated_at) VALUES('instagram',?,?,?,?,?,?)
      ON CONFLICT(platform) DO UPDATE SET account_id = excluded.account_id, account_name = excluded.account_name, token_enc = excluded.token_enc,
      scopes = excluded.scopes, updated_at = excluded.updated_at`)
    .bind(id, name, await encryptJson(env.TOKEN_KEY, token), 'instagram_content_publish', ts, ts).run();
  await logEvent(env, 'CONNECTED', { platform: 'instagram', message: `${name} (Token-Import)` });
  return { ok: true, account: name, account_id: id };
}

/** Gültiges Access-Token für einen Upload-Job (wird bei Bedarf erneuert). */
export async function accessToken(env, platform) {
  const row = await env.DB.prepare('SELECT * FROM connections WHERE platform = ?').bind(platform).first();
  if (!row) throw new HttpError(404, `${platform} ist nicht verbunden`);
  let tok = await decryptJson(env.TOKEN_KEY, row.token_enc);
  const p = PROVIDERS[platform];
  const margin = p.refreshBeforeMs || 10 * 60000;
  if (!tok.never_expires && (!tok.expires_at || tok.expires_at - Date.now() < margin)) {
    try {
      tok = await p.refresh(env, tok);
      await env.DB.prepare('UPDATE connections SET token_enc = ?, updated_at = ? WHERE platform = ?').bind(await encryptJson(env.TOKEN_KEY, tok), nowIso(), platform).run();
    } catch (e) {
      await logEvent(env, 'TOKEN_REFRESH_FAILED', { platform, level: 'error', message: e.message });
      if (!tok.expires_at || tok.expires_at < Date.now()) throw new HttpError(401, `${platform}: Anmeldung abgelaufen – im Dashboard neu verbinden`);
    }
  }
  return { access_token: tok.access_token, account_id: row.account_id, account_name: row.account_name, graph_version: env.IG_GRAPH_VERSION || 'v24.0', graph_base: tok.graph_base, scopes: row.scopes || '' };
}
