// rows.js — La route, rangée par rangée, fonction pure de l'index et de la
// graine (sauf l'ARMEMENT des traversées et des voitures en sens inverse, qui
// dépend du moment où le joueur arrive — voir armer()).
//
// ⚠️ UNE SEULE VOIE, vue de profil : pas de contournement latéral, tout se
// règle en HAUTEUR.
//
// 1. BOÎTES DE COLLISION RÉELLES. Chaque espèce a une boîte (long × h) et le
//    cycliste la sienne : on touche si les deux se recouvrent VRAIMENT, à
//    n'importe quel instant du recouvrement. Le seuil de franchissement d'une
//    espèce, c'est sa hauteur, rien d'autre.
//
// 2. LA FAMILLE DE SAUT EST CALCULÉE, jamais écrite à la main. On intègre les
//    trois arcs (tap, appui maintenu, double saut) et on retient le plus petit
//    qui reste au-dessus de l'obstacle pendant TOUT le temps qu'on met à le
//    franchir (longueur de la bête + longueur du vélo, à vitesse MINIMALE, le
//    pire cas). Changer une taille dans KINDS ou un réglage de saut dans
//    config.js ré-attribue les familles toutes seules. Même source pour
//    l'écart minimal entre deux obstacles.
//      → petits animaux = tap · gros animaux et fermier = appui maintenu
//      · véhicules = double saut.
//
// 3. LES PIÈCES DESSINENT LE GESTE. Au-dessus de chaque obstacle on pose l'ARC
//    que le joueur doit suivre, à la hauteur exacte de sa trajectoire ; sur
//    les longues lignes droites, une traînée au sol. Une seule taille de
//    pièce, un seul espacement (ESPACEMENT).
//
// Le sol n'est pas toujours 0 : HALLES et MONTAGNE le soulèvent (solAt). Le
// champ `boue` des rangées reste toujours null (pas de boue dans ce jeu).
//
// GÉNÉRATEUR À QUOTAS : blocs de 24 rangées, espèces tirées d'un paquet fixe
// de 12 mélangé par la graine, lait et grosse pièce sur des rangées
// réservées. Deux graines = deux routes différentes, mêmes quantités.

import { ROAD_HALF, HALLE_TOIT_AU_DESSUS } from "./scene.js";
import { V_UNIT, vitesseAuRang, rangAuTemps, dureeCourse } from "./regles.js";
import { tailleObstacle } from "./humains.js";

// --- Le bestiaire, à l'échelle : 1 unité ≈ 1 mètre --------------------------------
// Le cycliste fait 1,8 u de haut et 1,24 u de long (VELO_DEMI × 2). Tout le
// reste est calé dessus, à l'échelle réelle. `long` court le long de la
// route, `larg` en travers, `h` est la hauteur qu'il faut dépasser.
// Traversants (`traverse`) : ils roulent le long de u, c'est `larg` qui barre la route.
export const KINDS = {
  // Le TRACTEUR arrive EN FACE, plus lentement qu'une voiture ; on peut
  // ROULER dessus (atterrir sur son toit n'est pas un choc).
  tracteur:    { contresens: true, cout: 3, vitesse: 1.2, arme: 5.5, long: 2.6, larg: 1.6, h: 1.7, plancher: "double", montable: true, nom: "un tracteur" },
  // Le CAR SCOLAIRE de la Région (Auvergne-Rhône-Alpes) : comme la voiture en
  // face, en plus long et plus haut. Montable aussi.
  bus:         { contresens: true, cout: 3, vitesse: 2.0, arme: 5.5, long: 3.6, larg: 1.8, h: 1.9, plancher: "double", montable: true, nom: "un car scolaire" },
  // Le CHASSE-NEIGE : ce qui vient en face dans la montagne enneigée
  // (auDecor). Lame comprise dans la longueur ; montable comme le tracteur.
  chasseneige: { contresens: true, cout: 3, vitesse: 1.4, arme: 5.5, long: 3.6, larg: 1.9, h: 2.0, plancher: "double", montable: true, nom: "un chasse-neige" },
  // Le SKIEUR DE FOND, dans le biome neige uniquement : il vient en face,
  // lentement, skis compris dans la longueur.
  skieur:      { contresens: true, cout: 2, vitesse: 1.5, arme: 5.5, long: 1.9, larg: 0.7, h: 1.8, nom: "un skieur" },
  // Le BUGGY remplace le tracteur sur la plage, même rôle : il vient en face,
  // on peut rouler dessus.
  buggy:       { contresens: true, cout: 3, vitesse: 1.4, arme: 5.5, long: 2.4, larg: 1.5, h: 1.5, plancher: "double", montable: true, nom: "un buggy de plage" },
  // Les PIÉTONS marchent vers le joueur — seuls d'abord, puis en GROUPES de
  // plus en plus grands (taillePietons) : une rafale de sauts tenus, au plus
  // serré que permet la physique. La difficulté monte à vue d'œil. Lents :
  // pas de panneau d'alerte (on les voit venir).
  pieton:      { contresens: true, cout: 1, vitesse: 0.9, arme: 5.5, long: 0.6, larg: 0.6, h: 1.75, sansAlerte: true, nom: "un piéton" },
  // La VOITURE EN FACE roule sur la route, vers le joueur ; sa vitesse
  // s'ajoute à la sienne. ⚠️ Lente (2,0 rangées/s) et armée tôt pour laisser
  // le temps de sauter : plus rapide, elle traverse l'écran en une seconde.
  // MONTABLE comme la voiture garée : voir toitSous().
  contresens:  { contresens: true, cout: 2, vitesse: 2.0, arme: 5.5, long: 2.8, larg: 1.6, h: 1.45, plancher: "double", montable: true, nom: "une voiture en face" },
  // La POULE JETÉE : le fermier attend sur le bas-côté, `lanceur` rangées PLUS
  // LOIN que la rangée de croisement, face au joueur (on le voit venir) ;
  // quand le joueur approche, il jette la poule, qui court sur la route vers
  // lui. Mécanique d'une voiture en face (type « contresens »), en tout petit :
  // un tap.
  poulejetee:  { contresens: true, cout: 1, vitesse: 4.5, lanceur: 3.5, long: 0.9, larg: 0.84, h: 0.9, nom: "une poule jetée" },
  // Posés sur la route.
  // Poules grosses pour être bien vues, et rousses pour trancher sur la neige.
  poule:   { cout: 1, long: 0.9, larg: 0.84, h: 0.9, nom: "une poule" },
  chat:    { cout: 1, long: 0.80, larg: 0.60, h: 0.74, nom: "un chat" },
  chien:   { cout: 1, long: 0.80, larg: 0.55, h: 0.70, nom: "un chien" },
  // Un énorme mouton laineux : appui long.
  mouton:  { cout: 1, long: 1.5, larg: 1.3, h: 1.35, nom: "un mouton" },
  botte:   { cout: 1, long: 0.85, larg: 0.85, h: 0.75, nom: "une botte de foin" },
  cochon:  { cout: 2, long: 1.30, larg: 0.85, h: 0.92, nom: "un cochon" },
  vache:   { cout: 2, long: 1.60, larg: 1.00, h: 1.22, nom: "une vache" },
  // L'homme en COSTARD, planté au milieu de la route avec sa valise, qui
  // gesticule sur place.
  costard: { cout: 2, long: 0.8, larg: 0.7, h: 1.9, nom: "un homme en costard" },
  // Le BAIGNEUR en slip de bain remplace le costard sur la plage : même
  // gabarit, même geste.
  baigneur: { cout: 2, long: 0.8, larg: 0.7, h: 1.9, nom: "un baigneur" },
  fermier: { cout: 2, long: 0.85, larg: 0.75, h: 2.2, nom: "un fermier" },
  // ⚠️ MONTABLE : son toit devient un plancher dès qu'on arrive au-dessus.
  // Deux façons de la franchir : par-dessus, ou en s'y posant. Assez courte
  // pour rester passable au double saut.
  voiture: { cout: 2, long: 2.80, larg: 1.60, h: 1.45, plancher: "double", montable: true, nom: "une voiture" },
  // Le BONHOMME DE NEIGE de la montagne, gros, presque de la taille d'un bus.
  // Tête ronde : on ne roule pas dessus.
  bonhomme: { cout: 2, long: 1.7, larg: 1.7, h: 2.1, nom: "un bonhomme de neige" },
  // La MOUETTE plane au-dessus de la route, juste au-dessus de la tête du
  // cycliste (de `bas` à `h`) : on passe DESSOUS en roulant, le moindre saut
  // s'y cogne. Famille « sol » : le geste, c'est de NE PAS sauter. Seulement
  // dans la dernière minute, jamais à côté d'un double saut (etendreDangers).
  mouette: { aerien: true, cout: 1, long: 1.0, larg: 0.9, bas: 2.2, h: 2.9, nom: "une mouette" },
};

