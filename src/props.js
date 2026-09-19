// props.js — Obstacles en cubes (scene.drawBox), vue de PROFIL.
//
// ⚠️ TOUT EST REDESSINÉ À L'ÉCHELLE le 20 septembre 2026 (soir) : 1 unité ≈
// 1 mètre, comme le cycliste (1,8 u de haut, 1,24 u de long). Deux plaintes
// visaient exactement ça :
//   « les vaches sont plus grosses que les voitures, ça va pas du tout » — la
//   voiture était dessinée en tranche de 0,96 u de haut pour 3,4 de long, donc
//   plus basse qu'une vache et longue comme une limousine ;
//   « les voitures, faut vraiment que tu revoies le design ».
// Désormais la voiture fait 3,9 × 1,55 (une berline), le tracteur 4,2 × 2,3,
// la vache 2,3 × 1,5 : sur la route, le plus gros objet est toujours un
// véhicule. Les tailles vivent dans rows.KINDS et le dessin les SUIT (chaque
// modèle est construit à partir de K.long / K.larg / K.h), pour qu'une boîte
// de collision ne puisse plus mentir sur ce qu'on voit.
//
// Le mouton fait un 360 sur lui-même (demandé) : vraie rotation 3D autour de
// l'axe vertical, via scene.drawBoxR.

import { drawBox, drawBoxR, drawShadow, drawFlat, drawDisque, getNight, project } from "./scene.js";
import { KINDS } from "./rows.js";

const WHITE = "#f4efe4", BLACK = "#1a1a1e", PINK = "#f0a0b0", ORANGE = "#e08a2a", VITRE = "#a8d8f0";

// Repère « corps » d'un animal posé en (uC, r), en FRACTIONS de sa boîte :
// `a` court le long du corps (0 = arrière, 1 = tête, vers −v donc vers la
// gauche de l'écran), `b` en travers, `h` en hauteur. Tout modèle décrit ainsi
// grandit tout seul quand on change K.long / K.larg / K.h.
function corps(ctx, uC, r, K) {
  return (a, b, da, db, h, col, lift = 0) =>
    drawBox(ctx, uC - K.larg / 2 + b * K.larg, r + K.long / 2 - (a + da) * K.long, db * K.larg, da * K.long, h * K.h, col, lift * K.h);
}

export function drawCrosser(ctx, kind, u, v, dir, t, alpha = 1) {
  const K = KINDS[kind];
  if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
  if (kind === "poulelancee") drawPouleVolante(ctx, u, v, dir, t);
  else drawTracteur(ctx, K, u, v, dir, t);
  if (alpha < 1) ctx.restore();
}

