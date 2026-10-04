// scene.js — « J'ai un pote v2 » : VUE DE PROFIL, une seule voie (19 septembre
// 2026 : « une seule voie, en 2D, exactement comme Jetpack Joyride ou Zombie
// Tsunami »). Remplace iso.js (vue 3/4 tournée de 30°) avec le MÊME contrat
// d'exports : le monde reste en (u, v, h) — u = profondeur (0 = la route,
// + = vers le fond, − = vers la caméra), v = avance, h = hauteur — seule la
// projection change. Le joueur file vers la DROITE de l'écran.
//
// Caméra : un sténopé posé à côté de la route, à `camD` unités de son axe et
// `camH` unités de haut, qui regarde perpendiculairement à la route :
//
//   s = K · camD / (camD + u)          (échelle à la profondeur u)
//   x = W/2 + (v − vCentre) · s
//   y = horizon + (camH − h) · s
//
// À la profondeur de la route (u = 0), 1 unité = K pixels. Le fond se tasse
// vers l'horizon et défile moins vite (parallaxe gratuite, comme les décors
// de Zombie Tsunami) ; le premier plan grossit et file plus vite. Le sol à
// profondeur fixe est une ligne HORIZONTALE : les bandes de terrain sont des
// trapèzes, la face avant des cubes un rectangle.
//
// Ordre du peintre : profondeur = camD + u (le fond d'abord), départagée par
// l'écart au centre de l'écran.

import { parseColor } from "./voxel.js";
import { humain } from "./humains.js";

// --- La route : UNE voie ------------------------------------------------------
// COLS/COL_CENTRE/colU restent exportés pour les modules qui les lisaient
// (rows, friends, simulation) : il n'y a plus qu'une colonne, en u = 0.
export const COLS = 1;
export const COL_CENTRE = 0;
export const COL_W = 2.4;
export const ROAD_HALF = 1.2;
export function colU() { return 0; }
// Rangées ouvertes devant l'écran pour le turbo lait et le tuto (fenêtre
// sûre posée au-delà de ce que voit le joueur).
export const ROWS_AHEAD = 14;
export const ROWS_BEHIND = 5;

const U_DECOR = 16;   // au-delà : champs lointains unis, puis collines
// Hauteurs réelles du mobilier de bord de route (1 unité ≈ 1 mètre).
export const POTEAU_H = 8.0, LAMPE_H = 6.5;

let W = 375, H = 812, K = 26;
let camD = 11, camH = 3.6;
let camV = 0, vCentre = 0, joueurX = 0.28;
let horizonY = 430;
let camH0 = 3.6, horizonY0 = 430, levee = 0;
let night = 0;
let decorT = 0;
let heure = 0;   // 0 = début de course, 1 = fin : le soleil traverse le ciel

function cfg(cle, defaut) { const c = window.CONFIG || {}; return c[cle] !== undefined ? c[cle] : defaut; }

export function setViewport(width, height) {
  W = width; H = height;
  // Largeur fixe en unités (même temps de réaction pour tout le monde),
  // plafonnée par la hauteur sur un écran couché (ordinateur).
  K = Math.min(W / cfg("unitesVisibles", 14.5), H / 11);
  camD = cfg("cameraDistance", 11);
  camH0 = cfg("cameraHauteur", 3.6);
  horizonY0 = H * cfg("solEcran", 0.64) - camH0 * K;
  appliquerLevee();
  majCentre();
}
// Caméra qui MONTE avec la colline (5 octobre 2026 : en haut, la route passait
// au-dessus de l'œil de la caméra et on voyait les vélos par en dessous — « les
// vélos ne sont pas très bien modélisés »). L'œil monte de `levee` et l'image
// est recalée pour que le plan de la route (u = 0) reste EXACTEMENT au même
// endroit de l'écran : le joueur grimpe toujours autant à l'écran ; le fond
// monte, le premier plan descend, et tout se voit de nouveau par-dessus.
function appliquerLevee() { camH = camH0 + levee; horizonY = horizonY0 - levee * K; }
export function setLevee(d) { levee = Math.max(0, d); appliquerLevee(); }
// Hauteur (u) qui s'affiche à la ligne d'écran y, dans le plan de la route
// (u = 0). Indépendante de la levée de caméra (le plan u = 0 ne bouge pas).
export function hauteurA(y) { return camH + (horizonY - y) / K; }
export function getLevee() { return levee; }
function majCentre() { vCentre = camV + (0.5 - joueurX) * W / K; }
// La caméra suit le joueur ; `setJoueurX` règle où il est à l'écran (fraction
// de la largeur) — main.js l'avance quand la vitesse monte.
export function setCamera(v) { camV = v; majCentre(); }
export function setJoueurX(f) { joueurX = f; majCentre(); }
export function getJoueurX() { return joueurX; }
export function getCamV() { return camV; }
export function getVCentre() { return vCentre; }
export function unitesDevant() { return (1 - joueurX) * W / K; }
export function unitesDerriere() { return joueurX * W / K; }
export function setNight(n) { night = Math.max(0, Math.min(1, n)); }
// Avancement de la journée (20 septembre 2026, demandé : « le soleil qui
// tourne de gauche à droite de l'écran jusqu'à la nuit, où la lune fait
// pareil — on a l'impression que la temporalité passe »).
export function setHeure(t) { heure = Math.max(0, Math.min(1, t)); }
export function getNight() { return night; }
export function setDecorTime(t) { decorT = t; }
export function scale() { return K; }
export function horizon() { return horizonY; }

export function echelle(u) { return K * camD / Math.max(0.35, camD + u); }
// Sol surélevé (4 octobre 2026, les collines de la montagne) : tout ce qui est
// dessiné dans avecLift(h, …) est posé h plus haut. Les primitives l'ajoutent
// dès l'ENTRÉE (hauteurs absolues dans les opérations triées), `project`
// l'ajoute pour les dessins 2D des modèles (personnages, etc.).
let liftSol = 0;
export function avecLift(h, fn) { const a = liftSol; liftSol = a + h; try { fn(); } finally { liftSol = a; } }
function projectAbs(u, v, h) {
  const s = echelle(u);
  return { x: W * 0.5 + (v - vCentre) * s, y: horizonY + (camH - h) * s };
}
export function project(u, v, h = 0) { return projectAbs(u, v, h + liftSol); }
export function depth(u, v) { return camD + u + Math.abs(v - vCentre) * 0.002; }
function ySol(u) { return horizonY + camH * echelle(u); }
// Profondeur (négative) où le sol atteint le bas de l'écran.
function uPres() { const s = (H + 12 - horizonY) / camH; return K * camD / s - camD; }
// Hauteur maximale d'un objet du premier plan pour qu'il ne cache jamais la
// route (son sommet reste sous le bord proche de la route).
export function hauteurMaxPremierPlan(u) {
  const limite = ySol(-ROAD_HALF) + 5;
  return camH - (limite - horizonY) / echelle(u);
}

