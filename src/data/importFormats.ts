// Spécifications des formats de fichiers réellement reçus de chaque enseigne.
// Sert à la page /import : détection automatique du format, mapping intelligent
// des colonnes vers le modèle interne, prévisualisation.
//
// Le modèle interne cible (champs normalisés) :
//   ean · refFournisseur · libelle · distributeurId · magasinCode ·
//   magasinLibelle · annee · semaine · qteVendue · qteStock · caTTC
//
// Pour JouéClub et King Jouet, les entêtes sont issues des fichiers réels
// fournis. Les autres reflètent le format/canal documenté dans governance.ts.

export interface CompositeField {
  fields: string[];   // champs internes produits par décomposition
  label: string;      // explication affichée
}

export interface ImportFormat {
  distributeurId: string;
  enseigne: string;
  filename: string;
  format: 'CSV' | 'TSV' | 'XLSX' | 'XLSM' | 'XLS';
  separator?: string;
  encoding: string;
  sizeLabel: string;
  rows: number;
  headers: string[];
  // mapping source → champ interne (détecté automatiquement)
  autoMap: Record<string, string>;
  // colonnes "composites" décomposées en plusieurs champs internes
  composite?: Record<string, CompositeField>;
  // score de confiance du mapping auto par colonne
  confidence: Record<string, number>;
  // 10 premières lignes pour la prévisualisation
  preview: string[][];
}

// --- TARGET FIELDS (modèle interne) ------------------------------------
export const TARGET_FIELDS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'ean', label: 'EAN produit', hint: 'Code-barres GTIN-13' },
  { key: 'refFournisseur', label: 'Référence Silverlit', hint: 'Référence interne fournisseur' },
  { key: 'libelle', label: 'Libellé produit', hint: 'Nom commercial' },
  { key: 'distributeurId', label: 'Enseigne', hint: 'Distributeur émetteur' },
  { key: 'magasinCode', label: 'Code magasin', hint: 'Identifiant du point de vente' },
  { key: 'magasinLibelle', label: 'Nom du magasin', hint: 'Libellé du PDV' },
  { key: 'annee', label: 'Année', hint: 'Année ISO' },
  { key: 'semaine', label: 'Semaine', hint: 'Numéro de semaine ISO' },
  { key: 'qteVendue', label: 'Quantité vendue', hint: 'Unités vendues' },
  { key: 'qteStock', label: 'Stock', hint: 'Quantité en stock magasin' },
  { key: 'caTTC', label: 'CA TTC', hint: "Chiffre d'affaires TTC" },
];

