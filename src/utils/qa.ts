// Moteur Q&A polyvalent, 100% local.
// Approche : tokenisation + matching flou (par tokens et préfixes) + scoring
// des intents + désambiguïsation. Pas de modèle ML, mais une reconnaissance
// d'entités large et un fallback toujours utile.

import {
  PRODUITS, DISTRIBUTEURS, VENTES, WEEKS, CURRENT_WEEK,
  findDistributeur, findProduit, SOURCES,
} from '../data';
import type { Vente, Alerte, Gamme, Produit } from '../types';

export interface QAAnswer {
  text: string;
  bullets?: string[];
  link?: { label: string; to: string };
  followUps?: string[];
  // Propositions cliquables (désambiguïsation produit/distributeur)
  suggestions?: Array<{ label: string; query: string }>;
  amountsAreEUR?: boolean;
}

interface QAInput {
  question: string;
  alertes: Alerte[];
}

// --- Tokenisation -------------------------------------------------------

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'au', 'aux',
  'a', 'à', 'et', 'ou', 'ni', 'mais', 'donc', 'or', 'car',
  'est', 'sont', 'ont', 'a', 'ai', 'as', 'as', 'avait',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses',
  'ce', 'cet', 'cette', 'ces',
  'qui', 'que', 'quoi', 'dont', 'où', 'comment', 'quand', 'pourquoi',
  'me', 'te', 'se', 'lui', 'leur',
  'plus', 'moins', 'aussi', 'tres', 'peu', 'tout', 'tous', 'toute', 'toutes',
  'pour', 'par', 'avec', 'sans', 'sur', 'sous', 'dans', 'chez', 'vers', 'depuis',
  'pas', 'ne', 'non', 'oui',
  'silverlit', // toujours dans le contexte
  'donne', 'donner', 'dis', 'dire', 'montre', 'montrer', 'affiche', 'afficher', 'liste', 'lister',
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

// distance de Levenshtein (pour tolérer 1-2 typos)
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const v0 = new Array(b.length + 1).fill(0);
  const v1 = new Array(b.length + 1).fill(0);
  for (let j = 0; j <= b.length; j++) v0[j] = j;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

// --- Matching flou des produits ----------------------------------------

interface ProductMatch {
  produit: Produit;
  ean: string;
  score: number;
}

function scoreProductAgainstTokens(p: Produit, qTokens: string[]): number {
  const pTokens = tokenize(p.libelle);
  let score = 0;
  for (const qt of qTokens) {
    if (qt.length < 2) continue;
    let bestForQt = 0;
    for (const pt of pTokens) {
      let s = 0;
      if (pt === qt) s = 12;
      else if (pt.startsWith(qt) && qt.length >= 3) s = 8;
      else if (qt.startsWith(pt) && pt.length >= 3) s = 6;
      else if (pt.includes(qt) && qt.length >= 4) s = 5;
      else if (qt.length >= 4 && pt.length >= 4) {
        const d = lev(qt.slice(0, 6), pt.slice(0, 6));
        if (d === 1) s = 3;
        else if (d === 2 && Math.max(qt.length, pt.length) >= 6) s = 2;
      }
      if (s > bestForQt) bestForQt = s;
    }
    score += bestForQt;
  }
  // Bonus pour produits actifs
  if (p.statut === 'actif') score *= 1.1;
  // Penalité légère si trop de tokens dans le libellé sans match
  if (score > 0 && pTokens.length > qTokens.length + 3) score *= 0.92;
  return score;
}

