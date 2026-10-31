# Déployer EventPass (Neon + Render + Vercel)

Ce guide met EventPass en ligne avec trois offres gratuites. Il est écrit pour être refait seul,
de zéro : suivre les étapes **dans l'ordre**, une plateforme à la fois.

```mermaid
flowchart LR
    V["Navigateur"] -->|"pages React<br/>https://…vercel.app"| VE["Vercel<br/>fichiers statiques"]
    V -->|"appels API (CORS)<br/>https://…onrender.com/api/v1"| R["Render<br/>conteneur Docker de l'API"]
    R -->|"SQL chiffré (TLS)"| N[("Neon<br/>PostgreSQL")]
```

| Plateforme | Rôle | Ce qui est dans le dépôt |
|---|---|---|
| **Neon** | Base PostgreSQL | rien (création à la main) |
| **Render** | API Express, construite depuis `backend/Dockerfile` | [`render.yaml`](../render.yaml) (« Blueprint ») |
| **Vercel** | Interface React (build Vite) | [`frontend/vercel.json`](../frontend/vercel.json) |

## Pourquoi cet ordre ?

Chaque plateforme a besoin d'une information produite par la précédente :

1. **Neon** fournit l'adresse de la base → nécessaire à Render (`DATABASE_URL`).
2. **Render** fournit l'URL de l'API → nécessaire à Vercel (`VITE_API_URL`, figée au build).
3. **Vercel** fournit l'URL du site → nécessaire à Render (`CORS_ORIGIN`). D'où un **retour
   sur Render** à la fin : on ne connaît l'URL de Vercel qu'après sa création, et CORS se règle
   côté API sans rien reconstruire.

## Les variables de production

| Où | Variable | Valeur |
|---|---|---|
| Render | `DATABASE_URL` | chaîne de connexion Neon (étape 1) — **secrète** |
| Render | `JWT_SECRET` | valeur aléatoire ≥ 32 caractères — **secrète** |
| Render | `QR_SECRET` | autre valeur aléatoire, **différente** de `JWT_SECRET` — **secrète** |
| Render | `CORS_ORIGIN` | URL du site Vercel, sans `/` final |
| Render | `NODE_ENV`, `TRUST_PROXY`, `DEMO_RESET_ON_START`, `READ_ONLY_EMAILS`, `JWT_EXPIRES_IN` | déjà fixées dans `render.yaml` |
| Vercel | `VITE_API_URL` | `https://<service>.onrender.com/api/v1` — publique (visible dans le JavaScript) |

Générer un secret (à faire deux fois, une valeur pour `JWT_SECRET`, une pour `QR_SECRET`) :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Les secrets de production doivent être **différents de ceux du `.env` local** : si un fichier
local fuit, la production reste protégée. Les garder dans un gestionnaire de mots de passe :
ils ne doivent apparaître ni dans le dépôt, ni dans une capture d'écran.

---

## Étape 1 — Neon (base de données)

1. Sur [console.neon.tech](https://console.neon.tech), créer un projet (**New Project**) :
   - **Project name** : `eventpass`
   - **Postgres version** : la plus récente proposée
   - **Cloud provider / Region** : **AWS — Europe Central 1 (Frankfurt)**, la même région que
     l'API sur Render, pour limiter le temps de chaque requête SQL.
2. Une fois le projet créé, cliquer sur **Connect** (tableau de bord du projet) :
   - **Branch** `main`, **Database** `neondb`, **Role** `neondb_owner` (valeurs par défaut) ;
   - **désactiver « Connection pooling »** : on veut l'adresse directe (le nom d'hôte ne doit
     **pas** contenir `-pooler`). Voir l'encadré ci-dessous ;
   - copier la **Connection string**. Elle ressemble à :
     `postgresql://neondb_owner:XXXX@ep-xxx-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
3. **Modifier la fin** de cette chaîne : remplacer `?sslmode=require&channel_binding=require`
   par **`?sslmode=verify-full`**. Résultat :
   `postgresql://neondb_owner:XXXX@ep-xxx-123456.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full`
4. Garder cette chaîne de côté (elle contient le mot de passe de la base) : elle servira à
   l'étape 2. Rien d'autre à faire sur Neon : les tables sont créées par l'API à son démarrage
   (migrations automatiques).

