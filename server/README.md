# Silverlit Analytics — Back-end

API Node + Express + Postgres pour l'authentification, la gestion des
utilisateurs et les invitations (envoi d'emails via Resend).

## Prérequis

- Node.js 20+
- Une base Postgres (locale ou hébergée — Supabase, Railway, Neon…)
- Un compte [Resend](https://resend.com) (optionnel — sans clé, les invitations
  sont créées et le lien est loggé en console, sans envoi réel)

## Installation

```bash
cd server
npm install
cp .env.example .env
# → éditer .env : DATABASE_URL, JWT_SECRET, RESEND_API_KEY, EMAIL_FROM…
```

Générer un `JWT_SECRET` solide :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Base de données

```bash
npm run migrate     # crée les tables + le compte admin initial
```

Le compte admin est défini par les variables `SEED_ADMIN_*` du `.env`
(par défaut : `arthur1130` / `arthur1234`).

## Lancer

```bash
npm run dev         # développement (rechargement à chaud)
npm run build && npm start   # production
```

Le serveur écoute sur `http://localhost:4000` (configurable via `PORT`).
Vérification : `GET http://localhost:4000/api/health`.

## Endpoints

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| POST | `/api/auth/login` | public | — |
| GET | `/api/auth/me` | authentifié | — |
| GET | `/api/users` | admin | liste |
| PATCH | `/api/users/:id` | admin | change le rôle |
| DELETE | `/api/users/:id` | admin | supprime |
| GET | `/api/invitations` | admin | liste |
| POST | `/api/invitations` | admin | crée + envoie l'email |
| POST | `/api/invitations/:id/resend` | admin | renvoie l'email |
| POST | `/api/invitations/:id/cancel` | admin | annule |
| GET | `/api/invitations/verify?token=` | public | vérifie un lien |
| POST | `/api/invitations/accept` | public | crée le compte |
| POST | `/api/demandes` | public | soumet une demande d'accès |
| GET | `/api/demandes` | admin | liste |
| PATCH | `/api/demandes/:id` | admin | change le statut |

## Authentification

JWT signé (`JWT_SECRET`), transmis par le front dans l'en-tête
`Authorization: Bearer <token>`. Mots de passe hachés avec bcrypt.

> Durcissement production : passer le JWT en cookie `httpOnly` + `SameSite`,
> activer HTTPS, et restreindre CORS au domaine de déploiement.

## Emails (Resend)

`POST /api/invitations` envoie un email contenant un lien
`{FRONTEND_URL}/invitation?token=...`. La personne invitée y crée son compte.

Sans `RESEND_API_KEY`, le serveur démarre quand même : l'invitation est
enregistrée et le lien est renvoyé dans la réponse + loggé en console
(pratique pour tester sans configurer Resend).
