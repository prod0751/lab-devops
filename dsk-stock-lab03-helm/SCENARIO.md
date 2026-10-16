# Lab 03 — Créer une installation reproductible avec Helm

## Votre mission

Votre équipe souhaite réinstaller la même application dans plusieurs environnements sans recopier et modifier manuellement tous les manifests. Vous devez utiliser le chart fourni et exprimer les différences de votre infrastructure dans un fichier de valeurs local.

**Niveau :** Intermédiaire. **Durée indicative :** 2 à 3 heures, hors installation de votre infrastructure et téléchargement des images.

Vous travaillez sur **votre propre infrastructure**. Ce cours n’attribue ni VM, ni IP, ni cluster : vous réutilisez les vôtres. Le choix de Proxmox, Vagrant, d’un autre hyperviseur ou d’un poste local vous appartient. Le [guide d’environnement](ENVIRONNEMENT.md) explique les différences de réseau et d’accès.

**Ce que ce lab ajoute :** Templates Helm, fichier values, release, révision et upgrade.

## 1. Vérifier vos prérequis

### Connaissances

Savoir examiner des Pods, Services, Jobs et PVC avec kubectl. Comprendre le rôle d’une migration et d’un registre d’images.

### Infrastructure à fournir

Votre cluster Kubernetes existant. Le namespace stock-lab03 sera dédié à l’exercice. Le provisionneur de stockage et le registre restent ceux de votre lab ; Longhorn et Harbor ne sont pas imposés. Pour un petit cluster local : environ 2 vCPU, 4 Go de RAM et 20 Go libres.

Les ressources indiquées sont des estimations pour un lab pédagogique, pas une garantie de dimensionnement. Vérifiez les ressources déjà consommées par vos services.

### Outils et résultat attendu

| Prérequis | Commande ou contrôle | Vous pouvez continuer si… |
|---|---|---|
| kubectl et accès au cluster | kubectl config current-context ; kubectl get nodes ; kubectl get storageclass | Cluster prêt et stockage choisi. |
| Helm | helm version | Helm 3 ou version compatible disponible. |
| Images applicatives | docker version | Vous pouvez construire les images, ou disposez déjà de références accessibles aux nœuds. |
| OpenSSL | openssl version | Vous pouvez générer votre JWT de démonstration. |

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
cd dsk-stock-lab03-helm
ls
```

Résultat attendu : vous voyez `README.md`, `SCENARIO.md`, `GUIDE.md`, `ENVIRONNEMENT.md`, `apps/`, `labs/` et `package.json`. **Toutes les commandes de déploiement qui suivent partent de ce dossier**, sauf lorsqu’un retour à la racine Git est explicitement indiqué.

### Méthode B — Télécharger une archive ZIP

1. Ouvrez le dépôt dans votre navigateur.
2. Sélectionnez la branche ou la révision indiquée sur la page du cours.
3. Cliquez sur **Code**, puis **Download ZIP**.
4. Décompressez l’archive ; GitHub ajoute généralement le nom de branche au dossier extrait, par exemple `lab-devops-main`.
5. Ouvrez un terminal dans le sous-dossier `dsk-stock-lab03-helm` de cette archive.
6. Vérifiez la présence de `apps/` et `labs/` avant d’exécuter une commande.

Le ZIP est une copie des sources sans historique Git. Pour les labs 04 et 05, utilisez le fork et le clone pour réaliser les exercices de commits et de livraison. Le ZIP convient pour lire ces cours ; à lui seul, il ne crée pas un dépôt dans lequel vous pouvez pousser.

### Si l’exécution se fait dans une VM

Clonez directement dans la VM après connexion SSH, ou transférez le dépôt complet. Exemple depuis votre PC, avant d’entrer dans le sous-dossier du lab :

```bash
scp -r lab-devops utilisateur@ADRESSE_DE_VOTRE_VM:~/
ssh utilisateur@ADRESSE_DE_VOTRE_VM
```

Dans la VM, entrez dans `~/lab-devops/dsk-stock-lab03-helm`. Adaptez l’utilisateur, l’adresse et le port SSH à votre infrastructure. Pour Vagrant, vous pouvez utiliser le dossier partagé de votre configuration ou les informations de `vagrant ssh-config`. Les clés et les IP ne sont pas fournies par ce dépôt.

Références : [cloner un dépôt GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) et [télécharger ses sources](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives).

## 3. Préparer les paramètres de votre infrastructure

Identifiez vos images et votre StorageClass avant de créer les volumes. Choisissez un namespace dédié ; le chart utilise des noms de Services fixes et prévoit une release par namespace. Gardez le fichier de valeurs local hors de Git lorsqu’il contient vos secrets.

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

### Fichiers et choix
Le chart `chart/` déploie PostgreSQL, ses données, un Job de migration, l'API et Nginx. Il utilise des noms de services fixes : une seule release dans chaque namespace. Installer une autre release dans un namespace distinct.

Le Job est nommé avec le numéro de révision Helm. Le backend attend que la table Product existe dans un initContainer. L'option `--wait-for-jobs` permet de ne déclarer l'installation réussie qu'après la fin des migrations. Pour une mise à jour de schéma, prévoir la compatibilité avec les versions applicatives encore en service.

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

### Action 1 — Créer un fichier de valeurs local
```bash
cp labs/dsk-stock-lab03-helm/values.local.example.yaml labs/dsk-stock-lab03-helm/values.local.yaml
openssl rand -hex 32
```
Remplacer la valeur `secrets.jwtSecret` dans `values.local.yaml`. Ce fichier est ignoré par Git. Les valeurs du chart sont des identifiants de démonstration ; utiliser uniquement des caractères alphanumériques et underscores pour les paramètres de connexion simplifiés.

### Action 2 — Examiner le rendu
```bash
helm lint labs/dsk-stock-lab03-helm/chart -f labs/dsk-stock-lab03-helm/values.local.yaml
helm template stock labs/dsk-stock-lab03-helm/chart -n stock-lab03 -f labs/dsk-stock-lab03-helm/values.local.yaml
```
Le rendu affiche le Secret : garder cette sortie locale. Repérer les replicas, images, volumes et noms de services.

### Action 3 — Installer
```bash
helm upgrade --install stock labs/dsk-stock-lab03-helm/chart \
  --namespace stock-lab03 --create-namespace \
  -f labs/dsk-stock-lab03-helm/values.local.yaml \
  --wait --wait-for-jobs --timeout 5m