// Tracteur (4,2 m de long, 2,3 m de haut) : il roule le long de u. `U(a, da)`
// place un morceau à `a` depuis l'ARRIÈRE dans le sens de la marche.
function drawTracteur(ctx, K, u, v, dir, t) {
  const L = K.long, Wd = K.larg, H = K.h;
  const U = (a, da) => (dir < 0 ? u + L / 2 - a - da : u - L / 2 + a);
  const y = v - Wd / 2;
  drawShadow(ctx, u, v, L / 2, Wd / 2);
  // Poussière derrière.
  for (let i = 0; i < 5; i++) {
    const ph = (t * 3 + i * 1.3) % 1;
    const du = -dir * (1.2 + i * 0.7 + ph * 1.0);
    const sz = 0.35 + ph * 0.55;
    ctx.save(); ctx.globalAlpha *= 0.35 * (1 - ph);
    drawBox(ctx, u + du - sz / 2, v - sz / 2 + Math.sin(i * 2.1) * 0.4, sz, sz, sz * 0.8, "#d8c8a8", 0.08 + ph * 0.6);
    ctx.restore();
  }
  // Phares la nuit : une nappe de lumière devant lui.
  if (getNight() > 0.2) {
    const a = 0.4 * Math.min(1, (getNight() - 0.2) / 0.4);
    ctx.save(); ctx.globalAlpha *= a;
    const fx = dir > 0 ? u + L / 2 : u - L / 2 - 3.2;
    drawFlat(ctx, fx, v - 1.0, 3.2, 2.0, "#fff2b0", true);
    ctx.restore();
  }
  // Grandes roues arrière (1,6 m de diamètre), petites roues avant.
  for (const bb of [y + 0.02, y + Wd - 0.4]) {
    drawBox(ctx, U(0.25, 1.5), bb, 1.5, 0.38, 1.5, BLACK);
    drawBox(ctx, U(0.55, 0.9), bb - 0.02, 0.9, 0.42, 0.9, "#4a4a52", 0.3);
  }
  for (const bb of [y + 0.1, y + Wd - 0.42]) drawBox(ctx, U(3.1, 0.9), bb, 0.9, 0.32, 0.9, BLACK);
  // Châssis, capot, cabine vitrée, toit.
  drawBox(ctx, U(0.2, 3.7), y + 0.2, 3.7, Wd - 0.4, 0.42, "#2f7a2f", 0.85);
  drawBox(ctx, U(2.5, 1.7), y + 0.28, 1.7, Wd - 0.56, 0.8, "#3a8a3a", 0.75);
  drawBox(ctx, U(0.7, 1.7), y + 0.18, 1.7, Wd - 0.36, 1.05, "#2f7a2f", 1.25);
  drawBox(ctx, U(0.85, 1.4), y + 0.3, 1.4, Wd - 0.6, 0.85, VITRE, 1.32);
  drawBox(ctx, U(0.55, 2.0), y + 0.1, 2.0, Wd - 0.2, 0.2, "#256525", H - 0.2);
  drawBox(ctx, U(2.35, 0.22), y + Wd * 0.5, 0.22, 0.22, 1.1, "#3a3a40", 1.3);   // pot d'échappement
  // Calandre et phares.
  const avant = U(4.15, 0.06);
  drawBox(ctx, avant, y + 0.35, 0.06, Wd - 0.7, 0.45, "#1f4f1f", 0.95);
  for (const bb of [y + 0.22, y + Wd - 0.44]) drawBox(ctx, avant - 0.02, bb, 0.06, 0.22, 0.18, getNight() > 0.2 ? "#fff6c8" : "#e8e2c8", 1.42);
}

// Voiture : même carrosserie pour celle garée sur la route et celle qui arrive
// en face. `sens` = +1 si son capot pointe vers +v (elle s'éloigne), −1 si elle
// vient vers le joueur.
export function drawVoiture(ctx, K, uCenter, v, sens, t) {
  const L = K.long, Wd = K.larg, H = K.h;
  const x = uCenter - Wd / 2;
  const A = (a) => (sens > 0 ? v - L / 2 + a : v + L / 2 - a);
  const bloc = (a, da, b, db, h, hh, col) => drawBox(ctx, x + b, sens > 0 ? A(a) : A(a) - da, db, da, h, col, hh);
  // UNE seule teinte : la petite voiture crème de village. Les quatre couleurs
  // tirées au hasard ne voulaient rien dire et changeaient à chaque partie.
  const CAISSE = "#e6e0d2", BAS = "#cfc7b6", TOIT = "#c9c2b2";
  drawShadow(ctx, uCenter, v, Wd / 2, L / 2, 0.26);
  const rRoue = 0.33;
  for (const a of [0.72, L - 0.72]) {
    for (const uu of [x - 0.05, x + Wd - 0.26]) {
      drawDisque(ctx, uu, A(a), rRoue, rRoue, BLACK);
      drawDisque(ctx, uu - 0.02, A(a), rRoue, rRoue * 0.45, "#8a8d98");
    }
    bloc(a - 0.42, 0.84, 0.02, Wd - 0.04, 0.16, 0.5, "#2b2b31");   // passage de roue
  }
  // Caisse : bas de caisse, ceinture, cabine, toit PLAT (on s'y pose).
  bloc(0.06, L - 0.12, 0.03, Wd - 0.06, 0.34, 0.3, BAS);
  bloc(0.0, L, 0.0, Wd, 0.3, 0.64, CAISSE);
  bloc(0.85, L - 1.7, 0.1, Wd - 0.2, 0.42, 0.94, CAISSE);
  bloc(0.95, L - 1.9, 0.06, Wd - 0.12, 0.3, 0.98, VITRE);
  bloc(0.85, L - 1.7, 0.08, Wd - 0.16, 0.09, H - 0.09, TOIT);
  // Galerie de toit : elle DIT que le toit est une surface, pas une bosse.
  for (const a of [1.15, L - 1.15]) bloc(a, 0.08, 0.14, Wd - 0.28, 0.1, H, "#5c5348");
  bloc(1.15, L - 2.3, 0.16, 0.1, 0.06, H + 0.04, "#5c5348");
  bloc(1.15, L - 2.3, Wd - 0.26, 0.1, 0.06, H + 0.04, "#5c5348");
  // Pare-chocs et feux : blancs devant, rouges derrière.
  bloc(0.0, 0.12, 0.04, Wd - 0.08, 0.2, 0.46, "#2b2b31");
  bloc(L - 0.12, 0.12, 0.04, Wd - 0.08, 0.2, 0.46, "#2b2b31");
  for (const b of [0.1, Wd - 0.38]) {
    bloc(L - 0.09, 0.1, b, 0.28, 0.16, 0.74, getNight() > 0.2 ? "#fff6c8" : "#f0ead2");
    bloc(0.0, 0.1, b, 0.28, 0.15, 0.76, "#c8301c");
  }
  if (sens < 0) {
    ctx.save(); ctx.globalAlpha *= getNight() > 0.2 ? 0.55 : 0.22;
    drawFlat(ctx, x - 0.1, v - L / 2 - 4.2, Wd + 0.2, 4.2, "#fff2b0", true);
    ctx.restore();
  }
}

