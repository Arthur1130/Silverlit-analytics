// Fonction serverless Vercel — stockage EN LIGNE des lots d'import.
//
// Les lots de ventes importés sont persistés dans une base Postgres (Vercel
// Postgres / Neon). Tous les appareils et utilisateurs lisent/écrivent la
// même base → données partagées partout.
//
// Sécurité : la connexion à la base utilise la variable d'environnement
// POSTGRES_URL (fournie automatiquement par Vercel quand on connecte une base).
// Aucun identifiant n'est exposé côté navigateur.
//
// Endpoints :
//   GET    /api/batches        → liste tous les lots
//   POST   /api/batches        → crée/écrase un lot (corps = lot JSON)
//   DELETE /api/batches?id=...  → supprime un lot
//
// Repli : si aucune base n'est connectée, les appels échouent (500) et le
// front bascule automatiquement sur le stockage local — le site continue.

import { sql } from '@vercel/postgres';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Vérification du jeton (HMAC) EN LOCAL — pas d'import externe, pour que la
// fonction serverless se charge toujours.
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

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  try {
    await ensureTable();

    // Lecture ouverte (hydratation au démarrage) ; écritures protégées par jeton.
    const isWrite = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE';
    if (isWrite && !hasAuth(req)) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    if (req.method === 'GET') {
      const { rows } = await sql`SELECT data FROM import_batches ORDER BY updated_at ASC`;
      return res.status(200).json(rows.map((r: { data: unknown }) => r.data));
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const batch = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!batch || !batch.id) return res.status(400).json({ error: 'id manquant' });
      const json = JSON.stringify(batch);
      await sql`INSERT INTO import_batches (id, data, updated_at)
                VALUES (${batch.id}, ${json}::jsonb, now())
                ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'id manquant' });
      await sql`DELETE FROM import_batches WHERE id = ${String(id)}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'méthode non supportée' });
  } catch (e) {
    return res.status(500).json({ error: String((e as Error)?.message ?? e) });
  }
}
