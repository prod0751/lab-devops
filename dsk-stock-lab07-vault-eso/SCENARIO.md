# Lab 07 — Fournir les secrets de votre application depuis Vault

## Votre mission

Vous devez centraliser la configuration sensible de l’application. Votre objectif est de lire les cinq clés depuis Vault KV v2, de les synchroniser avec External Secrets Operator et de démontrer une rotation JWT sans reconstruire les images.

**Niveau :** Avancé. **Durée indicative :** 3 à 4 heures, hors installation de votre infrastructure et téléchargement des images.

Vous travaillez sur **votre propre infrastructure**. Ce cours n’attribue ni VM, ni IP, ni cluster : vous réutilisez les vôtres. Le choix de Proxmox, Vagrant, d’un autre hyperviseur ou d’un poste local vous appartient. 

**Ce que ce lab ajoute :** KV v2, policy minimale, SecretStore, ExternalSecret, Secret cible et rotation JWT.

## 1. Vérifier vos prérequis

### Connaissances

Maîtriser les ressources Kubernetes de base, Helm, les Secrets et le fonctionnement d’une variable d’environnement dans un Pod. Des notions de policy Vault sont nécessaires.

### Infrastructure à fournir

Votre cluster, son stockage et sa connectivité vers Vault. Soit vous utilisez les serveurs dédiés de démonstration, soit votre Vault/ESO existant avec un chemin autorisé et les règles d’authentification/TLS de votre infrastructure. Pour une installation locale dédiée, environ 4 vCPU, 8 Go de RAM et 30 Go libres constituent une estimation de départ.

Les ressources indiquées sont des estimations pour un lab pédagogique, pas une garantie de dimensionnement. Vérifiez les ressources déjà consommées par vos services.

### Outils et résultat attendu

| Prérequis | Commande ou contrôle | Vous pouvez continuer si… |
|---|---|---|
| kubectl avec les droits nécessaires | kubectl config current-context ; kubectl get nodes ; kubectl get storageclass | Cluster prêt et droits pour les ressources de l’exercice. |
| Helm | helm version | Installation des charts possible si vos composants ne sont pas déjà présents. |
| ESO et Vault, existants ou à installer | kubectl get crd externalsecrets.external-secrets.io | Si la CRD est absente, suivre la branche installation du guide ; ce n’est pas un prérequis à créer avant cette branche. |
| OpenSSL et images | openssl version | JWT générable et images accessibles aux nœuds. |

Git est nécessaire pour le clone ; il est facultatif pour lire et exécuter un ZIP hors exercices Git. Python 3 est requis pour les scripts fournis si vous les utilisez. Les commandes utilisent Bash ou un shell compatible : sous Windows, utilisez WSL2 ou votre VM Linux.

Les conteneurs embarquent Node et les dépendances de l’application : aucune installation manuelle de React, NestJS ou PostgreSQL sur votre hôte n’est demandée. Le lab CI installe ses outils dans les runners.

Ne poursuivez pas si un prérequis indispensable échoue : utilisez les liens d’installation d’ENVIRONNEMENT.md et les diagnostics du guide. Installer un outil sur votre PC ne l’installe pas dans votre VM.

## 2. Récupérer les sources chez vous

Le dépôt du parcours est `https://github.com/sdiawa/lab-devops.git`. Il doit contenir les sept dossiers nommés `dsk-stock-lab01-docker` à `dsk-stock-lab07-vault-eso`. Les noms de dossier sont significatifs pour les commandes, la CI et ArgoCD.

### Méthode A — Cloner avec Git

Sur la machine d’exécution choisie :

```bash
mkdir -p "$HOME/devops-labs"
cd "$HOME/devops-labs"
git clone https://github.com/sdiawa/lab-devops.git
cd lab-devops
git rev-parse --short HEAD
```

Notez la révision affichée dans votre compte rendu. Si vous avez déjà récupéré le dépôt pour un autre lab, réutilisez ce dossier ; sauvegardez vos modifications locales avant toute mise à jour. N’exécutez pas de reset pour simplement changer de lab.

Vous êtes maintenant à la racine Git du parcours. Entrez dans le projet :

```bash
cd dsk-stock-lab07-vault-eso
ls
```

Résultat attendu : vous voyez `README.md`, `SCENARIO.md`, `GUIDE.md`, `ENVIRONNEMENT.md`, `apps/`, `labs/` et `package.json`. **Toutes les commandes de déploiement qui suivent partent de ce dossier**, sauf lorsqu’un retour à la racine Git est explicitement indiqué.

### Méthode B — Télécharger une archive ZIP

