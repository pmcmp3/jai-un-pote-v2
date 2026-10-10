// voxrider.js — Le cycliste en cubes, posé dans le monde via scene.drawBox :
// cadre, jambes, torse rayé, tête, cheveux, chapeau. Palette par personnage
// (rider.js, PALETTES). Pédalage : les deux jambes montent et descendent en
// opposition, le buste tangue avec.
//
// Vue de profil : les ROUES sont des disques qui tournent (des cubes
// donneraient des roues carrées de côté), et l'ordre de
// dessin suit la profondeur — jambe et bras du côté du fond d'abord, puis
// roues et cadre, puis le torse, puis la jambe et le bras côté caméra.

import { drawBox, drawShadow, drawDisque, project, echelle } from "./scene.js";

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

// Cadre de VTT en vrais tubes (des cubes ne ressemblent à rien de profil) :
// le losange d'un vrai vélo, tracé dans le plan des roues — bases, haubans,
// tube de selle, tube horizontal, tube diagonal, fourche, pédalier qui
// tourne. Couleur du maillot, cernée de noir pour se lire sur l'asphalte
// comme sur le ciel.
function cadre(ctx, um, y, L, lift, pedal, P) {
  const pt = (dv, h) => project(um - 0.002, y + dv, lift + h);
  const moyeuAr = pt(0.25, 0.25), moyeuAv = pt(L - 0.25, 0.25), pedalier = pt(0.5, 0.24);
  const selle = pt(0.4, 0.84), douille = pt(0.86, 0.8), douilleBas = pt(0.83, 0.58);
  const e = echelle(um);
  const tubes = [[moyeuAr, pedalier], [moyeuAr, selle], [pedalier, selle], [selle, douille], [pedalier, douilleBas], [douilleBas, douille], [douilleBas, moyeuAv]];
  // Tubes « pixel » : bouts carrés, angles vifs, un peu plus épais.
  ctx.lineCap = "square"; ctx.lineJoin = "miter";
  for (const [larg, coul] of [[0.14, "#141418"], [0.085, P.top1 || FRAME]]) {
    ctx.strokeStyle = coul; ctx.lineWidth = Math.max(1.5, larg * e);
    ctx.beginPath();
    for (const [a, b] of tubes) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.stroke();
  }
  // Selle et manivelle.
  ctx.strokeStyle = "#141418"; ctx.lineWidth = Math.max(2, 0.09 * e);
  ctx.beginPath();
  const s1 = pt(0.3, 0.9), s2 = pt(0.5, 0.9);
  ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);
  const r = 0.16 * e;
  ctx.moveTo(pedalier.x - Math.cos(pedal) * r, pedalier.y - Math.sin(pedal) * r);
  ctx.lineTo(pedalier.x + Math.cos(pedal) * r, pedalier.y + Math.sin(pedal) * r);
  ctx.stroke();
}

