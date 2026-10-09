// audio.js — Chargement, unlock iOS et lecture du morceau via Web Audio API.
//
// Ordre imposé par iOS (Safari ET Chrome/Firefox iOS : même moteur WebKit) :
//
//   1. Télécharger + décoder ne demande aucun geste utilisateur, mais décoder
//      exige *un* contexte : on prend un OfflineAudioContext, qui ne produit
//      aucune sortie audio et n'est donc soumis à aucune restriction iOS.
//      L'AudioBuffer obtenu est lisible par n'importe quel AudioContext
//      ensuite (AudioBufferSourceNode rééchantillonne si le taux diffère).
//   2. L'AudioContext de SORTIE est créé dans le handler du geste, jamais au
//      chargement de la page : un contexte né hors geste reste "suspended" sur
//      iOS et son currentTime ne repart pas de façon fiable, même après un
//      resume() ultérieur.
//   3. Un buffer muet démarré immédiatement dans le geste finit de débloquer
//      la sortie (resume() seul ne suffit pas toujours sur iOS).
//   4. On ne démarre la vraie lecture qu'une fois state === "running" :
//      startCtxTime doit être lu sur une horloge qui avance réellement.
//
// ⚠️ Point critique : now() est la source de temps maîtresse du jeu (clock.js
// → entities.js). Tant que le contexte n'avance pas, elle renvoie 0 en boucle
// et fige toute la grille rythmique — bonus et obstacles restent plantés sur
// place pendant que le décor, lui, défile (il avance sur dt, pas sur
// l'horloge). C'était exactement le bug remonté au playtest iPhone. main.js
// surveille isRunning() pour basculer sur une horloge de secours plutôt que
// de laisser la partie figée.

let audioCtx = null;
let buffer = null;
let rawCopy = null;   // copie de l'ArrayBuffer, gardée tant que le décodage n'a pas abouti
let armed = false;
let started = false;
let startCtxTime = 0;
let loadError = null;
// Décodage hors-ligne en échec alors qu'on a toujours les octets : ce n'est
// PAS fatal, le décodage sera retenté avec le contexte de sortie au moment du
// geste (vieux WebKit, voir waitForRunningThenPlay). Mais `buffer` reste null
// d'ici là — et sans ce drapeau, l'écran de chargement n'avait aucun moyen de
// distinguer "ça arrive" de "ça n'arrivera jamais", donc restait bloqué à 90 %
// avec le bouton JOUER grisé pour toujours (voir isReadyToStart plus bas).
let decodeDeferred = false;

// Des gains en série, chacun avec sa propre raison d'exister, pour qu'ils ne
// se marchent jamais dessus : envelopeGain fait le fondu du morceau tout seul,
// musiqueGain porte le curseur Musique, volumeGain est le point où le morceau
// et les bruitages se rejoignent (gain 1), focusGain coupe/rétablit le son
// quand l'onglet perd/reprend le focus. Le volume final = leur produit.
let envelopeGain = null;
let volumeGain = null;
let focusGain = null;
// Deux curseurs dans les options (4 octobre 2026, nuit : « un réglage pour la
// musique et un réglage pour les effets sonores ») : musiqueGain porte le
// morceau et la boucle de mort ; effetsGain TOUS les bruitages (sfx.js,
// bruitages.js, ambiance.js, le marchand, la voix « pfff, aïe »). Les deux
// arrivent sur volumeGain (volume général). effetsGain est PERSISTANT (créé au
// premier bruitage, même avant le morceau) et rebranché sur chaque nouveau
// volumeGain : playNow recrée tout le graphe à chaque reprise.
let musiqueGain = null;
let effetsGain = null, effetsBranche = null;
let pendingMusique = 1, pendingEffets = 1;
function sortieEffets() {
  if (!audioCtx) return null;
  if (!effetsGain) { effetsGain = audioCtx.createGain(); effetsGain.gain.value = pendingEffets; effetsBranche = null; }
  const cible = volumeGain || audioCtx.destination;
  if (effetsBranche !== cible) {
    try { effetsGain.disconnect(); } catch (e) { /* jamais branché */ }
    effetsGain.connect(cible);
    effetsBranche = cible;
  }
  return effetsGain;
}
let currentSource = null; // nœud en cours de lecture, pour pouvoir l'arrêter au rejeu

// Filtre passe-bas inséré en bout de chaîne, transparent en temps normal
// (fréquence de coupure au-dessus de l'audible) et refermé sur ~800 Hz quand
// le menu pause s'ouvre : on n'entend plus que les basses, comme un morceau
// qu'on écouterait depuis la pièce d'à côté. Voir setPlaybackMode() plus bas.
let lowpass = null;
const FILTRE_OUVERT_HZ = 20000;

// --- Boucle du début pendant la seconde chance (22 août 2026) --------------
// « On doit mettre en place le début de la boucle à la place du mp3 qui tourne
// de base derrière [...] le début filtré, on a le décompte des 10 secondes et
// un filtre passe-bas qui remonte au fur et à mesure du chrono. »
//
// À la mort, le morceau s'ARRÊTE (fondu court) et cette boucle prend le
// relais : le même AudioBuffer, rejoué en boucle sur ses N premières secondes
// (config.loopMortDuree, 4 mesures par défaut), dans son PROPRE passe-bas.
// screens.js pilote l'ouverture du filtre au rythme du décompte via
// setReviveIntensity().
//
// ⚠️ Deux raisons d'arrêter le morceau au lieu de le laisser tourner étouffé
// comme le menu pause :
//   1. c'est la demande — on veut entendre le DÉBUT du morceau, pas l'endroit
//      où le joueur est mort ;
//   2. ça supprime toute dérive. Le morceau ne prenant plus d'avance pendant
//      la décision (qui peut durer un aller-retour sur Spotify, donc beaucoup
//      plus que les 10 s du décompte), la reprise le relance PILE à la
//      position de la mort : pas de clockShift à encaisser, pas de soupape
//      pauseDeriveMax à surveiller sur ce chemin-là.
//
// La boucle entre dans la chaîne par volumeGain : le slider, le mute et
// l'analyseur de spectre la voient donc exactement comme le morceau. Elle
// possède en revanche son propre filtre (le passe-bas du morceau reste ouvert
// dans ce mode, il n'a rien à étouffer).
let loopSource = null;
let loopLowpass = null;
let loopGain = null;
let loopStopTimer = null;
const LOOP_FONDU = 0.25;      // s : fondu d'entrée/sortie de la boucle
const LOOP_RAMPE = 0.25;      // s : lissage d'un changement d'intensité (un cran de décompte)

