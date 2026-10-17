# Lab 03 — Créer une installation reproductible avec Helm
## Votre mission
> ****Parcours recommandé :**** Lab 01 (Docker Compose) → Lab 02 (Kubernetes) → ****Lab 03 (Helm)****. Ce lab utilise le dépôt réellement cloné dans `~/devops-labs/lab-devops/dsk-stock-lab03-helm` (commit observé `07a15a9`). Les chemins `labs/dsk-stock-lab03-helm/...` figurant dans une ancienne version du scénario sont incorrects pour cette arborescence.





Votre équipe souhaite réinstaller la même application dans plusieurs environnements sans recopier et modifier manuellement tous les manifests. Vous devez utiliser le chart fourni et exprimer les différences de votre infrastructure dans un fichier de valeurs local.



****Niveau :**** Intermédiaire. ****Durée indicative :**** 2 à 3 heures, hors installation de votre infrastructure et téléchargement des images.



Vous travaillez sur ****votre propre infrastructure****. Ce cours n’attribue ni VM, ni IP, ni cluster : vous réutilisez les vôtres. Le choix de Proxmox, Vagrant, d’un autre hyperviseur ou d’un poste local vous appartient. Le [guide d’environnement](ENVIRONNEMENT.md) explique les différences de réseau et d’accès.



****Ce que ce lab ajoute :**** Templates Helm, fichier values, release, révision et upgrade.



## 1. Vérifier vos prérequis
**### Connaissances**



Savoir examiner des Pods, Services, Jobs et PVC avec kubectl. Comprendre le rôle d’une migration et d’un registre d’images.



**### Infrastructure à fournir**



Votre cluster Kubernetes existant. Le namespace stock-lab03 sera dédié à l’exercice. Le provisionneur de stockage et le registre restent ceux de votre lab ; Longhorn et Harbor ne sont pas imposés. Pour un petit cluster local : environ 2 vCPU, 4 Go de RAM et 20 Go libres.



Les ressources indiquées sont des estimations pour un lab pédagogique, pas une garantie de dimensionnement. Vérifiez les ressources déjà consommées par vos services.



**### Outils et résultat attendu**



\| Prérequis | Commande ou contrôle | Vous pouvez continuer si… |

\|---|---|---|

\| kubectl et accès au cluster | kubectl config current-context ; kubectl get nodes ; kubectl get storageclass | Cluster prêt et stockage choisi. |

\| Helm | helm version | Helm 3 ou version compatible disponible. |

\| Images applicatives | docker version | Vous pouvez construire les images, ou disposez déjà de références accessibles aux nœuds. |

\| OpenSSL | openssl version | Vous pouvez générer votre JWT de démonstration. |



Git est nécessaire pour le clone ; il est facultatif pour lire et exécuter un ZIP hors exercices Git. Python 3 est requis pour les scripts fournis si vous les utilisez. Les commandes utilisent Bash ou un shell compatible : sous Windows, utilisez WSL2 ou votre VM Linux.



Les conteneurs embarquent Node et les dépendances de l’application : aucune installation manuelle de React, NestJS ou PostgreSQL sur votre hôte n’est demandée. Le lab CI installe ses outils dans les runners.



Ne poursuivez pas si un prérequis indispensable échoue : utilisez les liens d’installation d’ENVIRONNEMENT.md et les diagnostics du guide. Installer un outil sur votre PC ne l’installe pas dans votre VM.



## 1 bis. Installer K3s et Helm sur une VM Ubuntu

Cette section est destinée aux apprenants qui partent d'une **VM Ubuntu sans Kubernetes ni Helm**, comme `test-helm`. Si vous disposez déjà d'un cluster Kubernetes accessible, **n'installez pas un second K3s** : installez uniquement les clients `kubectl` et Helm, puis configurez l'accès à votre cluster existant avec un kubeconfig adapté.

> **Prérequis matériels conseillés pour ce TP :** 2 vCPU, 4 Go de RAM et 20 Go de disque libre au minimum. Les commandes ci-dessous s'exécutent **dans la VM Ubuntu**, pas sur votre Mac. Elles nécessitent un accès Internet et des droits administrateur. K3s crée un cluster local et peut modifier la configuration réseau et les règles de pare-feu de la VM.

