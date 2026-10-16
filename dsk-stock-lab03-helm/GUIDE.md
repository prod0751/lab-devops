# Projet 03 — Transformer les manifests en chart Helm — Guide pas à pas

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
Installer DSK Stock avec un chart paramétrable indépendant de Harbor, Longhorn et des domaines privés. Comprendre valeurs, templates, release et upgrade.

Niveau : intermédiaire débutant. Durée indicative : 2 h. Prérequis : Helm 3, un cluster accessible et des images disponibles sur ses nœuds. Pour les préparer directement, suivre l'étape 1 du [projet 02](../dsk-stock-lab02-kubernetes/README.md).

## Fichiers et choix
Le chart `chart/` déploie PostgreSQL, ses données, un Job de migration, l'API et Nginx. Il utilise des noms de services fixes : une seule release dans chaque namespace. Installer une autre release dans un namespace distinct.

Le Job est nommé avec le numéro de révision Helm. Le backend attend que la table Product existe dans un initContainer. L'option `--wait-for-jobs` permet de ne déclarer l'installation réussie qu'après la fin des migrations. Pour une mise à jour de schéma, prévoir la compatibilité avec les versions applicatives encore en service.

## Paramètres à adapter au cluster

Dans le fichier `values.local.yaml` utilisé par ce projet, ajouter les paramètres correspondant à votre environnement :

```yaml
backend:
  image: docker.io/VOTRE_COMPTE/dsk-stock-backend:lab-v1
frontend:
  image: docker.io/VOTRE_COMPTE/dsk-stock-frontend:lab-v1
postgres:
  storageClass: NOM_DE_VOTRE_STORAGECLASS
  storage: 1Gi
```

Ces valeurs sont des exemples à remplacer. Sur kind ou après import sous les noms de lab, conserver les images d'origine. Omettre `storageClass` pour utiliser la classe par défaut. Garder les autres paramètres du fichier, notamment le JWT du lab 03/06 ou `existingSecret` du lab 07. Le chart accepte désormais une classe de stockage explicite.

## 1. Créer un fichier de valeurs local
```bash
cp labs/dsk-stock-lab03-helm/values.local.example.yaml labs/dsk-stock-lab03-helm/values.local.yaml
openssl rand -hex 32
```
Remplacer la valeur `secrets.jwtSecret` dans `values.local.yaml`. Ce fichier est ignoré par Git. Les valeurs du chart sont des identifiants de démonstration ; utiliser uniquement des caractères alphanumériques et underscores pour les paramètres de connexion simplifiés.

## 2. Examiner le rendu
```bash
helm lint labs/dsk-stock-lab03-helm/chart -f labs/dsk-stock-lab03-helm/values.local.yaml
helm template stock labs/dsk-stock-lab03-helm/chart -n stock-lab03 -f labs/dsk-stock-lab03-helm/values.local.yaml
```
Le rendu affiche le Secret : garder cette sortie locale. Repérer les replicas, images, volumes et noms de services.

## 3. Installer
```bash
helm upgrade --install stock labs/dsk-stock-lab03-helm/chart \
  --namespace stock-lab03 --create-namespace \
  -f labs/dsk-stock-lab03-helm/values.local.yaml \
  --wait --wait-for-jobs --timeout 5m
kubectl -n stock-lab03 get pods,jobs,pvc
kubectl -n stock-lab03 port-forward service/frontend 8080:80
```
Ouvrir http://localhost:8080 puis exécuter [le scénario](../SCENARIO.md).

## 4. Mettre à jour
Dans `values.local.yaml`, passer `backend.replicas` à 2 puis relancer la commande d'installation. Examiner :
```bash
helm history stock -n stock-lab03
kubectl -n stock-lab03 get deployment backend
```
Les Jobs achevés de révisions précédentes peuvent rester présents ; ils servent ici de trace d'exécution. Le retour à une version applicative ne revient pas automatiquement sur les migrations de base.

## Exercices
1. Déployer une deuxième installation dans `stock-lab03-b` avec un nouveau fichier de valeurs.
2. Modifier les requests et limits en les exposant dans `values.yaml`.
3. Ajouter un Ingress en option ; préciser l'Ingress Controller et le DNS requis.
4. Expliquer pourquoi un hook pre-install de migration échouerait si PostgreSQL n'existe pas encore.
5. Remplacer les identifiants rendus dans le chart par un Secret existant via `existingSecret`.

Livrable : rendu commenté, historique d'upgrade, scénario métier et comparaison des deux namespaces.

## Dépannage
```bash
helm status stock -n stock-lab03
kubectl -n stock-lab03 get jobs
kubectl -n stock-lab03 logs job/stock-migrate-1
kubectl -n stock-lab03 logs deployment/backend -c wait-schema
```
Adapter le suffixe du Job à la révision. Si l'installation attend, diagnostiquer la base et les migrations avant d'augmenter le timeout.

## Nettoyage
```bash
helm uninstall stock -n stock-lab03
```
Les PVC créés par le StatefulSet peuvent rester après désinstallation. Supprimer `stock-lab03` uniquement si vous voulez également supprimer ces données.

Référence : [documentation Helm](https://helm.sh/docs/).

## Vérifier l'accès depuis votre propre poste

Si les commandes sont exécutées dans une VM, garder le tunnel SSH actif pendant la vérification. Ouvrir l'URL locale du tunnel, et non le nom interne `backend` ou `postgres`. Réaliser [le scénario métier](../SCENARIO.md) lorsqu'une application est déployée. Pour le lab CI, les critères portent d'abord sur le run GitHub et les images publiées.

Consigner votre environnement, la distribution Kubernetes éventuelle, les versions, l'architecture des nœuds et le résultat des étapes dans votre compte rendu. Les variantes Proxmox/Vagrant et les clusters existants sont documentés ; ils n'ont pas tous été exécutés lors de la validation initiale. Voir [les vérifications](../VALIDATION.md).
