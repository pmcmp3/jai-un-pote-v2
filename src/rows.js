// rows.js — La route, rangée par rangée, fonction pure de l'index et de la
// graine (sauf l'ARMEMENT des traversées et des voitures en sens inverse, qui
// dépend du moment où le joueur arrive — voir armer()).
//
// ⚠️ v2 (19 septembre 2026) : UNE SEULE VOIE, vue de profil. Il n'y a plus de
// contournement latéral : tout se règle en HAUTEUR.
//
// ⚠️ 20 septembre 2026 (soir) — TROIS RENVERSEMENTS, tous demandés :
//
// 1. BOÎTES DE COLLISION RÉELLES. Avant, un obstacle était jugé à l'instant où
//    le CENTRE du vélo passait sa rangée, contre un seuil de hauteur FIXE par
//    famille de saut. D'où les deux plaintes : « je me suis pris un mouton mais
//    je me le suis pas pris » et « il y avait un paysan, j'ai sauté par-dessus,
//    je me le suis pris ». Désormais chaque espèce a une boîte (long × h) et le
//    cycliste la sienne : on touche si les deux se recouvrent VRAIMENT, à
//    n'importe quel instant du recouvrement. Le seuil de franchissement d'une
//    espèce, c'est sa hauteur, plus rien d'autre.
//
// 2. LA FAMILLE DE SAUT EST CALCULÉE, plus écrite à la main. On intègre les
//    trois arcs (tap, appui maintenu, double saut) et on retient le plus petit
//    qui reste au-dessus de l'obstacle pendant TOUT le temps qu'on met à le
//    franchir (longueur de la bête + longueur du vélo, à vitesse maximale).
//    Changer une taille dans KINDS ou un réglage de saut dans config.js
//    ré-attribue les familles toutes seules. Même source pour l'écart minimal
//    entre deux obstacles.
//      → petits animaux = tap · gros animaux et fermier = appui maintenu
//      · véhicules = double saut.
//
// 3. LES PIÈCES DESSINENT LE GESTE (« les tailles et l'espacement entre les
//    pièces, ça n'a aucun sens, ça doit être une règle conditionnelle »). Plus
//    de tirage : au-dessus de chaque obstacle on pose l'ARC que le joueur doit
//    suivre, une pièce par rangée, à la hauteur exacte de sa trajectoire ; sur
//    les longues lignes droites, une traînée au sol. Une seule taille de pièce,
//    un seul espacement (une rangée).
//
// Ajouts du même jour : les HALLES (une rampe qui monte à hauteur des fils
// électriques toutes les ~40 s, sol variable, cf. solAt) et la VOITURE EN SENS
// INVERSE (elle arrive de la droite de l'écran, face au joueur). La boue est
// supprimée (« enlève les trucs de terre par terre, les gens comprennent pas »).
//
// GÉNÉRATEUR À QUOTAS (9 septembre 2026, conservé) : blocs de 24 rangées,
// espèces tirées d'un paquet fixe de 12 mélangé par la graine, lait et grosse
// pièce sur des rangées réservées. Deux graines = deux routes différentes,
// mêmes quantités.

import { ROAD_HALF } from "./scene.js";
import { V_UNIT, vitesseAuRang, rangAuTemps } from "./regles.js";

