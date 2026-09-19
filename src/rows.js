// rows.js — La route, rangée par rangée, fonction pure de l'index et de la
// graine (sauf l'ARMEMENT des traversées, qui dépend du moment où le joueur
// arrive — voir armer()).
//
// ⚠️ v2 (19 septembre 2026) : UNE SEULE VOIE, vue de profil. Il n'y a plus
// de contournement latéral : tout se règle en HAUTEUR.
//   - obstacle « saut »  : il faut être en l'air (hauteur ≥ 0,45) quand le
//     vélo passe dessus — poule, chat, chien, mouton, botte, cochon, vache,
//     poule lancée ;
//   - obstacle « salto » : trop haut pour un saut simple (apex 1,25) — il
//     faut le re-tap en l'air (hauteur ≥ 1,45) : tracteur, fermier, voiture ;
//   - l'obstacle est jugé à l'INSTANT où le centre du vélo passe sa rangée
//     (aussi tolérant que la v1, qui jugeait au premier contact).
// Les pièces vivent à une HAUTEUR : au sol (0,9 — ramassées en roulant), en
// arc au-dessus de chaque obstacle (le dessin du saut à faire : bas pour un
// saut, haut pour un salto), ou en pile sur une rangée libre.
//
// GÉNÉRATEUR À QUOTAS (9 septembre 2026, conservé) : blocs de 24 rangées,
// nombre EXACT de dangers par bloc, espèces tirées d'un paquet fixe de 12
// mélangé par la graine, pièces = quota exact des rangées éligibles, lait et
// pièce rouge sur des rangées réservées. Deux graines = deux routes
// différentes, mêmes quantités. Ajout v2 : jamais deux obstacles « salto »
// consécutifs (la barre d'élan doit avoir le temps de se recharger).

import { ROAD_HALF } from "./scene.js";

export const KINDS = {
  // Traversants : `long` le long de leur trajet (u), `larg` le long de la
  // route (v). `vmax` = vitesse plafond d'une traversée armée (u/s).
  tracteur:    { traverse: true, franchir: "salto", cout: 3, vitesse: 2.2, vmax: 3.2, long: 2.4, larg: 1.05, h: 1.4, nom: "un tracteur" },
  poulelancee: { traverse: true, franchir: "saut", cout: 1, vitesse: 4.5, vmax: 9, long: 0.55, larg: 0.5, h: 0.55, nom: "une poule lancée" },
  // Posés : `long` le long de la route (v), `larg` en travers (u).
  poule:   { traverse: false, franchir: "saut",  cout: 1, long: 0.55, larg: 0.5,  h: 0.55, nom: "une poule" },
  chat:    { traverse: false, franchir: "saut",  cout: 1, long: 0.6,  larg: 0.35, h: 0.4,  nom: "un chat" },
  chien:   { traverse: false, franchir: "saut",  cout: 1, long: 0.8,  larg: 0.4,  h: 0.6,  nom: "un chien" },
  mouton:  { traverse: false, franchir: "saut",  cout: 1, long: 0.9,  larg: 0.6,  h: 0.7,  nom: "un mouton" },
  botte:   { traverse: false, franchir: "saut",  cout: 1, long: 0.9,  larg: 0.9,  h: 0.75, nom: "une botte de foin" },
  cochon:  { traverse: false, franchir: "saut",  cout: 2, long: 1.0,  larg: 0.6,  h: 0.7,  nom: "un cochon" },
  vache:   { traverse: false, franchir: "saut",  cout: 2, long: 1.5,  larg: 0.8,  h: 1.1,  nom: "une vache" },
  fermier: { traverse: false, franchir: "salto", cout: 2, long: 0.5,  larg: 0.5,  h: 1.8,  nom: "un fermier" },
  voiture: { traverse: false, franchir: "salto", cout: 2, long: 2.0,  larg: 0.95, h: 1.0,  nom: "une voiture garée" },
};
// Hauteur (bas des roues) à avoir quand le vélo passe l'obstacle.
export const H_FRANCHIR = { saut: 0.45, salto: 1.45 };
function estSalto(kind) { return KINDS[kind].franchir === "salto"; }
// Distance minimale (en rangées) entre deux obstacles consécutifs, selon ce
// qu'ils demandent. Mesuré à vitesse max (6,8 rangées/s) : un saut occupe
// ~1,9 rangée de chaque côté de son sommet ; un salto rapide (double tap)
// demande ~2 rangées d'élan et retombe ~2 rangées après.
function ecart(a, b) { return estSalto(a) || estSalto(b) ? 5 : 1 + GAP_MIN; }

