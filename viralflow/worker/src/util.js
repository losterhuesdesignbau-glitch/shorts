// Hilfsfunktionen: Antworten, Zeit, HMAC, Verschlüsselung

export const nowIso = (d = new Date()) => d.toISOString();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const enc = new TextEncoder();

export function b64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
export const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function hmacHex(secret, msg) {
  return hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(msg)));
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/**
 * Webhook-Signatur prüfen: X-VF-Timestamp (Unix-Sekunden) + X-VF-Signature = hex(HMAC-SHA256(secret, ts + "." + body)).
 * Gültig 5 Minuten (Schutz gegen Wiederholung).
 */
export async function verifySignedRequest(req, secret, body) {
  if (!secret) throw new HttpError(500, 'VF_WEBHOOK_SECRET fehlt');
  const ts = req.headers.get('x-vf-timestamp');
  const sig = req.headers.get('x-vf-signature');
  if (!ts || !sig) throw new HttpError(401, 'Signatur fehlt');
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) throw new HttpError(401, 'Signatur abgelaufen');
  const expect = await hmacHex(secret, `${ts}.${body}`);
  if (!safeEqual(expect, sig)) throw new HttpError(401, 'Signatur ungültig');
}

// AES-GCM für OAuth-Tokens in der Datenbank. TOKEN_KEY = beliebige lange Zufallszeichenkette (Schlüssel = SHA-256 davon).
async function aesKey(secret) {
  if (!secret || secret.length < 24) throw new HttpError(500, 'TOKEN_KEY fehlt oder ist zu kurz (mind. 24 Zeichen)');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptJson(keyB64, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyB64), enc.encode(JSON.stringify(obj)));
  return `${b64url(iv)}.${b64url(ct)}`;
}
export async function decryptJson(keyB64, s) {
  const [iv, ct] = s.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64url(iv) }, await aesKey(keyB64), unb64url(ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

export function randomId(n = 16) { return b64url(crypto.getRandomValues(new Uint8Array(n))); }

export const PLATFORMS = ['youtube', 'instagram', 'tiktok'];
