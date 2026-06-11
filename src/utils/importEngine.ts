// Moteur d'import générique, piloté par FORMAT — version robuste.
//
// Robustesse (corrige le bug des semaines suivantes) :
//   - colonnes repérées par NOM d'en-tête, jamais par position fixe
//     (les exports varient : S4 King Jouet a 15 colonnes au lieu de 13)
//   - valorisation par EAN propre, sinon par Référence Fournisseur
//     (certains fichiers exportent l'EAN en notation scientifique → illisible)
//   - clé canonique = EAN du catalogue, pour que la même réf déposée sur
//     plusieurs semaines/formats fusionne correctement
//
// Pipeline : fichier brut → parse → agrège qté NETTE par produit →
// valorise (CA = qté × prix grille) → lignes de vente.

import { findProduit, PRODUITS } from '../data';

export interface ImportFormatDef {
  id: string;
  label: string;
  kind: 'csv' | 'xlsx';
  encoding?: 'utf-8' | 'utf-16le' | 'windows-1252';
  delimiter?: string;
  // Noms d'en-tête possibles pour chaque champ logique (1er trouvé = utilisé)
  headers: {
    ean: string[];
    qty: string[];
    stock?: string[];
    ref?: string[];   // référence fournisseur (fallback de valorisation)
  };
  detect: RegExp;
  defaultDistributeurId?: string;
}

export const FORMATS: ImportFormatDef[] = [
  {
    id: 'jol-utf16',
    label: 'King Jouet — Stats Fournisseur (JOL)',
    kind: 'csv',
    encoding: 'utf-16le',
    delimiter: '\t',
    headers: {
      ean: ['Code EAN'],
      qty: ['Quantité'],
      stock: ['Stock'],
      ref: ['Référence Fournisseur'],
    },
    detect: /fournisseur_ventes_jol|_jol_|jol_stocks/i,
    defaultDistributeurId: 'kingjouet',
  },
  {
    id: 'joueclub-csv',
    label: 'JouéClub — Stats hebdo',
    kind: 'csv',
    encoding: 'windows-1252',
    delimiter: ';',
    headers: {
      ean: ['EAN_CD'],
      qty: ['VTES_QT_N'],
      stock: ['STK_DAT_QT'],
      ref: ['FOUR_CD'],
    },
    detect: /joueclub|groupejoueclub/i,
    defaultDistributeurId: 'joueclub',
  },
];

export interface AggregatedRow {
  ean: string;
  libelle: string;
  qteVendue: number;
  qteStock: number;
  caTTC: number;
  inCatalog: boolean;
}

export interface ParseResult {
  rows: AggregatedRow[];
  totalQte: number;
  totalCa: number;
  refsCount: number;
  unpricedRefs: number;
  unpricedQte: number;
  detectedAnnee?: number;
  detectedSemaine?: number;
  warnings: string[];
}

// ---- Lookups catalogue (EAN normalisé + Référence Fournisseur) ----
function normEan(e: string): string {
  return String(e).trim().replace(/^0+/, '') || '0';
}
function normRef(r: string): string {
  return String(r).trim().toUpperCase().replace(/^0+/, '') || '0';
}
const BY_REF = new Map(PRODUITS.filter((p) => p.refFournisseur).map((p) => [normRef(p.refFournisseur), p]));
function findByRef(ref: string) {
  return BY_REF.get(normRef(ref));
}

