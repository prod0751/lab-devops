# Lab 06 — Détecter une panne avec Prometheus et Grafana

## Votre mission

Une application peut être déployée tout en étant indisponible pour ses utilisateurs. Vous devez mettre en place une observation HTTP, construire un tableau de bord et provoquer une panne contrôlée du backend pour comprendre ce que les sondes détectent réellement.

**Niveau :** Intermédiaire. **Durée indicative :** 2 à 3 heures, hors installation de votre infrastructure et téléchargement des images.

Vous travaillez sur **votre propre infrastructure**. Ce cours n’attribue ni VM, ni IP, ni cluster : vous réutilisez les vôtres. Le choix de Proxmox, Vagrant, d’un autre hyperviseur ou d’un poste local vous appartient. Le [guide d’environnement](ENVIRONNEMENT.md) explique les différences de réseau et d’accès.

**Ce que ce lab ajoute :** Prometheus, Blackbox Exporter, datasource Grafana et sondes HTTP externes.

## 1. Vérifier vos prérequis

### Connaissances

Savoir utiliser kubectl et Helm, identifier un Service et lire une série temporelle simple. Une première pratique des labels Prometheus est utile.

### Infrastructure à fournir

Votre cluster existant avec un namespace stock-lab06 dédié. Les composants peuvent tirer leurs images publiques. Prévoir davantage de mémoire que pour l’application seule ; environ 4 vCPU, 8 Go de RAM et 30 Go libres pour un cluster local sont une estimation de départ.

Les ressources indiquées sont des estimations pour un lab pédagogique, pas une garantie de dimensionnement. Vérifiez les ressources déjà consommées par vos services.

### Outils et résultat attendu

| Prérequis | Commande ou contrôle | Vous pouvez continuer si… |
|---|---|---|
| kubectl et accès au cluster | kubectl config current-context ; kubectl get nodes ; kubectl get storageclass | Cluster et stockage prêts pour une installation isolée. |
| Helm | helm version | Vous pouvez installer le chart applicatif. |
| Images et OpenSSL | openssl version | Images applicatives disponibles ; génération des mots de passe de lab possible. |

Git est nécessaire pour le clone ; il est facultatif pour lire et exécuter un ZIP hors exercices Git. Python 3 est requis pour les scripts fournis si vous les utilisez. Les commandes utilisent Bash ou un shell compatible : sous Windows, utilisez WSL2 ou votre VM Linux.

Les conteneurs embarquent Node et les dépendances de l’application : aucune installation manuelle de React, NestJS ou PostgreSQL sur votre hôte n’est demandée. Le lab CI installe ses outils dans les runners.

Ne poursuivez pas si un prérequis indispensable échoue : utilisez les liens d’installation d’ENVIRONNEMENT.md et les diagnostics du guide. Installer un outil sur votre PC ne l’installe pas dans votre VM.

## 2. Récupérer les sources chez vous

Le dépôt du parcours est `https://github.com/sdiawa/lab-devops.git`. Il doit contenir les sept dossiers nommés `dsk-stock-lab01-docker` à `dsk-stock-lab07-vault-eso`. Les noms de dossier sont significatifs pour les commandes, la CI et ArgoCD.

### Méthode A — Cloner avec Git

Sur la machine d’exécution choisie :

```bash
mkdir -p "$HOME/devops-labs"
cd "$HOME/devops-labs"
git clone https://github.com/sdiawa/lab-devops.git
cd lab-devops
git rev-parse --short HEAD
```

Notez la révision affichée dans votre compte rendu. Si vous avez déjà récupéré le dépôt pour un autre lab, réutilisez ce dossier ; sauvegardez vos modifications locales avant toute mise à jour. N’exécutez pas de reset pour simplement changer de lab.

Vous êtes maintenant à la racine Git du parcours. Entrez dans le projet :

```bash
cd dsk-stock-lab06-prometheus-grafana
ls
```

Résultat attendu : vous voyez `README.md`, `SCENARIO.md`, `GUIDE.md`, `ENVIRONNEMENT.md`, `apps/`, `labs/` et `package.json`. **Toutes les commandes de déploiement qui suivent partent de ce dossier**, sauf lorsqu’un retour à la racine Git est explicitement indiqué.

### Méthode B — Télécharger une archive ZIP

