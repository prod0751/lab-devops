# Lab 02 — Déployer sur votre cluster avec des manifests Kubernetes

## Votre mission

La première installation doit désormais tourner sur Kubernetes. Vous disposez de votre propre cluster et devez livrer les objets nécessaires sans Helm ni ArgoCD. Vous devez comprendre qui lance les conteneurs, comment les services communiquent et où les données persistent.

**Niveau :** Débutant Kubernetes. **Durée indicative :** 2 à 3 heures, hors installation de votre infrastructure et téléchargement des images.

Vous travaillez sur **votre propre infrastructure**. Ce cours n’attribue ni VM, ni IP, ni cluster : vous réutilisez les vôtres. Le choix de Proxmox, Vagrant, d’un autre hyperviseur ou d’un poste local vous appartient. Le [guide d’environnement](ENVIRONNEMENT.md) explique les différences de réseau et d’accès.

**Ce que ce lab ajoute :** Namespace, Secret, Service, StatefulSet, PVC, Job de migration, Deployment et probes.

## 1. Vérifier vos prérequis

### Connaissances

Connaître les images et volumes Docker ainsi que les notions de Pod et Service. Le code applicatif est fourni : vous n’avez pas à réécrire l’application.

### Infrastructure à fournir

Votre cluster K3s, kubeadm, Minikube ou autre avec DNS et stockage opérationnels. Une VM ou un cluster local kind convient également. Pour une installation locale dédiée, prévoir environ 2 vCPU, 4 Go de RAM et 20 Go libres, à ajuster aux composants du cluster.

Les ressources indiquées sont des estimations pour un lab pédagogique, pas une garantie de dimensionnement. Vérifiez les ressources déjà consommées par vos services.

### Outils et résultat attendu

