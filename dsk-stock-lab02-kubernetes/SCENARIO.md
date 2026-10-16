# Lab 02 — Déployer DSK Stock sur Kubernetes, pas à pas

> **Public :** débutants ayant terminé le Lab 01 Docker Compose. **Durée :** 3 à 5 h après installation du cluster et préparation des images. **But :** comprendre Kubernetes, pas seulement copier des commandes.
>
> **Compatibilité :** K3s sur VM Ubuntu (parcours recommandé), kind, Minikube, kubeadm ou cluster existant. **Ni Proxmox ni Longhorn ne sont obligatoires.**

## 0. Votre mission et ce que vous allez apprendre

Dans le Lab 01, Docker Compose démarrait l'application DSK Stock (React/Nginx, NestJS, PostgreSQL) sur une machine. Dans ce lab, Kubernetes maintient les conteneurs dans l'état déclaré : un **Deployment** gère les applications sans état, un **StatefulSet** gère PostgreSQL, des **Services** relient les composants, un **PVC** conserve les données et un **Job** applique les migrations Prisma.

À la fin, vous devrez **expliquer**, **déployer**, **tester** et **dépanner** chaque composant, puis démontrer la persistance des données après recréation du Pod PostgreSQL.

### Architecture logique

```text
Navigateur
  | http://localhost:8080 (port-forward local) ou http://IP_VM:8080 (VM distante)
  v
Service frontend:80 -> Deployment frontend (Nginx + React)
                             | /api (reverse proxy)
                             v
                     Service backend:3001 -> Deployment backend (NestJS)
                                                    |
                                                    v
                                         Service postgres:5432
                                                    |
                                                    v
                                         StatefulSet postgres-0
                                                    |
                                                    v
                                            PVC data-postgres-0

Job stock-migrate (Prisma) -> PostgreSQL (à exécuter AVANT le backend)
Secret stock-secrets -> PostgreSQL, Job, backend
Namespace commun : stock-lab02
```

<img width="704" height="682" alt="Capture d’écran 2026-10-16 à 20 35 49" src="https://github.com/user-attachments/assets/39df2246-214f-465c-ba04-2b9cb74dae47" />

**Attention :** un Pod `Running` ne signifie pas que l'application fonctionne. Le scénario métier et la persistance sont des tests distincts.

## 1. Préparer l'environnement

### 1.1 Choisir une option

| Option | Pour qui ? | Stockage typique | Images |
|---|---|---|---|
| **A — K3s, une VM Ubuntu** | Débutant | `local-path` (si activé) | registre accessible ou import dans containerd |
| **B — kind** | Poste Docker local | provisionneur du cluster kind | `kind load docker-image` |
| **C — Minikube** | Poste local | provisionneur du cluster | `minikube image load` |
| **D — kubeadm / cluster existant** | Plus avancé | StorageClass ou PV existant | registre accessible à tous les nœuds |

**K3s `local-path`** n'est pas Longhorn : il utilise du stockage local au nœud. Il convient au lab mais n'apporte pas de réplication inter-nœuds ni de haute disponibilité. Un PVC n'est pas une sauvegarde.

### 1.2 Installer K3s (option A uniquement)

