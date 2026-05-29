// Store des LOTS d'import — coeur de la plateforme.
//
// Chaque dépôt de fichier = un « lot » traçable et indépendant :
//   - métadonnées : nom de source, distributeur, année, semaine, format, fichier
//   - lignes de ventes valorisées (CA = qté × prix grille)
//   - statistiques de contrôle (qté, CA, nb réfs)
//
// Le dashboard agrège tous les lots ACTIFS. Supprimer un lot recalcule tout
// automatiquement. On peut aussi renommer / re-paramétrer un lot (modifier).
//
// Persistance : localStorage. Seedé au premier lancement avec les données de
// référence (King Jouet S1 + JouéClub S1) afin que le site déployé montre des
// données dès l'ouverture — ces lots seed sont gérables/supprimables comme les
// autres. Une fois le store initialisé, on ne re-seede jamais (les suppressions
// utilisateur sont définitives).

import type { Vente } from '../types';
import { SEED_VENTES } from './realSales';

export interface ImportBatch {
  id: string;
  sourceName: string;      // nom libre donné par l'utilisateur
  distributeurId: string;
  annee: number;
  semaine: number;
  formatId: string;        // identifiant du format de fichier
  fileName: string;        // nom du fichier d'origine
  importedAt: string;      // date ISO du dépôt
  rows: Vente[];           // ventes valorisées (CA = qté × PVC)
  totalQte: number;
  totalCa: number;
  refsCount: number;
}

const STORE_KEY = 'silverlit.import.batches.v1';
const INIT_KEY = 'silverlit.import.batches.initialized.v1';

// ---- Calcul des stats d'un lot ----
export function computeBatchStats(rows: Vente[]): { totalQte: number; totalCa: number; refsCount: number } {
  let totalQte = 0;
  let totalCa = 0;
  const refs = new Set<string>();
  for (const r of rows) {
    totalQte += r.qteVendue;
    totalCa += r.caTTC;
    refs.add(r.ean);
  }
  return { totalQte, totalCa: Math.round(totalCa * 100) / 100, refsCount: refs.size };
}

// ---- Construction des lots seed (King Jouet S1 + JouéClub S1) ----
function buildSeedBatches(): ImportBatch[] {
  const byDist = new Map<string, Vente[]>();
  for (const v of SEED_VENTES) {
    const arr = byDist.get(v.distributeurId) ?? [];
    arr.push(v);
    byDist.set(v.distributeurId, arr);
  }
  const labels: Record<string, string> = {
    kingjouet: 'King Jouet — Semaine 1 (réf.)',
    joueclub: 'JouéClub — Semaine 1 (réf.)',
  };
  const files: Record<string, string> = {
    kingjouet: 'SEMAINE 1 Fournisseur_Ventes_JOL_Stocks.csv',
    joueclub: 'SEMAINE 1 GroupeJoueclub_Stats_hebdo_2026-01.csv',
  };
  const formats: Record<string, string> = {
    kingjouet: 'jol-utf16',
    joueclub: 'joueclub-csv',
  };
  const out: ImportBatch[] = [];
  for (const [dist, rows] of byDist.entries()) {
    const stats = computeBatchStats(rows);
    out.push({
      id: `seed-${dist}-2026-1`,
      sourceName: labels[dist] ?? `${dist} — Semaine 1`,
      distributeurId: dist,
      annee: 2026,
      semaine: 1,
      formatId: formats[dist] ?? 'inconnu',
      fileName: files[dist] ?? '',
      importedAt: '2026-05-28T00:00:00Z',
      rows,
      ...stats,
    });
  }
  return out;
}

// ---- Persistance ----
function readStore(): ImportBatch[] {
  if (typeof window === 'undefined') return buildSeedBatches();
  try {
    const initialized = window.localStorage.getItem(INIT_KEY);
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!initialized) {
      // Premier lancement : on seede
      const seed = buildSeedBatches();
      window.localStorage.setItem(STORE_KEY, JSON.stringify(seed));
      window.localStorage.setItem(INIT_KEY, '1');
      return seed;
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ImportBatch[]) : [];
  } catch {
    return buildSeedBatches();
  }
}

function writeStore(batches: ImportBatch[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(batches));
    window.localStorage.setItem(INIT_KEY, '1');
  } catch {
    /* localStorage plein ou indisponible */
  }
}

// Cache mémoire synchronisé
let cache: ImportBatch[] = readStore();

// ---- API publique ----
export function getBatches(): ImportBatch[] {
  return cache;
}

export function getBatch(id: string): ImportBatch | undefined {
  return cache.find((b) => b.id === id);
}

/** Ajoute un nouveau lot. */
export function addBatch(batch: ImportBatch): void {
  cache = [...cache, batch];
  writeStore(cache);
}

/** Met à jour les métadonnées d'un lot (renommer, re-paramétrer). */
export function updateBatch(id: string, patch: Partial<Omit<ImportBatch, 'id' | 'rows'>>): void {
  cache = cache.map((b) => (b.id === id ? { ...b, ...patch } : b));
  writeStore(cache);
}

/** Supprime un lot (doc par doc, source par source). */
export function deleteBatch(id: string): void {
  cache = cache.filter((b) => b.id !== id);
  writeStore(cache);
}

/** Remet le store à l'état de référence (seed). Zone admin. */
export function resetBatches(): void {
  cache = buildSeedBatches();
  writeStore(cache);
}

// ---- Vues agrégées (consommées par le dashboard) ----
export function getAllVentes(): Vente[] {
  return cache.flatMap((b) => b.rows);
}

// Back-compat : noms utilisés ailleurs dans l'app
export function getImportedVentes(): readonly Vente[] {
  return getAllVentes();
}
export function getImportedVentesByDistrib(distId: string): Vente[] {
  return getAllVentes().filter((v) => v.distributeurId === distId);
}
export function hasImportedDataFor(distId: string): boolean {
  return cache.some((b) => b.distributeurId === distId);
}
export function hasAnyImportedData(): boolean {
  return cache.length > 0;
}
