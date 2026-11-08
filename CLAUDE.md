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
  Le service worker range la page sous `./` quel que soit le lien : ne jamais remettre un repli
  `caches.match(req)` nu sur une navigation (hors réseau, `?ligue=…` ne trouvait rien → page
  blanche, « Returned response is null » sur Safari).
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
- **Son du saut** : un tout petit clic au toucher (sol5), un autre au second tap (ré6) ; RIEN en
  l'air (ni souffle ni roue libre — la roue libre ne joue qu'après l'arrivée).
- **Écraser une petite bête** (poule, poule jetée, chat, chien, cochon, mouton) : lui retomber
  dessus PAR LE DESSUS (on descend et on était au-dessus d'elle au pas d'avant) = rebond, aucun
  coût, la bête s'aplatit (`parDessus`/`ecraser`, main.js). De face, elle fait toujours mal.
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
- **Mouettes** (dès ~70 s, les 100 dernières secondes) : elles VOLENT vers le joueur (type « contresens », panneau
  attention) au-dessus de la tête, à DEUX hauteurs (`envolMouette` : bas à 2,4 ou 2,9) (famille « sol » : on passe DESSOUS en roulant, le
  moindre saut s'y cogne), pièces au sol de part et d'autre. Projecteur à la première
  (« Attention, les mouettes ! »). Posées entre deux obstacles sans double saut (⚠️ jamais à
  côté d'un véhicule à double saut) et dans les groupes de piétons, 4 fois sur 5 : 4 à 10 par
  course. ⚠️ Écart AVANT compté sur la retombée d'un saut TENU (au moins) + 0,4 s, APRÈS
  + 0,4 s : avec la retombée d'un simple tap et 0,3 s, un joueur qui tenait son saut retombait
  dans la mouette (vécu par l'artiste ; le « joueur maladroit » de `mesurer.mjs` en touchait
  107 sur 20 graines, 0 maintenant — vérifié par le test `regles`).
- ⚠️ **Toutes les pièces sont prenables** : aucune pièce AU SOL entre le décollage et
  l'atterrissage d'un obstacle (rows.js, étape 4 ter). Mesuré par `outils/pieces-timing.mjs` :
  le joueur parfait n'en prenait que 95,9 % ; 100 % maintenant (le bouchon se prend par un
  PETIT saut sur la première voiture, puis on roule sur les toits — le score parfait,
  `simulation.js`, suit ce chemin). Une erreur de timing de ±0,1 s garde 99 % des pièces.
- **Bouchon** (3 voitures garées, on roule sur les toits) DEUX fois : vers 85 s et 15 s avant
  la fin, les trois voitures sur une route libre et plate.
- ⚠️ **Quitter un obstacle n'est pas un choc** (checkMember) : rouler hors du toit de la
  dernière voiture du bouchon touchait sa carrosserie par le balayage du pas.
- **Chacun dans son décor** (`auDecor`, `aCheval`) : rien n'est habillé pour une autre rangée
  que la sienne, rien ne chevauche une frontière de biome.
- Une **ligue = une graine** (`graineLigue`) : même route pour ses membres ; sans ligue, graine
  au hasard. La courbe de difficulté est la même pour tous.
- Score parfait simulé (`simulation.js`) affiché au menu et à la fin. Joueur idéal scripté :
  0 choc ; joueur immobile : touche tout (`outils/mesurer.mjs`).

### Pièces, potes, turbo
- Les pièces **dessinent le geste** (arc au-dessus de chaque obstacle), pièce double au sommet
  d'un double saut. Paliers de potes, rachat et coût des chocs : `config.js`.
- **Difficulté qui monte** : vitesse max 3,2 puis finale 8,4 (≈ 22 rangées/s sur la plage, contre
  4,4 au départ : on lit moins longtemps ce qui arrive — ~0,5 s de visibilité devant soi à
  la fin, `cameraJoueurX` finit à 0,2). ⚠️ Plus vite = scores plus hauts : le score parfait
  maximal est de 23 050 (×3 avec le boost de ligue), le plafond anti-triche de la base est à
  95 000 (`outils/plafond.mjs`, `supabase/CORRECTIF-PLAFOND.sql`), le paquet « finale » (presque tout roule) dès le 4e paquet, un choc coûte +1 pote
  dès 30 % de la course et +2 dès 65 % (`chocPlusDeuxApres`), racheter un pote coûte 12 puis
  jusqu'à 35 pièces. Mesuré par `outils/difficulte.mjs` (joueur qui rate 5/10/15/20 % des
  obstacles, vraie économie) : à 5 % de ratés il meurt dans 23 % des courses (7 % avant), à
  10 % dans 63 % (40 % avant). ⚠️ Mourir = un choc SANS pote : tant que le rachat est bon
  marché, un bon joueur est immortel — c'est l'économie qu'il faut regarder d'abord.
