import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, requireAdmin, signToken } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { generateInvitationToken } from '../services/tokens.js';
import { sendInvitationEmail } from '../services/email.js';
import { config } from '../config.js';
import {
  toPublicInvitation, toPublicUser, ROLES,
  type DbInvitation, type DbUser, type Role,
} from '../types.js';

export const invitationsRouter = Router();

// --- Routes publiques (acceptation d'invitation) -----------------------

// GET /api/invitations/verify?token=... — vérifie un lien d'invitation
invitationsRouter.get(
  '/verify',
  asyncHandler(async (req, res) => {
    const token = String(req.query.token ?? '');
    if (!token) throw new HttpError(400, 'Jeton manquant');

    const { rows } = await query<DbInvitation>(
      'SELECT * FROM invitations WHERE token = $1',
      [token],
    );
    const inv = rows[0];
    if (!inv) throw new HttpError(404, 'Invitation introuvable');
    if (inv.status === 'acceptee') throw new HttpError(409, 'Cette invitation a déjà été utilisée');
    if (inv.status === 'annulee') throw new HttpError(409, 'Cette invitation a été annulée');
    if (new Date(inv.expires_at) < new Date()) {
      await query("UPDATE invitations SET status = 'expiree' WHERE id = $1", [inv.id]);
      throw new HttpError(409, 'Cette invitation a expiré');
    }
    res.json({ email: inv.email, role: inv.role });
  }),
);

const acceptSchema = z.object({
  token: z.string().min(10),
  pseudo: z.string().min(3).max(120).regex(/^[a-zA-Z0-9._-]+$/, 'Identifiant invalide'),
  fullName: z.string().min(2).max(160),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(200),
});

// POST /api/invitations/accept — crée le compte depuis une invitation
invitationsRouter.post(
  '/accept',
  asyncHandler(async (req, res) => {
    const parsed = acceptSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Données invalides');
    }
    const { token, pseudo, fullName, password } = parsed.data;

    const { rows } = await query<DbInvitation>(
      'SELECT * FROM invitations WHERE token = $1',
      [token],
    );
    const inv = rows[0];
    if (!inv) throw new HttpError(404, 'Invitation introuvable');
    if (inv.status !== 'envoyee') throw new HttpError(409, 'Invitation non valide');
    if (new Date(inv.expires_at) < new Date()) {
      await query("UPDATE invitations SET status = 'expiree' WHERE id = $1", [inv.id]);
      throw new HttpError(409, 'Cette invitation a expiré');
    }

    // Unicité pseudo / email
    const { rows: dup } = await query(
      'SELECT 1 FROM users WHERE lower(pseudo) = lower($1) OR lower(email) = lower($2)',
      [pseudo, inv.email],
    );
    if (dup.length > 0) {
      throw new HttpError(409, 'Cet identifiant ou cet email est déjà utilisé');
    }

    const initials = fullName
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const hash = await bcrypt.hash(password, 10);
    const { rows: created } = await query<DbUser>(
      `INSERT INTO users (pseudo, full_name, email, password_hash, role, last_login)
       VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
      [pseudo, fullName, inv.email, hash, inv.role],
    );
    await query(
      "UPDATE invitations SET status = 'acceptee', accepted_at = now() WHERE id = $1",
      [inv.id],
    );

    const user = created[0];
    void initials; // les initiales sont recalculées côté front
    const jwtToken = signToken({ sub: user.id, pseudo: user.pseudo, role: user.role });
    res.status(201).json({ token: jwtToken, user: toPublicUser(user) });
  }),
);

// --- Routes administrateur --------------------------------------------

invitationsRouter.use(requireAuth, requireAdmin);

// GET /api/invitations — liste des invitations
invitationsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query<DbInvitation>(
      'SELECT * FROM invitations ORDER BY created_at DESC LIMIT 200',
    );
    res.json({ invitations: rows.map(toPublicInvitation) });
  }),
);

const inviteSchema = z.object({
  email: z.string().email('Adresse email invalide').max(200),
  role: z.enum(ROLES as [Role, ...Role[]]),
});

// POST /api/invitations — crée + envoie une invitation
invitationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Données invalides');
    }
    const email = parsed.data.email.toLowerCase();
    const { role } = parsed.data;

    const { rows: existingUser } = await query(
      'SELECT 1 FROM users WHERE lower(email) = $1',
      [email],
    );
    if (existingUser.length > 0) throw new HttpError(409, 'Cet utilisateur a déjà un compte');

    const { rows: pending } = await query(
      "SELECT 1 FROM invitations WHERE lower(email) = $1 AND status = 'envoyee'",
      [email],
    );
    if (pending.length > 0) {
      throw new HttpError(409, 'Une invitation est déjà en attente pour cet email');
    }

    const token = generateInvitationToken();
    const expiresAt = new Date(Date.now() + config.invitationTtlHours * 3600 * 1000);
    const { rows } = await query<DbInvitation>(
      `INSERT INTO invitations (email, role, token, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [email, role, token, req.auth!.sub, expiresAt.toISOString()],
    );
    const inv = rows[0];

    // Nom de l'invitant pour personnaliser l'email
    const { rows: inviter } = await query<DbUser>('SELECT * FROM users WHERE id = $1', [
      req.auth!.sub,
    ]);
    const sendResult = await sendInvitationEmail({
      to: email,
      role,
      token,
      invitedByName: inviter[0]?.full_name ?? 'Un administrateur',
      expiresAt,
    });

    res.status(201).json({
      invitation: toPublicInvitation(inv),
      emailSent: sendResult.sent,
      // En l'absence de Resend configuré, on renvoie le lien pour la démo
      link: sendResult.sent ? undefined : sendResult.link,
    });
  }),
);

// POST /api/invitations/:id/resend — renvoie l'email d'une invitation
invitationsRouter.post(
  '/:id/resend',
  asyncHandler(async (req, res) => {
    const { rows } = await query<DbInvitation>('SELECT * FROM invitations WHERE id = $1', [
      req.params.id,
    ]);
    const inv = rows[0];
    if (!inv) throw new HttpError(404, 'Invitation introuvable');
    if (inv.status === 'acceptee') throw new HttpError(409, 'Invitation déjà acceptée');

    // Prolonge la validité et réactive si besoin
    const expiresAt = new Date(Date.now() + config.invitationTtlHours * 3600 * 1000);
    const { rows: updated } = await query<DbInvitation>(
      `UPDATE invitations SET status = 'envoyee', expires_at = $1, created_at = now()
       WHERE id = $2 RETURNING *`,
      [expiresAt.toISOString(), inv.id],
    );
    const { rows: inviter } = await query<DbUser>('SELECT * FROM users WHERE id = $1', [
      req.auth!.sub,
    ]);
    const sendResult = await sendInvitationEmail({
      to: inv.email,
      role: inv.role,
      token: inv.token,
      invitedByName: inviter[0]?.full_name ?? 'Un administrateur',
      expiresAt,
    });
    res.json({
      invitation: toPublicInvitation(updated[0]),
      emailSent: sendResult.sent,
      link: sendResult.sent ? undefined : sendResult.link,
    });
  }),
);

// POST /api/invitations/:id/cancel — annule une invitation
invitationsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const { rows } = await query<DbInvitation>(
      "UPDATE invitations SET status = 'annulee' WHERE id = $1 AND status = 'envoyee' RETURNING *",
      [req.params.id],
    );
    if (rows.length === 0) {
      throw new HttpError(404, 'Invitation introuvable ou déjà traitée');
    }
    res.json({ invitation: toPublicInvitation(rows[0]) });
  }),
);
