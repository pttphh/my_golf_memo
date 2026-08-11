import { parseOgId, renderOgImage } from './og-render';

export const config = { runtime: 'edge' };

/** /api/og?id=...&v=... (카카오는 경로형 동적 이미지 URL을 자주 실패시킴) */
export default async function handler(req: Request) {
  try {
    const id = parseOgId(req);
    if (!id) return new Response('missing id', { status: 400 });
    return await renderOgImage(id);
  } catch {
    return new Response('og error', { status: 500 });
  }
}
