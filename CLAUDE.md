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

## Invariants de la v2 (mesurés, `outils/mesurer.mjs`)

- L'écart entre deux obstacles vient de la PHYSIQUE du saut (`ecartMin` : retombée du premier +
  élan du second), jamais d'un nombre fixe, et jamais deux « double saut » d'affilée. Un joueur
  idéal scripté ne touche **aucun** obstacle sur 20 graines (1 531 franchis) ; un joueur immobile
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