function loopReglages() {
  const c = window.CONFIG;
  return {
    debut: c.loopMortDebut ?? 0,
    duree: c.loopMortDuree ?? 8,
    fMin: c.loopMortFiltreMin ?? 170,
    fMax: c.loopMortFiltreMax ?? 16000,
    gMin: c.loopMortVolumeMin ?? 0.32,
  };
}

function startReviveLoop() {
  if (!audioCtx || !buffer || loopSource) return;
  const r = loopReglages();
  const t = audioCtx.currentTime;

  // Le morceau s'efface (fondu court sur SON gain à lui : volumeGain et
  // focusGain sont partagés avec la boucle, les toucher la couperait aussi),
  // puis sa source est arrêtée pour de bon.
  if (envelopeGain) {
    envelopeGain.gain.cancelScheduledValues(t);
    envelopeGain.gain.setValueAtTime(envelopeGain.gain.value, t);
    envelopeGain.gain.linearRampToValueAtTime(0, t + LOOP_FONDU);
  }
  const mourante = currentSource;
  currentSource = null;
  if (mourante) {
    try { mourante.stop(t + LOOP_FONDU + 0.05); } catch (e) { /* déjà terminée */ }
  }
  // ⚠️ `started` reste VRAI : l'horloge de jeu est déjà gelée sur pauseAnchor
  // (setPlaybackMode l'a posé avant d'entrer ici), donc now() ne lit plus
  // l'horloge de lecture de toute façon — alors qu'un `started = false`
  // ferait mentir isRunning() au chien de garde de main.js, qui basculerait
  // la partie sur l'horloge de secours pendant la décision.

  loopLowpass = audioCtx.createBiquadFilter();
  loopLowpass.type = "lowpass";
  loopLowpass.frequency.value = r.fMin;
  loopGain = audioCtx.createGain();
  loopGain.gain.setValueAtTime(0, t);
  loopGain.gain.linearRampToValueAtTime(r.gMin, t + LOOP_FONDU);

  loopSource = audioCtx.createBufferSource();
  loopSource.buffer = buffer;
  loopSource.loop = true;
  loopSource.loopStart = r.debut;
  loopSource.loopEnd = Math.min(buffer.duration, r.debut + r.duree);
  loopSource.connect(loopLowpass);
  loopLowpass.connect(loopGain);
  // volumeGain peut ne pas exister si la partie a démarré sans morceau décodé
  // (horloge de secours) : dans ce cas il n'y a de toute façon pas de buffer,
  // on n'arrive jamais ici. Repli défensif quand même.
  loopGain.connect(musiqueGain || volumeGain || audioCtx.destination);
  loopSource.start(t, r.debut);
}

// 0 = boucle au plus fermé et au plus bas (début du décompte, ou joueur parti
// sur Spotify) ; 1 = filtre grand ouvert, volume plein (reprise imminente).
// Appelée à chaque tick du décompte par screens.js — d'où la rampe courte
// plutôt qu'un saut de valeur.
export function setReviveIntensity(p) {
  if (!loopLowpass || !loopGain || !audioCtx) return;
  const r = loopReglages();
  const k = Math.max(0, Math.min(1, p));
  const t = audioCtx.currentTime;
  // Exponentielle : une fréquence de coupure se perçoit en octaves, pas en
  // hertz (même raison que rampFilter pour le filtre de pause).
  const freq = r.fMin * Math.pow(r.fMax / r.fMin, k);
  loopLowpass.frequency.cancelScheduledValues(t);
  loopLowpass.frequency.setValueAtTime(loopLowpass.frequency.value, t);
  loopLowpass.frequency.exponentialRampToValueAtTime(Math.max(20, freq), t + LOOP_RAMPE);
  const g = r.gMin + (1 - r.gMin) * k;
  loopGain.gain.cancelScheduledValues(t);
  loopGain.gain.setValueAtTime(loopGain.gain.value, t);
  loopGain.gain.linearRampToValueAtTime(g, t + LOOP_RAMPE);
}

function stopReviveLoop(immediat = false) {
  if (loopStopTimer) { clearTimeout(loopStopTimer); loopStopTimer = null; }
  if (!loopSource) return;
  const src = loopSource;
  const g = loopGain;
  loopSource = null;
  loopGain = null;
  loopLowpass = null;
  if (immediat || !audioCtx) {
    try { src.stop(); } catch (e) { /* déjà terminée */ }
    return;
  }
  const t = audioCtx.currentTime;
  if (g) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + LOOP_FONDU);
  }
  try { src.stop(t + LOOP_FONDU + 0.05); } catch (e) { /* déjà terminée */ }
}

