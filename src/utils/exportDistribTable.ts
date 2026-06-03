// Export Excel au format « Tableau des Ventes » Silverlit.
//
// Reproduit la structure du fichier de référence (TB Vierge) :
//   - détail à la référence, organisé par MARQUE (gamme), trié CA décroissant
//   - 4 blocs par marque : QTES N-1, QTES N, CA N-1, CA N (colonnes S1→S52)
//   - une ligne TOTAL par bloc (sous-total marque)
//   - bloc final TOUTES GAMMES (totaux généraux)
//
// Données : lots importés (VENTES). CA = quantité × prix grille (PVC).
// N = année la plus récente présente ; N-1 = année précédente.

import {
  VENTES, findProduit, findDistributeur, DISTRIBUTEURS,
} from '../data';
import type { Vente } from '../types';

const NB_WEEKS = 52;

interface SheetJSModule {
  utils: {
    book_new(): unknown;
    aoa_to_sheet(rows: unknown[][]): unknown;
    book_append_sheet(wb: unknown, ws: unknown, name: string): void;
  };
  writeFile(wb: unknown, filename: string): void;
}
async function loadXLSX(): Promise<SheetJSModule> {
  return (await import('xlsx')) as unknown as SheetJSModule;
}

function safeFileName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim();
}

// Ordre des marques calqué sur le fichier de référence Silverlit
const BRAND_ORDER = [
  'EXOST', 'EXOST PRO', 'EXOST JUMP', 'EXOST LOOP', 'EXOST SMASH', '4SPEED',
  'FLYBOTIC', 'YCOO', 'BOXING WARRIORS', 'MONSTER FLEX', 'HERO BUILDER',
  'TOOKO', 'ROBOCAR POLI', 'DIGIBIRDS', 'WINKSIES', 'SPIROGRAPH', 'WATER ART',
  "IMAGIN'ART", 'POUR PALZ', 'MONTRES LICENCE', 'ALIEN VISION', 'KIMMON',
  'EGG A BOO', 'RYTHM MASTER', 'TETES BRULEES', 'FIDGET POP', 'APRES-SKI',
  'BOUTIQUE GARDEN', 'OUAPS', 'LAZER MAD', 'SPINNER MAD', 'HELLO MAESTRO',
  'CURLIGIRLS', 'ASTROPOD', 'MONCHHICHI', 'SLIME', 'CAPTAIN BRAIN',
  'DISSECT-IT', 'RESCUE PENGUIN', 'HYDRO MAD', 'TINY FURRIES', 'SILVERLIT',
];
function brandRank(m: string): number {
  const i = BRAND_ORDER.indexOf(m);
  return i < 0 ? BRAND_ORDER.length + 1 : i;
}

interface Mat { qte: number[]; ca: number[]; }
function emptyMat(): Mat { return { qte: new Array(NB_WEEKS).fill(0), ca: new Array(NB_WEEKS).fill(0) }; }

// Matrices par EAN pour une année : qté + CA hebdomadaires
function buildMatrices(ventes: Vente[], annee: number): Map<string, Mat> {
  const m = new Map<string, Mat>();
  for (const v of ventes) {
    if (v.annee !== annee) continue;
    const idx = v.semaine - 1;
    if (idx < 0 || idx >= NB_WEEKS) continue;
    const cur = m.get(v.ean) ?? emptyMat();
    cur.qte[idx] += v.qteVendue;
    cur.ca[idx] += v.caTTC;
    m.set(v.ean, cur);
  }
  return m;
}
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

const WEEK_HEADERS = Array.from({ length: NB_WEEKS }, (_, i) => `S${i + 1}`);

