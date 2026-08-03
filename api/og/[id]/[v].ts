import { parseOgId, renderOgImage } from '../../og-render';

export const config = { runtime: 'edge' };

/** 카카오 이미지 캐시 우회용 경로: /api/og/{id}/{v}.png */
export default async function handler(req: Request) {
  try {
    const id = parseOgId(req);
    if (!id) return new Response('missing id', { status: 400 });
    return await renderOgImage(id);
  } catch {
    return new Response('og error', { status: 500 });
  }
}