// ⚠️ Les hauteurs `h` sont mesurées sur les DESSINS (capture.mjs hitbox, qui
// prend l'enveloppe réelle de chaque modèle). Une hauteur plus grande que le
// dessin fait prendre une bête qu'on a visiblement passée : re-mesurer après
// toute retouche d'un modèle.

// --- Boîte de collision -----------------------------------------------------------
// Le cycliste occupe [v − VELO_DEMI, v + VELO_DEMI] le long de la route ; ses
// roues sont à `jumpY`. On passe si les roues dépassent le haut de l'obstacle
// de MARGE_H pendant TOUT le recouvrement.
// VELO_DEMI ≈ la moitié de l'empattement : ce sont les ROUES qui accrochent,
// pas les épaules du cycliste. Volontairement généreux : le joueur ne doit
// jamais se prendre une bête qu'il a visiblement passée.
export const VELO_DEMI = 0.44;
export const MARGE_H = 0.04;
export function hauteurAFranchir(kind) { return KINDS[kind].h + MARGE_H; }
// Hauteur du cycliste, tête comprise (voxrider.RIDER_HEIGHT) : ce qui plane
// (la mouette) ne touche que s'il descend sous `jumpY + HAUT_CYCLISTE`.
export const HAUT_CYCLISTE = 1.9;
// Les HUMAINS n'ont pas tous la même taille (humains.js) :
// la collision lit la vraie hauteur de celui de la rangée r — un petit se
// saute plus bas, jamais plus haut que K.h. Le planificateur (simulation,
// joueur idéal) garde hauteurAFranchir, le cas le plus haut.
const HUMAINS = new Set(["pieton", "costard", "fermier", "baigneur", "skieur"]);
export function hauteurObstacle(kind, r) { return HUMAINS.has(kind) ? KINDS[kind].h * tailleObstacle(r) + MARGE_H : hauteurAFranchir(kind); }
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
  // « sol » : ne pas sauter (la mouette) — aucun arc, aucune montée.
  ARCS = { tap: calcul("tap"), haut: calcul("haut"), double: calcul("double"), sol: { pts: [0], apex: 0, tApex: 0, duree: 0 } };
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
export function tempsAuDessus(tier, H) {
  const a = arcs()[tier];
  let n = 0;
  for (const h of a.pts) if (h >= H) n += 1;
  return n * PAS_ARC;
}

// --- La famille de saut d'une espèce, CALCULÉE ------------------------------------
// On franchit un obstacle pendant (sa longueur sur la route + celle du vélo)
// rangées. Pour un véhicule en sens inverse, les deux vitesses s'additionnent :
// la fenêtre est plus courte.
function vMaxRangees() { return V_UNIT * Math.max(window.CONFIG.vitesseMax, window.CONFIG.vitesseFinale || 0); }
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
// Marge de confort : la plus grande possible sans rendre le saut mou. Les
// tailles ci-dessus et la pesanteur de config.js ont été cherchées ensemble
// pour que la plus petite marge du bestiaire reste au-dessus de 45 ms.
const MARGE_FENETRE = 0.04;
let FAMILLE = null;
export function familleDe(kind) {
  if (!FAMILLE) {
    FAMILLE = {};
    for (const k of Object.keys(KINDS)) {
      if (KINDS[k].aerien) { FAMILLE[k] = "sol"; continue; }
      const besoin = fenetreSecondes(k) + MARGE_FENETRE;
      const H = hauteurAFranchir(k);
      const calculee = FAMILLES.find((t) => tempsAuDessus(t, H) >= besoin) || "double";
      // Plancher de lisibilité : TOUT CE QUI ROULE se passe au double saut,
      // quel que soit le calcul (règle annoncée par le bestiaire : « tout ce
      // qui roule : saute, puis re-tape »). Sans ça, la voiture en face, plus
      // vite croisée, demanderait un geste différent de la voiture garée :
      // même objet, deux gestes, impossible à apprendre.
      const plancher = KINDS[k].plancher;
      FAMILLE[k] = plancher && FAMILLES.indexOf(plancher) > FAMILLES.indexOf(calculee) ? plancher : calculee;
    }
  }
  return FAMILLE[kind];
}
// `KINDS[k].franchir` est lu par la simulation, le bestiaire et les outils de
// mesure : c'est une propriété calculée (familleDe).
for (const k of Object.keys(KINDS)) {
  Object.defineProperty(KINDS[k], "franchir", { get() { return familleDe(k); }, enumerable: true });
}
// Écart minimal entre deux obstacles : le temps de retomber du premier plus
// celui de prendre son élan pour le second, converti en rangées à la vitesse
// `v`, plus les deux demi-longueurs.
// `v` (rangées/s) : la vitesse LÀ où les deux obstacles se suivent — calculé
// à la vitesse maximale de fin, l'écart espacerait trop tout le début de
// course. Sans `v`, le pire cas (vitesse maximale).
export function ecartMin(a, b, v = vMaxRangees()) {
  const t = retombee(familleDe(a)) + montee(familleDe(b));
  return Math.ceil(t * v + demiLongueurRoute(a) + demiLongueurRoute(b)) + 1;
}

