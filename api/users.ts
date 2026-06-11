// Fonction serverless Vercel — gestion des UTILISATEURS en base (partagés).
//
// Permet d'ajouter/lister/supprimer des comptes depuis le site (page Équipe),
// stockés dans la même base Postgres → comptes valables sur tous les appareils.
// Les mots de passe sont HACHÉS (pbkdf2 + sel), jamais stockés en clair.
//
// Endpoints :
//   GET    /api/users            → liste des comptes (sans mot de passe)
//   POST   /api/users            → crée un compte { pseudo, fullName, email, role, password }
//   DELETE /api/users?id=...      → supprime un compte
//   PATCH  /api/users            → change le rôle { id, role }
//
// La vérification du mot de passe (connexion) est dans /api/login.

import { sql } from '@vercel/postgres';
import { pbkdf2Sync, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

// Vérification du jeton (HMAC) EN LOCAL — pas d'import externe.
const AUTH_SECRET = process.env.AUTH_SECRET || 'anizia-silverlit-server-secret-v1-2026';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasAuth(req: any): boolean {
  const h = req?.headers?.authorization ?? req?.headers?.Authorization ?? '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const token = m[1];
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const data = token.slice(0, dot);
  const expected = createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const body = JSON.parse(Buffer.from(data, 'base64url').toString());
    return typeof body.exp === 'number' && body.exp >= Date.now();
  } catch {
    return false;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    pseudo TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'analyste',
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUser(r: any) {
  return {
    id: r.id, pseudo: r.pseudo, fullName: r.full_name, email: r.email,
    role: r.role, lastLogin: null, createdAt: r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  try {
    await ensureTable();

    // Lecture ouverte ; créer/modifier/supprimer un compte exige un jeton valide.
    const isWrite = req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE';
    if (isWrite && !hasAuth(req)) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    if (req.method === 'GET') {
      const { rows } = await sql`SELECT id, pseudo, full_name, email, role, created_at
                                 FROM app_users ORDER BY created_at ASC`;
      return res.status(200).json(rows.map(toUser));
    }

    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const pseudo = String(b?.pseudo ?? '').trim().toLowerCase();
      const password = String(b?.password ?? '');
      const fullName = String(b?.fullName ?? '').trim();
      const email = String(b?.email ?? '').trim().toLowerCase();
      const role = String(b?.role ?? 'analyste');
      if (!pseudo || !password || !fullName) {
        return res.status(400).json({ error: 'pseudo, nom et mot de passe requis' });
      }
      // unicité du pseudo
      const exists = await sql`SELECT 1 FROM app_users WHERE pseudo = ${pseudo}`;
      if (exists.rowCount && exists.rowCount > 0) {
        return res.status(409).json({ error: 'Ce pseudo existe déjà' });
      }
      const id = `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const password_hash = hashPassword(password);
      await sql`INSERT INTO app_users (id, pseudo, full_name, email, role, password_hash)
                VALUES (${id}, ${pseudo}, ${fullName}, ${email}, ${role}, ${password_hash})`;
      return res.status(200).json({
        id, pseudo, fullName, email, role, lastLogin: null,
        createdAt: new Date().toISOString(),
      });
    }

    if (req.method === 'PATCH') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!b?.id || !b?.role) return res.status(400).json({ error: 'id et role requis' });
      await sql`UPDATE app_users SET role = ${String(b.role)} WHERE id = ${String(b.id)}`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id requis' });
      await sql`DELETE FROM app_users WHERE id = ${String(id)}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'méthode non supportée' });
  } catch (e) {
    return res.status(500).json({ error: String((e as Error)?.message ?? e) });
  }
}
