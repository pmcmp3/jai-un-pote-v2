// main.js — « J'ai un pote v2 » : VUE DE PROFIL, une seule voie (19 septembre
// 2026, « exactement comme Jetpack Joyride ou Zombie Tsunami »). Boucle à pas
// fixe 120 Hz, horloge = audio (comme le premier jeu), rangées et traversants
// (rows.js), meute de potes (friends.js), projection de côté (scene.js).
// Gestes : tap = saut, re-tap en l'air = salto. Tout se franchit en hauteur :
// saut pour les petits obstacles, salto pour les hauts (tracteur, fermier,
// voiture) ; les pièces dessinent le saut à faire.
//
// ⚠️ CONTRE-LA-MONTRE (6 septembre 2026) : la course dure exactement le
// morceau (config.dureeMorceau, 173,65 s), qui ne boucle pas. Sa fin termine
// la partie (« TERMINÉ ! »), sauf mort avant. Le score est en « pts »
// (9 septembre 2026) : distance × potes × turbo + pièces.
//
// ⚠️ UNE LIGUE = UNE COURSE (9 septembre 2026) : graine dérivée du code de
// ligue (regles.graineLigue), score PARFAIT calculé par simulation.js, et
// FANTÔME du meilleur de la ligue (fantome.js) qui roule à côté du joueur.

import * as audio from "./audio.js";
import * as sfx from "./sfx.js";
import { clock } from "./clock.js";
import * as scene from "./scene.js";
import * as rows from "./rows.js";
import * as props from "./props.js";
import * as friends from "./friends.js";
import * as hud from "./hud.js";
import * as screens from "./screens.js";
import * as net from "./net.js";
import * as debugOverlay from "./debug.js";
import { consumeJumpPress, consumeWheelie, isHolding } from "./input.js";
import { PALETTES, paletteDepuisSkin } from "./rider.js";
import { drawRider, RIDER_HEIGHT } from "./voxrider.js";
import { drawCoin } from "./coin.js";
import { V_UNIT, LEAD_IN, targetSpeed as targetSpeedRegle, multiplicateur as multRegle, graineLigue } from "./regles.js";
import { scoreParfait } from "./simulation.js";
import * as fantome from "./fantome.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
let width = 0, height = 0, safeTop = 0;
const safeProbe = document.getElementById("safe-probe");

let dprCourant = 1;
function resize() {
  // DPR plafonné à 1,5 sur mobile (2 sur ordinateur) : la scène est faite de
  // cubes à bords nets, la différence ne se voit pas, le coût de remplissage
  // baisse de 44 %.
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  dprCourant = dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scene.setViewport(width, height);
  // Encoche / barre d'état (iPhone en plein écran) : le HUD descend d'autant.
  safeTop = safeProbe ? Math.max(0, Math.round(safeProbe.getBoundingClientRect().top)) : 0;
}
window.addEventListener("resize", resize);
resize();

function updateBrowserChromeInset() {
  if (!window.visualViewport) return;
  const inset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
  document.documentElement.style.setProperty("--browser-chrome-bottom", `${Math.round(inset)}px`);
}
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateBrowserChromeInset);
  window.visualViewport.addEventListener("scroll", updateBrowserChromeInset);
  updateBrowserChromeInset();
}

// Vibrations : Android (Chrome/Firefox) seulement — Safari iOS n'expose pas
// navigator.vibrate, et aucune API web ne fait vibrer un iPhone. Sans effet là-bas.
function vibrer(motif) { try { if (navigator.vibrate) navigator.vibrate(motif); } catch (e) { /* rien */ } }

// --- Horloge ---------------------------------------------------------------
const perfClock = () => performance.now() / 1000;
const AUDIO_START_TIMEOUT = 3;
const AUDIO_STALL_TIMEOUT = 1;
let gameStarted = false;
let startRequested = false;
let startRequestedAt = 0;
let audioDrivesClock = false;
let audioFallback = false;
const audioWatch = { lastT: -1, lastReal: 0 };

function useFallbackClock(preserve) {
  clock.setTimeSource(perfClock, preserve);
  audioDrivesClock = false;
  audioFallback = true;
}

const COUNT_IN_BEATS = 3;
const COUNT_IN_GO_LINGER_S = 0.55;
let departMorceau = 0; // position du morceau au GO (le contre-la-montre compte à partir de là)
function ancrerDepartSurLaGrille() {
  const pos = audioDrivesClock ? audio.now() : 0;
  const pas = clock.beatPeriod;
  const go = Math.ceil((pos + LEAD_IN) / pas) * pas;
  departMorceau = go;
  clock.jumpBy(-(go - pos));
}
// Temps restant avant la fin du morceau (= de la course).
function tempsRestant() {
  if (game.sprint) return (window.CONFIG.sprintDureeS || 60) - Math.max(0, clock.now());
  const duree = window.CONFIG.dureeMorceau;
  const pos = audioDrivesClock ? audio.now() : departMorceau + clock.now();
  return duree - pos;
}

// --- Pause -------------------------------------------------------------------
let manualPaused = false, hiddenPaused = false, revivePaused = false;
let pauseStartedAt = 0;
function isPaused() { return manualPaused || hiddenPaused || revivePaused; }
function applyPauseState() {
  const next = revivePaused ? "revive" : hiddenPaused ? "silent" : manualPaused ? "muffled" : "running";
  audio.setPlaybackMode(next);
  if (next !== "running") {
    if (pauseStartedAt === 0) pauseStartedAt = perfClock();
  } else {
    if (pauseStartedAt > 0) {
      const ecart = perfClock() - pauseStartedAt;
      if (!audioDrivesClock) clock.jumpBy(-Math.round(ecart / clock.beatPeriod) * clock.beatPeriod);
      if (startRequested && !gameStarted) startRequestedAt += ecart;
    }
    pauseStartedAt = 0;
    audioWatch.lastT = audio.now();
    audioWatch.lastReal = perfClock();
  }
}
document.addEventListener("visibilitychange", () => { hiddenPaused = document.hidden; applyPauseState(); });

