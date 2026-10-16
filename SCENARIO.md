# Scénario de validation de DSK Stock

Utiliser une base neuve ou choisir un SKU différent à chaque essai. Dans les labs 01 à 07, le frontend est accessible par défaut sur http://localhost:8080 et relaie `/api` vers le backend avec Nginx.

1. Créer un compte fictif `apprenant@example.com` avec un mot de passe de lab.
2. Créer « Clavier USB », SKU `LAB-CLAVIER-001`, catégorie Informatique, quantité 10, seuil 5, prix 25 et emplacement A-01.
3. Dans la page produits, renseigner une entrée de 3 et cliquer sur l'icône de mouvement de sa ligne : stock 13.
4. Faire une sortie de 4 : stock 9.
5. Tenter une sortie de 99 : réponse HTTP 400 visible dans l'onglet Réseau du navigateur, stock inchangé.
6. Ouvrir le détail : trois mouvements (stock initial, entrée et sortie), aucune trace de la sortie refusée.
7. Recharger le dashboard : 225 € et aucune alerte si la base contient seulement ce produit.
8. Se déconnecter et se reconnecter ; les données doivent être conservées.

L'interface actuelle n'affiche pas toutes les erreurs API. Utiliser les outils développeur pour vérifier le refus. Le catalogue est partagé entre tous les comptes et l'authentification ne définit pas de rôles.

Ne pas modifier directement la quantité par le formulaire d'édition pendant ce scénario : cette action n'est pas correctement représentée dans l'historique actuel. La fiabilisation de l'application constitue un exercice de développement distinct.

Livrable : schéma d'architecture et tableau attendu/observé, sans JWT ni mots de passe.