// --- Pièces : elles dessinent le geste --------------------------------------------
// Une pièce est ramassée quand elle tombe dans le buste du cycliste : centre à
// `jumpY + CORPS_CENTRE`, demi-fenêtre CORPS_DEMI. Les arcs posent les pièces
// pile à cette hauteur — suivre la trajectoire, c'est toutes les prendre.
export const PRISE_V = 0.62;
export const CORPS_CENTRE = 0.85, CORPS_DEMI = 1.0;
export const CORPS_HAUT = CORPS_CENTRE + CORPS_DEMI;
export function dansLeCorps(h, jumpY) { return Math.abs(h - (jumpY + CORPS_CENTRE)) <= CORPS_DEMI; }
export const PIECE_SOL = CORPS_CENTRE;      // 0,85 : ramassée en roulant
export const H_LAIT = PIECE_SOL, H_ROUGE = PIECE_SOL;

export const GRACE_ROWS = 40;    // ~9 s sans rien au départ
const RAMP_ROWS = 380;   // le mou entre obstacles fond en ~40 s
// Marge ALÉATOIRE ajoutée à l'écart minimal, en rangées : large au début, plus
// serrée à la fin.
const MOU_DEBUT = 5, MOU_FIN = 0;
export const BLOC = 24;
// UN SEUL espacement dans tout le jeu, sur l'arc comme au sol : une pièce
// tous les ESPACEMENT rangs, régulière. Une seule taille de pièce aussi
// (main.js, PIECE_R). ⚠️ Pas d'éclaircissage après coup : compté à travers
// tout le bloc, il ferait perdre à un arc tantôt sa première, tantôt sa
// deuxième pièce.
export const ESPACEMENT = 3;
const TRAINEE_MIN = 8;           // rangées libres d'affilée avant de poser une traînée au sol
const TRAINEE_LONGUEUR = 2;      // pièces d'une traînée
const LAIT_EVERY = 48;
const LAIT_ISOLE = 3; // aucune pièce à moins de 3 rangées d'une brique de lait
let FIN_LAIT = null;
function rangFinLait() { if (FIN_LAIT === null) FIN_LAIT = Math.round(rangAuTemps(dureeCourse() - 55)); return FIN_LAIT; }
const GROSSE_EVERY = 70;         // rangée réservée à la grosse pièce (laissée vide)

// --- Les HALLES ------------------------------------------------------------------
// Une variation de décor et de hauteur : une rampe monte au niveau des fils
// électriques, un plancher file en l'air, une rampe redescend. Pendant ce
// temps la route est vide et couverte de pièces. Le sol du jeu n'est donc pas
// toujours 0 : voir solAt().
export const HALLE_HAUT = 4.2;
export const HALLE_MONTEE = 7, HALLE_PLAT = 26, HALLE_DESCENTE = 7;
export const HALLE_ROWS = HALLE_MONTEE + HALLE_PLAT + HALLE_DESCENTE;
// Marché 25 s, gare 88 s (vers la mi-morceau), bowling 116 s ; l'hiver
// (46–80 s) est pris par la montagne enneigée.
const HALLE_TEMPS = [25, 88, 116];  // secondes de course
let HALLES = null;
function halles() {
  if (!HALLES) HALLES = HALLE_TEMPS.map((t) => Math.round(rangAuTemps(t)));
  return HALLES;
}
// Trois bâtiments différents, dans l'ordre de HALLE_TEMPS : le marché, la
// gare (rails, trains à quai), le bowling.
export const TYPES_HALLE = ["marche", "gare", "bowling"];
export function typeHalle(d) { const i = halles().indexOf(d); return TYPES_HALLE[Math.max(0, i) % TYPES_HALLE.length]; }
// Hauteur du plancher et du toit (au-dessus du plancher) de chaque bâtiment.
// Le BOWLING est de plain-pied (une marche de 0,35 u) : avec un plancher à
// 4,2 u, la caméra (3,6 u) serait dessous et ne verrait pas ses pistes. Son
// toit est plus haut pour que le double saut y tienne.
const GEO_TYPES = { marche: { haut: HALLE_HAUT, toit: HALLE_TOIT_AU_DESSUS }, gare: { haut: HALLE_HAUT, toit: HALLE_TOIT_AU_DESSUS }, bowling: { haut: 0.35, toit: 7.4 } };
export function geoHalle(d) { return GEO_TYPES[typeHalle(d)]; }
// Première rangée de la halle d'un type donné (« marche »…), ou null.
export function debutHalle(type) { const d = halles().find((h) => typeHalle(h) === type); return d === undefined ? null : d; }
// Début de la halle qui couvre la rangée r, ou null.
export function halleA(r) {
  for (const d of halles()) if (r >= d - 1 && r <= d + HALLE_ROWS + 1) return d;
  return null;
}
// Hauteur du SOL à l'avancement v (0 sur la route normale).
export function solAt(v) {
  const d = halleA(Math.round(v));
  if (d === null) return hauteurBosse(v);
  const p = v - d;
  if (p <= 0 || p >= HALLE_ROWS) return 0;
  const H = geoHalle(d).haut;
  if (p < HALLE_MONTEE) return H * (p / HALLE_MONTEE);
  if (p < HALLE_MONTEE + HALLE_PLAT) return H;
  return H * (1 - (p - HALLE_MONTEE - HALLE_PLAT) / HALLE_DESCENTE);
}
function dansHalle(r) { const d = halleA(r); return d !== null && r >= d && r <= d + HALLE_ROWS; }

