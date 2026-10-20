# Lab 03 — Déployer une application reproductible avec Helm

> **Parcours :** Lab 01 (Docker Compose) → Lab 02 (Kubernetes) → **Lab 03 (Helm)**  
> **Niveau :** intermédiaire · **Durée indicative :** 2 à 3 heures, hors préparation de l'infrastructure et téléchargement des images.

## Votre mission

Votre équipe doit pouvoir installer et mettre à jour la même application de gestion de stock sur plusieurs environnements, sans recopier ni modifier manuellement tous les manifests Kubernetes. Vous utiliserez un **chart Helm**, un **fichier de valeurs local**, puis testerez les **révisions**, les **upgrades**, les **rollbacks** et la **persistance PostgreSQL**.

Ce lab utilise **votre propre infrastructure** : VM Ubuntu avec K3s, cluster Kubernetes existant, Proxmox ou autre. Aucune adresse IP ni StorageClass n'est imposée. Les adresses utilisées dans les exemples doivent être remplacées par les vôtres.

### Objectifs pédagogiques

À la fin de ce lab, vous saurez :

1. Expliquer les rôles de `Chart.yaml`, `values.yaml`, des templates et d'une release Helm.
2. Configurer l'accès à Kubernetes pour **kubectl et Helm**, notamment avec K3s.
3. Choisir une StorageClass existante et personnaliser des valeurs locales.
4. Déployer PostgreSQL, un Job de migration, une API et un frontend.
5. Diagnostiquer les images, les Secrets, les PVC et les accès réseau.
6. Réaliser un `helm upgrade`, consulter l'historique et effectuer un rollback.
7. Vérifier que les données PostgreSQL survivent à la recréation de son Pod.

---

## 1. Prérequis et architecture

**Connaissances :** Pods, Deployments, StatefulSets, Services, Jobs, PVC, images OCI, notions de YAML.

**Ressources conseillées pour un petit lab :** environ 2 vCPU, 4 Go de RAM et 20 Go de disque libre, à ajuster selon les autres services présents. Les images peuvent occuper plusieurs gigaoctets.

| Outil | Vérification | Utilité |
|---|---|---|
| Git | `git --version` | Récupérer les sources |
| kubectl | `kubectl version --client` | Inspecter Kubernetes |
| Helm | `helm version` | Gérer les releases |
| OpenSSL | `openssl version` | Générer un secret JWT |
| Docker (facultatif) | `docker version` | Construire/publier vos propres images |

**Architecture logique :** navigateur → frontend Nginx → API backend → PostgreSQL. Un Job applique les migrations de schéma. PostgreSQL monte un PVC ; les Pods applicatifs sont gérés par des Deployments.

> **Important :** K3s utilise `containerd` pour exécuter les Pods. Une image présente dans `docker images` sur la VM n'est pas automatiquement disponible dans K3s. Le moyen le plus simple pour ce lab est un registre accessible au cluster, par exemple GHCR.

## 2. Préparer une VM Ubuntu avec K3s et Helm (si nécessaire)

**Sautez l'installation de K3s si vous possédez déjà un cluster Kubernetes fonctionnel.** Dans ce cas, configurez seulement votre kubeconfig et installez Helm sur la machine où vous travaillerez.

### 2.1 Préparer Ubuntu

```bash
sudo apt update
sudo apt install -y curl ca-certificates git openssl
cat /etc/os-release
free -h
df -h /
```

### 2.2 Installer K3s

Consultez d'abord la [documentation officielle K3s](https://docs.k3s.io/quick-start) et les implications réseau. La commande d'installation rapide est :

```bash
curl -sfL https://get.k3s.io -o /tmp/install-k3s.sh
less /tmp/install-k3s.sh
sudo sh /tmp/install-k3s.sh
```

Vérifiez :

```bash
sudo systemctl status k3s --no-pager
kubectl get nodes -o wide
kubectl get pods -A
kubectl get storageclass
```

**Attendu :** nœud `Ready`, composants système en fonctionnement et, dans une installation K3s standard, StorageClass `local-path`.

### 2.3 Installer Helm