- **Multiplicateur ENTIER** (`regles.multiplicateur`) : 3 potes = ×3, 5 potes = ×5, ×1 en
  dessous de deux ; ×2 en plus au turbo. Jamais de demi-multiplication à l'écran (le boost de
  ligue, lui, reste en pourcentage). Un choc coûte des potes ; seul le joueur meurt.
- **Brique de lait** : turbo 5 s, invincible, points doublés ; ce qu'on percute est éjecté.
  Plus grande qu'une pièce, avec un halo qui pulse au rythme du morceau.
- ⚠️ **Aucun conflit entre objets et récompenses** : aucune pièce ni brique de lait dans un
  obstacle, ni sur le passage d'un véhicule venu d'en face pendant qu'il est à l'écran
  (`balayageVisible`, rows.js), et **aucune pièce à moins de 3 rangées d'une brique de lait**
  (`LAIT_ISOLE` : on cherche une place loin des arcs, sinon les pièces voisines s'effacent — le
  quota de 15 briques reste le même pour toutes les graines). Gardé par le test `conflits`.
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
- **Projecteur** (brique de lait, première mouette) : l'écran s'assombrit à 70 % avec un FONDU
  jusqu'à l'objet (dégradé radial, pas de cercle net), visé sur le centre réel de l'objet.
- **Explication au lancement** en étapes (`EXPL_ETAPES`, screens.js) : 3 premières parties et
  toujours en ligue démo. Projecteur une fois par joueur sur la première brique de lait. Le
  panneau « attention » n'a PAS de tuto : il se comprend seul (retour de joueurs).

### Rendu (`scene.js`, `props.js`, `voxrider.js`, `humains.js`)
- Sténopé de profil, tout en cubes ; un modèle = un `scene.groupe()` trié (ARCHITECTURE §5 bis).
- Les humains (piétons, costard, fermier, baigneur, skieurs, marchands…) partagent le même corps
  en cubes que le cycliste, avec une diversité tirée par rangée (`humains.js`). Les villageois
  du décor encouragent, les deux bras en l'air qui battent (`personnage`, scene.js).
  ⚠️ La personne se tire d'une GRAINE FIXE (sa place), jamais de sa position animée : tirée de
  `v` qui bouge, elle changeait de tête à chaque image (« régénérée toutes les demi-secondes »).
- **Aucun contour noir** autour des personnages (demandé) ; `groupe(ctx, fn, contour)` reste
  disponible mais n'est plus utilisé.
- **La neige s'annonce** : plaques de neige sur 45 rangées avant et après la montagne
  (`plaqueNeige`) ; enfants qui se lancent des boules de neige ; un skieur qui file au fond.
