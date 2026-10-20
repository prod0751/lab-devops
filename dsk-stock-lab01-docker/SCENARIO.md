# Lab 01 — Mettre en service DSK Stock avec Docker Compose

## Votre mission

Vous rejoignez une équipe qui suit son matériel informatique dans des fichiers partagés. Elle vous confie **DSK Stock** : vous devez installer l’interface React servie par Nginx, l’API NestJS et PostgreSQL, puis prouver que les données survivent à la recréation des conteneurs.

**Niveau :** débutant. **Durée indicative :** 1 à 2 heures, hors préparation de l’environnement et téléchargement des images. Le lab fonctionne sur un poste Docker (notamment macOS avec Docker Desktop), une machine Linux ou une VM. Aucun cluster Kubernetes n’est nécessaire.

**Compétences travaillées :** construction d’images, services Docker Compose, réseau interne, proxy inverse Nginx, volumes nommés, healthchecks, migrations Prisma et sauvegardes PostgreSQL.

## 1. Prérequis

- Docker Engine ou Docker Desktop fonctionnel : `docker version`.

- Docker Compose v2 : `docker compose version`.

- `curl` pour les vérifications HTTP ; `openssl` pour générer un secret ; `python3` seulement si vous utilisez un script de validation externe.

- Ressources indicatives : 2 vCPU, 4 Go de RAM et 20 Go de stockage disponible.

Vérifiez que les ports **8080** (interface) et **3001** (API) sont disponibles. Dans cette version du lab, les ports sont fixés dans `compose.yaml` et l’adresse d’écoute est configurée avec `BIND_IP` dans `.env`.

## 1.1 Installer Docker Engine et Docker Compose sur Ubuntu 24.04 LTS

> Cette installation concerne une machine Ubuntu 24.04 (`noble`). Sur macOS ou Windows, utilisez Docker Desktop. Si Docker est déjà installé et fonctionnel, passez directement à la section 2.

### Étape 1 — Mettre à jour le système et installer les dépendances
```bash
sudo apt update

sudo apt install -y ca-certificates curl gnupg
```

### Étape 2 — Ajouter la clé de signature officielle Docker
```bash
sudo install -m 0755 -d /etc/apt/keyrings

sudo curl -fsSL https\://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc

sudo chmod a+r /etc/apt/keyrings/docker.asc
```

**Attention :** Ubuntu utilise `https\://download.docker.com/linux/ubuntu`, et non `https\://download.docker.com/linux/debian`. Utiliser le dépôt Debian avec le nom de version `noble` provoque une erreur `404 Not Found`.

### Étape 3 — Déclarer le dépôt Docker pour Ubuntu
```bash
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update

```

Si un ancien dépôt Docker erroné existe dans `/etc/apt/sources.list.d/docker.list`, supprimez **uniquement cette entrée incorrecte** avant `apt update` pour éviter les conflits de configuration.

### Étape 4 — Installer Docker et Compose v2
```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
```

### Étape 5 — Vérifier l'installation
```bash
docker --version

docker compose version

sudo systemctl status docker --no-pager

sudo docker run --rm hello-world
```

Le conteneur de test doit afficher `Hello from Docker!`. Vérifiez aussi la disponibilité de Compose avec `docker compose version` (sans tiret entre `docker` et `compose`).

### Étape 6 — Exécuter Docker sans sudo (facultatif)
```bash
sudo usermod -aG docker "$USER"
```

Déconnectez-vous puis reconnectez-vous avant de vérifier avec `docker ps`. **Sécurité :** appartenir au groupe `docker` donne des privilèges équivalents à ceux de `root` sur l'hôte. Sur une VM partagée ou de production, privilégiez les commandes `sudo docker ...` ou une solution rootless adaptée.

### Dépannage rapide

