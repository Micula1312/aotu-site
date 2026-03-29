// src/lib/api-security.ts
import type { APIRoute } from 'astro';

interface ApiToken {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  scope: string[];
  clientName: string;
}

class ApiSecurityManager {
  private tokens: Map<string, ApiToken> = new Map();
  private tokenSecret = process.env.API_SECRET_KEY || 'dev-secret-key-change-in-production';
  private tokenDuration = 24 * 60 * 60 * 1000; // 24 ore

  /**
   * Genera un nuovo token API con scopi specifici
   */
  generateToken(clientName: string, scope: string[] = ['read:media']): string {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.tokenDuration);
    
    const token = this.createSecureToken(clientName, now.getTime());
    
    this.tokens.set(token, {
      token,
      createdAt: now,
      expiresAt,
      scope,
      clientName,
    });

    return token;
  }

  /**
   * Verifica se un token è valido
   */
  validateToken(token: string, requiredScope?: string): boolean {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData) return false;
    if (tokenData.revokedAt) return false; // Token revocato
    if (new Date() > tokenData.expiresAt) {
      this.tokens.delete(token);
      return false; // Token scaduto
    }
    
    if (requiredScope && !tokenData.scope.includes(requiredScope)) {
      return false; // Scope insufficiente
    }
    
    return true;
  }

  /**
   * Revoca un token (per logout o revoca di accesso)
   */
  revokeToken(token: string): boolean {
    const tokenData = this.tokens.get(token);
    if (!tokenData) return false;
    
    tokenData.revokedAt = new Date();
    return true;
  }

  /**
   * Revoca tutti i token di un client (logout globale)
   */
  revokeAllClientTokens(clientName: string): number {
    let revoked = 0;
    for (const [token, data] of this.tokens) {
      if (data.clientName === clientName && !data.revokedAt) {
        data.revokedAt = new Date();
        revoked++;
      }
    }
    return revoked;
  }

  /**
   * Pulisce i token scaduti (cleanup periodico)
   */
  cleanupExpiredTokens(): number {
    let cleaned = 0;
    const now = new Date();
    
    for (const [token, data] of this.tokens) {
      if (now > data.expiresAt) {
        this.tokens.delete(token);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Genera token sicuro (in production usare JWT)
   */
  private createSecureToken(clientName: string, timestamp: number): string {
    const randomPart = Math.random().toString(36).substring(2, 15);
    const hashPart = btoa(`${clientName}:${timestamp}:${randomPart}`).replace(/[^a-zA-Z0-9]/g, '');
    return `aotu_${hashPart.substring(0, 48)}`;
  }

  /**
   * Ottieni info token (solo per debug, non esporre in produzione)
   */
  getTokenInfo(token: string) {
    const data = this.tokens.get(token);
    if (!data) return null;
    
    return {
      clientName: data.clientName,
      scope: data.scope,
      expiresAt: data.expiresAt,
      isRevoked: !!data.revokedAt,
    };
  }
}

// Singleton
export const securityManager = new ApiSecurityManager();

/**
 * Middleware per proteggere gli endpoint API
 */
export function protectedApiMiddleware(token?: string): boolean {
  if (!token) return false;
  return securityManager.validateToken(token, 'read:media');
}