// --- État de partie ------------------------------------------------------------
const game = {
  metres: 0, points: 0, potesGagnes: 0, etoiles: 0,
  ended: false, endReason: null, reviveOffered: false, sansFaute: true, startedAt: 0,
  turbo: 0, finAge: -1, sprint: false, cibleRachat: null, surHalle: false,
  graine: 0, ligueCourse: false, scoreMax: null, // course de LIGUE : graine partagée, score parfait
};
// Une seule voie : le joueur reste en u = 0 (u est gardé pour le fantôme).
const player = { u: 0, prevU: 0, v: 0, prevV: 0, jumpY: 0, prevJumpY: 0, jumpVy: 0, pedal: 0, prevPedal: 0, doubled: false, flip: 0, prevFlip: 0, tHaut: 0, roue: 0, prevRoue: 0 };
// Position du joueur à l'écran (fraction de la largeur), lissée : la caméra
// prend de l'avance quand la vitesse monte (config.cameraJoueurX).
let cameraX = null;
let speed = V_UNIT * window.CONFIG.vitesseBase;
// Courbe de vitesse et multiplicateur : regles.js (partagés avec la simulation).
const targetSpeed = targetSpeedRegle;
// Saut à hauteur VARIABLE (20 septembre 2026, demandé : « on peut sauter un
// peu haut si on reste appuyé 0,5 s, et si on double-tape après, on peut
// faire un double saut, comme dans tous les jeux d'arcade ») :
//   - tap court        → apex ~1,3 (les poules, les chats, les moutons) ;
//   - appui maintenu   → la pesanteur est réduite tant qu'on monte, apex ~2,5
//                        (les vaches, les tracteurs) ;
//   - re-tap en l'air  → on REMONTE d'un coup (apex ~3,7 depuis un saut
//                        maintenu) + salto (les fermiers, les voitures).
function jumpPhysics() {
  const C = window.CONFIG;
  return { vJump: C.sautVitesse, vDouble: C.sautVitesseDouble, g: C.sautGravite, gTenu: C.sautGraviteTenue, tenueMax: C.sautTenueMaxS, sol: rows.solAt };
}
function multiplicateur() { return multRegle(friends.count(), game.turbo > 0); }
// Hauteur du sol sous le joueur : la route (0), le plancher d'une halle, ou le
// toit d'une voiture s'il arrive déjà au-dessus d'elle.
function solSous(v, jumpY) { return Math.max(rows.solAt(v), rows.toitSous(rows.routeVivante(), v, jumpY)); }
// Pente locale du sol, en radians : sert à incliner le vélo sur la rampe.
function penteSol(v) { return Math.atan2(rows.solAt(v + 0.6) - rows.solAt(v - 0.6), 1.2); }
function palierPrecedent() {
  const p = window.CONFIG.potesPaliers;
  if (game.cibleRachat !== null && game.cibleRachat !== undefined) return game.cibleRachat - (window.CONFIG.poteRachatPieces || 10);
  return game.potesGagnes === 0 ? 0 : p[game.potesGagnes - 1];
}
// Pièces à ramasser pour le prochain pote. Après le dernier palier, un pote
// perdu se RACHÈTE (20 septembre 2026 : « j'ai perdu tous mes potes et
// j'arrive pas à les regagner ») : une cible relative est posée à la perte.
function prochainPalier() {
  const p = window.CONFIG.potesPaliers;
  if (game.cibleRachat !== null && game.cibleRachat !== undefined) return game.cibleRachat;
  return p[Math.min(game.potesGagnes, p.length - 1)];
}
function armerRachat() {
  if (friends.count() >= friends.max()) { game.cibleRachat = null; return; }
  if (game.potesGagnes < window.CONFIG.potesPaliers.length) return; // les paliers suffisent
  game.cibleRachat = game.points + (window.CONFIG.poteRachatPieces || 10);
}
const sparkles = [];
function semerSparkles(u, v, n = 9, couleur = null) {
  for (let i = 0; i < n; i++) sparkles.push({ u, v, h: 0.6, vu: (Math.random() - 0.5) * 3, vv: (Math.random() - 0.5) * 3, vh: 1.5 + Math.random() * 2.5, age: 0, couleur });
}
const ghosts = []; // traînée du salto

// --- Tutoriel ------------------------------------------------------------------
// Sur les `config.tutoParties` premières parties : consignes une à une au
// tout début, chacune validée par le geste (ou passée après 5 s). Pendant le
// tuto la vitesse est bridée et la route reste sans danger (rows.GRACE).
const TUTO_ETAPES = [
  { titre: "TAP = SAUTER", sous: "les poules, les chats, les moutons se sautent", test: (ev) => ev === "jump" },
  { titre: "RESTE APPUYÉ = PLUS HAUT", sous: "les vaches, les cochons, les fermiers", test: (ev) => ev === "haut" },
  { titre: "RE-TAP EN L'AIR = DOUBLE SAUT", sous: "tout ce qui roule se passe en double saut", test: (ev) => ev === "salto" },
  { titre: "LES PIÈCES APPELLENT TES POTES", sous: "elles dessinent le saut à faire", test: (ev) => ev === "piece" },
];
const tuto = { actif: false, index: 0, ok: 0, timer: 0, alpha: 0 };
function tutoDemarrer() { tuto.actif = true; tuto.index = 0; tuto.ok = 0; tuto.timer = 0; tuto.alpha = 0; }
function tutoEvenement(ev) {
  if (!tuto.actif || tuto.ok > 0) return;
  if (TUTO_ETAPES[tuto.index].test(ev)) { tuto.ok = 0.8; sfx.piece(); }
}
function tutoStep(dt, now) {   // eslint-disable-line no-shadow
  if (!tuto.actif) return;
  if (now < 0) return;
  tuto.alpha = Math.min(1, tuto.alpha + dt * 3);
  if (tuto.ok > 0) {
    tuto.ok -= dt;
    if (tuto.ok <= 0) { tuto.ok = 0; tuto.index += 1; tuto.timer = 0; }
  } else {
    // Une étape n'avance QUE sur le geste (8 septembre 2026 : « étape par
    // étape, pour que les gens puissent bien jouer »). Garde-fou : 25 s.
    tuto.timer += dt;
    if (tuto.timer > 25) { tuto.index += 1; tuto.timer = 0; }
  }
  if (tuto.index >= TUTO_ETAPES.length) { tuto.actif = false; lancerBestiaire(); }
}
function tutoVue() {
  if (!tuto.actif) return null;
  const e = TUTO_ETAPES[tuto.index];
  return { titre: e.titre, sous: e.sous, index: tuto.index + 1, total: TUTO_ETAPES.length, ok: tuto.ok > 0, alpha: tuto.alpha };
}

// --- Bestiaire du début de course ------------------------------------------------
// Trois familles, deux vignettes chacune, dessinées UNE fois par le moteur
// (comme l'aperçu du cycliste) puis affichées au-dessus de la route pendant
// les premières secondes, quand la route est encore vide.
const BESTIAIRE = [
  { geste: "TAP", texte: "les petits animaux", kinds: ["poule", "chien", "mouton"] },
  { geste: "RESTE APPUYÉ", texte: "les gros et les fermiers", kinds: ["cochon", "vache", "fermier"] },
  { geste: "DOUBLE TAP", texte: "tout ce qui roule", kinds: ["voiture", "tracteur"] },
];
// 10 s au total, UNE famille à la fois (20 septembre 2026 : « le menu du début,
// laisse un décompte de 10, c'est très bien, mais fais une étape par une
// étape »). Le décompte s'affiche, le joueur roule sur une route encore vide.
const BESTIAIRE_S = 10;
let bestiaire = null, bestiaireT = 0;
function prechaufferBestiaire() {
  const VW = 700;
  bestiaire = BESTIAIRE.map((g) => {
    const images = g.kinds.map((kind) => {
      const K = rows.KINDS[kind];
      const cv = document.createElement("canvas");
      const dpr = 2, larg = Math.round(46 + K.long * 26), haut = 108;
      cv.width = larg * dpr; cv.height = haut * dpr;
      const c2 = cv.getContext("2d");
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.setViewport(VW, VW);
      scene.setJoueurX(0.5);
      scene.setCamera(0);
      const a = scene.project(0, 0, 0);
      c2.save();
      c2.translate(larg / 2 - a.x, haut - 14 - a.y);
      try {
        if (K.traverse) props.drawCrosser(c2, kind, 0, 0, -1, 0.3, 1);
        else props.drawStatic(c2, kind, 0, 0, 0.3);
      } catch (e) { /* une vignette ratée ne doit rien casser */ }
      c2.restore();
      return cv;
    });
    return { geste: g.geste, texte: g.texte, images };
  });
  scene.setViewport(width, height);
}

// --- Effets ------------------------------------------------------------------
const popups = [];
function pousserPopup(texte, couleur) {
  const decalage = popups.filter((p) => p.age < 0.5).length * 24;
  popups.push({ texte, couleur, age: 0, decalage });
  if (popups.length > 3) popups.shift();
}
let banner = null;
function afficherBanner(titre, sous, couleur, duree = 2.4) { banner = { titre, sous, couleur, duree, timer: duree }; }
const shake = { time: 0, duration: 0.5, amp: 6 };
const rendusRates = new Set();   // une trace par message, pas une par image
let damageFlash = 0;
let hudAlpha = 0;
const HUD_FADE = 0.6;
let hintTimer = 0;
let reviveShieldUntil = -Infinity;
const JAUNE = "#ffcf2e", ROUGE = "#e13e26";
let klaxonne = new Set();