| Symptôme | Cause probable | Vérification / correction |
|---|---|---|
| `404 ... /linux/debian noble Release` | Dépôt Debian utilisé sur Ubuntu | Corriger l'URL en `/linux/ubuntu` |
| `Package docker-ce has no installation candidate` | Dépôt absent ou invalide | Vérifier `docker.sources` puis `sudo apt update` |
| `Cannot connect to the Docker daemon` | Service arrêté ou droits insuffisants | `sudo systemctl status docker` ; tester avec `sudo docker ps` |
| `permission denied ... docker.sock` | Utilisateur non autorisé | Utiliser `sudo`, ou revoir l'appartenance au groupe `docker` |

Documentation officielle : https\://docs.docker.com/engine/install/ubuntu/

**---**

## 2. Récupérer les sources

Le dépôt du parcours est https\://github.com/sdiawa/lab-devops.git . Si vous utilisez Git :
```bash
mkdir -p "$HOME/devops-labs"

cd "$HOME/devops-labs"

git clone https\://github.com/sdiawa/lab-devops.git

cd lab-devops/dsk-stock-lab01-docker
```

Si le dépôt est déjà présent, entrez simplement dans **`dsk-stock-lab01-docker`**. Vous pouvez également extraire une archive ZIP et ouvrir ce même sous-dossier. Toutes les commandes suivantes s’exécutent **_**_**depuis ce dossier**.

Vérifiez l’arborescence :
```bash
ls -la

ls apps
```

Fichiers essentiels présents dans la variante étudiée : `apps/`, `backend.Dockerfile`, `frontend.Dockerfile`, `compose.yaml`, `nginx.conf`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.env.example`, `README.md`, `GUIDE.md`, `ENVIRONNEMENT.md`, `COMPTE-RENDU.md` et `SCENARIO.md`.

## 3. Préparer l’environnement

### 3.1 Créer et comprendre le fichier `.env`

Le fichier `.env` contient les paramètres propres à la machine de chaque apprenant. Il est lu par Docker Compose pour remplacer les expressions `${VARIABLE}` présentes dans `compose.yaml`. **Il ne s’agit pas d’un script Bash** : on y inscrit des valeurs, jamais des commandes à exécuter.

Depuis le dossier `dsk-stock-lab01-docker` :
```bash
# Créer le fichier uniquement s'il n'existe pas encore
# Créer le fichier .env à partir du modèle, uniquement s'il n'existe pas
cp .env.example .env

# Afficher les adresses IPv4 de la machine hébergeant Docker
hostname -I

# Générer un secret JWT sécurisé à recopier dans .env
openssl rand -hex 32

# Ouvrir le fichier .env pour renseigner les variables
nano .env

Explications :

cp  .env.example .env : crée le fichier .env à partir du modèle sans écraser une configuration existante.

hostname -I : affiche les adresses IP de la machine. Identifiez l'adresse IPv4 accessible depuis votre poste de travail. Ignorez les adresses des réseaux internes Docker, généralement de type 172.x.x.x.

openssl rand -hex 32 : génère une valeur aléatoire sécurisée de 64 caractères hexadécimaux pour JWT_SECRET.

nano .env : permet de modifier les paramètres de l'application.

Exemple de configuration .env :

POSTGRES_USER=stock
POSTGRES_PASSWORD=VotreMotDePasseSecurise
POSTGRES_DB=stock
JWT_SECRET=REMPLACER_PAR_LA_VALEUR_DE_OPENSSL_RAND_HEX_32
BIND_IP=10.0.0.50

Important : 10.0.0.50 est une adresse IP utilisée à titre d'exemple. Remplacez-la par l'adresse IPv4 de votre machine dont docker tourne.

