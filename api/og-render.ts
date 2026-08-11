import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';

const SUPABASE_URL = 'https://hguhjojlzcufdkwrjzuz.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhndWhqb2psemN1ZmRrd3JqenV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNzc1MzYsImV4cCI6MjA5NDY1MzUzNn0.5aZQiz3-nqChG7gFA16WsGOdptBG2qQi6NxPvnC1JSs';

const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

const FONT_400 = 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.woff';
const FONT_700 = 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-700-normal.woff';

/** /api/og?id=... 또는 /api/og/{id}/{v}.png 에서 id 추출 */
export function parseOgId(req: Request): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('id');
  if (fromQuery) return fromQuery;

  const parts = url.pathname.split('/').filter(Boolean);
  // api / og / {id} / {v}.png
  const ogIdx = parts.indexOf('og');
  if (ogIdx >= 0 && parts[ogIdx + 1]) {
    return decodeURIComponent(parts[ogIdx + 1]);
  }
  return null;
}

export async function renderOgImage(id: string): Promise<Response> {
  const [roundRes, holesRes, font400, font700] = await Promise.all([
    // is_public 필터 없음: 공유 직후 레이스로 빈 이미지가 고정되는 것 방지
    // (앱 공유 화면은 계속 is_public 검사)
    fetch(`${SUPABASE_URL}/rest/v1/rounds?id=eq.${id}&select=course_name,date,time`, {
      headers: HEADERS,
    }),
    fetch(`${SUPABASE_URL}/rest/v1/holes?round_id=eq.${id}&select=par,total_strokes,over_par`, {
      headers: HEADERS,
    }),
    fetch(FONT_400).then((r) => r.arrayBuffer()),
    fetch(FONT_700).then((r) => r.arrayBuffer()),
  ]);

  const rounds = await roundRes.json();
  const holes = await holesRes.json();
  const round = Array.isArray(rounds) ? rounds[0] : null;

  const course: string = (round && round.course_name) || '골프 라운드';
  const date: string = (round && round.date) || '';
  const time: string = (round && round.time) || '';

  const holeList: Array<{ over_par?: number; total_strokes?: number }> = Array.isArray(holes)
    ? holes
    : [];
  const total = holeList.reduce((s, hh) => s + (hh.total_strokes || 0), 0);
  const overTotal = holeList.reduce((s, hh) => s + (hh.over_par || 0), 0);
  const overStr = overTotal === 0 ? 'E' : overTotal > 0 ? `+${overTotal}` : `${overTotal}`;

  let birdieDown = 0,
    parCnt = 0,
    bogey = 0,
    dbl = 0,
    tripleUp = 0;
  for (const hh of holeList) {
    const o = hh.over_par ?? 0;
    if (o <= -1) birdieDown++;
    else if (o === 0) parCnt++;
    else if (o === 1) bogey++;
    else if (o === 2) dbl++;
    else tripleUp++;
  }

  const stats: Array<[string, number, string]> = [
    ['버디 ↓', birdieDown, '#93C5FD'],
    ['파', parCnt, '#C0DD97'],
    ['보기', bogey, '#FCD34D'],
    ['더블', dbl, '#FCA5A5'],
    ['트리플 +', tripleUp, '#F87171'],
  ];

  const dateLine = [date, time].filter(Boolean).join('   ·   ') || '골프 라운드 기록';

  const statCards = stats.map(([label, value, color], i) =>
    h(
      'div',
      {
        key: label,
        style: {
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          flexBasis: 0,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 18,
          padding: '16px 16px',
          marginRight: i === stats.length - 1 ? 0 : 14,
        },
      },
      h('div', { style: { display: 'flex', fontSize: 25, color } }, label),
      h(
        'div',
        { style: { display: 'flex', fontSize: 54, fontWeight: 700, marginTop: 4 } },
        String(value),
      ),
    ),
  );

  const tree = h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#1B4332',
        color: '#ffffff',
        padding: '64px 64px',
        fontFamily: 'NotoKR',
      },
    },
    h('div', { style: { display: 'flex', fontSize: 30, color: '#C0DD97' } }, dateLine),
    h('div', { style: { display: 'flex', fontSize: 84, fontWeight: 700, marginTop: 10 } }, course),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'flex-end', marginTop: 24 } },
      h(
        'div',
        { style: { display: 'flex', fontSize: 128, fontWeight: 700, lineHeight: 1 } },
        String(total),
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontSize: 46,
            marginLeft: 14,
            marginBottom: 16,
            color: '#C0DD97',
          },
        },
        `타  (${overStr})`,
      ),
    ),
    h('div', { style: { display: 'flex', marginTop: 'auto', width: '100%' } }, statCards),
  );

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'NotoKR', data: font400, weight: 400, style: 'normal' },
      { name: 'NotoKR', data: font700, weight: 700, style: 'normal' },
    ],
    headers: {
      // 생성 비용이 커서 짧게 두면 카카오 스크랩 타임아웃/실패가 잦음
      'cache-control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
