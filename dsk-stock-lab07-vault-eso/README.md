# Lab 07 — Fournir les secrets de votre application depuis Vault

Vous devez centraliser la configuration sensible de l’application. Votre objectif est de lire les cinq clés depuis Vault KV v2, de les synchroniser avec External Secrets Operator et de démontrer une rotation JWT sans reconstruire les images.

**Niveau :** Avancé · **Durée indicative :** 3 à 4 heures

## Commencer

1. Suivez [SCENARIO.md](SCENARIO.md) : prérequis, clone ou ZIP, préparation, réalisation et recette.
2. Adaptez vos machines, images, stockage et accès avec [ENVIRONNEMENT.md](ENVIRONNEMENT.md).
3. Consultez [GUIDE.md](GUIDE.md) pour retrouver le pas à pas technique.
4. Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) au fil de vos vérifications.

Le code vient de `https://github.com/sdiawa/lab-devops.git`. Après récupération du dépôt, exécutez les commandes de ce lab depuis **dsk-stock-lab07-vault-eso/**, le dossier contenant `apps/` et `labs/`. Votre infrastructure vous appartient : aucun accès Proxmox, aucune IP ni aucun cluster ne sont fournis par l’auteur.

## Ce que vous allez apprendre

KV v2, policy minimale, SecretStore, ExternalSecret, Secret cible et rotation JWT.

## Prérequis principaux

Maîtriser les ressources Kubernetes de base, Helm, les Secrets et le fonctionnement d’une variable d’environnement dans un Pod. Des notions de policy Vault sont nécessaires. Votre cluster, son stockage et sa connectivité vers Vault. Soit vous utilisez les serveurs dédiés de démonstration, soit votre Vault/ESO existant avec un chemin autorisé et les règles d’authentification/TLS de votre infrastructure. Pour une installation locale dédiée, environ 4 vCPU, 8 Go de RAM et 30 Go libres constituent une estimation de départ.

La liste précise des outils et leurs contrôles se trouve dans le scénario. Tous les fichiers applicatifs nécessaires sont inclus ; suivre un lien vers un composant d’un autre lab n’impose pas de cloner un autre dépôt.

Voir [la recette métier](../SCENARIO.md) et [l’état des vérifications](../VALIDATION.md).
