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
  tracteur:    { traverse: true, franchir: "haut", cout: 3, vitesse: 2.2, vmax: 3.2, long: 2.8, larg: 1.2, h: 1.5, nom: "un tracteur" },
  poulelancee: { traverse: true, franchir: "tap", cout: 1, vitesse: 4.5, vmax: 9, long: 0.7, larg: 0.6, h: 0.65, nom: "une poule lancée" },
  // Posés : `long` le long de la route (v), `larg` en travers (u).
  // Tailles revues le 20 septembre 2026 (« les chats sont trop petits, la
  // poule est trop petite, les voitures pas assez grosses comparées aux vaches »).
  poule:   { traverse: false, franchir: "tap",    cout: 1, long: 0.8,  larg: 0.7,  h: 0.7,  nom: "une poule" },
  chat:    { traverse: false, franchir: "tap",    cout: 1, long: 0.85, larg: 0.5,  h: 0.6,  nom: "un chat" },
  chien:   { traverse: false, franchir: "tap",    cout: 1, long: 1.0,  larg: 0.5,  h: 0.75, nom: "un chien" },
  mouton:  { traverse: false, franchir: "tap",    cout: 1, long: 1.1,  larg: 0.7,  h: 0.85, nom: "un mouton" },
  botte:   { traverse: false, franchir: "tap",    cout: 1, long: 1.0,  larg: 1.0,  h: 0.85, nom: "une botte de foin" },
  cochon:  { traverse: false, franchir: "haut",   cout: 2, long: 1.3,  larg: 0.75, h: 0.95, nom: "un cochon" },
  vache:   { traverse: false, franchir: "haut",   cout: 2, long: 1.9,  larg: 1.0,  h: 1.35, nom: "une vache" },
  fermier: { traverse: false, franchir: "double", cout: 2, long: 0.7,  larg: 0.6,  h: 2.0,  nom: "un fermier" },
  voiture: { traverse: false, franchir: "double", cout: 2, long: 3.4,  larg: 1.3,  h: 1.9,  nom: "une voiture" },
};
// Hauteur (bas des roues) à avoir quand le vélo passe l'obstacle :
//   tap    : un petit saut suffit (apex ~1,3) ;
//   haut   : il faut rester appuyé (apex ~2,5) ;
//   double : il faut re-taper en l'air (apex ~3,7).
export const H_FRANCHIR = { tap: 0.45, haut: 1.5, double: 2.8 };
// Élan à prendre avant l'obstacle et temps de retombée après, en RANGÉES à
// vitesse maximale (6,8 rangées/s) : c'est ce qui dicte l'écart minimal entre
// deux obstacles (20 septembre 2026 : « des fois il y a trop d'obstacles au
// même moment, des fois de grandes lignes droites où il ne se passe rien »).
const ELAN = { tap: 2.4, haut: 4.6, double: 6.6 };
const RETOMBEE = { tap: 2.4, haut: 3.2, double: 3.9 };
export function ecartMin(a, b) { return Math.ceil(RETOMBEE[KINDS[a].franchir] + ELAN[KINDS[b].franchir]) + 1; }
function estDouble(kind) { return KINDS[kind].franchir === "double"; }

// --- Pièces : DEUX hauteurs, pas une de plus ------------------------------------
// 20 septembre 2026 : « il faut que les pièces soient soit à hauteur 0, au
// niveau du sol, soit à hauteur 1, la moitié du joueur quand il saute ». Une
// pièce est ramassée si sa hauteur tombe dans le corps du cycliste.
export const PRISE_V = 0.5;
export const CORPS_BAS = 0.25, CORPS_HAUT = 1.75;
export function dansLeCorps(h, jumpY) { return h >= jumpY + CORPS_BAS && h <= jumpY + CORPS_HAUT; }
export const PIECE_SOL = 0.9;   // ramassée en roulant
export const PIECE_AIR = 2.1;   // il faut sauter
// Pièces posées autour d'un obstacle, là où le cycliste passe en l'air : plus
// le saut demandé est grand, plus elles s'écartent de l'obstacle.
const ECART_ARC = { tap: 1, haut: 2, double: 3 };
const PAQUET_PILES = ["sol", "sol", "sol", "sol", "sol", "sol", "air", "air", "air", "air"];
export const H_LAIT = 0.95, H_ROUGE = 1.0;