1. Ouvrez le dépôt dans votre navigateur.
2. Sélectionnez la branche ou la révision indiquée sur la page du cours.
3. Cliquez sur **Code**, puis **Download ZIP**.
4. Décompressez l’archive ; GitHub ajoute généralement le nom de branche au dossier extrait, par exemple `lab-devops-main`.
5. Ouvrez un terminal dans le sous-dossier `dsk-stock-lab07-vault-eso` de cette archive.
6. Vérifiez la présence de `apps/` et `labs/` avant d’exécuter une commande.

Le ZIP est une copie des sources sans historique Git. Pour les labs 04 et 05, utilisez le fork et le clone pour réaliser les exercices de commits et de livraison. Le ZIP convient pour lire ces cours ; à lui seul, il ne crée pas un dépôt dans lequel vous pouvez pousser.

### Si l’exécution se fait dans une VM

Clonez directement dans la VM après connexion SSH, ou transférez le dépôt complet. Exemple depuis votre PC, avant d’entrer dans le sous-dossier du lab :

```bash
scp -r lab-devops utilisateur@ADRESSE_DE_VOTRE_VM:~/
ssh utilisateur@ADRESSE_DE_VOTRE_VM
```

Dans la VM, entrez dans `~/lab-devops/dsk-stock-lab07-vault-eso`. Adaptez l’utilisateur, l’adresse et le port SSH à votre infrastructure. Pour Vagrant, vous pouvez utiliser le dossier partagé de votre configuration ou les informations de `vagrant ssh-config`. Les clés et les IP ne sont pas fournies par ce dépôt.

Références : [cloner un dépôt GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) et [télécharger ses sources](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives).

## 3. Préparer les paramètres de votre infrastructure

Choisissez explicitement entre un Vault de démonstration et votre Vault existant. Le token lab-root-token concerne uniquement la démonstration en mémoire fournie. Dans votre infrastructure, utilisez votre méthode d’authentification, votre CA éventuelle et un chemin de secrets réservé à l’exercice. Ne réinstallez ni ne supprimez un ESO partagé pour suivre le cours.

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

### Architecture
Vault KV → ESO et son SecretStore → Secret `stock-secrets` → PostgreSQL, migration et API. Aucune donnée Vault n'est nécessaire au frontend : l'URL relative `/api` est une configuration publique.

### Paramètres à adapter au cluster

Dans le fichier `values.local.yaml` utilisé par ce projet, ajouter les paramètres correspondant à votre environnement :

```yaml
backend:
  image: docker.io/VOTRE_COMPTE/dsk-stock-backend:lab-v1
frontend:
  image: docker.io/VOTRE_COMPTE/dsk-stock-frontend:lab-v1
postgres:
  storageClass: NOM_DE_VOTRE_STORAGECLASS
  storage: 1Gi
```

Ces valeurs sont des exemples à remplacer. Sur kind ou après import sous les noms de lab, conserver les images d'origine. Omettre `storageClass` pour utiliser la classe par défaut. Garder les autres paramètres du fichier, notamment le JWT du lab 03/06 ou `existingSecret` du lab 07. Le chart accepte désormais une classe de stockage explicite.

### Action 1 — Installer Vault et ESO

Ces commandes créent une installation de démonstration dédiée. Si votre infrastructure dispose déjà de Vault ou ESO, voir la variante après les commandes avant de les exécuter.

Depuis la racine, sur le contexte de votre cluster vérifié :
```bash
kubectl config current-context
kubectl get nodes
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo add external-secrets https://charts.external-secrets.io
helm repo update
helm upgrade --install vault hashicorp/vault --version 0.34.1 \
  -n vault-lab07 --create-namespace \
  -f labs/dsk-stock-lab07-vault-eso/vault-values.yaml --wait --timeout 5m
helm upgrade --install external-secrets external-secrets/external-secrets --version 2.12.0 \
  -n eso-lab07 --create-namespace \
  --set installCRDs=true --wait --timeout 5m
kubectl create namespace stock-lab07 --dry-run=client -o yaml | kubectl apply -f -
kubectl get crd externalsecrets.external-secrets.io
```
Les versions des charts sont figées dans les commandes. Les relever avec `helm list -n vault-lab07` et `helm list -n eso-lab07` et consulter [les vérifications](../VALIDATION.md). Les manifests fournis utilisent `external-secrets.io/v1` ; en cas de changement de version ESO, vérifier que cette API est toujours servie.

#### Variante : Vault ou ESO déjà disponible dans votre lab

