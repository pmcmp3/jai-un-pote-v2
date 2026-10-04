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

import { drawBox, drawBoxR, drawShadow, drawFlat, drawDisque, getNight, project, groupe, echelle, CONTOUR_PERSO, contour2D, teteVoxel } from "./scene.js";
import { KINDS } from "./rows.js";
import { humain } from "./humains.js";

const ROUSSE = "#b8612c", ROUSSE_AILE = "#8a4420";
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

// Tracteur SUR la route, de profil, capot vers +v (3 octobre 2026 : il roule
// dans le sens du joueur, on le rattrape). `bloc(a, da, b, db, h, lift)` : `a`
// depuis l'ARRIÈRE le long de la route, `b` en travers — en fractions de la
// boîte, pour que le dessin suive K.long / K.larg / K.h.
export function drawTracteurRoute(ctx, K, uC, v, t, sens = -1) {
  groupe(ctx, () => {
    const L = K.long, W = K.larg, H = K.h;
    const x = uC - W / 2;
    // `a` part de l'ARRIÈRE, dans le sens de la marche (sens −1 : il vient vers le joueur).
    const A = (a, da) => (sens > 0 ? v - L / 2 + a * L : v + L / 2 - (a + da) * L);
    const bloc = (a, da, b, db, h, lift, col) => drawBox(ctx, x + b * W, A(a, da), db * W, da * L, h * H, col, lift * H);
    const arr = sens > 0 ? v - L / 2 : v + L / 2;
    drawShadow(ctx, uC, v, W / 2, L / 2, 0.26);
    // Poussière derrière lui.
    for (let i = 0; i < 4; i++) {
      const ph = (t * 3 + i * 1.3) % 1, sz = 0.3 + ph * 0.5;
      ctx.save(); ctx.globalAlpha *= 0.35 * (1 - ph);
      drawBox(ctx, uC - sz / 2 + Math.sin(i * 2.1) * 0.3, arr - sens * (0.4 + i * 0.5 + ph * 0.8) - (sens > 0 ? 0 : sz), sz, sz, sz * 0.8, "#d8c8a8", 0.08 + ph * 0.5);
      ctx.restore();
    }
    // Grande roue arrière, petite roue avant, en disques comme la voiture.
    for (const b of [-0.02, 0.8]) {
      const u = x + b * W + 0.12;
      const vAr = arr + sens * 0.24 * L, vAv = arr + sens * 0.84 * L;
      drawDisque(ctx, u, vAr, 0.62, 0.62, "#1a1a1e");
      drawDisque(ctx, u - 0.002, vAr, 0.62, 0.3, "#e0b02a");
      drawDisque(ctx, u, vAv, 0.34, 0.34, "#1a1a1e");
      drawDisque(ctx, u - 0.002, vAv, 0.34, 0.17, "#e0b02a");
    }
    bloc(0.02, 0.94, 0.12, 0.76, 0.18, 0.36, "#2f7a2f");     // châssis
    bloc(0.52, 0.46, 0.18, 0.64, 0.34, 0.42, "#3a8a3a");     // capot
    bloc(0.06, 0.44, 0.1, 0.8, 0.12, 0.42, "#2f7a2f");       // plancher de cabine
    bloc(0.1, 0.36, 0.16, 0.68, 0.4, 0.54, VITRE);           // cabine vitrée
    for (const a of [0.08, 0.42]) bloc(a, 0.05, 0.12, 0.76, 0.42, 0.54, "#2f7a2f"); // montants
    bloc(0.04, 0.48, 0.06, 0.88, 0.06, 0.94, "#256525");     // toit
    bloc(0.8, 0.05, 0.48, 0.1, 0.36, 0.64, "#3a3a40");       // pot d'échappement
    const nuit = getNight() > 0.2;
    for (const b of [0.18, 0.7]) bloc(0.97, 0.03, b, 0.12, 0.08, 0.6, nuit ? "#fff6c8" : "#e8e2c8"); // phares
    if (nuit) { ctx.save(); ctx.globalAlpha *= 0.45; drawFlat(ctx, x - 0.1, sens > 0 ? v + L / 2 : v - L / 2 - 3.6, W + 0.2, 3.6, "#fff2b0", true); ctx.restore(); }
  });
}

// Le BUGGY de la plage (5 octobre 2026 : « faut virer les tracteurs quand on
// est sur la plage, il vaut mieux que tu rajoutes des voiturettes de plage ») :
// coque rose bonbon façon Miami, gros pneus de sable, arceau de sécurité
// turquoise, un conducteur à lunettes noires. Il vient en face (avant vers −v).
const BUGGY = ["#ff5fa2", "#ffb347", "#36c6d0"];
export function drawBuggy(ctx, K, uC, v, t, r = 0) {
  groupe(ctx, () => {
    const L = K.long, W = K.larg, H = K.h;
    const x = uC - W / 2, av = v - L / 2;
    const bloc = (a, da, b, db, h, lift, col) => drawBox(ctx, x + b * W, av + a * L, db * W, da * L, h * H, col, lift * H);
    // Couleur tirée de la RANGÉE, jamais de v : il roule, sa coque changeait
    // de couleur en route (vu à la capture, rose puis turquoise).
    const COQUE = BUGGY[Math.abs(r) % 3], ARCEAU = "#36e0e6";
    drawShadow(ctx, uC, v, W / 2, L / 2, 0.26);
    // Le sable qui gicle derrière.
    for (let i = 0; i < 4; i++) {
      const ph = (t * 3.4 + i * 1.3) % 1, sz = 0.25 + ph * 0.45;
      ctx.save(); ctx.globalAlpha *= 0.4 * (1 - ph);
      drawBox(ctx, uC - sz / 2 + Math.sin(i * 2.1) * 0.3, v + L / 2 + 0.3 + i * 0.4 + ph * 0.7, sz, sz, sz * 0.7, "#e8d2a0", 0.05 + ph * 0.4);
      ctx.restore();
    }
    // Quatre gros pneus de sable.
    for (const b of [-0.02, 0.8]) for (const a of [0.2, 0.82]) {
      const u = x + b * W + 0.12, vv = av + a * L;
      drawDisque(ctx, u, vv, 0.5, 0.5, "#1a1a1e");
      drawDisque(ctx, u - 0.002, vv, 0.5, 0.22, "#d8d8d8");
    }
    bloc(0.06, 0.88, 0.1, 0.8, 0.2, 0.3, COQUE);            // coque basse
    bloc(0.0, 0.26, 0.14, 0.72, 0.16, 0.42, COQUE);          // nez relevé (avant)
    bloc(0.72, 0.24, 0.12, 0.76, 0.24, 0.46, "#3a3a40");     // moteur à l'air (arrière)
    bloc(0.3, 0.4, 0.2, 0.6, 0.12, 0.5, "#2a2a30");          // sièges
    // Le conducteur (humains.js) : torse nu, lunettes noires, cheveux au vent.
    const M = humain(r * 3 + 1, { enfants: false });
    bloc(0.42, 0.16, 0.36, 0.3, 0.34, 0.62, M.peau);
    bloc(0.42, 0.16, 0.38, 0.26, 0.2, 0.96, M.peau);
    bloc(0.4, 0.04, 0.36, 0.3, 0.05, 1.04, "#0d0d10");       // lunettes
    if (M.coiffure === "afro") bloc(0.46, 0.2, 0.34, 0.34, 0.14, 1.12, M.cheveux);
    else if (M.coiffure !== "chauve") bloc(0.46, 0.14, 0.36, 0.3, 0.06, 1.16, M.cheveux);
    // L'arceau : deux montants et la barre du haut.
    for (const b of [0.1, 0.84]) bloc(0.56, 0.05, b, 0.06, 0.62, 0.5, ARCEAU);
    bloc(0.56, 0.05, 0.1, 0.8, 0.06, 1.12, ARCEAU);
    for (const b of [0.18, 0.7]) bloc(-0.01, 0.03, b, 0.12, 0.08, 0.52, "#fff6c8"); // phares
  });
}