// VÉLO ENFANT (gag) : petites roues roses, roulettes, guidon trop haut, fanion
// sur sa perche — et un adulte assis tout en bas, les genoux aux oreilles.
const ROSE = "#ff6fae";
function veloEnfant(ctx, um, y, lift, pedal) {
  const pt = (dv, h) => project(um - 0.002, y + dv, lift + h);
  roue2(ctx, um + 0.2, y + 0.12, lift + 0.08, 0.08, pedal);     // roulette
  roue2(ctx, um, y + 0.3, lift + 0.17, 0.17, pedal * 1.6);
  roue2(ctx, um, y + 0.86, lift + 0.17, 0.17, pedal * 1.6);
  const e = echelle(um);
  const ar = pt(0.3, 0.17), av = pt(0.86, 0.17), pedalier = pt(0.5, 0.17), selle = pt(0.4, 0.46), douille = pt(0.78, 0.5), guidon = pt(0.72, 1.18);
  ctx.lineCap = "square"; ctx.lineJoin = "miter";
  for (const [larg, coul] of [[0.13, "#141418"], [0.08, ROSE]]) {
    ctx.strokeStyle = coul; ctx.lineWidth = Math.max(1.5, larg * e);
    ctx.beginPath();
    for (const [a, b] of [[ar, pedalier], [ar, selle], [pedalier, selle], [selle, douille], [pedalier, douille], [douille, av], [douille, guidon]]) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.stroke();
  }
  ctx.strokeStyle = "#141418"; ctx.lineWidth = Math.max(2, 0.08 * e);
  ctx.beginPath();
  const r = 0.1 * e;
  ctx.moveTo(pedalier.x - Math.cos(pedal) * r, pedalier.y - Math.sin(pedal) * r);
  ctx.lineTo(pedalier.x + Math.cos(pedal) * r, pedalier.y + Math.sin(pedal) * r);
  ctx.stroke();
  // Guidon « chopper » et ses rubans, puis la perche et son fanion orange.
  drawBox(ctx, um - 0.26, y + 0.66, 0.52, 0.1, 0.08, "#33333b", lift + 1.18);
  for (const [du, c] of [[-0.26, "#ffcf2e"], [0.18, "#3fb6e8"]]) drawBox(ctx, um + du, y + 0.6 - Math.abs(Math.sin(pedal * 2)) * 0.08, 0.06, 0.12, 0.2, c, lift + 1.02);
  drawBox(ctx, um + 0.1, y + 0.02, 0.04, 0.04, 1.9, "#f2ede2", lift + 0.2);
  drawBox(ctx, um + 0.1, y - 0.36 + Math.sin(pedal * 3) * 0.04, 0.03, 0.38, 0.24, "#ff7a1a", lift + 1.84);
}