// --- Le bestiaire, à l'échelle : 1 unité ≈ 1 mètre --------------------------------
// Le cycliste fait 1,8 u de haut et 1,24 u de long (VELO_DEMI × 2). Tout le
// reste est calé dessus (20 septembre 2026 : « le plus proche de mes yeux doit
// être le plus gros [...] j'ai des personnages beaucoup plus petits que des
// voitures, ça va pas du tout », et « les vaches sont plus grosses que les
// voitures »). `long` court le long de la route, `larg` en travers, `h` est la
// hauteur qu'il faut dépasser.
export const KINDS = {
  // Traversants : ils roulent le long de u, donc c'est `larg` qui barre la route.
  tracteur:    { traverse: true, cout: 3, vitesse: 2.2, vmax: 3.2, long: 4.2, larg: 1.8, h: 2.3, plancher: "double", nom: "un tracteur" },
  poulelancee: { traverse: true, cout: 1, vitesse: 4.5, vmax: 9,   long: 0.7, larg: 0.6, h: 0.7, nom: "une poule lancée" },
  // En SENS INVERSE : elle roule sur la route, vers le joueur (20 septembre
  // 2026 : « une voiture qui roule en sens inverse, pour que ce soit vraiment
  // difficile »). Sa vitesse s'ajoute à celle du joueur.
  contresens:  { contresens: true, cout: 2, vitesse: 3.4, long: 3.9, larg: 1.7, h: 1.55, plancher: "double", nom: "une voiture en face" },
  // Posés sur la route.
  poule:   { cout: 1, long: 0.70, larg: 0.60, h: 0.75, nom: "une poule" },
  chat:    { cout: 1, long: 0.80, larg: 0.50, h: 0.60, nom: "un chat" },
  chien:   { cout: 1, long: 1.00, larg: 0.55, h: 0.80, nom: "un chien" },
  mouton:  { cout: 1, long: 1.05, larg: 0.80, h: 0.85, nom: "un mouton" },
  botte:   { cout: 1, long: 1.00, larg: 0.90, h: 0.80, nom: "une botte de foin" },
  cochon:  { cout: 2, long: 1.40, larg: 0.85, h: 1.05, nom: "un cochon" },
  vache:   { cout: 2, long: 2.10, larg: 1.00, h: 1.50, nom: "une vache" },
  fermier: { cout: 2, long: 0.70, larg: 0.60, h: 1.85, nom: "un fermier" },
  voiture: { cout: 2, long: 3.90, larg: 1.70, h: 1.55, plancher: "double", nom: "une voiture" },
};

// --- Boîte de collision -----------------------------------------------------------
// Le cycliste occupe [v − VELO_DEMI, v + VELO_DEMI] le long de la route ; ses
// roues sont à `jumpY`. On passe si les roues dépassent le haut de l'obstacle
// de MARGE_H pendant TOUT le recouvrement.
// 0,48 = la moitié de l'empattement : ce sont les ROUES qui accrochent, pas
// les épaules du cycliste. Généreux pour le joueur, volontairement (il s'est
// plaint de se prendre des bêtes qu'il avait visiblement passées).
export const VELO_DEMI = 0.48;
export const MARGE_H = 0.04;
export function hauteurAFranchir(kind) { return KINDS[kind].h + MARGE_H; }
// Demi-longueur d'un obstacle LE LONG DE LA ROUTE (un traversant barre la
// route sur sa largeur, pas sur sa longueur).
export function demiLongueurRoute(kind) {
  const K = KINDS[kind];
  return (K.traverse ? K.larg : K.long) / 2;
}

// --- Les trois arcs de saut, intégrés une fois ------------------------------------
// tap : on lâche tout de suite ; haut : on garde l'appui tant qu'on monte ;
// double : pareil, plus une seconde impulsion au sommet.
const PAS_ARC = 1 / 480;
let ARCS = null;
function arcs() {
  if (ARCS) return ARCS;
  const C = window.CONFIG;
  const calcul = (tier) => {
    let h = 0, vy = C.sautVitesse, tH = 0, doubled = false;
    const pts = [0];
    for (let i = 0; i < 4 / PAS_ARC; i++) {
      const tenu = tier !== "tap" && vy > 0 && tH < C.sautTenueMaxS;
      if (tenu) tH += PAS_ARC;
      if (tier === "double" && !doubled && vy <= 0) { vy = C.sautVitesseDouble; doubled = true; }
      vy -= (tenu ? C.sautGraviteTenue : C.sautGravite) * PAS_ARC;
      h += vy * PAS_ARC;
      if (h <= 0) break;
      pts.push(h);
    }
    let apex = 0, iApex = 0;
    pts.forEach((x, i) => { if (x > apex) { apex = x; iApex = i; } });
    return { pts, apex, tApex: iApex * PAS_ARC, duree: pts.length * PAS_ARC };
  };
  ARCS = { tap: calcul("tap"), haut: calcul("haut"), double: calcul("double") };
  return ARCS;
}
export const FAMILLES = ["tap", "haut", "double"];
// Hauteur des roues `t` secondes après le décollage (0 en dehors de l'arc).
export function hauteurArc(tier, t) {
  const a = arcs()[tier];
  const i = Math.round(t / PAS_ARC);
  return i < 0 || i >= a.pts.length ? 0 : a.pts[i];
}
export function apexArc(tier) { return arcs()[tier].apex; }
export function montee(tier) { return arcs()[tier].tApex; }
export function retombee(tier) { return arcs()[tier].duree - arcs()[tier].tApex; }
// Secondes passées au-dessus de la hauteur H.
function tempsAuDessus(tier, H) {
  const a = arcs()[tier];
  let n = 0;
  for (const h of a.pts) if (h >= H) n += 1;
  return n * PAS_ARC;
}