// Car scolaire de la Région (3 octobre 2026) : livrée blanche, bandeau bleu
// nuit et filet turquoise, panneau jaune « transport d'enfants » à l'avant
// et à l'arrière. Il arrive EN FACE : capot vers −v.
export function drawBus(ctx, K, uC, v, t) {
  groupe(ctx, () => {
    const L = K.long, W = K.larg, H = K.h;
    const x = uC - W / 2, av = v - L / 2;   // l'avant est côté joueur
    const bloc = (a, da, b, db, h, lift, col) => drawBox(ctx, x + b * W, av + a * L, db * W, da * L, h * H, col, lift * H);
    drawShadow(ctx, uC, v, W / 2, L / 2, 0.26);
    for (const a of [0.14, 0.8]) for (const b of [-0.01, 0.84]) { drawDisque(ctx, x + b * W + 0.12, av + a * L, 0.36, 0.36, "#1a1a1e"); drawDisque(ctx, x + b * W + 0.118, av + a * L, 0.36, 0.18, "#9a9da8"); }
    bloc(0, 1, 0, 1, 0.5, 0.14, "#f4f2ec");                  // caisse basse
    bloc(0, 1, -0.01, 1.02, 0.1, 0.22, "#1f3a78");           // bandeau bleu nuit
    bloc(0, 1, -0.012, 1.024, 0.035, 0.34, "#21b3c6");       // filet turquoise
    bloc(0.02, 0.96, 0.04, 0.92, 0.26, 0.64, "#2a3442");      // vitres
    for (let i = 0; i < 6; i++) bloc(0.1 + i * 0.15, 0.025, 0.03, 0.94, 0.26, 0.64, "#f4f2ec"); // montants
    bloc(0, 1, 0, 1, 0.1, 0.9, "#f4f2ec");                    // toit
    bloc(-0.01, 0.05, 0.06, 0.88, 0.5, 0.14, "#f4f2ec");      // face avant
    // Panneau « transport d'enfants » : carré jaune, deux silhouettes.
    for (const a of [-0.03, 1.0]) {
      bloc(a, 0.03, 0.3, 0.4, 0.18, 0.66, "#ffcf2e");
      bloc(a - 0.002, 0.034, 0.4, 0.07, 0.11, 0.69, "#1a1a1e");
      bloc(a - 0.002, 0.034, 0.55, 0.06, 0.09, 0.69, "#1a1a1e");
    }
    const nuit = getNight() > 0.2;
    for (const b of [0.08, 0.76]) bloc(-0.02, 0.03, b, 0.16, 0.08, 0.3, nuit ? "#fff6c8" : "#f4eed6");
    ctx.save(); ctx.globalAlpha *= nuit ? 0.55 : 0.22;
    drawFlat(ctx, x - 0.1, av - 4.2, W + 0.2, 4.2, "#fff2b0", true);
    ctx.restore();
  });
}

// Chasse-neige (4 octobre 2026 : « au lieu de croiser un tracteur dans ce
// biome, il faut qu'on croise un chasse-neige ») : camion orange des routes,
// lame jaune et noire, gyrophare, sel dans la benne. Il arrive EN FACE (avant
// côté −v) et rejette la neige sur le bas-côté du fond. Toit PLAT sur toute la
// longueur, à K.h : on y roule comme sur le car (rows.toitSous).
export function drawChasseNeige(ctx, K, uC, v, t) {
  groupe(ctx, () => {
    const L = K.long, W = K.larg, H = K.h;
    const x = uC - W / 2, av = v - L / 2;   // l'avant est côté joueur
    const bloc = (a, da, b, db, h, lift, col) => drawBox(ctx, x + b * W, av + a * L, db * W, da * L, h * H, col, lift * H);
    drawShadow(ctx, uC, v, W / 2, L / 2, 0.26);
    // La gerbe de neige que la lame repousse vers le fond.
    for (let i = 0; i < 6; i++) {
      const ph = (t * 2.2 + i / 6) % 1, sz = 0.16 + ph * 0.3;
      ctx.save(); ctx.globalAlpha *= 0.85 * (1 - ph);
      drawBox(ctx, x + W * 0.8 + ph * 2.4, av + 0.05 + Math.sin(i * 1.7) * 0.2 + ph * 0.6, sz, sz, sz, "#f6f8fa", 0.1 + Math.sin(Math.PI * ph) * 0.9);
      ctx.restore();
    }
    for (const a of [0.25, 0.8]) for (const b of [-0.01, 0.84]) { drawDisque(ctx, x + b * W + 0.12, av + a * L, 0.46, 0.46, "#1a1a1e"); drawDisque(ctx, x + b * W + 0.118, av + a * L, 0.46, 0.22, "#5a5d66"); }
    bloc(0.06, 0.94, 0.08, 0.84, 0.14, 0.18, "#2b2d33");      // châssis
    bloc(0.1, 0.3, 0.04, 0.92, 0.68, 0.28, "#ee7a1a");        // cabine
    bloc(0.1, 0.2, 0.02, 0.96, 0.26, 0.6, VITRE);             // vitres
    bloc(0.1, 0.3, 0.04, 0.92, 0.04, 0.96, "#c95e0c");        // toit de cabine
    bloc(0.42, 0.58, 0.02, 0.96, 0.64, 0.32, "#ee7a1a");      // benne à sel
    bloc(0.42, 0.58, 0.0, 1.0, 0.07, 0.32, "#c95e0c");        // rebord bas
    bloc(0.44, 0.54, 0.08, 0.84, 0.04, 0.96, "#e9ecef");      // le sel
    bloc(0.03, 0.08, 0.1, 0.8, 0.07, 0.08, "#2b2d33");        // bras de lame
    for (let i = 0; i < 6; i++) bloc(-0.02, 0.05, -0.06 + i * 0.187, 0.187, 0.34, 0.02, i % 2 ? "#1a1a1e" : "#f2c21c"); // la lame, à chevrons
    const on = Math.floor(t * 4) % 2 === 0;                   // gyrophare
    bloc(0.2, 0.07, 0.4, 0.2, 0.07, 1.0, on ? "#ffb21a" : "#a85a10");
    const nuit = getNight() > 0.2;
    for (const b of [0.1, 0.74]) bloc(0.08, 0.03, b, 0.16, 0.07, 0.42, nuit ? "#fff6c8" : "#f4eed6");
    ctx.save(); ctx.globalAlpha *= nuit ? 0.55 : 0.2;
    drawFlat(ctx, x - 0.1, av - 4.2, W + 0.2, 4.2, "#fff2b0", true);
    ctx.restore();
  });
}

