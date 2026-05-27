// Validation minimale à l'import — version v0.
//
// Périmètre volontairement étroit (décision Philippe, mai 2026) :
//   « pour l'instant faudrait juste une alerte si il manque des données »
//
// On ne fait PAS encore :
//   - de contrôles statistiques (outliers, anomalies)
//   - de contrôles sémantiques (EAN inconnu, écart de prix…)
//   - de croisement entre lignes (doublons, gaps de semaines)
//
// On fait UNIQUEMENT : repérer les cellules vides sur les colonnes critiques.
// Les futurs niveaux de validation viendront s'empiler ici.

import type { ImportFormat } from '../data';

// Champs strictement obligatoires pour qu'une ligne de vente soit
// exploitable : EAN (clé pivot), quantité (la mesure), année + semaine
// (l'axe temps). Tout le reste est facultatif.
const REQUIRED_FIELDS = ['ean', 'qteVendue', 'annee', 'semaine'] as const;

const FIELD_LABEL: Record<string, string> = {
  ean: 'EAN',
  qteVendue: 'Quantité vendue',
  annee: 'Année',
  semaine: 'Semaine',
};

export interface MissingDataIssue {
  field: string;            // 'ean'
  fieldLabel: string;       // 'EAN'
  missingRows: number[];    // [3, 7]  (indices 1-based dans le fichier source)
  sourceColumn: string | null; // 'EAN_CD' (colonne source mappée), null si non mappée
}

export interface ImportValidationResult {
  hasIssues: boolean;
  totalMissingCells: number;
  issues: MissingDataIssue[];
  // Champs requis qui n'ont AUCUNE colonne source mappée (cas le plus grave)
  unmappedRequiredFields: string[];
}

/**
 * Repère, pour les 10 premières lignes (échantillon de prévisualisation),
 * les cellules vides dans les colonnes mappées sur des champs obligatoires.
 *
 * Limitation v0 : ne valide que l'échantillon `preview`, pas le fichier
 * complet. Suffit pour signaler un problème au moment où l'utilisateur
 * arrive sur l'écran de mapping. Une validation full-file viendra avec
 * le vrai parsing du fichier (chantier futur).
 */
export function validateImport(
  format: ImportFormat,
  mapping: Record<string, string>,
): ImportValidationResult {
  // 1) Détecter les champs obligatoires qui n'ont aucune colonne mappée
  //    On regarde aussi les champs composites (date qui contient année+semaine, etc.)
  const mappedTargets = new Set<string>(Object.values(mapping).filter(Boolean));
  if (format.composite) {
    for (const comp of Object.values(format.composite)) {
      for (const f of comp.fields) mappedTargets.add(f);
    }
  }

  const unmappedRequired = REQUIRED_FIELDS.filter((f) => !mappedTargets.has(f));

  // 2) Pour chaque champ requis effectivement mappé, repérer les lignes
  //    de preview où la cellule source est vide.
  const issues: MissingDataIssue[] = [];

  for (const reqField of REQUIRED_FIELDS) {
    // Si non mappé, on le signale séparément (cf. unmappedRequired)
    if (!mappedTargets.has(reqField)) continue;

    // Trouver la colonne source qui mappe vers ce champ
    // (en ignorant les composites qui les remplissent autrement)
    const sourceCol = Object.entries(mapping).find(([, t]) => t === reqField)?.[0] ?? null;
    if (!sourceCol) continue; // alimenté par un composite, on ne peut pas valider à ce stade

    // Index de la colonne source dans le header
    const colIdx = format.headers.indexOf(sourceCol);
    if (colIdx < 0) continue;

    // Parcourir les lignes de preview
    const missingRows: number[] = [];
    format.preview.forEach((row, i) => {
      const cell = row[colIdx];
      if (cell === undefined || cell === null || String(cell).trim() === '') {
        // i+1 car les utilisateurs comptent à partir de 1 (et la ligne 1 = entêtes)
        missingRows.push(i + 2);
      }
    });

    if (missingRows.length > 0) {
      issues.push({
        field: reqField,
        fieldLabel: FIELD_LABEL[reqField] ?? reqField,
        missingRows,
        sourceColumn: sourceCol,
      });
    }
  }

  const totalMissingCells = issues.reduce((s, i) => s + i.missingRows.length, 0);

  return {
    hasIssues: issues.length > 0 || unmappedRequired.length > 0,
    totalMissingCells,
    issues,
    unmappedRequiredFields: unmappedRequired.map((f) => FIELD_LABEL[f] ?? f),
  };
}
