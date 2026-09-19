// config.js — Réglages de « J'ai un pote » (jeu n°2, 4 septembre 2026).
// Fichier UNIQUE de configuration, chargé tel quel (pas bundlé). Aucune
// logique de jeu ici. Même contrat que le premier jeu : audio.js lit les clés
// audio, tout le reste est lu par main.js/track.js/friends.js.

window.CONFIG = {

  // === MORCEAU / RYTHME ===
  // « J'ai un pote » (EP La ville est belle). BPM mesuré sur le master WAV
  // (librosa, 222 temps suivis, résidu 43 ms) : 85,0. Premier temps à 0,04 s.
  bpm: 85,
  premierTempsOffset: 0.04,
  dureeMorceau: 173.65,
  fichierAudio: "assets/jai-un-pote.mp3", // 96 kbps, 2,1 Mo (le 320 de l'EPK fait 6,9 Mo)
  boucleMorceau: false,     // contre-la-montre : la fin du morceau = la fin de la partie (6 septembre 2026)
  chargementMinS: 5,        // la barre de chargement dure au moins 5 s : tout est en cache avant JOUER (demandé)
  fonduEntree: 1.2,
  fonduSortie: 2.0,
  pauseFiltreHz: 800,
  pauseFondu: 0.5,
  pauseDeriveMax: 25,

  // Boucle du début pendant la seconde chance : 16 temps = 4 mesures à 85 BPM.
  loopMortDebut: 0.04,
  loopMortDuree: 11.294,
  loopMortFiltreMin: 170,
  loopMortFiltreMax: 16000,
  loopMortVolumeMin: 0.32,
  loopMortRetour: 5,
  // Pas d'easter egg vocal sur ce jeu (clés lues par audio.js, laissées vides).
  fichierEasterEgg: "",
  easterEggScore: Infinity,

  // === VITESSE ===
  // Jeu d'endurance : montée plus douce que le premier (le but est d'aller
  // LOIN avec ses potes, pas de survivre 2 minutes). Plafond ×4,6 = 51 u/s.
  // Vitesse d'avance en rangées/seconde : 4,4 au départ → plafond 9,4 (Crossy
  // Road : 1 rangée = 1 unité). Doublement toutes les 70 s (main.js).
  vitesseBase: 1.7,
  vitesseMax: 2.6,          // 3,6 → 2,6 le 7 septembre 2026 (« quand ça va vite, ça va vraiment trop vite »)

  // === VUE DE PROFIL (v2, 19 septembre 2026) ===
  // « Une seule voie, en 2D, exactement comme Jetpack Joyride ou Zombie
  // Tsunami ». Caméra posée à côté de la route (scene.js) : le joueur file
  // vers la droite, le fond défile moins vite que la route (parallaxe).
  unitesVisibles: 14.5,     // largeur de l'écran en unités, à la profondeur de la route (portrait)
  solEcran: 0.7,            // hauteur de la route à l'écran (fraction, depuis le haut)
  cameraDistance: 11,       // distance caméra → route (unités) : plus petit = perspective plus forte
  cameraHauteur: 3.6,       // hauteur de la caméra : plus grand = on voit plus le dessus des choses
  // Où est le joueur à l'écran (fraction de la largeur) : au départ, puis à
  // vitesse maximale — la caméra prend de l'avance quand ça accélère, pour
  // garder ~1,6 s de lecture devant soi.
  cameraJoueurX: [0.3, 0.25],

  // === SAUT (tap) ===
  sautHauteur: 1.25,     // apex du saut (unités-monde) — passe au-dessus des poules et des bottes
  sautDuree: 0.55,       // durée du saut en secondes

  // === GRILLE ===
  cadenceSpawnBeats: 1.5, // un créneau tous les 1,5 temps = 1,06 s à 85 BPM

  // === SCORE (en « pts » depuis le 9 septembre 2026 : tout le monde fait la
  // même distance sur la même course, ce qui départage c'est les potes gardés
  // et les pièces — le mot « mètres » ne voulait plus rien dire) ===
  metresParUnite: 1,      // 1 rangée = 1 pt de base (× potes, × turbo)
  // Chaque pote ajoute ce pourcentage aux mètres gagnés (×1 seul, ×3 avec 8 potes).
  potesBonusMetres: 0.25,
  // Mètres bonus par pièce ramassée (avant multiplicateur de potes).
  // v2 : 4 → 2,6. La vue de profil pose ~1,5× plus de pièces (les arcs
  // au-dessus des obstacles) ; 2,6 garde leur poids dans le score parfait au
  // niveau de la v1 (~50 %), mesuré par outils/mesurer.mjs.
  pieceMetres: 2.6,

  // === POTES ===
  // PIÈCES cumulées qui font venir le pote n°1, n°2… (croissant : chaque pote
  // est plus long à gagner que le précédent). Le premier arrive vite (8
  // pièces) pour que le principe se comprenne dans les dix premières secondes.
  potesMax: 5,              // sans ligue : la ligue de démo (5 membres)
  // Peloton (9 septembre 2026 : « il faut que les potes soient un peu plus
  // éloignés de toi, parce que c'est trop difficile sinon ») : le premier
  // pote roule `potesRecul` rangées derrière le joueur, puis `potesEcart`
  // rangées entre chaque pote (avant : 1,5 et 1,5).
  // v2 (vue de profil) : MEUTE serrée — en portrait on ne voit que ~3,5
  // unités derrière le joueur, la file indienne de la v1 (3,0 + 1,6 × rang)
  // sortait de l'écran dès le 2e pote.
  potesRecul: 1.0,
  potesEcart: 0.5,
  potesPaliers: [5, 12, 20, 30, 42],
  // Prénoms des potes, dans l'ordre d'arrivée (Soberland en premier, verrouillé).
  // Sans ligue, le peloton c'est la LIGUE DE DÉMO (7 septembre 2026) : Paul et
  // ses quatre potes, avec leurs skins. Dans une ligue, ce sont les membres.
  potesDefaut: [
    { nom: "paul", skin: { motif: "raye", c1: "#2f7a46", c2: "#f2ede2", short: "#3a3e4e", chapeau: "casquette", chaussures: "#565a66", velo: "vtt" } },
    { nom: "lea", skin: { motif: "uni", c1: "#ffcf2e", c2: "#f2ede2", short: "#3f63b4", chapeau: "paille", chaussures: "#f2ede2", velo: "grandbi" } },
    { nom: "marius", skin: { motif: "uni", c1: "#f2ede2", c2: "#f2ede2", short: "#b8402c", chapeau: "aucun", chaussures: "#f2ede2", velo: "vtt" } },
    { nom: "ines", skin: { motif: "uni", c1: "#2f7a46", c2: "#f2ede2", short: "#3a3e4e", chapeau: "bob", chaussures: "#e0742e", velo: "vtt" } },
    { nom: "hugo", skin: { motif: "carreaux", c1: "#e13e26", c2: "#0d0d10", short: "#c8963a", chapeau: "casquette", chaussures: "#33353d", velo: "grandbi" } },
  ],
  potesNoms: ["paul", "lea", "marius", "ines", "hugo"],
  ligueDemo: "PMCMP",       // code de la ligue de démo (jamais ouverte au public)
  // === BÊTA FERMÉE (16 septembre 2026) ===
  // Une ligue unique pour les fans du groupe WhatsApp. Arriver par
  // `lienJeu?ligue=BETA` met le joueur dans cette ligue ET simplifie tout le
  // menu (plus de choix de ligue, plus de sprint, plus de tiroir album) : on
  // ne joue QUE dans cette ligue. Les autres visiteurs gardent le jeu normal.
  // Table et plafond (60) créés par supabase-migration-beta.sql.
  ligueBeta: "BETA",
  ligueBetaPlafond: 60,
  betaRetours: true,        // le bouton « Laisser un retour » sur l'écran de fin
  liguesParVague: 5,        // 5 ligues jouables en même temps, au-delà : lundi prochain
  relaisDistance: 30000,    // mètres cumulés d'une ligue pour gagner le relais
  sprintDureeS: 60,         // le sprint du dimanche : 60 s, même route pour tous

  // === DOUBLE SAUT (6 septembre 2026) ===
  // Un second tap en l'air = salto. Il consomme la barre d'élan, qui se
  // recharge en `elanRechargeS` secondes — pas de double saut en continu.
  // v2 : le salto devient OBLIGATOIRE pour les obstacles hauts (tracteur,
  // fermier, voiture). Deux obstacles « salto » ne se suivent jamais (rows.js) :
  // le suivant est au moins 8 rangées plus loin, soit 1,18 s à vitesse max —
  // la barre doit donc se recharger en moins de ça, même sans pièce.
  elanRechargeS: 1.1,       // 2,5 en v1
  elanParPiece: 0.1,        // 0,25 en v1 (il y a ~3× plus de pièces : les arcs)
  piecesLogo: false,        // « mets juste des pièces jaunes pour l'instant, enlève les dessins »
  laitDureeS: 5,            // brique de lait : ×2 sur les mètres pendant 5 s
  laitVitesse: 1.2,         // et seulement +20 % de vitesse (« pas ×2, c'est n'importe quoi »)
  nuitDebutS: 95,           // la nuit tombe à partir de cet instant du morceau (30 s de transition)
  tutoParties: 2,           // tutoriel sur les deux premières parties

  // === PANNEAUX DE VILLAGE (nom, département) ===
  villages: [
    ["CYSOING", "59"],
    ["MOYENCOURT", "80"],
    ["LA FRETTE", "38"],
    ["VAL-DE-VIRIEU", "38"],
    ["BIZONNES", "38"],
  ],

  // === LIENS (identiques au premier jeu) ===
  plateformesAlbum: [
    { id: "spotify",      nom: "Spotify",       couleur: "#1DB954", geste: "appuie sur ＋ Ajouter",  url: "https://open.spotify.com/album/5nR4uZiJgNJCIRaRAo6qcX" },
    { id: "deezer",       nom: "Deezer",        couleur: "#A238FF", geste: "appuie sur ♥",           url: "https://www.deezer.com/album/1039050902" },
    { id: "apple-music",  nom: "Apple Music",   couleur: "#FA243C", geste: "appuie sur ＋",          url: "https://music.apple.com/fr/album/la-ville-est-belle-ep/6795042969" },
    { id: "tidal",        nom: "TIDAL",         couleur: "#000000", geste: "appuie sur ♥",           url: "https://tidal.com/album/546720750" },
    { id: "youtube-music", nom: "YouTube Music", couleur: "#FF0033", geste: "appuie sur Enregistrer", url: "https://music.youtube.com/playlist?list=OLAK5uy_lRwuoRCrfJSQCxEMH_GwNJCyITGAhdfNE" },
  ],
  lienSuivre: "https://open.spotify.com/artist/3TqmTXwzfX2UCduNYwW9iq",
  lienInsta: "https://www.instagram.com/pmc.mp3/",

  // === BACKEND ===
  // ⚠️ v2 (19 septembre 2026) : la v2 a SA PROPRE base Supabase, jamais celle
  // de la v1 (où tourne la bêta fermée : ses classements, son relais de la
  // semaine et ses événements ne doivent pas recevoir de courses v2).
  // Tant que le projet Supabase v2 n'existe pas, les deux champs restent VIDES :
  // net.js ne fait alors aucun appel, le jeu tourne avec la ligue de démo
  // (potesDefaut), sans ligue ni classement. Pour brancher la base : créer le
  // projet, exécuter supabase/schema-v2.sql, copier les ligues
  // (outils/copier-ligues-v1-vers-v2.mjs), puis coller ici l'URL REST
  // (https://<ref>.supabase.co/rest/v1) et la clé « anon public ».
  apiBase: "",
  apiKey: "",
  // Base des liens de ligue (?ligue=CODE). L'adresse github.io reste valable
  // quand le sous-domaine sera branché : GitHub la redirige alors (301).
  lienJeu: "https://pmcmp3.github.io/jai-un-pote-v2/",
  apiScores: "",
  apiScoresKey: "",

  toucheDebug: "d",
};

Object.freeze(window.CONFIG);
