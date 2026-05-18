<div align="center">

<br>

<sub>SILVERLIT FRANCE&nbsp;&nbsp;·&nbsp;&nbsp;2026</sub>

# Silverlit Analytics

<p><em>Une seule plateforme pour lire toutes les ventes,<br>
chez tous les distributeurs, sur toutes les semaines.</em></p>

<br>

<img src="https://img.shields.io/badge/Statut-En_production-e30613?style=for-the-badge&labelColor=1d1d1f" alt="Statut">
&nbsp;
<img src="https://img.shields.io/badge/Acc%C3%A8s-Web_·_sans_installation-1d1d1f?style=for-the-badge&labelColor=1d1d1f" alt="Web">
&nbsp;
<img src="https://img.shields.io/badge/Conception-ANIZIA-5b54e8?style=for-the-badge&labelColor=1d1d1f" alt="ANIZIA">

<br><br>

</div>

<hr>

<br>

<sub>**LE PROBLÈME**</sub>

## Pourquoi cet outil existe

Les ventes Silverlit France remontent **enseigne par enseigne**, dans des
formats différents : Excel King Jouet, exports Qlik Carrefour, extractions
Amazon, fichiers PDF Joué Club. Chaque fichier vit dans sa propre boîte
mail, son propre SharePoint, son propre logiciel.

Pour répondre à une question aussi simple que *« comment se vend l'EXOST
360 cross chez Auchan cette semaine ? »*, il faut ouvrir trois fichiers et
faire un tableau croisé à la main.

> **Silverlit Analytics est la réponse unique à ce problème.**
> Une seule plateforme, toutes les enseignes, tous les produits,
> toutes les semaines — du sell-out brut jusqu'à l'infographie
> commerciale prête à envoyer.

<br>
<hr>
<br>

<sub>**LES UTILISATEURS**</sub>

## À qui ça sert

<table>
<tr>
<td width="40"><sub>01</sub></td>
<td width="240"><strong>Direction commerciale</strong></td>
<td>Vue d'ensemble du CA, comparatifs N/N-1, top distributeurs</td>
</tr>
<tr>
<td><sub>02</sub></td>
<td><strong>Chef de produit</strong></td>
<td>Performance par référence, ruptures, fins de vie à anticiper</td>
</tr>
<tr>
<td><sub>03</sub></td>
<td><strong>Compte-clé (KAM)</strong></td>
<td>Tout ce qui concerne <em>son</em> enseigne — détaillé jusqu'au magasin</td>
</tr>
<tr>
<td><sub>04</sub></td>
<td><strong>Marketing &amp; communication</strong></td>
<td>Visuels et chiffres prêts pour les comités, les pitchs, les newsletters</td>
</tr>
<tr>
<td><sub>05</sub></td>
<td><strong>Direction générale</strong></td>
<td>Reçoit chaque semaine les alertes et l'infographie hebdomadaire</td>
</tr>
</table>

<br>
<hr>
<br>

<sub>**LE PÉRIMÈTRE**</sub>

## Ce qu'on peut faire dedans

Neuf écrans, dans cet ordre logique.

<table>
<tr>
<td width="33%" valign="top">

<sub>01&nbsp;·&nbsp;ACCUEIL</sub>

### Pilotage
La vue 30 secondes : CA de la semaine, évolution vs N-1, top 5
distributeurs, top 5 produits, et les 3 alertes prioritaires.
*L'écran qu'on ouvre le lundi matin.*

</td>
<td width="33%" valign="top">

<sub>02&nbsp;·&nbsp;CATALOGUE</sub>

### Produits
Les **186 références** Silverlit, filtrables par marque (EXOST, FLYBOTIC,
YCOO, ROBOCAR POLI, OUAPS…) et par statut. Une fiche par produit
avec courbe, top enseignes, prix moyen.

</td>
<td width="33%" valign="top">

<sub>03&nbsp;·&nbsp;ENSEIGNES</sub>

### Distributeurs
Les **11 partenaires** (Amazon, King Jouet, Carrefour, Auchan, Joué Club,
Récréa Club, Cdiscount, Smyths, Fnac Darty, Oxybul, Galec). Export Excel
au format interne Silverlit en un clic.

</td>
</tr>
<tr>
<td valign="top">

<sub>04&nbsp;·&nbsp;DONNÉES</sub>

### Import
La porte d'entrée. On y dépose les fichiers reçus des distributeurs ;
l'app détecte le format, parse, range. Un mode d'emploi pas-à-pas
détaille chaque source.

</td>
<td valign="top">

<sub>05&nbsp;·&nbsp;VIGILANCE</sub>

### Alertes
Liste centralisée : ruptures, chutes inhabituelles, nouvelles entrées en
assortiment, fins de vie. Chaque alerte peut être **traitée**,
**masquée** ou **démasquée** — historique conservé.

</td>
<td valign="top">

<sub>06&nbsp;·&nbsp;PARTAGE</sub>

### Infographie
Génère un **PNG prêt à envoyer** comparant N et N-1, avec les chiffres
clés et les top produits. Pour les newsletters internes, les comités
ou les présentations clients.

</td>
</tr>
<tr>
<td valign="top">

<sub>07&nbsp;·&nbsp;TRANSPARENCE</sub>

### Gouvernance
D'où viennent les données, quand elles ont été importées, qui a
transmis ses fichiers, qui manque. Suivi du calendrier de remontée
hebdomadaire.

</td>
<td valign="top">

<sub>08&nbsp;·&nbsp;ADMIN</sub>

