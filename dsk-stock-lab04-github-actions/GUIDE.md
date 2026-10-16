# Projet 04 — Construire et publier les images avec GitHub Actions — Guide pas à pas

## Avant de commencer : choisissez votre environnement

Ce guide s'exécute depuis la racine **de ce projet**, où se trouvent `apps/` et `labs/`. Proxmox n'est pas requis : une VM Vagrant, une autre VM Linux, un poste personnel ou un cluster déjà disponible peuvent être utilisés.

1. Lire [ENVIRONNEMENT.md](ENVIRONNEMENT.md) pour distinguer PC, VM et cluster.
2. Préparer les outils demandés ci-dessous sur la machine d'exécution.
3. Si Kubernetes est utilisé, choisir soit le chemin kind, soit votre cluster existant ; préparer ses images et son stockage.
4. Choisir l'accès navigateur direct ou le tunnel SSH. Les URL localhost du pas à pas désignent la machine d'exécution ; le tunnel les rend disponibles depuis le PC.
5. Exécuter les étapes dans l'ordre et vérifier les résultats avant de continuer.

Les fichiers inclus suffisent pour ce projet ; il n'est pas nécessaire de cloner un autre dépôt de lab. Les liens vers d'autres projets expliquent les composants réutilisés et restent dans ce dépôt.

### Chemin CI

L'exécution principale a lieu sur les runners GitHub Actions. Vous avez besoin de Git et d'un dépôt GitHub ; votre hyperviseur et votre cluster personnel ne sont pas utilisés. Vérifier d'abord les deux Dockerfiles et leurs chemins depuis ce dépôt, puis copier le workflow comme expliqué ci-dessous.

## Mission et objectifs
À chaque pull request, vérifier le projet. Sur main ou lancement manuel, publier deux images GHCR avec le SHA complet du commit. Comprendre CI, permissions, registre et tags immuables.

Niveau : intermédiaire. Durée : 2 à 3 h. Prérequis : votre propre dépôt GitHub, Actions activées et les sources de ce parcours. Aucune connexion à Kubernetes n'est nécessaire.

## 1. Installer le workflow dans votre dépôt
Depuis le dossier `dsk-stock-lab04-github-actions`, placé à la racine du dépôt Git `lab-devops` :
```bash
mkdir -p ../.github/workflows
cp labs/dsk-stock-lab04-github-actions/workflow.yaml ../.github/workflows/stock-labs.yaml
```
Le workflow actif doit être dans `.github/workflows/` à la racine Git du dépôt, un niveau au-dessus du dossier du lab. Il utilise le sous-dossier `dsk-stock-lab04-github-actions` pour les vérifications et les builds. Le modèle reste dans ce projet pour permettre d'apprendre Docker et Kubernetes avant d'activer la publication automatique.

## 2. Comprendre les jobs
`verify` installe les dépendances figées, lance lint, tests non interactifs, vérification TypeScript frontend, build et lint Helm. `images` dépend de son succès et construit les images AMD64 et ARM64.

Le workflow utilise `GITHUB_TOKEN` avec `packages: write` uniquement dans le job de publication. Sur une pull request il construit sans publier. Le nom de dépôt est normalisé en minuscules pour GHCR.

Les tests métier de l'application restent très limités : ce workflow automatise les tests présents, il ne les rend pas suffisants.

## 3. Lancer et vérifier
Commiter puis pousser le workflow dans votre dépôt. Dans Actions, vérifier le résultat des deux jobs. Pour un fork `compte/lab-devops`, les images seront :
```text
ghcr.io/compte/lab-devops-backend:<SHA_COMPLET>
ghcr.io/compte/lab-devops-frontend:<SHA_COMPLET>
```
Dans les paramètres de chaque package GHCR, autoriser l'accès public si vous souhaitez des pulls anonymes dans les labs. Un dépôt GitHub public ne garantit pas à lui seul qu'un package est public.

## 4. Utiliser ces images
Dans un fichier local de valeurs du projet 03 :
```yaml
backend:
  image: ghcr.io/compte/lab-devops-backend:remplacer_par_le_sha_complet
frontend:
  image: ghcr.io/compte/lab-devops-frontend:remplacer_par_le_sha_complet
```
Remplacer le compte, le dépôt et le SHA, puis exécuter l'upgrade Helm. Pour un package privé, créer un imagePullSecret et ajouter sa référence dans les Pods : ce complément n'est pas activé dans le chart de base.

## Exercices
1. Introduire une erreur TypeScript et vérifier que la publication est bloquée.
2. Ajouter un test de refus d'une sortie supérieure au stock.
3. Remplacer les références de versions des actions par des SHA vérifiés.
4. Ajouter un test HTTP après lancement du Compose dans la CI.
5. Montrer qu'un nouveau commit produit un nouveau tag sans écraser l'ancien.

Livrable : lien vers un run de votre dépôt, références des deux images et explication du déclenchement sur PR/main.

## Dépannage
- 403 GHCR : vérifier permissions du workflow et autorisation Actions du package.
- Tests qui ne finissent pas : conserver `vitest run`.
- Échec du verrou : corriger les dépendances et régénérer le lockfile ensemble, puis commiter les deux.
- ImagePullBackOff : vérifier visibilité du package et tag exact.

## Nettoyage
Depuis le dossier du lab 04, retirer le workflow actif `../.github/workflows/stock-labs.yaml` et commiter ce retrait dans votre fork pour désactiver ce pipeline. Supprimer les packages de démonstration depuis GitHub uniquement si vous n'en avez plus besoin.

Référence : [publication d'images avec GitHub Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

## Vérifier l'accès depuis votre propre poste

Si les commandes sont exécutées dans une VM, garder le tunnel SSH actif pendant la vérification. Ouvrir l'URL locale du tunnel, et non le nom interne `backend` ou `postgres`. Réaliser [le scénario métier](../SCENARIO.md) lorsqu'une application est déployée. Pour le lab CI, les critères portent d'abord sur le run GitHub et les images publiées.

Consigner votre environnement, la distribution Kubernetes éventuelle, les versions, l'architecture des nœuds et le résultat des étapes dans votre compte rendu. Les variantes Proxmox/Vagrant et les clusters existants sont documentés ; ils n'ont pas tous été exécutés lors de la validation initiale. Voir [les vérifications](../VALIDATION.md).
