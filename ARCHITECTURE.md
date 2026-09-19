# ARCHITECTURE — « J'ai un pote v2 » (vue de profil, une voie)

Rédigé le 19 septembre 2026. Ce fichier décrit ce que la v2 CHANGE. Tout le reste (ligues, bêta,
fantôme, skins, tiroir album, audio, écrans) est hérité tel quel de la v1 et documenté dans la
seconde moitié : « Héritage v1 », recopié de `ARCHITECTURE.md` §14 du dépôt
`pmcmp3/la-ville-est-belle` au commit `9e591d2`. Là où l'héritage parle de `iso.js`, de voies,
de swipe latéral ou de file indienne, c'est ce fichier-ci qui fait foi.

## 1. Où ça vit

| Quoi | Où |
|---|---|
| Code | `/Users/pmc/Documents/PMC/JAI-UN-POTE-V2/` — projet autonome, rien de partagé avec le dépôt du premier jeu |
| Dépôt | **`pmcmp3/jai-un-pote-v2`** (public, obligatoire pour GitHub Pages gratuit). Branche `main` = historique normal, `gh-pages` = build |
| En ligne | **https://pmcmp3.github.io/jai-un-pote-v2/** ; sous-domaine prévu `pote.la-ville-est-belle-pmc.fr` (voir §4) |
| Base | **Aucune pour l'instant** : `apiBase`/`apiKey` vides dans `config.js`, le jeu tourne sans ligue (voir §5) |
| Dev | `npm run dev` → port 5175 (LAN) ; lanceur `.claude/launch.json` « pote2 » |
| Déploiement | `./deploy.sh "message"` : commit + push `main`, build, `gh-pages` orphelin dans un worktree. Pousse avec le compte `pmcmp3` via `gh auth token --user pmcmp3`, sans changer le compte actif du poste |

Isolement de la v1 (où tourne la bêta fermée) : clés `localStorage` préfixées **`jp2`** (au lieu
de `jaip`), cache du service worker **`jp2-v1`**, **`VERSION_COURSE = 3`** (regles.js : graines de
ligue différentes de la v1), aucun appel à la base de la v1.

## 2. La perspective : `scene.js` (remplace `iso.js`)

Un sténopé posé à côté de la route, à `cameraDistance` (11) unités de son axe et
`cameraHauteur` (3,6) unités de haut, qui regarde perpendiculairement à la route :

```
s = K · camD / (camD + u)        x = W/2 + (v − vCentre) · s        y = horizon + (camH − h) · s
```

- Le monde reste en **(u, v, h)** : u = profondeur (0 = la route, + = le fond, − = la caméra),
  v = avance, h = hauteur. Seule la projection change : les modules qui dessinent en cubes
  (`props`, `voxrider`, décor) n'ont été que réorientés, pas réécrits.
- **Même contrat d'exports qu'`iso.js`** (project, depth, drawBox, drawFlat, drawShadow, rowDecor,
  drawSign, lampsIn, renderGround, renderHaze, setViewport, setCamera, setNight…), plus
  `setJoueurX`, `echelle`, `drawDisque`, `unitesDevant`, `demiLargeurRoute`, `getVCentre`.
- **Parallaxe gratuite** : le fond est plus petit et défile moins vite, le premier plan grossit.
- `K = min(W / unitesVisibles, H / 11)` : la largeur visible est fixe en unités (même temps de
  lecture pour tous en portrait), plafonnée par la hauteur sur un écran couché.
- **Caméra qui prend de l'avance** : le joueur passe de 30 % à 25 % de la largeur quand la
  vitesse monte (`cameraJoueurX`). Lecture devant soi : **10,2 unités au départ (2,3 s), 10,9 à
  vitesse max (1,6 s)**.
- Faces vues d'un cube : l'avant (vers la caméra), le dessus, et UN côté selon que le cube est à
  gauche ou à droite du centre de l'écran (vraie perspective). Couleurs (nuit + brume de distance)
  mises en cache par couleur × profondeur × nuit.
- Ordre du peintre : `depth = camD + u` (le fond d'abord), départagé par l'écart au centre.
- **Décor** : tout ce qui est haut vit DERRIÈRE la route. Les deux rives de la v1 sont repliées
  sur deux plans du fond. Le premier plan (u < 0) ne porte que du bas (herbes, épis, fleurs,
  clôture), plafonné par `hauteurMaxPremierPlan(u)` : rien ne cache jamais la route.
- Fond : ciel dégradé, soleil (lune et étoiles la nuit), nuages, **montagnes enneigées** (les
  villages du jeu sont en Isère), collines, champs en sillons parallèles à la route.
- ⚠️ **Retiré du bas-côté** : les bottes de foin du décor (de profil, identiques à la
  botte-obstacle) ; les voitures garées et passants du village sont reculés à u ≥ RH + 1,3.
  Règle : **rien qui ressemble à un obstacle ne doit être juste derrière la route.**

## 3. Le gameplay en hauteur (`rows.js`, `simulation.js`)

Une seule voie : plus de contournement, tout se règle en hauteur.

| Franchissement | Obstacles | Hauteur à avoir au passage |
|---|---|---|
| **saut** (tap) | poule, chat, chien, mouton, botte, cochon, vache, poule lancée | bas des roues ≥ 0,45 |
| **salto** (re-tap en l'air) | tracteur, fermier, voiture garée | bas des roues ≥ 1,45 (apex d'un saut simple : 1,25) |

- L'obstacle est jugé **à l'instant où le centre du vélo passe sa rangée** (aussi tolérant que la
  v1, qui jugeait au premier contact).
- **Pièces en hauteur** : ramassées si leur hauteur tombe dans le corps (bas des roues + 0,25 à
  + 1,75). Au sol : 0,9. **Arc au-dessus de chaque obstacle** (côtés sur r ± 1, sommet sur r) :
  1,9 / 2,3 pour un saut, 3,1 / 3,4 pour un salto — hors de portée au sol, et l'arc « salto » hors
  de portée d'un saut simple. L'arc dessine le geste à faire. **Piles** sur 25 % des rangées libres,
  tirées d'un paquet fixe de 10 : 5 au sol, 3 en l'air (2,2), 1 double (0,9 + 1,9), 1 au salto (3,3).
- **Écarts** : 4 rangées entre deux sauts, **5 dès qu'un salto est en jeu**, jamais deux saltos
  consécutifs dans l'ordre des dangers (paquets remélangés jusqu'à ce que ça tienne).
