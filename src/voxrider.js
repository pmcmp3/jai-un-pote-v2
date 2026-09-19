// voxrider.js — Le cycliste en cubes (4 septembre 2026), posé dans le monde
// via scene.drawBox : cadre, jambes, torse rayé, tête, cheveux, chapeau.
// Palette par personnage (rider.js, PALETTES). Pédalage : les deux jambes
// montent et descendent en opposition, le buste tangue avec.
//
// VUE DE PROFIL (v2, 19 septembre 2026) : les ROUES sont des disques qui
// tournent (des cubes donnaient des roues carrées de côté), et l'ordre de
// dessin suit la profondeur — jambe et bras du côté du fond d'abord, puis
// roues et cadre, puis le torse, puis la jambe et le bras côté caméra.

import { drawBox, drawShadow, drawDisque, depth, project, echelle } from "./scene.js";

// Roue vue de côté : pneu, jante, moyeu, quatre rayons qui tournent avec la
// distance parcourue (angle = v / R, sens horaire quand on file à droite).
function roue2(ctx, u, v, hc, R, angle) {
  drawDisque(ctx, u, v, hc, R, TIRE);
  drawDisque(ctx, u - 0.001, v, hc, R * 0.78, RIM);
  drawDisque(ctx, u - 0.002, v, hc, R * 0.66, "#2b2b31");
  const p = project(u - 0.003, v, hc), r = R * 0.66 * echelle(u);
  ctx.strokeStyle = RIM;
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = angle + (i * Math.PI) / 4;
    ctx.moveTo(p.x - Math.cos(a) * r, p.y - Math.sin(a) * r);
    ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
  }
  ctx.stroke();
  drawDisque(ctx, u - 0.004, v, hc, R * 0.14, RIM);
}

const TIRE = "#151518", RIM = "#8a8d98", FRAME = "#1b1b21", SKIN_SHOE = "#565a66";