Réutiliser ESO si les CRD et son contrôleur sont déjà installés ; ne pas le désinstaller lors du nettoyage. Pour votre Vault, copier `secrets.yaml` dans `externalsecret.local.yaml` et adapter l'URL du serveur, le montage KV v2 et le chemin de lecture. Appliquer ensuite ce fichier local à l'étape 4. Si Vault utilise une CA privée, configurer la confiance TLS avec `caProvider` selon le provider ESO ; conserver la vérification du certificat.

Dans les étapes 2 et 3, utiliser le client Vault et le mode d'authentification de **votre installation**. Les commandes `exec vault-0` et le token `lab-root-token` ne concernent que le serveur de démonstration créé ci-dessus. Obtenir de votre administrateur un chemin KV et une policy autorisés ; les cinq clés attendues restent les mêmes. Adapter `policy.hcl` au montage et au chemin choisis.

Le chemin de référence complet reste le serveur Vault dev fourni. L'intégration d'un Vault existant dépend de ses règles d'authentification et de TLS ; elle ne consiste pas à remplacer uniquement un nom de VM. Ne supprimer aucun composant partagé lors du nettoyage.

### Action 2 — Alimenter Vault
Créer les cinq clés attendues par le chart :
```bash
export LAB_JWT_SECRET="$(openssl rand -hex 32)"
kubectl -n vault-lab07 exec vault-0 -- env \
  VAULT_ADDR=http://127.0.0.1:8200 VAULT_TOKEN=lab-root-token \
  vault kv put secret/stock \
  POSTGRES_USER=stock POSTGRES_PASSWORD=stock_local_only POSTGRES_DB=stock \
  DATABASE_URL=postgresql://stock:stock_local_only@postgres:5432/stock \
  JWT_SECRET="$LAB_JWT_SECRET"
unset LAB_JWT_SECRET
```
Le dev server active normalement KV v2 au chemin `secret/`. Vérifier avec `vault secrets list` via la même commande exec si ce chemin est absent.

### Action 3 — Créer une policy et un token de lecture
```bash
kubectl -n vault-lab07 exec -i vault-0 -- env \
  VAULT_ADDR=http://127.0.0.1:8200 VAULT_TOKEN=lab-root-token \
  vault policy write stock-read - < labs/dsk-stock-lab07-vault-eso/policy.hcl

export LAB_VAULT_TOKEN="$(kubectl -n vault-lab07 exec vault-0 -- env \
  VAULT_ADDR=http://127.0.0.1:8200 VAULT_TOKEN=lab-root-token \
  vault token create -policy=stock-read -no-default-policy -ttl=2h -field=token)"

kubectl -n stock-lab07 create secret generic vault-access \
  --from-literal=token="$LAB_VAULT_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -
unset LAB_VAULT_TOKEN
```
Ce token expire après deux heures ; recréez-le pour une session plus longue. La policy autorise la lecture du secret et de `auth/token/lookup-self`, nécessaire à la validation du token par ESO. Ne publiez pas les tokens générés.

### Action 4 — Synchroniser les données
```bash
kubectl -n stock-lab07 apply -f labs/dsk-stock-lab07-vault-eso/secrets.yaml
kubectl -n stock-lab07 wait --for=condition=Ready secretstore/stock-vault --timeout=120s
kubectl -n stock-lab07 wait --for=condition=Ready externalsecret/stock --timeout=120s
kubectl -n stock-lab07 describe externalsecret stock
```
Vérifier le nom du Secret créé sans afficher ses valeurs :
```bash
kubectl -n stock-lab07 get secret stock-secrets
```

### Action 5 — Déployer avec le Secret existant

Copier les valeurs et adapter les images/StorageClass si nécessaire :

```bash
cp labs/dsk-stock-lab07-vault-eso/values.local.example.yaml labs/dsk-stock-lab07-vault-eso/values.local.yaml
```
```bash
helm upgrade --install stock labs/dsk-stock-lab03-helm/chart \
  -n stock-lab07 \
  -f labs/dsk-stock-lab07-vault-eso/values.local.yaml \
  --wait --wait-for-jobs --timeout 5m
kubectl -n stock-lab07 port-forward service/frontend 8080:80
```
Le paramètre `existingSecret` empêche Helm de créer lui-même `stock-secrets`. Exécuter [le scénario métier](../SCENARIO.md).

### Action 6 — Comprendre une rotation
Changer uniquement le JWT dans Vault avec `vault kv patch secret/stock JWT_SECRET=...`, en conservant les autres clés. Attendre une actualisation ESO, puis :
```bash
kubectl -n stock-lab07 rollout restart deployment/backend
kubectl -n stock-lab07 rollout status deployment/backend --timeout=180s
```
Les variables d'environnement d'un Pod déjà en cours ne changent pas à chaque mise à jour du Secret. Les anciens JWT ne seront plus valides après le redémarrage : se reconnecter.

