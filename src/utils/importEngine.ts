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

function detectWeek(fileName: string): number | undefined {
  const m = fileName.match(/semaine\s*(\d{1,2})/i) || fileName.match(/[_-](\d{1,2})[_-]SILVERLIT/i);
  return m ? parseInt(m[1], 10) : undefined;
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
    detectedAnnee: 2026,
    detectedSemaine: detectWeek(file.name),
    warnings,
  };
}