// Safari a longtemps n'accepté que la forme à callbacks de decodeAudioData ;
// les navigateurs récents renvoient une Promise. On accepte les deux.
function decodeWith(ctx, data) {
  return new Promise((resolve, reject) => {
    const ret = ctx.decodeAudioData(data, resolve, reject);
    if (ret && typeof ret.then === "function") ret.then(resolve, reject);
  });
}

function onDecoded(decoded) {
  buffer = decoded;
  rawCopy = null; // plus besoin de la copie de secours
  progress = 1;

  const ecart = Math.abs(decoded.duration - window.CONFIG.dureeMorceau);
  if (ecart > 0.3) {
    console.warn(
      `[audio] durée décodée ${decoded.duration.toFixed(2)}s ≠ CONFIG.dureeMorceau ` +
      `${window.CONFIG.dureeMorceau}s (écart ${ecart.toFixed(2)}s) — vérifier l'export mp3.`
    );
  }
}

// Progression 0..1 du chargement, pour l'afficher en pourcentage à l'écran :
// le morceau pèse 3,9 Mo (128 kbps), sur data mobile l'attente est réelle et
// un simple « Chargement… » ne dit pas si ça avance. On réserve les 10
// derniers pour cent au décodage, qui n'expose aucune progression.
const PART_TELECHARGEMENT = 0.9;
let progress = 0;

export function getProgress() {
  return progress;
}

// Lit la réponse en flux plutôt que d'attendre l'ArrayBuffer complet, seule
// façon de connaître l'avancement. Repli sur arrayBuffer() si le corps n'est
// pas lisible en flux ou si la taille est inconnue (pas de Content-Length).
function fetchAvecProgression(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);

    const total = Number(res.headers.get("Content-Length")) || 0;
    if (!res.body || !res.body.getReader || !total) {
      return res.arrayBuffer().then((buf) => {
        progress = PART_TELECHARGEMENT;
        return buf;
      });
    }

    const reader = res.body.getReader();
    const morceaux = [];
    let recu = 0;

    const lire = () =>
      reader.read().then(({ done, value }) => {
        if (done) {
          const tout = new Uint8Array(recu);
          let offset = 0;
          for (const m of morceaux) { tout.set(m, offset); offset += m.length; }
          progress = PART_TELECHARGEMENT;
          return tout.buffer;
        }
        morceaux.push(value);
        recu += value.length;
        progress = Math.min(PART_TELECHARGEMENT, (recu / total) * PART_TELECHARGEMENT);
        return lire();
      });

    return lire();
  });
}

fetchAvecProgression(window.CONFIG.fichierAudio)
  .then((data) => {
    // decodeAudioData "détache" l'ArrayBuffer qu'on lui passe : on garde une
    // copie pour pouvoir retenter avec le contexte de sortie si le décodage
    // hors-ligne échoue (implémentations WebKit anciennes).
    rawCopy = data.slice(0);
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    return decodeWith(new Offline(1, 1, 44100), data);
  })
  .then(onDecoded)
  .catch((err) => {
    // Pas encore fatal : une 2e tentative aura lieu avec le contexte de sortie
    // au moment du geste (voir waitForRunningThenPlay).
    console.warn("[audio] décodage hors-ligne impossible, retentera au démarrage :", err);
    if (!rawCopy) loadError = err;
    else decodeDeferred = true;
  });

// `offset` = seconde du morceau où démarrer la lecture. 0 au premier
// lancement et au rejeu. Non nul dans un seul cas restant : la soupape de
// dérive en sortie de pause, quand le morceau a tellement avancé qu'il
// finirait avant la ligne d'arrivée (voir setPlaybackMode). Une sortie de
// pause ordinaire ne rembobine PLUS le morceau : c'est la course qui se
// recale dessus, via clockShift.
const REPRISE_FONDU = 0.18; // s : fondu d'entrée d'une reprise en cours de morceau

