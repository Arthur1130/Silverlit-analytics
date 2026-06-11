// Ventes réelles de la plateforme.
//
// Plus de données synthétiques : la source est `SEED_VENTES` (données réelles
// importées et figées) + le store `IMPORTED_VENTES` (fichiers déposés en live
// via l'espace d'import). Le CA est toujours valorisé par la grille de prix
// (PVC), jamais par les montants des fichiers sources.
//
// État actuel du périmètre : King Jouet, semaine 1 (test de référence).
// Le calendrier `WEEKS` est dérivé des semaines réellement présentes dans les
// données — il s'étoffe au fur et à mesure des imports.

import type { Vente } from '../types';
import { getAllVentes } from './importBatches';

// Ventes = agrégat de tous les lots d'import actifs (seedés avec King Jouet S1
// + JouéClub S1). Supprimer/ajouter un lot via la page Import recalcule tout.
export const VENTES: Vente[] = getAllVentes();

// Calendrier dérivé des données réelles (semaines effectivement présentes),
// trié chronologiquement.
function buildWeeks(): Array<{ annee: number; semaine: number }> {
  const seen = new Set<string>();
  const out: Array<{ annee: number; semaine: number }> = [];
  for (const v of VENTES) {
    const k = `${v.annee}-${v.semaine}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ annee: v.annee, semaine: v.semaine });
    }
  }
  out.sort((a, b) => (a.annee !== b.annee ? a.annee - b.annee : a.semaine - b.semaine));
  // Filet de sécurité : au moins une semaine pour éviter les vues vides
  return out.length > 0 ? out : [{ annee: 2026, semaine: 1 }];
}

export const WEEKS = buildWeeks();

// Dernière semaine disponible = la plus récente présente dans les données.
export const CURRENT_WEEK = WEEKS[WEEKS.length - 1];
