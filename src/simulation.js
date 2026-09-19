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

import { Route, KINDS, CORPS_HAUT, familleDe, montee, solAt, armer } from "./rows.js";
import { ROWS_AHEAD } from "./scene.js";
import { V_UNIT, targetSpeed, multiplicateur, dureeCourse } from "./regles.js";

const REGARD = 12; // rangées examinées devant

// Temps de montée jusqu'au sommet, par famille de saut (config.js).
function montees(C) {
  const tTenue = C.sautTenueMaxS;
  const tTap = C.sautVitesse / C.sautGravite;
  const tHaut = tTenue + (C.sautVitesse - C.sautGraviteTenue * tTenue) / C.sautGravite;
  const tDouble = C.sautVitesseDouble / C.sautGravite;
  return { tap: tTap, haut: tHaut, double: tHaut + tDouble * 0.6, tDouble };
}

// Ce que demande une rangée : null, "tap", "haut" ou "double". Depuis le
// 20 septembre 2026 les pièces en l'air DESSINENT l'arc d'un obstacle voisin :
// le pilote n'a plus à les viser séparément, il les ramasse en sautant.
function cibleDe(route, r) {
  const row = route.rowAt(r);
  if (row.type !== "safe") return familleDe(row.kind);
  return null;
}

export function scoreParfait(seed, potesMax) {
  const C = window.CONFIG;
  const route = new Route(seed);
  const dt = 1 / 120, T = dureeCourse();
  const paliers = C.potesPaliers || [];
  const M = montees(C);
  let v = 0, prevV = 0, speed = V_UNIT * C.vitesseBase;
  let jumpY = 0, vy = 0, doubled = false, tHaut = 0, plan = null;
  // Le sol n'est plus toujours 0 : les halles portent le vélo en l'air.
  let metres = 0, points = 0, potesGagnes = 0, potes = 0, turbo = 0, cible = null;
  const stats = { pieces: 0, laits: 0, rouges: 0, sauts: 0, doubles: 0, rangees: 0 };
  for (let now = 0; now < T; now += dt) {
    if (turbo > 0) { turbo -= dt; if (turbo <= 0) turbo = 0; }
    speed += (targetSpeed(now) - speed) * Math.min(1, 3 * dt);
    const vitesse = speed * (turbo > 0 ? (C.laitVitesse || 1.2) : 1);
    prevV = v;
    v += vitesse * dt;
    metres += vitesse * dt * C.metresParUnite * multiplicateur(potes, turbo > 0);

    const sol = solAt(v);
    // Pilote : au sol, il vise la prochaine cible et part au bon moment.
    if (jumpY <= sol + 0.02 && !plan) {
      for (let r = Math.floor(v) + 1; r <= Math.floor(v) + REGARD; r++) {
        const c = cibleDe(route, r);
        if (!c) continue;
        if (r - v <= vitesse * montee(c)) {
          plan = { r, type: c };
          jumpY = sol + 0.001; vy = C.sautVitesse; doubled = false; tHaut = 0; stats.sauts += 1;
        }
        break;
      }
    }
    // Re-tap : le second sommet doit tomber sur la cible.
    if (plan && plan.type === "double" && !doubled && jumpY > sol && vy <= 0) {
      vy = C.sautVitesseDouble; doubled = true; stats.doubles += 1;
    }
    if (jumpY > sol) {
      // Il garde l'appui tant qu'il monte, sauf pour un simple saut.
      const tenu = plan && plan.type !== "tap" && vy > 0 && tHaut < C.sautTenueMaxS;
      if (tenu) tHaut += dt;
      vy -= (tenu ? C.sautGraviteTenue : C.sautGravite) * dt;
      jumpY += vy * dt;
    }
    if (jumpY <= sol) { jumpY = sol; vy = 0; doubled = false; tHaut = 0; plan = null; }

    for (let r = Math.floor(v + 0.5); r <= Math.floor(v + 0.5) + Math.ceil(vitesse * 4) + 1; r++) {
      const row = route.rowAt(r);
      if ((row.type !== "traverse" && row.type !== "contresens") || row.armed) continue;
      const tArr = now + (r - v) / Math.max(0.5, vitesse);
      if (tArr - now <= 4) armer(row, now, tArr);
    }
    for (const ev of route.checkMember("sim", prevV, v, jumpY, now)) {
      const mult = multiplicateur(potes, turbo > 0);
      if (ev.type === "piece") {
        stats.pieces += 1; points += 1; metres += C.pieceMetres * mult;
        while (potesGagnes < paliers.length && points >= paliers[potesGagnes]) { potesGagnes += 1; if (potes < potesMax) potes += 1; }
        if (cible !== null && points >= cible) { cible = null; if (potes < potesMax) potes += 1; }
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
  const n = { dangers: 0, pieces: 0, piecesAir: 0, laits: 0, grosses: 0, halles: 0, tap: 0, haut: 0, double: 0, ecartMin: 99, ecartMax: 0 };
  let dernier = null;
  for (let r = 0; r < nRangees; r++) {
    const row = route.rowAt(r);
    if (row.type !== "safe") {
      n.dangers += 1; n[row.kind] = (n[row.kind] || 0) + 1; n[familleDe(row.kind)] += 1;
      if (dernier !== null) { n.ecartMin = Math.min(n.ecartMin, r - dernier); n.ecartMax = Math.max(n.ecartMax, r - dernier); }
      dernier = r;
    }
    n.pieces += row.coins.length;
    for (const h of row.coins) if (h > CORPS_HAUT) n.piecesAir += 1;
    if (row.lait !== undefined) n.laits += 1;
    if (row.grosse !== undefined) n.grosses += 1;
    if (solAt(r) > 0.05) n.halles += 1;
  }
  return n;
}
