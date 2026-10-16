# Lab 03 — Créer une installation reproductible avec Helm

Votre équipe souhaite réinstaller la même application dans plusieurs environnements sans recopier et modifier manuellement tous les manifests. Vous devez utiliser le chart fourni et exprimer les différences de votre infrastructure dans un fichier de valeurs local.

**Niveau :** Intermédiaire · **Durée indicative :** 2 à 3 heures

## Commencer

1. Suivez [SCENARIO.md](SCENARIO.md) : prérequis, clone ou ZIP, préparation, réalisation et recette.
2. Adaptez vos machines, images, stockage et accès avec [ENVIRONNEMENT.md](ENVIRONNEMENT.md).
3. Consultez [GUIDE.md](GUIDE.md) pour retrouver le pas à pas technique.
4. Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) au fil de vos vérifications.

Les fichiers de ce lab sont disponibles sur [GitHub — dsk-stock-lab03-helm](https://github.com/sdiawa/lab-devops/tree/main/dsk-stock-lab03-helm). Après récupération du dépôt, exécutez les commandes de ce lab depuis **dsk-stock-lab03-helm/**, le dossier contenant `apps/` et `labs/`. Votre infrastructure vous appartient : aucun accès Proxmox, aucune IP ni aucun cluster ne sont fournis par l’auteur.

## Ce que vous allez apprendre

Templates Helm, fichier values, release, révision et upgrade.

## Prérequis principaux

Savoir examiner des Pods, Services, Jobs et PVC avec kubectl. Comprendre le rôle d’une migration et d’un registre d’images. Votre cluster Kubernetes existant. Le namespace stock-lab03 sera dédié à l’exercice. Le provisionneur de stockage et le registre restent ceux de votre lab ; Longhorn et Harbor ne sont pas imposés. Pour un petit cluster local : environ 2 vCPU, 4 Go de RAM et 20 Go libres.

La liste précise des outils et leurs contrôles se trouve dans le scénario. Tous les fichiers applicatifs nécessaires sont inclus ; suivre un lien vers un composant d’un autre lab n’impose pas de cloner un autre dépôt.

Voir [la recette métier](../SCENARIO.md) et [l’état des vérifications](../VALIDATION.md).
