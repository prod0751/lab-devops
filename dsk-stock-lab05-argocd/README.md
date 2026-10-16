# Lab 05 — Livrer votre application depuis Git avec ArgoCD

Vous souhaitez que les déploiements reflètent l’état décrit dans Git. Vous allez connecter ArgoCD à votre fork, déployer sur votre cluster, puis observer la correction d’une dérive manuelle et le retour à une configuration antérieure par commit.

**Niveau :** Intermédiaire · **Durée indicative :** 2 à 3 heures

## Commencer

1. Suivez [SCENARIO.md](SCENARIO.md) : prérequis, clone ou ZIP, préparation, réalisation et recette.
2. Adaptez vos machines, images, stockage et accès avec [ENVIRONNEMENT.md](ENVIRONNEMENT.md).
3. Consultez [GUIDE.md](GUIDE.md) pour retrouver le pas à pas technique.
4. Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) au fil de vos vérifications.

Les fichiers de ce lab sont disponibles sur [GitHub — dsk-stock-lab05-argocd](https://github.com/sdiawa/lab-devops/tree/main/dsk-stock-lab05-argocd). Après récupération du dépôt, exécutez les commandes de ce lab depuis **dsk-stock-lab05-argocd/**, le dossier contenant `apps/` et `labs/`. Votre infrastructure vous appartient : aucun accès Proxmox, aucune IP ni aucun cluster ne sont fournis par l’auteur.

## Ce que vous allez apprendre

Source Git, Application ArgoCD, sync waves, hook de migration, selfHeal et retour à une révision.

## Prérequis principaux

Connaître les manifests Kubernetes, les valeurs Helm et les commandes Git de base. Savoir rendre une image accessible aux nœuds. Votre cluster existant, son stockage et ses accès réseau. ArgoCD doit pouvoir lire votre dépôt Git et tirer les images. Pour un cluster local hébergeant aussi ArgoCD, une enveloppe d’environ 4 vCPU, 8 Go de RAM et 30 Go libres est un point de départ indicatif.

La liste précise des outils et leurs contrôles se trouve dans le scénario. Tous les fichiers applicatifs nécessaires sont inclus ; suivre un lien vers un composant d’un autre lab n’impose pas de cloner un autre dépôt.

Voir [la recette métier](../SCENARIO.md) et [l’état des vérifications](../VALIDATION.md).