// --- La famille de saut d'une espèce, CALCULÉE ------------------------------------
// On franchit un obstacle pendant (sa longueur sur la route + celle du vélo)
// rangées ; à vitesse maximale c'est le pire cas. Pour un véhicule en sens
// inverse, les deux vitesses s'additionnent : la fenêtre est plus courte.
function vMaxRangees() { return V_UNIT * window.CONFIG.vitesseMax; }
function vMinRangees() { return V_UNIT * window.CONFIG.vitesseBase; }
// ⚠️ Le pire cas, c'est la vitesse MINIMALE : la longueur d'un obstacle est
// fixée en rangées, donc plus on roule lentement, plus on reste longtemps
// au-dessus de lui — et c'est là que l'arc de saut risque de ne pas tenir.
// (Mesuré : à 5,3 rangées/s le joueur idéal accrochait moutons et bottes,
// jamais à 6,8.)
function fenetreSecondes(kind) {
  const K = KINDS[kind];
  const rangees = demiLongueurRoute(kind) * 2 + VELO_DEMI * 2;
  const vRel = vMinRangees() + (K.contresens ? K.vitesse : 0);
  return rangees / vRel;
}
const MARGE_FENETRE = 0.06; // secondes de confort : on ne veut aucun saut « au pixel »
let FAMILLE = null;
export function familleDe(kind) {
  if (!FAMILLE) {
    FAMILLE = {};
    for (const k of Object.keys(KINDS)) {
      const besoin = fenetreSecondes(k) + MARGE_FENETRE;
      const H = hauteurAFranchir(k);
      const calculee = FAMILLES.find((t) => tempsAuDessus(t, H) >= besoin) || "double";
      // Plancher de lisibilité : TOUT CE QUI ROULE se passe au double saut,
      // quel que soit le calcul (c'est la règle annoncée par le bestiaire —
      // « tout ce qui roule : saute, puis re-tape »). Sans ça, la voiture en
      // face, plus vite croisée, aurait demandé un geste différent de la
      // voiture garée : même objet, deux gestes, impossible à apprendre.
      const plancher = KINDS[k].plancher;
      FAMILLE[k] = plancher && FAMILLES.indexOf(plancher) > FAMILLES.indexOf(calculee) ? plancher : calculee;
    }
  }
  return FAMILLE[kind];
}
// Compatibilité : `KINDS[k].franchir` reste lu par la simulation, le bestiaire
// et les outils de mesure — c'est maintenant une propriété calculée.
for (const k of Object.keys(KINDS)) {
  Object.defineProperty(KINDS[k], "franchir", { get() { return familleDe(k); }, enumerable: true });
}
// Écart minimal entre deux obstacles : le temps de retomber du premier plus
// celui de prendre son élan pour le second, converti en rangées à vitesse
// maximale, plus les deux demi-longueurs.
export function ecartMin(a, b) {
  const v = vMaxRangees();
  const t = retombee(familleDe(a)) + montee(familleDe(b));
  return Math.ceil(t * v + demiLongueurRoute(a) + demiLongueurRoute(b)) + 1;
}

