import type { Distributeur, Magasin } from '../types';
import { PRODUITS } from './products';

// Référentiel des 11 distributeurs réels Silverlit France (source : organisation
// des dossiers "STATS 2026" reçus chaque semaine par enseigne)
export const DISTRIBUTEURS: Distributeur[] = [
  { id: 'joueclub', nom: 'JouéClub', type: 'GSS', nbMagasins: 239, logoColor: '#e63946' },
  { id: 'recreaclub', nom: 'Récréa Club / La Grande Récré', type: 'GSS', nbMagasins: 180, logoColor: '#ff6b35' },
  { id: 'kingjouet', nom: 'King Jouet', type: 'GSS', nbMagasins: 220, logoColor: '#ffb703' },
  { id: 'oxybul', nom: 'Oxybul', type: 'GSS', nbMagasins: 95, logoColor: '#7209b7' },
  { id: 'fnacdarty', nom: 'Fnac Darty', type: 'GSS', nbMagasins: 320, logoColor: '#f0a500' },
  { id: 'smythstoys', nom: 'Smyths Toys', type: 'GSS', nbMagasins: 28, logoColor: '#d62828' },
  { id: 'galec', nom: 'GALEC / E.Leclerc', type: 'GMS', nbMagasins: 720, logoColor: '#0353a4' },
  { id: 'carrefour', nom: 'Carrefour', type: 'GMS', nbMagasins: 1054, logoColor: '#005baa' },
  { id: 'auchan', nom: 'Auchan', type: 'GMS', nbMagasins: 645, logoColor: '#ef3340' },
  { id: 'amazon', nom: 'Amazon', type: 'ecommerce', nbMagasins: 1, logoColor: '#ff9900' },
  { id: 'cdiscount', nom: 'Cdiscount', type: 'ecommerce', nbMagasins: 1, logoColor: '#ee7600' },
];

export const findDistributeur = (id: string) => DISTRIBUTEURS.find((d) => d.id === id);

export const isEcommerce = (d: Distributeur) => d.type === 'ecommerce';

// --- Assortiment par distributeur --------------------------------------
// Chaque enseigne ne référence qu'un SOUS-ENSEMBLE du catalogue Silverlit.
// - GMS (hyper) : assortiment court, centré sur les best-sellers
// - GSS (spécialiste) : assortiment large
// - E-commerce : longue traîne, presque tout le catalogue
// L'assortiment est déterministe (seed = id enseigne) pour rester stable
// entre les rechargements.

const ASSORTMENT_SIZE: Record<string, number> = {
  joueclub: 96,
  recreaclub: 88,
  kingjouet: 90,
  oxybul: 54,
  fnacdarty: 62,
  smythstoys: 70,
  galec: 30,
  carrefour: 34,
  auchan: 27,
  amazon: 102,
  cdiscount: 79,
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildAssortment(distId: string, size: number): string[] {
  const rnd = mulberry32(hashSeed(distId));
  // Score : popularité (index bas = best-seller) + bruit propre à l'enseigne.
  // Les produits "retiré" ne sont jamais référencés.
  const scored = PRODUITS
    .map((p, i) => ({
      ean: p.ean,
      statut: p.statut,
      score: (1 / Math.pow(i + 1, 0.4)) * (0.45 + rnd() * 1.1),
    }))
    .filter((x) => x.statut !== 'retire');
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.min(size, scored.length)).map((s) => s.ean);
}

export const ASSORTMENTS: Record<string, string[]> = Object.fromEntries(
  DISTRIBUTEURS.map((d) => [d.id, buildAssortment(d.id, ASSORTMENT_SIZE[d.id] ?? 60)]),
);

export const assortmentOf = (id: string): string[] => ASSORTMENTS[id] ?? [];
export const assortmentSize = (id: string): number => (ASSORTMENTS[id] ?? []).length;

// --- Magasins (échantillon représentatif pour la carte) ----------------
// On ne stocke pas les 3 500 magasins réels : la carte affiche un échantillon
// représentatif d'implantations. Le compte officiel reste `nbMagasins`.

