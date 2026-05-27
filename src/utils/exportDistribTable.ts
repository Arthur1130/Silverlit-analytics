// Export Excel par distributeur — version CFO-grade.
//
// Conçue pour qu'un Directeur Financier ou un Directeur Commercial puisse
// lire toute la santé d'une enseigne **en diagonale** :
//   - une ligne par produit (pas de bloc empilé N/N-1)
//   - N et N-1 côte à côte avec l'écart explicite (Δ et Δ%)
//   - groupement par marque + sous-totaux par marque + total général
//   - codage couleur des Δ% pour repérer en 5 secondes les problèmes
//
// Source de vérité : `IMPORTED_VENTES` (uniquement les vraies ventes
// importées par l'utilisateur). Tant que rien n'a été importé pour ce
// distributeur, l'export affiche du « — » partout — décision produit pour
// éviter qu'un export contienne des chiffres synthétiques mensongers.
//
// `xlsx` (SheetJS) est chargé en import dynamique pour ne pas alourdir
// le bundle principal.

import {
  PRODUITS,
  WEEKS,
  findDistributeur,
  findProduit,
  assortmentOf,
  getImportedVentesByDistrib,
  hasImportedDataFor,
} from '../data';
import type { Vente } from '../types';

const CURRENT_YEAR = 2026;
const PREV_YEAR = CURRENT_YEAR - 1;
const NB_WEEKS = 52;
const TRAILING_WEEKS = 4; // tendance « 4 dernières semaines »

// Sentinelle d'affichage quand une donnée n'a pas été importée
const EMPTY = '—';

// =======================================================================
//   Types SheetJS minimaux
// =======================================================================

interface CellStyle {
  font?: { bold?: boolean; color?: { rgb: string }; sz?: number };
  fill?: { fgColor: { rgb: string } };
  alignment?: { horizontal?: 'left' | 'center' | 'right'; vertical?: 'center' };
  border?: Record<string, { style: string; color: { rgb: string } }>;
  numFmt?: string;
}

interface CellObject {
  v: string | number;
  t?: 's' | 'n';
  s?: CellStyle;
  z?: string;
}

interface SheetJSModule {
  utils: {
    book_new(): unknown;
    aoa_to_sheet(rows: unknown[][]): Record<string, unknown>;
    book_append_sheet(wb: unknown, ws: unknown, name: string): void;
    decode_range(r: string): { s: { c: number; r: number }; e: { c: number; r: number } };
    encode_cell(addr: { c: number; r: number }): string;
  };
  writeFile(wb: unknown, filename: string): void;
}

async function loadXLSX(): Promise<SheetJSModule> {
  const mod = await import('xlsx');
  return mod as unknown as SheetJSModule;
}

// =======================================================================
//   Outils
// =======================================================================

function safeFileName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dernière semaine pour laquelle on a au moins une donnée. */
function lastImportedWeek(ventes: readonly Vente[]): { annee: number; semaine: number } | null {
  if (ventes.length === 0) return null;
  let bestY = 0;
  let bestS = 0;
  for (const v of ventes) {
    if (v.annee > bestY || (v.annee === bestY && v.semaine > bestS)) {
      bestY = v.annee;
      bestS = v.semaine;
    }
  }
  return { annee: bestY, semaine: bestS };
}

/** Agrège les ventes par EAN → [qty(S1)…qty(S52)] pour une année donnée. */
function buildQtyMatrix(ventes: readonly Vente[], annee: number, eans: string[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const ean of eans) m.set(ean, new Array(NB_WEEKS).fill(0));
  for (const v of ventes) {
    if (v.annee !== annee) continue;
    const arr = m.get(v.ean);
    if (!arr) continue;
    const idx = v.semaine - 1;
    if (idx >= 0 && idx < NB_WEEKS) arr[idx] += v.qteVendue;
  }
  return m;
}

