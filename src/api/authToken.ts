// Jeton d'authentification côté client.
//
// Délivré par /api/login à la connexion, stocké en mémoire + localStorage
// (persiste entre les rechargements), et joint aux ÉCRITURES de l'API
// (en-tête « Authorization: Bearer <jeton> »). Sans jeton, le serveur refuse
// les écritures sur /api/batches et /api/users.

const KEY = 'silverlit-auth-token';
let mem: string | null = null;

export function setToken(token: string | null): void {
  mem = token;
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}

export function getToken(): string | null {
  if (mem) return mem;
  try {
    mem = localStorage.getItem(KEY);
  } catch {
    mem = null;
  }
  return mem;
}

/** Ajoute l'en-tête Authorization si un jeton est disponible. */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const t = getToken();
  return t ? { ...extra, Authorization: `Bearer ${t}` } : extra;
}
