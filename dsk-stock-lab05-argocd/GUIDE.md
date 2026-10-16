# Projet 05 — Déployer depuis Git avec ArgoCD — Guide pas à pas

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
Faire de Git la source du déploiement. Observer un changement, une dérive manuelle et un retour à une configuration antérieure.

Niveau : intermédiaire. Durée : 2 à 3 h. Prérequis : votre cluster Kubernetes accessible, images disponibles sur les nœuds et dépôt GitHub public contenant le chart du projet 03. Les images GHCR du projet 04 peuvent remplacer les images locales.

## 1. Installer ou réutiliser ArgoCD

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

## 2. Configurer la source Git
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

## 3. Déployer
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

## 4. Démontrer la correction de dérive
```bash
kubectl -n stock-lab05 scale deployment backend --replicas=2
```
Avec la valeur Git à 1 et selfHeal actif, ArgoCD doit rétablir le replica désiré. Ne faites pas un `helm upgrade` manuel sur ce namespace : ArgoCD pilote désormais le rendu.

## Exercices
1. Ajouter un fichier de valeurs Git dédié à ce projet, changer le nombre de replicas puis pousser le commit.
2. Changer le tag d'image dans ce fichier vers un SHA construit par la CI.
3. Faire un `git revert` de ce changement et observer la synchronisation.
4. Expliquer pourquoi un retour de version ne restaure pas une base de données.
5. Expliquer le rôle de chaque wave et les effets de prune/selfHeal.

Livrable : capture des statuts, commit livré et preuve de correction de dérive. Ne publier ni mot de passe admin ni token.

## Dépannage
- Repo inaccessible : vérifier l'URL et que le chart est effectivement dans la branche ciblée.
- OutOfSync : lire le diff et demander une synchronisation dans l'interface.
- Progressing : vérifier PVC et probes.
- Hook en échec : inspecter Job, logs de migration et Secret.
- ImagePullBackOff : vérifier l'image dans kind ou la visibilité du package GHCR.

## Nettoyage
Le modèle n'ajoute pas de finalizer de suppression en cascade. Supprimer l'Application, puis son namespace applicatif :
```bash
kubectl -n argocd delete application stock-lab05
kubectl delete namespace stock-lab05
```
La seconde commande détruit ses données. Garder ArgoCD pour les autres exercices ; supprimer son namespace uniquement si plus aucune Application de lab n'en dépend.

Références : [installation ArgoCD](https://argo-cd.readthedocs.io/en/stable/getting_started/) et [phases et sync waves](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/).

## Vérifier l'accès depuis votre propre poste

Si les commandes sont exécutées dans une VM, garder le tunnel SSH actif pendant la vérification. Ouvrir l'URL locale du tunnel, et non le nom interne `backend` ou `postgres`. Réaliser [le scénario métier](../SCENARIO.md) lorsqu'une application est déployée. Pour le lab CI, les critères portent d'abord sur le run GitHub et les images publiées.

Consigner votre environnement, la distribution Kubernetes éventuelle, les versions, l'architecture des nœuds et le résultat des étapes dans votre compte rendu. Les variantes Proxmox/Vagrant et les clusters existants sont documentés ; ils n'ont pas tous été exécutés lors de la validation initiale. Voir [les vérifications](../VALIDATION.md).