- **Détails** : un lampadaire sur cinq détraqué (il clignote et grésille la nuit,
  `eclatLampe`, son `gresille`) ; au marché, un marchand sur trois lance une tomate ou une
  courgette par-dessus son étal ; sur le versant de la colline enneigée, la grotte d'un yéti
  qui se chauffe au feu (`caverneYeti`, placée par l'écran : au tiers haut du blanc visible).
- **Bowling** : un joueur de dos au départ de chaque piste (il lance quand la boule part),
  vraies boules sombres à trois trous.
- **Traînée du salto** : un trait blanc qui suit la tête pendant le tour (plus de copies
  transparentes du cycliste, illisibles avec le peloton).
- **Phare avant** sur le VTT et le Grand Bi (`phareAvant`, voxrider.js) : verre crème le jour,
  allumé et rayonnant la nuit (`setNuit`, posé par main.js).
- ⚠️ **Dans un modèle, jamais deux cubes imbriqués** : `scene.groupe` ne sait pas les ordonner
  (le chasse-neige perdait ses vitres, le rebord de la benne se peignait dessus). Empiler.
- Le TER a un **nez** à trois marches avec pare-brise à chaque bout (`drawHalle`, couche train),
  en cubes empilés dans un groupe trié, peint avant ou après la caisse selon le côté de l'écran
  (sinon il n'était juste que pile dans l'axe de la caméra).
- ⚠️ **Le canvas penché** : un index de tableau dérivé d'une position n'est jamais supposé
  entier ; `parseColor` rend du gris plutôt que de lever ; `render()` repart d'une matrice propre
  et chaque objet est dessiné dans un `try/catch` qui remet la matrice.

### Son (`audio.js`, `bruitages.js`, `ambiance.js`, `sfx.js`)
- Bruitages **synthétisés** (aucun fichier, sauf la voix « pfff, aïe » et le marchand) :
  vélo selon la surface, cri de chaque obstacle percuté, bêtes qui crient en nous voyant,
  klaxon de chaque véhicule qui entre à l'écran, train, quilles, ambiances par décor.
- ⚠️ **Tout ce qui a une hauteur joue la pentatonique de sol** (sol la si ré mi) : le morceau
  est en mi mineur / sol majeur (`outils/gamme.py`).
- **Musique du menu** : la boucle du début du morceau tourne pendant tout le menu, du premier
  toucher (iOS exige un geste) jusqu'au départ (`lancerBoucleMenu`/`arreterBoucleMenu`, audio.js).
- Niveaux calés en LUFS contre le morceau (`outils/bruitages.mjs`). Deux curseurs **Musique** et
  **Effets** (menu pause et bouton ♪), retenus d'une visite à l'autre.
- ⚠️ Vérifiés à la mesure et au spectrogramme, pas à l'oreille : c'est au téléphone qu'on
  tranche ce qui sonne faux.

### Menus, ligues, conversion (`screens.js`, `net.js`)
- Premier passage : pseudo + **Insta OBLIGATOIRE** (c'est par là qu'on prévient la ligue
  gagnante), email et village facultatifs, case newsletter séparée, lien vers le règlement →
  mon cycliste (homme/femme, VTT / Grand Bi / vélo enfant, maillot, chapeau) → ma ligue (créer
  avec un nom libre, rejoindre, ou jouer sans). Ensuite le cycliste est l'accueil. Un habitué
  sans Insta repasse UNE fois par l'étape 1.
- **Fiche de contact** (`net.enregistrerJoueur`, table `joueurs`) : elle ne part que quand elle
  CHANGE, et seulement si elle porte de quoi joindre quelqu'un. ⚠️ Table en insertion seule,
  AUCUNE règle de lecture : les contacts sont illisibles avec la clé publique, ils se lisent
  dans le Table editor (vue `contacts`).
- **Ligues** : 21 membres maximum, complétées par 3 bots ; **boost de ligue** (+10 % par pote
  qui a joué au moins 30 s, jusqu'à ×3) ; relais de ligue ; sprint du dimanche ; `liguesParVague` (0 = aucune
  limite de création, indispensable pendant le concours). Partage : natif d'abord, tiroir maison si
  absent (Instagram sur Android).
- **LE CONCOURS** (`supabase/CONCOURS-A-COLLER.sql` puis `supabase/CLASSEMENT-GENERAL-A-COLLER.sql`).
  ⚠️ **Règle changée le 8 novembre 2026** : *score au général = ton record + 10 % du record de
  chaque pote de ta ligue* ; à la clôture, **tirage au sort entre les 3 premiers du général**, le
  gagnant fait un morceau avec PMC et ses potes. Clôture le **dimanche 22 novembre 2026 à 12 h**.
  - **Boost et commission sont deux mécaniques séparées** : le boost (+10 % par pote, ×3 max)
    multiplie les points pendant la course ; la commission s'ajoute dans le classement, sur les
    records et jamais sur les totaux. Taux : `concours.commission` (la base calcule),
    `config.commissionParPote` n'est que le repli d'affichage.
  - **Les joueurs sans ligue sont au général**, sans commission : leur score part sous le code
    `PMCMP`, inclus dans `concours_joueurs` et exclu de `concours_ligues`.
  - Un appareil ne rapporte qu'une commission par ligue (`par_appareil`). Le classement des
    ligues reste affiché pour l'honneur, sans lot. `concours_podium` (top 10 et contacts) n'est
    lisible que dans le SQL editor. Test : `outils/classement-general.mjs`, base simulée.
  - Tout est additionné par la BASE (vues `concours_ligues` et `concours_joueurs`) : le jeu ne
    voit que son propre score, il ne pourrait rien totaliser. Il lit, il n'écrit pas.
  - ⚠️ Un joueur ne compte que pour **UNE** ligue, celle où il a fait son meilleur score
    (`distinct on` dans la vue) : sans ça, cinq potes qui rejoignent les cinq ligues les uns
    des autres feraient monter les cinq d'un coup.
  - ⚠️ La **date qui fait foi** est celle de la table `concours`, lue au chargement ;
    `config.concoursFin` n'est que le repli hors réseau. Les deux doivent coïncider.
  - Les ligues de test sortent du classement par la colonne `ligues.concours`, jamais par le
    jeu. La ligue de démo reste en base : c'est le peloton de ceux qui jouent sans ligue.
  - **Anti-triche** : plafond de vraisemblance et cadence vérifiés par un trigger Postgres
    (`score_vraisemblable`) ; identifiant d'appareil à côté de chaque score, vue
    `ligues_suspectes` (vingt pseudos, un appareil). Détection, pas prévention — c'est l'artiste
    qui remet le lot. Plafond mesuré par `outils/plafond.mjs`, à relever d'un `update` si le
    score parfait grimpe. ⚠️ Un plafond trop bas refuserait une vraie partie EN SILENCE.
  - Écran de fin : **« Ta ligue a besoin de toi »** (rang de la ligue sur toutes les ligues,
    points qui manquent pour passer celle du dessus, temps restant) au-dessus du classement
    interne. Tiroir `#classement-sheet` : les ligues, et le top 50 individuel (la « super
    ligue », classement bonus dont on ne parle pas en vidéo).
  - **Messages d'invitation** (`config.messagesInvitation`) : quatre formulations sur le ton du
    morceau, celle qui s'ouvre vient de la variante A/B, le joueur peut en choisir une autre, et
    c'est le message RÉELLEMENT envoyé qui est mesuré (`details.message`).
  - **« @x a rejoint ta ligue »** sous le peloton : mémorisé par ligue (`jp2LigueVus`), et la
    première fois qu'on regarde une ligue on ne crie pas que tout le monde vient d'arriver.
  - **Règlement** : `public/reglement.html`, lié depuis l'inscription et le classement.
    ⚠️ Il reste des `[À COMPLÉTER]` surlignés : identité de l'organisateur, SIRET, adresse,
    email de contact.
- **A/B TEST** (`config.abTests`, `net.variante`) : la variante d'un joueur est **tirée de son
  identifiant anonyme**, pas au hasard à chaque fois — sinon il verrait une version différente à
  chaque visite et la mesure ne voudrait rien dire. Elle part dans `details.ab` de chaque
  événement. Deux tests : `ecoute` (panneau de trois plateformes vs Spotify seul) et
  `invitation` (message par défaut). Vues `ab_ecoute` et `ab_invitation`. Une seule valeur dans
  la liste = test éteint.
- **Les boutons d'écoute pointent vers le TITRE** (`config.plateformesTitre` : Spotify, Deezer,
  Apple Music), l'album en repli si la liste est vide. ⚠️ URL nettoyées à la main : pas de
  `/intl-fr/` (il force la page web au lieu de l'app), pas de `?si=`, jamais le schéma
  `spotify:`.
- **Base Supabase v2 BRANCHÉE depuis le 11 octobre 2026** (projet `khlxublwgcqihuezzsam`,
  clé publishable dans `config.js`) : `schema-v2.sql` + `tableau-de-bord.sql` exécutés (fusionnés
  dans `supabase/A-COLLER-DANS-SUPABASE.sql`), 6 ligues / 29 membres recopiés de la v1.
  ⚠️ `net.js` ne contacte JAMAIS la base depuis un serveur local (localhost, 127., 10., 192.168.,
  .local) ni un navigateur piloté (`navigator.webdriver` : les tests de `npm run verif`) —
  sinon ils rempliraient le tableau de bord de fausses courses. `?base` dans l'adresse force.
- **Couronne** : le premier de la ligue la porte à la place de son chapeau, dans la course de
  ses potes (et sur soi si c'est soi), et devant son nom sur l'écran de fin. Retenu par ligue
  (`jp2Leader`) ; en démo, avant toute course finie, c'est le premier pote fictif.
- **HUD** : les points au centre de l'ÉCRAN (ils rapetissent plutôt que de toucher les blocs).
- **Écran de fin** : « Il te manque X pts pour passer devant @pseudo » (ou « La couronne est à
  toi »), sous le rang.
- **Suivi** (`net.evenement`) : chaque événement porte `details.visite` (un chargement de
  page) et `details.joueur` (identifiant anonyme, `jp2Joueur`), part en `keepalive`, et reste
  dans `window.__evenements` (tests, base absente). Événements : arrivee, chargement_fini,
  menu_etape, inscription, course_debut, premiere_course, pause, mort, mort_choix,
  course_finie, porte_vue, clic_album, clic_suivre, ecouter_album, continuer, rejouer,
  fin_vue, partage_ouvert, invitation_envoyee (avec `depuis`), invitation_ouverte,
  invitation_acceptee, cachee/revenue (avec `ou` : chargement, menu-…, explication, course,
  pause, mort, fin), retour_beta.
- **Banc d'essai du partage en story** : `public/story-test.html` (en ligne, PAS encore dans le
  jeu). Image 1080×1920 dessinée sur une vraie capture (`assets/story-fond.webp`, refaite par
  `DPR=3 ECRAN=i16 node outils/capture.mjs story`), lien de ligue copié dans le même geste que
  le partage de l'image. ⚠️ Une page web ne peut pas poser le sticker lien (schéma
  `instagram-stories://` réservé aux applis natives) : le joueur colle lui-même. Le centre de
  l'image (y ≈ 960, là où Instagram pose un sticker) reste libre.
