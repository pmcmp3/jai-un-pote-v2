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

import { drawBox, drawBoxR, drawShadow, drawFlat, drawDisque, getNight, project, groupe } from "./scene.js";
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
  groupe(ctx, () => drawTracteur(ctx, K, u, v, dir, t));
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
  groupe(ctx, () => voitureNue(ctx, K, uCenter, v, sens, t));
}
function voitureNue(ctx, K, uCenter, v, sens, t) {
  // Refaite le 28 septembre 2026 (« refais une repasse de tous les éléments
  // 3D qui ont trop de soucis ») : plus de passages de roue ni de pare-chocs
  // noirs sur toute la largeur (vus de biais, ils faisaient de grandes bandes
  // noires en travers de la caisse), plus de galerie de toit. Une caisse, un
  // habitacle VITRÉ avec trois montants, un toit plat clair (on s'y pose),
  // des pare-chocs gris fins, des feux aux quatre coins.
  const L = K.long, Wd = K.larg, H = K.h;
  const x = uCenter - Wd / 2;
  const A = (a) => (sens > 0 ? v - L / 2 + a : v + L / 2 - a);
  const bloc = (a, da, b, db, h, hh, col) => drawBox(ctx, x + b, sens > 0 ? A(a) : A(a) - da, db, da, h, col, hh);
  const CAISSE = "#e6e0d2", TOIT = "#d3cab8", GRIS = "#8a8a92", LIGNE = "#bdb4a0";
  const nuit = getNight() > 0.2;
  drawShadow(ctx, uCenter, v, Wd / 2, L / 2, 0.26);
  const rRoue = 0.34;
  for (const a of [0.62, L - 0.62]) {
    for (const uu of [x + Wd - 0.3, x - 0.03]) {
      drawDisque(ctx, uu, A(a), rRoue, rRoue, "#1a1a1e");
      drawDisque(ctx, uu - 0.002, A(a), rRoue, rRoue * 0.5, "#9a9da8");
    }
  }
  bloc(0.0, L, 0.0, Wd, 0.62, 0.3, CAISSE);                      // caisse
  bloc(0.35, L - 0.7, -0.012, 0.02, 0.05, 0.62, LIGNE);          // ligne de caisse, côté caméra
  bloc(0.75, L - 1.5, 0.1, Wd - 0.2, 0.42, 0.92, "#a8d8f0");     // habitacle vitré
  for (const a of [0.72, L / 2 - 0.07, L - 0.86]) bloc(a, 0.14, 0.08, Wd - 0.16, 0.42, 0.92, CAISSE); // montants
  bloc(0.68, L - 1.36, 0.06, Wd - 0.12, H - 1.34, 1.34, TOIT);   // toit plat
  bloc(-0.05, 0.1, 0.12, Wd - 0.24, 0.12, 0.34, GRIS);           // pare-chocs
  bloc(L - 0.05, 0.1, 0.12, Wd - 0.24, 0.12, 0.34, GRIS);
  for (const b of [0.06, Wd - 0.34]) {
    bloc(L - 0.03, 0.05, b, 0.28, 0.14, 0.68, nuit ? "#fff6c8" : "#f4eed6");   // phares
    bloc(-0.02, 0.05, b, 0.28, 0.12, 0.7, "#c8301c");                          // feux arrière
  }
  if (sens < 0) {
    ctx.save(); ctx.globalAlpha *= nuit ? 0.55 : 0.22;
    drawFlat(ctx, x - 0.1, v - L / 2 - 4.2, Wd + 0.2, 4.2, "#fff2b0", true);
    ctx.restore();
  }
}

