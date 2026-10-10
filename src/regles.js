// regles.js — Formules PARTAGÉES entre la course (main.js) et la simulation
// du score parfait (simulation.js), pour qu'elles ne divergent jamais :
// courbe de vitesse, multiplicateur, durée réelle de la course, graine de
// la ligue. Aucun état ici.

export const V_UNIT = 2.6;          // rangées/s par unité de « vitesse » de config.js
// Accélération progressive : la vitesse double toutes les V_DOUBLING_S secondes jusqu'à vitesseMax.
export const V_DOUBLING_S = 50; // vitesseMax atteinte vers 30 s
export const LEAD_IN = 3.3;         // décompte avant le GO (ancré sur la grille du morceau)

export function targetSpeed(t) {
  const { vitesseBase, vitesseMax, vitesseFinale, accelDernieresS } = window.CONFIG;
  let v = Math.min(vitesseMax, vitesseBase * Math.pow(2, Math.max(0, t) / V_DOUBLING_S));
  if (vitesseFinale && accelDernieresS) {
    const tA = dureeCourse() - accelDernieresS;
    if (t > tA) v = Math.max(v, vitesseMax + (vitesseFinale - vitesseMax) * Math.min(1, (t - tA) / (accelDernieresS - 15)));
  }
  return V_UNIT * v;
}
// Multiplicateur ENTIER : 3 potes = ×3, 5 potes = ×5 (×1 tant qu'on en a
// moins de deux), doublé par le turbo.
export function multiplicateur(potes, turbo) {
  return Math.max(1, potes) * (turbo ? 2 : 1);
}
// Durée de course effective : le morceau moins le temps du GO (le départ est
// posé sur un temps du morceau, ≥ LEAD_IN après la position de lecture — ici
// la position 0, cas du premier départ et du REJOUER).
export function dureeCourse() {
  const pas = 60 / window.CONFIG.bpm;
  const go = Math.ceil(LEAD_IN / pas) * pas;
  return window.CONFIG.dureeMorceau - go;
}

// ⚠️ VERSION DU PARCOURS : à incrémenter dès que le générateur (rows.js) ou
// les règles changent la route — les scores et fantômes d'une ligue sont
// filtrés sur la graine, une nouvelle version repart donc sur un classement
// vierge sans rien supprimer en base.
export const VERSION_COURSE = 24; // entre dans graineLigue() : +1 = nouvelle route partout
export function graineDepuisTexte(txt) {
  let h = 7;
  for (const ch of String(txt)) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h;
}
// Une ligue = UNE course : tous ses membres jouent la même route, tirée de
// son code et de la version du parcours.
export function graineLigue(code) { return graineDepuisTexte(`${code}#v${VERSION_COURSE}`); }

// --- Rangée ↔ temps ↔ vitesse -------------------------------------------------
// La route est une fonction pure de l'index de rangée, mais la vitesse, elle,
// dépend du TEMPS. Pour poser les arcs de pièces à la bonne échelle (rows.js)
// et pour placer les halles à un moment donné de la course, on intègre la
// courbe de vitesse une fois pour toutes : rangée → temps → vitesse.
let TABLE = null;
function table() {
  if (TABLE) return TABLE;
  const dt = 0.05;
  let v = V_UNIT * window.CONFIG.vitesseBase, r = 0;
  const t = [{ r: 0, v, t: 0 }];
  for (let now = 0; now < 400; now += dt) {
    v += (targetSpeed(now) - v) * Math.min(1, 3 * dt);
    r += v * dt;
    t.push({ r, v, t: now + dt });
  }
  TABLE = t;
  return t;
}
function cherche(r) {
  const T = table();
  let lo = 0, hi = T.length - 1;
  if (r <= 0) return T[0];
  if (r >= T[hi].r) return T[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m].r <= r) lo = m; else hi = m; }
  return T[lo];
}
// Vitesse (rangées/s) quand le joueur atteint la rangée r.
export function vitesseAuRang(r) { return cherche(r).v; }
// Rangée atteinte après `t` secondes de course (halles, mesures).
export function rangAuTemps(t) {
  const T = table();
  let lo = 0, hi = T.length - 1;
  if (t <= 0) return 0;
  if (t >= T[hi].t) return T[hi].r;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m].t <= t) lo = m; else hi = m; }
  return T[lo].r;
}
