# Déploiement — rendre les invitations partageables

Tant que l'app tourne sur `localhost`, les liens d'invitation ne sont
**transmissibles à personne** : `localhost` désigne la machine de chacun.
Pour des invitations réelles, il faut **deux URL publiques** :

1. **Le front-end** — pour que le lien d'invitation s'ouvre chez l'invité
2. **Le back-end + base de données** — pour que l'invitation créée par
   l'admin soit visible par l'invité (stockage partagé, pas du `localStorage`)

Les deux sont gratuits à déployer. Compter ~20 min.

---

## Étape 1 — Mettre le projet sur GitHub

```bash
cd /Users/arthur/Desktop/classification/silverlit-analytics
git init && git add -A && git commit -m "Silverlit Analytics"
# créer un dépôt sur github.com puis :
git remote add origin https://github.com/VOTRE-COMPTE/silverlit-analytics.git
git push -u origin main
```

## Étape 2 — Back-end + base de données (Render)

1. Sur [render.com](https://render.com) → **New ▸ Blueprint** → sélectionner le dépôt
2. Render lit `server/render.yaml` : il crée **le service API + la base Postgres**
3. Renseigner les variables marquées `sync: false` :
   - `SEED_ADMIN_PASSWORD` — le mot de passe du compte admin
   - `RESEND_API_KEY` + `EMAIL_FROM` — *(optionnel)* pour l'envoi auto d'emails
   - `FRONTEND_URL` — à compléter après l'étape 3
4. Au déploiement, l'API démarre, applique le schéma et crée le compte admin.
   URL obtenue : `https://silverlit-analytics-api.onrender.com`

## Étape 3 — Front-end (Vercel)

1. Sur [vercel.com](https://vercel.com) → **Add New ▸ Project** → sélectionner le dépôt
2. Vercel détecte Vite automatiquement (`vercel.json` est déjà fourni)
3. Ajouter une variable d'environnement :
   - `VITE_API_URL` = `https://silverlit-analytics-api.onrender.com/api`
4. Déployer. URL obtenue : `https://silverlit-analytics.vercel.app`

## Étape 4 — Relier les deux

1. Retourner sur Render → service API → variable `FRONTEND_URL`
   = `https://silverlit-analytics.vercel.app` → redéployer
2. C'est terminé.

---

## Résultat

- Le site est public : `https://silverlit-analytics.vercel.app`
- L'app détecte automatiquement le back-end → **mode API** (auth réelle,
  stockage partagé)
- Une invitation créée par l'admin **est visible par tous** — le lien
  `https://silverlit-analytics.vercel.app/invitation?token=…` fonctionne
  sur n'importe quel appareil
- Avec une clé Resend : l'email part automatiquement.
  Sans clé : l'admin copie le lien (désormais public et valide) ou
  l'envoie via sa messagerie — et **ça fonctionne pour de vrai**.

## Notes

- Le plan gratuit Render met l'API en veille après inactivité : le premier
  appel après une pause prend ~30 s, puis c'est instantané.
- Pour l'envoi d'emails Resend : créer un compte, vérifier un domaine
  (ou utiliser l'adresse de test), récupérer la clé API.
- Sécurité : `JWT_SECRET` est généré par Render, les mots de passe sont
  hachés (bcrypt), CORS est restreint à `FRONTEND_URL`.
