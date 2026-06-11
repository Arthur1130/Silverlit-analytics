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
import { DISTRIBUTEURS } from './distributors';
import { fetchBatchesFromServer, pushBatchToServer, deleteBatchOnServer } from '../api/batchesApi';

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
// Ids des lots dont la présence en base en ligne a été CONFIRMÉE au moins une
// fois depuis cet appareil. Sert à distinguer, au boot, un lot local absent du
// serveur : jamais synchronisé → import hors-ligne à migrer ; déjà synchronisé
// → supprimé depuis un autre appareil, NE PAS le ressusciter en le re-poussant.
const SYNCED_KEY = 'silverlit.import.batches.synced.v1';

function readSyncedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(SYNCED_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSyncedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SYNCED_KEY, JSON.stringify([...ids]));
  } catch {
    /* no-op */
  }
}

function markSynced(id: string): void {
  const ids = readSyncedIds();
  if (!ids.has(id)) {
    ids.add(id);
    writeSyncedIds(ids);
  }
}

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

// Cache mémoire synchronisé (lecture synchrone par tout le dashboard)
let cache: ImportBatch[] = readStore();

// Vrai si la base en ligne est joignable (sinon : mode local de secours)
let serverActive = false;
export function isServerActive(): boolean {
  return serverActive;
}

/**
 * Hydrate le cache depuis la BASE EN LIGNE au démarrage de l'app.
 *  - si la base répond : elle fait foi → on remplace le cache local
 *  - on MIGRE au passage les lots présents seulement en local (imports faits
 *    avant la mise en ligne de la base) vers la base
 *  - si la base est vide : on l'amorce avec les données de référence (seed)
 *  - si la base est injoignable : on garde le stockage local (aucune casse)
 *
 * Appelée AVANT le rendu de l'app (cf. main.tsx) pour que le dashboard lise
 * directement les données partagées.
 */
export async function hydrateFromServer(): Promise<void> {
  const server = await fetchBatchesFromServer();
  if (server === null) {
    serverActive = false; // base indisponible → on reste en local
    return;
  }
  serverActive = true;
  const serverIds = new Set(server.map((b) => b.id));
  const synced = readSyncedIds();
  // Lots locaux absents du serveur :
  //  - jamais synchronisés → imports faits hors-ligne, on les MIGRE vers la base
  //  - déjà synchronisés   → supprimés depuis un autre appareil, on les LAISSE
  //    morts (les re-pousser ressusciterait des lots supprimés ailleurs)
  const localOnly = cache.filter((b) => !serverIds.has(b.id) && !synced.has(b.id));
  for (const b of localOnly) {
    if (await pushBatchToServer(b)) markSynced(b.id);
  }
  let merged = [...server, ...localOnly];
  // Amorçage : si tout est vide, on installe le seed de référence
  if (merged.length === 0) {
    const seed = buildSeedBatches();
    for (const b of seed) {
      if (await pushBatchToServer(b)) markSynced(b.id);
    }
    merged = seed;
  }
  // Tout ce qui vient du serveur est, par définition, synchronisé.
  const allSynced = readSyncedIds();
  for (const b of server) allSynced.add(b.id);
  writeSyncedIds(allSynced);
  cache = merged;
  writeStore(cache);
}

// ---- API publique ----
export function getBatches(): ImportBatch[] {
  return cache;
}

export function getBatch(id: string): ImportBatch | undefined {
  return cache.find((b) => b.id === id);
}

/** Ajoute un nouveau lot (local + base en ligne). */
export function addBatch(batch: ImportBatch): void {
  cache = [...cache, batch];
  writeStore(cache);
  if (serverActive) {
    void pushBatchToServer(batch).then((ok) => {
      if (ok) markSynced(batch.id);
    });
  }
}

// Les LIGNES de vente portent elles-mêmes année/semaine/distributeur, et c'est
// ELLES que lit le dashboard (getAllVentes). Toute modification des métadonnées
// d'un lot DOIT donc être propagée à ses lignes — sinon la page Import affiche
// « 2025·S28 » pendant que le dashboard compte toujours les ventes en 2026·S1
// (bug historique : 15 lots édités jamais répercutés sur les courbes).
function syncRowsWithMeta(b: ImportBatch): ImportBatch {
  const desync = b.rows.some(
    (r) => r.annee !== b.annee || r.semaine !== b.semaine || r.distributeurId !== b.distributeurId,
  );
  if (!desync) return b;
  const dist = DISTRIBUTEURS.find((d) => d.id === b.distributeurId);
  const rows = b.rows.map((r) => ({
    ...r,
    annee: b.annee,
    semaine: b.semaine,
    distributeurId: b.distributeurId,
    ...(r.distributeurId !== b.distributeurId && dist
      ? { magasinCode: `${dist.codeRetail}-CONSO`, magasinLibelle: `${dist.nom} — flux consolidé` }
      : {}),
  }));
  return { ...b, rows };
}

/** Met à jour les métadonnées d'un lot (local + base en ligne), lignes incluses. */
export function updateBatch(id: string, patch: Partial<Omit<ImportBatch, 'id' | 'rows'>>): void {
  cache = cache.map((b) => (b.id === id ? syncRowsWithMeta({ ...b, ...patch }) : b));
  writeStore(cache);
  if (serverActive) {
    const updated = cache.find((b) => b.id === id);
    if (updated) void pushBatchToServer(updated);
  }
}

/** Supprime un lot (local + base en ligne). */
export function deleteBatch(id: string): void {
  cache = cache.filter((b) => b.id !== id);
  writeStore(cache);
  // Hygiène du registre : un id supprimé n'a plus à y figurer.
  const synced = readSyncedIds();
  if (synced.delete(id)) writeSyncedIds(synced);
  if (serverActive) void deleteBatchOnServer(id);
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
