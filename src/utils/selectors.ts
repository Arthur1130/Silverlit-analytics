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

// Ensemble des EAN d'une gamme (null = toutes gammes confondues).
function gammeEanSet(gamme: AppFilters['gamme']): Set<string> | null {
  return gamme === 'all'
    ? null
    : new Set(PRODUITS.filter((p) => p.gamme === gamme).map((p) => p.ean));
}

export function filteredVentes(filters: AppFilters): Vente[] {
  const weeks = new Set(periodWeeks(filters.period).map(weekKey));
  const gammeEans = gammeEanSet(filters.gamme);

  return VENTES.filter((v) => {
    if (!weeks.has(weekKey(v))) return false;
    if (filters.distributeurId !== 'all' && v.distributeurId !== filters.distributeurId) return false;
    if (gammeEans && !gammeEans.has(v.ean)) return false;
    return true;
  });
}

// Périmètre filtré par distributeur + gamme, SANS contrainte de période.
// Sert au comparatif année sur année (vue « glissante à l'année » sur 52
// semaines, indépendante du sélecteur de période S-1 / 4S / 13S…).
export function scopeVentes(filters: AppFilters): Vente[] {
  const gammeEans = gammeEanSet(filters.gamme);
  return VENTES.filter((v) => {
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

  const gammeEans = gammeEanSet(filters.gamme);

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

// =======================================================================
//   Comparatif année sur année (N vs N-1) par semaine
// =======================================================================
//
// Vrai comparatif « glissant à l'année » : pour chaque numéro de semaine
// (S1…S52) on confronte l'année N (la plus récente présente dans les données)
// à l'année N-1 — MÊME numéro de semaine, d'une année sur l'autre.
//
// Règle anti-faux-chiffre stricte :
//   - `caN`/`caN1` valent `null` (et non 0) si AUCUNE vente n'existe pour ce
//     couple (année, semaine). Sur le graphe → un trou, jamais un faux zéro.
//   - Une évolution % n'est calculée QUE sur les semaines « comparables »
//     (présentes à la fois en N et N-1). Sinon elle vaut `null` → l'UI
//     affiche « — » au lieu d'un pourcentage trompeur.

export interface YoYWeek {
  semaine: number;            // 1..52
  caN: number | null;         // CA année N pour cette semaine (null = pas de donnée)
  caN1: number | null;        // CA année N-1 pour cette semaine
  qteN: number | null;
  qteN1: number | null;
}

export interface YoYReference {
  semaine: number;            // semaine de référence (point d'ancrage)
  // Cumul « depuis la S1 jusqu'à la semaine de référence incluse », calculé
  // UNIQUEMENT sur les semaines comparables (présentes en N ET N-1).
  caN: number;
  caN1: number;
  qteN: number;
  qteN1: number;
  matchedWeeks: number[];     // semaines effectivement cumulées (≤ réf, communes)
  caEvolution: number | null; // (caN - caN1)/caN1 ; null si caN1 == 0
  qteEvolution: number | null;
}

export interface YoYComparison {
  anneeN: number;
  anneeN1: number;
  hasN: boolean;              // au moins une semaine présente en N
  hasN1: boolean;             // au moins une semaine présente en N-1
  weeks: YoYWeek[];           // 52 entrées (S1..S52), trous = null
  weeksPresentN: number[];    // numéros de semaine présents en N (candidats réf.)
  matchedWeeks: number[];     // semaines présentes en N ET N-1 (toute l'année)
  totalCaN: number;           // Σ CA toutes semaines N
  totalCaN1: number;          // Σ CA toutes semaines N-1
  totalQteN: number;
  totalQteN1: number;
  reference: YoYReference | null; // null si N et N-1 n'ont aucune semaine commune
}

const FULL_YEAR_WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);

/**
 * Construit le comparatif N / N-1 par semaine.
 * @param ventes  périmètre déjà filtré (cf. `scopeVentes`).
 * @param refWeek semaine de référence pour le cumul ; par défaut = dernière
 *                semaine présente en N.
 */
export function compareYoY(ventes: Vente[], refWeek?: number): YoYComparison {
  // reduce plutôt que Math.max(...spread) : robuste quel que soit le volume
  // de ventes (le spread peut dépasser la limite d'arguments sur de gros lots).
  const anneeN = ventes.length
    ? ventes.reduce((m, v) => (v.annee > m ? v.annee : m), ventes[0].annee)
    : CURRENT_WEEK.annee;
  const anneeN1 = anneeN - 1;

  // Agrégats par semaine, séparément pour N et N-1.
  const aggN = new Map<number, { ca: number; qte: number }>();
  const aggN1 = new Map<number, { ca: number; qte: number }>();
  for (const v of ventes) {
    const target = v.annee === anneeN ? aggN : v.annee === anneeN1 ? aggN1 : null;
    if (!target) continue;
    const cur = target.get(v.semaine) ?? { ca: 0, qte: 0 };
    cur.ca += v.caTTC;
    cur.qte += v.qteVendue;
    target.set(v.semaine, cur);
  }

  const weeks: YoYWeek[] = FULL_YEAR_WEEKS.map((s) => {
    const n = aggN.get(s);
    const n1 = aggN1.get(s);
    return {
      semaine: s,
      caN: n ? n.ca : null,
      caN1: n1 ? n1.ca : null,
      qteN: n ? n.qte : null,
      qteN1: n1 ? n1.qte : null,
    };
  });

  const weeksPresentN = FULL_YEAR_WEEKS.filter((s) => aggN.has(s));
  const matchedWeeks = FULL_YEAR_WEEKS.filter((s) => aggN.has(s) && aggN1.has(s));

  let totalCaN = 0, totalQteN = 0;
  for (const { ca, qte } of aggN.values()) { totalCaN += ca; totalQteN += qte; }
  let totalCaN1 = 0, totalQteN1 = 0;
  for (const { ca, qte } of aggN1.values()) { totalCaN1 += ca; totalQteN1 += qte; }

  const hasN = weeksPresentN.length > 0;
  const hasN1 = aggN1.size > 0;

  // Semaine de référence : UNIQUEMENT une semaine COMPARABLE (présente en N ET
  // N-1). Par défaut, la dernière semaine comparable. Toute valeur fournie est
  // bornée à `matchedWeeks` → jamais de cumul « fantôme » à 0 sur des semaines
  // sans équivalent N-1 (règle anti-faux-chiffre). `reference` reste `null` tant
  // que les deux années ne partagent aucune semaine : il n'y a alors rien à cumuler.
  let reference: YoYReference | null = null;
  if (matchedWeeks.length > 0) {
    const lastMatched = matchedWeeks[matchedWeeks.length - 1];
    const ref = refWeek != null && matchedWeeks.includes(refWeek) ? refWeek : lastMatched;
    const refMatched = matchedWeeks.filter((s) => s <= ref);
    let caN = 0, caN1 = 0, qteN = 0, qteN1 = 0;
    for (const s of refMatched) {
      caN += aggN.get(s)!.ca;
      caN1 += aggN1.get(s)!.ca;
      qteN += aggN.get(s)!.qte;
      qteN1 += aggN1.get(s)!.qte;
    }
    reference = {
      semaine: ref,
      caN: Math.round(caN * 100) / 100,
      caN1: Math.round(caN1 * 100) / 100,
      qteN, qteN1,
      matchedWeeks: refMatched,
      caEvolution: caN1 > 0 ? ((caN - caN1) / caN1) * 100 : null,
      qteEvolution: qteN1 > 0 ? ((qteN - qteN1) / qteN1) * 100 : null,
    };
  }

  return {
    anneeN, anneeN1, hasN, hasN1, weeks, weeksPresentN, matchedWeeks,
    totalCaN: Math.round(totalCaN * 100) / 100,
    totalCaN1: Math.round(totalCaN1 * 100) / 100,
    totalQteN, totalQteN1,
    reference,
  };
}

export function ventesByEan(ean: string) {
  return VENTES.filter((v) => v.ean === ean);
}

export function ventesByDistributeur(id: string) {
  return VENTES.filter((v) => v.distributeurId === id);
}
