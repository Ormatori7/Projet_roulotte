# La Roulotte : API back-end

API de click & collect pour un food-truck : consulter la carte, passer commande, suivre sa préparation en direct, payer en ligne.

Projet de groupe : Clément (t3mq), Antoine (Ormatori), Thomas (Thomas_pereira).

## État du projet

| Palier | Contenu | État |
| --- | --- | --- |
| 1 | Socle, authentification fournie branchée, carte, commandes | Fait |
| 2 | Administration des plats, stock, cycle de vie des commandes | Fait |
| 3 | Observabilité, cache, temps réel, photos des plats | Fait |
| 4 | Paiement en ligne via un prestataire | Fait (hors options) |

La présentation orale portait sur les paliers 1 et 2. La section suivante décrit ce qui a été ajouté depuis.

## Ce qui a été fait depuis la présentation

### Rattrapage du palier 2 : le stock (Thomas)

- Commander décrémente le stock dans la même transaction que la création de la commande.
- Décrément conditionnel (`updateMany` avec `stock >= quantité`) : deux commandes simultanées ne peuvent pas vendre plus de portions que le stock.
- Stock insuffisant : 409 `OUT_OF_STOCK` avec le détail `{ dishId, available }`, et rien n'est consommé.

### Palier 3

**Observabilité (Clément)**

- `GET /health` interroge réellement la base : `{ "status": "ok", "database": "up" }`, ou 503 si elle ne répond pas.
- En-tête `X-Request-Id` unique sur chaque réponse, succès comme erreur.
- Logs structurés avec pino : une ligne JSON par requête (identifiant, méthode, URL, statut, durée).

**Cache de la carte (Clément)**

- `CachedMenuRepository` enveloppe le repository Prisma du menu (pattern Decorator). Même interface, donc le service ne sait pas qu'un cache existe.
- Le cache est vidé à chaque écriture sur un plat et à chaque commande créée ou modifiée, car le stock affiché change.

**Bus d'événements (Clément)**

- `EventBus` (pattern Observer). `OrderService` publie `order.created` et `order.updated` sans connaître ceux qui écoutent.
- Deux abonnés aujourd'hui : le cache et le temps réel.

**Temps réel (Thomas)**

- `GET /events` : flux Server-Sent Events, authentifié.
- `order.created` est envoyé à la cuisine et à l'admin. `order.updated` est envoyé au client de la commande, à la cuisine et à l'admin.
- Commentaire `: ping` toutes les 25 secondes pour garder la connexion ouverte.

**Photos des plats (Antoine)**

- `PUT /dishes/:id/image`, réservé à l'admin. 2 Mo maximum (413), contenu du fichier vérifié (415 si ce n'est pas une image).
- Une nouvelle photo remplace l'ancienne, dont le fichier est supprimé.
- Les fichiers sont servis sur `/uploads`.

### Palier 4 : le paiement

**Route et règles (Clément)**

- Migration `payment` : champ `paymentStatus` sur les commandes, `UNPAID` à la création.
- `POST /orders/:id/payment`, corps `{ "token": "tok_visa" }`.
- Seul le client de la commande peut payer : 404 pour un autre client, 403 pour la cuisine et l'admin.
- Commande déjà payée ou annulée : 409 `CONFLICT`, sans appeler le prestataire.
- Le montant envoyé au prestataire vient de la base, jamais du client.
- Après paiement, `order.updated` est publié : la cuisine voit la commande payée en direct.

**Factory et faux prestataire (Clément)**

- `PaymentService` ne dépend que de l'interface `PaymentGateway`.
- `createPaymentGateway(config)` choisit le prestataire selon `PAYMENT_PROVIDER` : `http` (le vrai) ou `fake` (aucun appel réseau, utilisé par les tests).

**Adaptateur HTTP (Thomas)**

- `HttpPaymentGateway` traduit notre interface vers l'API du prestataire (pattern Adapter).
- 2 secondes maximum par tentative, 3 tentatives au total.
- Un refus de la banque (402) n'est pas réessayé : 402 `PAYMENT_DECLINED`.
- Prestataire en panne : 502 `PAYMENT_PROVIDER_ERROR`. Trop lent : 504 `PAYMENT_PROVIDER_TIMEOUT`.
- Même `Idempotency-Key` sur toutes les tentatives d'un paiement : le client n'est jamais débité deux fois.

## Stack

Node.js 22, TypeScript strict, Express 5, Prisma 7 avec SQLite, Zod, Vitest et Supertest, pino.

## Installation

```bash
npm install
cp .env.example .env
```