1. Ouvrez le dépôt dans votre navigateur.
2. Sélectionnez la branche ou la révision indiquée sur la page du cours.
3. Cliquez sur **Code**, puis **Download ZIP**.
4. Décompressez l’archive ; GitHub ajoute généralement le nom de branche au dossier extrait, par exemple `lab-devops-main`.
5. Ouvrez un terminal dans le sous-dossier `dsk-stock-lab06-prometheus-grafana` de cette archive.
6. Vérifiez la présence de `apps/` et `labs/` avant d’exécuter une commande.

Le ZIP est une copie des sources sans historique Git. Pour les labs 04 et 05, utilisez le fork et le clone pour réaliser les exercices de commits et de livraison. Le ZIP convient pour lire ces cours ; à lui seul, il ne crée pas un dépôt dans lequel vous pouvez pousser.

### Si l’exécution se fait dans une VM

Clonez directement dans la VM après connexion SSH, ou transférez le dépôt complet. Exemple depuis votre PC, avant d’entrer dans le sous-dossier du lab :

```bash
scp -r lab-devops utilisateur@ADRESSE_DE_VOTRE_VM:~/
ssh utilisateur@ADRESSE_DE_VOTRE_VM
```

Dans la VM, entrez dans `~/lab-devops/dsk-stock-lab06-prometheus-grafana`. Adaptez l’utilisateur, l’adresse et le port SSH à votre infrastructure. Pour Vagrant, vous pouvez utiliser le dossier partagé de votre configuration ou les informations de `vagrant ssh-config`. Les clés et les IP ne sont pas fournies par ce dépôt.

Références : [cloner un dépôt GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) et [télécharger ses sources](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives).

## 3. Préparer les paramètres de votre infrastructure

Utilisez les manifests du lab dans un namespace dédié pour ne pas modifier votre supervision existante. L’application ne fournit pas encore de /metrics métier ; l’exercice mesure d’abord une réponse HTTP et sa durée. Choisissez l’accès local ou les tunnels SSH pour les ports 9090 et 3000.

Avant les commandes techniques, complétez ce tableau dans votre [compte rendu](COMPTE-RENDU.md) :

| Paramètre | Votre valeur |
|---|---|
| Machine qui exécutera les commandes | PC, VM ou serveur choisi |
| Accès au navigateur | Local ou tunnel SSH |
| Contexte Kubernetes, si utilisé | Nom relevé avec kubectl |
| Référence des images, si Kubernetes | Registre/tag ou import dans le runtime |
| Stockage, si Kubernetes | StorageClass ou PV préparé |
| Révision des sources | Commit Git ou archive utilisée |

Pour Kubernetes, une image construite dans Docker n’est pas forcément présente dans le runtime du cluster. Avant le déploiement, suivez l’étape 7 d’ENVIRONNEMENT.md : registre accessible aux nœuds, import K3s adapté ou chargement kind. Pour les labs 01 et 04, ce point n’impose pas de créer un cluster.

## 4. Réaliser le lab pas à pas

Les fichiers sont déjà fournis dans ce dossier. Lisez chaque action, exécutez ses commandes sur la machine choisie et vérifiez le résultat avant de passer à la suivante. Les fichiers locaux contenant vos paramètres ou vos secrets restent hors de Git.

### Architecture
Prometheus → Blackbox Exporter → HTTP frontend et health backend. Grafana interroge Prometheus. Les sondes ne vérifient pas une inscription, une opération de stock ou l'accès PostgreSQL.

### Paramètres à adapter au cluster

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

### Action 1 — Déployer une application indépendante
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

### Action 2 — Installer l'observabilité
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

### Action 3 — Examiner Prometheus
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

### Action 4 — Créer un dashboard Grafana
Dans un deuxième terminal :
```bash
kubectl -n stock-lab06 port-forward service/grafana 3000:3000
```
Ouvrir http://localhost:3000, compte `admin` et mot de passe créé à l'étape 2. La datasource Prometheus est préconfigurée.

Créer un dashboard avec un panneau de disponibilité basé sur `probe_success{job="stock-http"}` et un panneau de durée basé sur `probe_duration_seconds{job="stock-http"}`. Utiliser `{{instance}}` comme légende. Choisir une période courte et un rafraîchissement de 15 secondes.

### Action 5 — Observer une panne
```bash
kubectl -n stock-lab06 scale deployment backend --replicas=0
```
Après quelques scrapes, la sonde backend doit passer à 0. La sonde frontend peut rester à 1, car elle teste la page statique et non une opération API. Restaurer :
```bash
kubectl -n stock-lab06 scale deployment backend --replicas=1
```
Si vous adaptez ce projet à un namespace piloté par ArgoCD avec selfHeal, une modification manuelle peut être corrigée automatiquement ; réaliser alors l'expérience depuis Git.