function fuzzyMatchProducts(query: string, limit = 5): ProductMatch[] {
  const q = query.trim();
  // 1. EAN explicite
  const eanMatch = q.match(/\b\d{12,13}\b/);
  if (eanMatch) {
    const ean = eanMatch[0].padStart(13, '0');
    const p = findProduit(ean);
    if (p) return [{ produit: p, ean, score: 100 }];
  }
  // 2. Référence Silverlit (ex: 84150, 33-7013, 1001Z)
  const refRx = /\b\d{4,5}[a-zA-Z]?\b|\b\d{2}-\d{4}\b/;
  const refMatch = q.match(refRx);
  if (refMatch) {
    const ref = refMatch[0];
    const p = PRODUITS.find((x) => x.refFournisseur.toLowerCase() === ref.toLowerCase());
    if (p) return [{ produit: p, ean: p.ean, score: 95 }];
  }
  // 3. Matching flou par tokens
  const qTokens = tokenize(q);
  if (qTokens.length === 0) return [];
  const scored: ProductMatch[] = [];
  for (const p of PRODUITS) {
    const s = scoreProductAgainstTokens(p, qTokens);
    if (s > 0) scored.push({ produit: p, ean: p.ean, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// --- Distributeurs / gammes / périodes ---------------------------------

const DIST_PATTERNS: Array<{ id: string; rx: RegExp }> = [
  { id: 'joueclub', rx: /\b(joueclub|joue club|jc)\b/ },
  { id: 'recreaclub', rx: /\b(recrea\s?club|recrea|la grande recre|grande recre|lgr)\b/ },
  { id: 'kingjouet', rx: /\b(king\s?jouet|king\s?jouets|king)\b/ },
  { id: 'oxybul', rx: /\b(oxybul|eveil|eveil et jeux)\b/ },
  { id: 'fnacdarty', rx: /\b(fnac\s?darty|fnac|darty)\b/ },
  { id: 'smythstoys', rx: /\b(smyths\s?toys|smyths|smyth)\b/ },
  { id: 'galec', rx: /\b(galec|leclerc|e\s?leclerc)\b/ },
  { id: 'carrefour', rx: /\b(carrefour|crf)\b/ },
  { id: 'auchan', rx: /\b(auchan)\b/ },
  { id: 'amazon', rx: /\b(amazon|amz)\b/ },
  { id: 'cdiscount', rx: /\b(cdiscount|c\s?discount|cdi)\b/ },
];

function extractDistributeurs(q: string): string[] {
  const found = new Set<string>();
  for (const p of DIST_PATTERNS) if (p.rx.test(q)) found.add(p.id);
  return Array.from(found);
}

// Détection des familles de marques Silverlit dans une question
const GAMME_PATTERNS: Array<{ g: Gamme; rx: RegExp }> = [
  { g: 'EXOST', rx: /\b(exost|4\s?speed|crash\s?racers?|voiture\s?rc|rc\b|radiocommand)\b/ },
  { g: 'FLYBOTIC', rx: /\b(flybotic|drone|drones)\b/ },
  { g: 'YCOO', rx: /\b(ycoo|robot|robots|alien\s?vision|boxing\s?warriors?|astropod)\b/ },
  { g: 'ROBOCAR POLI', rx: /\b(robocar|poli|robocar\s?poli)\b/ },
  { g: 'OUAPS', rx: /\b(ouaps|hello\s?maestro|monchhichi|peluche|peluches|eveil|jojo|digibirds?)\b/ },
  { g: 'SPIROGRAPH', rx: /\b(spirograph|curligirls?|water\s?art|slime|creatif|creative|dissect)\b/ },
  { g: 'LAZER MAD', rx: /\b(lazer\s?mad|hydro\s?mad|monster\s?flex|spinner\s?mad|tetes?\s?brulees?)\b/ },
  { g: 'TOOKO', rx: /\b(tooko)\b/ },
];

function extractGamme(q: string): Gamme | null {
  for (const g of GAMME_PATTERNS) if (g.rx.test(q)) return g.g;
  return null;
}

interface PeriodFilter {
  label: string;
  weeks: Array<{ annee: number; semaine: number }>;
}

function extractPeriod(q: string): PeriodFilter {
  const matchN = q.match(/(\d+)\s*(dernie?re?s?\s+)?(semaines?|mois|jours?)/);
  if (matchN) {
    const n = parseInt(matchN[1], 10);
    const unit = matchN[3];
    if (/mois/.test(unit)) {
      const weeks = Math.min(WEEKS.length, n * 4);
      return { label: `${n} dernier${n > 1 ? 's' : ''} mois`, weeks: WEEKS.slice(-weeks) };
    }
    if (/jour/.test(unit)) {
      return { label: 'cette semaine', weeks: [CURRENT_WEEK] };
    }
    return { label: `${n} dernière${n > 1 ? 's' : ''} semaines`, weeks: WEEKS.slice(-Math.min(WEEKS.length, n)) };
  }
  if (/\bcette\s+semaine|semaine\s+en\s+cours|derniere?\s+semaine|s-?1\b/.test(q)) {
    return { label: 'semaine S-1', weeks: [CURRENT_WEEK] };
  }
  if (/\b4\s*sem|ce\s+mois|mois|mensuel\b/.test(q)) {
    return { label: '4 semaines glissantes', weeks: WEEKS.slice(-4) };
  }
  if (/\bce\s+trimestre|trimestre|3\s*mois|13\s*sem|trois\s+mois\b/.test(q)) {
    return { label: '13 semaines glissantes', weeks: WEEKS.slice(-13) };
  }
  if (/\bsemestre|6\s*mois|26\s*sem|six\s+mois\b/.test(q)) {
    return { label: '6 mois glissants', weeks: WEEKS.slice(-26) };
  }
  if (/\banne[er]|52\s*sem|12\s*mois|annuel|un\s+an\b/.test(q)) {
    return { label: '12 mois glissants', weeks: WEEKS.slice(-52) };
  }
  if (/\b24\s*mois|2\s*ans|deux\s+ans|historique\b/.test(q)) {
    return { label: '24 mois', weeks: WEEKS };
  }
  return { label: '13 semaines glissantes', weeks: WEEKS.slice(-13) };
}

// --- Filtres & agrégations ---------------------------------------------

function filterVentes(period: PeriodFilter, distIds?: string[], gamme?: Gamme | null, ean?: string): Vente[] {
  const weekSet = new Set(period.weeks.map((w) => `${w.annee}-${w.semaine}`));
  const distSet = distIds && distIds.length > 0 ? new Set(distIds) : null;
  const gammeEans = gamme
    ? new Set(PRODUITS.filter((p) => p.gamme === gamme).map((p) => p.ean))
    : null;
  return VENTES.filter((v) => {
    if (ean && v.ean !== ean) return false;
    if (!weekSet.has(`${v.annee}-${v.semaine}`)) return false;
    if (distSet && !distSet.has(v.distributeurId)) return false;
    if (gammeEans && !gammeEans.has(v.ean)) return false;
    return true;
  });
}

function totals(ventes: Vente[]) {
  let ca = 0, qte = 0;
  const refs = new Set<string>();
  let stock = 0;
  for (const v of ventes) {
    ca += v.caTTC;
    qte += v.qteVendue;
    refs.add(v.ean);
    stock = Math.max(stock, v.qteStock);
  }
  return { ca, qte, refs: refs.size, stock };
}

function topProducts(ventes: Vente[], n: number) {
  const map = new Map<string, { ca: number; qte: number }>();
  for (const v of ventes) {
    const c = map.get(v.ean) ?? { ca: 0, qte: 0 };
    c.ca += v.caTTC; c.qte += v.qteVendue;
    map.set(v.ean, c);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].ca - a[1].ca)
    .slice(0, n)
    .map(([ean, agg]) => ({ ean, libelle: findProduit(ean)?.libelle ?? ean, ...agg }));
}

function topDistribs(ventes: Vente[], n: number) {
  const map = new Map<string, { ca: number; qte: number }>();
  for (const v of ventes) {
    const c = map.get(v.distributeurId) ?? { ca: 0, qte: 0 };
    c.ca += v.caTTC; c.qte += v.qteVendue;
    map.set(v.distributeurId, c);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].ca - a[1].ca)
    .slice(0, n)
    .map(([id, agg]) => ({ id, nom: findDistributeur(id)?.nom ?? id, ...agg }));
}

// Période précédente comparable, ou null s'il n'existe pas d'historique
// antérieur — pour ne JAMAIS inventer un « 0 % » ou « +100 % vs précédent »
// quand il n'y a rien à comparer (même règle anti-faux-chiffre que le dashboard).
function previousPeriod(p: PeriodFilter): PeriodFilter | null {
  const len = p.weeks.length;
  const idxStart = WEEKS.findIndex((w) => w.annee === p.weeks[0].annee && w.semaine === p.weeks[0].semaine);
  if (idxStart <= 0) return null;
  return { label: 'précédente', weeks: WEEKS.slice(Math.max(0, idxStart - len), idxStart) };
}

function growthsByProduct(period: PeriodFilter, distIds?: string[], gamme?: Gamme | null) {
  const prevPeriod = previousPeriod(period);
  if (!prevPeriod) return [];  // pas d'antériorité → aucune croissance à calculer
  const cur = filterVentes(period, distIds, gamme);
  const prev = filterVentes(prevPeriod, distIds, gamme);
  const curM = new Map<string, number>();
  const prevM = new Map<string, number>();
  for (const v of cur) curM.set(v.ean, (curM.get(v.ean) ?? 0) + v.caTTC);
  for (const v of prev) prevM.set(v.ean, (prevM.get(v.ean) ?? 0) + v.caTTC);
  const out: Array<{ ean: string; libelle: string; caCur: number; caPrev: number; pct: number }> = [];
  const eans = new Set([...curM.keys(), ...prevM.keys()]);
  for (const e of eans) {
    const caCur = curM.get(e) ?? 0;
    const caPrev = prevM.get(e) ?? 0;
    if (caCur + caPrev < 50) continue;
    if (caPrev <= 0) continue;  // produit sans antériorité réelle → pas de % de croissance inventé
    const pct = ((caCur - caPrev) / caPrev) * 100;
    out.push({ ean: e, libelle: findProduit(e)?.libelle ?? e, caCur, caPrev, pct });
  }
  return out;
}

// --- Formatage ----------------------------------------------------------

function fmtEUR(amount: number): string {
  return `##EUR:${amount.toFixed(2)}##`;
}
function fmtPct(p: number): string {
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}%`;
}
function fmtNum(n: number): string {
  return n.toLocaleString('fr-FR');
}

// --- Détection d'intent -------------------------------------------------

interface IntentSignal {
  growth: boolean;
  decline: boolean;
  topAsked: boolean;
  flopAsked: boolean;
  compareAsked: boolean;
  ruptureAsked: boolean;
  alertAsked: boolean;
  priceAsked: boolean;
  stockAsked: boolean;
  availabilityAsked: boolean; // où acheter
  governanceAsked: boolean;
  salesAsked: boolean;
  overviewAsked: boolean;
  greetingAsked: boolean;
  helpAsked: boolean;
}

function detectSignals(q: string): IntentSignal {
  return {
    growth: /\b(croissance|monte|hausse|augmente|booste|envole|progress|cartonne|explose|decolle)\b/.test(q),
    decline: /\b(baisse|chute|recul|baisser|decroissance|flop|decline|en chute|tomber)\b/.test(q),
    topAsked: /\b(top|meilleur|cartonne|champion|premier|premiere|number\s?one|best|leader|locomotive|plus\s+vendu|le\s+mieux|hit)\b/.test(q),
    flopAsked: /\b(pire|moins\s+vendu|moins\s+bon|flop|faible|mauvais|le\s+moins|dernier|queue)\b/.test(q),
    compareAsked: /\b(compare|comparais|comparaison|vs|versus|contre|difference|entre|comparer|opposer)\b/.test(q),
    ruptureAsked: /\b(rupture|stockout|en\s+rupture|manque|epuise)\b/.test(q),
    alertAsked: /\b(alerte|anomalie|incident|warning|attention)\b/.test(q),
    priceAsked: /\b(prix|pvc|coute|coutent|cher|tarif|valeur|vente\s+a)\b/.test(q),
    stockAsked: /\b(stock|stocks|disponibilit|reserve|inventaire|combien\s+il\s+reste)\b/.test(q),
    availabilityAsked: /\b(ou\s+acheter|ou\s+trouver|ou\s+vendu|ou\s+est\s+vendu|disponible\s+chez|distribue\s+par|distribue\s+chez|qui\s+vend)\b/.test(q),
    governanceAsked: /\b(qualite|completude|score|source|import|fichier|format|gouvernance|retard|livraison|fraicheur)\b/.test(q),
    salesAsked: /\b(ca|chiffre|vente|vendu|combien|total|revenu|recette|volume|quantit)\b/.test(q),
    overviewAsked: /\b(comment\s+ca\s+va|ca\s+va|bilan|sante|forme|generale|resume|synthese|aper[cç]u|tableau\s+de\s+bord)\b/.test(q),
    greetingAsked: /^(salut|bonjour|hello|hi|coucou|hey|bonsoir|yo|hola)\b/.test(q),
    helpAsked: /\b(aide|help|que\s+peux|que\s+sais|comment\s+ca\s+marche|que\s+fais|capacit|que\s+savez)\b/.test(q),
  };
}

// --- Génération de réponses --------------------------------------------

function answerGreeting(): QAAnswer {
  return {
    text: 'Bonjour ! Je peux analyser vos ventes Silverlit en temps réel — top produits, comparaisons d\'enseignes, ruptures, tendances, gouvernance. Posez-moi une question ou tapez juste un nom de produit.',
    followUps: [
      'Top 5 produits chez Carrefour ce mois-ci',
      'Comment se vend le stunt drone ?',
      'Compare Carrefour et Auchan',
      'Qui est en rupture ?',
    ],
  };
}

function answerHelp(): QAAnswer {
  return {
    text: 'Je comprends les questions formulées librement. Quelques exemples :',
    bullets: [
      'Performance : "Comment va JouéClub ?", "CA total ce mois-ci"',
      'Comparaison : "Compare Carrefour, Auchan et Leclerc"',
      'Classements : "Top robots", "Pire produit cette semaine"',
      'Tendances : "Qui monte ?", "Quels produits chutent ?"',
      'Anomalies : "Ruptures actives", "Alertes prioritaires"',
      'Recherche libre : "stunt", "pokibot", "spirograph", "Robocar"',
      'Identification : "EAN du timinou", "Prix du Mega Bot"',
      'Distribution : "Où acheter le Stunt Drone ?"',
      'Gouvernance : "Qualité Cdiscount", "Source la plus en retard"',
    ],
    followUps: ['Top produits cette semaine', 'Quel distributeur cartonne ?'],
  };
}

function answerCompareDistribs(distIds: string[], period: PeriodFilter, gamme: Gamme | null): QAAnswer {
  const rows = distIds.map((id) => {
    const v = filterVentes(period, [id], gamme);
    const t = totals(v);
    return { id, nom: findDistributeur(id)?.nom ?? id, ...t };
  }).sort((a, b) => b.ca - a.ca);
  const winner = rows[0];
  const tail = rows.slice(1);
  return {
    text: `Comparaison sur ${period.label}${gamme ? ` · gamme ${gamme}` : ''}. **${winner.nom}** est en tête avec ${fmtEUR(winner.ca)}.`,
    bullets: rows.map((r, i) =>
      `${i + 1}. ${r.nom} — ${fmtEUR(r.ca)} · ${fmtNum(r.qte)} u. · ${r.refs} réfs`,
    ),
    link: { label: `Voir ${winner.nom}`, to: `/distributeurs/${winner.id}` },
    amountsAreEUR: true,
    followUps: tail.length > 0 ? [`Top produits chez ${winner.nom}`, `Top produits chez ${tail[0].nom}`] : undefined,
  };
}

function answerGrowth(period: PeriodFilter, distIds: string[], gamme: Gamme | null): QAAnswer {
  const g = growthsByProduct(period, distIds.length ? distIds : undefined, gamme);
  const top = g.filter((x) => x.caPrev > 100).sort((a, b) => b.pct - a.pct).slice(0, 5);
  if (top.length === 0) return { text: 'Pas assez de données stables sur la période pour repérer une croissance.' };
  const distLabel = distIds.length === 1 ? ` chez ${findDistributeur(distIds[0])?.nom}` : '';
  return {
    text: `Plus fortes croissances sur ${period.label}${distLabel}${gamme ? ` · ${gamme}` : ''} :`,
    bullets: top.map((p) => `${p.libelle} · ${fmtPct(p.pct)} (${fmtEUR(p.caPrev)} → ${fmtEUR(p.caCur)})`),
    link: { label: 'Voir la fiche du leader', to: `/produits/${top[0].ean}` },
    amountsAreEUR: true,
  };
}

function answerDecline(period: PeriodFilter, distIds: string[], gamme: Gamme | null): QAAnswer {
  const g = growthsByProduct(period, distIds.length ? distIds : undefined, gamme);
  const worst = g.filter((x) => x.caPrev > 100).sort((a, b) => a.pct - b.pct).slice(0, 5);
  if (worst.length === 0) return { text: 'Pas assez de données stables pour repérer une baisse.' };
  return {
    text: `Plus fortes baisses sur ${period.label} :`,
    bullets: worst.map((p) => `${p.libelle} · ${fmtPct(p.pct)} (${fmtEUR(p.caPrev)} → ${fmtEUR(p.caCur)})`),
    amountsAreEUR: true,
  };
}

function answerRupture(alertes: Alerte[], distIds: string[]): QAAnswer {
  const filtered = alertes.filter((a) => a.statut === 'ouverte' && a.type === 'rupture');
  const matched = distIds.length > 0 ? filtered.filter((a) => distIds.includes(a.distributeurId ?? '')) : filtered;
  if (matched.length === 0) return { text: 'Aucune rupture active correspondant à votre demande.' };
  return {
    text: `${matched.length} rupture${matched.length > 1 ? 's' : ''} active${matched.length > 1 ? 's' : ''} :`,
    bullets: matched.map((a) => `${a.libelle} · ${findDistributeur(a.distributeurId ?? '')?.nom ?? '—'} — ${a.message}`),
    link: { label: 'Voir toutes les alertes', to: '/alertes' },
  };
}

function answerAlerts(alertes: Alerte[]): QAAnswer {
  const ouv = alertes.filter((a) => a.statut === 'ouverte');
  const haute = ouv.filter((a) => a.severite === 'haute').length;
  return {
    text: `${ouv.length} alerte${ouv.length > 1 ? 's' : ''} ouverte${ouv.length > 1 ? 's' : ''}, dont **${haute}** prioritaire${haute > 1 ? 's' : ''}.`,
    bullets: ouv.slice(0, 6).map((a) => {
      const d = a.distributeurId ? findDistributeur(a.distributeurId)?.nom : null;
      return `${a.libelle} · ${a.type}${d ? ` · ${d}` : ''}`;
    }),
    link: { label: 'Voir tout', to: '/alertes' },
  };
}

function answerTopProducts(period: PeriodFilter, distIds: string[], gamme: Gamme | null, n = 5): QAAnswer {
  const ventes = filterVentes(period, distIds.length ? distIds : undefined, gamme);
  const top = topProducts(ventes, n);
  if (top.length === 0) return { text: 'Aucune vente sur cette période avec ces filtres.' };
  const ctx = [
    distIds.length === 1 ? `chez ${findDistributeur(distIds[0])?.nom}` : distIds.length > 1 ? `chez ${distIds.length} enseignes` : '',
    gamme ? `· ${gamme}` : '',
    `sur ${period.label}`,
  ].filter(Boolean).join(' ');
  return {
    text: `Top ${n} produits ${ctx} :`,
    bullets: top.map((t, i) => `${i + 1}. ${t.libelle} — ${fmtEUR(t.ca)} · ${fmtNum(t.qte)} u.`),
    link: { label: 'Voir le n°1', to: `/produits/${top[0].ean}` },
    followUps: top.length > 1 ? [`Détail du ${top[0].libelle}`, `Détail du ${top[1].libelle}`] : undefined,
    amountsAreEUR: true,
  };
}

function answerFlopProducts(period: PeriodFilter, gamme: Gamme | null): QAAnswer {
  const ventes = filterVentes(period, undefined, gamme);
  const map = new Map<string, { ca: number; qte: number }>();
  for (const v of ventes) {
    const c = map.get(v.ean) ?? { ca: 0, qte: 0 };
    c.ca += v.caTTC; c.qte += v.qteVendue;
    map.set(v.ean, c);
  }
  const arr = Array.from(map.entries())
    .filter(([, agg]) => agg.qte > 0)
    .sort((a, b) => a[1].ca - b[1].ca)
    .slice(0, 5)
    .map(([ean, agg]) => ({ ean, libelle: findProduit(ean)?.libelle ?? ean, ...agg }));
  if (arr.length === 0) return { text: 'Pas de données significatives sur cette période.' };
  return {
    text: `Produits les moins vendus sur ${period.label}${gamme ? ` (${gamme})` : ''} :`,
    bullets: arr.map((t, i) => `${i + 1}. ${t.libelle} — ${fmtEUR(t.ca)} · ${t.qte} u.`),
    amountsAreEUR: true,
  };
}

function answerTopDistribs(period: PeriodFilter, gamme: Gamme | null): QAAnswer {
  const ventes = filterVentes(period, undefined, gamme);
  const top = topDistribs(ventes, DISTRIBUTEURS.length);
  return {
    text: `Classement des distributeurs sur ${period.label}${gamme ? ` (${gamme})` : ''} :`,
    bullets: top.slice(0, 6).map((t, i) => `${i + 1}. ${t.nom} — ${fmtEUR(t.ca)} · ${fmtNum(t.qte)} u.`),
    link: { label: 'Voir tous les distributeurs', to: '/distributeurs' },
    amountsAreEUR: true,
  };
}

function answerProductInfo(p: Produit, period: PeriodFilter, signals: IntentSignal): QAAnswer {
  const v = filterVentes(period, undefined, null, p.ean);
  const t = totals(v);
  const byDist = topDistribs(v, 3);

  // Prix
  if (signals.priceAsked) {
    return {
      text: `**${p.libelle}** — Prix de vente conseillé : ${fmtEUR(p.prixConseille)}. Gamme ${p.gamme}, statut ${p.statut}.`,
      link: { label: 'Voir la fiche', to: `/produits/${p.ean}` },
      amountsAreEUR: true,
    };
  }
  // EAN / identification
  if (/\b(ean|gencod|code|reference)\b/.test(normalize(p.libelle))) {
    // (fallback - shouldn't really hit, but for safety)
  }
  // Stock
  if (signals.stockAsked) {
    return {
      text: `**${p.libelle}** — Stock max constaté ${fmtNum(t.stock)} unités sur ${period.label}, réparti sur ${byDist.length} distributeur${byDist.length > 1 ? 's' : ''}.`,
      bullets: byDist.map((d) => `${d.nom} — ${fmtNum(d.qte)} u. vendues`),
      link: { label: 'Voir la fiche', to: `/produits/${p.ean}` },
    };
  }
  // Où acheter
  if (signals.availabilityAsked) {
    return {
      text: `**${p.libelle}** est distribué via ces enseignes sur ${period.label} :`,
      bullets: byDist.length > 0
        ? byDist.map((d) => `${d.nom} — ${fmtEUR(d.ca)} · ${fmtNum(d.qte)} u.`)
        : ['Aucune vente sur la période.'],
      link: { label: 'Voir la fiche', to: `/produits/${p.ean}` },
      amountsAreEUR: true,
    };
  }
  // Fiche standard
  return {
    text: `**${p.libelle}** (EAN ${p.ean}, réf. ${p.refFournisseur}) — gamme ${p.gamme}, statut ${p.statut}, PVC ${fmtEUR(p.prixConseille)}. Sur ${period.label} : ${fmtEUR(t.ca)} de CA, ${fmtNum(t.qte)} u. vendues.`,
    bullets: byDist.length > 0 ? byDist.map((d) => `${d.nom} — ${fmtEUR(d.ca)} · ${fmtNum(d.qte)} u.`) : undefined,
    link: { label: 'Ouvrir la fiche produit', to: `/produits/${p.ean}` },
    amountsAreEUR: true,
  };
}

function answerDistributeurInfo(distId: string, period: PeriodFilter, gamme: Gamme | null): QAAnswer {
  const d = findDistributeur(distId)!;
  const v = filterVentes(period, [distId], gamme);
  const t = totals(v);
  const prevPeriod = previousPeriod(period);
  const tPrev = totals(prevPeriod ? filterVentes(prevPeriod, [distId], gamme) : []);
  const delta = prevPeriod && tPrev.ca > 0 ? ((t.ca - tPrev.ca) / tPrev.ca) * 100 : null;
  const top = topProducts(v, 3);
  return {
    text: `**${d.nom}** sur ${period.label}${gamme ? ` (${gamme})` : ''} : ${fmtEUR(t.ca)} de CA${delta !== null ? ` (${fmtPct(delta)} vs précédent)` : ''}, ${fmtNum(t.qte)} u., ${t.refs} réfs.`,
    bullets: top.map((p, i) => `${i + 1}. ${p.libelle} — ${fmtEUR(p.ca)} · ${fmtNum(p.qte)} u.`),
    link: { label: `Ouvrir ${d.nom}`, to: `/distributeurs/${d.id}` },
    followUps: [`Top produits ${d.nom}`, `Qualité source ${d.nom}`],
    amountsAreEUR: true,
  };
}

function answerGovernance(distIds: string[]): QAAnswer {
  if (distIds.length === 1) {
    const s = SOURCES.find((x) => x.distributeurId === distIds[0]);
    const d = findDistributeur(distIds[0]);
    if (s && d) {
      return {
        text: `Source **${d.nom}** : format ${s.format} via ${s.canal} (${s.periodicite}), qualité **${s.scoreQualite}/100**, complétude ${s.semainesRecues}/${s.semainesAttendues} semaines.`,
        bullets: s.problemes.length > 0 ? s.problemes : ['Aucun problème en cours.'],
        link: { label: 'Voir la gouvernance', to: '/gouvernance' },
      };
    }
  }
  // Moyenne sur les sources ACTIVES uniquement (au moins une semaine reçue),
  // comme la page Gouvernance — sinon les sources sans données écrasent le
  // score et le chatbot contredit l'écran (44 vs 87).
  const actives = SOURCES.filter((s) => s.semainesRecues > 0);
  const moy = actives.length > 0
    ? actives.reduce((s, x) => s + x.scoreQualite, 0) / actives.length
    : 0;
  const enRetard = SOURCES
    .filter((s) => s.semainesRecues < s.semainesAttendues)
    .sort((a, b) => (a.semainesRecues / a.semainesAttendues) - (b.semainesRecues / b.semainesAttendues));
  return {
    text: `Score qualité moyen ${moy.toFixed(0)}/100 sur ${actives.length} source${actives.length > 1 ? 's' : ''} active${actives.length > 1 ? 's' : ''}. ${enRetard.length} en retard.`,
    bullets: enRetard.slice(0, 5).map((s) => {
      const d = findDistributeur(s.distributeurId);
      return `${d?.nom} — ${s.semainesRecues}/${s.semainesAttendues} sem. (score ${s.scoreQualite})`;
    }),
    link: { label: 'Ouvrir la gouvernance', to: '/gouvernance' },
  };
}

function answerSales(period: PeriodFilter, distIds: string[], gamme: Gamme | null): QAAnswer {
  const v = filterVentes(period, distIds.length ? distIds : undefined, gamme);
  const prevPeriod = previousPeriod(period);
  const prev = prevPeriod ? filterVentes(prevPeriod, distIds.length ? distIds : undefined, gamme) : [];
  const t = totals(v);
  const tPrev = totals(prev);
  const dCa = prevPeriod && tPrev.ca > 0 ? ((t.ca - tPrev.ca) / tPrev.ca) * 100 : null;
  const dQte = prevPeriod && tPrev.qte > 0 ? ((t.qte - tPrev.qte) / tPrev.qte) * 100 : null;
  const ctx = distIds.length === 1
    ? `chez ${findDistributeur(distIds[0])?.nom}`
    : distIds.length > 1 ? `pour ${distIds.length} enseignes` : '';
  return {
    text: `Sur ${period.label}${ctx ? ` ${ctx}` : ''}${gamme ? ` · ${gamme}` : ''} : ${fmtEUR(t.ca)} de CA${dCa !== null ? ` (${fmtPct(dCa)} vs précédent)` : ''}, ${fmtNum(t.qte)} u.${dQte !== null ? ` (${fmtPct(dQte)})` : ''}, ${t.refs} réfs.`,
    link: { label: 'Voir le pilotage', to: '/pilotage' },
    amountsAreEUR: true,
  };
}

function answerOverview(period: PeriodFilter, alertes: Alerte[]): QAAnswer {
  const v = filterVentes(period);
  const t = totals(v);
  const ouv = alertes.filter((a) => a.statut === 'ouverte').length;
  const top = topProducts(v, 1)[0];
  const topD = topDistribs(v, 1)[0];
  return {
    text: `Bilan ${period.label} : ${fmtEUR(t.ca)} de CA, ${fmtNum(t.qte)} u., ${ouv} alerte${ouv > 1 ? 's' : ''} ouverte${ouv > 1 ? 's' : ''}.`,
    bullets: [
      top ? `Produit n°1 : ${top.libelle} (${fmtEUR(top.ca)})` : '',
      topD ? `Enseigne n°1 : ${topD.nom} (${fmtEUR(topD.ca)})` : '',
    ].filter(Boolean),
    link: { label: 'Voir le pilotage', to: '/pilotage' },
    amountsAreEUR: true,
  };
}

function answerDisambiguation(matches: ProductMatch[]): QAAnswer {
  return {
    text: `J'ai trouvé plusieurs produits qui correspondent. Lequel cherchez-vous ?`,
    suggestions: matches.slice(0, 5).map((m) => ({
      label: m.produit.libelle,
      query: m.produit.libelle,
    })),
  };
}

