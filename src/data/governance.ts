// Gouvernance des sources de données par distributeur
// Config descriptive (format, canal, conventions) + statut RÉEL calculé
// depuis les lots importés (semaines reçues, qualité, problèmes).

import { getBatches } from './importBatches';
import { findProduit } from './products';

export type FormatSource = 'CSV' | 'XLSX' | 'XLSM' | 'XLS';
export type Periodicite = 'hebdo' | 'bi-hebdo' | 'mensuel';
export type CanalLivraison = 'email' | 'EDI' | 'portail' | 'sFTP' | 'API';

export interface SourceDistributeur {
  distributeurId: string;
  format: FormatSource;
  separateur?: string;
  encoding?: string;
  periodicite: Periodicite;
  canal: CanalLivraison;
  nomFichierPattern: string;          // Convention de nommage
  derniereSemaine: number;            // 1..52
  derniereDate: string;               // ISO
  semainesAttendues: number;          // YTD attendu
  semainesRecues: number;             // YTD effectivement reçu
  scoreQualite: number;               // 0..100
  problemes: string[];                // Anomalies récurrentes
  champClef: string;                  // Colonne source contenant l'EAN
  contactSilverlit: string;
  contactDistributeur?: string;
  granulariteMagasin: boolean;        // Vrai si on reçoit le détail par magasin
  inclutStock: boolean;
}

