# Lab 01 — Mettre en service une application avec Docker Compose

Vous rejoignez une petite équipe qui suit son matériel informatique dans des fichiers partagés. Elle vous remet DSK Stock et vous demande une première installation utilisable sur une machine de votre lab. Vous devez livrer l’interface, son API et PostgreSQL, puis montrer que les données survivent à la recréation des conteneurs.

**Niveau :** Débutant · **Durée indicative :** 1 à 2 heures

## Commencer

1. Suivez [SCENARIO.md](SCENARIO.md) : prérequis, clone ou ZIP, préparation, réalisation et recette.
2. Adaptez vos machines, images, stockage et accès avec [ENVIRONNEMENT.md](ENVIRONNEMENT.md).
3. Consultez [GUIDE.md](GUIDE.md) pour retrouver le pas à pas technique.
4. Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) au fil de vos vérifications.

Le code vient de `https://github.com/sdiawa/lab-devops.git`. Après récupération du dépôt, exécutez les commandes de ce lab depuis **dsk-stock-lab01-docker/**, le dossier contenant `apps/` et `labs/`. Votre infrastructure vous appartient : aucun accès Proxmox, aucune IP ni aucun cluster ne sont fournis par l’auteur.

## Ce que vous allez apprendre

Conteneurs, réseau Compose, proxy Nginx, volume PostgreSQL et migration ponctuelle.

## Prérequis principaux

Savoir ouvrir un terminal, naviguer dans des dossiers et identifier un port réseau. Une première lecture de Docker est utile ; connaître React ou NestJS n’est pas nécessaire. Une machine Linux, une VM Linux Vagrant/Proxmox/VMware/VirtualBox ou un poste disposant de Docker. Point de départ indicatif : 2 vCPU, 4 Go de RAM et 20 Go disponibles pour les images et les volumes. Aucun cluster Kubernetes requis.

La liste précise des outils et leurs contrôles se trouve dans le scénario. Tous les fichiers applicatifs nécessaires sont inclus ; suivre un lien vers un composant d’un autre lab n’impose pas de cloner un autre dépôt.

Voir [la recette métier](../SCENARIO.md) et [l’état des vérifications](../VALIDATION.md).
