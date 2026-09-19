# Ouvrir la ligue de test de « J'ai un pote v2 »

Étape par étape, dans l'ordre. Compte environ dix minutes, la première fois.

## A. Si le projet Supabase de la v2 n'existe pas encore

1. Va sur **supabase.com**, connecte-toi, bouton **New project**.
2. Nom : `jai-un-pote-v2`. Région : **Europe (Paris)** ou Francfort.
   Mot de passe de base : celui que tu veux, garde-le, tu n'en auras pas besoin ensuite.
3. Attends que le projet passe au vert (1 à 2 minutes).
4. Menu de gauche → **SQL Editor** → **New query**.
5. Ouvre le fichier `supabase/schema-v2.sql` du projet, **copie tout**, colle
   dans la fenêtre, bouton **Run**. Il doit finir sans erreur rouge.
6. Menu de gauche → **Project Settings** → **API**. Note deux choses :
   - **Project URL** (`https://xxxx.supabase.co`)
   - la clé **anon public** (la longue, celle marquée « anon », surtout pas
     « service_role »)
7. Envoie-moi ces deux valeurs : je les colle dans `public/config.js`
   (`apiBase` = l'URL suivie de `/rest/v1`, `apiKey` = la clé anon) et je
   redéploie. **Sans cette étape, le jeu tourne sans ligue** : il affiche la
   ligue de démonstration et n'enregistre aucun score.

⚠️ Ne réutilise pas le projet Supabase du premier jeu : la bêta fermée de « La
ville est belle » y tourne, et les courses de la v2 pollueraient ses
classements.

## B. Créer la ligue de test

1. **SQL Editor** → **New query**.
2. Ouvre `supabase/ligue-test-v2.sql`, copie tout, colle, **Run**.
3. La dernière ligne doit répondre `membres = 4`.

Ça crée la ligue **TESTV2** avec Arthur, Louis, Antoine et Paul déjà dedans :
ils forment le peloton que verra rouler le premier joueur qui arrive, même
s'il est tout seul.

## C. Partager le lien

Le lien d'invitation est :

    https://pmcmp3.github.io/jai-un-pote-v2/?ligue=TESTV2

Quiconque l'ouvre est inscrit dans la ligue de test dès qu'il choisit son
pseudo. Le menu est réduit à trois écrans (pseudo → cycliste → JOUER), il n'y
a ni choix de ligue ni sprint, et l'écran de fin porte un bouton
**« Laisser un retour »**.

Message à envoyer avec le lien :

> Bonjour, voici la nouvelle ligue de test. Vous pouvez jouer à la bêta pour me
> dire si vous avez des retours ou des choses qui ne fonctionnent pas.

## D. Lire les retours

**Table editor** → table **`retours_beta`**. Chaque ligne porte le pseudo, le
texte et la date.

⚠️ Cette table est en écriture seule pour le jeu : elle n'est lisible QUE
d'ici. C'est voulu — personne ne peut lire les retours des autres depuis le
navigateur.

## Repères

| Quoi | Où |
|---|---|
| Code de la ligue | `TESTV2` |
| Plafond | 60 joueurs |
| Membres de départ | arthur, louis, antoine, paul |
| Scores | table `ligue_scores` |
| Retours | table `retours_beta` |