// Construit une feuille « Tableau des ventes » pour un jeu de ventes donné
function buildSheet(XLSX: SheetJSModule, titre: string, ventes: Vente[]): unknown {
  const years = Array.from(new Set(ventes.map((v) => v.annee))).sort((a, b) => b - a);
  const N = years[0] ?? new Date().getFullYear();
  const N1 = N - 1;
  const matN = buildMatrices(ventes, N);
  const matN1 = buildMatrices(ventes, N1);

  // Ensemble des EAN concernés, groupés par marque
  const eans = new Set<string>([...matN.keys(), ...matN1.keys()]);
  const byMarque = new Map<string, string[]>();
  for (const ean of eans) {
    const p = findProduit(ean);
    const marque = p?.marque ?? 'AUTRES';
    const arr = byMarque.get(marque) ?? [];
    arr.push(ean);
    byMarque.set(marque, arr);
  }
  const marques = Array.from(byMarque.keys()).sort((a, b) => brandRank(a) - brandRank(b) || a.localeCompare(b));

  const lastWeek = Math.max(0, ...ventes.filter((v) => v.annee === N).map((v) => v.semaine));
  const rows: unknown[][] = [];
  rows.push([`TABLEAU DES VENTES — ${titre}`]);
  rows.push(['Valorisation : grille de prix (PVC)', '', 'SEMAINE', lastWeek, '', '', `N = ${N}`, `N-1 = ${N1}`]);
  rows.push([]);

  type BlockKind = 'QTES N-1' | 'QTES N' | 'CA N-1' | 'CA N';
  const blockMeta: Array<{ kind: BlockKind; mat: Map<string, Mat>; field: 'qte' | 'ca'; year: number; totalLabel: string }> = [
    { kind: 'QTES N-1', mat: matN1, field: 'qte', year: N1, totalLabel: 'TOTAL QUANTITES N-1' },
    { kind: 'QTES N', mat: matN, field: 'qte', year: N, totalLabel: 'TOTAL QUANTITES N' },
    { kind: 'CA N-1', mat: matN1, field: 'ca', year: N1, totalLabel: 'TOTAL VALEUR N-1' },
    { kind: 'CA N', mat: matN, field: 'ca', year: N, totalLabel: 'TOTAL VALEUR N' },
  ];

  // Totaux généraux (toutes gammes), accumulés par bloc
  const grand: Record<BlockKind, number[]> = {
    'QTES N-1': new Array(NB_WEEKS).fill(0), 'QTES N': new Array(NB_WEEKS).fill(0),
    'CA N-1': new Array(NB_WEEKS).fill(0), 'CA N': new Array(NB_WEEKS).fill(0),
  };

  function emitBlock(marque: string, eanList: string[], meta: typeof blockMeta[number], rounder: (x: number) => number) {
    // En-tête de bloc
    rows.push([meta.year, '', marque, meta.kind, '', '', ...WEEK_HEADERS, 'YTD', 'ANNEE']);
    rows.push(['#', 'Catégorie', 'Réf.', 'EAN', 'Désignation', '', ...new Array(NB_WEEKS).fill(''), '', '']);
    const blockTotal = new Array(NB_WEEKS).fill(0);
    eanList.forEach((ean, i) => {
      const p = findProduit(ean);
      const series = (meta.mat.get(ean) ?? emptyMat())[meta.field];
      for (let w = 0; w < NB_WEEKS; w++) blockTotal[w] += series[w];
      const cells = series.map(rounder);
      const tot = rounder(sum(series));
      rows.push([
        i + 1, p?.categorie ?? '', p?.refFournisseur ?? '', ean, p?.libelle ?? '', '',
        ...cells, tot, tot,
      ]);
    });
    const tot = rounder(sum(blockTotal));
    rows.push(['', '', '', '', meta.totalLabel, '', ...blockTotal.map(rounder), tot, tot]);
    rows.push([]);
    for (let w = 0; w < NB_WEEKS; w++) grand[meta.kind][w] += blockTotal[w];
  }

  for (const marque of marques) {
    // Tri des réfs de la marque par CA N décroissant
    const eanList = (byMarque.get(marque) ?? []).slice().sort((a, b) =>
      sum((matN.get(b) ?? emptyMat()).ca) - sum((matN.get(a) ?? emptyMat()).ca));
    for (const meta of blockMeta) {
      const rounder = meta.field === 'ca' ? (x: number) => Math.round(x * 100) / 100 : (x: number) => Math.round(x);
      emitBlock(marque, eanList, meta, rounder);
    }
  }

  // Bloc TOUTES GAMMES (totaux généraux)
  for (const meta of blockMeta) {
    const rounder = meta.field === 'ca' ? (x: number) => Math.round(x * 100) / 100 : (x: number) => Math.round(x);
    const series = grand[meta.kind];
    rows.push([meta.year, '', 'TOUTES GAMMES', meta.kind, '', '', ...WEEK_HEADERS, 'YTD', 'ANNEE']);
    const tot = rounder(sum(series));
    rows.push(['', '', '', '', meta.totalLabel, '', ...series.map(rounder), tot, tot]);
    rows.push([]);
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

export async function exportDistributeurXlsx(distId: string): Promise<void> {
  const dist = findDistributeur(distId);
  if (!dist) return;
  const XLSX = await loadXLSX();
  const ventes = VENTES.filter((v) => v.distributeurId === distId);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, dist.nom.toUpperCase(), ventes), 'TAB VENTES');
  XLSX.writeFile(wb, `Tableau des ventes ${safeFileName(dist.nom).toUpperCase()} ${new Date().getFullYear()}.xlsx`);
}

// Export global : tous distributeurs consolidés
export async function exportGlobalXlsx(): Promise<void> {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, 'TOUS DISTRIBUTEURS', VENTES.slice()), 'TAB VENTES');
  XLSX.writeFile(wb, `Tableau des ventes GLOBAL ${new Date().getFullYear()}.xlsx`);
}

// Export séquentiel : un fichier par distributeur
export async function exportAllDistributeursXlsx(
  distIds: string[], onProgress?: (done: number, total: number) => void,
): Promise<void> {
  // on n'exporte que les distributeurs qui ont des données
  const withData = distIds.filter((id) => VENTES.some((v) => v.distributeurId === id));
  for (let i = 0; i < withData.length; i++) {
    await exportDistributeurXlsx(withData[i]);
    onProgress?.(i + 1, withData.length);
    await new Promise((r) => setTimeout(r, 350));
  }
}

export function distributeursAvecDonnees(): string[] {
  return DISTRIBUTEURS.filter((d) => VENTES.some((v) => v.distributeurId === d.id)).map((d) => d.id);
}