## 5. Recette : démontrer que votre mission est réussie

| Point de contrôle | Résultat à démontrer |
|---|---|
| Application | Le scénario métier fonctionne dans stock-lab06. |
| Collecte | Les deux séries probe_success du job stock-http valent 1. |
| Dashboard | Grafana affiche disponibilité et durée, avec une légende par instance. |
| Panne | Après arrêt du backend et quelques scrapes, sa sonde passe à 0. |
| Rétablissement | Après restauration du backend, sa sonde revient à 1 et le métier fonctionne. |
| Livrable | Le dashboard JSON est exporté avant suppression des Pods de démonstration. |

Pour les labs qui déploient l’application, ouvrez le frontend depuis votre PC et exécutez [la recette métier détaillée](../SCENARIO.md). Elle vérifie l’inscription, la création du clavier, les mouvements et le refus d’une sortie impossible. L’API et l’interface font partie du même exercice ; un Pod Running seul ne valide pas la mission.

Vous pouvez aussi lancer :

```bash
python3 labs/validate-http.py --base-url http://localhost:8080/api
```

Ce script crée son compte fictif et un produit de test. Il doit être lancé sur la machine qui accède à cette URL ; adaptez le port si vous utilisez un tunnel différent. Dans le lab 04, cette commande est facultative et ne s’applique que si vous avez aussi déployé une application.

### Si une vérification échoue

- Target en panne : vérifier Services, endpoints et logs Blackbox.
- Pas de datasource : vérifier ConfigMap et logs Grafana.
- Pas de métriques : vérifier le scrape Prometheus et attendre 15 à 30 secondes.
- Dashboard perdu après remplacement du Pod : Grafana utilise ici un emptyDir ; exporter le dashboard avant le nettoyage.

## 6. Questions pour comprendre ce que vous avez fait

1. Pourquoi la sonde frontend peut-elle rester verte pendant la panne API ?
2. Pourquoi une réponse /health ne prouve-t-elle pas qu’une sortie de stock fonctionne ?
3. Quelles données de monitoring disparaissent avec les volumes emptyDir du modèle ?

### Exercices complémentaires

1. Exporter le dashboard JSON et l'ajouter au projet.
2. Ajouter une règle d'alerte sur une sonde à 0 pendant deux minutes.
3. Instrumenter le backend pour exposer un compteur de requêtes, puis expliquer la différence avec les sondes HTTP.
4. Ajouter un PVC pour Prometheus et Grafana.
5. Compléter par un test synthétique authentifié couvrant une opération métier.

Livrable : dashboard exporté, observation de panne/rétablissement et explication des limites. Effectuer aussi [le scénario métier](../SCENARIO.md) avec un port-forward frontend.

## 7. Votre livrable

Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) avec votre architecture, vos paramètres, le résultat des points de contrôle, les incidents rencontrés et vos réponses. Joignez les commandes de diagnostic ou des captures utiles. Masquez les mots de passe, JWT, clés et kubeconfigs.

Le résultat attendu est une installation ou une CI que vous pouvez expliquer et refaire, avec une révision de sources identifiée. Les vérifications initiales du cours et leurs limites sont dans [VALIDATION.md](../VALIDATION.md) ; votre variante d’infrastructure doit être vérifiée chez vous.

## 8. Terminer votre session

Arrêtez les port-forwards et tunnels avec Ctrl+C. Utilisez le nettoyage de la partie technique uniquement pour les ressources créées par cet exercice. Conservez les données si vous souhaitez poursuivre ; la suppression d’un volume ou d’un namespace peut les détruire. Votre cluster, votre VM et les services partagés de votre infrastructure n’ont pas à être supprimés pour terminer un lab.

### Nettoyage des ressources de cet exercice

```bash
kubectl -n stock-lab06 delete -f labs/dsk-stock-lab06-prometheus-grafana/workloads.yaml
kubectl -n stock-lab06 delete -f labs/dsk-stock-lab06-prometheus-grafana/config.yaml
kubectl -n stock-lab06 delete secret grafana-admin
helm uninstall stock -n stock-lab06
```
Supprimer le namespace détruit également les données PostgreSQL de cette installation.

Référence : [pattern multi-target exporter de Prometheus](https://prometheus.io/docs/guides/multi-target-exporter/).
