import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { toPublicUser, ROLES, type DbUser, type Role } from '../types.js';

export const usersRouter = Router();

// Toutes les routes utilisateurs sont réservées aux administrateurs
usersRouter.use(requireAuth, requireAdmin);

// GET /api/users — liste des utilisateurs actifs
usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query<DbUser>(
      'SELECT * FROM users ORDER BY (role = \'admin\') DESC, full_name ASC',
    );
    res.json({ users: rows.map(toPublicUser) });
  }),
);

const roleSchema = z.object({ role: z.enum(ROLES as [Role, ...Role[]]) });

// PATCH /api/users/:id — modifier le rôle d'un utilisateur
usersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Rôle invalide');
    const { role } = parsed.data;

    // Garde-fou : ne pas retirer le dernier administrateur
    if (role !== 'admin') {
      const { rows: target } = await query<DbUser>('SELECT role FROM users WHERE id = $1', [
        req.params.id,
      ]);
      if (target[0]?.role === 'admin') {
        const { rows: admins } = await query<{ count: string }>(
          "SELECT count(*)::int AS count FROM users WHERE role = 'admin'",
        );
        if (Number(admins[0].count) <= 1) {
          throw new HttpError(409, 'Au moins un administrateur doit rester actif');
        }
      }
    }

    const { rows } = await query<DbUser>(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
      [role, req.params.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'Utilisateur introuvable');
    res.json({ user: toPublicUser(rows[0]) });
  }),
);

// DELETE /api/users/:id — supprimer un utilisateur
usersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.auth!.sub) {
      throw new HttpError(409, 'Vous ne pouvez pas supprimer votre propre compte');
    }
    const { rows: target } = await query<DbUser>('SELECT role FROM users WHERE id = $1', [
      req.params.id,
    ]);
    if (target.length === 0) throw new HttpError(404, 'Utilisateur introuvable');

    if (target[0].role === 'admin') {
      const { rows: admins } = await query<{ count: string }>(
        "SELECT count(*)::int AS count FROM users WHERE role = 'admin'",
      );
      if (Number(admins[0].count) <= 1) {
        throw new HttpError(409, 'Au moins un administrateur doit rester actif');
      }
    }

    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }),
);