// Statique centré sur (uCenter, r). `t` anime les animaux sur place.
export function drawStatic(ctx, kind, uCenter, r, t) {
  const K = KINDS[kind];
  // ⚠️ `r` peut être DÉCIMAL : drawStaticTombe recule la bête qui bascule.
  // Les couleurs se choisissent donc sur un index ENTIER. Sans ça,
  // ["gris","blanc","noir"][74.35 % 3] rendait `undefined`, parseColor plantait
  // au milieu d'une rotation du canvas, et la rotation restait : tout le jeu
  // partait de travers jusqu'au rechargement (bug vécu le 20 septembre 2026).
  const ri = Math.abs(Math.round(r));
  const wob = Math.sin(t * 2.2 + r) * 0.05;
  const B = corps(ctx, uCenter, r, K);
  if (kind !== "mouton") drawShadow(ctx, uCenter, r, K.larg / 2, K.long / 2, 0.22);
  if (kind === "poule") {
    const bob = Math.abs(Math.sin(t * 6 + r)) * 0.08;
    B(0.12 + wob, 0.12, 0.5, 0.62, 0.42, WHITE, 0.2 + bob);
    B(0.56 + wob, 0.2, 0.26, 0.42, 0.3, WHITE, 0.58 + bob);
    B(0.8 + wob, 0.3, 0.16, 0.2, 0.09, ORANGE, 0.68 + bob);
    B(0.62 + wob, 0.26, 0.14, 0.24, 0.12, "#e13e26", 0.86 + bob);
    B(0.22, 0.24, 0.1, 0.12, 0.2, ORANGE);
    B(0.44, 0.5, 0.1, 0.12, 0.2, ORANGE);
  } else if (kind === "mouton") {
    for (const [la, lb] of [[0.12, 0.1], [0.12, 0.66], [0.68, 0.1], [0.68, 0.66]]) B(la, lb, 0.1, 0.18, 0.34, BLACK);
    B(0.03 + wob, 0.04, 0.78, 0.9, 0.46, "#f7f4ee", 0.34);
    B(0.12 + wob, 0.12, 0.6, 0.72, 0.12, "#ffffff", 0.78);
    B(0.78 + wob, 0.18, 0.22, 0.62, 0.3, BLACK, 0.44);
    B(0.96 + wob, 0.3, 0.08, 0.36, 0.12, "#2b2b31", 0.5);
    B(-0.02, 0.42, 0.08, 0.16, 0.1, "#efe9e0", 0.62);
  } else if (kind === "cochon") {
    for (const [la, lb] of [[0.12, 0.1], [0.12, 0.62], [0.72, 0.1], [0.72, 0.62]]) B(la, lb, 0.1, 0.16, 0.24, "#e08a9a");
    B(0.04 + wob, 0.06, 0.72, 0.84, 0.46, PINK, 0.24);
    B(0.7 + wob, 0.16, 0.22, 0.64, 0.36, PINK, 0.34);
    B(0.92 + wob, 0.32, 0.1, 0.3, 0.16, "#e08a9a", 0.44);
    B(0.72 + wob, 0.1, 0.1, 0.16, 0.14, "#e08a9a", 0.7);
    B(0.72 + wob, 0.72, 0.1, 0.16, 0.14, "#e08a9a", 0.7);
    B(0.0, 0.42, 0.06, 0.12, 0.08, "#e08a9a", 0.5);
  } else if (kind === "vache") {
    for (const [la, lb] of [[0.1, 0.1], [0.1, 0.66], [0.62, 0.1], [0.62, 0.66]]) B(la, lb, 0.09, 0.18, 0.34, WHITE);
    B(0.04 + wob, 0.04, 0.68, 0.9, 0.42, WHITE, 0.34);
    B(0.2 + wob, 0.0, 0.16, 0.34, 0.14, BLACK, 0.62);
    B(0.5 + wob, 0.02, 0.13, 0.3, 0.14, BLACK, 0.5);
    B(0.22 + wob, 0.18, 0.18, 0.38, 0.13, BLACK, 0.76);
    B(0.74 + wob, 0.2, 0.2, 0.6, 0.26, WHITE, 0.46);
    B(0.94 + wob, 0.3, 0.08, 0.38, 0.1, PINK, 0.48);
    B(0.78 + wob, 0.12, 0.06, 0.1, 0.1, "#c8b89a", 0.7);
    B(0.78 + wob, 0.78, 0.06, 0.1, 0.1, "#c8b89a", 0.7);
    B(0.0, 0.44, 0.05, 0.12, 0.06, WHITE, 0.6);
  } else if (kind === "fermier") {
    // 1,85 m : salopette bleue, chemise à carreaux, chapeau de paille, fourche.
    B(0.18, 0.12, 0.3, 0.3, 0.46, "#2f4f9a");
    B(0.18, 0.56, 0.3, 0.3, 0.46, "#2f4f9a");
    B(0.1, 0.06, 0.5, 0.5, 0.15, "#2f4f9a", 0.46);
    B(0.06, 0.02, 0.58, 0.58, 0.19, "#b8402c", 0.61);
    B(0.2, 0.18, 0.36, 0.42, 0.11, "#d69a68", 0.8);
    B(0.12, 0.08, 0.5, 0.6, 0.03, "#e8c66a", 0.91);
    B(0.24, 0.24, 0.32, 0.34, 0.06, "#e8c66a", 0.93);
    B(0.88, -0.04, 0.09, 0.1, 0.95, "#6b4b2e", 0.0);
    B(0.78, -0.06, 0.3, 0.12, 0.07, "#8a8d98", 0.9);
  } else if (kind === "botte") {
    B(0, 0, 1, 1, 1, "#d0a84a");
    B(0, 0, 1, 1, 0.05, "#a8862f", 0.35);
    B(0, 0, 1, 1, 0.05, "#a8862f", 0.72);
    B(-0.02, 0.2, 1.04, 0.6, 0.04, "#8a6a2a", 0.2);
  } else if (kind === "voiture") {
    drawVoiture(ctx, K, uCenter, r, 1, t);
  } else if (kind === "chat") {
    // Plus de gris : il se perdait sur l'asphalte (« les chats gris, on ne les
    // voit pas assez »). Noir, blanc ou roux foncé, et une tache de contraste.
    const noir = ri % 3 === 0;
    const col = noir ? "#1a1a1e" : ri % 3 === 1 ? "#f4efe4" : "#6b3a20";
    const tache = noir ? "#f4efe4" : "#1a1a1e";
    for (const [la, lb] of [[0.14, 0.08], [0.14, 0.64], [0.62, 0.08], [0.62, 0.64]]) B(la, lb, 0.1, 0.18, 0.3, col);
    B(0.06 + wob * 0.5, 0.06, 0.62, 0.78, 0.36, col, 0.3);
    B(0.66 + wob * 0.5, 0.12, 0.26, 0.66, 0.34, col, 0.44);
    B(0.7, 0.08, 0.1, 0.18, 0.16, col, 0.78);
    B(0.86, 0.56, 0.1, 0.18, 0.16, col, 0.78);
    B(0.18, 0.14, 0.26, 0.4, 0.1, tache, 0.64);
    B(-0.16, 0.36, 0.24, 0.16, 0.12, col, 0.52 + Math.abs(wob) * 2);
  } else if (kind === "chien") {
    const col = ri % 2 ? "#5a3a22" : "#2a2a30";
    for (const [la, lb] of [[0.1, 0.08], [0.1, 0.62], [0.58, 0.08], [0.58, 0.62]]) B(la, lb, 0.1, 0.18, 0.3, col);
    B(0.04 + wob * 0.5, 0.06, 0.66, 0.72, 0.34, col, 0.28);
    B(0.66 + wob * 0.5, 0.1, 0.24, 0.62, 0.32, col, 0.42);
    B(0.9 + wob * 0.5, 0.28, 0.1, 0.28, 0.14, "#1a1a1e", 0.5);
    B(0.68, 0.04, 0.08, 0.2, 0.14, "#8a6a3a", 0.72); B(0.68, 0.64, 0.08, 0.2, 0.14, "#8a6a3a", 0.72);
    B(-0.14, 0.38, 0.2, 0.12, 0.08, col, 0.52 + Math.abs(wob) * 3);
  }
}