Sur une **VM Ubuntu dédiée au lab**, avec accès administrateur, installez K3s selon la [documentation officielle](https://docs.k3s.io/quick-start). Une installation standard utilise la commande suivante, après lecture des prérequis et vérification de la source :

```bash
curl -sfL https://get.k3s.io | sh -
```

> Cette commande télécharge et exécute un script avec des privilèges élevés. Ne l'exécutez **pas** sur un serveur partagé ou un cluster déjà opérationnel. Les utilisateurs de kind, Minikube ou kubeadm **ignorent cette étape**.

Sur la VM K3s, vous pouvez utiliser `sudo k3s kubectl ...` si `kubectl` n'est pas configuré pour votre utilisateur. Pour piloter le cluster depuis un autre PC, configurez un kubeconfig adapté selon la documentation K3s ; ne publiez jamais ce fichier et vérifiez que son adresse de serveur est joignable.

### 1.3 Vérifications communes — avant toute modification

```bash
kubectl config current-context
kubectl get nodes -o wide
kubectl get storageclass
kubectl get storageclass -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.annotations.storageclass\.kubernetes\.io/is-default-class}{"\n"}{end}'
docker version
```

**Pourquoi ?** `kubectl` agit sur le cluster sélectionné par le contexte courant. Une mauvaise sélection peut modifier un cluster de production. La StorageClass détermine comment le PVC sera provisionné.

**Résultat attendu :** au moins un nœud `Ready`, un contexte connu, et une StorageClass par défaut ou un PV compatible. Si `kubectl` est introuvable sur K3s, utilisez `sudo k3s kubectl` sur la VM. Si `docker` est absent, construisez les images sur un autre poste ou utilisez une méthode de build adaptée : Docker n'est pas requis sur les nœuds Kubernetes.

**Diagnostic :**

```bash
kubectl cluster-info
kubectl describe node NOM_DU_NOEUD
kubectl get events -A --sort-by=.lastTimestamp
```

> Ne poursuivez pas tant que le cluster n'est pas identifié et prêt.

## 2. Récupérer les sources et comprendre les fichiers

```bash
mkdir -p "$HOME/devops-labs"
cd "$HOME/devops-labs"
git clone https://github.com/sdiawa/lab-devops.git
cd lab-devops/dsk-stock-lab02-kubernetes
ls -la
ls apps manifests
```

Si le dépôt existe déjà, **ne le clonez pas une seconde fois** : entrez dans son dossier et mettez-le à jour seulement après avoir vérifié vos modifications locales.

Arborescence observée dans le projet :

```text
apps/backend/Dockerfile
apps/frontend/Dockerfile
kind.yaml
manifests/00-namespace.yaml
manifests/10-postgres.yaml
manifests/20-migrate.yaml
manifests/30-app.yaml
README.md
GUIDE.md
ENVIRONNEMENT.md
SCENARIO.md
COMPTE-RENDU.md
```

**Important :** ce dépôt **ne contient pas**, dans le dossier Lab 02 fourni, de `labs/prepare-kubernetes.py` ni de `labs/validate-http.py`. Ne suivez pas les commandes du scénario antérieur qui les invoquent. Les chemins corrects sont `manifests/...` depuis le dossier du Lab 02.

## 3. Comprendre les manifests, ligne par ligne dans leur rôle

### `00-namespace.yaml` — isoler le lab

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: stock-lab02
```

- `apiVersion` : version de l'API Kubernetes utilisée.
- `kind` : type d'objet demandé.
- `metadata.name` : nom de l'objet.
- Un namespace évite des collisions de noms ; **ce n'est pas à lui seul une isolation de sécurité**.

### `10-postgres.yaml` — Service, StatefulSet et PVC

- Le **Service `postgres`** donne une adresse réseau stable : `postgres:5432` à l'intérieur du namespace.
- Le **StatefulSet `postgres`** maintient un Pod nommé `postgres-0`.
- `envFrom.secretRef` injecte les variables du Secret `stock-secrets`.
- La **readinessProbe** utilise `pg_isready` pour déterminer si PostgreSQL accepte des connexions ; cela ne valide pas nécessairement une requête applicative complète.
- `volumeClaimTemplates` crée un PVC de **1 GiB**, en `ReadWriteOnce`, nommé normalement `data-postgres-0`.
- `subPath: postgres` monte un sous-répertoire du volume dans `/var/lib/postgresql/data`.

**Portabilité :** le manifest fourni n'indique **pas** `storageClassName`. Kubernetes utilise alors la StorageClass par défaut si elle existe. Sur K3s standard, ce peut être `local-path` ; sur d'autres clusters, une autre classe. S'il n'existe pas de classe par défaut, le PVC peut rester `Pending`. Ne remplacez pas systématiquement cette valeur par `longhorn`.

### `20-migrate.yaml` — migration Prisma

Un **Job** réalise une tâche finie. L'`initContainer` `wait-database` attend la connexion à PostgreSQL, puis le conteneur `migrate` exécute `prisma migrate deploy`. `backoffLimit` et `activeDeadlineSeconds` limitent les tentatives et la durée. Les deux conteneurs utilisent l'image du backend, qui doit donc être accessible aux nœuds.

### `30-app.yaml` — frontend, backend, Services et probes

- Un **Deployment** décrit l'état souhaité des Pods et les recrée si nécessaire.
- Un **Service** sélectionne les Pods via leurs labels (`app: backend`, `app: frontend`).
- `startupProbe` laisse le temps au backend de démarrer.
- `readinessProbe` contrôle s'il peut recevoir du trafic.
- `livenessProbe` aide à détecter un conteneur bloqué pour le redémarrer.
- `imagePullPolicy: IfNotPresent` réutilise une image locale **si elle existe sur le nœud où le Pod démarre** ; ce n'est pas un mécanisme de distribution entre nœuds.

**Limite :** la route `/health` répond lorsque le serveur HTTP fonctionne, mais ne garantit pas que PostgreSQL est joignable.

## 4. Construire et publier les images dans un Container Registry (recommandé)

### 4.1 Pourquoi utiliser un registre Docker ?

**Je recommande d’utiliser un registre Docker (Container Registry)** plutôt que de dépendre des images construites sur la VM. Un `docker build` crée une image dans le magasin de Docker ; K3s utilise son propre runtime containerd. Une image visible dans `docker images` n'est donc pas automatiquement accessible à K3s. Le registre permet aux nœuds de télécharger les images de manière reproductible.

Dans ce lab, nous utilisons **GitHub Container Registry (GHCR)** (`ghcr.io`), mais le principe est identique avec Harbor, GitLab Container Registry ou Docker Hub. Pour les apprenants, les images publiques évitent d'avoir à créer un `imagePullSecret`.

```text
Sources Git → docker build → images locales → docker push → GHCR
                                                        |
                                     K3s/containerd ← docker pull (par Kubernetes)
                                                        |
                                     Job Prisma + Deployments frontend/backend
```

### 4.2 Préparer les sources et contrôler les Dockerfiles

Placez-vous à la racine du Lab 02 :

```bash
cd ~/devops-labs/lab-devops/dsk-stock-lab02-kubernetes
sed -n '1,180p' apps/backend/Dockerfile
sed -n '1,180p' apps/frontend/Dockerfile
docker version
```

Les Dockerfiles du projet utilisent la racine du Lab 02 comme **contexte de build** (`.`). Vérifiez leurs `COPY` si vous avez modifié l'arborescence.

### 4.3 Créer un Personal Access Token GitHub (classic)

1. Connectez-vous à GitHub avec le compte qui possédera les packages.
2. Ouvrez **Settings → Developer settings → Personal access tokens → Tokens (classic)**, ou [la page des tokens classic](https://github.com/settings/tokens).
3. Cliquez sur **Generate new token → Generate new token (classic)**.
4. Donnez un nom explicite, par exemple `lab02-ghcr-push`, et choisissez une expiration courte.
5. Cochez **`write:packages`** (GitHub peut sélectionner aussi `read:packages`). `delete:packages` n'est pas nécessaire. Le droit `repo` n'est pas nécessaire pour publier des images publiques ordinaires ; les contraintes d'organisation et de dépôts privés peuvent nécessiter des droits supplémentaires.
6. Générez le token, copiez-le immédiatement et conservez-le dans un gestionnaire de secrets. Il ne sera pas affiché une seconde fois.

**Sécurité :** ne publiez jamais ce token dans Git, un README, une capture d'écran ou les logs. Si votre organisation impose le SSO/SAML, autorisez le token pour l'organisation concernée. Un token classic est ici utilisé pour l'apprentissage de GHCR ; en CI/CD, préférez `GITHUB_TOKEN` et des permissions minimales adaptées au workflow.

### 4.4 Se connecter au registre GHCR

Remplacez `sdiawa` par **votre propre identifiant GitHub ou organisation**, sauf si vous publiez volontairement dans le compte de démonstration qui vous appartient.

```bash
export GHCR_USER="sdiawa"  # À ADAPTER à votre compte GitHub
read -rsp 'GitHub PAT (classic) : ' GHCR_TOKEN
echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io \
  -u "$GHCR_USER" --password-stdin
unset GHCR_TOKEN
```

**Attendu :** `Login Succeeded`. Cela confirme l'authentification Docker, **pas** les permissions de publication sur n'importe quel propriétaire GHCR. Pour un environnement partagé, configurez un gestionnaire d'identifiants Docker : la configuration par défaut peut stocker le token sans chiffrement dans `~/.docker/config.json`.

### 4.5 Construire et publier les images

Depuis la racine du Lab 02 :

```bash
export GHCR_USER="sdiawa"  # À ADAPTER

docker build -f apps/backend/Dockerfile \
  -t "ghcr.io/${GHCR_USER}/dsk-stock-backend:lab02" .

docker build -f apps/frontend/Dockerfile \
  -t "ghcr.io/${GHCR_USER}/dsk-stock-frontend:lab02" .

docker images | grep dsk-stock

docker push "ghcr.io/${GHCR_USER}/dsk-stock-backend:lab02"
docker push "ghcr.io/${GHCR_USER}/dsk-stock-frontend:lab02"
```

**Attendu :** chaque `docker push` termine par `lab02: digest: sha256:...`. Le digest confirme la publication de l'image. Il est également possible de construire sous un nom local puis d'utiliser `docker tag` : cette opération ne reconstruit pas l'image.

**Incident réel — `not_found: owner not found` :** cette erreur est survenue lorsque l'exemple `ton_utilisateur_github` avait été conservé dans le nom d'image. Il faut remplacer le propriétaire par un compte ou une organisation où le token possède les droits. Exemple, si une image a déjà été construite sous le mauvais nom :

```bash
docker tag ghcr.io/ton_utilisateur_github/dsk-stock-backend:lab02 \
  ghcr.io/sdiawa/dsk-stock-backend:lab02
docker tag ghcr.io/ton_utilisateur_github/dsk-stock-frontend:lab02 \
  ghcr.io/sdiawa/dsk-stock-frontend:lab02
# Puis refaire les deux docker push avec les noms corrigés.
```

### 4.6 Rendre les deux packages publics dans GitHub

Les packages nouvellement créés peuvent être **privés par défaut**. Pour que K3s et les apprenants téléchargent les images sans authentification :

1. Ouvrez votre profil GitHub, onglet **Packages** (exemple : [packages du compte sdiawa](https://github.com/sdiawa?tab=packages)).
2. Sélectionnez `dsk-stock-backend`, ouvrez **Package settings** puis **Danger Zone → Change package visibility → Public** et confirmez.
3. Répétez l'opération pour `dsk-stock-frontend`.
4. Vérifiez qu'aucun secret, identifiant ou fichier confidentiel n'est inclus dans les couches de vos images **avant** de les rendre publiques. Cette opération rend les packages téléchargeables par tout le monde.

**Incident réel — `401 Unauthorized` :** un `k3s crictl pull` a échoué avec `failed to fetch anonymous token` alors que `docker push` avait réussi. La connexion Docker utilisée pour publier n'est **pas** automatiquement transmise au runtime K3s. Après passage des packages en public, le téléchargement anonyme est possible.

Vérifiez sur la VM K3s :

```bash
sudo k3s crictl pull ghcr.io/sdiawa/dsk-stock-backend:lab02
sudo k3s crictl pull ghcr.io/sdiawa/dsk-stock-frontend:lab02
sudo k3s crictl images | grep dsk-stock
```

Adaptez le propriétaire des images. Sur une session root, `sudo` est facultatif. Pour garder les packages privés, configurez à la place un Secret `kubernetes.io/dockerconfigjson` et `imagePullSecrets` sur les Pods (y compris le Job Prisma) ; ce parcours est hors du chemin principal de ce lab.

### 4.7 Adapter les références des images dans les manifests Kubernetes — obligatoire

**Publier les images ne suffit pas : les manifests doivent pointer vers le registre.** Trois usages du backend sont à modifier : l'initContainer et le conteneur de migration dans `manifests/20-migrate.yaml`, puis le Deployment backend dans `manifests/30-app.yaml`. Le Deployment frontend doit utiliser l'image frontend du registre.

Exemple pour le compte `sdiawa` :

```yaml
# manifests/20-migrate.yaml : dans wait-database ET migrate
image: ghcr.io/sdiawa/dsk-stock-backend:lab02
imagePullPolicy: IfNotPresent

# manifests/30-app.yaml : conteneur backend
image: ghcr.io/sdiawa/dsk-stock-backend:lab02

# manifests/30-app.yaml : conteneur frontend
image: ghcr.io/sdiawa/dsk-stock-frontend:lab02
```

Pour adapter automatiquement les références locales initiales (à partir d'un dépôt non encore modifié) :

```bash
export GHCR_USER="sdiawa"  # À ADAPTER
sed -i "s|image: dsk-stock-backend:lab|image: ghcr.io/${GHCR_USER}/dsk-stock-backend:lab02|g" \
  manifests/20-migrate.yaml manifests/30-app.yaml
sed -i "s|image: dsk-stock-frontend:lab|image: ghcr.io/${GHCR_USER}/dsk-stock-frontend:lab02|g" \
  manifests/30-app.yaml

grep -nE 'image:|imagePullPolicy:' \
  manifests/20-migrate.yaml manifests/30-app.yaml
```

**Attendu :** 3 références backend et 1 référence frontend. Si vous avez déjà modifié les manifests, vérifiez-les plutôt que de répéter aveuglément le remplacement. Préférez un tag versionné ou un digest immuable pour un déploiement reproductible.

### 4.8 Autres environnements (alternatives)

- **kind** : `kind load docker-image dsk-stock-backend:lab dsk-stock-frontend:lab --name NOM_DU_CLUSTER_KIND` si vous choisissez de ne pas utiliser GHCR.
- **Minikube** : `minikube image load dsk-stock-backend:lab` puis `minikube image load dsk-stock-frontend:lab`.
- **K3s / kubeadm multinœud** : un registre accessible à tous les nœuds est préférable à l'import manuel. Une image disponible dans Docker Engine ou sur un seul nœud n'est pas forcément visible par les autres nœuds Kubernetes.

**Contrôle de sortie de l'étape 4 :** les deux images sont publiées, publiques ou accessibles via `imagePullSecrets`, téléchargeables par le runtime du cluster, et les deux manifests référencent correctement GHCR.

## 5. Déployer les objets Kubernetes dans le bon ordre

> **Toutes les commandes suivantes** partent de `lab-devops/dsk-stock-lab02-kubernetes`. Utilisez `kubectl` avec le bon contexte. Pour un K3s local non configuré, remplacez `kubectl` par `sudo k3s kubectl`.

### Étape 1 — Namespace

**Pourquoi ?** Regrouper et identifier les objets de l'exercice.

```bash
kubectl apply -f manifests/00-namespace.yaml
kubectl get namespace stock-lab02
```

**Attendu :** `stock-lab02` en statut `Active`.

### Étape 2 — Secret

**Pourquoi ?** PostgreSQL, Prisma et le backend ont besoin des mêmes paramètres de connexion ; le backend a également besoin d'un secret JWT.

Pour un **lab local uniquement**, utilisez des identifiants de démonstration ; ne les réutilisez jamais en production :

```bash
export LAB_JWT_SECRET="$(openssl rand -hex 32)"
kubectl -n stock-lab02 create secret generic stock-secrets \
  --from-literal=POSTGRES_USER=stock \
  --from-literal=POSTGRES_PASSWORD=stock_local_only \
  --from-literal=POSTGRES_DB=stock \
  --from-literal=DATABASE_URL='postgresql://stock:stock_local_only@postgres:5432/stock' \
  --from-literal=JWT_SECRET="$LAB_JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -
unset LAB_JWT_SECRET
kubectl -n stock-lab02 get secret stock-secrets
```

**Attendu :** `stock-secrets` existe. N'affichez pas son YAML en public. Un Secret Kubernetes est encodé en base64 et n'est **pas automatiquement chiffré** ; les autorisations RBAC et le chiffrement au repos du cluster sont des sujets distincts. La commande ci-dessus ne doit pas être utilisée telle quelle avec de vrais secrets : ses arguments peuvent apparaître dans l'historique ou les processus.

### Étape 3 — PostgreSQL et PVC

**Pourquoi ?** Démarrer la base et obtenir un volume persistant avant les migrations.

```bash
kubectl -n stock-lab02 apply -f manifests/10-postgres.yaml
kubectl -n stock-lab02 get pods,pvc
kubectl -n stock-lab02 rollout status statefulset/postgres --timeout=180s
```

**Attendu :** `postgres-0` prêt et PVC `data-postgres-0` en `Bound`.

**Si le PVC reste `Pending` :**

```bash
kubectl -n stock-lab02 describe pvc data-postgres-0
kubectl get storageclass
kubectl -n stock-lab02 get events --sort-by=.lastTimestamp
```

Vérifiez la classe par défaut, le provisionneur et les ressources. Sur K3s, vérifiez la présence du provisionneur `local-path`. N'installez pas Longhorn uniquement pour terminer cet exercice.

### Étape 4 — Job Prisma

**Pourquoi ?** Créer ou mettre à jour le schéma PostgreSQL avant de démarrer l'API.

```bash
kubectl -n stock-lab02 apply -f manifests/20-migrate.yaml
kubectl -n stock-lab02 wait --for=condition=complete job/stock-migrate --timeout=300s
kubectl -n stock-lab02 logs job/stock-migrate
```

**Attendu :** Job `Complete` et migrations sans erreur.

**Si échec :**

```bash
kubectl -n stock-lab02 get pods,jobs
kubectl -n stock-lab02 describe job stock-migrate
kubectl -n stock-lab02 logs job/stock-migrate --all-containers=true
```

Ne déployez pas le backend tant que le Job échoue. Un Job terminé n'est pas relancé simplement parce que vous réappliquez le YAML : après changement de version, il faut planifier explicitement son nouvel essai.

### Étape 5 — Backend et frontend

**Pourquoi ?** Les Deployments maintiennent les Pods ; les Services les rendent joignables dans le cluster.

```bash
kubectl -n stock-lab02 apply -f manifests/30-app.yaml
kubectl -n stock-lab02 rollout status deployment/backend --timeout=180s
kubectl -n stock-lab02 rollout status deployment/frontend --timeout=180s
kubectl -n stock-lab02 get pods,deploy,svc,pvc,jobs
```

**Attendu :** les deux Deployments prêts, PostgreSQL prêt, le PVC `Bound` et le Job `Complete`.

## 6. Accéder à l'interface et corriger la configuration API du frontend

### 6.1 Comprendre `ClusterIP` et `kubectl port-forward`

Les Services `frontend` (80) et `backend` (3001) sont de type `ClusterIP` : leurs ports ne sont pas automatiquement ouverts sur l'IP de la VM. Pour tester, on utilise temporairement `kubectl port-forward`.

**Si `kubectl` s'exécute sur votre propre ordinateur** avec un kubeconfig fonctionnel :

```bash
kubectl -n stock-lab02 port-forward svc/frontend 8080:80
# Ouvrir http://localhost:8080 sur ce même ordinateur.
```

**Si `kubectl` s'exécute sur une VM K3s distante** (exemple `10.0.0.50`) et que vous ouvrez le navigateur depuis votre Mac, `localhost` ne désigne pas la même machine. Pour le test **uniquement sur un LAN de confiance**, utilisez deux terminaux sur la VM :

```bash
# Terminal 1 — frontend
kubectl -n stock-lab02 port-forward --address 0.0.0.0 svc/frontend 8080:80

# Terminal 2 — backend
kubectl -n stock-lab02 port-forward --address 0.0.0.0 svc/backend 3001:3001
```

Le frontend est alors accessible à **http://10.0.0.50:8080** et l'API à **http://10.0.0.50:3001** dans cet exemple. **Adaptez l'IP à votre VM.** Les deux terminaux doivent rester ouverts. `--address 0.0.0.0` expose temporairement les ports sur toutes les interfaces de la VM : n'utilisez pas cette option sur une machine exposée à Internet ; préférez un tunnel SSH ou un Ingress protégé.

Pour vérifier l'écoute :

```bash
ss -lntp | grep -E '8080|3001'
curl -i http://127.0.0.1:3001/health  # Depuis la VM
```

Sur le Mac (avec l'IP de l'exemple) :

```bash
curl -i http://10.0.0.50:3001/health
curl -i http://10.0.0.50:3001/api/products
```

- `/health` → `200 OK`, `{"status":"ok"}` : serveur HTTP disponible.
- `/api/products` → `401 Unauthorized` sans JWT : comportement attendu sur une route protégée.
- `/docs` : Swagger seulement si activé dans le backend.

### 6.2 Incident réel : l'interface s'affiche mais l'inscription indique `Network Error`

**Symptômes constatés :** le navigateur affiche la page d'inscription, le backend répond sur `/health`, et un appel direct à `POST /api/auth/register` renvoie `201 Created`, mais l'interface React affiche `Network Error`.

**Diagnostic :** React n'appelle pas nécessairement l'adresse que vous venez de tester. Dans le projet :

- `apps/frontend/src/lib/config.ts` contient un fallback de développement `http://localhost:3001/api` ; dans le navigateur du Mac, `localhost` désigne **le Mac**, pas la VM.
- `apps/frontend/entrypoint.sh` construit un fichier `env.js` au démarrage du conteneur. Sans variable de runtime, son URL par défaut peut être `https://api.stock.dsk.lab/api`, qui n'est pas forcément joignable dans le lab.
- `apps/frontend/src/lib/api.ts` utilise `API_BASE_URL` pour ses requêtes HTTP.

Vérifiez les sources et la configuration réellement injectée :

```bash
grep -RInE 'VITE_API|API_URL|baseURL|localhost:3001|/api/auth' \
  apps/frontend/src apps/frontend/entrypoint.sh apps/frontend/nginx.conf

kubectl -n stock-lab02 get deployment frontend -o yaml | grep -A 20 'env:'
kubectl -n stock-lab02 exec deployment/frontend -- \
  sh -c 'cat /usr/share/nginx/html/env.js'
```

**Test direct de l'API d'inscription** (compte de démonstration, adresse unique) :

```bash
curl -i -X POST http://10.0.0.50:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"lab02-test@example.com","password":"TestLab02!2026"}'
```

**Attendu :** `201 Created` si l'inscription est acceptée ; `409` peut signifier que l'utilisateur existe déjà. N'utilisez pas de vrais mots de passe ou de données personnelles dans ce test.

### 6.3 Corriger l'URL API au runtime, sans reconstruire l'image

Pour le test avec la VM `10.0.0.50`, la valeur adaptée est :

```text
VITE_API_BASE_URL=http://10.0.0.50:3001/api
```

Appliquez-la :

```bash
kubectl -n stock-lab02 set env deployment/frontend \
  VITE_API_BASE_URL=http://10.0.0.50:3001/api

kubectl -n stock-lab02 rollout status deployment/frontend --timeout=180s
kubectl -n stock-lab02 get pods
kubectl -n stock-lab02 exec deployment/frontend -- \
  sh -c 'cat /usr/share/nginx/html/env.js'
```

**Attendu :** `deployment "frontend" successfully rolled out`, nouveau Pod `Running`, et fichier `env.js` :

```javascript
window.__APP_CONFIG__ = {
  apiBaseUrl: "http://10.0.0.50:3001/api"
};
```

Rechargez le navigateur, puis inscrivez-vous et accédez au Dashboard. **Dans le lab réel, cette correction a permis d'accéder au Dashboard.** Aucun `docker build` ni `docker push` supplémentaire n'a été nécessaire : l'image est identique, seule la configuration d'exécution change.

### 6.4 Rendre la correction déclarative dans Git — indispensable

`kubectl set env` modifie **le Deployment vivant**, mais **pas** `manifests/30-app.yaml`. Ajoutez donc cette variable **au conteneur `frontend` uniquement** dans le manifest, en conservant les autres champs existants :

```yaml
# Extrait du conteneur frontend dans manifests/30-app.yaml
containers:
  - name: frontend
    image: ghcr.io/sdiawa/dsk-stock-frontend:lab02
    imagePullPolicy: IfNotPresent
    env:
      - name: VITE_API_BASE_URL
        value: "http://10.0.0.50:3001/api"  # Adapter l'IP au lab
    # Conserver ports, probes et autres paramètres existants.
```

Appliquez et vérifiez :

```bash
kubectl -n stock-lab02 apply -f manifests/30-app.yaml
kubectl -n stock-lab02 rollout status deployment/frontend --timeout=180s
kubectl -n stock-lab02 exec deployment/frontend -- \
  sh -c 'cat /usr/share/nginx/html/env.js'
```

Cette URL est **temporaire et propre au lab**. Elle dépend du port-forward backend. Dans une évolution plus durable, utilisez Traefik Ingress avec un **point d'entrée unique**, une route `/` vers le frontend et `/api` vers le backend, puis `VITE_API_BASE_URL=/api`. Cela évite l'IP codée en dur, la dépendance au port 3001 et les appels cross-origin. Vérifiez le routage Nginx/Ingress avant de basculer.

### 6.5 Diagnostiquer si cela ne fonctionne toujours pas

Dans Chrome : **F12 → Network**, reproduisez l'inscription et relevez l'URL réellement appelée, le statut HTTP et les éventuelles erreurs CORS. Comparez-la à la valeur de `env.js`. Si l'API est appelée en `https` depuis une page HTTP, vérifiez également la connectivité, le certificat et les règles du navigateur. Ne confondez pas `401` applicatif, `ERR_CONNECTION_REFUSED` réseau et `Network Error` côté Axios.

## 7. Recette métier : prouver que l'application fonctionne

Depuis le frontend :

1. Créer un compte de test puis se connecter.
2. Ajouter un produit **Clavier**, quantité initiale **10**.
3. Ajouter **3** unités : quantité attendue **13**.
4. Retirer **4** unités : quantité attendue **9**.
5. Essayer de retirer **99** unités : l'opération doit être refusée.

**Pourquoi ?** Cela valide ensemble Nginx, le backend, l'authentification, les migrations et PostgreSQL. Les Pods `Running` seuls ne suffisent pas.

### Vérifier la persistance — uniquement après validation du stockage

Sur **le namespace du lab uniquement** :

```bash
kubectl -n stock-lab02 get pvc data-postgres-0
kubectl -n stock-lab02 delete pod postgres-0
kubectl -n stock-lab02 rollout status statefulset/postgres --timeout=180s
kubectl -n stock-lab02 get pods,pvc
```

Revenez dans l'application : le produit **Clavier** doit toujours avoir **9** unités. Le StatefulSet recrée `postgres-0` en réutilisant son PVC.

**Limite :** ce test démontre la persistance après remplacement du Pod, **pas** la résistance à la perte du disque ou du nœud. Avec un stockage local, le Pod peut ne pas redémarrer sur un autre nœud si le volume y est inaccessible.

## 8. Diagnostic guidé

| Symptôme | Explication probable | Première vérification |
|---|---|---|
| Pod `Pending` | Ordonnancement ou stockage impossible | `kubectl -n stock-lab02 describe pod NOM` |
| PVC `Pending` | Aucun PV compatible / provisionneur indisponible | `kubectl -n stock-lab02 describe pvc data-postgres-0` |
| `ImagePullBackOff` | Image absente, mauvais tag, package GHCR privé ou registre inaccessible | `kubectl -n stock-lab02 describe pod NOM` |
| `CrashLoopBackOff` | Processus qui échoue au démarrage | `kubectl -n stock-lab02 logs NOM --previous` |
| Job `Failed` | Erreur de connexion ou migration | `kubectl -n stock-lab02 logs job/stock-migrate --all-containers=true` |
| `ERR_CONNECTION_REFUSED` sur `10.0.0.50:8080` | Port-forward limité à `127.0.0.1` ou port non ouvert | Vérifier `--address`, `ss -lntp` et le pare-feu |
| `Network Error` à l’inscription | Mauvaise URL API runtime (`localhost`/DNS) ou CORS | Vérifier `env.js`, DevTools Network et `VITE_API_BASE_URL` |
| HTTP `502` | Nginx ne parvient pas à joindre le backend | `kubectl -n stock-lab02 get endpoints backend` |
| HTTP `401` | JWT absent ou invalide | Se connecter et vérifier l'en-tête `Authorization` |
| HTTP `404` sur `/docs` | Swagger non activé ou chemin différent | Inspecter la configuration NestJS |

Commandes universelles :

```bash
kubectl -n stock-lab02 get pods,deploy,sts,svc,pvc,jobs
kubectl -n stock-lab02 get events --sort-by=.lastTimestamp
kubectl -n stock-lab02 logs deployment/backend
kubectl -n stock-lab02 describe pod postgres-0
```

## 9. Exercices pour comprendre (et réponses à produire)

1. **Pod vs Deployment :** pourquoi un Deployment recrée-t-il un Pod supprimé ?
2. **Service :** pourquoi le frontend utilise-t-il `backend` plutôt qu'une IP de Pod ?
3. **PVC :** pourquoi les données persistent-elles après suppression du Pod, mais pas forcément après perte du nœud ?
4. **Probes :** distinguer `startupProbe`, `readinessProbe` et `livenessProbe`.
5. **Images :** pourquoi `docker build` sur le Mac ne suffit-il pas pour un cluster kubeadm distant ?
6. **Job :** pourquoi Prisma doit-il migrer la base avant le démarrage du backend ?
7. **Bonus :** passer le Deployment backend à deux réplicas et observer les endpoints du Service ; revenir ensuite à un réplica.

Pour le bonus :

```bash
kubectl -n stock-lab02 scale deployment/backend --replicas=2
kubectl -n stock-lab02 get pods -l app=backend
kubectl -n stock-lab02 get endpoints backend
kubectl -n stock-lab02 scale deployment/backend --replicas=1
```

## 10. Livrable à remplir dans `COMPTE-RENDU.md`

Documentez : type de cluster, contexte `kubectl`, nombre de nœuds, StorageClass, nom du registre GHCR, création et portée du PAT (sans jamais le divulguer), visibilité des packages, références d’images dans les manifests, configuration runtime `env.js`, captures ou sorties des objets `Ready`/`Bound`/`Complete`, tests HTTP, scénario métier, preuve de persistance, incident rencontré et solution, réponses aux exercices. **Masquez secrets, JWT, mots de passe et kubeconfigs.** Notez le commit Git utilisé.

## 11. Fin de session et nettoyage (facultatif)

Arrêtez les port-forwards avec `Ctrl+C`. **Ne supprimez pas le cluster** pour nettoyer ce lab.

La commande suivante supprime **tout le namespace du lab** et peut entraîner la suppression du PVC et des données associées :

```bash
# À exécuter uniquement si vous acceptez de perdre les données du lab :
# kubectl delete namespace stock-lab02
```

Avant toute suppression, vérifiez le contexte et la politique de rétention du volume. La suppression d'un PVC avec une politique `Delete` peut détruire le stockage sous-jacent.

---

## Notes pour les mainteneurs du dépôt

- Les manifests transmis pour ce lab sont `manifests/00-namespace.yaml`, `10-postgres.yaml`, `20-migrate.yaml`, `30-app.yaml`. Ils n'imposent pas Longhorn : **ne pas introduire** `storageClassName: longhorn` dans la version commune.
- Les commandes de build proposées supposent que les Dockerfiles acceptent `.` comme contexte ; **vérifier leurs `COPY`** avant publication.
- Le guide d'origine renvoie à `labs/prepare-kubernetes.py`, `labs/validate-http.py`, `labs/dsk-stock-lab02-kubernetes/manifests.local/` et à un `SCENARIO.md` à la racine : ces chemins **ne sont pas confirmés** dans l'arborescence fournie. Corriger ou fournir les fichiers manquants avant publication.
- Le parcours GHCR est maintenant documenté : PAT classic, `docker login`, build/push, visibilité publique, pull K3s et références dans **les deux** manifests (`20-migrate.yaml` et `30-app.yaml`).
- Vérifier dans le backend que Swagger est effectivement monté sur `/docs` avant de le promettre.
- Éviter les identifiants d'exemple en dehors d'un lab isolé ; améliorer à terme la création des Secrets et la gestion des droits.