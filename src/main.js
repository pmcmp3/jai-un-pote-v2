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
import { V_UNIT, LEAD_IN, targetSpeed as targetSpeedRegle, multiplicateur as multRegle, graineLigue, dureeCourse } from "./regles.js";
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
  friends.setLargeurEcran(width);
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
const game = { arriveeR: null,
  metres: 0, points: 0, potesGagnes: 0, etoiles: 0,
  ended: false, endReason: null, reviveOffered: false, sansFaute: true, startedAt: 0,
  turbo: 0, finAge: -1, sprint: false, cibleRachat: null, surHalle: false,
  graine: 0, ligueCourse: false, scoreMax: null, // course de LIGUE : graine partagée, score parfait
};
// Une seule voie : le joueur reste en u = 0 (u est gardé pour le fantôme).
const player = { auSol: true, u: 0, prevU: 0, v: 0, prevV: 0, jumpY: 0, prevJumpY: 0, jumpVy: 0, pedal: 0, prevPedal: 0, doubled: false, flip: 0, prevFlip: 0, tHaut: 0, roue: 0, prevRoue: 0 };
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
  return {
    vJump: C.sautVitesse, vDouble: C.sautVitesseDouble, g: C.sautGravite, gTenu: C.sautGraviteTenue, tenueMax: C.sautTenueMaxS, sol: rows.solAt,
    // Pour les potes : toits de voiture, plafond des halles, position des obstacles.
    solSous, plafond: rows.plafondA, centreRef,
  };
}
// Boost de ligue (screens.getBoost, posé au départ) : multiplie TOUT.
function multiplicateur() { return multRegle(friends.count(), game.turbo > 0) * (game.boost || 1); }
// Hauteur du sol sous le joueur : la route (0), le plancher d'une halle, ou le
// toit d'une voiture s'il arrive déjà au-dessus d'elle.
function solSous(v, jumpY) { return Math.max(rows.solAt(v), rows.toitSous(rows.routeVivante(), v, jumpY, tMonde())); }
// Pente locale du sol, en radians : sert à incliner le vélo sur la rampe.
// ⚠️ Signe NÉGATIF (27 septembre 2026) : sur le canvas un angle positif tourne
// dans le sens horaire, donc le vélo piquait du nez en MONTANT (« quand on
// monte, je penche vers l'avant, c'est trop bizarre, il faudrait que j'aie le
// corps penché légèrement en arrière »). Nez en l'air à la montée, et tout le
// cycliste tourne avec le vélo : le buste part en arrière.
function penteSol(v) { return -Math.atan2(rows.solAt(v + 0.6) - rows.solAt(v - 0.6), 1.2); }
// Collines de 6,5 u (4 octobre 2026, deuxième passe) : ce qui se tient ou
// roule sur la chaussée MONTE avec elle (scene.avecLift : toute la géométrie
// est soulevée, ombre comprise) et un véhicule s'incline sur la pente, autour
// de son point de contact.
function surSol(v, fn, incliner = false, h = rows.solAt(v)) {
  if (h < 0.01) { fn(); return; }
  scene.avecLift(h, () => {
    const a = incliner ? penteSol(v) : 0;
    if (Math.abs(a) < 0.01) { fn(); return; }
    const c = scene.project(0, v, 0);
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(a); ctx.translate(-c.x, -c.y);
    try { fn(); } finally { ctx.restore(); }
  });
}
function palierPrecedent() {
  const p = window.CONFIG.potesPaliers;
  if (game.cibleRachat !== null && game.cibleRachat !== undefined) return game.cibleRachat - (game.coutRachat || window.CONFIG.poteRachatPieces || 10);
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
  game.coutRachat = coutRachat();
  game.cibleRachat = game.points + game.coutRachat;
}
// Racheter un pote coûte de plus en plus cher (4 octobre 2026 : « plus ça
// avance, plus ça doit être difficile [...] je suis allé jusqu'à la ligne
// d'arrivée assez facilement ») : `poteRachatPieces` jusqu'à 60 s, puis on
// monte vers `poteRachatPiecesFin` à 160 s.
function coutRachat() {
  const C = window.CONFIG, base = C.poteRachatPieces || 5, fin = C.poteRachatPiecesFin || base;
  const k = Math.max(0, Math.min(1, (clock.now() - 60) / 100));
  return Math.round(base + (fin - base) * k);
}
const sparkles = [];
function semerSparkles(u, v, n = 9, couleur = null) {
  for (let i = 0; i < n; i++) sparkles.push({ u, v, h: 0.6, vu: (Math.random() - 0.5) * 3, vv: (Math.random() - 0.5) * 3, vh: 1.5 + Math.random() * 2.5, age: 0, couleur });
}
const ghosts = []; // traînée du salto