export const GRACE_ROWS = 40;    // ~9 s sans rien au départ (« laisse vraiment du temps au début »)
const RAMP_ROWS = 1000;
// Marge ALÉATOIRE ajoutée à l'écart minimal, en rangées : large au début
// (le rythme respire), serrée à la fin (ça se resserre progressivement).
const MOU_DEBUT = 8, MOU_FIN = 1;
export const BLOC = 24;
const P_PIECE = 0.15;            // piles sur 15 % des rangées libres (25 % avant : « beaucoup trop de pièces »)
const LAIT_EVERY = 48;           // brique de lait : rangées 24, 72, 120…
const ROUGE_EVERY = 70;          // pièce brillante : rangées 40, 110, 180…
const BOUE_DEBUT_T = 0.08;

// Paquets d'espèces (12 dangers chacun), par phase du parcours — même
// composition que la v1 : doux, puis gros animaux, puis tracteurs doublés.
const PAQUETS = [
  // Départ : que des petits sauts.
  ["poule", "poule", "poule", "chat", "chat", "chien", "chien", "mouton", "mouton", "botte", "botte", "poulelancee"],
  // Ensuite : les gros animaux et les tracteurs (appui maintenu).
  ["poule", "poule", "chat", "chien", "mouton", "botte", "poulelancee", "cochon", "cochon", "vache", "tracteur", "tracteur"],
  // Fin : fermiers et voitures (double saut) par-dessus.
  ["poule", "chat", "mouton", "botte", "poulelancee", "cochon", "vache", "vache", "tracteur", "tracteur", "fermier", "voiture"],
];
function paquetPour(d) { return PAQUETS[d < 2 ? 0 : d < 4 ? 1 : 2]; }

