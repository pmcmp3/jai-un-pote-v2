// props.js — Obstacles en cubes (scene.drawBox), vue de PROFIL (v2, 19
// septembre 2026). Même bestiaire que la v1 — poule, chat, chien, mouton,
// botte de foin, cochon, vache, fermier, voiture garée, et les deux
// traversants (tracteur, poule lancée par un fermier) — réorienté :
//   - un obstacle POSÉ a son corps le long de la route et regarde le joueur
//     qui arrive (tête vers −v, donc vers la gauche de l'écran) ;
//   - un TRAVERSANT arrive du fond (u > 0) et file vers la caméra (u < 0) en
//     coupant la route : on voit sa face avant grossir.
// Les animaux bougent sur place (balancement) pour vivre sans traverser.

import { drawBox, drawShadow, drawFlat, drawDisque, getNight } from "./scene.js";
import { KINDS } from "./rows.js";

const WHITE = "#f4efe4", BLACK = "#1a1a1e", PINK = "#f0a0b0", ORANGE = "#e08a2a";

// Repère « corps » d'un animal posé en (uC, r) : `a` court le long du corps
// (0 = arrière, vers +v ; la tête est du côté des grands `a`, vers −v), `b`
// en travers (profondeur). Reprend tel quel le dessin de la v1, qui était
// orienté en travers de la route.
function corps(ctx, uC, r, K) {
  return (a, b, da, db, h, col, lift = 0) => drawBox(ctx, uC - K.larg / 2 + b, r + K.long / 2 - a - da, db, da, h, col, lift);
}

export function drawCrosser(ctx, kind, u, v, dir, t, alpha = 1) {
  const K = KINDS[kind];
  if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
  if (kind === "poulelancee") drawPouleVolante(ctx, u, v, dir, t);
  else drawTracteur(ctx, K, u, v, dir, t);
  if (alpha < 1) ctx.restore();
}

// Tracteur : il roule le long de u. `U(a, da)` place un morceau à `a` depuis
// l'ARRIÈRE du tracteur dans le sens de la marche (l'avant — capot, petites
// roues — est du côté des grands `a`).
function drawTracteur(ctx, K, u, v, dir, t) {
  const L = K.long, Wd = K.larg;
  const U = (a, da) => (dir < 0 ? u + L / 2 - a - da : u - L / 2 + a);
  const y = v - Wd / 2;
  drawShadow(ctx, u, v, L / 2, Wd / 2);
  // Poussière derrière (« un klaxon avec la poussière »).
  for (let i = 0; i < 5; i++) {
    const ph = (t * 3 + i * 1.3) % 1;
    const du = -dir * (0.9 + i * 0.55 + ph * 0.8);
    const sz = 0.22 + ph * 0.35;
    ctx.save(); ctx.globalAlpha *= 0.35 * (1 - ph);
    drawBox(ctx, u + du - sz / 2, v - sz / 2 + Math.sin(i * 2.1) * 0.3, sz, sz, sz * 0.8, "#d8c8a8", 0.05 + ph * 0.4);
    ctx.restore();
  }
  // Phares la nuit : une nappe de lumière devant lui.
  if (getNight() > 0.2) {
    const a = 0.4 * Math.min(1, (getNight() - 0.2) / 0.4);
    ctx.save(); ctx.globalAlpha *= a;
    const fx = dir > 0 ? u + L / 2 : u - L / 2 - 2.4;
    drawFlat(ctx, fx, v - 0.8, 2.4, 1.6, "#fff2b0", true);
    ctx.restore();
  }
  drawBox(ctx, U(0.05, 0.75), y - 0.05, 0.75, 0.35, 0.75, BLACK);
  drawBox(ctx, U(0.05, 0.75), y + Wd - 0.3, 0.75, 0.35, 0.75, BLACK);
  drawBox(ctx, U(1.4, 0.45), y, 0.45, 0.25, 0.45, BLACK);
  drawBox(ctx, U(1.4, 0.45), y + Wd - 0.25, 0.45, 0.25, 0.45, BLACK);
  drawBox(ctx, U(0.1, 1.9), y + 0.15, 1.9, Wd - 0.3, 0.5, "#3a8a3a", 0.45);
  drawBox(ctx, U(0.9, 1.0), y + 0.2, 1.0, Wd - 0.4, 0.4, "#2f7a2f", 0.95);
  drawBox(ctx, U(0.1, 0.8), y + 0.12, 0.8, Wd - 0.24, 0.7, "#2f7a2f", 0.95);
  drawBox(ctx, U(0.15, 0.7), y + 0.17, 0.7, Wd - 0.34, 0.45, "#a8d8f0", 1.15);
  drawBox(ctx, U(1.55, 0.1), y + 0.35, 0.1, 0.1, 0.7, "#3a3a40", 1.3);
  // Calandre et phares sur la face avant.
  const avant = U(1.99, 0.02);
  drawBox(ctx, avant, y + 0.3, 0.02, Wd - 0.6, 0.25, "#1f4f1f", 0.55);
  drawBox(ctx, avant - 0.01, y + 0.18, 0.02, 0.14, 0.1, getNight() > 0.2 ? "#fff6c8" : "#e8e2c8", 0.78);
  drawBox(ctx, avant - 0.01, y + Wd - 0.32, 0.02, 0.14, 0.1, getNight() > 0.2 ? "#fff6c8" : "#e8e2c8", 0.78);
}

