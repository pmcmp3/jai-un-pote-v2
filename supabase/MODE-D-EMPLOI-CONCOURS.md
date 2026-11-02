# Mettre le concours en route — étape par étape

Cinq minutes, tout se fait dans le navigateur. Rien à installer.

---

## Étape 1 — Coller le SQL

1. Ouvre **supabase.com**, puis ton projet **jai-un-pote-v2**.
2. Dans la colonne de gauche, clique sur **SQL Editor** (l'icône `>_`).
3. Clique sur **New query**.
4. Ouvre le fichier `supabase/CONCOURS-A-COLLER.sql`, **sélectionne tout**, copie, colle dans
   la fenêtre.
5. Clique sur **Run** (ou ⌘ + Entrée).

En bas, trois résultats doivent s'afficher : la ligne du concours avec ses dates, le nombre de
ligues en course, et le classement (vide pour l'instant, c'est normal).

> Le fichier est **relançable**. Si tu le recolles plus tard, il ne casse rien et il
> n'écrase **pas** les dates que tu auras changées à la main.

---

## Étape 2 — Vérifier la date de clôture

Le fichier pose la clôture au **dimanche 22 novembre 2026 à 12 h 00** (heure de Paris), et
l'ouverture à l'instant où tu l'as collé.

Pour la changer, colle ça dans le SQL Editor en remplaçant la date :

```sql
update public.concours set fin = '2026-11-22 12:00:00+01' where id = 1;
```

Pour décaler l'OUVERTURE (par exemple si tu colles aujourd'hui mais lances vendredi — sinon tes
propres parties de test comptent dans le concours) :

```sql
update public.concours set debut = '2026-11-07 18:00:00+01' where id = 1;
```

⚠️ Mets la **même** date de fin dans `public/config.js`, ligne `concoursFin` : c'est le repli
affiché quand le téléphone n'a pas de réseau.

---

## Étape 3 — Compléter le règlement

Ouvre `public/reglement.html` et remplace les passages **surlignés en jaune** :

- ton nom ou ta raison sociale
- ton statut (auto-entrepreneur, SAS…)
- ton numéro SIRET
- ton adresse
- ton email de contact (il apparaît deux fois)

Tant qu'ils ne sont pas remplis, le concours tourne mais le règlement n'est pas opposable.
Je ne suis pas juriste : si tu veux être tranquille, fais-le relire.

---

## Étape 4 — Mettre en ligne

Dans le terminal :

```bash
cd ~/Documents/PMC/JAI-UN-POTE-V2 && ./deploy.sh "le concours de ligues"
```

Il lance les 14 tests avant de déployer, et refuse de déployer si l'un échoue.

---

## Étape 5 — Vérifier comme un nouveau joueur

Ouvre sur ton téléphone :

```
https://pmcmp3.github.io/jai-un-pote-v2/?9&premiere
```

Tu dois voir : pseudo + **Insta demandé**, puis ton cycliste, puis « créer ma ligue » avec un
nom déjà proposé. À la fin d'une partie : « Ta ligue a besoin de toi » avec ton rang, et
« Voir le classement général ».

---

# Ce que tu peux lire ensuite

Toujours dans le **SQL Editor**, une requête à la fois.

### Le classement des ligues

```sql
select * from public.concours_ligues order by total desc;
```

### Les contacts (pour prévenir la ligue gagnante)

```sql
select * from public.contacts order by created_at desc;
```

⚠️ Ces contacts sont **illisibles depuis le jeu** et depuis n'importe quel navigateur : la table
n'a aucune règle de lecture publique. Ils ne se lisent qu'ici.

### Les ligues à regarder de près (triche)

```sql
select * from public.ligues_suspectes;
```

Beaucoup de pseudos pour peu d'appareils = probablement une seule personne qui s'est inscrite
vingt fois. À toi de trancher : la ligne te le montre, elle ne bloque rien.

### L'A/B test : qu'est-ce qui fait cliquer vers le son

```sql
select * from public.ab_ecoute;
```

`panneau` = on propose les trois plateformes. `spotify` = un seul bouton. La colonne
`taux_pct` est le pourcentage de joueurs qui ont cliqué.

### L'A/B test : quel message d'invitation marche

```sql
select * from public.ab_invitation;
```

`envoyees` = combien de fois ce message est parti. `acceptees` = combien de potes sont arrivés
derrière. C'est le rapport des deux qui compte.

### Relever le plafond anti-triche

Si un vrai score se fait refuser (tu le verras : un joueur dit avoir fait un score qui
n'apparaît pas) :

```sql
update public.concours set plafond_score = 100000 where id = 1;
```

Pour savoir où le poser : `node outils/plafond.mjs` dans le terminal.

---

# Le message à envoyer

> Salut ! J'ai fait un jeu pour la sortie de « J'ai un pote ».
>
> Le principe : tu crées une ligue avec tes potes, et le score de ta ligue c'est tous vos
> meilleurs scores additionnés. Plus t'as de potes qui jouent, plus tu montes.
>
> Dimanche 22 novembre à midi, la ligue n°1 gagne un son que j'écris sur eux. Leurs vannes,
> leurs histoires. Et s'ils sont à Paris, ils viennent poser dessus.
>
> C'est par là : https://pmcmp3.github.io/jai-un-pote-v2/

Pour inviter dans une ligue précise, le jeu fabrique lui-même le lien avec le code
(`?ligue=XXXXX`) : c'est le bouton « Inviter tes potes ».
