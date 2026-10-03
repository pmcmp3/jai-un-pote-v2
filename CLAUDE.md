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

## Invariants de la v2 (mesurés, `outils/mesurer.mjs`)

- L'écart entre deux obstacles vient de la PHYSIQUE du saut (`ecartMin` : retombée du premier +
  élan du second), jamais d'un nombre fixe, et jamais deux « double saut » d'affilée. Un joueur
  idéal scripté ne touche **aucun** obstacle sur 20 graines (1 643 franchis, 4 octobre 2026) ; un joueur immobile
  les touche tous. À re-mesurer après toute modification du saut ou du générateur.
- ⚠️ La fenêtre de franchissement se calcule à la vitesse MINIMALE, pas maximale : un obstacle
  est long en rangées, donc c'est en roulant lentement qu'on reste le plus longtemps dessus.
  (Mesuré : à 5,3 rangées/s le pilote idéal accrochait moutons et bottes, jamais à 6,8.)
- Le sol vaut `rows.solAt(v)`, jamais 0 : tout ce qui décolle, retombe ou « est au sol » s'y
  compare (joueur, potes, simulation, pilotes de mesure).
- Quotas identiques d'une graine à l'autre (20 laits, 12-13 grosses pièces, ±1 par espèce),
  244 à 286 pièces par course.
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
