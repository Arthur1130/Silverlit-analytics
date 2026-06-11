// Client de l'API utilisateurs (comptes partagés en base).
// Tolérant aux pannes : si l'API/base est indisponible, renvoie null/false
// et le front retombe sur les comptes de référence (filet de sécurité).

import type { User, Role } from './backend';
import { setToken, authHeaders } from './authToken';

export interface CreateUserInput {
  pseudo: string;
  fullName: string;
  email: string;
  role: Role;
  password: string;
}

/** Liste des comptes en base. null = API indisponible. */
export async function fetchUsersFromServer(): Promise<User[] | null> {
  try {
    const res = await fetch('/api/users', { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? (data as User[]) : null;
  } catch {
    return null;
  }
}

/** Crée un compte en base. Renvoie l'utilisateur, ou lève une erreur lisible. */
export async function createUserOnServer(input: CreateUserInput): Promise<User> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Création impossible (base indisponible ?)');
  }
  return res.json();
}

/** Supprime un compte en base. */
export async function deleteUserOnServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/users?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}

/** Change le rôle d'un compte en base. */
export async function updateUserRoleOnServer(id: string, role: Role): Promise<boolean> {
  try {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, role }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Vérifie un couple pseudo/mot de passe en base. null = invalide ou base indispo. */
export async function verifyLoginOnServer(pseudo: string, password: string): Promise<User | null> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo, password }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    // Stocke le jeton (autorise ensuite les écritures) et le retire de l'objet user.
    if (body && typeof body.token === 'string') setToken(body.token);
    if (body && 'token' in body) delete body.token;
    return body as User;
  } catch {
    return null;
  }
}