// --- Départ / rejeu -----------------------------------------------------------------
let paletteJoueur = PALETTES.pmc;
function preparerJoueur() {
  paletteJoueur = paletteDepuisSkin(screens.getSkin());
  scene.setVille(screens.getVille());
}
// Graine du sprint du dimanche : la même route pour tout le monde ce jour-là.
function graineSprint() { let h = 0; for (const ch of net.jourSprint()) h = (h * 31 + ch.charCodeAt(0)) % 100000; return h; }
// --- La course de la ligue (9 septembre 2026) --------------------------------------
// Une ligue = une graine (regles.graineLigue) : tous ses membres jouent la
// MÊME route. Le sprint garde sa graine du jour ; sans ligue, graine aléatoire
// (chaque partie différente). Calcule aussi le score PARFAIT de la course
// (simulation.js, ~4 ms, avec le nombre de potes possibles = les autres
// membres) et va chercher le FANTÔME du meilleur de la ligue.
function semerCourse() {
  const l = screens.getLigue();
  const seed = game.sprint ? graineSprint() : l ? graineLigue(l.code) : Math.floor(Math.random() * 100000);
  rows.reseed(seed);
  rows.reset();
  game.graine = seed;
  game.ligueCourse = !!l && !game.sprint;
  game.scoreMax = game.ligueCourse ? scoreParfait(seed, friends.max()).score : null;
  fantome.demarrerEnregistrement();
  ghost = null;
  if (game.ligueCourse) chargerFantome(l, seed);
}
let ghost = null; // { graine, pseudo, palette, trace } — le meilleur de la ligue
async function chargerFantome(l, seed) {
  const f = await net.fantome(l.code, seed);
  if (!f || seed !== game.graine) return;
  const trace = fantome.decoder(f.trace);
  if (!trace) return;
  const membre = (l.membres || []).find((m) => m.nom === f.pseudo);
  const base = PALETTES.potes[0];
  const palette = membre && membre.skin ? paletteDepuisSkin(membre.skin, base) : base;
  ghost = { graine: seed, pseudo: f.pseudo, metres: f.metres, palette, trace };
}

function requestGameStart(opts = {}) {
  game.startedAt = perfClock();
  startRequested = true;
  startRequestedAt = perfClock();
  hintTimer = 9;
  game.sprint = !!opts.sprint;
  semerCourse();
  preparerJoueur();
  if (screens.getParties() === 0) net.evenement("premiere_course", { pseudo: screens.getPseudo(), source: screens.getSource(), ligue: screens.getLigue() ? screens.getLigue().code : null });
  if (screens.getParties() < (window.CONFIG.tutoParties || 0) && !game.sprint) tutoDemarrer(); else lancerBestiaire();
  screens.compterPartie();
}
function isGameStartRequested() { return startRequested; }

function lancerBestiaire(duree = BESTIAIRE_S) { bestiaireT = duree; }

function resetRun() {
  game.metres = 0; game.points = 0; game.potesGagnes = 0; game.etoiles = 0;
  game.ended = false; game.endReason = null; game.reviveOffered = false; game.sansFaute = true;
  game.turbo = 0; game.finAge = -1; game.surHalle = false; tombes.clear();
  game.startedAt = perfClock();
  player.u = 0; player.prevU = 0; player.v = 0; player.prevV = 0; cameraX = null;
  player.jumpY = 0; player.prevJumpY = 0; player.jumpVy = 0; player.doubled = false; player.flip = 0; player.prevFlip = 0; player.tHaut = 0; player.roue = 0; player.prevRoue = 0;
  game.cibleRachat = null;
  sparkles.length = 0; ghosts.length = 0;
  speed = V_UNIT * window.CONFIG.vitesseBase; nuitDebut = null;
  friends.reset();
  klaxonne = new Set();
  popups.length = 0; banner = null; damageFlash = 0; shake.time = 0; hudAlpha = 0; hintTimer = 6;
  canvas.classList.remove("game-over-bw", "danger", "turbo");
  scene.setNight(0);
}

function restartGame() {
  screens.preparerLigue();
  preparerJoueur();
  game.sprint = false; // REJOUER après un sprint = une vraie course
  audio.restart();
  if (audio.isRunning()) {
    clock.setTimeSource(audio.now);
    audioDrivesClock = true; audioFallback = false;
    audioWatch.lastT = -1; audioWatch.lastReal = perfClock();
  } else {
    useFallbackClock(false);
  }
  resetRun();
  semerCourse();
  ancrerDepartSurLaGrille();
  gameStarted = true;
  startRequested = true;
  if (screens.getParties() < (window.CONFIG.tutoParties || 0)) tutoDemarrer(); else lancerBestiaire();
  screens.compterPartie();
}

// --- Mort / fin ------------------------------------------------------------------
function mourir() {
  game.sansFaute = false;
  triggerShake(10, 0.6);
  damageFlash = 1;
  vibrer([120, 60, 200]);
  sfx.potePerdu();
  if (!game.reviveOffered) {
    game.reviveOffered = true;
    revivePaused = true;
    applyPauseState();
    screens.hidePauseButton();
    canvas.classList.add("game-over-bw");
    screens.openReviveSheet({
      metres: game.metres,
      potes: friends.maxReached(),
      onAccept: () => {
        canvas.classList.remove("game-over-bw");
        revivePaused = false;
        applyPauseState();
        screens.showPauseButton();
        consumeJumpPress();
        const retour = Math.min(2, friends.maxReached());
        for (let i = 0; i < retour; i++) friends.join(player);
        afficherBanner(retour > 1 ? "TES POTES SONT REVENUS" : retour === 1 ? "TON POTE EST REVENU" : "C'EST REPARTI", null, JAUNE);
        reviveShieldUntil = clock.now() + 2.5;
      },
      onDecline: () => { revivePaused = false; applyPauseState(); endGame("mort"); },
      onReplay: () => { revivePaused = false; applyPauseState(); restartGame(); },
    });
  } else {
    endGame("mort");
  }
}

// Fin du morceau : « TERMINÉ ! », le joueur continue de rouler 1,5 s en roue
// libre, puis l'écran de fin.
function terminer() {
  game.ended = true;
  game.endReason = "fin";
  game.finAge = 0;
  sfx.fin();
  vibrer([60, 40, 60, 40, 120]);
  screens.hidePauseButton();
  const record = !game.sprint && game.metres > screens.getRecord();
  if (record) screens.setRecord(game.metres);
  screens.showEndScreen({ metres: game.metres, potesMax: friends.maxReached(), record, fin: true, sprint: game.sprint, scoreMax: game.scoreMax });
  screens.finLigue(game.metres, friends.maxReached(), game.sprint ? "sprint" : "course", bilanCourse());
  net.evenement("course_finie", { pseudo: screens.getPseudo(), source: screens.getSource(), ligue: screens.getLigue() ? screens.getLigue().code : null });
}

function endGame(reason) {
  game.ended = true;
  game.endReason = reason;
  canvas.classList.add("game-over-bw");
  canvas.classList.remove("turbo");
  screens.hidePauseButton();
  const record = game.metres > screens.getRecord();
  if (record) screens.setRecord(game.metres);
  screens.showEndScreen({ metres: game.metres, potesMax: friends.maxReached(), record, fin: false, sprint: game.sprint, scoreMax: game.scoreMax });
  screens.finLigue(game.metres, friends.maxReached(), game.sprint ? "sprint" : "course", bilanCourse());
}

// Ce que la fin de course envoie à la ligue : graine (le classement d'une
// ligue ne compare que les courses de la même route) et trace du fantôme.
function bilanCourse() { return { graine: game.graine, trace: fantome.encoder(), scoreMax: game.scoreMax }; }

function triggerShake(amp, duration) { shake.amp = amp; shake.duration = duration; shake.time = duration; }

