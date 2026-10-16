# Lab 06 — Détecter une panne avec Prometheus et Grafana

Une application peut être déployée tout en étant indisponible pour ses utilisateurs. Vous devez mettre en place une observation HTTP, construire un tableau de bord et provoquer une panne contrôlée du backend pour comprendre ce que les sondes détectent réellement.

**Niveau :** Intermédiaire · **Durée indicative :** 2 à 3 heures

## Commencer

1. Suivez [SCENARIO.md](SCENARIO.md) : prérequis, clone ou ZIP, préparation, réalisation et recette.
2. Adaptez vos machines, images, stockage et accès avec [ENVIRONNEMENT.md](ENVIRONNEMENT.md).
3. Consultez [GUIDE.md](GUIDE.md) pour retrouver le pas à pas technique.
4. Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) au fil de vos vérifications.

Les fichiers de ce lab sont disponibles sur [GitHub — dsk-stock-lab06-prometheus-grafana](https://github.com/sdiawa/lab-devops/tree/main/dsk-stock-lab06-prometheus-grafana). Après récupération du dépôt, exécutez les commandes de ce lab depuis **dsk-stock-lab06-prometheus-grafana/**, le dossier contenant `apps/` et `labs/`. Votre infrastructure vous appartient : aucun accès Proxmox, aucune IP ni aucun cluster ne sont fournis par l’auteur.

## Ce que vous allez apprendre

Prometheus, Blackbox Exporter, datasource Grafana et sondes HTTP externes.

## Prérequis principaux

Savoir utiliser kubectl et Helm, identifier un Service et lire une série temporelle simple. Une première pratique des labels Prometheus est utile. Votre cluster existant avec un namespace stock-lab06 dédié. Les composants peuvent tirer leurs images publiques. Prévoir davantage de mémoire que pour l’application seule ; environ 4 vCPU, 8 Go de RAM et 30 Go libres pour un cluster local sont une estimation de départ.

La liste précise des outils et leurs contrôles se trouve dans le scénario. Tous les fichiers applicatifs nécessaires sont inclus ; suivre un lien vers un composant d’un autre lab n’impose pas de cloner un autre dépôt.

Voir [la recette métier](../SCENARIO.md) et [l’état des vérifications](../VALIDATION.md).
