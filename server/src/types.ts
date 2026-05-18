export type Role = 'admin' | 'analyste' | 'distributeur' | 'invite';
export const ROLES: Role[] = ['admin', 'analyste', 'distributeur', 'invite'];

export interface DbUser {
  id: string;
  pseudo: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: Role;
  last_login: string | null;
  created_at: string;
}

// Vue publique d'un utilisateur — jamais le hash de mot de passe
export interface PublicUser {
  id: string;
  pseudo: string;
  fullName: string;
  email: string;
  role: Role;
  lastLogin: string | null;
  createdAt: string;
}

export function toPublicUser(u: DbUser): PublicUser {
  return {
    id: u.id,
    pseudo: u.pseudo,
    fullName: u.full_name,
    email: u.email,
    role: u.role,
    lastLogin: u.last_login,
    createdAt: u.created_at,
  };
}

export interface DbInvitation {
  id: string;
  email: string;
  role: Role;
  token: string;
  status: 'envoyee' | 'acceptee' | 'expiree' | 'annulee';
  invited_by: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export interface PublicInvitation {
  id: string;
  email: string;
  role: Role;
  status: DbInvitation['status'];
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export function toPublicInvitation(i: DbInvitation): PublicInvitation {
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    status: i.status,
    invitedBy: i.invited_by,
    createdAt: i.created_at,
    expiresAt: i.expires_at,
    acceptedAt: i.accepted_at,
  };
}

// Charge utile du JWT
export interface JwtPayload {
  sub: string;   // user id
  pseudo: string;
  role: Role;
}
