// Client HTTP du back-end Silverlit Analytics.
// Base configurable via VITE_API_URL (défaut : serveur local Express).

const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'silverlit-analytics-token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* no-op */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

// Appel API typé. Lève une ApiError en cas de réponse non-2xx.
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Serveur injoignable — vérifiez que le back-end est démarré');
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* corps vide ou non-JSON */
  }

  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? `Erreur ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const API_URL = API_BASE;