// --- Routeur principal --------------------------------------------------

export function answer({ question, alertes }: QAInput): QAAnswer {
  const raw = question.trim();
  if (!raw) return { text: 'Posez-moi une question.' };
  const q = normalize(raw);

  const signals = detectSignals(q);
  if (signals.greetingAsked && q.length < 30) return answerGreeting();
  if (signals.helpAsked) return answerHelp();

  const distIds = extractDistributeurs(q);
  const gamme = extractGamme(q);
  const period = extractPeriod(q);
  const matches = fuzzyMatchProducts(raw, 5);

  // --- Priorité 1 : Comparaison entre distributeurs ---
  if (distIds.length >= 2 && signals.compareAsked) {
    return answerCompareDistribs(distIds, period, gamme);
  }

  // --- Priorité 2 : Croissance/baisse ---
  if (signals.growth && !signals.decline) return answerGrowth(period, distIds, gamme);
  if (signals.decline && !signals.growth) return answerDecline(period, distIds, gamme);

  // --- Priorité 3 : Ruptures / alertes ---
  if (signals.ruptureAsked) return answerRupture(alertes, distIds);
  if (signals.alertAsked) return answerAlerts(alertes);

  // --- Priorité 4 : Flop ---
  if (signals.flopAsked) return answerFlopProducts(period, gamme);

  // --- Priorité 5 : Top (avec ou sans produit/enseigne) ---
  if (signals.topAsked) {
    // "Top distributeur(s)" / "meilleur enseigne"
    if (/\b(distributeur|enseigne|magasin|partenaire)\b/.test(q) && matches.length === 0) {
      return answerTopDistribs(period, gamme);
    }
    // Demande "top X chez Y" ou "top X" en général
    return answerTopProducts(period, distIds, gamme);
  }

  // --- Priorité 6 : Gouvernance ---
  if (signals.governanceAsked) return answerGovernance(distIds);

  // --- Priorité 7 : Information produit (fiche, prix, stock, où acheter) ---
  if (matches.length > 0) {
    const top = matches[0];
    const second = matches[1];
    // Désambiguïsation si 2 matches très proches en score ET pas de signal clair
    const ambiguous =
      second &&
      second.score >= top.score * 0.75 &&
      !signals.priceAsked && !signals.stockAsked && !signals.availabilityAsked;
    if (ambiguous && matches.length >= 2 && top.score < 20) {
      return answerDisambiguation(matches);
    }
    return answerProductInfo(top.produit, period, signals);
  }

  // --- Priorité 8 : Information distributeur seul ---
  if (distIds.length === 1) {
    return answerDistributeurInfo(distIds[0], period, gamme);
  }

  // --- Priorité 9 : CA / volumes ---
  if (signals.salesAsked) return answerSales(period, distIds, gamme);

  // --- Priorité 10 : Bilan général ---
  if (signals.overviewAsked) return answerOverview(period, alertes);

  // --- Fallback intelligent : si une gamme est mentionnée, donner un focus gamme ---
  if (gamme) {
    const v = filterVentes(period, distIds.length ? distIds : undefined, gamme);
    const t = totals(v);
    const top = topProducts(v, 3);
    return {
      text: `Gamme **${gamme}** sur ${period.label} : ${fmtEUR(t.ca)} de CA, ${fmtNum(t.qte)} u., ${t.refs} réfs actives.`,
      bullets: top.map((p, i) => `${i + 1}. ${p.libelle} — ${fmtEUR(p.ca)} · ${fmtNum(p.qte)} u.`),
      link: { label: 'Voir les produits', to: '/produits' },
      amountsAreEUR: true,
    };
  }

  // --- Vrai fallback : suggestions intelligentes ---
  return {
    text: 'Je n\'ai pas réussi à identifier précisément votre demande. Essayez par exemple :',
    suggestions: [
      { label: 'Top 5 produits ce trimestre', query: 'Top 5 produits ce trimestre' },
      { label: 'Comment va Carrefour ?', query: 'Comment va Carrefour ?' },
      { label: 'Ruptures actives', query: 'Ruptures actives' },
      { label: 'Qualité des sources', query: 'Qualité des sources' },
    ],
  };
}