- **Traversants** : ils arrivent TOUS du fond (`dir = −1`), coupent la route et s'effacent en
  sortant vers la caméra. Armement inchangé (4 s avant le passage du joueur). **Alerte « ! »** au
  bord droit (rouge = tracteur, jaune = poule lancée) tant que la rangée n'est pas à l'écran.
- **Barre d'élan** : `elanRechargeS` 2,5 → **1,1 s**, `elanParPiece` 0,25 → **0,1**. Le salto est
  devenu obligatoire pour trois espèces ; deux saltos consécutifs sont à ≥ 1,18 s à vitesse max.
- **Pièce** : `pieceMetres` 4 → **2,6** — ~1,5× plus de pièces (les arcs) ; 2,6 garde leur poids
  dans le score au niveau de la v1. `potesPaliers` inchangés (5, 12, 20, 30, 42).
- **Meute** (`friends.js`) : plus de file indienne (elle sortait de l'écran en portrait). Premier
  pote à 1,0 rangée, puis 0,5 par pote (`potesRecul`, `potesEcart`), chacun à sa profondeur sur la
  largeur de la route ; ils refont **sauts ET saltos** du joueur au même endroit (marques). Prénom
  affiché 3 s à l'arrivée seulement. Chevron blanc au-dessus du joueur.
- **Fantôme** : dessiné à u + 0,7 (sur une voie, il serait pile derrière le joueur).
- **Gestes** (`input.js`) : tap = saut, re-tap en l'air = salto, swipe haut = saut. Le swipe
  latéral est ignoré. **Tuto** en 3 étapes (saut, salto, pièces).

### Mesures (`node outils/mesurer.mjs 40`, 19 septembre 2026)

| Mesure | v2 | v1 |
|---|---|---|
| Dangers / 1 100 rangées | 134–135 (saut 98–100, salto 35–37) | 134–135 |
| Laits / pièces rouges | 22 / 15 sur toutes les graines | 22 / 15 |
| Pièces posées / 1 100 rangées | 585–589 | ~330 |
| Écart minimal entre deux saltos | 10 rangées | — |
| Joueur idéal scripté | **0 obstacle touché sur 5 360** | — |
| Joueur immobile | 5 360 touchés sur 5 360 | — |
| Score parfait, 5 potes | 8 041 (±6 % selon la graine) | 8 374 |
| Score parfait, seul | 3 663 | 3 834 |
| Arrivée des 5 potes (joueur idéal) | 3 · 7 · 12 · 17 · 24 s | 3 · 7 · 9 · 15 · 21 s |
| Rendu, CPU ralenti ×4, village, 5 potes | 60 images/s | — |

Captures et coût de rendu : `node outils/capture.mjs [scènes]` (Chrome headless 375×812,
`SERVIR=dist` pour tester le build, `PARTIES=0` pour le tuto) → `outils/sorties/` (gitignoré).

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
de ligue, pas de classement, pas de fantôme, la ligue de démo pédale derrière le joueur.
1. **L'artiste** crée un projet Supabase `jai-un-pote-v2` (même région que l'actuel).
2. SQL Editor → coller et exécuter **`supabase/schema-v2.sql`** (consolidé, idempotent : tables,
   plafond par ligue, vues, événements, retours, ligues PMCMP et BETA).
3. `V2_URL=https://<ref>.supabase.co/rest/v1 V2_KEY=<clé anon> node outils/copier-ligues-v1-vers-v2.mjs`
   — recopie les 6 ligues et 29 membres (pseudos, skins, ordre d'arrivée). Sans variables : simple
   lecture de la v1. Les SCORES ne sont pas copiés (graines d'une route qui n'existe plus).
4. Coller l'URL REST et la clé anon dans `public/config.js`, `./deploy.sh`.
⚠️ Un projet gratuit se met en pause après 7 jours sans requête.

## 6. Reste à faire / points ouverts

- Base Supabase v2 et sous-domaine : bloqués sur les deux actions de l'artiste ci-dessus.
- **Test sur un vrai téléphone** : lisibilité de profil (cycliste ~50 px), 1,6 s de lecture à
  vitesse max, timing du salto (double tap) — rien de tout ça ne se juge en headless.
- Le ciel occupe beaucoup de hauteur en portrait (inévitable avec une largeur fixe en unités).
- `simulation.js` : le joueur idéal ne vise pas toutes les piles ; le score parfait varie de ±6 %
  selon la graine (±1,5 % en v1). Sans conséquence pour une ligue (même graine pour tous).

---

# Héritage v1 (recopié de `ARCHITECTURE.md` §14, dépôt principal, 16 septembre 2026)

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
| `sfx.js` | **Bruitages synthétisés** (aucun fichier) sur le contexte du morceau via `audio.sfxOutput()` (derrière le curseur de volume) : pièce, pote qui arrive (bruit d'herbe filtré + montée), pote perdu, saut, salto, klaxon du tracteur (à l'armement), lait, pièce rouge, fin. Gains 0,04–0,12 : sous l'instrumental. |
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