- **Tableau de bord** : `public/tableau-de-bord.html` (en ligne à côté du jeu), lit les vues
  AGRÉGÉES de `supabase/tableau-de-bord.sql` (jamais un pseudo) ; `?exemple` = chiffres
  inventés, signalés.
- **Ambiance du marché** (`ambiance.js › marche`, couche `foule` + `cagette` + `pieces`, calées à
  −27 / −26 / −28 LUFS par `outils/bruitages.mjs`) : le brouhaha monte à l'approche, est plein
  dans les étals, retombe en sortant ; le vocal du marchand (`marchandVolume` 0,5) vient par-dessus.
- **Cercle sur le danger** (`hud.renderCible`, `main.cibleConseil`) : pendant une consigne de
  geste (tap / appui / double), le reste de l'écran s'assombrit en fondu et un anneau se pose sur
  ce qu'il faut franchir. Distinct du projecteur (qui gèle le monde, une fois par joueur).
- **Rappel de ligue à CHAQUE départ** : « Plus tu as de potes dans ta ligue, plus tu as de chances
  de faire un meilleur score » sur l'écran de chargement et pendant le décompte 3-2-1 (premier
  lancement comme REJOUER).
- **Contraste** : pièces cerclées de blanc PUIS de sombre, sol du blé / sable / Sud plus sourds,
  classe CSS `plage` (saturation 0,98, contraste 1,1) sur le canvas pendant la plage. Un
  premier plan tout en jaune clair noyait les pièces, les véhicules et les mouettes.
