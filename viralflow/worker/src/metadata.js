// Titel, Beschreibungen und Hashtags – ohne kostenpflichtige KI.
// Vorrang haben Angaben aus dem Skript (meta.title / meta.description / meta.hashtags),
// sonst werden sie regelbasiert aus Skript und Dateiname erzeugt.

const STOP = new Set((
  'the a an and or but of to in on at for with from by is are was were be been being this that these those it its ' +
  'you your we our they them their he she his her i me my not no so if then than as into out up down over just ' +
  'what when where who why how which can could would should will do does did have has had there here all any ' +
  'some more most very really about because only also even still every each one two three get got make made ' +
  'der die das und oder aber den dem des ein eine einer eines einem einen ist sind war waren wird werden mit von zu ' +
  'im in am an auf für bei aus nach vor über unter durch nicht kein keine auch noch nur schon sehr wie was wer wo ' +
  'warum wenn dann als dass sich sie er es wir ihr ich du mich dich uns euch man hat haben hatte hatten kann können ' +
  'muss müssen soll sollen diese dieser dieses jeder jede jedes alle mehr immer wieder einfach hier dort'
).split(/\s+/));

const BASE_TAGS = {
  // #fyp/#foryou bringen nachweislich nichts (TikTok sortiert nach Inhalt/Suchbegriffen); #shorts gehört nur zu YouTube
  en: { all: ['story'], youtube: ['shorts'], instagram: ['reels'], tiktok: [] },
  de: { all: ['geschichte'], youtube: ['shorts'], instagram: ['reels'], tiktok: [] },
};

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export function cleanTag(t) {
  return String(t || '').replace(/^#/, '').normalize('NFC').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 40);
}

export function detectLanguage(text) {
  const t = ` ${String(text || '').toLowerCase()} `;
  const de = (t.match(/ (der|die|das|und|ist|nicht|ein|eine|ich|du|wir) /g) || []).length + (t.match(/[äöüß]/g) || []).length;
  const en = (t.match(/ (the|and|is|not|you|we|this|that|of|to) /g) || []).length;
  return de > en ? 'de' : 'en';
}

export function keywords(text, n = 4) {
  const freq = new Map();
  for (const raw of String(text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 4 || STOP.has(raw) || /^\d+$/.test(raw)) continue;
    freq.set(raw, (freq.get(raw) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, n).map((x) => x[0]);
}

function truncate(s, max) {
  s = clean(s);
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + '…';
}

function deriveTitle(script, filename) {
  const lines = String(script || '').split('\n').map(clean).filter(Boolean);
  if (lines.length && lines[0].length <= 80 && !lines[0].startsWith('"')) return lines[0];
  const first = clean(String(script || '').replace(/["„“]/g, '')).split(/(?<=[.!?])\s/)[0];
  if (first) return truncate(first, 70);
  return clean(String(filename || 'Neues Video').replace(/\.mp4$/i, '').replace(/[_-]+/g, ' ').replace(/\bEN\b|\bDE\b/g, ''));
}

function deriveDescription(script) {
  const body = clean(String(script || '').replace(/["„“]/g, ''));
  const sentences = body.split(/(?<=[.!?])\s/).filter(Boolean);
  const q = [...sentences].reverse().find((s) => s.endsWith('?')); // Schlussfrage an die Zuschauer
  const intro = sentences.slice(0, 2).join(' ');
  return truncate([intro, q && q !== sentences[0] ? q : ''].filter(Boolean).join(' '), 400);
}

/**
 * @param {object} p {meta: {title, description, hashtags, language}, script, filename, settings}
 * @returns {{language, title, description, hashtags, youtube, instagram, tiktok}}
 */
export function buildMetadata({ meta = {}, script = '', filename = '', settings = {} }) {
  const language = meta.language || settings.language || detectLanguage(`${script} ${meta.title || ''} ${meta.description || ''}`);
  const base = BASE_TAGS[language] || BASE_TAGS.en;
  const title = clean(meta.title) || deriveTitle(script, filename);
  const description = clean(meta.description) || deriveDescription(script) || title;

  let own = Array.isArray(meta.hashtags) ? meta.hashtags : String(meta.hashtags || '').split(/[\s,]+/);
  // Hashtags, die direkt in der Beschreibung stehen, übernehmen und aus dem Text entfernen
  const inDesc = description.match(/#[\p{L}\p{N}_]+/gu) || [];
  own = [...own, ...inDesc];
  const descText = clean(description.replace(/#[\p{L}\p{N}_]+/gu, ''));
  const extra = (settings.base_hashtags || '').split(/[\s,]+/);
  const kw = keywords(`${title} ${script}`, 4);
  const uniq = (arr) => [...new Set(arr.map(cleanTag).filter(Boolean).map((t) => t.toLowerCase()))];
  const core = uniq([...own, ...extra, ...kw, ...base.all]).slice(0, 8);
  const hashtags = core;
  const tagStr = (list) => list.map((t) => '#' + t).join(' ');

  // YouTube: Titel max. 100 Zeichen, #Shorts im Titel hilft bei der Einordnung
  let ytTitle = truncate(title, 100);
  if (!/#shorts/i.test(ytTitle) && ytTitle.length + 8 <= 100) ytTitle += ' #Shorts';
  const ytTags = [];
  let len = 0;
  for (const t of uniq([...core, ...base.youtube])) { if (len + t.length + 1 > 450) break; ytTags.push(t); len += t.length + 1; }
  const youtube = {
    title: ytTitle,
    description: truncate(`${descText}\n\n${tagStr(uniq([...core, ...base.youtube]).slice(0, 10))}`, 4900),
    tags: ytTags,
    categoryId: settings.youtube_category || '24',
    defaultLanguage: language,
  };
  // Instagram: Caption max. 2200 Zeichen, max. 30 Hashtags
  const instagram = {
    caption: truncate(`${title}\n\n${descText}\n\n${tagStr(uniq([...core, ...base.instagram]).slice(0, 15))}`, 2200),
  };
  // TikTok (TikTok ist eine Suchmaschine): 1. Zeile = Suchbegriff so, wie Leute tippen + Hook; 2. Zeile = Frage für Kommentare;
  // dann 3–5 Hashtags (Nische + Kategorie). Eigene Caption über meta.tiktok.caption möglich.
  const tt = meta.tiktok || {};
  const kwl = (Array.isArray(meta.keywords) ? meta.keywords : String(meta.keywords || '').split(/\s*,\s*/)).map(clean).filter(Boolean);
  const question = clean(meta.question) || ((descText.match(/[^.!?]*\?/g) || []).slice(-1)[0] || '').trim();
  const ttTags = uniq([...(tt.hashtags || []), ...own, ...kwl.map((k) => k.replace(/\s+/g, '')), ...base.tiktok]).slice(0, 5);
  const line1 = kwl.length ? `${kwl[0].charAt(0).toUpperCase() + kwl[0].slice(1)}: ${title}` : title;
  const tiktok = {
    title: (String(tt.caption || '').trim() || [line1, question, tagStr(ttTags)].filter(Boolean).join('\n')).slice(0, 2200),
  };
  return { language, title, description: descText, hashtags, youtube, instagram, tiktok };
}
