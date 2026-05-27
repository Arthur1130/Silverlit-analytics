// Couche d'abstraction d'authentification.
// Deux implémentations interchangeables :
//   - apiBackend   : appelle le serveur Express/Postgres (auth réelle, emails)
//   - localBackend : autonome, sur localStorage (le site fonctionne sans serveur)
// detectBackend() choisit automatiquement selon la disponibilité du serveur.

import { api, ApiError, API_URL, getToken, setToken } from './client';

export type Role = 'admin' | 'analyste' | 'distributeur' | 'invite';

export interface User {
  id: string;
  pseudo: string;
  fullName: string;
  email: string;
  role: Role;
  lastLogin: string | null;
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: 'envoyee' | 'acceptee' | 'expiree' | 'annulee';
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export interface DemandeCompte {
  id: string;
  nom: string;
  email: string;
  entreprise: string;
  motif: string;
  statut: 'en_attente' | 'acceptee' | 'refusee';
  date: string;
}

export interface DemandeInput {
  nom: string;
  email: string;
  entreprise: string;
  motif: string;
}

export interface InviteResult {
  invitation: Invitation;
  emailSent: boolean;
  link?: string;
}

export type BackendMode = 'api' | 'local';

export interface AuthBackend {
  mode: BackendMode;
  restore(): Promise<User | null>;
  signIn(pseudo: string, password: string): Promise<User>;
  signOut(): void;
  submitDemande(d: DemandeInput): Promise<void>;
  listUsers(): Promise<User[]>;
  listInvitations(): Promise<Invitation[]>;
  listDemandes(): Promise<DemandeCompte[]>;
  inviteUser(email: string, role: Role): Promise<InviteResult>;
  cancelInvitation(id: string): Promise<Invitation>;
  resendInvitation(id: string): Promise<InviteResult>;
  updateUserRole(id: string, role: Role): Promise<User>;
  removeUser(id: string): Promise<void>;
  verifyInvitation(token: string): Promise<{ email: string; role: Role }>;
  acceptInvitation(
    token: string, pseudo: string, fullName: string, password: string,
  ): Promise<User>;
}

// =====================================================================
//  Implémentation API — serveur Express + Postgres
// =====================================================================

export const apiBackend: AuthBackend = {
  mode: 'api',
  async restore() {
    if (!getToken()) return null;
    try {
      const { user } = await api<{ user: User }>('/auth/me');
      return user;
    } catch {
      setToken(null);
      return null;
    }
  },
  async signIn(pseudo, password) {
    const { token, user } = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { pseudo, password },
    });
    setToken(token);
    return user;
  },
  signOut() {
    setToken(null);
  },
  async submitDemande(d) {
    await api('/demandes', { method: 'POST', body: d });
  },
  async listUsers() {
    const { users } = await api<{ users: User[] }>('/users');
    return users;
  },
  async listInvitations() {
    const { invitations } = await api<{ invitations: Invitation[] }>('/invitations');
    return invitations;
  },
  async listDemandes() {
    const { demandes } = await api<{ demandes: DemandeCompte[] }>('/demandes');
    return demandes;
  },
  async inviteUser(email, role) {
    return api<InviteResult>('/invitations', { method: 'POST', body: { email, role } });
  },
  async cancelInvitation(id) {
    const { invitation } = await api<{ invitation: Invitation }>(
      `/invitations/${id}/cancel`, { method: 'POST' },
    );
    return invitation;
  },
  async resendInvitation(id) {
    return api<InviteResult>(`/invitations/${id}/resend`, { method: 'POST' });
  },
  async updateUserRole(id, role) {
    const { user } = await api<{ user: User }>(`/users/${id}`, {
      method: 'PATCH', body: { role },
    });
    return user;
  },
  async removeUser(id) {
    await api(`/users/${id}`, { method: 'DELETE' });
  },
  async verifyInvitation(token) {
    return api<{ email: string; role: Role }>(
      `/invitations/verify?token=${encodeURIComponent(token)}`,
    );
  },
  async acceptInvitation(token, pseudo, fullName, password) {
    const { token: jwt, user } = await api<{ token: string; user: User }>(
      '/invitations/accept', { method: 'POST', body: { token, pseudo, fullName, password } },
    );
    setToken(jwt);
    return user;
  },
};

// =====================================================================
//  Implémentation locale — autonome, sur localStorage
// =====================================================================

const LK = {
  user: 'silverlit-local-user',
  users: 'silverlit-local-users',
  invitations: 'silverlit-local-invitations',
  demandes: 'silverlit-local-demandes',
};

