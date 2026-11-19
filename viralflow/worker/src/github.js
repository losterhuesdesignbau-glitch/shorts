// Startet GitHub-Actions-Workflows per repository_dispatch (Render- und Upload-Arbeiter)
export async function dispatchGithub(env, eventType, payload) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) throw new Error('GITHUB_TOKEN/GITHUB_REPO nicht gesetzt');
  const base = env.GITHUB_API_BASE || 'https://api.github.com';
  const r = await fetch(`${base}/repos/${env.GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'viralflow-orchestrator',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ event_type: eventType, client_payload: payload }),
  });
  if (r.status !== 204) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
}