// Fermier posté sur le bas-côté du fond, qui LANCE des poules vers la caméra.
export function drawLanceur(ctx, u, r, t, dir, arme) {
  const bras = arme ? Math.max(0, 1 - ((t * 2) % 2)) : 0.5 + Math.sin(t * 3) * 0.2;
  const x = u - 0.3, y = r - 0.3;
  drawShadow(ctx, u, r, 0.35, 0.35, 0.2);
  drawBox(ctx, x + 0.18, y + 0.12, 0.3, 0.26, 0.85, "#2f4f9a");
  drawBox(ctx, x + 0.18, y + 0.5, 0.3, 0.26, 0.85, "#2f4f9a");
  drawBox(ctx, x + 0.1, y + 0.06, 0.5, 0.48, 0.28, "#2f4f9a", 0.85);
  drawBox(ctx, x + 0.06, y + 0.02, 0.58, 0.56, 0.35, "#b8402c", 1.13);
  drawBox(ctx, x + 0.2, y + 0.16, 0.36, 0.4, 0.2, "#d69a68", 1.48);
  drawBox(ctx, x + 0.12, y + 0.08, 0.5, 0.56, 0.06, "#e8c66a", 1.68);
  drawBox(ctx, x + 0.24, y + 0.22, 0.32, 0.32, 0.11, "#e8c66a", 1.72);
  const ax = dir > 0 ? x + 0.6 : x - 0.5;
  drawBox(ctx, ax, y + 0.24, 0.5, 0.18, 0.18, "#d69a68", 1.2 + bras * 0.5);
  if (!arme) drawBox(ctx, dir > 0 ? ax + 0.36 : ax - 0.14, y + 0.14, 0.32, 0.32, 0.32, WHITE, 1.32 + bras * 0.5);
}