const VILLES: Array<{ ville: string; region: string; lat: number; lng: number }> = [
  { ville: 'Paris', region: 'Île-de-France', lat: 48.8566, lng: 2.3522 },
  { ville: 'Lyon', region: 'Auvergne-Rhône-Alpes', lat: 45.7640, lng: 4.8357 },
  { ville: 'Marseille', region: "Provence-Alpes-Côte d'Azur", lat: 43.2965, lng: 5.3698 },
  { ville: 'Toulouse', region: 'Occitanie', lat: 43.6047, lng: 1.4442 },
  { ville: 'Nice', region: "Provence-Alpes-Côte d'Azur", lat: 43.7102, lng: 7.2620 },
  { ville: 'Nantes', region: 'Pays de la Loire', lat: 47.2184, lng: -1.5536 },
  { ville: 'Strasbourg', region: 'Grand Est', lat: 48.5734, lng: 7.7521 },
  { ville: 'Bordeaux', region: 'Nouvelle-Aquitaine', lat: 44.8378, lng: -0.5792 },
  { ville: 'Lille', region: 'Hauts-de-France', lat: 50.6292, lng: 3.0573 },
  { ville: 'Rennes', region: 'Bretagne', lat: 48.1173, lng: -1.6778 },
  { ville: 'Reims', region: 'Grand Est', lat: 49.2583, lng: 4.0317 },
  { ville: 'Le Havre', region: 'Normandie', lat: 49.4944, lng: 0.1079 },
  { ville: 'Saint-Étienne', region: 'Auvergne-Rhône-Alpes', lat: 45.4397, lng: 4.3872 },
  { ville: 'Toulon', region: "Provence-Alpes-Côte d'Azur", lat: 43.1242, lng: 5.9280 },
  { ville: 'Grenoble', region: 'Auvergne-Rhône-Alpes', lat: 45.1885, lng: 5.7245 },
  { ville: 'Dijon', region: 'Bourgogne-Franche-Comté', lat: 47.3220, lng: 5.0415 },
  { ville: 'Angers', region: 'Pays de la Loire', lat: 47.4784, lng: -0.5632 },
  { ville: 'Saint-Quentin', region: 'Hauts-de-France', lat: 49.8489, lng: 3.2876 },
  { ville: 'Manosque', region: "Provence-Alpes-Côte d'Azur", lat: 43.8333, lng: 5.7833 },
  { ville: 'Gap', region: "Provence-Alpes-Côte d'Azur", lat: 44.5594, lng: 6.0789 },
  { ville: 'Annecy', region: 'Auvergne-Rhône-Alpes', lat: 45.8992, lng: 6.1294 },
  { ville: 'Avignon', region: "Provence-Alpes-Côte d'Azur", lat: 43.9493, lng: 4.8055 },
  { ville: 'Pau', region: 'Nouvelle-Aquitaine', lat: 43.2951, lng: -0.3708 },
  { ville: 'Caen', region: 'Normandie', lat: 49.1829, lng: -0.3707 },
];

// Nombre de points affichés sur la carte par enseigne (échantillon, ≤ VILLES)
function sampleStoreCount(d: Distributeur): number {
  if (isEcommerce(d)) return 0;
  // proportionnel au parc réel, plafonné à la taille de VILLES
  return Math.max(8, Math.min(VILLES.length, Math.round(d.nbMagasins / 22)));
}

function genMagasins(): Magasin[] {
  const out: Magasin[] = [];
  let i = 0;
  for (const d of DISTRIBUTEURS) {
    if (isEcommerce(d)) {
      out.push({
        code: d.id.slice(0, 2).toUpperCase() + '-WEB',
        libelle: `${d.nom} · plateforme nationale`,
        distributeurId: d.id,
        ville: 'France entière',
        region: 'National',
        lat: 46.6,
        lng: 2.4,
      });
      continue;
    }
    const rnd = mulberry32(hashSeed(d.id + 'mag'));
    const count = sampleStoreCount(d);
    // sélection déterministe de `count` villes
    const villesShuffled = [...VILLES]
      .map((v) => ({ v, k: rnd() }))
      .sort((a, b) => a.k - b.k)
      .slice(0, count)
      .map((x) => x.v);
    const prefix = d.nom.split(/[\s/]/)[0].slice(0, 2).toUpperCase();
    for (const v of villesShuffled) {
      i += 1;
      out.push({
        code: `${prefix}${String(i).padStart(3, '0')}`,
        libelle: `${prefix} ${v.ville.toUpperCase()}`,
        distributeurId: d.id,
        ville: v.ville,
        region: v.region,
        lat: v.lat + (rnd() - 0.5) * 0.05,
        lng: v.lng + (rnd() - 0.5) * 0.05,
      });
    }
  }
  return out;
}

export const MAGASINS: Magasin[] = genMagasins();

export const magasinsByDistributeur = (id: string) =>
  MAGASINS.filter((m) => m.distributeurId === id);

// Parc total réel (somme des nbMagasins, hors plateformes e-commerce)
export const TOTAL_POINTS_VENTE = DISTRIBUTEURS
  .filter((d) => !isEcommerce(d))
  .reduce((s, d) => s + d.nbMagasins, 0);