// --- La route : une CLASSE (le jeu utilise l'instance `live` ; simulation.js
// crée ses propres instances et ne touche jamais au parcours en cours) ------------
export class Route {
  constructor(seed) {
    this.seed = seed !== undefined ? seed : Math.floor(Math.random() * 100000);
    this.cache = new Map();
    this.fenetreSure = null;
    this.piecesCumul = new Map();
    this.paquets = new Map();
    this.dangers = new Map();      // rangée → espèce (chaîne globale)
    this.chaine = null;            // { r, kind, i } : dernier danger posé
    this.resolved = new Set();
    this.coins = new Set();
  }
  hash(n) {
    const x = Math.sin(n * 91.173 + this.seed * 0.731) * 43758.5453;
    return x - Math.floor(x);
  }
  reset() { this.cache.clear(); this.resolved.clear(); this.coins.clear(); this.piecesCumul.clear(); this.dangers.clear(); this.chaine = null; this.fenetreSure = null; }
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
  // Ordre du paquet d, sans deux « double saut » consécutifs (y compris avec le
  // dernier du paquet précédent). Mélange seedé, retenté jusqu'à ce que ça
  // tienne ; repli déterministe (jamais mesuré).
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
      const hauts = paquet.filter(estSalto), bas = paquet.filter((k) => !estDouble(k));
      arr = [];
      while (bas.length || hauts.length) { if (bas.length) arr.push(bas.shift()); if (hauts.length) arr.push(hauts.shift()); }
    }
    this.paquets.set(d, arr);
    return arr;
  }
  especeDanger(i) { return this.arrangement(Math.floor(i / 12))[i % 12]; }

  // --- La CHAÎNE de dangers ------------------------------------------------------
  // Les obstacles ne sont plus tirés bloc par bloc mais posés à la suite, avec
  // l'écart que la physique du saut impose entre les deux espèces (ecartMin),
  // plus une marge aléatoire qui se resserre au fil de la course. Résultat :
  // jamais deux obstacles collés, jamais de longue ligne droite vide, et un
  // rythme qui s'accélère progressivement (20 septembre 2026).
  etendreDangers(rMax) {
    if (!this.chaine) this.chaine = { r: GRACE_ROWS - 4, kind: null, i: 0 };
    while (this.chaine.r <= rMax) {
      const i = this.chaine.i;
      const kind = this.especeDanger(i);
      const t = Math.min(1, Math.max(0, this.chaine.r / RAMP_ROWS));
      const mou = Math.round(MOU_DEBUT + (MOU_FIN - MOU_DEBUT) * t);
      const base = this.chaine.kind ? ecartMin(this.chaine.kind, kind) : 6;
      let r = this.chaine.r + base + Math.floor(this.hash(i * 37 + 11) * (mou + 1));
      while (estReservee(r) || estReservee(r - 1) || estReservee(r + 1)) r += 1;
      this.dangers.set(r, kind);
      this.chaine = { r, kind, i: i + 1 };
    }
  }

  genererBloc(b) {
    const r0 = GRACE_ROWS + b * BLOC;
    this.etendreDangers(r0 + BLOC + 16);
    const rowsBloc = new Array(BLOC);
    const autour = new Set();       // rangées qui portent les pièces du saut
    for (let p = 0; p < BLOC; p++) {
      const kind = this.dangers.get(r0 + p);
      if (!kind) continue;
      const K = KINDS[kind];
      const e = ECART_ARC[K.franchir];
      autour.add(p - e); autour.add(p + e); autour.add(p);
      rowsBloc[p] = K.traverse
        ? { type: "traverse", kind, dir: -1, cible: 0, armed: false, t0: 0, u0: 0, vitesse: K.vitesse, coins: [], boue: null }
        : { type: "statique", kind, coins: [], boue: null };
    }
    for (let p = 0; p < BLOC; p++) if (!rowsBloc[p]) rowsBloc[p] = { type: "safe", coins: [], boue: null };
    // Deux pièces en l'air de part et d'autre de l'obstacle, là où le cycliste
    // passe : plus le saut demandé est grand, plus elles s'en écartent.
    for (let p = 0; p < BLOC; p++) {
      const kind = this.dangers.get(r0 + p);
      if (!kind) continue;
      const e = ECART_ARC[KINDS[kind].franchir];
      for (const q of [p - e, p + e]) if (q >= 0 && q < BLOC && rowsBloc[q].type === "safe") rowsBloc[q].coins = [PIECE_AIR];
    }
    // Lait et pièce brillante sur leurs rangées réservées, sinon au plus près.
    const libre = (p) => p >= 0 && p < BLOC && rowsBloc[p].type === "safe" && !this.dangers.has(r0 + p) && rowsBloc[p].lait === undefined && rowsBloc[p].rouge === undefined;
    for (let p = 0; p < BLOC; p++) {
      const r = r0 + p;
      const kind = r % LAIT_EVERY === LAIT_EVERY / 2 ? "lait" : r % ROUGE_EVERY === 40 ? "rouge" : null;
      if (!kind) continue;
      let q = null;
      for (let d = 0; d < BLOC && q === null; d++) { if (libre(p + d)) q = p + d; else if (libre(p - d)) q = p - d; }
      if (q !== null) { rowsBloc[q][kind] = kind === "lait" ? H_LAIT : H_ROUGE; rowsBloc[q].coins = []; }
    }
    // Piles : quota exact des rangées libres, au sol ou en l'air.
    const eligibles = [];
    for (let p = 0; p < BLOC; p++) { const row = rowsBloc[p]; if (row.type === "safe" && !autour.has(p) && !row.coins.length && row.lait === undefined && row.rouge === undefined) eligibles.push(p); }
    const avant = b > 0 ? Math.round(this.piecesCumul.get(b - 1) || 0) : 0;
    const nPieces = this.nbPiecesBloc(b, eligibles.length);
    const choisies = this.melange(eligibles, 2000 + b).slice(0, nPieces).sort((x, y) => x - y);
    choisies.forEach((p, i) => { rowsBloc[p].coins = [this.pile(avant + i) === "air" ? PIECE_AIR : PIECE_SOL]; });
    // Boue : une flaque de 3 rangées tous les deux blocs.
    if (b % 2 === 1 && (GRACE_ROWS + b * BLOC) / RAMP_ROWS > BOUE_DEBUT_T) {
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

// --- Rangées réservées au lait et à la pièce brillante ---------------------------
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
