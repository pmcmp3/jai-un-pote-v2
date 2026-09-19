// regles.js — Formules PARTAGÉES entre la course (main.js) et la simulation
// du score parfait (simulation.js), pour qu'elles ne divergent jamais :
// courbe de vitesse, multiplicateur, durée réelle de la course, graine de
// la ligue. Aucun état ici.

export const V_UNIT = 2.6;          // rangées/s par unité de « vitesse » de config.js
// 70 → 88 s le 20 septembre 2026 (« la vitesse au tout début est très bien,
// faut vraiment que ce soit progressif et que plus on avance, plus ce soit
// compliqué ») : le plafond est atteint vers 2 min au lieu de 1 min 30.
export const V_DOUBLING_S = 88;
export const LEAD_IN = 3.3;         // décompte avant le GO (ancré sur la grille du morceau)

export function targetSpeed(t) {
  const { vitesseBase, vitesseMax } = window.CONFIG;
  return V_UNIT * Math.min(vitesseMax, vitesseBase * Math.pow(2, Math.max(0, t) / V_DOUBLING_S));
}
export function multiplicateur(potes, turbo) {
  return (1 + window.CONFIG.potesBonusMetres * potes) * (turbo ? 2 : 1);
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
export const VERSION_COURSE = 5; // 20 septembre 2026 (soir) : boîtes de collision réelles, arcs de pièces, halles, contresens
export function graineDepuisTexte(txt) {
  let h = 7;
  for (const ch of String(txt)) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h;
}
// Une ligue = UNE course (9 septembre 2026 : « une ligue est créée, donc une
// course est générée, et tout le monde doit pouvoir jouer la même »).
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