// PHARE AVANT : un boîtier noir sous le guidon, verre crème le jour ; la nuit
// (setNuit, posé par main.js à chaque image), le verre s'allume et rayonne.
let nuitPhare = 0;
export function setNuit(n) { nuitPhare = n; }
function phareAvant(ctx, um, v, h) {
  drawBox(ctx, um - 0.09, v, 0.18, 0.15, 0.16, "#1f1f25", h);
  const allume = nuitPhare > 0.25;
  drawBox(ctx, um - 0.095, v + 0.15, 0.19, 0.05, 0.13, allume ? "#fffbe0" : "#fff3b0", h + 0.015);
  if (!allume) return;
  const c = project(um - 0.095, v + 0.2, h + 0.08), R = 0.6 * echelle(um);
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
  g.addColorStop(0, `rgba(255,246,200,${0.9 * nuitPhare})`);
  g.addColorStop(1, "rgba(255,236,170,0)");
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
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
  // `pente` : sur la rampe d'une halle, le vélo suit l'inclinaison du plancher.
  const angle = flip > 0.01 ? flip : (roue > 0 ? -Math.sin(Math.PI * roue) * 0.75 : pente);
  if (Math.abs(angle) > 0.01) {
    // Salto : tout le vélo tourne à l'écran. Roue arrière (glissade vers le
    // bas) : il se cabre autour de sa roue arrière.
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
  const enfant = P.velo === "enfant";
  const um = x + W / 2;        // plan des roues et du cadre
  const liftSelle = lift + (grandBi ? 0.4 : enfant ? -0.3 : 0);
  // Jambes : le haut reste COLLÉ au bassin (sinon elles paraissent détachées),
  // seul le pied monte et descend avec le pédalage.
  const bassin = liftSelle + 0.88;
  // Pieds SUR les pédales : chaque semelle suit exactement le bout de sa
  // manivelle — même centre, même rayon, même angle que cadre(). Au Grand Bi,
  // les pédales sont sur le moyeu de la grande roue. En rollers, les patins
  // glissent d'avant en arrière et le pied de retour décolle un peu.
  // (vF, hF) = avant-bas de la chaussure.
  const pied = (sens) => {
    if (roller) {
      const k = Math.sin(pedal) * sens;
      return { v: y + 0.34 + 0.26 * k, h: lift + 0.16 + Math.max(0, -Math.cos(pedal) * sens) * 0.07 };
    }
    const cv = grandBi ? y + L - 0.475 : y + 0.5, ch = grandBi ? lift + 0.475 : enfant ? lift + 0.17 : lift + 0.24, R = grandBi ? 0.14 : enfant ? 0.1 : 0.16;
    const a = pedal + (sens > 0 ? 0 : Math.PI);
    return { v: cv + Math.cos(a) * R - 0.11, h: ch - Math.sin(a) * R + 0.02 };
  };
  const pL = pied(1), pR = pied(-1);
  const hL = pL.h + 0.1, hR = pR.h + 0.1;
  const legL = Math.max(0.2, bassin - hL), legR = Math.max(0.2, bassin - hR);
  const sway = 0.03 * s;
  const tx = x - 0.06 + sway, ty = y + 0.36;
  // 1) Côté FOND : jambe droite, chaussure, bras droit.
  drawBox(ctx, x + W - 0.12, pR.v + 0.01, 0.14, 0.2, legR, P.pants, hR);
  drawBox(ctx, x + W - 0.13, pR.v, 0.17, 0.22, 0.12, P.shoe, pR.h);
  drawBox(ctx, tx + W + 0.1, ty + 0.3, 0.12, 0.42, 0.1, P.top2, liftSelle + 1.05);
  // 2) Le véhicule.
  if (roller) {
    // Rollers : deux patins à quatre roulettes, pas de vélo.
    for (const [ux, p] of [[x + W - 0.13, pR], [x - 0.04, pL]]) {
      drawBox(ctx, ux, p.v - 0.1, 0.16, 0.42, 0.06, "#33333b", Math.max(0, p.h - 0.06));
      for (let i = 0; i < 4; i++) drawDisque(ctx, ux - 0.01, p.v - 0.06 + i * 0.11, Math.max(0.06, p.h - 0.1), 0.06, "#f2ede2");
    }
  } else if (enfant) {
    veloEnfant(ctx, um, y, lift, pedal);
  } else if (grandBi) {
    roue2(ctx, um, y + L - 0.475, lift + 0.475, 0.475, v / 0.475);
    roue2(ctx, um, y + 0.16, lift + 0.16, 0.16, v / 0.16);
    drawBox(ctx, um - 0.03, y + 0.16, 0.06, L - 0.6, 0.06, FRAME, lift + 0.55);
    drawBox(ctx, um - 0.04, y + L - 0.52, 0.08, 0.08, 0.5, FRAME, lift + 0.5);
  } else {
    roue2(ctx, um, y + 0.25, lift + 0.25, 0.25, v / 0.25);
    roue2(ctx, um, y + L - 0.25, lift + 0.25, 0.25, v / 0.25);
  }
  if (grandBi) {
    drawBox(ctx, um - 0.04, y + 0.3, 0.08, 0.6, 0.1, FRAME, liftSelle + 0.4);
    drawBox(ctx, um - 0.05, y + 0.85, 0.1, 0.1, 0.4, FRAME, liftSelle + 0.45);
  } else if (!roller && !enfant) cadre(ctx, um, y, L, lift, pedal, P);
  if (!roller && !enfant) phareAvant(ctx, um, grandBi ? y + L - 0.3 : y + 0.95, grandBi ? lift + 0.6 : lift + 0.66);
  if (enfant) drawBox(ctx, um - 0.12, y + 0.3, 0.24, 0.18, 0.08, "#141418", liftSelle + 0.8); // la selle, tout en bas
  else if (!roller) {
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
  drawBox(ctx, x - 0.02, pL.v + 0.01, 0.14, 0.2, legL, P.pants, hL);
  drawBox(ctx, x - 0.04, pL.v, 0.17, 0.22, 0.12, P.shoe, pL.h);
  drawBox(ctx, tx - 0.1, ty + 0.3, 0.12, 0.42, 0.1, P.top2, liftSelle + 1.05);
  // 5) Tête, cheveux, chapeau.
  const hx = x + W / 2 - 0.15 + sway, hy = y + 0.5;
  const hTete = hautTorse + 0.51;
  drawBox(ctx, hx, hy, 0.3, 0.3, 0.3, P.skin, hTete);
  drawBox(ctx, hx - 0.02, hy - 0.02, 0.34, 0.34, 0.14, P.hair, hTete + 0.29);
  drawBox(ctx, hx - 0.02, hy + 0.2, 0.04, 0.06, 0.06, "#1a1a1e", hTete + 0.15); // œil
  if (P.beard) drawBox(ctx, hx, hy + 0.22, 0.3, 0.1, 0.12, P.hair, hTete);
  if (P.genre === "femme") {
    // Cheveux longs dans le dos + queue de cheval qui flotte derrière.
    drawBox(ctx, hx - 0.02, hy - 0.06, 0.34, 0.14, 0.34, P.hair, hTete - 0.04);
    drawBox(ctx, hx + 0.06, hy - 0.24, 0.16, 0.2, 0.14, P.hair, hTete + 0.12 + sway * 0.5);
    drawBox(ctx, hx + 0.08, hy - 0.36, 0.12, 0.14, 0.1, P.hair, hTete + 0.06 + sway);
  }
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
  } else if (hat === "couronne") {
    // Bandeau doré, six pointes (trois devant, trois derrière : de profil on
    // lit la silhouette en dents), un rubis côté caméra.
    drawBox(ctx, hx - 0.02, hy - 0.02, 0.34, 0.34, 0.12, hatColor, hTete + 0.41);
    for (const du of [0, 0.26]) for (const dv of [0, 0.13, 0.26]) drawBox(ctx, hx - 0.02 + du, hy - 0.02 + dv, 0.08, 0.08, 0.13, hatColor, hTete + 0.53);
    drawBox(ctx, hx - 0.05, hy + 0.11, 0.04, 0.1, 0.07, "#e13e26", hTete + 0.43);
  }
  if (tourne) ctx.restore();
  if (alpha < 1) ctx.restore();
}

export const RIDER_HEIGHT = 1.9;

// JETPACK : deux bouteilles argentées sur le dos du cycliste
// (le dos est côté −v : il roule vers +v), sangles rouges, et des flammes qui
// crépitent sous les tuyères quand il pousse.
export function drawJetpack(ctx, u, v, lift, flamme, t) {
  const dos = v - 0.5;
  for (const du of [-0.17, 0.05]) {
    drawBox(ctx, u + du, dos - 0.1, 0.16, 0.2, 0.62, "#cfd4dc", lift + 0.82);
    drawBox(ctx, u + du + 0.01, dos - 0.09, 0.14, 0.18, 0.08, "#e13e26", lift + 1.44);
    drawBox(ctx, u + du + 0.03, dos - 0.06, 0.1, 0.12, 0.1, "#3a3d46", lift + 0.72);
    if (flamme) {
      const k = 0.55 + 0.45 * Math.sin(t * 38 + du * 40);
      drawBox(ctx, u + du + 0.02, dos - 0.07, 0.12, 0.14, 0.34 * k + 0.12, "#ff9a1a", lift + 0.72 - (0.34 * k + 0.12));
      drawBox(ctx, u + du + 0.045, dos - 0.04, 0.07, 0.08, 0.2 * k + 0.06, "#ffe36a", lift + 0.72 - (0.2 * k + 0.06));
    }
  }
  drawBox(ctx, u - 0.19, dos + 0.08, 0.38, 0.06, 0.08, "#e13e26", lift + 1.2);
}
