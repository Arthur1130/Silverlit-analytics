// Fonction serverless Vercel — vérification de connexion (comptes en base).
//
// POST /api/login  { pseudo, password }
//   → 200 + utilisateur si les identifiants sont valides
//   → 401 sinon
//
// Les comptes « de référence » (arthur1130, etc.) restent gérés côté front
// comme filet de sécurité ; cette route vérifie les comptes créés en base.

import { sql } from '@vercel/postgres';
import { pbkdf2Sync, timingSafeEqual, createHmac } from 'node:crypto';

// Jeton signé (HMAC) — défini EN LOCAL (pas d'import externe) pour garantir que
// la fonction serverless se charge sans dépendance qui pourrait manquer au build.
const AUTH_SECRET = process.env.AUTH_SECRET || 'anizia-silverlit-server-secret-v1-2026';
function signToken(payload: Record<string, unknown>): string {
  const body = { ...payload, exp: Date.now() + 60 * 60 * 24 * 1000 };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// Comptes de RÉFÉRENCE (filet de sécurité) — vérifiés AVANT la base, donc
// fonctionnels même si Postgres est indisponible, et JAMAIS exposés dans le
// bundle navigateur (ce fichier est serveur uniquement). Les mots de passe
// peuvent être surchargés par des variables d'environnement Vercel.
const SEED: Record<string, { password: string; user: Record<string, unknown> }> = {
  arthur1130: {
    password: process.env.SEED_PWD_ARTHUR || 'arthur1234',
    user: { id: 'u-arthur', pseudo: 'arthur1130', fullName: 'Arthur Leroy Sahli', email: 'arthur1130@silverlit.fr', role: 'admin' },
  },
  pls1406: {
    password: process.env.SEED_PWD_PLS || 'Fontaine28',
    user: { id: 'u-philippe', pseudo: 'pls1406', fullName: 'Philippe Leroy Sahli', email: 'philippe.ls@silverlit.fr', role: 'admin' },
  },
  'silverlit.all': {
    password: process.env.SEED_PWD_SILVERLIT || 'transverse.silverlit',
    user: { id: 'u-silverlit', pseudo: 'silverlit.all', fullName: 'Silverlit France', email: 'contact@silverlit.fr', role: 'admin' },
  },
};

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

    // 1) Comptes de référence (filet de sécurité), vérifiés AVANT toute requête
    //    base — donc fonctionnels même si Postgres est indisponible.
    const seed = SEED[pseudo];
    if (seed) {
      if (seed.password !== password) return res.status(401).json({ error: 'Identifiants invalides' });
      // Le jeton ne doit JAMAIS bloquer la connexion d'un compte de référence :
      // en cas d'imprévu, on connecte sans jeton (lecture OK, écritures à retenter).
      let token: string | undefined;
      try { token = signToken({ sub: seed.user.id, role: seed.user.role }); } catch { /* connexion sans jeton */ }
      return res.status(200).json({ ...seed.user, lastLogin: new Date().toISOString(), token });
    }

    // 2) Comptes créés en base.
    const { rows } = await sql`SELECT id, pseudo, full_name, email, role, password_hash
                               FROM app_users WHERE pseudo = ${pseudo}`;
    if (rows.length === 0) return res.status(401).json({ error: 'Identifiants invalides' });
    const u = rows[0];
    if (!verifyPassword(password, u.password_hash)) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    const token = signToken({ sub: u.id, role: u.role });
    return res.status(200).json({
      id: u.id, pseudo: u.pseudo, fullName: u.full_name, email: u.email,
      role: u.role, lastLogin: new Date().toISOString(), createdAt: u.created_at, token,
    });
  } catch (e) {
    // Si la base n'est pas joignable, on renvoie 401 (le front gère le filet de secours).
    // On NE renvoie PAS le détail de l'exception au navigateur (fuite d'infos internes) :
    // on le journalise uniquement côté serveur.
    console.error('[login] erreur serveur :', e);
    return res.status(401).json({ error: 'Identifiants invalides' });
  }
}