// Ancré au sol en (u, v) = centre du vélo. `lift` = hauteur de saut.
// `flip` (0..2π) = angle du salto (double saut) : tout le vélo tourne
// autour de son axe latéral — le corps décrit un cercle vers l'avant.
export function drawRider(ctx, u, v, lift, P, pedal, alpha = 1, flip = 0, ombre = true, roue = 0, pente = 0) {
  if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
  // L'ombre reste au sol, dessinée AVANT toute rotation.
  if (ombre) drawShadow(ctx, u, v, 0.3, 0.6, 0.24);
  let tourne = false;
  // `pente` : sur la rampe d'une halle, le vélo suit l'inclinaison du plancher
  // (20 septembre 2026 : « quand on monte ou qu'on descend la rampe, il faut
  // que le personnage s'oriente vis-à-vis de la rampe »).
  const angle = flip > 0.01 ? flip : (roue > 0 ? -Math.sin(Math.PI * roue) * 0.75 : pente);
  if (Math.abs(angle) > 0.01) {
    // Salto : tout le vélo tourne à l'écran. Roue arrière : il se cabre
    // autour de sa roue arrière (20 septembre 2026, demandé « une animation
    // marrante quand on glisse vers le bas »).
    const c = flip > 0.01 ? project(u, v, lift + 0.9) : project(u, v - (roue > 0 ? 0.5 : 0), lift + 0.25);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);
    ctx.translate(-c.x, -c.y);
    tourne = true;
  }
  const W = 0.36;              // largeur (u)
  const L = 1.15;              // longueur (v)
  const x = u - W / 2, y = v - L / 2;
  const s = Math.sin(pedal), c = Math.cos(pedal);
  const grandBi = P.velo === "grandbi";
  const roller = P.velo === "roller";
  const um = x + W / 2;        // plan des roues et du cadre
  const liftSelle = lift + (grandBi ? 0.4 : 0);
  // Jambes : le haut reste COLLÉ au bassin (20 septembre 2026 : « on dirait
  // que les jambes du personnage ne sont pas attachées »), seul le pied monte
  // et descend avec le pédalage.
  const bassin = liftSelle + 0.88;
  const hL = liftSelle + 0.08 + 0.12 * (1 + c) / 2, hR = liftSelle + 0.08 + 0.12 * (1 - c) / 2;
  const legL = Math.max(0.2, bassin - hL), legR = Math.max(0.2, bassin - hR);
  const sway = 0.03 * s;
  const tx = x - 0.06 + sway, ty = y + 0.36;
  // 1) Côté FOND : jambe droite, chaussure, bras droit.
  drawBox(ctx, x + W - 0.12, y + 0.42 - 0.06 * s, 0.14, 0.2, legR, P.pants, hR);
  drawBox(ctx, x + W - 0.13, y + 0.44 - 0.06 * s, 0.17, 0.22, 0.12, P.shoe, hR - 0.1);
  drawBox(ctx, tx + W + 0.1, ty + 0.3, 0.12, 0.42, 0.1, P.top2, liftSelle + 1.05);
  // 2) Le véhicule.
  if (roller) {
    // Rollers : deux patins à quatre roulettes, pas de vélo.
    for (const [ux, vy0, hh] of [[x - 0.02, y + 0.42 - 0.06 * s, hR], [x + W - 0.13, y + 0.44 - 0.06 * s, hL]]) {
      drawBox(ctx, ux, vy0 - 0.05, 0.16, 0.5, 0.06, "#33333b", Math.max(0, hh - 0.16));
      for (let i = 0; i < 4; i++) drawDisque(ctx, ux - 0.01, vy0 + 0.02 + i * 0.13, Math.max(0.06, hh - 0.2), 0.07, "#f2ede2");
    }
  } else if (grandBi) {
    roue2(ctx, um, y + L - 0.475, lift + 0.475, 0.475, v / 0.475);
    roue2(ctx, um, y + 0.16, lift + 0.16, 0.16, v / 0.16);
    drawBox(ctx, um - 0.03, y + 0.16, 0.06, L - 0.6, 0.06, FRAME, lift + 0.55);
    drawBox(ctx, um - 0.04, y + L - 0.52, 0.08, 0.08, 0.5, FRAME, lift + 0.5);
  } else {
    roue2(ctx, um, y + 0.25, lift + 0.25, 0.25, v / 0.25);
    roue2(ctx, um, y + L - 0.25, lift + 0.25, 0.25, v / 0.25);
  }
  if (!roller) {
    drawBox(ctx, um - 0.04, y + 0.3, 0.08, 0.6, 0.1, FRAME, liftSelle + 0.4);
    drawBox(ctx, um - 0.05, y + 0.35, 0.1, 0.1, 0.35, FRAME, liftSelle + 0.45);
    drawBox(ctx, um - 0.05, y + 0.85, 0.1, 0.1, 0.4, FRAME, liftSelle + 0.45);
    drawBox(ctx, x - 0.08, y + 0.92, W + 0.16, 0.08, 0.08, "#33333b", liftSelle + 0.85);
    drawBox(ctx, um - 0.12, y + 0.28, 0.24, 0.18, 0.08, P.pants, liftSelle + 0.8);
  }
  // 3) Torse, penché vers l'avant, qui tangue avec le pédalage.
  const hautTorse = roller ? liftSelle + 0.98 : liftSelle + 0.86;
  if (P.motif === "carreaux") {
    const hw = (W + 0.12) / 2;
    drawBox(ctx, tx + hw, ty, hw, 0.34, 0.17, P.top2, hautTorse); drawBox(ctx, tx, ty, hw, 0.34, 0.17, P.top1, hautTorse);
    drawBox(ctx, tx + hw, ty + 0.06, hw, 0.34, 0.17, P.top1, hautTorse + 0.17); drawBox(ctx, tx, ty + 0.06, hw, 0.34, 0.17, P.top2, hautTorse + 0.17);
    drawBox(ctx, tx + hw, ty + 0.12, hw, 0.34, 0.17, P.top2, hautTorse + 0.34); drawBox(ctx, tx, ty + 0.12, hw, 0.34, 0.17, P.top1, hautTorse + 0.34);
  } else {
    drawBox(ctx, tx, ty, W + 0.12, 0.34, 0.17, P.top1, hautTorse);
    drawBox(ctx, tx, ty + 0.06, W + 0.12, 0.34, 0.17, P.top2, hautTorse + 0.17);
    drawBox(ctx, tx, ty + 0.12, W + 0.12, 0.34, 0.17, P.top1, hautTorse + 0.34);
  }
  // 4) Côté CAMÉRA : jambe gauche, chaussure, bras gauche.
  drawBox(ctx, x - 0.02, y + 0.42 + 0.06 * s, 0.14, 0.2, legL, P.pants, hL);
  drawBox(ctx, x - 0.04, y + 0.44 + 0.06 * s, 0.17, 0.22, 0.12, P.shoe, hL - 0.1);
  drawBox(ctx, tx - 0.1, ty + 0.3, 0.12, 0.42, 0.1, P.top2, liftSelle + 1.05);
  // 5) Tête, cheveux, chapeau.
  const hx = x + W / 2 - 0.15 + sway, hy = y + 0.5;
  const hTete = hautTorse + 0.51;
  drawBox(ctx, hx, hy, 0.3, 0.3, 0.3, P.skin, hTete);
  drawBox(ctx, hx - 0.02, hy - 0.02, 0.34, 0.34, 0.14, P.hair, hTete + 0.29);
  drawBox(ctx, hx - 0.02, hy + 0.2, 0.04, 0.06, 0.06, "#1a1a1e", hTete + 0.15); // œil
  if (P.beard) drawBox(ctx, hx, hy + 0.22, 0.3, 0.1, 0.12, P.hair, hTete);
  const hat = P.hat !== undefined ? P.hat : (P.cap ? "casquette" : null);
  const hatColor = P.hatColor || P.cap;
  if (hat === "casquette") {
    drawBox(ctx, hx - 0.03, hy - 0.03, 0.36, 0.36, 0.1, hatColor, hTete + 0.41);
    drawBox(ctx, hx, hy + 0.3, 0.3, 0.16, 0.05, hatColor, hTete + 0.41);
  } else if (hat === "bob") {
    drawBox(ctx, hx - 0.02, hy - 0.02, 0.34, 0.34, 0.16, hatColor, hTete + 0.37);
    drawBox(ctx, hx - 0.1, hy - 0.1, 0.5, 0.5, 0.05, hatColor, hTete + 0.37);
  } else if (hat === "paille") {
    drawBox(ctx, hx - 0.01, hy - 0.01, 0.32, 0.32, 0.14, hatColor, hTete + 0.39);
    drawBox(ctx, hx - 0.16, hy - 0.16, 0.62, 0.62, 0.04, hatColor, hTete + 0.39);
    drawBox(ctx, hx - 0.01, hy - 0.01, 0.32, 0.32, 0.04, "#8a3a1a", hTete + 0.47);
  }
  if (tourne) ctx.restore();
  if (alpha < 1) ctx.restore();
}

export const RIDER_HEIGHT = 1.9;
export function riderDepth(u, v) { return depth(u, v); }
