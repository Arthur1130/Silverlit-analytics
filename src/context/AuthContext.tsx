import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  detectBackend, errMessage,
  type AuthBackend, type BackendMode,
  type User, type Invitation, type DemandeCompte, type Role,
} from '../api/backend';

// Ré-exports : les composants importent ces types depuis le contexte
export type { User, Invitation, DemandeCompte, Role, BackendMode };

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur',
  analyste: 'Analyste ventes',
  distributeur: 'Référent distributeur',
  invite: 'Invité · lecture seule',
};

export function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface Result {
  ok: boolean;
  error?: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  // 'api' = serveur Express branché · 'local' = mode autonome (localStorage)
  backendMode: BackendMode | null;

  signIn: (pseudo: string, password: string) => Promise<Result>;
  signOut: () => void;
  submitDemande: (d: { nom: string; email: string; entreprise: string; motif: string }) => Promise<Result>;
  acceptInvitation: (
    token: string, pseudo: string, fullName: string, password: string,
  ) => Promise<Result>;

  users: User[];
  invitations: Invitation[];
  demandes: DemandeCompte[];
  teamLoaded: boolean;
  refreshTeam: () => Promise<void>;

  inviteUser: (email: string, role: Role) => Promise<Result & { link?: string; emailSent?: boolean }>;
  cancelInvitation: (id: string) => Promise<void>;
  resendInvitation: (id: string) => Promise<Result & { link?: string; emailSent?: boolean }>;
  updateUserRole: (id: string, role: Role) => Promise<Result>;
  removeUser: (id: string) => Promise<Result>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<AuthBackend | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [demandes, setDemandes] = useState<DemandeCompte[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);

  // Au démarrage : détecte le backend dispo (API ou local) puis restaure la session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = await detectBackend();
      if (cancelled) return;
      setBackend(b);
      try {
        const restored = await b.restore();
        if (!cancelled) setUser(restored);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (pseudo: string, password: string): Promise<Result> => {
    if (!backend) return { ok: false, error: 'Initialisation en cours…' };
    try {
      const u = await backend.signIn(pseudo, password);
      setUser(u);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMessage(e) };
    }
  }, [backend]);

  const signOut = useCallback(() => {
    backend?.signOut();
    setUser(null);
    setUsers([]);
    setInvitations([]);
    setDemandes([]);
    setTeamLoaded(false);
  }, [backend]);

  const submitDemande = useCallback(async (d: {
    nom: string; email: string; entreprise: string; motif: string;
  }): Promise<Result> => {
    if (!backend) return { ok: false, error: 'Initialisation en cours…' };
    try {
      await backend.submitDemande(d);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMessage(e) };
    }
  }, [backend]);

  const acceptInvitation = useCallback(async (
    token: string, pseudo: string, fullName: string, password: string,
  ): Promise<Result> => {
    if (!backend) return { ok: false, error: 'Initialisation en cours…' };
    try {
      const u = await backend.acceptInvitation(token, pseudo, fullName, password);
      setUser(u);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMessage(e) };
    }
  }, [backend]);

  const refreshTeam = useCallback(async () => {
    if (!backend) return;
    try {
      const [u, i, d] = await Promise.all([
        backend.listUsers(),
        backend.listInvitations(),
        backend.listDemandes(),
      ]);
      setUsers(u);
      setInvitations(i);
      setDemandes(d);
    } catch {
      /* on laisse les données précédentes */
    } finally {
      setTeamLoaded(true);
    }
  }, [backend]);

  const inviteUser = useCallback(async (email: string, role: Role) => {
    if (!backend) return { ok: false, error: 'Initialisation en cours…' };
    try {
      const res = await backend.inviteUser(email, role);
      setInvitations((cur) => [res.invitation, ...cur]);
      return { ok: true, link: res.link, emailSent: res.emailSent };
    } catch (e) {
      return { ok: false, error: errMessage(e) };
    }
  }, [backend]);

  const cancelInvitation = useCallback(async (id: string) => {
    if (!backend) return;
    try {
      const invitation = await backend.cancelInvitation(id);
      setInvitations((cur) => cur.map((x) => (x.id === id ? invitation : x)));
    } catch {
      /* silencieux */
    }
  }, [backend]);

  const resendInvitation = useCallback(async (id: string) => {
    if (!backend) return { ok: false, error: 'Initialisation en cours…' };
    try {
      const res = await backend.resendInvitation(id);
      setInvitations((cur) => cur.map((x) => (x.id === id ? res.invitation : x)));
      return { ok: true, link: res.link, emailSent: res.emailSent };
    } catch (e) {
      return { ok: false, error: errMessage(e) };
    }
  }, [backend]);

  const updateUserRole = useCallback(async (id: string, role: Role): Promise<Result> => {
    if (!backend) return { ok: false, error: 'Initialisation en cours…' };
    try {
      const updated = await backend.updateUserRole(id, role);
      setUsers((cur) => cur.map((u) => (u.id === id ? updated : u)));
      setUser((cur) => (cur && cur.id === id ? updated : cur));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMessage(e) };
    }
  }, [backend]);

  const removeUser = useCallback(async (id: string): Promise<Result> => {
    if (!backend) return { ok: false, error: 'Initialisation en cours…' };
    try {
      await backend.removeUser(id);
      setUsers((cur) => cur.filter((u) => u.id !== id));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMessage(e) };
    }
  }, [backend]);

  const value: AuthCtx = {
    user,
    loading,
    isAdmin: user?.role === 'admin',
    backendMode: backend?.mode ?? null,
    signIn,
    signOut,
    submitDemande,
    acceptInvitation,
    users,
    invitations,
    demandes,
    teamLoaded,
    refreshTeam,
    inviteUser,
    cancelInvitation,
    resendInvitation,
    updateUserRole,
    removeUser,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return v;
}
