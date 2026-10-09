# ARCHITECTURE — « J'ai un pote v2 » (vue de profil, une voie)

Ce fichier décrit la technique de la v2. L'état du jeu (ce qu'il fait, les décisions en
vigueur) est dans `CLAUDE.md` ; le récit daté des décisions dans `JOURNAL.md`. La seconde
moitié, « Héritage v1 », est un document d'époque : là où elle parle de voies, de swipe
latéral ou de file indienne, c'est la première moitié qui fait foi.

## 1. Où ça vit

| Quoi | Où |
|---|---|
| Code | `/Users/pmc/Documents/PMC/JAI-UN-POTE-V2/` — projet autonome, rien de partagé avec le dépôt du premier jeu |
| Dépôt | **`pmcmp3/jai-un-pote-v2`** (public, obligatoire pour GitHub Pages gratuit). Branche `main` = historique normal, `gh-pages` = build |
| En ligne | **https://pmcmp3.github.io/jai-un-pote-v2/** ; sous-domaine prévu `pote.la-ville-est-belle-pmc.fr` (voir §4) |
| Base | **Aucune pour l'instant** : `apiBase`/`apiKey` vides dans `config.js`, tout ce qui est en ligne est inerte (voir §5) |
| Dev | `npm run dev` → port 5175 (LAN) ; lanceur `.claude/launch.json` « pote2 » |
| Tests | **`npm run verif`** : le filet (11 tests du vrai jeu, OK/ÉCHEC, code de sortie) — voir §7 |
| Déploiement | `./deploy.sh "message"` : le filet, puis commit + push `main`, build, `gh-pages` orphelin dans un worktree. Pousse avec le compte `pmcmp3` via `gh auth token --user pmcmp3`, sans changer le compte actif du poste. `VERIF=0` saute le filet (urgence seulement) |

Isolement de la v1 (où tourne la bêta fermée) : clés `localStorage` préfixées **`jp2`**, cache
du service worker **`jp2-vNN`** (`public/sw.js`, incrémenté à chaque version), `VERSION_COURSE`
propre (`regles.js`), aucun appel à la base de la v1.

## 2. La perspective : `scene.js`

Un sténopé posé à côté de la route, à `cameraDistance` (11) unités de son axe et
`cameraHauteur` (3,6) unités de haut, qui regarde perpendiculairement à la route :

```
s = K · camD / (camD + u)        x = W/2 + (v − vCentre) · s        y = horizon + (camH − h) · s
```

- Le monde est en **(u, v, h)** : u = profondeur (0 = la route, + = le fond, − = la caméra),
  v = avance, h = hauteur.
- **Parallaxe gratuite** : le fond est plus petit et défile moins vite, le premier plan grossit.
- `K = min(W / unitesVisibles, H / 11)` : la largeur visible est fixe en unités (même temps de
  lecture pour tous en portrait), plafonnée par la hauteur sur un écran couché.
- **Caméra qui prend de l'avance** : le joueur passe de 30 % à 25 % de la largeur quand la
  vitesse monte (`cameraJoueurX`). La caméra **monte avec les collines** (`setLevee`) en gardant
  le plan de la route fixe à l'écran.
- Faces vues d'un cube : l'avant, le dessus, et UN côté selon que le cube est à gauche ou à
  droite du centre de l'écran. Couleurs (nuit + brume) en cache par couleur × profondeur × nuit.
- Ordre du peintre : `depth = camD + u` (le fond d'abord), départagé par l'écart au centre.
- **Décor** : tout ce qui est haut vit DERRIÈRE la route ; le premier plan (u < 0) ne porte que
  du bas, plafonné par `hauteurMaxPremierPlan(u)`. Règle : **rien qui ressemble à un obstacle ne
  doit être juste derrière la route** (de profil, la profondeur se lit mal).

## 3. Le gameplay en hauteur (`rows.js`, `regles.js`, `simulation.js`)

Une seule voie : plus de contournement, tout se règle en hauteur.

- **Saut à trois étages** : tap, appui maintenu (pesanteur réduite tant que le doigt reste posé
  ET que le cycliste monte, `sautGraviteTenue`, plafonné à `sautTenueMaxS`), re-tap en l'air =
  double saut. Réglages dans `config.js` (`saut*`).
- **Familles** : la famille de chaque espèce (tap / haut / double) est calculée par
  `familleDe` en intégrant les trois arcs au pire cas — la vitesse MINIMALE, car un obstacle
  est long en rangées. Tout ce qui roule est au double saut. `node outils/familles.mjs` les
  liste.
- **La route est une chaîne** : obstacle après obstacle, avec l'écart que la physique impose
  entre les deux espèces (`ecartMin` = retombée du premier + élan du second, à la vitesse
  locale `vitesseAuRang`). Espèces tirées de paquets fixes de 12, mélangés par la graine, selon
  la phase de course (`paquetPour`). Les groupes de piétons et le bouchon se posent par leurs
  propres règles.
- **Le sol** vaut `rows.solAt(v)` (halles, collines) et les toits se lisent par `toitSous` /
  `toitGare` : joueur, potes, simulation et pilotes de mesure s'y comparent tous.
- **Pièces** : une toutes les `ESPACEMENT` (3) rangées sur l'arc du saut au-dessus de chaque
  obstacle, à hauteur du buste ; pièce double au sommet d'un double saut ; aucune pièce sur le
  passage d'un véhicule ou d'un piéton (`balayageVisible`) — une pièce qu'un véhicule traverse
  quand même est cachée le temps qu'il passe. La brique de lait ne se pose jamais sur une
  rangée qu'un véhicule venu d'en face balaie à l'écran (mesuré avant : 32 briques sur 900
  traversées ; après : 0 — `outils/pieces-piegees.mjs`).
- **Vitesse** : doublement en `V_DOUBLING_S` jusqu'à `vitesseMax`, puis seconde accélération
  vers `vitesseFinale` sur les `accelDernieresS` dernières secondes.
- **Simulation** (`simulation.js`) : le score parfait d'une graine, affiché au menu et à la fin.

### Mesures (`node outils/mesurer.mjs 20`, 9 octobre 2026)

