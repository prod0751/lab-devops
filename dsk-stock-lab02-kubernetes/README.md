# Lab 02 — Déployer sur votre cluster avec des manifests Kubernetes

La première installation doit désormais tourner sur Kubernetes. Vous disposez de votre propre cluster et devez livrer les objets nécessaires sans Helm ni ArgoCD. Vous devez comprendre qui lance les conteneurs, comment les services communiquent et où les données persistent.

**Niveau :** Débutant Kubernetes · **Durée indicative :** 2 à 3 heures

## Commencer

1. Suivez [SCENARIO.md](SCENARIO.md) : prérequis, clone ou ZIP, préparation, réalisation et recette.
2. Adaptez vos machines, images, stockage et accès avec [ENVIRONNEMENT.md](ENVIRONNEMENT.md).
3. Consultez [GUIDE.md](GUIDE.md) pour retrouver le pas à pas technique.
4. Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) au fil de vos vérifications.

Le code vient de `https://github.com/sdiawa/lab-devops.git`. Après récupération du dépôt, exécutez les commandes de ce lab depuis **dsk-stock-lab02-kubernetes/**, le dossier contenant `apps/` et `labs/`. Votre infrastructure vous appartient : aucun accès Proxmox, aucune IP ni aucun cluster ne sont fournis par l’auteur.

## Ce que vous allez apprendre

Namespace, Secret, Service, StatefulSet, PVC, Job de migration, Deployment et probes.

## Prérequis principaux

Connaître les images et volumes Docker ainsi que les notions de Pod et Service. Le code applicatif est fourni : vous n’avez pas à réécrire l’application. Votre cluster K3s, kubeadm, Minikube ou autre avec DNS et stockage opérationnels. Une VM ou un cluster local kind convient également. Pour une installation locale dédiée, prévoir environ 2 vCPU, 4 Go de RAM et 20 Go libres, à ajuster aux composants du cluster.

La liste précise des outils et leurs contrôles se trouve dans le scénario. Tous les fichiers applicatifs nécessaires sont inclus ; suivre un lien vers un composant d’un autre lab n’impose pas de cloner un autre dépôt.

Voir [la recette métier](../SCENARIO.md) et [l’état des vérifications](../VALIDATION.md).
