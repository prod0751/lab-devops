# Projet 07 — Fournir les secrets depuis Vault avec ESO — Guide pas à pas

## Avant de commencer : choisissez votre environnement

Ce guide s'exécute depuis la racine **de ce projet**, où se trouvent `apps/` et `labs/`. Proxmox n'est pas requis : une VM Vagrant, une autre VM Linux, un poste personnel ou un cluster déjà disponible peuvent être utilisés.

1. Lire [ENVIRONNEMENT.md](ENVIRONNEMENT.md) pour distinguer PC, VM et cluster.
2. Préparer les outils demandés ci-dessous sur la machine d'exécution.
3. Si Kubernetes est utilisé, choisir soit le chemin kind, soit votre cluster existant ; préparer ses images et son stockage.
4. Choisir l'accès navigateur direct ou le tunnel SSH. Les URL localhost du pas à pas désignent la machine d'exécution ; le tunnel les rend disponibles depuis le PC.
5. Exécuter les étapes dans l'ordre et vérifier les résultats avant de continuer.

Les fichiers inclus suffisent pour ce projet ; il n'est pas nécessaire de cloner un autre dépôt de lab. Les liens vers d'autres projets expliquent les composants réutilisés et restent dans ce dépôt.

### Chemin A : cluster kind

Si vous n'avez pas de cluster, créer kind avec l'étape 6 d'ENVIRONNEMENT.md, puis construire et charger les images avec son étape 7. Le nom `kind-stock-labs` désigne seulement ce cluster local.

### Chemin B : votre cluster existant

Ne créer aucun cluster kind. Vérifier votre contexte avec `kubectl config current-context` et les nœuds avec `kubectl get nodes`. Utiliser les images du registre accessible à vos nœuds, ou l'import adapté à votre runtime, puis choisir votre StorageClass avec `kubectl get storageclass`. La préparation est détaillée dans ENVIRONNEMENT.md.

## Mission et objectifs
Stocker la configuration sensible dans Vault KV v2, synchroniser un Secret Kubernetes avec External Secrets Operator, puis utiliser ce Secret dans le chart.

Niveau : avancé. Durée : 3 à 4 h. Prérequis : un cluster accessible, images, Helm et kubectl ; installation des CRD ESO autorisée dans votre environnement. Ce projet possède ses namespaces `stock-lab07`, `vault-lab07` et `eso-lab07`.

## Périmètre du serveur de démonstration
Vault fonctionne en mode dev, en HTTP interne, avec un token root de démonstration et un stockage en mémoire. Il perd ses secrets au remplacement du Pod. Ce choix rend le lab local réalisable sans certificat, unseal ou backend de stockage ; il ne constitue pas un déploiement de production.

ESO utilisera un token limité à la lecture de `secret/data/stock`, pas le token root. L'authentification Kubernetes est proposée en exercice d'approfondissement.

## Architecture
Vault KV → ESO et son SecretStore → Secret `stock-secrets` → PostgreSQL, migration et API. Aucune donnée Vault n'est nécessaire au frontend : l'URL relative `/api` est une configuration publique.

## Paramètres à adapter au cluster

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

## 1. Installer Vault et ESO

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

### Variante : Vault ou ESO déjà disponible dans votre lab

Réutiliser ESO si les CRD et son contrôleur sont déjà installés ; ne pas le désinstaller lors du nettoyage. Pour votre Vault, copier `secrets.yaml` dans `externalsecret.local.yaml` et adapter l'URL du serveur, le montage KV v2 et le chemin de lecture. Appliquer ensuite ce fichier local à l'étape 4. Si Vault utilise une CA privée, configurer la confiance TLS avec `caProvider` selon le provider ESO ; conserver la vérification du certificat.

Dans les étapes 2 et 3, utiliser le client Vault et le mode d'authentification de **votre installation**. Les commandes `exec vault-0` et le token `lab-root-token` ne concernent que le serveur de démonstration créé ci-dessus. Obtenir de votre administrateur un chemin KV et une policy autorisés ; les cinq clés attendues restent les mêmes. Adapter `policy.hcl` au montage et au chemin choisis.

Le chemin de référence complet reste le serveur Vault dev fourni. L'intégration d'un Vault existant dépend de ses règles d'authentification et de TLS ; elle ne consiste pas à remplacer uniquement un nom de VM. Ne supprimer aucun composant partagé lors du nettoyage.

## 2. Alimenter Vault
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

## 3. Créer une policy et un token de lecture
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

## 4. Synchroniser les données
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

## 5. Déployer avec le Secret existant

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

## 6. Comprendre une rotation
Changer uniquement le JWT dans Vault avec `vault kv patch secret/stock JWT_SECRET=...`, en conservant les autres clés. Attendre une actualisation ESO, puis :
```bash
kubectl -n stock-lab07 rollout restart deployment/backend
kubectl -n stock-lab07 rollout status deployment/backend --timeout=180s
```
Les variables d'environnement d'un Pod déjà en cours ne changent pas à chaque mise à jour du Secret. Les anciens JWT ne seront plus valides après le redémarrage : se reconnecter.

Une rotation du mot de passe PostgreSQL est différente : changer Vault ne modifie pas le compte SQL déjà créé dans le volume. Elle nécessite de coordonner modification du compte et redémarrage des clients.

## Exercices
1. Remplacer l'authentification par token par l'authentification Kubernetes avec un ServiceAccount et un rôle Vault dédiés.
2. Déployer Vault avec stockage persistant et TLS ; expliquer unseal, sauvegarde et récupération.
3. Révoquer le token de lecture et diagnostiquer l'échec ESO.
4. Ajouter une procédure de rotation JWT et une validation après reconnexion.
5. Intégrer cette installation avec ArgoCD, en organisant les prérequis ESO avant l'application.

Livrable : schéma du flux des secrets, policy minimale, statuts Ready et procédure de rotation. Garder les valeurs sensibles hors du compte rendu.

## Dépannage
- CRD inconnue : vérifier installation ESO et version d'API.
- SecretStore non Ready : vérifier le Service Vault, le token et son expiration.
- Permission denied : comparer la policy `secret/data/stock` et le chemin KV v2.
- Secret absent : consulter les événements de l'ExternalSecret.
- Secrets perdus : un Pod Vault dev a peut-être été recréé ; rejouer alimentation, policy et token.

## Nettoyage
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

## Vérifier l'accès depuis votre propre poste

Si les commandes sont exécutées dans une VM, garder le tunnel SSH actif pendant la vérification. Ouvrir l'URL locale du tunnel, et non le nom interne `backend` ou `postgres`. Réaliser [le scénario métier](../SCENARIO.md) lorsqu'une application est déployée. Pour le lab CI, les critères portent d'abord sur le run GitHub et les images publiées.

Consigner votre environnement, la distribution Kubernetes éventuelle, les versions, l'architecture des nœuds et le résultat des étapes dans votre compte rendu. Les variantes Proxmox/Vagrant et les clusters existants sont documentés ; ils n'ont pas tous été exécutés lors de la validation initiale. Voir [les vérifications](../VALIDATION.md).
