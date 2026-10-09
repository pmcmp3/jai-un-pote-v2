# JOURNAL — « J'ai un pote v2 »

L'historique des décisions, dans l'ordre où elles ont été prises, avec les mots de l'artiste.
**L'état actuel du jeu est dans `CLAUDE.md`** ; ce journal ne sert qu'à savoir *pourquoi*
une décision a été prise. Les valeurs citées ici sont celles du moment : `public/config.js` et le
code font foi. Ce qui suit a été déplacé tel quel de l'ancien `CLAUDE.md` le 9 octobre 2026.
Pour ajouter une entrée : une section datée en bas, et mettre à jour `CLAUDE.md` en remplaçant la
ligne concernée (jamais en y empilant un compte rendu).

## Décisions du 19 septembre 2026 (plan accepté tel quel : « exécute le plan »)

- **D1** Projet autonome frère du dépôt du premier jeu, son propre dépôt GitHub.
- **D2** Adresse : `pote.la-ville-est-belle-pmc.fr` (CNAME à poser chez OVH par l'artiste,
  puis `outils/brancher-domaine.sh`). En attendant : l'adresse github.io.
- **D3** Nouveau projet Supabase ; ligues et membres copiés, **pas les scores**.
- **D4** **Portrait conservé** : caméra de profil, joueur à gauche (30 % → 25 % avec la vitesse),
  alerte « ! » au bord droit pour ce qui arrive hors champ.
- **D5** Gestes : **tap = saut, appui maintenu = saut plus haut, re-tap en l'air = double saut**
  (revu le 20 septembre 2026), swipe bas = roue arrière, swipe latéral ignoré.
- **D6** **Pièces sur deux hauteurs** : au sol, ou en l'air de part et d'autre d'un obstacle
  (elles dessinent le geste à faire).
- **D7** Traversants (tracteur ; la poule lancée du fond est devenue la poule JETÉE de face le 27 septembre 2026) : ils arrivent **du fond** et coupent la route ;
  armement sur le passage du joueur inchangé.

## Retours téléphone du 20 septembre 2026 (première vraie partie)