// --- La MONTAGNE enneigée (l'hiver, à partir de 46 s) -----------------------------
// Un replat enneigé (MONTAGNE_AVANT rangs), UNE colline en cosinus de 6,5 u —
// montée douce (28 rangs), plateau (22), descente (28) —, un replat après, et
// le biome se referme. On y roule comme sur la rampe des halles (solAt).
// ⚠️ JAMAIS un obstacle dans une pente : la famille de saut d'un obstacle
// suppose un départ au même niveau que lui. Ils se posent sur PLAT tout
// autour de leur saut (penteAutour). Décor : scene.js, zone « montagne ».
const MONTAGNE_DEBUT_S = 46, MONTAGNE_AVANT = 24, MONTAGNE_APRES = 22;
const COLLINE_MONTEE = 28, COLLINE_PLAT = 22, COLLINE_VALLEE = 22, COLLINE_HAUT = 6.5;
const COLLINE_LONG = 2 * COLLINE_MONTEE + COLLINE_PLAT;
export const GEO_BOSSE = { long: COLLINE_LONG, haut: COLLINE_HAUT };
let MONTAGNE = null, BOSSES = null;
function montagne() {
  if (!MONTAGNE) { const a = Math.round(rangAuTemps(MONTAGNE_DEBUT_S)); MONTAGNE = [a, a + MONTAGNE_AVANT + COLLINE_LONG + MONTAGNE_APRES]; }
  return MONTAGNE;
}
function bosses() {
  if (!BOSSES) BOSSES = [montagne()[0] + MONTAGNE_AVANT];
  return BOSSES;
}
// La PLAGE de fin (mer au fond, palmiers, coucher de soleil) : les 30
// dernières secondes.
const T_PLAGE = 30;
let PLAGE = null;
export function enPlage(r) { if (PLAGE === null) PLAGE = Math.round(rangAuTemps(dureeCourse() - T_PLAGE)); return r >= PLAGE; }
// Rangées du biome (décor, route enneigée), un peu plus large que les collines.
export function enMontagne(r) { const [a, b] = montagne(); return r >= a - 30 && r <= b + 20; }
// Début de la colline qui couvre la rangée r, ou null.
export function bosseA(r) { for (const d of bosses()) if (r >= d - 1 && r <= d + COLLINE_LONG + 1) return d; return null; }
export function hauteurBosse(v) {
  const d = bosseA(Math.round(v));
  if (d === null) return 0;
  const p = v - d;
  if (p <= 0 || p >= COLLINE_LONG) return 0;
  if (p < COLLINE_MONTEE) return COLLINE_HAUT * (1 - Math.cos(Math.PI * p / COLLINE_MONTEE)) / 2;
  if (p < COLLINE_MONTEE + COLLINE_PLAT) return COLLINE_HAUT;
  return COLLINE_HAUT * (1 + Math.cos(Math.PI * (p - COLLINE_MONTEE - COLLINE_PLAT) / COLLINE_MONTEE)) / 2;
}
// Une pente là où l'obstacle se saute (de 9 rangs avant à 4 après) ?
function penteAutour(r) {
  if (bosseA(r - 9) === null && bosseA(r + 4) === null && bosseA(r) === null) return false;
  const h = solAt(r);
  for (let q = r - 9; q <= r + 4; q++) if (Math.abs(solAt(q) - h) > 0.02) return true;
  return false;
}

// --- Moments de course -----------------------------------------------------------
// Le CONVOI : trois cars scolaires d'affilée à T_CONVOI. Le BOUCHON, 15 s
// avant la fin : trois voitures garées pare-chocs contre pare-chocs (2,8 de
// long tous les 3 rangs : le toit porte d'une voiture à l'autre, toitSous),
// feux de détresse, pièces sur les toits — on saute dessus et on y roule.
const T_CONVOI = 100, CONVOI_N = 3, T_BOUCHON_AVANT_FIN = 15;
export const BOUCHON_PAS = 3;
// Toit d'une voiture GARÉE sous v (les simulations : roule sur le bouchon).
export function toitGare(route, v, jumpY) {
  for (let r = Math.floor(v - 2); r <= Math.ceil(v + 2); r++) {
    const row = route.rowAt(r);
    if (row.type !== "statique" || !KINDS[row.kind].montable) continue;
    if (Math.abs(v - r) >= KINDS[row.kind].long / 2 + VELO_DEMI) continue;
    const toit = KINDS[row.kind].h + MARGE_H + solAt(r);
    if (jumpY >= toit - 0.02) return toit;
  }
  return 0;
}
// Plafond du cycliste sous le toit d'une halle, qu'il ne doit jamais
// traverser : ses roues ne montent pas plus haut que le dessous des fermes
// moins sa taille (2,1 u, salto compris). Infini partout ailleurs.
export function plafondA(v) {
  const d = halleA(Math.round(v));
  if (d === null || v < d - 0.8 || v > d + HALLE_ROWS + 0.8) return Infinity;
  const g = geoHalle(d);
  return g.haut + g.toit + 0.1 - 2.1;
}

// Hauteur du toit d'un obstacle MONTABLE sous la position v, mais seulement si
// le cycliste arrive déjà au-dessus (`jumpY`). En dessous, ce n'est pas un
// plancher, c'est un mur : la collision s'en charge. Les véhicules EN FACE
// sont montables aussi : on cherche où ils sont à l'instant t.
export function toitSous(route, v, jumpY, t = 0) {
  for (let r = Math.floor(v - 4); r <= Math.ceil(v + 40); r++) {
    if (r < 0) continue;
    const row = route.rowAt(r);
    if (row.type !== "statique" && row.type !== "contresens") continue;
    if (r > v + 2 && row.type === "statique") continue;
    const K = KINDS[row.kind];
    if (!K.montable) continue;
    const centre = row.type === "statique" ? r : (row.armed ? r + row.v0 - row.vitesse * (t - row.t0) : null);
    // ⚠️ Le toit porte sur TOUTE la zone de choc : s'il s'arrêtait plus tôt,
    // le vélo retomberait à l'arrière du toit ENCORE dans la voiture, et
    // l'atterrissage compterait comme un choc.
    if (centre === null || Math.abs(v - centre) >= K.long / 2 + VELO_DEMI) continue;
    const toit = K.h + MARGE_H + solAt(centre); // sur une colline, le toit monte avec elle
    if (jumpY >= toit - 0.02) return toit;
  }
  return 0;
}

// --- Paquets d'espèces ------------------------------------------------------------
const PAQUETS = [
  // ⚠️ Chaque paquet compte EXACTEMENT 12 espèces (especeDanger : i % 12).
  // Départ : surtout des petits sauts. Une VOITURE dès le premier paquet : le
  // tuto du double saut doit venir tôt. Et UNE voiture en face (jamais avant
  // ~20 s, voir etendreDangers).
  ["poule", "poule", "voiture", "chat", "chat", "chien", "chien", "mouton", "mouton", "botte", "botte", "contresens"],
  // Ensuite : les gros animaux (appui maintenu), les premiers véhicules,
  // beaucoup de voitures EN FACE, et le premier PIÉTON, seul.
  ["poule", "pieton", "mouton", "botte", "costard", "fermier", "cochon", "vache", "tracteur", "bus", "contresens", "contresens"],
  // Fin : fermiers, voitures, la voiture qui arrive en face — et deux
  // passages de piétons (seuls, puis par deux : taillePietons).
  ["pieton", "mouton", "botte", "costard", "pieton", "vache", "tracteur", "fermier", "voiture", "contresens", "bus", "contresens"],
  // Finale, la plus dure (ceux qui terminent doivent être les plus forts) :
  // presque tout roule, et vite (armer : les véhicules en face accélèrent en
  // fin de course), plus deux groupes de piétons par paquet.
  ["contresens", "bus", "tracteur", "contresens", "pieton", "fermier", "contresens", "bus", "pieton", "voiture", "contresens", "tracteur"],
];
// Taille d'un groupe de piétons selon le PAQUET (même numéro de paquet pour
// toutes les graines : les quotas restent identiques d'une route à l'autre).
// Seuls (~35 s), par deux (~75 s), par trois (~2 min), par quatre sur la
// plage — la route se remplit à vue d'œil.
function taillePietons(d) { return d < 3 ? 1 : d < 5 ? 2 : d < 6 ? 3 : 4; }
// MOUETTES : sur les MOUETTES_DERNIERES_S dernières secondes, MOUETTES_PART
// des places possibles. Avant et après elle, MOUETTE_GRACE_S de plus que la
// physique : retomber un peu tard, ou sauter un peu tôt l'obstacle suivant,
// ne doit pas suffire à la toucher — c'est sauter POUR RIEN qui est puni.
const MOUETTES_DERNIERES_S = 60, MOUETTES_PART = 0.8, MOUETTE_GRACE_S = 0.3;
function graceMouette(r) { return Math.ceil(MOUETTE_GRACE_S * vitesseAuRang(r)); }
// Écart DANS un groupe : la physique du saut, plus une rangée de grâce.
const PIETONS_GRACE = 1;
// La course devient difficile dès ~40 s : 12 obstacles de départ, 12
// intermédiaires, 36 de fin, puis la finale.
function paquetPour(d) { return PAQUETS[d < 1 ? 0 : d < 2 ? 1 : d < 5 ? 2 : 3]; }
function estDouble(kind) { return familleDe(kind) === "double"; }