- **Hélicoptère de plage** (`scene.helicoptere`) : silhouette en rectangles, traverse le ciel de
  droite à gauche 15 s toutes les 24 s, hors de portée.
- **Grotte du yéti** : défile à la vitesse de la route (x pris dans le plan de la route, y sur le
  versant), un quart plus grande. **Panneau « attention »** 20 % plus petit, et posé à hauteur
  de chaussée AU NIVEAU DE LA MER (plus à `solAt`, où il suivait la rampe du marché).
- **Fantôme** du meilleur de la ligue : en sommeil (la trace part avec le score ; le
  chargement `chargerFantome` est à rebrancher quand la base existera).
- **Porte de conversion** (`niveauPour`) : une demande à la fois — l'album d'abord, puis
  l'abonnement à PMC, puis libre. Mort → « Tombé ! » → CONTINUER / REJOUER passent par la même
  porte. ⚠️ Le titre « Ajoute l'album à ta bibliothèque pour continuer la partie » est le choix
  de l'artiste ; le premier jeu l'évitait (règle Spotify : pas de contrepartie contre un ajout).
  Risque connu, assumé.
- Ligue de test : **éteinte** (`config.ligueBeta: ""`). Remettre un code (et le créer en base)
  rebranche le menu simplifié et le bouton « Laisser un retour » — jamais pendant le concours.