Une rotation du mot de passe PostgreSQL est différente : changer Vault ne modifie pas le compte SQL déjà créé dans le volume. Elle nécessite de coordonner modification du compte et redémarrage des clients.

## 5. Recette : démontrer que votre mission est réussie

| Point de contrôle | Résultat à démontrer |
|---|---|
| Source | Vault contient les cinq clés attendues sur votre chemin KV v2. |
| Droits | ESO utilise un accès de lecture adapté, incluant lookup-self pour la branche par token. |
| Synchronisation | SecretStore et ExternalSecret sont Ready ; stock-secrets existe avec cinq clés. |
| Application | Helm utilise existingSecret ; l’application et les mouvements fonctionnent. |
| Rotation | Le nouveau JWT est synchronisé ; après restart backend, l’ancienne session est refusée et une reconnexion fonctionne. |
| Nettoyage | Les composants partagés de votre infrastructure restent en place. |

Pour les labs qui déploient l’application, ouvrez le frontend depuis votre PC et exécutez [la recette métier détaillée](../SCENARIO.md). Elle vérifie l’inscription, la création du clavier, les mouvements et le refus d’une sortie impossible. L’API et l’interface font partie du même exercice ; un Pod Running seul ne valide pas la mission.

Vous pouvez aussi lancer :

```bash
python3 labs/validate-http.py --base-url http://localhost:8080/api
```

Ce script crée son compte fictif et un produit de test. Il doit être lancé sur la machine qui accède à cette URL ; adaptez le port si vous utilisez un tunnel différent. Dans le lab 04, cette commande est facultative et ne s’applique que si vous avez aussi déployé une application.

### Si une vérification échoue

- CRD inconnue : vérifier installation ESO et version d'API.
- SecretStore non Ready : vérifier le Service Vault, le token et son expiration.
- Permission denied : comparer la policy `secret/data/stock` et le chemin KV v2.
- Secret absent : consulter les événements de l'ExternalSecret.
- Secrets perdus : un Pod Vault dev a peut-être été recréé ; rejouer alimentation, policy et token.

## 6. Questions pour comprendre ce que vous avez fait

1. Pourquoi une mise à jour du Secret ne change-t-elle pas les variables d’un Pod déjà en cours ?
2. Pourquoi la rotation du mot de passe PostgreSQL ne se limite-t-elle pas à modifier Vault ?
3. Quelles conditions changent entre Vault dev et un serveur persistant avec TLS ?

### Exercices complémentaires

1. Remplacer l'authentification par token par l'authentification Kubernetes avec un ServiceAccount et un rôle Vault dédiés.
2. Déployer Vault avec stockage persistant et TLS ; expliquer unseal, sauvegarde et récupération.
3. Révoquer le token de lecture et diagnostiquer l'échec ESO.
4. Ajouter une procédure de rotation JWT et une validation après reconnexion.
5. Intégrer cette installation avec ArgoCD, en organisant les prérequis ESO avant l'application.

Livrable : schéma du flux des secrets, policy minimale, statuts Ready et procédure de rotation. Garder les valeurs sensibles hors du compte rendu.

## 7. Votre livrable

Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) avec votre architecture, vos paramètres, le résultat des points de contrôle, les incidents rencontrés et vos réponses. Joignez les commandes de diagnostic ou des captures utiles. Masquez les mots de passe, JWT, clés et kubeconfigs.

Le résultat attendu est une installation ou une CI que vous pouvez expliquer et refaire, avec une révision de sources identifiée. Les vérifications initiales du cours et leurs limites sont dans [VALIDATION.md](../VALIDATION.md) ; votre variante d’infrastructure doit être vérifiée chez vous.

## 8. Terminer votre session

Arrêtez les port-forwards et tunnels avec Ctrl+C. Utilisez le nettoyage de la partie technique uniquement pour les ressources créées par cet exercice. Conservez les données si vous souhaitez poursuivre ; la suppression d’un volume ou d’un namespace peut les détruire. Votre cluster, votre VM et les services partagés de votre infrastructure n’ont pas à être supprimés pour terminer un lab.

### Nettoyage des ressources de cet exercice

```bash
helm uninstall stock -n stock-lab07
kubectl delete namespace stock-lab07
helm uninstall vault -n vault-lab07
kubectl delete namespace vault-lab07
helm uninstall external-secrets -n eso-lab07
kubectl delete namespace eso-lab07
```
La suppression du namespace applicatif détruit sa base. Les CRD ESO peuvent rester au niveau du cluster : ne les supprimer que si aucune autre installation ne les utilise.

Référence : [provider Vault d'External Secrets Operator](https://external-secrets.io/latest/provider/hashicorp-vault/).