Référence : [installation officielle de Helm](https://helm.sh/docs/intro/install/).

```bash
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 -o /tmp/get_helm.sh
less /tmp/get_helm.sh
chmod 700 /tmp/get_helm.sh
sudo /tmp/get_helm.sh
helm version
```

### 2.4 Indispensable sur K3s : comprendre `KUBECONFIG`

Kubernetes expose une API. `kubectl` et Helm sont des **clients distincts** qui doivent connaître son adresse et ses identifiants. Le fichier **kubeconfig** contient ces informations.

Sur un serveur K3s, le fichier d'administration est généralement :

```text
/etc/rancher/k3s/k3s.yaml
```

K3s peut configurer son `kubectl` embarqué automatiquement, alors que Helm cherche un autre kubeconfig et tente parfois de joindre `http://localhost:8080`. L'erreur peut ressembler à :

```text
Kubernetes cluster unreachable: Get "http://localhost:8080/version": connect: connection refused
```

**Dans le shell root de la VM K3s**, configurez explicitement :

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
printf 'KUBECONFIG=%s\n' "$KUBECONFIG"
kubectl get nodes
helm list -A
```

**Pourquoi ?** `export` transmet la variable aux programmes démarrés depuis ce shell, y compris Helm et kubectl. Elle ne persiste pas automatiquement après une nouvelle connexion SSH.

Pour la rendre permanente **uniquement pour le compte administrateur de cette VM** :

```bash
printf '\nexport KUBECONFIG=/etc/rancher/k3s/k3s.yaml\n' >> ~/.bashrc
source ~/.bashrc
```

Ne dupliquez pas cette ligne à chaque exercice. Vérifiez d'abord avec `grep KUBECONFIG ~/.bashrc`.

> **Sécurité :** ce kubeconfig donne des privilèges élevés. Ne le commitez jamais, ne le copiez pas dans un dépôt et ne modifiez pas ses permissions pour le rendre lisible par tous. Sur un poste distant ou avec un compte non-root, utilisez un kubeconfig adapté avec les droits nécessaires.

## 3. Récupérer les sources

```bash
mkdir -p "$HOME/devops-labs"
cd "$HOME/devops-labs"
git clone https://github.com/sdiawa/lab-devops.git
cd lab-devops/dsk-stock-lab03-helm
pwd
git rev-parse --short HEAD
ls -la
```

Si le dépôt est déjà cloné, réutilisez-le et préservez vos modifications locales. **Toutes les commandes suivantes partent de `dsk-stock-lab03-helm/`**, sauf mention contraire.

Repérez :

| Élément | Rôle |
|---|---|
| `chart/Chart.yaml` | Métadonnées et version du chart |
| `chart/values.yaml` | Valeurs par défaut |
| `chart/templates/` | Modèles YAML générés par Helm |
| `values.local.example.yaml` | Exemple de personnalisation |
| `values.local.yaml` | Vos paramètres locaux, non destinés à Git |
| `apps/` | Sources et Dockerfiles de l'application |

Examinez les fichiers **avant de les modifier** :

```bash
cat chart/Chart.yaml
cat chart/values.yaml
cat values.local.example.yaml
ls chart/templates
```

### Comprendre `.Values`

Dans un template Helm, `{{ .Values.frontend.replicas }}` lit la clé `frontend.replicas` du jeu de valeurs. Helm part de `chart/values.yaml`, puis applique les valeurs du fichier fourni avec `-f`. Une clé présente dans un fichier de valeurs **n'a aucun effet** si les templates ne la lisent pas.

## 4. Préparer les images applicatives

Pour reproduire le déploiement validé dans ce parcours, utilisez les images GHCR du Lab 03, **si elles sont publiques et toujours disponibles** :

```text
ghcr.io/sdiawa/dsk-stock-backend:lab03
ghcr.io/sdiawa/dsk-stock-frontend:lab03
```

Vous pouvez également publier vos propres images. Depuis le dossier du Lab 03 :

```bash
export GHCR_USER=VOTRE_COMPTE_GITHUB
read -rsp 'GitHub PAT : ' GHCR_TOKEN; echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
unset GHCR_TOKEN

docker build -f apps/backend/Dockerfile -t "ghcr.io/${GHCR_USER}/dsk-stock-backend:lab03" .
docker build -f apps/frontend/Dockerfile -t "ghcr.io/${GHCR_USER}/dsk-stock-frontend:lab03" .
docker push "ghcr.io/${GHCR_USER}/dsk-stock-backend:lab03"
docker push "ghcr.io/${GHCR_USER}/dsk-stock-frontend:lab03"
```

Pour créer un PAT classic : GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic). Pour publier des packages, choisissez les permissions adaptées, notamment `write:packages`, et une durée limitée. Ne stockez jamais le token dans Git. Pour un registre privé, l'authentification Docker de la VM ne suffit pas : les Pods Kubernetes ont besoin d'une configuration de type `imagePullSecrets`.

## 5. Découvrir la StorageClass de votre cluster

Avant de définir un PVC, découvrez les classes de stockage réellement disponibles :

```bash
kubectl get storageclass
```

**Exemple sur K3s :**

```text
NAME                   PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE
local-path (default)   rancher.io/local-path   Delete          WaitForFirstConsumer
```

Ici, le **nom à copier est `local-path`**, sans le texte `(default)` : cette indication est seulement un marqueur d'affichage.

- **StorageClass :** indique comment provisionner un volume.
- **PVC :** demande de stockage formulée par l'application.
- **PV :** volume réellement attribué à la demande.
- **`Bound` :** PVC associé à un PV.
- **`1Gi` :** capacité demandée, soit 1 gibioctet.
- **`RWO` :** `ReadWriteOnce`, accès en lecture/écriture selon les contraintes de montage Kubernetes.
- **`Delete` :** le PV peut être supprimé lorsque son PVC est supprimé ; attention à la perte des données.

Vous n'avez **pas besoin de créer une nouvelle StorageClass** si une classe adaptée existe déjà. Sur un cluster avec une StorageClass par défaut, le chart permet également de laisser `postgres.storageClass` vide.

> **Limite du stockage `local-path` :** il est lié au stockage local du nœud ; il ne fournit pas, à lui seul, une haute disponibilité des données entre plusieurs nœuds.

## 6. Créer `values.local.yaml` et protéger les secrets

```bash
cp values.local.example.yaml values.local.yaml
chmod 600 values.local.yaml
openssl rand -hex 32
nano values.local.yaml
```

Copiez la valeur générée par OpenSSL dans `secrets.jwtSecret`. Ne la partagez pas dans des captures, des logs ou le dépôt Git.

**Exemple complet à adapter** (remplacez `VOTRE_COMPTE` par l'user de ton github, la StorageClass et `IP_DE_VOTRE_VM` par IPV4 de ta vm) :

```yaml
backend:
  replicas: 1
  image: ghcr.io/VOTRE_COMPTE/dsk-stock-backend:lab03

frontend:
  replicas: 1
  image: ghcr.io/VOTRE_COMPTE/dsk-stock-frontend:lab03
  apiBaseUrl: "http://IP_DE_VOTRE_VM:3001/api"

postgres:
  storageClass: local-path
  storage: 1Gi

secrets:
  jwtSecret: REMPLACER_PAR_LE_RESULTAT_OPENSSL
```

**Important :** `IP_DE_VOTRE_VM` est un placeholder, pas une URL à laisser telle quelle. 10.0.0.50 est une adresse IP utilisée à titre d'exemple. Remplacez-la par l'adresse IPv4 de votre VM.

Pour le tunnel SSH décrit plus loin, choisissez plutôt `http://localhost:3001/api` ; pour un Ingress qui route correctement `/api` sur le même domaine, une URL relative `/api` peut être préférable. L'URL doit être accessible **depuis le navigateur**, pas seulement depuis le Pod frontend.

**Ne remplacez pas tout le fichier à l'aveugle :** conservez les paramètres existants nécessaires à votre variante. Le chart peut aussi accepter `existingSecret` pour un Secret Kubernetes déjà présent.

Vérifiez que le fichier local n'est pas suivi par Git :

```bash
git status --short -- values.local.yaml
```

S'il apparaît comme fichier non suivi, ajoutez-le à votre `.gitignore` avant tout commit. Attention : les Secrets Kubernetes et l'historique des releases Helm ne constituent pas un coffre-fort ; utilisez des identifiants de démonstration pour ce lab.

## 7. Exposer correctement l'URL de l'API dans le chart

### 7.1 Comprendre le problème `Network Error`

L'interface peut s'afficher, mais l'inscription échouer si le navigateur appelle une API inaccessible. Le frontend utilise `VITE_API_BASE_URL` **au démarrage du conteneur** pour générer le fichier `/usr/share/nginx/html/env.js`.

Sans configuration explicite, l'image utilisée lors de nos tests renvoyait :

```javascript
window.__APP_CONFIG__ = {
  apiBaseUrl: "https://api.stock.dsk.lab/api"
};
```

Cette URL n'est pas forcément accessible depuis votre ordinateur. **La bonne correction consiste à transmettre une valeur par Helm**, pas à modifier manuellement le Deployment en direct.

### 7.2 Ajouter une valeur par défaut

Ouvrez `chart/values.yaml` et vérifiez la section `frontend`. Ajoutez-y `apiBaseUrl` si elle est absente :

```yaml
frontend:
  image: dsk-stock-frontend:lab
  replicas: 1
  apiBaseUrl: "https://api.stock.dsk.lab/api"
```

Conservez les autres clés existantes. La valeur locale définie dans `values.local.yaml` prendra le dessus.

### 7.3 Modifier le template frontend au bon endroit

Ouvrez `chart/templates/app.yaml`. Dans le **Deployment frontend**, repérez `spec.template.spec.containers` puis ajoutez `env` au même niveau que `image`, `imagePullPolicy` et `ports` :

```yaml
# Extrait du Deployment frontend, à replacer dans le template existant
spec:
  template:
    spec:
      containers:
        - name: frontend
          image: {{ .Values.frontend.image | quote }}
          imagePullPolicy: {{ .Values.imagePullPolicy }}
          env:
            - name: VITE_API_BASE_URL
              value: {{ .Values.frontend.apiBaseUrl | quote }}
          ports:
            - containerPort: 80
```

**Attention : cet extrait illustre l'emplacement, il ne remplace pas le Deployment entier.** Conservez ses labels, sélecteurs, probes, ressources et autres champs existants.

La syntaxe `{{ .Values.frontend.apiBaseUrl | quote }}` demande à Helm de lire la valeur puis de la rendre comme chaîne YAML entre guillemets.

**Erreur réelle rencontrée :** ajouter `env` directement sous `spec` du Deployment provoque un warning de type :

```text
Warning: unknown field "spec.env"
```

Dans ce cas, Kubernetes peut ignorer ce champ. Une commande Helm réussie ne signifie pas que tous les champs YAML ont été appliqués.

## 8. Vérifier le chart avant installation

```bash
helm lint ./chart -f values.local.yaml
helm template stock ./chart --namespace stock-lab03 -f values.local.yaml > /tmp/stock-lab03-rendered.yaml
```

Le rendu peut contenir un Secret : **ne le commitez pas et ne partagez pas le fichier complet**.

Vérifiez les ressources générées :

```bash
grep -nE 'kind: (Deployment|StatefulSet|Job|PersistentVolumeClaim|Secret)|image:|storageClassName:|VITE_API_BASE_URL' /tmp/stock-lab03-rendered.yaml
```

**À observer :** images GHCR, StorageClass correcte, variable d'environnement dans le conteneur frontend, PVC PostgreSQL et Job de migration. `helm lint` vérifie le chart, mais n'est pas une garantie de validité de tous les champs Kubernetes ; inspectez le YAML rendu.

## 9. Installer la release Helm

```bash
helm upgrade --install stock ./chart --namespace stock-lab03 --create-namespace -f values.local.yaml --wait --wait-for-jobs --timeout 5m
```

**Explications :**

- `stock` : nom de la release.
- `./chart` : chart local.
- `--namespace` : espace de noms cible.
- `--create-namespace` : crée le namespace s'il manque.
- `-f` : surcharge les valeurs par défaut.
- `--wait` : attend la disponibilité des ressources prises en charge.
- `--wait-for-jobs` : attend également la réussite des Jobs.
- `--timeout 5m` : délai maximal d'attente de l'opération.

Vérifiez :

```bash
helm status stock -n stock-lab03
helm list -n stock-lab03
kubectl -n stock-lab03 get pods,jobs,pvc
kubectl -n stock-lab03 get deployments,statefulsets,services
```

**Attendu :** release `deployed`, frontend/backend/PostgreSQL `Running`, Job de migration `Completed`, PVC `Bound`. Le nom exact du Job dépend de la révision Helm.

```bash
kubectl -n stock-lab03 logs deploy/backend --tail=30
kubectl -n stock-lab03 get jobs
# Remplacer NOM_JOB par le nom affiché :
kubectl -n stock-lab03 logs job/NOM_JOB --tail=30
```

## 10. Accéder à l'application depuis votre navigateur

### Cas A — Navigateur sur la même machine que kubectl

Dans deux terminaux, laissez ces commandes actives :

```bash
kubectl -n stock-lab03 port-forward svc/frontend 8080:80
```

```bash
kubectl -n stock-lab03 port-forward svc/backend 3001:3001
```

Ouvrez `http://localhost:8080`. L'URL API du frontend doit être `http://localhost:3001/api` dans ce cas.

### Cas B — Navigateur sur un Mac/PC, cluster sur une VM distante (recommandé)

Sur la VM, lancez les deux port-forwards ci-dessus. Sur votre ordinateur, ouvrez un troisième terminal :

```bash
ssh -L 8080:127.0.0.1:8080 -L 3001:127.0.0.1:3001 UTILISATEUR@IP_DE_VOTRE_VM
```

Ouvrez `http://localhost:8080` sur votre ordinateur. Le navigateur peut alors joindre l'API sur `http://localhost:3001/api` via le tunnel.

### Cas C — Accès direct sur un réseau local de confiance

Sur la VM, vous pouvez écouter sur toutes les interfaces :

```bash
kubectl -n stock-lab03 port-forward --address 0.0.0.0 svc/frontend 8080:80
```

Dans un autre terminal :

```bash
kubectl -n stock-lab03 port-forward --address 0.0.0.0 svc/backend 3001:3001
```

Ouvrez `http://IP_DE_VOTRE_VM:8080` sur ta machine locale. 

### Vérifier `env.js` et l'API

```bash
kubectl -n stock-lab03 exec deploy/frontend -- wget -qO- http://127.0.0.1/env.js

kubectl -n stock-lab03 exec deploy/frontend -- printenv VITE_API_BASE_URL
```

Le fichier doit contenir l'URL réellement accessible depuis votre navigateur. Le backend possède aussi une route `/health` ; via le port-forward :

```bash
curl -i http://localhost:3001/health
curl -i http://localhost:3001/api/products
```

**Attendu :** `/health` renvoie `200` ; `/api/products` peut renvoyer `401` sans JWT, ce qui confirme la protection de la route. Vérifiez également l'inscription et la connexion dans le navigateur.

## 11. Recette métier : tester l'application

Depuis l'interface :

1. Créez un compte de démonstration et connectez-vous.
2. Ouvrez **Produits** et créez un produit, par exemple « Clavier DevOps » (quantité 10, prix 25 €, seuil d'alerte 3, selon les champs proposés).
3. Vérifiez qu'il apparaît dans la liste et que le tableau de bord se met à jour.
4. Testez les mouvements de stock prévus dans le Lab 02 et le refus d'une sortie supérieure au stock disponible.

**Important :** un Pod `Running` ne valide pas à lui seul la recette métier. Le navigateur doit réellement communiquer avec l'API et la base.

## 12. Vérifier la persistance PostgreSQL

**Prérequis :** au moins un produit a été créé et est visible dans l'interface.

Avant toute suppression, observez le PVC :

```bash
kubectl -n stock-lab03 get pvc
kubectl -n stock-lab03 get statefulset postgres
```

**Dans ce lab uniquement**, supprimez le Pod PostgreSQL :

```bash
kubectl -n stock-lab03 delete pod postgres-0
kubectl -n stock-lab03 rollout status statefulset/postgres --timeout=180s
kubectl -n stock-lab03 get pods,pvc
```

Le StatefulSet recrée `postgres-0`. Le PVC `data-postgres-0` doit rester `Bound` et conserver son identifiant de volume. Rechargez ensuite la liste des produits dans le navigateur.

**Résultat attendu :** le produit existe toujours. C'est la vérification de bout en bout de la persistance des données après recréation du Pod.

> **À ne pas confondre :** persistance locale ≠ sauvegarde ≠ haute disponibilité. La suppression du PVC, une panne de disque ou la perte du nœud peuvent entraîner une perte de données. N'effectuez pas ce test destructif sur une base de production.

## 13. Mettre à jour une release avec `helm upgrade`

Modifiez une valeur du fichier local, par exemple `backend.replicas` de `1` à `2` si votre VM dispose des ressources nécessaires :

```yaml
backend:
  replicas: 2
```

Puis appliquez :

```bash
helm upgrade stock ./chart --namespace stock-lab03  -f values.local.yaml  --wait --wait-for-jobs --timeout 5m

kubectl -n stock-lab03 get deployment backend
helm history stock -n stock-lab03
```

**Attendu :** deux réplicas backend disponibles et une nouvelle révision Helm. Rétablissez `replicas: 1` si les ressources de votre VM sont limitées, puis exécutez à nouveau `helm upgrade`.

## 14. Comprendre `helm history` et tester `helm rollback`

### 14.1 Lire l'historique

```bash
helm history stock -n stock-lab03
```

- `deployed` : révision active.
- `superseded` : révision remplacée par une autre.
- `rollback` : création d'une **nouvelle révision** à partir d'une configuration ancienne.

**Exemple réellement observé pendant la validation du lab :**

| Révision | État final observé | Opération |
|---|---|---|
| 1 | superseded | Installation initiale |
| 2 | superseded | Upgrade sans configuration API frontend correcte |
| 3 | superseded | Upgrade avec `VITE_API_BASE_URL` correcte |
| 4 | superseded | Rollback vers 2 |
| 5 | superseded | Rollback vers 2 |
| 6 | deployed | Rollback vers 3 : configuration fonctionnelle restaurée |

Ces numéros sont **un exemple de session**, pas des numéros garantis pour votre cluster. Le deuxième rollback vers 2 reflète l'historique effectivement observé ; il n'est pas nécessaire de le reproduire.

### 14.2 Identifier une révision cible sans divulguer les secrets

```bash
helm history stock -n stock-lab03
helm get manifest stock -n stock-lab03 --revision NUMERO | grep -A 12 'name: frontend'
```

Vérifiez si la variable `VITE_API_BASE_URL` existe dans le conteneur frontend. **Ne partagez pas la sortie complète de `helm get values` ou des manifests contenant des Secrets.**

### 14.3 Effectuer un rollback contrôlé

Choisissez une révision antérieure connue, puis :

```bash
helm rollback stock NUMERO_ANCIEN -n stock-lab03 --wait --timeout 5m

helm history stock -n stock-lab03
kubectl -n stock-lab03 rollout status deployment/frontend
kubectl -n stock-lab03 exec deploy/frontend -- wget -qO- http://127.0.0.1/env.js
```

Pendant la validation, le rollback vers une révision dépourvue de `VITE_API_BASE_URL` a restauré `https://api.stock.dsk.lab/api` dans `env.js`. La commande `printenv VITE_API_BASE_URL` retournait alors le code `1` : variable absente.

### 14.4 Restaurer la configuration fonctionnelle

Repérez dans `helm history` la révision qui contenait la bonne URL, puis :

```bash
helm rollback stock NUMERO_FONCTIONNEL -n stock-lab03 --wait --timeout 5m

helm history stock -n stock-lab03
kubectl -n stock-lab03 exec deploy/frontend -- wget -qO- http://127.0.0.1/env.js
kubectl -n stock-lab03 get pods
```

**À comprendre :** un rollback restaure les ressources et les valeurs Helm enregistrées, mais **ne restaure pas automatiquement le contenu de PostgreSQL ni n'annule les migrations SQL**. Une stratégie de sauvegarde et de compatibilité de schéma est nécessaire pour la production.

> **Remarque importante :** après un rollback, vos fichiers locaux ne sont pas automatiquement réécrits. Avant un prochain `helm upgrade`, vérifiez que le chart et `values.local.yaml` correspondent à la configuration que vous souhaitez conserver.

## 15. Diagnostic : erreurs rencontrées et solutions

| Symptôme | Cause possible | Vérification ou correction |
|---|---|---|
| Helm tente `localhost:8080` | Kubeconfig absent ou incorrect | `export KUBECONFIG=/etc/rancher/k3s/k3s.yaml`, puis `helm list -A` |
| PVC `Pending` | StorageClass inexistante ou provisionnement en attente | `kubectl get storageclass`, `kubectl describe pvc -n stock-lab03 data-postgres-0` |
| `ImagePullBackOff` | Image/tag inaccessible ou registre privé | `kubectl describe pod -n stock-lab03 NOM_POD`, vérifier GHCR et `imagePullSecrets` |
| Frontend visible, inscription `Network Error` | URL API inaccessible depuis le navigateur | Inspecter `env.js`, `VITE_API_BASE_URL`, port-forward et tunnel |
| `unknown field "spec.env"` | `env` placé hors du conteneur dans le YAML | Corriger l'indentation dans `chart/templates/app.yaml` |
| Job de migration bloqué | PostgreSQL non prêt, identifiants ou schéma incorrects | `kubectl get jobs`, `kubectl logs job/NOM_JOB` |
| Disque saturé | Images et cache de build | `df -h /`, `docker system df` ; nettoyer uniquement les caches inutilisés après inspection |
| Le rollback réussit mais l'application échoue | Configuration ancienne incompatible | Examiner les manifests de révision et refaire la recette métier |

Commandes générales :

```bash
helm status stock -n stock-lab03
kubectl -n stock-lab03 get pods,jobs,pvc,events
kubectl -n stock-lab03 describe deployment frontend
kubectl -n stock-lab03 logs deploy/backend --tail=100
kubectl -n stock-lab03 get jobs
```

Évitez de supprimer aveuglément les volumes Docker, les PVC ou les ressources système K3s pour libérer de l'espace.

## 16. Exercices complémentaires

1. Déployer une deuxième installation dans `stock-lab03-b` avec un fichier de valeurs distinct, puis vérifier l'isolation des données.
2. Exposer les `requests` et `limits` dans `values.yaml`, puis mesurer leur effet sur les Pods.
3. Ajouter un Ingress avec un nom DNS et un contrôleur réellement présents dans votre cluster.
4. Expliquer pourquoi un Job de migration lancé avant la disponibilité de PostgreSQL peut échouer.
5. Utiliser `existingSecret` à la place des identifiants de démonstration définis dans le chart.

### Questions de compréhension

1. Pourquoi `helm template` n'installe-t-il aucune ressource dans Kubernetes ?
2. Quelle différence existe entre `values.yaml` et `values.local.yaml` ?
3. Pourquoi faut-il choisir une StorageClass existante avant le déploiement de PostgreSQL ?
4. Pourquoi une image construite avec Docker peut-elle être invisible depuis K3s ?
5. Pourquoi `localhost` dans un navigateur Mac ne pointe-t-il pas vers la VM K3s ?
6. Quelle est la différence entre un Deployment et un StatefulSet ?
7. Pourquoi un rollback Helm ne restaure-t-il pas les anciennes données SQL ?
8. Pourquoi une nouvelle révision apparaît-elle après un rollback ?

## 17. Recette finale et livrable

| Contrôle | Preuve attendue |
|---|---|
| Kubeconfig | Helm et kubectl accèdent au même cluster |
| Chart | `helm lint` passe ; `helm template` rend les bonnes valeurs |
| Déploiement | Release `deployed`, Pods `Running`, Job `Completed` |
| Stockage | PVC PostgreSQL `Bound` avec la StorageClass choisie |
| Réseau | `env.js` contient l'URL API accessible au navigateur |
| Métier | Inscription, connexion et produit visibles |
| Persistance | Produit toujours présent après recréation de `postgres-0` |
| Révisions | Upgrade, history, rollback et restauration vérifiés |

Complétez `COMPTE-RENDU.md` avec votre architecture, vos commandes, vos captures utiles, les erreurs rencontrées et vos réponses. **Masquez** les JWT, mots de passe, tokens, kubeconfigs et autres données sensibles.

## 18. Terminer le lab et nettoyer (facultatif)

Arrêtez les port-forwards et tunnels avec `Ctrl+C`.

Si vous souhaitez **conserver les données pour le lab suivant**, ne désinstallez pas PostgreSQL et ne supprimez pas son PVC.

Pour supprimer la release :

```bash
helm uninstall stock -n stock-lab03
```

Les PVC d'un StatefulSet peuvent subsister après désinstallation. **Ne supprimez le namespace et les PVC que si vous acceptez de perdre les données de l'exercice.** Ne supprimez ni votre VM ni les services partagés du cluster pour simplement terminer le lab.

---

**Références :** [K3s](https://docs.k3s.io/) · [Helm](https://helm.sh/docs/) · [Kubernetes — Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/) · [Kubernetes — StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/).
