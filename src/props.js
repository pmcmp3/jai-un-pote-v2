// props.js — Obstacles en cubes (scene.drawBox), vue de PROFIL.
//
// ⚠️ TOUT EST À L'ÉCHELLE : 1 unité ≈ 1 mètre, comme le cycliste (1,8 u de
// haut, 1,24 u de long). La voiture fait 3,9 × 1,55 (une berline), le tracteur
// 4,2 × 2,3, la vache 2,3 × 1,5 : sur la route, le plus gros objet est
// toujours un véhicule, jamais un animal. Les tailles vivent dans rows.KINDS
// et le dessin les SUIT (chaque modèle est construit à partir de K.long /
// K.larg / K.h), pour qu'une boîte de collision ne puisse pas mentir sur ce
// qu'on voit.
//
// Le mouton fait un 360 sur lui-même : vraie rotation 3D autour de
// l'axe vertical, via scene.drawBoxR.

import { drawBox, drawShadow, drawFlat, drawDisque, getNight, project, groupe, echelle, CONTOUR_PERSO, teteVoxel } from "./scene.js";
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

// Tracteur SUR la route, de profil, capot vers +v (il roule dans le sens du
// joueur, on le rattrape). `bloc(a, da, b, db, h, lift)` : `a`
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

// Le BUGGY de la plage (remplace le tracteur dans ce biome) : coque rose
// bonbon façon Miami, gros pneus de sable, arceau de sécurité
// turquoise, un conducteur à lunettes noires. Il vient en face (avant vers −v).
const BUGGY = ["#ff5fa2", "#ffb347", "#36c6d0"];
export function drawBuggy(ctx, K, uC, v, t, r = 0) {
  groupe(ctx, () => {
    const L = K.long, W = K.larg, H = K.h;
    const x = uC - W / 2, av = v - L / 2;
    const bloc = (a, da, b, db, h, lift, col) => drawBox(ctx, x + b * W, av + a * L, db * W, da * L, h * H, col, lift * H);
    // Couleur tirée de la RANGÉE, jamais de v : il roule, sa coque changerait
    // de couleur en route.
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

// Car scolaire de la Région : livrée blanche, bandeau bleu
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

// Chasse-neige (remplace le tracteur dans le biome montagne) : camion orange
// des routes, lame jaune et noire, gyrophare, sel dans la benne. Il arrive EN
// FACE (avant côté −v) et rejette la neige sur le bas-côté du fond. Toit PLAT
// sur toute la longueur, à K.h : on y roule comme sur le car (rows.toitSous).
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
    // ⚠️ Cubes EMPILÉS, jamais imbriqués : deux cubes qui s'interpénètrent
    // n'ont pas d'ordre de peinture (scene.groupe) — les vitres disparaissaient
    // dans la cabine et le dessus du rebord se peignait sur la benne.
    bloc(0.06, 0.94, 0.08, 0.84, 0.14, 0.18, "#2b2d33");      // châssis (0,18 → 0,32)
    bloc(0.1, 0.3, 0.04, 0.92, 0.28, 0.32, "#ee7a1a");        // bas de cabine (→ 0,60)
    bloc(0.1, 0.03, 0.04, 0.92, 0.26, 0.6, "#ee7a1a");        // montant avant
    bloc(0.13, 0.24, 0.04, 0.92, 0.26, 0.6, VITRE);           // vitres (→ 0,86)
    bloc(0.37, 0.03, 0.04, 0.92, 0.26, 0.6, "#ee7a1a");       // montant arrière
    bloc(0.1, 0.3, 0.04, 0.92, 0.1, 0.86, "#ee7a1a");         // haut de cabine (→ 0,96)
    bloc(0.1, 0.3, 0.04, 0.92, 0.04, 0.96, "#c95e0c");        // toit de cabine (→ 1)
    bloc(0.42, 0.58, 0.0, 1.0, 0.07, 0.32, "#c95e0c");        // rebord bas (→ 0,39)
    bloc(0.42, 0.58, 0.02, 0.96, 0.57, 0.39, "#ee7a1a");      // benne à sel (→ 0,96)
    bloc(0.44, 0.54, 0.08, 0.84, 0.04, 0.96, "#e9ecef");      // le sel (→ 1)
    bloc(0.03, 0.07, 0.1, 0.8, 0.07, 0.08, "#2b2d33");        // bras de lame
    for (let i = 0; i < 6; i++) bloc(-0.02, 0.05, -0.06 + i * 0.187, 0.187, 0.34, 0.02, i % 2 ? "#1a1a1e" : "#f2c21c"); // la lame, à chevrons
    const on = Math.floor(t * 4) % 2 === 0;                   // gyrophare
    bloc(0.2, 0.07, 0.4, 0.2, 0.07, 1.0, on ? "#ffb21a" : "#a85a10");
    const nuit = getNight() > 0.2;
    for (const b of [0.1, 0.74]) bloc(0.07, 0.03, b, 0.16, 0.07, 0.42, nuit ? "#fff6c8" : "#f4eed6");
    ctx.save(); ctx.globalAlpha *= nuit ? 0.55 : 0.2;
    drawFlat(ctx, x - 0.1, av - 4.2, W + 0.2, 4.2, "#fff2b0", true);
    ctx.restore();
  });
}

