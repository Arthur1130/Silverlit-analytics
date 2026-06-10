# SUIVI PROJET — Silverlit Analytics (ANIZIA)

> **Document de reprise.** À lire en premier dans une nouvelle conversation
> pour reprendre le projet sans l'historique. Tout le code est sur GitHub
> (`Arthur1130/Silverlit-analytics`), commits détaillés.

## 1. Le projet en 1 phrase
Plateforme web de pilotage des ventes Silverlit France : on dépose les fichiers
de ventes des distributeurs → consolidation, valorisation, dashboard, export.
Marque de l'outil : **ANIZIA**. Client final : Silverlit (contact : Chris).

## 2. Accès
- **URL en ligne** : https://silverlit-analytics.vercel.app
- **Comptes de référence** (en dur dans `src/api/backend.ts`, filet de sécurité) :
  `arthur1130` / `arthur1234` · `pls1406` / `Fontaine28` · `silverlit.all` / `transverse.silverlit`
- **Repo** : GitHub `Arthur1130/Silverlit-analytics` (push = redéploiement Vercel auto)

## 3. Stack & déploiement
- Front : React 18 + TypeScript + Vite 5 + Tailwind 3 + Recharts 2, déployé sur **Vercel**
- Back : **fonctions serverless Vercel** dans `/api` (`batches.ts`, `users.ts`, `login.ts`)
- Base : **Neon Postgres** (via Vercel Storage, région Frankfurt), var `POSTGRES_URL`
- Build : `npm run build` (tsc -b + vite build). Toujours vérifier le build avant push.

## 4. RÈGLES MÉTIER NON NÉGOCIABLES
- **CA = quantité × prix grille (PVC)**, jamais les montants des fichiers sources
  (certains distributeurs ne donnent pas le CA). Grille = `src/data/products.ts`.
- **Quantités NETTES** (ventes − retours).
- **Aucun chiffre inventé** affiché : tout vient d'un vrai fichier, ou est marqué « non disponible ».

## 5. Données actuelles (chiffres de contrôle validés par le client)
- King Jouet S1 : **2274 u. / 51 869 €**
- JouéClub S1 : **1949 u. / 42 316 €** (CA légèrement < attendu car 5 réfs hors grille)
- Données figées (« seed ») dans `src/data/realSales.ts`, dérivées des fichiers bruts.

## 6. Architecture clé
- **Moteur d'import** `src/utils/importEngine.ts` : lit le fichier (colonnes par NOM
  d'en-tête, pas par position — gère les variations de format), agrège par EAN,
  valorise via la grille. Formats gérés : `jol-utf16` (King Jouet, UTF-16/tab),
  `joueclub-csv` (JouéClub, Windows-1252/`;`). Ajouter un distributeur = une entrée dans FORMATS.
- **Store des lots** `src/data/importBatches.ts` : chaque import = un « lot » (nom,
  distributeur, semaine, fichier). `hydrateFromServer()` au démarrage (main.tsx) charge
  depuis la base EN LIGNE (`/api/batches`) ; mutations écrites en base. Repli localStorage si base injoignable.
- **Dashboard** lit `VENTES` (= `getAllVentes()` des lots) via `src/utils/selectors.ts`.
- **Export Excel** `src/utils/exportDistribTable.ts` : format Tableau des Ventes
  (4 blocs par marque : QTES N-1, QTES N, CA N-1, CA N + sous-totaux + TOUTES GAMMES).
  Boutons sur pages Distributeurs + fiche distributeur.
- **Auth** `src/api/backend.ts` (localBackend) : `signIn` vérifie comptes de référence
  d'abord (filet), puis base via `/api/login`. Création de comptes via page Équipe → `/api/users`.

## 7. Fichiers sources du client (sur le Mac d'Arthur)
- `/Users/arthur/Desktop/Retour chris/Base Prix 1.xlsx` — grille de prix (PVC)
- `/Users/arthur/Desktop/Retour chris/nouveaux/s10 kj stat/` — 10 semaines King Jouet (format JOL, UTF-16)
- `/Users/arthur/Desktop/Retour chris/nouveaux/s10 joueclub stat/` — 10 semaines JouéClub
- `/Users/arthur/Desktop/Retour chris/nouveaux/TB Vierge.xlsx` — TEMPLATE CIBLE de l'export (onglet TAB VENTES (2))
- ⚠️ Particularité : le fichier King Jouet S1 contient des lignes 2025 ET 2026 mélangées.