kubectl -n stock-lab03 get pods,jobs,pvc
kubectl -n stock-lab03 port-forward service/frontend 8080:80
```
Ouvrir http://localhost:8080 puis exécuter [le scénario](../SCENARIO.md).

### Action 4 — Mettre à jour
Dans `values.local.yaml`, passer `backend.replicas` à 2 puis relancer la commande d'installation. Examiner :
```bash
helm history stock -n stock-lab03
kubectl -n stock-lab03 get deployment backend
```
Les Jobs achevés de révisions précédentes peuvent rester présents ; ils servent ici de trace d'exécution. Le retour à une version applicative ne revient pas automatiquement sur les migrations de base.

## 5. Recette : démontrer que votre mission est réussie

| Point de contrôle | Résultat à démontrer |
|---|---|
| Rendu | helm lint passe et le rendu contient les images et le stockage choisis. |
| Installation | La release est deployed et le Job de migration a réussi. |
| Métier | Le scénario métier fonctionne avec les données dans le PVC. |
| Upgrade | Le backend passe à deux replicas et une nouvelle révision apparaît. |
| Isolation | Une seconde installation dans un autre namespace possède ses propres données. |

Pour les labs qui déploient l’application, ouvrez le frontend depuis votre PC et exécutez [la recette métier détaillée](../SCENARIO.md). Elle vérifie l’inscription, la création du clavier, les mouvements et le refus d’une sortie impossible. L’API et l’interface font partie du même exercice ; un Pod Running seul ne valide pas la mission.

Vous pouvez aussi lancer :

```bash
python3 labs/validate-http.py --base-url http://localhost:8080/api
```

Ce script crée son compte fictif et un produit de test. Il doit être lancé sur la machine qui accède à cette URL ; adaptez le port si vous utilisez un tunnel différent. Dans le lab 04, cette commande est facultative et ne s’applique que si vous avez aussi déployé une application.

### Si une vérification échoue

```bash
helm status stock -n stock-lab03
kubectl -n stock-lab03 get jobs
kubectl -n stock-lab03 logs job/stock-migrate-1
kubectl -n stock-lab03 logs deployment/backend -c wait-schema
```
Adapter le suffixe du Job à la révision. Si l'installation attend, diagnostiquer la base et les migrations avant d'augmenter le timeout.

## 6. Questions pour comprendre ce que vous avez fait

1. Quel est l’avantage d’un fichier de valeurs par environnement ?
2. Pourquoi la StorageClass doit-elle être choisie avant la première installation ?
3. Pourquoi helm rollback ne restaure-t-il pas automatiquement la base SQL ?

### Exercices complémentaires

1. Déployer une deuxième installation dans `stock-lab03-b` avec un nouveau fichier de valeurs.
2. Modifier les requests et limits en les exposant dans `values.yaml`.
3. Ajouter un Ingress en option ; préciser l'Ingress Controller et le DNS requis.
4. Expliquer pourquoi un hook pre-install de migration échouerait si PostgreSQL n'existe pas encore.
5. Remplacer les identifiants rendus dans le chart par un Secret existant via `existingSecret`.

Livrable : rendu commenté, historique d'upgrade, scénario métier et comparaison des deux namespaces.

## 7. Votre livrable

Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) avec votre architecture, vos paramètres, le résultat des points de contrôle, les incidents rencontrés et vos réponses. Joignez les commandes de diagnostic ou des captures utiles. Masquez les mots de passe, JWT, clés et kubeconfigs.

Le résultat attendu est une installation ou une CI que vous pouvez expliquer et refaire, avec une révision de sources identifiée. Les vérifications initiales du cours et leurs limites sont dans [VALIDATION.md](../VALIDATION.md) ; votre variante d’infrastructure doit être vérifiée chez vous.

## 8. Terminer votre session

Arrêtez les port-forwards et tunnels avec Ctrl+C. Utilisez le nettoyage de la partie technique uniquement pour les ressources créées par cet exercice. Conservez les données si vous souhaitez poursuivre ; la suppression d’un volume ou d’un namespace peut les détruire. Votre cluster, votre VM et les services partagés de votre infrastructure n’ont pas à être supprimés pour terminer un lab.

### Nettoyage des ressources de cet exercice

```bash
helm uninstall stock -n stock-lab03
```
Les PVC créés par le StatefulSet peuvent rester après désinstallation. Supprimer `stock-lab03` uniquement si vous voulez également supprimer ces données.

Référence : [documentation Helm](https://helm.sh/docs/).
