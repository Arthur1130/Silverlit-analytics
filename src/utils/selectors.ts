import {
  VENTES,
  WEEKS,
  CURRENT_WEEK,
  PRODUITS,
  DISTRIBUTEURS,
  findProduit,
} from '../data';
import type { Vente } from '../types';
import type { AppFilters, Period } from '../context/AppContext';

export function periodWeeks(period: Period): Array<{ annee: number; semaine: number }> {
  switch (period) {
    case 'S-1':
      return [CURRENT_WEEK];
    case '4S':
      return WEEKS.slice(-4);
    case '13S':
      return WEEKS.slice(-13);
    case '52S':
      return WEEKS.slice(-52);
    case '24M':
      return WEEKS;
  }
}

function weekKey(v: { annee: number; semaine: number }) {
  return `${v.annee}-${v.semaine}`;
}

export function filteredVentes(filters: AppFilters): Vente[] {
  const weeks = new Set(periodWeeks(filters.period).map(weekKey));
  const gammeEans = filters.gamme === 'all'
    ? null
    : new Set(PRODUITS.filter((p) => p.gamme === filters.gamme).map((p) => p.ean));

  return VENTES.filter((v) => {
    if (!weeks.has(weekKey(v))) return false;
    if (filters.distributeurId !== 'all' && v.distributeurId !== filters.distributeurId) return false;
    if (gammeEans && !gammeEans.has(v.ean)) return false;
    return true;
  });
}

export function previousPeriodVentes(filters: AppFilters): Vente[] {
  const weeks = periodWeeks(filters.period);
  const idxStart = WEEKS.findIndex((w) => weekKey(w) === weekKey(weeks[0]));
  const len = weeks.length;
  const prevWeeks = WEEKS.slice(Math.max(0, idxStart - len), idxStart);
  const prevSet = new Set(prevWeeks.map(weekKey));

  const gammeEans = filters.gamme === 'all'
    ? null
    : new Set(PRODUITS.filter((p) => p.gamme === filters.gamme).map((p) => p.ean));

  return VENTES.filter((v) => {
    if (!prevSet.has(weekKey(v))) return false;
    if (filters.distributeurId !== 'all' && v.distributeurId !== filters.distributeurId) return false;
    if (gammeEans && !gammeEans.has(v.ean)) return false;
    return true;
  });
}

export interface AggKPI {
  ca: number;
  qte: number;
  refs: number;
  panierMoyen: number;
}

export function aggregateKPI(ventes: Vente[]): AggKPI {
  let ca = 0;
  let qte = 0;
  const eans = new Set<string>();
  for (const v of ventes) {
    ca += v.caTTC;
    qte += v.qteVendue;
    eans.add(v.ean);
  }
  return {
    ca,
    qte,
    refs: eans.size,
    panierMoyen: qte > 0 ? ca / qte : 0,
  };
}

export function caByWeek(ventes: Vente[]) {
  const map = new Map<string, { annee: number; semaine: number; ca: number; qte: number }>();
  for (const v of ventes) {
    const k = `${v.annee}-${v.semaine}`;
    const cur = map.get(k) ?? { annee: v.annee, semaine: v.semaine, ca: 0, qte: 0 };
    cur.ca += v.caTTC;
    cur.qte += v.qteVendue;
    map.set(k, cur);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.annee !== b.annee ? a.annee - b.annee : a.semaine - b.semaine,
  );
}

export function caByDistributeur(ventes: Vente[]) {
  const map = new Map<string, number>();
  for (const v of ventes) map.set(v.distributeurId, (map.get(v.distributeurId) ?? 0) + v.caTTC);
  return DISTRIBUTEURS.map((d) => ({
    id: d.id,
    nom: d.nom,
    color: d.logoColor,
    ca: map.get(d.id) ?? 0,
  })).sort((a, b) => b.ca - a.ca);
}

export function caByGamme(ventes: Vente[]) {
  const map = new Map<string, number>();
  for (const v of ventes) {
    const p = findProduit(v.ean);
    if (!p) continue;
    map.set(p.gamme, (map.get(p.gamme) ?? 0) + v.caTTC);
  }
  return Array.from(map.entries()).map(([gamme, ca]) => ({ gamme, ca })).sort((a, b) => b.ca - a.ca);
}

export function topProduits(ventes: Vente[], n = 10) {
  const map = new Map<string, { ca: number; qte: number }>();
  for (const v of ventes) {
    const cur = map.get(v.ean) ?? { ca: 0, qte: 0 };
    cur.ca += v.caTTC;
    cur.qte += v.qteVendue;
    map.set(v.ean, cur);
  }
  return Array.from(map.entries())
    .map(([ean, agg]) => ({ ean, ...agg, produit: findProduit(ean) }))
    .filter((x) => x.produit)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, n);
}

export function ventesByEan(ean: string) {
  return VENTES.filter((v) => v.ean === ean);
}

export function ventesByDistributeur(id: string) {
  return VENTES.filter((v) => v.distributeurId === id);
}
