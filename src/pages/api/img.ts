import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const src = url.searchParams.get('src') || url.searchParams.get('url') || url.searchParams.get('u') || '';
  const base = url.searchParams.get('base') || '';

  // Prova a costruire sempre un URL assoluto usando eventualmente "base"
  let abs: string;
  try {
    abs = new URL(src, base || undefined).toString();
  } catch (e: any) {
    const msg = `Bad URL — src=${JSON.stringify(src)} base=${JSON.stringify(base)} err=${e?.message || e}`;
    return new Response(msg, { status: 422, headers: { 'Content-Type': 'text/plain' } });
  }

  // Consenti solo http/https
  if (!/^https?:\/\//i.test(abs)) {
    return new Response(`Unsupported protocol — abs=${abs}`, { status: 422, headers: { 'Content-Type': 'text/plain' } });
  }

  // Fetch a streaming verso upstream
  let upstream: Response;
  try {
    upstream = await fetch(abs, {
      headers: { 'User-Agent': 'AOTU-Proxy/1.0' }
    });
  } catch (e: any) {
    const msg = `Upstream fetch failed — abs=${abs} err=${e?.message || e}`;
    return new Response(msg, { status: 502, headers: { 'Content-Type': 'text/plain' } });
  }

  if (!upstream.ok || !upstream.body) {
    const msg = `Upstream error — abs=${abs} status=${upstream.status}`;
    return new Response(msg, { status: upstream.status || 502, headers: { 'Content-Type': 'text/plain' } });
  }

  const type = upstream.headers.get('content-type') || 'image/jpeg';
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    }
  });
};