```

Si `.env` existe déjà, conservez-le et modifiez uniquement les paramètres nécessaires. Exemple de contenu **à adapter** 

| Variable | Explication |
|---|---|
| `POSTGRES_USER` | Utilisateur PostgreSQL créé à la première initialisation du volume |
| `POSTGRES_PASSWORD` | Mot de passe de cet utilisateur ; choisir un secret unique et suffisamment long |
| `POSTGRES_DB` | Nom de la base de données utilisée par DSK Stock |
| `JWT_SECRET` | Clé secrète utilisée par le backend pour signer les jetons d'authentification ; générée avec `openssl rand -hex 32` |
| `BIND_IP` | Adresse IPv4 de la machine sur laquelle Docker publie les ports 8080 et 3001 |

**Attention :** `.env` contient des secrets. Ne le publiez pas dans Git et ne copiez pas son contenu dans un compte rendu. Vérifiez que `.env` est ignoré par Git (`git check-ignore .env`).

#### 3.1.1 Identifier manuellement l'adresse IP de sa machine

Sur une **VM Ubuntu ou un hôte Linux**, exécutez :
```bash
hostname -I
ip -4 addr show
ip -4 route get 1.1.1.1
```

`hostname -I` peut afficher plusieurs adresses, notamment celles des réseaux Docker (`172.x.x.x`). Choisissez **l'adresse IPv4 de l'interface réseau accessible depuis votre ordinateur**, et non une adresse de pont Docker. Exemple : si la VM affiche `10.0.0.50 172.17.0.1 172.18.0.1` et que votre PC accède au réseau `10.0.0.0/24`, utilisez `10.0.0.50`.

Sur **macOS avec Docker Desktop**, si vous utilisez le navigateur sur le même Mac, gardez généralement `BIND_IP=127.0.0.1`. Sous Windows avec Docker Desktop, `127.0.0.1` convient également pour un accès local. Pour un accès depuis un autre appareil, choisissez une adresse d'écoute appropriée et vérifiez les règles réseau et pare-feu.

Ouvrez `.env` et renseignez la valeur obtenue :
```dotenv
# Exemple uniquement : remplacez cette IP par celle de VOTRE machine
BIND_IP=10.0.0.50
```
#### 3.1.2 Vérifier la configuration avant de déployer
```bash
grep '^BIND_IP=' .env
```

La seconde commande doit se terminer sans erreur. En cas de `invalid IP address`, vérifiez que `BIND_IP` contient uniquement une adresse IPv4 valide, sans commande Bash ni lien Markdown.

**Remarque sur PostgreSQL :** le Compose de ce lab construit `DATABASE_URL` à partir des variables `POSTGRES_USER`, `POSTGRES_PASSWORD` et `POSTGRES_DB` :
```yaml
DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
```

Avec cette écriture, les caractères réservés dans une URL doivent être correctement encodés. Pour ce lab, choisissez un mot de passe alphanumérique long. Si PostgreSQL a déjà initialisé son volume, changer `POSTGRES_PASSWORD` dans `.env` ne change **pas** le mot de passe du rôle existant ; ne supprimez pas le volume pour résoudre ce problème.

### 3.2 Architecture
```mermaid
flowchart LR

    B[Navigateur BIND_IP:8080] --> F[Nginx / React]

    F -->|/api| A[Backend NestJS :3001]

    A --> P[(PostgreSQL :5432)]

    M[Migration Prisma ponctuelle] --> P

    P --> V[(Volume postgres-data)]
```

Le navigateur utilise `/api` via Nginx. Le nom `backend` est résolu sur le réseau Docker, pas depuis le navigateur. Le service PostgreSQL n’expose pas de port sur l’hôte : seuls les conteneurs du réseau Compose y accèdent directement.

### 3.3 Rôle des fichiers

| Fichier | Rôle |
|---|---|
| `compose.yaml` | Définit `postgres`, `migrate`, `backend`, `frontend`, leurs dépendances et volumes |
| `backend.Dockerfile` | Construit l’image Node/NestJS utilisée par le backend et Prisma |
| `frontend.Dockerfile` | Construit l’interface et l’image Nginx |
| `nginx.conf` | Sert le frontend et transmet `/api` au backend |
| `.env` | Paramètres locaux, secrets et `BIND_IP` (non versionnés) |
| `apps/` | Sources applicatives |

## 4. Déployer pas à pas

### Action 1 — Valider la configuration
```bash
docker compose --env-file .env -f compose.yaml config --quiet
```

Cette commande vérifie la configuration sans démarrer de conteneurs. Évitez `docker compose config` sans `--quiet` lorsque des secrets sont interpolés : ils pourraient s’afficher dans le terminal.

### Action 2 — Construire et démarrer
```bash
docker compose --env-file .env -f compose.yaml up -d --build