### Étape A — Préparer Ubuntu

```bash
sudo apt update
sudo apt install -y curl ca-certificates git openssl
cat /etc/os-release
free -h
df -h /
```

### Étape B — Installer K3s (cluster Kubernetes local)

Télécharger le script officiel, l'examiner, puis lancer l'installation :

```bash
curl -sfL https://get.k3s.io -o /tmp/install-k3s.sh
less /tmp/install-k3s.sh
sudo sh /tmp/install-k3s.sh
```

K3s installe un service systemd, un runtime `containerd` et les outils Kubernetes, dont `kubectl` (généralement via `/usr/local/bin/kubectl`). **Docker Engine n'est pas requis pour exécuter les Pods K3s**. Si le script échoue, lire les logs plutôt que relancer aveuglément l'installation.

```bash
sudo systemctl status k3s --no-pager
sudo journalctl -u k3s -n 80 --no-pager
kubectl version --client
kubectl get nodes -o wide
kubectl get storageclass
kubectl get pods -A
```

**Résultat attendu :** un nœud en état `Ready`, une StorageClass par défaut telle que `local-path`, et les composants système en cours de démarrage ou `Running`. Attendez quelques instants si les Pods système démarrent encore.

> **Sécurité :** ne publiez jamais `/etc/rancher/k3s/k3s.yaml` dans Git. Ce fichier kubeconfig contient des informations d'accès privilégiées au cluster. Ne désactivez pas le pare-feu par défaut pour « faire fonctionner » le lab : diagnostiquez d'abord les flux nécessaires.

### Étape C — Installer Helm

Helm est un **client de gestion de releases Kubernetes** : il utilise le kubeconfig pour communiquer avec l'API Kubernetes. Il ne remplace pas K3s.

Télécharger le script officiel Helm 3, le vérifier avant exécution et l'installer :

```bash
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 -o /tmp/get_helm.sh
less /tmp/get_helm.sh
chmod 700 /tmp/get_helm.sh
sudo /tmp/get_helm.sh
```

Vérifier que les outils fonctionnent **depuis le même compte utilisateur** :

```bash
helm version
helm env
kubectl config current-context
kubectl get nodes
kubectl get storageclass
```

**Résultat attendu :** Helm affiche une version, `kubectl` accède au cluster, et le nœud est `Ready`. Sur une VM où vous êtes connecté en `root`, les commandes fonctionnent généralement directement avec la configuration K3s. Pour un utilisateur non privilégié, configurez proprement l'accès au kubeconfig, sans le rendre lisible par tous.

### Étape D — Vérification avant de poursuivre

```bash
command -v kubectl
command -v helm
kubectl get nodes -o wide
kubectl get storageclass
helm version --short
```

Si `kubectl` répond `command not found`, vérifiez que l'installation K3s s'est achevée et que `/usr/local/bin` est dans le `PATH`. Si `kubectl` indique `connection refused` ou `permission denied`, examinez le service K3s et l'accès au kubeconfig. Si Helm est absent, vérifiez l'exécution du script et son résultat.

**À comprendre avant la suite :** `kubectl` permet de manipuler les ressources Kubernetes ; Helm génère ces ressources à partir du chart `chart/`, des templates et de `values.local.yaml`, puis suit leurs révisions.