Renseigner `JWT_SECRET` dans `.env` (16 caractères au moins), puis :

```bash
npx prisma migrate dev
npm run seed
```

## Lancer

```bash
npm run dev
```

L'API écoute sur `http://localhost:3000` (variable `PORT`).

Pour le paiement, lancer aussi le simulateur fourni, depuis le dossier du kit :

```bash
npm run paiement
```

## Variables d'environnement

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `PORT` | Port d'écoute | `3000` |
| `DATABASE_URL` | Fichier SQLite | obligatoire |
| `JWT_SECRET` | Secret des jetons, 16 caractères au moins | obligatoire |
| `JWT_EXPIRES_IN` | Durée de validité d'un jeton | `2h` |
| `CORS_ORIGIN` | Adresse du front autorisée | obligatoire |
| `PAYMENT_PROVIDER` | `http` ou `fake` | `http` |
| `PAYMENT_URL` | Adresse du prestataire de paiement | `http://localhost:4010` |
| `PAYMENT_API_KEY` | Clé secrète du prestataire | `sk_test_roulotte` |

La configuration est validée au démarrage avec Zod : l'API refuse de démarrer si une variable manque.

## Tests

```bash
npm run typecheck
npm test
```

92 tests : services avec de faux repositories, routes HTTP avec Supertest sur une application sans base, et transactions (stock, annulation) sur une base SQLite jetable.

La recette automatique du kit se lance depuis le dossier du kit, API démarrée :

```bash
npm run recette:4
```

## Architecture

```
src/
  server.ts          point d'entrée
  app.ts             middlewares et routes
  container.ts       composition root : tout est fabriqué et branché ici
  config/env.ts      configuration validée
  db/prisma.ts       client Prisma unique
  shared/            erreurs, logger, identifiant de requête, bus d'événements
  fourni/auth/       module d'authentification fourni (non modifié)
  modules/
    menu/            carte, administration, photos, cache
    orders/          commandes, statuts
    payment/         paiement
    events/          temps réel (SSE)
    health/          état de la base
    users/           repository des utilisateurs
```

Chaque module suit les mêmes couches : routes, controller, service, repository.

- Le controller valide l'entrée avec Zod et met en forme la réponse. Aucune règle métier.
- Le service porte les règles. Il ne connaît ni `req`, ni `res`, ni Prisma, seulement des interfaces.
- Le repository est le seul endroit où Prisma est utilisé.

Toutes les erreurs ont la même forme : `{ "error": { "code", "message", "details"? } }`.

## Patterns utilisés

| Pattern | Où | Pourquoi |
| --- | --- | --- |
| Repository | chaque module | isoler Prisma, tester les services sans base |
| Injection par constructeur | `container.ts` | remplacer une dépendance sans toucher au code qui l'utilise |
| Singleton | `db/prisma.ts` | une seule connexion à la base |
| Machine à états | `order.status.ts` | les transitions autorisées sont une table, pas des `if` |
| Decorator | `CachedMenuRepository` | ajouter un cache sans modifier le repository |
| Observer | `EventBus` | le service publie, le cache et le SSE réagissent |
| Adapter | `HttpPaymentGateway` | isoler l'API du prestataire |
| Factory | `payment.factory.ts` | un seul endroit choisit le prestataire |

## Routes principales

| Méthode | Route | Accès |
| --- | --- | --- |
| GET | `/health` | public |
| POST | `/auth/register`, `/auth/login` | public |
| GET | `/auth/me` | connecté |
| GET | `/categories`, `/allergens`, `/dishes`, `/dishes/:id` | public |
| POST, PATCH, DELETE | `/dishes`, `/dishes/:id` | admin |
| PUT | `/dishes/:id/image` | admin |
| POST, GET | `/orders`, `/orders/:id` | connecté |
| PATCH | `/orders/:id/status` | cuisine et admin, ou client pour annuler |
| POST | `/orders/:id/payment` | client de la commande |
| GET | `/events` | connecté |

Le contrat complet est dans `openapi.yaml`, fourni avec le kit.

## Limites connues

- Le cache, le bus d'événements et la liste des clients SSE sont en mémoire : ils supposent une seule instance de l'API.
- Si le prestataire débite puis que l'écriture en base échoue, la commande reste `UNPAID` alors que le client est débité. Un système réel enregistrerait chaque tentative et se réconcilierait avec le prestataire.

## Reste à faire

- Options du palier 4 : documentation Swagger sur `/docs` et intégration continue GitHub Actions.
- Poser les étiquettes `palier-1` à `palier-4` et fusionner `dev` dans `main`.