// Skieur de fond (5 octobre 2026 : « un mec qui arrive en ski face à nous,
// en ski de fond ») : il vient EN FACE (vers −v), en pas alternatif — un ski
// glisse devant pendant que l'autre recule, le bras opposé plante son bâton
// derrière lui. Combinaison rouge, bonnet jaune à pompon.
export function drawSkieur(ctx, K, uC, v, t, r = 0) {
  // La personne sous la combinaison (humains.js, 4 octobre 2026, nuit) : sa
  // peau, sa taille (la collision lit la même), sa carrure (+10 % de base).
  const M = humain(r, { enfants: false });
  const sy = M.taille, w = M.corpulence;
  const b = (u, vv, du, dv, h, col, lift = 0) => drawBox(ctx, u, vv, du, dv, h * sy, col, lift * sy);
  const s = Math.sin(t * 5.4);
  groupe(ctx, () => {
    drawShadow(ctx, uC, v, 0.38, 0.95, 0.22);
    for (const [du, k] of [[-0.17, 1], [0.12, -1]]) {
      const dvJambe = -0.3 * s * k, dvBras = 0.3 * s * k;   // −v = vers le joueur
      b(uC + du - 0.05, v - 0.85 + dvJambe, 0.1, 1.7, 0.035, "#1f5fb8");        // ski
      b(uC + du - 0.05, v - 0.93 + dvJambe, 0.1, 0.1, 0.09, "#1f5fb8", 0.035);  // spatule
      b(uC + du - 0.07, v - 0.14 + dvJambe, 0.14, 0.3, 0.12, "#1a1a1e", 0.035); // chaussure
      b(uC + du - 0.075, v - 0.08 + dvJambe * 0.7, 0.15, 0.17 * w, 0.42, "#23252e", 0.15); // tibia
      b(uC + du - 0.085, v - 0.09 + dvJambe * 0.3, 0.17, 0.19 * w, 0.36, "#23252e", 0.55); // cuisse
      // Bras (épaule → main), puis le bâton, de la main jusqu'à la neige derrière.
      const ub = uC + (k > 0 ? -0.29 : 0.21), vMain = v - 0.12 + dvBras;
      b(ub, v - 0.14 + dvBras * 0.4, 0.09, 0.13 * w, 0.22, "#d8352a", 1.1);
      b(ub, vMain - 0.06, 0.09, 0.13 * w, 0.2, "#d8352a", 0.92);
      b(ub, vMain - 0.05, 0.09, 0.11, 0.08, "#1a1a1e", 0.88);                   // gant
      for (let i = 0; i < 8; i++) { const f = i / 7; b(ub + 0.02, vMain + f * 0.6 - 0.02, 0.04, 0.05, 0.13, "#9aa0a8", 0.9 * (1 - f)); }
    }
    b(uC - 0.21, v - 0.28 * w, 0.42, 0.4 * w, 0.5, "#d8352a", 0.88);           // buste, penché vers l'avant
    b(uC - 0.22, v - 0.29 * w, 0.44, 0.42 * w, 0.06, "#ffffff", 1.18);         // bande blanche
    b(uC - 0.14, v - 0.4, 0.28, 0.28, 0.24, M.peau, 1.38);                      // tête
    if (M.fonce) b(uC - 0.152, v - 0.39, 0.012, 0.07, 0.055, "#f4efe4", 1.49);
    b(uC - 0.156, v - 0.39, 0.012, 0.04, 0.05, BLACK, 1.5);                     // œil (côté caméra)
    if (M.barbe) b(uC - 0.146, v - 0.41, 0.292, 0.07, 0.08, M.cheveux, 1.38);
    b(uC - 0.15, v - 0.41, 0.3, 0.3, 0.13, "#f2c21c", 1.58);                    // bonnet
    b(uC - 0.05, v - 0.31, 0.1, 0.1, 0.1, "#ffffff", 1.71);                     // pompon
  }, CONTOUR_PERSO);
}