function playNow(offset = 0) {
  if (!audioCtx || !buffer) return;

  if (currentSource) {
    try { currentSource.stop(); } catch (e) { /* déjà terminé */ }
  }

  const sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = buffer;
  currentSource = sourceNode;

  // --- Morceau en BOUCLE (24 août 2026, jeu infini) -------------------------
  // La course n'a plus de fin (voir entities.js) : le morceau ne doit plus
  // s'arrêter. Longueur de boucle arrondie à la MESURE inférieure (4 temps à
  // 120 BPM = 2 s) : le raccord retombe pile sur la grille rythmique du jeu
  // (clock.timeOfBeat), donc les créneaux restent calés sur les temps du
  // morceau à chaque tour de boucle — c'est la même astuce que la boucle de
  // mort (loopMortDuree = 4 mesures pile).
  const debutBoucle = window.CONFIG.premierTempsOffset;
  const mesure = beatPeriod * 4;
  const longueurBoucle = Math.max(mesure,
    Math.floor((buffer.duration - debutBoucle) / mesure) * mesure);
  // « J'ai un pote » est un contre-la-montre : le morceau ne boucle PAS, sa fin
  // termine la partie (config.boucleMorceau, 6 septembre 2026).
  sourceNode.loop = window.CONFIG.boucleMorceau !== false;
  sourceNode.loopStart = debutBoucle;
  sourceNode.loopEnd = debutBoucle + longueurBoucle;
  // L'offset de LECTURE est replié dans la boucle si la course a dépassé la
  // durée du morceau (reprise/rembobinage tard dans une longue partie) —
  // l'horloge de jeu, elle, reste continue : startCtxTime plus bas est
  // toujours calculé sur l'offset NON replié. Le repli étant un multiple de
  // mesures, la musique reste sur la même grille de temps que la course.
  const audioOffset = offset <= sourceNode.loopEnd
    ? offset
    : debutBoucle + ((offset - debutBoucle) % longueurBoucle);

  envelopeGain = audioCtx.createGain();
  volumeGain = audioCtx.createGain();
  musiqueGain = audioCtx.createGain();
  musiqueGain.gain.value = pendingMusique;
  focusGain = audioCtx.createGain();
  focusGain.gain.value = mode === "silent" ? 0 : 1; // repart coupé si on est déjà en pause silencieuse
  lowpass = audioCtx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = mode === "muffled" ? window.CONFIG.pauseFiltreHz : FILTRE_OUVERT_HZ;

  sourceNode.connect(envelopeGain);
  envelopeGain.connect(musiqueGain);
  musiqueGain.connect(volumeGain);
  volumeGain.connect(lowpass);
  lowpass.connect(focusGain);
  focusGain.connect(audioCtx.destination);

  const { fonduEntree } = window.CONFIG;
  const now = audioCtx.currentTime;

  // Le fondu d'entrée n'a de sens qu'au vrai début du morceau : reprendre en
  // plein milieu avec une montée de 1,2 s s'entendrait comme un gonflement.
  // (Plus de fondu de SORTIE programmé : le morceau boucle sans fin depuis le
  // passage au jeu infini — voir la section boucle plus haut.)
  if (offset > 0) {
    // Fondu très court (pas les 1,2 s du vrai début, qui s'entendraient comme
    // un gonflement en plein morceau) : sans lui, une reprise en pleine forme
    // d'onde claque. Chemin emprunté par la soupape de dérive ET par la sortie
    // de la boucle de mort, qui relance le morceau à la seconde exacte de la
    // mort.
    envelopeGain.gain.setValueAtTime(0, now);
    envelopeGain.gain.linearRampToValueAtTime(1, now + REPRISE_FONDU);
  } else {
    envelopeGain.gain.setValueAtTime(0, now);
    envelopeGain.gain.linearRampToValueAtTime(1, now + fonduEntree);
  }

  sortieEffets(); // les bruitages suivent le nouveau volumeGain (pause étouffée, onglet quitté)
  sourceNode.start(0, audioOffset);
  startCtxTime = now - offset; // now() doit renvoyer `offset` à cet instant précis
  clockShift = 0;              // la lecture repart calée sur la course : plus aucun retard à traîner
  started = true;

  // Métadonnées « Now Playing » (21 août 2026, avec le favicon) : c'est ce qui
  // habille la Dynamic Island / l'écran verrouillé pendant que le morceau
  // joue — titre, artiste, pochette de l'EP. Purement déclaratif et
  // best-effort : aucun navigateur n'en dépend pour jouer le son.
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "J'ai un pote",
        artist: "PMC",
        artwork: [{ src: "assets/cover-ep.webp", sizes: "480x480", type: "image/webp" }],
      });
    } catch (e) { /* MediaMetadata absent : tant pis, rien à faire */ }
  }
}

// Attend que le contexte tourne VRAIMENT (et que le buffer soit prêt) avant
// de lancer la lecture. Sans cette attente, on capturait startCtxTime sur une
// horloge gelée et le jeu entier se retrouvait bloqué à t=0 (voir en-tête).
const RESUME_POLL_MS = 100;
const RESUME_TIMEOUT_MS = 8000;

function waitForRunningThenPlay(deadline = performance.now() + RESUME_TIMEOUT_MS) {
  if (started || !audioCtx) return;

  if (audioCtx.state !== "running") {
    // iOS repasse en "suspended"/"interrupted" tout seul (appel entrant,
    // mise en arrière-plan…) : on relance tant qu'on est dans les temps.
    audioCtx.resume().catch(() => {});
    if (performance.now() < deadline) setTimeout(() => waitForRunningThenPlay(deadline), RESUME_POLL_MS);
    return;
  }

  if (!buffer) {
    if (loadError) return;
    // Le décodage hors-ligne a pu échouer : on retente avec le contexte de
    // sortie, maintenant qu'il existe.
    if (rawCopy) {
      const data = rawCopy;
      rawCopy = null;
      decodeWith(audioCtx, data)
        .then((decoded) => { onDecoded(decoded); waitForRunningThenPlay(); })
        .catch((err) => {
          loadError = err;
          console.error("[audio] décodage impossible :", err);
        });
      return;
    }
    // Décodage encore en cours : on repasse dans un instant.
    setTimeout(() => waitForRunningThenPlay(performance.now() + RESUME_TIMEOUT_MS), RESUME_POLL_MS);
    return;
  }

  playNow();
}

// À appeler directement depuis un handler de geste utilisateur
// (pointerdown/click/keydown) — jamais depuis un callback async. Ne fait QUE
// débloquer la sortie audio (contexte + buffer muet) : ne lance pas encore la
// vraie lecture. Séparé de play() pour permettre un décompte visuel entre le
// tap sur JOUER et le vrai début de la course, sans perdre le déblocage iOS
// (qui doit impérativement arriver dans la pile d'appel du geste — un
// setTimeout ultérieur ne compte plus comme un geste aux yeux d'iOS).
export function unlock() {
  if (started || armed) return;
  armed = true;

  // « J'avais pas de son sur mon tél » — remonté à chaque playtest iPhone, et
  // à chaque fois la cause était l'interrupteur SILENCIEUX physique : par
  // défaut, iOS classe le Web Audio en catégorie "ambient", donc coupé par le
  // petit switch latéral, exactement comme un son d'interface. Aucun réglage
  // dans la page ne pouvait le contourner… jusqu'à l'API AudioSession
  // (Safari 16.4+) : en déclarant le type "playback", on dit à iOS que c'est
  // du contenu média (comme un lecteur de musique), et le son sort MÊME en
  // mode silencieux. À poser avant la création du contexte, et sans risque
  // ailleurs (l'API n'existe simplement pas sur les autres navigateurs).
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch (e) { /* non bloquant : on retombe sur le comportement par défaut */ }

  const Ctx = window.AudioContext || window.webkitAudioContext;
  audioCtx = new Ctx();

  // Buffer muet démarré DANS le geste : c'est lui qui débloque réellement la
  // sortie audio sur iOS. Doit être synchrone, avant tout await/then.
  try {
    const silent = audioCtx.createBufferSource();
    silent.buffer = audioCtx.createBuffer(1, 1, 22050);
    silent.connect(audioCtx.destination);
    silent.start(0);
  } catch (e) { /* non bloquant : le resume() ci-dessous peut suffire */ }

  audioCtx.resume().catch(() => {});
}