## 8. CE QUI EST FAIT ✅
- Vrai moteur d'import (bug des semaines suivantes corrigé : lecture par nom de colonne)
- Dépôt multi-fichiers (plusieurs semaines d'un coup)
- Export au format Tableau des Ventes (structure conforme, pas pixel-près)
- Nettoyage complet des chiffres fabriqués (alertes, gouvernance, par-magasin, deltas, labels)
- **Base de données en ligne** : imports partagés sur tous les appareils
- **Création de comptes depuis le site** (page Équipe → Créer un compte, base partagée, mots de passe hachés)

## 9. CE QUI RESTE À FAIRE ⏳

### ⭐ PRIORITÉ DEMANDÉE PAR ARTHUR — Comparatif année sur année (N vs N-1) par semaine
Construire un **vrai comparatif N / N-1 au niveau global**, semaine par semaine
(pas le « glissant » actuel de `previousPeriodVentes`).
- **Besoin** : pour chaque numéro de semaine (S1…S52), comparer **2026 (N)** vs **2025 (N-1)**
  — même numéro de semaine, cette année vs l'an dernier. Vue « glissante à l'année ».
- **À construire** :
  1. Nouveau sélecteur dans `src/utils/selectors.ts`, ex `compareYoY(ventes)` :
     - N = année max présente dans les données ; N1 = N − 1.
     - Retourne, pour chaque semaine 1..52 : `{ semaine, caN, caN1, qteN, qteN1 }`.
     - + totaux globaux : ΣcaN, ΣcaN1, évolution % ; idem quantités.
  2. Section sur **Pilotage** (`src/pages/Pilotage.tsx`) :
     - Graphique avec **2 courbes superposées** (N et N-1) sur les 52 semaines (Recharts, 2 `<Area>`/`<Line>`).
     - KPIs globaux : **CA N vs CA N-1 + évolution %**, **Qté N vs N-1 + évolution %**.
     - N'afficher l'évolution que si N-1 a des données (sinon « — », cf. règle anti-faux-chiffre).
  3. Tester avec des semaines correspondantes (importer 2026-Sx ET 2025-Sx, mêmes numéros).
- **Note data** : aujourd'hui en base il y a 2026-S1 + des semaines 2025 éparses (S28, S35…).
  Le comparatif ne s'affiche que là où N et N-1 ont la **même** semaine. C'est normal.

### Track B — Export pixel-près
1. **Track B — Export pixel-près** : remplir directement le gabarit `TB Vierge.xlsx`
   (colonnes LIVRE/TAUX REVENTE, formules, mise en forme) au lieu de la structure actuelle.
2. **Track C — Mail à Chris** : demander les **fichiers hebdo 2025** pour avoir le N-1
   réel (critère d'acceptation de Chris : « charger N et N-1 sur un distributeur »).
   Aujourd'hui seul le S1 est chargé ; le N-1 (2025) manque.
3. **Autres distributeurs** : ajouter leurs formats dans `importEngine.ts` quand leurs fichiers arrivent
   (référentiel des 11 enseignes dans `src/data/distributors.ts`).
4. **5 réfs JouéClub hors grille** : à compléter dans la grille de prix pour fiabiliser le CA.

## 10. Retour client (Chris) — priorités
- **P1 (fiabilité données)** : calcul OK + multi-semaines OK. Reste « N et N-1 » → bloqué sur fichiers 2025.
- **P2 (export format)** : structure conforme livrée. Pixel-près = Track B si demandé.

## 11. Comment reprendre dans une nouvelle conversation
1. Dire à Claude : « lis SUIVI_PROJET.md à la racine du projet »
2. `git log --oneline -20` pour voir l'historique récent
3. Vérifier l'état déployé : ouvrir `/api/batches` (doit renvoyer du JSON)
4. Continuer par le Track voulu (B, C, ou autres distributeurs)