// Skieur de fond : il vient EN FACE (vers −v), en pas alternatif — un ski
// glisse devant pendant que l'autre recule, le bras opposé plante son bâton
// derrière lui. Combinaison rouge, bonnet jaune à pompon.
export function drawSkieur(ctx, K, uC, v, t, r = 0) {
  // La personne sous la combinaison (humains.js) : sa peau, sa taille (la
  // collision lit la même), sa carrure.
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

// Le PIÉTON qui marche vers le joueur. Même grammaire que le skieur : jambes
// et bras qui balancent le long de la route (−v = vers le joueur). Ce qu'il porte selon
// la rangée — la baguette sous le bras, le téléphone devant le nez, le
// footing, le cabas —, et en maillot sur la plage.
// ⚠️ La PERSONNE vient d'humains.js : peau, cheveux, coiffure, taille,
// corpulence, âge. Cernée d'un liseré sombre pour se détacher sur les fonds
// clairs.
const HAUTS = ["#c8301c", "#7a828e", "#2f9a6a", "#1f5fb8", "#f2c21c", "#8a3fd4", "#2b2d38", "#e8742e", "#3f8a8a", "#d8d2c4"];
const BAS = ["#23252e", "#2f4f9a", "#1a1a1e", "#5a4632", "#4a5260", "#7a2e3a"];
const OBJETS_VILLE = ["baguette", "telephone", "joggeur", "cabas"];
// Sur la plage : ballon de plage brandi à deux mains, raquette de plage avec
// la balle qui rebondit dessus, ou serviette sur l'épaule.
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
  const w = M.corpulence;                     // × la largeur nominale du modèle
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

// Feux de détresse (le bouchon) : les quatre coins de la
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
  // Une caisse, un habitacle VITRÉ avec trois montants, un toit plat clair (on
  // s'y pose), des pare-chocs gris fins, des feux aux quatre coins. Pas de
  // passages de roue ni de pare-chocs noirs sur toute la largeur : vus de
  // biais, ils font de grandes bandes noires en travers de la caisse.
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
  bloc(0.75, L - 1.5, 0.1, Wd - 0.2, 0.42, 0.92, "#5f7f9c");     // habitacle vitré, teinté : clair, on croirait voir À TRAVERS la voiture
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
  if (kind === "costard" || kind === "fermier" || kind === "baigneur") { debout(ctx, kind, uCenter, r, t, graine); return; }
  if (kind === "mouette") { groupe(ctx, () => drawMouette(ctx, uCenter, r, t)); return; }
  groupe(ctx, () => staticNu(ctx, kind, uCenter, r, t));
}