// --- Pièces -----------------------------------------------------------------------
// Un cycliste ramasse une pièce dont la hauteur tombe dans son corps :
// [bas des roues + 0,25 ; bas des roues + 1,75]. Au sol : jusqu'à 1,75.
export const PRISE_V = 0.45;
export const CORPS_BAS = 0.25, CORPS_HAUT = 1.75;
export function dansLeCorps(h, jumpY) { return h >= jumpY + CORPS_BAS && h <= jumpY + CORPS_HAUT; }
export const PIECE_SOL = 0.9;
// Arcs au-dessus des obstacles : [côtés (rangées r−1 et r+1), centre (r)].
// Hors de portée au sol (> 1,75) ; le haut de l'arc « salto » (3,1 / 3,4)
// est hors de portée d'un saut simple (apex 1,25 → corps jusqu'à 3,0).
export const ARCS = { saut: [1.9, 2.3], salto: [3.1, 3.4] };
// Piles sur les rangées libres, tirées d'un PAQUET fixe de 10 (mêmes
// quantités pour toutes les graines) : au sol, en l'air, les deux, au salto.
const PILES = { sol: [PIECE_SOL], saut: [2.2], double: [PIECE_SOL, 1.9], salto: [3.3] };
const PAQUET_PILES = ["sol", "sol", "sol", "sol", "sol", "saut", "saut", "saut", "double", "salto"];
export const H_LAIT = 0.95, H_ROUGE = 1.0;

export const GRACE_ROWS = 40;    // ~9 s sans rien au départ (« laisse vraiment du temps au début »)
const RAMP_ROWS = 1000;
const P_DANGER_START = 0.10, P_DANGER_MAX = 0.30;
const GAP_MIN = 3;               // toujours 3 rangées sûres après un danger
export const BLOC = 24;
const P_PIECE = 0.25;            // piles sur 25 % des rangées éligibles
const LAIT_EVERY = 48;           // brique de lait : rangées 24, 72, 120…
const ROUGE_EVERY = 70;          // pièce rouge : rangées 40, 110, 180…
const BOUE_DEBUT_T = 0.08;

// Paquets d'espèces (12 dangers chacun), par phase du parcours — même
// composition que la v1 : doux, puis gros animaux, puis tracteurs doublés.
const PAQUETS = [
  ["poule", "poule", "poule", "chat", "chat", "chien", "mouton", "mouton", "botte", "botte", "tracteur", "poulelancee"],
  ["poule", "poule", "chat", "chien", "mouton", "botte", "cochon", "vache", "fermier", "voiture", "tracteur", "poulelancee"],
  ["poule", "chat", "mouton", "botte", "cochon", "cochon", "vache", "fermier", "voiture", "tracteur", "tracteur", "poulelancee"],
];
function paquetPour(d) { return PAQUETS[d < 2 ? 0 : d < 5 ? 1 : 2]; }

// --- La route : une CLASSE (le jeu utilise l'instance `live` ; simulation.js
// crée ses propres instances et ne touche jamais au parcours en cours) ------------
export class Route {
  constructor(seed) {
    this.seed = seed !== undefined ? seed : Math.floor(Math.random() * 100000);
    this.cache = new Map();
    this.fenetreSure = null;
    this.piecesCumul = new Map();
    this.paquets = new Map();
    this.resolved = new Set();
    this.coins = new Set();
  }
  hash(n) {
    const x = Math.sin(n * 91.173 + this.seed * 0.731) * 43758.5453;
    return x - Math.floor(x);
  }
  reset() { this.cache.clear(); this.resolved.clear(); this.coins.clear(); this.piecesCumul.clear(); this.fenetreSure = null; }
  dansFenetre(r) { return this.fenetreSure !== null && r >= this.fenetreSure[0] && r <= this.fenetreSure[1]; }
  // Rangée sûre (départ, turbo lait, tuto) : une ligne de pièces au sol, une
  // rangée sur trois.
  rangeeSure(r) { return { type: "safe", coins: r % 3 === 1 ? [PIECE_SOL] : [], boue: null }; }
  ouvrirFenetreSure(from, to) {
    this.fenetreSure = [from, to];
    for (let r = from; r <= to; r++) this.cache.set(r, this.rangeeSure(r));
  }

