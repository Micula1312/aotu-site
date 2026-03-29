// src/pages/api/auth/revoke.ts
import type { APIRoute } from 'astro';
import { securityManager } from '../../../lib/api-security';

/**
 * POST /api/auth/revoke
 * Revoca un token o tutti i token di un client
 * 
 * Body:
 * {
 *   "token": "aotu_...",  // opzionale: revoca questo token specifico
 *   "clientName": "my-app"  // opzionale: revoca TUTTI i token del client
 * }
 * 
 * Almeno uno dei due campi è richiesto
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { token, clientName } = body;

    // Validazione: almeno uno richiesto
    if (!token && !clientName) {
      return new Response(
        JSON.stringify({
          error: 'Fornire "token" (revoca specifico) o "clientName" (revoca tutti)',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let revokedCount = 0;

    // Revoca token specifico
    if (token) {
      const revoked = securityManager.revokeToken(token);
      if (revoked) {
        revokedCount = 1;
      } else {
        return new Response(
          JSON.stringify({ error: 'Token non trovato o già revocato' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Revoca tutti i token del client
    if (clientName) {
      revokedCount = securityManager.revokeAllClientTokens(clientName);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${revokedCount} token revocato/i`,
        revokedCount,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Token revocation error:', error);
    return new Response(
      JSON.stringify({ error: 'Errore nella revoca del token' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};