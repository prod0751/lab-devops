# Lab 05 — Livrer votre application depuis Git avec ArgoCD

## Votre mission

Vous souhaitez que les déploiements reflètent l’état décrit dans Git. Vous allez connecter ArgoCD à votre fork, déployer sur votre cluster, puis observer la correction d’une dérive manuelle et le retour à une configuration antérieure par commit.

**Niveau :** Intermédiaire. **Durée indicative :** 2 à 3 heures, hors installation de votre infrastructure et téléchargement des images.

Vous travaillez sur **votre propre infrastructure**. Ce cours n’attribue ni VM, ni IP, ni cluster : vous réutilisez les vôtres. Le choix de Proxmox, Vagrant, d’un autre hyperviseur ou d’un poste local vous appartient. Le [guide d’environnement](ENVIRONNEMENT.md) explique les différences de réseau et d’accès.

**Ce que ce lab ajoute :** Source Git, Application ArgoCD, sync waves, hook de migration, selfHeal et retour à une révision.

## 1. Vérifier vos prérequis

### Connaissances

Connaître les manifests Kubernetes, les valeurs Helm et les commandes Git de base. Savoir rendre une image accessible aux nœuds.

### Infrastructure à fournir

Votre cluster existant, son stockage et ses accès réseau. ArgoCD doit pouvoir lire votre dépôt Git et tirer les images. Pour un cluster local hébergeant aussi ArgoCD, une enveloppe d’environ 4 vCPU, 8 Go de RAM et 30 Go libres est un point de départ indicatif.

Les ressources indiquées sont des estimations pour un lab pédagogique, pas une garantie de dimensionnement. Vérifiez les ressources déjà consommées par vos services.

### Outils et résultat attendu

| Prérequis | Commande ou contrôle | Vous pouvez continuer si… |
|---|---|---|
| kubectl et accès au cluster | kubectl config current-context ; kubectl get nodes ; kubectl get storageclass | Cluster prêt et namespace applicatif disponible. |
| Git et votre fork | git --version ; git remote -v | Vous pouvez pousser les changements destinés à ArgoCD. |
| ArgoCD | Vérifier l’interface ou les déploiements de votre installation | ArgoCD est présent, ou vous pouvez installer la démonstration du guide. |

Git est nécessaire pour le clone ; il est facultatif pour lire et exécuter un ZIP hors exercices Git. Python 3 est requis pour les scripts fournis si vous les utilisez. Les commandes utilisent Bash ou un shell compatible : sous Windows, utilisez WSL2 ou votre VM Linux.

Les conteneurs embarquent Node et les dépendances de l’application : aucune installation manuelle de React, NestJS ou PostgreSQL sur votre hôte n’est demandée. Le lab CI installe ses outils dans les runners.

Ne poursuivez pas si un prérequis indispensable échoue : utilisez les liens d’installation d’ENVIRONNEMENT.md et les diagnostics du guide. Installer un outil sur votre PC ne l’installe pas dans votre VM.

## 2. Récupérer les sources chez vous

Le dépôt du parcours est `https://github.com/sdiawa/lab-devops.git`. Il doit contenir les sept dossiers nommés `dsk-stock-lab01-docker` à `dsk-stock-lab07-vault-eso`. Les noms de dossier sont significatifs pour les commandes, la CI et ArgoCD.

### Méthode recommandée pour ce lab : créer votre fork

Vous allez pousser des changements dans Git. Sur GitHub, ouvrez le dépôt auteur, utilisez **Fork** pour créer `lab-devops` dans votre compte, puis clonez **votre fork**. Remplacez `VOTRE_COMPTE` ci-dessous :

```bash
mkdir -p "$HOME/devops-labs"
cd "$HOME/devops-labs"
git clone https://github.com/VOTRE_COMPTE/lab-devops.git
cd lab-devops
git remote -v
```

Résultat attendu : `origin` désigne votre compte. Vous n’avez pas besoin des droits d’écriture sur le dépôt de l’auteur. Si votre fork existe déjà, ouvrez sa copie locale ; ne clonez pas à l’intérieur d’un autre lab.

Vous êtes maintenant à la racine Git du parcours. Entrez dans le projet :

```bash
cd dsk-stock-lab05-argocd
ls
```

Résultat attendu : vous voyez `README.md`, `SCENARIO.md`, `GUIDE.md`, `ENVIRONNEMENT.md`, `apps/`, `labs/` et `package.json`. **Toutes les commandes de déploiement qui suivent partent de ce dossier**, sauf lorsqu’un retour à la racine Git est explicitement indiqué.

### Méthode B — Télécharger une archive ZIP

1. Ouvrez le dépôt dans votre navigateur.
2. Sélectionnez la branche ou la révision indiquée sur la page du cours.
3. Cliquez sur **Code**, puis **Download ZIP**.
4. Décompressez l’archive ; GitHub ajoute généralement le nom de branche au dossier extrait, par exemple `lab-devops-main`.
5. Ouvrez un terminal dans le sous-dossier `dsk-stock-lab05-argocd` de cette archive.
6. Vérifiez la présence de `apps/` et `labs/` avant d’exécuter une commande.