function buildCaMatrix(ventes: readonly Vente[], annee: number, eans: string[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const ean of eans) m.set(ean, new Array(NB_WEEKS).fill(0));
  for (const v of ventes) {
    if (v.annee !== annee) continue;
    const arr = m.get(v.ean);
    if (!arr) continue;
    const idx = v.semaine - 1;
    if (idx >= 0 && idx < NB_WEEKS) arr[idx] += v.caTTC;
  }
  return m;
}

function sumOver(weeks: number[], from: number, to: number): number {
  let s = 0;
  for (let i = from; i <= to && i < weeks.length; i++) s += weeks[i] ?? 0;
  return s;
}

function pctDelta(n: number, n1: number): number | string {
  if (n1 === 0) return n > 0 ? 100 : 0;
  return ((n - n1) / n1) * 100;
}

function colorForDelta(d: number | string): string | null {
  if (typeof d !== 'number') return null;
  if (d >= 5) return 'C6EFCE'; // vert pâle
  if (d > -5) return 'F2F2F2'; // neutre
  if (d > -15) return 'FFEB9C'; // ambre
  return 'FFC7CE'; // rouge pâle
}

const STATUT_LABEL: Record<string, string> = {
  actif: 'reconduit',
  fin_de_vie: 'non reconduit',
  retire: 'retiré',
};

// =======================================================================
//   Onglet 1 — SYNTHÈSE
// =======================================================================
//
// Le « cockpit » du directeur : KPIs en haut, top 5 contributeurs / décrochages,
// mix par marque. Lecture 30 secondes.

interface ProductPerf {
  ean: string;
  libelle: string;
  marque: string;
  qteN: number;
  qteN1: number;
  caN: number;
  caN1: number;
  deltaQtePct: number | string;
  deltaCaEuro: number;
  deltaCaPct: number | string;
}