// Configuration descriptive par source (format, canal, conventions).
// Les champs de STATUT (semaines reçues, qualité, problèmes, dates) sont
// recalculés à partir des vrais lots importés — cf. computeStatus() en bas.
const SOURCES_CONFIG: SourceDistributeur[] = [
  {
    distributeurId: 'joueclub',
    format: 'CSV',
    separateur: ';',
    encoding: 'Windows-1252',
    periodicite: 'hebdo',
    canal: 'sFTP',
    nomFichierPattern: 'GroupeJoueclub_Stats_hebdo_AAAA-SS_SILVERLIT.csv',
    derniereSemaine: 18,
    derniereDate: '2026-05-10T08:42:00Z',
    semainesAttendues: 18,
    semainesRecues: 18,
    scoreQualite: 98,
    problemes: [],
    champClef: 'EAN_CD',
    contactSilverlit: 'Arthur Leroy Sahli',
    contactDistributeur: 'datasilverlit@joueclub.fr',
    granulariteMagasin: true,
    inclutStock: true,
  },
  {
    distributeurId: 'recreaclub',
    format: 'CSV',
    separateur: ';',
    encoding: 'Windows-1252',
    periodicite: 'hebdo',
    canal: 'sFTP',
    nomFichierPattern: 'Recreaclub_Stats_hebdo_AAAA-SS_SILVERLIT.csv',
    derniereSemaine: 18,
    derniereDate: '2026-05-09T07:15:00Z',
    semainesAttendues: 18,
    semainesRecues: 17,
    scoreQualite: 92,
    problemes: ['Semaine 12 manquante (incident chez l\'éditeur)'],
    champClef: 'EAN_CD',
    contactSilverlit: 'Arthur Leroy Sahli',
    granulariteMagasin: true,
    inclutStock: true,
  },
  {
    distributeurId: 'kingjouet',
    format: 'CSV',
    separateur: '\\t',
    encoding: 'UTF-16-LE BOM',
    periodicite: 'hebdo',
    canal: 'portail',
    nomFichierPattern: 'Fournisseur_Ventes_JOL_Stocks_SemS-1.csv',
    derniereSemaine: 18,
    derniereDate: '2026-05-10T09:13:00Z',
    semainesAttendues: 18,
    semainesRecues: 18,
    scoreQualite: 94,
    problemes: ['Encodage UTF-16 nécessite une conversion préalable'],
    champClef: 'Code EAN',
    contactSilverlit: 'Arthur Leroy Sahli',
    granulariteMagasin: true,
    inclutStock: true,
  },
  {
    distributeurId: 'oxybul',
    format: 'XLSX',
    encoding: 'UTF-8',
    periodicite: 'mensuel',
    canal: 'email',
    nomFichierPattern: 'Ventes___Stock_fournisseur_SILVERLIT [MOIS] AAAA.xlsx',
    derniereSemaine: 16,
    derniereDate: '2026-04-30T15:22:00Z',
    semainesAttendues: 4,
    semainesRecues: 4,
    scoreQualite: 81,
    problemes: ['Périodicité mensuelle uniquement', 'Pas de remontée par magasin'],
    champClef: 'Code EAN',
    contactSilverlit: 'Arthur Leroy Sahli',
    granulariteMagasin: false,
    inclutStock: true,
  },
  {
    distributeurId: 'fnacdarty',
    format: 'XLS',
    encoding: 'Latin-1',
    periodicite: 'hebdo',
    canal: 'portail',
    nomFichierPattern: 'SEMAINE [N] Ventes et stocks articles - total.xls',
    derniereSemaine: 17,
    derniereDate: '2026-05-03T11:00:00Z',
    semainesAttendues: 18,
    semainesRecues: 14,
    scoreQualite: 72,
    problemes: [
      'Format XLS legacy (Excel 97-2003)',
      'Plusieurs semaines fusionnées dans un même fichier',
      'Libellés produits incohérents avec le catalogue',
    ],
    champClef: 'EAN',
    contactSilverlit: 'Arthur Leroy Sahli',
    granulariteMagasin: false,
    inclutStock: true,
  },
  {
    distributeurId: 'smythstoys',
    format: 'XLSX',
    encoding: 'UTF-8',
    periodicite: 'hebdo',
    canal: 'email',
    nomFichierPattern: 'Silverlit AAAA-MM-DD-HH-MM-SS.xlsx',
    derniereSemaine: 18,
    derniereDate: '2026-05-11T08:42:59Z',
    semainesAttendues: 18,
    semainesRecues: 18,
    scoreQualite: 89,
    problemes: ['Date d\'extraction dans le nom de fichier (pas la semaine ISO)'],
    champClef: 'EAN',
    contactSilverlit: 'Arthur Leroy Sahli',
    granulariteMagasin: true,
    inclutStock: true,
  },
  {
    distributeurId: 'galec',
    format: 'XLSX',
    encoding: 'UTF-8',
    periodicite: 'bi-hebdo',
    canal: 'email',
    nomFichierPattern: 'A Exporter Suivi des Ventes Hebdomadaire CA et UVC Total E.Leclerc (N).xlsx',
    derniereSemaine: 18,
    derniereDate: '2026-05-08T16:30:00Z',
    semainesAttendues: 18,
    semainesRecues: 16,
    scoreQualite: 76,
    problemes: [
      'Semaines parfois regroupées par deux dans le même fichier',
      'Versioning manuel avec un numéro entre parenthèses',
    ],
    champClef: 'Gencod',
    contactSilverlit: 'Arthur Leroy Sahli',
    granulariteMagasin: false,
    inclutStock: false,
  },
  {
    distributeurId: 'carrefour',
    format: 'XLSM',
    encoding: 'UTF-8',
    periodicite: 'hebdo',
    canal: 'EDI',
    nomFichierPattern: 'CARREFOUR V[X]-AAAA.xlsm',
    derniereSemaine: 18,
    derniereDate: '2026-05-09T05:00:00Z',
    semainesAttendues: 18,
    semainesRecues: 18,
    scoreQualite: 91,
    problemes: ['Macros VBA actives — traitement automatique requis'],
    champClef: 'EAN',
    contactSilverlit: 'Arthur Leroy Sahli',
    granulariteMagasin: false,
    inclutStock: true,
  },
  {
    distributeurId: 'auchan',
    format: 'CSV',
    separateur: ';',
    encoding: 'UTF-8',
    periodicite: 'hebdo',
    canal: 'EDI',
    nomFichierPattern: 'SEMAINE [N] AAAA_102_63652_301_VENTE_MAG_H[AAAASS].csv',
    derniereSemaine: 18,
    derniereDate: '2026-05-09T04:30:00Z',
    semainesAttendues: 18,
    semainesRecues: 18,
    scoreQualite: 95,
    problemes: [],
    champClef: 'GTIN',
    contactSilverlit: 'Arthur Leroy Sahli',
    granulariteMagasin: true,
    inclutStock: true,
  },
  {
    distributeurId: 'amazon',
    format: 'XLSX',
    encoding: 'UTF-8',
    periodicite: 'hebdo',
    canal: 'API',
    nomFichierPattern: 'Amazon_S[N].xlsx (Vendor Central · Sales & Traffic)',
    derniereSemaine: 18,
    derniereDate: '2026-05-10T22:00:00Z',
    semainesAttendues: 18,
    semainesRecues: 18,
    scoreQualite: 97,
    problemes: [],
    champClef: 'ASIN / EAN',
    contactSilverlit: 'Arthur Leroy Sahli',
    granulariteMagasin: false,
    inclutStock: true,
  },
  {
    distributeurId: 'cdiscount',
    format: 'XLSX',
    encoding: 'UTF-8',
    periodicite: 'hebdo',
    canal: 'portail',
    nomFichierPattern: 'SEMAINE [N] VentesEtStock (N) - SILVERIT.xlsx',
    derniereSemaine: 17,
    derniereDate: '2026-05-02T14:18:00Z',
    semainesAttendues: 18,
    semainesRecues: 15,
    scoreQualite: 68,
    problemes: [
      'Faute d\'orthographe "SILVERIT" dans le nom de fichier',
      'Retards récurrents de 3-5 jours sur la livraison',
      'Numérotation parfois absente sur les fichiers',
    ],
    champClef: 'EAN',
    contactSilverlit: 'Arthur Leroy Sahli',
    granulariteMagasin: false,
    inclutStock: true,
  },
];

