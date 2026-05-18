// Export Excel par distributeur — reproduit la structure des « Tableaux des
// ventes » internes Silverlit, à partir des ventes effectivement importées
// dans la plateforme.
//
// Onglets générés :
//   - base       : catalogue (marque, réf, EAN, désignation, tarif, statut)
//   - 2025       : pivot quantités vendues par réf × semaine (52)
//   - 2026       : idem année courante
//   - TAB VENTES : vue par produit avec totaux N, N-1 et évolution %
//   - Livré      : placeholder (sell-in non disponible dans l'app)
//
// `xlsx` (SheetJS) est chargé en import dynamique pour ne pas alourdir le
// bundle principal — la lib n'est téléchargée qu'à la première export.

import {
  VENTES, PRODUITS, WEEKS, findDistributeur, assortmentOf, findProduit,
} from '../data';

const CURRENT_YEAR = 2026;
const PREV_YEAR = CURRENT_YEAR - 1;
const NB_WEEKS = 52;

// Nettoie un nom de distributeur pour en faire un nom de fichier valide
function safeFileName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Construit la matrice quantités vendues : ean → [qty_S1, …, qty_S52]
function buildQtyMatrix(distId: string, annee: number, eans: string[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const ean of eans) m.set(ean, new Array(NB_WEEKS).fill(0));
  for (const v of VENTES) {
    if (v.distributeurId !== distId || v.annee !== annee) continue;
    const arr = m.get(v.ean);
    if (!arr) continue;
    const idx = v.semaine - 1;
    if (idx >= 0 && idx < NB_WEEKS) arr[idx] += v.qteVendue;
  }
  return m;
}

// Idem pour le CA TTC
function buildCaMatrix(distId: string, annee: number, eans: string[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const ean of eans) m.set(ean, new Array(NB_WEEKS).fill(0));
  for (const v of VENTES) {
    if (v.distributeurId !== distId || v.annee !== annee) continue;
    const arr = m.get(v.ean);
    if (!arr) continue;
    const idx = v.semaine - 1;
    if (idx >= 0 && idx < NB_WEEKS) arr[idx] += v.caTTC;
  }
  return m;
}

interface SheetJSModule {
  utils: {
    book_new(): unknown;
    aoa_to_sheet(rows: unknown[][]): unknown;
    book_append_sheet(wb: unknown, ws: unknown, name: string): void;
    decode_range(r: string): { s: { c: number; r: number }; e: { c: number; r: number } };
    encode_cell(addr: { c: number; r: number }): string;
  };
  writeFile(wb: unknown, filename: string): void;
}

async function loadXLSX(): Promise<SheetJSModule> {
  const mod = await import('xlsx');
  // L'import xlsx expose ses fonctions directement sur le namespace
  return mod as unknown as SheetJSModule;
}

// =======================================================================
//   Onglets
// =======================================================================