Le ZIP est une copie des sources sans historique Git. Pour les labs 04 et 05, utilisez le fork et le clone pour réaliser les exercices de commits et de livraison. Le ZIP convient pour lire ces cours ; à lui seul, il ne crée pas un dépôt dans lequel vous pouvez pousser.

### Si l’exécution se fait dans une VM

Clonez directement dans la VM après connexion SSH, ou transférez le dépôt complet. Exemple depuis votre PC, avant d’entrer dans le sous-dossier du lab :

```bash
scp -r lab-devops utilisateur@ADRESSE_DE_VOTRE_VM:~/
ssh utilisateur@ADRESSE_DE_VOTRE_VM
```

Dans la VM, entrez dans `~/lab-devops/dsk-stock-lab05-argocd`. Adaptez l’utilisateur, l’adresse et le port SSH à votre infrastructure. Pour Vagrant, vous pouvez utiliser le dossier partagé de votre configuration ou les informations de `vagrant ssh-config`. Les clés et les IP ne sont pas fournies par ce dépôt.

Références : [cloner un dépôt GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) et [télécharger ses sources](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives).

## 3. Préparer les paramètres de votre infrastructure

Réutilisez ArgoCD s’il existe déjà dans votre lab. Sinon, installez la démonstration dans le namespace prévu. Utilisez votre fork dans repoURL pour les manipulations Git ; le chemin du chart doit partir de la racine du dépôt, et inclure le dossier du lab 05.

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

### Action 1 — Installer ou réutiliser ArgoCD

Si votre cluster dispose déjà d’ArgoCD, utiliser cette installation et passer à l’étape 2 avec les droits appropriés. Sinon, les commandes suivantes créent l’installation de démonstration. Adapter le namespace `argocd` si votre installation utilise un autre nom.

```bash
kubectl config current-context
kubectl get nodes
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl -n argocd rollout status deployment/argocd-server --timeout=300s
```
La référence stable est mobile. Pour publier une version reproductible du cours, remplacer cette URL par celle d'une release précise après validation et noter cette version.

Dans un terminal :
```bash
kubectl -n argocd port-forward service/argocd-server 8443:443
```
Dans une VM, ouvrir aussi un tunnel `ssh -N -L 8443:127.0.0.1:8443 utilisateur@ADRESSE_DE_VOTRE_VM` depuis le PC. Ouvrir https://localhost:8443 ; le certificat de démonstration est auto-signé. Récupérer le mot de passe admin initial localement :
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 --decode
```

### Action 2 — Configurer la source Git
```bash
cp labs/dsk-stock-lab05-argocd/application.example.yaml labs/dsk-stock-lab05-argocd/application.local.yaml
```
Le dépôt source est `https://github.com/sdiawa/lab-devops.git`. Le chemin du chart depuis sa racine Git est `dsk-stock-lab05-argocd/labs/dsk-stock-lab03-helm/chart`. Pour réaliser les changements GitOps, créer votre fork, puis utiliser son URL dans `repoURL` ; conserver le chemin du chart.

Pour un cluster existant, remplacer `backend.image` et `frontend.image` par les références de votre registre, puis ajouter un paramètre Helm `postgres.storageClass` si aucune classe par défaut ne convient. Pour kind, garder les références locales uniquement après chargement des images. Exemple de paramètre à ajouter à la liste `parameters` :

```yaml
- name: postgres.storageClass
  value: NOM_DE_VOTRE_STORAGECLASS
```

 Conserver les images locales si elles ont été chargées dans kind, ou remplacer les paramètres par vos images GHCR publiques et leur SHA.

Le chart a des identifiants PostgreSQL et JWT de démonstration. Ce projet sert à apprendre GitOps localement. Ne placez pas de secrets réels dans Git ; le projet 07 externalise leur gestion.

### Action 3 — Déployer
```bash
kubectl apply -f labs/dsk-stock-lab05-argocd/application.local.yaml
kubectl -n argocd get application stock-lab05
```
Attendre les statuts Synced et Healthy dans l'interface ArgoCD. Le chart ordonne Secret, PostgreSQL, migration puis application avec des sync waves. La migration est un hook Sync recréé lors des synchronisations et supprimé après succès.

```bash
kubectl -n stock-lab05 get pods,pvc
kubectl -n stock-lab05 port-forward service/frontend 8080:80
```
Exécuter [le scénario métier](../SCENARIO.md). En cas d'échec du hook, consulter ses logs avant une nouvelle synchronisation.

### Action 4 — Démontrer la correction de dérive
```bash
kubectl -n stock-lab05 scale deployment backend --replicas=2
```
Avec la valeur Git à 1 et selfHeal actif, ArgoCD doit rétablir le replica désiré. Ne faites pas un `helm upgrade` manuel sur ce namespace : ArgoCD pilote désormais le rendu.

### Faire évoluer votre état désiré dans Git

Pour l’exercice de replicas, dans votre copie du dépôt et sur votre fork, modifiez `backend.replicas` dans `labs/dsk-stock-lab03-helm/chart/values.yaml` du lab 05, de 1 à 2. Attention : ce fichier de référence contient uniquement les identifiants fictifs du cours, pas vos secrets réels.

