import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import type { Alerte, Devise, Gamme } from '../types';
import { ALERTES_INIT } from '../data/alerts';

export type Period =
  | 'S-1'
  | '4S'
  | '13S'
  | '52S'
  | '24M';

export interface AppFilters {
  period: Period;
  distributeurId: string | 'all';
  gamme: Gamme | 'all';
}

interface AppContextValue {
  devise: Devise;
  setDevise: (d: Devise) => void;
  filters: AppFilters;
  setFilters: (f: AppFilters) => void;
  dark: boolean;
  toggleDark: () => void;
  // Source de vérité unique : chaque alerte est SOIT « ouverte » SOIT « traitee ».
  // L'onglet « En cours » = ouvertes, l'onglet « Historique » = traitees.
  // Une alerte n'est jamais dans les deux.
  alertes: Alerte[];
  markAlerteTraitee: (id: string) => void;       // masquer (→ historique)
  markAllAlertesTraitees: (ids: string[]) => void;
  reopenAlerte: (id: string) => void;            // démasquer (→ en cours)
}

const Ctx = createContext<AppContextValue | null>(null);

const STORAGE_KEY = 'silverlit-analytics-prefs';
// On ne persiste QUE les identifiants des alertes traitées (liste de chaînes).
// Stockage minimal et borné par nature : le contenu des alertes vit dans le
// code, jamais dupliqué en localStorage.
const ALERTES_STATUT_KEY = 'silverlit-analytics-alertes-traitees';

interface StoredPrefs {
  devise?: Devise;
  filters?: AppFilters;
  dark?: boolean;
}

function loadPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadTreatedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ALERTES_STATUT_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

// Reconstruit l'état des alertes à partir du seed + des IDs traités persistés.
// Si ALERTES_INIT évolue (nouvelles alertes côté code), elles apparaissent
// naturellement en « ouverte ».
function initAlertes(): Alerte[] {
  const treated = loadTreatedIds();
  return ALERTES_INIT.map((a) =>
    treated.has(a.id) ? { ...a, statut: 'traitee' as const } : { ...a, statut: 'ouverte' as const },
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadPrefs, []);
  const [devise, setDevise] = useState<Devise>(initial.devise ?? 'EUR');
  const [filters, setFilters] = useState<AppFilters>(
    initial.filters ?? { period: '13S', distributeurId: 'all', gamme: 'all' },
  );
  const [dark, setDark] = useState<boolean>(initial.dark ?? false);
  const [alertes, setAlertes] = useState<Alerte[]>(initAlertes);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ devise, filters, dark }));
    } catch {
      /* no-op */
    }
  }, [devise, filters, dark]);

  // Persistance compacte : uniquement les IDs des alertes traitées.
  useEffect(() => {
    try {
      const treatedIds = alertes.filter((a) => a.statut === 'traitee').map((a) => a.id);
      localStorage.setItem(ALERTES_STATUT_KEY, JSON.stringify(treatedIds));
    } catch {
      /* no-op */
    }
  }, [alertes]);

  const value: AppContextValue = {
    devise,
    setDevise,
    filters,
    setFilters,
    dark,
    toggleDark: () => setDark((v) => !v),
    alertes,
    markAlerteTraitee: (id) =>
      setAlertes((cur) =>
        cur.map((a) => (a.id === id ? { ...a, statut: 'traitee' } : a)),
      ),
    markAllAlertesTraitees: (ids) => {
      const idSet = new Set(ids);
      setAlertes((cur) =>
        cur.map((a) =>
          idSet.has(a.id) && a.statut === 'ouverte' ? { ...a, statut: 'traitee' } : a,
        ),
      );
    },
    reopenAlerte: (id) =>
      setAlertes((cur) =>
        cur.map((a) => (a.id === id ? { ...a, statut: 'ouverte' } : a)),
      ),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp doit être utilisé dans AppProvider');
  return v;
}