> **Pourquoi l'adresse directe et pas « pooled » ?** Le pooler de Neon (PgBouncer en mode
> transaction) partage les connexions entre clients transaction par transaction. L'outil de
> migration utilise un verrou de *session* PostgreSQL pour ne jamais lancer deux migrations en
> même temps ; ce type de verrou n'est pas fiable à travers un pooler. Notre API a déjà son
> propre pool (10 connexions) : l'adresse directe suffit largement.
>
> **Pourquoi `sslmode=verify-full` ?** La connexion traverse Internet : elle doit être chiffrée
> (TLS) et le certificat du serveur vérifié, pour être sûr de parler à Neon. C'est ce que fait
> déjà la bibliothèque `pg` avec `require` (en affichant un avertissement) ; `verify-full`
> l'écrit explicitement.

✅ **Point d'étape** : la chaîne de connexion est prête (ne pas la partager).

---

## Étape 2 — Render (API)

1. Sur [dashboard.render.com](https://dashboard.render.com) : **New +** → **Blueprint**.
2. Connecter le dépôt GitHub **`zakaech/EventPass`** (autoriser l'accès au dépôt si Render le
   demande), branche `main`. Render lit `render.yaml` et propose de créer le service
   **`eventpass-api`** (type *Web Service*, *Docker*, plan *Free*, région *Frankfurt*).
3. Render demande les valeurs marquées `sync: false` :
   - `DATABASE_URL` : la chaîne Neon de l'étape 1 ;
   - `JWT_SECRET` : le premier secret ;
   - `QR_SECRET` : le second secret ;
   - `CORS_ORIGIN` : mettre provisoirement `https://eventpass.vercel.app` (corrigé à l'étape 4).
4. **Deploy Blueprint** (ou **Apply**). Le premier déploiement construit l'image Docker
   (5 à 10 minutes). Dans l'onglet **Logs** du service, on doit voir :
   ```
   Migrations…
   Démo : réinitialisation des données…
   Données de démo insérées.
   API EventPass démarrée sur http://localhost:10000/api/v1
   ```
   (Render impose le port 10000 via la variable `PORT`, lue par l'API.)
5. Récupérer l'URL du service, en haut de sa page : `https://eventpass-api.onrender.com`
   (ou avec un suffixe si le nom est déjà pris).
6. Vérifier dans un navigateur : `https://<service>.onrender.com/api/v1/health` doit afficher
   `{"status":"ok","database":"ok",…}`.

> **Ce que fait `render.yaml`** : il décrit le service « en tant que code » (Infrastructure as
> Code). Recréer le service, ou le relire dans six mois, ne dépend plus de clics oubliés.
> `healthCheckPath` : à chaque déploiement, Render attend que `/api/v1/health` réponde avant
> d'envoyer le trafic à la nouvelle version (pas de coupure si la nouvelle version plante).
> `buildFilter` : seul un changement dans `backend/` redéploie l'API.

### Variante : créer le service à la main (si le Blueprint demande une carte bancaire)

Le résultat est le même service que celui décrit par `render.yaml`, saisi champ par champ.
**New +** → **Web Service** → onglet **Git Provider** → dépôt `zakaech/EventPass`, puis :

| Champ | Valeur |
|---|---|
| Name | `eventpass-api` |
| Language | `Docker` |
| Branch | `main` |
| Region | `Frankfurt (EU Central)` |
| Root Directory | *(laisser vide)* |
| Dockerfile Path | `./backend/Dockerfile` |
| Docker Build Context Directory | `./backend` |
| Instance Type | **Free** (512 Mo, 0,1 CPU) |

**Environment Variables** (bouton *Add Environment Variable*, une ligne par variable) :

| Clé | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | chaîne Neon de l'étape 1 (`…?sslmode=verify-full`) |
| `JWT_SECRET` | premier secret |
| `QR_SECRET` | second secret |
| `CORS_ORIGIN` | `https://eventpass.vercel.app` (provisoire, corrigé à l'étape 4) |
| `TRUST_PROXY` | `1` |
| `DEMO_RESET_ON_START` | `true` |
| `READ_ONLY_EMAILS` | `admin@eventpass.dev` |
| `JWT_EXPIRES_IN` | `2h` |

Ne pas définir `PORT` : Render le fournit (10000). Section **Advanced** :

- **Health Check Path** : `/api/v1/health` ;
- **Docker Command** : vide (l'image lance déjà `scripts/docker-entrypoint.sh`) ;
- **Build Filters** : *Included Paths* `backend/**` ; *Ignored Paths* `backend/tests/**` et
  `backend/requests/**` ;
- **Auto-Deploy** : `On Commit`.

Puis **Deploy Web Service** et reprendre au point 4 ci-dessus (logs, URL, `/health`).
Contrepartie : `render.yaml` n'est plus la source de vérité ; une modification faite dans le
fichier doit aussi être reportée à la main dans le tableau de bord.

✅ **Point d'étape** : `/api/v1/health` répond `"ok"` ; noter l'URL du service.

---

## Étape 3 — Vercel (interface)

1. Sur [vercel.com/new](https://vercel.com/new) : **Import** du dépôt **`zakaech/EventPass`**.
2. Dans l'écran de configuration :
   - **Project Name** : `eventpass` ;
   - **Root Directory** : **Edit** → choisir **`frontend`** (le frontend est dans un
     sous-dossier du dépôt) ;
   - **Framework Preset** : *Vite* (détecté ; les commandes viennent de `vercel.json`) ;
   - **Environment Variables** : ajouter `VITE_API_URL` =
     `https://<service>.onrender.com/api/v1` (l'URL de l'étape 2, suivie de `/api/v1`, sans `/`
     final).
3. **Deploy**. Le build prend environ une minute.
4. Récupérer l'URL de production : onglet **Domains** du projet (par exemple
   `https://eventpass.vercel.app`, ou `https://eventpass-xxxx.vercel.app`). Attention : les
   URL plus longues de type `eventpass-git-…` ou `eventpass-abc123-…` sont des déploiements
   ponctuels ; c'est le domaine de production qu'il faut retenir.

> **Pourquoi `VITE_API_URL` est-elle figée au build ?** Le navigateur ne lit pas de fichier
> `.env` : Vite remplace `import.meta.env.VITE_API_URL` par sa valeur, en texte, dans le
> JavaScript produit. Changer cette variable sur Vercel n'a d'effet qu'après un **Redeploy**.
> Et tout ce qui commence par `VITE_` est lisible par n'importe qui : jamais de secret ici.
>
> **Ce que fait `vercel.json`** : `rewrites` renvoie `index.html` pour toute URL qui n'est pas
> un fichier (`/mes-billets`, `/organisateur/scanner`…) ; sans cela, rafraîchir ces pages
> donnerait une erreur 404, car c'est React Router qui les gère dans le navigateur. Les
> fichiers de `/assets` (nom contenant une empreinte du contenu) sont mis en cache un an.

✅ **Point d'étape** : le site s'affiche ; noter son URL de production.

---

## Étape 4 — Retour sur Render : autoriser le site (CORS)

Le site (`…vercel.app`) et l'API (`…onrender.com`) sont sur deux domaines différents : le
navigateur bloque les appels de l'un vers l'autre, sauf si l'API autorise explicitement
l'origine du site. C'est le rôle de `CORS_ORIGIN`.

1. Render → service **eventpass-api** → **Environment**.
2. Modifier `CORS_ORIGIN` : l'URL exacte de l'étape 3, **sans `/` final**
   (ex. `https://eventpass.vercel.app`). Plusieurs origines possibles, séparées par des
   virgules.
3. **Save Changes** : Render redéploie l'API (2 à 3 minutes).
4. Ouvrir le site Vercel : la liste des événements s'affiche, la connexion fonctionne.

✅ **Point d'étape** : le site est en ligne.

---

## Vérifier le déploiement

À la main, en 5 minutes :

- page d'accueil et liste des événements ; rafraîchir la page sur `/evenements` (pas de 404) ;
- se connecter avec `alice@eventpass.dev` / `Password123!` → **Mes billets** → **Afficher** ;
- se connecter avec `sonora@eventpass.dev` → **Scanner** → autoriser la caméra (le site est en
  HTTPS : la caméra du téléphone fonctionne directement) → scanner le QR d'Alice sur un autre
  écran : **Entrée validée**, puis **Déjà utilisé** ;
- se connecter avec `admin@eventpass.dev` : message « lecture seule », boutons désactivés.

Automatiquement (scénario Playwright de 11 étapes, 3 connexions seulement) :

```bash
cd e2e
npm install
E2E_BASE_URL=https://<projet>.vercel.app \
E2E_API_URL=https://<service>.onrender.com/api/v1 \
node production.mjs
```

---

## Et ensuite ? Mises à jour

- **Un `git push` sur `main` met à jour la production** : Vercel reconstruit le frontend à
  chaque push ; Render redéploie l'API quand `backend/` change.
- **Revenir en arrière** : Vercel → *Deployments* → un ancien déploiement → *Promote to
  Production* ; Render → *Events* → un ancien déploiement → *Rollback*.
- **Changer un secret** : Render → *Environment* → modifier → *Save Changes*. Changer
  `JWT_SECRET` déconnecte tout le monde ; changer `QR_SECRET` change tous les QR codes.

## Le mode « démo publique »

Deux réglages de `render.yaml` sont propres à une démo ouverte à tous :

- **`DEMO_RESET_ON_START=true`** : à chaque démarrage, l'API efface la base et réinsère les
  données de démo, avec des dates calculées par rapport au jour même. Le service gratuit
  s'endort après 15 minutes sans visite, donc la démo repart d'un état propre très souvent :
  les événements restent « à venir », *Live au Point Éphémère* est toujours en cours (billets
  à scanner) et les essais des visiteurs ne s'accumulent pas. **À retirer pour un vrai site**,
  puisque toutes les données sont effacées à chaque redémarrage.
- **`READ_ONLY_EMAILS=admin@eventpass.dev`** : ce compte, dont le mot de passe est public, peut
  tout consulter dans l'espace admin, mais le serveur refuse ses actions d'écriture (validation
  ou refus d'un organisateur), avec un message clair dans l'interface.

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Dans les logs Render : `Variables d'environnement invalides` | Variable manquante ou trop courte | Render → *Environment* : vérifier les 4 valeurs secrètes (secrets ≥ 32 caractères, différents) |
| Logs : `getaddrinfo ENOTFOUND` ou `password authentication failed` | `DATABASE_URL` mal copiée | Recopier la chaîne Neon (étape 1) |
| Site affiché mais « Impossible de joindre le serveur » ; dans la console du navigateur : *blocked by CORS policy* | `CORS_ORIGIN` ne correspond pas exactement à l'URL du site | Étape 4 : même URL, `https`, sans `/` final |
| Requêtes vers `https://…vercel.app/api/v1/…` en 404 | `VITE_API_URL` absente au moment du build | Vercel → *Settings → Environment Variables*, puis *Deployments → Redeploy* |
| « Le serveur démarre… » pendant ~1 minute | Service Render en veille (normal sur l'offre gratuite) | Attendre ; voir les limites ci-dessous |
| 404 en rafraîchissant `/mes-billets` | `vercel.json` non pris en compte | Vérifier que *Root Directory* vaut bien `frontend` |

## Limites de l'hébergement gratuit

- **Render (Free)** : le service s'endort après **15 minutes sans requête** ; le premier visiteur
  suivant attend son redémarrage (environ 30 à 60 secondes, d'où le message « Le serveur
  démarre… »). 512 Mo de mémoire, CPU partagé, 750 heures d'instance par mois. Un redéploiement
  ou un réveil remet la démo à zéro (`DEMO_RESET_ON_START`).
- **Neon (Free)** : la base se met en pause après 5 minutes d'inactivité (réveil en moins d'une
  seconde) ; 0,5 Go de stockage, quota mensuel d'heures de calcul. Pas d'expiration de la base,
  contrairement à la base gratuite de Render (30 jours).
- **Vercel (Hobby)** : réservé à un usage personnel et non commercial ; bande passante et
  nombre de builds limités, largement suffisants pour une démo.
- **Pas de domaine personnalisé** ici (possible gratuitement sur Vercel avec un domaine acheté).
