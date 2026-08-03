export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://hguhjojlzcufdkwrjzuz.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhndWhqb2psemN1ZmRrd3JqenV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNzc1MzYsImV4cCI6MjA5NDY1MzUzNn0.5aZQiz3-nqChG7gFA16WsGOdptBG2qQi6NxPvnC1JSs';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  const v = url.searchParams.get('v') || '';
  const origin = url.origin;
  const appUrl = `${origin}/?share=${id}`;
  const img = `${origin}/api/og?id=${encodeURIComponent(id)}${v ? `&v=${encodeURIComponent(v)}` : ''}`;

  let title = '골프 메모';
  let desc = '라운드 기록 · 미스 분석';
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/rounds?id=eq.${id}&is_public=eq.true&select=course_name,date,time`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    const arr = await r.json();
    const round = Array.isArray(arr) ? arr[0] : null;
    if (round) {
      title = round.course_name || '골프 라운드';
      const line = [round.date, round.time].filter(Boolean).join('  ·  ');
      desc = line || '라운드 기록';
    }
  } catch {
    /* keep defaults */
  }

  const html = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:image" content="${img}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${appUrl}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
<meta name="twitter:image" content="${img}"/>
</head><body>
<script>location.replace(${JSON.stringify(appUrl)});</script>
<p style="font-family:sans-serif;padding:24px;color:#555">라운드 기록으로 이동 중… <a href="${appUrl}">여기</a>를 눌러 이동</p>
</body></html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}