// Lance la vraie lecture. Peut être appelé plus tard que unlock() (ex. après
// un décompte) : le contexte est déjà créé/débloqué à ce stade, donc plus
// besoin d'un geste utilisateur pour démarrer une source sur ce contexte.
export function play() {
  waitForRunningThenPlay();
}

// Relance le morceau depuis le début (bouton "Rejouer" après game over/fin
// de course) — le contexte est déjà débloqué depuis la première partie.
export function restart() {
  if (!audioCtx) return;
  // Une relance efface toute pause en cours : sans ça, un « Recommencer la
  // course » lancé depuis le menu pause repartirait avec l'horloge gelée et
  // le filtre encore fermé.
  mode = "running";
  stopReviveLoop(true); // une relance efface aussi la boucle de mort restée en fond
  pauseAnchor = null;
  clockShift = 0; // le retard accumulé pendant les pauses de la partie précédente ne se transmet pas
  if (suspendTimer) { clearTimeout(suspendTimer); suspendTimer = null; }
  if (audioCtx.state !== "running") audioCtx.resume().catch(() => {});
  if (!buffer) return;
  playNow();
}

// Vrai uniquement si le son sort ET si l'horloge audio avance : c'est la
// condition pour que now() soit une source de temps de jeu valable.
export function isRunning() {
  return started && audioCtx !== null && audioCtx.state === "running";
}

// Erreur fatale de chargement (téléchargement impossible, ou décodage en
// échec des deux côtés), ou null tant que tout va bien. Exporté pour que
// l'écran de chargement puisse SORTIR de son attente : sans ça, `progress`
// n'atteignait jamais 1, le bouton JOUER restait grisé pour toujours et le
// joueur n'avait aucun moyen de savoir pourquoi — le seul état du jeu dont
// on ne pouvait pas sortir, alors que la course, elle, sait tourner sans le
// morceau (horloge de secours, voir l'en-tête et main.js).
export function getLoadError() {
  return loadError;
}

// Peut-on lancer une partie ? Vrai dès que le morceau est décodé — mais AUSSI
// quand le décodage hors-ligne a échoué et sera retenté au geste : dans ce
// cas les octets sont là, il n'y a plus rien à attendre côté écran de
// chargement. Sans cette seconde branche, `buffer` restait null pour toujours
// et le bouton JOUER ne s'activait jamais, y compris quand la lecture aurait
// parfaitement démarré au tap suivant. Et si le décodage rate aussi cette
// fois-là, la partie part sur l'horloge de secours avec son bandeau « Son
// indisponible » (main.js/hud.js) — jamais sur un menu qui ne répond plus.
export function isReadyToStart() {
  return Boolean(buffer) || decodeDeferred;
}

// État lisible pour l'overlay de debug (indispensable pour diagnostiquer à
// distance sur un téléphone, où il n'y a ni console ni clavier).
export function getStatus() {
  if (loadError) return "échec chargement";
  if (!audioCtx) return buffer ? "prêt (en attente du tap)" : "décodage…";
  if (audioCtx.state !== "running") return `contexte ${audioCtx.state}`;
  if (!buffer) return "running, décodage…";
  if (!started) return "running, en attente";
  if (mode === "revive") return "boucle du début (seconde chance)";
  if (mode === "muffled") return "lecture (pause, filtre 800 Hz)";
  // Le retard course↔morceau est invisible en jeu : on l'affiche ici, c'est le
  // seul moyen de le vérifier sur un téléphone (ni console ni clavier).
  return clockShift > 0 ? `lecture (retard ${clockShift.toFixed(2)}s)` : "lecture";
}

// Secondes écoulées depuis le premier échantillon du morceau — c'est cette
// fonction que main.js branche sur clock.setTimeSource() une fois démarré.
export function now() {
  // Gelée pendant la pause : le contexte peut très bien continuer de tourner
  // (menu pause = le morceau continue, étouffé par le passe-bas) mais la
  // course, elle, doit rester exactement là où le joueur l'a laissée.
  if (pauseAnchor !== null) return pauseAnchor;
  // clockShift = retard accumulé de la course sur le morceau (voir
  // setPlaybackMode). Vaut 0 tant qu'aucune pause n'a eu lieu.
  return started ? audioCtx.currentTime - startCtxTime - clockShift : 0;
}

// Les deux curseurs des options (0..1), retenus avant même que le son existe.
function regler(gainNode, v) {
  if (!gainNode || !audioCtx) return;
  gainNode.gain.setTargetAtTime(v, audioCtx.currentTime, 0.03); // glisser le curseur ne grésille pas
}
export function setVolumeMusique(v) { pendingMusique = Math.max(0, Math.min(1, v)); regler(musiqueGain, pendingMusique); }
export function getVolumeMusique() { return pendingMusique; }
export function setVolumeEffets(v) { pendingEffets = Math.max(0, Math.min(1, v)); regler(effetsGain, pendingEffets); }
export function getVolumeEffets() { return pendingEffets; }

