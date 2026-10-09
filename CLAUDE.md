# CLAUDE.md — « J'ai un pote v2 » (jeu de campagne PMC)

## Avant toute chose

- **Ce fichier décrit le jeu TEL QU'IL EST.** Quand une décision change, on remplace la ligne
  concernée ici, on n'empile pas de compte rendu daté. Le récit daté (avec les mots de l'artiste)
  va en bas de **`JOURNAL.md`**, à ne lire que pour savoir *pourquoi* une décision a été prise.
- **`ARCHITECTURE.md`** : la technique (perspective, gameplay en hauteur, base, domaine, pièges
  de rendu), puis l'héritage de la v1. Le code et `public/config.js` font foi quand un document
  les contredit.
- Les **commentaires du code** disent au présent ce que fait le code et pourquoi ; jamais de
  date, d'historique de valeurs (« 5 → 3 ») ni de citation de demande — ça, c'est git et le
  journal. `node outils/commentaires-seuls.mjs` prouve qu'une retouche de commentaires n'a pas
  touché au code.

## Résumé

Second jeu de PMC, calé sur le morceau *J'ai un pote* (173,65 s) : runner de campagne à vélo,
**une seule voie, vue de profil** (Jetpack Joyride / Zombie Tsunami), **contre-la-montre de la
durée du morceau**. Les pièces font venir des potes, qui multiplient les points ; les ligues
entre amis partagent la même route. Cible : navigateur mobile, **Safari iOS et navigateur
intégré d'Instagram d'abord**, portrait natif.

- En ligne : **https://pmcmp3.github.io/jai-un-pote-v2/** (dépôt `pmcmp3/jai-un-pote-v2`) ;
  sous-domaine `pote.la-ville-est-belle-pmc.fr` prévu (ARCHITECTURE §4).
- Lien à donner pour tester comme un nouveau joueur : **`?9&premiere`** (vide les caches, efface
  tout, ligue de démo vide).
- Mise en ligne : **`./deploy.sh "message"`** — il lance d'abord le filet (`npm run verif`) et
  refuse de déployer si un test échoue. Après chaque mise en ligne : vérifier le nom du cache
  dans le `sw.js` servi (`jp2-vNN`, à incrémenter dans `public/sw.js` à chaque version).
- La v1 (`jai-un-pote/` du dépôt `pmcmp3/la-ville-est-belle`, où tourne la bêta fermée) ne
  reçoit pas les changements de la v2.

## Règles techniques non négociables

- **Vanilla JS + Canvas 2D + Vite.** Pas de framework, pas de moteur 3D, aucune dépendance
  runtime (`playwright-core` n'est qu'un outil de test).
- **Boucle à pas de temps fixe** (120 Hz) ; horloge maîtresse = **Web Audio API**.
- **`public/config.js` = SEUL fichier de réglages**, jamais de logique de jeu dedans.
- **iOS** : `AudioContext` débloqué sur geste utilisateur, dans la pile d'appel du geste.
- **Jamais la base Supabase de la v1** ; jamais toucher au dépôt `pmcmp3/la-ville-est-belle`.
- Toute modification du générateur ou des règles de route : **`VERSION_COURSE += 1`**
  (`regles.js`).
- **`npm run verif` doit être vert** avant toute mise en ligne (voir « Le filet »).

## Le jeu aujourd'hui

### Gestes et saut (`input.js`, `main.js`)
- **Tap = saut, appui maintenu = saut plus haut, re-tap en l'air = double saut** (avec salto) ;
  swipe vers le bas = roue arrière (décoratif). Le saut part au toucher.
- ⚠️ Android rejoue chaque toucher en événements souris : `input.js` ignore toute souris qui
  suit un toucher de moins d'une seconde (sinon un tap = un double saut).

### La route (`rows.js`, `regles.js`, `simulation.js`)
- Une **chaîne** d'obstacles : l'écart entre deux espèces vient de la physique du saut
  (`ecartMin`, à la vitesse LOCALE). Espèces tirées de paquets de **12** mélangés par la graine.
