// src/pages/api/pdf-proxy.ts

import type { APIRoute } from "astro";

const FALLBACK_PDF_URL =
  "https://thearchiveoftheuntamed.xyz/wp/wp-content/uploads/2026/06/roma-junio-2026.pdf";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);

  const pdfUrl =
    url.searchParams.get("url") || FALLBACK_PDF_URL;

  try {
    const res = await fetch(pdfUrl);

    if (!res.ok) {
      return new Response(`PDF fetch failed: ${res.status}`, {
        status: res.status,
      });
    }

    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(`Proxy error: ${String(err)}`, {
      status: 500,
    });
  }
};