| Prérequis | Commande ou contrôle | Vous pouvez continuer si… |
|---|---|---|
| kubectl configuré pour votre cluster | kubectl config current-context ; kubectl get nodes | Le contexte est celui de votre lab et les nœuds ciblés sont Ready. |
| Stockage Kubernetes | kubectl get storageclass | Vous connaissez une StorageClass utilisable ou disposez d’un PV adapté. |
| Construction des images | docker version | Docker fonctionne sur la machine de build ; les images seront rendues disponibles aux nœuds. |
| Python 3 et OpenSSL | python3 --version ; openssl version | Préparation des manifests et génération du JWT possibles. |

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
cd dsk-stock-lab02-kubernetes
ls
```

Résultat attendu : vous voyez `README.md`, `SCENARIO.md`, `GUIDE.md`, `ENVIRONNEMENT.md`, `apps/`, `labs/` et `package.json`. **Toutes les commandes de déploiement qui suivent partent de ce dossier**, sauf lorsqu’un retour à la racine Git est explicitement indiqué.

### Méthode B — Télécharger une archive ZIP

1. Ouvrez le dépôt dans votre navigateur.
2. Sélectionnez la branche ou la révision indiquée sur la page du cours.
3. Cliquez sur **Code**, puis **Download ZIP**.
4. Décompressez l’archive ; GitHub ajoute généralement le nom de branche au dossier extrait, par exemple `lab-devops-main`.
5. Ouvrez un terminal dans le sous-dossier `dsk-stock-lab02-kubernetes` de cette archive.
6. Vérifiez la présence de `apps/` et `labs/` avant d’exécuter une commande.

Le ZIP est une copie des sources sans historique Git. Pour les labs 04 et 05, utilisez le fork et le clone pour réaliser les exercices de commits et de livraison. Le ZIP convient pour lire ces cours ; à lui seul, il ne crée pas un dépôt dans lequel vous pouvez pousser.

### Si l’exécution se fait dans une VM

Clonez directement dans la VM après connexion SSH, ou transférez le dépôt complet. Exemple depuis votre PC, avant d’entrer dans le sous-dossier du lab :

```bash
scp -r lab-devops utilisateur@ADRESSE_DE_VOTRE_VM:~/
ssh utilisateur@ADRESSE_DE_VOTRE_VM
```

Dans la VM, entrez dans `~/lab-devops/dsk-stock-lab02-kubernetes`. Adaptez l’utilisateur, l’adresse et le port SSH à votre infrastructure. Pour Vagrant, vous pouvez utiliser le dossier partagé de votre configuration ou les informations de `vagrant ssh-config`. Les clés et les IP ne sont pas fournies par ce dépôt.

Références : [cloner un dépôt GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) et [télécharger ses sources](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives).

## 3. Préparer les paramètres de votre infrastructure

Conservez votre cluster existant. Déterminez le contexte, les références d’images accessibles à tous les nœuds, leur architecture CPU et la StorageClass. Créez kind uniquement si vous avez besoin d’un cluster de cours. Aucun nom de domaine ni Ingress Controller n’est nécessaire pour le chemin par port-forward.

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
Navigateur → port-forward du Service frontend → Nginx → Service backend → PostgreSQL et son PVC. Un Job applique les migrations avant la création des Deployments.

Tous les noms DNS de services sont internes au namespace `stock-lab02`. Les images du projet 01 utilisent ces mêmes noms `backend` et `postgres`.

### Action 1 — Préparer les manifests pour votre environnement

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

### Action 2 — Créer le namespace et le Secret
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

### Action 3 — Installer la base
```bash
kubectl -n stock-lab02 apply -f labs/dsk-stock-lab02-kubernetes/manifests.local/10-postgres.yaml
kubectl -n stock-lab02 rollout status statefulset/postgres --timeout=180s
kubectl -n stock-lab02 get pvc
```
Le PVC utilise la StorageClass choisie pendant la préparation, ou la classe par défaut. Vérifier que le volume devient Bound ; un PVC Pending nécessite de vérifier le provisionneur avant de poursuivre.

### Action 4 — Migrer, puis installer l'application
```bash
kubectl -n stock-lab02 apply -f labs/dsk-stock-lab02-kubernetes/manifests.local/20-migrate.yaml
kubectl -n stock-lab02 wait --for=condition=complete job/stock-migrate --timeout=300s
kubectl -n stock-lab02 logs job/stock-migrate
kubectl -n stock-lab02 apply -f labs/dsk-stock-lab02-kubernetes/manifests.local/30-app.yaml
kubectl -n stock-lab02 rollout status deployment/backend --timeout=180s
kubectl -n stock-lab02 rollout status deployment/frontend --timeout=180s
```
Ne poursuivez pas si la migration échoue. Pour rejouer un Job terminé après une nouvelle image, supprimer uniquement `job/stock-migrate`, puis appliquer son manifest et attendre à nouveau.

### Action 5 — Accéder au service
Dans un terminal qui reste ouvert :
```bash
kubectl -n stock-lab02 port-forward service/frontend 8080:80
```
Ouvrir http://localhost:8080 puis [valider le métier](../SCENARIO.md). Pour Swagger et health, utiliser un deuxième terminal :
```bash
kubectl -n stock-lab02 port-forward service/backend 3001:3001
```
La configuration frontend reste `/api` : inutile d'exposer l'API au navigateur sur un deuxième port pour utiliser l'application.

## 5. Recette : démontrer que votre mission est réussie

| Point de contrôle | Résultat à démontrer |
|---|---|
| Cluster | Nœuds Ready, contexte correct et stockage identifié. |
| Images | Images présentes dans le runtime des nœuds ou disponibles dans un registre accessible. |
| Base | PostgreSQL prêt, PVC Bound. |
| Migration | Job stock-migrate Complete avant la création de l’application. |
| Application | Deployments prêts, scénario métier réussi via le Service frontend. |
| Persistance | Le clavier est toujours présent après remplacement de postgres-0. |

Pour les labs qui déploient l’application, ouvrez le frontend depuis votre PC et exécutez [la recette métier détaillée](../SCENARIO.md). Elle vérifie l’inscription, la création du clavier, les mouvements et le refus d’une sortie impossible. L’API et l’interface font partie du même exercice ; un Pod Running seul ne valide pas la mission.

Vous pouvez aussi lancer :

```bash
python3 labs/validate-http.py --base-url http://localhost:8080/api
```

Ce script crée son compte fictif et un produit de test. Il doit être lancé sur la machine qui accède à cette URL ; adaptez le port si vous utilisez un tunnel différent. Dans le lab 04, cette commande est facultative et ne s’applique que si vous avez aussi déployé une application.

### Si une vérification échoue

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

## 6. Questions pour comprendre ce que vous avez fait

1. Pourquoi un docker build sur votre PC ne suffit-il pas toujours pour Kubernetes ?
2. Quel est le rôle respectif du Service, du Pod et du PVC ?
3. Pourquoi la sonde /health actuelle ne prouve-t-elle pas à elle seule que la base est disponible ?

### Exercices complémentaires

1. Supprimer `pod/postgres-0` et attendre sa recréation : les données doivent rester dans le PVC.
2. Passer le backend à deux replicas. Observer les Pods et les endpoints du Service.
3. Définir la différence entre startupProbe, readinessProbe et livenessProbe.
4. Choisir un tag d'image inexistant et diagnostiquer ImagePullBackOff.
5. Expliquer pourquoi le Job de migration précède l'API.

Livrable : schéma Kubernetes, résultat métier et preuve de persistance après recréation du Pod. Les probes HTTP utilisent le `/health` actuel, qui ne teste pas l'accès à la base ; c'est une limite à discuter.

## 7. Votre livrable

Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) avec votre architecture, vos paramètres, le résultat des points de contrôle, les incidents rencontrés et vos réponses. Joignez les commandes de diagnostic ou des captures utiles. Masquez les mots de passe, JWT, clés et kubeconfigs.

Le résultat attendu est une installation ou une CI que vous pouvez expliquer et refaire, avec une révision de sources identifiée. Les vérifications initiales du cours et leurs limites sont dans [VALIDATION.md](../VALIDATION.md) ; votre variante d’infrastructure doit être vérifiée chez vous.

## 8. Terminer votre session

Arrêtez les port-forwards et tunnels avec Ctrl+C. Utilisez le nettoyage de la partie technique uniquement pour les ressources créées par cet exercice. Conservez les données si vous souhaitez poursuivre ; la suppression d’un volume ou d’un namespace peut les détruire. Votre cluster, votre VM et les services partagés de votre infrastructure n’ont pas à être supprimés pour terminer un lab.

### Nettoyage des ressources de cet exercice

Ctrl+C arrête les port-forwards. Pour détruire uniquement ce projet :
```bash
kubectl delete namespace stock-lab02
```
Cette suppression détruit aussi son PVC et ses données. `kind delete cluster --name stock-labs` supprime tous les labs présents dans ce cluster ; ne l’utiliser que pour le cluster kind créé pour le cours ; ne jamais supprimer votre cluster existant pour nettoyer un exercice.
