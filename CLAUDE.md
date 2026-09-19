# CLAUDE.md — « J'ai un pote v2 » (jeu de campagne PMC)

## Avant toute chose

**Lis `ARCHITECTURE.md` en entier.** La première moitié décrit ce que la v2 change (vue de profil,
gameplay en hauteur, mesures, domaine, base) ; la seconde est l'héritage de la v1, qui fait foi
pour tout le reste. `PLAN-V2.md` est le plan d'exécution d'origine (19 septembre 2026) : utile pour
savoir *pourquoi*, pas pour savoir *où en est* le code.

## Résumé

Second jeu de PMC, calé sur le morceau *J'ai un pote* : runner de campagne à vélo, contre-la-montre
de la durée du morceau (173,65 s), pièces → potes, ligues entre amis, fantôme du meilleur. La v2
reprend la v1 (`jai-un-pote/` du dépôt `pmcmp3/la-ville-est-belle`) et ne change **que
l'architecture et la perspective** : **une seule voie, vue de profil**, « exactement comme Jetpack
Joyride ou Zombie Tsunami » (demandé le 19 septembre 2026, captures de référence à l'appui). Cible :
navigateur mobile, Safari iOS d'abord, **portrait natif**.

En ligne : **https://pmcmp3.github.io/jai-un-pote-v2/** (dépôt `pmcmp3/jai-un-pote-v2`), bientôt
`https://pote.la-ville-est-belle-pmc.fr/`. Déploiement **manuel** : `./deploy.sh "message"`.

## Règles techniques non négociables (héritées)

- **Vanilla JS + Canvas 2D + Vite.** Pas de framework, pas de moteur 3D, aucune dépendance runtime
  (`playwright-core` n'est qu'un outil de test, en devDependency).
- **Boucle à pas de temps fixe** (120 Hz) ; horloge maîtresse = **Web Audio API**.
- **`public/config.js` = SEUL fichier de réglages**, jamais de logique de jeu dedans.
- **iOS** : `AudioContext` débloqué sur geste utilisateur, dans la pile d'appel du geste.
- **Jamais la base Supabase de la v1** (la bêta fermée y tourne) ; jamais toucher au dépôt
  `pmcmp3/la-ville-est-belle` depuis ce projet.

## Décisions du 19 septembre 2026 (plan accepté tel quel : « exécute le plan »)

- **D1** Projet autonome frère du dépôt du premier jeu, son propre dépôt GitHub.
- **D2** Adresse : `pote.la-ville-est-belle-pmc.fr` (CNAME à poser chez OVH par l'artiste,
  puis `outils/brancher-domaine.sh`). En attendant : l'adresse github.io.
- **D3** Nouveau projet Supabase ; ligues et membres copiés, **pas les scores**.
- **D4** **Portrait conservé** : caméra de profil, joueur à gauche (30 % → 25 % avec la vitesse),
  alerte « ! » au bord droit pour ce qui arrive hors champ.
- **D5** Gestes : **tap = saut, re-tap en l'air = salto**, rien d'autre (swipe latéral ignoré).
- **D6** **Pièces en hauteur** : arcs au-dessus des obstacles, piles sur les rangées libres.
- **D7** Traversants (tracteur, poule lancée) : ils arrivent **du fond** et coupent la route ;
  armement sur le passage du joueur inchangé.

## Invariants de la v2 (mesurés, `outils/mesurer.mjs`)

- Deux obstacles consécutifs : **4 rangées** entre deux sauts, **5 dès qu'un salto est en jeu**,
  **jamais deux saltos d'affilée**. Un joueur idéal scripté ne touche **aucun** obstacle sur 40
  graines ; un joueur immobile les touche tous. À re-mesurer après toute modif du générateur.
- Quotas identiques d'une graine à l'autre (22 laits, 15 pièces rouges, ±1 par espèce).
- **Rien qui ressemble à un obstacle juste derrière la route** (de profil, la profondeur se lit
  mal) ; rien au premier plan plus haut que le bord de la route (`hauteurMaxPremierPlan`).
- Toute modif du générateur ou des règles de route : **`VERSION_COURSE += 1`** (regles.js).

## Outils

- `node outils/mesurer.mjs [N]` — quotas, écarts, score parfait, joueurs scriptés.
- `node outils/capture.mjs [scènes]` — Chrome headless 375×812, captures dans `outils/sorties/` ;
  `SERVIR=dist` teste le build, `PARTIES=0` le tuto ; scène `perf` = coût de rendu CPU ×4.
- ⚠️ La preview de l'IDE ne peut pas jouer le jeu (l'`AudioContext` fige l'onglet) : passer par
  `capture.mjs`, puis par un vrai téléphone.

## Méthode de travail

- **Mesurer avant de conclure.** Les bugs sérieux de ces jeux se trouvent en comptant.
- À la fin de chaque chantier : ce qui est fait, ce qui reste, sans enjoliver.
- Tenir `ARCHITECTURE.md` à jour quand un invariant, un piège ou un point ouvert change.
