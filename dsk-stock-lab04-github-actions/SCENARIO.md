# Lab 04 — Vérifier le code et publier vos images avec GitHub Actions

## Votre mission

Vous devez éviter de construire et pousser les images à la main après chaque changement. Vous allez créer votre copie du dépôt, activer le workflow et montrer qu’une erreur bloque la livraison. Les images publiées doivent être identifiables par le commit qui les a produites.

**Niveau :** Intermédiaire. **Durée indicative :** 2 à 3 heures, hors installation de votre infrastructure et téléchargement des images.

Vous travaillez sur **votre propre infrastructure**. Ce cours n’attribue ni VM, ni IP, ni cluster : vous réutilisez les vôtres. Le choix de Proxmox, Vagrant, d’un autre hyperviseur ou d’un poste local vous appartient. 
**Ce que ce lab ajoute :** Pipeline, contrôles automatisés, permissions du token, build multiarchitecture et publication GHCR.

## 1. Vérifier vos prérequis

### Connaissances

Comprendre commit, branche et pull request, ainsi que le rôle d’une image Docker. Le workflow est fourni et doit être lu avant activation.

### Infrastructure à fournir

Votre compte GitHub et un fork du dépôt. Les jobs du modèle utilisent des runners GitHub ; votre Proxmox, Vagrant ou cluster personnel n’est pas sollicité par cette CI. Les règles et quotas de votre compte GitHub s’appliquent.

Les ressources indiquées sont des estimations pour un lab pédagogique, pas une garantie de dimensionnement. Vérifiez les ressources déjà consommées par vos services.

### Outils et résultat attendu