// Statique centré sur (uCenter, r). `t` anime les animaux sur place.
export function drawStatic(ctx, kind, uCenter, r, t) {
  const K = KINDS[kind];
  const wob = Math.sin(t * 2.2 + r) * 0.06;
  const B = corps(ctx, uCenter, r, K);
  drawShadow(ctx, uCenter, r, K.larg / 2, K.long / 2, 0.22);
  if (kind === "poule") {
    const bob = Math.abs(Math.sin(t * 6 + r)) * 0.06;
    B(0.1 + wob, 0.1, 0.35, 0.3, 0.3, WHITE, 0.12 + bob);
    B(0.38 + wob, 0.15, 0.18, 0.2, 0.22, WHITE, 0.4 + bob);
    B(0.54 + wob, 0.2, 0.1, 0.08, 0.06, ORANGE, 0.48 + bob);
    B(0.42 + wob, 0.18, 0.1, 0.1, 0.07, "#e13e26", 0.62 + bob);
    B(0.18, 0.16, 0.06, 0.06, 0.12, ORANGE);
    B(0.3, 0.24, 0.06, 0.06, 0.12, ORANGE);
  } else if (kind === "mouton") {
    for (const [lx, ly] of [[0.12, 0.08], [0.12, 0.4], [0.66, 0.08], [0.66, 0.4]]) B(lx, ly, 0.12, 0.12, 0.3, BLACK);
    B(0.02 + wob, 0, 0.86, 0.6, 0.42, "#f7f4ee", 0.3);
    B(0.1 + wob, 0.08, 0.7, 0.44, 0.1, "#ffffff", 0.72);
    B(0.8 + wob, 0.15, 0.25, 0.3, 0.28, BLACK, 0.42);
  } else if (kind === "cochon") {
    for (const [lx, ly] of [[0.12, 0.06], [0.12, 0.42], [0.72, 0.06], [0.72, 0.42]]) B(lx, ly, 0.14, 0.12, 0.22, "#e08a9a");
    B(0 + wob, 0, 1.0, 0.6, 0.45, PINK, 0.22);
    B(0.9 + wob, 0.12, 0.3, 0.36, 0.36, PINK, 0.3);
    B(1.15 + wob, 0.2, 0.1, 0.2, 0.16, "#e08a9a", 0.38);
    B(0.92 + wob, 0.06, 0.12, 0.1, 0.14, "#e08a9a", 0.66);
    B(0.92 + wob, 0.44, 0.12, 0.1, 0.14, "#e08a9a", 0.66);
  } else if (kind === "vache") {
    for (const [lx, ly] of [[0.15, 0.1], [0.15, 0.55], [1.1, 0.1], [1.1, 0.55]]) B(lx, ly, 0.16, 0.16, 0.4, WHITE);
    B(0.05 + wob, 0.05, 1.3, 0.7, 0.55, WHITE, 0.4);
    B(0.3 + wob, 0.0, 0.4, 0.3, 0.2, BLACK, 0.7);
    B(0.9 + wob, 0.0, 0.3, 0.3, 0.2, BLACK, 0.55);
    B(0.3 + wob, 0.1, 0.4, 0.3, 0.2, BLACK, 0.95);
    B(1.25 + wob, 0.2, 0.4, 0.4, 0.4, WHITE, 0.6);
    B(1.55 + wob, 0.25, 0.12, 0.3, 0.14, PINK, 0.62);
    B(1.3 + wob, 0.12, 0.08, 0.08, 0.12, "#c8b89a", 1.0);
    B(1.3 + wob, 0.52, 0.08, 0.08, 0.12, "#c8b89a", 1.0);
  } else if (kind === "fermier") {
    // Salopette bleue, chemise à carreaux, chapeau de paille, fourche.
    B(0.1, 0.1, 0.14, 0.2, 0.55, "#2f4f9a");
    B(0.28, 0.1, 0.14, 0.2, 0.55, "#2f4f9a");
    B(0.05, 0.05, 0.42, 0.34, 0.6, "#2f4f9a", 0.55);
    B(-0.02, 0.02, 0.56, 0.4, 0.3, "#b8402c", 0.9);
    B(0.1, 0.1, 0.32, 0.3, 0.32, "#d69a68", 1.2);
    B(0.02, 0.02, 0.48, 0.46, 0.08, "#e8c66a", 1.52);
    B(0.12, 0.12, 0.28, 0.26, 0.16, "#e8c66a", 1.58);
    B(0.5, -0.02, 0.06, 0.06, 1.6, "#6b4b2e");
    B(0.42, -0.04, 0.22, 0.08, 0.18, "#8a8d98", 1.55);
  } else if (kind === "botte") {
    B(0, 0, K.long, K.larg, K.h, "#d0a84a");
    B(0, 0, K.long, K.larg, 0.06, "#a8862f", K.h * 0.4);
    B(0, 0, K.long, K.larg, 0.06, "#a8862f", K.h * 0.75);
  } else if (kind === "voiture") {
    // Garée sur la route, dans le sens de la marche.
    const col = ["#2f5fb0", "#e13e26", "#e9e4d8", "#3a8f5c"][Math.abs(r) % 4];
    const x = uCenter - K.larg / 2, y = r - K.long / 2;
    drawBox(ctx, x + 0.72, y + 0.28, 0.2, 0.3, 0.3, BLACK);
    drawBox(ctx, x + 0.72, y + 1.42, 0.2, 0.3, 0.3, BLACK);
    drawBox(ctx, x, y, K.larg, K.long, 0.42, col, 0.18);
    drawBox(ctx, x + 0.08, y + 0.55, K.larg - 0.16, 0.9, 0.36, "#a8d8f0", 0.6);
    drawBox(ctx, x + 0.1, y + 0.6, K.larg - 0.2, 0.8, 0.06, col, 0.96);
    drawBox(ctx, x - 0.01, y + 1.9, 0.12, 0.1, 0.1, "#fff1b0", 0.4);
    drawDisque(ctx, x - 0.02, y + 0.43, 0.2, 0.2, BLACK);
    drawDisque(ctx, x - 0.02, y + 1.57, 0.2, 0.2, BLACK);
    drawDisque(ctx, x - 0.03, y + 0.43, 0.2, 0.09, "#8a8d98");
    drawDisque(ctx, x - 0.03, y + 1.57, 0.2, 0.09, "#8a8d98");
  } else if (kind === "chat") {
    // Gris, blanc ou noir — jamais orange (« trop proche des pièces »).
    const col = ["#8a8d98", "#f4efe4", "#1a1a1e"][Math.abs(r) % 3];
    B(0.05 + wob * 0.5, 0, 0.42, 0.28, 0.24, col, 0.1);
    B(0.4 + wob * 0.5, 0.02, 0.22, 0.24, 0.24, col, 0.2);
    B(0.42, 0.0, 0.06, 0.06, 0.1, col, 0.44);
    B(0.54, 0.2, 0.06, 0.06, 0.1, col, 0.44);
    B(-0.1, 0.12, 0.16, 0.06, 0.06, col, 0.28 + Math.abs(wob) * 2);
    B(0.08, 0.02, 0.06, 0.06, 0.1, col); B(0.3, 0.2, 0.06, 0.06, 0.1, col);
  } else if (kind === "chien") {
    const col = Math.abs(r) % 2 ? "#5a3a22" : "#2a2a30";
    for (const [lx, ly] of [[0.08, 0.04], [0.08, 0.28], [0.5, 0.04], [0.5, 0.28]]) B(lx, ly, 0.1, 0.1, 0.22, col);
    B(0.02 + wob * 0.5, 0, 0.62, 0.38, 0.3, col, 0.22);
    B(0.58 + wob * 0.5, 0.04, 0.28, 0.3, 0.3, col, 0.34);
    B(0.8 + wob * 0.5, 0.12, 0.1, 0.14, 0.12, "#1a1a1e", 0.4);
    B(0.6, 0.0, 0.08, 0.1, 0.12, "#8a6a3a", 0.6); B(0.6, 0.28, 0.08, 0.1, 0.12, "#8a6a3a", 0.6);
    B(-0.12, 0.15, 0.16, 0.06, 0.06, col, 0.4 + Math.abs(wob) * 3);
  }
}

