// Client de l'API des lots d'import (base en ligne).
//
// Toutes les fonctions sont tolérantes aux pannes : si l'API/la base n'est pas
// disponible, elles renvoient null/false et l'app retombe sur le stockage local
// (le site ne casse jamais).

import type { ImportBatch } from '../data/importBatches';
import { authHeaders } from './authToken';

const BASE = '/api/batches';

/** Récupère tous les lots depuis la base. null = API indisponible. */
export async function fetchBatchesFromServer(): Promise<ImportBatch[] | null> {
  try {
    const res = await fetch(BASE, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? (data as ImportBatch[]) : null;
  } catch {
    return null;
  }
}

/** Enregistre (crée ou écrase) un lot en base. */
export async function pushBatchToServer(batch: ImportBatch): Promise<boolean> {
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(batch),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Supprime un lot en base. */
export async function deleteBatchOnServer(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}
