import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/error.js';

export const demandesRouter = Router();

interface DbDemande {
  id: string;
  nom: string;
  email: string;
  entreprise: string | null;
  motif: string | null;
  status: 'en_attente' | 'acceptee' | 'refusee';
  created_at: string;
}

function toPublic(d: DbDemande) {
  return {
    id: d.id,
    nom: d.nom,
    email: d.email,
    entreprise: d.entreprise ?? '',
    motif: d.motif ?? '',
    statut: d.status,
    date: d.created_at,
  };
}

const demandeSchema = z.object({
  nom: z.string().min(2).max(160),
  email: z.string().email('Email invalide').max(200),
  entreprise: z.string().max(200).optional().default(''),
  motif: z.string().max(1000).optional().default(''),
});

// POST /api/demandes — publique : soumission depuis la page de connexion
demandesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = demandeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Données invalides');
    }
    const { nom, email, entreprise, motif } = parsed.data;
    const { rows } = await query<DbDemande>(
      `INSERT INTO demandes (nom, email, entreprise, motif)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nom, email.toLowerCase(), entreprise, motif],
    );
    res.status(201).json({ demande: toPublic(rows[0]) });
  }),
);

// GET /api/demandes — administrateur : liste des demandes
demandesRouter.get(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const { rows } = await query<DbDemande>(
      'SELECT * FROM demandes ORDER BY created_at DESC LIMIT 200',
    );
    res.json({ demandes: rows.map(toPublic) });
  }),
);

const statusSchema = z.object({ statut: z.enum(['en_attente', 'acceptee', 'refusee']) });

// PATCH /api/demandes/:id — administrateur : changer le statut
demandesRouter.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Statut invalide');
    const { rows } = await query<DbDemande>(
      'UPDATE demandes SET status = $1 WHERE id = $2 RETURNING *',
      [parsed.data.statut, req.params.id],
    );
    if (rows.length === 0) throw new HttpError(404, 'Demande introuvable');
    res.json({ demande: toPublic(rows[0]) });
  }),
);