| Mesure | Valeur |
|---|---|
| Écart entre deux obstacles | 6 à 27 rangées, 0 paire plus serrée que le saut ne permet |
| Joueur idéal scripté | **0 obstacle touché sur 1 828** (20 graines) |
| Joueur immobile | 1 828 touchés sur 1 828 |
| Score parfait, 5 potes | 6 511 en moyenne (6 246 → 6 701, ±3,5 % selon la graine) |
| Arrivée des 5 potes (joueur idéal) | 4 · 10 · 24 · 37 · 50 s |
| Coût d'une image, CPU ×4 (`perf-plage.mjs`) | 6 à 7,5 ms selon la charge de la machine |

## 4. Domaine : `pote.la-ville-est-belle-pmc.fr` (à brancher)

Un domaine personnalisé GitHub Pages n'appartient qu'à UN dépôt, et l'apex est pris par le site du
premier jeu : la v2 passe par un sous-domaine.
1. **L'artiste** ajoute chez OVH, zone `la-ville-est-belle-pmc.fr` : `pote  CNAME  pmcmp3.github.io.`
2. Puis : `./outils/brancher-domaine.sh` — vérifie le DNS, écrit `public/CNAME`, passe `lienJeu`
   sur le domaine, redéploie, déclare le domaine à GitHub, attend le certificat, force HTTPS.
⚠️ Ne pas déclarer le domaine à GitHub AVANT le DNS : github.io redirigerait vers une adresse
qui ne répond pas. L'ancienne adresse github.io reste valable ensuite (redirection 301).

## 5. Base Supabase v2 (à créer)

La v2 ne parle JAMAIS à la base de la v1 (bêta en cours : classement, relais de la semaine et
événements pollués sinon). Tant que la base v2 n'existe pas, `apiBase`/`apiKey` sont vides : pas
de ligue réelle, pas de classement, pas de boost, pas d'événements ; la ligue de démo pédale
derrière le joueur.
1. **L'artiste** crée un projet Supabase `jai-un-pote-v2` (même région que l'actuel).
2. SQL Editor → coller et exécuter **`supabase/schema-v2.sql`** (consolidé, idempotent : tables,
   plafond par ligue, vues, événements, retours, ligues PMCMP et BETA).
