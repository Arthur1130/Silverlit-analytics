import type { Alerte, Severite } from '../types';
import { VENTES } from './sales';
import { findProduit } from './products';
import { findDistributeur } from './distributors';

// Alertes DÉRIVÉES des vraies ventes importées — aucune valeur inventée.
//
// Signaux réels détectables sur les données présentes :
//   - solde net négatif (retours > ventes) sur un (produit × distributeur)
//   - référence en fin de vie encore vendue (à déstocker)
//   - rupture potentielle : ventes significatives mais stock à 0
//
// Si aucune donnée n'est importée, la liste est vide (état honnête).
// Les ID sont déterministes pour que le statut « traité » persiste.

const SEV_RANK: Record<Severite, number> = { haute: 0, moyenne: 1, basse: 2 };

// Date de référence = période des données (semaine 1). Honnête : l'alerte
// porte sur cette semaine, pas sur « aujourd'hui ».
const DATE_REF = '2026-01-12T09:00:00Z';

function generateAlertes(): Alerte[] {
  // Agrégat par (ean, distributeur)
  const map = new Map<string, { ean: string; dist: string; qte: number; ca: number; stock: number }>();
  for (const v of VENTES) {
    const k = `${v.ean}|${v.distributeurId}`;
    const cur = map.get(k) ?? { ean: v.ean, dist: v.distributeurId, qte: 0, ca: 0, stock: 0 };
    cur.qte += v.qteVendue;
    cur.ca += v.caTTC;
    cur.stock = Math.max(cur.stock, v.qteStock);
    map.set(k, cur);
  }

  const alerts: Alerte[] = [];
  for (const r of map.values()) {
    const p = findProduit(r.ean);
    if (!p) continue;
    const distNom = findDistributeur(r.dist)?.nom ?? r.dist;

    // 1. Solde net négatif (retours > ventes) — signal fort et réel
    if (r.qte < 0) {
      alerts.push({
        id: `ret-${r.dist}-${r.ean}`, type: 'baisse', ean: r.ean, libelle: p.libelle,
        distributeurId: r.dist,
        message: `Solde net négatif chez ${distNom} : ${r.qte} u. (retours supérieurs aux ventes)`,
        severite: 'moyenne', dateCreation: DATE_REF, statut: 'ouverte', delta: r.qte,
      });
    } else if (p.statut === 'fin_de_vie' && r.qte >= 30) {
      // 2. Fin de vie à fort volume (best-seller en arrêt → gérer le déstockage)
      alerts.push({
        id: `fdv-${r.dist}-${r.ean}`, type: 'rotation', ean: r.ean, libelle: p.libelle,
        distributeurId: r.dist,
        message: `Référence en fin de vie à fort volume chez ${distNom} (${r.qte} u.) — anticiper le déstockage`,
        severite: 'moyenne', dateCreation: DATE_REF, statut: 'ouverte', delta: r.qte,
      });
    } else if (r.qte >= 10 && r.stock === 0) {
      // 3. Rupture potentielle : ventes significatives, stock à 0
      alerts.push({
        id: `rup-${r.dist}-${r.ean}`, type: 'rupture', ean: r.ean, libelle: p.libelle,
        distributeurId: r.dist,
        message: `Stock à 0 chez ${distNom} malgré ${r.qte} u. vendues — risque de rupture`,
        severite: 'haute', dateCreation: DATE_REF, statut: 'ouverte',
      });
    }
  }

  // Tri par sévérité puis volume, plafonné pour rester lisible
  return alerts
    .sort((a, b) => SEV_RANK[a.severite] - SEV_RANK[b.severite] || Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    .slice(0, 15);
}

export const ALERTES_INIT: Alerte[] = generateAlertes();
