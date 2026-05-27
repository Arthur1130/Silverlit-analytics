// Store des ventes RÉELLEMENT importées par l'utilisateur via la page Import.
//
// Différence avec `VENTES` (sales.ts) :
//   - VENTES : données synthétiques générées au boot pour faire vivre l'app
//     en démo (dashboards, graphiques, recherche, etc.)
//   - IMPORTED_VENTES : uniquement les enregistrements issus d'un vrai fichier
//     déposé par un utilisateur. Source unique de vérité pour les exports
//     Excel destinés à la direction.
//
// Décision produit (Philippe, mai 2026) :
//   « L'app reste vivante pour la démo, mais l'export Excel doit être honnête :
//     du "—" partout tant qu'aucun import réel n'a eu lieu pour ce distributeur. »
//
// Persistance : localStorage du navigateur (clé `silverlit.imported.sales`).
// Quand l'app passera en mode API/Postgres, ce module sera remplacé par
// `apiBackend.fetchImportedSales(distId)` sans changer l'interface publique.

import type { Vente } from '../types';

const STORAGE_KEY = 'silverlit.imported.sales';

// Lecture initiale au boot du module
function loadFromStorage(): Vente[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Vente[];
  } catch {
    return [];
  }
}

// État en mémoire (synchronisé avec localStorage)
let cache: Vente[] = loadFromStorage();

function persist() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage plein ou désactivé — on garde au moins le cache mémoire
  }
}

/** Toutes les ventes réellement importées (lecture seule). */
export function getImportedVentes(): readonly Vente[] {
  return cache;
}

/** Ventes importées pour un distributeur donné. */
export function getImportedVentesByDistrib(distId: string): Vente[] {
  return cache.filter((v) => v.distributeurId === distId);
}

/** Indique si au moins une vente a été importée pour ce distributeur. */
export function hasImportedDataFor(distId: string): boolean {
  return cache.some((v) => v.distributeurId === distId);
}

/** Indique si l'app a reçu au moins un import (tous distributeurs confondus). */
export function hasAnyImportedData(): boolean {
  return cache.length > 0;
}

/**
 * Ajoute un lot de ventes importées. Pas de déduplication ici :
 * la validation à l'import (cf. importValidation.ts à venir) doit déjà
 * avoir détecté et arbitré les doublons.
 */
export function appendImportedVentes(rows: Vente[]): void {
  if (rows.length === 0) return;
  cache = [...cache, ...rows];
  persist();
}

/**
 * Remplace toutes les ventes importées pour un distributeur donné
 * (utile quand un utilisateur re-importe un fichier corrigé).
 */
export function replaceImportedVentesForDistrib(distId: string, rows: Vente[]): void {
  cache = cache.filter((v) => v.distributeurId !== distId).concat(rows);
  persist();
}

/** Vide complètement le store (zone admin / debug). */
export function clearImportedVentes(): void {
  cache = [];
  persist();
}
