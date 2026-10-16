# Projet 06 — Observer la disponibilité avec Prometheus et Grafana — Guide pas à pas

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
Mesurer si le frontend et l'API répondent, afficher leur latence et observer une panne volontaire. Comprendre exporter, scrape, labels et requêtes PromQL.

Niveau : intermédiaire. Durée : 2 à 3 h. Prérequis : un cluster Kubernetes accessible, Helm et les images de cette application. Aucun endpoint `/metrics` n'existe dans le backend actuel : Blackbox Exporter réalise ici des sondes HTTP externes.

## Architecture
Prometheus → Blackbox Exporter → HTTP frontend et health backend. Grafana interroge Prometheus. Les sondes ne vérifient pas une inscription, une opération de stock ou l'accès PostgreSQL.

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

## 1. Déployer une application indépendante
Préparer les outils et images comme dans le [projet 02](../dsk-stock-lab02-kubernetes/README.md), puis :
```bash
cp labs/dsk-stock-lab03-helm/values.local.example.yaml labs/dsk-stock-lab06-prometheus-grafana/values.local.yaml
openssl rand -hex 32
```
Remplacer le JWT dans ce fichier, puis :
```bash
helm upgrade --install stock labs/dsk-stock-lab03-helm/chart \
  -n stock-lab06 --create-namespace \
  -f labs/dsk-stock-lab06-prometheus-grafana/values.local.yaml \
  --wait --wait-for-jobs --timeout 5m
```

## 2. Installer l'observabilité
Créer un mot de passe local pour Grafana :
```bash
export LAB_GRAFANA_PASSWORD="$(openssl rand -hex 16)"
kubectl -n stock-lab06 create secret generic grafana-admin \
  --from-literal=password="$LAB_GRAFANA_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -
```
Conserver cette valeur dans votre gestionnaire local pour vous connecter, puis `unset LAB_GRAFANA_PASSWORD`.

```bash
kubectl -n stock-lab06 apply -f labs/dsk-stock-lab06-prometheus-grafana/config.yaml
kubectl -n stock-lab06 apply -f labs/dsk-stock-lab06-prometheus-grafana/workloads.yaml
kubectl -n stock-lab06 rollout status deployment/blackbox --timeout=180s
kubectl -n stock-lab06 rollout status deployment/prometheus --timeout=180s
kubectl -n stock-lab06 rollout status deployment/grafana --timeout=180s
```

## 3. Examiner Prometheus
Dans un terminal :
```bash
kubectl -n stock-lab06 port-forward service/prometheus 9090:9090
```
Ouvrir http://localhost:9090 et la page Targets. Interroger :
```promql
probe_success{job="stock-http"}
```
Les deux séries doivent valoir 1. Interroger la durée :
```promql
probe_duration_seconds{job="stock-http"}
```

## 4. Créer un dashboard Grafana
Dans un deuxième terminal :
```bash
kubectl -n stock-lab06 port-forward service/grafana 3000:3000
```
Ouvrir http://localhost:3000, compte `admin` et mot de passe créé à l'étape 2. La datasource Prometheus est préconfigurée.

Créer un dashboard avec un panneau de disponibilité basé sur `probe_success{job="stock-http"}` et un panneau de durée basé sur `probe_duration_seconds{job="stock-http"}`. Utiliser `{{instance}}` comme légende. Choisir une période courte et un rafraîchissement de 15 secondes.

## 5. Observer une panne
```bash
kubectl -n stock-lab06 scale deployment backend --replicas=0
```
Après quelques scrapes, la sonde backend doit passer à 0. La sonde frontend peut rester à 1, car elle teste la page statique et non une opération API. Restaurer :
```bash
kubectl -n stock-lab06 scale deployment backend --replicas=1
```
Si vous adaptez ce projet à un namespace piloté par ArgoCD avec selfHeal, une modification manuelle peut être corrigée automatiquement ; réaliser alors l'expérience depuis Git.

## Exercices
1. Exporter le dashboard JSON et l'ajouter au projet.
2. Ajouter une règle d'alerte sur une sonde à 0 pendant deux minutes.
3. Instrumenter le backend pour exposer un compteur de requêtes, puis expliquer la différence avec les sondes HTTP.
4. Ajouter un PVC pour Prometheus et Grafana.
5. Compléter par un test synthétique authentifié couvrant une opération métier.

Livrable : dashboard exporté, observation de panne/rétablissement et explication des limites. Effectuer aussi [le scénario métier](../SCENARIO.md) avec un port-forward frontend.

## Dépannage
- Target en panne : vérifier Services, endpoints et logs Blackbox.
- Pas de datasource : vérifier ConfigMap et logs Grafana.
- Pas de métriques : vérifier le scrape Prometheus et attendre 15 à 30 secondes.
- Dashboard perdu après remplacement du Pod : Grafana utilise ici un emptyDir ; exporter le dashboard avant le nettoyage.

## Nettoyage
```bash
kubectl -n stock-lab06 delete -f labs/dsk-stock-lab06-prometheus-grafana/workloads.yaml
kubectl -n stock-lab06 delete -f labs/dsk-stock-lab06-prometheus-grafana/config.yaml
kubectl -n stock-lab06 delete secret grafana-admin
helm uninstall stock -n stock-lab06
```
Supprimer le namespace détruit également les données PostgreSQL de cette installation.

Référence : [pattern multi-target exporter de Prometheus](https://prometheus.io/docs/guides/multi-target-exporter/).

## Vérifier l'accès depuis votre propre poste

Si les commandes sont exécutées dans une VM, garder le tunnel SSH actif pendant la vérification. Ouvrir l'URL locale du tunnel, et non le nom interne `backend` ou `postgres`. Réaliser [le scénario métier](../SCENARIO.md) lorsqu'une application est déployée. Pour le lab CI, les critères portent d'abord sur le run GitHub et les images publiées.

Consigner votre environnement, la distribution Kubernetes éventuelle, les versions, l'architecture des nœuds et le résultat des étapes dans votre compte rendu. Les variantes Proxmox/Vagrant et les clusters existants sont documentés ; ils n'ont pas tous été exécutés lors de la validation initiale. Voir [les vérifications](../VALIDATION.md).
