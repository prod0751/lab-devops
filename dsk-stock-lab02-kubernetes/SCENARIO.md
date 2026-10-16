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
  | http://localhost:8080 (kubectl port-forward)
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

## 4. Construire et rendre les images disponibles

Le Lab 02 référence ces images :

```text
dsk-stock-backend:lab
dsk-stock-frontend:lab
```

**Point de vigilance :** les Dockerfiles sont situés dans `apps/backend/Dockerfile` et `apps/frontend/Dockerfile`. Leur contexte de build (`.` ou sous-dossier) dépend des instructions `COPY` qu'ils contiennent. **Vérifiez ces instructions avant d'exécuter un build** :

```bash
sed -n '1,180p' apps/backend/Dockerfile
sed -n '1,180p' apps/frontend/Dockerfile
```

Si les Dockerfiles attendent la racine du Lab 02 comme contexte, les commandes seront :

```bash
docker build -f apps/backend/Dockerfile -t dsk-stock-backend:lab .
docker build -f apps/frontend/Dockerfile -t dsk-stock-frontend:lab .
docker images | grep dsk-stock
```

**Résultat attendu :** les deux images apparaissent dans `docker images`. Si le build échoue sur un `COPY`, corrigez le **contexte de build** en fonction du Dockerfile : ne modifiez pas les chemins au hasard.

### Option B — kind

Après avoir créé ou sélectionné votre cluster kind, chargez les images sur ses nœuds :

```bash
kind get clusters
kind load docker-image dsk-stock-backend:lab dsk-stock-frontend:lab --name NOM_DU_CLUSTER_KIND
```

Remplacez `NOM_DU_CLUSTER_KIND` par le nom affiché. La présence des images dans Docker Desktop **ne suffit pas** à les rendre visibles dans kind.

### Option C — Minikube

```bash
minikube image load dsk-stock-backend:lab
minikube image load dsk-stock-frontend:lab
```

Assurez-vous que `kubectl` pointe vers le profil Minikube voulu.

### Option A ou D — K3s / kubeadm / cluster multinœud

**Voie recommandée : un registre accessible par tous les nœuds.** Publiez les images dans un registre dont les nœuds peuvent tirer les images (public, ou privé avec authentification `imagePullSecrets`). Puis créez des **copies locales** des manifests, en remplaçant les deux références `dsk-stock-*:lab` par leurs références complètes de registre, dans le Job **et** dans les Deployments.

Exemple **illustratif** (à remplacer par votre registre et votre tag réel) :

```text
registry.example.org/formation/dsk-stock-backend:lab02
registry.example.org/formation/dsk-stock-frontend:lab02
```

Pour les clusters multinœuds, une image présente sur **un seul nœud** ne suffit pas. L'import manuel dans containerd sur K3s est une autre possibilité, mais nécessite de suivre la procédure K3s correspondant à votre installation et de rendre les images disponibles sur tous les nœuds susceptibles d'exécuter les Pods. Évitez de dépendre de tags mutables en production ; préférez un tag versionné ou un digest.

**Vérification avant de continuer :** les deux images doivent être disponibles pour les Pods du cluster. Un `ImagePullBackOff` signifie souvent qu'elles ne le sont pas ou que le registre nécessite des identifiants.

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

## 6. Accéder à l'interface, à l'API et à Swagger

Dans un **premier terminal**, laissez cette commande ouverte :

```bash
kubectl -n stock-lab02 port-forward service/frontend 8080:80
```

Ouvrez **http://localhost:8080**. L'API est également accessible via le proxy Nginx, par exemple **http://localhost:8080/api/products** ; sans authentification, une réponse `401 Unauthorized` est attendue sur cette route protégée.

Dans un **deuxième terminal** :

```bash
kubectl -n stock-lab02 port-forward service/backend 3001:3001
```

Testez :

```bash
curl -i http://localhost:3001/health
curl -i http://localhost:3001/api/products
```

- **`/health`** : `200 OK` et `{"status":"ok"}` si le backend fonctionne.
- **`/api/products`** : `401 Unauthorized` sans JWT est normal.
- **http://localhost:3001/docs** : documentation Swagger **uniquement si elle est activée dans le code backend**. Un `404` ne signifie pas que Kubernetes est en panne.
- **`/api`** seul peut renvoyer `404` : ce n'est pas un endpoint métier défini.

Si vous exécutez `kubectl port-forward` sur une VM distante, `localhost` désigne **cette VM**, pas votre ordinateur. Utilisez un tunnel SSH approprié ou exécutez le port-forward depuis votre ordinateur équipé du kubeconfig. N'exposez pas ces ports publiquement sans sécurisation.

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
| `ImagePullBackOff` | Image absente, mauvais tag ou registre inaccessible | `kubectl -n stock-lab02 describe pod NOM` |
| `CrashLoopBackOff` | Processus qui échoue au démarrage | `kubectl -n stock-lab02 logs NOM --previous` |
| Job `Failed` | Erreur de connexion ou migration | `kubectl -n stock-lab02 logs job/stock-migrate --all-containers=true` |
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

Documentez : type de cluster, contexte `kubectl`, nombre de nœuds, StorageClass, méthode de distribution des images, captures ou sorties des objets `Ready`/`Bound`/`Complete`, tests HTTP, scénario métier, preuve de persistance, incident rencontré et solution, réponses aux exercices. **Masquez secrets, JWT, mots de passe et kubeconfigs.** Notez le commit Git utilisé.

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
- Pour un parcours véritablement prêt à l'emploi sur K3s, fournir des images publiques versionnées ou un script de publication vers un registre, plus un mécanisme documenté pour remplacer les références d'images dans **les deux** manifests concernés (`20-migrate.yaml` et `30-app.yaml`).
- Vérifier dans le backend que Swagger est effectivement monté sur `/docs` avant de le promettre.
- Éviter les identifiants d'exemple en dehors d'un lab isolé ; améliorer à terme la création des Secrets et la gestion des droits.