// --- Chacun dans son décor ---------------------------------------------------------
// Baigneurs sur la plage, skieurs dans la neige. Un obstacle s'habille selon
// sa PROPRE rangée (⚠️ pas celle de l'obstacle précédent, jusqu'à 25 rangs
// plus tôt : un skieur sur cinq finirait sur le goudron, mesuré sur 400
// routes), et rien ne se pose à cheval sur une frontière : son trajet à
// l'écran (3 rangs derrière, 8 devant pour ce qui vient en face) reste dans
// un seul décor.
export function biomeDe(r) { return enPlage(r) ? "plage" : enMontagne(r) ? "neige" : "route"; }
function aCheval(r, kind) {
  const b = biomeDe(r), devant = KINDS[kind].contresens ? 8 : 2;
  for (let q = r - 3; q <= r + devant; q++) if (biomeDe(q) !== b) return true;
  return false;
}
function rangeeLibre(r, kind) {
  return !(estReservee(r) || estReservee(r - 1) || estReservee(r + 1) || dansHalle(r) || dansHalle(r - 4) || dansHalle(r + 4) || penteAutour(r) || aCheval(r, kind));
}
// La plage : messieurs et bêtes de la ferme y sont en slip de bain, les
// tracteurs y deviennent des buggys.
const EN_SLIP = new Set(["costard", "fermier", "vache", "mouton", "cochon", "poule", "botte"]);
// La neige : voitures garées, messieurs et grosses bêtes deviennent, en
// alternance, des bonshommes de neige et des skieurs.
const SOUS_LA_NEIGE = new Set(["voiture", "costard", "fermier", "mouton", "vache", "baigneur"]);

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
    this.bouchons = new Map();   // rangée d'une voiture du bouchon → son rang (0, 1, 2) : sa couleur
    this.evts = null;
  }
  hash(n) {
    const x = Math.sin(n * 91.173 + this.seed * 0.731) * 43758.5453;
    return x - Math.floor(x);
  }
  reset() { this.cache.clear(); this.resolved.clear(); this.coins.clear(); this.dangers.clear(); this.blocs.clear(); this.bouchons.clear(); this.evts = null; this.chaine = null; this.fenetreSure = null; this.nNeige = 0; this.nNeigeFace = 0; }
  dansFenetre(r) { return this.fenetreSure !== null && r >= this.fenetreSure[0] && r <= this.fenetreSure[1]; }
  // Rangée sûre (départ, turbo lait, tuto) : une ligne de pièces au sol — à la
  // hauteur du PLANCHER, qui n'est pas 0 sur une halle.
  rangeeSure(r) { return { type: "safe", coins: r % 6 === 1 ? [solAt(r) + PIECE_SOL] : [], boue: null }; }
  ouvrirFenetreSure(from, to) {
    this.fenetreSure = [from, to];
    for (let r = from; r <= to; r++) {
      // ⚠️ Un véhicule DÉJÀ ARMÉ reste : son panneau d'alerte est peut-être
      // déjà à l'écran, l'effacer laisserait une alerte sans obstacle. Le
      // turbo rend invulnérable, il passe sans dégât.
      const avant = this.cache.get(r);
      if (avant && (avant.type === "contresens" || avant.type === "traverse") && avant.armed) continue;
      this.cache.set(r, this.rangeeSure(r));
    }
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

  // L'espèce `kind` habillée pour le décor `biome`. Ne consomme rien :
  // `compte` dit quelle alternance avancer, une fois l'obstacle posé.
  auDecor(kind, biome) {
    const K = KINDS[kind];
    if (biome === "neige") {
      if (kind === "pieton") return { kind: "skieur", compte: null }; // les piétons de la montagne sont à skis
      // Tout ce qui arrive en face est un chasse-neige — le 2e, TOUJOURS un skieur.
      if (K.contresens && !K.lanceur) return { kind: (this.nNeigeFace || 0) + 1 === 2 ? "skieur" : "chasseneige", compte: "face" };
      // En alternance : au moins un bonhomme par course.
      if (SOUS_LA_NEIGE.has(kind)) return { kind: ((this.nNeige || 0) + 1) % 2 === 1 ? "bonhomme" : "skieur", compte: "neige" };
    }
    if (biome === "plage") {
      if (EN_SLIP.has(kind)) return { kind: "baigneur", compte: null };
      if (kind === "tracteur") return { kind: "buggy", compte: null };
    }
    return { kind, compte: null };
  }

  // Chaîne de dangers : chacun posé à l'écart que la physique du saut impose
  // avec le précédent, plus une marge qui se resserre. Saute les rangées
  // réservées (lait, grosse pièce) et toute une halle.
  etendreDangers(rMax) {
    if (!this.chaine) this.chaine = { r: GRACE_ROWS - 4, kind: null, i: 0 };
    while (this.chaine.r <= rMax) {
      const i = this.chaine.i;
      let kind = this.especeDanger(i);
      // Rien n'arrive en face avant ~20 s : une voiture garée à la place.
      if (KINDS[kind].contresens && KINDS[kind].vitesse > 0 && this.chaine.r < rangAuTemps(20)) kind = "voiture";
      // … ni dans les 8 dernières secondes : aucun véhicule qui roule ne
      // traverse la ligne d'arrivée. (Sur la plage — les 30
      // dernières secondes —, la vache devient un baigneur : auDecor.)
      if (KINDS[kind].contresens && this.chaine.r > rangAuTemps(dureeCourse() - 8)) kind = "vache";
      const groupe = kind === "pieton" ? taillePietons(Math.floor(i / 12)) : 1;
      if (!this.evts) this.evts = { convoi: 0, convoiFait: false, bouchonFait: false };
      if (!this.evts.convoiFait && this.chaine.r >= rangAuTemps(T_CONVOI)) { this.evts.convoiFait = true; this.evts.convoi = CONVOI_N; }
      if (this.evts.convoi > 0) { kind = "bus"; this.evts.convoi -= 1; }
      const bouchon = !this.evts.bouchonFait && this.chaine.r >= rangAuTemps(dureeCourse() - T_BOUCHON_AVANT_FIN);
      if (bouchon) kind = "voiture";
      const t = Math.min(1, Math.max(0, this.chaine.r / RAMP_ROWS));
      const mou = Math.round(MOU_DEBUT + (MOU_FIN - MOU_DEBUT) * t);
      const jeu = Math.floor(this.hash(i * 37 + 11) * (mou + 1));
      const placer = (k, plancher) => {
        const base = this.chaine.kind ? ecartMin(this.chaine.kind, k, Math.min(vMaxRangees(), vitesseAuRang(this.chaine.r + 20) * 1.08)) : 6;
        let r = Math.max(plancher, this.chaine.r + base + jeu);
        let garde = 0;
        while (garde++ < 400 && !rangeeLibre(r, k)) r += 1;
        return r;
      };
      // Chacun dans son décor (voir auDecor) : posé avec l'espèce du paquet,
      // adapté au décor de la rangée TROUVÉE, re-posé (jamais plus tôt) si
      // l'adaptation change l'écart à tenir ou le trajet à l'écran.
      // MOUETTE, dans la dernière minute : entre deux obstacles qui ne
      // demandent pas de double saut (jamais une mouette et un véhicule l'un
      // derrière l'autre), deux fois sur trois.
      let mouette = null;
      const finR = rangAuTemps(dureeCourse());
      if (this.chaine.kind && this.chaine.kind !== "mouette" && !estDouble(this.chaine.kind) && !estDouble(kind) && !bouchon
        && this.chaine.r >= rangAuTemps(dureeCourse() - MOUETTES_DERNIERES_S) && this.chaine.r < finR - 20 && this.hash(i * 53 + 7) < MOUETTES_PART) {
        mouette = placer("mouette", 0) + graceMouette(this.chaine.r);
        let garde = 0;
        while (garde++ < 400 && !rangeeLibre(mouette, "mouette")) mouette += 1;
        this.dangers.set(mouette, "mouette");
        this.chaine = { r: mouette, kind: "mouette", i };
      }
      const apresMouette = (k) => mouette === null ? 0 : mouette + graceMouette(mouette) + ecartMin("mouette", k, Math.min(vMaxRangees(), vitesseAuRang(mouette + 20) * 1.08)) + jeu;
      let r = placer(kind, apresMouette(kind)), choix = this.auDecor(kind, biomeDe(r));
      for (let n = 0; n < 6; n++) {
        const r2 = placer(choix.kind, Math.max(r, apresMouette(choix.kind))), choix2 = this.auDecor(kind, biomeDe(r2));
        r = r2;
        if (choix2.kind === choix.kind) break;
        choix = choix2;
      }
      // Habillé pour son décor, l'obstacle d'après est devenu un double saut :
      // la mouette s'envole (l'écart reste, il est juste plus large).
      if (mouette !== null && estDouble(choix.kind)) this.dangers.delete(mouette);
      if (choix.compte === "face") this.nNeigeFace = (this.nNeigeFace || 0) + 1;
      if (choix.compte === "neige") this.nNeige = (this.nNeige || 0) + 1;
      kind = choix.kind;
      this.dangers.set(r, kind);
      if (bouchon) {
        this.evts.bouchonFait = true;
        for (let k = 0; k < 3; k++) { this.dangers.set(r + k * BOUCHON_PAS, "voiture"); this.bouchons.set(r + k * BOUCHON_PAS, k); }
        // + 6 rangées : un double saut lancé depuis un TOIT vole plus longtemps
        // que l'écart physique (calculé pour un départ au sol) ne le prévoit.
        this.chaine = { r: r + 2 * BOUCHON_PAS + 6, kind: "voiture", i: i + 1 };
        continue;
      }
      // Groupe de piétons : les suivants à l'écart physique du précédent (+
      // une rangée de grâce), tant que la route le permet (réserves, halles,
      // pentes : le groupe s'arrête là).
      let dernier = r;
      for (let g = 1; g < groupe; g++) {
        const vit = Math.min(vMaxRangees(), vitesseAuRang(dernier + 20) * 1.08);
        let rg = dernier + ecartMin(kind, kind, vit) + PIETONS_GRACE;
        // Une mouette entre deux piétons du groupe : saute, reste en bas, saute.
        let m = null;
        if (dernier >= rangAuTemps(dureeCourse() - MOUETTES_DERNIERES_S) && dernier < finR - 20 && this.hash(i * 61 + g * 13) < MOUETTES_PART) {
          m = dernier + ecartMin(kind, "mouette", vit) + graceMouette(dernier);
          rg = m + graceMouette(m) + ecartMin("mouette", kind, vit);
          if (!rangeeLibre(m, "mouette")) m = null;
        }
        if (!rangeeLibre(rg, kind) || biomeDe(rg) !== biomeDe(r)) break;
        if (m !== null) this.dangers.set(m, "mouette");
        this.dangers.set(rg, kind);
        dernier = rg;
      }
      this.chaine = { r: dernier, kind, i: i + 1 };
    }
  }

  // --- Les pièces d'un obstacle : l'ARC de son saut -------------------------------
  // On échantillonne la trajectoire de la famille demandée, une pièce tous
  // les ESPACEMENT rangs, à la hauteur du buste. Suivre l'arc = tout ramasser.
  arcPieces(rObs, kind) {
    const tier = familleDe(kind);
    // Sous une mouette : des pièces AU SOL de part et d'autre — « reste en bas ».
    if (tier === "sol") return [-ESPACEMENT, ESPACEMENT].map((d) => ({ r: rObs + d, h: solAt(rObs + d) + PIECE_SOL }));
    const vit = Math.max(1, vitesseAuRang(rObs));
    const rDepart = rObs - montee(tier) * vit;
    const demi = demiLongueurRoute(kind) + 0.4;
    const out = [];
    // On ne garde que la partie HAUTE de l'arc : les pièces qui rasent le sol
    // juste avant et juste après le saut n'apprennent rien et feraient
    // exploser le compte.
    const seuil = Math.min(apexArc(tier) * 0.45, 0.8);
    for (let q = Math.ceil(rDepart); q <= Math.floor(rDepart + retombee(tier) * vit + montee(tier) * vit); q++) {
      if (Math.abs(q - rObs) <= demi) continue;
      // Une rangée sur ESPACEMENT, calée sur l'obstacle : l'arc reste lisible,
      // et le compte ne gonfle pas parce qu'un saut dure longtemps.
      if (((q - rObs) % ESPACEMENT + ESPACEMENT) % ESPACEMENT !== 0) continue;
      const h = hauteurArc(tier, (q - rDepart) / vit);
      if (h < seuil) continue;
      out.push({ r: q, h: h + CORPS_CENTRE + solAt(rObs) });
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
          : { type: "statique", kind, coins: [], boue: null, bouchon: this.bouchons.get(r0 + p) };
    }
    for (let p = 0; p < BLOC; p++) if (!rowsBloc[p]) rowsBloc[p] = { type: "safe", coins: [], boue: null };
    // 2. Les arcs de pièces (ils peuvent déborder du bloc : on garde ce qui
    //    tombe dedans, le bloc voisin recalcule sa part quand il se génère).
    const pose = (r, h, grosse, double = false) => {
      const p = r - r0;
      if (p < 0 || p >= BLOC) return false;
      const row = rowsBloc[p];
      if (row.type !== "safe" || row.lait !== undefined || row.grosse !== undefined) return false;
      if (grosse) { row.grosse = h; row.coins = []; return true; }
      if (row.coins.length) return false;
      row.coins = [h];
      if (double) row.double = true;
      return true;
    };
    for (let p = -12; p < BLOC + 12; p++) {
      const kind = this.dangers.get(r0 + p);
      if (!kind || this.bouchons.has(r0 + p)) continue;
      // Une pièce d'arc jamais DANS une bosse de montagne.
      const arc = this.arcPieces(r0 + p, kind).filter((c) => c.h >= solAt(c.r) + PIECE_SOL - 0.3);
      // PIÈCE DOUBLE (compte double, un peu plus grosse) : la plus haute de
      // l'arc d'un DOUBLE saut — la récompense du gros saut, au sommet.
      const sommet = familleDe(kind) === "double" && arc.length ? arc.reduce((a, c) => (c.h > a.h ? c : a)) : null;
      for (const c of arc) pose(c.r, c.h, false, c === sommet);
    }
    // 3. Halle : plancher couvert de pièces (une tous les 2 × ESPACEMENT rangs).
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
        for (let i = 0; i < TRAINEE_LONGUEUR; i++) pose(r0 + depart + i * ESPACEMENT, solAt(r0 + depart + i * ESPACEMENT) + PIECE_SOL, false);
        libre = 0;
      }
    }
    // 4 bis. Le bouchon : une pièce entre chaque paire de voitures, à hauteur
    // de toit — elles disent « roule dessus ».
    for (let p = -2 * BOUCHON_PAS; p < BLOC; p++) {
      const rb = r0 + p;
      if (!this.bouchons.has(rb) || this.bouchons.has(rb - BOUCHON_PAS)) continue;
      const hToit = KINDS.voiture.h + MARGE_H + PIECE_SOL;
      for (const k of [1, 2, 4, 5]) { const q = rb + k; const row = q - r0 >= 0 && q - r0 < BLOC ? rowsBloc[q - r0] : null; if (row) row.coins = []; pose(q, hToit, false); }
    }
    // 5. Lait et grosse pièce sur leurs rangées réservées, sinon au plus près.
    // Le lait et la grosse pièce se posent sur une rangée LIBRE et à l'écart :
    // jamais sur un arc (ça y ferait un trou) ni collée à un obstacle (elle
    // attirerait le joueur pile là où il ne faut pas être).
    const dispo = (p, isolee = true) => {
      if (p < 0 || p >= BLOC) return false;
      const row = rowsBloc[p];
      if (row.type !== "safe" || row.coins.length || row.lait !== undefined || row.grosse !== undefined) return false;
      if (dansHalle(r0 + p)) return false;
      for (let d = -3; d <= 3; d++) if (this.dangers.has(r0 + p + d)) return false;
      // Seule sur la route : on cherche d'abord une place sans pièce d'ARC à
      // moins de LAIT_ISOLE rangées (les lignes de pièces au sol, elles,
      // s'effacent autour de la brique) ; à défaut, le bout d'arc s'efface
      // aussi — le quota de briques reste le même pour toutes les graines.
      for (let d = -LAIT_ISOLE; d <= LAIT_ISOLE; d++) {
        const q = p + d;
        if (q < 0 || q >= BLOC) { if (isolee) return false; continue; }
        if (isolee && rowsBloc[q].coins.some((h) => h > solAt(r0 + q) + PIECE_SOL + 0.05)) return false;
      }
      // Ni sur le passage d'un véhicule venu d'en face pendant qu'il est à
      // l'écran : il traverserait la brique sous les yeux du joueur.
      for (let r = r0 + p - BALAYAGE_MAX; r < r0 + p; r++) {
        const k = this.dangers.get(r);
        if (k && KINDS[k].contresens && !KINDS[k].lanceur && r0 + p - r <= balayageVisible(r, k)) return false;
      }
      return true;
    };
    for (let p = 0; p < BLOC; p++) {
      const r = r0 + p;
      // La grosse pièce dorée n'est pas posée : sa rangée reste réservée, vide.
      // Pas de lait dans les 55 dernières secondes : chaque brique vide la
      // route 5 s, la fin de course deviendrait la plus calme.
      const kind = r % LAIT_EVERY === LAIT_EVERY / 2 && r < rangFinLait() ? "lait" : null;
      if (!kind) continue;
      let q = null;
      for (const isolee of [true, false]) for (let d = 0; d < BLOC && q === null; d++) { if (dispo(p + d, isolee)) q = p + d; else if (dispo(p - d, isolee)) q = p - d; }
      if (q === null) continue;
      rowsBloc[q][kind] = kind === "lait" ? solAt(r0 + q) + H_LAIT : solAt(r0 + q) + H_ROUGE;
      for (let d = -LAIT_ISOLE; d <= LAIT_ISOLE; d++) if (d && rowsBloc[q + d]) rowsBloc[q + d].coins = [];
    }
    // 6. Aucune pièce qu'un véhicule venu d'en face TRAVERSE sous les yeux du
    //    joueur : elle semblerait imprenable, le meilleur score hors
    //    d'atteinte. En face, il balaie les rangées au-delà de son point de
    //    croisement pendant qu'il entre dans l'écran : une pièce plus basse
    //    que son toit, là, semble prise dans la carrosserie. On l'enlève.
    for (let p = 0; p < BLOC; p++) {
      const row = rowsBloc[p];
      if (!row.coins.length) continue;
      const q = r0 + p;
      for (let r = q - BALAYAGE_MAX; r < q; r++) {
        const kind = this.dangers.get(r);
        if (!kind) continue;
        const K = KINDS[kind];
        // Tout ce qui vient en face, piétons compris. Seule la poule jetée
        // part d'ailleurs (le fermier).
        if (!K.contresens || K.lanceur) continue;
        const d = q - r, demi = demiLongueurRoute(kind);
        if (d <= demi + 0.4 || d > balayageVisible(r, kind)) continue;
        if (row.coins[0] - solAt(q) < K.h + 0.3) { row.coins = []; row.double = false; break; }
      }
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

  // Le TUTO : pour chaque famille qu'on va expliquer, son premier obstacle
  // garde la route pour lui — rien TUTO_AVANT_S avant (un autre obstacle
  // juste avant piégerait le joueur concentré sur la consigne), rien
  // TUTO_APRES_S après (le double saut demande de la place). Deux tutos ne se
  // suivent jamais de plus près que ces deux fenêtres réunies — un obstacle de la famille trop tôt est retiré, c'est le suivant
  // qu'on expliquera. Seulement pour qui a encore un tuto à voir (main.js).
  // `depuis` / `gardes` : après un turbo (sa fenêtre sûre a pu effacer
  // l'obstacle réservé), main.js en réserve un autre plus loin, en gardant
  // ceux qui tiennent toujours.
  degagerTutos(familles, depuis = GRACE_ROWS, gardes = []) {
    const reste = new Set(familles), reserves = gardes.slice();
    for (let r = Math.max(GRACE_ROWS, depuis); r < 2000 && reste.size; r++) {
      const row = this.rowAt(r);
      if (row.type !== "statique" && row.type !== "traverse" && row.type !== "contresens") continue;
      const f = familleDe(row.kind);
      if (!reste.has(f)) continue;
      const v = Math.max(1, vitesseAuRang(r));
      const avant = Math.round(v * TUTO_AVANT_S), apres = Math.round(v * TUTO_APRES_S);
      if (reserves.some((q) => Math.abs(r - q) < avant + apres)) { this.rendreSure(r); continue; }
      reste.delete(f); reserves.push(r);
      for (let q = r - avant; q <= r + apres; q++) if (q !== r && q >= GRACE_ROWS && !reserves.includes(q)) this.rendreSure(q);
    }
    return reserves;
  }
  // L'obstacle part, les pièces restent. La brique de lait aussi s'en va :
  // son explication (le projecteur) tomberait sur celle du tuto.
  rendreSure(r) {
    const row = this.rowAt(r);
    if (row.type === "safe" && row.lait === undefined) return;
    this.cache.set(r, { type: "safe", coins: row.coins, double: row.double, grosse: row.grosse, boue: null });
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
          events.push({ type: "piece", r, h: row.coins[i], double: !!row.double });
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
      const haut = hauteurObstacle(row.kind, r) + solAt(centre);
      if (jumpY >= haut) continue;
      if (K.aerien && jumpY + HAUT_CYCLISTE <= K.bas + solAt(centre)) continue; // passé dessous
      this.resolved.add(key);
      events.push({ type: "obstacle", kind: row.kind, cout: K.cout, franchir: familleDe(row.kind), r, haut });
    }
    return events;
  }
}

