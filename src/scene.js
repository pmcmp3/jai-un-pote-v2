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

let W = 375, H = 812, K = 26;
let camD = 11, camH = 3.6;
let camV = 0, vCentre = 0, joueurX = 0.28;
let horizonY = 430;
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
  camH = cfg("cameraHauteur", 3.6);
  horizonY = H * cfg("solEcran", 0.64) - camH * K;
  majCentre();
}
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
export function project(u, v, h = 0) {
  const s = echelle(u);
  return { x: W * 0.5 + (v - vCentre) * s, y: horizonY + (camH - h) * s };
}
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
  const kn = Math.round(night * 10);
  const cle = `${color}|${kb}|${kn}`;
  let t = cache.get(cle);
  if (t) return t;
  let [r, g, b] = parseColor(color);
  if (kn > 0) { const a = 8 * kn; r -= a; g -= a * 0.95; b -= a * 0.5; }
  const hz = melange(HORIZON_JOUR, HORIZON_NUIT, kn / 10);
  const f = kb * 0.07;
  r += (hz[0] - r) * f; g += (hz[1] - g) * f; b += (hz[2] - b) * f;
  t = { plat: rgb(r, g, b), avant: rgb(r - 6, g - 6, b - 6), dessus: rgb(r + 26, g + 26, b + 22), lumiere: rgb(r + 6, g + 6, b + 4), ombre: rgb(r - 30, g - 30, b - 26) };
  if (cache.size > 6000) cache.clear();
  cache.set(cle, t);
  return t;
}
export function teinte(color, u = 0) { return teintes(color, u).plat; }

function poly(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

// Cube : de (u, v) à (u + du, v + dv), de `lift` à `lift + h`. Faces vues :
// l'avant (u = u_min, toujours), le dessus (sous la caméra), et UN côté selon
// que le cube est à gauche ou à droite du centre de l'écran.
export function drawBox(ctx, u, v, du, dv, h, color, lift = 0) {
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
  }
  ctx.fillStyle = t.avant;
  ctx.fillRect(x0, y1, x1 - x0, y0 - y1);
}

export function drawFlat(ctx, u, v, du, dv, color, raw = false) {
  poly(ctx, [project(u, v), project(u, v + dv), project(u + du, v + dv), project(u + du, v)], raw ? color : teintes(color, u).plat);
}

// Ombre au sol : une ellipse douce, légèrement à gauche (soleil à droite).
export function drawShadow(ctx, u, v, ru, rv, alpha = 0.26) {
  const a = project(u - ru, v - 0.1, 0), b = project(u + ru, v - 0.1, 0);
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
  const p = project(u, v, h), s = echelle(u);
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
const ZONES = ["ble", "prairie", "tournesol", "village", "foret", "vigne"];
export function zoneAt(r) { return ZONES[Math.floor(Math.max(0, r) / ZONE_ROWS) % ZONES.length]; }
const SOIL = { ble: "#c9a648", prairie: "#7aa63c", tournesol: "#6f8c2f", foret: "#3f5a2a", vigne: "#8a6a45", village: "#8fa864" };
const HERBE = { ble: "#6f8f34", prairie: "#7aa63c", tournesol: "#66852f", foret: "#4a6a30", vigne: "#6f8f34", village: "#8fa864" };
const DIRT = "#9a7a4e";
const ROAD = "#55514d";
const LINE = "#f2ead8";
const MUD = "#5a3f22";
let villeJoueur = null; // nom saisi à l'inscription : le joueur traverse SA ville
export function setVille(nom) { villeJoueur = nom ? String(nom).toUpperCase().slice(0, 16) : null; }
export function villeDuJoueur() { return villeJoueur; }
export function debutVillage(r) { return zoneAt(r) === "village" && zoneAt(r - 1) !== "village"; }

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
    if (cr !== c) { trace(debut, r - 1, c); debut = r; c = cr; }
  }
  trace(debut, r1, c);
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