function arriveePote(pote, direct) {
  if (!pote) return;
  sfx.pote();
  vibrer(30);
  // Une seule ligne, courte (7 septembre 2026 : « trop d'infos au mètre carré »).
  afficherBanner(`@${(pote.name || "pote").toUpperCase()} EST LÀ !`, null, JAUNE, 1.6);
  audio.playComboJingle(Math.min(6, friends.count()));
}

function gagnerPiece(u, v) {
  const mult = multiplicateur();
  const m = window.CONFIG.pieceMetres * mult;
  game.points += 1;
  game.metres += m;
  game.etoiles += 1;
  semerSparkles(u, v);
  sfx.piece();
  tutoEvenement("piece");
  while (game.potesGagnes < window.CONFIG.potesPaliers.length && game.points >= window.CONFIG.potesPaliers[game.potesGagnes]) {
    game.potesGagnes += 1;
    arriveePote(friends.join(player), false);
  }
  // Rachat d'un pote perdu une fois tous les paliers franchis.
  if (game.cibleRachat !== null && game.cibleRachat !== undefined && game.points >= game.cibleRachat) {
    game.cibleRachat = null;
    const pote = friends.join(player);
    if (pote) arriveePote(pote, false);
    armerRachat();
  }
}
function gagnerLait(u, v) {
  game.turbo = window.CONFIG.laitDureeS || 5;
  sfx.lait();
  vibrer(40);
  semerSparkles(u, v, 16, "#ffffff");
  afficherBanner("TURBO LAIT", "×2 sur tes points pendant 5 s", JAUNE, 1.6);
  canvas.classList.add("turbo");
  // Pas d'obstacles pendant le turbo : la route devient sûre au-delà de
  // l'écran (les rangées déjà visibles sont couvertes par l'invulnérabilité).
  const r0 = Math.floor(player.v + 0.5) + scene.ROWS_AHEAD + 1;
  rows.ouvrirFenetreSure(r0, r0 + Math.ceil(speed * (window.CONFIG.laitVitesse || 1.2) * (window.CONFIG.laitDureeS || 5)) + 12);
}
function gagnerRouge(u, v) {
  sfx.rouge();
  semerSparkles(u, v, 22, "#ff5a3c");
  const pote = friends.join(player);
  if (pote) arriveePote(pote, true);
  else { game.metres += 40 * multiplicateur(); pousserPopup("+40 PTS", JAUNE); }
}

// Une bête percutée tombe (20 septembre 2026) : on retient la rangée et
// l'instant, le rendu la fait basculer pendant 1,6 s.
const tombes = new Map();
function marquerTombe(ev, now) { if (ev.r !== undefined && !KINDS_ROULANTS.has(ev.kind)) tombes.set(ev.r, now); }
const KINDS_ROULANTS = new Set(["tracteur", "voiture", "contresens", "poulelancee"]);

function toucherJoueur(ev) {
  if (clock.now() < reviveShieldUntil || invincible || game.turbo > 0) return;
  marquerTombe(ev, clock.now());
  if (friends.count() > 0) {
    const perdus = friends.lose(ev.cout);
    game.sansFaute = false;
    triggerShake(6, 0.45);
    damageFlash = 0.8;
    vibrer(60);
    sfx.potePerdu();
    // Juste « −1 POTE » au-dessus du joueur (« tu enlèves le wording, tu dis
    // juste −1 pote en pop-up par-dessus et voilà »).
    pousserPopup(perdus.length > 1 ? `−${perdus.length} POTES` : "−1 POTE", ROUGE);
    armerRachat();
  } else {
    mourir();
  }
}

// --- Traversées armées sur le passage du joueur --------------------------------
const ARM_AHEAD_S = 4.0; // 2,6 → 4,0 le 9 septembre 2026 : le tracteur part plus tôt, donc plus lentement (rows.js, vmax)
function armerTraversees(now, vitesse) {
  const r0 = Math.floor(player.v + 0.5);
  const rMax = r0 + Math.ceil(vitesse * ARM_AHEAD_S) + 1;
  for (let r = Math.max(0, r0); r <= rMax; r++) {
    const row = rows.rowAt(r);
    if ((row.type !== "traverse" && row.type !== "contresens") || row.armed) continue;
    const tArr = now + (r - player.v) / Math.max(0.5, vitesse);
    if (tArr - now > ARM_AHEAD_S) continue;
    rows.armer(row, now, tArr);
    if ((row.kind === "tracteur" || row.kind === "contresens") && !klaxonne.has(r)) { klaxonne.add(r); sfx.klaxon(); }
  }
}

// --- Simulation ------------------------------------------------------------------
const STEP = 1 / 120;
const MAX_FRAME_TIME = 0.1;