// Jusqu'où, au-delà de son point de croisement r, un véhicule venu d'en face
// balaie la route PENDANT qu'il est à l'écran : il y entre quand son nez est
// à DEVANT rangées du joueur (72 % de la largeur visible, scene.joueurX), son
// centre est alors à r + k·(DEVANT + demi)/(1 + k) — k = sa vitesse / celle
// du joueur, avec l'accélération des véhicules en fin de course (armer()).
const BALAYAGE_MAX = 10;
function tempsAuRang(r) {
  let a = 0, b = dureeCourse();
  for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (rangAuTemps(m) < r) a = m; else b = m; }
  return a;
}
function balayageVisible(r, kind) {
  const K = KINDS[kind], demi = demiLongueurRoute(kind);
  const devant = 0.72 * (window.CONFIG.unitesVisibles || 14.5) + 1;
  const fin = 1 + 0.4 * Math.max(0, Math.min(1, (tempsAuRang(r) - 100) / 50));
  const k = (K.vitesse * fin) / Math.max(1, vitesseAuRang(r));
  return Math.min(BALAYAGE_MAX, demi + 0.6 + (k * (devant + demi)) / (1 + k));
}

// --- Rangées réservées ---------------------------------------------------------------
function estReservee(r) { return r % LAIT_EVERY === LAIT_EVERY / 2 || r % GROSSE_EVERY === 40; }