Mis en place : saut à trois étages (tap, appui maintenu, double saut ; plus de barre d'élan),
obstacles et animaux plus gros, voitures énormes, écarts calculés sur la physique du saut
(jamais de paquet d'obstacles, jamais de ligne droite vide), pièces sur DEUX hauteurs seulement
et trois fois moins nombreuses, pièce rouge devenue pièce dorée qui brille, brique de lait qui
tourne, potes rachetables après le dernier palier, bestiaire « qui tu vas croiser » au départ,
menu réduit à trois réglages + roller, chargement 5 s → 1,8 s, HUD sans bandeau ni barre,
« terminé ! » plus petit, soleil qui traverse le ciel, couleurs saturées en permanence, panneaux
sans département et jamais deux à la fois, jambes du cycliste rattachées, roue arrière au swipe
vers le bas, carte de mort qui met CONTINUER en avant.

## Retours téléphone du 20 septembre 2026, SOIR (deuxième passe)

Sept renversements, tous demandés :

1. **Boîtes de collision réelles.** Un obstacle n'est plus jugé au passage du centre du vélo
   contre un seuil FIXE par famille de saut, mais par recouvrement des boîtes (`rows.KINDS`,
   `VELO_DEMI`, `MARGE_H`) : « je me suis pris un mouton mais je me le suis pas pris », « j'ai
   sauté par-dessus le paysan et je me le suis pris ». Le seuil d'une espèce, c'est sa hauteur.
2. **La famille de saut est CALCULÉE** (`familleDe`, rows.js) : on intègre les trois arcs et on
   retient le plus petit qui reste au-dessus de l'obstacle pendant tout le franchissement.
   ⚠️ Le pire cas est la vitesse MINIMALE (un obstacle est long en RANGÉES : plus on roule
   lentement, plus on reste longtemps dessus). Règle de lisibilité par-dessus : **tout ce qui
   roule est au double saut** (`plancher`). Résultat : petits animaux = tap, gros animaux et
   fermier = appui tenu, véhicules = double saut — exactement les trois familles du bestiaire.
3. **Les pièces dessinent le geste** : plus de tirage, on pose l'ARC du saut au-dessus de chaque
   obstacle, une pièce toutes les `ESPACEMENT` (= 2) rangées, à hauteur du buste ; traînées au
   sol sur les lignes droites. **Une seule taille** (`PIECE_R`), la grosse dorée exactement ×1,6.
4. **Les HALLES** (`solAt`, `HALLE_*`, `scene.drawHalle`) : toutes les ~40 s une rampe monte à
   4,2 u, un plancher file en l'air couvert de pièces, une rampe redescend. ⚠️ **Le sol du jeu
   n'est plus toujours 0** — joueur, potes et simulation comparent tout à `rows.solAt(v)`.
5. **Voiture en sens inverse** (`contresens`) : elle roule sur la route vers le joueur, armée
   comme une traversée. Sa fenêtre de franchissement compte les DEUX vitesses.
6. **Tout est à l'échelle, 1 unité ≈ 1 mètre** : villageois 1,75 u (0,78 avant), étage de maison
   2,9 (1,0), voiture 3,9 × 1,55, poteau électrique 8, lampadaire 6,5, arbres 5 à 9. C'était ça,
   « les perspectives ça va pas du tout » et « les vaches sont plus grosses que les voitures ».
7. **Rendu et DA** : brique de lait en VRAIE rotation 3D (`scene.drawBoxR` — réduire la largeur
   au cosinus ne pouvait pas marcher), mouton qui fait un 360, bête percutée qui bascule
   (`drawStaticTombe`), panneau « ! » qui ne déborde plus de l'écran, HUD sans contour noir
   (texte blanc + ombre 25 %), bandeaux et bestiaire en carte blanche à bord noir avec onglet
   rouge de travers, bestiaire en 10 s une famille à la fois, « +40 PTS » en doré. Boue supprimée.

## Troisième passe du 20 septembre 2026 (nuit)

⚠️ **BUG DU CANVAS PENCHÉ, et pourquoi il faut s'en souvenir.** Tout le jeu s'affichait de
travers, définitivement, après quelques secondes. Cause : `drawStaticTombe` redessine la bête
percutée à une rangée **décimale** (elle recule en basculant), et le chat, le chien et la
voiture choisissaient leur couleur par `tableau[Math.abs(r) % 3]`. Index fractionnaire →
`undefined` → `parseColor` lève → l'exception tombe au milieu du `ctx.save()` + `ctx.rotate()`
de la bascule → la rotation n'est jamais rendue → **toutes les images suivantes sont peintes
par-dessus**. Trois corrections, à garder :
1. les couleurs se choisissent sur un index ENTIER (`Math.abs(Math.round(r))`) ;
2. `parseColor` rend du gris plutôt que de lever ;
3. `render()` **repart d'une matrice propre à chaque image** et chaque objet est dessiné dans
   un `try/catch` qui remet la matrice — un objet qui plante ne peut plus salir le reste.
⚠️ Ne jamais supposer qu'un index de tableau dérivé d'une position est entier.

Le reste de la passe : **saut plus sec** (pesanteur 25 → 60, apex 2,50 / 4,44 / 5,97, 0,58 s
en l'air pour un tap contre 0,75 — « on flotte, on a l'impression d'être sur la lune »), toutes
les tailles **recalées ensemble** pour que les trois familles gardent au moins 45 ms de marge
au pire cas (vitesse minimale), **voiture MONTABLE** (2,8 u, couleur unique crème, on peut se
poser sur son toit — `rows.toitSous`), **grosse pièce dorée retirée**, mouton qui ne tourne
plus, chats plus gros et plus contrastés, **rampe lisse** au lieu d'un escalier, **toit de
halle opaque** (`drawBox` peint désormais la sous-face d'une boîte entièrement au-dessus de la
caméra), cycliste **incliné dans la pente**, plus de voile blanc au turbo, et **deux bourgs
régionaux** : brique et ardoise au Nord (3e tranche), ocre et tuile romaine au Sud (7e).

⏳ **Pas fait** : le système de ligue / points (remis à plus tard par l'artiste).

🗄️ **Ligue de test** : `supabase/ligue-test-v2.sql` + `supabase/MODE-D-EMPLOI-LIGUE-TEST.md`.
Code `TESTV2`, qui est aussi `config.ligueBeta` (menu simplifié + bouton « Laisser un retour »).

## Retours téléphone du 27 septembre 2026 (partie sur iPhone, captures à l'appui)

- **Menu** : l'aperçu du cycliste était ÉCRASÉ par le CSS (canvas 220×200 affiché en 200×120) —
  désormais 240×140 des deux côtés. Libellés Maillot / Chapeau / Engin AU-DESSUS de leurs
  pastilles, plus d'air entre eux. Vrai **cadre de VTT** tracé en tubes (couleur du maillot).
- **Décompte 3-2-1** : ombre portée franche + contour ; le bestiaire n'apparaît qu'APRÈS le
  « GO ! » (les chiffres se peignaient sur sa carte).
- **Tuto : le score ne bouge pas** (ni distance ni pièces).
- **Poule jetée** (`poulejetee`, remplace `poulelancee`) : le fermier attend sur le bas-côté
  du fond, FACE au joueur, `lanceur` rangées après la rangée de croisement, et jette la poule
  qui court vers lui. Mécanique « contresens ». Plus aucun lanceur au fond du décor.
- **Voiture en face** : 3,4 → 2,0 rangées/s, armée 5,5 s avant (alerte « ! » tant que la
  VOITURE est hors écran), et **montable** comme la voiture garée (`toitSous(…, t)`).
- **Pente** : le vélo piquait du nez à la montée (signe inversé) — corrigé, le cycliste part
  en arrière en montant.
- **Halles en deux couches** (`drawHalle(..., "fond" | "devant")`), toit remonté à
  `HALLE_TOIT_AU_DESSUS` = 5,4 u (un double saut ne le traverse plus), enseigne
  « HALLES DU MARCHÉ » suspendue à l'entrée (le bandeau « LES HALLES ! » est supprimé).
  Plus de lampadaire, poteau ni panneau de village sur ou près d'une halle.
- **Lampadaires** effacés à ±3 rangées d'un panneau (`scene.setMasqueDecor`).
- **Modèles triés** : `scene.groupe()` peint les cubes d'un modèle dans l'ordre de la vraie
  géométrie (phares vus à travers la carrosserie, tracteur incohérent). Voitures garées du
  village = le même modèle que la route (`scene.setDessinVoiture`).
- **Boîtes de collision** re-mesurées sur les dessins (`node outils/capture.mjs hitbox`) :
  cochon, vache, chien, mouton, chat abaissés. Choc pendant le turbo lait : la bête est
  renversée avec des étincelles (on croyait à un bug : « j'ai roulé sur une poule »).
- **Nuit** : `nuitDebutS` 95 → 50. **Fin** : sticker rouge « TERMINÉ ! » + une ligne, plus de
  voile blanc. **Bouton « Menu »** sur l'écran de fin (changer de ligue, de cycliste) ; JOUER
  depuis ce menu passe par la même porte que REJOUER.
- `VERSION_COURSE` 7, cache `jp2-v5`.

## Retours du 28 septembre 2026 (« cohérence dans les menus », « le tuto sans difficulté », « repasse des éléments 3D »)

- **Menus** : UNE grammaire partout — carte blanche, bord noir, sticker rouge de travers.
  Ajoutée là où elle manquait : carte de mort (« Tombé ! »), tiroir album (« L'album est
  sorti » / « Dernière étape »), carte du TUTO (qui était la dernière sombre et
  translucide, désormais identique au bestiaire, onglet jaune « BIEN ! »). Icône de volume
  en SVG (plus d'emoji).
- **Tuto sans difficulté** : rien ne fait mal pendant le tuto, aucune traversée n'est armée,
  et la route reste sûre pendant tout le bestiaire qui le suit + 3 s.
- **3D** : voiture refaite (habitacle vitré à montants, toit plat clair, pare-chocs gris fins ;
  plus de bandes noires ni de galerie), taches de la vache plaquées, maisons du Nord refaites
  (pignon à redents CENTRÉ face à la rue, ardoise derrière), maisons groupées/triées, pas
  d'ombre au sol quand on roule sur une halle ou un toit.
- **Galerie** : `node outils/capture.mjs galerie` dessine chaque modèle en grand, à gauche /
  au centre / à droite de la caméra, plus le décor des biomes (`outils/sorties/g*.png`).
  À relancer après toute retouche d'un modèle.
- ⚠️ **À trancher par l'artiste** : le titre du tiroir dit encore « Ajoute l'album à ta
  bibliothèque pour continuer la partie » — c'est précisément la formulation que le
  CLAUDE.md du premier jeu interdit (clause Spotify « compensation … or otherwise »).
  Non modifiée ici sans son accord.

## Retours du 28 septembre 2026, soir (captures iPhone)

- **Toit des voitures garées** : on ne s'y posait jamais — en retombant, les roues passaient
  sous le toit en UNE image, qui devenait un mur. `solSous` cherche désormais le toit avec
  `max(jumpY, prevJumpY)`. Vérifié : `capture.mjs toit` → 1,49 u stable.
- **Descente des halles** : le vélo décollait d'un cheveu à chaque image (inclinaison qui
  clignote). Collage au sol (`player.auSol`, idem potes) tant que la marche fait < 0,35 u.
  Vérifié : `capture.mjs descente` → 0 image en l'air. Les potes s'inclinent aussi.
- **Bandeaux** (turbo lait, nouveau pote, reprise) : l'onglet jaune était VIDE, et le bandeau
  se peignait derrière la carte du bestiaire. Onglet légendé (« BONUS », « NOUVEAU POTE »,
  « REPRISE »), bandeau peint après le bestiaire et sous sa carte.
- **Potes** : ils arrivent et repartent PAR LA ROUTE (ils passaient par le champ du fond,
  donc derrière les panneaux et les lampadaires).
- Vitres des voitures teintées (claires, on croyait voir à travers), ardoise des maisons du
  Nord qui ne traverse plus le pignon.

## Retours du 28 septembre 2026, nuit (« saisons avec neige », « enlève le tuto », « homme ou femme », « simplifie »)

- ⚠️ **Plus de tuto au départ ni de bestiaire.** À la place, un **tuto CONTEXTUEL au
  ralenti** (`CONSEILS`/`conseilStep`, main.js) : la première fois qu'une FAMILLE
  d'obstacle arrive (tap / appui long / double), le monde passe à ×0,06 pile au
  moment du saut, la consigne s'affiche (carte `hud.renderTuto`, onglet « À TOI »),
  le morceau passe dans un passe-bas (`audio.setRalenti`), et le temps ne repart
  que sur le bon geste. L'obstacle expliqué ne fait jamais mal. Famille apprise
  une fois franchie → `localStorage["jp2-appris"]` (effacé par `?neuf`/`?zero`).
- ⚠️ **Deux horloges** : `clock.now()` = le morceau (fin de course, nuit, soleil) ;
  `tMonde()` = le monde (traversées, voitures en face, toits, bêtes tombées), qui
  prend du retard pendant le ralenti (`retardMonde`). Tout ce qui BOUGE sur la
  route doit lire `tMonde()`, sinon il file à pleine vitesse pendant le ralenti.
- **Saisons** (scene.js, `setSaison`/`renderMeteo`) : le morceau est coupé en 4
  saisons dans l'ordre du calendrier, la première tirée par la graine, fondu de
  4 s. Elles ne repeignent QUE le décor et le sol (`modeSaison`, posé autour des
  dessins de `rowDecor` et de `renderGround` hors route) : hiver = sol et dessus
  enneigés + flocons, automne = feuillage roux + feuilles, printemps = arbres en
  fleurs + pétales. Debug : touche **S** ; capture : `node outils/capture.mjs saisons`.
- **Auto-audit** : `node outils/capture.mjs audit` joue les trois familles du tuto
  contextuel (bon geste, obstacle expliqué jamais compté — `__pote.chocs()`
  marque `conseil` sur le choc ignoré), une pause pendant le ralenti, et la perf
  par saison (p95 ≈ 3 ms). Pièges corrigés par l'audit : l'appui long relâchait
  le ralenti au premier dixième d'appui (le ralenti tient désormais jusqu'à la
  pleine hauteur ou au doigt levé) ; mort/fin pendant un conseil laissaient le
  morceau étouffé (`conseilCouper`) ; le fantôme lisait l'horloge du morceau
  (désormais `tMonde()`, enregistrement ET relecture).
- **Homme / femme** : premier réglage du menu « Mon cycliste » (`skin.genre`) ;
  femme = cheveux longs + queue de cheval, jamais de barbe.
- **Décor allégé** : un élément semé par rangée côté route, rien au fond hors
  arbres, poteaux électriques retirés, une seule touffe au premier plan.

## Retours du 29 septembre 2026 (boost de ligue, lien ?9, poules, décor)

- ⚠️ **BOOST DE LIGUE** (idée du manager de Bluefit : « pour faire le meilleur
  score, les fans sont obligés de faire jouer leurs potes ») : chaque AUTRE
  membre de ta ligue qui a fait une course d'au moins `boostLigueDureeS` (30 s)
  te donne +`boostLigueParPote` (10 %) sur TOUS tes points, jusqu'à
  `boostLigueMaxPotes` (20 → ×3). `net.potesActifs` (colonne `duree_s` de
  `ligue_scores`, ajoutée à `schema-v2.sql`), `screens.getBoost`, appliqué dans
  `multiplicateur()` (main.js) et au score parfait affiché. Sticker jaune sous
  JOUER (tap = partager le lien de ligue), bandeau « BOOST ×N » au GO, ligne
  sur l'écran de fin. Pas en sprint (même règle pour tous). `LIGUE_MAX` 6 → 21.
  ⚠️ **Inerte tant que la base Supabase v2 n'existe pas** (`apiBase` vide) :
  l'interface du boost est alors masquée.
- **Lien `?9`** (script en tête d'`index.html`) : tout paramètre NUMÉRIQUE
  (`?9`, `?10`…) vide les caches, désinscrit le service worker, remet le tuto
  au ralenti à zéro, puis recharge l'URL propre (`?ligue=` conservé).
- **Fantôme retiré de l'écran** (la trace est toujours enregistrée et envoyée).
- **Poules ×1,4 et rousses** (contraste sur la neige) — toujours « tap »
  (`node outils/familles.mjs`). `VERSION_COURSE` 8.
- **Arrière-plan encore allégé** : arbres espacés (1/5 près, 1/3 au fond),
  lampadaires 1/12, plus de clôture au premier plan. Ombre du HUD 25 → 50 %.

## Retours du 29 septembre 2026, soir (partie jouée en direct, commande vocale)

- **Ligue DÉMO** : `?demo` (mémorisé, `jp2Demo`, effacé par `?zero`) → ligue
  locale « DEMO », 6 potes fictifs qui ont « joué », boost ×1,6 actif, classement
  de fin fictif (les potes s'étagent SOUS une course terminée : on voit « Tu es
  1er de ta ligue ! »). Rien ne part sur le réseau. Lien à montrer : `?9&demo`.
- **Première visite** (3 octobre 2026) : `?premiere` efface tout (comme `?zero`)
  puis `jp2Demo = "cree"` : ligue démo VIDE. Étape « Ma ligue » = bloc
  « Pourquoi / Comment » (affiché aussi en vrai, tant qu'on n'a pas de ligue) +
  CRÉER MA LIGUE en rouge ; seul dans sa ligue → INVITER en rouge ; en démo,
  Inviter ne partage rien : les 6 potes fictifs « jouent » un par un (1,5 s) et
  le boost monte. Lien à montrer : `?9&premiere`. Parcours : `outils/premiere.mjs`.
- **3 octobre 2026, retours d'iPhone (quatre lots)** :
  - *Menu* : écran de CHARGEMENT plein écran (`#splash`, logo LVEB qui tourne
    en rotateY + flotte, barre dessous) ; ordre du premier passage pseudo →
    CYCLISTE (bouton « Continuer ») → LIGUE (bouton « Jouer »), clé
    `jp2LigueVue` ; ensuite le cycliste est l'accueil. Page ligue : une phrase
    de pourquoi, CRÉER en rouge, « ou », code + Rejoindre, « Jouer sans ligue »
    en petit. Ligue créée : message jaune EN HAUT, code en gros (tap = copie),
    INVITER en gros, peloton en pastilles avec **BOTS** (`BOTS_LIGUE` = 3 :
    toi + Bot 1..3, chaque vrai pote remplace un bot ; en jeu friends.js
    complète aussi avec « bot N »). Bandeau boost : « N potes dans ta ligue ».
    Fin : « Meilleur score · tu peux le battre », code de ligue soulignée
    (tap = copie), liens Album / Menu / @pmc.mp3 sur une ligne.
  - *Messages* : plus de grands bandeaux en course — PASTILLES au-dessus du
    joueur (`pousserPastille`) et pastille jaune « LEA EST LÀ » au-dessus du
    pote qui arrive (friends.js). PROJECTEUR (`projo`, une fois par joueur,
    clés `lait`/`alerte` dans `jp2-conseils-vus`) : monde gelé, écran
    assombri sauf un cercle autour de la brique de lait / du premier triangle,
    tap pour repartir. Le doigt qui tape n'apparaît qu'après le GO et jamais
    par-dessus une consigne. Explication : « 1 tap = 1 saut », « 1 partie =
    1 morceau », « Touche pour continuer » en bas de l'écran.
  - *Gameplay* (VERSION_COURSE 13) : le TRACTEUR ne traverse plus, il roule
    dans le sens du joueur (contresens à vitesse −0,8, long 2,6, h 1,7) ;
    CAR SCOLAIRE Région (`bus`, contresens, 3,6 × 1,9, montable) ; rien en
    face avant 20 s ni dans les 8 dernières secondes ; paquet FINAL (index
    ≥ 5) presque tout roulant ; véhicules d'en face +40 % entre 100 et 150 s ;
    plus de lait dans les 55 dernières secondes ; halle de 156 s retirée.
    Costard et fermier DE FACE en 2D (`personnage2D`, bras pivotant à
    l'épaule). Premier plan nu, sillons adoucis. Joueur idéal : 0 choc.
  - *Bâtiments* : halle 1 = marché, 2 = BOWLING (piste cirée, quilles,
    néons), 3 = GARE (quai, marquise vitrée, rails et TER à quai, couche
    « train »). `rows.typeHalle(d)`. Capture : `capture.mjs batiments`.
- **4 octobre 2026, deuxième série de retours (trois lots)** :
  - *Interface* : écran de chargement avec le cycliste qui pédale sur une route
    qui défile (`renderSplash`/`dessinerCycliste`, main.js), `chargementMinS`
    2,6. Menu CENTRÉ verticalement (`centrerMenu`, var CSS `--centre` animée)
    et qui remonte quand un champ prend le focus (classe `clavier`) ; champs en
    16 px (sinon Safari zoome à l'ouverture du clavier). Étape 1 : titre « Pour
    aller plus loin » au-dessus des champs facultatifs, plus de phrase. Ligue :
    « Plus tes potes jouent… Deviens le meilleur score de ta ligue de potes » ;
    après création : « Ma ligue », code, bandeau jaune SOUS le code
    (`#ligue-statut`), INVITER TES POTES en très gros (icônes 24 px), texte des
    bots ; liens « Mon cycliste · Quitter la ligue » alignés. Explication :
    l'étape 2 sans titre, 4e carte « Monte le son ! » 5 s avec deux klaxons
    (le décompte ne répète plus le rappel : `game.sonAnnonce`). Triangle
    d'alerte : grand et qui TREMBLE 1 s, puis petit et calme
    (`alertesVues`). Pastilles toujours entières dans l'écran. Arrivée : plus
    de texte « ARRIVÉE », damier au sol + drapeaux à damier sur les poteaux.
  - *Physique* : le saut trop tôt du tuto PLANE au-dessus de l'obstacle
    (`conseil.plane`) au lieu d'un double saut automatique. PLAFOND sous le
    toit des halles (`rows.plafondA`, joueur et potes). Les potes refont le
    saut à la même distance de L'OBSTACLE franchi (`refObstacle`/`centreRef`,
    marques `{ id, ref }`), tiennent l'appui exactement comme le joueur
    (`majTenue`), gardent un saut arrivé en l'air (`enAttente`), roulent sur
    les toits (`phys.solSous`). Mesuré (`capture.mjs potesVehicules`,
    IMPARFAIT=1) : ancien code 1-2 véhicules traversés par un pote par course,
    nouveau 0. Difficulté : rachat d'un pote de 5 à 14 pièces entre 60 et
    160 s (`poteRachatPiecesFin`), chaque choc coûte +1 pote passé la moitié
    (`chocPlusUnApres`), `vitesseFinale` 4,4.
  - *Moments de course* (VERSION_COURSE 15) : halles à 30 s (marché), 58 s
    (BOWLING de plain-pied, 0,35 u, toit à 7,4 : la caméra voyait son plancher
    par-dessous ; pistes en perspective, boules, grosses quilles, mur à néons,
    `SANS_DECOR`) et 86 s (gare). CONVOI de 3 cars scolaires à 72 s. MONTAGNE
    de fin −60 → −20 s : bosses en cosinus (`rows.bosseA`, 16 rangs, 1,3 u,
    jamais d'obstacle dessus), zone « montagne » (sapins, rochers, sommets
    proches `setMontagne`). BOUCHON à −15 s : 3 voitures garées tous les 3
    rangs (toit continu), feux de détresse, pièces sur les toits, +6 rangs
    après (un double saut lancé d'un toit vole plus loin). Les simulations
    roulent sur les toits (`rows.toitGare`). Joueur idéal : 0 choc / 30 graines.
- **4 octobre 2026, troisième série (montagne d'hiver, tracteur en face, clavier)**
  — `VERSION_COURSE` 16, SW `jp2-v23` :
  - *Montagne* : déplacée en HIVER (46 → 80 s, `MONTAGNE_DEBUT_S`/`MONTAGNE_FIN_S`),
    collines 5× plus hautes (6,5 u — « qu'on soit quasiment tout en haut de
    l'écran ») : montée 28 rangs, plateau 22, descente, en cosinus
    (`rows.hauteurBosse`). Obstacles permis sur le PLAT seulement
    (`penteAutour`). Route ENNEIGÉE (neige tassée, deux ornières, bas-côtés
    blancs : `routeNeige`). Trois couches (`scene.drawBosse`) : « dos » (le
    terrain derrière la route soulevé jusqu'à `U_DECOR`, mêmes sillons que les
    champs : aucune couture au pied), « dessus » (chaussée), « flanc » (versant
    qui redescend vers la caméra, courbes de niveau). ⚠️ Au-dessus de l'œil de
    la caméra (3,6 u), on voit la route PAR EN DESSOUS : le bord haut du flanc
    suit alors l'AXE de la chaussée, et le flanc est peint AVANT ce qui roule
    (sinon il coupe les roues). Tout ce qui se tient sur la chaussée monte avec
    elle : `scene.avecLift(h, fn)` soulève drawBox/drawBoxR/drawFlat/
    drawShadow/drawDisque, via `surSol()` (main.js) — véhicules inclinés sur la
    pente ; décor des rangées de colline soulevé de `hauteurBosse(r)`. Les
    potes ne projettent plus d'ombre au sol quand ils roulent au-dessus.
  - *Hiver* : CHASSE-NEIGE à la place des véhicules en face dans la montagne
    (`props.drawChasseNeige` : toit plat montable, lame à chevrons,
    gyrophare), gros BONHOMME DE NEIGE à la place des voitures, costards et
    fermiers (2,1 u, saut appuyé), petits bonshommes et SAPIN DE NOËL dans le
    décor (`bonhommeDecor`/`sapinNoel`, hiver ou montagne).
  - *Tracteur* : arrive EN FACE (plus jamais dans notre sens : « beaucoup plus
    difficile à passer ») et est MONTABLE (plancher « double ») — atterrir
    dessus ne coûte plus 3 potes.
  - *Moments* : marché 25 s, gare 88 s, bowling 116 s ; convoi de cars à 100 s ;
    bouchon en voitures blanche, rouge, noire (`props.COULEURS_BOUCHON`).
  - *Fausse alerte après la gare* : le turbo lait (`ouvrirFenetreSure`) écrasait
    des véhicules DÉJÀ ARMÉS — le panneau restait, le véhicule disparaissait.
    Les rangées armées sont conservées. Mesuré : 0 alerte fantôme sur 3 × 110 s
    (`capture.mjs alertes`).
  - *Tuto* : plus d'« appui gratuit » (chaque tap passait pour un appui long :
    saut énorme sur les petites bêtes) ; l'étape « haut » ne réussit que sur
    un vrai appui.
  - *Interface* : logo de chargement fixe ; menu à 50 % d'opacité pendant
    « comment jouer » (`estompe`) ; « ! » du triangle dessiné en formes, centré.
  - *Clavier iOS* : plus AUCUNE animation au focus — la marge qui glissait en
    0,35 s déplaçait le champ pendant que Safari calculait son propre
    défilement (« ça a très, très mal réagi », mieux au deuxième tap). Mise en
    page « clavier » SYNCHRONE (titre, lien album et bouton son masqués, carte
    en haut), overlay calé sur `visualViewport` (hauteur + décalage), champ
    actif ramené en vue dans l'overlay (`montrerChamp`). Vérifié en simulation
    (fenêtre réduite, `premiere.mjs`) ; ⚠️ pas vérifiable sans un vrai iPhone.
- **5 octobre 2026, quatrième série (retours iPhone : pause, plage, jetpack, porte)**
  — `VERSION_COURSE` 17, SW `jp2-v24` :
  - *Pause* : ⚠️ le chien de garde de l'horloge audio tournait PENDANT la pause ;
    `audio.now()` y est gelé exprès, il y voyait une panne et basculait au bout
    d'une seconde sur l'horloge de secours… qui tourne : le monde avançait
    derrière le menu (« le chasse-neige avait continué d'avancer ») et la course
    restait décalée du morceau (« à la fin il y a du vide »). Chien de garde
    coupé pendant toute pause (`!isPaused()`), horloge de secours gelée en
    pause, et `pauseDeriveMax` 25 → 0 : ici le morceau EST le chrono, il repart
    là où la course s'est arrêtée. Mesuré (`capture.mjs pause`) : horloge
    1,97 → 2,00 s pendant 3,5 s de pause.
  - *Montagne* : UNE seule colline (`MONTAGNE_AVANT`/`MONTAGNE_APRES`, le biome
    se referme après sa descente). La CAMÉRA MONTE avec la colline
    (`scene.setLevee`, œil ≥ 2,4 u au-dessus de la chaussée) en gardant le plan
    de la route fixe à l'écran : en haut, on voyait les vélos et le
    chasse-neige PAR EN DESSOUS (« les vélos ne sont pas très bien
    modélisés »). Plateau prolongé en neige jusqu'à u = 70, collines et champs
    lointains enneigés dans la montagne. SKIEUR DE FOND en face
    (`skieur`, `props.drawSkieur`) : le 2e véhicule « en face » du biome, et en
    alternance avec le bonhomme pour les gros obstacles posés — chaque course
    a au moins un chasse-neige, un skieur, un bonhomme (mesuré, 20 graines).
  - *Alertes* : le panneau ne s'allume que `alerteAvanceS` (3 s) avant que le
    véhicule n'entre dans l'écran, et s'éteint dès qu'il y entre.
  - *Pièces* : +20 % de taille (`PIECE_R` 0,36), une pièce tous les 3 rangs
    PARTOUT (`ESPACEMENT` 3, plus d'éclaircissage « une sur deux » qui rendait
    les espacements irréguliers), traînées de 2 pièces : +15 % de pièces,
    +23 % en valeur. PIÈCE DOUBLE (dorée, ×1,45) au sommet de l'arc de chaque
    double saut : compte pour 2 (`row.double`, simulation comprise).
  - *Plage de fin* (`rows.enPlage`, 30 dernières secondes) : coucher de soleil
    (ciel violet/orange, soleil bas, nuit levée aux 4/5), mer jusqu'à
    l'horizon avec vagues et reflet (`scene.mer`), montagnes effacées, sable,
    écume, palmiers, parasols, cabanes de sauveteur pastel (Miami Beach).
  - *Jetpack* : une partie sur cinq (`jetpackUneSur`/`jetpackPartie` : la 3e,
    la 8e…, `?jetpack` pour forcer), posé vers 70 s HORS du générateur (la
    route et le score parfait ne changent pas) ; 10 s de vol, appuyé = on
    monte, relâché = on plane vers le bas ; plafond sous le score ; pièces du
    vol calées sur la hauteur de l'ÉCRAN (`scene.hauteurA`) ; les potes suivent
    la trajectoire exacte du joueur (`phys.trace`, enregistrée du ramassage à
    l'atterrissage seulement). ⚠️ Une course à jetpack peut dépasser le
    « score parfait » affiché.
  - *Porte de conversion, nouvelle échelle* (`niveauPour`, screens.js, précisée
    par l'artiste le soir même) : UNE demande à la fois. Partie 1 : la
    PREMIÈRE porte, CONTINUER comme REJOUER, c'est l'ALBUM ; si l'album est
    déjà ajouté (« si déjà crash »), REJOUER demande l'ABONNEMENT. Partie 2 :
    libre. Partie 3 et suivantes : abonnement tant qu'il n'est pas fait, puis
    libre « ad vitam æternam ». Vérifié dans le vrai jeu, 7 états :
    `node outils/porte-echelle.mjs`. `?neuf` remet les paliers à zéro,
    `?zero`/`?premiere` aussi. L'album = l'EP « La ville est belle », où est
    « J'ai un pote » (`plateformesAlbum`).
  - *Trackers* : événements `porte_vue`, `clic_album` (plateforme), `clic_suivre`,
    `mort_choix`, `continuer`, `rejouer`, `ecouter_album`, `mort`, `course_finie`
    — avec une colonne `details` (jsonb) ajoutée à `supabase/schema-v2.sql`.
    ⚠️ **AUCUN N'EST ENREGISTRÉ AUJOURD'HUI** : `apiBase`/`apiKey` de la v2 sont
    vides (base v2 jamais créée), `net.js` n'envoie donc rien.
  - *Clavier* : carte « Qui es-tu ? » compacte pendant la saisie (marges
    serrées, bouton 40 px) — tient au-dessus du clavier d'un iPhone SE.
  - *Vidéo 9:16* : `node outils/video.mjs <nom> <début_s> [durée] [jetpack]` —
    1080×1920, 30 i/s, simulation pas à pas (`__pote.videoPas`), pilote
    automatique, 5 potes, morceau calé (ffmpeg).
- **5 octobre 2026, cinquième série (ouvert dans Instagram : clavier, HUD,
  partage, marché, piétons, plage)** — `VERSION_COURSE` 18, SW `jp2-v27` (clavier : v27) :
  - *Clavier, troisième passe* (capture iPhone DANS Instagram, le soir même :
    carte coupée en haut, « ça monte d'un seul coup et ça redescend », « les
    lignes se rétrécissent au fur et à mesure ») : trois mécanismes se
    battaient (marge haute recentrée avec transition, overlay recalé sur la
    zone visible à chaque événement, overlay défilé pour montrer le bouton),
    en plus du défilement d'iOS. ⚠️ Tous SUPPRIMÉS, ainsi que la version
    serrée (`serre`). UNE règle (`placerSaisie`, screens.js) : clavier ouvert
    (écran tactile seulement), la carte — même forme, mêmes espacements,
    270 px + 15 de sticker : elle tient au-dessus du clavier d'un iPhone SE
    dans Instagram — est posée par une translation (`--saisie-y`), centrée
    dans la zone visible ; l'overlay ne défile plus. Au focus, la zone est
    ESTIMÉE (ce que cache le clavier, retenu la première fois dans
    `jp2Clavier`, sinon `0,32 × écran + 102` px : 362 px mesurés sur l'écran
    de 812 de la capture) : la carte glisse UNE fois avec le clavier, se pose
    à ≤ 8 px près la première fois, plus du tout ensuite. Si iOS fait quand
    même défiler la zone visible, la carte la suit dans la même image.
    Vérifié : `node outils/clavier.mjs` (6 cas : Instagram sur iPhone, SE,
    Pro Max, Safari, défilement forcé d'iOS, Android — faux visualViewport
    pour le modèle iOS). ⚠️ Pas de simulateur iOS sur ce poste (pas de
    Xcode) : le vrai test reste le téléphone.
  - *HUD refait* (`hud.renderHud`) : la barre du MORCEAU tout en haut, sur la
    largeur, jusqu'au drapeau à damier (comme les barres d'une story ; rouge
    les 10 dernières secondes) ; les points au centre ; à droite les cases des
    potes, puis « N POTES » avec le MULTIPLICATEUR qu'ils donnent juste à côté
    (pastille jaune, rouge en turbo) — on lit d'où vient le ×1,5 —, puis la
    jauge « PROCHAIN POTE » sur une étiquette sombre. Plus aucun flou
    (`#vignette` masqué, ni ombre ni blur sur le texte). Capture :
    `capture.mjs hud` (seul, potes, turbo, nuit).
  - *Partage dans les navigateurs intégrés* (« Inviter tes potes, ça ne marche
    pas dans le navigateur Instagram ») : Instagram/Facebook/TikTok/Snapchat
    n'ont pas de partage natif (ou il échoue) et l'API presse-papiers y est
    refusée — l'erreur était avalée, rien ne se passait. Désormais
    (`partagerLigue`, screens.js) : hors navigateur intégré, partage natif ;
    dedans (ou s'il manque/échoue), le tiroir `#partage-sheet` — le lien
    AFFICHÉ et sélectionnable, COPIER LE LIEN (copie fiable : `execCommand`
    dans le geste, puis l'API), WhatsApp (`wa.me`), Messages (`sms:`),
    Snapchat (`snapchat.com/scan?attachmentUrl=`), « Instagram (en DM) » =
    copier + consigne, « Autres applis… » si `navigator.share` existe. En
    démo (`?premiere`), le lien partagé est celui du JEU (la ligue n'existe
    nulle part) et les potes fictifs n'arrivent qu'une fois le lien parti.
    Événements `invitation_ouverte` / `invitation_envoyee` (`details.via`).
    Vérifié avec un user-agent Instagram (`premiere.mjs`) ; ⚠️ le vrai
    navigateur d'Instagram reste à essayer sur téléphone.
  - *@pmc.mp3 dans Instagram* : dans son navigateur, un lien https vers le
    profil s'ouvre en version web DANS ce navigateur ; on y sert
    `instagram://user?username=pmc.mp3` (`lienInstaPmc`), qui ouvre le profil
    dans l'appli. Ailleurs, lien https inchangé. ⚠️ À essayer sur téléphone.
  - *PIÉTONS* (`pieton`, contresens lent, famille tap, sans panneau
    d'alerte, `props.drawPieton` : dame à la baguette, gars sur son
    téléphone, joggeur ; en slip de bain sur la plage) : seuls dès ~35 s,
    par DEUX vers 75 s, par TROIS vers 2 min, par QUATRE sur la plage
    (`taillePietons`, par numéro de paquet). Un groupe se pose comme le
    bouchon : chaque piéton à `ecartMin` + 1 rangée du précédent, sans
    consommer de place dans le paquet. Mesuré : 10 → 11 obstacles par 15 s
    à 2 min, 9 → 10,8 à 2 min 15, 11,3 → 12,7 à 2 min 30 ; joueur idéal
    0 choc sur 1 841 obstacles (20 graines). Piétons de la montagne → skieurs.
  - *BAIGNEURS* (`baigneur`, statique, gabarit du costard) : sur la plage, le
    costard et le fermier sont en slip de bain (2D de face, bronzé, lunettes
    noires, chaîne en or ; ballon de plage brandi ou biceps gonflés), et les
    8 dernières secondes alignent des baigneurs au lieu des vaches.
  - *Marché de plein air* (`scene.etalMarche`, bit de décor `ETALS` autour de
    la halle du marché) : étals au sol derrière la route — bâche rayée
    (rouge, vert, bleu), table en gazon synthétique, cagettes (courgettes,
    tomates, salades, aubergines, poireaux / oranges, bananes, pommes,
    fraises / pastèques entières et ouvertes, melons), étiquettes de prix,
    paniers de fruits par terre, pile de pastèques, marchands en marinière
    (béret, casquette) qui haranguent dans une bulle (« Elle est belle ma
    courgette ! »). Hors teinte de saison (en automne la pastèque virait au
    marron). Capture : `capture.mjs batiments`.
- **5 octobre 2026, sixième série (essai complet dans Instagram)** —
  `VERSION_COURSE` 19, SW `jp2-v28` :
  - *Clavier qui s'ouvrait tout seul* (« on ne voit pas l'animation la ville
    est belle ») : aucune ligne du jeu ne donne le focus au chargement
    (vérifié), mais le navigateur d'Instagram ouvre le clavier sur N'IMPORTE
    quel focus. Le menu est désormais `inert` tant que l'écran de chargement
    est là (attribut posé dans index.html, retiré par `finSplash()` après le
    fondu), et un focus que personne n'a demandé (ni doigt ni touche depuis
    1,5 s, clavier pas déjà ouvert) est rendu aussitôt. ⚠️ Les outils de test
    doivent TAPER dans les champs (`page.tap`), plus `page.focus`.
  - *Partage* : le partage natif d'abord, PARTOUT où il existe — il marche
    dans Instagram sur iPhone (« "Autres applis" fonctionne directement,
    pourquoi on ne fait pas directement là-dedans ? »). Le tiroir maison ne
    sert plus que s'il manque (Instagram sur Android) ou échoue.
  - *Potes ×1,2* (« faut durcir de 20 % ») : paliers [4, 8, 17, 28, 41],
    rachat 6 → 17 pièces. Joueur idéal : potes à 4, 10, 24, 37, 49 s (3, 8,
    20, 31, 43 avant).
  - *Pièces « à travers une voiture »* : aucune pièce n'est piégée (le joueur
    idéal ne passe jamais une pièce dans un obstacle : 0 sur ~5 000,
    `node outils/pieces-piegees.mjs`), mais un véhicule venu d'en face
    TRAVERSAIT, à l'écran, les pièces posées au-delà de son point de
    croisement — on croyait devoir le percuter pour les prendre. Le
    générateur retire les pièces plus basses que son toit dans la zone qu'il
    balaie à l'écran (`balayageVisible`, rows.js ; piétons exclus, trop
    lents) : 60 → 5 pièces traversées sur 20 courses, −1,6 % de pièces. Et
    les pièces du jetpack ne descendent jamais plus bas que ce qui roule
    dessous.
  - *Panneau « attention »* : 3 s → 1,8 s avant l'entrée du véhicule
    (`alerteAvanceS`), grand et tremblant 0,6 s puis petit. Mesuré
    (`node outils/alertes.mjs 110 170`) : 2,6 → 1,8 s par véhicule, présent
    36 % de la dernière minute au lieu de 56 %.
  - *Plage* : la nuit s'y lève tout à fait ; UN soleil qui descend se poser
    sur l'horizon (moitié dans la mer), énorme, dégradé or → rose, rayé dans
    le bas façon années 80 (`soleilCouchant`, découpe par `clip`, jamais de
    `destination-out` qui trouerait le ciel) ; ciel indigo → magenta → corail
    → or ; reflet doré large ; lumière chaude sur toute la scène. Coût
    mesuré (`outils/perf-plage.mjs`, CPU ×4) : 5,8 ms par image, moins qu'au
    début de course.
  - *Gens de la plage* : piétons en slip avec un ballon brandi à deux mains,
    une raquette où rebondit la balle, ou la serviette ; le baigneur planté
    sur la route a une troisième pose (raquette levée, balle qui rebondit) ;
    au bord de l'eau, des parties de raquettes (`raquettesPlage`).
  - *Ligues* : une ligue = une graine (`graineLigue(code)`) → placement des
    obstacles, des pièces, des groupes différents d'une ligue à l'autre ; la
    COURBE de difficulté (vitesse, paquets d'espèces, biomes) est la même
    pour tous. Sans ligue : graine au hasard, chaque partie différente.
- **5 octobre 2026, septième série (retours après l'essai Instagram)** —
  `VERSION_COURSE` 20, SW `jp2-v29` :
  - *Explication* : « Monte le son » passe en PREMIER (1/4), puis 1 tap = 1
    saut, l'arrivée, les potes. Les carrés de couleur de la carte potes
    (« incompréhensible avec les tags de couleur ») sont remplacés par un
    PELOTON dessiné par le vrai moteur (`dessinerPeloton`, main.js, passé à
    screens.js par `deps`) : le joueur devant, un pote qui arrive par
    derrière toutes les 0,7 s, « +10 % » au-dessus du DERNIER arrivé
    seulement (deux étiquettes voisines se chevauchaient : ~37 px entre deux
    cyclistes).
  - *HUD, colonne de droite* : « ×1,5  2 POTES » en gros, puis « PROCHAINE
    ÉTAPE / 6 PIÈCES ». Plus de barre de progression, plus des 5 carreaux du
    maximum. Texte blanc la nuit ET sur la plage (ciel violet, `hud.plage`).
  - *Marché* : les étals montent sur une ESTRADE dans les halles (couche
    `"estrade"` de `drawHalle` : plancher, poteaux, étals entre les
    piliers), en plus de ceux du sol. Cris : « Tu veux voir ma grosse
    courge ? », « Elles sont belles mes courgettes ! ».
  - *« Je suis passé à travers un skieur »* : mesuré dans le vrai jeu
    (`node outils/collisions.mjs`, course sans sauter) — AUCUN obstacle
    traversé sans contact ; tous les chocs gratuits tombent pendant le turbo
    de la brique de lait (invincible 5 s), qui ne se voyait pas. Désormais
    l'obstacle percuté pendant l'invincibilité est ÉJECTÉ (il s'envole en
    tournant et s'efface, 0,9 s, `ejecter`/`dessinerEjecte`) + secousse,
    et un popup « TURBO : INVINCIBLE ! » (« INVINCIBLE ! » pour le bouclier
    de reprise) une fois par course.
  - *Plage* : les tracteurs y deviennent des BUGGYS (`buggy`, rows.js —
    même rôle : en face, montable, coût 3). Mesuré : 33 buggys sur 20
    graines, plus aucun tracteur après la rangée 1012 (plage à 1087). La
    couleur de coque se tire de la RANGÉE (tirée de `v`, elle changeait en
    roulant). Les voitures d'en face restent (route du bord de mer).
  - *Ligne d'arrivée franchie en l'air* : le cycliste restait suspendu, la
    gravité s'appliquait plus après la fin. Elle s'applique jusqu'au sol,
    le salto en cours continue.
- **5 octobre 2026, huitième série (vocal du marchand, humains)** — SW
  `jp2-v30` (`VERSION_COURSE` inchangée : le parcours ne bouge pas) :
  - *Le marchand* : un vocal de PMC au téléphone (« Quatre euros les belles
    courgettes ! Allez-y, achetez mes courgettes… ») devenu un cri de
    marchand au mégaphone dans une halle — `public/assets/marchand-
    courgettes.mp3`, 6,5 s, 66 Ko, fabriqué par `outils/voix-megaphone.sh`
    (chaîne documentée dans le script ; le relancer sur un autre mémo vocal
    pour d'autres cris). Joué une fois par course (`audio.lancerMarchand`),
    pas fort (`config.marchandVolume` 0,6 devant les étals, le fichier est
    à −16 LUFS et le morceau à ~−14), lancé pour que le milieu du vocal
    tombe au milieu de la halle du marché : mesuré (`node outils/
    marchand.mjs`), il part à l'entrée (t 24,1 s, rangée 131) et finit à la
    sortie (30,8 s, rangée 175). Volume, passe-bas et gauche/droite suivent
    la distance (`placerMarchand`) : il arrive de la droite, étouffé,
    s'éclaircit devant les étals, repart à gauche — c'est le fondu d'entrée
    et de sortie demandé. Coupé net par la pause, la mort, l'onglet quitté.
    La bulle « 4 € les belles courgettes ! » rejoint les cris des étals.
  - *Les humains* (« trop fins », « humains blancs sur fond blanc », « on
    n'a pas de métis, y a que des blancs… je veux tout ») : `src/humains.js`
    tire pour chaque personnage (graine = sa rangée) une peau parmi huit
    (très claire → très foncée, tirage uniforme), cheveux, coiffure (court,
    rasé, long, chignon, afro, tresses, chauve), taille, carrure (1,05 /
    1,12 / 1,38 × l'ancien gabarit), âge (vieux : cheveux gris, dos voûté,
    canne). Appliqué partout : piétons, costard, fermier, baigneur, skieur,
    lanceur de poules, conducteur de buggy, marchands, villageois, joueurs
    de raquettes. Œil blanc + pupille sur les peaux foncées. Liseré sombre
    autour des humains-obstacles (`groupe(…, CONTOUR_PERSO)` pour les cubes,
    `contour2D` pour les personnages à plat). ⚠️ La TAILLE compte dans la
    collision (`rows.hauteurObstacle`) : un petit se saute plus bas, jamais
    plus haut que `K.h` — mesuré, joueur idéal toujours à 0 choc sur 1 841.
    ⚠️ Jamais d'enfant sur la route (`enfants: false`) : ils sont dans le
    décor (plage, village). Coût : +0,5 à 1,5 ms par image à la plage (CPU
    ×4, `perf-plage.mjs`), rien au départ. Planche de contrôle : `node
    outils/capture.mjs humains` → `outils/sorties/h*.png`.
- **5 octobre 2026, neuvième série (essai en direct sur un Samsung, navigateur
  d'Instagram)** — `VERSION_COURSE` 21, SW `jp2-v31` :
  - ⚠️ *UN tap = un double saut sur Android* : Android rejoue chaque toucher
    en événements souris (mousedown/mouseup) juste après le touchend ; le
    mousedown arrivait quand le cycliste venait de décoller, donc comptait
    comme le re-tap. Sur iPhone, ces souris de compatibilité n'atteignent pas
    le canvas. `input.js` ignore toute souris qui suit un toucher de moins
    d'une seconde. Reproduit puis corrigé : `node outils/tap-android.mjs`
    (ancien code 5/5 doubles sauts avec salto, corrigé 5/5 sauts simples —
    ⚠️ il faut un vrai appui de ~120 ms, `page.tap` pose et lève dans la même
    milliseconde et ne montre rien).
  - ⚠️ *Menu « mon cycliste » qui remontait à chaque choix* : sur Android un
    BOUTON prend le focus (pas sur iPhone) ; en le perdant il déclenchait le
    « clavier refermé » (`sortirSaisie` : retour en haut, carte rejouée
    depuis le bas). `focusout` ne réagit plus qu'à un champ, clavier
    ouvert ; les puces ne sont plus reconstruites (`majSkinUi` bascule
    l'état actif). `node outils/menu-android.mjs` : 6/6 choix bougeaient la
    carte de 131 px, 0/6 maintenant.
  - *Marchand* −5 dB (`marchandVolume` 0,6 → 0,34).
  - *Tuto* : la route est DÉGAGÉE autour du premier obstacle de chaque
    famille à expliquer (`rows.degagerTutos` : rien 2,4 s avant, rien 1,6 s
    après, deux tutos jamais plus proches que ces deux fenêtres) —
    seulement pour qui a encore un tuto à voir. Avant : un autre obstacle
    1,4 à 2,7 s avant le tuto (« il devait sauter un bus et il s'est pris
    un mec en costard qui était avant »). Un turbo de brique de lait peut
    effacer l'obstacle réservé (fenêtre sûre) : on en réserve un autre plus
    loin. L'obstacle réservé ne file jamais (tuto lancé même en l'air), et
    le projecteur de la brique de lait ne tombe jamais juste avant un tuto.
    `node outils/tuto-neuf.mjs` (joueur neuf, course accélérée) : 8/8
    courses, chaque tuto sur sa route dégagée, ≥ 3 s sans rien avant.
  - *Textes du tuto plus gros* (consigne 31 px, sous-titre 16 px gras ;
    projecteur 32/18 px) ; la brique de lait dit ce qu'elle fait :
    « BRIQUE DE LAIT = TURBO — pendant 5 s, tu fonces, rien ne peut te
    toucher et tes points comptent double ».
  - *Panneaux de commune +50 %* (`scene.drawSign`).
  - *Pièces à travers un bus* : le générateur n'en pose plus non plus sur
    le passage des piétons et des skieurs (−2,8 % de pièces, score parfait
    6 544 → 6 509), et une pièce qu'un véhicule ou un piéton traverse
    encore est CACHÉE le temps qu'il passe (`cachee`, main.js) — elle reste
    à prendre, le score n'en dépend pas.
  - *Emojis* 👆 🔊 remplacés par des icônes dessinées (main en gant blanc,
    manche rouge ; haut-parleur) : chaque téléphone dessinait les siens.
- **4 octobre 2026 (nuit), dixième série (sound design « à fond », chacun dans
  son décor)** — `VERSION_COURSE` 22, SW `jp2-v32` :
  - ⚠️ *Chacun dans son décor* (« les gens en slip restent sur la plage, les
    skieurs au ski ») : le personnage se choisissait sur la rangée de
    l'obstacle PRÉCÉDENT, jusqu'à 25 rangs plus tôt. Mesuré sur 400 routes :
    149 skieurs, 148 chasse-neige et 76 bonshommes sur le goudron, 83
    fermiers et 15 tracteurs sur la plage, des cars et des costards dans la
    neige. `rows.auDecor` l'habille pour SA rangée, et rien ne se pose à
    cheval sur une frontière (`aCheval` : 3 rangs derrière, 8 devant pour ce
    qui vient en face, 2 sinon) → 0 faute sur 400 routes. Coût : ~1 obstacle
    de moins par course (une respiration à chaque changement de décor) ;
    joueur idéal toujours à 0 choc. Les compteurs de la neige (`nNeige`,
    `nNeigeFace`) sont remis à zéro par `reset()` (ils ne l'étaient pas).
  - *Sound design, tout synthétisé, zéro fichier* (`bruitages.js` = les
    sons, `ambiance.js` = ce qui sonne en continu) :
    - le vélo « en pas fort » : roulement selon la surface (goudron, neige
      qui crisse, planches des halles, piste du bowling, toit de voiture),
      roue libre qui cliquette en l'air et après l'arrivée, vent de la
      vitesse (plus fort au turbo), jetpack, atterrissage (tôle sur un toit) ;
    - un cri par obstacle percuté (« quand je prends une poule, je veux un
      bruit de poule ») : poule (« KRAAAK », ailes), vache, mouton, cochon,
      chien, chat, botte, « ouf » (voix d'homme ou de femme selon la
      personne), mallette et feuilles du costard, skis du skieur, bonhomme
      qui s'effondre, tôle + verre + klaxon étranglé pour un véhicule ;
      les bêtes crient aussi en nous voyant arriver (4 sur 5) ;
    - ⚠️ un klaxon par véhicule quand il ENTRE à l'écran (avant : un seul
      son pour tous, à l'armement, 5,5 s avant, hors champ) : voiture
      « tut-tuuut », car grave, tracteur « pouet-pouet », chasse-neige
      corne de camion, buggy « bip-bip » ; la sonnette du vélo pour les
      piétons et les skieurs ; le moteur passe de droite à gauche (Doppler) ;
    - la gare : le TER ENTRE EN GARE (il arrive de derrière, double le
      joueur sur la rampe, freine le long du quai — `scene.decalageTrain`,
      fonction de la position du joueur, ~2 s de mouvement à l'écran ; venu
      d'en face il traversait l'écran en moins d'une seconde) : klaxon deux
      tons de loin, roulement, « ta-dam » des rails, freins qui crissent,
      souffle à l'arrêt, carillon sur le quai ;
    - le bowling : les quilles TOMBENT quand la boule arrive
      (`scene.phaseQuilles`, `QUILLES_IMPACT`), fracas au même instant ;
    - les décors : oiseaux le jour, grillons + chouette la nuit, meuglement
      au loin dans les prés, cloche au passage d'un clocher, blizzard dans
      la montagne, vagues + mouettes sur la plage ;
    - « Monte le son » joue le klaxon puis la sonnette du jeu.
    - Niveaux calés sur le morceau (−9,9 LUFS) par `outils/bruitages.mjs` :
      un choc ~12 LU sous la musique, un klaxon ~13, le train ~10, le vélo
      et l'ambiance 20 à 25 (crête du niveau momentané). Réglages globaux :
      `bruitagesVolume`, `veloVolume`, `ambianceVolume` (config.js).
    - Mesuré : une course réelle = ~200 sons, 60 i/s, 0 erreur
      (`outils/sons-course.mjs --reel`) ; +0,5 à 1 ms par image à CPU ×4
      (`perf-plage.mjs`).
    - ⚠️ Je n'ai pas d'oreilles : les sons sont vérifiés au niveau (LUFS) et
      au spectrogramme (`outils/sorties/sons/*.png`), pas à l'écoute — c'est
      au téléphone qu'on tranche ce qui sonne faux.
- **4 octobre 2026 (nuit), onzième série (gamme, voix, volumes, train,
  personnages debout)** — SW `jp2-v33` (parcours inchangé, `VERSION_COURSE` 22) :
  - *La gamme du morceau* (« analyse la gamme [...] que tous les bruitages
    soient sur la gamme, pour pas qu'il y ait des fausses notes ») : mesurée
    sur le MP3 (chromagramme accordé, profils de Krumhansl) → **mi mineur /
    sol majeur**, La 440 (+3 cents) ; notes dominantes mi do si sol ré la,
    basse do-si-la-sol. Tout ce qui a une hauteur joue la **pentatonique de
    sol** (sol la si ré mi : aucun demi-ton, rien ne frotte quel que soit
    l'accord) — `bruitages.n("E5")`, `surGamme(f)` pour les tirages au
    hasard. Cris des bêtes, klaxons, train (ré puis la, sans Doppler qui
    désaccorderait), cloche (en mi : tous ses partiels sur la gamme),
    carillon, sonnette, oiseaux, grillons, chouette, mouettes, quilles,
    tôle, lattes, roue libre, freins, moteurs (note de base choisie pour que
    l'approche ×1,06 et l'éloignement ×0,94 tombent tous deux sur la gamme),
    et `sfx.js` (pièces, lait, pièce rouge, salto, pote perdu, fin).
    ⚠️ La fanfare des potes (`audio.playComboJingle`) jouait encore en **ré♭
    majeur**, la tonalité de « La ville est belle » : réaccordée (ré mi sol
    si ré mi). Vérifié au spectre : toutes les fondamentales sur la gamme.
  - *La voix du joueur* (« dès que tu te prends un objet, tu prends cet
    audio-là, pour que les gens fassent « pfff » ») : le mémo de PMC
    (`public/assets/pff-aie.mp3`, 8,5 Ko) coupé à 0,78 s, passe-haut 110 Hz
    ×2 (le « p » qui claque), débruitage léger (`afftdn` 4 dB — plus fort, il
    mangeait le « fff »), égaliseur (−2 dB à 320 Hz, +3 dB à 3,2 kHz, +2 dB
    d'air), compresseur 4:1 seuil −20 dB, limiteur −1 dB ; −17 LUFS.
    `bruitages.aie()` à chaque choc qui fait mal (pas sous turbo), jamais
    deux fois en 0,55 s, trois prises : tout (50 %), « aïe » seul, « pfff »
    seul. Son « aïe » descend de mi à ré : déjà sur la gamme, laissé tel quel.
    Réglages `fichierAie`, `aieVolume` (config.js).
  - *Les bêtes* (« rajoute les miaulements du chat ») : chaque bête crie en
    nous voyant arriver (avant : 4 sur 5), et ~3 LU plus fort qu'au premier
    essai.
  - *Deux curseurs* (« un réglage pour la musique et un réglage pour les
    effets sonores ») : menu pause (Musique / Effets) et bouton ♪ du menu
    (même panneau, titre « Son », bouton OK). `audio.musiqueGain` (morceau +
    boucle de mort) et `audio.effetsGain` (TOUS les bruitages, le marchand, la
    voix) avant `volumeGain` ; effetsGain est persistant et rebranché sur
    chaque nouveau graphe. Retenus dans `jp2VolMusique` / `jp2VolEffets`.
    `node outils/volumes.mjs` : chaque curseur ne règle que le sien, le
    réglage survit au rechargement.
  - ⚠️ *Le train qui flottait* (« le train apparaissait un peu dans le
    vide, au milieu de nulle part, avant même que j'arrive dans la gare ») :
    il arrivait de derrière à hauteur de quai au bord gauche de l'écran
    pendant qu'on montait la rampe, là où il n'y a pas encore de quai. Il sort
    maintenant d'un TUNNEL au bout du quai (`TRAIN.tunnel`, mur de pierre et
    bouche sombre) et n'est dessiné que sur ses rails, sorti du tunnel. À
    l'arrêt il longe tout le quai (`TRAIN.corps`).
  - ⚠️ *Les personnages debout en cubes* (« l'apparence des personnages qui
    attendent debout est globalement la même que moi [...] il faut que ça
    soit dans le même univers ») : costard, fermier et baigneur abandonnent
    les silhouettes plates DE FACE du 3 octobre pour le corps du piéton (de
    profil, tournés vers le joueur, liseré) — `props.debout()`. Bras en
    chaîne de cubes qui pivote à l'épaule (`brasCubes`), jamais
    « désarticulés ». Costard : veste, col, cravate, mallette, bras qui
    s'agite ; fermier : bottes, salopette, chemise à carreaux, chapeau de
    paille, fourche tenue coude plié ; baigneur : tongs, slip ou maillot,
    lunettes, chaîne en or, ballon / raquette / biceps. Hauteur = K.h ×
    taille, chapeau compris. `node outils/capture.mjs humains`.
  - Le titre affiché sur l'écran verrouillé (Media Session) disait encore
    « La ville est belle » : « J'ai un pote ».
- **Tuto au ralenti, deuxième version** (`conseilTap`/`conseilStep`) : approche
  ~1 s avant le bon moment (monde ×0,25), un tap donné pendant l'approche est
  GARDÉ et part pile au bon moment, gel ×0,06 s'il n'a rien fait ; reprise
  franche sur réussite. Appris dès que l'obstacle est franchi sans contact,
  jamais montré plus de 2 fois (`jp2-conseils-vus`). Carte en HAUT, sous le
  score. Bug corrigé : un tap juste avant le déclenchement faisait un double
  saut qui ne validait rien → le même conseil revenait 3-4 fois.
- **Pieds sur les pédales** (voxrider `pied()`), Grand Bi sur le moyeu avant,
  rollers qui glissent en foulée. Cadre en tubes « pixel » (bouts carrés).
- Départ toujours en **automne**. Sticker « MONTE LE SON » sous le décompte.
- **Une pièce sur deux** (rows.js, 4 bis) et paliers de potes ÷2
  (`[3, 7, 14, 23, 34]`, rachat 5). **Moutons ×2** (appui long désormais),
  **fermier plus grand**, **plus de voitures en face** (PAQUETS).
  `VERSION_COURSE` 9.
- **Village ÷2** (maisons, voitures garées, habitants ; skateur retiré).
  Botte de foin : liens en saillie (ils se battaient avec les faces).
- **Acteurs éclairés la nuit** (`scene.eclaire`) : tout ce qui n'est pas décor
  n'est assombri qu'au quart — on voyait plus les bêtes la nuit en automne.
- Classement de fin : sticker « Tu es 1er de ta ligue ! » (`#end-rang`).

## Retours du 30 septembre 2026 (partie fake en direct)

- **Tuto** : un tap pendant l'approche fait REPARTIR le temps tout de suite, et
  le saut part seul au bon moment (tenue offerte pour l'appui long et le double,
  re-tap gardé jusqu'au sommet). Chaque conseil n'est montré qu'UNE fois.
  Tests : `node outils/capture.mjs audit tapTot`.
- **Vélo enfant** à la place du roller (`veloEnfant`, voxrider) : roues roses,
  roulette, guidon chopper à rubans, fanion — l'adulte assis tout en bas.
  Ancien choix « roller » migré en « enfant » (rider.js + screens.getSkin).
- **Animation d'explication au lancement** (`#explication`,
  `montrerExplication`, screens.js) : « Tes potes = tes points », 6 carrés qui
  apparaissent, ×1,0 → ×1,6, puis la course part seule (4,6 s, un tap abrège).
  3 premières parties + toujours en ligue démo. Le contexte audio est débloqué
  dans le geste du JOUER, la musique part après sans nouveau tap.
- **Plus aucune ombre portée** sur les textes (hud.js) : texte du HUD NOIR de
  jour, BLANC la nuit (`hud.nuit`).
- **Plus de poule jetée** (retirée des PAQUETS) ; **homme en COSTARD** (appui
  long, bras qui moulinent, mallette). ⚠️ Chaque paquet = EXACTEMENT 12 espèces.
- **Deuxième accélération** : sur les `accelDernieresS` (85) dernières secondes,
  la vitesse repart de `vitesseMax` vers `vitesseFinale` (3,4) — l'écart minimal
  entre obstacles est calculé sur `vitesseFinale`. `VERSION_COURSE` 10.
- Voitures garées du village décalées (rz % 24 = 20) : elles chevauchaient une maison.

## Retours du 30 septembre 2026, soir (difficulté, latence du tuto, halles, toits)

- ⚠️ **DIFFICULTÉ AVANCÉE** (« au bout de 40 secondes, ça doit devenir
  difficile » ; « la difficulté à 30 s de la fin, je l'attends pour le milieu ») :
  `V_DOUBLING_S` 88 → 50 (vitesseMax vers 30 s), 2e accélération de ~50 s à la
  fin vers `vitesseFinale` 4,0 (`accelDernieresS` 120), paquets avancés
  (`paquetPour` : 12 / 12 / le dur), `RAMP_ROWS` 380, `MOU` 5 → 0, une voiture
  dès le premier paquet (tuto du double saut tôt). ⚠️ `ecartMin(a, b, v)` prend
  désormais la vitesse LOCALE (`vitesseAuRang`) : l'écart calculé à la vitesse
  maxi de fin espaçait tout le début. ~100 obstacles par course (81 avant), joueur
  idéal toujours à 0 choc. (L'avertissement « paires plus serrées que la
  physique » de mesurer.mjs compare encore au pire cas : il est attendu.)
  `VERSION_COURSE` 11.
- **Tuto sans latence** : un tap pendant l'approche fait sauter TOUT DE SUITE ;
  le saut est prolongé (tenue offerte, double saut automatique au sommet si le
  tap était tôt de plus de 0,12 s) pour passer quand même. Tap et appui long
  sont réussis au décollage ; seul le double gèle encore au sommet pour le re-tap.
- **Toits de voiture** : le toit porte sur toute la zone de choc (il s'arrêtait
  une demi-roue avant, l'atterrissage comptait comme un choc). Test :
  `capture.mjs toitVoiture`.
- **Halles** : un pote en cours d'arrivée suit le plancher (il roulait dessous).
- Roue arrière d'un pote au hasard toutes les 15 s (friends.js).
- **Nuit** : acteurs en pleine lumière (`eclaire` → kn 0), phare du vélo sur la
  route, plus de chat noir. Plus AUCUNE ombre portée (cartes du HUD, étiquettes
  des potes, CSS).
- **Fin** : plus de tag « Terminé », « Nouveau record · N potes maximum »,
  « Tu peux encore faire un meilleur score. » à la place du score parfait ; tient
  sur iPhone 16 (`ECRAN=i16`).
- **Explication au lancement** : 9,2 s en deux temps (« Tes potes = tes points »,
  puis « Ton boost de départ » + tag « Tu peux aller jusqu'à ×3 ! »).

## Retours du 1er octobre 2026 (test avec une joueuse)

- **Explication au lancement en 3 étapes** (`EXPL_ETAPES`, screens.js) :
  1) « Tape l'écran pour sauter » + doigt animé, « pas besoin de glisser » ;
  2) « Une partie = un morceau », ligne d'arrivée ; 3) « Joue avec tes potes »,
  +10 % par pote, compteur en POURCENTAGE (« 1,6 » se lisait « 1,6 % »). Un tap
  = étape suivante ; après la 3e, la course part seule.
- **Doigt qui tape en course** (`hud.renderTapHint`) : 3 premières parties,
  jusqu'au premier saut.
- **Ligne d'ARRIVÉE** (main.js, `game.arriveeR`) : posée 8 s avant la fin du
  morceau là où le joueur sera (vitesse prévue intégrée) ; damier + arche rouge.
  La franchir termine la course.
- **Double saut plus haut** (`sautVitesseDouble` 13,6 → 17) et **pesanteurs −10 %**
  (54 / 26) : un double saut « spammé » passe maintenant un tracteur.
  `VERSION_COURSE` 12.
- Le **bob** prend la couleur du maillot. Boost affiché en « +60 % », plus en « ×1,6 ».

## 9 octobre 2026 — nettoyage du code (« voir si le code est clean, épurer », trois pistes acceptées)

- **Filet de sécurité** : `npm run verif` (11 tests, chacun conclut par OK/ÉCHEC avec un code
  de sortie), branché sur `deploy.sh`. Vérifié qu'il attrape une panne (erreur injectée exprès
  dans le HUD → `collisions` en ÉCHEC). Deux seuils corrigés au premier passage : les paires
  « serrées » de `mesurer.mjs` comparaient au pire cas (indicatives seulement), et les i/s d'un
  Chrome sans écran suivent la charge de la machine (30 i/s avec l'ancien code comme avec le
  nouveau, machine à charge 8) — la fluidité est gardée par `perf` en ms par image.
  `tap-android` est parfois lent à démarrer : un test en échec est relancé une fois.
- **Code mort retiré** (−530 lignes) : égaliseur et vocal « 500 000 » du premier jeu, analyseur
  de spectre, volume général remplacé par les deux curseurs, ancien cycliste vu de dos en
  sprites (et son `blk`), colonnes de la vue de dessus, bestiaire et rappel des commandes du
  HUD, contour des personnages plats, accesseurs que rien n'appelait, 10 réglages de config.js
  jamais lus, 3 règles CSS. Aucun gain de poids pour les joueurs (Vite retirait déjà ce code du
  build) : le gain est à la lecture. Le filet a attrapé au passage un import oublié (`VELOS`)
  que le build tolérait mais qui bloquait le jeu en développement. Exception : le chargement du
  fantôme est GARDÉ, en sommeil, pour le jour où la base v2 existera.
- **Historique sorti du code** : commentaires réécrits au présent dans les 23 fichiers et
  config.js (plus aucune date ; 2 648 → 2 228 lignes de commentaires), prouvé par
  `outils/commentaires-seuls.mjs` (code compilé identique au caractère près). Une douzaine de
  commentaires qui contredisaient le code ont été corrigés au passage (vitesse minimale et non
  maximale pour les familles, `ESPACEMENT` 3, ordre des halles, `LIGUE_MAX` 21…).
  `CLAUDE.md` réécrit en état actuel (898 → ~180 lignes), l'ancien récit déplacé ici,
  `ARCHITECTURE.md` (partie v2) remis à jour avec les mesures du jour.
- **Pas fait** : le découpage de `render()`/`step()` (voir CLAUDE.md, points ouverts).