// La MOUETTE, en cubes, tournée vers le joueur (tête côté −v), qui plane dans
// sa boîte de collision (KINDS.mouette : de `bas` à `h`) en battant des ailes
// — une aile de chaque côté du corps, jamais imbriquée (scene.groupe). Son
// ombre au sol dit où elle est.
function drawMouette(ctx, u, r, t) {
  const K = KINDS.mouette, ph = t * 9 + r * 1.7;
  const hc = (K.bas + K.h) / 2 - 0.12 + Math.sin(ph * 0.35) * 0.05;
  drawShadow(ctx, u, r, 0.35, 0.4, 0.12);
  drawBox(ctx, u - 0.18, r - 0.32, 0.36, 0.66, 0.26, "#f7f7f2", hc - 0.13);             // corps
  drawBox(ctx, u - 0.13, r + 0.34, 0.26, 0.2, 0.09, "#cfd4db", hc - 0.02);               // queue
  drawBox(ctx, u - 0.13, r - 0.56, 0.26, 0.24, 0.24, "#ffffff", hc + 0.02);              // tête
  drawBox(ctx, u - 0.05, r - 0.68, 0.1, 0.12, 0.07, "#f2b21c", hc + 0.08);               // bec
  drawBox(ctx, u - 0.14, r - 0.5, 0.01, 0.06, 0.06, "#1a1a1e", hc + 0.14);               // œil
  // Les ailes : deux segments de part et d'autre, le bout bat plus que l'épaule.
  const s = Math.sin(ph);
  for (const sens of [-1, 1]) {
    const u1 = sens < 0 ? u - 0.18 - 0.32 : u + 0.18, u2 = sens < 0 ? u1 - 0.3 : u1 + 0.32;
    drawBox(ctx, u1, r - 0.18, 0.32, 0.4, 0.06, "#c9ced6", hc + 0.08 + 0.12 * s);
    drawBox(ctx, u2, r - 0.14, 0.3, 0.34, 0.06, "#2b2d33", hc + 0.08 + 0.3 * s);
  }
}