// Fermier posté sur le bas-côté du fond, qui LANCE des poules vers la caméra
// (6 septembre 2026 : « des fermiers qui lancent des poules »). `arme` = la
// poule est partie.
export function drawLanceur(ctx, u, r, t, dir, arme) {
  const x = u - 0.25, y = r - 0.25;
  const bras = arme ? Math.max(0, 1 - ((t * 2) % 2)) : 0.5 + Math.sin(t * 3) * 0.2;
  drawShadow(ctx, u, r, 0.3, 0.3, 0.2);
  drawBox(ctx, x + 0.1, y + 0.1, 0.14, 0.2, 0.55, "#2f4f9a");
  drawBox(ctx, x + 0.28, y + 0.1, 0.14, 0.2, 0.55, "#2f4f9a");
  drawBox(ctx, x + 0.05, y + 0.05, 0.42, 0.34, 0.6, "#2f4f9a", 0.55);
  drawBox(ctx, x - 0.02, y + 0.02, 0.56, 0.4, 0.3, "#b8402c", 0.9);
  drawBox(ctx, x + 0.1, y + 0.1, 0.32, 0.3, 0.32, "#d69a68", 1.2);
  drawBox(ctx, x + 0.02, y + 0.02, 0.48, 0.46, 0.08, "#e8c66a", 1.52);
  drawBox(ctx, x + 0.12, y + 0.12, 0.28, 0.26, 0.16, "#e8c66a", 1.58);
  // Bras tendu vers la route, une poule dans la main tant qu'il n'a pas lancé.
  const ax = dir > 0 ? x + 0.5 : x - 0.4;
  drawBox(ctx, ax, y + 0.18, 0.4, 0.12, 0.12, "#d69a68", 1.0 + bras * 0.5);
  if (!arme) drawBox(ctx, dir > 0 ? ax + 0.3 : ax - 0.1, y + 0.1, 0.25, 0.25, 0.25, WHITE, 1.1 + bras * 0.5);
}

function drawPouleVolante(ctx, u, v, dir, t) {
  const flap = Math.abs(Math.sin(t * 22)) * 0.2;
  const lift = 0.6 + Math.abs(Math.sin(t * 4)) * 0.25;
  drawShadow(ctx, u, v, 0.25, 0.3, 0.2);
  const x = u - 0.28, y = v - 0.2;
  drawBox(ctx, x + 0.1, y + 0.1, 0.35, 0.3, 0.3, WHITE, lift);
  drawBox(ctx, dir > 0 ? x + 0.4 : x - 0.05, y + 0.15, 0.18, 0.2, 0.22, WHITE, lift + 0.25);
  drawBox(ctx, dir > 0 ? x + 0.56 : x - 0.1, y + 0.2, 0.1, 0.08, 0.06, ORANGE, lift + 0.33);
  drawBox(ctx, x + 0.1, y - 0.15, 0.3, 0.14, 0.05, WHITE, lift + 0.3 + flap);
  drawBox(ctx, x + 0.1, y + 0.42, 0.3, 0.14, 0.05, WHITE, lift + 0.3 + flap);
}
