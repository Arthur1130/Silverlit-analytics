-- Schéma Postgres — Silverlit Analytics back-end
-- Auth, utilisateurs, invitations, demandes d'accès.
-- Idempotent : peut être ré-exécuté sans casse.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Rôles applicatifs
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'analyste', 'distributeur', 'invite');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('envoyee', 'acceptee', 'expiree', 'annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE demande_status AS ENUM ('en_attente', 'acceptee', 'refusee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudo        TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'analyste',
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invitations envoyées par un administrateur
CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'analyste',
  token       TEXT UNIQUE NOT NULL,
  status      invitation_status NOT NULL DEFAULT 'envoyee',
  invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_email  ON invitations (lower(email));
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations (status);

-- Demandes d'accès soumises depuis la page de connexion
CREATE TABLE IF NOT EXISTS demandes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  email      TEXT NOT NULL,
  entreprise TEXT,
  motif      TEXT,
  status     demande_status NOT NULL DEFAULT 'en_attente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
