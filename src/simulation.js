// simulation.js — Le SCORE PARFAIT d'une course (9 septembre 2026 : « ce que
// j'aimerais beaucoup, c'est que tu me donnes le score maximum à atteindre »).
// Rejoue la course d'une graine avec un joueur idéal, avec les MÊMES formules
// que main.js (regles.js) et sa propre instance de Route (le parcours en
// cours n'est jamais touché).
//
// v2 (19 septembre 2026, vue de profil) : le joueur idéal ne change plus de
// voie, il SAUTE. Il vise la prochaine cible devant lui — un obstacle ou une
// pile de pièces en l'air — et part au bon moment pour culminer dessus :
// saut simple pour un obstacle « saut » (l'arc de pièces qui le surmonte est
// ramassé au passage), saut + re-tap à l'apex pour un obstacle « salto ». Il
// ne fait le salto facultatif (pile tout en haut) que si la barre est pleine
// et qu'aucun obstacle « salto » n'arrive avant qu'elle se recharge. Il
// ramasse les pièces avec la même règle que le jeu (rows.checkMember). Le
// re-tap du salto part quand il reste le temps d'une montée avant la cible.
// Jamais freiné par la boue, jamais un pote perdu. ~20 000 pas : quelques ms.

import { Route, KINDS, CORPS_HAUT } from "./rows.js";
import { ROWS_AHEAD } from "./scene.js";
import { V_UNIT, targetSpeed, multiplicateur, dureeCourse } from "./regles.js";

const REGARD = 9; // rangées examinées devant

// Ce que demande une rangée : null, "saut" ou "salto".
function cibleDe(route, r) {
  const row = route.rowAt(r);
  if (row.type !== "safe") return KINDS[row.kind].franchir;
  if (!row.coins.length) return null;
  // Les côtés d'un arc appartiennent à l'obstacle voisin : on ne les vise pas.
  if (r > 0 && route.rowAt(r - 1).type !== "safe") return null;
  if (route.rowAt(r + 1).type !== "safe") return null;
  const haut = Math.max(...row.coins);
  if (haut <= CORPS_HAUT) return null;
  return haut > 3.0 ? "piles-salto" : "saut";
}

export function scoreParfait(seed, potesMax) {
  const C = window.CONFIG;
  const route = new Route(seed);
  const dt = 1 / 120, T = dureeCourse();
  const paliers = C.potesPaliers || [];
  const tApex = C.sautDuree / 2;
  const vJ = (4 * C.sautHauteur) / C.sautDuree, g = (8 * C.sautHauteur) / (C.sautDuree * C.sautDuree);
  let v = 0, prevV = 0, speed = V_UNIT * C.vitesseBase;
  let jumpY = 0, vy = 0, doubled = false, elan = 1, plan = null;
  let metres = 0, points = 0, potesGagnes = 0, potes = 0, turbo = 0;
  const stats = { pieces: 0, laits: 0, rouges: 0, sauts: 0, saltos: 0, rangees: 0 };
  for (let now = 0; now < T; now += dt) {
    if (turbo > 0) { turbo -= dt; if (turbo <= 0) turbo = 0; }
    speed += (targetSpeed(now) - speed) * Math.min(1, 3 * dt);
    const vitesse = speed * (turbo > 0 ? (C.laitVitesse || 1.2) : 1);
    prevV = v;
    v += vitesse * dt;
    metres += vitesse * dt * C.metresParUnite * multiplicateur(potes, turbo > 0);

    // Pilote : au sol, il cherche la prochaine cible et part au bon moment.
    if (jumpY <= 0 && !plan) {
      for (let r = Math.floor(v) + 1; r <= Math.floor(v) + REGARD; r++) {
        let c = cibleDe(route, r);
        if (!c) continue;
        if (c === "piles-salto") {
          // Salto facultatif : seulement si l'élan sera encore là pour le prochain obstacle haut.
          let libre = elan >= 1;
          const garde = Math.ceil(vitesse * (C.elanRechargeS || 1.1)) + 3;
          for (let k = r + 1; libre && k <= r + garde; k++) { const rw = route.rowAt(k); if (rw.type !== "safe" && KINDS[rw.kind].franchir === "salto") libre = false; }
          c = libre ? "salto" : "saut";
        }
        const avance = c === "salto" ? 2 * tApex : tApex;
        if (r - v <= vitesse * avance) {
          plan = { r, salto: c === "salto" };
          jumpY = 0.001; vy = vJ; doubled = false; stats.sauts += 1;
        }
        break;
      }
    }
    // Salto : re-tap quand il reste le temps d'une montée avant la cible (le
    // second sommet tombe dessus) — tout de suite si on est parti tard.
    if (plan && plan.salto && !doubled && jumpY > 0 && elan >= 1 && (plan.r - v) <= vitesse * tApex) { vy = vJ; doubled = true; elan = 0; stats.saltos += 1; }
    if (jumpY > 0) {
      vy -= g * dt; jumpY += vy * dt;
      if (jumpY <= 0) { jumpY = 0; vy = 0; doubled = false; plan = null; }
    }
    if (elan < 1) elan = Math.min(1, elan + dt / (C.elanRechargeS || 1.1));

    for (const ev of route.checkMember("sim", prevV, v, jumpY, now)) {
      const mult = multiplicateur(potes, turbo > 0);
      if (ev.type === "piece") {
        stats.pieces += 1; points += 1; metres += C.pieceMetres * mult;
        elan = Math.min(1, elan + (C.elanParPiece || 0));
        while (potesGagnes < paliers.length && points >= paliers[potesGagnes]) { potesGagnes += 1; if (potes < potesMax) potes += 1; }
      } else if (ev.type === "lait") {
        stats.laits += 1; turbo = C.laitDureeS || 5;
        const r0 = Math.floor(v + 0.5) + ROWS_AHEAD + 1;
        route.ouvrirFenetreSure(r0, r0 + Math.ceil(speed * (C.laitVitesse || 1.2) * (C.laitDureeS || 5)) + 12);
      } else if (ev.type === "rouge") {
        stats.rouges += 1;
        if (potes < potesMax) potes += 1; else metres += 40 * mult;
      }
    }
  }
  stats.rangees = Math.floor(v);
  stats.potes = potes;
  return { score: Math.floor(metres), ...stats };
}

// Recensement d'une course : combien de chaque espèce, de pièces, de laits…
// sur `nRangees` rangées. Sert à vérifier que deux graines ont les MÊMES
// quotas (outil de mesure).
export function recenser(seed, nRangees = 1100) {
  const route = new Route(seed);
  const n = { dangers: 0, pieces: 0, rangeesPieces: 0, laits: 0, rouges: 0, boue: 0, saut: 0, salto: 0 };
  for (let r = 0; r < nRangees; r++) {
    const row = route.rowAt(r);
    if (row.type !== "safe") { n.dangers += 1; n[row.kind] = (n[row.kind] || 0) + 1; n[KINDS[row.kind].franchir] += 1; }
    n.pieces += row.coins.length;
    if (row.coins.length) n.rangeesPieces += 1;
    if (row.lait !== undefined) n.laits += 1;
    if (row.rouge !== undefined) n.rouges += 1;
    if (row.boue !== null && row.boue !== undefined) n.boue += 1;
  }
  return n;
}