// --- Jingle de combo (demandé le 20 août 2026 : « quand y'a un combo, un
// bruit de pixels dans la tonalité du morceau ») ------------------------------
// ⚠️ Réaccordé le 4 octobre 2026 (nuit) : il jouait encore en RÉ BÉMOL MAJEUR,
// la tonalité de « La ville est belle » (le jeu n°1) — fausse sur « J'ai un
// pote », qui est en MI MINEUR / SOL MAJEUR (mesuré : chromagramme du MP3,
// notes dominantes mi, do, si, sol, ré, la). Il ne joue plus que la
// PENTATONIQUE de sol (sol, la, si, ré, mi — voir bruitages.js, GAMME) : pas un
// demi-ton, rien ne frotte, quel que soit l'accord du moment.
// Onde carrée = le timbre « console 8 bits » demandé. L'arpège s'allonge d'une
// note par palier (4 notes au ×1,5, puis 5, puis 6) : le son lui-même dit que
// ça monte. Branché sur volumeGain (donc le slider et le mute s'appliquent),
// jamais sur envelopeGain (réservé au fondu du morceau).
const JINGLE_NOTES = [587.33, 659.26, 783.99, 987.77, 1174.66, 1318.51]; // Ré5 Mi5 Sol5 Si5 Ré6 Mi6
const JINGLE_PAS_S = 0.066;   // écart entre deux notes — débit « pièce de Mario »
// 0,16 → 0,09 le 21 août 2026 (« baisse de 5 dB le bruit des bruitages ») :
// −5 dB = ×10^(−5/20) ≈ ×0,562, soit 0,16 × 0,562 ≈ 0,09.
const JINGLE_GAIN = 0.09;     // crête par note : présent sans couvrir le morceau