3. `V2_URL=https://<ref>.supabase.co/rest/v1 V2_KEY=<clé anon> node outils/copier-ligues-v1-vers-v2.mjs`
   — recopie les ligues et leurs membres (pseudos, skins, ordre d'arrivée). Sans variables : simple
   lecture de la v1. Les SCORES ne sont pas copiés (graines d'une route qui n'existe plus).
4. Coller l'URL REST et la clé anon dans `public/config.js`, `./deploy.sh`.
5. Pour rallumer le fantôme : appeler `chargerFantome(l, graine)` dans `requestGameStart`
   (main.js) ; `net.fantome` et le dessin sont en place.
⚠️ Un projet gratuit se met en pause après 7 jours sans requête.

## 5 bis. Pièges de rendu

- **Un modèle = un `scene.groupe()`**. À l'intérieur, `drawBox`/`drawDisque`/`drawShadow`/
  `drawFlat` ne peignent pas : ils empilent, puis le groupe trie (plan séparateur entre deux
  cubes qui se recouvrent à l'écran, Kahn, repli sur la profondeur). Ne JAMAIS peindre en
  direct (ctx.fillText, stroke) dans un groupe : ça passerait avant tout le reste. Les
  groupes imbriqués se fondent dans le parent. Le cycliste (`voxrider`) n'est PAS groupé :
  son ordre manuel et ses traits (roues, cadre) tiennent.
- **Halles** : deux entrées dans la liste du peintre — « fond » à la profondeur du bord arrière
  de la route, « devant » à celle du bord avant. La caméra (3,6 u) est SOUS le plancher : on voit
  le dessous du plancher et du toit, jamais leur dessus.
- **Collines** : au-dessus de l'œil de la caméra, on voit la route par en dessous ; le flanc est
  peint AVANT ce qui roule (sinon il coupe les roues), et tout ce qui se tient sur la chaussée
  monte avec elle (`scene.avecLift`).
- **Masque du décor** (`scene.setMasqueDecor`, bits `SANS_LAMPE` / `DANS_HALLE`) : calculé
  dans main.js (où vivent les panneaux), mis en cache par rangée, vidé par `preparerJoueur`.
- `scene.js` ne peut pas importer `props.js` (cycle scene → props → rows → scene : `rows`
  lit `ROAD_HALF` au chargement). D'où l'injection `setDessinVoiture`.
- **Le canvas penché** : un objet qui lève au milieu d'un `save()`/`rotate()` laisse la matrice
  tournée pour toutes les images suivantes. D'où : index de couleur toujours entiers,
  `parseColor` qui rend du gris, matrice remise à zéro à chaque image et `try/catch` par objet.

## 6. Points ouverts

- Base Supabase v2 et sous-domaine : bloqués sur les actions de l'artiste ci-dessus.
- **Test sur un vrai téléphone** : clavier iOS dans Instagram, partage dans les navigateurs
  intégrés, lisibilité de profil, les sons — rien de tout ça ne se juge sans écran.
- Le ciel occupe beaucoup de hauteur en portrait (inévitable avec une largeur fixe en unités).
- `simulation.js` : le joueur idéal ne vise pas toutes les piles ; le score parfait varie de
  ±3,5 % selon la graine. Sans conséquence pour une ligue (même graine pour tous).

## 7. Le filet (`npm run verif`)

`outils/verif.mjs` enchaîne les tests du vrai jeu (Vite + Chrome sans tête, ou Node pur pour
`regles`) ; chacun finit par `verdict(ok, résumé)` (`outils/verdict.mjs`), qui écrit ✅ OK ou
❌ ÉCHEC et pose le code de sortie. Un test en échec est relancé une fois (Chrome sans tête est
parfois lent à démarrer) : s'il passe, il est signalé « instable » sans bloquer. Délai de 150 s
par test. `deploy.sh` refuse de mettre en ligne sur un échec.
- Les i/s d'un Chrome sans écran suivent la charge de la machine : le test `build` ne les
  affiche qu'à titre indicatif ; la fluidité est gardée par `perf` (ms par image à CPU ×4).
- `outils/rendu-identique.mjs [--reference]` : prouve qu'une réorganisation n'a pas changé
  l'image. `__pote.videoAuDepart(rappel)` (posé avant JOUER) fait jouer la course pas à pas
  dès sa première image, sur un départ toujours identique ; le test fige le hasard et
  l'horloge murale au départ, coupe les autres boucles d'animation, remet la phase de pédalage
  et le tirage des potes à zéro, puis compare 13 images (ligue de démo = même route) au pixel
  près. Vérifié sensible : la couleur de la route changée d'une unité → 12 images sur 13
  différentes.
- `outils/commentaires-seuls.mjs [réf]` : prouve qu'une retouche n'a changé que des commentaires
  (esbuild sans commentaires ni espaces, avant/après, identiques au caractère près).

---

# Héritage v1 (recopié de `ARCHITECTURE.md` §14, dépôt principal, 16 septembre 2026)

> Document d'époque, gardé pour les mécanismes hérités (horloge, audio, Supabase, conversion).
> Il parle de voies, de vue de dessus et de réglages qui ont changé depuis : **la première
> moitié de ce fichier, `CLAUDE.md` et le code font foi** quand ils le contredisent.

## 14. Jeu n°2 — « J'ai un pote » (`jai-un-pote/`, 4 septembre 2026)

Deuxième jeu, même site (**https://la-ville-est-belle-pmc.fr/jai-un-pote/**), sa propre racine
Vite (`npm run dev:pote` → port 5174, `npm run build:pote` → `dist-pages/jai-un-pote/`, enchaîné
par `deploy.sh`). Brief : « une variante en mode Zombie Tsunami [...] champêtre, route de
campagne, champs à gauche à droite [...] dès que j'ai assez d'étoiles, un pote se rajoute ;
quand je me prends des obstacles je perds des potes ; aller le plus loin possible avec le plus
de potes ». ⚠️ **Deux versions le même jour** : une première en perspective fuyante (fork du
moteur du premier jeu) rejetée en dix minutes de test (« pas la fausse 3D [...] je vois pas
comment faire juste sauter [...] injouable »), puis la version COURANTE, **vue 3/4 du dessus
façon Crossy Road** avec des choses qui traversent la route. Le portrait reste natif (un
navigateur ne peut pas forcer le paysage : pas de `screen.orientation.lock()` sur Safari iOS,
navigateur Instagram verrouillé portrait).

**Forké, pas partagé** : `jai-un-pote/src/` a ses COPIES de `audio.js`, `clock.js`, `voxel.js`,
`debug.js` — un changement sur l'un ne touche jamais l'autre jeu, qui est en concours.

| Module | Rôle |
|---|---|
| `iso.js` | **Vue 3/4 tournée de 30°** (6 septembre 2026, quatrième perspective : « 0° ce serait Subway Surfers, 90° Zombie Tsunami, j'aimerais 30°, un peu plus vers la verticale pour qu'on voie plus loin » — remplace le 45° dimétrique de Crossy Road du 4 septembre). `x' = u·cos30 + v·sin30`, `y' = −u·sin30 + v·cos30`, `sx = ancre + x'·K`, `sy = ancre − y'·K·0,62 − h·K·0,92`. La route file vers le haut-droite, plus dressée ; ~20 rangées visibles devant (`ROWS_AHEAD` 24, `UNITS_ACROSS` 14). Ordre du peintre : profondeur = `y'`. `drawBox()` = cube 3 faces, `drawFlat()`, `drawShadow()`. **Nuit** (`setNight`, 0..1) : sol et cubes assombris (`nightShade`), brume qui vire au bleu nuit, étoiles, lampadaires à GAUCHE de la route (tous les 6 rangées) qui s'allument, halos peints par main.js (`lampsIn`). **Boue** : `renderRow(ctx, r, boue)` peint une flaque brune sur la voie boueuse. `rowDecor(ctx, r, clear)` : `clear` vide le décor des rangées traversées (« pas d'arbres sur le trajet du tracteur »). Panneaux de village `drawSign(ctx, r, village)` **à GAUCHE**, 30 % plus grands, Cysoing en premier ; le texte est posé sur la FACE AVANT du cube par `ctx.transform` (base = vecteurs écran de la face), donc dans la perspective de la route. |
| `rows.js` | Une rangée `r` = fonction pure de l'index + graine, SAUF l'armement des traversées : `safe` (pièce 40 %, ou brique de LAIT tous les 48 rangées, ou pièce ROUGE tous les 70, ou flaque de BOUE de 3 rangées sur une voie), `statique` (poule, chat, chien, mouton, botte, cochon, vache, fermier, voiture garée) ou `traverse` (**tracteur** ou **poule lancée** par un fermier au bord). ⚠️ **Traversée ARMÉE sur le passage du joueur** (6 septembre : « il faut vraiment qu'il traverse quand on est là ») : `armer(row, now, tArrivee)` est appelé par main.js 2,6 s avant l'arrivée prévue du joueur (`armerTraversees`, à la vitesse EFFECTIVE, turbo compris) ; le traversant part hors champ (±(ROAD_HALF+6)) et vise une colonne `cible` à l'instant où le joueur franchit la rangée (vitesse bornée 1,8..9). Mesuré headless : écart ≤ 1,8 unité sur la voie visée. La boue (vitesse ×0,5) désynchronise volontairement. **40 rangées de grâce** (~9 s, « laisse vraiment du temps au début »), densité 12 % → 42 % sur 1 000 rangées. `checkMember` émet `piece` / `lait` / `rouge` / `obstacle`. |
| `props.js` | Obstacles en cubes. Tracteur avec **poussière** derrière et **phares** la nuit ; `drawLanceur()` = fermier au bord qui tient une poule puis la lance (`poulelancee`, vol en arc, se saute) ; chats gris/blanc/noir et chiens brun foncé/noir (« trop proches des pièces » en orange/fauve). |
| `coin.js` | Pièce **jaune unie** (`config.piecesLogo` false : « enlève les dessins pour l'instant » — le pictogramme reste dans le code) ; `drawCoin(ctx, R, spin, rouge)` : la pièce ROUGE a un halo « soleil » et vaut un pote direct. |
| `sfx.js` | **Bruitages synthétisés** (aucun fichier) sur le contexte du morceau via `audio.sfxOutput()` (derrière le curseur de volume) : pièce, pote qui arrive (bruit d'herbe filtré + montée), pote perdu, saut, salto, lait, pièce rouge, fin. Gains 0,04–0,12 : sous l'instrumental. (Le klaxon à l'armement est remplacé par ceux de `ambiance.js`, 4 octobre 2026.) |
| `bruitages.js` | **Le sound design** (4 octobre 2026, nuit), tout synthétisé et **accordé sur la pentatonique de sol** (le morceau est en mi mineur / sol majeur : `n("E5")`, `surGamme(f)`), plus la voix « pfff, aïe » du joueur (`aie()`, fichier `config.fichierAie` via `audio.echantillon`) : voix d'animaux (source à contour de hauteur → FORMANTS), cloches/tôle/quilles en PARTIELS, klaxons saturés, grains (roue libre, neige, lattes), couches continues (`couche` : roulement, vent, blizzard, vagues, jet, grondement et freins du TER, boules) et moteurs (`moteur`). Chaque son = fonction pure (contexte, sortie, instant, options) : `jouer(nom, {pan, volume, etouffe, ambiance})` en direct, `rendre()` hors ligne pour `outils/bruitages.mjs`, qui cale `NIVEAUX` sur `CIBLES` (LUFS visés, le morceau est à −9,9). `choc(kind)` = le cri de ce qu'on percute. |
| `ambiance.js` | **Ce qui sonne en continu**, réglé à chaque image par main.js (`pas(dt, etatSon())`) : vélo (surface sous les roues, roue libre en l'air, vent, jetpack), klaxon/sonnette quand un véhicule ou un piéton ENTRE à l'écran + son moteur (pan, Doppler), bêtes qui crient en nous voyant, TER (`scene.decalageTrain`), quilles (`scene.phaseQuilles`), oiseaux/grillons/chouette/meuglement/cloche/blizzard/vagues/mouettes selon le décor. ⚠️ audio.js recrée son graphe à chaque reprise : bus propre, rebranché sur le `volumeGain` courant ; tout s'éteint 2,5 s après l'arrêt de la course. |
| `input.js` | Swipe gauche/droite = colonne, tap = saut au RELÂCHER, swipe haut = saut. ⚠️ **En l'air, le tap part au TOUCHER** (`setAirborne`, « le double saut n'a pas marché ») : zéro latence pour le salto. |
| `friends.js` | Peloton derrière le joueur (`SPACING` 0,95), **chaque pote choisit sa voie** (7 septembre 2026 : « qu'ils naviguent entre les lignes, et qu'ils réussissent TOUJOURS à éviter les objets ») : `voiesBloquees()` regarde 3 rangées devant (statiques, boue) et le pote change de voie avant tout obstacle ; sinon il se balade toutes les 1,5–4,5 s vers une voie libre. Mesuré headless : 0 chevauchement pote/obstacle sur 3 782 échantillons. Il saute là où le joueur a sauté. Aucun dégât. Prénoms `config.potesNoms` : le premier ABSENT du peloton (plus de doublon « @soberland » ×2 après une perte). |
| `voxrider.js` | Cycliste en cubes. **Salto = vraie rotation à l'écran** (l'ombre est dessinée AVANT la rotation, elle reste au sol ; les fantômes n'en ont pas) (`ctx.rotate` autour du centre du vélo, un tour en 0,5 s) + traînée fantôme (`ghosts`, main.js) — l'ancienne version déplaçait les cubes sur un cercle, illisible. |
| `hud.js` | **Trois étages qui ne se chevauchent jamais** (7 septembre 2026, « en haut tout se marche dessus ») : pause + barre SALTO à gauche (sous le bouton), mètres (taille réduite à 4 chiffres) + chrono + pastille ×N au centre, potes + jauge à droite ; bandeau d'événement à `safeTop + 150`. `safeTop` = encoche iPhone mesurée via `#safe-probe` (index.html). Textes ajustés à la largeur (`fitFont`). Plus de popups « +4 m » / « POTE DANS N », plus de sous-titre sur les bandeaux, dégâts = popup « −1 POTE » au-dessus du joueur, salto sans bandeau. **Bandeau sombre** derrière le HUD (illisible sur le fond clair sinon), mètres, **chrono** du contre-la-montre (rouge sous 10 s), pastille ×N (+ « TURBO »), potes + jauge « PROCHAIN POTE : N PIÈCES », barre « SALTO PRÊT », `renderTuto`, `renderTurbo` (flou de vitesse : bandes + traits sur les côtés ; couleurs saturées par CSS `canvas.turbo`), `renderFin` (« TERMINÉ ! »). Plus de `shadowBlur` (cher sur mobile) : contours par `strokeText`. |
| `screens.js`, `index.html` | Chargement ≥ `config.chargementMinS` (5 s) de 0 à 100 % avec étapes nommées, jamais au-delà du réel (morceau 70 % + préchauffage 30 %, `setPrechauffage`) ; compteur `jaipParties` (tuto) ; écran de fin : sticker « Nouveau record » en haut à droite de la carte, en-tête « Course terminée » / « Ta course », « Tu n'as pas eu de potes sur cette partie ? Tu prends des pièces pour les appeler. », crédit « J'ai un pote, composé par PMC MP3 » (lien Instagram). |

**Règles (config.js, 6 septembre 2026)** : ⚠️ **CONTRE-LA-MONTRE** : la course dure le morceau
(`dureeMorceau` 173,65 s, `boucleMorceau: false` — audio.js ne boucle plus), sa fin = « TERMINÉ ! »
(roue libre 1,5 s, accord, écran de fin « Course terminée »), sauf mort avant. Score = mètres ×
(1 + 0,25 × potes) × (2 sous turbo) ; vitesse 4,4 → 9,4 rangées/s (doublement 70 s) ; pièce =
+4 m × mult ET un pas vers le prochain pote, paliers `potesPaliers` **5, 12, 20, 30, 42, 56, 72,
90** pièces (« mets les potes plus faciles ») ; **pièce rouge** = un pote direct (+40 m × mult si
le peloton est plein) ; **brique de lait** = 5 s à ×2 vitesse et ×2 mètres, flou latéral,
couleurs saturées, **et aucun obstacle** (`rows.ouvrirFenetreSure` rend sûres les rangées au-delà de
l'écran, invulnérabilité pour celles déjà visibles — « sinon personne ne voudra aller plus vite ») ; **boue** = voie à ×0,5 au sol (on la saute) ; **élan** du salto : recharge
en 2,5 s + 0,25 par pièce (`elanParPiece`). **Nuit** à partir de `nuitDebutS` = 95 s (30 s de
transition). **Tutoriel** sur les `tutoParties` = 2 premières parties : 4 consignes au tout
début (swipe, tap, re-tap, pièces), validées par le geste ou passées après 6 s. Vibrations
Android (`navigator.vibrate` : pote, perte, mort, salto, lait) — **rien sur iPhone**, Safari
n'expose pas l'API. **Score max théorique** (simulation Node sur 40 graines, run parfait :
toutes les pièces, tous les laits, jamais un pote perdu) ≈ **31 600 m** ; un joueur réel qui
garde ses 8 potes fait ~10 000–15 000 m.

**Morceau** : « J'ai un pote », 85 BPM, premier temps à 0,04 s, MP3 96 kbps (2,1 Mo). Boucle de
mort = 16 temps = 11,294 s. Les traversants sont calés sur le JOUEUR, pas sur le tempo.

**Menu** : titre, champ, une phrase. **Tiroir album** unifié (mort, REJOUER, ÉCOUTER L'ALBUM).
**`?zero`** efface tout le localStorage (les deux jeux). Touches de debug avec `?debug` : **P**
+1 pote, **O** −1, **G** mourir, **I** invincible, **L** turbo lait, **N** nuit, **F** fin du
morceau ; `window.__pote` expose player/game/rows/friends/clock aux scripts headless.

**Mobile** : DPR plafonné à 1,5 sous 600 px, pas de `shadowBlur`, décor 4 éléments par côté et
par rangée, préchauffage pendant le chargement (`prechauffer()` : 400 rangées hachées, chaque
prop et chaque cycliste dessinés une fois hors écran).

**Pièges déjà vus** : `MutationObserver` sur `disabled` (gelait la page) ; ordre du peintre sur
le bord proche ; `window.CONFIG` est GELÉ (les touches de debug passent par des variables
locales). Captures headless via Playwright + Google Chrome (`channel="chrome"`), scripts
`pote-v6/v7/v8.py` dans le scratchpad de session.

**Ligues entre potes** (7 septembre 2026 : « une compétition avec les gens qu'on connaît, un
code de ligue [...] si E joue, toutes les autres lettres rejoignent sa partie ») : `net.js` +
`supabase-migration-ligues.sql` (tables `ligues`, `ligue_membres`, `ligue_scores`, vue
`ligue_classement` = meilleure course par pseudo ; même projet Supabase que le premier jeu,
`config.apiBase`/`apiKey`). Menu : champ CODE + REJOINDRE, « Créer ma ligue » (code 5 lettres
sans O/0/I/1), bloc « Ligue XXXXX · tes potes : @… », INVITER (partage natif du lien
`?ligue=CODE`, `config.lienJeu`), QUITTER. Ligue mémorisée (`jaipLigue`). ⚠️ **Le lien d'invitation SUFFIT** (7 septembre 2026, deuxième passe) : `?ligue=CODE` inscrit la
personne d'office (bloc « Tu en fais partie ! Écris ton pseudo et appuie sur JOUER »), l'adhésion
part au JOUER avec le pseudo. **6 personnes max** (`net.LIGUE_MAX`, vérifié côté client ET par
un trigger SQL). Au JOUER / REJOUER, `preparerLigue()` rafraîchit les membres et
`friends.setNomsLigue()` fait des AUTRES membres LES SEULS potes du peloton : en ligue, plus de
Soberland/Jules…, et `friends.max()` = nombre d'autres membres (0 → HUD « INVITE TES POTES »).
Sans ligue, prénoms par défaut et 8 potes. Boutons INVITER DES POTES (menu et fin) avec les
icônes WhatsApp/Instagram/Messages/Snap comme sur le premier jeu — le partage natif
(`navigator.share`) liste ces apps ; repli presse-papiers. À la fin, `finLigue()` envoie le score
et affiche le classement de la ligue (8 lignes, la sienne surlignée) + « DÉFIER LA LIGUE ».
⚠️ **La migration SQL doit être exécutée par l'artiste dans le dashboard Supabase** ; tant
qu'elle ne l'est pas, les appels renvoient 404 en silence (« Cette ligue n'existe pas »,
« Impossible de créer la ligue »), le jeu tourne avec les prénoms par défaut.

**Lumière** (7 septembre 2026) : soleil en haut à droite → face u_max éclairée (−10), face v_min
à l'ombre (−38), dessus +26 ; ombres portées décalées vers le bas-gauche. **Boue** = bande
claire + deux ornières sombres sur toute la rangée (lignes continues, plus des carrés).
**Pédalage** : hauteur du pied ~ cos, avance ~ sin (sens de la marche ; l'inverse « pédalait à
l'envers »).

**Troisième passe du 7 septembre 2026 (test WhatsApp)** : voies **+20 %** (`COL_W` 1,5,
`ROAD_HALF` 2,25) ; route **plus haute** (`ANCHOR` 0,48 ; 0,65, `ROWS_BEHIND` 13 — « le bas de la
route dans l'angle, monte-la au niveau des yeux ») ; peloton **espacé** (`SPACING` 1,5) ; **moins
d'informations** : pièces sur 25 % des rangées sûres et jamais juste après un danger, plus de
pièce sur une rangée d'obstacle, danger 10 % → 30 % (mesuré : 157 pièces et 130 dangers sur
1 000 rangées, contre ~330 / ~250), toujours 3 rangées sûres entre deux dangers, décor 3 éléments
par côté ; **vitesse** : `vitesseMax` 2,6 (au lieu de 3,6) et turbo lait **+20 %** de vitesse
(`laitVitesse`, les mètres restent ×2) ; **clés de conversion propres au jeu 2**
(`jaipMorceauOuvert`, `jaipPmcSuivi`, `jaipPlateformeAlbum`) : un joueur « libre » sur le premier
jeu repasse par l'album ici ; écran de fin : « Au bout du morceau avec N potes ! » / « Tombé avant
la fin du morceau ». Score max théorique recalculé : **≈ 12 600 m**. Migration SQL rendue
idempotente (`drop policy if exists`) après une première exécution interrompue à mi-chemin.

**Quatrième passe du 7 septembre 2026 (« mettons tout ça en place »)** — tout le plan de campagne
(artefact « Plan J'ai un pote ») est dans le code :
- **Menu en trois étapes** (ordre demandé : inscription → ma ligue → mon cycliste) : `#onboarding[data-step]`,
  `setStep()` (screens.js). Étape 1 : pseudo, Instagram, ville (facultatifs, clés `jaipInsta`/`jaipVille`).
  Étape 2 : le bloc ligue, « Continuer sans ligue ». Étape 3 : aperçu du cycliste dessiné par le vrai
  moteur (`renderApercu`, main.js — viewport emprunté à 700 px pour K ≈ 50), chips de personnalisation,
  barre de chargement, JOUER, SPRINT DU DIMANCHE. Un habitué arrive à l'étape 3, une invitation à l'étape 2.
- **Skins** (`rider.js` : `COULEURS`, `SHORTS`, `CHAUSSURES`, `CHAPEAUX`, `VELOS`, `SKIN_DEFAUT`,
  `paletteDepuisSkin`) : t-shirt (6 couleurs), motif uni/rayé/carreaux, short, chapeau (casquette, bob,
  paille, aucun), chaussures, vélo **VTT ou Grand Bi** (grande roue avant, cycliste 0,4 plus haut —
  voxrider.js). Clé `jaipSkin`, envoyé dans `ligue_membres.skin` (JSON) : les potes te voient avec ton vélo.
- **Ligue de démo** `PMCMP` : Paul, Léa, Marius, Inès, Hugo avec leurs skins (`config.potesDefaut`,
  insérée par la migration). Sans ligue, c'est ELLE qui pédale derrière le joueur (`potesMax` 5).
- **Biome village** (`iso.js`, zone `village` entre tournesols et forêt) : maisons (1 sur 3 rangées par
  côté), voitures garées (1 sur 5), skateur qui roule sur place (1 sur 9). À l'entrée, un panneau porte la
  VILLE du joueur (`iso.setVille`, `debutVillage`) : il traverse sa propre ville.
- **Service worker** (`public/sw.js`, enregistré hors localhost) : précache page, config, MP3, polices ;
  réseau d'abord pour la page et config, cache d'abord pour le reste. `CACHE = "jaip-v1"`.
- **Sprint du dimanche** (`config.sprintDureeS` 60) : bouton visible le dimanche à partir de midi
  (`net.sprintOuvert`), graine = date (`graineSprint`), une tentative par jour (clé `jaipSprint`, honneur),
  score envoyé avec `mode: "sprint"`, classement du jour toutes ligues confondues sur l'écran de fin
  (« · une place » pour les 5 premiers). REJOUER après un sprint = une vraie course.
- **Relais de ligue** (`config.relaisDistance` 30 000) : vue `ligue_relais` (mètres cumulés depuis le lundi),
  affiché sous le classement de ligue. **Vagues** : `net.creerLigue` refuse au-delà de
  `config.liguesParVague` (5) ligues créées dans la semaine (« la tienne démarre lundi »).
- **Préinscription concert** (`#concert-sheet`) : proposée UNE fois, 2,6 s après la première course arrivée
  au bout du morceau ; table `preinscriptions_concert`, compteur `count=planned`, clé `jaipPreinscrit` ;
  ligne « Concert : 50 places à gagner · N préinscrits » sur l'écran de fin.
- **Événements du funnel** (`net.evenement`, table `evenements`) : arrivee, inscription, premiere_course,
  course_finie, invitation_envoyee, invitation_acceptee, clic_album, preinscription — avec pseudo, source
  (`?src=`, clé `jaipSource`) et ligue.
- Migration `supabase-migration-ligues.sql` complétée (deuxième partie idempotente : colonnes skin/mode,
  ligue de démo, vues classement/relais, tables evenements/preinscriptions_concert).

**Cinquième passe du 8 septembre 2026 (retours téléphone)** : **Helvetica** pour tout le texte courant
(`--police`, `POLICE` du HUD ; Stage Grotesk n'est plus déclarée ni chargée) et la **Source Serif** partout
où ça compte (titres du tuto et des bandeaux, « terminé ! » en minuscules condensées ×0,66 comme le titre,
score, chrono) ; tailles en `clamp()` ; **overlay du menu qui défile** et CTA « L'album est sorti » dans le
flux (la carte « Mon cycliste » débordait sur iPhone) ; **tuto strict** : une étape n'avance QUE sur le
geste (garde-fou 25 s), vitesse ×0,55 et route sûre tant qu'il tourne ; **le concert s'annonce au DÉBUT**
de la course (bandeau « 50 places de concert à gagner », après le tuto ou à 1,5 s), la feuille de fin ne
dit plus que « Une place de concert ? Un tap, tu es préinscrit » ; **écran de fin allégé** : score,
« Au bout du morceau · 3 potes », classement de ligue (6 lignes), « Relais : x / 30 000 m », REJOUER,
INVITER DES POTES, « Écouter l'album » en lien, « Concert : préinscrit · N », « @pmc.mp3 » ; **village
refait** (`decorVillage`, iso.js) : emplacements fixes par rangée de la tranche (rien ne se marche
dessus) — petites maisons près de la route (1 sur 4), grandes maisons à deux étages au fond avec
balcon et quelqu'un dessus (1 sur 5), **église** avec clocher et croix au milieu (rz 27, à gauche),
**école** avec cour et enfants (rz 12, à droite), voitures garées (1 sur 6), skateur, passants.
Comptage des préinscrits en `count=exact` (planned renvoyait 400 sur une table vide). ⚠️ **La migration
est passée** : ligues réelles en base (UKMVV pol/pims, scores, skins) — ne plus créer de ligue de test,
chaque création compte dans le plafond hebdomadaire de 5.

**Sixième passe du 9 septembre 2026 (retours à l'oral : 5 voies, tracteurs, potes, une course par
ligue, score parfait, fantôme)** :
- **5 voies** (`iso.js` : `COLS` 5, `COL_W` 1,35, `UNITS_ACROSS` 16, `COL_CENTRE` = 2) — « la même
  logique que Crossy Road [...] il n'y a que trois voies, fais la même chose avec cinq ». La route
  fait 6,75 unités (4,5 avant), le champ est élargi pour qu'elle tienne à l'écran (K = W/16). Plus
  aucun `[0, 1, 2]` en dur : friends.js prend `COLS`, le joueur démarre au centre.
- **Tracteurs ralentis** : `KINDS.tracteur.vmax` 3,2 u/s (plafond d'`armer()`, 9 avant) et
  `ARM_AHEAD_S` 2,6 → 4,0 s (main.js) : la traversée part plus tôt, donc plus lentement, et reste
  calée pour croiser le joueur. La poule lancée garde son plafond de 9.
- **Potes plus loin** : `config.potesRecul` 3,0 (premier pote derrière le joueur, 1,5 avant) et
  `config.potesEcart` 1,6 (friends.js, `vDuSlot`).
- ⚠️ **GÉNÉRATEUR À QUOTAS** (`rows.js`, classe `Route`) : la route est hachée par BLOCS de 24
  rangées — nombre EXACT de dangers par bloc (diffusion d'erreur sur la courbe p/(1+3p), 7,7 % →
  15,8 %), espèces tirées d'un PAQUET fixe de 12 mélangé par la graine (trois paquets selon la
  phase : doux, gros animaux, tracteurs doublés), pièces = quota exact de 25 % des rangées
  éligibles, boue = une flaque de 3 rangées tous les deux blocs, lait/rouge sur des rangées
  RÉSERVÉES (24 + 48k, 40 + 70k — la rangée 600 cumule les deux, le lait gagne, pour tout le
  monde). Mesuré (13 graines × 1 100 rangées) : 134-135 dangers, 22 laits, 15 rouges, 63 rangées
  de boue, chaque espèce à ±1, écart ≥ 3 entre dangers, 0 pièce après un danger, 0 danger dans
  la grâce. ⚠️ `rows.js` est une CLASSE : l'instance `live` sert le jeu via l'API historique
  (`rowAt`, `reseed`, `reset`…) ; `simulation.js` crée ses propres `Route` et ne touche jamais
  au parcours en cours.
- ⚠️ **UNE LIGUE = UNE COURSE** (`regles.graineLigue(code)` = hash de `CODE#v{VERSION_COURSE}`,
  `semerCourse()` dans main.js) : tous les membres jouent la même route ; sans ligue, graine
  aléatoire ; le sprint garde sa graine du jour. **`VERSION_COURSE` (regles.js) à incrémenter
  dès que le générateur ou les règles changent la route** : le classement et le fantôme d'une
  ligue sont filtrés sur la graine (`net.classement(code, graine)` agrège `ligue_scores`
  côté client ; la vue `ligue_classement` ne sert plus qu'en repli), donc une nouvelle version
  repart sur un classement vierge sans rien effacer.
- **Score en « pts »** (HUD, écran de fin, classement, relais, partage) : tout le monde fait la
  même distance sur la même course, ce qui départage c'est les potes gardés et les pièces —
  « ça ne peut pas être le nombre de mètres ». La colonne Supabase reste `metres`.
- **Score PARFAIT** (`simulation.js`, `scoreParfait(graine, potesMax)`) : rejoue la course avec
  les formules partagées de `regles.js` (`targetSpeed`, `multiplicateur`, `dureeCourse` =
  morceau − GO ≈ 170,1 s), joueur idéal (toutes les pièces, laits, rouges, jamais un pote
  perdu, jamais freiné) mais soumis au tween de voie. ~4 ms. Dépend du nombre de potes
  possibles = les AUTRES membres : affiché dans le bloc ligue du menu (« score parfait N pts »)
  et sur l'écran de fin (`#end-max`, « tu es à N % »). Ordres de grandeur : ~3 850 pts seul,
  ~5 700 avec 2 potes, ~8 400 avec 5 potes (±1,5 % selon la graine).
- **FANTÔME** (`fantome.js`) : la course du joueur est échantillonnée à 10 Hz (u, v, hauteur,
  quantifiés, ~15 Ko pour 170 s) et envoyée avec le score SEULEMENT si elle bat le record de
  la ligue sur cette route (`screens.finLigue` compare au classement avant d'envoyer). Au
  départ d'une course de ligue, `net.fantome(code, graine)` charge la meilleure trace et
  main.js dessine le cycliste en transparence (alpha 0,38, sans ombre, étiquette « @pseudo ·
  fantôme »), position interpolée sur `now`. Le premier du classement de fin est marqué
  « · fantôme ». Harnais : `window.__pote.injecterFantome(pts, pseudo)` avec `?debug`.
- ⚠️ **Migration SQL, troisième partie** (`supabase-migration-ligues.sql`) : colonnes
  `ligue_scores.graine` et `ligue_scores.trace` + index. **À exécuter AVANT de déployer** : sans
  elles, `net.envoyerScore` se replie sur un insert sans graine ni trace (PostgREST refuse
  une colonne inconnue — vérifié : 400 sur `?graine=eq.1` tant que la colonne manque), le
  classement retombe sur la vue, et le fantôme n'existe pas.
- Service worker `CACHE = "jaip-v2"`.

### 14.x Bêta fermée (16 septembre 2026)

Une ligue unique **`BETA`** pour le groupe WhatsApp de fans, plus un canal de retours écrit
dans le jeu. Migration : **`jai-un-pote/supabase-migration-beta.sql`**, à exécuter AVANT de
déployer (sinon la ligue n'existe pas → « Cette ligue n'existe pas », et les retours ne
partent pas — le tiroir affiche « Pas parti, réessaie », vérifié).

- **Le lien fait tout** : `https://la-ville-est-belle-pmc.fr/jai-un-pote/?ligue=BETA` met le
  joueur dans la ligue (adhésion au JOUER, `preparerLigue`) et **allume le mode bêta**. Le mode
  ne dépend d'aucun réglage global : il s'allume si et seulement si la ligue courante est
  `config.ligueBeta` (`screens.enBeta()`), donc **les autres visiteurs gardent le jeu normal**.
  Il survit au rechargement (la ligue est en localStorage) et s'éteint par « Quitter la ligue ».
- **Menu réduit** : pseudo (sans Insta ni ville) → cycliste → JOUER. L'étape 2 « ma ligue »
  n'existe plus (`setStep` renvoie 2 → 3), le sprint du dimanche est masqué, la proposition de
  concert ne sort pas, et **le tiroir album ne barre plus rien** (`exigerConversion` passe) :
  un testeur doit pouvoir enchaîner les parties. Masquage par `body.beta .beta-off`.
- **Plafond de ligue par ligue** : colonne `ligues.plafond` (défaut 6), lue par le trigger
  `ligue_plafond()` ; `BETA` est à 60. `net.membres` remonte à 200 lignes.
  ⚠️ `friends.max()` est désormais **plafonné à `config.potesMax`** : sans ça, une ligue de 40
  testeurs aurait fait un peloton de 40 et un score parfait absurde. Sans effet sur une ligue
  ordinaire (6 membres → 5 autres = potesMax).
  ⚠️ Corrigé au passage dans `net.rejoindreLigue` : le test « suis-je déjà membre ? » comparait
  des objets `{nom, skin}` à une chaîne (`avant.includes(pseudo)`), donc un membre qui revenait
  dans une ligue pleine se voyait répondre « complète ».
- **Retours** (`#retour-sheet`, table `retours_beta` insert-only, jamais relue par le jeu) :
  bouton « Laisser un retour » sous REJOUER sur l'écran de fin → carte avec champ libre →
  Envoyer (ou Entrée ; Maj+Entrée = retour à la ligne) → **confirmation dans la même carte**
  (pas un second pop-up qui se referme tout seul). Part avec pseudo, score/potes/fin de la
  course qui vient de finir (`derniereCourse`, posé par `showEndScreen`), numéro de partie et
  user-agent. Échec réseau → « Pas parti, réessaie », le texte reste à l'écran. Lecture : Table
  editor Supabase, `retours_beta` triée par date.
- Classement de fin : 12 lignes en bêta au lieu de 6.
- ⚠️ **`retours_beta` est INSERT-ONLY : illisible avec la clé anon** (aucune policy de
  lecture). Une requête REST de vérification renvoie donc toujours `[]`, même quand la table
  est pleine — piège vécu le 16 septembre, conclusion « la table est vide » alors que
  l'insert répondait 201. Les retours se lisent dans le **Table editor Supabase**, nulle part
  ailleurs. (`ligue_membres`/`ligue_scores`, eux, ont bien une lecture publique.)
- ⚠️ **Le peloton n'est plus indexé sur la taille de la ligue** (16 septembre 2026,
  renversement du 7 septembre) : première course de bêta, l'artiste seul inscrit dans `BETA`
  → `friends.max()` valait 0, aucun pote de toute la course, `potes: 0` en base (vérifié), jeu
  vide et sans enjeu. `listeMembres()` complète désormais les membres de la ligue par
  `config.potesDefaut` jusqu'à `config.potesMax` (membres d'abord), et `max()` vaut toujours
  `potesMax`. `screens.afficherLigue` calcule donc le score parfait sur `potesMax`.
- ⚠️ **5 membres TIRÉS AU HASARD par course** (16 septembre 2026, « oui, 5 personnes
  aléatoires à chaque fois ») : le peloton n'a que `potesMax` places pour une ligue de bêta
  qui peut compter 60 personnes — sans tirage, tout le monde verrait éternellement les 5
  premiers inscrits. `tirerSelection()` (friends.js) mélange les membres à chaque `reset()`
  et à chaque `setNomsLigue()`, complète avec `potesDefaut`, et la sélection est FIGÉE
  pendant la course. Non seedée, volontairement : les prénoms ne touchent pas au gameplay,
  la route reste celle de la ligue. Vérifié : 5 tirages successifs sur 12 membres donnent 5
  pelotons différents.
- ⚠️ **Le concert et ses « 50 places » sont SUPPRIMÉS partout** (16 septembre 2026, demandé :
  « enlève les 50 places gagnées au début, partout ») : bannière de départ (`annoncerConcert`,
  main.js), carte de préinscription (`#concert-sheet`), ligne de l'écran de fin
  (`#end-concert`), mention « une place » du sprint, `config.concertPlaces`,
  `net.preinscrire`/`nbPreinscrits`. La table `preinscriptions_concert` reste en base, sans
  écriture. Ce que gagne le premier de ligue n'est plus annoncé : c'est justement une des
  trois questions posées aux bêta-testeurs.
- Champs de saisie forcés en `-webkit-user-select: text` : `body` est en `user-select: none`,
  ce qui peut empêcher le curseur dans un `textarea` sur certains WebKit iOS (piste du
  « j'ai pas réussi à mettre mon retour »).
- Échec d'envoi d'un retour : le tiroir affiche le **détail** (statut HTTP + message
  PostgREST), plus un « Pas parti » muet.

**Reste à faire** : exécuter la migration (troisième partie) côté Supabase, déployer
(`./deploy.sh`), tester sur téléphone (lisibilité de la route à 5 voies, vitesse des tracteurs,
distance des potes), distribution effective des places (hors jeu), vérification du sprint un
dimanche.