// Le PIÉTON qui marche vers le joueur (5 octobre 2026 : « sur la route, des
// piétons présents »). Même grammaire que le skieur : jambes et bras qui
// balancent le long de la route (−v = vers le joueur). Ce qu'il porte selon
// la rangée — la baguette sous le bras, le téléphone devant le nez, le
// footing, le cabas —, et en maillot sur la plage.
// ⚠️ Depuis le 4 octobre 2026 (nuit) la PERSONNE vient d'humains.js : peau,
// cheveux, coiffure, taille, corpulence, âge (« je veux des métis, des gros,
// des petits, des grands, des vieux… »). Gabarit +10 % (« ils sont trop
// fins »), cerné d'un liseré sombre (« des humains blancs sur un fond blanc »).
const HAUTS = ["#c8301c", "#7a828e", "#2f9a6a", "#1f5fb8", "#f2c21c", "#8a3fd4", "#2b2d38", "#e8742e", "#3f8a8a", "#d8d2c4"];
const BAS = ["#23252e", "#2f4f9a", "#1a1a1e", "#5a4632", "#4a5260", "#7a2e3a"];
const OBJETS_VILLE = ["baguette", "telephone", "joggeur", "cabas"];
// Sur la plage (5 octobre 2026 : « il faudrait qu'ils tiennent un ballon
// au-dessus de leur tête, qu'ils jouent avec des raquettes ») : ballon de
// plage brandi à deux mains, raquette de plage avec la balle qui rebondit
// dessus, ou serviette sur l'épaule.
const OBJETS_PLAGE = ["ballon", "raquette", "serviette"];
const MAILLOTS = ["#e13e26", "#1f8fd6", "#f2c21c", "#ff5fa2", "#2f9a6a", "#8a3fd4"];
// Ballon de plage : un disque à six quartiers qui tourne doucement.
export function ballonPlage(ctx, u, v, h, rayon, t) {
  const c = project(u, v, h), R = rayon * echelle(u);
  const q = ["#ffffff", "#e13e26", "#ffffff", "#1f8fd6", "#ffffff", "#f2c21c"];
  for (let i = 0; i < 6; i++) { ctx.fillStyle = q[i]; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, R, t * 0.8 + (i * Math.PI) / 3, t * 0.8 + ((i + 1) * Math.PI) / 3); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = Math.max(1, R * 0.08);
  ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke();
}
// Petite balle jaune (raquettes de plage).
export function balle(ctx, u, v, h, rayon = 0.07) {
  const c = project(u, v, h), R = Math.max(1.5, rayon * echelle(u));
  ctx.fillStyle = "#f2e01c"; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.fill();
}
export function drawPieton(ctx, K, uC, v, t, r, plage = false) {
  const M = humain(r, { enfants: false });
  const ri = Math.abs(Math.round(r));
  const objet = plage ? OBJETS_PLAGE[ri % 3] : M.age === "vieux" && ri % 2 === 0 ? "canne" : OBJETS_VILLE[ri % 4];
  const haut = HAUTS[(ri * 7 + 3) % HAUTS.length], bas = BAS[(ri * 5 + 1) % BAS.length];
  const maillot = MAILLOTS[(ri * 3) % MAILLOTS.length];
  const jupe = !plage && M.femme && objet !== "joggeur" && ri % 5 < 2;
  const sy = (K.h * M.taille) / 1.7;          // le modèle est dessiné pour 1,70 m
  const w = M.corpulence;                     // 1,12 = l'ancien gabarit + 12 %
  const vieux = M.age === "vieux";
  const cadence = objet === "joggeur" ? 9 : vieux ? 4.6 : 6.2;
  const ph = t * cadence + r;
  const s = Math.sin(ph);
  const amp = objet === "joggeur" ? 0.22 : vieux ? 0.09 : 0.15;
  const rebond = Math.abs(Math.cos(ph)) * (objet === "joggeur" ? 0.06 : 0.025);
  const pench = vieux ? -0.05 : 0;            // le dos un peu voûté, vers l'avant
  const H0 = 0.84 * sy + rebond, T = 0.52 * sy, HT = H0 + T, TE = 0.27 * sy;
  const peauBas = plage || jupe;
  groupe(ctx, () => {
    drawShadow(ctx, uC, v, 0.3 * w, 0.32 * w, 0.22);
    const dJ = 0.15 * Math.pow(w, 0.8), uJ = 0.12 * Math.pow(w, 0.5);
    for (const [du, k] of [[-0.16 * w, 1], [0.05, -1]]) {
      const dv = -amp * s * k;
      drawBox(ctx, uC + du, v - 0.13 + dv, uJ, 0.26, 0.08 * sy, "#1a1a1e");                                  // chaussure
      drawBox(ctx, uC + du, v - 0.07 + dv * 0.8, uJ, dJ * 0.9, 0.42 * sy, peauBas ? M.peau : bas, 0.08 * sy);  // tibia
      drawBox(ctx, uC + du, v - 0.08 + dv * 0.4, uJ + 0.01, dJ, 0.38 * sy, peauBas ? M.peau : bas, 0.46 * sy + rebond);
    }
    const dT = 0.26 * w, uT = 0.36 * Math.pow(w, 0.6);
    const vT = v - dT / 2 + pench;
    if (jupe) drawBox(ctx, uC - uT / 2 - 0.02, vT - 0.03, uT + 0.04, dT + 0.06, 0.3 * sy, bas, H0 - 0.26 * sy);
    // Buste : maillot une pièce (elle) ou slip de bain (lui) sur la plage.
    if (plage && !M.femme) drawBox(ctx, uC - uT / 2, vT, uT, dT, 0.15 * sy, maillot, H0);
    drawBox(ctx, uC - uT / 2, vT, uT, dT, plage && !M.femme ? T - 0.15 * sy : T, plage ? (M.femme ? maillot : M.peau) : haut, plage && !M.femme ? H0 + 0.15 * sy : H0);
    if (w > 1.25) drawBox(ctx, uC - uT / 2 + 0.03, vT - 0.07, uT - 0.06, 0.08, T * 0.5, plage && !M.femme ? M.peau : plage ? maillot : haut, H0 + T * 0.12); // le ventre
    const dB = 0.11 * Math.pow(w, 0.5), uBc = uC - uT / 2 - 0.08, uBf = uC + uT / 2;
    const manche = plage ? M.peau : haut;
    if (objet === "ballon") {
      // Les deux bras levés, droits, qui tiennent le ballon au-dessus de la tête.
      for (const du of [uBc, uBf]) drawBox(ctx, du, v - 0.05 + pench, 0.09, dB, 0.62 * sy, M.peau, HT - 0.1 * sy);
    } else if (objet === "raquette") {
      // Bras du fond qui balance, bras côté caméra tendu devant, raquette à plat.
      const dv = 0.18 * s;
      drawBox(ctx, uBf, v - 0.05 + dv * 0.5, 0.09, dB, 0.26 * sy, M.peau, H0 + 0.36 * sy);
      drawBox(ctx, uBf, v - 0.05 + dv, 0.09, dB, 0.24 * sy, M.peau, H0 + 0.14 * sy);
      drawBox(ctx, uBc, v - 0.32, 0.09, 0.3, 0.1, M.peau, H0 + 0.5 * sy);                        // avant-bras tendu
      drawBox(ctx, uBc - 0.01, v - 0.42, 0.06, 0.1, 0.05, "#6b4b2e", H0 + 0.52 * sy);           // manche
      drawBox(ctx, uBc - 0.08, v - 0.72, 0.22, 0.32, 0.04, "#2f6fd0", H0 + 0.53 * sy);          // la raquette
    } else {
      // Bras côté caméra (balancé) et bras du fond.
      for (const [du, k] of [[uBc, -1], [uBf, 1]]) {
        const dv = (vieux ? 0.08 : 0.18) * s * k;
        drawBox(ctx, du, v - 0.05 + dv * 0.5 + pench, 0.09, dB, 0.26 * sy, manche, H0 + 0.36 * sy);
        drawBox(ctx, du, v - 0.05 + dv + pench, 0.09, dB, 0.24 * sy, manche, H0 + 0.14 * sy);
        drawBox(ctx, du, v - 0.05 + dv + pench, 0.09, dB, 0.08, M.peau, H0 + 0.06 * sy);          // main
      }
    }
    // La tête (+ ce qu'on porte dessus).
    const td = 0.26, tw = 0.26, uH = uC - td / 2, vH = v - 0.14 + pench * 1.4;
    const chapeau = objet === "baguette" && ri % 8 < 4;
    teteVoxel(ctx, M, uH, vH, td, tw, HT, TE, { chapeau });
    if (chapeau) drawBox(ctx, uH - 0.01, vH - 0.02, td + 0.02, tw + 0.06, 0.07, "#1a1a1e", HT + TE - 0.02);  // béret
    if (objet === "baguette") drawBox(ctx, uBc - 0.03, v - 0.32, 0.07, 0.72, 0.08, "#d9a45a", H0 + 0.36 * sy); // sous le bras
    else if (objet === "telephone") {
      drawBox(ctx, uH + 0.04, vH - 0.14, 0.12, 0.03, 0.18, "#0d0d10", HT - 0.02);              // le téléphone, devant le nez
      drawBox(ctx, uH + 0.05, vH - 0.15, 0.1, 0.01, 0.15, "#7fd0ff", HT);                       // écran allumé
    } else if (objet === "joggeur") drawBox(ctx, uH - 0.01, vH, td + 0.02, tw + 0.01, 0.05, "#ffffff", HT + TE * 0.6); // bandeau
    else if (objet === "cabas") {
      drawBox(ctx, uBf + 0.02, v - 0.12, 0.08, 0.3, 0.32, "#2f6a3a", H0 - 0.18 * sy);           // le cabas, au bout du bras du fond
      drawBox(ctx, uBf + 0.03, v - 0.1, 0.06, 0.08, 0.1, "#e13e26", H0 + 0.12 * sy);           // une botte de poireaux qui dépasse
    } else if (objet === "canne") drawBox(ctx, uBc + 0.02, v - 0.28 + pench, 0.04, 0.04, H0 + 0.1 * sy, "#5a3a22");
    else if (plage) drawBox(ctx, uH - 0.02, vH - 0.015, td + 0.04, 0.04, 0.06, "#0d0d10", HT + TE * 0.5); // lunettes de soleil
    if (objet === "serviette") drawBox(ctx, uBf - 0.02, v - 0.12, 0.06, 0.3, 0.5 * sy, "#f4efe4", H0 + 0.4 * sy); // serviette sur l'épaule
  }, CONTOUR_PERSO);
  // Peints après le corps (hors du tri des boîtes) : ils sont devant/au-dessus.
  if (objet === "ballon") ballonPlage(ctx, uC - 0.03, v, HT + TE + 0.56 + 0.03 * Math.sin(t * 5 + r), 0.3, t + r);
  else if (objet === "raquette") {
    const k = Math.abs(Math.sin(t * 4.2 + r));                                                      // la balle rebondit sur la raquette
    balle(ctx, uC - 0.3, v - 0.56, H0 + 0.62 * sy + k * 0.7);
  }
}