// --- Pièces : elles dessinent le geste --------------------------------------------
// Une pièce est ramassée quand elle tombe dans le buste du cycliste : centre à
// `jumpY + CORPS_CENTRE`, demi-fenêtre CORPS_DEMI. Les arcs posent les pièces
// pile à cette hauteur — suivre la trajectoire, c'est toutes les prendre.
export const PRISE_V = 0.62;
export const CORPS_CENTRE = 0.85, CORPS_DEMI = 1.0;
export const CORPS_BAS = CORPS_CENTRE - CORPS_DEMI, CORPS_HAUT = CORPS_CENTRE + CORPS_DEMI;
export function dansLeCorps(h, jumpY) { return Math.abs(h - (jumpY + CORPS_CENTRE)) <= CORPS_DEMI; }
export const PIECE_SOL = CORPS_CENTRE;      // 0,85 : ramassée en roulant
export const H_LAIT = PIECE_SOL, H_ROUGE = PIECE_SOL;

export const GRACE_ROWS = 40;    // ~9 s sans rien au départ
const RAMP_ROWS = 1000;
// Marge ALÉATOIRE ajoutée à l'écart minimal, en rangées : large au début, plus
// serrée à la fin.
const MOU_DEBUT = 8, MOU_FIN = 1;
export const BLOC = 24;
// UN SEUL espacement dans tout le jeu : une pièce toutes les deux rangées,
// sur l'arc comme au sol (20 septembre 2026 : « les tailles et l'espacement
// entre les pièces, ça n'a aucun sens ; ça doit être une règle conditionnelle,
// avoir des standards »). Une seule taille de pièce aussi (main.js, PIECE_R).
export const ESPACEMENT = 2;
const TRAINEE_MIN = 7;           // rangées libres d'affilée avant de poser une traînée au sol
const TRAINEE_LONGUEUR = 3;      // pièces d'une traînée
const LAIT_EVERY = 48;
const GROSSE_EVERY = 70;         // la grosse pièce dorée (ex-rouge)

// --- Les HALLES (20 septembre 2026) ------------------------------------------------
// « Faut que je prenne une rampe et que je me retrouve au niveau des fils
// électriques [...] au bout de 30 ou 40 secondes de jeu, pour que ça fasse une
// variation. » Une rampe monte, un plancher file en l'air, une rampe redescend :
// pendant ce temps la route est vide et couverte de pièces. Le sol du jeu n'est
// donc plus toujours 0 : voir solAt().
export const HALLE_HAUT = 4.2;
const HALLE_MONTEE = 7, HALLE_PLAT = 26, HALLE_DESCENTE = 7;
export const HALLE_ROWS = HALLE_MONTEE + HALLE_PLAT + HALLE_DESCENTE;
const HALLE_TEMPS = [36, 76, 116, 156];  // secondes de course
let HALLES = null;
function halles() {
  if (!HALLES) HALLES = HALLE_TEMPS.map((t) => Math.round(rangAuTemps(t)));
  return HALLES;
}
// Début de la halle qui couvre la rangée r, ou null.
export function halleA(r) {
  for (const d of halles()) if (r >= d - 1 && r <= d + HALLE_ROWS + 1) return d;
  return null;
}
// Hauteur du SOL à l'avancement v (0 sur la route normale).
export function solAt(v) {
  const d = halleA(Math.round(v));
  if (d === null) return 0;
  const p = v - d;
  if (p <= 0 || p >= HALLE_ROWS) return 0;
  if (p < HALLE_MONTEE) return HALLE_HAUT * (p / HALLE_MONTEE);
  if (p < HALLE_MONTEE + HALLE_PLAT) return HALLE_HAUT;
  return HALLE_HAUT * (1 - (p - HALLE_MONTEE - HALLE_PLAT) / HALLE_DESCENTE);
}
function dansHalle(r) { const d = halleA(r); return d !== null && r >= d && r <= d + HALLE_ROWS; }