// --- Tuto CONTEXTUEL au ralenti (28 septembre 2026) -------------------------------
// « Enlève le tuto, mets pause quand les gens arrivent devant une situation, ils
// ont le tuto qui correspond, genre tout passe en méga ralenti. » Plus de
// consignes au départ ni de bestiaire : la PREMIÈRE fois qu'une famille
// d'obstacle arrive (tap / appui long / double tap), le monde passe au ralenti
// pile au moment où il faut sauter, la consigne s'affiche, et le temps ne
// repart que sur le bon geste. L'obstacle expliqué ne fait jamais mal.
// Une famille est apprise pour de bon dès qu'elle a été franchie (localStorage).
const CONSEILS = {
  tap:    { titre: "TAPE !", sous: "un petit saut pour les petites bêtes" },
  haut:   { titre: "RESTE APPUYÉ !", sous: "plus tu tiens, plus tu sautes haut" },
  double: { titre: "TAPE… PUIS RE-TAPE !", sous: "double saut pour tout ce qui roule" },
};
const CLE_APPRIS = "jp2-appris", CLE_VUS = "jp2-conseils-vus";
function lireJson(k, def) { try { return JSON.parse(localStorage.getItem(k) || "null") || def; } catch (e) { return def; } }
function ecrireJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* navigation privée */ } }
function appris() { return new Set(lireJson(CLE_APPRIS, [])); }
function apprendre(f) { const a = appris(); a.add(f); ecrireJson(CLE_APPRIS, [...a]); }
// ralenti : facteur de temps du MONDE (1 = normal). La musique, elle, continue :
// seule l'horloge du monde (`tMonde`) prend du retard sur celle du morceau.
// Deuxième version (29 septembre 2026, joué en direct : « le ralenti devrait
// arriver bien avant la bête, genre une seconde avant le choc, pour me laisser
// le temps de me poser » ; « j'ai trois fois le même truc de ralenti ») :
//   approche  : ~1 s avant le bon moment, le monde glisse vers ×0,25 ; un tap
//               donné là est GARDÉ et part pile au bon moment ;
//   attente   : au bon moment, s'il n'a rien fait, gel à ×0,06 ;
//   enl_air   : appui long / double saut, ×0,3 le temps du deuxième geste ;
//   fini      : réussite → le temps repart d'un coup (« ça doit s'accélérer
//               quand la personne réussit »).
// Une famille est APPRISE dès que l'obstacle est franchi sans le toucher (quel
// que soit le geste), et jamais montrée plus de deux fois.
const RALENTI_MIN = 0.015, RALENTI_APPROCHE = 0.25, APPROCHE_S = 0.7;
const conseil = { r: null, famille: null, phase: null, alpha: 0, ok: 0, tampon: false, touche: false };
let ralenti = 1, retardMonde = 0;
function tMonde() { return clock.now() - retardMonde; }
function conseilCouper() { projo.type = null; conseil.plane = false; conseil.r = null; conseil.phase = null; conseil.alpha = 0; conseil.ok = 0; conseil.tampon = false; audio.setRalenti(false); }
function conseilReset() { conseilCouper(); ralenti = 1; retardMonde = 0; }
// Temps avant que l'obstacle de la rangée r croise le joueur (s), ou null.
function tempsAvant(r, row, tm, vitesse) {
  if (row.type === "statique") return (r - player.v) / Math.max(0.5, vitesse);
  if (!row.armed) return null;
  if (row.type === "contresens") { const o = rows.contresensAt(r, row, tm); return o ? (o.v - player.v) / Math.max(0.5, vitesse + row.vitesse) : null; }
  return (r - player.v) / Math.max(0.5, vitesse);
}
function momentIdeal(f) { return rows.montee(f) + 0.03; } // le moment du joueur idéal (outils/mesurer.mjs), un poil avant
function conseilCherche(tm, vitesse) {
  if (conseil.r !== null || projo.type || game.sprint || !player.auSol) return;
  const deja = appris();
  if (deja.size >= 3) return;
  const vus = lireJson(CLE_VUS, {});
  const r0 = Math.floor(player.v) + 1;
  for (let r = r0; r <= r0 + 30; r++) {
    const row = rows.rowAt(r);
    if (row.type !== "statique" && row.type !== "traverse" && row.type !== "contresens") continue;
    const f = rows.familleDe(row.kind);
    if (deja.has(f) || (vus[f] || 0) >= 1) continue; // UNE seule fois (30 septembre 2026 : « faut pas 2 fois le même tuto »)
    const t = tempsAvant(r, row, tm, vitesse);
    if (t !== null && t > momentIdeal(f) && t <= momentIdeal(f) + APPROCHE_S) {
      conseil.r = r; conseil.famille = f; conseil.phase = "approche"; conseil.ok = 0; conseil.tampon = false; conseil.touche = false; conseil.plane = false;
      vus[f] = (vus[f] || 0) + 1; ecrireJson(CLE_VUS, vus);
      audio.setRalenti(true);
    }
    return; // seul l'obstacle le plus proche compte
  }
}
// Filtre du tap pendant un conseil : gardé en approche, relâché au bon moment.
function conseilTap(tap, tm, vitesse) {
  if (projo.type) { if (tap && projo.age > 0.5) projoFin(); return false; }
  if (conseil.r === null) return tap;
  if (conseil.phase === "approche") {
    const t = tempsAvant(conseil.r, rows.rowAt(conseil.r), tm, vitesse);
    // Tap pendant l'approche : on saute TOUT DE SUITE (30 septembre 2026 :
    // « il y a une latence entre le moment où tu appuies et le moment où
    // l'action se réalise, c'est très frustrant ») — l'ancien tap gardé
    // partait plus tard. Pour que ça passe quand même, le saut est prolongé :
    // tenue offerte, et double saut automatique au sommet si le tap était tôt.
    if (tap && player.auSol) {
      const avance = t !== null ? t - momentIdeal(conseil.famille) : 0;
      // 4 octobre 2026 : plus de double saut automatique (« je suis resté
      // appuyé, il a fait un double saut tout seul ») — le saut trop tôt PLANE
      // au-dessus de l'obstacle expliqué (voir la physique du saut).
      conseil.plane = conseil.famille !== "double" && avance > 0.12;
      conseil.phase = "attente";
      return true;
    }
    if (t !== null && t <= momentIdeal(conseil.famille)) conseil.phase = "attente";
    return false;
  }
  // Double saut : un re-tap AVANT le sommet est gardé et part au sommet (un
  // re-tap trop tôt donnait un double saut trop bas pour le tracteur).
  if (conseil.phase === "enl_air" && conseil.famille === "double") {
    if (tap && player.jumpVy > APEX_VY) { conseil.tampon = true; return false; }
    if (conseil.tampon && player.jumpVy <= APEX_VY) { conseil.tampon = false; return true; }
  }
  return tap;
}
const APEX_VY = 0; // au sommet du premier saut, comme le joueur idéal (rows.arcs)
function conseilReussi() { if (conseil.phase === "fini") return; conseil.phase = "fini"; ralenti = Math.max(ralenti, 0.6); conseil.ok = 0.9; audio.setRalenti(false); sfx.piece(); }
function conseilGeste(ev) {
  if (conseil.r === null || conseil.phase === "fini") return;
  const f = conseil.famille;
  // Tap et appui long : réussis dès le décollage (la tenue est offerte). Le
  // double attend encore son re-tap, au sommet.
  if (ev === "jump") { if (f === "tap") conseilReussi(); else { conseil.phase = "enl_air"; conseil.tampon = false; } }
  else if (ev === "haut" && f === "haut") conseilReussi(); // l'appui a tenu (> 0,12 s)
  else if (ev === "salto") conseilReussi(); // un double saut passe tout
}
function conseilStep(dt, tm, vitesse) {
  conseilCherche(tm, vitesse);
  let cible = 1;
  if (projo.type) { projo.age += dt; cible = RALENTI_MIN; if (projo.age > 8) projoFin(); }
  if (conseil.r !== null) {
    // Un tap pendant l'approche : le temps REPART tout de suite (30 septembre
    // 2026 : « si qqn appuie pour sauter, hop, faut accélérer ») et le saut
    // part tout seul au bon moment, tenue comprise.
    if (conseil.phase === "approche") cible = conseil.tampon ? 1 : RALENTI_APPROCHE;
    else if (conseil.phase === "attente") cible = RALENTI_MIN;
    else if (conseil.phase === "enl_air") {
      // Double : ralenti jusqu'au sommet, puis gel en attendant le re-tap.
      cible = conseil.famille === "double" && player.jumpVy <= APEX_VY ? RALENTI_MIN : 1;
      // (Appui long : réussi par conseilGeste("haut"), quand l'appui a tenu.)
    }
    // Obstacle dépassé : appris s'il n'a pas été touché (quel que soit le geste).
    if (player.v > conseil.r + 1.5) {
      if (!conseil.touche) { apprendre(conseil.famille); if (conseil.phase !== "fini") { conseil.ok = 0.9; sfx.piece(); } }
      conseil.r = null; conseil.phase = conseil.touche ? null : "fini"; audio.setRalenti(false);
    }
  }
  if (conseil.ok > 0) conseil.ok -= dt;
  const vis = conseil.r !== null && conseil.phase !== "fini";
  conseil.alpha = Math.max(0, Math.min(1, conseil.alpha + (vis || conseil.ok > 0 ? dt * 6 : -dt * 4)));
  // Freinage doux, reprise FRANCHE sur une réussite.
  ralenti += (cible - ralenti) * Math.min(1, dt * (cible < ralenti ? 6 : 20));
}
function conseilVue() {
  if (conseil.alpha <= 0 || !conseil.famille) return null;
  const c = CONSEILS[conseil.famille];
  const fini = conseil.phase === "fini" || conseil.r === null;
  const titre = conseil.phase === "enl_air" ? (conseil.famille === "haut" ? "TIENS… TIENS !" : "RE-TAPE EN L'AIR !") : c.titre;
  return { titre: fini ? "BIEN !" : titre, sous: fini ? null : c.sous, onglet: fini ? "BIEN !" : "À TOI", ok: fini, alpha: conseil.alpha, y: safeTop + 96 };
}

