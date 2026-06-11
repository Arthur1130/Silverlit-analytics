// Fonction serverless Vercel — vérification de connexion (comptes en base).
//
// POST /api/login  { pseudo, password }
//   → 200 + utilisateur si les identifiants sont valides
//   → 401 sinon
//
// Les comptes « de référence » (arthur1130, etc.) restent gérés côté front
// comme filet de sécurité ; cette route vérifie les comptes créés en base.

import { sql } from '@vercel/postgres';
import { pbkdf2Sync, timingSafeEqual } from 'node:crypto';

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const computed = pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  try {
    return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'méthode non supportée' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const pseudo = String(b?.pseudo ?? '').trim().toLowerCase();
    const password = String(b?.password ?? '');
    if (!pseudo || !password) return res.status(400).json({ error: 'identifiants requis' });

    const { rows } = await sql`SELECT id, pseudo, full_name, email, role, password_hash
                               FROM app_users WHERE pseudo = ${pseudo}`;
    if (rows.length === 0) return res.status(401).json({ error: 'Identifiants invalides' });
    const u = rows[0];
    if (!verifyPassword(password, u.password_hash)) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    return res.status(200).json({
      id: u.id, pseudo: u.pseudo, fullName: u.full_name, email: u.email,
      role: u.role, lastLogin: new Date().toISOString(), createdAt: u.created_at,
    });
  } catch (e) {
    // Si la base n'est pas joignable, on renvoie 401 (le front gère le filet de secours).
    // On NE renvoie PAS le détail de l'exception au navigateur (fuite d'infos internes) :
    // on le journalise uniquement côté serveur.
    console.error('[login] erreur serveur :', e);
    return res.status(401).json({ error: 'Identifiants invalides' });
  }
}