interface LocalInvitation extends Invitation {
  token: string;
}

// Compte pré-configuré du mode local — utilisable tel quel sur le site déployé.
// Le mot de passe peut être modifié ici avant déploiement.
const SEED_CREDENTIALS: Record<string, string> = {
  arthur1130: 'arthur1234',
  pls1406: 'Fontaine28',
  'silverlit.all': 'transverse.silverlit',
};

const SEED_USERS: User[] = [
  { id: 'u-arthur', pseudo: 'arthur1130', fullName: 'Arthur Leroy Sahli', email: 'arthur1130@silverlit.fr', role: 'admin', lastLogin: '2026-05-14T08:10:00Z', createdAt: '2026-01-06T09:00:00Z' },
  { id: 'u-philippe', pseudo: 'pls1406', fullName: 'Philippe Leroy Sahli', email: 'philippe.ls@silverlit.fr', role: 'admin', lastLogin: null, createdAt: '2026-05-27T18:30:00Z' },
  { id: 'u-silverlit', pseudo: 'silverlit.all', fullName: 'Silverlit France', email: 'contact@silverlit.fr', role: 'admin', lastLogin: null, createdAt: '2026-05-27T20:30:00Z' },
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* no-op */
  }
}
// Lit la liste d'utilisateurs, en fusionnant le localStorage (utilisateurs
// déjà connus) avec SEED_USERS (le code, source de vérité). Permet d'ajouter
// de nouveaux comptes via le code sans que le cache localStorage des
// utilisateurs ne les masque.
function getUsers(): User[] {
  const stored = load<User[]>(LK.users, []);
  if (stored.length === 0) return SEED_USERS;
  const knownPseudos = new Set(stored.map((u) => u.pseudo));
  const newSeeds = SEED_USERS.filter((u) => !knownPseudos.has(u.pseudo));
  return [...stored, ...newSeeds];
}
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const localBackend: AuthBackend = {
  mode: 'local',
  async restore() {
    return load<User | null>(LK.user, null);
  },
  async signIn(pseudo, password) {
    const key = pseudo.trim().toLowerCase();
    const expected = SEED_CREDENTIALS[key];
    if (!expected || expected !== password) {
      throw new Error('Identifiants invalides');
    }
    const account = getUsers().find((u) => u.pseudo === key);
    if (!account) {
      // Safety net : si le profil est introuvable malgré des credentials
      // valides (cas pathologique : SEED_USERS et SEED_CREDENTIALS désynchronisés),
      // on refuse plutôt que de logguer comme admin par défaut.
      throw new Error('Identifiants invalides');
    }
    const signed = { ...account, lastLogin: new Date().toISOString() };
    save(LK.user, signed);
    save(LK.users, getUsers().map((u) => (u.id === signed.id ? signed : u)));
    return signed;
  },
  signOut() {
    try {
      localStorage.removeItem(LK.user);
    } catch {
      /* no-op */
    }
  },
  async submitDemande(d) {
    if (!EMAIL_RX.test(d.email)) throw new Error('Adresse email invalide');
    const demande: DemandeCompte = {
      id: newId('D'),
      nom: d.nom,
      email: d.email.toLowerCase(),
      entreprise: d.entreprise,
      motif: d.motif,
      statut: 'en_attente',
      date: new Date().toISOString(),
    };
    save(LK.demandes, [demande, ...load<DemandeCompte[]>(LK.demandes, [])].slice(0, 50));
  },
  async listUsers() {
    return getUsers();
  },
  async listInvitations() {
    return load<LocalInvitation[]>(LK.invitations, []);
  },
  async listDemandes() {
    return load<DemandeCompte[]>(LK.demandes, []);
  },
  async inviteUser(email, role) {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RX.test(clean)) throw new Error('Adresse email invalide');
    if (getUsers().some((u) => u.email.toLowerCase() === clean)) {
      throw new Error('Cet utilisateur a déjà un compte');
    }
    const list = load<LocalInvitation[]>(LK.invitations, []);
    if (list.some((i) => i.email.toLowerCase() === clean && i.status === 'envoyee')) {
      throw new Error('Une invitation est déjà en attente pour cet email');
    }
    const me = load<User | null>(LK.user, null);
    const token = newId('tok') + Math.random().toString(36).slice(2);
    const invitation: LocalInvitation = {
      id: newId('INV'),
      email: clean,
      role,
      status: 'envoyee',
      invitedBy: me?.id ?? null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120 * 3600 * 1000).toISOString(),
      acceptedAt: null,
      token,
    };
    save(LK.invitations, [invitation, ...list].slice(0, 80));
    const link = `${window.location.origin}/invitation?token=${token}`;
    return { invitation, emailSent: false, link };
  },
  async cancelInvitation(id) {
    const list = load<LocalInvitation[]>(LK.invitations, []);
    const next = list.map((i) => (i.id === id ? { ...i, status: 'annulee' as const } : i));
    save(LK.invitations, next);
    const found = next.find((i) => i.id === id);
    if (!found) throw new Error('Invitation introuvable');
    return found;
  },
  async resendInvitation(id) {
    const list = load<LocalInvitation[]>(LK.invitations, []);
    const next = list.map((i) =>
      i.id === id
        ? {
            ...i,
            status: 'envoyee' as const,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 120 * 3600 * 1000).toISOString(),
          }
        : i,
    );
    save(LK.invitations, next);
    const found = next.find((i) => i.id === id);
    if (!found) throw new Error('Invitation introuvable');
    const link = `${window.location.origin}/invitation?token=${found.token}`;
    return { invitation: found, emailSent: false, link };
  },
  async updateUserRole(id, role) {
    const users = getUsers();
    const target = users.find((u) => u.id === id);
    if (!target) throw new Error('Utilisateur introuvable');
    if (target.role === 'admin' && role !== 'admin'
        && users.filter((u) => u.role === 'admin').length <= 1) {
      throw new Error('Au moins un administrateur doit rester actif');
    }
    const next = users.map((u) => (u.id === id ? { ...u, role } : u));
    save(LK.users, next);
    const me = load<User | null>(LK.user, null);
    if (me && me.id === id) save(LK.user, { ...me, role });
    return { ...target, role };
  },
  async removeUser(id) {
    const users = getUsers();
    const me = load<User | null>(LK.user, null);
    if (id === me?.id) throw new Error('Vous ne pouvez pas supprimer votre propre compte');
    const target = users.find((u) => u.id === id);
    if (!target) throw new Error('Utilisateur introuvable');
    if (target.role === 'admin' && users.filter((u) => u.role === 'admin').length <= 1) {
      throw new Error('Au moins un administrateur doit rester actif');
    }
    save(LK.users, users.filter((u) => u.id !== id));
  },
  async verifyInvitation(token) {
    const list = load<LocalInvitation[]>(LK.invitations, []);
    const inv = list.find((i) => i.token === token);
    if (!inv) throw new Error('Invitation introuvable');
    if (inv.status === 'acceptee') throw new Error('Cette invitation a déjà été utilisée');
    if (inv.status === 'annulee') throw new Error('Cette invitation a été annulée');
    if (new Date(inv.expiresAt) < new Date()) throw new Error('Cette invitation a expiré');
    return { email: inv.email, role: inv.role };
  },
  async acceptInvitation(token, pseudo, fullName, password) {
    void password; // en mode local, pas de hachage — démo uniquement
    const list = load<LocalInvitation[]>(LK.invitations, []);
    const inv = list.find((i) => i.token === token);
    if (!inv || inv.status !== 'envoyee') throw new Error('Invitation non valide');
    const users = getUsers();
    if (users.some((u) => u.pseudo.toLowerCase() === pseudo.toLowerCase())) {
      throw new Error('Cet identifiant est déjà utilisé');
    }
    const user: User = {
      id: newId('u'),
      pseudo: pseudo.toLowerCase(),
      fullName,
      email: inv.email,
      role: inv.role,
      lastLogin: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    save(LK.users, [...users, user]);
    save(LK.invitations, list.map((i) =>
      i.id === inv.id
        ? { ...i, status: 'acceptee' as const, acceptedAt: new Date().toISOString() }
        : i,
    ));
    save(LK.user, user);
    SEED_CREDENTIALS[user.pseudo] = password; // permet de se reconnecter en session locale
    return user;
  },
};

// =====================================================================
//  Détection du backend disponible
// =====================================================================

let cachedMode: BackendMode | null = null;

export async function detectBackend(): Promise<AuthBackend> {
  if (cachedMode) return cachedMode === 'api' ? apiBackend : localBackend;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${API_URL}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    cachedMode = res.ok ? 'api' : 'local';
  } catch {
    cachedMode = 'local';
  }
  return cachedMode === 'api' ? apiBackend : localBackend;
}

export function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Erreur inattendue';
}
