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
// Hauteurs réelles du mobilier de bord de route (1 unité ≈ 1 mètre).
export const POTEAU_H = 8.0, LAMPE_H = 6.5;

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

// Boîte TOURNÉE autour de son axe vertical, centrée sur (cu, cv) : un vrai
// prisme à quatre arêtes, dont on peint les faces du fond vers l'avant. C'est
// ce qui manquait à la brique de lait (20 septembre 2026 : « les briques de
// lait, ça ne marche toujours pas en 3D, il faut que tu voies la logique ») —
// drawBox ne sait peindre qu'une boîte alignée sur les axes, donc réduire sa
// largeur au cosinus donnait une boîte écrasée, jamais une boîte qui tourne.
// Sert aussi au mouton qui fait un 360.
export function drawBoxR(ctx, cu, cv, du, dv, h, color, lift = 0, angle = 0) {
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
  // La route : asphalte et lignes de rive en tirets (repère de vitesse). Plus
  // de flaques de boue depuis le 20 septembre 2026 (« enlève les trucs de
  // terre par terre, les gens comprennent pas, je pense »).
  bande(ctx, -ROAD_HALF, ROAD_HALF, (r) => teintes(r % 2 ? ROAD : shadeHex(ROAD, 3), 0).plat);
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
          const h = 5.0 + a * 4.0;
          push(u, v, () => arbre(ctx, u, v, h, sway(k)));
        }
      }
      // Rangée d'arbres, une rangée sur deux.
      if ((r + (side > 0 ? 1 : 0)) % 2 === 0 && zone !== "village") {
        const a = hash(r * 13 + side * 7);
        const u = (side > 0 ? ROAD_HALF + 6.6 : ROAD_HALF + 11.2) + a * 0.8, v = r - 0.4, k = r * 2.3 + side * 5;
        push(u, v, () => arbre(ctx, u, v, 5.5 + a * 3.0, sway(k) * 1.4));
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
  // Poteaux électriques (8 m, comme dans la vraie vie) et lampadaires (6,5 m) :
  // ils faisaient la taille du cycliste (20 septembre 2026, « je fais la même
  // taille qu'un lampadaire, il faudrait qu'ils soient plus grands »).
  if (r % 5 === 0 && zone !== "foret") {
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
  if (r % 6 === 3) {
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
  const pres = hash(r * 57 + 3);
  for (let i = 0; i < 2; i++) {
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

// Arbre : 1 unité ≈ 1 mètre ici aussi (un pommier de bord de route fait 5 à
// 9 m, pas 2). Le tronc porte deux étages de feuillage.
function arbre(ctx, u, v, h, sw) {
  drawBox(ctx, u + 0.3, v + 0.3, 0.45, 0.45, h * 0.42, "#5c4a3a");
  drawBox(ctx, u - 0.7, v - 0.7 + sw * 0.5, 2.4, 2.4, h * 0.42, "#2f6a2a", h * 0.34);
  drawBox(ctx, u - 0.2, v - 0.2 + sw, 1.5, 1.5, h * 0.34, "#3a7a33", h * 0.72);
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
function personnage(ctx, u, v, lift, haut, bas) {
  const l = 0.42;   // épaules
  drawBox(ctx, u, v, 0.3, l * 0.8, PERSO_H * 0.46, bas, lift);                       // jambes
  drawBox(ctx, u - 0.05, v - 0.05, 0.4, l, PERSO_H * 0.33, haut, lift + PERSO_H * 0.46); // buste
  drawBox(ctx, u + 0.02, v + 0.04, 0.3, 0.3, PERSO_H * 0.21, "#d69a68", lift + PERSO_H * 0.79); // tête
}
function maison(ctx, u, v, prof, larg, etages, mur, toit, balcon) {
  const h = ETAGE_H * etages;
  drawBox(ctx, u, v, prof, larg, h, mur);
  drawBox(ctx, u - 0.05, v + larg * 0.3, 0.06, 0.95, 2.1, "#3a3a40");                 // porte (2,1 m)
  for (let e = 0; e < etages; e++) {
    drawBox(ctx, u - 0.05, v + larg * 0.62, 0.06, 0.85, 1.15, "#a8d8f0", 1.15 + e * ETAGE_H);
    if (larg > 2.4) drawBox(ctx, u - 0.05, v + larg * 0.1, 0.06, 0.85, 1.15, "#a8d8f0", 1.15 + e * ETAGE_H);
  }
  if (balcon) {
    drawBox(ctx, u - 0.8, v + 0.2, 0.8, larg - 0.4, 0.14, "#6b4b2e", ETAGE_H);
    personnage(ctx, u - 0.55, v + larg * 0.42, ETAGE_H + 0.14, balcon, "#3a3e4e");
    drawBox(ctx, u - 0.82, v + 0.2, 0.08, larg - 0.4, 0.95, "#6b4b2e", ETAGE_H + 0.14);
  }
  drawBox(ctx, u - 0.25, v - 0.25, prof + 0.5, larg + 0.5, 0.35, toit, h);
  drawBox(ctx, u + 0.3, v + 0.3, prof - 0.6, larg - 0.6, 0.9, toit, h + 0.35);
}
function decorVillage(ctx, push, r, side, sway) {
  const rz = ((r % ZONE_ROWS) + ZONE_ROWS) % ZONE_ROWS;
  const pres = side > 0;
  const murs = ["#f2ede2", "#e8d8b8", "#d9c3a0", "#f0e0d0"], toits = ["#b8402c", "#5c4a3a", "#3a3a40", "#8a6a45"];
  const k = r * 7 + (pres ? 0 : 3);
  if (rz % 6 === (pres ? 4 : 1) && rz !== 27 && rz !== 12) {
    const u = pres ? ROAD_HALF + 2.2 : ROAD_HALF + 8.0, v = r - 1.2;
    push(u, v, () => maison(ctx, u, v, 4.0, 3.2, 1, murs[k % 4], toits[(k + 1) % 4], null));
  }
  // Troisième plan : des toits au fond, qui donnent la profondeur du bourg.
  if (rz % 4 === (pres ? 2 : 0)) {
    const u = pres ? ROAD_HALF + 15.0 : ROAD_HALF + 21.0, v = r - 1.8;
    push(u, v, () => maison(ctx, u, v, 5.0, 4.6, 2, murs[(k + 3) % 4], toits[(k + 2) % 4], null));
  }
  if (rz % 7 === (pres ? 0 : 3)) {
    const u = pres ? ROAD_HALF + 6.2 : ROAD_HALF + 11.5, v = r - 1.5;
    const hab = ["#e13e26", "#ffcf2e", "#3f63b4", "#2f7a46"][k % 4];
    push(u, v, () => maison(ctx, u, v, 4.4, 4.0, 2, murs[(k + 2) % 4], toits[k % 4], hab));
  }
  // L'église : nef de 7 m, clocher de 17 m, croix.
  if (!pres && rz === 27) {
    const u = ROAD_HALF + 6.5, v = r - 2.6;
    push(u, v, () => {
      drawBox(ctx, u, v, 5.2, 6.0, 7.0, "#e8e0cc");
      drawBox(ctx, u - 0.3, v - 0.3, 5.8, 6.6, 1.3, "#5c4a3a", 7.0);
      drawBox(ctx, u + 1.4, v + 6.0, 2.4, 2.4, 14.0, "#e8e0cc");
      drawBox(ctx, u + 1.1, v + 5.7, 3.0, 3.0, 2.2, "#3a3a40", 14.0);
      drawBox(ctx, u + 2.45, v + 7.05, 0.3, 0.3, 1.6, "#3a3a40", 16.2);
      drawBox(ctx, u + 2.45, v + 6.6, 0.3, 1.2, 0.3, "#3a3a40", 17.2);
      drawBox(ctx, u - 0.05, v + 2.4, 0.06, 1.2, 2.6, "#6b4b2e");
    });
  }
  // L'école : long bâtiment bas, une cour devant avec des enfants.
  if (pres && rz === 12) {
    const u = ROAD_HALF + 3.6, v = r - 3.5;
    push(u, v, () => {
      drawBox(ctx, u, v, 5.0, 8.0, 3.4, "#f0e0d0");
      drawBox(ctx, u - 0.25, v - 0.25, 5.5, 8.5, 0.6, "#8a6a45", 3.4);
      for (let i = 0; i < 4; i++) drawBox(ctx, u - 0.06, v + 1.0 + i * 1.7, 0.06, 1.1, 1.3, "#a8d8f0", 1.1);
    });
    for (let i = 0; i < 3; i++) {
      const pu = ROAD_HALF + 1.7 + (i % 2) * 0.8, pv = r - 2.2 + i * 1.4;
      // Des enfants : un tiers plus petits que les adultes.
      push(pu, pv, () => { ctx.save(); personnage(ctx, pu, pv + Math.sin(decorT * 3 + i) * 0.15, 0, ["#e13e26", "#ffcf2e", "#3f63b4"][i], "#3a3e4e"); ctx.restore(); });
    }
  }
  // Voitures garées le long de la route (côté fond) : 4 m de long, 1,5 de haut.
  if (pres && rz % 6 === 1) {
    const cu = ROAD_HALF + 2.6, cv = r - 1.0, col = ["#2f5fb0", "#e13e26", "#e9e4d8"][k % 3];
    push(cu, cv, () => {
      drawShadow(ctx, cu + 0.85, cv + 2.0, 0.9, 2.0, 0.22);
      for (const [lu, lv] of [[-0.05, 0.6], [-0.05, 2.9], [1.5, 0.6], [1.5, 2.9]]) drawBox(ctx, cu + lu, cv + lv, 0.4, 0.66, 0.62, "#1a1a1e");
      drawBox(ctx, cu, cv, 1.7, 4.0, 0.68, col, 0.3);
      drawBox(ctx, cu + 0.16, cv + 1.05, 1.38, 1.85, 0.62, "#a8d8f0", 0.95);
      drawBox(ctx, cu + 0.22, cv + 1.15, 1.26, 1.65, 0.1, col, 1.52);
    });
  }
  // Un skateur, un passant, de temps en temps.
  if (pres && rz % 11 === 5) {
    const su = ROAD_HALF + 1.6, sv = r - 0.3, k2 = r * 1.3;
    push(su, sv, () => { const roll = Math.sin(decorT * 2 + k2) * 0.4; drawBox(ctx, su, sv + roll, 0.4, 1.0, 0.1, "#e13e26", 0.16); personnage(ctx, su + 0.05, sv + 0.2 + roll, 0.26, "#ffcf2e", "#3a3e4e"); });
  }
  if (!pres && rz % 9 === 6) {
    const pu = ROAD_HALF + 2.0, pv = r - 0.4;
    push(pu, pv, () => personnage(ctx, pu, pv + sway(r) * 4, 0, ["#e13e26", "#3f63b4", "#2f7a46"][k % 3], "#3a3e4e"));
  }
}

// --- Les HALLES DE MARCHÉ (20 septembre 2026) ---------------------------------------
// « Un bâtiment un peu comme des halles de marché typiques françaises, où il y
// a une rampe [...] on est au premier étage des halles. » Une rampe de bois
// monte depuis la route, un plancher file à HALLE_HAUT, une rampe redescend ;
// au-dessus, la charpente et le toit de tuiles sur des piliers de pierre, tous
// posés DERRIÈRE la route pour ne jamais cacher le joueur.
export function drawHalle(ctx, rDebut, geo, rFrom = -Infinity, rTo = Infinity) {
  const { haut, montee, plat, descente, total } = geo;
  const visible = (v0, v1) => v1 >= rFrom - 2 && v0 <= rTo + 2;
  const uG = -ROAD_HALF - 0.2, du = ROAD_HALF * 2 + 0.4;
  const BOIS = "#7a5632", BOIS_CLAIR = "#a9855a", PIERRE = "#ded3c0", TUILE = "#b8402c", POUTRE = "#5c4326";
  const TOIT = haut + 3.6;
  // Piliers de pierre et charpente, tous les 6 rangs, côté fond.
  for (let i = 0; i <= total; i += 6) {
    const v = rDebut + i;
    if (!visible(v, v + 0.8)) continue;
    drawBox(ctx, ROAD_HALF + 0.5, v, 0.8, 0.8, TOIT, PIERRE);
    drawBox(ctx, ROAD_HALF + 0.35, v - 0.1, 1.1, 1.0, 0.45, PIERRE, TOIT);
  }
  // Toit : panne faîtière puis deux rangs de tuiles qui débordent sur la route.
  drawBox(ctx, ROAD_HALF + 0.25, rDebut, 1.2, total, 0.5, POUTRE, TOIT + 0.45);
  drawBox(ctx, -ROAD_HALF - 0.9, rDebut - 0.5, ROAD_HALF * 2 + 2.4, total + 1.0, 0.35, TUILE, TOIT + 0.95);
  drawBox(ctx, -ROAD_HALF - 0.3, rDebut - 0.25, ROAD_HALF * 2 + 1.4, total + 0.5, 0.45, TUILE, TOIT + 1.3);
  // La RAMPE : un plan incliné de planches, pas des marches — la première
  // version se lisait comme une botte de foin posée sur la route. Bois foncé,
  // nez de marche clair, et deux bandes rouges à l'entrée qui disent « monte ».
  const pente = (i, n, sens) => {
    const v0 = rDebut + (sens > 0 ? i : montee + plat + i);
    if (!visible(v0, v0 + 1)) return;
    const a = sens > 0 ? i / n : 1 - i / n, b = sens > 0 ? (i + 1) / n : 1 - (i + 1) / n;
    const bas = Math.min(a, b) * haut, hautMarche = Math.max(a, b) * haut;
    drawBox(ctx, uG, v0, du, 1.02, hautMarche - bas + 0.2, BOIS, bas);
    drawBox(ctx, uG + 0.06, v0 + 0.02, du - 0.12, 0.98, 0.08, BOIS_CLAIR, hautMarche + 0.14);
  };
  for (let i = 0; i < montee; i++) pente(i, montee, 1);
  for (let i = 0; i < descente; i++) pente(i, descente, -1);
  if (visible(rDebut - 0.6, rDebut + 0.4)) {
    drawBox(ctx, uG, rDebut - 0.55, du, 0.5, 0.16, "#e13e26", 0);
    drawBox(ctx, uG, rDebut - 1.15, du, 0.5, 0.16, "#f7f2e6", 0);
  }
  // Le plancher du premier étage, sa lisse côté caméra et ses poteaux.
  drawBox(ctx, uG, rDebut + montee, du, plat, 0.4, BOIS, haut - 0.4);
  drawBox(ctx, uG, rDebut + montee, du, plat, 0.1, BOIS_CLAIR, haut);
  for (let i = 0; i <= plat; i += 3) {
    const v = rDebut + montee + i;
    if (!visible(v, v + 0.2)) continue;
    drawBox(ctx, uG - 0.16, v, 0.16, 0.18, 0.75, POUTRE, haut);
  }
  drawBox(ctx, uG - 0.18, rDebut + montee, 0.18, plat, 0.13, POUTRE, haut + 0.62);
  // L'enseigne « HALLES » sur le premier pilier.
  if (visible(rDebut - 1, rDebut + 4)) {
    const p = project(ROAD_HALF + 0.46, rDebut - 0.3, TOIT - 0.4), sc = echelle(ROAD_HALF + 0.46);
    ctx.save();
    ctx.fillStyle = teintes("#f7f2e6", ROAD_HALF).plat;
    ctx.fillRect(p.x, p.y, sc * 3.6, sc * 1.0);
    ctx.strokeStyle = "#0d0d10"; ctx.lineWidth = 1.2;
    ctx.strokeRect(p.x, p.y, sc * 3.6, sc * 1.0);
    ctx.fillStyle = "#0d0d10";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(6, sc * 0.58)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillText("HALLES", p.x + sc * 1.8, p.y + sc * 0.52);
    ctx.restore();
  }
}

// Lampadaires visibles (halos peints par-dessus la nuit, main.js).
export function lampsIn(from, to) {
  const out = [];
  for (let r = from; r <= to; r++) if (r % 6 === 3) out.push({ u: ROAD_HALF - 0.2, v: r, h: LAMPE_H - 0.2 });
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
