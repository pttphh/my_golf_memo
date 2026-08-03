import { parseOgId, renderOgImage } from '../og-render';

export const config = { runtime: 'edge' };

/** 하위 호환: /api/og?id=... */
export default async function handler(req: Request) {
  try {
    const id = parseOgId(req);
    if (!id) return new Response('missing id', { status: 400 });
    return await renderOgImage(id);
  } catch {
    return new Response('og error', { status: 500 });
  }
}