function drawPouleVolante(ctx, u, v, dir, t) {
  const flap = Math.abs(Math.sin(t * 22)) * 0.22;
  const lift = 0.6 + Math.abs(Math.sin(t * 4)) * 0.25;
  drawShadow(ctx, u, v, 0.3, 0.35, 0.2);
  const x = u - 0.3, y = v - 0.24;
  drawBox(ctx, x + 0.1, y + 0.1, 0.42, 0.36, 0.36, WHITE, lift);
  drawBox(ctx, dir > 0 ? x + 0.46 : x - 0.08, y + 0.16, 0.22, 0.24, 0.26, WHITE, lift + 0.28);
  drawBox(ctx, dir > 0 ? x + 0.64 : x - 0.14, y + 0.22, 0.12, 0.1, 0.08, ORANGE, lift + 0.38);
  drawBox(ctx, x + 0.1, y - 0.18, 0.36, 0.16, 0.06, WHITE, lift + 0.34 + flap);
  drawBox(ctx, x + 0.1, y + 0.48, 0.36, 0.16, 0.06, WHITE, lift + 0.34 + flap);
}

// Un obstacle TOUCHÉ bascule (20 septembre 2026 : « quand on se prend un
// cochon ou une vache qui tombe par terre, pour qu'on comprenne qu'il s'est
// passé un truc »). On fait pivoter le dessin autour de son point d'appui, à
// l'écran, comme le salto du cycliste.
export function drawStaticTombe(ctx, kind, uCenter, r, t, age) {
  const K = KINDS[kind];
  const k = Math.min(1, age / 0.45);
  const angle = (Math.PI / 2) * (1 - Math.pow(1 - k, 3)) * 0.92;
  const recul = k * 0.8;
  const c = project(uCenter, r + K.long / 2, 0);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(angle);
  ctx.translate(-c.x, -c.y);
  drawStatic(ctx, kind, uCenter, r + recul, t);
  ctx.restore();
}