### Vibrations (Android seulement : aucune API web ne fait vibrer un iPhone)
Choc 60 ms, chute, nouveau pote, brique de lait, salto, fin. Le test `collisions` vérifie que
chaque choc payé vibre.

### Liens et touches
- Pages : le jeu (`index.html`), le règlement (`reglement.html`), le tableau de bord
  (`tableau-de-bord.html`), le banc d'essai story (`story-test.html`).
- URL : `?9` (retire le service worker PUIS vide les caches — dans cet ordre, voir `index.html`), `?premiere` (première visite), `?demo` (ligue de
  démo pleine), `?neuf` (paliers de conversion à zéro), `?zero` (tout effacer), `?jetpack`,
  `?ligue=CODE`, `?debug`.
- Avec `?debug` : I invincible, G mourir, F terminer, P/O pote ±1, L lait, N nuit, S saison,
  D affichage de debug.

## Interface et effets (9 novembre 2026)

- **Turbo du lait** : les obstacles RESTENT sur la route et explosent (`exploser`, `souffleTurbo`,
  main.js) ; seule la sortie du turbo est dégagée (`fenetreApresTurbo`, regles.js, partagée avec la
  simulation), avec 0,5 s de grâce. Pas de panneau d'alerte ni de tuto pendant le turbo.