function buildBaseSheet(XLSX: SheetJSModule, assortment: Set<string>): unknown {
  const header = ['MARQUE', '', 'ORDRE', 'Réf.', 'EAN', 'DESIGNATION', 'TARIF 2026', 'STATUT'];
  const rows: unknown[][] = [header];
  PRODUITS.forEach((p, i) => {
    const statut =
      p.statut === 'actif' ? 'reconduit' : p.statut === 'fin_de_vie' ? 'non reconduit' : 'retiré';
    // On marque les références hors assortiment d'une note (utile pour Silverlit
    // de voir le catalogue total + ce que l'enseigne référence)
    const inAssort = assortment.has(p.ean);
    rows.push([
      p.marque, '', i + 1, p.refFournisseur, p.ean, p.libelle,
      p.prixConseille, statut, inAssort ? 'référencé' : '',
    ]);
  });
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildPivotSheet(
  XLSX: SheetJSModule, distId: string, assortment: string[], annee: number,
): unknown {
  const qty = buildQtyMatrix(distId, annee, assortment);
  const header = ['', '', ...Array.from({ length: NB_WEEKS }, (_, i) => i + 1), 'TOTAL'];
  const rows: unknown[][] = [header];
  for (const ean of assortment) {
    const p = findProduit(ean);
    const week = qty.get(ean) ?? [];
    const total = week.reduce((s, x) => s + x, 0);
    rows.push([p?.refFournisseur ?? ean, '', ...week, total]);
  }
  // Ligne TOTAL en bas
  const colSums = new Array(NB_WEEKS).fill(0);
  qty.forEach((arr) => arr.forEach((q, i) => (colSums[i] += q)));
  rows.push(['TOTAL', '', ...colSums, colSums.reduce((s, x) => s + x, 0)]);
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildTabVentesSheet(
  XLSX: SheetJSModule, distId: string, assortment: string[],
): unknown {
  const dist = findDistributeur(distId)!;
  const qtyN = buildQtyMatrix(distId, CURRENT_YEAR, assortment);
  const qtyN1 = buildQtyMatrix(distId, PREV_YEAR, assortment);
  const caN = buildCaMatrix(distId, CURRENT_YEAR, assortment);

  // Lignes d'en-tête
  const titleRow = [`TABLEAU DES VENTES — ${dist.nom.toUpperCase()}`];
  const metaRow = [
    `Année : ${CURRENT_YEAR}`, '', '', '',
    `Comparatif : N-1 (${PREV_YEAR})`,
  ];
  const labelRow = [
    '#', 'Marque', 'Réf.', 'EAN', 'Désignation', 'Statut',
    ...Array.from({ length: NB_WEEKS }, (_, i) => `S${i + 1}`),
    `Total ${CURRENT_YEAR}`,
    `Total ${PREV_YEAR}`,
    'Évolution %',
    `CA TTC ${CURRENT_YEAR} (€)`,
  ];

  const rows: unknown[][] = [titleRow, metaRow, [], labelRow];

  assortment.forEach((ean, idx) => {
    const p = findProduit(ean);
    if (!p) return;
    const weeks = qtyN.get(ean) ?? new Array(NB_WEEKS).fill(0);
    const totalN = weeks.reduce((s, x) => s + x, 0);
    const totalN1 = (qtyN1.get(ean) ?? []).reduce((s, x) => s + x, 0);
    const evol = totalN1 > 0 ? ((totalN - totalN1) / totalN1) * 100 : totalN > 0 ? 100 : 0;
    const caTotal = (caN.get(ean) ?? []).reduce((s, x) => s + x, 0);
    const statut =
      p.statut === 'actif' ? 'reconduit' : p.statut === 'fin_de_vie' ? 'non reconduit' : 'retiré';
    rows.push([
      idx + 1, p.marque, p.refFournisseur, p.ean, p.libelle, statut,
      ...weeks,
      totalN, totalN1,
      Number(evol.toFixed(1)),
      Number(caTotal.toFixed(2)),
    ]);
  });

  // Ligne de total
  const totalsN = new Array(NB_WEEKS).fill(0);
  qtyN.forEach((arr) => arr.forEach((q, i) => (totalsN[i] += q)));
  const grandN = totalsN.reduce((s, x) => s + x, 0);
  const grandN1 = Array.from(qtyN1.values()).reduce(
    (s, arr) => s + arr.reduce((a, b) => a + b, 0), 0,
  );
  const grandCa = Array.from(caN.values()).reduce(
    (s, arr) => s + arr.reduce((a, b) => a + b, 0), 0,
  );
  const evolGlobal = grandN1 > 0 ? ((grandN - grandN1) / grandN1) * 100 : 0;
  rows.push([
    '', '', '', '', 'TOTAL', '',
    ...totalsN, grandN, grandN1,
    Number(evolGlobal.toFixed(1)),
    Number(grandCa.toFixed(2)),
  ]);

  return XLSX.utils.aoa_to_sheet(rows);
}

function buildLivreSheet(XLSX: SheetJSModule, assortment: string[]): unknown {
  // L'app n'a pas les données de livraisons (sell-in) — onglet placeholder
  // pour préserver la structure du fichier Silverlit.
  const header = ['REF', ...Array.from({ length: NB_WEEKS }, (_, i) => `S${i + 1}`), 'TOTAL'];
  const rows: unknown[][] = [
    [
      'Onglet non rempli : la plateforme n\'importe que le sell-out (ventes consommateur).',
    ],
    ['Pour le sell-in (livraisons Silverlit → enseigne), brancher la source ERP.'],
    [],
    header,
  ];
  for (const ean of assortment) {
    const p = findProduit(ean);
    rows.push([p?.refFournisseur ?? ean, ...new Array(NB_WEEKS).fill(0), 0]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

// =======================================================================
//   Export
// =======================================================================

export async function exportDistributeurXlsx(distId: string): Promise<void> {
  const dist = findDistributeur(distId);
  if (!dist) return;
  const XLSX = await loadXLSX();

  const assortment = assortmentOf(distId);
  const assortSet = new Set(assortment);

  const wb = XLSX.utils.book_new();
  // Ordre des onglets identique au fichier source Silverlit
  XLSX.utils.book_append_sheet(wb, buildPivotSheet(XLSX, distId, assortment, PREV_YEAR), String(PREV_YEAR));
  XLSX.utils.book_append_sheet(wb, buildPivotSheet(XLSX, distId, assortment, CURRENT_YEAR), String(CURRENT_YEAR));
  XLSX.utils.book_append_sheet(wb, buildBaseSheet(XLSX, assortSet), 'base');
  XLSX.utils.book_append_sheet(wb, buildTabVentesSheet(XLSX, distId, assortment), 'TAB VENTES');
  XLSX.utils.book_append_sheet(wb, buildLivreSheet(XLSX, assortment), 'Livré');

  const filename = `Tableau des ventes ${safeFileName(dist.nom).toUpperCase()} ${CURRENT_YEAR}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Export séquentiel de tous les distributeurs (un fichier par enseigne)
export async function exportAllDistributeursXlsx(
  distIds: string[], onProgress?: (done: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < distIds.length; i++) {
    await exportDistributeurXlsx(distIds[i]);
    onProgress?.(i + 1, distIds.length);
    // Léger délai pour permettre au navigateur d'enchaîner les téléchargements
    await new Promise((r) => setTimeout(r, 350));
  }
}

// Estime la dernière semaine disponible (utile pour le titre du fichier)
export function lastWeekAvailable(): { annee: number; semaine: number } {
  return WEEKS[WEEKS.length - 1];
}