// Feux de détresse (le bouchon, 4 octobre 2026) : les quatre coins de la
// voiture garée clignotent orange.
export function drawFeuxDetresse(ctx, K, uC, v, t) {
  if (Math.floor(t * 2.4) % 2) return;
  const L = K.long, x = uC - K.larg / 2;
  for (const dv of [-L / 2 - 0.05, L / 2 - 0.01]) for (const b of [0.04, K.larg - 0.34]) drawBox(ctx, x + b, v + dv, 0.3, 0.06, 0.14, "#ff9a1a", 0.5);
}

// Voiture : même carrosserie pour celle garée sur la route et celle qui arrive
// en face. `sens` = +1 si son capot pointe vers +v (elle s'éloigne), −1 si elle
// vient vers le joueur.
export const COULEURS_BOUCHON = [
  { caisse: "#e6e0d2", toit: "#d3cab8" },   // blanche
  { caisse: "#c8301c", toit: "#a8261a" },   // rouge
  { caisse: "#26262c", toit: "#3a3a42" },   // noire
];
export function drawVoiture(ctx, K, uCenter, v, sens, t, couleur = null) {
  groupe(ctx, () => voitureNue(ctx, K, uCenter, v, sens, t, couleur));
}
function voitureNue(ctx, K, uCenter, v, sens, t, couleur = null) {
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
  const CAISSE = couleur ? couleur.caisse : "#e6e0d2", TOIT = couleur ? couleur.toit : "#d3cab8", GRIS = "#8a8a92", LIGNE = couleur ? couleur.toit : "#bdb4a0";
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
  bloc(0.75, L - 1.5, 0.1, Wd - 0.2, 0.42, 0.92, "#5f7f9c");     // habitacle vitré, teinté : clair, on croyait voir À TRAVERS la voiture
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
// `graine` : la rangée d'origine (drawStaticTombe recule la figure qui
// bascule — la personne, elle, ne doit pas changer de tête en tombant).
export function drawStatic(ctx, kind, uCenter, r, t, graine = Math.round(r)) {
  if (kind === "costard" || kind === "fermier" || kind === "baigneur") {
    drawShadow(ctx, uCenter, r, 0.42, 0.42, 0.22);
    contour2D(ctx, (c) => personnage2D(c, kind, uCenter, r, t, graine));
    return;
  }
  groupe(ctx, () => staticNu(ctx, kind, uCenter, r, t));
}

// Tête de face, à plat (costard, fermier, baigneur) : cou, visage, cheveux
// selon la coiffure, yeux (blancs sur les peaux foncées), barbe. Repère du
// personnage : x en largeur, h en hauteur, pour 1,9 m (×k).
function tete2D(ctx, M, X, Y, k, s, { chapeau = false, lunettes = false } = {}) {
  const R = 0.18 * k * s, cx = X(0), cy = Y(1.6 * k);
  const rond = (x, h, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(x * k), Y(h * k), r * k * s, 0, Math.PI * 2); ctx.fill(); };
  const rect = (x, h, w, hh, col) => { ctx.fillStyle = col; ctx.fillRect(X(x * k), Y((h + hh) * k), w * k * s, hh * k * s); };
  const C = M.cheveux, co = M.coiffure;
  // Derrière la tête : ce qui dépasse sous les épaules ou autour.
  if (co === "long") rect(-0.21, 1.3, 0.42, 0.34, C);
  if (co === "tresses") { rect(-0.2, 1.12, 0.07, 0.5, C); rect(0.13, 1.12, 0.07, 0.5, C); }
  if (co === "afro") rond(0, 1.66, 0.25, C);
  rect(-0.065, 1.38, 0.13, 0.08, M.peau);                                  // cou
  ctx.fillStyle = M.peau; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  if (!chapeau) {
    if (co === "court" || co === "long" || co === "tresses" || co === "chignon") { ctx.fillStyle = C; ctx.beginPath(); ctx.arc(cx, Y(1.64 * k), R * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); }
    if (co === "rase") { ctx.fillStyle = C; ctx.beginPath(); ctx.arc(cx, Y(1.62 * k), R, Math.PI * 1.1, Math.PI * 1.9); ctx.fill(); }
    if (co === "chignon") rond(0, 1.86, 0.08, C);
    if (co === "chauve" && M.age === "vieux") { rect(-0.19, 1.58, 0.05, 0.1, C); rect(0.14, 1.58, 0.05, 0.1, C); }
  }
  if (lunettes) {
    ctx.fillStyle = "#0d0d10";
    ctx.fillRect(X(-0.15 * k), Y(1.66 * k), 0.13 * k * s, 0.07 * k * s); ctx.fillRect(X(0.02 * k), Y(1.66 * k), 0.13 * k * s, 0.07 * k * s);
    ctx.fillRect(X(-0.02 * k), Y(1.645 * k), 0.04 * k * s, 0.02 * k * s);
  } else {
    if (M.fonce) { rect(-0.095, 1.585, 0.07, 0.065, "#f4efe4"); rect(0.025, 1.585, 0.07, 0.065, "#f4efe4"); }
    rect(-0.08, 1.58, 0.04, 0.05, "#0d0d10"); rect(0.04, 1.58, 0.04, 0.05, "#0d0d10");
  }
  if (M.barbe) { ctx.fillStyle = C; ctx.beginPath(); ctx.arc(cx, Y(1.56 * k), R * 0.92, Math.PI * 0.08, Math.PI * 0.92); ctx.fill(); }
}