| Prérequis | Commande ou contrôle | Vous pouvez continuer si… |
|---|---|---|
| Git | git --version | Vous pouvez cloner, commiter et pousser dans votre fork. |
| Compte GitHub | Vérifier votre accès dans le navigateur | Vous avez les droits sur votre fork et pouvez utiliser Actions et GHCR. |
| Docker, seulement pour les vérifications locales facultatives | docker version | Pas nécessaire à l’exécution des jobs sur les runners GitHub. |

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
cd dsk-stock-lab04-github-actions
ls
```

Résultat attendu : vous voyez `README.md`, `SCENARIO.md`, `GUIDE.md`, `ENVIRONNEMENT.md`, `apps/`, `labs/` et `package.json`. **Toutes les commandes de déploiement qui suivent partent de ce dossier**, sauf lorsqu’un retour à la racine Git est explicitement indiqué.

### Méthode B — Télécharger une archive ZIP

1. Ouvrez le dépôt dans votre navigateur.
2. Sélectionnez la branche ou la révision indiquée sur la page du cours.
3. Cliquez sur **Code**, puis **Download ZIP**.
4. Décompressez l’archive ; GitHub ajoute généralement le nom de branche au dossier extrait, par exemple `lab-devops-main`.
5. Ouvrez un terminal dans le sous-dossier `dsk-stock-lab04-github-actions` de cette archive.
6. Vérifiez la présence de `apps/` et `labs/` avant d’exécuter une commande.

Le ZIP est une copie des sources sans historique Git. Pour les labs 04 et 05, utilisez le fork et le clone pour réaliser les exercices de commits et de livraison. Le ZIP convient pour lire ces cours ; à lui seul, il ne crée pas un dépôt dans lequel vous pouvez pousser.

### Si l’exécution se fait dans une VM

Clonez directement dans la VM après connexion SSH, ou transférez le dépôt complet. Exemple depuis votre PC, avant d’entrer dans le sous-dossier du lab :

```bash
scp -r lab-devops utilisateur@ADRESSE_DE_VOTRE_VM:~/
ssh utilisateur@ADRESSE_DE_VOTRE_VM
```

Dans la VM, entrez dans `~/lab-devops/dsk-stock-lab04-github-actions`. Adaptez l’utilisateur, l’adresse et le port SSH à votre infrastructure. Pour Vagrant, vous pouvez utiliser le dossier partagé de votre configuration ou les informations de `vagrant ssh-config`. Les clés et les IP ne sont pas fournies par ce dépôt.

Références : [cloner un dépôt GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) et [télécharger ses sources](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives).

## 3. Préparer les paramètres de votre infrastructure

Travaillez dans votre fork pour avoir le droit de pousser et d’exécuter la CI. Le dépôt contient plusieurs labs : le workflow actif doit être placé dans `.github/workflows/` à la racine Git, puis travailler dans le sous-dossier du lab 04. Le modèle est déjà adapté à cette organisation.

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

### Action 1 — Installer le workflow dans votre dépôt
Depuis le dossier `dsk-stock-lab04-github-actions`, placé à la racine du dépôt Git `lab-devops` :
```bash
mkdir -p ../.github/workflows
cp labs/dsk-stock-lab04-github-actions/workflow.yaml ../.github/workflows/stock-labs.yaml
```
Le workflow actif doit être dans `.github/workflows/` à la racine Git du dépôt, un niveau au-dessus du dossier du lab. Il utilise le sous-dossier `dsk-stock-lab04-github-actions` pour les vérifications et les builds. Le modèle reste dans ce projet pour permettre d'apprendre Docker et Kubernetes avant d'activer la publication automatique.

### Action 2 — Comprendre les jobs
`verify` installe les dépendances figées, lance lint, tests non interactifs, vérification TypeScript frontend, build et lint Helm. `images` dépend de son succès et construit les images AMD64 et ARM64.

Le workflow utilise `GITHUB_TOKEN` avec `packages: write` uniquement dans le job de publication. Sur une pull request il construit sans publier. Le nom de dépôt est normalisé en minuscules pour GHCR.

Les tests métier de l'application restent très limités : ce workflow automatise les tests présents, il ne les rend pas suffisants.

### Publier le workflow dans votre fork

Après avoir copié le workflow depuis le dossier du lab 04, revenez à la racine Git. Vérifiez les fichiers avant de les ajouter :

```bash
cd ..
git status --short
git add .github/workflows/stock-labs.yaml
git commit -m "Activer la CI du lab 04"
git push origin main
cd dsk-stock-lab04-github-actions
```

Ces commandes supposent que votre branche de travail est `main`, comme le workflow. Si votre fork utilise un autre nom de branche, adaptez la commande push et la liste `branches` du workflow ensemble. Pour une erreur volontaire, créez une branche dédiée et ouvrez une pull request dans votre propre fork.

Résultat attendu : un run apparaît dans l’onglet Actions de votre fork. Si GitHub demande d’activer Actions sur le fork, validez cette activation dans votre compte. Les noms d’images incluent votre propriétaire GitHub, le nom du dépôt et le SHA du commit affiché dans le run.

### Action 3 — Lancer et vérifier
Après ce push, ouvrir Actions dans votre fork et vérifier le résultat des deux jobs. Pour un fork `compte/lab-devops`, les images seront :
```text
ghcr.io/compte/lab-devops-backend:<SHA_COMPLET>
ghcr.io/compte/lab-devops-frontend:<SHA_COMPLET>
```
Dans les paramètres de chaque package GHCR, autoriser l'accès public si vous souhaitez des pulls anonymes dans les labs. Un dépôt GitHub public ne garantit pas à lui seul qu'un package est public.

### Action 4 — Utiliser ces images
Dans un fichier local de valeurs du projet 03 :
```yaml
backend:
  image: ghcr.io/compte/lab-devops-backend:remplacer_par_le_sha_complet
frontend:
  image: ghcr.io/compte/lab-devops-frontend:remplacer_par_le_sha_complet