- La **famille de saut** d'une espèce (tap / appui / double) est CALCULÉE (`familleDe`) au pire
  cas, la vitesse MINIMALE ; tout ce qui roule est au double saut. Collisions par boîtes
  (`KINDS`), la taille d'un humain compte.
- ⚠️ **Le sol n'est pas toujours 0** : tout se compare à `rows.solAt(v)` (halles, collines,
  toits de voitures et de véhicules montables).
- Moments de course : **halles** (marché avec étals et marchand, bowling, gare avec TER),
  **convoi de cars**, **montagne d'hiver** (une colline, route enneigée, chasse-neige, skieurs,
  bonhommes), **bouchon** de voitures garées, **plage** sur les 30 dernières secondes (coucher
  de soleil, baigneurs, buggys). Véhicules en face (voiture, car, tracteur, chasse-neige, buggy),
  piétons en groupes grandissants.
- **Chacun dans son décor** (`auDecor`, `aCheval`) : rien n'est habillé pour une autre rangée
  que la sienne, rien ne chevauche une frontière de biome.
- Une **ligue = une graine** (`graineLigue`) : même route pour ses membres ; sans ligue, graine
  au hasard. La courbe de difficulté est la même pour tous.
- Score parfait simulé (`simulation.js`) affiché au menu et à la fin. Joueur idéal scripté :
  0 choc ; joueur immobile : touche tout (`outils/mesurer.mjs`).

### Pièces, potes, turbo
- Les pièces **dessinent le geste** (arc au-dessus de chaque obstacle), pièce double au sommet
  d'un double saut. Paliers de potes, rachat et coût des chocs : `config.js`.
- Chaque pote = +`potesBonusMetres` au multiplicateur. Un choc coûte des potes ; seul le joueur
  meurt.
- **Brique de lait** : turbo 5 s, invincible, points doublés ; ce qu'on percute est éjecté.
  Plus grande qu'une pièce, avec un halo qui pulse au rythme du morceau.
- ⚠️ **Aucun conflit entre objets et récompenses** : aucune pièce ni brique de lait dans un
  obstacle, ni sur le passage d'un véhicule venu d'en face pendant qu'il est à l'écran
  (`balayageVisible`, rows.js). Gardé par le test `conflits` du filet.
- **Jetpack** une partie sur cinq, posé hors du générateur (une course à jetpack peut dépasser
  le score parfait).

### Le temps
- ⚠️ **Deux horloges** : `clock.now()` = le morceau (chrono, nuit, soleil, fin) ; `tMonde()` =
  le monde, qui prend du retard pendant le ralenti du tuto. Tout ce qui bouge sur la route lit
  `tMonde()`.
- Pause : le morceau ET le monde sont gelés (`pauseDeriveMax` = 0 : le morceau est le chrono).
- Ligne d'arrivée posée 8 s avant la fin du morceau ; nuit à partir de `nuitDebutS` ;
  4 saisons qui ne repeignent que le décor, départ en automne.

### Tuto et explication
- **Tuto contextuel au ralenti** : la première fois qu'une famille d'obstacle arrive, le monde
  ralentit, la consigne s'affiche, le temps repart sur le bon geste ; l'obstacle expliqué ne fait
  jamais mal et la route est dégagée autour (`rows.degagerTutos`).
- **Explication au lancement** en étapes (`EXPL_ETAPES`, screens.js) : 3 premières parties et
  toujours en ligue démo. Projecteur une fois par joueur sur la première brique de lait. Le
  panneau « attention » n'a PAS de tuto : il se comprend seul (retour de joueurs).

### Rendu (`scene.js`, `props.js`, `voxrider.js`, `humains.js`)
- Sténopé de profil, tout en cubes ; un modèle = un `scene.groupe()` trié (ARCHITECTURE §5 bis).
- Les humains (piétons, costard, fermier, baigneur, skieurs, marchands…) partagent le même corps
  en cubes que le cycliste, avec une diversité tirée par rangée (`humains.js`).