// Les personnages DEBOUT — costard, fermier, baigneur — en CUBES, de profil,
// tournés vers le joueur, dans le même univers que le cycliste et les
// piétons : même corps que le piéton (jambes, buste, tête teteVoxel, liseré),
// mais planté là, qui respire, et ce qui le fait reconnaître — la mallette et
// le bras qui s'agite, la fourche et le chapeau de paille, le slip et le ballon.
// ⚠️ Les bras sont une CHAÎNE de cubes qui pivote à l'épaule (brasCubes) :
// d'une pièce, jamais désarticulés. Hauteur = K.h × taille de la personne,
// chapeau compris : ce qu'on voit est ce que la collision juge.
const COSTARDS = ["#2b2d38", "#3a3f5a", "#5a4632"], CRAVATES = ["#e13e26", "#1f8fd6", "#f2c21c"];
const SLIPS = ["#e13e26", "#1f8fd6", "#f2c21c", "#ff5fa2"];
// angle : 0 = le bras pend, π/2 = tendu vers le joueur (−v), π = levé.
function brasCubes(ctx, u, vE, hE, angle, long, manche, peau, epais = 0.1) {
  const dv = -Math.sin(angle), dh = -Math.cos(angle);
  const n = Math.max(3, Math.round(long / 0.09));
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    drawBox(ctx, u, vE + dv * long * f - epais / 2, 0.09, epais, epais, manche, hE + dh * long * f - epais / 2);
  }
  const vM = vE + dv * (long + 0.04), hM = hE + dh * (long + 0.04);
  drawBox(ctx, u, vM - 0.05, 0.09, 0.1, 0.1, peau, hM - 0.05);   // la main
  return { v: vM, h: hM };
}
function debout(ctx, kind, uC, v, t, graine) {
  const K = KINDS[kind];
  const M = humain(graine, { enfants: false });
  const ri = Math.abs(graine), w = M.corpulence, phase = t + ri * 0.37;
  // Échelle du corps (dessiné pour 1,70 m, tête en haut à 1,63) : le sommet
  // — chapeau de paille compris pour le fermier — tombe sur K.h × taille.
  const chapeau = kind === "fermier" ? 0.17 : 0;
  const sy = (K.h * M.taille - chapeau) / 1.63;
  const souffle = 0.012 * Math.sin(phase * 2.2);
  const H0 = 0.84 * sy, T = 0.52 * sy, HT = H0 + T + souffle, TE = 0.27 * sy;
  const dT = 0.26 * w, uT = 0.36 * Math.pow(w, 0.6), vT = v - dT / 2;
  const uBc = uC - uT / 2 - 0.08, uBf = uC + uT / 2;           // bras côté caméra, bras du fond
  const vE = v - 0.02, hE = HT - 0.07, L = 0.6 * sy;            // l'épaule, la longueur du bras
  const td = 0.26, tw = 0.26, uH = uC - td / 2, vH = v - 0.14;
  const dJ = 0.15 * Math.pow(w, 0.8), uJ = 0.12 * Math.pow(w, 0.5);
  const jambes = (bas, chaussure, hChaussure = 0.08 * sy) => {
    for (const du of [-0.16 * w, 0.05]) {
      drawBox(ctx, uC + du, v - 0.13, uJ, 0.26, hChaussure, chaussure);
      drawBox(ctx, uC + du, v - 0.07, uJ, dJ * 0.9, 0.42 * sy, bas, 0.08 * sy);
      drawBox(ctx, uC + du, v - 0.08, uJ + 0.01, dJ, 0.38 * sy, bas, 0.46 * sy);
    }
  };
  const ventre = (col) => { if (w > 1.25) drawBox(ctx, uC - uT / 2 + 0.03, vT - 0.07, uT - 0.06, 0.08, T * 0.5, col, H0 + T * 0.12); };
  let apres = null;
  groupe(ctx, () => {
    drawShadow(ctx, uC, v, 0.3 * w, 0.32 * w, 0.22);
    if (kind === "costard") {
      // Le costard : veste qui descend sous la taille, col blanc et cravate
      // devant ; la mallette au bout du bras du fond ; l'autre bras s'agite
      // au-dessus de la tête, dans tous les sens.
      const tissu = COSTARDS[ri % 3], cravate = CRAVATES[ri % 3];
      jambes(tissu, "#1a1a1e");
      const m = brasCubes(ctx, uBf, vE, hE, 0.14 + 0.05 * Math.sin(phase * 3.1), L, tissu, M.peau);
      drawBox(ctx, uBf - 0.02, m.v - 0.22, 0.13, 0.44, 0.3, "#6b3a1a", m.h - 0.34);              // la mallette
      drawBox(ctx, uBf + 0.01, m.v - 0.07, 0.07, 0.14, 0.05, "#3e2210", m.h - 0.05);             // sa poignée
      drawBox(ctx, uC - uT / 2, vT, uT, dT, T + 0.1 * sy, tissu, H0 - 0.1 * sy);                 // la veste
      ventre(tissu);
      drawBox(ctx, uC - uT / 2 + 0.04, vT - 0.012, uT - 0.08, 0.02, 0.16 * sy, "#f4efe4", HT - 0.16 * sy); // le col
      drawBox(ctx, uC - 0.035, vT - 0.022, 0.07, 0.02, 0.36 * sy, cravate, HT - 0.4 * sy);        // la cravate
      brasCubes(ctx, uBc, vE, hE, 2.25 + 0.5 * Math.sin(phase * 7), L, tissu, M.peau);
      teteVoxel(ctx, M, uH, vH, td, tw, HT, TE);
    } else if (kind === "fermier") {
      // Le fermier : bottes, salopette bleue (bavette devant, bretelles),
      // chemise rouge à carreaux, chapeau de paille ; il tient sa fourche
      // plantée devant lui, l'autre bras ballant.
      const BLEU = "#2f4f9a", ROUGE = "#c8402c";
      jambes(BLEU, "#4a3220", 0.14 * sy);
      brasCubes(ctx, uBf, vE, hE, 0.12 + 0.06 * Math.sin(phase * 3), L, ROUGE, M.peau);
      drawBox(ctx, uC - uT / 2, vT, uT, dT, T, ROUGE, H0);                                         // la chemise
      for (const f of [0.38, 0.72]) drawBox(ctx, uC - uT / 2 - 0.005, vT - 0.005, uT + 0.01, dT + 0.01, 0.035, "#9a2a1c", H0 + T * f); // les carreaux
      drawBox(ctx, uC - uT / 2 - 0.008, vT - 0.008, uT + 0.016, dT + 0.016, T * 0.28, BLEU, H0);  // le haut de la salopette
      drawBox(ctx, uC - uT / 2 + 0.03, vT - 0.02, uT - 0.06, 0.04, T * 0.72, BLEU, H0);           // la bavette, devant
      drawBox(ctx, uC - uT / 2 - 0.012, vT + 0.02, 0.012, dT - 0.04, 0.06, BLEU, HT - 0.1);       // la bretelle, côté caméra
      ventre(BLEU);
      // Bras plié : le coude le long du corps, l'avant-bras vers la fourche.
      const coude = brasCubes(ctx, uBc, vE, hE, 0.3, L * 0.5, ROUGE, ROUGE);
      const m = brasCubes(ctx, uBc, coude.v, coude.h, 1.75 + 0.05 * Math.sin(phase * 2), L * 0.42, ROUGE, M.peau);
      const uF = uBc - 0.04, vF = m.v - 0.025, haut = K.h * M.taille;
      drawBox(ctx, uF, vF, 0.05, 0.05, haut - 0.36, "#6b4b2e", 0.04);                              // le manche
      drawBox(ctx, uF - 0.02, vF - 0.12, 0.09, 0.29, 0.05, "#8a8d98", haut - 0.33);               // la traverse
      for (const dv of [-0.12, 0.005, 0.13]) drawBox(ctx, uF, vF + dv, 0.04, 0.04, 0.28, "#8a8d98", haut - 0.28); // les dents
      teteVoxel(ctx, M, uH, vH, td, tw, HT, TE, { chapeau: true });
      drawBox(ctx, uH - 0.12, vH - 0.12, td + 0.24, tw + 0.24, 0.035, "#e8c66a", HT + TE - 0.01);   // le bord du chapeau
      drawBox(ctx, uH - 0.01, vH - 0.01, td + 0.02, tw + 0.02, 0.13, "#e8c66a", HT + TE + 0.02);   // la calotte
      drawBox(ctx, uH - 0.015, vH - 0.015, td + 0.03, tw + 0.03, 0.035, "#b8402c", HT + TE + 0.03); // le ruban
    } else {
      // Le baigneur : tongs, slip de bain (maillot une pièce pour elle),
      // lunettes de soleil, chaîne en or ; trois poses selon la rangée —
      // ballon de plage brandi, raquette levée, biceps gonflés.
      const slip = SLIPS[ri % 4], pose = ri % 3;
      jambes(M.peau, "#1f8fd6", 0.035);
      drawBox(ctx, uC - uT / 2 - 0.005, vT - 0.005, uT + 0.01, dT + 0.01, 0.2 * sy, slip, H0 - 0.08 * sy);   // le slip
      drawBox(ctx, uC - uT / 2, vT, uT, dT, T - 0.12 * sy, M.femme ? slip : M.peau, H0 + 0.12 * sy);      // le torse (ou le maillot)
      ventre(M.femme ? slip : M.peau);
      if (!M.femme) drawBox(ctx, uC - uT / 2 + 0.04, vT - 0.012, uT - 0.08, 0.02, 0.03, "#f2c21c", HT - 0.09); // la chaîne en or
      if (pose === 0) {
        // Les deux bras levés : le ballon au-dessus de la tête.
        const a = Math.PI - 0.12 + 0.04 * Math.sin(phase * 4);
        brasCubes(ctx, uBf, vE, hE, a, L, M.peau, M.peau);
        const m = brasCubes(ctx, uBc, vE, hE, a, L, M.peau, M.peau);
        apres = () => ballonPlage(ctx, uC - 0.03, m.v + 0.02, m.h + 0.3, 0.3, t + ri);
      } else if (pose === 1) {
        // La raquette levée devant lui, la balle qui rebondit dessus.
        brasCubes(ctx, uBf, vE, hE, 0.15 + 0.06 * Math.sin(phase * 4), L, M.peau, M.peau);
        const m = brasCubes(ctx, uBc, vE, hE, 2.35 + 0.1 * Math.sin(phase * 4.2), L, M.peau, M.peau);
        drawBox(ctx, uBc - 0.01, m.v - 0.03, 0.06, 0.06, 0.14, "#6b4b2e", m.h);                   // le manche
        drawBox(ctx, uBc - 0.06, m.v - 0.16, 0.16, 0.32, 0.36, "#2f6fd0", m.h + 0.14);            // la raquette
        const k = Math.abs(Math.sin(phase * 4.2));
        apres = () => balle(ctx, uBc, m.v, m.h + 0.62 + 0.6 * k);
      } else {
        // Les biceps : bras tendus vers l'avant, avant-bras dressés, il pompe.
        for (const [u0, ph] of [[uBf, 0], [uBc, 1.3]]) {
          const coude = brasCubes(ctx, u0, vE, hE, Math.PI / 2, L * 0.5, M.peau, M.peau, 0.13);
          brasCubes(ctx, u0, coude.v, coude.h, Math.PI - 0.15 * Math.abs(Math.sin(phase * 3 + ph)), L * 0.45, M.peau, M.peau, 0.11);
        }
      }
      teteVoxel(ctx, M, uH, vH, td, tw, HT, TE);
      drawBox(ctx, uH - 0.02, vH - 0.015, td + 0.04, 0.04, 0.06, "#0d0d10", HT + TE * 0.5);       // les lunettes de soleil
    }
  }, CONTOUR_PERSO);
  if (apres) apres();
}
function staticNu(ctx, kind, uCenter, r, t) {
  const K = KINDS[kind];
  // ⚠️ `r` peut être DÉCIMAL : drawStaticTombe recule la bête qui bascule.
  // Les couleurs se choisissent donc sur un index ENTIER. Sans ça,
  // ["gris","blanc","noir"][74.35 % 3] rend `undefined`, parseColor plante au
  // milieu d'une rotation du canvas, et la rotation reste : tout le jeu part
  // de travers jusqu'au rechargement.
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
    // Taches PLAQUÉES sur le flanc côté caméra et sur le dos, à ras du corps
    // (pas en blocs qui flottent au-dessus).
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
    // Le gros bonhomme de neige de la montagne, presque de la taille d'un
    // bus : trois boules arrondies (deux boîtes croisées chacune), regard et
    // nez carotte vers le joueur (−v), écharpe rouge au cou, chapeau, bras en
    // branches.
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
    // Liens de ficelle en SAILLIE : à ras des faces, ils se battent avec elles
    // (z-fighting).
    B(-0.03, -0.03, 1.06, 1.06, 0.06, "#a8862f", 0.33);
    B(-0.03, -0.03, 1.06, 1.06, 0.06, "#a8862f", 0.7);
  } else if (kind === "voiture") {
    drawVoiture(ctx, K, uCenter, r, 1, t);
  } else if (kind === "chat") {
    // Ni gris (il se perd sur l'asphalte) ni noir (invisible dans le biome de
    // nuit) : roux vif, blanc ou tigré orange, et une tache de contraste.
    // (`noir` est un nom resté : c'est le roux vif à tache blanche.)
    const noir = ri % 3 === 0;
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

// --- La POULE JETÉE -----------------------------------------------------------
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

// Un obstacle TOUCHÉ bascule, pour qu'on comprenne qu'il s'est passé quelque
// chose. On fait pivoter le dessin autour de son point d'appui, à l'écran,
// comme le salto du cycliste.
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