docker compose --env-file .env -f compose.yaml ps -a
```

Ordre attendu : `postgres` devient **healthy** ; `migrate` applique les migrations et se termine avec le code **0** ; `backend` devient **healthy** ; `frontend` démarre. **`migrate` en `Exited (0)` est normal**.

### Action 3 — Vérifier Prisma sans modifier la base
```bash
docker compose --env-file .env -f compose.yaml run --rm --no-deps  --entrypoint node migrate node_modules/prisma/build/index.js migrate status
```

Résultat attendu pour la variante testée : `1 migration found` puis `Database schema is up to date!`. `migrate status` ne modifie pas le schéma.

### Action 4 — Vérifier les services HTTP
```bash
curl -i http://IP_VM:3001/health

curl -I http://IP_VM:8080/

docker compose --env-file .env -f compose.yaml logs --tail=100 backend frontend
```

Résultats observés sur la variante testée : API `HTTP/1.1 200 OK` avec `{"status":"ok"}` et Nginx `HTTP/1.1 200 OK`. Tester depuis la VM, puis depuis le navigateur du PC (en remplaçant `IP_VM` par la valeur de `BIND_IP`) : `http://IP_VM:8080` et `http://IP_VM:3001/health`. . Un HTTP 200 vérifie la disponibilité de base, pas encore l'ensemble des fonctions métier.

Accéder à l'API et à sa documentation Swagger

Vous pouvez également accéder à l'API backend NestJS et consulter sa documentation interactive Swagger depuis votre navigateur :

Documentation Swagger UI : `http://IP_VM:3001/docs`

Vérification de l'API (Healthcheck) : http://IP_VM:3001/health

Interface via Nginx : `http://IP_VM:8080`

Swagger permet de consulter les endpoints disponibles, les méthodes HTTP (GET, POST, PATCH, DELETE), les paramètres attendus et les réponses de l'API. Il permet également de tester les endpoints directement depuis le navigateur, avec une authentification JWT lorsque celle-ci est nécessaire.

Remarque : l'accès à Swagger via /docs nécessite que cette fonctionnalité soit activée dans le backend.

## 5. Recette métier

Dans l’interface, réalisez le scénario fonctionnel du parcours :

1\. Créer un compte de démonstration, puis se connecter.

2\. Créer un produit **Clavier** avec un stock initial de **10** unités.

3\. Enregistrer une entrée de **3** unités : le stock attendu est **13**.

4\. Enregistrer une sortie de **4** unités : le stock attendu est **9**.

5\. Essayer une sortie de **99** unités : l’opération doit être refusée, sans modifier le stock restant.

6\. Vérifier l’historique des mouvements et le tableau de bord.

Documentez chaque résultat dans `COMPTE-RENDU.md` ; ne considérez pas les opérations comme validées tant qu’elles n’ont pas été réellement testées.

## 6. Sauvegarder et démontrer la persistance

### Action 1 — Sauvegarder avant tout test de recréation
```bash
mkdir -p backups

docker compose --env-file .env -f compose.yaml exec -T postgres 

  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' 

  > backups/stock-before-persistence-test.dump

ls -lh backups/stock-before-persistence-test.dump
```

Vérifiez que l’archive est lisible :
```bash
docker compose --env-file .env -f compose.yaml exec -T postgres 

  pg_restore --list < backups/stock-before-persistence-test.dump | head -20
```

La lecture de la liste confirme que l’archive est reconnue ; elle ne remplace pas un test de restauration sur une base isolée. Conservez cette sauvegarde dans un emplacement protégé.

### Action 2 — Recréer les conteneurs en conservant le volume

Après avoir créé le produit de test et sauvegardé la base :
```bash
docker compose --env-file .env -f compose.yaml down

docker compose --env-file .env -f compose.yaml up -d --no-build

docker compose --env-file .env -f compose.yaml ps -a
```

Reconnectez-vous et vérifiez que **Clavier** existe toujours avec **9** unités et son historique. `down` supprime les conteneurs et le réseau Compose, mais conserve le volume nommé. **N’utilisez pas `down -v` ni `prisma migrate reset` : ces opérations peuvent détruire les données.**

