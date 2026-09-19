# PLAN D'EXÉCUTION — « J'ai un pote v2 » : duplication, puis passage en 2D de profil à une voie

Rédigé le 19 septembre 2026, à partir de l'état du dépôt au commit `9e591d2` (branche
`gameplay-pause-voitures-etoiles`).

> **✅ EXÉCUTÉ le 19 septembre 2026** (recommandations D1–D7 acceptées : « exécute le plan »).
> Projet : `/Users/pmc/Documents/PMC/JAI-UN-POTE-V2/`, dépôt `pmcmp3/jai-un-pote-v2`, en ligne sur
> https://pmcmp3.github.io/jai-un-pote-v2/. Ce qui s'écarte du plan est dans `ARCHITECTURE.md` de
> ce projet (§2–§6) — notamment : perspective = vraie caméra de profil (parallaxe) plutôt qu'une
> projection oblique, écart de 5 rangées dès qu'un salto est en jeu, barre d'élan à 1,1 s, pièce à
> 2,6 pts, paliers de potes inchangés (mesurés équivalents à la v1). **En attente de l'artiste** :
> le CNAME `pote` chez OVH (puis `outils/brancher-domaine.sh`) et le projet Supabase v2 (puis
> `supabase/schema-v2.sql` et `outils/copier-ligues-v1-vers-v2.mjs`). Le texte ci-dessous est le
> plan d'origine, laissé tel quel.

Le plan se lit APRÈS `ARCHITECTURE.md` §14 (le jeu n°2 tel qu'il est), et il
remplace la description des captures d'écran de référence, qui ne seront pas dans le contexte
de la prochaine session (voir §6.1).

---

## 0. La demande, et ce qui a été vérifié

**Demande (19 septembre 2026)** :
1. Dupliquer `jai-un-pote/` en **« J'ai un pote v2 »**, base de travail complète.
2. La même chose **sur GitHub**, pour que v2 **ne soit pas hébergé au même endroit** que le
   site actuel, en **gardant le domaine** la-ville-est-belle-pmc.fr.
3. **Dupliquer la base de données** (Supabase).
4. Puis revoir **l'architecture et la perspective, pas la logique de jeu** : **une seule voie**,
   **2D de profil** « exactement comme Jetpack Joyride ou Zombie Tsunami » — perspective jugée
   « hyper importante », qui « ferait beaucoup plus sens avec le système de pièces et de saut ».

**État vérifié sur le poste et en ligne** :

| Sujet | Constat |
|---|---|
| Code v1 | `jai-un-pote/` : 21 modules, ~5 700 lignes (`src/` 3 200 + `index.html` 545 + `config.js` 139). Racine Vite dans le dépôt principal, scripts `dev:pote` / `build:pote`, entrée `pote` dans `.claude/launch.json` (port 5174). 17 commits touchent le dossier. |
| Perspective | `iso.js` (369 lignes) = vue 3/4 tournée de 30°. **6 modules en dépendent** : `main.js`, `rows.js`, `friends.js`, `props.js`, `voxrider.js`, `simulation.js`. Les 15 autres (audio, clock, hud, screens, net, sfx, rider, fantome, regles, coin, input, debug, voxel, …) ne connaissent pas la perspective. |
| Hébergement | Un seul dépôt `pmcmp3/la-ville-est-belle`, branche `gh-pages`, domaine personnalisé `la-ville-est-belle-pmc.fr` (+ `www`), HTTPS forcé, certificat jusqu'au 19 novembre 2026. DNS : 4 A vers GitHub Pages, `www` en CNAME vers `pmcmp3.github.io`. Aucun sous-domaine n'existe. `deploy.sh` construit ET pousse les deux jeux d'un coup. |
| Compte GitHub | `gh` connaît deux comptes ; le compte ACTIF est `workpaulmathieucollin-byte`, le dépôt appartient à `pmcmp3` → `gh auth switch --user pmcmp3` avant de créer quoi que ce soit. |
| Supabase | Un seul projet (`lmlltogosjpxkgofpcdy`) partagé par les deux jeux. Tables du jeu n°2 : `ligues` (6 lignes : R5298, C3HH3, PMCMP, UKMVV, 9UW5K, BETA à 60), `ligue_membres` (29), `ligue_scores` (32), `evenements` et `retours_beta` (insert-only, illisibles en anon), `preinscriptions_concert` (1). Vues `ligue_classement`, `ligue_relais` ; trigger `ligue_plafond`. Trois fichiers SQL : `supabase-migration-ligues.sql` (3 parties), `supabase-migration-beta.sql`, `supabase-migration-A-EXECUTER.sql` (= partie 3 + bêta, consolidé). |
| Outillage | **Ni `supabase` CLI, ni `psql`, ni `pg_dump`** sur le poste. Node 24, npm 11, `git-filter-repo`, `gh`, `curl` disponibles. |
| localStorage | 12 clés préfixées `jaip*` (pseudo, insta, ville, ligue, parties, record, skin, sprint, source, 3 clés de conversion). Service worker `CACHE = "jaip-v3"`, scope `/jai-un-pote/`. |

---

## 1. Décisions à valider AVANT de commencer (recommandation en premier)

Ces sept points changent la nature du travail. Les valider en une fois, en début de session.

- **D1 — Où vit le code v2.** *Recommandé* : un **projet autonome frère**,
  `/Users/pmc/Documents/PMC/JAI-UN-POTE-V2/`, avec son propre `package.json`, son propre dépôt
  git, son propre `CLAUDE.md`. C'est ce qui garantit « pas hébergé au même endroit » : un
  déploiement de v2 ne touche jamais `gh-pages` du site principal (où tourne la bêta v1), et
  réciproquement. *Alternative* : sous-dossier `jai-un-pote-v2/` du dépôt actuel, servi sous
  `/jai-un-pote-v2/` — zéro DNS, mais `deploy.sh` force-pousse TOUT le site à chaque fois :
  un build v2 cassé emporte le jeu du concours.
- **D2 — L'adresse.** Un domaine personnalisé GitHub Pages n'est rattachable qu'à UN dépôt, et
  l'apex est pris par le site principal. *Recommandé* : le sous-domaine
  **`pote.la-ville-est-belle-pmc.fr`** (court, partageable). Coût : **un enregistrement CNAME
  chez OVH** (`pote` → `pmcmp3.github.io`), à faire par l'artiste (déjà fait une fois pour
  `www` le 21 août). *Alternative sans DNS* : `pmcmp3.github.io/jai-un-pote-v2/` (pas le
  domaine).