// --- Paquets d'espèces ------------------------------------------------------------
const PAQUETS = [
  // Départ : que des petits sauts.
  ["poule", "poule", "poule", "chat", "chat", "chien", "chien", "mouton", "mouton", "botte", "botte", "poulelancee"],
  // Ensuite : les gros animaux (appui maintenu) et les premiers véhicules.
  ["poule", "poule", "chat", "chien", "mouton", "botte", "poulelancee", "cochon", "cochon", "vache", "tracteur", "voiture"],
  // Fin : fermiers, voitures, et la voiture qui arrive en face.
  ["poule", "chat", "mouton", "botte", "poulelancee", "cochon", "vache", "tracteur", "tracteur", "fermier", "voiture", "contresens"],
];
function paquetPour(d) { return PAQUETS[d < 2 ? 0 : d < 4 ? 1 : 2]; }
function estDouble(kind) { return familleDe(kind) === "double"; }

// --- La route ----------------------------------------------------------------------
export class Route {
  constructor(seed) {
    this.seed = seed !== undefined ? seed : Math.floor(Math.random() * 100000);
    this.cache = new Map();
    this.fenetreSure = null;
    this.paquets = new Map();
    this.dangers = new Map();      // rangée → espèce (chaîne globale)
    this.chaine = null;
    this.resolved = new Set();
    this.coins = new Set();
    this.blocs = new Set();
  }
  hash(n) {
    const x = Math.sin(n * 91.173 + this.seed * 0.731) * 43758.5453;
    return x - Math.floor(x);
  }
  reset() { this.cache.clear(); this.resolved.clear(); this.coins.clear(); this.dangers.clear(); this.blocs.clear(); this.chaine = null; this.fenetreSure = null; }
  dansFenetre(r) { return this.fenetreSure !== null && r >= this.fenetreSure[0] && r <= this.fenetreSure[1]; }
  // Rangée sûre (départ, turbo lait, tuto) : une ligne de pièces au sol — à la
  // hauteur du PLANCHER, qui n'est pas 0 sur une halle.
  rangeeSure(r) { return { type: "safe", coins: r % 3 === 1 ? [solAt(r) + PIECE_SOL] : [], boue: null }; }
  ouvrirFenetreSure(from, to) {
    this.fenetreSure = [from, to];
    for (let r = from; r <= to; r++) this.cache.set(r, this.rangeeSure(r));
  }

