import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://hguhjojlzcufdkwrjzuz.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhndWhqb2psemN1ZmRrd3JqenV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNzc1MzYsImV4cCI6MjA5NDY1MzUzNn0.5aZQiz3-nqChG7gFA16WsGOdptBG2qQi6NxPvnC1JSs';

const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

const FONT_400 = 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.woff';
const FONT_700 = 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-700-normal.woff';

export default async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new Response('missing id', { status: 400 });

    const [roundRes, holesRes, font400, font700] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/rounds?id=eq.${id}&is_public=eq.true&select=course_name,date,time`, { headers: HEADERS }),
      fetch(`${SUPABASE_URL}/rest/v1/holes?round_id=eq.${id}&select=par,total_strokes,over_par`, { headers: HEADERS }),
      fetch(FONT_400).then(r => r.arrayBuffer()),
      fetch(FONT_700).then(r => r.arrayBuffer()),
    ]);

    const rounds = await roundRes.json();
    const holes = await holesRes.json();
    const round = Array.isArray(rounds) ? rounds[0] : null;

    const course: string = (round && round.course_name) || '골프 라운드';
    const date: string = (round && round.date) || '';
    const time: string = (round && round.time) || '';

    const holeList: Array<{ over_par?: number; total_strokes?: number }> = Array.isArray(holes) ? holes : [];
    const total = holeList.reduce((s, h) => s + (h.total_strokes || 0), 0);
    const overTotal = holeList.reduce((s, h) => s + (h.over_par || 0), 0);
    const overStr = overTotal === 0 ? 'E' : overTotal > 0 ? `+${overTotal}` : `${overTotal}`;

    let birdieDown = 0, parCnt = 0, bogey = 0, dblUp = 0;
    for (const h of holeList) {
      const o = h.over_par ?? 0;
      if (o <= -1) birdieDown++;
      else if (o === 0) parCnt++;
      else if (o === 1) bogey++;
      else dblUp++;
    }

    const stats: Array<[string, number, string]> = [
      ['버디 ↓', birdieDown, '#93C5FD'],
      ['파', parCnt, '#C0DD97'],
      ['보기', bogey, '#FCD34D'],
      ['더블 +', dblUp, '#FCA5A5'],
    ];

    const dateLine = [date, time].filter(Boolean).join('   ·   ');

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#1B4332',
            color: '#ffffff',
            padding: '64px 72px',
            fontFamily: 'NotoKR',
          }}
        >
          <div style={{ display: 'flex', fontSize: 30, color: '#C0DD97' }}>{dateLine || '골프 라운드 기록'}</div>

          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, marginTop: 10 }}>{course}</div>

          <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 24 }}>
            <div style={{ display: 'flex', fontSize: 128, fontWeight: 700, lineHeight: 1 }}>{total}</div>
            <div style={{ display: 'flex', fontSize: 46, marginLeft: 14, marginBottom: 16, color: '#C0DD97' }}>타  ({overStr})</div>
          </div>

          <div style={{ display: 'flex', marginTop: 'auto', width: '100%' }}>
            {stats.map(([label, value, color]) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flexGrow: 1,
                  flexBasis: 0,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 20,
                  padding: '18px 22px',
                  marginRight: label === '더블 +' ? 0 : 18,
                }}
              >
                <div style={{ display: 'flex', fontSize: 28, color }}>{label}</div>
                <div style={{ display: 'flex', fontSize: 60, fontWeight: 700, marginTop: 4 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: 'NotoKR', data: font400, weight: 400, style: 'normal' },
          { name: 'NotoKR', data: font700, weight: 700, style: 'normal' },
        ],
      },
    );
  } catch {
    return new Response('og error', { status: 500 });
  }
}
