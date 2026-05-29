// Moteur d'import générique, piloté par FORMAT.
//
// Pipeline : fichier brut → parse (encodage/séparateur du format) → agrège les
// quantités NETTES par EAN → valorise (CA = qté × prix grille) → lignes de vente.
//
// Ajouter un distributeur au même format = aucune ligne de code : il suffit de
// déposer son fichier et choisir le format. Ajouter un NOUVEAU format = une
// entrée dans FORMATS ci-dessous.

import { findProduit } from '../data';

export interface ImportFormatDef {
  id: string;
  label: string;
  kind: 'csv' | 'xlsx';
  encoding?: 'utf-8' | 'utf-16le' | 'windows-1252';
  delimiter?: string;          // pour csv
  hasHeader: boolean;
  // Index de colonnes (0-based) pour csv, ou index colonne xlsx
  col: { ean: number; qty: number; stock?: number };
  // Pour xlsx : ligne d'en-tête (1-based) et 1ère ligne de données
  xlsxHeaderRow?: number;
  xlsxDataStartRow?: number;
  // Détection automatique par nom de fichier
  detect: RegExp;
  // Distributeur par défaut suggéré
  defaultDistributeurId?: string;
}

export const FORMATS: ImportFormatDef[] = [
  {
    id: 'jol-utf16',
    label: 'King Jouet — Stats Fournisseur (JOL)',
    kind: 'csv',
    encoding: 'utf-16le',
    delimiter: '\t',
    hasHeader: true,
    col: { ean: 4, qty: 9, stock: 8 },
    detect: /fournisseur_ventes_jol|_jol_|jol_stocks/i,
    defaultDistributeurId: 'kingjouet',
  },
  {
    id: 'joueclub-csv',
    label: 'JouéClub — Stats hebdo',
    kind: 'csv',
    encoding: 'windows-1252',
    delimiter: ';',
    hasHeader: true,
    col: { ean: 9, qty: 14, stock: 13 },
    detect: /joueclub|groupejoueclub/i,
    defaultDistributeurId: 'joueclub',
  },
];

export interface AggregatedRow {
  ean: string;
  libelle: string;
  qteVendue: number;   // net (ventes − retours)
  qteStock: number;
  caTTC: number;       // qté × prix grille
  inCatalog: boolean;  // false = EAN absent de la grille de prix
}

export interface ParseResult {
  rows: AggregatedRow[];
  totalQte: number;
  totalCa: number;
  refsCount: number;
  unpricedRefs: number;     // réfs vendues sans prix grille
  unpricedQte: number;      // quantités concernées
  detectedAnnee?: number;
  detectedSemaine?: number;
}

// EAN normalisé (tolérant aux zéros initiaux)
function normEan(e: string): string {
  return String(e).trim().replace(/^0+/, '') || '0';
}

function toNum(s: string): number {
  const v = parseFloat(String(s ?? '').replace(',', '.').trim());
  return isFinite(v) ? v : 0;
}

export function detectFormat(fileName: string): ImportFormatDef | undefined {
  return FORMATS.find((f) => f.detect.test(fileName));
}

export function getFormat(id: string): ImportFormatDef | undefined {
  return FORMATS.find((f) => f.id === id);
}

// Détecte la semaine depuis le nom de fichier (« SEMAINE 3 », « -03 »…)
function detectWeek(fileName: string): number | undefined {
  const m = fileName.match(/semaine\s*(\d{1,2})/i) || fileName.match(/[_-](\d{1,2})[_-]SILVERLIT/i);
  if (m) return parseInt(m[1], 10);
  return undefined;
}

// ---- Lecture du fichier selon le format ----
async function readRows(file: File, fmt: ImportFormatDef): Promise<string[][]> {
  if (fmt.kind === 'xlsx') {
    const XLSX = (await import('xlsx')) as unknown as {
      read: (data: ArrayBuffer, opts: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
      utils: { sheet_to_json: (ws: unknown, opts: { header: number; raw: boolean; defval: string }) => string[][] };
    };
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  }
  // CSV : décodage selon l'encodage déclaré
  const buf = await file.arrayBuffer();
  const decoder = new TextDecoder(fmt.encoding ?? 'utf-8');
  const text = decoder.decode(buf);
  const delim = fmt.delimiter ?? ';';
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(delim));
}

// ---- Parse + agrège + valorise ----
export async function parseAndValorize(file: File, formatId: string): Promise<ParseResult> {
  const fmt = getFormat(formatId);
  if (!fmt) throw new Error(`Format inconnu : ${formatId}`);

  const rows = await readRows(file, fmt);
  const dataRows = fmt.hasHeader ? rows.slice(fmt.xlsxDataStartRow ? fmt.xlsxDataStartRow - 1 : 1) : rows;

  // Agrégation nette par EAN
  const agg = new Map<string, { ean: string; qte: number; stock: number }>();
  for (const r of dataRows) {
    const rawEan = r[fmt.col.ean];
    if (rawEan === undefined || String(rawEan).trim() === '') continue;
    const key = normEan(String(rawEan));
    const qte = toNum(r[fmt.col.qty]);
    const stock = fmt.col.stock !== undefined ? toNum(r[fmt.col.stock]) : 0;
    const cur = agg.get(key) ?? { ean: String(rawEan).trim(), qte: 0, stock: 0 };
    cur.qte += qte;
    cur.stock += stock;
    agg.set(key, cur);
  }

  // Valorisation via la grille (findProduit → prixConseille)
  const out: AggregatedRow[] = [];
  let totalQte = 0;
  let totalCa = 0;
  let unpricedRefs = 0;
  let unpricedQte = 0;
  for (const { ean, qte, stock } of agg.values()) {
    if (Math.abs(qte) < 0.0001) continue; // ignore les réfs à solde net nul
    const p = findProduit(ean);
    const tarif = p?.prixConseille ?? 0;
    const ca = Math.round(qte * tarif * 100) / 100;
    const inCatalog = !!p && tarif > 0;
    if (!inCatalog) {
      unpricedRefs += 1;
      unpricedQte += qte;
    }
    out.push({
      ean,
      libelle: p?.libelle ?? `EAN ${ean} (hors grille)`,
      qteVendue: Math.round(qte),
      qteStock: Math.round(stock),
      caTTC: ca,
      inCatalog,
    });
    totalQte += Math.round(qte);
    totalCa += ca;
  }
  out.sort((a, b) => b.caTTC - a.caTTC);

  return {
    rows: out,
    totalQte,
    totalCa: Math.round(totalCa * 100) / 100,
    refsCount: out.length,
    unpricedRefs,
    unpricedQte: Math.round(unpricedQte),
    detectedAnnee: 2026,
    detectedSemaine: detectWeek(file.name),
  };
}