Références officielles : [installation K3s](https://docs.k3s.io/quick-start), [installation Helm](https://helm.sh/docs/intro/install/).

---

## 2. Récupérer les sources chez vous
Le dépôt du parcours est `https://github.com/sdiawa/lab-devops.git`. Il doit contenir les sept dossiers nommés `dsk-stock-lab01-docker` à `dsk-stock-lab07-vault-eso`. Les noms de dossier sont significatifs pour les commandes, la CI et ArgoCD.



**### Méthode A — Cloner avec Git**



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

cd dsk-stock-lab03-helm

ls

```



Résultat attendu : vous voyez `README.md`, `SCENARIO.md`, `GUIDE.md`, `ENVIRONNEMENT.md`, `apps/`, `chart/`, `values.local.example.yaml` et `package.json`. ****Toutes les commandes de déploiement qui suivent partent de ce dossier****, sauf lorsqu’un retour à la racine Git est explicitement indiqué.



**### Méthode B — Télécharger une archive ZIP**



1. Ouvrez le dépôt dans votre navigateur.

2. Sélectionnez la branche ou la révision indiquée sur la page du cours.

3. Cliquez sur ****Code****, puis ****Download ZIP****.

4. Décompressez l’archive ; GitHub ajoute généralement le nom de branche au dossier extrait, par exemple `lab-devops-main`.

5. Ouvrez un terminal dans le sous-dossier `dsk-stock-lab03-helm` de cette archive.

6. Vérifiez la présence de `apps/` et `chart/` avant d’exécuter une commande.



Le ZIP est une copie des sources sans historique Git. Pour les labs 04 et 05, utilisez le fork et le clone pour réaliser les exercices de commits et de livraison. Le ZIP convient pour lire ces cours ; à lui seul, il ne crée pas un dépôt dans lequel vous pouvez pousser.



**### Si l’exécution se fait dans une VM**



Clonez directement dans la VM après connexion SSH, ou transférez le dépôt complet. Exemple depuis votre PC, avant d’entrer dans le sous-dossier du lab :



```bash

scp -r lab-devops utilisateur@ADRESSE_DE_VOTRE_VM:~/

ssh utilisateur@ADRESSE_DE_VOTRE_VM

```



Dans la VM, entrez dans `~/lab-devops/dsk-stock-lab03-helm`. Adaptez l’utilisateur, l’adresse et le port SSH à votre infrastructure. Pour Vagrant, vous pouvez utiliser le dossier partagé de votre configuration ou les informations de `vagrant ssh-config`. Les clés et les IP ne sont pas fournies par ce dépôt.



Références : [cloner un dépôt GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) et [télécharger ses sources](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives).



## 3. Préparer les paramètres de votre infrastructure
**### Vérifier le chart réellement présent**



Depuis `dsk-stock-lab03-helm` :



```bash

pwd

find chart -maxdepth 3 -type f | sort

cat values.local.example.yaml

sed -n '1,240p' chart/values.yaml

helm version

kubectl config current-context

kubectl get nodes -o wide

kubectl get storageclass

```



****Important :**** la structure du chart et les clés des valeurs doivent être vérifiées avant de modifier `values.local.yaml`. Les noms des champs proposés dans ce guide sont à confronter à `chart/values.yaml` ; ne supposez pas qu'une variable non utilisée par les templates est prise en compte.



**### Images : réutiliser GitHub Container Registry (GHCR)**



Comme dans le Lab 02, ****je recommande un registre Docker**** pour que le cluster puisse télécharger les images. Pour reproduire l'exemple de ce parcours, les images publiées sont :



```text

ghcr.io/sdiawa/dsk-stock-backend:lab02

ghcr.io/sdiawa/dsk-stock-frontend:lab02

```



Les apprenants peuvent utiliser ces images publiques si elles restent accessibles, ou publier leurs propres images avec leur compte GitHub. Pour créer et publier les leurs :



1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic). Sélectionner `write:packages` et une durée limitée ; le token doit être conservé en lieu sûr.

2. Se connecter avec `docker login ghcr.io` et `--password-stdin` (ne jamais coller le token dans le dépôt).

3. Construire les images depuis ****la racine de ce Lab 03****, car les Dockerfiles utilisent des `COPY` relatifs à cette racine.

4. Publier avec `docker push`, puis rendre chaque package ****Public**** dans les paramètres de visibilité GitHub Packages, uniquement pour ce laboratoire.



```bash

export GHCR_USER=VOTRE_COMPTE_GITHUB

read -rsp 'GitHub PAT classic : ' GHCR_TOKEN; echo

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

unset GHCR_TOKEN



docker build -f apps/backend/Dockerfile -t "ghcr.io/${GHCR_USER}/dsk-stock-backend:lab03" .

docker build -f apps/frontend/Dockerfile -t "ghcr.io/${GHCR_USER}/dsk-stock-frontend:lab03" .

docker push "ghcr.io/${GHCR_USER}/dsk-stock-backend:lab03"

docker push "ghcr.io/${GHCR_USER}/dsk-stock-frontend:lab03"

```



Dans `values.local.yaml`, utilisez ****vos références GHCR exactes**** pour `backend.image` et `frontend.image` si ces clés sont confirmées par `chart/values.yaml`. ****Avec Helm, ne modifiez pas manuellement les images dans les manifests générés : adaptez les valeurs du chart.**** Pour un package privé, configurez `imagePullSecrets` dans les Pods via le chart au lieu de supposer que `docker login` authentifie K3s.





Identifiez vos images et votre StorageClass avant de créer les volumes. Choisissez un namespace dédié ; le chart utilise des noms de Services fixes et prévoit une release par namespace. Gardez le fichier de valeurs local hors de Git lorsqu’il contient vos secrets.



Avant les commandes techniques, complétez ce tableau dans votre [compte rendu](COMPTE-RENDU.md) :



\| Paramètre | Votre valeur |

\|---|---|

\| Machine qui exécutera les commandes | PC, VM ou serveur choisi |

\| Accès au navigateur | Local ou tunnel SSH |

\| Contexte Kubernetes, si utilisé | Nom relevé avec kubectl |

\| Référence des images, si Kubernetes | Registre/tag ou import dans le runtime |

\| Stockage, si Kubernetes | StorageClass ou PV préparé |

\| Révision des sources | Commit Git ou archive utilisée |



Pour Kubernetes, une image construite dans Docker n’est pas forcément présente dans le runtime du cluster. Avant le déploiement, suivez l’étape 7 d’ENVIRONNEMENT.md : registre accessible aux nœuds, import K3s adapté ou chargement kind. Pour les labs 01 et 04, ce point n’impose pas de créer un cluster.



## 4. Réaliser le lab pas à pas
Les fichiers sont déjà fournis dans ce dossier. Lisez chaque action, exécutez ses commandes sur la machine choisie et vérifiez le résultat avant de passer à la suivante. Les fichiers locaux contenant vos paramètres ou vos secrets restent hors de Git.



**### Fichiers et choix**

Le chart `chart/` déploie PostgreSQL, ses données, un Job de migration, l'API et Nginx. Il utilise des noms de services fixes : une seule release dans chaque namespace. Installer une autre release dans un namespace distinct.



Selon le chart fourni, le Job est nommé avec le numéro de révision Helm. Le backend attend que la table Product existe dans un initContainer. L'option `--wait-for-jobs` permet de ne déclarer l'installation réussie qu'après la fin des migrations. Pour une mise à jour de schéma, prévoir la compatibilité avec les versions applicatives encore en service.



**### Paramètres à adapter au cluster**



Dans le fichier `values.local.yaml` utilisé par ce projet, ajouter les paramètres correspondant à votre environnement :



```yaml

backend:

  image: ghcr.io/VOTRE_COMPTE/dsk-stock-backend:lab03

frontend:

  image: ghcr.io/VOTRE_COMPTE/dsk-stock-frontend:lab03

postgres:

  storageClass: NOM_DE_VOTRE_STORAGECLASS

  storage: 1Gi

```



Ces valeurs sont des exemples à remplacer. Sur kind ou après import sous les noms de lab, conserver les images d'origine. Omettre `storageClass` pour utiliser la classe par défaut. Garder les autres paramètres du fichier, notamment le JWT du lab 03/06 ou `existingSecret` du lab 07. Le chart accepte désormais une classe de stockage explicite.



**### Action 1 — Créer un fichier de valeurs local**

```bash

cp values.local.example.yaml values.local.yaml

chmod 600 values.local.yaml

openssl rand -hex 32

# Éditer values.local.yaml et y définir le JWT généré, les images et le stockage

```

Remplacer la valeur `secrets.jwtSecret` dans `values.local.yaml`. Ce fichier est ignoré par Git. Les valeurs du chart sont des identifiants de démonstration ; utiliser uniquement des caractères alphanumériques et underscores pour les paramètres de connexion simplifiés.



**### Action 2 — Examiner le rendu**

```bash

helm lint ./chart -f values.local.yaml

helm template stock ./chart -n stock-lab03 -f values.local.yaml > /tmp/stock-lab03-rendered.yaml

# ATTENTION : ce fichier peut contenir des Secrets. Ne pas le committer.

grep -nE "image:|storageClassName:|kind: (Deployment|StatefulSet|Job|Secret)" /tmp/stock-lab03-rendered.yaml

```

Le rendu affiche le Secret : garder cette sortie locale. Repérer les replicas, images, volumes et noms de services.



**### Action 3 — Installer**

```bash

helm upgrade --install stock ./chart \

  --namespace stock-lab03 --create-namespace \

  -f values.local.yaml \

  --wait --wait-for-jobs --timeout 5m

kubectl -n stock-lab03 get pods,jobs,pvc

kubectl -n stock-lab03 port-forward service/frontend 8080:80

```

Ouvrir http://localhost:8080 puis suivre la recette métier ci-dessous. Si vous utilisez une VM distante, reportez-vous à la section accès réseau.



**### Accès depuis un ordinateur différent de la VM K3s**



`kubectl port-forward` écoute par défaut sur `127.0.0.1` ****de la machine qui exécute la commande****. Si votre navigateur est sur un Mac et Kubernetes sur une VM, `localhost:8080` sur le Mac ne pointe pas vers la VM.



****Méthode recommandée : tunnel SSH depuis votre ordinateur**** (les deux port-forwards sont lancés dans deux terminaux de la VM) :



```bash

# Terminal 1, sur la VM :

kubectl -n stock-lab03 port-forward svc/frontend 8080:80

# Terminal 2, sur la VM :

kubectl -n stock-lab03 port-forward svc/backend 3001:3001

# Terminal 3, sur votre Mac (laissez le tunnel ouvert) :

ssh -L 8080:127.0.0.1:8080 -L 3001:127.0.0.1:3001 UTILISATEUR@IP_VM

```



Naviguez sur `http://localhost:8080`. Pour un accès direct sur le LAN, `kubectl port-forward --address 0.0.0.0` est possible, ****mais expose les ports sur les interfaces réseau de la VM**** : réservez-le à un réseau de confiance, avec filtrage adapté.



**### Éviter l'erreur frontend « Network Error »**



Le frontend utilise `VITE_API_BASE_URL` au ****démarrage du conteneur**** pour générer `/usr/share/nginx/html/env.js`. Si cette valeur est absente ou pointe vers une URL inaccessible depuis le navigateur, l'interface peut s'afficher mais les inscriptions échouent.



Dans le Lab 02, nous avons diagnostiqué le problème avec :



```bash

kubectl -n stock-lab03 exec deployment/frontend -- cat /usr/share/nginx/html/env.js

kubectl -n stock-lab03 get deployment frontend -o yaml | grep -A 15 'env:'

```



****Avec Helm, corrigez durablement le chart****, pas uniquement le Deployment en direct. Cherchez comment les templates frontend exposent les variables d'environnement :



```bash

grep -RIn 'VITE_API_BASE_URL\|VITE_API_URL\|frontend.*env' chart apps/frontend/entrypoint.sh

```



Si le chart ne transmet pas encore la variable, ajoutez un paramètre `frontend.apiBaseUrl` dans `chart/values.yaml` puis utilisez-le dans le template du Deployment frontend :



```yaml

# Exemple de fragment à insérer dans spec.template.spec.containers[] du frontend

env:

  - name: VITE_API_BASE_URL

    value: {{ .Values.frontend.apiBaseUrl | quote }}

```



Ajoutez ensuite `frontend.apiBaseUrl` dans `values.local.yaml` avec l'URL ****accessible au navigateur****. Dans le cas du tunnel SSH ci-dessus, `http://localhost:3001/api` convient ; avec un Ingress qui route `/api` vers le backend, préférez `/api` pour une URL relative au même domaine. Vérifiez le rendu avec `helm template`, puis relancez `helm upgrade --install`. ****Ne copiez pas ce fragment sans vérifier l'emplacement et l'indentation dans le template réel.****



**### Action 4 — Mettre à jour**

Dans `values.local.yaml`, passer `backend.replicas` à 2 (si ce paramètre est utilisé par les templates) puis relancer la commande d'installation. Examiner :

```bash

helm history stock -n stock-lab03

kubectl -n stock-lab03 get deployment backend

```

Les Jobs achevés de révisions précédentes peuvent rester présents ; ils servent ici de trace d'exécution. Le retour à une version applicative ne revient pas automatiquement sur les migrations de base.



## 5. Recette : démontrer que votre mission est réussie
\| Point de contrôle | Résultat à démontrer |

\|---|---|

\| Rendu | helm lint passe et le rendu contient les images et le stockage choisis. |

\| Installation | La release est deployed et le Job de migration a réussi. |

\| Métier | Le scénario métier fonctionne avec les données dans le PVC. |

\| Upgrade | Le backend passe à deux replicas et une nouvelle révision apparaît. |

\| Isolation | Une seconde installation dans un autre namespace possède ses propres données. |



Ouvrez le frontend depuis votre PC et exécutez la recette métier détaillée du Lab 02. Elle vérifie l’inscription, la création du clavier, les mouvements et le refus d’une sortie impossible. L’API et l’interface font partie du même exercice ; un Pod Running seul ne valide pas la mission.



Vous pouvez aussi lancer :



```bash

curl -i http://localhost:3001/health

curl -i http://localhost:3001/api/products

```



Ces commandes testent la santé du backend (`200`) et la protection de la route produits (`401` sans JWT). Lancez-les depuis une machine qui accède au port-forward du backend. Pour tester l’inscription et les mouvements de stock, utilisez l’interface du frontend.



**### Si une vérification échoue**



```bash

helm status stock -n stock-lab03

kubectl -n stock-lab03 get jobs

kubectl -n stock-lab03 get jobs

# Remplacer NOM_JOB par le nom réellement affiché :

kubectl -n stock-lab03 logs job/NOM_JOB

kubectl -n stock-lab03 get pods

# Vérifier le nom exact de l’initContainer dans le Deployment :

kubectl -n stock-lab03 get deployment backend -o yaml | grep -A 18 initContainers:

```

Adapter le suffixe du Job à la révision. Si l'installation attend, diagnostiquer la base et les migrations avant d'augmenter le timeout.



## 6. Questions pour comprendre ce que vous avez fait
1. Quel est l’avantage d’un fichier de valeurs par environnement ?

2. Pourquoi la StorageClass doit-elle être choisie avant la première installation ?

3. Pourquoi helm rollback ne restaure-t-il pas automatiquement la base SQL ?



**### Exercices complémentaires**



1. Déployer une deuxième installation dans `stock-lab03-b` avec un nouveau fichier de valeurs.

2. Modifier les requests et limits en les exposant dans `values.yaml`.

3. Ajouter un Ingress en option ; préciser l'Ingress Controller et le DNS requis.

4. Expliquer pourquoi un hook pre-install de migration échouerait si PostgreSQL n'existe pas encore.

5. Remplacer les identifiants rendus dans le chart par un Secret existant via `existingSecret`.



Livrable : rendu commenté, historique d'upgrade, scénario métier et comparaison des deux namespaces.



## 7. Votre livrable
Complétez [COMPTE-RENDU.md](COMPTE-RENDU.md) avec votre architecture, vos paramètres, le résultat des points de contrôle, les incidents rencontrés et vos réponses. Joignez les commandes de diagnostic ou des captures utiles. Masquez les mots de passe, JWT, clés et kubeconfigs.



Le résultat attendu est une installation ou une CI que vous pouvez expliquer et refaire, avec une révision de sources identifiée. Votre variante d’infrastructure doit être vérifiée sur votre cluster, avec les sorties des commandes et les tests métier.



## 8. Terminer votre session
Arrêtez les port-forwards et tunnels avec Ctrl+C. Utilisez le nettoyage de la partie technique uniquement pour les ressources créées par cet exercice. Conservez les données si vous souhaitez poursuivre ; la suppression d’un volume ou d’un namespace peut les détruire. Votre cluster, votre VM et les services partagés de votre infrastructure n’ont pas à être supprimés pour terminer un lab.



**### Nettoyage des ressources de cet exercice**



```bash

helm uninstall stock -n stock-lab03

```

Les PVC créés par le StatefulSet peuvent rester après désinstallation. Supprimer `stock-lab03` uniquement si vous voulez également supprimer ces données.



Référence : [documentation Helm](https://helm.sh/docs/).