function step(dt) {
  if (!gameStarted && startRequested) {
    if (audio.isRunning()) {
      clock.setTimeSource(audio.now);
      audioDrivesClock = true;
      audioWatch.lastT = -1; audioWatch.lastReal = perfClock();
      gameStarted = true;
    } else if (perfClock() - startRequestedAt > AUDIO_START_TIMEOUT) {
      useFallbackClock(false);
      gameStarted = true;
    }
    if (gameStarted) ancrerDepartSurLaGrille();
  }
  if (gameStarted && audioDrivesClock && !game.ended) {
    const audioT = audio.now();
    if (audioT > audioWatch.lastT + 1e-4) { audioWatch.lastT = audioT; audioWatch.lastReal = perfClock(); }
    else if (perfClock() - audioWatch.lastReal > AUDIO_STALL_TIMEOUT) useFallbackClock(true);
  }

  player.prevU = player.u; player.prevV = player.v; player.prevJumpY = player.jumpY; player.prevPedal = player.pedal; player.prevFlip = player.flip;
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const sp = sparkles[i];
    sp.age += dt; sp.u += sp.vu * dt; sp.v += sp.vv * dt; sp.h += sp.vh * dt; sp.vh -= 9 * dt;
    if (sp.age > 0.6) sparkles.splice(i, 1);
  }
  for (let i = ghosts.length - 1; i >= 0; i--) { ghosts[i].age += dt; if (ghosts[i].age > 0.35) ghosts.splice(i, 1); }

  for (let i = popups.length - 1; i >= 0; i--) { popups[i].age += dt; if (popups[i].age >= 1.1) popups.splice(i, 1); }
  if (banner) { banner.timer -= dt; if (banner.timer <= 0) banner = null; }
  if (damageFlash > 0) damageFlash = Math.max(0, damageFlash - dt);
  if (shake.time > 0) shake.time = Math.max(0, shake.time - dt);
  if (hintTimer > 0 && gameStarted) hintTimer -= dt;
  // Le bestiaire s'affiche au départ, ou juste après le tutoriel.
  if (gameStarted && !game.ended && bestiaireT > 0 && clock.now() >= 0) bestiaireT -= dt;

  if (gameStarted) {
    const enDecompte = clock.now() < -COUNT_IN_BEATS * clock.beatPeriod;
    const cible = game.ended || enDecompte ? 0 : 1;
    if (hudAlpha !== cible) { const pas = dt / HUD_FADE; hudAlpha = cible > hudAlpha ? Math.min(cible, hudAlpha + pas) : Math.max(cible, hudAlpha - pas); }
  }

  if (!gameStarted) {
    player.pedal += 4.5 * dt;
    return;
  }
  if (game.ended) {
    // Roue libre après « TERMINÉ ! » : on continue d'avancer, sans rien ramasser.
    if (game.finAge >= 0) { game.finAge += dt; player.v += speed * 0.6 * dt; player.pedal += speed * dt * 2; friends.recordPlayer(player.v, null); friends.update(dt, player, jumpPhysics()); }
    return;
  }
  if (isPaused()) return;

  const now = clock.now();
  const phys = jumpPhysics();
  tutoStep(dt, now);

  // --- Nuit : tombe à partir de nuitDebutS, 30 s de transition ---
  const nd = nuitDebut !== null ? nuitDebut : window.CONFIG.nuitDebutS;
  if (nd !== undefined) scene.setNight(Math.max(0, Math.min(1, (now - nd) / 30)));
  // Le soleil traverse le ciel sur toute la durée du morceau.
  scene.setHeure(now / Math.max(1, window.CONFIG.dureeMorceau));

  // --- Saut : tap, maintien, double saut ---
  // ⚠️ Le sol n'est plus toujours 0 : sur une halle, le plancher monte
  // (rows.solAt). Décoller, retomber et « être au sol » se comparent donc à la
  // hauteur du sol SOUS le joueur, jamais à zéro.
  let marque = null; // « saut » ou « double » : la meute le refera au même endroit
  const solIci = solSous(player.v, player.jumpY);
  const tap = consumeJumpPress();
  if (tap && player.jumpY <= solIci + 0.02) {
    player.jumpVy = phys.vJump; player.jumpY = solIci + 0.001; player.doubled = false; player.tHaut = 0; player.tenueMarquee = false;
    marque = "saut"; sfx.saut(); tutoEvenement("jump");
  } else if (tap && player.jumpY > solIci && !player.doubled) {
    player.jumpVy = phys.vDouble; player.doubled = true; player.flip = 0.001; player.tHaut = phys.tenueMax;
    marque = "double"; sfx.salto(); vibrer(25);
    semerSparkles(player.u, player.v, 12);
    tutoEvenement("salto");
  }
  if (player.jumpY > solIci) {
    // Tant que le doigt reste appuyé et qu'on monte, la pesanteur est réduite.
    const tenu = isHolding() && player.jumpVy > 0 && player.tHaut < phys.tenueMax;
    if (tenu) player.tHaut += dt;
    player.jumpVy -= (tenu ? phys.gTenu : phys.g) * dt;
    player.jumpY += player.jumpVy * dt;
    if (player.tHaut > 0.12 && !player.tenueMarquee) { player.tenueMarquee = true; friends.marquerTenue(); tutoEvenement("haut"); }
  }
  if (player.flip > 0) {
    player.flip = Math.min(Math.PI * 2, player.flip + dt * (Math.PI * 2 / 0.55));
    const last = ghosts[ghosts.length - 1];
    if (!last || last.t + 0.04 < now) ghosts.push({ u: player.u, v: player.v, h: player.jumpY, flip: player.flip, age: 0, t: now });
  }
  // Roue arrière (swipe vers le bas) : purement décoratif, au sol seulement.
  if (consumeWheelie() && player.jumpY <= 0 && player.roue <= 0) { player.roue = 0.001; sfx.saut(); }
  player.prevRoue = player.roue;
  if (player.roue > 0) { player.roue = player.roue + dt / 0.9; if (player.roue >= 1) player.roue = 0; }

  // --- Turbo lait ---
  if (game.turbo > 0) { game.turbo -= dt; if (game.turbo <= 0) { game.turbo = 0; canvas.classList.remove("turbo"); } }

  // --- Avance ---
  speed += (targetSpeed(now) - speed) * Math.min(1, 3 * dt);
  const vitesse = speed * (game.turbo > 0 ? (window.CONFIG.laitVitesse || 1.2) : 1) * (tuto.actif ? 0.55 : 1);
  if (now >= 0) {
    const dv = vitesse * dt;
    player.v += dv;
    game.metres += dv * window.CONFIG.metresParUnite * multiplicateur();
  }
  player.pedal += vitesse * dt * 3.2;
  // Retombée / roulage sur la rampe de la halle, ou atterrissage sur le toit
  // d'une voiture : le vélo colle au plancher trouvé sous lui.
  const solApres = solSous(player.v, player.jumpY);
  if (player.jumpY <= solApres) {
    if (player.jumpVy < -0.5 && game.surHalle === false) sfx.saut();
    player.jumpY = solApres; player.jumpVy = 0; player.doubled = false; player.flip = 0; player.tHaut = 0;
  }
  const surHalle = rows.solAt(player.v) > 0.05;
  if (surHalle && !game.surHalle) afficherBanner("LES HALLES !", "ramasse tout là-haut", JAUNE, 1.6);
  game.surHalle = surHalle;
  if (now >= 0) fantome.enregistrer(now, player.u, player.v, player.jumpY);
  friends.recordPlayer(player.v, marque);
  friends.update(dt, player, phys);

  // --- Traversées : armées pour croiser le joueur ---
  if (tuto.actif) rows.ouvrirFenetreSure(Math.floor(player.v + 0.5) + 1, Math.floor(player.v + 0.5) + scene.ROWS_AHEAD + 2);
  if (now >= 0) armerTraversees(now, vitesse);

  // --- Collisions et pièces ---
  if (now >= 0) {
    for (const ev of rows.checkMember("j", player.prevV, player.v, player.jumpY, now)) {
      if (ev.type === "piece") gagnerPiece(player.u, player.v);
      else if (ev.type === "lait") gagnerLait(player.u, player.v);
      else if (ev.type === "rouge") gagnerRouge(player.u, player.v);
      else { toucherJoueur(ev); if (game.ended || revivePaused) break; }
    }
    for (const m of friends.members()) {
      for (const ev of rows.checkMember(m.id, m.prevV, m.v, m.jumpY, now)) {
        if (ev.type === "piece") gagnerPiece(m.u, m.v);
        else if (ev.type === "lait") gagnerLait(m.u, m.v);
        else if (ev.type === "rouge") gagnerRouge(m.u, m.v);
      }
    }
  }

  // --- Fin du morceau = fin de la course ---
  if (now >= 0 && !game.ended && tempsRestant() <= 0) { terminer(); return; }

  if (friends.count() > 0 || friends.maxReached() === 0) canvas.classList.remove("danger");
  else if (!game.ended) canvas.classList.add("danger");
}

// Touches de debug (avec ?debug) : P = +1 pote, O = −1 pote, G = mourir,
// I = invincible, L = turbo lait, N = nuit tout de suite, F = fin du morceau.
let invincible = false;
let nuitDebut = null; // surcharge debug (CONFIG est gelé)
window.addEventListener("keydown", (e) => {
  if (!debugOverlay.isEnabled() || !gameStarted || game.ended) return;
  if (e.code === "KeyI") { invincible = !invincible; afficherBanner(invincible ? "INVINCIBLE" : "VULNÉRABLE", "debug", JAUNE, 1.2); }
  if (e.code === "KeyP") arriveePote(friends.join(player), false);
  if (e.code === "KeyO") { friends.lose(1); pousserPopup("−1 POTE", ROUGE); }
  if (e.code === "KeyG") mourir();
  if (e.code === "KeyL") gagnerLait(player.u, player.v);
  if (e.code === "KeyN") { nuitDebut = clock.now() - 30; }
  if (e.code === "KeyF") terminer();
});

// --- Rendu ---------------------------------------------------------------------
const GEO_HALLE = { haut: rows.HALLE_HAUT, montee: 7, plat: 26, descente: 7, total: rows.HALLE_ROWS };
const SIGN_EVERY = 45;
// Un seul panneau à la fois : celui d'entrée de village (la ville du joueur)
// efface le panneau régulier voisin (20 septembre 2026 : « j'ai eu deux
// panneaux en même temps, c'est assez bizarre »).
function panneauVilleProche(r) {
  if (!scene.villeDuJoueur()) return false;
  for (let d = -9; d <= 9; d++) if (scene.debutVillage(r + d)) return true;
  return false;
}
function signAt(r) {
  const villages = window.CONFIG.villages || [];
  if (!villages.length || r % SIGN_EVERY !== 20) return null;
  if (panneauVilleProche(r)) return null;
  return villages[Math.floor(r / SIGN_EVERY) % villages.length];
}

