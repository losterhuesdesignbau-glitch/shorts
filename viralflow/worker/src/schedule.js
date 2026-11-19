// Veröffentlichungsplan: feste Tageszeiten in einer Zeitzone (Standard Europe/Berlin, inkl. Sommerzeit)

const dtfCache = new Map();
function dtf(tz) {
  if (!dtfCache.has(tz)) {
    dtfCache.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return dtfCache.get(tz);
}

/** Wanduhrzeit einer UTC-Zeit in der Zeitzone -> {y,m,d,h,min,s} */
export function wallTime(date, tz) {
  const p = Object.fromEntries(dtf(tz).formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

function offsetMs(date, tz) {
  const w = wallTime(date, tz);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Lokale Zeit (Datum + "HH:MM") in der Zeitzone -> UTC-Date */
export function zonedToUtc(y, m, d, hhmm, tz) {
  const [hh, mm] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz); // zweiter Durchlauf für Sommerzeit-Wechsel
  return new Date(t);
}

export function normalizeSlots(slots) {
  const ok = (slots || [])
    .map((s) => String(s).trim())
    .filter((s) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s))
    .map((s) => s.padStart(5, '0'));
  return [...new Set(ok)].sort();
}

/**
 * Nächster freier Termin ab `from` (+ Vorlauf). `taken` = Set von ISO-Zeiten bereits belegter Termine.
 * Wird ein Video zu spät fertig, ist automatisch der nächste freie Termin dran.
 */
export function nextFreeSlot({ slots, tz, taken, from = new Date(), leadMinutes = 3, horizonDays = 60 }) {
  const list = normalizeSlots(slots);
  if (!list.length) throw new Error('Keine gültigen Veröffentlichungszeiten');
  const earliest = from.getTime() + leadMinutes * 60000;
  const start = wallTime(from, tz);
  for (let day = 0; day <= horizonDays; day++) {
    const base = new Date(Date.UTC(start.y, start.m - 1, start.d + day, 12));
    for (const hhmm of list) {
      const t = zonedToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hhmm, tz);
      if (t.getTime() < earliest) continue;
      const iso = t.toISOString();
      if (!taken.has(iso)) return iso;
    }
  }
  throw new Error('Kein freier Termin in den nächsten ' + horizonDays + ' Tagen');
}

/** Kommende Termine (für das Dashboard) */
export function upcomingSlots({ slots, tz, from = new Date(), count = 10 }) {
  const out = [];
  const taken = new Set();
  let cursor = from;
  while (out.length < count) {
    const iso = nextFreeSlot({ slots, tz, taken, from: cursor, leadMinutes: 0 });
    out.push(iso); taken.add(iso);
    cursor = new Date(iso);
  }
  return out;
}

export function formatLocal(iso, tz) {
  return new Intl.DateTimeFormat('de-DE', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}