export function playComboJingle(palier) {
  // Uniquement quand le son tourne vraiment : en secours silencieux (contexte
  // jamais créé ou suspendu), un jingle seul dans le silence serait étrange.
  if (!audioCtx || audioCtx.state !== "running" || mode !== "running") return;
  const nNotes = Math.min(3 + Math.max(1, palier), JINGLE_NOTES.length);
  const t0 = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.connect(sortieEffets());
  for (let i = 0; i < nNotes; i++) {
    const osc = audioCtx.createOscillator();
    osc.type = "square";
    osc.frequency.value = JINGLE_NOTES[i];
    const g = audioCtx.createGain();
    const t = t0 + i * JINGLE_PAS_S;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(JINGLE_GAIN, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}

// --- Le MARCHAND du marché (4 octobre 2026, nuit) ------------------------------
// « Quatre euros les belles courgettes ! » : un vocal de PMC enregistré au
// téléphone, nettoyé et passé au mégaphone dans une halle (fichier
// config.fichierMarchand, traitement décrit dans CLAUDE.md). Joué pas fort, une
// fois par course, au passage du marché. main.js le replace à chaque pas
// (placerMarchand) : il arrive de la droite, étouffé, s'éclaircit devant les
// étals et repart à gauche — c'est ça, le fondu d'entrée et de sortie. Passe
// par volumeGain comme les bruitages (curseur du joueur, pause étouffée,
// onglet quitté).
let marchandBuf = null;
let marchandChargement = false;
let marchand = null; // { src, filtre, gain, pan, fini, maj } de la course en cours

export function prechargerMarchand() {
  if (marchandChargement) return;
  marchandChargement = true;
  const url = window.CONFIG.fichierMarchand;
  if (!url) return;
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((data) => {
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      return decodeWith(new Offline(1, 1, 44100), data);
    })
    .then((decoded) => { marchandBuf = decoded; })
    .catch(() => { /* fichier absent ou illisible : le marché reste muet */ });
}

// Lance le vocal, une fois par course. false tant qu'il n'est pas prêt (main.js
// retente au pas suivant) ou s'il a déjà joué.
export function lancerMarchand() {
  if (marchand || !audioCtx || !marchandBuf || audioCtx.state !== "running" || mode !== "running") return false;
  const src = audioCtx.createBufferSource();
  src.buffer = marchandBuf;
  const filtre = audioCtx.createBiquadFilter();
  filtre.type = "lowpass";
  filtre.frequency.value = 1000;
  const gain = audioCtx.createGain();
  gain.gain.value = 0; // monte avec le premier placerMarchand : pas de clic
  const pan = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
  src.connect(filtre);
  filtre.connect(gain);
  const sortie = sortieEffets();
  if (pan) { gain.connect(pan); pan.connect(sortie); } else gain.connect(sortie);
  marchand = { src, filtre, gain, pan, fini: false, maj: -1 };
  src.onended = () => { if (marchand && marchand.src === src) marchand.fini = true; };
  src.start(audioCtx.currentTime);
  return true;
}

// ecart = position du marchand − position du joueur, en rangées (positif : il
// est encore devant, à droite de l'écran).
export function placerMarchand(ecart) {
  if (!marchand || marchand.fini || !audioCtx) return;
  const t = audioCtx.currentTime;
  if (t - marchand.maj < 0.04) return; // ~25 retouches par seconde suffisent
  marchand.maj = t;
  const proche = 1 / (1 + (ecart / 16) ** 2); // 1 devant les étals, ~0,2 à 30 rangées
  const vol = (window.CONFIG.marchandVolume ?? 0.6) * (0.35 + 0.65 * proche);
  marchand.gain.gain.setTargetAtTime(vol, t, 0.1);
  marchand.filtre.frequency.setTargetAtTime(900 + 5100 * proche, t, 0.1);
  if (marchand.pan) marchand.pan.pan.setTargetAtTime(Math.max(-0.7, Math.min(0.7, ecart / 25)), t, 0.1);
}

// Pause, mort, onglet quitté : il se tait (fondu court) et ne reprend pas.
export function couperMarchand() {
  if (!marchand || marchand.fini || !audioCtx) return;
  const t = audioCtx.currentTime;
  marchand.gain.gain.cancelScheduledValues(t);
  marchand.gain.gain.setTargetAtTime(0, t, 0.06);
  try { marchand.src.stop(t + 0.4); } catch (e) { /* déjà arrêté */ }
  marchand.fini = true;
}

// Nouvelle course : il pourra rejouer.
export function oublierMarchand() {
  couperMarchand();
  marchand = null;
}

export function marchandEtat() {
  return !marchand ? (marchandBuf ? "pret" : "attente") : marchand.fini ? "fini" : "joue";
}

// --- Modes de lecture (course / menu pause / onglet quitté) ------------------
// Trois états, et un seul point d'entrée pour en changer : main.js calcule le
// mode voulu à partir de ses deux drapeaux (menu pause ouvert, onglet caché)
// et appelle setPlaybackMode(). Aucun appelant n'a à savoir ce que ça
// implique côté Web Audio.
//
//   "running"  — la course : filtre ouvert, son plein.
//   "muffled"  — menu pause : le morceau CONTINUE mais passe dans le filtre
//                passe-bas (~800 Hz, réglable dans config.js), donc on
//                n'entend plus que les basses. Demandé explicitement.
//   "silent"   — onglet/app quitté : fondu à 0 puis audioCtx.suspend(). Là,
//                jouer même étouffé n'aurait aucun sens, personne n'écoute.
//
// ⚠️ Le point délicat est l'horloge. now() est la source de temps maîtresse
// du jeu (voir en-tête). Dès qu'on quitte le mode "running", on la gèle à la
// main (pauseAnchor) : en "muffled" le contexte tourne toujours (sinon la
// course avancerait derrière le panneau de pause), et en "silent" le suspend
// n'arrive qu'après le fondu — et sur iOS le timer qui le déclenche peut ne
// jamais partir tant que l'app est en arrière-plan. Un seul mécanisme couvre
// donc les deux.
//
// À la reprise, le morceau a pris de l'avance sur la course. C'est LA course
// qui se recale sur lui : on n'a jamais rembobiné le morceau (l'artiste
// l'entendait comme un retour en arrière), on encaisse l'écart dans
// `clockShift`, un retard permanent que now() retranche à l'horloge audio.
//
// Le retard est arrondi au TEMPS musical le plus proche, et c'est tout
// l'intérêt : les objets arrivent tous les 1,5 temps, donc un décalage
// multiple d'un temps les laisse exactement sur la même grille rythmique — ils
// retombent sur les temps du morceau comme avant, simplement plus loin dans le
// morceau. Le résidu est au pire d'un demi-temps (0,25 s à 120 BPM), soit le
// petit sursaut de la course à la reprise, dans un sens ou dans l'autre.
//
// Seule contrepartie : le morceau finit `clockShift` secondes plus tôt dans la
// course. Il y a ~114 s de marge (course `dureeCourse` = 143,5 s, morceau
// 257,9 s) — au-delà de `pauseDeriveMax` (25 s), la soupape rembobine quand
// même, sans quoi le joueur terminerait en silence.
// Durée du fondu des GAINS à l'entrée/sortie de pause. Lue dans config.js —
// c'est ce que ce réglage promet ("à l'entrée comme à la sortie de la pause"),
// alors qu'une constante locale figée à 0,5 vivait ici en parallèle : le
// filtre suivait le réglage, les gains non. Les deux valeurs coïncidaient,
// donc rien ne se voyait — jusqu'au jour où on aurait touché à pauseFondu.
function pauseFade() {
  return window.CONFIG.pauseFondu;
}
let mode = "running";
let pauseAnchor = null; // temps de jeu gelé pendant la pause (null = horloge libre)
let clockShift = 0;     // retard permanent de la course sur le morceau, en secondes
let suspendTimer = null;

// Même valeur que clock.js, recalculée ici plutôt qu'importée : audio.js est
// sous l'horloge de jeu dans la pile de dépendances, pas au-dessus.
const beatPeriod = 60 / window.CONFIG.bpm;

function rampFilter(target) {
  if (!lowpass) return;
  // Un ralenti en cours survit à une pause : on rouvre sur SON filtre.
  if (ralentiOn && target === FILTRE_OUVERT_HZ) target = 650;
  const t = audioCtx.currentTime;
  lowpass.frequency.cancelScheduledValues(t);
  lowpass.frequency.setValueAtTime(lowpass.frequency.value, t);
  // Rampe exponentielle : une fréquence se perçoit en octaves, pas en hertz —
  // une rampe linéaire de 20 kHz à 800 Hz semblerait ne rien faire pendant
  // presque tout le fondu, puis tout faire à la fin.
  lowpass.frequency.exponentialRampToValueAtTime(Math.max(20, target), t + window.CONFIG.pauseFondu);
}

function rampFocus(target) {
  if (!focusGain) return;
  const t = audioCtx.currentTime;
  focusGain.gain.cancelScheduledValues(t);
  focusGain.gain.setValueAtTime(focusGain.gain.value, t);
  focusGain.gain.linearRampToValueAtTime(target, t + pauseFade());
}

// Ralenti du tuto contextuel (main.js) : le morceau passe dans un passe-bas le
// temps de la consigne — on entend que le temps s'est arrêté, la musique non.
let ralentiOn = false;
export function setRalenti(on) {
  ralentiOn = !!on;
  if (!audioCtx || !lowpass || mode !== "running") return;
  const t = audioCtx.currentTime;
  lowpass.frequency.cancelScheduledValues(t);
  lowpass.frequency.setValueAtTime(lowpass.frequency.value, t);
  lowpass.frequency.exponentialRampToValueAtTime(on ? 650 : FILTRE_OUVERT_HZ, t + (on ? 0.2 : 0.35));
}

export function setPlaybackMode(next) {
  if (next === mode) return;
  const precedent = mode;
  mode = next;

  // Le gel de l'horloge se pose/se lève indépendamment du contexte audio :
  // il doit tenir même si la lecture n'a pas encore démarré.
  if (next !== "running" && pauseAnchor === null) pauseAnchor = now();

  if (suspendTimer) { clearTimeout(suspendTimer); suspendTimer = null; }
  if (!audioCtx || !started) {
    if (next === "running") pauseAnchor = null;
    return;
  }

  // Seconde chance : le morceau s'arrête, la boucle du début prend le relais
  // dans son propre passe-bas (voir startReviveLoop). ⚠️ Ce mode l'emporte sur
  // "silent" côté main.js même quand l'onglet est caché : la boucle DOIT
  // continuer de tourner pendant que le joueur est parti ajouter le morceau
  // sur Spotify — c'est tout l'intérêt.
  if (next === "revive") {
    audioCtx.resume().catch(() => {});
    rampFocus(1);
    rampFilter(FILTRE_OUVERT_HZ); // le filtre du morceau n'a plus rien à étouffer : la boucle a le sien
    startReviveLoop();
    return;
  }

  if (next === "silent") {
    rampFocus(0);
    // On laisse le fondu finir avant de suspendre pour de vrai — un suspend()
    // immédiat couperait la rampe en plein milieu, ce qui s'entend comme un clic.
    suspendTimer = setTimeout(() => {
      suspendTimer = null;
      if (mode === "silent" && audioCtx.state === "running") audioCtx.suspend().catch(() => {});
    }, pauseFade() * 1000);
    return;
  }

  audioCtx.resume().catch(() => {});

  if (next === "muffled") {
    rampFocus(1);
    rampFilter(window.CONFIG.pauseFiltreHz);
    return;
  }

  // next === "running"
  // Sortie de la boucle de mort : aucun calcul de dérive à faire, le morceau
  // ne tournait plus. On le relance PILE à la seconde où le joueur est mort
  // (donc course et morceau restent calés l'un sur l'autre, clockShift remis
  // à 0 par playNow) et la boucle s'efface par-dessus en fondu.
  if (precedent === "revive") {
    const reprise = pauseAnchor === null ? now() : pauseAnchor;
    pauseAnchor = null;
    stopReviveLoop();
    playNow(reprise);
    return;
  }

  if (pauseAnchor !== null) {
    const reprise = pauseAnchor;
    pauseAnchor = null;

    // Écart pris par le morceau pendant la pause. Nul (ou presque) si le
    // contexte avait vraiment été suspendu, égal à la durée de la pause s'il a
    // continué de tourner derrière le filtre.
    const positionMorceau = audioCtx.currentTime - startCtxTime;
    const ecart = Math.max(0, positionMorceau - clockShift - reprise);
    const rattrapage = Math.round(ecart / beatPeriod) * beatPeriod;

    // (Plus de cas « morceau fini » : il boucle sans fin depuis le passage au
    // jeu infini — seule la dérive excessive déclenche encore la soupape.)
    if (clockShift + rattrapage > window.CONFIG.pauseDeriveMax) {
      // Soupape : la course a pris trop de retard sur le morceau — on
      // relance la lecture pile sur la position de la course.
      playNow(reprise);
      // playNow() a recréé tout le graphe (donc un filtre neuf, ouvert par
      // défaut puisque mode vaut déjà "running") : on le repose fermé avant de
      // lancer la rampe, sinon la réouverture serait instantanée.
      if (lowpass) lowpass.frequency.value = window.CONFIG.pauseFiltreHz;
    } else {
      // Cas normal : le morceau garde sa position, la course encaisse le
      // retard — arrondi au temps musical près pour rester sur la grille.
      clockShift += rattrapage;
    }
  }

  rampFocus(1);
  rampFilter(FILTRE_OUVERT_HZ);
}


// --- Sortie pour les bruitages (sfx.js, 6 septembre 2026) --------------------
// Le contexte et le nœud de volume, uniquement quand le son tourne vraiment :
// les bruitages passent par volumeGain (donc le curseur du joueur), jamais par
// les fondus de pause du morceau.
export function sfxOutput() {
  if (!audioCtx || audioCtx.state !== "running") return null;
  return { ctx: audioCtx, dest: sortieEffets() };
}

// --- Échantillons (4 octobre 2026, nuit) ---------------------------------------
// Un fichier son court (la voix « pfff, aïe » du joueur qui se prend un
// obstacle) : chargé et décodé hors-ligne à la première demande, comme le
// marchand. null tant qu'il n'est pas prêt (ou s'il manque : le jeu s'en passe).
const echantillons = new Map(); // url → AudioBuffer | "charge" | "echec"
export function echantillon(url) {
  if (!url) return null;
  const e = echantillons.get(url);
  if (e && typeof e.getChannelData === "function") return e;
  if (e) return null;
  echantillons.set(url, "charge");
  fetch(url)
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.arrayBuffer(); })
    .then((data) => {
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      return decodeWith(new Offline(1, 1, 44100), data);
    })
    .then((b) => { echantillons.set(url, b); })
    .catch(() => { echantillons.set(url, "echec"); });
  return null;
}
