# Projet 02 — Déployer sur Kubernetes avec des manifests simples — Guide pas à pas

## Avant de commencer : choisissez votre environnement

Ce guide s'exécute depuis la racine **de ce projet**, où se trouvent `apps/` et `labs/`. Proxmox n'est pas requis : une VM Vagrant, une autre VM Linux, un poste personnel ou un cluster déjà disponible peuvent être utilisés.

1. Lire [ENVIRONNEMENT.md](ENVIRONNEMENT.md) pour distinguer PC, VM et cluster.
2. Préparer les outils demandés ci-dessous sur la machine d'exécution.
3. Si Kubernetes est utilisé, choisir soit le chemin kind, soit votre cluster existant ; préparer ses images et son stockage.
4. Choisir l'accès navigateur direct ou le tunnel SSH. Les URL localhost du pas à pas désignent la machine d'exécution ; le tunnel les rend disponibles depuis le PC.
5. Exécuter les étapes dans l'ordre et vérifier les résultats avant de continuer.

Les fichiers inclus suffisent pour ce projet ; il n'est pas nécessaire de cloner un autre dépôt de lab. Les liens vers d'autres projets expliquent les composants réutilisés et restent dans ce dépôt.

### Chemin A : cluster kind

Si vous n'avez pas de cluster, créer kind avec l'étape 6 d'ENVIRONNEMENT.md, puis construire et charger les images avec son étape 7. Le nom `kind-stock-labs` désigne seulement ce cluster local.

### Chemin B : votre cluster existant

Ne créer aucun cluster kind. Vérifier votre contexte avec `kubectl config current-context` et les nœuds avec `kubectl get nodes`. Utiliser les images du registre accessible à vos nœuds, ou l'import adapté à votre runtime, puis choisir votre StorageClass avec `kubectl get storageclass`. La préparation est détaillée dans ENVIRONNEMENT.md.

## Mission et objectifs
Déployer le même service sur un cluster Kubernetes de votre choix avec des fichiers YAML et kubectl. Comprendre Namespace, Secret, Service, Deployment, StatefulSet, PVC, Job et probes.

Niveau : débutant Kubernetes. Durée indicative : 2 à 3 h. Prérequis : kubectl, un cluster prêt et des images disponibles ; Docker pour les construire et kind seulement si vous choisissez ce chemin ; accès à Internet pour les images. Prévoir plusieurs Go de mémoire disponibles. Helm, Vault et ArgoCD ne sont pas utilisés.

## Architecture
Navigateur → port-forward du Service frontend → Nginx → Service backend → PostgreSQL et son PVC. Un Job applique les migrations avant la création des Deployments.

Tous les noms DNS de services sont internes au namespace `stock-lab02`. Les images du projet 01 utilisent ces mêmes noms `backend` et `postgres`.

## 1. Préparer les manifests pour votre environnement

Après la préparation d'ENVIRONNEMENT.md, générer des copies locales. **Avec kind ou des images importées sous leurs noms de lab** :

```bash
python3 labs/prepare-kubernetes.py
```

**Avec un registre et une StorageClass choisie**, définir les variables comme dans ENVIRONNEMENT.md, puis :

```bash
python3 labs/prepare-kubernetes.py \
  --backend-image "$LAB_BACKEND_IMAGE" \
  --frontend-image "$LAB_FRONTEND_IMAGE" \
  --storage-class NOM_DE_VOTRE_STORAGECLASS
```

Remplacer le nom de classe avant exécution ; omettre `--storage-class` pour conserver la classe par défaut. Les fichiers sont créés dans `labs/dsk-stock-lab02-kubernetes/manifests.local/`, sans modifier les références fournies. L'outil refuse d'écraser un dossier existant ; pour une nouvelle préparation, choisir un dossier neuf avec `--output` et adapter les chemins des étapes suivantes.

## 2. Créer le namespace et le Secret
```bash
kubectl apply -f labs/dsk-stock-lab02-kubernetes/manifests.local/00-namespace.yaml
export LAB_JWT_SECRET="$(openssl rand -hex 32)"
kubectl -n stock-lab02 create secret generic stock-secrets \
  --from-literal=POSTGRES_USER=stock \
  --from-literal=POSTGRES_PASSWORD=stock_local_only \
  --from-literal=POSTGRES_DB=stock \
  --from-literal=DATABASE_URL=postgresql://stock:stock_local_only@postgres:5432/stock \
  --from-literal=JWT_SECRET="$LAB_JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -
unset LAB_JWT_SECRET
```
Les identifiants sont fictifs et locaux. Un Secret Kubernetes ne remplace pas un gestionnaire de secrets : son encodage base64 n'est pas du chiffrement. Ne publiez pas sa valeur générée.