  melange(liste, k) {
    const a = liste.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.hash(k * 131 + i * 17 + 5) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // Ordre du paquet d, sans deux « salto » consécutifs (y compris avec le
  // dernier du paquet précédent). Mélange seedé, retenté jusqu'à ce que ça
  // tienne ; repli déterministe (jamais mesuré).
  arrangement(d) {
    if (this.paquets.has(d)) return this.paquets.get(d);
    const avant = d > 0 ? this.arrangement(d - 1) : null;
    const finSalto = avant ? estSalto(avant[avant.length - 1]) : false;
    const paquet = paquetPour(d);
    let arr = null;
    for (let essai = 0; essai < 80 && !arr; essai++) {
      const a = this.melange(paquet, 1000 + d + essai * 7919);
      let ok = !(finSalto && estSalto(a[0]));
      for (let i = 1; ok && i < a.length; i++) if (estSalto(a[i]) && estSalto(a[i - 1])) ok = false;
      if (ok) arr = a;
    }
    if (!arr) {
      const hauts = paquet.filter(estSalto), bas = paquet.filter((k) => !estSalto(k));
      arr = [];
      while (bas.length || hauts.length) { if (bas.length) arr.push(bas.shift()); if (hauts.length) arr.push(hauts.shift()); }
    }
    this.paquets.set(d, arr);
    return arr;
  }
  especeDanger(i) { return this.arrangement(Math.floor(i / 12))[i % 12]; }

  trous(n, libres, k) {
    const coupes = [];
    for (let i = 0; i < n; i++) coupes.push(Math.floor(this.hash(k * 7 + i * 13 + 2) * (libres + 1)));
    coupes.sort((a, b) => a - b);
    const g = [];
    let prev = 0;
    for (const c of coupes) { g.push(c - prev); prev = c; }
    g.push(libres - prev);
    return g;
  }

  // Positions des n dangers dans le bloc : jamais en rangée 0 (l'arc déborde
  // d'une rangée de chaque côté, il reste dans le bloc), ni lui ni ses
  // voisines sur une rangée réservée, et un ÉCART qui dépend de la paire
  // (ECART) : 4 rangées entre deux sauts, 5 dès qu'un salto est en jeu (il
  // faut de l'élan pour monter, et du temps pour redescendre). Les trois
  // dernières rangées du bloc restent sûres. Si la paire ne tient pas dans le
  // bloc (jamais mesuré), repli sur l'écart de la v1 (4).
  positionsDangers(b, n) {
    const r0 = GRACE_ROWS + b * BLOC;
    const base = indexDangerBase(b);
    const ecarts = [];
    for (let j = 0; j + 1 < n; j++) ecarts.push(ecart(this.especeDanger(base + j), this.especeDanger(base + j + 1)));
    let libres = BLOC - 1 - (1 + GAP_MIN) - ecarts.reduce((a, x) => a + x, 0);
    if (n > 0 && libres < 0) { for (let j = 0; j < ecarts.length; j++) ecarts[j] = 1 + GAP_MIN; libres = BLOC - n * (1 + GAP_MIN) - 1; }
    let pos = [];
    for (let essai = 0; essai < 30; essai++) {
      const g = this.trous(n, Math.max(0, libres), b * 97 + essai);
      pos = [];
      let cur = 1 + g[0];
      for (let i = 0; i < n; i++) { pos.push(cur); cur += (ecarts[i] || 0) + g[i + 1]; }
      if (pos.every((p) => !estReservee(r0 + p) && !estReservee(r0 + p - 1) && !estReservee(r0 + p + 1))) return pos;
    }
    return pos;
  }

  genererBloc(b) {
    const r0 = GRACE_ROWS + b * BLOC;
    const n = nbDangersBloc(b);
    const pos = this.positionsDangers(b, n);
    const base = indexDangerBase(b);
    const rowsBloc = new Array(BLOC);
    const kinds = [];
    const autour = new Set();
    pos.forEach((p, j) => {
      const kind = this.especeDanger(base + j);
      const K = KINDS[kind];
      kinds.push(kind);
      autour.add(p - 1); autour.add(p + 1);
      const coins = [ARCS[K.franchir][1]];
      rowsBloc[p] = K.traverse
        ? { type: "traverse", kind, dir: -1, cible: 0, armed: false, t0: 0, u0: 0, vitesse: K.vitesse, coins, boue: null }
        : { type: "statique", kind, coins, boue: null };
    });
    for (let p = 0; p < BLOC; p++) if (!rowsBloc[p]) rowsBloc[p] = { type: "safe", coins: [], boue: null };
    // Les côtés de l'arc, sur les rangées voisines.
    pos.forEach((p, j) => {
      const h = ARCS[KINDS[kinds[j]].franchir][0];
      rowsBloc[p - 1].coins.push(h);
      rowsBloc[p + 1].coins.push(h);
    });
    // Lait et pièce rouge sur leurs rangées réservées ; si un danger ou un
    // arc l'occupe (écarts v2 plus grands, rare), sur la rangée libre la plus
    // proche du même bloc — le nombre reste le même pour toutes les graines.
    const libre = (p) => p >= 0 && p < BLOC && rowsBloc[p].type === "safe" && !autour.has(p) && rowsBloc[p].lait === undefined && rowsBloc[p].rouge === undefined;
    for (let p = 0; p < BLOC; p++) {
      const r = r0 + p;
      const kind = r % LAIT_EVERY === LAIT_EVERY / 2 ? "lait" : r % ROUGE_EVERY === 40 ? "rouge" : null;
      if (!kind) continue;
      let q = null;
      for (let d = 0; d < BLOC && q === null; d++) { if (libre(p + d)) q = p + d; else if (libre(p - d)) q = p - d; }
      if (q !== null) rowsBloc[q][kind] = kind === "lait" ? H_LAIT : H_ROUGE;
    }
    // Piles : quota exact (diffusion d'erreur) des rangées éligibles — sûres,
    // hors arcs, sans lait ni rouge. Motif tiré du paquet de piles.
    const eligibles = [];
    for (let p = 0; p < BLOC; p++) { const row = rowsBloc[p]; if (row.type === "safe" && !autour.has(p) && row.lait === undefined && row.rouge === undefined) eligibles.push(p); }
    const avant = b > 0 ? Math.round(this.piecesCumul.get(b - 1) || 0) : 0;
    const nPieces = this.nbPiecesBloc(b, eligibles.length);
    const choisies = this.melange(eligibles, 2000 + b).slice(0, nPieces).sort((x, y) => x - y);
    choisies.forEach((p, i) => { rowsBloc[p].coins = PILES[this.pile(avant + i)].slice(); });
    // Boue : une flaque de 3 rangées tous les deux blocs.
    if (b % 2 === 1 && tBloc(b) > BOUE_DEBUT_T) {
      const departs = [];
      for (let p = 0; p + 2 < BLOC; p++) if (rowsBloc[p].type === "safe" && rowsBloc[p + 1].type === "safe" && rowsBloc[p + 2].type === "safe") departs.push(p);
      if (departs.length) {
        const p = departs[Math.floor(this.hash(b * 43 + 6) * departs.length)];
        for (let i = 0; i < 3; i++) rowsBloc[p + i].boue = 0;
      }
    }
    for (let p = 0; p < BLOC; p++) { const r = r0 + p; if (!this.cache.has(r) && !this.dansFenetre(r)) this.cache.set(r, rowsBloc[p]); }
  }
  // Motif de la i-ème pile de la course : paquets de 10 mélangés par la graine.
  pile(i) { return this.melange(PAQUET_PILES, 3000 + Math.floor(i / PAQUET_PILES.length))[i % PAQUET_PILES.length]; }
  nbPiecesBloc(b, nElig) {
    const avant = b > 0 ? (this.piecesCumul.get(b - 1) || 0) : 0;
    const cumul = avant + P_PIECE * nElig;
    this.piecesCumul.set(b, cumul);
    return Math.round(cumul) - Math.round(avant);
  }

  rowAt(r) {
    const hit = this.cache.get(r);
    if (hit) return hit;
    if (r < GRACE_ROWS || this.dansFenetre(r)) { const row = this.rangeeSure(r); this.cache.set(r, row); return row; }
    const b = Math.floor((r - GRACE_ROWS) / BLOC);
    for (let k = 0; k <= b; k++) if (!this.piecesCumul.has(k)) this.genererBloc(k);
    return this.cache.get(r);
  }

  coinTaken(r, i) { return this.coins.has(`${r}:${i}`); }
  bonusTaken(r, kind) { return this.coins.has(`${r}:${kind}`); }

  // Événements d'un cycliste qui passe de prevV à v, bas des roues à jumpY :
  // pièces ramassées (hauteur dans le corps), bonus, et obstacles jugés au
  // passage du centre du vélo sur leur rangée.
  checkMember(id, prevV, v, jumpY, t) {
    const events = [];
    const rA = Math.max(0, Math.floor(Math.min(prevV, v) + 0.5) - 1), rB = Math.floor(v + 0.5) + 1;
    for (let r = rA; r <= rB; r++) {
      const row = this.rowAt(r);
      if (Math.abs(v - r) < PRISE_V) {
        for (let i = 0; i < row.coins.length; i++) {
          const key = `${r}:${i}`;
          if (this.coins.has(key) || !dansLeCorps(row.coins[i], jumpY)) continue;
          this.coins.add(key);
          events.push({ type: "piece", r, h: row.coins[i] });
        }
        for (const [kind, h] of [["lait", row.lait], ["rouge", row.rouge]]) {
          if (h === undefined || this.coins.has(`${r}:${kind}`) || !dansLeCorps(h, jumpY)) continue;
          this.coins.add(`${r}:${kind}`);
          events.push({ type: kind, r, h });
        }
      }
      if (row.type === "safe" || !(prevV < r && v >= r)) continue;
      if (row.type === "statique") {
        const key = `s${r}:${id}`;
        if (this.resolved.has(key)) continue;
        this.resolved.add(key);
        const K = KINDS[row.kind];
        if (jumpY < H_FRANCHIR[K.franchir]) events.push({ type: "obstacle", kind: row.kind, cout: K.cout, franchir: K.franchir });
      } else {
        for (const inst of crossersAt(r, row, t)) {
          const key = `${inst.id}:${id}`;
          if (this.resolved.has(key)) continue;
          if (Math.abs(inst.u) < inst.K.long / 2 + 0.35) {
            this.resolved.add(key);
            if (jumpY < H_FRANCHIR[inst.K.franchir]) events.push({ type: "obstacle", kind: inst.kind, cout: inst.K.cout, franchir: inst.K.franchir });
          }
        }
      }
    }
    return events;
  }
}

// --- Densité et quotas (indépendants de la graine) ------------------------------
function densiteDanger(t) { const p = P_DANGER_START + (P_DANGER_MAX - P_DANGER_START) * t; return p / (1 + GAP_MIN * p); }
function tBloc(b) { return Math.min(1, Math.max(0, (GRACE_ROWS + b * BLOC) / RAMP_ROWS)); }
function cumulDangers(b) { let s = 0; for (let k = 0; k <= b; k++) s += BLOC * densiteDanger(tBloc(k)); return s; }
export function nbDangersBloc(b) { return b < 0 ? 0 : Math.round(cumulDangers(b)) - (b > 0 ? Math.round(cumulDangers(b - 1)) : 0); }
function indexDangerBase(b) { return b > 0 ? Math.round(cumulDangers(b - 1)) : 0; }
function estReservee(r) { return r % LAIT_EVERY === LAIT_EVERY / 2 || r % ROUGE_EVERY === 40; }

// Armement d'une traversée : elle part du FOND (u > 0) et atteint la route
// (u = 0) exactement à `tArrivee` (instant où le joueur sera sur la rangée),
// dans la limite de sa vitesse plafond.
export function armer(row, now, tArrivee) {
  if (row.armed) return;
  row.armed = true;
  row.t0 = now;
  row.u0 = -row.dir * (ROAD_HALF + 6.0);
  const dist = Math.abs(row.u0);
  const dt = Math.max(0.6, tArrivee - now);
  const K = KINDS[row.kind];
  row.vitesse = Math.max(1.8, Math.min(K.vmax || 9, dist / dt));
}

// Instance visible d'une traversée à l'instant t. Elle s'efface en sortant
// vers la caméra (elle ne vient jamais boucher le premier plan) et apparaît
// en fondu au fond.
const U_SORTIE = -(ROAD_HALF + 3.2);
export function crossersAt(r, row, t) {
  if (!row.armed) return [];
  const K = KINDS[row.kind];
  const u = row.u0 + row.dir * row.vitesse * (t - row.t0);
  if (u < U_SORTIE || u > ROAD_HALF + 6.6) return [];
  const alpha = Math.max(0, Math.min(1, (u - U_SORTIE) / 1.6, (t - row.t0) / 0.5));
  return [{ id: r * 100003, r, u, dir: row.dir, kind: row.kind, K, alpha }];
}

// --- L'instance VIVANTE (celle du jeu) et son API historique ----------------------
let live = new Route();
export function getSeed() { return live.seed; }
export function reseed(force) { live = new Route(force); }
export function reset() { live.reset(); }
export function ouvrirFenetreSure(from, to) { live.ouvrirFenetreSure(from, to); }
export function rowAt(r) { return live.rowAt(r); }
export function coinTaken(r, i) { return live.coinTaken(r, i); }
export function bonusTaken(r, kind) { return live.bonusTaken(r, kind); }
export function checkMember(id, prevV, v, jumpY, t) { return live.checkMember(id, prevV, v, jumpY, t); }