// Pièce, brique de lait ou pièce rouge, flottant à la hauteur `h` au-dessus
// de la route (rangée r).
function drawPiece(r, h, now, kind) {
  const bob = Math.sin(now * 3 + r * 0.7) * 0.05;
  const spin = (now * Math.PI * 2) / (clock.beatPeriod * 2) + r * 0.9 + h;
  if (kind === "lait") {
    // Brique de lait : une VRAIE boîte qui tourne autour de son axe vertical
    // (scene.drawBoxR). L'astuce précédente — réduire la largeur au cosinus —
    // ne pouvait pas marcher : drawBox ne peint que des boîtes alignées sur
    // les axes, donc la brique s'écrasait au lieu de tourner (20 septembre
    // 2026 : « ça ne marche toujours pas en 3D, il faut que tu voies la logique »).
    const bas = h - 0.42 + bob;
    scene.drawShadow(ctx, 0, r, 0.22, 0.22, 0.18);
    scene.drawBoxR(ctx, 0, r, 0.42, 0.42, 0.74, "#f8f8f4", bas, spin);
    scene.drawBoxR(ctx, 0, r, 0.44, 0.44, 0.2, "#2f7fd6", bas + 0.2, spin);
    scene.drawBoxR(ctx, 0, r, 0.16, 0.16, 0.14, "#e8e8e2", bas + 0.74, spin);   // le bec
    return;
  }
  // UNE SEULE taille de pièce, et la grosse dorée exactement 1,6 fois plus
  // grande (20 septembre 2026 : « les tailles et l'espacement entre les
  // pièces, ça n'a aucun sens »).
  const p = scene.project(-0.35, r, h + bob);
  const R = scene.scale() * (kind === "grosse" ? PIECE_R * 1.6 : PIECE_R);
  ctx.save();
  ctx.translate(p.x, p.y);
  drawCoin(ctx, R, spin, kind === "grosse");
  ctx.restore();
}
const PIECE_R = 0.3;