Depuis le dossier du lab 05, revenez à la racine Git, puis poussez le changement :

```bash
cd ..
git status --short
git add dsk-stock-lab05-argocd/labs/dsk-stock-lab03-helm/chart/values.yaml
git commit -m "Lab 05 : passer le backend a deux replicas"
git push origin main
git rev-parse --short HEAD
```

Notez le SHA de ce commit. Attendez la synchronisation dans ArgoCD, ou lancez une synchronisation depuis son interface. Le Deployment doit passer à deux replicas. Pour revenir à un replica, depuis la même racine Git :

```bash
git revert SHA_DU_COMMIT_NOTE
git push origin main
cd dsk-stock-lab05-argocd
```

Remplacez `SHA_DU_COMMIT_NOTE` avant exécution. Adaptez `main` si vous avez choisi une autre branche et mettez aussi `targetRevision` à jour dans l’Application. Un git revert crée un nouveau commit ; il ne remet pas la base de données à un état antérieur.

## 5. Recette : démontrer que votre mission est réussie

| Point de contrôle | Résultat à démontrer |
|---|---|
| Source | L’Application pointe vers votre fork et le chemin exact du chart. |
| Synchronisation | L’application est Synced et Healthy ; la migration s’est terminée. |
| Métier | Le produit et ses mouvements sont accessibles depuis le frontend. |
| Dérive | Le passage manuel à deux replicas est corrigé vers la valeur Git. |
| Git | Un changement de replicas poussé dans votre fork est livré, puis annulé par git revert. |

Pour les labs qui déploient l’application, ouvrez le frontend depuis votre PC et exécutez [la recette métier détaillée](../SCENARIO.md). Elle vérifie l’inscription, la création du clavier, les mouvements et le refus d’une sortie impossible. L’API et l’interface font partie du même exercice ; un Pod Running seul ne valide pas la mission.

Vous pouvez aussi lancer :

```bash
python3 labs/validate-http.py --base-url http://localhost:8080/api
```

Ce script crée son compte fictif et un produit de test. Il doit être lancé sur la machine qui accède à cette URL ; adaptez le port si vous utilisez un tunnel différent. Dans le lab 04, cette commande est facultative et ne s’applique que si vous avez aussi déployé une application.

### Si une vérification échoue

- Repo inaccessible : vérifier l'URL et que le chart est effectivement dans la branche ciblée.
- OutOfSync : lire le diff et demander une synchronisation dans l'interface.
- Progressing : vérifier PVC et probes.
- Hook en échec : inspecter Job, logs de migration et Secret.
- ImagePullBackOff : vérifier l'image dans kind ou la visibilité du package GHCR.

## 6. Questions pour comprendre ce que vous avez fait

1. Quelle différence entre le chemin local du chart et son chemin depuis la racine Git ?
2. Quelle action faut-il effectuer si selfHeal corrige votre modification manuelle ?
3. Quelles données restent après le retour à une ancienne révision applicative ?

### Exercices complémentaires

1. Ajouter un fichier de valeurs Git dédié à ce projet, changer le nombre de replicas puis pousser le commit.
2. Changer le tag d'image dans ce fichier vers un SHA construit par la CI.
3. Faire un `git revert` de ce changement et observer la synchronisation.
4. Expliquer pourquoi un retour de version ne restaure pas une base de données.
5. Expliquer le rôle de chaque wave et les effets de prune/selfHeal.

Livrable : capture des statuts, commit livré et preuve de correction de dérive. Ne publier ni mot de passe admin ni token.

## 7. Votre livrable

Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) avec votre architecture, vos paramètres, le résultat des points de contrôle, les incidents rencontrés et vos réponses. Joignez les commandes de diagnostic ou des captures utiles. Masquez les mots de passe, JWT, clés et kubeconfigs.

Le résultat attendu est une installation ou une CI que vous pouvez expliquer et refaire, avec une révision de sources identifiée. Les vérifications initiales du cours et leurs limites sont dans [VALIDATION.md](../VALIDATION.md) ; votre variante d’infrastructure doit être vérifiée chez vous.

## 8. Terminer votre session

Arrêtez les port-forwards et tunnels avec Ctrl+C. Utilisez le nettoyage de la partie technique uniquement pour les ressources créées par cet exercice. Conservez les données si vous souhaitez poursuivre ; la suppression d’un volume ou d’un namespace peut les détruire. Votre cluster, votre VM et les services partagés de votre infrastructure n’ont pas à être supprimés pour terminer un lab.

### Nettoyage des ressources de cet exercice

Le modèle n'ajoute pas de finalizer de suppression en cascade. Supprimer l'Application, puis son namespace applicatif :
```bash
kubectl -n argocd delete application stock-lab05
kubectl delete namespace stock-lab05
```
La seconde commande détruit ses données. Garder ArgoCD pour les autres exercices ; supprimer son namespace uniquement si plus aucune Application de lab n'en dépend.

Références : [installation ArgoCD](https://argo-cd.readthedocs.io/en/stable/getting_started/) et [phases et sync waves](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/).