function looksLikeEan(s: string): boolean {
  const t = String(s).trim();
  return /^\d{8,14}$/.test(t); // exclut la notation scientifique « 7,64E+12 »
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

// Détection du numéro de semaine depuis le nom de fichier.
// Pièges réels gérés :
//  - le libellé natif King Jouet « SemS-1 » signifie « semaine S-1 » (relative),
//    PAS « semaine 1 » → on le retire avant toute détection ;
//  - « hebdo_2026-03_SILVERLIT » (JouéClub) : 03 est un numéro de MOIS, jamais
//    une semaine → aucun pattern ne doit le matcher ;
//  - suffixes de copie « 38 (2).txt » → 38.
function clampWeek(s: string): number | undefined {
  const n = parseInt(s, 10);
  return n >= 1 && n <= 53 ? n : undefined;
}

export function detectWeek(fileName: string): number | undefined {
  const base = fileName.replace(/\.(csv|tsv|txt|xlsx|xlsm|xls)$/i, '').replace(/sems-1\b/gi, ' ').trim();
  // 1. « SEMAINE 27 » explicite (convention de nommage interne)
  let m = base.match(/semaine\s*(\d{1,2})/i);
  if (m) return clampWeek(m[1]);
  // 2. « SemS-41 » / « Sem 41 » (numéro DANS le libellé semaine, S-1 déjà exclu)
  m = base.match(/sem\s*s?-?\s*(\d{1,2})\b/i);
  if (m) return clampWeek(m[1]);
  // 3. « s42 » isolé
  m = base.match(/(?:^|[\s_-])s(\d{1,2})(?:\s*\(\d+\))?$/i);
  if (m) return clampWeek(m[1]);
  // 4. nombre isolé en fin de nom : « … 27 », « … 38 (2) »
  m = base.match(/(?:^|[\s_-])(\d{1,2})(?:\s*\(\d+\))?$/);
  if (m) return clampWeek(m[1]);
  return undefined;
}

// Détection de l'année depuis le nom de fichier (« hebdo_2026-01 », « ANNEE 2025 »…).
export function detectYear(fileName: string): number | undefined {
  // Frontières numériques plutôt que \b : « hebdo_2026-03 » doit matcher
  // (underscore = caractère de mot), « H202616 » ne doit pas.
  const m = fileName.match(/(?<!\d)(20\d{2})(?!\d)/);
  if (!m) return undefined;
  const y = parseInt(m[1], 10);
  return y >= 2020 && y <= 2035 ? y : undefined;
}

// ---- Lecture brute selon le format ----
async function readRows(file: File, fmt: ImportFormatDef): Promise<string[][]> {
  if (fmt.kind === 'xlsx') {
    const XLSX = (await import('xlsx')) as unknown as {
      read: (d: ArrayBuffer, o: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
      utils: { sheet_to_json: (ws: unknown, o: { header: number; raw: boolean; defval: string }) => string[][] };
    };
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  }
  const buf = await file.arrayBuffer();
  const text = new TextDecoder(fmt.encoding ?? 'utf-8').decode(buf);
  const delim = fmt.delimiter ?? ';';
  return text.split(/\r?\n/).filter((l) => l.length > 0).map((l) => l.split(delim));
}

// Trouve l'index de colonne par nom d'en-tête (insensible casse/espaces)
function colIndex(header: string[], names: string[]): number {
  const norm = header.map((h) => String(h ?? '').trim().toLowerCase());
  for (const name of names) {
    const i = norm.indexOf(name.trim().toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

export async function parseAndValorize(file: File, formatId: string): Promise<ParseResult> {
  const fmt = getFormat(formatId);
  if (!fmt) throw new Error(`Format inconnu : ${formatId}`);

  const rows = await readRows(file, fmt);
  if (rows.length < 2) throw new Error('Fichier vide ou sans données.');

  const header = rows[0];
  const iEan = colIndex(header, fmt.headers.ean);
  const iQty = colIndex(header, fmt.headers.qty);
  const iStock = fmt.headers.stock ? colIndex(header, fmt.headers.stock) : -1;
  const iRef = fmt.headers.ref ? colIndex(header, fmt.headers.ref) : -1;

  const warnings: string[] = [];
  if (iQty < 0) throw new Error(`Colonne quantité introuvable (attendu : ${fmt.headers.qty.join(' / ')}).`);
  if (iEan < 0 && iRef < 0) throw new Error('Ni colonne EAN ni Référence trouvées — format non reconnu.');

  // Agrégation par produit canonique
  const agg = new Map<string, { ean: string; libelle: string; qte: number; stock: number; tarif: number; inCatalog: boolean }>();
  for (const r of rows.slice(1)) {
    if (iQty >= r.length) continue;
    const qte = toNum(r[iQty]);
    const rawEan = iEan >= 0 && iEan < r.length ? String(r[iEan]).trim() : '';
    const rawRef = iRef >= 0 && iRef < r.length ? String(r[iRef]).trim() : '';

    // Résolution produit : EAN propre prioritaire, sinon Référence Fournisseur
    let prod = looksLikeEan(rawEan) ? findProduit(rawEan) : undefined;
    if (!prod && rawRef) prod = findByRef(rawRef);

    // Clé canonique : EAN catalogue si trouvé, sinon EAN propre, sinon réf
    const key = prod ? prod.ean : looksLikeEan(rawEan) ? normEan(rawEan) : rawRef ? `REF:${normRef(rawRef)}` : '';
    if (!key) continue;

    const cur = agg.get(key) ?? {
      ean: prod?.ean ?? (looksLikeEan(rawEan) ? rawEan : rawRef),
      libelle: prod?.libelle ?? `Réf ${rawRef || rawEan} (hors grille)`,
      qte: 0,
      stock: 0,
      tarif: prod?.prixConseille ?? 0,
      inCatalog: !!prod && (prod.prixConseille ?? 0) > 0,
    };
    cur.qte += qte;
    if (iStock >= 0 && iStock < r.length) cur.stock += toNum(r[iStock]);
    agg.set(key, cur);
  }

  const out: AggregatedRow[] = [];
  let totalQte = 0, totalCa = 0, unpricedRefs = 0, unpricedQte = 0;
  for (const v of agg.values()) {
    if (Math.abs(v.qte) < 0.0001) continue;
    const qte = Math.round(v.qte);
    const ca = Math.round(qte * v.tarif * 100) / 100;
    if (!v.inCatalog) { unpricedRefs += 1; unpricedQte += qte; }
    out.push({ ean: v.ean, libelle: v.libelle, qteVendue: qte, qteStock: Math.round(v.stock), caTTC: ca, inCatalog: v.inCatalog });
    totalQte += qte;
    totalCa += ca;
  }
  out.sort((a, b) => b.caTTC - a.caTTC);

  if (unpricedRefs > 0) {
    warnings.push(`${unpricedRefs} référence(s) absente(s) de la grille de prix (${Math.round(unpricedQte)} u. non valorisées).`);
  }

  return {
    rows: out,
    totalQte,
    totalCa: Math.round(totalCa * 100) / 100,
    refsCount: out.length,
    unpricedRefs,
    unpricedQte: Math.round(unpricedQte),
    detectedAnnee: detectYear(file.name) ?? new Date().getFullYear(),
    detectedSemaine: detectWeek(file.name),
    warnings,
  };
}