// Avertisseur « ! » au bord droit (comme les missiles de Jetpack Joyride) :
// une traversée est armée mais sa rangée n'est pas encore à l'écran.
function renderAlertes(now, vitesse) {
  if (!gameStarted || game.ended || now < 0) return;
  const devant = scene.unitesDevant();
  const r0 = Math.floor(player.v + devant) + 1, r1 = Math.floor(player.v + vitesse * ARM_AHEAD_S) + 2;
  for (let r = r0; r <= r1; r++) {
    const row = rows.rowAt(r);
    if ((row.type !== "traverse" && row.type !== "contresens") || !row.armed) continue;
    const tRest = (r - player.v) / Math.max(0.5, vitesse);
    const urgence = Math.max(0, Math.min(1, 1 - (tRest - 1) / 2.5));
    const pouls = 0.82 + 0.18 * Math.sin(now * 16);
    const taille = (26 + 16 * urgence) * pouls;
    const y = scene.project(0, player.v, 1.4).y;
    // ⚠️ Le panneau tenait sur `width − 18 − taille` et son sommet droit
    // partait donc HORS de l'écran (20 septembre 2026 : « il est coupé sur la
    // droite, il apparaît pas dans tout l'écran »). Il est désormais posé sur
    // sa largeur réelle, 2 × taille, avec une marge franche.
    const x = width - 14 - taille * 2;
    ctx.save();
    // Halo puis panneau plein, contour blanc : il doit sauter aux yeux
    // (20 septembre 2026 : « le panneau d'attention n'est pas du tout assez visible »).
    const halo = ctx.createRadialGradient(x + taille, y, 0, x + taille, y, taille * 2.4);
    const grave = row.kind === "tracteur" || row.kind === "contresens";
    const teinte = grave ? "225,62,38" : "255,207,46";
    halo.addColorStop(0, `rgba(${teinte},${0.5 * urgence + 0.2})`);
    halo.addColorStop(1, `rgba(${teinte},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(x + taille - taille * 2.4, y - taille * 2.4, taille * 4.8, taille * 4.8);
    ctx.fillStyle = grave ? "#e13e26" : "#ffcf2e";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x + taille, y - taille * 1.15);
    ctx.lineTo(x + taille * 2, y + taille * 0.8);
    ctx.lineTo(x, y + taille * 0.8);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = grave ? "#ffffff" : "#0d0d10";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.round(taille * 1.15)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillText("!", x + taille, y + taille * 0.22);
    ctx.restore();
    break;
  }
}

function render(alpha) {
  // ⚠️ On repart d'une matrice propre à chaque image. Un seul `ctx.save()` non
  // rendu — une exception au milieu d'une rotation, par exemple — laissait
  // sinon TOUT le jeu penché jusqu'au rechargement de la page.
  ctx.setTransform(dprCourant, 0, 0, dprCourant, 0, 0);
  ctx.globalAlpha = 1;
  const now = clock.now();
  const u = player.prevU + (player.u - player.prevU) * alpha;
  const v = player.prevV + (player.v - player.prevV) * alpha;
  const jy = player.prevJumpY + (player.jumpY - player.prevJumpY) * alpha;
  const pedal = player.prevPedal + (player.pedal - player.prevPedal) * alpha;
  const flip = player.prevFlip + (player.flip - player.prevFlip) * alpha;
  const tAnim = gameStarted ? Math.max(0, now) + 30 : perfClock();
  scene.setDecorTime(tAnim);
  // Caméra : le joueur recule vers la gauche de l'écran quand ça accélère.
  const [xDepart, xMax] = window.CONFIG.cameraJoueurX || [0.3, 0.25];
  const vMin = V_UNIT * window.CONFIG.vitesseBase, vMax = V_UNIT * window.CONFIG.vitesseMax;
  const cibleX = xDepart + (xMax - xDepart) * Math.max(0, Math.min(1, (speed - vMin) / Math.max(0.01, vMax - vMin)));
  cameraX = cameraX === null ? cibleX : cameraX + (cibleX - cameraX) * 0.04;
  scene.setJoueurX(cameraX);
  scene.setCamera(v);

  const shakeActive = shake.time > 0;
  if (shakeActive) {
    const k = shake.time / shake.duration;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake.amp * k, (Math.random() - 0.5) * shake.amp * k);
  }

  scene.renderGround(ctx, null);   // plus de boue depuis le 20 septembre 2026

  const items = [];
  const { from, to } = scene.rowRange();
  // Les halles : la rampe, le plancher et la charpente, posés à la profondeur
  // du bord ARRIÈRE de la route pour que le joueur reste peint par-dessus.
  const hallesVues = new Set();
  for (let r = from; r <= to; r++) {
    const d = rows.halleA(r);
    if (d === null || hallesVues.has(d)) continue;
    hallesVues.add(d);
    items.push({ d: scene.depth(scene.ROAD_HALF + 0.5, d), draw: () => scene.drawHalle(ctx, d, GEO_HALLE, from, to) });
  }
  const vc = scene.getVCentre(), largeurRoute = scene.demiLargeurRoute() + 2;
  for (let r = from; r <= to; r++) {
    const row = r >= 0 ? rows.rowAt(r) : null;
    const clear = row && row.type === "traverse";
    for (const it of scene.rowDecor(ctx, r, clear)) items.push(it);
    const sg = signAt(r);
    if (sg) items.push({ d: scene.depth(scene.ROAD_HALF + 0.55, r), draw: () => scene.drawSign(ctx, r, sg) });
    // Entrée du biome village : le panneau porte la ville du joueur.
    if (scene.villeDuJoueur() && scene.debutVillage(r)) items.push({ d: scene.depth(scene.ROAD_HALF + 0.55, r + 1), draw: () => scene.drawSign(ctx, r + 1, [scene.villeDuJoueur(), "chez toi"]) });
    if (!row) continue;
    // La voiture en face : elle roule SUR la route, vers le joueur (20
    // septembre 2026 : « une voiture qui roule en sens inverse, pour que ce
    // soit vraiment difficile »).
    if (row.type === "contresens") {
      const t = gameStarted ? now : perfClock();
      const inst = rows.contresensAt(r, row, t);
      if (inst) items.push({ d: scene.depth(0, inst.v), draw: () => props.drawVoiture(ctx, inst.K, 0, inst.v, -1, t) });
    }
    // Les traversants se voient de loin (ils arrivent du fond) : tout l'intervalle.
    if (row.type === "traverse") {
      const t = gameStarted ? now : perfClock();
      if (row.kind === "poulelancee") {
        const fu = scene.ROAD_HALF + 0.75;
        items.push({ d: scene.depth(fu, r), draw: () => props.drawLanceur(ctx, fu, r, tAnim, row.dir, row.armed) });
      }
      for (const inst of rows.crossersAt(r, row, t)) {
        items.push({ d: scene.depth(inst.u, r), draw: () => props.drawCrosser(ctx, inst.kind, inst.u, r, inst.dir, t, inst.alpha) });
      }
    }
    // Ce qui est sur la route : seulement à proximité de l'écran.
    if (Math.abs(r - vc) > largeurRoute) continue;
    row.coins.forEach((h, i) => { if (!rows.coinTaken(r, i)) items.push({ d: scene.depth(-0.3, r), draw: () => drawPiece(r, h, now, "piece") }); });
    if (row.lait !== undefined && !rows.bonusTaken(r, "lait")) items.push({ d: scene.depth(-0.3, r), draw: () => drawPiece(r, row.lait, now, "lait") });
    if (row.grosse !== undefined && !rows.bonusTaken(r, "grosse")) items.push({ d: scene.depth(-0.3, r), draw: () => drawPiece(r, row.grosse, now, "grosse") });
    if (row.type === "statique") {
      const tombe = tombes.get(r);
      items.push({ d: scene.depth(0, r), draw: () => (tombe !== undefined
        ? props.drawStaticTombe(ctx, row.kind, 0, r, tAnim, Math.max(0, now - tombe))
        : props.drawStatic(ctx, row.kind, 0, r, tAnim)) });
    }
  }
  if (gameStarted) for (const dr of friends.drawables(ctx, pedal)) items.push({ d: scene.depth(dr.u, dr.v), draw: dr.draw });
  // Le fantôme du meilleur de la ligue : transparent, sans ombre, étiqueté.
  // Décalé vers le fond de la route (u + 0,7) : sur une seule voie, il serait
  // pile derrière le joueur.
  const gp = gameStarted && ghost && ghost.graine === game.graine ? fantome.positionA(ghost.trace, now) : null;
  if (gp) items.push({ d: scene.depth(gp.u + 0.7, gp.v), draw: () => {
    drawRider(ctx, gp.u + 0.7, gp.v, gp.h, ghost.palette, pedal, 0.38 * gp.alpha, 0, false);
    const g = scene.project(gp.u + 0.7, gp.v, gp.h + RIDER_HEIGHT + 0.15);
    ctx.save();
    ctx.globalAlpha = 0.7 * gp.alpha;
    ctx.font = `700 11px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineJoin = "round";
    ctx.strokeText(`@${ghost.pseudo} · fantôme`, g.x, g.y);
    ctx.fillStyle = "#fff";
    ctx.fillText(`@${ghost.pseudo} · fantôme`, g.x, g.y);
    ctx.restore();
  } });
  for (const g of ghosts) items.push({ d: scene.depth(g.u + 0.01, g.v), draw: () => drawRider(ctx, g.u, g.v, g.h, paletteJoueur, pedal, 0.22 * (1 - g.age / 0.35), g.flip, false) });
  items.push({ d: scene.depth(u, v), draw: () => {
    drawRider(ctx, u, v, jy, paletteJoueur, pedal, 1, flip, true, player.prevRoue + (player.roue - player.prevRoue) * alpha,
      player.jumpY <= rows.solAt(player.v) + 0.02 ? penteSol(v) : 0);
    // Chevron « c'est toi » au-dessus de la tête : dans la meute, le joueur
    // se perdait parmi ses potes (même maillot possible).
    if (gameStarted && !game.ended) {
      const g = scene.project(u, v, jy + RIDER_HEIGHT + 0.45 + Math.sin(tAnim * 5) * 0.05);
      const t = scene.scale() * 0.2;
      ctx.save();
      ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 2; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(g.x - t, g.y - t * 0.8); ctx.lineTo(g.x + t, g.y - t * 0.8); ctx.lineTo(g.x, g.y + t * 0.5); ctx.closePath();
      ctx.stroke(); ctx.fill();
      ctx.restore();
    }
  } });
  items.sort((a, b) => b.d - a.d);
  for (const it of items) {
    // Un objet qui plante ne doit emporter ni l'image ni l'état du canvas.
    try { it.draw(); } catch (e) { if (!rendusRates.has(String(e))) { rendusRates.add(String(e)); console.error("rendu d'objet :", e); } ctx.setTransform(dprCourant, 0, 0, dprCourant, 0, 0); ctx.globalAlpha = 1; }
  }

  for (const sp of sparkles) {
    const g = scene.project(sp.u, sp.v, sp.h);
    ctx.globalAlpha = Math.max(0, 1 - sp.age / 0.6);
    ctx.fillStyle = sp.couleur || (sp.age < 0.2 ? "#fff6c0" : "#ffcf2e");
    const r = 2 + (1 - sp.age / 0.6) * 2;
    ctx.fillRect(g.x - r / 2, g.y - r / 2, r, r);
  }
  ctx.globalAlpha = 1;

  // Nuit : halos des lampadaires, par-dessus la scène.
  const night = scene.getNight();
  if (night > 0.2) {
    const a = Math.min(1, (night - 0.2) / 0.5);
    for (const l of scene.lampsIn(from, to)) {
      const p = scene.project(l.u, l.v, l.h);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, scene.scale() * 2.6);
      g.addColorStop(0, `rgba(255,236,170,${0.55 * a})`);
      g.addColorStop(1, "rgba(255,236,170,0)");
      ctx.fillStyle = g;
      ctx.fillRect(p.x - scene.scale() * 2.6, p.y - scene.scale() * 2.6, scene.scale() * 5.2, scene.scale() * 5.2);
    }
  }
  scene.renderHaze(ctx);
  renderAlertes(now, speed);
  hud.renderTurbo(ctx, width, height, tAnim, Math.min(1, game.turbo * 2));

  if (damageFlash > 0) {
    ctx.fillStyle = `rgba(225, 62, 38, ${0.35 * damageFlash})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (popups.length) {
    const g = scene.project(u, v, jy + RIDER_HEIGHT + 0.3);
    const base = g.y;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    for (const pop of popups) {
      const t = pop.age / 1.1;
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      ctx.font = `900 18px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineJoin = "round";
      ctx.strokeText(pop.texte, g.x, base - t * 46 - pop.decalage);
      ctx.fillStyle = pop.couleur;
      ctx.fillText(pop.texte, g.x, base - t * 46 - pop.decalage);
    }
    ctx.restore();
  }
  if (shakeActive) ctx.restore();

  if (gameStarted && hudAlpha > 0.001) {
    ctx.save();
    ctx.globalAlpha = hudAlpha;
    const paliers = window.CONFIG.potesPaliers;
    const plein = friends.count() >= friends.max();
    const gaugeT = plein ? 1 : Math.max(0, Math.min(1, (game.points - palierPrecedent()) / Math.max(1, prochainPalier() - palierPrecedent())));
    hud.renderHud(ctx, width, height, {
      metres: game.metres, potes: friends.count(), potesMax: friends.max(), gaugeT,
      mult: Math.round(multiplicateur() * 100) / 100, restant: plein ? 0 : Math.max(0, prochainPalier() - game.points), plein,
      restantS: game.ended ? 0 : tempsRestant(), turbo: game.turbo > 0, safeTop,
    });
    hud.renderBanner(ctx, width, height, banner, safeTop);
    ctx.restore();
  }
  if (gameStarted && !game.ended) {
    if (now < COUNT_IN_GO_LINGER_S) hud.renderCountIn(ctx, width, height, now, clock.beatPeriod, COUNT_IN_BEATS, COUNT_IN_GO_LINGER_S);
    hud.renderTuto(ctx, width, height, tutoVue());
    if (!tuto.actif && bestiaireT > 0) {
      const ecoule = BESTIAIRE_S - bestiaireT;
      const parEtape = BESTIAIRE_S / BESTIAIRE.length;
      const idx = Math.min(BESTIAIRE.length - 1, Math.floor(ecoule / parEtape));
      const dansEtape = ecoule - idx * parEtape;
      hud.renderBestiaire(ctx, width, height, Math.min(1, bestiaireT * 2, dansEtape * 4 + 0.15), bestiaire, safeTop, idx, Math.ceil(bestiaireT));
    }
    if (now >= 0 && !banner && !tuto.actif) hud.renderHint(ctx, width, height, Math.min(1, hintTimer));
  }
  if (game.finAge >= 0) hud.renderFin(ctx, width, height, game.finAge);

  renderApercu(pedal);
  debugOverlay.renderStats(ctx, {
    fps: perf.fps, frameMs: perf.frameMs, playerX: player.u,
    audioStatus: audio.getStatus(), clockSource: audioDrivesClock ? "audio" : "secours",
    conversion: screens.niveauConversionCourant(), classement: `graine ${game.graine}${game.scoreMax ? ` · max ${game.scoreMax}` : ""}${ghost ? ` · fantôme @${ghost.pseudo}` : ""} · potes ${friends.count()} · pièces ${game.points} · v ${player.v.toFixed(1)} · ${speed.toFixed(1)} r/s · reste ${gameStarted ? tempsRestant().toFixed(0) : "-"} s · nuit ${night.toFixed(2)}`,
  });
}