- ⚠️ **Le canvas penché** : un index de tableau dérivé d'une position n'est jamais supposé
  entier ; `parseColor` rend du gris plutôt que de lever ; `render()` repart d'une matrice propre
  et chaque objet est dessiné dans un `try/catch` qui remet la matrice.

### Son (`audio.js`, `bruitages.js`, `ambiance.js`, `sfx.js`)
- Bruitages **synthétisés** (aucun fichier, sauf la voix « pfff, aïe » et le marchand) :
  vélo selon la surface, cri de chaque obstacle percuté, bêtes qui crient en nous voyant,
  klaxon de chaque véhicule qui entre à l'écran, train, quilles, ambiances par décor.
- ⚠️ **Tout ce qui a une hauteur joue la pentatonique de sol** (sol la si ré mi) : le morceau
  est en mi mineur / sol majeur (`outils/gamme.py`).
- Niveaux calés en LUFS contre le morceau (`outils/bruitages.mjs`). Deux curseurs **Musique** et
  **Effets** (menu pause et bouton ♪), retenus d'une visite à l'autre.
- ⚠️ Vérifiés à la mesure et au spectrogramme, pas à l'oreille : c'est au téléphone qu'on
  tranche ce qui sonne faux.

### Menus, ligues, conversion (`screens.js`, `net.js`)
- Premier passage : pseudo → mon cycliste (homme/femme, VTT / Grand Bi / vélo enfant, maillot,
  chapeau) → ma ligue (créer, rejoindre, ou jouer sans). Ensuite le cycliste est l'accueil.