- **D3 — La base.** *Recommandé* : **un NOUVEAU projet Supabase** (le plan gratuit permet deux
  projets actifs — à confirmer dans le dashboard), même schéma, **`ligues` + `ligue_membres`
  copiés (identités et skins), `ligue_scores` NON copiés** (les scores v1 portent la graine
  d'une route qui n'existe plus en v2 — ils n'ont aucun sens dans le nouveau classement).
  ⚠️ Un projet gratuit **se met en pause après 7 jours sans requête** ; le jeu tomberait alors
  en silence sur les prénoms par défaut. À surveiller pendant le développement (un simple
  chargement de la page envoie l'événement `arrivee`, ce qui suffit à le garder actif).
  *Alternative* : même projet, tables préfixées `v2_` (renommage dans `net.js`) — moins isolé.
- **D4 — Portrait natif conservé.** Les deux références sont des jeux **paysage** ; le projet
  est **portrait** (Safari iOS et le navigateur Instagram ne permettent pas de verrouiller le
  paysage — règle du projet). *Recommandé* : jeu de profil EN PORTRAIT, caméra dézoomée +
  joueur ancré à gauche + avertisseur « ! » au bord droit pour ce qui arrive vite (voir §6.4).
  *Alternative* : canvas tourné de 90° (le joueur tient le téléphone couché) — techniquement
  possible, mais les écrans HTML (menus, tiroirs, clavier du pseudo) devraient tourner aussi ;
  à ne considérer que si le premier prototype prouve que l'horizon portrait est trop court.
- **D5 — Les gestes.** Plus de voie → plus de swipe latéral. *Recommandé* : **tap = saut,
  re-tap en l'air = salto** (inchangés), rien d'autre au départ. Le « swipe bas = baisse-toi »
  (pour des obstacles aériens) n'est PAS introduit dans un premier temps : deux gestes
  suffisent, et le salto conditionné par la barre d'élan donne déjà la profondeur (voir §6.5).
- **D6 — Les pièces.** *Recommandé* : les pièces passent en **MOTIFS dans les airs** (ligne au
  sol, arc au-dessus d'un obstacle, colonne verticale, grille à hauteur de salto) — c'est
  exactement ce que la perspective de profil permet et ce que l'artiste vise (« plus de sens
  avec le système de pièces et de saut »). Conséquence : une « rangée à pièce » vaut plusieurs
  pièces → **`potesPaliers` à recalibrer par simulation** (§6.6). *Alternative* : une pièce par
  rangée, posée à une hauteur (sol / saut / salto) — plus proche de v1, moins « Jetpack ».
- **D7 — Les traversées.** *Recommandé* : le tracteur et la poule lancée traversent la route
  **en PROFONDEUR** (du fond du champ vers le premier plan), rendus sur l'axe oblique de la
  scène. Toute la logique « armée sur le passage du joueur » (`armer`, `crossersAt`,
  `ARM_AHEAD_S`, klaxon) reste **telle quelle**. *Alternative* : le tracteur arrive de la
  droite sur la route (face au joueur) — perd le mécanisme d'armement, devient un obstacle
  rapide de plus.

---

## 2. Ce qui NE change PAS (la logique de jeu, verrouillée)

À relire pendant la phase 4 pour ne pas dériver : contre-la-montre = la durée du morceau
(`dureeMorceau`, pas de boucle, « TERMINÉ ! » en roue libre 1,5 s) ; score en pts = distance ×
(1 + 0,25 × potes) × 2 en turbo + pièces ; **pièces → potes** par paliers ; **pièce rouge** =
un pote direct ; **brique de lait** = turbo 5 s sans obstacle (`ouvrirFenetreSure`) ; **boue**
= ×0,5 au sol ; **salto** et barre d'élan (`elanRechargeS`, `elanParPiece`) ; **nuit** à 95 s ;
**tutoriel** sur 2 parties ; **seconde chance** (revive, boucle de mort filtrée) ; **ligues**,
**une ligue = une course** (`graineLigue`), **score parfait** (`simulation.js`), **fantôme**
(`fantome.js`, format de trace `u,v,h`) ; **bêta fermée** (`ligueBeta`, retours) ; menu en
trois étapes, skins VTT / Grand Bi ; tiroir album à trois paliers ; écran de fin ; audio
(horloge maîtresse Web Audio, pas fixe 120 Hz), sfx synthétisés ; règles techniques de
`CLAUDE.md` (vanilla JS + Canvas 2D + Vite, `config.js` seul fichier de réglages, iOS :
AudioContext dans la pile du geste).

Générateur à quotas (`rows.js`, classe `Route`) : **conservé dans son principe** — blocs de 24,
nombre exact de dangers, paquets d'espèces seedés, lait/rouge sur rangées réservées, `GAP_MIN`.
Ce qui change dans ce module, c'est la GÉOMÉTRIE des rangées (une voie, une hauteur), pas
l'économie (§6.5–6.6).

---

## 3. Phase 1 — Duplication locale (mécanique, ~30 min)

Objectif : `JAI-UN-POTE-V2/` démarre, joue, se construit, **à l'identique de v1**, avant de
toucher à quoi que ce soit d'autre. C'est la base de comparaison de la phase 4.

1. Créer le projet frère à partir du dossier `jai-un-pote/` (copie de fichiers, pas de lien) :
   ```
   JAI-UN-POTE-V2/
     package.json          name "jai-un-pote-v2", scripts dev / build / preview, devDep vite ^6
     vite.config.js        copie de la racine (host: true, allowedHosts trycloudflare)
     .gitignore            node_modules/, dist/, dist-pages/, .DS_Store, .claude/settings.local.json
     index.html            copie ; corriger `href="../favicon.png"` → `favicon.png` (copié dans public/)
     public/               config.js, sw.js, fonts/, assets/ (MP3 2,1 Mo, cover), + favicon.png,
                           apple-touch-icon.png, CNAME (= pote.la-ville-est-belle-pmc.fr, D2)
     src/                  les 21 modules, inchangés à cette étape
     supabase/             les 3 SQL d'origine (référence) + schema-v2.sql (phase 3)
     outils/               scripts de mesure et de copie (phases 3 et 4)
     deploy.sh             version SIMPLIFIÉE : un seul jeu, une seule branche gh-pages (§4)
     .claude/launch.json   { name: "pote2", npx vite --port 5175 --host, port 5175 }
     CLAUDE.md             court : renvoie à ARCHITECTURE.md et à ce plan
     ARCHITECTURE.md       = ARCHITECTURE.md §14 du dépôt principal, recopié, + une section
                           « perspective » à écrire en phase 4
     PLAN-V2.md            = ce fichier
   ```
2. Renommages **immédiats** (avant tout commit), pour que v1 et v2 ne se marchent jamais dessus :
   - `index.html` : `<title>` « J'ai un pote v2 — PMC », `og:title`.
   - `public/config.js` : `lienJeu` → `https://pote.la-ville-est-belle-pmc.fr/` (D2) ;
     `apiBase` / `apiKey` inchangés **jusqu'à la phase 3** (v2 parle à la base v1 pendant
     quelques heures, c'est voulu : ça prouve que la copie tourne).
   - `screens.js` : préfixe des clés localStorage `jaip` → `jp2` (12 clés, une constante par
     clé, grep `"jaip`). Sur un sous-domaine séparé (D2) il n'y a pas de collision d'origine,
     mais le préfixe protège l'alternative D1-bis, et `?zero` ne doit plus effacer les DEUX
     jeux (il n'en voit qu'un).
   - `public/sw.js` : `CACHE = "jp2-v1"`.
   - `regles.js` : `VERSION_COURSE = 3` (la route v2 sera différente de toute façon ; poser le
     numéro tout de suite évite de mélanger des scores).
3. `npm install`, `npm run dev` (port 5175), ouvrir sur le téléphone via le LAN, **jouer une
   partie complète** : menu → tuto → course → fin → classement de ligue (base v1). `npm run
   build` doit sortir ~26 modules, bundle de l'ordre de 17 Ko gzippé.
4. `git init`, un commit racine « Copie de jai-un-pote (pmcmp3/la-ville-est-belle @9e591d2) ».
   Historique : *recommandé* repartir à neuf (le dépôt principal garde les 17 commits d'origine,
   accessibles par `git log -- jai-un-pote`). Si l'on tient à l'historique, `git subtree split
   -P jai-un-pote -b pote-histoire` puis pousser cette branche — à décider, ça ne change rien
   au reste.

⚠️ Ne PAS supprimer `jai-un-pote/` du dépôt principal : la bêta fermée y tourne
(`…/jai-un-pote/?ligue=BETA`) et continue de tourner pendant tout le chantier v2.

---

## 4. Phase 2 — GitHub et domaine (~20 min + propagation DNS)

1. `gh auth switch --user pmcmp3` (vérifier avec `gh auth status` que pmcmp3 est actif).
2. `gh repo create pmcmp3/jai-un-pote-v2 --public --source . --push --description "J'ai un pote v2 — runner 2D de profil (PMC)"`.
   **Public obligatoirement** : GitHub Pages sur dépôt privé exige un compte payant. Le MP3
   est déjà public sur le site actuel, la clé Supabase anon est publique par nature (RLS).
3. Premier build + branche `gh-pages` : `npx vite build --base=./ --outDir=dist-pages`,
   `.nojekyll`, `CNAME`, commit orphelin poussé sur `gh-pages` (même recette que
   `deploy.sh` §3, dans un worktree séparé — le piège du `--orphan` à la racine est documenté
   dans `ARCHITECTURE.md` §9). Activer Pages : `gh api -X POST repos/pmcmp3/jai-un-pote-v2/pages -f source[branch]=gh-pages -f source[path]=/`.
4. **L'artiste ajoute chez OVH** : `pote  CNAME  pmcmp3.github.io.` (zone
   la-ville-est-belle-pmc.fr). Vérifier par `dig +short pote.la-ville-est-belle-pmc.fr CNAME`.
5. Une fois le DNS propagé : `gh api -X PUT repos/pmcmp3/jai-un-pote-v2/pages -f cname=pote.la-ville-est-belle-pmc.fr`,
   attendre le certificat (`gh api repos/pmcmp3/jai-un-pote-v2/pages` → `https_certificate.state`
   = approved, quelques minutes à une heure), puis `-F https_enforced=true`.
6. `deploy.sh` de v2 (simplifié) : commit + push `main` (historique normal, pas de snapshot
   orphelin — le dépôt est neuf, il n'y a rien à cacher), build, snapshot `gh-pages` dans un
   worktree, push. Mode `DEPLOY_DRY=1` conservé. ⚠️ Comme pour le site principal : pas de
   contrôle des en-têtes de cache sur GitHub Pages (`max-age=600` sur tout, `_headers` ignoré).
7. Vérification : `curl -sI https://pote.la-ville-est-belle-pmc.fr/` → 200, et une partie sur
   téléphone depuis cette adresse. Le lien de bêta v2 sera
   `https://pote.la-ville-est-belle-pmc.fr/?ligue=BETA`.

Rien de cette phase ne touche `pmcmp3/la-ville-est-belle`.

---

## 5. Phase 3 — Base Supabase v2 (~40 min, dont 2 actions de l'artiste)

Sans `psql` ni CLI sur le poste, on fait comme pour chaque migration jusqu'ici : **l'artiste
exécute le SQL dans l'éditeur du dashboard**, et Claude vérifie/copie par l'API REST.

1. **L'artiste crée le projet** dans le dashboard Supabase : nom `jai-un-pote-v2`, même région
   que le projet actuel, mot de passe DB à conserver (inutile au jeu, utile un jour pour
   `psql`). Il transmet **l'URL REST et la clé anon** (Settings → API).
2. Claude écrit `supabase/schema-v2.sql`, **consolidé et idempotent**, à partir des trois
   fichiers v1 dans l'ordre : `ligues`, `ligue_membres` (+ `skin`), `ligue_scores` (+ `mode`,
   `graine`, `trace`, index), fonction + trigger `ligue_plafond` (colonne `plafond`), vues
   `ligue_classement` et `ligue_relais`, `evenements`, `retours_beta`, toutes les policies
   (`drop policy if exists` avant chaque `create`), la ligue de démo `PMCMP` avec ses 5 membres
   et la ligue `BETA` à 60. `preinscriptions_concert` **omise** (fonction supprimée le
   16 septembre, table sans écriture). **L'artiste l'exécute** dans SQL Editor.
3. Claude vérifie par REST (comme fait ce jour sur v1) : `GET /ligues?select=code,plafond`
   doit renvoyer PMCMP et BETA ; `Prefer: count=exact` sur `ligue_membres` → 5.
4. Copie des identités : `outils/copier-supabase-v1-vers-v2.mjs` (Node, `fetch`) — `GET`
   `ligues` puis `ligue_membres` sur v1 (lecture anon autorisée), `POST` sur v2 avec
   `Prefer: resolution=merge-duplicates` sur `(code)` / `(code,pseudo)`. **Ordre** : `ligues`
   d'abord (le trigger de plafond lit `ligues.plafond`, et BETA doit être à 60 avant ses 20+
   membres). Attendu : 6 ligues, 29 membres. `ligue_scores` **non copiés** (D3) ;
   `evenements` / `retours_beta` **non copiables** (insert-only, illisibles en anon) et sans
   intérêt pour v2.