// --- Aperçu du cycliste (étape « Mon cycliste ») ------------------------------------
// Dessiné avec le VRAI moteur sur un petit canvas : on emprunte la projection
// avec un viewport élargi (K ≈ 50 px/unité) puis on la rend au jeu.
const skinCanvas = document.getElementById("skin-canvas");
const skinCtx = skinCanvas ? skinCanvas.getContext("2d") : null;
let apercuPedal = 0;
function renderApercu(pedal) {
  if (!skinCtx || gameStarted || !document.getElementById("overlay").classList.contains("visible") || screens.stepCourante() !== 3) return;
  apercuPedal += 0.12;
  const P = paletteDepuisSkin(screens.getSkin());
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = 220, ch = 200;
  if (skinCanvas.width !== cw * dpr) { skinCanvas.width = cw * dpr; skinCanvas.height = ch * dpr; }
  skinCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  skinCtx.clearRect(0, 0, cw, ch);
  const VW = 700;
  scene.setViewport(VW, VW);
  scene.setJoueurX(0.36);
  scene.setCamera(0);
  const a = scene.project(0, 0, 0);
  skinCtx.save();
  skinCtx.translate(cw / 2 - a.x, ch * 0.78 - a.y);
  scene.drawFlat(skinCtx, -0.7, -1.4, 1.4, 2.8, "#565250");
  drawRider(skinCtx, 0, 0, 0, P, apercuPedal, 1, 0);
  skinCtx.restore();
  scene.setViewport(width, height);
}

if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

// --- Préchauffage (pendant la barre de chargement) --------------------------------
// Construit 400 rangées, dessine chaque prop et chaque cycliste une fois hors
// écran : le premier vrai frame de course ne paie ni le hachage ni la
// compilation des chemins de rendu.
function prechauffer() {
  const off = document.createElement("canvas");
  off.width = 64; off.height = 64;
  const c = off.getContext("2d");
  let i = 0;
  const etapes = [
    () => { for (let r = 0; r < 400; r++) rows.rowAt(r); },
    () => { for (const k of Object.keys(rows.KINDS)) if (!rows.KINDS[k].traverse) props.drawStatic(c, k, 0, 5, 0); },
    () => { props.drawCrosser(c, "tracteur", 0, 5, 1, 0); props.drawCrosser(c, "poulelancee", 0, 5, 1, 0); props.drawLanceur(c, 0, 5, 0, 1, false); },
    () => { drawRider(c, 0, 0, 0, PALETTES.pmc, 0, 1, 0); drawRider(c, 0, 0, 0, PALETTES.soberland, 0, 1, 1); for (const P of PALETTES.potes) drawRider(c, 0, 0, 0, P, 0); },
    () => { c.translate(32, 32); drawCoin(c, 10, 0.3); drawCoin(c, 10, 0.3, true); c.setTransform(1, 0, 0, 1, 0, 0); scene.drawSign(c, 20, ["CYSOING", "59"]); },
    () => { for (let r = 0; r < 60; r++) scene.rowDecor(c, r, false).forEach((it) => it.draw()); },
    () => prechaufferBestiaire(),
  ];
  const suite = () => {
    try { etapes[i](); } catch (e) { /* le préchauffage ne doit jamais bloquer */ }
    i += 1;
    screens.setPrechauffage(i / etapes.length);
    if (i < etapes.length) setTimeout(suite, 60);
  };
  setTimeout(suite, 200);
}

// --- Boucle ------------------------------------------------------------------------
const perf = { fps: 0, frameMs: 0, acc: 0, n: 0 };
let lastTime = perfClock();
let accumulator = 0;

if (document.fonts && document.fonts.load) {
  Promise.all([
    document.fonts.load('900 40px "Source Serif 2"'),
  ]).catch(() => {});
}

function frame(nowMs) {
  try { frameInterne(nowMs); } finally { requestAnimationFrame(frame); }
}
function frameInterne(nowMs) {
  const t0 = performance.now();
  const now = nowMs / 1000;
  const frameTime = Math.min(now - lastTime, MAX_FRAME_TIME);
  lastTime = now;
  accumulator += frameTime;
  while (accumulator >= STEP) { step(STEP); accumulator -= STEP; }
  render(accumulator / STEP);
  screens.syncLoadingUi();
  const ms = performance.now() - t0;
  perf.acc += frameTime; perf.n += 1; perf.frameMs = ms;
  if (perf.acc >= 0.5) { perf.fps = Math.round(perf.n / perf.acc); perf.acc = 0; perf.n = 0; }
}

screens.init({
  game,
  requestGameStart,
  isGameStartRequested,
  restartGame,
  openPause: () => { manualPaused = true; applyPauseState(); },
  closePause: () => { manualPaused = false; applyPauseState(); },
  isManuallyPaused: () => manualPaused,
});
screens.showOverlayOnLoad();
prechauffer();
if (debugOverlay.isEnabled()) {
  window.__pote = {
    player, game, rows, friends, clock, fantome, scoreParfait,
    // Harnais headless : poser un fantôme sans réseau (pts = [[u, v, h], …] à 10 Hz).
    injecterFantome: (pts, pseudo = "test") => { ghost = { graine: game.graine, pseudo, metres: 0, palette: PALETTES.potes[0], trace: { hz: fantome.HZ, pts } }; },
    estDemarre: () => gameStarted,
    fps: () => perf.fps,
    frameMs: () => perf.frameMs,
    tombes: () => tombes.size,
  };
}
requestAnimationFrame(frame);