- **Ligues** : 21 membres maximum, complétées par 3 bots ; **boost de ligue** (+10 % par pote
  qui a joué au moins 30 s, jusqu'à ×3) ; relais de ligue ; sprint du dimanche ; au plus
  `liguesParVague` nouvelles ligues par semaine. Partage : natif d'abord, tiroir maison si
  absent (Instagram sur Android).
- ⚠️ **Tout ce qui est en ligne est INERTE** tant que la base Supabase v2 n'existe pas
  (`apiBase` vide) : ni ligue réelle, ni classement, ni boost, ni événements de funnel. Le jeu
  tourne alors avec la ligue de démo.
- **Couronne** : le premier de la ligue la porte à la place de son chapeau, dans la course de
  ses potes (et sur soi si c'est soi), et devant son nom sur l'écran de fin. Retenu par ligue
  (`jp2Leader`) ; en démo, avant toute course finie, c'est le premier pote fictif.
- **Écran de fin** : « Il te manque X pts pour passer devant @pseudo » (ou « La couronne est à
  toi »), sous le rang.
- **Fantôme** du meilleur de la ligue : en sommeil (la trace part avec le score ; le
  chargement `chargerFantome` est à rebrancher quand la base existera).
- **Porte de conversion** (`niveauPour`) : une demande à la fois — l'album d'abord, puis
  l'abonnement à PMC, puis libre. Mort → « Tombé ! » → CONTINUER / REJOUER passent par la même
  porte. ⚠️ Le titre « Ajoute l'album à ta bibliothèque pour continuer la partie » est le choix
  de l'artiste ; le premier jeu l'évitait (règle Spotify : pas de contrepartie contre un ajout).
  Risque connu, assumé.
- Ligue de test `TESTV2` (`config.ligueBeta`) : menu simplifié et bouton « Laisser un retour ».

### Vibrations (Android seulement : aucune API web ne fait vibrer un iPhone)
Choc 60 ms, chute, nouveau pote, brique de lait, salto, fin. Le test `collisions` vérifie que
chaque choc payé vibre.

### Liens et touches
- URL : `?9` (vide caches et service worker), `?premiere` (première visite), `?demo` (ligue de
  démo pleine), `?neuf` (paliers de conversion à zéro), `?zero` (tout effacer), `?jetpack`,
  `?ligue=CODE`, `?debug`.
- Avec `?debug` : I invincible, G mourir, F terminer, P/O pote ±1, L lait, N nuit, S saison,
  D affichage de debug.

## Points ouverts

- **Base Supabase v2** à créer par l'artiste (ARCHITECTURE §5), puis **sous-domaine** (§4).
- **À juger sur un vrai téléphone** : clavier iOS dans Instagram, partage dans les navigateurs
  intégrés, lien `instagram://` vers @pmc.mp3, les sons à l'oreille.
- **Mesurer le parcours des joueurs** (où ils décrochent : chargement, pseudo, 1re course,
  2e course, clic album) : voulu par l'artiste. Les événements sont codés ; il faut la base v2,
  puis une page de tableau de bord.
- **Défi à un ami** (lien avec un score à battre) : prévu, pas commencé.
- Idées de lots pour les champions de ligue (maillot jaune du leader, nom du champion dans le
  jeu, finale du dimanche, règle des 5 potes actifs, blocage des scores impossibles) : proposées
  le 5 octobre 2026, rien de commencé.

## Le filet et les outils

- **`npm run verif`** (≈ 3 min) : 12 tests du vrai jeu, chacun conclut par ✅ OK ou ❌ ÉCHEC
  (`outils/verdict.mjs`) ; un test qui échoue est relancé une fois et signalé « instable » s'il
  passe au second essai. `npm run verif -- collisions clavier` pour n'en lancer que certains.
  Ce qu'il garantit : joueur idéal sans choc et joueur immobile qui touche tout (`regles`),
  aucune récompense dans un obstacle ou un véhicule (`conflits`), chaque obstacle percuté
  coûte et vibre (`collisions`), un tap = un saut sur Android, tutos sur route
  dégagée, menu stable sur Android, clavier sur 6 téléphones, première visite façon Instagram,
  curseurs de son, course entière sans erreur avec les sons dans leur décor, < 8,3 ms par image
  à CPU ×4 (`perf` ; une machine très chargée peut le faire monter), build qui tourne.
- **Réorganiser du code sans changer l'image** : `node outils/rendu-identique.mjs --reference`
  AVANT, puis `node outils/rendu-identique.mjs` APRÈS — 13 images d'une même course (départ
  reproductible `__pote.videoAuDepart`) comparées au pixel près. Pas dans le filet : sa
  référence n'a de sens qu'autour d'une retouche qui ne doit rien changer à l'écran.
- Ajouter un test au filet : finir le script par `verdict(ok, résumé)` et l'inscrire dans
  `TESTS` (`outils/verif.mjs`).
- Autres outils : `outils/capture.mjs [scènes]` (captures, `SERVIR=dist` pour le build,
  `ECRAN=petit`), `mesurer.mjs [N]` (quotas, écarts, score parfait), `bruitages.mjs` (niveau et
  spectrogramme de chaque son), `sons-course.mjs [--reel]`, `gamme.py` (tonalité d'un morceau),
  `video.mjs` (vidéo 9:16), `voix-megaphone.sh` (mémo vocal → cri au mégaphone),
  `marchand.mjs`, `alertes.mjs`, `pieces-piegees.mjs`, `porte-echelle.mjs`, `familles.mjs`,
  `commentaires-seuls.mjs`.
- ⚠️ La preview de l'IDE ne peut pas jouer le jeu (l'`AudioContext` fige l'onglet) : passer par
  les outils, puis par un vrai téléphone.

## Méthode de travail

- **Mesurer avant de conclure.** Les bugs sérieux de ces jeux se trouvent en comptant.
- À chaque tour : implémenter → `npm run verif` → mettre à jour CLAUDE.md (état) et JOURNAL.md
  (récit daté) → `./deploy.sh` → vérifier le cache `sw.js` en ligne → dire ce qui est fait et ce
  qui reste, sans enjoliver.
- Tenir `ARCHITECTURE.md` à jour quand un invariant, un piège ou un point ouvert change.
