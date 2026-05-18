// Configuration des filtres globaux applicables par page.
// Permet de masquer les filtres qui n'ont pas de sens dans le contexte de la
// page courante (par ex. inutile d'avoir un filtre "distributeur" sur la page
// d'un distributeur précis, ou un filtre "période" sur la page Import).

export interface PageFilterConfig {
  period: boolean;
  distributeur: boolean;
  gamme: boolean;
  devise: boolean;
}

const ALL: PageFilterConfig = { period: true, distributeur: true, gamme: true, devise: true };
const NONE: PageFilterConfig = { period: false, distributeur: false, gamme: false, devise: false };

export function filtersForPath(pathname: string): PageFilterConfig {
  // Pages sans filtres globaux : paramètres internes ou statiques
  if (pathname === '/import') return NONE;
  if (pathname === '/gouvernance') return NONE;
  if (pathname === '/profil') return NONE;
  if (pathname === '/infographie') return NONE; // page autonome avec ses propres contrôles

  // Page d'un produit précis : pas de filtre gamme (1 seul produit) ni de
  // filtre distributeur (vue produit cross-canal). Période + devise utiles.
  if (pathname.startsWith('/produits/')) {
    return { period: true, distributeur: false, gamme: false, devise: true };
  }

  // Page d'un distributeur précis : pas de filtre distributeur (on est dessus).
  // Période + gamme + devise utiles.
  if (pathname.startsWith('/distributeurs/')) {
    return { period: true, distributeur: false, gamme: true, devise: true };
  }

  // Liste des distributeurs : pas de filtre distributeur (la page est la liste)
  if (pathname === '/distributeurs') {
    return { period: true, distributeur: false, gamme: true, devise: true };
  }

  // Alertes : pas de période (les alertes ont leurs propres timestamps) ni de
  // devise (elles ne portent pas de montants). Distributeur + gamme utiles.
  if (pathname === '/alertes') {
    return { period: false, distributeur: true, gamme: true, devise: false };
  }

  // Pilotage et liste produits : tous les filtres applicables
  if (pathname === '/pilotage' || pathname === '/produits') return ALL;

  return NONE;
}

export function hasAnyFilter(cfg: PageFilterConfig): boolean {
  return cfg.period || cfg.distributeur || cfg.gamme || cfg.devise;
}
