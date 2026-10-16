# Lab 04 — Vérifier le code et publier vos images avec GitHub Actions

Vous devez éviter de construire et pousser les images à la main après chaque changement. Vous allez créer votre copie du dépôt, activer le workflow et montrer qu’une erreur bloque la livraison. Les images publiées doivent être identifiables par le commit qui les a produites.

**Niveau :** Intermédiaire · **Durée indicative :** 2 à 3 heures

## Commencer

1. Suivez [SCENARIO.md](SCENARIO.md) : prérequis, clone ou ZIP, préparation, réalisation et recette.
2. Adaptez vos machines, images, stockage et accès avec [ENVIRONNEMENT.md](ENVIRONNEMENT.md).
3. Consultez [GUIDE.md](GUIDE.md) pour retrouver le pas à pas technique.
4. Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) au fil de vos vérifications.

Le code vient de `https://github.com/sdiawa/lab-devops.git`. Après récupération du dépôt, exécutez les commandes de ce lab depuis **dsk-stock-lab04-github-actions/**, le dossier contenant `apps/` et `labs/`. Votre infrastructure vous appartient : aucun accès Proxmox, aucune IP ni aucun cluster ne sont fournis par l’auteur.

## Ce que vous allez apprendre

Pipeline, contrôles automatisés, permissions du token, build multiarchitecture et publication GHCR.

## Prérequis principaux

Comprendre commit, branche et pull request, ainsi que le rôle d’une image Docker. Le workflow est fourni et doit être lu avant activation. Votre compte GitHub et un fork du dépôt. Les jobs du modèle utilisent des runners GitHub ; votre Proxmox, Vagrant ou cluster personnel n’est pas sollicité par cette CI. Les règles et quotas de votre compte GitHub s’appliquent.

La liste précise des outils et leurs contrôles se trouve dans le scénario. Tous les fichiers applicatifs nécessaires sont inclus ; suivre un lien vers un composant d’un autre lab n’impose pas de cloner un autre dépôt.

Voir [la recette métier](../SCENARIO.md) et [l’état des vérifications](../VALIDATION.md).