function buildSyntheseSheet(
  XLSX: SheetJSModule,
  distNom: string,
  assortment: string[],
  qtyN: Map<string, number[]>,
  qtyN1: Map<string, number[]>,
  caN: Map<string, number[]>,
  caN1: Map<string, number[]>,
  hasData: boolean,
  lastWeek: { annee: number; semaine: number } | null,
): unknown {
  const rows: unknown[][] = [];

  // En-tête
  rows.push([`SYNTHÈSE — ${distNom.toUpperCase()}`]);
  rows.push([hasData
    ? `Données à jour : S${lastWeek!.semaine} / ${lastWeek!.annee}`
    : 'Aucune vente importée pour cette enseigne']);
  rows.push([]);

  // KPIs globaux
  const allEans = assortment;
  let totalQteN = 0, totalQteN1 = 0, totalCaN = 0, totalCaN1 = 0;
  const perfs: ProductPerf[] = [];

  for (const ean of allEans) {
    const p = findProduit(ean);
    if (!p) continue;
    const qN = qtyN.get(ean) ?? [];
    const qN1 = qtyN1.get(ean) ?? [];
    const cN = caN.get(ean) ?? [];
    const cN1 = caN1.get(ean) ?? [];
    const sQN = qN.reduce((s, x) => s + x, 0);
    const sQN1 = qN1.reduce((s, x) => s + x, 0);
    const sCN = cN.reduce((s, x) => s + x, 0);
    const sCN1 = cN1.reduce((s, x) => s + x, 0);
    totalQteN += sQN;
    totalQteN1 += sQN1;
    totalCaN += sCN;
    totalCaN1 += sCN1;
    perfs.push({
      ean,
      libelle: p.libelle,
      marque: p.marque,
      qteN: sQN,
      qteN1: sQN1,
      caN: sCN,
      caN1: sCN1,
      deltaQtePct: pctDelta(sQN, sQN1),
      deltaCaEuro: sCN - sCN1,
      deltaCaPct: pctDelta(sCN, sCN1),
    });
  }

  const deltaCaEuro = totalCaN - totalCaN1;
  const deltaCaPct = pctDelta(totalCaN, totalCaN1);
  const deltaQtePct = pctDelta(totalQteN, totalQteN1);

  // Bandeau KPIs (en bloc 2 colonnes)
  rows.push(['INDICATEURS CLÉS', '', '', '']);
  rows.push([
    'CA YTD N',
    hasData ? Number(totalCaN.toFixed(2)) : EMPTY,
    'Qté YTD N',
    hasData ? totalQteN : EMPTY,
  ]);
  rows.push([
    'CA YTD N-1',
    hasData ? Number(totalCaN1.toFixed(2)) : EMPTY,
    'Qté YTD N-1',
    hasData ? totalQteN1 : EMPTY,
  ]);
  rows.push([
    'Écart CA (€)',
    hasData ? Number(deltaCaEuro.toFixed(2)) : EMPTY,
    'Écart Qté (%)',
    hasData ? (typeof deltaQtePct === 'number' ? Number(deltaQtePct.toFixed(1)) : deltaQtePct) : EMPTY,
  ]);
  rows.push([
    'Écart CA (%)',
    hasData ? (typeof deltaCaPct === 'number' ? Number(deltaCaPct.toFixed(1)) : deltaCaPct) : EMPTY,
    'Réfs vendues',
    hasData ? perfs.filter((p) => p.qteN > 0).length : EMPTY,
  ]);
  rows.push([]);

  if (!hasData) {
    rows.push(['Importez un fichier sur la page Import pour faire apparaître les analyses.']);
    return XLSX.utils.aoa_to_sheet(rows);
  }

  // Top 5 contributeurs (par CA)
  const topCa = [...perfs].sort((a, b) => b.caN - a.caN).slice(0, 5);
  rows.push(['TOP 5 CONTRIBUTEURS AU CA', 'Marque', 'CA YTD N (€)', '% du CA total']);
  for (const p of topCa) {
    rows.push([p.libelle, p.marque, Number(p.caN.toFixed(2)),
      totalCaN > 0 ? Number(((p.caN / totalCaN) * 100).toFixed(1)) : 0]);
  }
  rows.push([]);

  // Top 5 décrochages (plus grosse perte en € N vs N-1)
  const topDrop = [...perfs]
    .filter((p) => p.caN1 > 0) // seulement les produits qui vendaient en N-1
    .sort((a, b) => a.deltaCaEuro - b.deltaCaEuro)
    .slice(0, 5);
  rows.push(['TOP 5 DÉCROCHAGES', 'Marque', 'Écart CA (€)', 'Écart CA (%)']);
  for (const p of topDrop) {
    rows.push([
      p.libelle,
      p.marque,
      Number(p.deltaCaEuro.toFixed(2)),
      typeof p.deltaCaPct === 'number' ? Number(p.deltaCaPct.toFixed(1)) : p.deltaCaPct,
    ]);
  }
  rows.push([]);

  // Top 5 progressions
  const topGrow = [...perfs]
    .filter((p) => p.caN > 0)
    .sort((a, b) => b.deltaCaEuro - a.deltaCaEuro)
    .slice(0, 5);
  rows.push(['TOP 5 PROGRESSIONS', 'Marque', 'Écart CA (€)', 'Écart CA (%)']);
  for (const p of topGrow) {
    rows.push([
      p.libelle,
      p.marque,
      Number(p.deltaCaEuro.toFixed(2)),
      typeof p.deltaCaPct === 'number' ? Number(p.deltaCaPct.toFixed(1)) : p.deltaCaPct,
    ]);
  }
  rows.push([]);

  // Mix par marque
  const byMarque = new Map<string, { ca: number; qte: number }>();
  for (const p of perfs) {
    const cur = byMarque.get(p.marque) ?? { ca: 0, qte: 0 };
    cur.ca += p.caN;
    cur.qte += p.qteN;
    byMarque.set(p.marque, cur);
  }
  rows.push(['MIX PAR MARQUE', 'CA YTD N (€)', '% du CA', 'Qté YTD N']);
  const sorted = [...byMarque.entries()].sort((a, b) => b[1].ca - a[1].ca);
  for (const [marque, agg] of sorted) {
    rows.push([
      marque,
      Number(agg.ca.toFixed(2)),
      totalCaN > 0 ? Number(((agg.ca / totalCaN) * 100).toFixed(1)) : 0,
      agg.qte,
    ]);
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

// =======================================================================
//   Onglet 2 — TAB VENTES (le cœur)
// =======================================================================

function buildTabVentesSheet(
  XLSX: SheetJSModule,
  distNom: string,
  assortment: string[],
  qtyN: Map<string, number[]>,
  qtyN1: Map<string, number[]>,
  caN: Map<string, number[]>,
  caN1: Map<string, number[]>,
  hasData: boolean,
  lastWeek: { annee: number; semaine: number } | null,
): unknown {
  const rows: unknown[][] = [];

  // Bandeau titre (2 lignes)
  rows.push([`TABLEAU DES VENTES — ${distNom.toUpperCase()}`]);
  rows.push([
    `Année en cours : ${CURRENT_YEAR}`,
    '', '', '', '',
    hasData ? `Données à jour : S${lastWeek!.semaine} / ${lastWeek!.annee}` : 'Aucun import',
  ]);
  rows.push([]);

  // En-tête : 2 lignes (bloc + sous-bloc)
  const headerBlock = [
    '', '', '', '', '', '', '',           // identification (7 cols)
    'VOLUMES YTD', '', '', '',            // 4 cols
    'VALEUR YTD', '', '', '',             // 4 cols
    'ANNÉE PRÉCÉDENTE',                   // 1 col
    `${TRAILING_WEEKS} DERNIÈRES SEMAINES`, '', '', // 3 cols
    'ÉCOULEMENT', '',                     // 2 cols (Livré, Taux)
    'PRIX',                               // 1 col
  ];
  const headerCols = [
    '#', 'Marque', 'Catégorie', 'Réf.', 'EAN', 'Désignation', 'Statut',
    'Qté N', 'Qté N-1', 'Écart qté', 'Écart %',
    'CA N (€)', 'CA N-1 (€)', 'Écart €', 'Écart %',
    'Total N-1 (réalisé)',
    `${TRAILING_WEEKS}S N`, `${TRAILING_WEEKS}S N-1`, 'Écart %',
    'Livré YTD', 'Taux écoul.',
    `Tarif ${CURRENT_YEAR}`,
  ];
  rows.push(headerBlock);
  rows.push(headerCols);

  // Regroupement par marque (avec sous-totaux)
  const lastWeekIdx = lastWeek ? lastWeek.semaine - 1 : -1;
  const trailingFrom = Math.max(0, lastWeekIdx - TRAILING_WEEKS + 1);

  // Trier les EAN d'assortiment par marque puis par réf
  const eansByMarque = new Map<string, string[]>();
  for (const ean of assortment) {
    const p = findProduit(ean);
    if (!p) continue;
    const list = eansByMarque.get(p.marque) ?? [];
    list.push(ean);
    eansByMarque.set(p.marque, list);
  }
  const marquesSorted = [...eansByMarque.keys()].sort();

  let globalIndex = 0;
  let grandQteN = 0, grandQteN1 = 0, grandCaN = 0, grandCaN1 = 0;

  for (const marque of marquesSorted) {
    let mQteN = 0, mQteN1 = 0, mCaN = 0, mCaN1 = 0;
    const marqueStart = rows.length;

    for (const ean of eansByMarque.get(marque) ?? []) {
      const p = findProduit(ean);
      if (!p) continue;
      globalIndex += 1;

      const wN = qtyN.get(ean) ?? new Array(NB_WEEKS).fill(0);
      const wN1 = qtyN1.get(ean) ?? new Array(NB_WEEKS).fill(0);
      const cN = caN.get(ean) ?? new Array(NB_WEEKS).fill(0);
      const cN1 = caN1.get(ean) ?? new Array(NB_WEEKS).fill(0);

      const sQN = wN.reduce((s, x) => s + x, 0);
      const sQN1 = wN1.reduce((s, x) => s + x, 0);
      const sCN = cN.reduce((s, x) => s + x, 0);
      const sCN1 = cN1.reduce((s, x) => s + x, 0);

      mQteN += sQN; mQteN1 += sQN1; mCaN += sCN; mCaN1 += sCN1;

      const dQte = sQN - sQN1;
      const dQtePct = pctDelta(sQN, sQN1);
      const dCa = sCN - sCN1;
      const dCaPct = pctDelta(sCN, sCN1);

      const t4N = lastWeekIdx >= 0 ? sumOver(wN, trailingFrom, lastWeekIdx) : 0;
      const t4N1 = lastWeekIdx >= 0 ? sumOver(wN1, trailingFrom, lastWeekIdx) : 0;
      const t4Pct = pctDelta(t4N, t4N1);

      // Livré et taux d'écoulement : pas de données aujourd'hui → EMPTY
      const livre: number | string = EMPTY;
      const tauxEcoul: number | string = EMPTY;

      rows.push([
        globalIndex,
        p.marque,
        p.categorie,
        p.refFournisseur,
        p.ean,
        p.libelle,
        STATUT_LABEL[p.statut] ?? p.statut,
        hasData ? sQN : EMPTY,
        hasData ? sQN1 : EMPTY,
        hasData ? dQte : EMPTY,
        hasData ? (typeof dQtePct === 'number' ? Number(dQtePct.toFixed(1)) : dQtePct) : EMPTY,
        hasData ? Number(sCN.toFixed(2)) : EMPTY,
        hasData ? Number(sCN1.toFixed(2)) : EMPTY,
        hasData ? Number(dCa.toFixed(2)) : EMPTY,
        hasData ? (typeof dCaPct === 'number' ? Number(dCaPct.toFixed(1)) : dCaPct) : EMPTY,
        hasData ? Number(sCN1.toFixed(2)) : EMPTY, // Total N-1 réalisé (= cumul complet de N-1)
        hasData ? t4N : EMPTY,
        hasData ? t4N1 : EMPTY,
        hasData ? (typeof t4Pct === 'number' ? Number(t4Pct.toFixed(1)) : t4Pct) : EMPTY,
        livre,
        tauxEcoul,
        p.prixConseille,
      ]);
    }

    // Sous-total marque
    if (rows.length > marqueStart) {
      const dMQtePct = pctDelta(mQteN, mQteN1);
      const dMCa = mCaN - mCaN1;
      const dMCaPct = pctDelta(mCaN, mCaN1);
      rows.push([
        '',
        `Sous-total ${marque}`,
        '', '', '', '', '',
        hasData ? mQteN : EMPTY,
        hasData ? mQteN1 : EMPTY,
        hasData ? mQteN - mQteN1 : EMPTY,
        hasData ? (typeof dMQtePct === 'number' ? Number(dMQtePct.toFixed(1)) : dMQtePct) : EMPTY,
        hasData ? Number(mCaN.toFixed(2)) : EMPTY,
        hasData ? Number(mCaN1.toFixed(2)) : EMPTY,
        hasData ? Number(dMCa.toFixed(2)) : EMPTY,
        hasData ? (typeof dMCaPct === 'number' ? Number(dMCaPct.toFixed(1)) : dMCaPct) : EMPTY,
        hasData ? Number(mCaN1.toFixed(2)) : EMPTY,
        '', '', '', '', '', '',
      ]);
      rows.push([]); // ligne vide entre marques
    }

    grandQteN += mQteN; grandQteN1 += mQteN1; grandCaN += mCaN; grandCaN1 += mCaN1;
  }

  // Total général
  const dGQtePct = pctDelta(grandQteN, grandQteN1);
  const dGCa = grandCaN - grandCaN1;
  const dGCaPct = pctDelta(grandCaN, grandCaN1);
  rows.push([
    '', 'TOTAL GÉNÉRAL', '', '', '', '', '',
    hasData ? grandQteN : EMPTY,
    hasData ? grandQteN1 : EMPTY,
    hasData ? grandQteN - grandQteN1 : EMPTY,
    hasData ? (typeof dGQtePct === 'number' ? Number(dGQtePct.toFixed(1)) : dGQtePct) : EMPTY,
    hasData ? Number(grandCaN.toFixed(2)) : EMPTY,
    hasData ? Number(grandCaN1.toFixed(2)) : EMPTY,
    hasData ? Number(dGCa.toFixed(2)) : EMPTY,
    hasData ? (typeof dGCaPct === 'number' ? Number(dGCaPct.toFixed(1)) : dGCaPct) : EMPTY,
    hasData ? Number(grandCaN1.toFixed(2)) : EMPTY,
    '', '', '', '', '', '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Coloration des cellules Δ% (col 11 = Δ% qté, col 15 = Δ% CA, col 19 = Δ% 4S)
  if (hasData) {
    applyDeltaColors(XLSX, ws, rows, [10, 14, 18]);
  }
  return ws;
}

function applyDeltaColors(
  XLSX: SheetJSModule,
  ws: Record<string, unknown>,
  rows: unknown[][],
  cols: number[],
) {
  for (let r = 0; r < rows.length; r++) {
    for (const c of cols) {
      const val = rows[r]?.[c];
      if (typeof val !== 'number') continue;
      const addr = XLSX.utils.encode_cell({ c, r });
      const cell = ws[addr] as CellObject | undefined;
      if (!cell) continue;
      const fill = colorForDelta(val);
      if (fill) {
        cell.s = { ...(cell.s ?? {}), fill: { fgColor: { rgb: fill } } };
      }
    }
  }
}

// =======================================================================
//   Onglet 3 — DÉTAIL HEBDO (N et N-1 alterné, Δ% par semaine)
// =======================================================================

function buildDetailHebdoSheet(
  XLSX: SheetJSModule,
  distNom: string,
  assortment: string[],
  qtyN: Map<string, number[]>,
  qtyN1: Map<string, number[]>,
  hasData: boolean,
): unknown {
  const rows: unknown[][] = [];

  rows.push([`DÉTAIL HEBDOMADAIRE — ${distNom.toUpperCase()}`]);
  rows.push(['Quantités vendues, ligne N puis N-1, puis Écart % semaine par semaine']);
  rows.push([]);

  const header = ['Réf.', 'Désignation', 'Période',
    ...Array.from({ length: NB_WEEKS }, (_, i) => `S${i + 1}`), 'Total'];
  rows.push(header);

  for (const ean of assortment) {
    const p = findProduit(ean);
    if (!p) continue;

    const wN = qtyN.get(ean) ?? new Array(NB_WEEKS).fill(0);
    const wN1 = qtyN1.get(ean) ?? new Array(NB_WEEKS).fill(0);

    if (!hasData) {
      rows.push([p.refFournisseur, p.libelle, 'N', ...new Array(NB_WEEKS).fill(EMPTY), EMPTY]);
      rows.push(['', '', 'N-1', ...new Array(NB_WEEKS).fill(EMPTY), EMPTY]);
      rows.push(['', '', 'Écart %', ...new Array(NB_WEEKS).fill(EMPTY), EMPTY]);
      continue;
    }

    const totalN = wN.reduce((s, x) => s + x, 0);
    const totalN1 = wN1.reduce((s, x) => s + x, 0);
    const totalPct = pctDelta(totalN, totalN1);

    rows.push([p.refFournisseur, p.libelle, 'N', ...wN, totalN]);
    rows.push(['', '', 'N-1', ...wN1, totalN1]);
    const deltas = wN.map((q, i) => {
      const q1 = wN1[i] ?? 0;
      const d = pctDelta(q, q1);
      return typeof d === 'number' ? Number(d.toFixed(0)) : d;
    });
    rows.push(['', '', 'Écart %', ...deltas,
      typeof totalPct === 'number' ? Number(totalPct.toFixed(1)) : totalPct]);
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

// =======================================================================
//   Onglet 4 — base (catalogue Silverlit)
// =======================================================================

function buildBaseSheet(
  XLSX: SheetJSModule,
  assortmentSet: Set<string>,
): unknown {
  const header = [
    'MARQUE', 'Num séq.', 'ORDRE', 'Réf.', 'EAN', 'DESIGNATION',
    'TARIFS 2025', 'TARIF 2026', 'STATUT', 'Référencé enseigne',
  ];
  const rows: unknown[][] = [header];

  // Numérotation par marque
  const seqByMarque = new Map<string, number>();
  PRODUITS.forEach((p, i) => {
    const seq = (seqByMarque.get(p.marque) ?? 0) + 1;
    seqByMarque.set(p.marque, seq);
    rows.push([
      p.marque,
      seq,
      i + 1,
      p.refFournisseur,
      p.ean,
      p.libelle,
      EMPTY,            // Tarif 2025 : à brancher quand on aura l'historique
      p.prixConseille,  // Tarif 2026
      STATUT_LABEL[p.statut] ?? p.statut,
      assortmentSet.has(p.ean) ? 'oui' : '',
    ]);
  });

  return XLSX.utils.aoa_to_sheet(rows);
}

// =======================================================================
//   Export principal
// =======================================================================

export async function exportDistributeurXlsx(distId: string): Promise<void> {
  const dist = findDistributeur(distId);
  if (!dist) return;
  const XLSX = await loadXLSX();

  const assortment = assortmentOf(distId);
  const assortSet = new Set(assortment);

  // Source de vérité : uniquement les vraies ventes importées
  const ventes = getImportedVentesByDistrib(distId);
  const hasData = hasImportedDataFor(distId);
  const lastWeek = lastImportedWeek(ventes);

  // Matrices pré-calculées (qté + CA par produit et année)
  const qtyN = buildQtyMatrix(ventes, CURRENT_YEAR, assortment);
  const qtyN1 = buildQtyMatrix(ventes, PREV_YEAR, assortment);
  const caN = buildCaMatrix(ventes, CURRENT_YEAR, assortment);
  const caN1 = buildCaMatrix(ventes, PREV_YEAR, assortment);

  const wb = XLSX.utils.book_new();

  // Ordre de lecture pensé pour la direction :
  // SYNTHÈSE en premier (le « bandeau » que les directeurs ouvrent),
  // TAB VENTES (le cœur), puis détail hebdo, puis catalogue.
  XLSX.utils.book_append_sheet(
    wb,
    buildSyntheseSheet(XLSX, dist.nom, assortment, qtyN, qtyN1, caN, caN1, hasData, lastWeek),
    'SYNTHÈSE',
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildTabVentesSheet(XLSX, dist.nom, assortment, qtyN, qtyN1, caN, caN1, hasData, lastWeek),
    'TAB VENTES',
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildDetailHebdoSheet(XLSX, dist.nom, assortment, qtyN, qtyN1, hasData),
    'Détail hebdo',
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildBaseSheet(XLSX, assortSet),
    'base',
  );

  const filename = `Tableau des ventes ${safeFileName(dist.nom).toUpperCase()} ${CURRENT_YEAR}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Export séquentiel de tous les distributeurs (un fichier par enseigne)
export async function exportAllDistributeursXlsx(
  distIds: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < distIds.length; i++) {
    await exportDistributeurXlsx(distIds[i]);
    onProgress?.(i + 1, distIds.length);
    // Léger délai pour permettre au navigateur d'enchaîner les téléchargements
    await new Promise((r) => setTimeout(r, 350));
  }
}

// Dernière semaine disponible dans la table de référence (sert au titre du fichier)
export function lastWeekAvailable(): { annee: number; semaine: number } {
  return WEEKS[WEEKS.length - 1];
}