// Armement : la traversée part du FOND et atteint la route à `tArrivee` ; la
// voiture en sens inverse part de DEVANT et arrive sur la rangée au même
// instant ; la poule jetée part des mains du fermier, `lanceur` rangées plus
// loin, et court juste assez vite pour croiser le joueur sur la rangée.
// Délai d'armement (secondes avant l'arrivée du joueur sur la rangée) :
// partagé par main.js, la simulation et l'outil de mesure.
export function delaiArmement(row) {
  const K = KINDS[row.kind];
  if (K.lanceur) return K.lanceur / K.vitesse;
  return K.arme || 4.0;
}
export function armer(row, now, tArrivee) {
  if (row.armed) return;
  row.armed = true;
  row.t0 = now;
  const K = KINDS[row.kind];
  const dt = Math.max(0.6, tArrivee - now);
  if (row.type === "contresens") {
    if (K.lanceur) { row.v0 = K.lanceur; row.vitesse = K.lanceur / dt; return; }
    // Les véhicules d'en face accélèrent sur la fin : jusqu'à +40 % entre
    // 100 et 150 s (la fenêtre de saut raccourcit, le temps de réaction aussi).
    const fin = K.vitesse > 0 ? 1 + 0.4 * Math.max(0, Math.min(1, (now - 100) / 50)) : 1;
    row.vitesse = K.vitesse * fin; row.v0 = row.vitesse * dt; return;
  }
  row.u0 = -row.dir * (ROAD_HALF + 6.0);
  const dist = Math.abs(row.u0);
  row.vitesse = Math.max(1.8, Math.min(K.vmax || 9, dist / dt));
}

// Route dégagée autour du premier obstacle de chaque tuto (Route.degagerTutos).
export const TUTO_AVANT_S = 2.4, TUTO_APRES_S = 1.6;
export function degagerTutos(familles, depuis, gardes) { return live.degagerTutos(familles, depuis, gardes); }
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
// La Route en cours (la simulation, elle, crée les siennes).
export function routeVivante() { return live; }
export function reseed(force) { live = new Route(force); }
export function reset() { live.reset(); }
export function ouvrirFenetreSure(from, to) { live.ouvrirFenetreSure(from, to); }
export function rowAt(r) { return live.rowAt(r); }
export function coinTaken(r, i) { return live.coinTaken(r, i); }
export function bonusTaken(r, kind) { return live.bonusTaken(r, kind); }
export function checkMember(id, prevV, v, jumpY, t) { return live.checkMember(id, prevV, v, jumpY, t); }