function nuages(ctx) {
  const u = 380, s = echelle(u);
  ctx.save();
  ctx.globalAlpha = 0.85 * (1 - night * 0.7);
  const R = (W * 0.5 + 80) / s;
  for (let i = Math.floor((vCentre - R) / 150); i <= Math.ceil((vCentre + R) / 150); i++) {
    const vc = i * 150 + hash(i * 3.1) * 70, hc = 38 + hash(i * 5.7) * 26, lg = 60 + hash(i * 1.3) * 60;
    const p = project(u, vc, hc);
    const w = lg * s, h = Math.max(6, w * 0.18);
    ctx.fillStyle = night > 0.5 ? "#39406a" : "#fff7ea";
    ctx.fillRect(p.x, p.y, w, h);
    ctx.fillRect(p.x + w * 0.18, p.y - h * 0.7, w * 0.5, h * 0.8);
    ctx.fillStyle = night > 0.5 ? "#2c3358" : "#f1dcc6";
    ctx.fillRect(p.x, p.y + h * 0.7, w, h * 0.3);
  }
  ctx.restore();
}

export function renderGround(ctx, boueAt) {
  // Ciel.
  const haut = melange(CIEL_HAUT, CIEL_HAUT_NUIT, night), bas = melange(CIEL_BAS, CIEL_BAS_NUIT, night);
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, rgbA(haut));
  g.addColorStop(0.6, rgbA(melange(haut, bas, 0.55)));
  g.addColorStop(1, rgbA(bas));
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
  if (night < 0.98) astre(heure, `rgba(255,236,190,${1 - night})`, K * 0.9, 1 - night);
  if (night > 0.3) {
    const a = Math.min(1, (night - 0.3) / 0.5);
    ctx.fillStyle = `rgba(255,255,255,${0.75 * a})`;
    for (let i = 0; i < 40; i++) ctx.fillRect(hash(i * 7.1) * W, hash(i * 3.3) * (horizonY - 30), 2, 2);
    astre(Math.max(0, heure - 0.55), `rgba(250,244,220,${a})`, K * 0.7, 0);
  }
  nuages(ctx);
  // Montagnes au loin (les villages du jeu sont en Isère : les Alpes en toile
  // de fond), neige sur les crêtes ; puis collines vertes, dans la brume.
  montagnes(ctx, 320);
  collines(ctx, 150, 2, 26, teintes("#7c96a8", 14).plat, 1.7);
  collines(ctx, 62, 0.4, 9, teintes("#6d8c45", 12).plat, 4.1);
  // Champs lointains, jusqu'à la zone de décor.
  ctx.fillStyle = teintes("#8d9a4c", 14).plat;
  ctx.fillRect(0, ySol(62) - 1, W, H - ySol(62) + 1);

  // Champs du fond, en sillons parallèles à la route (bandes de 1,25 u).
  const zSol = (r, u, k) => { const soil = SOIL[zoneAt(r)]; return teintes(k % 2 ? shadeHex(soil, -9) : soil, u).plat; };
  let k = 0;
  for (let u = U_DECOR; u > ROAD_HALF + 1.0; u -= 1.25, k++) {
    const u0 = Math.max(ROAD_HALF + 1.0, u - 1.25), kk = k;
    bande(ctx, u0, u, (r) => zSol(r, u0, kk));
  }
  bande(ctx, ROAD_HALF + 0.22, ROAD_HALF + 1.0, (r) => teintes(HERBE[zoneAt(r)], 1).plat);
  bande(ctx, ROAD_HALF, ROAD_HALF + 0.22, () => teintes(DIRT, 1).plat);
  // La route : asphalte, boue, lignes de rive en tirets (repère de vitesse).
  bande(ctx, -ROAD_HALF, ROAD_HALF, (r) => (boueAt && r >= 0 && boueAt(r) !== null && boueAt(r) !== undefined ? teintes(shadeHex(MUD, 14), 0).plat : teintes(r % 2 ? ROAD : shadeHex(ROAD, 3), 0).plat));
  bande(ctx, -0.5, -0.36, (r) => (boueAt && r >= 0 && boueAt(r) != null ? teintes(MUD, 0).plat : teintes(r % 2 ? ROAD : shadeHex(ROAD, 3), 0).plat));
  bande(ctx, 0.36, 0.5, (r) => (boueAt && r >= 0 && boueAt(r) != null ? teintes(MUD, 0).plat : teintes(r % 2 ? ROAD : shadeHex(ROAD, 3), 0).plat));
  const rive = (r) => (r % 3 === 0 ? teintes(ROAD, 0).plat : teintes(LINE, 0).plat);
  bande(ctx, ROAD_HALF - 0.2, ROAD_HALF - 0.12, rive);
  bande(ctx, -ROAD_HALF + 0.12, -ROAD_HALF + 0.2, rive);
  bande(ctx, -ROAD_HALF - 0.22, -ROAD_HALF, () => teintes(DIRT, 0).plat);
  bande(ctx, -ROAD_HALF - 1.3, -ROAD_HALF - 0.22, (r) => teintes(HERBE[zoneAt(r)], 0).plat);
  // Champ du premier plan, jusqu'au bas de l'écran : des sillons parallèles
  // à la route, bien marqués — la perspective les épaissit vers le bas.
  const uFin = uPres();
  k = 0;
  for (let u = -ROAD_HALF - 1.3; u > uFin; u -= 0.6, k++) {
    const u1 = Math.max(uFin, u - 0.6), kk = k;
    bande(ctx, u1, u, (r) => { const soil = SOIL[zoneAt(r)]; return teintes(kk % 2 ? shadeHex(soil, -16) : shadeHex(soil, 4), 0).plat; });
  }
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
export function rowDecor(ctx, r, clear) {
  const out = [];
  const zone = zoneAt(r);
  const push = (u, v, draw) => out.push({ d: depth(u, v), draw });
  const sway = (k) => Math.sin(decorT * 1.6 + k) * 0.05;
  if (!clear) {
    for (const side of [1, -1]) {
      const base = side > 0 ? ROAD_HALF + 1.2 : ROAD_HALF + 6.0;
      const n = zone === "foret" || zone === "prairie" ? 2 : zone === "village" ? 0 : 3;
      if (zone === "village") decorVillage(ctx, push, r, side, sway);
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
          const h = 1.4 + a * 1.2;
          push(u, v, () => arbre(ctx, u, v, h, sway(k)));
        }
      }
      // Rangée d'arbres, une rangée sur deux.
      if ((r + (side > 0 ? 1 : 0)) % 2 === 0 && zone !== "village") {
        const a = hash(r * 13 + side * 7);
        const u = (side > 0 ? ROAD_HALF + 6.6 : ROAD_HALF + 11.2) + a * 0.8, v = r - 0.4, k = r * 2.3 + side * 5;
        push(u, v, () => arbre(ctx, u, v, 1.6 + a * 0.8, sway(k) * 1.4));
      }
    }
    // (Plus de bottes de foin sur le bas-côté : de profil, elles se
    // confondaient avec la botte-obstacle posée sur la route.) Des buissons
    // bas, ronds et verts, à la place.
    if (hash(r * 41 + 1) < 0.14 && zone !== "foret" && zone !== "village") {
      const u = ROAD_HALF + 1.3, v = r - 0.25;
      push(u, v, () => { drawBox(ctx, u, v, 0.6, 0.7, 0.35, "#4f7f35"); drawBox(ctx, u + 0.1, v + 0.1, 0.4, 0.5, 0.18, "#5f9440", 0.35); });
    }
  }
  // Poteaux électriques (fils tendus jusqu'au suivant) et lampadaires, sur le
  // bas-côté du fond. Même sur une rangée traversée : ils sont hors du chemin.
  if (r % 5 === 0 && zone !== "foret") {
    const u = ROAD_HALF + 1.55, v = r - 0.05;
    push(u, v, () => {
      drawBox(ctx, u, v, 0.2, 0.2, 3.9, "#5c4a3a");
      drawBox(ctx, u - 0.5, v + 0.02, 1.2, 0.14, 0.14, "#3a2e24", 3.5);
      drawBox(ctx, u - 0.35, v + 0.04, 0.9, 0.1, 0.1, "#3a2e24", 3.0);
      const a = project(u + 0.1, v + 0.1, 3.6), b = project(u + 0.1, v + 5.1, 3.6);
      ctx.strokeStyle = night > 0.5 ? "rgba(20,20,30,0.7)" : "rgba(40,34,30,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, a.y + K * 0.35, b.x, b.y); ctx.stroke();
    });
  }
  if (r % 6 === 3) {
    const u = ROAD_HALF + 0.3, v = r - 0.1;
    push(u, v, () => {
      drawBox(ctx, u, v, 0.12, 0.12, 2.2, "#3a3a40");
      drawBox(ctx, u - 0.55, v - 0.05, 0.62, 0.22, 0.12, "#3a3a40", 2.2);
      drawBox(ctx, u - 0.5, v - 0.02, 0.3, 0.16, 0.06, night > 0.2 ? "#fff1b0" : "#c8c4b8", 2.14);
    });
  }
  // Premier plan : herbes, fleurs, épis, clôture — jamais plus haut que la route.
  const pres = hash(r * 57 + 3);
  for (let i = 0; i < 3; i++) {
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
      const h = Math.min(hmax, 0.18 + pres * 0.14);
      const fl = zone === "foret" ? "#3a7a33" : pres < 0.4 ? "#ffffff" : pres < 0.7 ? "#ffcf2e" : "#e13e26";
      push(u, v, () => { drawBox(ctx, u, v, 0.1, 0.1, h, zone === "vigne" ? "#6b4b2e" : "#4f7a2a"); if (zone !== "foret") drawBox(ctx, u - 0.03, v - 0.03, 0.16, 0.16, 0.1, fl, h); });
    }
  }
  // Clôture de bois du premier plan : un piquet toutes les deux rangées,
  // une lisse qui court jusqu'au suivant.
  if (r % 2 === 0 && zone !== "village") {
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

function arbre(ctx, u, v, h, sw) {
  drawBox(ctx, u + 0.15, v + 0.15, 0.2, 0.2, h * 0.4, "#5c4a3a");
  drawBox(ctx, u - 0.25, v - 0.25 + sw * 0.5, 0.9, 0.9, h * 0.45, "#2f6a2a", h * 0.35);
  drawBox(ctx, u - 0.05, v + sw, 0.5, 0.5, h * 0.4, "#3a7a33", h * 0.78);
}

// --- Le village : tout derrière la route, portes et fenêtres sur la façade
// qui regarde la caméra. Emplacements FIXES par rangée de la tranche (rz) :
// rien ne se marche dessus. Côté +1 = juste derrière la route, côté −1 = au
// fond (les deux rives de la v1).
function personnage(ctx, u, v, lift, haut, bas) {
  drawBox(ctx, u, v, 0.14, 0.14, 0.32, bas, lift);
  drawBox(ctx, u - 0.03, v - 0.03, 0.2, 0.2, 0.3, haut, lift + 0.32);
  drawBox(ctx, u, v, 0.14, 0.14, 0.16, "#d69a68", lift + 0.62);
}
function maison(ctx, u, v, prof, larg, etages, mur, toit, balcon) {
  const h = 1.0 * etages;
  drawBox(ctx, u, v, prof, larg, h, mur);
  drawBox(ctx, u - 0.03, v + larg * 0.3, 0.04, 0.3, 0.55, "#3a3a40");                 // porte
  for (let e = 0; e < etages; e++) drawBox(ctx, u - 0.03, v + larg * 0.66, 0.04, 0.24, 0.25, "#a8d8f0", 0.5 + e);
  if (balcon) {
    drawBox(ctx, u - 0.35, v + 0.15, 0.35, larg - 0.3, 0.08, "#6b4b2e", 1.0);
    personnage(ctx, u - 0.24, v + larg * 0.42, 1.08, balcon, "#3a3e4e");
    drawBox(ctx, u - 0.36, v + 0.15, 0.05, larg - 0.3, 0.3, "#6b4b2e", 1.08);
  }
  drawBox(ctx, u - 0.12, v - 0.12, prof + 0.24, larg + 0.24, 0.3, toit, h);
  drawBox(ctx, u + 0.2, v + 0.2, prof - 0.4, larg - 0.4, 0.28, toit, h + 0.3);
}
function decorVillage(ctx, push, r, side, sway) {
  const rz = ((r % ZONE_ROWS) + ZONE_ROWS) % ZONE_ROWS;
  const pres = side > 0;
  const murs = ["#f2ede2", "#e8d8b8", "#d9c3a0", "#f0e0d0"], toits = ["#b8402c", "#5c4a3a", "#3a3a40", "#8a6a45"];
  const k = r * 7 + (pres ? 0 : 3);
  if (rz % 4 === (pres ? 3 : 1) && rz !== 27 && rz !== 12) {
    const u = pres ? ROAD_HALF + 1.4 : ROAD_HALF + 6.4, v = r - 0.5;
    push(u, v, () => maison(ctx, u, v, 1.1, 1.3, 1, murs[k % 4], toits[(k + 1) % 4], null));
  }
  // Troisième plan : des toits au fond, qui donnent la profondeur du bourg
  // (20 septembre 2026 : « revois un peu plus la perspective des bâtiments
  // entre eux »).
  if (rz % 3 === (pres ? 2 : 0)) {
    const u = pres ? ROAD_HALF + 11.5 : ROAD_HALF + 13.5, v = r - 0.8;
    push(u, v, () => maison(ctx, u, v, 1.8, 2.2, 2, murs[(k + 3) % 4], toits[(k + 2) % 4], null));
  }
  if (rz % 5 === (pres ? 0 : 2)) {
    const u = pres ? ROAD_HALF + 3.6 : ROAD_HALF + 8.6, v = r - 0.6;
    const hab = ["#e13e26", "#ffcf2e", "#3f63b4", "#2f7a46"][k % 4];
    push(u, v, () => maison(ctx, u, v, 1.6, 1.9, 2, murs[(k + 2) % 4], toits[k % 4], hab));
  }
  // L'église, au milieu du village : nef, clocher, croix.
  if (!pres && rz === 27) {
    const u = ROAD_HALF + 4.4, v = r - 1.2;
    push(u, v, () => {
      drawBox(ctx, u, v, 1.8, 2.6, 1.4, "#e8e0cc");
      drawBox(ctx, u - 0.1, v - 0.1, 2.0, 2.8, 0.5, "#5c4a3a", 1.4);
      drawBox(ctx, u + 0.5, v + 2.6, 0.8, 0.8, 3.2, "#e8e0cc");
      drawBox(ctx, u + 0.4, v + 2.5, 1.0, 1.0, 0.6, "#3a3a40", 3.2);
      drawBox(ctx, u + 0.85, v + 2.95, 0.1, 0.1, 0.6, "#3a3a40", 3.8);
      drawBox(ctx, u + 0.85, v + 2.8, 0.1, 0.4, 0.1, "#3a3a40", 4.2);
      drawBox(ctx, u - 0.03, v + 1.05, 0.04, 0.5, 0.9, "#6b4b2e");
    });
  }
  // L'école : long bâtiment bas, une cour devant avec des enfants.
  if (pres && rz === 12) {
    const u = ROAD_HALF + 2.4, v = r - 1.5;
    push(u, v, () => {
      drawBox(ctx, u, v, 2.2, 3.2, 1.1, "#f0e0d0");
      drawBox(ctx, u - 0.1, v - 0.1, 2.4, 3.4, 0.25, "#8a6a45", 1.1);
      for (let i = 0; i < 4; i++) drawBox(ctx, u - 0.03, v + 0.3 + i * 0.7, 0.04, 0.4, 0.4, "#a8d8f0", 0.45);
    });
    for (let i = 0; i < 3; i++) {
      const pu = ROAD_HALF + 1.2 + (i % 2) * 0.4, pv = r - 1 + i * 0.7;
      push(pu, pv, () => personnage(ctx, pu, pv + Math.sin(decorT * 3 + i) * 0.15, 0, ["#e13e26", "#ffcf2e", "#3f63b4"][i], "#3a3e4e"));
    }
  }
  // Voitures garées le long de la route (côté fond), une tous les 6 rangées.
  if (pres && rz % 6 === 1) {
    const cu = ROAD_HALF + 2.3, cv = r - 0.5, col = ["#2f5fb0", "#e13e26", "#e9e4d8"][k % 3];
    push(cu, cv, () => {
      drawShadow(ctx, cu + 0.4, cv + 0.85, 0.45, 0.9, 0.22);
      for (const [lu, lv] of [[-0.03, 0.2], [-0.03, 1.2], [0.65, 0.2], [0.65, 1.2]]) drawBox(ctx, cu + lu, cv + lv, 0.18, 0.3, 0.28, "#1a1a1e");
      drawBox(ctx, cu, cv, 0.8, 1.7, 0.4, col, 0.15);
      drawBox(ctx, cu + 0.08, cv + 0.45, 0.64, 0.7, 0.3, "#a8d8f0", 0.55);
    });
  }
  // Un skateur, un passant, de temps en temps.
  if (pres && rz % 11 === 5) {
    const su = ROAD_HALF + 1.3, sv = r - 0.3, k2 = r * 1.3;
    push(su, sv, () => { const roll = Math.sin(decorT * 2 + k2) * 0.3; drawBox(ctx, su, sv + roll, 0.25, 0.7, 0.06, "#e13e26", 0.12); personnage(ctx, su + 0.05, sv + 0.2 + roll, 0.18, "#ffcf2e", "#3a3e4e"); });
  }
  if (!pres && rz % 9 === 6) {
    const pu = ROAD_HALF + 1.4, pv = r - 0.4;
    push(pu, pv, () => personnage(ctx, pu, pv + sway(r) * 4, 0, ["#e13e26", "#3f63b4", "#2f7a46"][k % 3], "#3a3e4e"));
  }
}

// Lampadaires visibles (halos peints par-dessus la nuit, main.js).
export function lampsIn(from, to) {
  const out = [];
  for (let r = from; r <= to; r++) if (r % 6 === 3) out.push({ u: ROAD_HALF - 0.2, v: r, h: 2.14 });
  return out;
}

// Panneau de village sur le bas-côté du fond : deux poteaux, une plaque rouge,
// le nom écrit sur la face qui regarde la caméra (un rectangle à l'écran).
export function drawSign(ctx, r, village) {
  const [nom] = village;   // le département ne sert à rien (20 septembre 2026)
  const u = ROAD_HALF + 0.55, v = r;
  const w = 2.3, hb = 0.85, base = 1.2;
  drawBox(ctx, u, v - w / 2 + 0.2, 0.12, 0.12, base, "#8a8d98");
  drawBox(ctx, u, v + w / 2 - 0.32, 0.12, 0.12, base, "#8a8d98");
  drawBox(ctx, u - 0.05, v - w / 2, 0.1, w, hb, "#e13e26", base);
  const A = project(u - 0.05, v - w / 2, base + hb), B = project(u - 0.05, v + w / 2, base);
  const s = echelle(u - 0.05), m = 0.08 * s;
  ctx.fillStyle = teintes("#f7f2e6", u).plat;
  ctx.fillRect(A.x + m, A.y + m, B.x - A.x - 2 * m, B.y - A.y - 2 * m);
  ctx.fillStyle = "#0d0d10";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const cx = (A.x + B.x) / 2, hh = B.y - A.y;
  let taille = s * 0.34;
  ctx.font = `900 ${taille}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  while (ctx.measureText(nom).width > (B.x - A.x) - 4 * m && taille > 5) { taille -= 1; ctx.font = `900 ${taille}px "Helvetica Neue", Helvetica, Arial, sans-serif`; }
  ctx.fillText(nom, cx, A.y + hh * 0.5);
}