  melange(liste, k) {
    const a = liste.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.hash(k * 131 + i * 17 + 5) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  arrangement(d) {
    if (this.paquets.has(d)) return this.paquets.get(d);
    const avant = d > 0 ? this.arrangement(d - 1) : null;
    const finDouble = avant ? estDouble(avant[avant.length - 1]) : false;
    const paquet = paquetPour(d);
    let arr = null;
    for (let essai = 0; essai < 80 && !arr; essai++) {
      const a = this.melange(paquet, 1000 + d + essai * 7919);
      let ok = !(finDouble && estDouble(a[0]));
      for (let i = 1; ok && i < a.length; i++) if (estDouble(a[i]) && estDouble(a[i - 1])) ok = false;
      if (ok) arr = a;
    }
    if (!arr) {
      const hauts = paquet.filter(estDouble), bas = paquet.filter((k) => !estDouble(k));
      arr = [];
      while (bas.length || hauts.length) { if (bas.length) arr.push(bas.shift()); if (hauts.length) arr.push(hauts.shift()); }
    }
    this.paquets.set(d, arr);
    return arr;
  }
  especeDanger(i) { return this.arrangement(Math.floor(i / 12))[i % 12]; }

  // Chaîne de dangers : chacun posé à l'écart que la physique du saut impose
  // avec le précédent, plus une marge qui se resserre. Saute les rangées
  // réservées (lait, grosse pièce) et toute une halle.
  etendreDangers(rMax) {
    if (!this.chaine) this.chaine = { r: GRACE_ROWS - 4, kind: null, i: 0 };
    while (this.chaine.r <= rMax) {
      const i = this.chaine.i;
      const kind = this.especeDanger(i);
      const t = Math.min(1, Math.max(0, this.chaine.r / RAMP_ROWS));
      const mou = Math.round(MOU_DEBUT + (MOU_FIN - MOU_DEBUT) * t);
      const base = this.chaine.kind ? ecartMin(this.chaine.kind, kind) : 6;
      let r = this.chaine.r + base + Math.floor(this.hash(i * 37 + 11) * (mou + 1));
      let garde = 0;
      while (garde++ < 400 && (estReservee(r) || estReservee(r - 1) || estReservee(r + 1) || dansHalle(r) || dansHalle(r - 4) || dansHalle(r + 4))) r += 1;
      this.dangers.set(r, kind);
      this.chaine = { r, kind, i: i + 1 };
    }
  }

  // --- Les pièces d'un obstacle : l'ARC de son saut -------------------------------
  // On échantillonne la trajectoire de la famille demandée, une pièce par
  // rangée, à la hauteur du buste. Suivre l'arc = tout ramasser.
  arcPieces(rObs, kind) {
    const tier = familleDe(kind);
    const vit = Math.max(1, vitesseAuRang(rObs));
    const rDepart = rObs - montee(tier) * vit;
    const demi = demiLongueurRoute(kind) + 0.4;
    const out = [];
    // On ne garde que la partie HAUTE de l'arc : les pièces qui rasent le sol
    // juste avant et juste après le saut n'apprennent rien et faisaient
    // exploser le compte (« il y a beaucoup trop de pièces »).
    const seuil = Math.min(apexArc(tier) * 0.45, 0.8);
    for (let q = Math.ceil(rDepart); q <= Math.floor(rDepart + retombee(tier) * vit + montee(tier) * vit); q++) {
      if (Math.abs(q - rObs) <= demi) continue;
      // Une rangée sur deux, calées sur l'obstacle : l'arc reste lisible, et
      // le compte ne double pas parce qu'un saut dure longtemps.
      if (((q - rObs) % ESPACEMENT + ESPACEMENT) % ESPACEMENT !== 0) continue;
      const h = hauteurArc(tier, (q - rDepart) / vit);
      if (h < seuil) continue;
      out.push({ r: q, h: h + CORPS_CENTRE });
    }
    return out;
  }

  genererBloc(b) {
    if (this.blocs.has(b)) return;
    this.blocs.add(b);
    const r0 = GRACE_ROWS + b * BLOC;
    this.etendreDangers(r0 + BLOC + 24);
    const rowsBloc = new Array(BLOC);
    // 1. Les dangers.
    for (let p = 0; p < BLOC; p++) {
      const kind = this.dangers.get(r0 + p);
      if (!kind) continue;
      const K = KINDS[kind];
      rowsBloc[p] = K.traverse
        ? { type: "traverse", kind, dir: -1, armed: false, t0: 0, u0: 0, vitesse: K.vitesse, coins: [], boue: null }
        : K.contresens
          ? { type: "contresens", kind, armed: false, t0: 0, v0: 0, vitesse: K.vitesse, coins: [], boue: null }
          : { type: "statique", kind, coins: [], boue: null };
    }
    for (let p = 0; p < BLOC; p++) if (!rowsBloc[p]) rowsBloc[p] = { type: "safe", coins: [], boue: null };
    // 2. Les arcs de pièces (ils peuvent déborder du bloc : on garde ce qui
    //    tombe dedans, le bloc voisin recalcule sa part quand il se génère).
    const pose = (r, h, grosse) => {
      const p = r - r0;
      if (p < 0 || p >= BLOC) return false;
      const row = rowsBloc[p];
      if (row.type !== "safe" || row.lait !== undefined || row.grosse !== undefined) return false;
      if (grosse) { row.grosse = h; row.coins = []; return true; }
      if (row.coins.length) return false;
      row.coins = [h];
      return true;
    };
    for (let p = -12; p < BLOC + 12; p++) {
      const kind = this.dangers.get(r0 + p);
      if (!kind) continue;
      for (const c of this.arcPieces(r0 + p, kind)) pose(c.r, c.h, false);
    }
    // 3. Halle : plancher couvert de pièces (une rangée sur deux).
    for (let p = 0; p < BLOC; p++) {
      const r = r0 + p;
      const d = halleA(r);
      if (d === null || !dansHalle(r)) continue;
      rowsBloc[p] = { type: "safe", coins: [], boue: null };
      if ((r - d) % (ESPACEMENT * 2) === 0 && r - d >= 2 && r - d <= HALLE_ROWS - 2) rowsBloc[p].coins = [solAt(r) + PIECE_SOL];
    }
    // 4. Traînées au sol sur les longues lignes droites.
    let libre = 0;
    for (let p = 0; p < BLOC; p++) {
      const row = rowsBloc[p];
      const vide = row.type === "safe" && !row.coins.length && row.lait === undefined && row.grosse === undefined && !dansHalle(r0 + p);
      if (!vide) { libre = 0; continue; }
      libre += 1;
      if (libre === TRAINEE_MIN) {
        const depart = p - TRAINEE_MIN + 2;
        for (let i = 0; i < TRAINEE_LONGUEUR; i++) pose(r0 + depart + i * ESPACEMENT, PIECE_SOL, false);
        libre = 0;
      }
    }
    // 5. Lait et grosse pièce sur leurs rangées réservées, sinon au plus près.
    // Le lait et la grosse pièce se posent sur une rangée LIBRE et à l'écart :
    // jamais sur un arc (ça y ferait un trou) ni collée à un obstacle (elle
    // attirait le joueur pile là où il ne faut pas être).
    const dispo = (p) => {
      if (p < 0 || p >= BLOC) return false;
      const row = rowsBloc[p];
      if (row.type !== "safe" || row.coins.length || row.lait !== undefined || row.grosse !== undefined) return false;
      if (dansHalle(r0 + p)) return false;
      for (let d = -3; d <= 3; d++) if (this.dangers.has(r0 + p + d)) return false;
      return true;
    };
    for (let p = 0; p < BLOC; p++) {
      const r = r0 + p;
      const kind = r % LAIT_EVERY === LAIT_EVERY / 2 ? "lait" : r % GROSSE_EVERY === 40 ? "grosse" : null;
      if (!kind) continue;
      let q = null;
      for (let d = 0; d < BLOC && q === null; d++) { if (dispo(p + d)) q = p + d; else if (dispo(p - d)) q = p - d; }
      if (q === null) continue;
      rowsBloc[q][kind] = kind === "lait" ? solAt(r0 + q) + H_LAIT : solAt(r0 + q) + H_ROUGE;
    }
    for (let p = 0; p < BLOC; p++) { const r = r0 + p; if (!this.cache.has(r) && !this.dansFenetre(r)) this.cache.set(r, rowsBloc[p]); }
  }

  rowAt(r) {
    const hit = this.cache.get(r);
    if (hit) return hit;
    if (r < GRACE_ROWS || this.dansFenetre(r)) { const row = this.rangeeSure(r); this.cache.set(r, row); return row; }
    const b = Math.floor((r - GRACE_ROWS) / BLOC);
    for (let k = 0; k <= b; k++) this.genererBloc(k);
    return this.cache.get(r) || this.rangeeSure(r);
  }

  coinTaken(r, i) { return this.coins.has(`${r}:${i}`); }
  bonusTaken(r, kind) { return this.coins.has(`${r}:${kind}`); }

  // Événements d'un cycliste qui passe de prevV à v, roues à `jumpY`.
  // Pièces : hauteur dans le buste. Obstacles : recouvrement RÉEL des boîtes.
  checkMember(id, prevV, v, jumpY, t) {
    const events = [];
    const rA = Math.max(0, Math.floor(Math.min(prevV, v) - 4)), rB = Math.floor(v + 4);
    for (let r = rA; r <= rB; r++) {
      const row = this.rowAt(r);
      if (Math.abs(v - r) < PRISE_V) {
        for (let i = 0; i < row.coins.length; i++) {
          const key = `${r}:${i}`;
          if (this.coins.has(key) || !dansLeCorps(row.coins[i], jumpY)) continue;
          this.coins.add(key);
          events.push({ type: "piece", r, h: row.coins[i] });
        }
        for (const [kind, h] of [["lait", row.lait], ["grosse", row.grosse]]) {
          if (h === undefined || this.coins.has(`${r}:${kind}`) || !dansLeCorps(h, jumpY)) continue;
          this.coins.add(`${r}:${kind}`);
          events.push({ type: kind === "grosse" ? "rouge" : kind, r, h });
        }
      }
      if (row.type === "safe") continue;
      const key = `s${r}:${id}`;
      if (this.resolved.has(key)) continue;
      const K = KINDS[row.kind];
      // Où l'obstacle se trouve LE LONG DE LA ROUTE à l'instant t.
      let centre = r, present = true;
      if (row.type === "contresens") { if (!row.armed) { present = false; } else centre = r + row.v0 - row.vitesse * (t - row.t0); }
      else if (row.type === "traverse") {
        present = false;
        for (const inst of crossersAt(r, row, t)) if (Math.abs(inst.u) < K.long / 2 + 0.35) { present = true; centre = r; }
      }
      if (!present) continue;
      const demi = demiLongueurRoute(row.kind) + VELO_DEMI;
      // Balayage du pas : on prend le point du segment [prevV, v] le plus
      // proche du centre de l'obstacle (à 120 Hz le pas fait 0,06 rangée, mais
      // le balayage protège d'un décrochage d'image).
      const proche = Math.max(Math.min(prevV, v), Math.min(Math.max(prevV, v), centre));
      if (Math.abs(proche - centre) >= demi) continue;
      if (jumpY >= hauteurAFranchir(row.kind) + solAt(centre)) continue;
      this.resolved.add(key);
      events.push({ type: "obstacle", kind: row.kind, cout: K.cout, franchir: familleDe(row.kind), r });
    }
    return events;
  }
}

// --- Rangées réservées ---------------------------------------------------------------
function estReservee(r) { return r % LAIT_EVERY === LAIT_EVERY / 2 || r % GROSSE_EVERY === 40; }

// Armement : la traversée part du FOND et atteint la route à `tArrivee` ; la
// voiture en sens inverse part de DEVANT et arrive sur la rangée au même
// instant.
export function armer(row, now, tArrivee) {
  if (row.armed) return;
  row.armed = true;
  row.t0 = now;
  const K = KINDS[row.kind];
  const dt = Math.max(0.6, tArrivee - now);
  if (row.type === "contresens") { row.vitesse = K.vitesse; row.v0 = row.vitesse * dt; return; }
  row.u0 = -row.dir * (ROAD_HALF + 6.0);
  const dist = Math.abs(row.u0);
  row.vitesse = Math.max(1.8, Math.min(K.vmax || 9, dist / dt));
}

// Position d'une voiture en sens inverse à l'instant t (null si pas armée).
export function contresensAt(r, row, t) {
  if (row.type !== "contresens" || !row.armed) return null;
  const v = r + row.v0 - row.vitesse * (t - row.t0);
  if (v < r - 26 || v > r + 90) return null;
  return { v, kind: row.kind, K: KINDS[row.kind] };
}

const U_SORTIE = -(ROAD_HALF + 3.2);
export function crossersAt(r, row, t) {
  if (row.type !== "traverse" || !row.armed) return [];
  const K = KINDS[row.kind];
  const u = row.u0 + row.dir * row.vitesse * (t - row.t0);
  if (u < U_SORTIE || u > ROAD_HALF + 6.6) return [];
  const alpha = Math.max(0, Math.min(1, (u - U_SORTIE) / 1.6, (t - row.t0) / 0.5));
  return [{ id: r * 100003, r, u, dir: row.dir, kind: row.kind, K, alpha }];
}

// --- L'instance VIVANTE (celle du jeu) ------------------------------------------------
let live = new Route();
export function getSeed() { return live.seed; }
export function reseed(force) { live = new Route(force); }
export function reset() { live.reset(); }
export function ouvrirFenetreSure(from, to) { live.ouvrirFenetreSure(from, to); }
export function rowAt(r) { return live.rowAt(r); }
export function coinTaken(r, i) { return live.coinTaken(r, i); }
export function bonusTaken(r, kind) { return live.bonusTaken(r, kind); }
export function checkMember(id, prevV, v, jumpY, t) { return live.checkMember(id, prevV, v, jumpY, t); }
