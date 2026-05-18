import type { Vente } from '../types';
import { PRODUITS, findProduit } from './products';
import { DISTRIBUTEURS, assortmentOf } from './distributors';

// Pseudo-random determinist : on veut des données identiques entre rechargements
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(424242);

// Périodes : 24 mois jusqu'à semaine 1 / 2026
// On génère ANNEES_PERIODES : (annee, semaine) listés
function buildWeeks(): Array<{ annee: number; semaine: number }> {
  const out: Array<{ annee: number; semaine: number }> = [];
  // Couvrir 2024 (52 semaines), 2025 (52 semaines), 2026 (1 semaine)
  for (let s = 1; s <= 52; s++) out.push({ annee: 2024, semaine: s });
  for (let s = 1; s <= 52; s++) out.push({ annee: 2025, semaine: s });
  out.push({ annee: 2026, semaine: 1 });
  return out;
}

export const WEEKS = buildWeeks();

// Coefficient saisonnier sur 52 semaines
// pic en S48-S51 (Noël), creux en S28-S32 (été), rebond S35-S38 (rentrée)
function seasonalCoef(semaine: number): number {
  if (semaine >= 47 && semaine <= 51) return 2.4 + (semaine - 47) * 0.18; // Noël
  if (semaine === 52) return 1.6; // fin d'année
  if (semaine >= 1 && semaine <= 4) return 1.05; // soldes / cadeaux post-Noël
  if (semaine >= 5 && semaine <= 12) return 0.85;
  if (semaine >= 13 && semaine <= 18) return 0.78; // creux printemps
  if (semaine >= 19 && semaine <= 23) return 0.82;
  if (semaine >= 24 && semaine <= 27) return 0.72; // début été
  if (semaine >= 28 && semaine <= 32) return 0.62; // creux été
  if (semaine >= 33 && semaine <= 34) return 0.85; // pré-rentrée
  if (semaine >= 35 && semaine <= 38) return 1.12; // rentrée
  if (semaine >= 39 && semaine <= 42) return 1.05;
  if (semaine >= 43 && semaine <= 46) return 1.45; // pré-Noël
  return 1;
}

// Part de marché de chaque distributeur (somme ~ 1)
// Reflète l'importance commerciale relative observée chez Silverlit France
const PART_DISTRIB: Record<string, number> = {
  joueclub: 0.21,
  recreaclub: 0.16,
  kingjouet: 0.14,
  carrefour: 0.10,
  galec: 0.09,
  auchan: 0.07,
  amazon: 0.08,
  fnacdarty: 0.06,
  oxybul: 0.04,
  cdiscount: 0.03,
  smythstoys: 0.02,
};

// Index produit (position dans le catalogue) → utilisé pour la popularité
const PRODUIT_INDEX: Record<string, number> = {};
PRODUITS.forEach((p, i) => { PRODUIT_INDEX[p.ean] = i; });

// Poids "popularité" par produit, basé sur index et statut
function produitWeight(index: number, statut: string): number {
  // distribution skewed: quelques produits dominent
  const base = 1 / Math.pow(index + 1, 0.55);
  if (statut === 'fin_de_vie') return base * 0.35;
  if (statut === 'retire') return base * 0.05;
  return base;
}

// Cible CA hebdo moyen en EUR HT
const CA_HEBDO_BASE = 130_000; // moyenne ~ saisonnalité × 130k = 95k à 180k

// Génère un dataset agrégé par (ean, distributeur, annee, semaine).
// IMPORTANT : chaque distributeur ne vend QUE les produits de son assortiment
// (cf. distributors.ts) — un hyper Carrefour ne référence pas les 104 produits.
export function generateVentes(): Vente[] {
  const ventes: Vente[] = [];

  // Poids total propre à chaque distributeur (somme des poids de son assortiment)
  const distribTotalWeight: Record<string, number> = {};
  for (const d of DISTRIBUTEURS) {
    let tw = 0;
    for (const ean of assortmentOf(d.id)) {
      const p = findProduit(ean);
      if (p) tw += produitWeight(PRODUIT_INDEX[ean] ?? 999, p.statut);
    }
    distribTotalWeight[d.id] = tw || 1;
  }

  for (const w of WEEKS) {
    const coef = seasonalCoef(w.semaine);
    const noise = 0.85 + rand() * 0.3; // ±15%
    const totalCaSemaine = CA_HEBDO_BASE * coef * noise;

    for (const d of DISTRIBUTEURS) {
      const partD = PART_DISTRIB[d.id] ?? 0.05;
      const caDistribSemaine = totalCaSemaine * partD;
      const totalWeight = distribTotalWeight[d.id];

      // On ne parcourt que l'assortiment du distributeur
      for (const ean of assortmentOf(d.id)) {
        const p = findProduit(ean);
        if (!p) continue;
        const idx = PRODUIT_INDEX[ean] ?? 999;
        const w_prod = produitWeight(idx, p.statut) / totalWeight;

        // Absence ponctuelle (rupture, semaine sans vente) — réaliste
        if (rand() < 0.22 && p.statut !== 'actif') continue;
        if (rand() < 0.07 && p.statut === 'actif') continue;

        const productNoise = 0.6 + rand() * 0.8;
        const caEAN = caDistribSemaine * w_prod * productNoise;
        if (caEAN < 1) continue;

        const qte = Math.max(1, Math.round(caEAN / p.prixConseille));
        const stock = Math.round(qte * (2 + rand() * 8)); // 2x à 10x les ventes

        ventes.push({
          ean: p.ean,
          distributeurId: d.id,
          magasinCode: d.id.toUpperCase().slice(0, 2) + '01',
          magasinLibelle: `${d.nom} — flux consolidé`,
          annee: w.annee,
          semaine: w.semaine,
          qteVendue: qte,
          qteStock: stock,
          caTTC: Math.round(caEAN * 100) / 100,
        });
      }
    }
  }
  return ventes;
}

export const VENTES: Vente[] = generateVentes();

// CURRENT_WEEK = dernière semaine disponible
export const CURRENT_WEEK = WEEKS[WEEKS.length - 1];
export const PREVIOUS_WEEK = WEEKS[WEEKS.length - 2];