// Costard et fermier DE FACE, en 2D plat (3 octobre 2026 : « pour que ce soit
// plus logique, il faut qu'il soit de face en 2D, là il est en semi-3D » ;
// « ses bras, on dirait qu'ils sont désarticulés » ; « le paysan, pas assez
// clair »). Dessinés en vrai à l'écran, à l'échelle du monde : les bras
// PIVOTENT à l'épaule (plus de cubes qui glissent indépendamment du corps).
// La personne (peau, coiffure, taille, carrure) vient d'humains.js depuis le
// 4 octobre 2026 (nuit) ; la hauteur suit sa taille (la collision aussi).
function personnage2D(ctx, kind, uC, r, t, graine) {
  const K = KINDS[kind];
  const M = humain(graine, { enfants: false });
  const s = echelle(uC), pied = project(uC, r, 0);
  const X = (x) => pied.x + x * s, Y = (h) => pied.y - h * s;
  const costard = kind === "costard";
  const k = (K.h * M.taille) / 1.9; // tout est dessiné pour 1,9 m puis mis à l'échelle
  if (kind === "baigneur") { baigneur2D(ctx, M, X, Y, s, k, r, t); return; }
  const w = M.corpulence;           // carrure (1,1 = l'ancien gabarit + 10 %)
  const C = costard
    ? { jambe: "#23252e", buste: ["#2b2d38", "#3a3f5a", "#5a4632"][graine % 3], accent: ["#e13e26", "#1f8fd6", "#f2c21c"][graine % 3] }
    : { jambe: "#2f4f9a", buste: "#c8402c", haut: "#e8c66a", accent: "#2f4f9a" };
  const rect = (x, h, wd, hh, col) => { ctx.fillStyle = col; ctx.fillRect(X(x * k), Y((h + hh) * k), wd * k * s, hh * k * s); };
  const ep = 0.33 * w;              // demi-largeur des épaules
  const bras = (sx, ang, len, main) => {
    // Bras d'une pièce, pivot à l'épaule (sx, 1.36) ; ang = 0 le long du corps.
    const e = 0.085 * Math.sqrt(w);
    ctx.save();
    ctx.translate(X(sx * k), Y(1.36 * k)); ctx.rotate(ang);
    ctx.fillStyle = C.buste; ctx.fillRect(-e * k * s, 0, 2 * e * k * s, len * k * s);
    ctx.fillStyle = M.peau; ctx.beginPath(); ctx.arc(0, (len + 0.05) * k * s, 0.09 * k * s, 0, Math.PI * 2); ctx.fill();
    if (main) main((len + 0.05) * k * s);
    ctx.restore();
  };
  ctx.save();
  ctx.lineJoin = "round";
  // Jambes et chaussures.
  const jl = 0.19 * Math.pow(w, 0.7), jx = 0.03 * w;
  rect(-jx - jl, 0.06, jl, 0.74, C.jambe); rect(jx, 0.06, jl, 0.74, C.jambe);
  rect(-jx - jl - 0.03, 0, jl + 0.04, 0.08, "#0d0d10"); rect(jx - 0.01, 0, jl + 0.04, 0.08, "#0d0d10");
  if (costard) {
    const f = Math.sin(t * 7 + r), g = Math.sin(t * 5.3 + r * 1.7);
    // Bras gauche levé qui s'agite (au-dessus de la tête), bras droit avec la mallette.
    bras(-ep, Math.PI - 0.5 + 0.35 * f, 0.6);
    rect(-ep - 0.01, 0.78, 2 * ep + 0.02, 0.62, C.buste);                  // veste
    if (w > 1.25) { ctx.fillStyle = C.buste; ctx.beginPath(); ctx.ellipse(X(0), Y(1.0 * k), (ep + 0.05) * k * s, 0.24 * k * s, 0, 0, Math.PI * 2); ctx.fill(); } // le ventre
    ctx.fillStyle = "#f4efe4"; ctx.beginPath(); ctx.moveTo(X(-0.12 * k), Y(1.4 * k)); ctx.lineTo(X(0.12 * k), Y(1.4 * k)); ctx.lineTo(X(0), Y(1.1 * k)); ctx.fill(); // chemise
    rect(-0.03, 1.02, 0.06, 0.34, C.accent);                                // cravate
    bras(ep, -0.25 + 0.3 * g, 0.6, (d) => { ctx.fillStyle = "#6b3a1a"; ctx.fillRect(-0.2 * k * s, d, 0.4 * k * s, 0.28 * k * s); ctx.fillStyle = "#3e2210"; ctx.fillRect(-0.06 * k * s, d - 0.04 * k * s, 0.12 * k * s, 0.05 * k * s); });
    tete2D(ctx, M, X, Y, k, s);
  } else {
    const f = Math.sin(t * 3 + r);
    rect(-ep, 0.78, 2 * ep, 0.62, C.buste);                                 // chemise rouge
    ctx.fillStyle = "rgba(0,0,0,0.18)";                                     // carreaux
    for (let i = 0; i < 3; i++) ctx.fillRect(X(-ep * k), Y((0.9 + i * 0.18) * k), 2 * ep * k * s, 0.05 * k * s);
    rect(-ep + 0.08, 0.78, 2 * ep - 0.16, 0.4, C.jambe);                    // salopette
    rect(-ep + 0.12, 1.18, 0.07, 0.22, C.jambe); rect(ep - 0.19, 1.18, 0.07, 0.22, C.jambe);
    bras(-ep + 0.01, 0.25 + 0.1 * f, 0.58);
    // Fourche tenue droite, levée.
    bras(ep - 0.01, -0.35 - 0.1 * f, 0.58, (d) => {
      ctx.fillStyle = "#6b4b2e"; ctx.fillRect(-0.03 * k * s, d - 1.3 * k * s, 0.06 * k * s, 1.7 * k * s);
      ctx.fillStyle = "#8a8d98"; ctx.fillRect(-0.14 * k * s, d - 1.34 * k * s, 0.28 * k * s, 0.05 * k * s);
      for (const x of [-0.14, -0.035, 0.07]) ctx.fillRect(x * k * s, d - 1.6 * k * s, 0.05 * k * s, 0.28 * k * s);
    });
    tete2D(ctx, M, X, Y, k, s, { chapeau: true });
    // Grand chapeau de paille : bord large + calotte.
    ctx.fillStyle = C.haut; ctx.fillRect(X(-0.36 * k), Y(1.76 * k), 0.72 * k * s, 0.07 * k * s);
    ctx.fillRect(X(-0.18 * k), Y(1.92 * k), 0.36 * k * s, 0.17 * k * s);
    ctx.fillStyle = "#b8402c"; ctx.fillRect(X(-0.18 * k), Y(1.8 * k), 0.36 * k * s, 0.04 * k * s);
  }
  ctx.restore();
}
// Le BAIGNEUR de la plage (5 octobre 2026), de face en 2D comme le costard :
// slip de bain (maillot une pièce pour elle), lunettes de soleil — très Vice
// City. Trois poses selon la rangée : raquette levée, ballon de plage brandi à
// deux mains, ou biceps gonflés (il frime, il ne bougera pas).
function baigneur2D(ctx, M, X, Y, s, k, r, t) {
  const ri = Math.abs(Math.round(r));
  const PEAU = M.peau, OMBRE = M.peauOmbre, w = M.corpulence;
  const SLIP = ["#e13e26", "#1f8fd6", "#f2c21c", "#ff5fa2"][ri % 4];
  const rect = (x, h, wd, hh, col) => { ctx.fillStyle = col; ctx.fillRect(X(x * k), Y((h + hh) * k), wd * k * s, hh * k * s); };
  const ep = 0.33 * w;
  const membre = (sx, sh, ang, len, main) => {
    const e = 0.085 * Math.sqrt(w);
    ctx.save();
    ctx.translate(X(sx * k), Y(sh * k)); ctx.rotate(ang);
    ctx.fillStyle = PEAU; ctx.fillRect(-e * k * s, 0, 2 * e * k * s, len * k * s);
    ctx.beginPath(); ctx.arc(0, (len + 0.05) * k * s, 0.09 * k * s, 0, Math.PI * 2); ctx.fill();
    if (main) main((len + 0.05) * k * s);
    ctx.restore();
  };
  const f = Math.sin(t * 4 + r);
  ctx.save();
  // Tongs, jambes, slip.
  const jl = 0.19 * Math.pow(w, 0.7), jx = 0.03 * w;
  rect(-jx - jl - 0.04, 0, jl + 0.05, 0.05, "#1f8fd6"); rect(jx - 0.01, 0, jl + 0.05, 0.05, "#1f8fd6");
  rect(-jx - jl, 0.05, jl, 0.78, PEAU); rect(jx, 0.05, jl, 0.78, PEAU);
  // Torse : bronzé, pectoraux et abdos en ombre (lui) ; maillot une pièce (elle).
  rect(-ep, 0.92, 2 * ep, 0.48, PEAU);
  if (w > 1.25) { ctx.fillStyle = PEAU; ctx.beginPath(); ctx.ellipse(X(0), Y(1.02 * k), (ep + 0.04) * k * s, 0.22 * k * s, 0, 0, Math.PI * 2); ctx.fill(); }
  rect(-ep + 0.06, 0.72, 2 * ep - 0.12, 0.2, SLIP);
  if (M.femme) {
    rect(-ep + 0.05, 0.9, 2 * ep - 0.1, 0.4, SLIP);
    rect(-ep + 0.1, 1.28, 0.06, 0.12, SLIP); rect(ep - 0.16, 1.28, 0.06, 0.12, SLIP);   // bretelles
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillRect(X((-ep + 0.06) * k), Y(0.9 * k), (2 * ep - 0.12) * k * s, 0.025 * k * s); // ceinture
    ctx.fillStyle = OMBRE;
    ctx.fillRect(X(-0.2 * k), Y(1.3 * k), 0.17 * k * s, 0.03 * k * s); ctx.fillRect(X(0.03 * k), Y(1.3 * k), 0.17 * k * s, 0.03 * k * s);
    if (w < 1.25) for (let i = 0; i < 3; i++) ctx.fillRect(X(-0.012 * k), Y((1.0 + i * 0.08) * k), 0.024 * k * s, 0.05 * k * s);
    // Chaîne en or.
    ctx.strokeStyle = "#f2c21c"; ctx.lineWidth = Math.max(1, 0.03 * k * s);
    ctx.beginPath(); ctx.moveTo(X(-0.12 * k), Y(1.4 * k)); ctx.quadraticCurveTo(X(0), Y(1.22 * k), X(0.12 * k), Y(1.4 * k)); ctx.stroke();
  }
  if (ri % 3 === 2) {
    // Raquettes de plage : bras levé, raquette en l'air, la balle qui rebondit
    // dessus (le bras pointe en haut à droite : la raquette finit vers 0,7 ; 2,2).
    const rebond = Math.abs(Math.sin(t * 4 + r)), u = k * s;
    membre(-ep, 1.36, 0.35 + 0.08 * f, 0.6);
    membre(ep, 1.36, -(Math.PI - 0.45) + 0.06 * f, 0.6, (d) => {
      ctx.fillStyle = "#6b4b2e"; ctx.fillRect(-0.03 * u, d - 0.02 * u, 0.06 * u, 0.16 * u);
      ctx.fillStyle = "#2f6fd0"; ctx.beginPath(); ctx.ellipse(0, d + 0.3 * u, 0.17 * u, 0.2 * u, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = "#f2e01c"; ctx.beginPath(); ctx.arc(X(0.7 * k), Y((2.5 + 0.65 * rebond) * k), Math.max(1.5, 0.07 * u), 0, Math.PI * 2); ctx.fill();
  } else if (ri % 3 === 0) {
    // Le ballon de plage, brandi au-dessus de la tête.
    const by = 2.12 + 0.05 * f;
    membre(-ep, 1.36, Math.PI - 0.35, 0.62);
    membre(ep, 1.36, -(Math.PI - 0.35), 0.62);
    const cx = X(0), cy = Y(by * k), R = 0.26 * k * s;
    const quartiers = ["#ffffff", "#e13e26", "#ffffff", "#1f8fd6", "#ffffff", "#f2c21c"];
    for (let i = 0; i < 6; i++) { ctx.fillStyle = quartiers[i]; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, t * 0.6 + i * Math.PI / 3, t * 0.6 + (i + 1) * Math.PI / 3); ctx.closePath(); ctx.fill(); }
  } else {
    // Biceps gonflés : avant-bras levés, poings serrés.
    const p = 0.08 * f;
    for (const [sx, sg] of [[-ep, 1], [ep, -1]]) {
      membre(sx, 1.36, sg * (Math.PI / 2 + 0.15), 0.3, (d) => {
        ctx.fillStyle = OMBRE; ctx.beginPath(); ctx.arc(0, d * 0.45, 0.11 * k * s, 0, Math.PI * 2); ctx.fill();      // le biceps
        ctx.fillStyle = PEAU; ctx.save(); ctx.translate(0, d); ctx.rotate(-sg * (Math.PI / 2 + 0.3 + p));
        ctx.fillRect(-0.07 * k * s, 0, 0.14 * k * s, 0.32 * k * s);
        ctx.beginPath(); ctx.arc(0, 0.36 * k * s, 0.09 * k * s, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    }
  }
  // Tête, cheveux, lunettes de soleil, sourire.
  tete2D(ctx, M, X, Y, k, s, { lunettes: true });
  ctx.fillStyle = "#7a3a1a"; ctx.fillRect(X(-0.05 * k), Y(1.52 * k), 0.1 * k * s, 0.025 * k * s);
  ctx.restore();
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
    B(0.12 + wob, 0.12, 0.5, 0.62, 0.42, ROUSSE, 0.2 + bob);
    B(0.2 + wob, 0.04, 0.3, 0.1, 0.22, ROUSSE_AILE, 0.3 + bob);             // l'aile, côté caméra
    B(0.56 + wob, 0.2, 0.26, 0.42, 0.3, ROUSSE, 0.58 + bob);
    B(0.8 + wob, 0.3, 0.16, 0.2, 0.09, "#f2c02c", 0.68 + bob);
    B(0.66 + wob, 0.18, 0.06, 0.06, 0.08, BLACK, 0.72 + bob);               // l'œil
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
  } else if (kind === "costard") {
    // Costume anthracite, chemise blanche, cravate rouge, mallette : il gesticule
    // sur place, bras qui moulinent (déphasés), la mallette suit la main.
    const f = Math.sin(t * 9 + r), g = Math.sin(t * 7.3 + r * 1.7);
    B(0.32, 0.14, 0.28, 0.28, 0.45, "#23252e");
    B(0.32, 0.58, 0.28, 0.28, 0.45, "#23252e");
    B(0.3, 0.14, 0.34, 0.3, 0.04, "#0d0d10");
    B(0.3, 0.58, 0.34, 0.3, 0.04, "#0d0d10");
    B(0.22, 0.08, 0.52, 0.84, 0.34, "#2b2d38", 0.45);
    B(0.4, 0.02, 0.18, 0.1, 0.16, "#f4efe4", 0.63);                   // chemise
    B(0.45, 0.0, 0.08, 0.06, 0.2, "#e13e26", 0.52);                    // cravate
    B(0.34, 0.28, 0.3, 0.44, 0.13, "#d69a68", 0.79);                   // tête
    B(0.32, 0.26, 0.34, 0.48, 0.04, "#2a1a10", 0.92);                  // cheveux
    B(0.4 + 0.22 * f, -0.14, 0.16, 0.14, 0.3, "#2b2d38", 0.5 + 0.22 * f);
    B(0.4 + 0.22 * f, -0.14, 0.16, 0.14, 0.05, "#d69a68", 0.8 + 0.22 * f);
    B(0.3 + 0.22 * f, -0.22, 0.36, 0.08, 0.15, "#6b3a1a", 0.36 + 0.22 * f); // mallette
    B(0.4 - 0.22 * g, 1.0, 0.16, 0.14, 0.3, "#2b2d38", 0.52 + 0.24 * g);
    B(0.4 - 0.22 * g, 1.0, 0.16, 0.14, 0.05, "#d69a68", 0.82 + 0.24 * g);
  } else if (kind === "bonhomme") {
    // Le gros bonhomme de neige de la montagne (4 octobre 2026 : « un
    // bonhomme de neige [...] gros, presque de la taille d'un bus ») : trois
    // boules arrondies (deux boîtes croisées chacune), regard et nez carotte
    // vers le joueur (−v), écharpe rouge au cou, chapeau, bras en branches.
    const NEIGE = "#f4f7fa", BRANCHE = "#5a3f26", ROUGE = "#d33a2a";
    const boule = (a, w, h, lift) => {
      const m = (1 - w) / 2;
      B(a + w * 0.125, m, w * 0.75, w, h, NEIGE, lift);
      B(a, m + w * 0.125, w, w * 0.75, h * 0.86, NEIGE, lift + h * 0.07);
    };
    boule(0, 1, 0.38, 0);
    boule(0.14, 0.72, 0.28, 0.38);
    B(0.43, 0.12, 0.05, 0.02, 0.035, BLACK, 0.45);                     // boutons
    B(0.43, 0.12, 0.05, 0.02, 0.035, BLACK, 0.54);
    B(0.22, 0.22, 0.56, 0.56, 0.06, ROUGE, 0.64);                      // écharpe
    B(0.3, 0.2, 0.1, 0.03, 0.2, ROUGE, 0.46);                          // son pan
    boule(0.25, 0.5, 0.24, 0.68);
    B(0.62, 0.23, 0.06, 0.02, 0.05, BLACK, 0.8);                       // les yeux
    B(0.745, 0.32, 0.02, 0.08, 0.05, BLACK, 0.8);
    B(0.745, 0.6, 0.02, 0.08, 0.05, BLACK, 0.8);
    B(0.75, 0.45, 0.2, 0.1, 0.05, "#f08a1c", 0.75);                    // la carotte
    B(0.22, 0.22, 0.56, 0.56, 0.03, BLACK, 0.9);                       // chapeau
    B(0.31, 0.31, 0.38, 0.38, 0.13, BLACK, 0.93);
    B(0.3, 0.3, 0.4, 0.4, 0.03, ROUGE, 0.94);
    B(0.8, 0.47, 0.18, 0.05, 0.03, BRANCHE, 0.54);                     // bras
    B(0.93, 0.47, 0.05, 0.05, 0.1, BRANCHE, 0.57);
    B(0.02, 0.47, 0.18, 0.05, 0.03, BRANCHE, 0.56);
    B(0.02, 0.47, 0.05, 0.05, 0.1, BRANCHE, 0.59);
  } else if (kind === "botte") {
    B(0, 0, 1, 1, 1, "#d0a84a");
    // Liens de ficelle en SAILLIE (29 septembre 2026 : « on voit les trois
    // couches en 3D ») : à ras des faces, ils se battaient avec elles.
    B(-0.03, -0.03, 1.06, 1.06, 0.06, "#a8862f", 0.33);
    B(-0.03, -0.03, 1.06, 1.06, 0.06, "#a8862f", 0.7);
  } else if (kind === "voiture") {
    drawVoiture(ctx, K, uCenter, r, 1, t);
  } else if (kind === "chat") {
    // Plus de gris : il se perdait sur l'asphalte (« les chats gris, on ne les
    // voit pas assez »). Noir, blanc ou roux foncé, et une tache de contraste.
    const noir = ri % 3 === 0;
    // Plus de chat NOIR (30 septembre 2026 : « quand il y a un chat et qu'on est
    // dans le biome de la nuit, on ne se rend pas du tout compte qu'il y a un
    // chat ») : roux vif, blanc, ou tigré orange.
    const col = noir ? "#e0701e" : ri % 3 === 1 ? "#f4efe4" : "#c85a1a";
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
  const M = humain(Math.round(v) * 5 + 2, { enfants: false });
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
    drawBox(ctx, x + 0.12, y + 0.14, 0.28, 0.36, 0.28, M.peau, 1.42);
    if (M.fonce) drawBox(ctx, x + 0.11, y + 0.06, 0.32, 0.07, 0.07, "#f4efe4", 1.575);
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
  const S = 1.4; // même agrandissement que la poule posée (rows.KINDS)
  const flap = Math.abs(Math.sin(t * 20)) * 0.14 * S;
  const x = u - 0.3 * S, y = v - 0.32 * S;
  const tete = sens < 0 ? y - 0.02 * S : y + 0.42 * S;
  const b = (du, dv, a, bb, h, c, l) => drawBox(ctx, x + du * S, dv, a * S, bb * S, h * S, c, l);
  b(0.14, y + 0.14 * S, 0.32, 0.36, 0.34, ROUSSE, lift + 0.16 * S);
  b(0.2, tete, 0.2, 0.22, 0.24, ROUSSE, lift + 0.42 * S);
  b(0.24, sens < 0 ? tete - 0.1 * S : tete + 0.22 * S, 0.12, 0.1, 0.07, "#f2c02c", lift + 0.5 * S);
  b(0.24, tete + 0.06 * S, 0.12, 0.1, 0.1, "#e13e26", lift + 0.66 * S);
  b(0.08, y + 0.2 * S, 0.06, 0.24, 0.14, ROUSSE_AILE, lift + 0.3 * S + flap);
  b(0.46, y + 0.2 * S, 0.06, 0.24, 0.14, ROUSSE_AILE, lift + 0.3 * S + flap);
  if (lift < 0.5) { b(0.22, y + 0.22 * S, 0.06, 0.06, (lift + 0.16 * S) / S, ORANGE, 0); b(0.34, y + 0.34 * S, 0.06, 0.06, (lift + 0.16 * S) / S, ORANGE, 0); }
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
  drawStatic(ctx, kind, uCenter, r + recul, t, Math.round(r));
  ctx.restore();
}