// Statique centré sur (uCenter, r). `t` anime les animaux sur place.
export function drawStatic(ctx, kind, uCenter, r, t) {
  groupe(ctx, () => staticNu(ctx, kind, uCenter, r, t));
}
function staticNu(ctx, kind, uCenter, r, t) {
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
    // Taches PLAQUÉES sur le flanc côté caméra et sur le dos (elles flottaient
    // en blocs au-dessus du dos, 28 septembre 2026).
    B(0.14 + wob, 0.02, 0.2, 0.03, 0.22, BLACK, 0.42);
    B(0.44 + wob, 0.02, 0.16, 0.03, 0.18, BLACK, 0.52);
    B(0.22 + wob, 0.3, 0.2, 0.36, 0.02, BLACK, 0.76);
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

// --- La POULE JETÉE (27 septembre 2026) ---------------------------------------
// Le fermier est planté sur le bas-côté du fond, juste derrière la route,
// TOURNÉ VERS LE JOUEUR (vers −v, la gauche de l'écran). Il tient une poule
// au-dessus de sa tête ; quand le joueur approche, il la jette et elle court
// sur la route vers lui. Il est volontairement plus petit et plus loin de
// l'asphalte que le fermier-obstacle, et il a les bras en l'air : on ne le
// confond pas avec quelqu'un qui barre la route.
export function drawLanceurFace(ctx, u, v, t, lance) {
  groupe(ctx, () => {
    // 0 → 1 pendant le lancer, puis bras baissés.
    const k = lance === null ? 0 : Math.min(1, lance / 0.35);
    const bras = lance === null ? 0.08 * Math.sin(t * 5) : k < 1 ? -0.5 * Math.sin(k * Math.PI) : -0.25;
    drawShadow(ctx, u + 0.3, v, 0.35, 0.35, 0.2);
    const x = u, y = v - 0.3;
    drawBox(ctx, x + 0.14, y + 0.1, 0.22, 0.22, 0.8, "#2f4f9a");
    drawBox(ctx, x + 0.14, y + 0.36, 0.22, 0.22, 0.8, "#2f4f9a");
    drawBox(ctx, x + 0.08, y + 0.04, 0.36, 0.6, 0.26, "#2f4f9a", 0.8);
    drawBox(ctx, x + 0.06, y + 0.02, 0.4, 0.64, 0.36, "#b8402c", 1.06);
    drawBox(ctx, x + 0.12, y + 0.14, 0.28, 0.36, 0.28, "#d69a68", 1.42);
    drawBox(ctx, x + 0.12, y + 0.06, 0.3, 0.06, 0.06, "#1a1a1e", 1.58);          // les yeux, côté joueur
    drawBox(ctx, x + 0.02, y - 0.06, 0.48, 0.76, 0.05, "#e8c66a", 1.7);
    drawBox(ctx, x + 0.12, y + 0.12, 0.28, 0.4, 0.12, "#e8c66a", 1.74);
    // Les deux bras levés, qui tiennent la poule (ou qui viennent de la jeter).
    for (const b of [0.0, 0.52]) drawBox(ctx, x + 0.16, y + b + bras * 0.4, 0.14, 0.14, 0.62, "#b8402c", 1.3 + (lance === null ? 0.1 : 0));
    if (lance === null) poule(ctx, x + 0.26, y + 0.33, 2.0, t, -1);
  });
}
// La poule qui court sur la route, vers le joueur (tête vers −v).
export function drawPouleJetee(ctx, u, v, t) {
  groupe(ctx, () => {
    drawShadow(ctx, u, v, 0.28, 0.32, 0.22);
    const saut = Math.abs(Math.sin(t * 14)) * 0.06;
    poule(ctx, u, v, saut, t, -1);
  });
}
// Poule en cubes, centrée en (u, v), posée à `lift`, tête du côté `sens`.
function poule(ctx, u, v, lift, t, sens) {
  const flap = Math.abs(Math.sin(t * 20)) * 0.14;
  const x = u - 0.3, y = v - 0.32;
  const tete = sens < 0 ? y - 0.02 : y + 0.42;
  drawBox(ctx, x + 0.14, y + 0.14, 0.32, 0.36, 0.34, WHITE, lift + 0.16);
  drawBox(ctx, x + 0.2, tete, 0.2, 0.22, 0.24, WHITE, lift + 0.42);
  drawBox(ctx, x + 0.24, sens < 0 ? tete - 0.1 : tete + 0.22, 0.12, 0.1, 0.07, ORANGE, lift + 0.5);
  drawBox(ctx, x + 0.24, tete + 0.06, 0.12, 0.1, 0.1, "#e13e26", lift + 0.66);
  drawBox(ctx, x + 0.08, y + 0.2, 0.06, 0.24, 0.14, WHITE, lift + 0.3 + flap);
  drawBox(ctx, x + 0.46, y + 0.2, 0.06, 0.24, 0.14, WHITE, lift + 0.3 + flap);
  if (lift < 0.5) { drawBox(ctx, x + 0.22, y + 0.22, 0.06, 0.06, lift + 0.16, ORANGE); drawBox(ctx, x + 0.34, y + 0.34, 0.06, 0.06, lift + 0.16, ORANGE); }
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