## 7. Diagnostic : incident PostgreSQL / Prisma P1000

### Symptôme réellement rencontré

Le service `migrate` échouait avec `P1000: Authentication failed against database server at postgres`. Pourtant, un test `psql` sur `127.0.0.1` dans le conteneur PostgreSQL fonctionnait.

### Explication

Les règles `pg_hba.conf` observées autorisaient les connexions locales avec `trust`, mais exigeaient `scram-sha-256` pour les connexions réseau Docker. Le test local ne validait donc **pas** le mot de passe. Le mot de passe du rôle PostgreSQL `stock` ne correspondait pas à celui transmis par Compose.

### Diagnostic reproductible
```bash
# Lire les méthodes d'authentification (connexion locale)

docker compose --env-file .env -f compose.yaml exec postgres 

  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT type, database, user_name, address, auth_method, error FROM pg_hba_file_rules;"'

# Vérifier l'authentification sur le réseau Docker

docker compose --env-file .env -f compose.yaml exec postgres 

  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT current_user, current_database();"'
```

### Résolution appliquée dans le lab

Une sauvegarde `pg_dump` a été créée et vérifiée. Le mot de passe du rôle PostgreSQL a ensuite été synchronisé avec `POSTGRES_PASSWORD` **sans recréer la base**, puis la connexion réseau, Prisma et `migrate status` ont réussi. La mise à jour du rôle a été effectuée avec `ALTER ROLE` et `psql` via la connexion locale autorisée ; cette opération est réservée à l'administration d'une base que vous contrôlez.

**Leçon DevOps :** les variables d’initialisation de l’image PostgreSQL ne réécrivent pas les utilisateurs d’une base déjà présente dans un volume. Un healthcheck `pg_isready` confirme la disponibilité du serveur, pas la validité du mot de passe applicatif.

## 8. Critères de réussite

| Contrôle | Preuve attendue |
|---|---|
| Configuration | `.env` local non commité, configuration Compose valide |
| Base de données | `postgres` healthy, authentification réseau fonctionnelle |
| Migration | `migrate` terminé avec code 0, schéma à jour |
| Backend | `/health` répond HTTP 200 |
| Frontend | `http://localhost:8080/` répond HTTP 200 et l’interface s’affiche |
| Métier | Stock 10 → 13 → 9 ; sortie de 99 refusée |
| Persistance | Produit toujours présent après `down` / `up` sans `-v` |
| Sauvegarde | Archive `pg_dump` créée et lisible |

## 9. Questions et exercices complémentaires

1\. Pourquoi le navigateur appelle-t-il `/api` plutôt que `http://backend:3001` ?

2\. Quelle différence existe entre un conteneur et un volume Docker ?

3\. Pourquoi Prisma doit-il terminer ses migrations avant le démarrage du backend ?

4\. Pourquoi `pg_isready` peut-il être positif alors qu’une connexion applicative échoue ?

5\. Pourquoi le mot de passe défini dans `.env` ne met-il pas à jour un rôle PostgreSQL existant ?

6\. Modifiez `FRONTEND_PORT` pour exposer l’interface sur 8081 sans reconstruire les images.

7\. Proposez une méthode de réduction de la taille de l’image backend en conservant les outils de migration nécessaires.

8\. Identifiez les précautions à prendre avant d’exposer le lab sur Internet : TLS, CORS, secrets, authentification, limitation des requêtes et sauvegardes.

## 10. Livrable et fin de session

Complétez `COMPTE-RENDU.md` avec la machine utilisée, la révision Git, l’architecture, les commandes, les résultats des tests, l’incident P1000 et sa résolution. Masquez les mots de passe, tokens JWT, clés et informations sensibles.

Pour arrêter les conteneurs **sans supprimer les données** :
```bash
docker compose --env-file .env -f compose.yaml down
```

Le volume `postgres-data` est conservé. Une suppression de volume ne fait pas partie du nettoyage normal de ce lab.
