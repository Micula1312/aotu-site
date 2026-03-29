import type { APIRoute } from 'astro';

/**
 * GET /api/media
 * Fetch media from WordPress and transform for constellation viewer
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const WP_API_URL = 'https://thearchiveoftheuntamed.xyz/wp/wp-json/wp/v2/media';
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${WP_API_URL}?per_page=100`, { 
      headers,
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`WordPress API error: ${response.statusText}`);
    }

    const media = await response.json();

    // Transform WordPress media to constellation format
    const transformedMedia = media.map((item: any) => ({
      id: item.id,
      title: item.title.rendered || 'Untitled',
      url: `/api/img?src=${encodeURIComponent(item.source_url)}`,
      thumbnail: `/api/img?src=${encodeURIComponent(item.media_details?.sizes?.thumbnail?.source_url || item.source_url)}`,
      description: item.description?.rendered || '',
      alt: item.alt_text || '',
      date: item.date,
    }));

    return new Response(JSON.stringify(transformedMedia), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Media fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch media from WordPress' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};