// --- Couleurs : nuit + brume de distance, mises en cache ------------------------
const HORIZON_JOUR = parseColor("#f4dfbf"), HORIZON_NUIT = parseColor("#1c2448");
const cache = new Map();
const borne = (x) => Math.max(0, Math.min(255, Math.round(x)));
const rgb = (r, g, b) => `rgb(${borne(r)},${borne(g)},${borne(b)})`;
function melange(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
// Teintes d'une couleur à la profondeur u : `plat` (sol), et les faces d'un
// cube — `avant` (face qui regarde la caméra), `dessus`, `lumiere` (côté
// tourné vers la droite, où est le soleil), `ombre` (côté gauche).
function teintes(color, u) {
  const kb = Math.max(0, Math.min(9, Math.round((u - 2.5) / 1.8)));
  // Acteurs éclairés (main.js) : la nuit ne les assombrit qu'au quart.
  const kn = eclaireActif ? 0 : Math.round(night * 10); // acteurs en pleine lumière la nuit
  const cle = `${color}|${kb}|${kn}|${modeSaison ? saisonCle : ""}`;
  let t = cache.get(cle);
  if (t) return t;
  let [r, g, b] = parseColor(color);
  let neigeDessus = 0;
  if (modeSaison) { [r, g, b] = saisonner([r, g, b], color); neigeDessus = modeSaison === "objet" ? poidsHiver() * 0.85 : 0; }
  if (kn > 0) { const a = 8 * kn; r -= a; g -= a * 0.95; b -= a * 0.5; }
  const hz = melange(HORIZON_JOUR, HORIZON_NUIT, kn / 10);
  const f = kb * 0.07;
  r += (hz[0] - r) * f; g += (hz[1] - g) * f; b += (hz[2] - b) * f;
  const neige = melange(melange([236, 241, 246], [120, 130, 170], kn / 10), hz, f);
  const dessus = melange([r + 26, g + 26, b + 22], neige, neigeDessus);
  t = { plat: rgb(r, g, b), avant: rgb(r - 6, g - 6, b - 6), dessus: rgb(dessus[0], dessus[1], dessus[2]), lumiere: rgb(r + 6, g + 6, b + 4), ombre: rgb(r - 30, g - 30, b - 26) };
  if (cache.size > 6000) cache.clear();
  cache.set(cle, t);
  return t;
}
export function teinte(color, u = 0) { return teintes(color, u).plat; }
let eclaireActif = false;
export function eclaire(fn) { const e = eclaireActif; eclaireActif = true; try { fn(); } finally { eclaireActif = e; } }

// --- Saisons (28 septembre 2026 : « fais les saisons avec neige, faut plein de
// variations ») ------------------------------------------------------------------
// Quatre saisons se succèdent pendant le morceau (main.js pose la saison et le
// fondu). Elles ne repeignent QUE le décor et le sol — jamais la route, les
// bêtes ni les cyclistes : `modeSaison` est levé autour de leurs dessins.
//   hiver     : sol et toits enneigés, feuillage sombre, flocons ;
//   automne   : feuillage roux, herbe sèche, feuilles qui tombent ;
//   printemps : vert tendre, arbres en fleurs, pétales ;
//   été       : les couleurs d'origine.
export const SAISONS = ["printemps", "ete", "automne", "hiver"];
let saisonA = 1, saisonB = 1, saisonT = 0, saisonCle = "1-1-0";
let modeSaison = null; // null | "sol" | "objet"
export function setSaison(a, b, t) {
  const q = Math.round(Math.max(0, Math.min(1, t)) * 6) / 6;
  saisonA = a; saisonB = b; saisonT = q; saisonCle = `${a}-${b}-${q}`;
}
export function saisonCourante() { return SAISONS[saisonT < 0.5 ? saisonA : saisonB]; }
function poids(nom) { const i = SAISONS.indexOf(nom); return (saisonA === i ? 1 - saisonT : 0) + (saisonB === i ? saisonT : 0); }
function poidsHiver() { return poids("hiver"); }
const ROUX = [[200, 112, 42], [181, 70, 42], [217, 161, 58], [168, 96, 40]];
function estVegetal(c) { return c[1] > c[0] + 4 && c[1] > c[2] + 8; }
function saisonnerUne(nom, c, cle) {
  if (nom === "hiver") {
    if (modeSaison === "sol") return melange(c, [232, 238, 244], 0.86);
    // Feuillage givré, cultures (blé, tournesol) blanchies par le gel.
    if (estVegetal(c)) return melange(c, [168, 184, 182], 0.62);
    if (c[0] > 150 && c[0] > c[1] && c[1] > c[2] + 20) return melange(c, [226, 220, 204], 0.6);
    return c;
  }
  if (nom === "automne") {
    if (!estVegetal(c)) return c;
    if (modeSaison === "sol") return melange(c, [170, 140, 70], 0.5);
    let h = 0; for (let i = 0; i < cle.length; i++) h = (h * 31 + cle.charCodeAt(i)) % 997;
    return melange(c, ROUX[h % ROUX.length], 0.72);
  }
  if (nom === "printemps") return estVegetal(c) ? melange(c, [134, 198, 83], 0.35) : c;
  return c;
}
function saisonner(c, cle) {
  const a = saisonnerUne(SAISONS[saisonA], c, cle);
  if (saisonT <= 0 || saisonB === saisonA) return a;
  return melange(a, saisonnerUne(SAISONS[saisonB], c, cle), saisonT);
}
// Sert à main.js pour le sol des halles, etc. : tout ce qui est décor.
export function avecSaison(mode, fn) { const m = modeSaison; modeSaison = mode; try { fn(); } finally { modeSaison = m; } }

// Météo : flocons, feuilles ou pétales en surimpression, en parallaxe avec la
// caméra. Poids de la saison = densité (le fondu les fait venir doucement).
export function renderMeteo(ctx, t) {
  const kinds = [["hiver", 70], ["automne", 26], ["printemps", 22]];
  ctx.save();
  for (const [nom, n0] of kinds) {
    const w = poids(nom);
    if (w < 0.05) continue;
    const n = Math.round(n0 * w);
    for (let i = 0; i < n; i++) {
      const a = hash(i * 7.3 + nom.length), b = hash(i * 3.9 + 11), c = hash(i * 1.7 + 5);
      const chute = nom === "hiver" ? 38 + c * 40 : 30 + c * 25;
      const y = ((b * (H + 40) + t * chute) % (H + 40)) - 20;
      const x = (((a * (W + 60) - camV * K * (0.35 + c * 0.5) + Math.sin(t * 1.3 + i) * 14) % (W + 60)) + (W + 60)) % (W + 60) - 30;
      if (nom === "hiver") {
        ctx.fillStyle = `rgba(255,255,255,${0.55 + 0.4 * c})`;
        const r = 1.2 + c * 2.2;
        ctx.fillRect(x, y, r, r);
      } else {
        ctx.fillStyle = nom === "automne" ? ["#c8702a", "#b5462a", "#d9a13a"][i % 3] : ["#f4bccb", "#ffffff", "#f7d3dc"][i % 3];
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * (1 + c) + i);
        ctx.fillRect(-2.5, -1.5, 5, 3);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function poly(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

// --- Modèles TRIÉS (27 septembre 2026) ----------------------------------------
// Un modèle (voiture, tracteur, bête) est une pile de cubes peints dans l'ordre
// où le code les appelle. Tant que cet ordre était écrit à la main, il ne
// valait que pour UN point de vue : dès que le véhicule passait de l'autre
// côté du centre de l'écran, un phare du flanc du fond se peignait par-dessus
// la carrosserie (« on voit les phares à travers la coque du véhicule »), une
// roue du fond par-dessus le châssis (« le tracteur a un gros problème de
// modélisation 3D »). `groupe()` collecte les cubes d'un modèle et les peint
// selon la VRAIE géométrie : deux cubes qui se recouvrent à l'écran sont
// départagés par un plan qui les sépare (celui qui est du côté de la caméra
// passe devant). Les ombres et aplats au sol partent en premier.
let groupeOps = null;
// `contour` ({ couleur, px }) : un liseré sombre autour du modèle entier (les
// personnages, 4 octobre 2026, nuit : « il manque un peu de contraste [...]
// sur la plage, c'est très difficile de distinguer des humains blancs sur un
// fond blanc »). La silhouette de chaque cube, élargie, est peinte en encre
// AVANT tous les cubes : une fois ceux-ci peints par-dessus, il ne reste que le
// bord extérieur de la figure — jamais de trait entre ses morceaux.
export const CONTOUR_PERSO = { couleur: "#17131c", px: 1.3 };
export function groupe(ctx, fn, contour = null) {
  if (groupeOps) {                         // imbriqué : le groupe parent trie tout
    const debut = groupeOps.length;
    fn();
    if (contour) for (let i = debut; i < groupeOps.length; i++) groupeOps[i].contour = contour;
    return;
  }
  const ops = [];
  groupeOps = ops;
  try { fn(); if (contour) for (const o of ops) o.contour = contour; } finally { groupeOps = null; peindreGroupe(ctx, ops); }
}
// Tête en cubes d'une personne d'humains.js : peau, cheveux selon la coiffure,
// barbe, œil (blanc + pupille sur les peaux foncées : un point noir y
// disparaissait). La tête occupe u ∈ [uH, uH+td] (uH côté caméra), v ∈ [vH,
// vH+tw], h ∈ [HT, HT+TE]. `face` : "profil" = le visage regarde −v (piéton,
// skieur) ; "camera" = il regarde la caméra (marchands). `chapeau` : le dessus
// est couvert, seuls la nuque et les côtés dépassent.
export function teteVoxel(ctx, M, uH, vH, td, tw, HT, TE, { chapeau = false, face = "profil" } = {}) {
  const C = M.cheveux, co = M.coiffure, profil = face === "profil";
  drawBox(ctx, uH, vH, td, tw, TE, M.peau, HT);
  if (co === "afro" && !chapeau) {
    if (profil) drawBox(ctx, uH - 0.05, vH + 0.11, td + 0.1, tw - 0.07, TE * 0.68, C, HT + TE * 0.5);
    else drawBox(ctx, uH + 0.07, vH - 0.05, td - 0.02, tw + 0.1, TE * 0.68, C, HT + TE * 0.5);
  } else if (co === "rase") drawBox(ctx, uH - 0.005, vH + (profil ? 0.05 : -0.005), td + 0.01, tw + (profil ? -0.04 : 0.01), 0.025, C, HT + TE);
  else if (co !== "chauve" && !chapeau) drawBox(ctx, uH - 0.01, vH + (profil ? 0.03 : -0.01), td + 0.02, tw + (profil ? -0.01 : 0.02), 0.06, C, HT + TE);
  // Ce qui descend derrière la tête : [épaisseur, bas en fraction de TE].
  const nuque = { court: [0.08, 0.55], long: [0.1, -0.85], chignon: [0.08, 0.5], afro: [0.12, 0.25], tresses: [0.07, -1.25], chauve: [0.05, 0.3] }[co];
  if (nuque && !(co === "chauve" && M.age !== "vieux")) {
    const [ep, bas] = nuque;
    const h0 = HT + TE * bas, hh = Math.max(0.04, HT + TE * (co === "chauve" ? 0.62 : 0.98) - h0);
    if (profil) drawBox(ctx, uH - 0.01, vH + tw - ep + 0.02, td + 0.02, ep, hh, C, h0);
    else {
      drawBox(ctx, uH + td - ep + 0.02, vH - 0.01, ep, tw + 0.02, hh, C, h0);
      // De face, les cheveux longs encadrent le visage.
      if (co === "long" || co === "tresses") for (const dv of [-0.02, tw - 0.03]) drawBox(ctx, uH + 0.03, vH + dv, td - 0.02, 0.05, HT + TE * 0.98 - h0, C, h0);
    }
  }
  if (co === "chignon" && !chapeau) {
    if (profil) drawBox(ctx, uH + td / 2 - 0.07, vH + tw - 0.02, 0.14, 0.13, 0.13, C, HT + TE * 0.78);
    else drawBox(ctx, uH + td - 0.06, vH + tw / 2 - 0.07, 0.13, 0.14, 0.13, C, HT + TE * 0.78);
  }
  const yo = HT + TE * 0.56;
  if (profil) {
    if (M.barbe) drawBox(ctx, uH - 0.006, vH - 0.012, td + 0.012, 0.07, TE * 0.36, C, HT);
    if (M.fonce) { drawBox(ctx, uH - 0.012, vH + 0.03, 0.012, 0.07, 0.055, "#f4efe4", yo); drawBox(ctx, uH - 0.016, vH + 0.03, 0.012, 0.035, 0.05, "#1a1a1e", yo); }
    else drawBox(ctx, uH - 0.01, vH + 0.03, 0.01, 0.05, 0.05, "#1a1a1e", yo);
  } else {
    if (M.barbe) drawBox(ctx, uH - 0.008, vH + 0.02, 0.06, tw - 0.04, TE * 0.32, C, HT);
    for (const f of [0.22, 0.6]) {
      if (M.fonce) drawBox(ctx, uH - 0.012, vH + tw * f - 0.01, 0.012, 0.07, 0.055, "#f4efe4", yo);
      drawBox(ctx, uH - 0.016, vH + tw * f, 0.012, 0.045, 0.05, "#1a1a1e", yo);
    }
  }
}

// Enveloppe convexe (chaîne monotone) de quelques points écran.
function enveloppe(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const croix = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bas = [], haut = [];
  for (const p of pts) { while (bas.length >= 2 && croix(bas[bas.length - 2], bas[bas.length - 1], p) <= 0) bas.pop(); bas.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (haut.length >= 2 && croix(haut[haut.length - 2], haut[haut.length - 1], p) <= 0) haut.pop(); haut.push(p); }
  haut.pop(); bas.pop();
  return bas.concat(haut);
}
function peindreContours(ctx, ops) {
  ctx.save();
  ctx.lineJoin = "round";
  for (const o of ops) {
    const { couleur, px } = o.contour;
    ctx.globalAlpha = o.a;
    ctx.fillStyle = couleur; ctx.strokeStyle = couleur; ctx.lineWidth = px * 2;
    const pts = [];
    for (const u of [o.u0, o.u1]) {
      const s = echelle(u);
      for (const v of [o.v0, o.v1]) for (const h of [o.h0, o.h1]) pts.push([W * 0.5 + (v - vCentre) * s, horizonY + (camH - h) * s]);
    }
    const env = enveloppe(pts);
    ctx.beginPath();
    env.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
// Le même liseré pour les personnages dessinés À PLAT (costard, fermier,
// baigneur) : la figure est d'abord peinte en encre, décalée dans huit
// directions, puis normalement par-dessus. `dessin(c)` reçoit le contexte à
// utiliser — en encre, toute couleur qu'il pose est remplacée par l'encre.
export function contour2D(ctx, dessin, { couleur, px } = CONTOUR_PERSO) {
  const encre = new Proxy(ctx, {
    get(c, k) { const v = c[k]; return typeof v === "function" ? v.bind(c) : v; },
    set(c, k, v) { c[k] = k === "fillStyle" || k === "strokeStyle" ? couleur : v; return true; },
  });
  const d = px * 0.71;
  for (const [dx, dy] of [[px, 0], [-px, 0], [0, px], [0, -px], [d, d], [-d, d], [d, -d], [-d, -d]]) {
    ctx.save(); ctx.translate(dx, dy); dessin(encre); ctx.restore();
  }
  dessin(ctx);
}
// Boîte englobante (u, v, h) de ce que dessine `fn(ctx)`, sans rien peindre :
// sert à vérifier qu'un modèle ne ment pas sur sa boîte de collision.
export function mesurerModele(fn) {
  const ops = [], faux = { globalAlpha: 1, save() {}, restore() {}, translate() {}, rotate() {}, scale() {} };
  groupeOps = ops;
  try { fn(faux); } finally { groupeOps = null; }
  const b = { u0: Infinity, u1: -Infinity, v0: Infinity, v1: -Infinity, h0: Infinity, h1: -Infinity };
  for (const o of ops) if (!o.sol) for (const k of ["u", "v", "h"]) { b[`${k}0`] = Math.min(b[`${k}0`], o[`${k}0`]); b[`${k}1`] = Math.max(b[`${k}1`], o[`${k}1`]); }
  return b;
}
function pousser(ctx, op) { op.a = ctx.globalAlpha; groupeOps.push(op); }
// Rectangle écran d'une opération (pour ne comparer que ce qui se recouvre).
function boiteEcran(op) {
  if (op.sol) return null;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const u of [op.u0, op.u1]) {
    const s = echelle(u);
    for (const v of [op.v0, op.v1]) { const x = W * 0.5 + (v - vCentre) * s; if (x < x0) x0 = x; if (x > x1) x1 = x; }
    for (const h of [op.h0, op.h1]) { const y = horizonY + (camH - h) * s; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, x1, y0, y1 };
}
// true : `a` se peint AVANT `b` ; false : après ; null : rien ne les sépare.
function avant(a, b) {
  const e = 1e-4;
  if (a.u0 >= b.u1 - e) return true;           // la caméra est côté u négatif
  if (b.u0 >= a.u1 - e) return false;
  if (a.v0 >= b.v1 - e) { if (b.v1 >= vCentre) return true; if (a.v0 <= vCentre) return false; }
  if (b.v0 >= a.v1 - e) { if (a.v1 >= vCentre) return false; if (b.v0 <= vCentre) return true; }
  if (a.h0 >= b.h1 - e) { if (camH >= a.h0) return false; if (camH <= b.h1) return true; }
  if (b.h0 >= a.h1 - e) { if (camH >= b.h0) return true; if (camH <= a.h1) return false; }
  return null;
}
function peindreGroupe(ctx, ops) {
  const alpha0 = ctx.globalAlpha;
  const jouer = (op) => { ctx.globalAlpha = op.a; op.f(); };
  const sols = ops.filter((o) => o.sol), pleins = ops.filter((o) => !o.sol);
  for (const o of sols) jouer(o);
  const cernes = pleins.filter((o) => o.contour);
  if (cernes.length) peindreContours(ctx, cernes);
  const n = pleins.length;
  const boites = pleins.map(boiteEcran);
  const entrants = new Array(n).fill(0), suivants = pleins.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const A = boites[i], B = boites[j];
      if (A.x1 <= B.x0 || B.x1 <= A.x0 || A.y1 <= B.y0 || B.y1 <= A.y0) continue;
      const r = avant(pleins[i], pleins[j]);
      if (r === true) { suivants[i].push(j); entrants[j] += 1; }
      else if (r === false) { suivants[j].push(i); entrants[i] += 1; }
    }
  }
  // Kahn : parmi les cubes libres, le plus au fond d'abord (puis l'ordre du code).
  const cle = (i) => -(pleins[i].u0 + pleins[i].u1);
  const fait = new Array(n).fill(false);
  for (let k = 0; k < n; k++) {
    let choix = -1;
    for (let i = 0; i < n; i++) if (!fait[i] && entrants[i] === 0 && (choix < 0 || cle(i) < cle(choix))) choix = i;
    if (choix < 0) for (let i = 0; i < n; i++) if (!fait[i] && (choix < 0 || cle(i) < cle(choix))) choix = i; // cycle : on tranche
    fait[choix] = true;
    for (const j of suivants[choix]) entrants[j] -= 1;
    jouer(pleins[choix]);
  }
  ctx.globalAlpha = alpha0;
}

// Cube : de (u, v) à (u + du, v + dv), de `lift` à `lift + h`. Faces vues :
// l'avant (u = u_min, toujours), le dessus (sous la caméra), et UN côté selon
// que le cube est à gauche ou à droite du centre de l'écran.
export function drawBox(ctx, u, v, du, dv, h, color, lift = 0) {
  lift += liftSol;
  if (groupeOps) { pousser(ctx, { u0: u, u1: u + du, v0: v, v1: v + dv, h0: lift, h1: lift + h, f: () => boxNu(ctx, u, v, du, dv, h, color, lift) }); return; }
  boxNu(ctx, u, v, du, dv, h, color, lift);
}
function boxNu(ctx, u, v, du, dv, h, color, lift) {
  const t = teintes(color, u);
  const h0 = lift, h1 = lift + h;
  const s = echelle(u), s2 = echelle(u + du);
  const x0 = W * 0.5 + (v - vCentre) * s, x1 = W * 0.5 + (v + dv - vCentre) * s;
  const y0 = horizonY + (camH - h0) * s, y1 = horizonY + (camH - h1) * s;
  if (v + dv < vCentre) {
    const xb = W * 0.5 + (v + dv - vCentre) * s2;
    poly(ctx, [{ x: x1, y: y0 }, { x: xb, y: horizonY + (camH - h0) * s2 }, { x: xb, y: horizonY + (camH - h1) * s2 }, { x: x1, y: y1 }], t.lumiere);
  } else if (v > vCentre) {
    const xb = W * 0.5 + (v - vCentre) * s2;
    poly(ctx, [{ x: x0, y: y0 }, { x: xb, y: horizonY + (camH - h0) * s2 }, { x: xb, y: horizonY + (camH - h1) * s2 }, { x: x0, y: y1 }], t.ombre);
  }
  if (h1 < camH) {
    const yb = horizonY + (camH - h1) * s2;
    poly(ctx, [{ x: x0, y: y1 }, { x: x1, y: y1 }, { x: W * 0.5 + (v + dv - vCentre) * s2, y: yb }, { x: W * 0.5 + (v - vCentre) * s2, y: yb }], t.dessus);
  } else if (h0 > camH) {
    const yb = horizonY + (camH - h0) * s2;
    poly(ctx, [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: W * 0.5 + (v + dv - vCentre) * s2, y: yb }, { x: W * 0.5 + (v - vCentre) * s2, y: yb }], t.ombre);
  }
  ctx.fillStyle = t.avant;
  ctx.fillRect(x0, y1, x1 - x0, y0 - y1);
}

// Boîte TOURNÉE autour de son axe vertical, centrée sur (cu, cv) : un vrai
// prisme à quatre arêtes, dont on peint les faces du fond vers l'avant. C'est
// ce qui manquait à la brique de lait (20 septembre 2026 : « les briques de
// lait, ça ne marche toujours pas en 3D, il faut que tu voies la logique ») —
// drawBox ne sait peindre qu'une boîte alignée sur les axes, donc réduire sa
// largeur au cosinus donnait une boîte écrasée, jamais une boîte qui tourne.
// Sert aussi au mouton qui fait un 360.
export function drawBoxR(ctx, cu, cv, du, dv, h, color, lift = 0, angle = 0) {
  lift += liftSol;
  const t = teintes(color, cu);
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const hu = du / 2, hv = dv / 2;
  // Les quatre coins, dans le plan (u, v).
  const coins = [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]].map(([a, b]) => ({
    u: cu + a * ca - b * sa,
    v: cv + a * sa + b * ca,
  }));
  const h0 = lift, h1 = lift + h;
  const pt = (c, hh) => { const s = echelle(c.u); return { x: W * 0.5 + (c.v - vCentre) * s, y: horizonY + (camH - hh) * s }; };
  // Faces verticales : on garde celles qui tournent le dos au fond, peintes
  // de la plus lointaine à la plus proche.
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const a = coins[i], b = coins[(i + 1) % 4];
    const milieuU = (a.u + b.u) / 2;
    // Normale sortante (le contour est dans le sens trigonométrique en (u, v)).
    const nu = b.v - a.v;
    if (nu >= 0) continue;                       // face qui regarde le fond
    faces.push({ d: milieuU, pts: [pt(a, h0), pt(b, h0), pt(b, h1), pt(a, h1)], col: i % 2 ? t.avant : t.lumiere });
  }
  faces.sort((x, y) => y.d - x.d);
  for (const f of faces) poly(ctx, f.pts, f.col);
  if (h1 < camH) poly(ctx, coins.map((c) => pt(c, h1)), t.dessus);
  else poly(ctx, coins.map((c) => pt(c, h0)), t.ombre);
}

export function drawFlat(ctx, u, v, du, dv, color, raw = false) {
  const h = liftSol;
  const f = () => poly(ctx, [projectAbs(u, v, h), projectAbs(u, v + dv, h), projectAbs(u + du, v + dv, h), projectAbs(u + du, v, h)], raw ? color : teintes(color, u).plat);
  if (groupeOps) { pousser(ctx, { sol: true, f }); return; }
  f();
}

// Ombre au sol : une ellipse douce, légèrement à gauche (soleil à droite).
export function drawShadow(ctx, u, v, ru, rv, alpha = 0.26) {
  const h = liftSol;
  if (groupeOps) { pousser(ctx, { sol: true, f: () => avecLift(h - liftSol, () => drawShadow(ctx, u, v, ru, rv, alpha)) }); return; }
  const a = projectAbs(u - ru, v - 0.1, h), b = projectAbs(u + ru, v - 0.1, h);
  const s = echelle(u);
  ctx.save();
  ctx.globalAlpha = alpha * (1 - night * 0.5);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(2, rv * s * 1.05), Math.max(1.5, (a.y - b.y) / 2), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Disque DEBOUT face à la caméra (roue vue de profil), centré en (u, v, h).
export function drawDisque(ctx, u, v, h, R, couleur) {
  h += liftSol;
  if (groupeOps) { pousser(ctx, { u0: u, u1: u + 0.002, v0: v - R, v1: v + R, h0: h - R, h1: h + R, f: () => disqueNu(ctx, u, v, h, R, couleur) }); return; }
  disqueNu(ctx, u, v, h, R, couleur);
}
function disqueNu(ctx, u, v, h, R, couleur) {
  const p = projectAbs(u, v, h), s = echelle(u);
  ctx.fillStyle = teintes(couleur, u).avant;
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(1, R * s), 0, Math.PI * 2);
  ctx.fill();
}

// --- Biomes ----------------------------------------------------------------------
function hash(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
// Biomes TRANCHÉS de 55 rangées (« comme Minecraft ») : même suite que la v1.
const ZONE_ROWS = 55;
// 20 septembre 2026 : « essaye de faire un village typique du nord de la
// France dans un des biomes premiers, et après un village typique du sud ».
// Le village du Nord arrive tôt (3e tranche), celui du Sud en fin de boucle.
const ZONES = ["ble", "prairie", "village", "tournesol", "foret", "vigne", "villageSud"];
// Zone imposée par le parcours (4 octobre 2026 : le biome MONTAGNE de la fin,
// posé par main.js à partir de rows.enMontagne).
let zoneForcee = () => null;
export function setZoneForcee(f) { zoneForcee = typeof f === "function" ? f : () => null; }
export function zoneAt(r) { return zoneForcee(r) || ZONES[Math.floor(Math.max(0, r) / ZONE_ROWS) % ZONES.length]; }
const SOIL = { ble: "#c9a648", prairie: "#7aa63c", tournesol: "#6f8c2f", foret: "#3f5a2a", vigne: "#8a6a45", village: "#8fa864", villageSud: "#b9a06a", montagne: "#e4e9ee", plage: "#ecd3a0" };
const HERBE = { ble: "#6f8f34", prairie: "#7aa63c", tournesol: "#66852f", foret: "#4a6a30", vigne: "#6f8f34", village: "#8fa864", villageSud: "#9aa86a", montagne: "#dfe5eb", plage: "#e6c993" };
// La route de la montagne est ENNEIGÉE (4 octobre 2026 : « il faudrait que la
// route soit un peu pleine de neige ») : neige tassée et deux ornières.
const NEIGE_ROUTE = "#dde3e9", ORNIERE = "#b9c2cc", BORD_NEIGE = "#cfd7df";
function routeNeige(r) { return zoneForcee(r) === "montagne"; }
// La PLAGE de fin (5 octobre 2026 : « tu peux finir avec plage, coucher de
// soleil : c'est la mer au fond et des palmiers. On est un peu comme Miami
// Beach ») : du sable jusqu'au rivage (u = RIVAGE), la mer au-delà.
function enPlage(r) { return zoneForcee(r) === "plage"; }
const RIVAGE = 7.25, SABLE_BORD = "#dcc08a";
function bordure(r) { return routeNeige(r) ? BORD_NEIGE : enPlage(r) ? SABLE_BORD : DIRT; }
const DIRT = "#9a7a4e";
const ROAD = "#55514d";
const LINE = "#f2ead8";
const MUD = "#5a3f22";
let dessinVoiture = null; // (ctx, u, v) → voiture garée, fourni par main.js
export function setDessinVoiture(f) { dessinVoiture = f; }
let villeJoueur = null; // nom saisi à l'inscription : le joueur traverse SA ville
export function setVille(nom) { villeJoueur = nom ? String(nom).toUpperCase().slice(0, 16) : null; }
export function villeDuJoueur() { return villeJoueur; }
export function estVillage(z) { return z === "village" || z === "villageSud"; }
export function debutVillage(r) { return estVillage(zoneAt(r)) && !estVillage(zoneAt(r - 1)); }

// Rangées dont un élément peut être à l'écran (le fond, tassé, en montre
// davantage que la route).
export function rowRange() {
  const R = (W * 0.5 + 60) / echelle(U_DECOR);
  return { from: Math.floor(vCentre - R), to: Math.ceil(vCentre + R) };
}
// Demi-largeur visible (en rangées) à la profondeur de la route.
export function demiLargeurRoute() { return (W * 0.5 + 30) / K; }

// --- Ciel, collines, sol -------------------------------------------------------------
const CIEL_HAUT = parseColor("#8fbbe0"), CIEL_HAUT_NUIT = parseColor("#070b22");
const CIEL_BAS = parseColor("#f6dcb4"), CIEL_BAS_NUIT = parseColor("#1c2448");
const rgbA = (c) => rgb(c[0], c[1], c[2]);

// Bande de sol entre deux profondeurs, découpée en trapèzes de même couleur.
function bande(ctx, uPresB, uLoinB, couleur) {
  const sP = echelle(uPresB), sL = echelle(uLoinB);
  const yP = horizonY + camH * sP, yL = horizonY + camH * sL;
  if (yL > H || yP < 0) return;
  const R = (W * 0.5 + 20) / Math.min(sP, sL);
  const r0 = Math.floor(vCentre - R), r1 = Math.ceil(vCentre + R);
  const trace = (ra, rb, col) => {
    const va = ra - 0.5, vb = rb + 0.52;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(W * 0.5 + (va - vCentre) * sL, yL - 0.4);
    ctx.lineTo(W * 0.5 + (vb - vCentre) * sL, yL - 0.4);
    ctx.lineTo(W * 0.5 + (vb - vCentre) * sP, yP + 0.4);
    ctx.lineTo(W * 0.5 + (va - vCentre) * sP, yP + 0.4);
    ctx.closePath();
    ctx.fill();
  };
  let debut = r0, c = couleur(r0);
  for (let r = r0 + 1; r <= r1; r++) {
    const cr = couleur(r);
    if (cr !== c) { if (c) trace(debut, r - 1, c); debut = r; c = cr; }
  }
  if (c) trace(debut, r1, c);
}

function collines(ctx, u, base, amp, couleur, graine) {
  const s = echelle(u);
  const yBase = ySol(u);
  ctx.fillStyle = couleur;
  ctx.beginPath();
  ctx.moveTo(-10, H);
  for (let x = -10; x <= W + 10; x += 6) {
    const v = vCentre + (x - W * 0.5) / s;
    const hh = base + amp * (0.55 + 0.28 * Math.sin(v * 0.045 + graine) + 0.17 * Math.sin(v * 0.13 + graine * 2.3));
    ctx.lineTo(x, Math.min(yBase, horizonY + (camH - hh) * s));
  }
  ctx.lineTo(W + 10, H);
  ctx.closePath();
  ctx.fill();
}

function montagnes(ctx, u) {
  const s = echelle(u);
  const pic = (v) => {
    const a = Math.abs(((v / 90) % 1 + 1) % 1 - 0.5) * 2;          // dents de scie
    const b = Math.abs(((v / 37 + 0.3) % 1 + 1) % 1 - 0.5) * 2;
    return 38 + 78 * (1 - a) * (0.6 + 0.4 * Math.sin(v * 0.011)) + 16 * (1 - b);
  };
  const pts = [];
  for (let x = -10; x <= W + 10; x += 5) pts.push([x, pic(vCentre + (x - W * 0.5) / s)]);
  const nuit = night;
  ctx.fillStyle = rgbA(melange(melange(parseColor("#8fa6c4"), HORIZON_JOUR, 0.35), parseColor("#141a38"), nuit));
  ctx.beginPath(); ctx.moveTo(-10, H);
  for (const [x, hh] of pts) ctx.lineTo(x, horizonY + (camH - hh) * s);
  ctx.lineTo(W + 10, H); ctx.closePath(); ctx.fill();
  // Neige : tout ce qui dépasse une altitude.
  ctx.fillStyle = rgbA(melange(parseColor("#f4f1ec"), parseColor("#3a4166"), nuit));
  ctx.beginPath();
  let dedans = false;
  const seuil = 100;
  for (const [x, hh] of pts) {
    const y = horizonY + (camH - Math.max(hh, seuil)) * s;
    if (!dedans) { ctx.moveTo(x, horizonY + (camH - seuil) * s); dedans = true; }
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 10, horizonY + (camH - seuil) * s);
  ctx.closePath(); ctx.fill();
}

// Montagnes PROCHES (biome montagne, 4 octobre 2026) : une chaîne rocheuse
// devant les Alpes lointaines, qui apparaît en fondu (setMontagne).
let montagneAlpha = 0;
export function setMontagne(a) { montagneAlpha = Math.max(0, Math.min(1, a)); }
let plageAlpha = 0;
export function setPlage(a) { plageAlpha = Math.max(0, Math.min(1, a)); }
// La mer du coucher de soleil : claire et rosée à l'horizon, plus profonde
// vers le rivage, des vagues en traits fins et le reflet du soleil en colonne.
function mer(ctx, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const y0 = horizonY, y1 = H;
  const g = ctx.createLinearGradient(0, y0, 0, ySol(RIVAGE));
  g.addColorStop(0, rgbA(melange(parseColor("#ffb37a"), HORIZON_NUIT, night * 0.5)));
  g.addColorStop(0.2, rgbA(melange(parseColor("#c4608e"), HORIZON_NUIT, night * 0.5)));
  g.addColorStop(1, rgbA(melange(parseColor("#3d3f8c"), HORIZON_NUIT, night * 0.5)));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, y1 - y0);
  // Vagues : des traits qui dérivent, plus serrés au loin.
  ctx.fillStyle = "rgba(255,236,214,0.35)";
  for (let i = 0; i < 14; i++) {
    const u = 18 + i * i * 2.2, s2 = echelle(u), y = horizonY + camH * s2;
    if (y > ySol(RIVAGE)) continue;
    const pas = 90 * s2 / K + 30, dec = ((decorT * 6 + i * 37) * s2) % pas;
    for (let x = -pas + dec; x < W + pas; x += pas) ctx.fillRect(x + hash(i * 3 + Math.floor(x / pas)) * 20, y, Math.max(6, 22 * s2 / K + 8), Math.max(1, s2 * 0.05));
  }
  // Reflet du soleil : une colonne dorée, large, qui scintille jusqu'au rivage.
  const { x: sx, R } = soleilPlage(plageAlpha);
  for (let i = 0; i < 16; i++) {
    const y = horizonY + 2 + i * i * 1.5;
    if (y > ySol(RIVAGE)) break;
    const w = (R * 1.6 + i * 7) * (0.55 + 0.45 * Math.sin(decorT * 3 + i * 1.7));
    ctx.fillStyle = `rgba(255,${206 - i * 4},${120 - i * 3},${0.8 - i * 0.04})`;
    ctx.fillRect(sx - w / 2, y, w, 2 + i * 0.35);
  }
  ctx.restore();
}
function montagnesProches(ctx) {
  const u = 170, s = echelle(u);
  const pic = (v) => {
    const a = Math.abs(((v / 52) % 1 + 1) % 1 - 0.5) * 2;
    const b = Math.abs(((v / 21 + 0.37) % 1 + 1) % 1 - 0.5) * 2;
    return 18 + 64 * (1 - a) * (0.7 + 0.3 * Math.sin(v * 0.017)) + 11 * (1 - b);
  };
  const pts = [];
  for (let x = -10; x <= W + 10; x += 5) pts.push([x, pic(vCentre * 0.6 + (x - W * 0.5) / s)]);
  ctx.fillStyle = rgbA(melange(parseColor("#6f7a86"), parseColor("#10142c"), night));
  ctx.beginPath(); ctx.moveTo(-10, H);
  for (const [x, hh] of pts) ctx.lineTo(x, horizonY + (camH - hh) * s);
  ctx.lineTo(W + 10, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgbA(melange(parseColor("#f4f1ec"), parseColor("#3a4166"), night));
  ctx.beginPath();
  const seuil = 62;
  ctx.moveTo(-10, horizonY + (camH - seuil) * s);
  for (const [x, hh] of pts) ctx.lineTo(x, horizonY + (camH - Math.max(hh, seuil)) * s);
  ctx.lineTo(W + 10, horizonY + (camH - seuil) * s);
  ctx.closePath(); ctx.fill();
}

// Deux joueurs de raquettes face à face le long de la plage ; la balle fait
// l'aller-retour en cloche, chacun lève sa raquette quand elle arrive.
function raquettesPlage(ctx, u, v, t, k) {
  const ECART = 3.4;
  const SLIPS = ["#e13e26", "#1f8fd6", "#f2c21c", "#ff5fa2"];
  const f = ((t * 0.5 + hash(k) * 3) % 1 + 1) % 1, aller = f < 0.5, p = aller ? f * 2 : (f - 0.5) * 2;
  const vA = v, vB = v + ECART;
  // Qui joue (humains.js) : souvent un parent et son enfant.
  const joueur = (vv, sens, slip, frappe, graine) => {
    const M = humain(graine), sy = M.taille, w = M.corpulence, PEAU = M.peau;
    drawBox(ctx, u, vv - 0.13 * w, 0.14, 0.11, 0.62 * sy, PEAU);
    drawBox(ctx, u, vv + 0.05 * w, 0.14, 0.11, 0.62 * sy, PEAU);
    drawBox(ctx, u - 0.02, vv - 0.15 * w, 0.18, 0.32 * w, 0.16 * sy, slip, 0.58 * sy);
    drawBox(ctx, u - 0.02, vv - 0.15 * w, 0.18, 0.32 * w, (M.femme ? 0.46 : 0.46) * sy, M.femme ? slip : PEAU, 0.74 * sy); // torse (maillot pour elle)
    drawBox(ctx, u, vv - 0.11, 0.16, 0.24, 0.24 * sy, PEAU, 1.2 * sy);                // tête
    if (M.coiffure === "afro") drawBox(ctx, u - 0.03, vv - 0.15, 0.22, 0.32, 0.14 * sy, M.cheveux, 1.36 * sy);
    else if (M.coiffure !== "chauve") drawBox(ctx, u - 0.01, vv - 0.12, 0.18, 0.26, 0.07, M.cheveux, 1.38 * sy); // cheveux
    drawBox(ctx, u - 0.04, vv - 0.05 + sens * 0.16, 0.08, 0.11, 0.3 * sy, PEAU, (0.86 + frappe * 0.34) * sy); // le bras qui frappe
  };
  // La balle arrive chez B pendant l'aller, chez A au retour : le bras se lève.
  const fA = !aller ? Math.max(0, p - 0.6) / 0.4 : Math.max(0, 0.25 - p) / 0.25;
  const fB = aller ? Math.max(0, p - 0.6) / 0.4 : Math.max(0, 0.25 - p) / 0.25;
  const gA = Math.abs(k) * 2 + 9000, gB = gA + 1, tA = humain(gA).taille, tB = humain(gB).taille;
  joueur(vA, 1, SLIPS[Math.abs(k) % 4], fA, gA);
  joueur(vB, -1, SLIPS[(Math.abs(k) + 1) % 4], fB, gB);
  // Raquettes (vues de face) et balle, peintes après les corps, à la hauteur
  // de chacun (un enfant tient la sienne plus bas).
  const raquette = (vv, sens, frappe, sy) => {
    const c = project(u - 0.06, vv + sens * 0.26, (1.28 + frappe * 0.36) * sy), sc = echelle(u);
    ctx.fillStyle = "#2f6fd0"; ctx.beginPath(); ctx.ellipse(c.x, c.y, 0.13 * sc, 0.16 * sc, 0, 0, Math.PI * 2); ctx.fill();
  };
  raquette(vA, 1, fA, tA); raquette(vB, -1, fB, tB);
  const vb = aller ? vA + 0.3 + (ECART - 0.6) * p : vB - 0.3 - (ECART - 0.6) * p;
  const hDepart = 1.45 * (aller ? tA : tB), hArrivee = 1.45 * (aller ? tB : tA);
  const b = project(u - 0.06, vb, hDepart + (hArrivee - hDepart) * p + 1.1 * Math.sin(Math.PI * p));
  ctx.fillStyle = "#f2e01c"; ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(1.5, 0.08 * echelle(u)), 0, Math.PI * 2); ctx.fill();
}

// Le soleil de la plage : posé sur la mer (la mer, peinte après, cache sa
// moitié basse), énorme, dégradé or → orange → rose, rayé dans le bas comme
// un coucher de soleil des années 80 — Miami, Vice City. Un grand halo
// chaud éclaire tout le ciel.
// En entrant sur la plage, le soleil DESCEND jusqu'à l'horizon et grossit
// (un seul soleil, qui glisse de sa place dans le ciel à sa place sur la mer).
export const SOLEIL_X = 0.64;
function soleilPlage(a) {
  const e = a * a * (3 - 2 * a);
  const R0 = K * 0.9, R1 = K * 2.3;
  const x0 = W * (0.08 + 0.84 * heure), y0 = horizonY * (1.02 - 0.86 * Math.sin(Math.PI * Math.max(0, Math.min(1, heure))));
  const x1 = W * SOLEIL_X, y1 = horizonY - R1 * 0.3;
  return { x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e, R: R0 + (R1 - R0) * e, e };
}
function soleilCouchant(ctx, a) {
  const { x, y, R, e } = soleilPlage(a);
  ctx.save();
  const halo = ctx.createRadialGradient(x, y, R * 0.4, x, y, W * (0.75 + 0.3 * e));
  halo.addColorStop(0, `rgba(255,226,150,${0.85 + 0.1 * e})`);
  halo.addColorStop(0.18, `rgba(255,160,96,${0.35 + 0.2 * e})`);
  halo.addColorStop(0.45, `rgba(255,96,120,${0.22 * e})`);
  halo.addColorStop(1, "rgba(120,60,160,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, horizonY + 4);
  // Le disque uni (le soleil d'avant) s'efface pendant que le disque rayé apparaît.
  if (e < 1) { ctx.globalAlpha = 1 - e; ctx.fillStyle = "rgba(255,200,130,1)"; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = e;
  const disque = ctx.createLinearGradient(0, y - R, 0, y + R);
  disque.addColorStop(0, "#fff1a8");
  disque.addColorStop(0.45, "#ffb347");
  disque.addColorStop(0.8, "#ff6a5a");
  disque.addColorStop(1, "#ff4f8a");
  // Les rayures : le disque n'est peint qu'ENTRE des bandes de ciel de plus en
  // plus épaisses vers le bas (découpe, le ciel déjà peint reste dessous).
  ctx.beginPath();
  let yc = y - R - 2;
  for (let i = 0; i < 5; i++) {
    const yb = y + R * (0.05 + i * 0.19), eb = R * (0.035 + i * 0.022);
    ctx.rect(x - R - 2, yc, 2 * R + 4, yb - yc);
    yc = yb + eb;
  }
  ctx.rect(x - R - 2, yc, 2 * R + 4, y + R + 2 - yc);
  ctx.clip();
  ctx.fillStyle = disque;
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function nuages(ctx) {
  const u = 380, s = echelle(u);
  ctx.save();
  ctx.globalAlpha = 0.85 * (1 - night * 0.7);
  const R = (W * 0.5 + 80) / s;
  for (let i = Math.floor((vCentre - R) / 150); i <= Math.ceil((vCentre + R) / 150); i++) {
    const vc = i * 150 + hash(i * 3.1) * 70, hc = 38 + hash(i * 5.7) * 26, lg = 60 + hash(i * 1.3) * 60;
    const p = project(u, vc, hc);
    const w = lg * s, h = Math.max(6, w * 0.18);
    ctx.fillStyle = night > 0.5 ? "#39406a" : plageAlpha > 0.3 ? "#ffc7a6" : "#fff7ea";
    ctx.fillRect(p.x, p.y, w, h);
    ctx.fillRect(p.x + w * 0.18, p.y - h * 0.7, w * 0.5, h * 0.8);
    ctx.fillStyle = night > 0.5 ? "#2c3358" : plageAlpha > 0.3 ? "#e8957a" : "#f1dcc6";
    ctx.fillRect(p.x, p.y + h * 0.7, w, h * 0.3);
  }
  ctx.restore();
}

export function renderGround(ctx, boueAt) {
  // Ciel.
  const hiv = poidsHiver() * 0.3, aut = poids("automne") * 0.25;
  let haut = melange(melange(melange(CIEL_HAUT, [176, 188, 204], hiv), [214, 170, 120], aut), CIEL_HAUT_NUIT, night);
  let bas = melange(melange(melange(CIEL_BAS, [226, 230, 236], hiv), [240, 196, 150], aut), CIEL_BAS_NUIT, night);
  // Coucher de soleil sur la plage (5 octobre 2026, intensifié : « il faut
  // vraiment que le soleil soit à l'horizon ») : indigo en haut, magenta,
  // corail, puis de l'or tout contre la mer.
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  if (plageAlpha > 0.01) {
    const p = plageAlpha;
    g.addColorStop(0, rgbA(melange(haut, [43, 29, 92], p)));
    g.addColorStop(0.45, rgbA(melange(melange(haut, bas, 0.55), [138, 63, 143], p)));
    g.addColorStop(0.78, rgbA(melange(melange(haut, bas, 0.85), [255, 111, 97], p)));
    g.addColorStop(1, rgbA(melange(bas, [255, 186, 92], p)));
  } else {
    g.addColorStop(0, rgbA(haut));
    g.addColorStop(0.6, rgbA(melange(haut, bas, 0.55)));
    g.addColorStop(1, rgbA(bas));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizonY + 4);
  // Le soleil traverse le ciel pendant la course : il se lève à gauche,
  // passe au plus haut vers la mi-course, se couche à droite ; la lune prend
  // le même chemin la nuit.
  const astre = (t, couleur, rayon, halo) => {
    const x = W * (0.08 + 0.84 * t), y = horizonY * (1.02 - 0.86 * Math.sin(Math.PI * Math.max(0, Math.min(1, t))));
    if (halo > 0) {
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, W * 0.75);
      g2.addColorStop(0, `rgba(255,222,160,${0.85 * halo})`);
      g2.addColorStop(0.3, `rgba(245,170,130,${0.35 * halo})`);
      g2.addColorStop(1, "rgba(160,150,210,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, horizonY + 4);
    }
    ctx.fillStyle = couleur;
    ctx.beginPath(); ctx.arc(x, y, rayon, 0, Math.PI * 2); ctx.fill();
  };
  if (plageAlpha > 0.01) soleilCouchant(ctx, plageAlpha);
  else if (night < 0.98) astre(heure, `rgba(255,236,190,${1 - night})`, K * 0.9, 1 - night);
  if (night > 0.3) {
    const a = Math.min(1, (night - 0.3) / 0.5);
    ctx.fillStyle = `rgba(255,255,255,${0.75 * a})`;
    for (let i = 0; i < 40; i++) ctx.fillRect(hash(i * 7.1) * W, hash(i * 3.3) * (horizonY - 30), 2, 2);
    astre(Math.max(0, heure - 0.55), `rgba(250,244,220,${a})`, K * 0.7, 0);
  }
  nuages(ctx);
  modeSaison = "sol";
  // Montagnes au loin (les villages du jeu sont en Isère : les Alpes en toile
  // de fond), neige sur les crêtes ; puis collines vertes, dans la brume.
  // (À la plage, montagnes et collines s'effacent : la mer va jusqu'à l'horizon.)
  ctx.save(); ctx.globalAlpha = 1 - plageAlpha;
  montagnes(ctx, 320);
  if (montagneAlpha > 0.01) { ctx.globalAlpha = (1 - plageAlpha) * montagneAlpha; montagnesProches(ctx); ctx.globalAlpha = 1 - plageAlpha; }
  collines(ctx, 150, 2, 26, teintes("#7c96a8", 14).plat, 1.7);
  collines(ctx, 62, 0.4, 9, teintes("#6d8c45", 12).plat, 4.1);
  ctx.restore();
  // Champs lointains, jusqu'à la zone de décor.
  ctx.fillStyle = teintes("#8d9a4c", 14).plat;
  ctx.fillRect(0, ySol(62) - 1, W, H - ySol(62) + 1);
  // La mer, de l'horizon au rivage : elle recouvre montagnes, collines et
  // champs lointains, et reflète le soleil couchant.
  if (plageAlpha > 0.01) mer(ctx, plageAlpha);
  // Dans la montagne, collines et champs lointains passent sous la neige (5
  // octobre 2026 : une bande jaune restait visible derrière les sapins).
  if (montagneAlpha > 0.01) {
    ctx.save(); ctx.globalAlpha = montagneAlpha;
    collines(ctx, 62, 0.4, 9, teintes("#dfe6ec", 12).plat, 4.1);
    ctx.fillStyle = teintes("#e3e9ee", 14).plat;
    ctx.fillRect(0, ySol(62) - 1, W, H - ySol(62) + 1);
    ctx.restore();
  }

  // Champs du fond, en sillons parallèles à la route (bandes de 1,25 u).
  const zSol = (r, u, k) => {
    if (enPlage(r) && u >= RIVAGE - 0.01) return teintes(k % 2 ? "#3d5a9c" : "#41609f", u).plat;
    const soil = SOIL[zoneAt(r)]; return teintes(k % 2 ? shadeHex(soil, -9) : soil, u).plat;
  };
  let k = 0;
  for (let u = U_DECOR; u > ROAD_HALF + 1.0; u -= 1.25, k++) {
    const u0 = Math.max(ROAD_HALF + 1.0, u - 1.25), kk = k;
    bande(ctx, u0, u, (r) => zSol(r, u0, kk));
  }
  // L'écume au rivage : elle avance et recule doucement.
  { const e = 0.18 + 0.14 * Math.sin(decorT * 1.3); bande(ctx, RIVAGE - e, RIVAGE + 0.12, (r) => (enPlage(r) ? teintes("#f6efe2", RIVAGE).plat : null)); }
  bande(ctx, ROAD_HALF + 0.22, ROAD_HALF + 1.0, (r) => teintes(HERBE[zoneAt(r)], 1).plat);
  bande(ctx, ROAD_HALF, ROAD_HALF + 0.22, (r) => teintes(bordure(r), 1).plat);
  // La route : asphalte et lignes de rive en tirets (repère de vitesse). Plus
  // de flaques de boue depuis le 20 septembre 2026 (« enlève les trucs de
  // terre par terre, les gens comprennent pas, je pense »).
  modeSaison = null;
  bande(ctx, -ROAD_HALF, ROAD_HALF, (r) => (routeNeige(r) ? teintes(r % 2 ? NEIGE_ROUTE : shadeHex(NEIGE_ROUTE, -3), 0).plat : teintes(r % 2 ? ROAD : shadeHex(ROAD, 3), 0).plat));
  const rive = (r) => (routeNeige(r) ? teintes(NEIGE_ROUTE, 0).plat : r % 3 === 0 ? teintes(ROAD, 0).plat : teintes(LINE, 0).plat);
  bande(ctx, ROAD_HALF - 0.2, ROAD_HALF - 0.12, rive);
  bande(ctx, -ROAD_HALF + 0.12, -ROAD_HALF + 0.2, rive);
  const orniere = (r) => (routeNeige(r) ? teintes(ORNIERE, 0).plat : teintes(r % 2 ? ROAD : shadeHex(ROAD, 3), 0).plat);
  bande(ctx, -0.58, -0.4, orniere);
  bande(ctx, 0.4, 0.58, orniere);
  modeSaison = "sol";
  bande(ctx, -ROAD_HALF - 0.22, -ROAD_HALF, (r) => teintes(bordure(r), 0).plat);
  bande(ctx, -ROAD_HALF - 1.3, -ROAD_HALF - 0.22, (r) => teintes(HERBE[zoneAt(r)], 0).plat);
  // Champ du premier plan, jusqu'au bas de l'écran : des sillons parallèles
  // à la route, bien marqués — la perspective les épaissit vers le bas.
  const uFin = uPres();
  k = 0;
  for (let u = -ROAD_HALF - 1.3; u > uFin; u -= 0.6, k++) {
    const u1 = Math.max(uFin, u - 0.6), kk = k;
    bande(ctx, u1, u, (r) => { const soil = SOIL[zoneAt(r)]; return teintes(kk % 2 ? shadeHex(soil, -7) : shadeHex(soil, 2), 0).plat; }); // sillons adoucis (3 octobre 2026)
  }
  modeSaison = null;
}

// Brume chaude du soleil par-dessus la scène (très légère).
export function renderHaze(ctx) {
  if (night > 0.9) return;
  const g = ctx.createLinearGradient(0, horizonY - 20, 0, horizonY + 60);
  g.addColorStop(0, "rgba(246,220,180,0)");
  g.addColorStop(0.45, `rgba(246,220,180,${0.22 * (1 - night)})`);
  g.addColorStop(1, "rgba(246,220,180,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, horizonY - 20, W, 80);
  // Plage : la lumière dorée du soleil couchant baigne toute la scène.
  if (plageAlpha > 0.01) {
    const sx = soleilPlage(plageAlpha).x;
    const l = ctx.createRadialGradient(sx, horizonY, 10, sx, horizonY, H * 0.9);
    l.addColorStop(0, `rgba(255,190,110,${0.32 * plageAlpha})`);
    l.addColorStop(0.5, `rgba(255,140,110,${0.12 * plageAlpha})`);
    l.addColorStop(1, "rgba(255,120,120,0)");
    ctx.fillStyle = l;
    ctx.fillRect(0, 0, W, H);
  }
}

function shadeHex(hex, a) {
  const [r, g, b] = parseColor(hex);
  const c = (x) => borne(x + a).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// --- Décor ------------------------------------------------------------------------
// rowDecor : éléments triables d'une rangée. Tout ce qui est haut vit DERRIÈRE
// la route (u > 0) : les deux côtés de la v1 sont repliés sur deux plans du
// fond (côté droit juste derrière, côté gauche plus loin). Le premier plan
// (u < 0) ne porte que du bas — herbes, fleurs, clôture — plafonné par
// hauteurMaxPremierPlan() : rien ne cache jamais la route.
// `clear` = rangée traversée par un tracteur ou une poule lancée : rien sur
// leur chemin.
// Masque posé par main.js (27 septembre 2026) : rangées où le mobilier de bord
// de route doit s'effacer. Bit 1 = pas de lampadaire (un panneau est là : « il
// y avait un panneau avec marqué Jules, il était caché derrière un lampadaire,
// on le voit pas ») ; bit 2 = une halle est là (lampadaires et poteaux
// passaient À TRAVERS son plancher et son toit).
let masque = () => 0;
export function setMasqueDecor(f) { masque = typeof f === "function" ? f : () => 0; }
export const SANS_LAMPE = 1, DANS_HALLE = 2, SANS_DECOR = 4, ETALS = 8;
function lampeIci(r) { return r % 12 === 3 && !(masque(r) & (SANS_LAMPE | DANS_HALLE)); }
function poteauIci(r) { return r % 5 === 0 && !(masque(r) & DANS_HALLE) && !(masque(r + 5) & DANS_HALLE); }

export function rowDecor(ctx, r, clear) {
  const out = [];
  // Le bowling est un INTÉRIEUR (4 octobre 2026 : « enlève les maisons
  // derrière ») : son mur du fond remplace tout le décor.
  if (masque(r) & SANS_DECOR) return out;
  const zone = zoneAt(r);
  const push = (u, v, draw) => out.push({ d: depth(u, v), draw: () => avecSaison("objet", draw) });
  const sway = (k) => Math.sin(decorT * 1.6 + k) * 0.05;
  if (zone === "plage") {
    // Palmiers le long de la route, parasols sur le sable, et de temps en
    // temps une cabane de sauveteur pastel (Miami Beach).
    if (r % 4 === 0) { const a = hash(r * 23 + 1), u = ROAD_HALF + 1.4 + a * 1.2, v = r - 0.3, k = r * 1.7; push(u, v, () => palmier(ctx, u, v, 6.2 + a * 2.4, Math.sin(decorT * 1.1 + k) * 0.12, hash(r * 5) < 0.5 ? -1 : 1)); }
    // Une partie de raquettes au bord de l'eau, tous les 37 rangs (5 octobre
    // 2026 : « qu'ils jouent avec des raquettes ») : pas de parasol dessus.
    const jeu = ((r % 37) + 37) % 37;
    if (jeu === 11) { const u = RIVAGE - 1.1, v = r; push(u, v, () => raquettesPlage(ctx, u, v, decorT, r)); }
    if (r % 4 === 2 && !(jeu >= 9 && jeu <= 15) && hash(r * 29 + 4) < 0.55) { const a = hash(r * 31 + 2), u = ROAD_HALF + 3.0 + a * 2.0, v = r; push(u, v, () => parasol(ctx, u, v, Math.floor(hash(r * 7 + 1) * 4))); }
    if (r % 41 === 17) { const u = ROAD_HALF + 3.2, v = r; push(u, v, () => cabaneSauveteur(ctx, u, v, Math.floor(hash(r) * 3))); }
    return out;
  }
  // Le MARCHÉ de plein air le long des halles (5 octobre 2026 : « des stands
  // comme s'ils étaient à Paris, des mecs qui vendent des courgettes, des
  // légumes, des pastèques ») : les étals remplacent le premier plan, les
  // maisons du fond restent.
  const marche = (masque(r) & ETALS) !== 0;
  // (Hors teinte de saison : en automne, la pastèque virait au marron.)
  if (marche && ((r % 5) + 5) % 5 === 0) { const u = ROAD_HALF + 1.4, v = r; out.push({ d: depth(u, v), draw: () => etalMarche(ctx, u, v, Math.floor(r / 5), decorT) }); }
  if (!clear) {
    for (const side of [1, -1]) {
      if (marche && side > 0) continue;
      const base = side > 0 ? ROAD_HALF + 1.2 : ROAD_HALF + 6.0;
      // Décor ALLÉGÉ (28 septembre 2026 : « simplifie les décors et la
      // complexité des choses ») : un seul élément semé par rangée, et
      // seulement juste derrière la route — le fond ne garde que ses arbres.
      // 29 septembre 2026 (« trop d'éléments à l'arrière-plan ») : encore
      // divisé par deux.
      const n = estVillage(zone) || side < 0 ? 0 : hash(r * 7 + 3) < 0.3 ? 1 : 0;
      if (estVillage(zone)) decorVillage(ctx, push, r, side, sway, zone === "villageSud");
      for (let i = 0; i < n; i++) {
        const a = hash(r * 31 + i * 7 + side * 101);
        const b = hash(r * 17 + i * 5 + side * 53);
        const u = base + a * 4.5;
        const v = r - 0.5 + b * 0.8;
        const k = r * 3.1 + i * 1.7 + side;
        if (zone === "ble") {
          const h = 0.55 + a * 0.35;
          push(u, v, () => { const sw = sway(k); drawBox(ctx, u, v, 0.28, 0.28, h, "#c9a23b"); drawBox(ctx, u, v + sw, 0.28, 0.28, 0.16, "#e8c65a", h); });
        } else if (zone === "tournesol") {
          push(u, v, () => { const sw = sway(k); drawBox(ctx, u + 0.1, v + 0.1, 0.1, 0.1, 0.9, "#4f7a2a"); drawBox(ctx, u - 0.05, v - 0.05 + sw, 0.24, 0.42, 0.42, "#f2c02c", 0.85); drawBox(ctx, u - 0.08, v + 0.08 + sw, 0.1, 0.18, 0.2, "#5a3a1a", 0.95); });
        } else if (zone === "vigne") {
          push(u, v, () => { const sw = sway(k); drawBox(ctx, u, v + 0.1, 0.1, 0.1, 0.8, "#6b4b2e"); drawBox(ctx, u - 0.1, v - 0.15 + sw, 0.35, 0.6, 0.4, "#3f7a2a", 0.55); });
        } else if (zone === "prairie") {
          const fl = a < 0.5 ? "#ffffff" : "#ffcf2e";
          push(u, v, () => { const sw = sway(k); drawBox(ctx, u + 0.05, v + 0.05, 0.06, 0.06, 0.3, "#4f7a2a"); drawBox(ctx, u, v + sw, 0.16, 0.16, 0.1, fl, 0.3); });
        } else if (zone === "foret") {
          const h = 5.0 + a * 4.0;
          push(u, v, () => arbre(ctx, u, v, h, sway(k)));
        } else if (zone === "montagne") {
          const t = 0.5 + a * 0.9;
          push(u, v, () => rocher(ctx, u, v, t));
        }
      }
      // Arbres ESPACÉS (29 septembre 2026 : l'ancien « une rangée sur deux »
      // faisait un mur de forêt derrière la route) : un tous les 5 près de
      // la route, un tous les 3 au fond.
      if ((side > 0 ? r % 5 === 0 : r % 3 === 1) && !estVillage(zone)) {
        const a = hash(r * 13 + side * 7);
        const u = (side > 0 ? ROAD_HALF + 6.6 : ROAD_HALF + 11.2) + a * 0.8, v = r - 0.4, k = r * 2.3 + side * 5;
        if (zone === "montagne") push(u, v, () => sapin(ctx, u, v, 6.5 + a * 3.5));
        else push(u, v, () => arbre(ctx, u, v, 5.5 + a * 3.0, sway(k) * 1.4));
      }
      // Montagne : une forêt de sapins plus serrée au fond.
      if (zone === "montagne" && side < 0 && r % 3 === 0) {
        const a = hash(r * 19 + 5), u = ROAD_HALF + 8.4 + a * 1.4, v = r + 0.6;
        push(u, v, () => sapin(ctx, u, v, 7 + a * 4));
      }
    }
    // Hiver et montagne (4 octobre 2026 : « rajoute des bonshommes de neige
    // sur le côté, dans le décor [...] tu peux mettre un sapin de Noël dans
    // le fond ») : de petits bonshommes près de la route, un sapin décoré au fond.
    if ((zone === "montagne" || poidsHiver() > 0.5) && !estVillage(zone)) {
      if (hash(r * 61 + 7) < 0.07) { const a = hash(r * 67 + 3), u = ROAD_HALF + 1.6 + a * 2.2, v = r - 0.3; push(u, v, () => bonhommeDecor(ctx, u, v, 0.55 + a * 0.25)); }
      if (r % 37 === 5) { const u = ROAD_HALF + 7.2, v = r; push(u, v, () => sapinNoel(ctx, u, v, 6.5)); }
    }
    // (Plus de bottes de foin sur le bas-côté : de profil, elles se
    // confondaient avec la botte-obstacle posée sur la route.) Des buissons
    // bas, ronds et verts, à la place.
    if (hash(r * 41 + 1) < 0.05 && zone !== "foret" && !estVillage(zone) && !marche) {
      const u = ROAD_HALF + 1.3, v = r - 0.25;
      push(u, v, () => { drawBox(ctx, u, v, 0.6, 0.7, 0.35, "#4f7f35"); drawBox(ctx, u + 0.1, v + 0.1, 0.4, 0.5, 0.18, "#5f9440", 0.35); });
    }
  }
  // Poteaux électriques (fils tendus jusqu'au suivant) et lampadaires, sur le
  // bas-côté du fond. Même sur une rangée traversée : ils sont hors du chemin.
  // Poteaux électriques (8 m, comme dans la vraie vie) et lampadaires (6,5 m) :
  // ils faisaient la taille du cycliste (20 septembre 2026, « je fais la même
  // taille qu'un lampadaire, il faudrait qu'ils soient plus grands »).
  if (false && poteauIci(r) && zone !== "foret") { // poteaux et fils retirés (décor allégé)
    const u = ROAD_HALF + 1.55, v = r - 0.05;
    push(u, v, () => {
      drawBox(ctx, u, v, 0.28, 0.28, POTEAU_H, "#5c4a3a");
      drawBox(ctx, u - 0.9, v + 0.02, 2.1, 0.18, 0.18, "#3a2e24", POTEAU_H - 0.5);
      drawBox(ctx, u - 0.65, v + 0.04, 1.6, 0.14, 0.14, "#3a2e24", POTEAU_H - 1.3);
      ctx.strokeStyle = night > 0.5 ? "rgba(20,20,30,0.75)" : "rgba(40,34,30,0.6)";
      ctx.lineWidth = 1.2;
      for (const [dh, du] of [[-0.42, -0.75], [-0.42, 0.75], [-1.22, -0.5], [-1.22, 0.5]]) {
        const a = project(u + du * 0.2, v + 0.1, POTEAU_H + dh), b = project(u + du * 0.2, v + 5.1, POTEAU_H + dh);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, a.y + K * 0.38, b.x, b.y); ctx.stroke();
      }
    });
  }
  if (lampeIci(r)) {
    const u = ROAD_HALF + 0.3, v = r - 0.1;
    push(u, v, () => {
      drawBox(ctx, u, v, 0.2, 0.2, LAMPE_H - 0.9, "#3a3a40");
      // Col de cygne : deux marches vers la route, larges le long de v pour
      // qu'on les VOIE (un bras qui part en profondeur est vu en bout).
      drawBox(ctx, u - 0.3, v - 0.02, 0.4, 0.3, 0.5, "#3a3a40", LAMPE_H - 0.9);
      drawBox(ctx, u - 0.75, v - 0.04, 0.5, 0.34, 0.4, "#3a3a40", LAMPE_H - 0.5);
      drawBox(ctx, u - 1.0, v - 0.22, 0.42, 0.72, 0.22, "#4a4a52", LAMPE_H - 0.3);
      drawBox(ctx, u - 0.98, v - 0.2, 0.38, 0.68, 0.1, night > 0.2 ? "#fff1b0" : "#d8d4c6", LAMPE_H - 0.4);
    });
  }
  // Premier plan : herbes, fleurs, épis, clôture — jamais plus haut que la route.
  // ⚠️ RETIRÉ le 3 octobre 2026 (« simplifier les éléments au premier plan,
  // pour qu'on arrive plus facilement à voir quand il y a quelque chose sur
  // la route ») : le champ du premier plan est désormais nu.
  const pres = hash(r * 57 + 3);
  for (let i = 0; i < 0; i++) {
    const a = hash(r * 23 + i * 11 + 5), b = hash(r * 29 + i * 3 + 9);
    const u = -(ROAD_HALF + 1.4 + a * 3.6), v = r - 0.5 + b;
    const s = echelle(u);
    if (Math.abs(v - vCentre) > (W * 0.5 + 40) / s) continue;
    const hmax = hauteurMaxPremierPlan(u) - 0.05;
    if (hmax < 0.1) continue;
    const k = r * 1.9 + i;
    if (zone === "ble" || (zone === "tournesol" && hmax < 1.1)) {
      const h = Math.min(hmax, 0.45 + a * 0.2);
      push(u, v, () => { const sw = sway(k); drawBox(ctx, u, v, 0.14, 0.14, h, "#c9a23b"); drawBox(ctx, u, v + sw, 0.14, 0.16, 0.14, "#e8c65a", Math.max(0, h - 0.14)); });
    } else if (zone === "tournesol") {
      const h = Math.min(hmax, 0.95);
      push(u, v, () => { const sw = sway(k); drawBox(ctx, u, v + 0.06, 0.08, 0.08, h - 0.3, "#4f7a2a"); drawBox(ctx, u - 0.06, v - 0.08 + sw, 0.16, 0.36, 0.36, "#f2c02c", h - 0.36); drawBox(ctx, u - 0.08, v + 0.04 + sw, 0.06, 0.12, 0.14, "#5a3a1a", h - 0.26); });
    } else {
      const h = Math.min(hmax, 0.12 + pres * 0.1);
      const fl = zone === "foret" ? "#3a7a33" : pres < 0.4 ? "#ffffff" : pres < 0.7 ? "#ffcf2e" : "#e13e26";
      push(u, v, () => { drawBox(ctx, u, v, 0.06, 0.06, h, zone === "vigne" ? "#6b4b2e" : "#4f7a2a"); if (zone !== "foret") drawBox(ctx, u - 0.02, v - 0.02, 0.1, 0.1, 0.07, fl, h); });
    }
  }
  // Clôture de bois du premier plan : un piquet toutes les deux rangées,
  // une lisse qui court jusqu'au suivant.
  if (false && r % 2 === 0 && !estVillage(zone)) { // clôture du premier plan retirée (29 septembre 2026)
    const u = -(ROAD_HALF + 3.4), v = r;
    const h = Math.min(0.62, hauteurMaxPremierPlan(u) - 0.04);
    if (h > 0.2) {
      push(u, v, () => {
        drawBox(ctx, u, v, 0.12, 0.12, h, "#7a5a3a");
        drawBox(ctx, u + 0.02, v + 0.12, 0.06, 1.9, 0.08, "#8a6a45", h * 0.62);
      });
    }
  }
  return out;
}

// Arbre : 1 unité ≈ 1 mètre ici aussi (un pommier de bord de route fait 5 à
// 9 m, pas 2). Le tronc porte deux étages de feuillage.
// Sapin (montagne) : un tronc, quatre étages qui rétrécissent, neige l'hiver.
// Toujours vert sapin : les saisons ne le repeignent pas (il a sa neige à lui).
function sapin(ctx, u, v, h) {
  avecSaison(null, () => {
    drawBox(ctx, u + 0.35, v + 0.35, 0.3, 0.3, h * 0.2, "#4a3828");
    const neige = poidsHiver() > 0.5;
    for (let i = 0; i < 4; i++) {
      const w = 2.2 - i * 0.48, base = h * (0.16 + i * 0.2);
      drawBox(ctx, u + 0.5 - w / 2, v + 0.5 - w / 2, w, w, h * 0.24, i % 2 ? "#24573a" : "#1f4d2c", base);
      if (neige) drawBox(ctx, u + 0.5 - w / 2 + 0.05, v + 0.5 - w / 2 + 0.05, w - 0.1, w - 0.1, 0.08, "#f2f0ea", base + h * 0.24);
    }
  });
}
// Petit bonhomme de neige du décor (échelle k) : trois boules, nez carotte
// vers le joueur (−v), écharpe rouge, chapeau noir.
function bonhommeDecor(ctx, u, v, k) {
  avecSaison(null, () => {
    drawBox(ctx, u, v, 1.1 * k, 1.1 * k, 0.75 * k, "#f4f7fa");
    drawBox(ctx, u + 0.15 * k, v + 0.15 * k, 0.8 * k, 0.8 * k, 0.6 * k, "#f4f7fa", 0.75 * k);
    drawBox(ctx, u + 0.13 * k, v + 0.13 * k, 0.84 * k, 0.84 * k, 0.12 * k, "#d33a2a", 1.3 * k);
    drawBox(ctx, u + 0.25 * k, v + 0.25 * k, 0.6 * k, 0.6 * k, 0.45 * k, "#f4f7fa", 1.42 * k);
    drawBox(ctx, u + 0.45 * k, v + 0.05 * k, 0.12 * k, 0.25 * k, 0.1 * k, "#f08a1c", 1.6 * k);
    drawBox(ctx, u + 0.18 * k, v + 0.18 * k, 0.74 * k, 0.74 * k, 0.05 * k, "#1a1a1e", 1.87 * k);
    drawBox(ctx, u + 0.32 * k, v + 0.32 * k, 0.46 * k, 0.46 * k, 0.32 * k, "#1a1a1e", 1.92 * k);
  });
}
// Sapin de Noël : le sapin, des boules de couleur et une étoile.
function sapinNoel(ctx, u, v, h) {
  sapin(ctx, u, v, h);
  avecSaison(null, () => {
    const boules = ["#e13e26", "#ffcf2e", "#3f63b4", "#f2f0ea"];
    for (let i = 0; i < 4; i++) {
      const w = 2.2 - i * 0.48, base = h * (0.16 + i * 0.2);
      for (let j = 0; j < 2; j++) drawBox(ctx, u + 0.5 - w / 2 - 0.08, v + 0.5 - w / 2 + (j + 0.3) * w * 0.45, 0.16, 0.16, 0.16, boules[(i + j) % 4], base + 0.08);
    }
    drawBox(ctx, u + 0.32, v + 0.32, 0.36, 0.36, 0.36, "#ffd84a", h * 0.97);
  });
}
// Palmier (la plage) : un tronc en anneaux qui se courbe, une couronne de
// palmes qui retombent, des noix de coco.
function palmier(ctx, u, v, h, sw, sens) {
  avecSaison(null, () => {
    const n = 8, dh = h / n;
    let dv = 0;
    for (let i = 0; i < n; i++) {
      const f = i / n; dv = sens * f * f * 1.2 + sw * f;
      const w = 0.34 - i * 0.015;
      drawBox(ctx, u + 0.5 - w / 2, v + 0.5 - w / 2 + dv, w, w, dh * 1.03, i % 2 ? "#8a6a45" : "#74563a", i * dh);
    }
    const cu = u + 0.5, cv = v + 0.5 + sens * 1.2 + sw;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.4, du = Math.cos(a) * 0.55, dvv = Math.sin(a);
      for (let j = 0; j < 3; j++) {
        const d = 0.35 + j * 0.55;
        drawBox(ctx, cu + du * d - 0.22, cv + dvv * d - 0.22 + sw * j * 0.6, 0.44, 0.44, 0.12, j === 2 ? "#3c9a4a" : "#2e8a3c", h - 0.1 - j * j * 0.22);
      }
    }
    drawBox(ctx, cu - 0.3, cv - 0.3, 0.6, 0.6, 0.2, "#2e8a3c", h - 0.05);
    for (const [a, b] of [[-0.25, 0.05], [0.05, -0.2], [0.1, 0.15]]) drawBox(ctx, cu + a - 0.1, cv + b - 0.1, 0.2, 0.2, 0.2, "#5a3a1a", h - 0.35);
  });
}
// Parasol rayé planté dans le sable, et sa serviette.
const PARASOLS = [["#e13e26", "#f6efe2"], ["#2fb3b0", "#f6efe2"], ["#ffcf2e", "#e8618c"], ["#3f63b4", "#ffcf2e"]];
function parasol(ctx, u, v, i) {
  avecSaison(null, () => {
    const [c1, c2] = PARASOLS[i % PARASOLS.length];
    drawFlat(ctx, u - 0.9, v - 0.1, 0.9, 1.6, c2 === "#f6efe2" ? c1 : c2);
    drawBox(ctx, u - 0.04, v - 0.04, 0.08, 0.08, 2.1, "#e9e3d6");
    drawBox(ctx, u - 0.9, v - 0.9, 1.8, 1.8, 0.1, c1, 2.0);
    drawBox(ctx, u - 0.55, v - 0.55, 1.1, 1.1, 0.1, c2, 2.1);
    drawBox(ctx, u - 0.2, v - 0.2, 0.4, 0.4, 0.1, c1, 2.2);
  });
}
// Cabane de sauveteur, pastel, sur pilotis (l'image de Miami Beach).
const CABANES = [["#f4a6b8", "#5ec4c0"], ["#5ec4c0", "#ffd45a"], ["#ffd45a", "#f4a6b8"]];
function cabaneSauveteur(ctx, u, v, i) {
  avecSaison(null, () => {
    const [mur, toit] = CABANES[i % CABANES.length];
    for (const [a, b] of [[0, 0], [1.6, 0], [0, 1.6], [1.6, 1.6]]) drawBox(ctx, u + a, v + b, 0.14, 0.14, 1.7, "#f1ece2");
    drawBox(ctx, u - 0.2, v - 0.2, 2.2, 2.2, 0.14, "#f1ece2", 1.7);
    drawBox(ctx, u + 0.1, v + 0.1, 1.6, 1.6, 1.15, mur, 1.84);
    drawBox(ctx, u + 0.09, v + 0.5, 1.62, 0.8, 0.5, "#2b3a4a", 2.3);
    drawBox(ctx, u + 0.08, v + 0.08, 1.64, 0.14, 1.15, "#ffffff", 1.84);
    drawBox(ctx, u - 0.15, v - 0.15, 2.1, 2.1, 0.16, toit, 2.99);
    drawBox(ctx, u + 0.85, v + 0.85, 0.06, 0.06, 0.9, "#f1ece2", 3.15);
    drawBox(ctx, u + 0.91, v + 0.6, 0.04, 0.32, 0.22, "#e13e26", 3.8);
    for (let k = 0; k < 5; k++) drawBox(ctx, u + 0.6, v - 0.35 - k * 0.32, 0.8, 0.3, 0.08, "#f1ece2", 1.6 - k * 0.32); // la rampe
  });
}
// Rocher : deux blocs gris décalés.
function rocher(ctx, u, v, t) {
  drawBox(ctx, u, v, 1.1 * t, 1.3 * t, 0.7 * t, "#8a8a86");
  drawBox(ctx, u + 0.25 * t, v + 0.2 * t, 0.7 * t, 0.8 * t, 0.45 * t, "#a2a29c", 0.7 * t);
}
function arbre(ctx, u, v, h, sw) {
  drawBox(ctx, u + 0.3, v + 0.3, 0.45, 0.45, h * 0.42, "#5c4a3a");
  // Printemps : un arbre sur deux en fleurs (rose, jamais « végétal », donc
  // la saison ne le repeint pas).
  const fleurs = poids("printemps") > 0.5 && hash(Math.round(u * 10) + Math.round(v * 3)) < 0.5;
  drawBox(ctx, u - 0.7, v - 0.7 + sw * 0.5, 2.4, 2.4, h * 0.42, fleurs ? "#e9a9bb" : "#2f6a2a", h * 0.34);
  drawBox(ctx, u - 0.2, v - 0.2 + sw, 1.5, 1.5, h * 0.34, fleurs ? "#f6cdd8" : "#3a7a33", h * 0.72);
}

// --- Le village : tout derrière la route, portes et fenêtres sur la façade
// qui regarde la caméra. Emplacements FIXES par rangée de la tranche (rz) :
// rien ne se marche dessus. Côté +1 = juste derrière la route, côté −1 = au
// fond (les deux rives de la v1).
// ⚠️ TOUT LE VILLAGE EST À L'ÉCHELLE DEPUIS LE 20 SEPTEMBRE 2026 (« on a un
// background avec des maisons, des voitures et des personnages : les
// perspectives, ça va pas du tout [...] j'ai des personnages beaucoup plus
// petits que des voitures »). Le bug n'était pas la projection, qui est juste,
// mais les MODÈLES : un villageois faisait 0,78 unité de haut et un étage de
// maison 1,0 — soit un bonhomme de 78 cm devant une maison de 1 m. Règle
// désormais : 1 unité ≈ 1 mètre, comme le cycliste (1,8 u).
const PERSO_H = 1.75, ETAGE_H = 2.9;
// La personne vient d'humains.js (4 octobre 2026, nuit) : peau, taille —
// enfants compris, c'est le décor —, carrure, cheveux.
function personnage(ctx, u, v, lift, haut, bas) {
  const M = humain(Math.round(v * 13 + u * 7) + 3000);
  const H = PERSO_H * M.taille, w = M.corpulence;
  const l = 0.42 * w;   // épaules
  drawBox(ctx, u, v, 0.3, l * 0.8, H * 0.46, bas, lift);                       // jambes
  drawBox(ctx, u - 0.05, v - 0.05, 0.4, l, H * 0.33, haut, lift + H * 0.46);   // buste
  teteVoxel(ctx, M, u + 0.02, v + 0.04, 0.3, 0.3, lift + H * 0.79, H * 0.21, { face: "camera" }); // tête
}
// Deux bourgs, deux régions. NORD : brique rouge, ardoise sombre, pignon à
// redents, encadrements blancs. SUD : enduit ocre, tuile romaine, volets,
// toits à faible pente. Même grammaire de cubes, deux palettes et deux toits.
const PALETTE_NORD = { murs: ["#a8503a", "#96452f", "#b35c44", "#8f4433"], toits: ["#5b6571", "#525b66", "#626c78", "#4d5661"], encadrement: "#f2ede2", pente: 0.9 };
const PALETTE_SUD  = { murs: ["#ead9b6", "#dfc79c", "#f0e2c4", "#d9bf94"], toits: ["#c9743a", "#b8632e", "#d68448", "#a85526"], encadrement: "#8fa86a", pente: 0.45 };
function maisonRegion(ctx, u, v, prof, larg, etages, P, k, balcon) {
  groupe(ctx, () => maisonNue(ctx, u, v, prof, larg, etages, P, k, balcon));
}
function maisonNue(ctx, u, v, prof, larg, etages, P, k, balcon) {
  const h = ETAGE_H * etages;
  const mur = P.murs[k % 4], toit = P.toits[(k + 1) % 4];
  drawBox(ctx, u, v, prof, larg, h, mur);
  // Porte et fenêtres, avec leur encadrement clair (c'est lui qui « dit » la région).
  drawBox(ctx, u - 0.07, v + larg * 0.28, 0.05, 1.05, 2.25, P.encadrement);
  drawBox(ctx, u - 0.09, v + larg * 0.3, 0.05, 0.95, 2.1, "#3a3a40");
  for (let e = 0; e < etages; e++) {
    for (const f of larg > 2.4 ? [0.12, 0.62] : [0.6]) {
      drawBox(ctx, u - 0.07, v + larg * f - 0.05, 0.05, 0.95, 1.25, P.encadrement, 1.1 + e * ETAGE_H);
      drawBox(ctx, u - 0.09, v + larg * f, 0.05, 0.85, 1.15, "#a8d8f0", 1.15 + e * ETAGE_H);
    }
  }
  if (balcon) {
    drawBox(ctx, u - 0.8, v + 0.2, 0.8, larg - 0.4, 0.14, "#6b4b2e", ETAGE_H);
    personnage(ctx, u - 0.55, v + larg * 0.42, ETAGE_H + 0.14, balcon, "#3a3e4e");
    drawBox(ctx, u - 0.82, v + 0.2, 0.08, larg - 0.4, 0.95, "#6b4b2e", ETAGE_H + 0.14);
  }
  if (P.pente > 0.7) {
    // NORD (refait le 28 septembre 2026) : pignon à redents CENTRÉ sur la
    // façade, face à la rue, et le toit d'ardoise derrière lui, faîtage
    // perpendiculaire à la route. L'ancien toit en marches parallèles à la
    // route passait AU-DESSUS de la caméra : on n'en voyait que des dessous
    // sombres qui flottaient, et le « pignon » était un escalier collé à
    // gauche de la maison.
    const marches = 4, hm = 0.62, retrait = larg / (2 * marches + 1);
    for (let e = 0; e < marches; e++) {
      const l = larg - 2 * e * retrait, vv = v + e * retrait;
      drawBox(ctx, u + 0.32, vv - 0.12, prof - 0.6, l + 0.24, hm, toit, h + e * hm);      // ardoise, derrière le pignon (sans le traverser)
      drawBox(ctx, u, vv, 0.3, l, hm, mur, h + e * hm);                                  // brique du pignon
      drawBox(ctx, u - 0.02, vv - 0.02, 0.34, l + 0.04, 0.08, P.encadrement, h + (e + 1) * hm - 0.08);
    }
    drawBox(ctx, u - 0.03, v + larg / 2 - 0.3, 0.05, 0.6, 0.7, "#3a3a40", h + 0.7);      // lucarne
  } else {
    // SUD : toit de tuiles bas, large débord, génoise sous l'avant-toit.
    drawBox(ctx, u - 0.55, v - 0.55, prof + 1.1, larg + 1.1, 0.22, "#c9a678", h);
    drawBox(ctx, u - 0.45, v - 0.45, prof + 0.9, larg + 0.9, 0.34, toit, h + 0.22);
    drawBox(ctx, u - 0.1, v - 0.1, prof + 0.2, larg + 0.2, 0.42, toit, h + 0.56);
  }
}
function decorVillage(ctx, push, r, side, sway, sud) {
  const rz = ((r % ZONE_ROWS) + ZONE_ROWS) % ZONE_ROWS;
  const pres = side > 0;
  const P = sud ? PALETTE_SUD : PALETTE_NORD;
  const k = r * 7 + (pres ? 0 : 3);
  // UNE MAISON SUR DEUX, une voiture sur deux, moins d'habitants (29 septembre
  // 2026 : « il y a beaucoup trop de choses [...] mets une maison sur deux »).
  if (rz % 12 === (pres ? 4 : 1) && rz !== 27 && rz !== 12) {
    const u = pres ? ROAD_HALF + 2.2 : ROAD_HALF + 8.0, v = r - 1.2;
    push(u, v, () => maisonRegion(ctx, u, v, 4.0, 3.2, 1, P, k, null));
  }
  if (rz % 8 === (pres ? 2 : 0)) {
    const u = pres ? ROAD_HALF + 15.0 : ROAD_HALF + 21.0, v = r - 1.8;
    push(u, v, () => maisonRegion(ctx, u, v, 5.0, 4.6, 2, P, k + 3, null));
  }
  if (rz % 14 === (pres ? 0 : 3)) {
    const u = pres ? ROAD_HALF + 6.2 : ROAD_HALF + 11.5, v = r - 1.5;
    const hab = ["#e13e26", "#ffcf2e", "#3f63b4", "#2f7a46"][k % 4];
    push(u, v, () => maisonRegion(ctx, u, v, 4.4, 4.0, 2, P, k + 2, hab));
  }
  // Le monument de la place : beffroi de brique au Nord, clocher-mur au Sud.
  if (!pres && rz === 27) {
    const u = ROAD_HALF + 6.5, v = r - 2.6;
    push(u, v, () => {
      if (sud) {
        drawBox(ctx, u, v, 5.0, 6.0, 6.0, P.murs[0]);
        drawBox(ctx, u - 0.5, v - 0.5, 6.0, 7.0, 0.4, P.toits[0], 6.0);
        drawBox(ctx, u + 1.0, v + 1.6, 2.6, 2.8, 4.0, P.murs[2], 6.4);          // clocher-mur
        drawBox(ctx, u + 1.0, v + 2.3, 2.6, 1.4, 2.2, "#3a3a40", 6.9);          // la baie
        drawBox(ctx, u + 2.1, v + 2.8, 0.3, 0.3, 1.2, "#3a3a40", 10.4);
      } else {
        drawBox(ctx, u, v, 5.2, 6.0, 7.0, P.murs[1]);
        drawBox(ctx, u - 0.3, v - 0.3, 5.8, 6.6, 0.5, P.toits[0], 7.0);
        drawBox(ctx, u + 1.4, v + 6.0, 2.4, 2.4, 15.0, P.murs[0]);              // beffroi
        for (let e = 1; e <= 4; e++) drawBox(ctx, u + 1.3, v + 5.9, 2.6, 2.6, 0.25, "#f2ede2", 2.6 * e);
        drawBox(ctx, u + 1.1, v + 5.7, 3.0, 3.0, 0.5, "#f2ede2", 15.0);
        drawBox(ctx, u + 1.45, v + 6.05, 2.3, 2.3, 2.4, P.toits[0], 15.5);
        drawBox(ctx, u + 2.45, v + 7.05, 0.3, 0.3, 1.4, "#e8c66a", 17.9);
      }
    });
  }
  // L'école, avec sa cour.
  if (pres && rz === 12) {
    const u = ROAD_HALF + 3.6, v = r - 3.5;
    push(u, v, () => {
      drawBox(ctx, u, v, 5.0, 8.0, 3.4, P.murs[2]);
      drawBox(ctx, u - 0.3, v - 0.3, 5.6, 8.6, 0.55, P.toits[1], 3.4);
      for (let i = 0; i < 4; i++) {
        drawBox(ctx, u - 0.07, v + 0.95 + i * 1.7, 0.05, 1.2, 1.4, P.encadrement, 1.05);
        drawBox(ctx, u - 0.09, v + 1.0 + i * 1.7, 0.05, 1.1, 1.3, "#a8d8f0", 1.1);
      }
    });
    for (let i = 0; i < 1; i++) {
      const pu = ROAD_HALF + 1.7 + (i % 2) * 0.8, pv = r - 2.2 + i * 1.4;
      push(pu, pv, () => personnage(ctx, pu, pv + Math.sin(decorT * 3 + i) * 0.15, 0, ["#e13e26", "#ffcf2e", "#3f63b4"][i], "#3a3e4e"));
    }
  }
  // Voitures garées : EXACTEMENT le modèle de la route (props.drawVoiture,
  // injecté par main.js — scene.js ne peut pas importer props.js, qui
  // l'importe). Le modèle simplifié d'ici avait des roues en cubes et une
  // vitre qui flottait (27 septembre 2026 : « dans le biome aux maisons
  // rouges, les voitures avaient un gros problème de modélisation »).
  // Voitures garées posées LOIN des maisons (30 septembre 2026 : « des voitures
  // qui passent derrière des maisons ») : à rz 1 la voiture chevauchait la
  // maison de rz 4 — même profondeur, le tri les mélangeait.
  if (pres && rz % 24 === 20 && dessinVoiture) {
    const cu = ROAD_HALF + 3.4, cv = r + 0.4;
    push(cu, cv, () => dessinVoiture(ctx, cu, cv));
  }
  if (false && pres && rz % 11 === 5) { // skateur retiré
    const su = ROAD_HALF + 1.6, sv = r - 0.3, k2 = r * 1.3;
    push(su, sv, () => { const roll = Math.sin(decorT * 2 + k2) * 0.4; drawBox(ctx, su, sv + roll, 0.4, 1.0, 0.1, "#e13e26", 0.16); personnage(ctx, su + 0.05, sv + 0.2 + roll, 0.26, "#ffcf2e", "#3a3e4e"); });
  }
  if (!pres && rz % 18 === 6) {
    const pu = ROAD_HALF + 2.0, pv = r - 0.4;
    push(pu, pv, () => personnage(ctx, pu, pv + sway(r) * 4, 0, ["#e13e26", "#3f63b4", "#2f7a46"][k % 3], "#3a3e4e"));
  }
}

// --- Les ÉTALS du marché (5 octobre 2026) -------------------------------------------
// Au sol, derrière la route, le long de la halle du marché : la caméra (3,6 u)
// les voit d'en haut, on lit donc les cagettes. Trois étals qui tournent :
// le primeur (courgettes, tomates, salades, aubergines, poireaux), le
// fruitier (oranges, bananes, pommes, fraises) et le roi de la pastèque.
// Gazon synthétique sur la table, bâche rayée au-dessus du marchand, paniers
// de fruits par terre, et le marchand qui harangue — bulle comprise.
const BACHES = [["#e13e26", "#f7f2e6"], ["#2f8a4a", "#f7f2e6"], ["#1f5fb8", "#f7f2e6"]];
const CRIS = ["4 € les belles courgettes !", "Elle est belle ma courgette !", "Allez, 2 € le kilo !", "Tu veux voir ma grosse courge ?", "Pastèque bien sucrée !", "Qui veut des tomates ?", "Elles sont belles mes courgettes !", "Goûtez-moi ça !", "Le kilo, 1 € !"];
function etalMarche(ctx, u, v, n, t) {
  const sorte = ((n % 3) + 3) % 3;
  const L = 3.5;                        // longueur de l'étal le long de la route
  const uT = u + 0.5, pT = 1.25, hT = 0.82; // la table : devant, profondeur, hauteur
  const uM = uT + pT + 0.25;            // le marchand, derrière la table
  const [c1, c2] = BACHES[sorte];
  // Bâche : mâts, puis la toile rayée (bandes ⟂ à la route) et son lambrequin.
  const uB = uT + 0.55, pB = 1.7, hB = 2.35;
  for (const dv of [0.05, L - 0.17]) drawBox(ctx, uB + pB - 0.1, v + dv, 0.08, 0.08, hB + 0.25, "#5c4326");
  // Le marchand (et parfois sa collègue) : tablier, marinière, béret ou casquette.
  const vendeurs = sorte === 1 ? [L * 0.3, L * 0.72] : [L * 0.5];
  vendeurs.forEach((dv, k) => {
    // La personne (humains.js, 4 octobre 2026, nuit) : peau, carrure, taille,
    // coiffure ; béret, casquette, ou tête nue.
    const M = humain(n * 2 + k + 7000, { enfants: false });
    const sy = M.taille, w = M.corpulence, chapeau = (n + k) % 3;
    const gest = Math.sin(t * 3.2 + n * 1.7 + k * 2.1);
    const vv = v + dv;
    drawBox(ctx, uM, vv - 0.17 * w, 0.26, 0.15 * w, 0.8 * sy, "#2a2f3e");                 // jambes
    drawBox(ctx, uM, vv + 0.04 * w, 0.26, 0.15 * w, 0.8 * sy, "#2a2f3e");
    drawBox(ctx, uM - 0.04, vv - 0.22 * w, 0.34, 0.44 * w, 0.62 * sy, "#f7f2e6", 0.8 * sy); // marinière
    for (let i = 0; i < 3; i++) drawBox(ctx, uM - 0.05, vv - 0.23 * w, 0.35, 0.46 * w, 0.07 * sy, "#1f3a78", (0.88 + i * 0.18) * sy);
    drawBox(ctx, uM - 0.08, vv - 0.2 * w, 0.06, 0.4 * w, 0.95 * sy, sorte === 2 ? "#7a3a1a" : "#2f6a3a", 0.42 * sy); // tablier
    teteVoxel(ctx, M, uM + 0.02, vv - 0.14, 0.26, 0.28, 1.42 * sy, 0.3 * sy, { chapeau: chapeau < 2, face: "camera" });
    if (chapeau === 0) drawBox(ctx, uM, vv - 0.16, 0.3, 0.32, 0.09, "#1a1a1e", 1.72 * sy);   // béret
    else if (chapeau === 1) drawBox(ctx, uM, vv - 0.16, 0.3, 0.32, 0.12, "#e13e26", 1.7 * sy); // casquette
    // Bras : l'un sur la hanche, l'autre qui harangue (levé, il s'agite).
    drawBox(ctx, uM + 0.06, vv + 0.22 * w, 0.14, 0.13, 0.5 * sy, "#f7f2e6", 0.92 * sy);
    drawBox(ctx, uM + 0.06, vv - 0.36 * w - 0.06 * gest, 0.14, 0.13, 0.5 * sy, "#f7f2e6", (1.2 + 0.08 * gest) * sy);
    drawBox(ctx, uM + 0.07, vv - 0.36 * w - 0.06 * gest, 0.12, 0.12, 0.12, M.peau, (1.7 + 0.08 * gest) * sy);
  });
  // La toile, par-dessus le marchand (la caméra la voit d'en haut).
  const nb = 7;
  for (let i = 0; i < nb; i++) drawBox(ctx, uB, v + (L * i) / nb, pB, L / nb, 0.06, i % 2 ? c2 : c1, hB);
  for (let i = 0; i < nb * 2; i++) drawBox(ctx, uB - 0.04, v + (L * i) / (nb * 2), 0.04, L / (nb * 2), 0.26, i % 2 ? c2 : c1, hB - 0.2); // lambrequin
  // La table : jupe de bois, plateau de gazon synthétique.
  drawBox(ctx, uT, v, pT, L, hT - 0.06, "#8a6a44");
  drawBox(ctx, uT - 0.03, v - 0.03, pT + 0.06, L + 0.06, 0.06, "#4f9a3a", hT - 0.06);
  // Les cagettes, deux rangs (le rang du fond un peu plus haut, sur des cales).
  const CAGETTE = "#d9b98a";
  const produits = [
    ["courgette", "tomate", "salade", "aubergine", "poireau", "tomate"],
    ["orange", "banane", "pomme", "fraise", "pommeVerte", "orange"],
    ["pasteque", "melon", "pastequeOuverte", "melon", "pasteque", "tomate"],
  ][sorte];
  const nC = 3, lC = (L - 0.3) / nC;
  for (const [rang, du, cale] of [[1, pT * 0.5, 0.12], [0, 0.06, 0]]) {
    for (let i = 0; i < nC; i++) {
      const cv = v + 0.15 + i * lC, cu = uT + du, h0 = hT + cale, pr = produits[rang * nC + i];
      if (cale) drawBox(ctx, cu, cv, pT * 0.44, lC - 0.08, cale, "#6b4b2e", hT);
      drawBox(ctx, cu, cv, pT * 0.44, lC - 0.08, 0.16, CAGETTE, h0);
      produit(ctx, pr, cu + 0.04, cv + 0.04, pT * 0.44 - 0.08, lC - 0.16, h0 + 0.16, n * 7 + i);
      // L'étiquette du prix, plantée devant.
      if (rang === 0) drawBox(ctx, cu - 0.02, cv + lC * 0.5 - 0.2, 0.02, 0.32, 0.2, "#ffffff", h0 + 0.12);
    }
  }
  // Par terre, devant : paniers de fruits, et une pile de pastèques chez le dernier.
  for (let i = 0; i < 2; i++) {
    const pv = v + 0.4 + i * (L - 1.3), pu = u;
    drawBox(ctx, pu, pv, 0.42, 0.55, 0.26, "#a8743a");
    drawBox(ctx, pu - 0.01, pv - 0.01, 0.44, 0.57, 0.04, "#7a5226", 0.22);
    produit(ctx, ["pomme", "orange", "fraise", "pommeVerte"][(n + i) % 4], pu + 0.03, pv + 0.04, 0.36, 0.47, 0.26, n * 3 + i);
  }
  if (sorte === 2) for (const [du, dv, h] of [[0, 1.45, 0], [0, 1.95, 0], [0.05, 1.7, 0.3]]) pasteque(ctx, u + du, v + dv, h);
  // Le cri du marchand : une bulle de temps en temps, à tour de rôle.
  const cycle = (t * 0.35 + n * 0.37) % 1;
  if (cycle < 0.45) {
    const p = project(uM, v + vendeurs[0], 2.35);
    const txt = CRIS[((n % CRIS.length) + CRIS.length) % CRIS.length];
    const sc = echelle(uM), taille = Math.max(8, Math.min(13, sc * 0.3));
    ctx.save();
    ctx.globalAlpha *= Math.min(1, cycle * 8, (0.45 - cycle) * 8);
    ctx.font = `800 ${taille}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const w = ctx.measureText(txt).width + 12, h = taille + 9;
    const x = Math.round(p.x - w * 0.3), y = Math.round(p.y - h - 6);
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#0d0d10"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 5) : ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.3 - 4, y + h); ctx.lineTo(x + w * 0.3 + 4, y + h); ctx.lineTo(x + w * 0.3 - 2, y + h + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0d0d10"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(txt, x + 6, y + h / 2 + 0.5);
    ctx.restore();
  }
}
// Une pastèque entière : un gros ovale vert foncé zébré.
function pasteque(ctx, u, v, h) {
  drawBox(ctx, u, v, 0.4, 0.5, 0.34, "#2f6a2a", h);
  for (const dv of [0.08, 0.22, 0.36]) drawBox(ctx, u - 0.005, v + dv, 0.41, 0.05, 0.345, "#1c4a1c", h);
  drawBox(ctx, u + 0.05, v + 0.06, 0.3, 0.38, 0.06, "#3f8a3a", h + 0.34);
}
// Le contenu d'une cagette (dessus visible d'en haut), en petits cubes.
function produit(ctx, sorte, u, v, du, dv, h, graine) {
  const g = (k) => hash(graine * 13 + k * 7);
  if (sorte === "pasteque") { pasteque(ctx, u, v + dv * 0.1, h - 0.1); return; }
  if (sorte === "pastequeOuverte") {
    // Une moitié de pastèque, chair rouge et pépins noirs vers le ciel.
    drawBox(ctx, u, v + 0.05, du, dv - 0.1, 0.12, "#2f6a2a", h);
    drawBox(ctx, u + 0.03, v + 0.08, du - 0.06, dv - 0.16, 0.04, "#f2f0d8", h + 0.12);
    drawBox(ctx, u + 0.05, v + 0.1, du - 0.1, dv - 0.2, 0.04, "#e8364a", h + 0.15);
    for (let k = 0; k < 6; k++) drawBox(ctx, u + 0.08 + g(k) * (du - 0.2), v + 0.14 + g(k + 9) * (dv - 0.3), 0.03, 0.04, 0.01, "#1a1a1e", h + 0.19);
    return;
  }
  if (sorte === "courgette" || sorte === "poireau" || sorte === "banane") {
    // Des légumes longs, couchés en travers de la cagette.
    const n = sorte === "banane" ? 4 : 5;
    for (let k = 0; k < n; k++) {
      const vv = v + (k + 0.15) * (dv / n);
      if (sorte === "poireau") { drawBox(ctx, u, vv, du * 0.55, dv / n * 0.7, 0.09, "#f2efe0", h); drawBox(ctx, u + du * 0.55, vv, du * 0.45, dv / n * 0.7, 0.1, "#3f8a3a", h); }
      else drawBox(ctx, u + g(k) * 0.05, vv, du - 0.05, dv / n * 0.75, 0.1, sorte === "banane" ? "#f2c21c" : (k % 2 ? "#2f6a2a" : "#3a7a30"), h);
    }
    return;
  }
  if (sorte === "melon") {
    for (let k = 0; k < 2; k++) drawBox(ctx, u + 0.02, v + 0.04 + k * dv * 0.5, du - 0.04, dv * 0.42, 0.22, "#d8c98a", h);
    return;
  }
  // Des fruits ronds en tas : un cube par fruit, deux étages.
  const COUL = { tomate: ["#e13e26", "#c8301c"], orange: ["#f28a1c", "#e8781a"], pomme: ["#d8352a", "#b82a22"], pommeVerte: ["#8ac43a", "#76b02e"], fraise: ["#e8283a", "#c81e2e"], salade: ["#8ac43a", "#a8d85a"], aubergine: ["#5a2a6a", "#4a1f5a"] }[sorte] || ["#e13e26", "#c8301c"];
  const t = sorte === "salade" ? 0.26 : sorte === "aubergine" ? 0.16 : sorte === "fraise" ? 0.1 : 0.14;
  const nu = Math.max(1, Math.floor(du / (t + 0.02))), nv = Math.max(1, Math.floor(dv / (t + 0.02)));
  for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) drawBox(ctx, u + a * (du / nu), v + b * (dv / nv), t, sorte === "aubergine" ? t * 1.6 : t, t, COUL[(a + b) % 2], h);
  for (let a = 0; a < nu - 1; a++) for (let b = 0; b < nv - 1; b++) if (g(a * 5 + b) < 0.6) drawBox(ctx, u + (a + 0.5) * (du / nu), v + (b + 0.5) * (dv / nv), t, t, t * 0.9, COUL[(a + b + 1) % 2], h + t * 0.9);
}

// --- Les HALLES DE MARCHÉ (20 septembre 2026) ---------------------------------------
// « Un bâtiment un peu comme des halles de marché typiques françaises, où il y
// a une rampe [...] on est au premier étage des halles. » Une rampe de bois
// monte depuis la route, un plancher file à HALLE_HAUT, une rampe redescend ;
// au-dessus, la charpente et le toit de tuiles sur des piliers de pierre.
//
// ⚠️ DEUX COUCHES depuis le 27 septembre 2026 (« attention aux perspectives au
// niveau des halles : il y a beaucoup de bugs de texture et de perspective
// entre ce qui est devant et ce qui est derrière »). La halle était UN seul
// objet peint derrière la route : le garde-corps et le flanc de la rampe, qui
// sont DEVANT le cycliste, passaient derrière lui, et les lampadaires du
// bas-côté traversaient le plancher. Désormais :
//   « fond »  — piliers, bandes du départ, tablier de la rampe (la surface où
//              l'on roule) : peints avant le cycliste ;
//   « devant » — flanc de la rampe, plancher, poteaux, garde-corps, fermes,
//              toit, enseigne : peints après lui.
// Le toit est monté assez haut pour qu'un double saut depuis le plancher ne
// le traverse jamais (tête à ~9,6 u au plus haut, sous-face à 10,05).
export const HALLE_TOIT_AU_DESSUS = 5.4;
// --- La gare et le bowling VIVENT (4 octobre 2026, nuit : « à la gare je veux
// un klaxon de train, au bowling un bruit de quilles ») -----------------------
// Le TER ENTRE EN GARE : il arrive DE DERRIÈRE le joueur, le double pendant
// qu'il monte la rampe, freine le long du quai et s'y arrête quand le joueur
// est au milieu du quai — on le voit filer ~2 s puis s'immobiliser (un train
// venu d'en face traversait l'écran en moins d'une seconde). Fonction de la
// position du JOUEUR (pas du temps) : le ralenti d'un tuto ou une pause ne le
// désynchronisent jamais, et ambiance.js en tire le son (klaxon, roulement,
// freins) par la même formule. `arret` : où est le joueur quand il s'arrête
// (rangs après le début de la halle) ; `approche` : sur combien de rangs du
// joueur il freine ; `elan` : son retard au départ (il attend, hors champ) ;
// `klaxon` : où est le joueur quand il klaxonne, de loin derrière.
// `corps` : la rame à l'arrêt (rangs depuis le début de la halle), le long du
// quai ; elle sort d'un TUNNEL au bout du quai (`tunnel`, voir la couche
// « train » de drawHalle) — jamais du vide.
export const TRAIN = { arret: 22, approche: 22, elan: 60, klaxon: -8, corps: [7.2, 39.2], tunnel: 6 };
export function decalageTrain(rDebut, vJoueur) {
  const s = Math.max(0, Math.min(1, (rDebut + TRAIN.arret - vJoueur) / TRAIN.approche));
  return -TRAIN.elan * s * s;
}
// Les pistes : une boule part toutes les ~2,4 s sur chacune, et les quilles
// TOMBENT quand elle arrive (QUILLES_IMPACT de son cycle), relevées au départ
// de la suivante. ambiance.js joue le fracas au même instant.
export const QUILLES_IMPACT = 0.72;
export function pistesBowling(v1, v2) {
  const out = [];
  for (let v = v1 + 0.6; v + 1.1 < v2 - 0.4; v += 1.6) out.push(v);
  return out;
}
export function phaseQuilles(t, v) { return ((t * 0.42 + v * 0.37) % 1 + 1) % 1; }
// Le clocher (ou le beffroi) de la place d'un village : rangée de son monument.
export function clocherA(r) { return ((r % ZONE_ROWS) + ZONE_ROWS) % ZONE_ROWS === 27 && estVillage(zoneAt(r)) && !(masque(r) & SANS_DECOR); }

export function drawHalle(ctx, rDebut, geo, rFrom = -Infinity, rTo = Infinity, couche = "fond") {
  const { haut, montee, plat, descente, total } = geo;
  const type = geo.type || "marche";
  const visible = (v0, v1) => v1 >= rFrom - 2 && v0 <= rTo + 2;
  const uG = -ROAD_HALF - 0.2, uD = ROAD_HALF + 0.2;
  // Palette par bâtiment (3 octobre 2026) : marché (bois, pierre, tuiles),
  // bowling (piste cirée, violet nuit, néons), gare (quai béton, acier vert,
  // marquise vitrée).
  const PAL = {
    marche: { BOIS: "#7a5632", BOIS_CLAIR: "#a9855a", PIERRE: "#ded3c0", TUILE: "#b8402c", POUTRE: "#5c4326", SOUS: "#4a3a2c", ENSEIGNE: "HALLES DU MARCHÉ", FOND: "#f7f2e6", ENCRE: "#0d0d10", CADRE: "#e13e26" },
    bowling: { BOIS: "#3a2f5a", BOIS_CLAIR: "#e3c48e", PIERRE: "#4a3d72", TUILE: "#2a2140", POUTRE: "#2a2140", SOUS: "#181226", ENSEIGNE: "BOWLING", FOND: "#2a2140", ENCRE: "#ff5fa8", CADRE: "#36e0e6" },
    gare: { BOIS: "#5c6a66", BOIS_CLAIR: "#c4beb2", PIERRE: "#4f6a5e", TUILE: "#a9cfe0", POUTRE: "#3f564c", SOUS: "#7fa3b5", ENSEIGNE: "GARE", FOND: "#1f3a78", ENCRE: "#ffffff", CADRE: "#ffffff" },
  }[type];
  const { BOIS, BOIS_CLAIR, PIERRE, TUILE, POUTRE } = PAL;
  const TOIT = haut + (geo.toit || HALLE_TOIT_AU_DESSUS);
  const v1 = rDebut + montee, v2 = rDebut + montee + plat, vFin = rDebut + total;
  // Rampe : le tablier (fond) et le flanc côté caméra (devant) se projettent
  // exactement, la pente est lisse.
  const rampes = [[rDebut, v1, 0, haut], [v2, vFin, haut, 0]];
  if (couche === "salle") {
    // L'INTÉRIEUR du bowling (4 octobre 2026 : « il faut vraiment que tu mettes
    // des pistes, enlève les maisons derrière, et que les quilles soient
    // beaucoup plus grosses ») : derrière la route, les pistes filent vers le
    // fond (la perspective les fait converger), des quilles en bout de piste,
    // un mur violet à néons qui cache tout le décor (scene.SANS_DECOR).
    const uW = ROAD_HALF + 6.2, a0 = rDebut - 0.5, a1 = vFin + 0.5, t = geo.t || 0;
    if (!visible(a0, a1)) return;
    drawBox(ctx, uD, a0, uW - uD, a1 - a0, haut - 0.04, "#2a2140");                 // socle sous les pistes
    drawBox(ctx, uW, a0, 0.4, a1 - a0, TOIT + 0.5 - haut, "#3a2f5a", haut);         // mur du fond
    poly(ctx, [project(uD, a0, haut), project(uW, a0, haut), project(uW, a1, haut), project(uD, a1, haut)], teintes("#181226", 0).plat); // gouttières
    const LARGE = 1.1;
    for (const v of pistesBowling(v1, v2)) {
      if (!visible(v - 1, v + 2)) continue;
      poly(ctx, [project(uD, v, haut + 0.01), project(uW - 0.1, v, haut + 0.01), project(uW - 0.1, v + LARGE, haut + 0.01), project(uD, v + LARGE, haut + 0.01)], teintes("#e3c48e", 0).plat);
      for (const du of [1.4, 2.0]) poly(ctx, [project(uD + du, v + 0.5, haut + 0.02), project(uD + du + 0.25, v + 0.55, haut + 0.02), project(uD + du, v + 0.6, haut + 0.02)], "#ff5fa8"); // flèches de visée
      // Quilles en bout de piste : GROSSES (1,8 u), une derrière, deux devant.
      // Debout tant que la boule roule ; couchées (après un petit envol) dès
      // qu'elle les percute — c'est le moment du fracas (ambiance.js).
      const k = phaseQuilles(t, v);
      if (k < QUILLES_IMPACT) {
        for (const [du, dv] of [[0.4, 0.34], [0.95, 0.08], [0.95, 0.6]]) {
          const u = uW - 0.15 - du, vv = v + dv;
          drawBox(ctx, u, vv, 0.44, 0.44, 1.1, "#f7f2e6", haut);
          drawBox(ctx, u + 0.07, vv + 0.07, 0.3, 0.3, 0.45, "#f7f2e6", haut + 1.1);
          drawBox(ctx, u - 0.005, vv - 0.005, 0.45, 0.45, 0.13, "#e13e26", haut + 0.82);
          drawBox(ctx, u + 0.04, vv + 0.04, 0.36, 0.36, 0.26, "#f7f2e6", haut + 1.55);
        }
        // Une boule qui roule vers les quilles (peinte APRÈS elles : elle est devant).
        const ub = uD + 0.4 + (k / QUILLES_IMPACT) * (uW - uD - 1.9);
        drawDisque(ctx, ub, v + LARGE / 2, haut + 0.26, 0.26, ["#ff5fa8", "#36e0e6", "#ffcf2e"][Math.abs(Math.round(v * 3)) % 3]);
      } else {
        const vol = Math.max(0, 1 - (k - QUILLES_IMPACT) / 0.06) * 0.7;
        const a = uW - 1.35;
        drawBox(ctx, a + 0.15, v - 0.05, 0.4, 1.15, 0.36, "#f7f2e6", haut + vol);              // couchée en travers
        drawBox(ctx, a + 0.16, v + 0.35, 0.38, 0.14, 0.37, "#e13e26", haut + vol);
        drawBox(ctx, a - 0.25, v + 0.62, 1.15, 0.4, 0.36, "#f7f2e6", haut + vol * 0.6);        // couchée vers le fond
        drawBox(ctx, a + 0.35, v + 0.6, 0.14, 0.42, 0.37, "#e13e26", haut + vol * 0.6);
        drawBox(ctx, a + 0.75, v + 0.15, 0.4, 0.4, 0.36, "#f7f2e6", haut + vol * 1.3);         // la tête d'une troisième
      }
    }
    // Néons sur le mur, et une quille géante en néon tous les ~10 rangs.
    for (const [hh, col] of [[haut + 2.4, "#ff5fa8"], [haut + 2.7, "#36e0e6"]]) drawBox(ctx, uW - 0.06, a0, 0.06, a1 - a0, 0.07, col, hh);
    ctx.save();
    ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.strokeStyle = "#ff5fa8";
    for (let v = v1 + 4; v < v2 - 2; v += 10) {
      if (!visible(v - 2, v + 2)) continue;
      const P = (dv, h) => project(uW - 0.05, v + dv, haut + 3.2 + h);
      const contour = [[0, 0], [-0.35, 0.3], [-0.45, 1.0], [-0.22, 1.6], [-0.18, 1.9], [-0.28, 2.3], [0, 2.6], [0.28, 2.3], [0.18, 1.9], [0.22, 1.6], [0.45, 1.0], [0.35, 0.3]];
      ctx.beginPath(); contour.forEach(([dv, h], k) => { const p = P(dv, h); if (k) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
    drawBox(ctx, uD, a0, uW - uD, a1 - a0, 0.3, "#181226", TOIT + 0.2);           // plafond
    return;
  }
  if (couche === "estrade") {
    // Le marché EN HAUT, sur le plancher des halles (5 octobre 2026 : « il
    // faut qu'ils soient en haut de l'estrade, en hauteur, logique, parce
    // qu'on est dans les halles ») : le plancher se prolonge derrière la
    // route, porté par des poteaux, et les étals s'y alignent entre les
    // piliers. (Ceux d'en bas, sous le pont, restent.)
    const uE = uD, pE = 3.7;
    if (!visible(v1, v2)) return;
    for (let i = 0; i <= plat; i += 6) { const v = v1 + Math.min(i, plat - 0.3); if (visible(v, v + 0.3)) drawBox(ctx, uE + pE - 0.4, v, 0.3, 0.3, haut - 0.42, POUTRE); }
    drawBox(ctx, uE, v1, pE, plat, 0.42, BOIS, haut - 0.42);
    drawBox(ctx, uE, v1, pE, plat, 0.03, BOIS_CLAIR, haut);
    avecLift(haut, () => {
      for (let i = 0; i + 6 <= total; i += 6) {
        const v = rDebut + i + 1.25;
        if (v < v1 + 0.3 || v + 3.5 > v2 - 0.3 || !visible(v - 1, v + 4.5)) continue;
        etalMarche(ctx, uE + 0.15, v, i / 6 + 101, decorT);
      }
    });
    return;
  }
  if (couche === "train") {
    // Rails derrière la gare, et un TER à quai, au niveau du plancher. Ils
    // sortent d'un tunnel au bout du quai (a0) et filent au-delà de la halle.
    const uR = ROAD_HALF + 1.6, a0 = rDebut + TRAIN.tunnel, a1 = vFin + 8;
    drawBox(ctx, uR - 0.2, a0, 2.4, a1 - a0, haut - 0.05, "#8a8478");              // remblai
    for (let v = Math.ceil(a0); v < a1; v += 1) if (visible(v, v + 0.3)) drawBox(ctx, uR, v, 2.0, 0.3, 0.06, "#6b4b2e", haut - 0.05); // traverses
    for (const du of [0.35, 1.55]) drawBox(ctx, uR + du, a0, 0.1, a1 - a0, 0.1, "#b8bcc4", haut);   // rails
    // ⚠️ Le TER ne sort que du TUNNEL (4 octobre 2026, nuit : « le train
    // apparaissait un peu dans le vide, au milieu de nulle part, avant même que
    // j'arrive dans la gare ») : il arrivait de derrière à hauteur de quai, au
    // bord gauche de l'écran, pendant qu'on montait la rampe — là où il n'y a
    // pas encore de quai, rien sous lui. Il sort maintenant d'un tunnel au bout
    // du quai : on ne dessine que la partie sortie (de a0 à a1).
    const dv = geo.trainDv || 0;
    const t0 = rDebut + TRAIN.corps[0] + dv, t1 = rDebut + TRAIN.corps[1] + dv, H = haut + 0.25;
    const tv0 = Math.max(a0 + 1, t0), tv1 = Math.min(a1, t1);
    if (tv1 - tv0 > 0.3 && visible(tv0, tv1)) {
      drawBox(ctx, uR + 0.1, tv0, 1.8, tv1 - tv0, 2.4, "#e8e6e0", H);                // caisse
      drawBox(ctx, uR + 0.08, tv0, 1.84, tv1 - tv0, 0.35, "#1f3a78", H + 0.25);      // bas de caisse bleu
      drawBox(ctx, uR + 0.07, tv0, 1.86, tv1 - tv0, 0.08, "#21b3c6", H + 0.62);      // filet turquoise
      if (tv1 - tv0 > 0.9) drawBox(ctx, uR + 0.06, tv0 + 0.4, 1.88, tv1 - tv0 - 0.8, 0.7, "#2a3442", H + 1.1); // vitres
      for (let v = t0 + 1.6; v < t1 - 1; v += 4.2) if (v >= tv0 && v + 0.7 <= tv1) drawBox(ctx, uR + 0.05, v, 0.1, 0.7, 1.75, "#c8301c", H + 0.25); // portes (côté quai)
      drawBox(ctx, uR + 0.1, tv0, 1.8, tv1 - tv0, 0.2, "#b8bcc4", H + 2.4);          // toit
      // Les deux nez : pare-brise sombre et phares (il ENTRE en gare : on le
      // voit arriver) — seulement s'ils sont sur les rails.
      for (const vc of [t0 >= a0 + 1 ? t0 - 0.05 : null, t1 <= a1 ? t1 : null]) {
        if (vc === null) continue;
        drawBox(ctx, uR + 0.25, vc, 1.5, 0.05, 0.75, "#2a3442", H + 1.15);
        for (const du of [0.3, 1.48]) drawBox(ctx, uR + du, vc - 0.01, 0.22, 0.07, 0.16, "#fff3b0", H + 0.5);
      }
    }
    // Le tunnel : un mur de pierre au bout du quai, haut comme la halle, et sa
    // bouche sombre d'où sort la rame.
    if (visible(a0 - 1, a0 + 1.5)) {
      drawBox(ctx, uR - 0.35, a0, 2.7, 1.0, TOIT + 0.4, PIERRE);
      drawBox(ctx, uR - 0.45, a0 - 0.1, 2.9, 1.2, 0.35, POUTRE, TOIT + 0.4);
      drawBox(ctx, uR + 0.05, a0 + 0.99, 1.9, 0.03, 2.95, "#14161c", haut - 0.05);
    }
    return;
  }
  if (couche === "fond") {
    if (visible(rDebut - 1.3, rDebut + 0.4)) {
      drawBox(ctx, uG, rDebut - 0.55, uD - uG, 0.5, 0.02, type === "bowling" ? "#ff5fa8" : type === "gare" ? "#ffcf2e" : "#e13e26", 0);
      drawBox(ctx, uG, rDebut - 1.15, uD - uG, 0.5, 0.02, "#f7f2e6", 0);
    }
    // Piliers de pierre, DERRIÈRE la route : ils portent le toit.
    for (let i = 0; i <= total; i += 6) {
      const v = rDebut + i;
      if (!visible(v, v + 0.8)) continue;
      drawBox(ctx, ROAD_HALF + 0.5, v, 0.8, 0.8, TOIT, PIERRE);
      drawBox(ctx, ROAD_HALF + 0.35, v - 0.1, 1.1, 1.0, 0.45, PIERRE, TOIT);
    }
    for (const [a, b, h0, h1] of rampes) {
      if (!visible(Math.min(a, b), Math.max(a, b))) continue;
      poly(ctx, [project(uG, a, h0), project(uG, b, h1), project(uD, b, h1), project(uD, a, h0)], teintes(BOIS_CLAIR, 0).dessus);
      // Lattes en travers : c'est elles qui disent « on monte ».
      ctx.strokeStyle = teintes(BOIS, 0).avant; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 1; k < Math.abs(b - a); k++) {
        const v = a + k * Math.sign(b - a), hh = h0 + (h1 - h0) * (k / Math.abs(b - a));
        const p = project(uG, v, hh), q = project(uD, v, hh);
        ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
    return;
  }
  // --- Couche « devant ».
  for (const [a, b, h0, h1] of rampes) {
    if (!visible(Math.min(a, b), Math.max(a, b))) continue;
    const A = project(uG, a, 0), B = project(uG, b, 0), A2 = project(uG, a, h0), B2 = project(uG, b, h1);
    poly(ctx, [A, B, B2, A2], teintes(BOIS, uG).avant);
    poly(ctx, [A2, B2, project(uG - 0.1, b, h1 - 0.12), project(uG - 0.1, a, h0 - 0.12)], teintes("#c49a68", uG).plat);
  }
  // Le plancher, porté par des poteaux de bois côté caméra.
  drawBox(ctx, uG, v1, uD - uG, plat, 0.42, BOIS, haut - 0.42);
  if (type === "bowling") {
    // La piste cirée sur le plancher, gouttières sombres de part et d'autre.
    drawBox(ctx, uG + 0.3, v1, uD - uG - 0.6, plat, 0.02, BOIS_CLAIR, haut);
    for (const u of [uG + 0.1, uD - 0.3]) drawBox(ctx, u, v1, 0.2, plat, 0.02, "#181226", haut);
    for (let v = v1 + 2; v < v2; v += 4) drawBox(ctx, -0.15, v, 0.3, 0.12, 0.03, "#ff5fa8", haut); // flèches de visée
  } else if (type === "gare") {
    // Quai : bande d'éveil jaune côté voies.
    drawBox(ctx, uD - 0.45, v1, 0.18, plat, 0.02, "#ffcf2e", haut);
  }
  if (haut > 1) for (let i = 0; i <= plat; i += 6) {
    const v = v1 + Math.min(i, plat - 0.3);
    if (visible(v, v + 0.3)) drawBox(ctx, uG + 0.05, v, 0.3, 0.3, haut - 0.42, POUTRE);
  }
  // Garde-corps : des montants et une lisse, ajourés (on voit le cycliste à travers).
  if (haut > 1) {
    for (let i = 0; i <= plat; i += 2) {
      const v = v1 + i;
      if (visible(v, v + 0.2)) drawBox(ctx, uG - 0.16, v, 0.12, 0.12, 0.8, POUTRE, haut);
    }
    drawBox(ctx, uG - 0.18, v1, 0.16, plat, 0.1, POUTRE, haut + 0.72);
  }
  // Charpente : les fermes en travers, puis le toit (masse, rive épaisse).
  for (let i = 0; i <= total; i += 6) {
    const v = rDebut + i;
    if (visible(v, v + 0.8)) drawBox(ctx, -ROAD_HALF - 0.4, v + 0.15, ROAD_HALF * 2 + 0.9, 0.4, 0.35, POUTRE, TOIT + 0.1);
  }
  // Le toit. La caméra est SOUS lui : on n'en voit que la sous-face et la
  // rive. Une seule masse de tuiles (plus deux boîtes superposées qui se
  // peignaient dans le mauvais ordre), une sous-face de voliges sombre juste
  // dessous, et un débord côté caméra limité à 0,5 u (à 1 u, la rive mangeait
  // le tiers haut de l'écran).
  const uT = -ROAD_HALF - 0.5, lT = ROAD_HALF * 2 + 1.9;
  drawBox(ctx, uT, rDebut - 0.5, lT, total + 1.0, 0.55, TUILE, TOIT + 0.5);
  drawBox(ctx, uT + 0.02, rDebut - 0.45, lT - 0.04, total + 0.9, 0.05, PAL.SOUS, TOIT + 0.45);
  // L'ENSEIGNE, suspendue sous la rive à l'entrée (remplace le bandeau
  // « LES HALLES ! » qui s'affichait par-dessus le jeu).
  const vE = rDebut + 3.2, lE = 6.2, hE = 1.15, basE = TOIT - 1.05;
  if (visible(vE - lE / 2, vE + lE / 2)) {
    const uE = uT - 0.05;
    for (const dv of [-lE / 2 + 0.5, lE / 2 - 0.6]) drawBox(ctx, uE + 0.02, vE + dv, 0.06, 0.1, TOIT + 0.45 - basE - hE, "#3a3a40", basE + hE);
    drawBox(ctx, uE, vE - lE / 2, 0.1, lE, hE, PAL.FOND, basE);
    const A = project(uE, vE - lE / 2, basE + hE), B = project(uE, vE + lE / 2, basE);
    const m = (B.y - A.y) * 0.1;
    ctx.strokeStyle = PAL.CADRE; ctx.lineWidth = Math.max(1.5, m * 0.6);
    ctx.strokeRect(A.x + m, A.y + m, B.x - A.x - 2 * m, B.y - A.y - 2 * m);
    ctx.fillStyle = PAL.ENCRE;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let taille = (B.y - A.y) * 0.5;
    ctx.font = `900 ${taille}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const txt = PAL.ENSEIGNE;
    while (ctx.measureText(txt).width > (B.x - A.x) * 0.84 && taille > 5) { taille -= 1; ctx.font = `900 ${taille}px "Helvetica Neue", Helvetica, Arial, sans-serif`; }
    ctx.fillText(txt, (A.x + B.x) / 2, (A.y + B.y) / 2 + 1);
  }
}

// Bosse de montagne (4 octobre 2026) : la chaussée monte et redescend. Deux
// couches comme la halle : « dessus » (la route, peinte avant le cycliste) et
// « flanc » (le talus côté caméra, peint après lui).
// Trois couches depuis les collines de 6,5 u (4 octobre 2026, deuxième passe) :
// « dos » (le terrain derrière la route, soulevé jusqu'au fond du décor, où se
// posent les sapins — mêmes sillons que les champs : aucune couture au pied),
// « dessus » (la chaussée enneigée) et « flanc » (le versant côté caméra, qui
// redescend jusqu'au sol — ou jusqu'en bas de l'écran).
// Chaque bande est UN polygone qui suit la colline (points tous les 0,5 rang).
const PENTE_VERSANT = 1.2; // le versant avant recule de 1,2 u par unité de hauteur
export function drawBosse(ctx, d, geo, rFrom = -Infinity, rTo = Infinity, couche = "dessus") {
  const { long, sol } = geo;
  const uG = -ROAD_HALF, uD = ROAD_HALF;
  const a0 = Math.max(d - 0.5, rFrom - 2), a1 = Math.min(d + long + 0.5, rTo + 2);
  if (a1 - a0 < 0.1) return;
  const vs = [];
  for (let v = a0; v < a1; v += 0.5) vs.push(v);
  vs.push(a1);
  const hs = vs.map(sol);
  const bande = (u0, u1, col, dh = 0) => {
    const pts = [];
    for (let i = 0; i < vs.length; i++) pts.push(project(u0, vs[i], hs[i] + dh));
    for (let i = vs.length - 1; i >= 0; i--) pts.push(project(u1, vs[i], hs[i] + dh));
    poly(ctx, pts, col);
  };
  if (couche === "dos") {
    avecSaison("sol", () => {
      const soil = SOIL.montagne;
      // Au loin, le plateau continue en neige unie (la caméra monte avec la
      // colline et verrait sinon par-dessus son bord, jusqu'aux champs).
      bande(U_DECOR, 70, teintes("#e3e9ee", 14).plat);
      let k = 0;
      for (let u = U_DECOR; u > ROAD_HALF + 1.0; u -= 1.25, k++) {
        const u0 = Math.max(ROAD_HALF + 1.0, u - 1.25);
        bande(u0, u, teintes(k % 2 ? shadeHex(soil, -9) : soil, u0).plat);
      }
      bande(ROAD_HALF + 0.22, ROAD_HALF + 1.0, teintes(HERBE.montagne, 1).plat);
      bande(ROAD_HALF, ROAD_HALF + 0.22, teintes(BORD_NEIGE, 1).plat);
    });
  } else if (couche === "dessus") {
    bande(uG, uD, teintes(NEIGE_ROUTE, 0).plat);
    // Une rangée sur deux un ton plus sombre, comme sur le plat (repère de vitesse).
    const sombre = teintes(shadeHex(NEIGE_ROUTE, -3), 0).plat;
    for (let r = Math.round(a0); r <= Math.round(a1); r++) {
      if (r % 2) continue;
      const va = Math.max(a0, r - 0.5), vb = Math.min(a1, r + 0.5);
      if (vb <= va) continue;
      poly(ctx, [project(uG, va, sol(va)), project(uG, vb, sol(vb)), project(uD, vb, sol(vb)), project(uD, va, sol(va))], sombre);
    }
    for (const [u0, u1] of [[-0.58, -0.4], [0.4, 0.58]]) bande(u0, u1, teintes(ORNIERE, 0).plat, 0.003);
  } else {
    // Le bord haut suit le bord de la chaussée — ou son AXE quand la route
    // passe au-dessus de l'œil de la caméra (on la voit alors par en
    // dessous) : les roues posent toujours pile sur l'arête.
    const s = echelle(uG);
    const haut = vs.map((v, i) => { const p = project(uG, v, hs[i]), q = project(0, v, hs[i]); return { x: p.x, y: Math.max(p.y, q.y) }; });
    const pied = vs.map((v, i) => ({ x: haut[i].x, y: Math.min(H + 4, project(uG - hs[i] * PENTE_VERSANT, v, 0).y) }));
    const ruban = (f0, f1, col) => {
      const y = (i, f) => (f < 1 ? haut[i].y + f * s * Math.min(1, hs[i] / 0.6) : haut[i].y + (pied[i].y - haut[i].y) * (f - 1));
      const pts = [];
      for (let i = 0; i < vs.length; i++) pts.push({ x: haut[i].x, y: y(i, f0) });
      for (let i = vs.length - 1; i >= 0; i--) pts.push({ x: haut[i].x, y: y(i, f1) });
      poly(ctx, pts, col);
    };
    avecSaison("sol", () => {
      // Le versant : la neige du champ du premier plan (même teinte moyenne).
      ruban(0, 2, teintes(shadeHex(SOIL.montagne, -2), 0).plat);
      // Des courbes de niveau (hauteur constante sur le versant) : elles
      // naissent sous la crête quand la route monte, comme des terrasses.
      ctx.save();
      ctx.strokeStyle = teintes(shadeHex(SOIL.montagne, -16), 0).plat;
      ctx.lineWidth = Math.max(1, s * 0.07);
      ctx.lineJoin = "round";
      for (const hc of [1.3, 2.7, 4.1, 5.5]) {
        ctx.beginPath();
        let dedans = false;
        for (let i = 0; i < vs.length; i++) {
          if (hs[i] <= hc + 0.05) { dedans = false; continue; }
          const p = project(uG - (hs[i] - hc) * PENTE_VERSANT, vs[i], hc);
          if (dedans) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); dedans = true; }
        }
        ctx.stroke();
      }
      ctx.restore();
      ruban(0, 0.42, teintes("#c9d2dc", 0).plat);
      ruban(0, 0.3, teintes("#f6f8fa", 0).plat);
    });
  }
}

// Lampadaires visibles (halos peints par-dessus la nuit, main.js).
export function lampsIn(from, to) {
  const out = [];
  for (let r = from; r <= to; r++) if (lampeIci(r)) out.push({ u: ROAD_HALF - 0.2, v: r, h: LAMPE_H - 0.2 });
  return out;
}

// Panneau de village sur le bas-côté du fond : deux poteaux, une plaque rouge,
// le nom écrit sur la face qui regarde la caméra (un rectangle à l'écran).
export function drawSign(ctx, r, village) {
  const [nom] = village;   // le département ne sert à rien (20 septembre 2026)
  const u = ROAD_HALF + 0.55, v = r;
  // +50 % le 4 octobre 2026, nuit (« il faut que les panneaux de commune
  // soient 50 % plus gros ») : 2,3 × 0,85 → 3,45 × 1,28, poteaux plus hauts.
  const w = 3.45, hb = 1.28, base = 1.5;
  drawBox(ctx, u, v - w / 2 + 0.3, 0.15, 0.15, base, "#8a8d98");
  drawBox(ctx, u, v + w / 2 - 0.45, 0.15, 0.15, base, "#8a8d98");
  drawBox(ctx, u - 0.05, v - w / 2, 0.1, w, hb, "#e13e26", base);
  const A = project(u - 0.05, v - w / 2, base + hb), B = project(u - 0.05, v + w / 2, base);
  const s = echelle(u - 0.05), m = 0.08 * s;
  ctx.fillStyle = teintes("#f7f2e6", u).plat;
  ctx.fillRect(A.x + m, A.y + m, B.x - A.x - 2 * m, B.y - A.y - 2 * m);
  ctx.fillStyle = "#0d0d10";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const cx = (A.x + B.x) / 2, hh = B.y - A.y;
  let taille = s * 0.5;
  ctx.font = `900 ${taille}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  while (ctx.measureText(nom).width > (B.x - A.x) - 4 * m && taille > 5) { taille -= 1; ctx.font = `900 ${taille}px "Helvetica Neue", Helvetica, Arial, sans-serif`; }
  ctx.fillText(nom, cx, A.y + hh * 0.5);
}
