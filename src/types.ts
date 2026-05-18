// Les "gammes" correspondent aux familles de marques réelles Silverlit France
// (source : Première base de prix / base de données produits).
export type Gamme =
  | 'EXOST'
  | 'FLYBOTIC'
  | 'YCOO'
  | 'ROBOCAR POLI'
  | 'OUAPS'
  | 'SPIROGRAPH'
  | 'LAZER MAD'
  | 'TOOKO'
  | 'Autres marques';

export type Categorie =
  | 'Garcon 3-6'
  | 'Garcon 6-10'
  | 'Fille 3-6'
  | 'Fille 6-10'
  | 'Mixte'
  | 'Premier age';

export type Statut = 'actif' | 'fin_de_vie' | 'retire';

export interface Produit {
  ean: string;
  refFournisseur: string;
  libelle: string;
  marque: string;        // marque commerciale réelle (EXOST, YCOO, OUAPS…)
  gamme: Gamme;          // famille de marques (regroupement)
  categorie: Categorie;
  statut: Statut;
  prixConseille: number; // tarif fournisseur 2026 en EUR
}

export type DistributeurType = 'GSS' | 'GMS' | 'ecommerce' | 'independant';

export interface Distributeur {
  id: string;
  nom: string;
  type: DistributeurType;
  nbMagasins: number;
  region?: string;
  logoColor: string;
}

export interface Magasin {
  code: string;
  libelle: string;
  distributeurId: string;
  ville: string;
  region: string;
  lat: number;
  lng: number;
}

export interface Vente {
  ean: string;
  distributeurId: string;
  magasinCode: string;
  magasinLibelle: string;
  annee: number;
  semaine: number;
  qteVendue: number;
  qteStock: number;
  caTTC: number;
}

export type AlerteType = 'rupture' | 'baisse' | 'croissance' | 'rotation';
export type Severite = 'haute' | 'moyenne' | 'basse';
export type StatutAlerte = 'ouverte' | 'traitee';

export interface Alerte {
  id: string;
  type: AlerteType;
  ean: string;
  libelle: string;
  distributeurId?: string;
  message: string;
  severite: Severite;
  dateCreation: string;
  statut: StatutAlerte;
  delta?: number;
}

export type Devise = 'EUR' | 'USD' | 'GBP' | 'JPY' | 'CNY';

export interface DeviseInfo {
  code: Devise;
  symbol: string;
  rate: number;
  label: string;
}

export interface SerieHebdo {
  semaine: string;
  ca: number;
  qte: number;
}
