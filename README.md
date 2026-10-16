# DSK Stock — Projets de labs DevOps

Une application fil rouge, sept projets de déploiement. Chaque dossier contient un guide, des fichiers et des exercices. Le code métier reste partagé dans `apps/` ; il n'est pas dupliqué sept fois. Toutes les commandes partent de la racine du dépôt, sauf indication contraire.

| Projet | Sujet | Ce qui est ajouté | Prérequis |
|---|---|---|---|
| [01 — Docker](https://github.com/sdiawa/lab-devops/tree/main/dsk-stock-lab01-docker) | Déployer localement | Compose, PostgreSQL, migrations, API, Nginx | Docker et Compose v2 |
| [02 — Kubernetes](https://github.com/sdiawa/lab-devops/tree/main/dsk-stock-lab02-kubernetes) | Comprendre les objets Kubernetes | Namespace, Secret, PVC, StatefulSet, Job, Deployment, Service | Docker, kind, kubectl |
| [03 — Helm](https://github.com/sdiawa/lab-devops/tree/main/dsk-stock-lab03-helm) | Paramétrer le déploiement | Un chart indépendant de l'infrastructure DSK | Lab 02, Helm 3 |
| [04 — CI et registre](https://github.com/sdiawa/lab-devops/tree/main/dsk-stock-lab04-github-actions) | Construire avec GitHub Actions | Vérifications et images GHCR identifiées par commit | GitHub, lab 01 |
| [05 — ArgoCD](https://github.com/sdiawa/lab-devops/tree/main/dsk-stock-lab05-argocd) | Livrer depuis Git | Application ArgoCD, synchronisation, retour à une version | Lab 03, dépôt GitHub public |
| [06 — Observabilité](https://github.com/sdiawa/lab-devops/tree/main/dsk-stock-lab06-prometheus-grafana) | Vérifier la disponibilité | Prometheus, Blackbox Exporter, Grafana | Lab 03 ou 05 |
| [07 — Vault et ESO](https://github.com/sdiawa/lab-devops/tree/main/dsk-stock-lab07-vault-eso) | Externaliser les secrets | Vault de démonstration, External Secrets Operator | Lab 03, Helm, kubectl |

Les labs 01 et 02 ne nécessitent ni Vault, ni MinIO, ni Harbor, ni ArgoCD. MinIO n'est utilisé par aucune fonctionnalité de l'application actuelle ; il pourrait devenir un projet supplémentaire en ajoutant un vrai besoin de stockage d'objets, par exemple les photos produits.

## Démarrage

Commencer par [le projet Docker](https://github.com/sdiawa/lab-devops/tree/main/dsk-stock-lab01-docker). Pour accéder directement à Kubernetes, son guide inclut la construction des images. Chaque projet est utilisable sans avoir exécuté tous les précédents ; ses dépendances nécessaires sont explicites.

Les guides fournissent une implémentation de référence, puis des exercices à réaliser. Pour publier un exercice à trous, créer une révision de départ dédiée et une révision de correction ; ces tags ne sont pas encore créés.

Chaque projet exporté possède **GUIDE.md** et **ENVIRONNEMENT.md** à sa racine. Les étapes proposent une exécution sur un poste personnel, une VM Vagrant/Proxmox ou un cluster Kubernetes existant. Les adaptations portent sur les images, le stockage, le contexte Kubernetes et l'accès navigateur ; l'hyperviseur reste au choix de l'apprenant.

## Dépôt GitHub du parcours

Le dépôt prévu est `https://github.com/sdiawa/lab-devops.git`. Il contient les sept dossiers de projets à sa racine. L’apprenant clone ce dépôt une fois, puis entre dans le dossier du lab choisi. Pour les labs 04 et 05, il utilise son fork pour pousser ses propres changements.

Chaque projet comprend `SCENARIO.md` (mission, prérequis, clone/ZIP, réalisation et recette) et `COMPTE-RENDU.md` en plus de ses guides. Son README dirige vers le scénario.

## Exporter les fichiers d’un projet

Un exporteur copie le code applicatif, le lab choisi et ses fichiers prérequis dans un dossier indépendant, en excluant environnements locaux, dépendances installées et configurations privées historiques. Exemple :

```bash
python3 labs/export-project.py --lab 01 --output /tmp/dsk-stock-lab01
python3 labs/export-project.py --lab 02 --output /tmp/dsk-stock-lab02
```

Le dossier de sortie doit être nouveau et situé hors du dépôt source. Pour préparer `lab-devops`, placer les sept exports côte à côte dans leurs dossiers nommés `dsk-stock-lab01-docker`, etc. Le workflow du lab 04 et le chemin Git ArgoCD du lab 05 utilisent cette organisation. Le script ne publie rien et ne crée aucun dépôt distant.

## Validation HTTP automatisée

Avec Python 3 et une application démarrée :

```bash
python3 labs/validate-http.py --base-url http://localhost:8080/api
```

Ce script crée un compte fictif et un produit de validation, puis vérifie l'authentification, les mouvements et le refus d'une sortie impossible. Il conserve son produit pour vérifier la persistance. Le scénario manuel reste nécessaire pour l'interface.

## Résultat métier commun

Après chaque déploiement, suivre [le scénario de validation](SCENARIO.md). Il évite de confondre « conteneur démarré » et « application fonctionnelle ».

## État de validation

Ces fichiers constituent des bases de cours. Les vérifications réalisées et les limites sont consignées dans [VALIDATION.md](VALIDATION.md). Ne présenter un lab comme testé de bout en bout qu'après l'avoir exécuté sur une machine disposant des services nécessaires.

## Réutilisation sur le site

Publier une page par projet : mission, architecture, prérequis, lien vers la révision GitHub, pas à pas, exercices, critères de réussite, dépannage et nettoyage. Garder les commandes et configurations de référence dans GitHub ; le site explique le raisonnement. Une trame est fournie dans [MODELE-ARTICLE.md](MODELE-ARTICLE.md).
