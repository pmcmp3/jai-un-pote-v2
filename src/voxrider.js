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
function roue(ctx, u, v, hc, R, angle) {
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
export function drawRider(ctx, u, v, lift, P, pedal, alpha = 1, flip = 0, ombre = true) {
  if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
  // L'ombre reste au sol, dessinée AVANT la rotation du salto (retour :
  // « tu as des ombres horribles » — elle tournait avec le vélo).
  if (ombre) drawShadow(ctx, u, v, 0.3, 0.6, 0.24);
  let spinning = false;
  if (flip > 0.01) {
    // Salto = le vélo ENTIER tourne à l'écran autour de son centre (6
    // septembre 2026 : « il faut que ce soit vraiment visible » — l'ancienne
    // version déplaçait les cubes sur un cercle, ça ne se lisait pas).
    const c = project(u, v, lift + 0.9);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(flip);
    ctx.translate(-c.x, -c.y);
    spinning = true;
  }
  const W = 0.36;              // largeur du vélo (u)
  const L = 1.15;              // longueur (v)
  const x = u - W / 2, y = v - L / 2;
  const s = Math.sin(pedal), c = Math.cos(pedal);
  const grandBi = P.velo === "grandbi";
  const um = x + W / 2;        // plan des roues et du cadre
  // Jambes : en opposition, autour du pédalier. Le pied décrit un cercle
  // dans le SENS DE LA MARCHE (7 septembre 2026, « j'ai l'impression de
  // pédaler à l'envers ») : en haut il part vers l'AVANT (+v), puis descend.
  const liftSelle = lift + (grandBi ? 0.4 : 0);
  const legL = 0.5 + 0.12 * c, legR = 0.5 - 0.12 * c;
  const hL = liftSelle + 0.08 + 0.1 * (1 + c) / 2, hR = liftSelle + 0.08 + 0.1 * (1 - c) / 2;
  const sway = 0.03 * s;
  const tx = x - 0.06 + sway, ty = y + 0.36;
  // 1) Côté FOND : jambe droite, chaussure, bras droit.
  drawBox(ctx, x + W - 0.12, y + 0.42 - 0.06 * s, 0.14, 0.2, legR, P.pants, hR);
  drawBox(ctx, x + W - 0.12, y + 0.46 - 0.06 * s, 0.16, 0.18, 0.1, P.shoe, hR);
  drawBox(ctx, tx + W + 0.1, ty + 0.3, 0.12, 0.42, 0.1, P.top2, liftSelle + 1.05);
  // 2) Roues et cadre, dans le plan du milieu.
  const angle = v / 0.25;
  if (grandBi) {
    // GRAND BI : grande roue avant, petite roue arrière, cycliste perché.
    roue(ctx, um, y + L - 0.475, lift + 0.475, 0.475, v / 0.475);
    roue(ctx, um, y + 0.16, lift + 0.16, 0.16, v / 0.16);
    drawBox(ctx, um - 0.03, y + 0.16, 0.06, L - 0.6, 0.06, FRAME, lift + 0.55);
    drawBox(ctx, um - 0.04, y + L - 0.52, 0.08, 0.08, 0.5, FRAME, lift + 0.5);
  } else {
    roue(ctx, um, y + 0.25, lift + 0.25, 0.25, angle);
    roue(ctx, um, y + L - 0.25, lift + 0.25, 0.25, angle);
  }
  drawBox(ctx, um - 0.04, y + 0.3, 0.08, 0.6, 0.1, FRAME, liftSelle + 0.4);
  drawBox(ctx, um - 0.05, y + 0.35, 0.1, 0.1, 0.35, FRAME, liftSelle + 0.45);
  drawBox(ctx, um - 0.05, y + 0.85, 0.1, 0.1, 0.4, FRAME, liftSelle + 0.45);
  drawBox(ctx, x - 0.08, y + 0.92, W + 0.16, 0.08, 0.08, "#33333b", liftSelle + 0.85);
  drawBox(ctx, um - 0.12, y + 0.28, 0.24, 0.18, 0.08, P.pants, liftSelle + 0.8);
  // 3) Torse rayé, penché vers l'avant (guidon), tangue avec le pédalage.
  if (P.motif === "carreaux") {
    const hw = (W + 0.12) / 2;
    drawBox(ctx, tx + hw, ty, hw, 0.34, 0.17, P.top2, liftSelle + 0.86); drawBox(ctx, tx, ty, hw, 0.34, 0.17, P.top1, liftSelle + 0.86);
    drawBox(ctx, tx + hw, ty + 0.06, hw, 0.34, 0.17, P.top1, liftSelle + 1.03); drawBox(ctx, tx, ty + 0.06, hw, 0.34, 0.17, P.top2, liftSelle + 1.03);
    drawBox(ctx, tx + hw, ty + 0.12, hw, 0.34, 0.17, P.top2, liftSelle + 1.2); drawBox(ctx, tx, ty + 0.12, hw, 0.34, 0.17, P.top1, liftSelle + 1.2);
  } else {
    drawBox(ctx, tx, ty, W + 0.12, 0.34, 0.17, P.top1, liftSelle + 0.86);
    drawBox(ctx, tx, ty + 0.06, W + 0.12, 0.34, 0.17, P.top2, liftSelle + 1.03);
    drawBox(ctx, tx, ty + 0.12, W + 0.12, 0.34, 0.17, P.top1, liftSelle + 1.2);
  }
  // 4) Côté CAMÉRA : jambe gauche, chaussure, bras gauche.
  drawBox(ctx, x - 0.02, y + 0.42 + 0.06 * s, 0.14, 0.2, legL, P.pants, hL);
  drawBox(ctx, x - 0.04, y + 0.46 + 0.06 * s, 0.16, 0.18, 0.1, P.shoe, hL);
  drawBox(ctx, tx - 0.1, ty + 0.3, 0.12, 0.42, 0.1, P.top2, liftSelle + 1.05);
  lift = liftSelle;
  // 5) Tête, cheveux, chapeau.
  const hx = x + W / 2 - 0.15 + sway, hy = y + 0.5;
  drawBox(ctx, hx, hy, 0.3, 0.3, 0.3, P.skin, lift + 1.37);
  drawBox(ctx, hx - 0.02, hy - 0.02, 0.34, 0.34, 0.14, P.hair, lift + 1.66);
  drawBox(ctx, hx - 0.02, hy + 0.2, 0.04, 0.06, 0.06, "#1a1a1e", lift + 1.52); // œil
  if (P.beard) drawBox(ctx, hx, hy + 0.22, 0.3, 0.1, 0.12, P.hair, lift + 1.37);
  const hat = P.hat !== undefined ? P.hat : (P.cap ? "casquette" : null);
  const hatColor = P.hatColor || P.cap;
  if (hat === "casquette") {
    drawBox(ctx, hx - 0.03, hy - 0.03, 0.36, 0.36, 0.1, hatColor, lift + 1.78);
    drawBox(ctx, hx, hy + 0.3, 0.3, 0.16, 0.05, hatColor, lift + 1.78);
  } else if (hat === "bob") {
    drawBox(ctx, hx - 0.02, hy - 0.02, 0.34, 0.34, 0.16, hatColor, lift + 1.74);
    drawBox(ctx, hx - 0.1, hy - 0.1, 0.5, 0.5, 0.05, hatColor, lift + 1.74);
  } else if (hat === "paille") {
    drawBox(ctx, hx - 0.01, hy - 0.01, 0.32, 0.32, 0.14, hatColor, lift + 1.76);
    drawBox(ctx, hx - 0.16, hy - 0.16, 0.62, 0.62, 0.04, hatColor, lift + 1.76);
    drawBox(ctx, hx - 0.01, hy - 0.01, 0.32, 0.32, 0.04, "#8a3a1a", lift + 1.84);
  }
  if (spinning) ctx.restore();
  if (alpha < 1) ctx.restore();
}

export const RIDER_HEIGHT = 1.9;
export function riderDepth(u, v) { return depth(u, v); }
