import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonedToUtc, nextFreeSlot, normalizeSlots, upcomingSlots } from '../src/schedule.js';
import { buildMetadata, keywords, detectLanguage } from '../src/metadata.js';
import { hmacHex, encryptJson, decryptJson, b64url } from '../src/util.js';

const SLOTS = ['09:00', '11:30', '14:00', '17:00', '20:00'];
const TZ = 'Europe/Berlin';

test('Berlin Winterzeit: 09:00 = 08:00 UTC', () => {
  assert.equal(zonedToUtc(2026, 11, 20, '09:00', TZ).toISOString(), '2026-11-20T08:00:00.000Z');
});
test('Berlin Sommerzeit: 09:00 = 07:00 UTC', () => {
  assert.equal(zonedToUtc(2026, 7, 1, '09:00', TZ).toISOString(), '2026-07-01T07:00:00.000Z');
});
test('Zeitumstellungstag (29.03.2026)', () => {
  assert.equal(zonedToUtc(2026, 3, 29, '09:00', TZ).toISOString(), '2026-03-29T07:00:00.000Z');
});
test('nächster freier Termin nach 12:00 Berlin ist 14:00', () => {
  const from = new Date('2026-11-19T11:00:00Z'); // 12:00 Berlin
  assert.equal(nextFreeSlot({ slots: SLOTS, tz: TZ, taken: new Set(), from }), '2026-11-19T13:00:00.000Z');
});
test('belegter Termin wird übersprungen, verspätetes Video bekommt nächsten', () => {
  const from = new Date('2026-11-19T11:00:00Z');
  const taken = new Set(['2026-11-19T13:00:00.000Z', '2026-11-19T16:00:00.000Z']);
  assert.equal(nextFreeSlot({ slots: SLOTS, tz: TZ, taken, from }), '2026-11-19T19:00:00.000Z');
});
test('nach 20:00 -> nächster Tag 09:00', () => {
  const from = new Date('2026-11-19T19:30:00Z');
  assert.equal(nextFreeSlot({ slots: SLOTS, tz: TZ, taken: new Set(), from }), '2026-11-20T08:00:00.000Z');
});
test('5 Termine pro Tag', () => {
  const up = upcomingSlots({ slots: SLOTS, tz: TZ, from: new Date('2026-11-19T23:30:00Z'), count: 5 });
  assert.deepEqual(up.map((x) => x.slice(11, 16)), ['08:00', '10:30', '13:00', '16:00', '19:00']);
});
test('Uhrzeiten werden bereinigt', () => {
  assert.deepEqual(normalizeSlots(['9:00', '25:00', '11:30', '11:30', 'x']), ['09:00', '11:30']);
});
test('Metadaten aus meta haben Vorrang, Plattform-Limits', () => {
  const m = buildMetadata({ meta: { title: 'The 13th Floor 🛗', description: 'Nobody talks about it. #elevator #creepy', hashtags: ['horror'] }, script: 'An elevator story.' });
  assert.equal(m.title, 'The 13th Floor 🛗');
  assert.ok(m.youtube.title.includes('#Shorts') && m.youtube.title.length <= 100);
  assert.ok(m.hashtags.includes('horror') && m.hashtags.includes('elevator'));
  assert.ok(!m.description.includes('#'));
  assert.ok(m.instagram.caption.length <= 2200 && m.tiktok.title.length <= 2200 && !m.tiktok.title.includes('#fyp'))  // #fyp bringt nichts (21.11.2026);
});
test('Metadaten ohne meta (regelbasiert)', () => {
  const m = buildMetadata({ script: 'In this town yawning is illegal. Every yawn costs twenty dollars. The mayor loves the yawning law. Would you survive here?' });
  assert.equal(m.language, 'en');
  assert.ok(m.title.length > 5);
  assert.ok(m.description.endsWith('?'));
  assert.ok(m.hashtags.length >= 3);
});
test('Sprache/Schlagwörter', () => {
  assert.equal(detectLanguage('Das ist eine Geschichte über die Stadt und ich weiß nicht'), 'de');
  assert.deepEqual(keywords('pizza pizza pizza dragon dragon the the the', 2), ['pizza', 'dragon']);
});
test('HMAC + Token-Verschlüsselung', async () => {
  assert.equal((await hmacHex('k', 'm')).length, 64);
  const key = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const enc = await encryptJson(key, { a: 1 });
  assert.deepEqual(await decryptJson(key, enc), { a: 1 });
});