// --- Les 11 formats ----------------------------------------------------
export const IMPORT_FORMATS: ImportFormat[] = [
  {
    distributeurId: 'joueclub',
    enseigne: 'JouéClub',
    filename: 'GroupeJoueclub_Stats_hebdo_2026-19_SILVERLIT.csv',
    format: 'CSV',
    separator: ';',
    encoding: 'Windows-1252',
    sizeLabel: '1,47 Mo',
    rows: 11648,
    headers: [
      'PER_CUR', 'FOU_CD', 'FOU_LB', 'MAG_CD', 'MAG_LB', 'MAG_ENS',
      'PRO_CD', 'PRO_LB', 'FOUR_CD', 'EAN_CD', 'MILLESIME', 'TYPO',
      'CDE_DAT_QT', 'STK_DAT_QT', 'VTES_QT_N',
    ],
    autoMap: {
      MAG_CD: 'magasinCode', MAG_LB: 'magasinLibelle', MAG_ENS: 'distributeurId',
      PRO_LB: 'libelle', FOUR_CD: 'refFournisseur', EAN_CD: 'ean',
      STK_DAT_QT: 'qteStock', VTES_QT_N: 'qteVendue',
    },
    composite: {
      PER_CUR: { fields: ['annee', 'semaine'], label: 'Format AAAA-SS → décomposé' },
    },
    confidence: {
      PER_CUR: 99, MAG_CD: 96, MAG_LB: 88, MAG_ENS: 97, PRO_LB: 92,
      FOUR_CD: 95, EAN_CD: 98, STK_DAT_QT: 86, VTES_QT_N: 91,
    },
    preview: [
      ['2026-19', '38406', 'SILVERLIT', '02F0', '02F0 / JC FAYET', 'JouéClub', '02023432', 'STUNT DRONE', '54077', '4891813540007', '', '', '', '23', '3'],
      ['2026-19', '38406', 'SILVERLIT', '05G2', '05G2 / JC GAP', 'JouéClub', '02018440', 'POKIBOT VIOLET', '88800', '4891813888008', '', '', '', '12', '1'],
      ['2026-19', '38406', 'SILVERLIT', '06AN', '06AN / JC ANNECY', 'JouéClub', '02022210', 'MEGA BOT', '21253', '4891813212539', '', '', '', '8', '2'],
      ['2026-19', '38406', 'SILVERLIT', '13A1', '13A1 / JC AIX', 'JouéClub', '02023432', 'STUNT DRONE', '54077', '4891813540007', '', '', '', '17', '0'],
      ['2026-19', '38406', 'SILVERLIT', '14CA', '14CA / JC CAEN', 'JouéClub', '02024510', 'TORNADO AMAZONE', '84150', '4891813841500', '', '', '', '6', '1'],
      ['2026-19', '38406', 'SILVERLIT', '21D1', '21D1 / JC DIJON', 'JouéClub', '02023432', 'ALIEN VISION', '88750', '4891813887506', '', '', '', '11', '4'],
    ],
  },
  {
    distributeurId: 'recreaclub',
    enseigne: 'Récréa Club / La Grande Récré',
    filename: 'Recreaclub_Stats_hebdo_2026-19_SILVERLIT.csv',
    format: 'CSV',
    separator: ';',
    encoding: 'Windows-1252',
    sizeLabel: '0,92 Mo',
    rows: 7234,
    // Entêtes réelles du fichier Recreaclub_Stats_hebdo_AAAA-SS_SILVERLIT.csv
    headers: [
      'PER_CUR', 'FOU_CD', 'FOU_LB', 'MAG_CD', 'MAG_LB', 'PRO_CD', 'PRO_LB',
      'FOUR_CD', 'EAN_CD', 'MILLESIME', 'TYPO', 'CDE_DAT_QT', 'STK_DAT_QT', 'VTES_QT_N',
    ],
    autoMap: {
      MAG_CD: 'magasinCode', MAG_LB: 'magasinLibelle',
      PRO_LB: 'libelle', FOUR_CD: 'refFournisseur', EAN_CD: 'ean',
      STK_DAT_QT: 'qteStock', VTES_QT_N: 'qteVendue',
    },
    composite: {
      PER_CUR: { fields: ['annee', 'semaine'], label: 'Format AAAA/SS → décomposé' },
    },
    confidence: {
      PER_CUR: 99, FOU_CD: 0, FOU_LB: 0, MAG_CD: 95, MAG_LB: 86, PRO_CD: 0, PRO_LB: 90,
      FOUR_CD: 94, EAN_CD: 98, MILLESIME: 0, TYPO: 0, CDE_DAT_QT: 0,
      STK_DAT_QT: 85, VTES_QT_N: 90,
    },
    preview: [
      ['2026/01', '10326', 'SILVERLIT', '1710', 'JAUX', '225077', 'ROBOCAR POLI VEHICULE', '83151', '4891813831518', '2026', '1', '', '17', '4'],
      ['2026/01', '10326', 'SILVERLIT', '1189', 'RODEZ', '225077', 'ROBOCAR POLI VEHICULE', '83151', '4891813831518', '2026', '1', '', '18', '2'],
      ['2026/01', '10326', 'SILVERLIT', '1157', 'MONTPELLIER ODYSEUM', '225067', 'JOJO FUN PELUCHES', '61035', '4891813610359', '2012', 'H', '', '6', '1'],
      ['2026/01', '10326', 'SILVERLIT', '1120', 'MONTESSON', '225077', 'ROBOCAR POLI VEHICULE', '83151', '4891813831518', '2026', '1', '', '15', '3'],
      ['2026/01', '10326', 'SILVERLIT', '1125', 'COGOLIN', '225077', 'ROBOCAR POLI VEHICULE', '83151', '4891813831518', '2026', '1', '', '18', '5'],
    ],
  },
  {
    distributeurId: 'kingjouet',
    enseigne: 'King Jouet',
    filename: 'Fournisseur_Ventes_JOL_Stocks_SemS-1.csv',
    format: 'TSV',
    separator: 'Tab',
    encoding: 'UTF-16-LE (BOM)',
    sizeLabel: '0,29 Mo',
    rows: 3204,
    // Entêtes réelles — flux JOL consolidé (pas de détail par magasin)
    headers: [
      'Code Fournisseur magasin', 'Fournisseur magasin', 'Code article', 'Article',
      'Code EAN', 'Référence Fournisseur', 'Année', 'N° semaine', 'Stock',
      'Quantité', 'Montant TTC av remise globale', 'Rapport', 'Date extraction',
    ],
    autoMap: {
      'Article': 'libelle',
      'Code EAN': 'ean',
      'Référence Fournisseur': 'refFournisseur',
      'Année': 'annee',
      'N° semaine': 'semaine',
      'Stock': 'qteStock',
      'Quantité': 'qteVendue',
      'Montant TTC av remise globale': 'caTTC',
    },
    confidence: {
      'Code Fournisseur magasin': 0, 'Fournisseur magasin': 0, 'Code article': 0,
      'Article': 90, 'Code EAN': 98, 'Référence Fournisseur': 96,
      'Année': 99, 'N° semaine': 99, 'Stock': 88, 'Quantité': 92,
      'Montant TTC av remise globale': 94, 'Rapport': 0, 'Date extraction': 0,
    },
    preview: [
      ['002885', 'SILVERLIT PLAYWELL', '1008452', 'STUNT DRONE', '3700224540777', '54077', '2026', '01', '23', '3', '104,97', 'Stats Fournisseur Complètes', '2026-01-05 09:13:27'],
      ['002885', 'SILVERLIT PLAYWELL', '0084056', 'TELEPHONE ALLO CAPUCINE', '7640114233449', '33-5044', '2026', '01', '1', '0', '0', 'Stats Fournisseur Complètes', '2026-01-05 09:13:27'],
      ['002885', 'SILVERLIT PLAYWELL', '0118593', 'TIMINOU DIS MOI UN SECRET', '7640114235139', '33-7013', '2026', '01', '2', '0', '0', 'Stats Fournisseur Complètes', '2026-01-05 09:13:27'],
      ['002885', 'SILVERLIT PLAYWELL', '0131254', 'KIT HELICE ARRIERE', '4891813856900', '85690', '2026', '01', '0', '0', '0', 'Stats Fournisseur Complètes', '2026-01-05 09:13:27'],
      ['002885', 'SILVERLIT PLAYWELL', '0166141', 'PEL FUN JOJO ET SES AMIS', '4891813610359', '61035', '2026', '01', '1', '0', '0', 'Stats Fournisseur Complètes', '2026-01-05 09:13:27'],
    ],
  },
  {
    distributeurId: 'oxybul',
    enseigne: 'Oxybul',
    filename: 'Ventes___Stock_fournisseur_SILVERLIT MAI 2026.xlsx',
    format: 'XLSX',
    separator: undefined,
    encoding: 'UTF-8',
    sizeLabel: '0,11 Mo',
    rows: 432,
    headers: [
      'Mois', 'Code EAN', 'Désignation', 'Réf fournisseur',
      'Ventes unités', 'Stock fin de période', 'CA TTC',
    ],
    autoMap: {
      'Code EAN': 'ean',
      'Désignation': 'libelle',
      'Réf fournisseur': 'refFournisseur',
      'Ventes unités': 'qteVendue',
      'Stock fin de période': 'qteStock',
      'CA TTC': 'caTTC',
    },
    composite: {
      Mois: { fields: ['annee', 'semaine'], label: 'Mensuel → réparti sur les semaines ISO' },
    },
    confidence: {
      Mois: 90, 'Code EAN': 97, 'Désignation': 88, 'Réf fournisseur': 93,
      'Ventes unités': 89, 'Stock fin de période': 85, 'CA TTC': 92,
    },
    preview: [
      ['2026-05', '4891813888008', 'POKIBOT VIOLET', '88800', '142', '88', '2 838,58'],
      ['2026-05', '7640114235139', 'TIMINOU DIS MOI UN SECRET', '33-7013', '78', '54', '2 729,22'],
      ['2026-05', '4891813212539', 'MEGA BOT', '21253', '210', '120', '2 097,90'],
      ['2026-05', '4891813540007', 'STUNT DRONE', '54077', '64', '32', '3 199,36'],
      ['2026-05', '4891813831518', 'ROBOCAR ASST N°1', '83151', '320', '180', '2 876,80'],
    ],
  },
  {
    distributeurId: 'fnacdarty',
    enseigne: 'Fnac Darty',
    filename: 'SEMAINE 19 Ventes et stocks articles - total.xls',
    format: 'XLS',
    separator: undefined,
    encoding: 'Latin-1',
    sizeLabel: '0,34 Mo',
    rows: 1890,
    headers: [
      'Semaine', 'EAN', 'Libellé article', 'Réf. four.',
      'Qté vendue', 'Stock', 'CA TTC', 'Enseigne',
    ],
    autoMap: {
      Semaine: 'semaine',
      EAN: 'ean',
      'Libellé article': 'libelle',
      'Réf. four.': 'refFournisseur',
      'Qté vendue': 'qteVendue',
      Stock: 'qteStock',
      'CA TTC': 'caTTC',
      Enseigne: 'distributeurId',
    },
    confidence: {
      Semaine: 82, EAN: 97, 'Libellé article': 76, 'Réf. four.': 90,
      'Qté vendue': 88, Stock: 84, 'CA TTC': 91, Enseigne: 95,
    },
    preview: [
      ['2026-S19', '4891813540007', 'SILVERLIT STUNT DRONE', '54077', '34', '18', '1 699,66', 'FNAC'],
      ['2026-S19', '4891813540007', 'SILVERLIT STUNT DRONE', '54077', '12', '6', '599,88', 'DARTY'],
      ['2026-S19', '4891813888008', 'POKIBOT VIOLET SILVERLIT', '88800', '21', '14', '419,79', 'FNAC'],
      ['2026-S19', '4891813212546', 'DINO BOT', '21254', '9', '4', '314,91', 'FNAC'],
      ['2026-S19', '8194410100176', 'SPIROGRAPH COFFRET DELUXE', '1001Z', '7', '3', '559,93', 'DARTY'],
    ],
  },
  {
    distributeurId: 'smythstoys',
    enseigne: 'Smyths Toys',
    filename: 'Silverlit 2026-01-05-08-42-59.xlsx',
    format: 'XLSX',
    separator: undefined,
    encoding: 'UTF-8',
    sizeLabel: '0,04 Mo',
    rows: 33,
    // Entêtes réelles de l'onglet "Vendor Report" (la semaine est dans le nom
    // de fichier, pas dans les colonnes)
    headers: [
      'Article', 'Article Description', 'Article Barcode', 'Vendor Material',
      'Retail Article Group', 'Category', 'Vendor Code', 'Vendor Name',
      'Top X Qty Total', 'Total Available Stock', 'Weeks Cover On Total',
    ],
    autoMap: {
      'Article Description': 'libelle',
      'Article Barcode': 'ean',
      'Vendor Material': 'refFournisseur',
      'Top X Qty Total': 'qteVendue',
      'Total Available Stock': 'qteStock',
    },
    confidence: {
      Article: 0, 'Article Description': 86, 'Article Barcode': 98,
      'Vendor Material': 92, 'Retail Article Group': 0, Category: 0,
      'Vendor Code': 0, 'Vendor Name': 0, 'Top X Qty Total': 88,
      'Total Available Stock': 87, 'Weeks Cover On Total': 0,
    },
    preview: [
      ['227150', 'ALIEN VISION', '730002030513', '3051', 'SM11060202', "Children's Games", '10862', 'Silverlit Toys Manufac', '124', '1725', '13.91'],
      ['251803', 'BOXING WARRIORS', '4891813892656', '89265', 'SM11010206', 'Robots', '8000036', 'SILVERLIT FRANCE', '79', '1475', '18.67'],
      ['227791', 'EXOST 360 TORNADO AMAZONE', '4891813547549', '54754', 'SM11010202', 'Radio Control Cars', '8000036', 'SILVERLIT FRANCE', '2', '0', ''],
      ['256781', 'MUD MONSTER', '3700224541347', '54134', 'SM11010202', 'Radio Control Cars', '8000036', 'SILVERLIT FRANCE', '0', '0', ''],
      ['168030', 'ROBO CHAMELEON NR', '4891813885382', '88538', 'SM11010206', 'Robots', '10862', 'Silverlit Toys Manufac', '8', '0', ''],
    ],
  },
  {
    distributeurId: 'galec',
    enseigne: 'GALEC / E.Leclerc',
    filename: 'SEMAINE 19 A Exporter Suivi des Ventes Hebdomadaire E.Leclerc.xlsx',
    format: 'XLSX',
    separator: undefined,
    encoding: 'UTF-8',
    sizeLabel: '0,21 Mo',
    rows: 980,
    headers: [
      'Semaine', 'Gencod', 'Libellé article', 'Code fournisseur',
      'UVC', 'CA TTC', 'PVC moyen',
    ],
    autoMap: {
      Semaine: 'semaine',
      Gencod: 'ean',
      'Libellé article': 'libelle',
      'Code fournisseur': 'refFournisseur',
      UVC: 'qteVendue',
      'CA TTC': 'caTTC',
    },
    confidence: {
      Semaine: 83, Gencod: 97, 'Libellé article': 82, 'Code fournisseur': 89,
      UVC: 88, 'CA TTC': 92, 'PVC moyen': 0,
    },
    preview: [
      ['201926', '4891813540007', 'DRONE SILVERLIT STUNT', '54077', '142', '7 098,58', '49,99'],
      ['201926', '4891813831518', 'ROBOCAR ASST VEHICULE', '83151', '380', '3 416,20', '8,99'],
      ['201926', '4891813888008', 'ROBOT POKIBOT', '88800', '95', '1 899,05', '19,99'],
      ['201926', '4891813202103', 'VOITURE RC FURY CROSS', '20210', '210', '1 677,90', '7,99'],
      ['201926', '4891813212539', 'MEGA BOT SILVERLIT', '21253', '88', '879,12', '9,99'],
    ],
  },
  {
    distributeurId: 'carrefour',
    enseigne: 'Carrefour',
    filename: 'CARREFOUR V5-2026.xlsm',
    format: 'XLSM',
    separator: undefined,
    encoding: 'UTF-8',
    sizeLabel: '0,46 Mo',
    rows: 1240,
    headers: [
      'Periode', 'EAN', 'Designation', 'Code Article Fournisseur',
      'Qte Vendue', 'Stock Magasin', 'CA TTC',
    ],
    autoMap: {
      EAN: 'ean',
      Designation: 'libelle',
      'Code Article Fournisseur': 'refFournisseur',
      'Qte Vendue': 'qteVendue',
      'Stock Magasin': 'qteStock',
      'CA TTC': 'caTTC',
    },
    composite: {
      Periode: { fields: ['annee', 'semaine'], label: 'Format SSAAAA → décomposé' },
    },
    confidence: {
      Periode: 94, EAN: 98, Designation: 84, 'Code Article Fournisseur': 90,
      'Qte Vendue': 90, 'Stock Magasin': 86, 'CA TTC': 93,
    },
    preview: [
      ['192026', '4891813540007', 'DRONE STUNT SILVERLIT', '54077', '98', '210', '4 899,02'],
      ['192026', '4891813831518', 'ASST ROBOCAR DIE CAST', '83151', '420', '880', '3 775,80'],
      ['192026', '4891813888008', 'POKIBOT VIOLET', '88800', '120', '260', '2 398,80'],
      ['192026', '4891813212539', 'MEGA BOT', '21253', '76', '160', '759,24'],
      ['192026', '4891813202103', 'FURY CROSS 1:12', '20210', '180', '390', '1 438,20'],
    ],
  },
  {
    distributeurId: 'auchan',
    enseigne: 'Auchan',
    filename: 'SEMAINE 19 2026_102_63652_301_VENTE_MAG_H202619.csv',
    format: 'CSV',
    separator: ';',
    encoding: 'UTF-8',
    sizeLabel: '0,73 Mo',
    rows: 5410,
    headers: [
      'SEMAINE', 'CODE_MAG', 'LIBELLE_MAG', 'GTIN', 'LIBELLE_ARTICLE',
      'REF_FOUR', 'QTE_VENTE', 'QTE_STOCK', 'CA_TTC',
    ],
    autoMap: {
      SEMAINE: 'semaine',
      CODE_MAG: 'magasinCode',
      LIBELLE_MAG: 'magasinLibelle',
      GTIN: 'ean',
      LIBELLE_ARTICLE: 'libelle',
      REF_FOUR: 'refFournisseur',
      QTE_VENTE: 'qteVendue',
      QTE_STOCK: 'qteStock',
      CA_TTC: 'caTTC',
    },
    confidence: {
      SEMAINE: 85, CODE_MAG: 96, LIBELLE_MAG: 90, GTIN: 98, LIBELLE_ARTICLE: 86,
      REF_FOUR: 92, QTE_VENTE: 91, QTE_STOCK: 87, CA_TTC: 93,
    },
    preview: [
      ['202619', '0312', 'AUCHAN VELIZY 2', '4891813540007', 'STUNT DRONE SILVERLIT', '54077', '12', '34', '599,88'],
      ['202619', '0312', 'AUCHAN VELIZY 2', '4891813888008', 'POKIBOT VIOLET', '88800', '8', '22', '159,92'],
      ['202619', '0457', 'AUCHAN LE PONTET', '4891813831518', 'ROBOCAR ASST DIE CAST', '83151', '40', '95', '359,60'],
      ['202619', '0457', 'AUCHAN LE PONTET', '4891813540007', 'STUNT DRONE SILVERLIT', '54077', '6', '18', '299,94'],
      ['202619', '0688', 'AUCHAN FACHES', '4891813212539', 'MEGA BOT', '21253', '14', '38', '139,86'],
    ],
  },
  {
    distributeurId: 'amazon',
    enseigne: 'Amazon (Vendor Central)',
    filename: 'Amazon_S19.xlsx',
    format: 'XLSX',
    separator: undefined,
    encoding: 'UTF-8',
    sizeLabel: '0,18 Mo',
    rows: 612,
    headers: [
      'Week', 'ASIN', 'EAN', 'Product Title', 'Vendor SKU',
      'Ordered Units', 'Sellable On Hand Units', 'Ordered Revenue',
    ],
    autoMap: {
      Week: 'semaine',
      EAN: 'ean',
      'Product Title': 'libelle',
      'Vendor SKU': 'refFournisseur',
      'Ordered Units': 'qteVendue',
      'Sellable On Hand Units': 'qteStock',
      'Ordered Revenue': 'caTTC',
    },
    confidence: {
      Week: 86, ASIN: 0, EAN: 98, 'Product Title': 87, 'Vendor SKU': 90,
      'Ordered Units': 92, 'Sellable On Hand Units': 88, 'Ordered Revenue': 94,
    },
    preview: [
      ['2026-W19', 'B07XYZ1234', '4891813540007', 'Silverlit - Stunt Drone télécommandé', '54077', '210', '480', '10 497,90'],
      ['2026-W19', 'B07ABC5678', '4891813888008', 'Silverlit Pokibot Violet Robot', '88800', '156', '320', '3 118,44'],
      ['2026-W19', 'B08DEF9012', '4891813212539', 'Silverlit Mega Bot', '21253', '98', '210', '979,02'],
      ['2026-W19', 'B08GHI3456', '8194410100176', 'Spirograph Coffret Deluxe', '1001Z', '42', '90', '3 359,58'],
      ['2026-W19', 'B09JKL7890', '4891813887506', 'Silverlit Alien Vision', '88750', '67', '140', '1 674,33'],
    ],
  },
  {
    distributeurId: 'cdiscount',
    enseigne: 'Cdiscount',
    filename: 'SEMAINE 19 VentesEtStock (158) - SILVERIT.xlsx',
    format: 'XLSX',
    separator: undefined,
    encoding: 'UTF-8',
    sizeLabel: '0,14 Mo',
    rows: 498,
    headers: [
      'Semaine', 'EAN', 'Produit', 'Reference', 'Ventes', 'Stock', 'Montant TTC',
    ],
    autoMap: {
      Semaine: 'semaine',
      EAN: 'ean',
      Produit: 'libelle',
      Reference: 'refFournisseur',
      Ventes: 'qteVendue',
      Stock: 'qteStock',
      'Montant TTC': 'caTTC',
    },
    confidence: {
      Semaine: 84, EAN: 97, Produit: 83, Reference: 89,
      Ventes: 90, Stock: 86, 'Montant TTC': 92,
    },
    preview: [
      ['S19-2026', '4891813540007', 'SILVERLIT Stunt Drone', '54077', '64', '120', '3 199,36'],
      ['S19-2026', '4891813888008', 'Robot POKIBOT Violet', '88800', '38', '85', '759,62'],
      ['S19-2026', '4891813212546', 'DINO BOT Silverlit', '21254', '21', '48', '734,79'],
      ['S19-2026', '8194410100176', 'SPIROGRAPH Coffret Deluxe', '1001Z', '12', '30', '959,88'],
      ['S19-2026', '4891813202103', 'Voiture RC Fury Cross', '20210', '54', '110', '431,46'],
    ],
  },
];

export const findImportFormat = (distributeurId: string) =>
  IMPORT_FORMATS.find((f) => f.distributeurId === distributeurId);