## 3. Installer la base
```bash
kubectl -n stock-lab02 apply -f labs/dsk-stock-lab02-kubernetes/manifests.local/10-postgres.yaml
kubectl -n stock-lab02 rollout status statefulset/postgres --timeout=180s
kubectl -n stock-lab02 get pvc
```
Le PVC utilise la StorageClass choisie pendant la préparation, ou la classe par défaut. Vérifier que le volume devient Bound ; un PVC Pending nécessite de vérifier le provisionneur avant de poursuivre.

## 4. Migrer, puis installer l'application
```bash
kubectl -n stock-lab02 apply -f labs/dsk-stock-lab02-kubernetes/manifests.local/20-migrate.yaml
kubectl -n stock-lab02 wait --for=condition=complete job/stock-migrate --timeout=300s
kubectl -n stock-lab02 logs job/stock-migrate
kubectl -n stock-lab02 apply -f labs/dsk-stock-lab02-kubernetes/manifests.local/30-app.yaml
kubectl -n stock-lab02 rollout status deployment/backend --timeout=180s
kubectl -n stock-lab02 rollout status deployment/frontend --timeout=180s
```
Ne poursuivez pas si la migration échoue. Pour rejouer un Job terminé après une nouvelle image, supprimer uniquement `job/stock-migrate`, puis appliquer son manifest et attendre à nouveau.

## 5. Accéder au service
Dans un terminal qui reste ouvert :
```bash
kubectl -n stock-lab02 port-forward service/frontend 8080:80
```
Ouvrir http://localhost:8080 puis [valider le métier](../SCENARIO.md). Pour Swagger et health, utiliser un deuxième terminal :
```bash
kubectl -n stock-lab02 port-forward service/backend 3001:3001
```
La configuration frontend reste `/api` : inutile d'exposer l'API au navigateur sur un deuxième port pour utiliser l'application.

## Exercices
1. Supprimer `pod/postgres-0` et attendre sa recréation : les données doivent rester dans le PVC.
2. Passer le backend à deux replicas. Observer les Pods et les endpoints du Service.
3. Définir la différence entre startupProbe, readinessProbe et livenessProbe.
4. Choisir un tag d'image inexistant et diagnostiquer ImagePullBackOff.
5. Expliquer pourquoi le Job de migration précède l'API.

Livrable : schéma Kubernetes, résultat métier et preuve de persistance après recréation du Pod. Les probes HTTP utilisent le `/health` actuel, qui ne teste pas l'accès à la base ; c'est une limite à discuter.

## Dépannage
```bash
kubectl -n stock-lab02 get pods,jobs,svc,pvc
kubectl -n stock-lab02 describe pod postgres-0
kubectl -n stock-lab02 logs deployment/backend
kubectl -n stock-lab02 get events --sort-by=.lastTimestamp
```
- PVC Pending : vérifier la StorageClass.
- ImagePullBackOff : vérifier le registre ou l’import dans le runtime du cluster ; `IfNotPresent` permet leur utilisation locale.
- CrashLoopBackOff : lire les logs et vérifier Secret, migrations et connexion PostgreSQL.
- Réponse 502 : vérifier le Service backend et ses endpoints.

## Nettoyage
Ctrl+C arrête les port-forwards. Pour détruire uniquement ce projet :
```bash
kubectl delete namespace stock-lab02
```
Cette suppression détruit aussi son PVC et ses données. `kind delete cluster --name stock-labs` supprime tous les labs présents dans ce cluster ; ne l’utiliser que pour le cluster kind créé pour le cours ; ne jamais supprimer votre cluster existant pour nettoyer un exercice.

## Vérifier l'accès depuis votre propre poste

Si les commandes sont exécutées dans une VM, garder le tunnel SSH actif pendant la vérification. Ouvrir l'URL locale du tunnel, et non le nom interne `backend` ou `postgres`. Réaliser [le scénario métier](../SCENARIO.md) lorsqu'une application est déployée. Pour le lab CI, les critères portent d'abord sur le run GitHub et les images publiées.

Consigner votre environnement, la distribution Kubernetes éventuelle, les versions, l'architecture des nœuds et le résultat des étapes dans votre compte rendu. Les variantes Proxmox/Vagrant et les clusters existants sont documentés ; ils n'ont pas tous été exécutés lors de la validation initiale. Voir [les vérifications](../VALIDATION.md).