### Équipe
Pour inviter de nouvelles personnes. L'admin saisit un email,
l'invité crée son mot de passe, et obtient un accès lecture ou
complet selon le rôle.

</td>
<td valign="top">

<sub>09&nbsp;·&nbsp;COMPTE</sub>

### Profil
Préférences personnelles : devise d'affichage (€/£/$), thème clair
ou sombre, gestion du mot de passe.

</td>
</tr>
</table>

<br>

> **Bonus : Poli, l'assistant conversationnel intégré.**
> On lui pose une question en langage naturel
> (*« ventes du Flybotic Bumper chez Cdiscount sur 4 semaines ? »*)
> et il répond directement à partir des données importées.

<br>
<hr>
<br>

<sub>**LE FLUX**</sub>

## Comment ça fonctionne

```
   Fichiers reçus                  Silverlit Analytics
   ─────────────────               ──────────────────────────

   King Jouet   .xlsm  ─┐
   Carrefour    .xlsx  ─┤          Lecture & normalisation
   Amazon       .csv   ─┼──────▶   Base de ventes unifiée
   Joué Club    .pdf   ─┤          (EAN × distributeur × semaine)
   …                   ─┘                     │
                                              │
                                              ▼
                                   Dashboards · Alertes ·
                                   Exports Excel · Infographie
                                              │
                                              ▼
                                   Toute l'équipe Silverlit,
                                   partout, depuis un navigateur
```

Côté utilisateur, c'est un **site web** : on l'ouvre dans Chrome, Safari
ou Edge, on se connecte avec son email et son mot de passe, tout est là.
Rien à installer.

<br>
<hr>
<br>

<sub>**LES DONNÉES**</sub>

## Où elles vivent

<table>
<tr>
<td width="50%" valign="top">

<sub>AUJOURD'HUI</sub>

### Mode local
Les données vivent dans le navigateur de chaque utilisateur. Pratique
pour la démo et l'usage individuel. Chaque personne a sa propre copie ;
les imports ne sont pas partagés.

</td>
<td width="50%" valign="top">

<sub>DEMAIN</sub>

### Mode partagé
Une base centrale héberge les ventes une seule fois. Tout le monde
voit les mêmes chiffres en temps réel, les invitations deviennent
réelles, l'admin suit qui fait quoi.

</td>
</tr>
</table>

> **En clair.** Tant que l'outil tourne en local, il fonctionne mais
> sur votre machine uniquement. Pour ouvrir l'accès à toute l'équipe,
> il reste l'étape de déploiement — documentée dans `DEPLOIEMENT.md`,
> compter ~20 minutes.

<br>
<hr>
<br>

<sub>**LA SÉCURITÉ**</sub>

## Confidentialité

<table>
<tr>
<td width="200"><strong>Mots de passe</strong></td>
<td>Jamais stockés en clair · hachés (bcrypt)</td>
</tr>
<tr>
<td><strong>Sessions</strong></td>
<td>Token signé · expiration automatique</td>
</tr>
<tr>
<td><strong>Hébergement</strong></td>
<td>Prévu chez un hébergeur européen · RGPD</td>
</tr>
<tr>
<td><strong>Tiers</strong></td>
<td>Aucun envoi externe · aucun tracking publicitaire</td>
</tr>
<tr>
<td><strong>Propriété</strong></td>
<td>Code source intégralement Silverlit · auditable ligne par ligne</td>
</tr>
</table>

<br>
<hr>
<br>

<sub>**LA TRAJECTOIRE**</sub>

## Roadmap

<table>
<tr>
<td width="120"><sub><strong>LIVRÉ</strong></sub></td>
<td>Imports manuels · dashboards · alertes · exports Excel · infographie</td>
</tr>
<tr>
<td><sub><strong>LIVRÉ</strong></sub></td>
<td>Assistant conversationnel Poli (questions en langage naturel)</td>
</tr>
<tr>
<td><sub><strong>EN COURS</strong></sub></td>
<td>Bascule en mode partagé (déploiement serveur Silverlit)</td>
</tr>
<tr>
<td><sub><strong>À VENIR</strong></sub></td>
<td>Connexion API directe avec Qlik / SAP — fin des imports manuels</td>
</tr>
<tr>
<td><sub><strong>À VENIR</strong></sub></td>
<td>Alertes par email automatique (résumé hebdo direction)</td>
</tr>
<tr>
<td><sub><strong>EXPLORATION</strong></sub></td>
<td>Module sell-in (livraisons Silverlit → enseigne)</td>
</tr>
<tr>
<td><sub><strong>EXPLORATION</strong></sub></td>
<td>Comparatifs marché (parts de marché vs concurrence)</td>
</tr>
</table>

<br>
<hr>
<br>

<sub>**POUR LES DÉVELOPPEURS**</sub>

## Mise en route

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # bundle de production
```

Stack : **React 19** · **TypeScript** · **Vite** · **Tailwind 3** ·
**Recharts**. Backend optionnel : **Node + Express + Postgres**.
Aucune dépendance payante.

Le détail technique — architecture API, déploiement, schéma base de
données — vit dans [`DEPLOIEMENT.md`](./DEPLOIEMENT.md).

<br>

<div align="center">

<br>
<hr style="width:120px;border:none;border-top:1px solid #d2d2d7">
<br>

<sub>Conçu et développé par <strong>ANIZ<span style="color:#5b54e8">IA</span></strong>&nbsp;&nbsp;·&nbsp;&nbsp;Silverlit France&nbsp;&nbsp;·&nbsp;&nbsp;2026</sub>

<br><br>

</div>
