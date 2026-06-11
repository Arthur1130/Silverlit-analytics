// Util d'authentification serveur — jeton signé (HMAC-SHA256).
//
// Le secret de signature vit UNIQUEMENT côté serveur (variable d'environnement
// AUTH_SECRET, avec un repli intégré). Il n'est jamais envoyé au navigateur :
// ce fichier fait partie des fonctions serverless Vercel, pas du bundle SPA.
// Le client reçoit un jeton opaque qu'il ne peut pas forger sans le secret.
//
// Un fichier préfixé par « _ » dans /api n'est pas exposé comme route Vercel.

import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.AUTH_SECRET || 'anizia-silverlit-server-secret-v1-2026';
const DEFAULT_TTL = 60 * 60 * 24; // 24 h

export function signToken(payload: Record<string, unknown>, ttlSeconds = DEFAULT_TTL): string {
  const body = { ...payload, exp: Date.now() + ttlSeconds * 1000 };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', SECRET).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(data, 'base64url').toString()) as Record<string, unknown>;
    if (typeof body.exp !== 'number' || body.exp < Date.now()) return null;
    return body;
  } catch {
    return null;
  }
}

// Renvoie le payload si la requête porte un en-tête « Authorization: Bearer <jeton> »
// valide, sinon null. Sert à protéger les écritures des endpoints.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAuth(req: any): Record<string, unknown> | null {
  const h = req?.headers?.authorization ?? req?.headers?.Authorization ?? '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? verifyToken(m[1]) : null;
}