// --- Projecteur (3 octobre 2026) -----------------------------------------------
// « La brique de lait : tu baisses l'opacité et la luminosité, tu mets en
// surbrillance la brique et une indication » — pareil pour le premier
// triangle d'alerte. Une fois par joueur (jp2-conseils-vus), le monde gèle,
// l'écran s'assombrit sauf autour de l'objet, et un tap fait repartir.
const PROJECTEURS = {
  lait: { titre: "BRIQUE DE LAIT", sous: "Attrape-la : turbo et ×2 sur tes points pendant 5 s" },
  alerte: { titre: "ATTENTION !", sous: "Ce panneau annonce un danger qui arrive : prépare-toi à sauter" },
};
const projo = { type: null, x: 0, y: 0, r: 40, age: 0 };
function projoLancer(type, x, y, r) {
  if (projo.type || game.sprint || game.ended || conseil.r !== null || !gameStarted || clock.now() < 1) return;
  const vus = lireJson(CLE_VUS, {});
  if ((vus[type] || 0) >= 1) return;
  vus[type] = 1; ecrireJson(CLE_VUS, vus);
  Object.assign(projo, { type, x, y, r, age: 0 });
  audio.setRalenti(true);
}
function projoSuivre(type, x, y) { if (projo.type === type) { projo.x = x; projo.y = y; } }
function projoFin() { if (!projo.type) return; projo.type = null; if (conseil.r === null) audio.setRalenti(false); }

// --- Effets ------------------------------------------------------------------
// Pastilles (3 octobre 2026 : « il y a trop de bandeaux turbo lait, ×2, etc. [...]
// mes yeux sont en train de suivre la ligne avec les joueurs ») : les annonces
// de course sont de petites pastilles au-dessus du joueur, plus des bandeaux.
const pastilles = [];
function pousserPastille(texte, duree = 2) {
  pastilles.push({ texte, age: 0, duree });
  if (pastilles.length > 2) pastilles.shift();
}
const popups = [];
function pousserPopup(texte, couleur) {
  const decalage = popups.filter((p) => p.age < 0.5).length * 24;
  popups.push({ texte, couleur, age: 0, decalage });
  if (popups.length > 3) popups.shift();
}
let banner = null;
// `etiquette` : le mot écrit dans l'onglet de couleur (28 septembre 2026 : « le truc
// jaune [...] il sert à rien » — l'onglet était vide).
function afficherBanner(titre, sous, couleur, duree = 2.4, etiquette = "") { banner = { titre, sous, couleur, duree, timer: duree, etiquette }; }
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
  masqueCache.clear();
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
  game.boost = game.sprint ? 1 : screens.getBoost().mult; game.boostAnnonce = false;
  game.tapHint = !game.sprint && screens.getParties() < 3; // sprint : même règle pour tous
  game.scoreMax = game.ligueCourse ? Math.round(scoreParfait(seed, friends.max()).score * game.boost) : null;
  fantome.demarrerEnregistrement();
  ghost = null;
  // Fantôme retiré de l'écran (29 septembre 2026 : « le cycliste fantôme, pour
  // l'instant, tu l'enlèves ») — la trace part toujours, pour pouvoir le rebrancher.
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
  game.sonAnnonce = screens.consommerAnnonceSon(); // la carte « Monte le son » vient de passer : le décompte ne le répète pas
  semerCourse();
  preparerJoueur();
  if (screens.getParties() === 0) net.evenement("premiere_course", { pseudo: screens.getPseudo(), source: screens.getSource(), ligue: screens.getLigue() ? screens.getLigue().code : null });
  conseilReset();
  screens.compterPartie();
}
function isGameStartRequested() { return startRequested; }

function resetRun() {
  game.metres = 0; game.points = 0; game.potesGagnes = 0; game.etoiles = 0;
  game.ended = false; game.endReason = null; game.reviveOffered = false; game.sansFaute = true;
  game.turbo = 0; game.finAge = -1; game.arriveeR = null; game.surHalle = false; tombes.clear();
  game.startedAt = perfClock();
  player.u = 0; player.prevU = 0; player.v = 0; player.prevV = 0; cameraX = null;
  player.jumpY = 0; player.prevJumpY = 0; player.jumpVy = 0; player.doubled = false; player.flip = 0; player.prevFlip = 0; player.tHaut = 0; player.roue = 0; player.prevRoue = 0;
  game.cibleRachat = null;
  sparkles.length = 0; ghosts.length = 0;
  speed = V_UNIT * window.CONFIG.vitesseBase; nuitDebut = null;
  friends.reset();
  klaxonne = new Set(); alertesVues.clear(); montagneFondu = 0;
  popups.length = 0; pastilles.length = 0; banner = null; damageFlash = 0; shake.time = 0; hudAlpha = 0; hintTimer = 6;
  canvas.classList.remove("game-over-bw", "danger", "turbo");
  scene.setNight(0);
}

function restartGame(opts = {}) {
  screens.preparerLigue();
  preparerJoueur();
  game.sprint = !!opts.sprint; // REJOUER après un sprint = une vraie course ; le menu peut relancer un sprint
  game.sonAnnonce = false;
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
  conseilReset();
  screens.compterPartie();
}