// =======================================================================
//   Statut RÉEL calculé depuis les lots importés (plus aucune valeur inventée)
// =======================================================================

type Status = Pick<SourceDistributeur,
  'derniereSemaine' | 'derniereDate' | 'semainesAttendues' | 'semainesRecues' | 'scoreQualite' | 'problemes'>;

function computeStatus(distId: string): Status {
  const batches = getBatches().filter((b) => b.distributeurId === distId);
  if (batches.length === 0) {
    return {
      derniereSemaine: 0, derniereDate: '', semainesAttendues: 0,
      semainesRecues: 0, scoreQualite: 0, problemes: ['Aucune donnée importée'],
    };
  }
  const semaines = [...new Set(batches.map((b) => b.semaine))].sort((a, b) => a - b);
  const derniereSemaine = Math.max(...semaines);
  const semainesRecues = semaines.length;
  // « Attendu » = jusqu'à la dernière semaine reçue (met en évidence les trous)
  const semainesAttendues = derniereSemaine;

  // Qualité = % des quantités effectivement valorisées par la grille
  let totalQ = 0, valQ = 0, unpriced = 0;
  for (const b of batches) {
    for (const r of b.rows) {
      const q = Math.abs(r.qteVendue);
      totalQ += q;
      const p = findProduit(r.ean);
      if (p && p.prixConseille > 0) valQ += q; else unpriced += 1;
    }
  }
  const scoreQualite = totalQ > 0 ? Math.round((valQ / totalQ) * 100) : 100;

  const problemes: string[] = [];
  const missing = [];
  for (let w = 1; w <= derniereSemaine; w++) if (!semaines.includes(w)) missing.push(w);
  if (missing.length) problemes.push(`Semaine(s) manquante(s) : ${missing.join(', ')}`);
  if (unpriced > 0) problemes.push(`${unpriced} référence(s) hors grille de prix`);

  const derniereDate = batches.map((b) => b.importedAt).filter(Boolean).sort().pop() ?? '';
  return { derniereSemaine, derniereDate, semainesAttendues, semainesRecues, scoreQualite, problemes };
}

export const SOURCES: SourceDistributeur[] = SOURCES_CONFIG.map((s) => ({
  ...s,
  ...computeStatus(s.distributeurId),
}));

export const findSource = (id: string) => SOURCES.find((s) => s.distributeurId === id);
