import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { toPublicUser, type DbUser } from '../types.js';

export const authRouter = Router();

const loginSchema = z.object({
  pseudo: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
});

// POST /api/auth/login — { pseudo, password } → { token, user }
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Identifiant et mot de passe requis');
    const { pseudo, password } = parsed.data;

    const { rows } = await query<DbUser>(
      'SELECT * FROM users WHERE lower(pseudo) = lower($1)',
      [pseudo],
    );
    const user = rows[0];
    if (!user) throw new HttpError(401, 'Identifiants invalides');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new HttpError(401, 'Identifiants invalides');

    await query('UPDATE users SET last_login = now() WHERE id = $1', [user.id]);
    user.last_login = new Date().toISOString();

    const token = signToken({ sub: user.id, pseudo: user.pseudo, role: user.role });
    res.json({ token, user: toPublicUser(user) });
  }),
);

// GET /api/auth/me — (auth) → { user } — restaure la session au chargement du front
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query<DbUser>('SELECT * FROM users WHERE id = $1', [req.auth!.sub]);
    const user = rows[0];
    if (!user) throw new HttpError(401, 'Compte introuvable');
    res.json({ user: toPublicUser(user) });
  }),
);