5. `public/config.js` de v2 : `apiBase` / `apiKey` → le nouveau projet. Une partie complète →
   `ligue_scores` v2 reçoit une ligne avec `graine` et `trace` ; classement et fantôme
   apparaissent. Vérifier aussi que la **v1 n'a rien reçu** (compte `ligue_scores` v1 inchangé).
6. Noter dans `ARCHITECTURE.md` v2 : identifiant du projet, tables, « comment lire
   `retours_beta` » (Table editor uniquement), et le piège de la pause à 7 jours.

---

## 6. Phase 4 — La refonte : 2D de profil, une voie (le vrai chantier, 3 à 5 sessions)

### 6.1 Les références, transcrites (les captures ne seront plus dans le contexte)

- **Zombie Tsunami (2 captures)** : vue strictement **de profil**, la horde court **vers la
  droite** sur une bande de sol qui occupe le bas de l'écran (~20 % de la hauteur). Les
  personnages ont du **volume cartoon** (pas des sprites plats : arêtes, dessus visibles),
  serrés en **meute** avec de légers décalages de profondeur pour qu'ils se chevauchent sans
  se cacher. **Parallaxe** de ville derrière (immeubles, château d'eau, escaliers de secours).
  HUD : compteurs en haut à gauche (pièces, cerveaux), et au **centre haut la tête du
  personnage + « ×15 »** — c'est notre pastille de potes. Une caisse « ? » bonus posée sur le
  sol, sautée. Bandeau d'événement rose en haut (« CROQUE TES AMIS !! ») avec les photos des
  amis dans des bulles — l'équivalent de « @paul EST LÀ ! ».
- **Jetpack Joyride (1 capture)** : profil, joueur **au quart gauche**, en l'air. Sol en bas
  avec des personnages de décor qui courent (nos passants / potes en attente). **Pièces en
  GRILLE 4×3 en hauteur** au milieu de l'écran — c'est la raison de D6. Dangers à **plusieurs
  hauteurs** : laser à gauche, missile en haut à droite avec traînée, et surtout un **panneau
  rouge « ! » au bord droit** qui annonce le missile avant qu'il entre à l'écran — c'est la
  solution à l'horizon court du portrait (§6.4). HUD : portrait + barre de vie en haut à
  gauche, progression « 320/600 » centrée, pièces dessous.

Ce qu'on retient, dans l'ordre d'importance : profil pur, joueur à gauche, tout se joue
**verticalement** (hauteur des obstacles, hauteur des pièces), meute derrière, parallaxe,
avertisseur de bord pour ce qui arrive vite.

### 6.2 Principe directeur : changer la PROJECTION, pas le MONDE

`iso.js` est déjà une rotation du plan du sol : `(u, v, h)` → écran. Une vue de profil est
**une autre matrice** : `v` (avance sur la route) → écran x, `h` (hauteur) → écran −y, `u`
(latéral) → **un petit décalage oblique de profondeur** (les objets « derrière » la route
montent légèrement vers la droite, les objets « devant » descendent vers la gauche — projection
cabinet à ~30°, facteur 0,3–0,4). Ce choix est central parce qu'il **conserve la grammaire
voxel** (`drawBox` 3 faces, `voxrider.js`, `props.js`, décor) — le cycliste, les animaux, le
tracteur, les maisons restent des boîtes, vues de côté avec une face de dessus et une face
latérale visibles : exactement le volume cartoon de Zombie Tsunami. Et il conserve le **triplet
`(u, v, h)`** partout : la trace du fantôme, `simulation.js`, `net.js` ne changent pas de
format (`u` vaut 0 sur la voie ; il ne sert plus qu'au décor et aux traversées).

Nouveau module **`scene.js`** (remplace `iso.js`, **même contrat d'exports** pour limiter la
diff — liste exacte des exports consommés ailleurs, vérifiée par grep) :
`project`, `depth`, `drawBox`, `drawFlat`, `drawShadow`, `setViewport`, `setCamera`,
`setNight`, `getNight`, `setDecorTime`, `scale`, `rowRange`, `renderGround`, `renderHaze`,
`rowDecor`, `drawSign`, `lampsIn`, `setVille`, `villeDuJoueur`, `debutVillage`, `zoneAt`, plus
`COLS` (= 1), `COL_CENTRE` (= 0), `colU` (→ 0), `ROAD_HALF`, `ROWS_AHEAD` / `ROWS_BEHIND`
(renommés en unités visibles, voir 6.4). Ordre du peintre : `depth = u` (le fond d'abord),
départage par `v`.

### 6.3 Module par module

| Module | Sort | Travail |
|---|---|---|
| `iso.js` → `scene.js` | **réécrit** | Projection de profil (6.2), caméra x avec avance, sol = bande route + bas-côtés, **parallaxe** à 3 plans (fond 0,5 : collines/champs/village/église/école ; route 1,0 ; premier plan 1,2 : herbe, piquets), biomes conservés comme bandes horizontales, panneaux de village au bord (u = +0,8), lampadaires + halos, nuit = dégradé de ciel + étoiles, brume au loin devient brume à DROITE (le lointain est à droite). |
| `rows.js` | **adapté** | `COLS = 1` : `cols`/`cible`/`boue` perdent leur colonne (boue = tronçon de 3 rangées sur LA voie, on la saute). Obstacles statiques : passables par **hauteur** (6.5). Traversées : inchangées, elles vivent sur `u` (D7). Pièces : motifs (6.6). Quotas par bloc, paquets, rangées réservées, `GAP_MIN` : inchangés. `checkMember` : collision `|v − r| < larg/2 + marge` ET `jumpY < K.h` (au-dessus = franchi) ; pour les motifs de pièces, test par pièce `(v, h)`. |
| `input.js` | **simplifié** | Tap = saut (au relâcher), re-tap en l'air = salto (au toucher, inchangé), swipe haut = saut. **Suppression** de `laneQueue`/swipe latéral (D5). Clavier : espace / flèche haut. |
| `main.js` | **adapté** | Suppression `col`/`LANE_TWEEN`/`camU` ; caméra `camV` avec **avance** (6.4) ; fenêtre sûre du lait et du tuto en unités visibles ; tuto refait (3 étapes : TAP = SAUTER, RE-TAP = SALTO, LES PIÈCES APPELLENT TES POTES) ; popups au-dessus du joueur via `project(0, v, h)` ; `renderApercu` (aperçu du cycliste au menu) réglé sur la nouvelle projection ; **avertisseur « ! »** au bord droit pour une traversée armée encore hors champ ; touches de debug conservées. |
| `friends.js` | **simplifié** | Plus de choix de voie ni de `voiesBloquees` : file **sur la voie**, `u` alterné ±0,25 par rang pour la lecture en meute (6.7), saute aux marques du joueur (conservé), perte par l'arrière (conservé), prénoms au-dessus (conservé). |
| `props.js` | **relu** | Orientation : le vélo et les animaux regardent **+v (la droite)** ; le tracteur roule le long de `u` (il traverse en profondeur), phares/poussière adaptés ; la voiture garée est **le long de la route** (sa longueur sur `v`). |
| `voxrider.js` | **relu** | Roues alignées sur `v` (déjà le cas), salto = rotation écran autour du centre (inchangé), Grand Bi inchangé. Vérifier la silhouette de profil (le cadre, les jambes en opposition doivent se lire de côté). |
| `simulation.js` | **adapté** | Joueur idéal sans voie : prend toute pièce **atteignable** (sol, hauteur de saut, hauteur de salto si l'élan est plein — modéliser l'élan), tous les laits, tous les rouges. Recalcul du score parfait ; ordre de grandeur attendu différent de v1 (à mesurer, 6.8). |
| `hud.js`, `screens.js`, `net.js`, `audio.js`, `clock.js`, `sfx.js`, `rider.js`, `fantome.js`, `regles.js`, `coin.js`, `debug.js`, `voxel.js`, `index.html` | **inchangés** | (hud : `scale()` importé pour la taille des textes — garder l'export.) |
| `config.js` | **complété** | Nouvelles clés : `cameraJoueurX` (0,22), `pixelsParUnite` (26), `potesEcart` / `potesRecul` revus (6.7), `piecesMotifs` (6.6). Rien d'autre. |

### 6.4 Caméra et échelle en portrait (hypothèses de départ, À MESURER)

Chiffres réels du jeu (`regles.js`, `config.js`) : vitesse **4,42 u/s au départ, 6,76 u/s au
plafond, 8,11 u/s en turbo** (le turbo n'a pas d'obstacle) ; le saut dure 0,55 s → portée
**2,4 u / 3,7 u / 4,5 u** ; le cycliste fait 1,9 u de haut.

Sur 375 px de large avec le joueur à **22 %** (82 px) et **K = 26 px/u** : le cycliste fait
~50 px, on voit **11,3 u devant** → **2,6 s au départ, 1,7 s au plafond**. Pour comparaison la
vue 3/4 actuelle montre 24 rangées (~3,5 s au plafond), Zombie Tsunami donne ~1–1,5 s et
c'est jouable parce que l'obstacle est binaire (on saute ou pas). Leviers, dans l'ordre :
1. **Avance de caméra** : le joueur glisse de 28 % vers 18 % de la largeur quand la vitesse
   monte (façon Sonic) — gagne ~1,4 u au plafond.
2. **Avertisseur « ! »** au bord droit (référence Jetpack) pour toute traversée armée dont la
   rangée n'est pas encore à l'écran : le tracteur s'arme 4 s avant (`ARM_AHEAD_S`), on le
   voit ~1,7 s avant → **le « ! » couvre les 2,3 s manquantes**, avec le klaxon existant.
3. K entre 24 et 28 selon le rendu sur téléphone (en dessous de 24, le cycliste devient
   illisible ; c'est là que D4-alternative se rediscuterait).

Verticalement : sol à **~66 % de la hauteur**, HUD en haut (inchangé, trois étages), ciel
entre les deux pour les motifs de pièces (jusqu'à ~3 u = 80 px au-dessus du sol : hauteur de
salto) et les bandeaux. Le turbo garde son flou latéral (`hud.renderTurbo`).

**Mesure de sortie** de cette étape (harnais headless, 6.8) : temps de réaction disponible
≥ 1,6 s à vitesse plafond et ≥ 2,4 s au départ, meute de 5 potes ENTIÈREMENT visible.

### 6.5 La matrice verticale des obstacles (remplace la matrice « saut / contournement »)

En v1, quatre obstacles ne se sautent pas et se contournent latéralement. Sur une voie, il
n'y a plus de contournement : tout se règle par la **hauteur**, et les valeurs `h` de `KINDS`
donnent la matrice presque gratuitement (apex du saut 1,25 u, du salto ≈ 2,5 u) :

| Obstacle | `h` v1 | Franchissement v2 | Note |
|---|---|---|---|
| poule, chat, chien, mouton, botte, cochon | 0,4–0,75 | **saut simple** | cochon perd son « saut: false » |
| voiture garée | 0,75 mais **2,0 u de long** | saut simple, **timing serré au départ** (portée 2,4 u) | reste en paquets 2–3 (jamais au début), à mesurer |
| vache | 1,1 | saut simple de justesse → **monter à 1,3 : salto** | décision de réglage |
| tracteur | 1,4 | **salto** (ou l'attendre : il traverse) | cout 3 conservé |
| fermier | 1,8 | **salto** | cout 2 |
| poule lancée | vol à 0,6–0,85 | saut simple (elle passe sous les pieds) | à mesurer ; c'est LE candidat au « baisse-toi » si un jour D5 change |
| boue | sol | saut (ou on subit ×0,5) | inchangé |

Règle de collision unique : touché si `|v − r| < larg/2 + 0,15` ET `jumpY < h + lift`.
L'élan (salto une fois par 2,5 s + 0,25 par pièce) devient la vraie gestion de ressource : deux
tracteurs rapprochés sans pièces entre les deux = un pote perdu. C'est la profondeur que le
pont apportait au jeu n°1. Le générateur doit **garantir** qu'aucun enchaînement n'est
infranchissable : pas deux obstacles « salto » à moins de `elanRechargeS × vitesse` rangées
sans au moins 4 pièces entre eux — contrainte à ajouter dans `positionsDangers` et à **mesurer
sur 40 graines** (6.8), comme les quotas l'ont été.

### 6.6 Les pièces en motifs (D6)

Une rangée « pièce » du générateur porte désormais un **motif** tiré par la graine :
`ligne` (3 pièces au sol), `arc` (5 pièces en cloche au-dessus de l'obstacle suivant — le
motif Sonic/Jetpack qui APPREND à sauter), `colonne` (3 pièces à 0,5 / 1,0 / 1,5 u : le salto
en prend une de plus), `grille` (2×3 à hauteur de saut, ne s'attrape entièrement qu'en salto),
`lait`/`rouge` restent uniques. Quotas : le générateur compte les MOTIFS (même nombre par
bloc pour toutes les graines, comme aujourd'hui) ; `potesPaliers` (5, 12, 20, 30, 42) est
**recalibré** pour que le premier pote arrive toujours dans les ~10 premières secondes et le
cinquième vers 60 % du morceau — par `simulation.js`, pas à la main.

### 6.7 La meute (friends.js)

La file indienne de v1 (recul 3 u + 1,6 u par pote = 9,4 u pour le 5e) **ne tient pas en
portrait** : à K = 26 et joueur à 22 %, tout ce qui est à plus de 3,2 u derrière est hors
champ. Zombie Tsunami résout ça par la **meute** : `potesRecul` 1,0, `potesEcart` 0,55,
profondeur `u` alternée ±0,25 par rang (ils se chevauchent sans se cacher), ombre commune.
Cinq potes tiennent en ~3,2 u. Ils sautent aux marques du joueur (l'effet « vague » de la
meute qui saute l'une après l'autre est le moment Zombie Tsunami à réussir), ils ne prennent
pas de dégât, ils ramassent les pièces qu'ils croisent (ce qui, en meute serrée, arrive
souvent — à surveiller dans le score parfait).

### 6.8 Ordre d'exécution et jalons MESURABLES (« mesurer avant de conclure »)

1. **`scene.js` seul**, avec `COLS = 1` et tout le reste en l'état : le jeu v1 doit tourner
   dans la nouvelle projection, moche mais jouable (voie unique, obstacles encore « saut /
   pas saut »). Jalon : capture headless, 60 fps sur DPR 1,5, aucune exception.
2. **`rows.js` + `main.js` collisions** (6.5) puis **`input.js`**. Jalon : script headless
   « joueur parfait scripté » qui franchit CHAQUE espèce par le geste attendu, 0 dégât sur
   1 100 rangées × 5 graines ; et « joueur immobile » qui perd des potes sur chaque danger
   (la collision marche dans les deux sens).
3. **Caméra + avance + « ! »** (6.4). Jalon : temps de réaction mesuré ≥ 1,6 s au plafond.
4. **`friends.js` meute** (6.7). Jalon : 5 potes visibles à l'écran à vitesse plafond,
   0 chevauchement pote/obstacle rendu illisible (capture).
5. **Motifs de pièces + `simulation.js` + paliers** (6.6). Jalon : score parfait sur
   40 graines à ±2 %, premier pote < 12 s, 5e pote < 110 s ; `recenser()` : mêmes quotas de
   motifs/dangers/laits/rouges d'une graine à l'autre.
6. **Contrainte d'élan** dans le générateur (6.5). Jalon : 0 enchaînement infranchissable
   sur 40 graines (test automatique).
7. **Décor / parallaxe / nuit / village / panneaux** — la partie « belle », en dernier, une
   fois le jeu prouvé jouable. Jalon : capture jour, capture nuit, capture village, capture
   turbo, sur téléphone réel.
8. **Tuto, aperçu du cycliste, fantôme** : le fantôme v2 doit rejouer une trace v2 (le format
   n'a pas bougé, mais `h` compte désormais visuellement : il doit SAUTER au bon endroit).
9. **Session téléphone** avec l'artiste avant tout déploiement (lisibilité de profil, taille du
   cycliste, horizon) — c'est là que D4 se confirme ou se rediscute.

Harnais : Playwright + Google Chrome (`channel="chrome"`) comme pour v1 (`ARCHITECTURE.md`
§12 : la preview de l'IDE ne peut pas jouer le jeu, l'AudioContext fige l'onglet ; en headless
le jeu bascule sur l'horloge de secours et `window.__pote` expose player/game/rows/friends
avec `?debug`). Les scripts vivent dans `outils/` du dépôt v2 cette fois (ceux de v1 étaient
dans un scratchpad de session, ils ont disparu).

### 6.9 Pièges connus à ne pas reproduire (hérités des deux jeux)

- `window.CONFIG` est **gelé** : les surcharges de debug passent par des variables locales.
- **Pas de `shadowBlur`** (cher sur mobile) ; contours par `strokeText`. DPR plafonné à 1,5.
- Ordre du peintre : un objet rendu hors de la liste triée se peint toujours au même endroit
  de la séquence, quelle que soit sa profondeur (bug vécu sur le caméo du jeu n°1).
- `MutationObserver` sur `disabled` gelait la page (bug vécu).
- Ne pas réintroduire `clock.jumpBy(-LEAD_IN)` brut ni `road.reset()` au départ : le départ
  est ancré sur la grille du morceau (`ancrerDepartSurLaGrille`).
- Le fantôme et le classement sont filtrés sur la **graine** : toute modification du
  générateur = `VERSION_COURSE += 1`.
- `retours_beta` et `evenements` sont insert-only : une vérification REST renvoie toujours
  `[]`, ce n'est pas « la table est vide ».
- GitHub Pages : `.nojekyll`, chemins relatifs, `--base=./`, jamais de `--orphan` dans
  l'arbre de travail principal.

---

## 7. Phase 5 — Documentation et fin de chantier

- `ARCHITECTURE.md` (v2) : section « perspective de profil » (projection, caméra, matrice
  verticale, meute, motifs, mesures obtenues avec leurs chiffres), tableau des modules mis à
  jour, dette ouverte.
- `CLAUDE.md` (v2) : règles non négociables reprises du dépôt principal + les décisions D1–D7
  telles qu'arbitrées, avec la date.
- Dépôt principal : **une ligne** dans `CLAUDE.md` (section « Jeu n°2 ») qui pointe vers le
  dépôt et l'adresse de v2, et une entrée datée dans `PLAN-ACTION.md`. Rien d'autre n'y change.
- Bêta : quand v2 est jouable, le lien `…?ligue=BETA` de v2 peut être diffusé au groupe
  WhatsApp **en plus** de v1, chacun sur sa base — les retours v2 arrivent dans `retours_beta`
  du projet Supabase v2.

---

## 8. Séquencement proposé

| Session | Contenu | Prérequis artiste |
|---|---|---|
| S1 (courte) | Valider D1–D7 ; phases 1, 2, 3 ; v2 en ligne, identique à v1, sur sa base | créer le projet Supabase, poser le CNAME, exécuter `schema-v2.sql` |
| S2 | 6.8 jalons 1–3 (projection, collisions verticales, caméra) | — |
| S3 | jalons 4–6 (meute, motifs, simulation, contrainte d'élan) | — |
| S4 | jalon 7 (décor, parallaxe, nuit, village) | — |
| S5 (courte) | jalons 8–9, session téléphone, déploiement, docs | tester sur son téléphone |

Les sessions S2–S4 sont celles où le modèle compte (géométrie, harnais de mesure, arbitrages
de lisibilité) ; S1 est mécanique.

---

## 9. Checklist « prêt à démarrer S1 »

- [ ] D1–D7 arbitrés (ou « recommandations acceptées »).
- [ ] Projet Supabase `jai-un-pote-v2` créé, URL REST + clé anon transmises.
- [ ] Enregistrement DNS `pote  CNAME  pmcmp3.github.io.` posé chez OVH (peut se faire pendant
      la session, la propagation prend de quelques minutes à quelques heures).
- [ ] `gh auth switch --user pmcmp3` fait en début de session.
- [ ] Le dossier `jai-un-pote/` du dépôt principal reste intact : la bêta v1 continue.