// --- Mort / fin ------------------------------------------------------------------
function mourir() {
  conseilCouper();
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
        pousserPastille(retour > 1 ? "TES POTES SONT REVENUS" : retour === 1 ? "TON POTE EST REVENU" : "C'EST REPARTI", 2);
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
  conseilCouper();
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
  conseilCouper();
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
function bilanCourse() { return { graine: game.graine, trace: fantome.encoder(), scoreMax: game.scoreMax, duree: Math.max(0, clock.now()), fin: game.endReason === "fin" }; }

function triggerShake(amp, duration) { shake.amp = amp; shake.duration = duration; shake.time = duration; }

function arriveePote(pote, direct) {
  if (!pote) return;
  sfx.pote();
  vibrer(30);
  // Une seule ligne, courte (7 septembre 2026 : « trop d'infos au mètre carré »).
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
  pousserPastille("TURBO · ×2 PENDANT 5 S", 1.8);
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
const KINDS_ROULANTS = new Set(["tracteur", "bus", "chasseneige", "voiture", "contresens", "poulejetee"]);

const chocs = []; // debug : les derniers chocs (auto-audit)
function toucherJoueur(ev) {
  chocs.push({ r: ev.r, kind: ev.kind, conseil: conseil.r }); if (chocs.length > 20) chocs.shift();
  if (conseil.r !== null && ev.r === conseil.r) { conseil.touche = true; return; } // l'obstacle expliqué ne fait pas mal
  // Invulnérable (turbo lait, bouclier de reprise) : la bête est quand même
  // renversée, avec une gerbe d'étincelles — sinon on croit à un bug de
  // collision (27 septembre 2026 : « j'ai roulé sur une poule, j'ai pas eu
  // de défaut »).
  if (clock.now() < reviveShieldUntil || invincible || game.turbo > 0) {
    marquerTombe(ev, tMonde());
    semerSparkles(player.u, player.v, 10, "#ffffff");
    return;
  }
  marquerTombe(ev, tMonde());
  if (friends.count() > 0) {
    // Deuxième moitié du morceau : chaque choc coûte un pote de plus.
    const cout = ev.cout + (clock.now() > dureeCourse() * (window.CONFIG.chocPlusUnApres || 2) ? 1 : 0);
    const perdus = friends.lose(cout);
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

// --- Les potes suivent le mouvement du joueur (4 octobre 2026) -----------------
// « Quand je réussis mon double saut et que je tombe après la voiture ou le car,
// j'ai des potes qui tombent avant la voiture. » Ils refaisaient le saut au
// même ENDROIT ; or une voiture en face a avancé entre-temps. Chaque saut
// retient donc l'obstacle qu'il franchit et la distance qui l'en séparait :
// le pote saute quand il est à la même distance de CE véhicule, là où il est.
function refObstacle(v, tm) {
  let best = null;
  for (let r = Math.floor(v) - 3; r <= v + 16; r++) {
    const row = rows.rowAt(r);
    let c = null, vit = 0;
    if (row.type === "statique") c = r;
    else if (row.type === "contresens" && row.armed) { const o = rows.contresensAt(r, row, tm); if (o) { c = o.v; vit = row.vitesse; } }
    if (c === null || c + rows.demiLongueurRoute(row.kind) + rows.VELO_DEMI <= v) continue;
    const t = (c - v) / Math.max(0.5, speed + vit);
    if (!best || t < best.t) best = { r, d: c - v, t };
  }
  return best && best.t < 2.5 ? { r: best.r, d: best.d } : null;
}
// Position actuelle de l'obstacle de la rangée r (null s'il n'existe plus).
function centreRef(r) {
  const row = rows.rowAt(r);
  if (row.type === "statique") return r;
  if (row.type === "contresens") { const o = rows.contresensAt(r, row, tMonde()); return o ? o.v : null; }
  return null;
}

// --- Traversées armées sur le passage du joueur --------------------------------
// Chaque espèce a son délai (rows.delaiArmement) : 4 s pour le tracteur,
// 5,5 s pour la voiture en face, le temps de vol pour la poule jetée.
const ARM_AHEAD_S = 5.5; // le plus long des délais : borne du balayage
function armerTraversees(now, vitesse) {
  const r0 = Math.floor(player.v + 0.5);
  const rMax = r0 + Math.ceil(vitesse * ARM_AHEAD_S) + 1;
  for (let r = Math.max(0, r0); r <= rMax; r++) {
    const row = rows.rowAt(r);
    if ((row.type !== "traverse" && row.type !== "contresens") || row.armed) continue;
    const tArr = now + (r - player.v) / Math.max(0.5, vitesse);
    if (tArr - now > rows.delaiArmement(row)) continue;
    rows.armer(row, now, tArr);
    if ((row.kind === "tracteur" || row.kind === "contresens" || row.kind === "bus" || row.kind === "chasseneige") && !klaxonne.has(r)) { klaxonne.add(r); sfx.klaxon(); }
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
  for (let i = pastilles.length - 1; i >= 0; i--) { pastilles[i].age += dt; if (pastilles[i].age >= pastilles[i].duree) pastilles.splice(i, 1); }
  if (banner) { banner.timer -= dt; if (banner.timer <= 0) banner = null; }
  if (damageFlash > 0) damageFlash = Math.max(0, damageFlash - dt);
  if (shake.time > 0) shake.time = Math.max(0, shake.time - dt);
  if (hintTimer > 0 && gameStarted) hintTimer -= dt;

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
  // Ralenti du tuto contextuel : le monde avance à `ralenti`, la musique non.
  const dtReel = dt;
  if (now >= 0) { conseilStep(dtReel, tMonde(), speed); dt = dtReel * ralenti; retardMonde += dtReel - dt; }
  const tm = tMonde();

  // Le boost de ligue s'annonce au « GO ».
  if (!game.boostAnnonce && now >= COUNT_IN_GO_LINGER_S) {
    game.boostAnnonce = true;
    const b = screens.getBoost();
    // Pas aux premières parties : le doigt qui tape a la priorité au départ.
    if (game.boost > 1 && !game.tapHint) pousserPastille(`+${Math.round((game.boost - 1) * 100)} % GRÂCE À TES ${b.potes.length} POTES`, 2.4);
  }
  // --- Nuit : tombe à partir de nuitDebutS, 30 s de transition ---
  const nd = nuitDebut !== null ? nuitDebut : window.CONFIG.nuitDebutS;
  if (nd !== undefined) scene.setNight(Math.max(0, Math.min(1, (now - nd) / 30)));
  // Le soleil traverse le ciel sur toute la durée du morceau.
  scene.setHeure(now / Math.max(1, window.CONFIG.dureeMorceau));
  // Montagnes proches en fondu quand on entre dans le biome montagne.
  montagneFondu += ((rows.enMontagne(Math.round(player.v)) ? 1 : 0) - montagneFondu) * Math.min(1, dt * 0.6);
  scene.setMontagne(montagneFondu);

  // --- Saut : tap, maintien, double saut ---
  // ⚠️ Le sol n'est plus toujours 0 : sur une halle, le plancher monte
  // (rows.solAt). Décoller, retomber et « être au sol » se comparent donc à la
  // hauteur du sol SOUS le joueur, jamais à zéro.
  let marque = null; // « saut » ou « double » : la meute le refera au même endroit
  const solIci = solSous(player.v, player.jumpY);
  const tap = conseilTap(consumeJumpPress(), tm, speed);
  if (tap && player.jumpY <= solIci + 0.02) {
    player.jumpVy = phys.vJump; player.jumpY = solIci + 0.001; player.doubled = false; player.tHaut = 0; player.tenueMarquee = false;
    marque = "saut"; sfx.saut(); conseilGeste("jump"); game.tapHint = false;
  } else if (tap && player.jumpY > solIci && !player.doubled) {
    player.jumpVy = phys.vDouble; player.doubled = true; player.flip = 0.001; player.tHaut = phys.tenueMax;
    marque = "double"; sfx.salto(); vibrer(25);
    semerSparkles(player.u, player.v, 12);
    conseilGeste("salto");
  }
  if (player.jumpY > solIci) {
    // Tant que le doigt reste appuyé et qu'on monte, la pesanteur est réduite.
    // ⚠️ Plus AUCUN appui offert pendant les tutos (4 octobre 2026 : « un petit
    // saut pour les petites bêtes, ça m'a fait sauter hyper haut tout seul [...]
    // à chaque fois que j'appuie, tu considères que c'est un appui lent ») :
    // le saut est celui que fait le doigt.
    const tenu = isHolding() && player.jumpVy > 0 && player.tHaut < phys.tenueMax;
    if (tenu) player.tHaut += dt;
    player.jumpVy -= (tenu ? phys.gTenu : phys.g) * dt;
    player.jumpY += player.jumpVy * dt;
    if (player.tHaut > 0.12 && !player.tenueMarquee) { player.tenueMarquee = true; friends.marquerTenue(); conseilGeste("haut"); }
    if (tenu) friends.majTenue(player.tHaut); // les potes tiendront EXACTEMENT aussi longtemps
    // Saut donné trop tôt pendant un conseil : descente freinée et plancher
    // d'air au ras de l'obstacle expliqué, jusqu'à l'avoir passé.
    if (conseil.plane && conseil.r !== null && player.jumpVy < 0) {
      const row = rows.rowAt(conseil.r);
      const o = row.type === "contresens" ? rows.contresensAt(conseil.r, row, tm) : { v: conseil.r };
      if (o && player.v < o.v + rows.demiLongueurRoute(row.kind) + rows.VELO_DEMI) {
        const H = rows.hauteurAFranchir(row.kind) + rows.solAt(o.v) + 0.1;
        player.jumpVy = Math.max(player.jumpVy, -2.2);
        if (player.jumpY < H) { player.jumpY = H; player.jumpVy = 0; }
      } else conseil.plane = false;
    }
    // Sous le toit d'une halle, on reste DESSOUS (4 octobre 2026 : « le
    // personnage reste en dessous, sans possibilité de dépasser le toit »).
    const plafond = rows.plafondA(player.v);
    if (player.jumpY > plafond) { player.jumpY = plafond; if (player.jumpVy > 0) player.jumpVy = 0; }
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
  const vitesse = speed * (game.turbo > 0 ? (window.CONFIG.laitVitesse || 1.2) : 1);
  if (now >= 0) {
    const dv = vitesse * dt;
    player.v += dv;
    game.metres += dv * window.CONFIG.metresParUnite * multiplicateur();
  }
  player.pedal += vitesse * dt * 3.2;
  // Retombée / roulage sur la rampe de la halle, ou atterrissage sur le toit
  // d'une voiture : le vélo colle au plancher trouvé sous lui.
  // ⚠️ Le toit se cherche avec la hauteur d'AVANT la chute de ce pas : en
  // retombant à ~10 u/s, les roues passaient sous le toit en une seule image
  // et la voiture n'était plus un plancher mais un mur (28 septembre 2026 :
  // « je peux pas rouler sur les voitures arrêtées »).
  const solApres = solSous(player.v, Math.max(player.jumpY, player.prevJumpY));
  // Collage à la DESCENTE : au sol, on suit le plancher qui descend au lieu de
  // décoller d'un cheveu à chaque image (le vélo tremblait et perdait son
  // inclinaison une image sur deux — « glitchs bizarres dans la descente »).
  // Une vraie marche (bout d'un toit de voiture, > 0,35 u) fait toujours tomber.
  if (player.auSol && player.jumpVy <= 0 && player.jumpY > solApres && player.jumpY - solApres < 0.35) player.jumpY = solApres;
  if (player.jumpY <= solApres) {
    if (player.jumpVy < -0.5 && game.surHalle === false) sfx.saut();
    player.jumpY = solApres; player.jumpVy = 0; player.doubled = false; player.flip = 0; player.tHaut = 0;
  }
  player.auSol = player.jumpY <= solApres + 0.001;
  // (Plus de bandeau « LES HALLES ! » : c'est l'enseigne peinte sur le toit
  // qui annonce le bâtiment, 27 septembre 2026.)
  game.surHalle = rows.solAt(player.v) > 0.05;
  if (now >= 0) fantome.enregistrer(tm, player.u, player.v, player.jumpY);
  friends.recordPlayer(player.v, marque, marque ? refObstacle(player.v, tm) : null);
  friends.update(dt, player, phys);

  // --- Traversées : armées pour croiser le joueur ---
  if (now >= 0) armerTraversees(tm, vitesse);

  // --- Collisions et pièces ---
  if (now >= 0) {
    for (const ev of rows.checkMember("j", player.prevV, player.v, player.jumpY, tm)) {
      if (ev.type === "piece") gagnerPiece(player.u, player.v);
      else if (ev.type === "lait") gagnerLait(player.u, player.v);
      else if (ev.type === "rouge") gagnerRouge(player.u, player.v);
      else { toucherJoueur(ev); if (game.ended || revivePaused) break; }
    }
    for (const m of friends.members()) {
      for (const ev of rows.checkMember(m.id, m.prevV, m.v, m.jumpY, tm)) {
        if (ev.type === "piece") gagnerPiece(m.u, m.v);
        else if (ev.type === "lait") gagnerLait(m.u, m.v);
        else if (ev.type === "rouge") gagnerRouge(m.u, m.v);
      }
    }
  }

  // --- Ligne d'ARRIVÉE (1er octobre 2026 : « essaye de modéliser une ligne
  // d'arrivée ») : 8 s avant la fin du morceau, on la pose là où le joueur
  // sera quand la musique s'arrêtera (vitesse prévue intégrée). La franchir
  // termine la course, comme la fin du morceau.
  if (now >= 0 && !game.sprint && game.arriveeR === null && tempsRestant() <= 8) {
    let d = 0;
    for (let t = 0; t < tempsRestant(); t += 0.05) d += targetSpeed(now + t) * 0.05;
    game.arriveeR = player.v + d;
  }
  if (game.arriveeR !== null && player.v >= game.arriveeR && !game.ended) { terminer(); return; }
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
  if (e.code === "KeyI") { invincible = !invincible; afficherBanner(invincible ? "INVINCIBLE" : "VULNÉRABLE", "debug", JAUNE, 1.2, "DEBUG"); }
  if (e.code === "KeyP") arriveePote(friends.join(player), false);
  if (e.code === "KeyO") { friends.lose(1); pousserPopup("−1 POTE", ROUGE); }
  if (e.code === "KeyG") mourir();
  if (e.code === "KeyL") gagnerLait(player.u, player.v);
  if (e.code === "KeyN") { nuitDebut = clock.now() - 30; }
  if (e.code === "KeyF") terminer();
  if (e.code === "KeyS") { saisonForcee = saisonForcee === null ? 0 : (saisonForcee + 1) % 4; afficherBanner(scene.SAISONS[saisonForcee].toUpperCase(), "debug", JAUNE, 1.2, "SAISON"); }
});

// --- Rendu ---------------------------------------------------------------------
const GEO_HALLE = { haut: rows.HALLE_HAUT, montee: 7, plat: 26, descente: 7, total: rows.HALLE_ROWS };
const GEO_BOSSE = { ...rows.GEO_BOSSE, sol: rows.solAt };
const SIGN_EVERY = 45;
// Un seul panneau à la fois : celui d'entrée de village (la ville du joueur)
// efface le panneau régulier voisin (20 septembre 2026 : « j'ai eu deux
// panneaux en même temps, c'est assez bizarre »).
function panneauVilleProche(r) {
  if (!scene.villeDuJoueur()) return false;
  for (let d = -9; d <= 9; d++) if (scene.debutVillage(r + d)) return true;
  return false;
}
// Jamais de panneau sur une halle ni juste avant/après (27 septembre 2026 :
// « il y a un panneau de ville qui était derrière les halles, ça n'a aucun sens »).
function prochDeHalle(r, marge = 14) {
  for (let d = -marge; d <= marge; d += 2) if (rows.halleA(r + d) !== null) return true;
  return false;
}
function signAt(r) {
  const villages = window.CONFIG.villages || [];
  if (!villages.length || r % SIGN_EVERY !== 20) return null;
  if (panneauVilleProche(r) || prochDeHalle(r)) return null;
  return villages[Math.floor(r / SIGN_EVERY) % villages.length];
}
function panneauVilleA(r) { return !!scene.villeDuJoueur() && scene.debutVillage(r - 1) && !prochDeHalle(r); }
// Le mobilier s'efface autour des panneaux (bit 1) et sur les halles (bit 2).
const masqueCache = new Map(); // fonction pure de r (et de la ville) : vidée par preparerJoueur
scene.setMasqueDecor((r) => {
  let m = masqueCache.get(r);
  if (m !== undefined) return m;
  m = 0;
  for (let d = -3; d <= 3; d++) if (signAt(r + d) || panneauVilleA(r + d)) { m |= scene.SANS_LAMPE; break; }
  if (prochDeHalle(r, 4)) m |= scene.DANS_HALLE;
  // Le bowling est une salle fermée : aucun décor derrière (4 octobre 2026).
  for (let k = -8; k <= 8; k += 2) { const dh = rows.halleA(r + k); if (dh !== null && rows.typeHalle(dh) === "bowling") { m |= scene.SANS_DECOR; break; } }
  // Pas de lampadaire planté dans une bosse.
  for (let k = -2; k <= 2; k++) if (rows.bosseA(r + k) !== null) { m |= scene.SANS_LAMPE; break; }
  if (masqueCache.size > 4000) masqueCache.clear();
  masqueCache.set(r, m);
  return m;
});
scene.setDessinVoiture((c, u, v) => props.drawVoiture(c, rows.KINDS.voiture, u, v, 1, 0));
scene.setZoneForcee((r) => (rows.enMontagne(r) ? "montagne" : null));

// Pièce, brique de lait ou pièce rouge, flottant à la hauteur `h` au-dessus
// de la route (rangée r).
function drawPiece(r, h, now, kind) {
  const bob = Math.sin(now * 3 + r * 0.7) * 0.05;
  const spin = (now * Math.PI * 2) / (clock.beatPeriod * 2) + r * 0.9 + h;
  if (kind === "lait") {
    { const p = scene.project(0, r, h + 0.3); if (p.x < width * 0.82) projoLancer("lait", p.x, p.y, 46); projoSuivre("lait", p.x, p.y); }
    // Brique de lait : une VRAIE boîte qui tourne autour de son axe vertical
    // (scene.drawBoxR). L'astuce précédente — réduire la largeur au cosinus —
    // ne pouvait pas marcher : drawBox ne peint que des boîtes alignées sur
    // les axes, donc la brique s'écrasait au lieu de tourner (20 septembre
    // 2026 : « ça ne marche toujours pas en 3D, il faut que tu voies la logique »).
    const bas = h - 0.42 + bob;
    scene.avecLift(rows.solAt(r), () => scene.drawShadow(ctx, 0, r, 0.22, 0.22, 0.18));
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
const alertesVues = new Map(); // rangée → instant (réel) où son panneau est apparu
let debugAlertes = null; // harnais : rangée → { alerte, vu } (panneau affiché / véhicule à l'écran)
let montagneFondu = 0;
function renderAlertes(now, vitesse) {
  if (!gameStarted || game.ended || now < 0) return;
  const devant = scene.unitesDevant();
  const r0 = Math.floor(player.v) + 1, r1 = Math.floor(player.v + vitesse * ARM_AHEAD_S) + 2;
  for (let r = r0; r <= r1; r++) {
    const row = rows.rowAt(r);
    if ((row.type !== "traverse" && row.type !== "contresens") || !row.armed) continue;
    // La poule jetée n'a pas d'alerte : on voit le fermier avant qu'il lance.
    if (rows.KINDS[row.kind].lanceur) continue;
    // Tracteur : tant que sa rangée n'est pas à l'écran. Voiture en face :
    // tant que la VOITURE n'y est pas (elle part de bien plus loin que sa rangée).
    const ou = row.type === "contresens" ? rows.contresensAt(r, row, now) : { v: r };
    // L'ARRIÈRE du véhicule compte : un tracteur lent entre dans l'écran par son cul.
    if (!ou || ou.v - (row.type === "contresens" ? rows.KINDS[row.kind].long / 2 : 0) <= player.v + devant + 1) continue;
    const tRest = row.type === "contresens" ? (ou.v - player.v) / Math.max(0.5, vitesse + row.vitesse) : (r - player.v) / Math.max(0.5, vitesse);
    const urgence = Math.max(0, Math.min(1, 1 - (tRest - 1) / 2.5));
    // 4 octobre 2026 (« il doit trembler pendant 1 seconde, et après se réduire
    // en taille et être tout le temps là [...] c'est un poil trop ») : grand et
    // qui tremble la première seconde, puis petit et calme jusqu'à l'arrivée.
    const tReel = perfClock();
    if (!alertesVues.has(r)) { alertesVues.set(r, tReel); if (alertesVues.size > 40) alertesVues.delete(alertesVues.keys().next().value); }
    const age = tReel - alertesVues.get(r);
    const reduit = Math.max(0, Math.min(1, (age - 1) / 0.3));
    const taille = 32 * (1 - reduit) + 17 * reduit;
    const tremble = age < 1 ? Math.sin(age * 72) * 5 * (1 - age * 0.6) : 0;
    const y = scene.project(0, player.v, 1.4).y + (age < 1 ? Math.cos(age * 61) * 2 : 0);
    // ⚠️ Le panneau tenait sur `width − 18 − taille` et son sommet droit
    // partait donc HORS de l'écran (20 septembre 2026 : « il est coupé sur la
    // droite, il apparaît pas dans tout l'écran »). Il est désormais posé sur
    // sa largeur réelle, 2 × taille, avec une marge franche.
    const x = width - 14 - taille * 2 + tremble;
    projoLancer("alerte", x + taille, y, 70); projoSuivre("alerte", x + taille, y);
    if (debugAlertes) { const e = debugAlertes.get(r) || { kind: row.kind, alerte: 0, vu: 0 }; e.alerte += 1; debugAlertes.set(r, e); }
    ctx.save();
    // Halo puis panneau plein, contour blanc : il doit sauter aux yeux
    // (20 septembre 2026 : « le panneau d'attention n'est pas du tout assez visible »).
    const halo = ctx.createRadialGradient(x + taille, y, 0, x + taille, y, taille * 2.4);
    const grave = row.kind === "tracteur" || row.kind === "contresens" || row.kind === "bus" || row.kind === "chasseneige";
    const teinte = grave ? "225,62,38" : "255,207,46";
    halo.addColorStop(0, `rgba(${teinte},${(0.5 * urgence + 0.2) * (1 - reduit * 0.75)})`);
    halo.addColorStop(1, `rgba(${teinte},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(x + taille - taille * 2.4, y - taille * 2.4, taille * 4.8, taille * 4.8);
    ctx.fillStyle = grave ? "#e13e26" : "#ffcf2e";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5 - reduit * 1.3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x + taille, y - taille * 1.15);
    ctx.lineTo(x + taille * 2, y + taille * 0.8);
    ctx.lineTo(x, y + taille * 0.8);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    // « ! » DESSINÉ (4 octobre 2026 : « le point d'exclamation n'est pas très
    // bien centré ») : une barre et un point, centrés sur l'axe du triangle et
    // posés dans son tiers bas — plus de dépendance aux métriques de la police.
    ctx.fillStyle = grave ? "#ffffff" : "#0d0d10";
    const cx = x + taille, bw = taille * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2, y - taille * 0.42); ctx.lineTo(cx + bw / 2, y - taille * 0.42);
    ctx.lineTo(cx + bw * 0.32, y + taille * 0.28); ctx.lineTo(cx - bw * 0.32, y + taille * 0.28);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, y + taille * 0.52, bw * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    break;
  }
}

// Saisons : quatre tranches égales du morceau, dans l'ordre du calendrier,
// automne → hiver → printemps → été. Fondu de 4 s d'une saison à l'autre.
let saisonForcee = null; // debug : touche S
function poserSaison(t) {
  if (saisonForcee !== null) { scene.setSaison(saisonForcee, saisonForcee, 0); return; }
  const duree = Math.max(20, (window.CONFIG.dureeMorceau || 170) / 4);
  const depart = 2; // toujours l'AUTOMNE au départ (29 septembre 2026 : « ça serait bien que ça commence dans le biome automne »)
  const k = Math.max(0, Math.floor(t / duree));
  const dans = t - k * duree;
  const a = (depart + k) % 4, b = (depart + k + 1) % 4;
  scene.setSaison(a, b, Math.max(0, (dans - (duree - 4)) / 4));
}
function render(alpha) {
  // ⚠️ On repart d'une matrice propre à chaque image. Un seul `ctx.save()` non
  // rendu — une exception au milieu d'une rotation, par exemple — laissait
  // sinon TOUT le jeu penché jusqu'au rechargement de la page.
  ctx.setTransform(dprCourant, 0, 0, dprCourant, 0, 0);
  ctx.globalAlpha = 1;
  const now = clock.now();
  const tm = tMonde();   // horloge du monde (ralentie pendant un conseil)
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

  poserSaison(gameStarted ? now : 0);
  scene.renderGround(ctx, null);   // plus de boue depuis le 20 septembre 2026
  // Phare du vélo la nuit : un faisceau chaud sur la route, devant le joueur.
  const nuitF = scene.getNight();
  if (gameStarted && nuitF > 0.25) {
    const a = scene.project(0, v + 1, 0), b = scene.project(0, v + 9, 0);
    const g = ctx.createRadialGradient(a.x, a.y, 4, a.x, a.y, Math.max(40, b.x - a.x));
    g.addColorStop(0, `rgba(255,236,170,${0.42 * nuitF})`);
    g.addColorStop(1, "rgba(255,236,170,0)");
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse((a.x + b.x) / 2, a.y, (b.x - a.x) / 2 + 20, scene.scale() * 1.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const items = [];
  const { from, to } = scene.rowRange();
  // Les halles : la rampe, le plancher et la charpente, posés à la profondeur
  // du bord ARRIÈRE de la route pour que le joueur reste peint par-dessus.
  const hallesVues = new Set();
  for (let r = from; r <= to; r++) {
    const d = rows.halleA(r);
    if (d === null || hallesVues.has(d)) continue;
    hallesVues.add(d);
    // Deux couches : le fond avant le cycliste, le devant après (scene.drawHalle).
    const geo = { ...GEO_HALLE, ...rows.geoHalle(d), type: rows.typeHalle(d) };
    if (geo.type === "gare") items.push({ decor: true, d: scene.depth(scene.ROAD_HALF + 3.0, d), draw: () => scene.drawHalle(ctx, d, geo, from, to, "train") });
    if (geo.type === "bowling") { geo.t = tAnim; items.push({ decor: true, d: scene.depth(scene.ROAD_HALF + 6.5, d), draw: () => scene.drawHalle(ctx, d, geo, from, to, "salle") }); }
    items.push({ decor: true, d: scene.depth(scene.ROAD_HALF + 0.5, d), draw: () => scene.drawHalle(ctx, d, geo, from, to, "fond") });
    items.push({ decor: true, d: scene.depth(-scene.ROAD_HALF - 0.3, d), draw: () => scene.drawHalle(ctx, d, geo, from, to, "devant") });
  }
  // Collines de la montagne : le versant du fond (sous le décor qu'il porte),
  // la chaussée, puis la masse côté caméra — peinte AVANT ce qui roule sur la
  // route : au-dessus de l'œil de la caméra, le bord de la chaussée couperait
  // sinon les roues (on voit la colline par en dessous).
  const bossesVues = new Set();
  for (let r = from; r <= to; r++) {
    const d = rows.bosseA(r);
    if (d === null || bossesVues.has(d)) continue;
    bossesVues.add(d);
    items.push({ decor: true, d: scene.depth(17, d), draw: () => scene.drawBosse(ctx, d, GEO_BOSSE, from, to, "dos") });
    items.push({ decor: true, d: scene.depth(scene.ROAD_HALF + 0.05, d), draw: () => scene.drawBosse(ctx, d, GEO_BOSSE, from, to, "dessus") });
    items.push({ decor: true, d: scene.depth(scene.ROAD_HALF + 0.04, d), draw: () => scene.drawBosse(ctx, d, GEO_BOSSE, from, to, "flanc") });
  }
  const vc = scene.getVCentre(), largeurRoute = scene.demiLargeurRoute() + 2;
  for (let r = from; r <= to; r++) {
    const row = r >= 0 ? rows.rowAt(r) : null;
    const clear = row && row.type === "traverse";
    const hb = rows.hauteurBosse(r);
    for (const it of scene.rowDecor(ctx, r, clear)) {
      it.decor = true;
      if (hb > 0.01) { const f = it.draw; it.draw = () => scene.avecLift(hb, f); }
      items.push(it);
    }
    const sg = rows.bosseA(r) === null ? signAt(r) : null;
    if (sg) items.push({ decor: true, d: scene.depth(scene.ROAD_HALF + 0.55, r), draw: () => scene.drawSign(ctx, r, sg) });
    // Entrée du biome village : le panneau porte la ville du joueur.
    if (panneauVilleA(r + 1)) items.push({ d: scene.depth(scene.ROAD_HALF + 0.55, r + 1), draw: () => scene.drawSign(ctx, r + 1, [scene.villeDuJoueur(), "chez toi"]) });
    if (!row) continue;
    // La voiture en face : elle roule SUR la route, vers le joueur (20
    // septembre 2026 : « une voiture qui roule en sens inverse, pour que ce
    // soit vraiment difficile »).
    if (row.type === "contresens") {
      const t = gameStarted ? tm : perfClock();
      const K = rows.KINDS[row.kind];
      const inst = rows.contresensAt(r, row, t);
      if (K.lanceur) {
        // Le fermier qui jette la poule : sur le bas-côté du fond, face au joueur.
        const fu = scene.ROAD_HALF + 0.45, fv = r + K.lanceur;
        const lance = row.armed ? Math.max(0, t - row.t0) : null;
        items.push({ d: scene.depth(fu, fv), draw: () => surSol(fv, () => props.drawLanceurFace(ctx, fu, fv, tAnim, lance)) });
        if (inst) items.push({ d: scene.depth(0, inst.v), draw: () => surSol(inst.v, () => props.drawPouleJetee(ctx, 0, inst.v, t)) });
      } else if (inst) {
        const dessin = row.kind === "tracteur" ? () => props.drawTracteurRoute(ctx, inst.K, 0, inst.v, t)
          : row.kind === "bus" ? () => props.drawBus(ctx, inst.K, 0, inst.v, t)
          : row.kind === "chasseneige" ? () => props.drawChasseNeige(ctx, inst.K, 0, inst.v, t)
          : () => props.drawVoiture(ctx, inst.K, 0, inst.v, -1, t);
        items.push({ d: scene.depth(0, inst.v), draw: () => surSol(inst.v, dessin, true) });
        if (debugAlertes) { const px = scene.project(0, inst.v, 0).x; if (px > 0 && px < width) { const e = debugAlertes.get(r) || { kind: row.kind, alerte: 0, vu: 0 }; e.vu += 1; debugAlertes.set(r, e); } }
      }
    }
    // Les traversants se voient de loin (ils arrivent du fond) : tout l'intervalle.
    if (row.type === "traverse") {
      const t = gameStarted ? tm : perfClock();
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
      items.push({ d: scene.depth(0, r), draw: () => surSol(r, () => (tombe !== undefined
        ? props.drawStaticTombe(ctx, row.kind, 0, r, tAnim, Math.max(0, tm - tombe))
        : row.bouchon !== undefined
          ? (props.drawVoiture(ctx, rows.KINDS[row.kind], 0, r, 1, tAnim, props.COULEURS_BOUCHON[row.bouchon % 3]), props.drawFeuxDetresse(ctx, rows.KINDS[row.kind], 0, r, tAnim))
          : props.drawStatic(ctx, row.kind, 0, r, tAnim))) });
    }
  }
  if (game.arriveeR !== null && Math.abs(game.arriveeR - vc) < largeurRoute + 6) {
    const ra = game.arriveeR, RH = scene.ROAD_HALF;
    // 4 octobre 2026 (« arrête d'écrire ARRIVÉE de manière 2D alors que le jeu
    // est modélisé en 3D, tu mets juste les carreaux noirs et blancs ») : plus
    // de texte. Un damier au sol, et un drapeau à damier sur chaque poteau,
    // tourné vers la caméra pour se lire de profil.
    const damier = (i, j) => ((i + j) % 2 ? "#0d0d10" : "#f4efe4");
    const drapeau = (u) => {
      scene.drawBox(ctx, u, ra - 0.12, 0.24, 0.24, 5.2, "#3a3a40");
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) scene.drawBox(ctx, u - 0.02, ra + 0.12 + i * 0.32, 0.06, 0.32, 0.32, damier(i, j), 3.9 + j * 0.32);
    };
    items.push({ decor: true, d: scene.depth(RH + 0.6, ra), draw: () => {
      const n = 8, du = (2 * RH) / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) scene.drawFlat(ctx, -RH + i * du, ra - 0.6 + j * 0.4, du, 0.4, damier(i, j));
      drapeau(RH + 0.3);
    } });
    items.push({ d: scene.depth(-RH - 0.6, ra), draw: () => drapeau(-RH - 0.6) });
  }
  if (gameStarted) for (const dr of friends.drawables(ctx, pedal, penteSol)) items.push({ d: scene.depth(dr.u, dr.v), draw: dr.draw });
  // Le fantôme du meilleur de la ligue : transparent, sans ombre, étiqueté.
  // Décalé vers le fond de la route (u + 0,7) : sur une seule voie, il serait
  // pile derrière le joueur.
  const gp = gameStarted && ghost && ghost.graine === game.graine ? fantome.positionA(ghost.trace, tm) : null;
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
    // Pas d'ombre sur la route quand on roule sur une halle ou un toit de voiture.
    drawRider(ctx, u, v, jy, paletteJoueur, pedal, 1, flip, solSous(v, jy) < 0.05, player.prevRoue + (player.roue - player.prevRoue) * alpha,
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
    // Tout ce qui n'est pas décor reste ÉCLAIRÉ la nuit (29 septembre 2026 :
    // « quand on est en nuit, à l'automne, on ne voit pas les personnages qui
    // sont sur la route [...] je suis mort parce que j'ai pris une poule »).
    try { if (it.decor) it.draw(); else scene.eclaire(it.draw); } catch (e) { if (!rendusRates.has(String(e))) { rendusRates.add(String(e)); console.error("rendu d'objet :", e); } ctx.setTransform(dprCourant, 0, 0, dprCourant, 0, 0); ctx.globalAlpha = 1; }
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
  scene.renderMeteo(ctx, tAnim);
  renderAlertes(tm, speed);
  hud.renderTurbo(ctx, width, height, tAnim, Math.min(1, game.turbo * 2));

  if (damageFlash > 0) {
    ctx.fillStyle = `rgba(225, 62, 38, ${0.35 * damageFlash})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (pastilles.length) {
    const g = scene.project(u, v, jy + RIDER_HEIGHT + 0.5);
    pastilles.forEach((pa, i) => {
      const a = Math.min(1, pa.age * 6, (pa.duree - pa.age) * 3);
      hud.renderPastille(ctx, g.x, g.y - 30 - (pastilles.length - 1 - i) * 26 - Math.min(1, pa.age * 5) * 8, pa.texte, a, true);
    });
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
      restantS: game.ended ? 0 : tempsRestant(), turbo: game.turbo > 0, safeTop, nuit: scene.getNight(),
    });
    ctx.restore();
  }
  if (gameStarted && !game.ended) {
    if (now < COUNT_IN_GO_LINGER_S) hud.renderCountIn(ctx, width, height, now, clock.beatPeriod, COUNT_IN_BEATS, COUNT_IN_GO_LINGER_S, !game.sonAnnonce);
    hud.renderTuto(ctx, width, height, conseilVue());
  }
  // Le doigt qui tape : 3 premières parties, jusqu'au premier saut.
  // Après le GO seulement, et jamais par-dessus une consigne (3 octobre 2026 :
  // « 3 ou 4 écrans au tout début qui s'affichent en même temps »).
  if (gameStarted && !game.ended && game.tapHint && now > COUNT_IN_GO_LINGER_S && !conseilVue() && !projo.type) hud.renderTapHint(ctx, width, height, tAnim, Math.min(1, (now - COUNT_IN_GO_LINGER_S) * 2));
  if (projo.type) hud.renderProjecteur(ctx, width, height, projo, PROJECTEURS[projo.type], tAnim);
  if (gameStarted && hudAlpha > 0.001 && banner) {
    ctx.save();
    ctx.globalAlpha = hudAlpha;
    hud.renderBanner(ctx, width, height, banner, safeTop, null);
    ctx.restore();
  }
  if (game.finAge >= 0) hud.renderFin(ctx, width, height, game.finAge, game.sprint ? "Fin du sprint" : "Tu es allé au bout du morceau");

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
  renderSplash();
  // Aussi APRÈS une course : le bouton « Menu » de l'écran de fin ramène ici.
  if (!skinCtx || !document.getElementById("overlay").classList.contains("visible") || !document.getElementById("onboarding").classList.contains("active") || screens.stepCourante() !== 3) return;
  apercuPedal += 0.12;
  dessinerCycliste(skinCanvas, skinCtx, 240, 140, apercuPedal, false);
}
// Un cycliste qui pédale, centré dans un petit canvas : l'aperçu du menu, et
// l'écran de chargement (4 octobre 2026 : « rajoute le cycliste en 3D en train
// de pédaler »), où la route défile sous lui.
function dessinerCycliste(cv, c2, cw, ch, ped, route) {
  const P = paletteDepuisSkin(screens.getSkin());
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (cv.width !== cw * dpr) { cv.width = cw * dpr; cv.height = ch * dpr; }
  c2.setTransform(dpr, 0, 0, dpr, 0, 0);
  c2.clearRect(0, 0, cw, ch);
  const VW = 700;
  scene.setViewport(VW, VW);
  scene.setJoueurX(0.36);
  scene.setCamera(0);
  const a = scene.project(0, 0, 0);
  c2.save();
  c2.translate(cw / 2 - a.x, ch * 0.88 - a.y);
  if (route) {
    scene.drawFlat(c2, -0.8, -3.4, 1.6, 6.8, "#3a3633");
    const pas = 1.7, decal = (ped * 0.22) % pas;
    for (let k = -3; k <= 3; k++) scene.drawFlat(c2, -0.05, k * pas - decal, 0.1, 0.8, "#f2ead8");
  } else scene.drawFlat(c2, -0.7, -1.4, 1.4, 2.8, "#565250");
  drawRider(c2, 0, 0, 0, P, ped, 1, 0);
  c2.restore();
  scene.setViewport(width, height);
}
const splashVelo = document.getElementById("splash-velo");
const splashCtx = splashVelo ? splashVelo.getContext("2d") : null;
let splashPedal = 0;
function renderSplash() {
  if (!splashCtx || document.getElementById("splash").classList.contains("fini")) return;
  splashPedal += 0.16;
  dessinerCycliste(splashVelo, splashCtx, 200, 110, splashPedal, true);
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
    () => { for (const k of Object.keys(rows.KINDS)) if (!rows.KINDS[k].traverse && !rows.KINDS[k].contresens) props.drawStatic(c, k, 0, 5, 0); },
    () => { props.drawCrosser(c, "tracteur", 0, 5, 1, 0); props.drawLanceurFace(c, 2, 5, 0, null); props.drawPouleJetee(c, 0, 5, 0); },
    () => { drawRider(c, 0, 0, 0, PALETTES.pmc, 0, 1, 0); drawRider(c, 0, 0, 0, PALETTES.soberland, 0, 1, 1); for (const P of PALETTES.potes) drawRider(c, 0, 0, 0, P, 0); },
    () => { c.translate(32, 32); drawCoin(c, 10, 0.3); drawCoin(c, 10, 0.3, true); c.setTransform(1, 0, 0, 1, 0, 0); scene.drawSign(c, 20, ["CYSOING", "59"]); },
    () => { for (let r = 0; r < 60; r++) scene.rowDecor(c, r, false).forEach((it) => it.draw()); },
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
    projo: () => projo.type,
    tMonde: () => tMonde(),
    vitesse: () => speed,
    suivreAlertes: () => { debugAlertes = new Map(); },
    alertes: () => [...(debugAlertes || new Map())].map(([r, e]) => ({ r, ...e })),
    fps: () => perf.fps,
    frameMs: () => perf.frameMs,
    tombes: () => tombes.size,
    conseil: () => ({ ...conseil, ralenti }),
    chocs: () => chocs.slice(),
  };
}
requestAnimationFrame(frame);
