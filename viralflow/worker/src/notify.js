// Push-Benachrichtigungen aufs Handy über ntfy.sh (kostenlos, App für Android/iOS).
// Secret NTFY_TOPIC setzen (langer, zufälliger Name = dein privater Kanal). Ohne Secret: keine Benachrichtigung.
export async function notify(env, title, message, priority = 'default') {
  if (!env.NTFY_TOPIC) return;
  const server = env.NTFY_SERVER || 'https://ntfy.sh';
  try {
    await fetch(`${server}/${encodeURIComponent(env.NTFY_TOPIC)}`, {
      method: 'POST',
      headers: { title: encodeRfc2047(title), priority, tags: 'movie_camera' },
      body: message,
    });
  } catch { /* Benachrichtigung ist optional */ }
}

// HTTP-Header dürfen nur ASCII enthalten -> Umlaute/Emoji als RFC-2047 kodieren (ntfy versteht das)
function encodeRfc2047(s) {
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(bin)}?=`;
}