```
Remplacer le compte, le dépôt et le SHA, puis exécuter l'upgrade Helm. Pour un package privé, créer un imagePullSecret et ajouter sa référence dans les Pods : ce complément n'est pas activé dans le chart de base.

## 5. Recette : démontrer que votre mission est réussie

| Point de contrôle | Résultat à démontrer |
|---|---|
| Dépôt | Le remote origin pointe vers votre fork, pas vers le dépôt auteur. |
| Workflow | Le fichier actif est à la racine Git dans .github/workflows/. |
| Vérification | Le job verify réussit pour une version correcte. |
| Construction | Les deux images sont construites ; sur main, elles sont publiées avec le SHA complet. |
| Blocage | Une erreur TypeScript introduite dans une branche fait échouer la vérification. |
| Pull | Vous pouvez tirer les images publiées avec leur tag exact, si elles ont été rendues accessibles. |

Pour les labs qui déploient l’application, ouvrez le frontend depuis votre PC et exécutez [la recette métier détaillée](../SCENARIO.md). Elle vérifie l’inscription, la création du clavier, les mouvements et le refus d’une sortie impossible. L’API et l’interface font partie du même exercice ; un Pod Running seul ne valide pas la mission.

Vous pouvez aussi lancer :

```bash
python3 labs/validate-http.py --base-url http://localhost:8080/api
```

Ce script crée son compte fictif et un produit de test. Il doit être lancé sur la machine qui accède à cette URL ; adaptez le port si vous utilisez un tunnel différent. Dans le lab 04, cette commande est facultative et ne s’applique que si vous avez aussi déployé une application.

### Si une vérification échoue

- 403 GHCR : vérifier permissions du workflow et autorisation Actions du package.
- Tests qui ne finissent pas : conserver `vitest run`.
- Échec du verrou : corriger les dépendances et régénérer le lockfile ensemble, puis commiter les deux.
- ImagePullBackOff : vérifier visibilité du package et tag exact.

## 6. Questions pour comprendre ce que vous avez fait

1. Pourquoi un workflow placé dans le .github d’un sous-dossier ne démarre-t-il pas ?
2. Quelle différence entre un build de pull request et un push sur main ?
3. Pourquoi les tests présents ne suffisent-ils pas à garantir toutes les règles métier ?

### Exercices complémentaires

1. Introduire une erreur TypeScript et vérifier que la publication est bloquée.
2. Ajouter un test de refus d'une sortie supérieure au stock.
3. Remplacer les références de versions des actions par des SHA vérifiés.
4. Ajouter un test HTTP après lancement du Compose dans la CI.
5. Montrer qu'un nouveau commit produit un nouveau tag sans écraser l'ancien.

Livrable : lien vers un run de votre dépôt, références des deux images et explication du déclenchement sur PR/main.

## 7. Votre livrable

Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) avec votre architecture, vos paramètres, le résultat des points de contrôle, les incidents rencontrés et vos réponses. Joignez les commandes de diagnostic ou des captures utiles. Masquez les mots de passe, JWT, clés et kubeconfigs.

Le résultat attendu est une installation ou une CI que vous pouvez expliquer et refaire, avec une révision de sources identifiée. Les vérifications initiales du cours et leurs limites sont dans [VALIDATION.md](../VALIDATION.md) ; votre variante d’infrastructure doit être vérifiée chez vous.

## 8. Terminer votre session

Arrêtez les port-forwards et tunnels avec Ctrl+C. Utilisez le nettoyage de la partie technique uniquement pour les ressources créées par cet exercice. Conservez les données si vous souhaitez poursuivre ; la suppression d’un volume ou d’un namespace peut les détruire. Votre cluster, votre VM et les services partagés de votre infrastructure n’ont pas à être supprimés pour terminer un lab.

### Nettoyage des ressources de cet exercice

Depuis le dossier du lab 04, retirer `../.github/workflows/stock-labs.yaml` et commiter ce retrait dans votre fork pour désactiver ce pipeline. Supprimer les packages de démonstration depuis GitHub uniquement si vous n'en avez plus besoin.

Référence : [publication d'images avec GitHub Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).