- **Ciel** : aucun astre ne s'efface. Le soleil se couche, la lune monte, et à la plage la lune
  redescend pendant que le soleil monte de l'horizon. Montagnes qui s'enfoncent, mer qui monte
  (`PLAGE_TRANSITION_S`, 8 s). L'hélicoptère entre et sort par les bords.
- **Vibrations** (`src/vibration.js`, coupables dans le panneau ♪) : Android par
  `navigator.vibrate` ; iPhone par l'interrupteur natif, sans garantie selon la version d'iOS.
- **Typographie** (`src/typo.js`) : insécables françaises sur tous les textes, même écrits après
  coup. **Accessibilité** (`src/a11y.js`) : focus, Tab et Échap dans les tiroirs, `annoncer()` pour
  le lecteur d'écran, « réduire les animations » respecté. Tests : `outils/accessibilite.mjs`
  (axe-core), `outils/lignes.mjs` (aucun mot seul en fin de texte), `outils/turbo.mjs`.

## Points ouverts

- **Sous-domaine** (§4).
- **Le règlement attend ses mentions** : identité de l'organisateur, SIRET, adresse, email de
  contact (`public/reglement.html`, surlignés en jaune). Sans elles, le concours tourne mais le
  règlement n'est pas opposable.
- **Le lien Deezer est un lien court** (`link.deezer.com/s/…`) : une redirection de plus avant
  l'app, à remplacer par le `deezer.com/track/…`. TIDAL et YouTube Music n'ont pas de lien du
  titre : ils ne sont plus proposés.
- **À juger sur un vrai téléphone** : clavier iOS dans Instagram, partage dans les navigateurs
  intégrés, lien `instagram://` vers @pmc.mp3, les sons à l'oreille.
- **Défi à un ami** (lien avec un score à battre) : prévu, pas commencé.
- Idées de lots pour les champions de ligue (maillot jaune du leader, nom du champion dans le
  jeu, finale du dimanche, règle des 5 potes actifs, blocage des scores impossibles) : proposées
  le 5 octobre 2026, rien de commencé.

## Le filet et les outils

- **`npm run verif`** (≈ 3 min) : 14 tests du vrai jeu, chacun conclut par ✅ OK ou ❌ ÉCHEC
  (`outils/verdict.mjs`) ; un test qui échoue est relancé une fois et signalé « instable » s'il
  passe au second essai. `npm run verif -- collisions clavier` pour n'en lancer que certains.
  Ce qu'il garantit : joueur idéal sans choc et joueur immobile qui touche tout (`regles`),
  aucune récompense dans un obstacle ou un véhicule (`conflits`), chaque obstacle percuté
  coûte et vibre (`collisions`), petite bête écrasée par le dessus sans coût (`ecraser`), un tap = un saut sur Android, tutos sur route
  dégagée, menu stable sur Android, clavier sur 6 téléphones, première visite façon Instagram,
  curseurs de son, course entière sans erreur avec les sons dans leur décor, < 8,3 ms par image
  à CPU ×4 (`perf` ; une machine très chargée peut le faire monter), page servie sans réseau quel
  que soit le lien et `?9` qui recharge proprement (`hors-ligne`), build qui tourne.
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
  `commentaires-seuls.mjs`, `plafond.mjs` (plafond de vraisemblance du concours).
- ⚠️ La preview de l'IDE ne peut pas jouer le jeu (l'`AudioContext` fige l'onglet) : passer par
  les outils, puis par un vrai téléphone.

## Méthode de travail

- **Mesurer avant de conclure.** Les bugs sérieux de ces jeux se trouvent en comptant.
- À chaque tour : implémenter → `npm run verif` → mettre à jour CLAUDE.md (état) et JOURNAL.md
  (récit daté) → `./deploy.sh` → vérifier le cache `sw.js` en ligne → dire ce qui est fait et ce
  qui reste, sans enjoliver.
- Tenir `ARCHITECTURE.md` à jour quand un invariant, un piège ou un point ouvert change.
