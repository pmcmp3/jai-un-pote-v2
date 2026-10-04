// ambiance.js — Ce qui sonne EN CONTINU pendant la course (4 octobre 2026,
// nuit : « un bruitage de bicyclette dans le fond, en pas fort », « plus de
// sound design, à fond »). main.js appelle pas() à chaque image avec l'état
// du joueur ; ici on règle :
//   - le VÉLO : le pneu sur la chaussée (goudron, neige qui crisse, planches
//     des halles, piste du bowling, toit de voiture), la roue libre qui
//     cliquette en l'air, le vent de la vitesse, le jetpack ;
//   - ce qui ARRIVE EN FACE : son klaxon quand il entre à l'écran (la sonnette
//     du vélo pour les piétons et les skieurs), son moteur qui passe de droite
//     à gauche avec l'effet Doppler ;
//   - les BÊTES qui crient en nous voyant arriver (pas toutes, pas toujours) ;
//   - la GARE : le TER qui entre en klaxonnant, roule, freine et souffle
//     (scene.decalageTrain, la même formule que le dessin) ;
//   - le BOWLING : le fracas des quilles à chaque boule (scene.phaseQuilles,
//     la même horloge que le dessin) ;
//   - l'AMBIANCE de chaque décor : oiseaux le jour, grillons et chouette la
//     nuit, meuglement au loin dans les prés, cloche au passage d'un clocher,
//     blizzard dans la montagne, vagues et mouettes sur la plage.
// Tout passe par un bus à soi, branché sur la sortie des bruitages
// (audio.sfxOutput : le curseur de volume du joueur) et rebranché quand
// audio.js recrée son graphe (reprise, rejouer). Course arrêtée (pause, mort,
// écran de fin) : fondu à zéro, puis les sources s'éteignent.
import * as audio from "./audio.js";
import * as B from "./bruitages.js";
import * as rows from "./rows.js";
import * as scene from "./scene.js";

let ctx = null, bus = null, busDest = null;
let C = null;                 // les couches continues (et les bus de grains)
let dernierActif = -1e9;
const moteurs = new Map();    // rangée → moteur de ce qui vient en face
const annonces = new Set();   // rangées déjà klaxonnées (ou sonnées)
const appels = new Set();     // bêtes qui ont déjà crié en nous voyant
const cloches = new Set();    // clochers déjà sonnés
const pistes = new Map();     // piste de bowling → phase de la boule à l'image d'avant
let prochain = {};            // prochains événements d'ambiance (horloge audio)
let rafales = {};             // prochain grain de chaque rafale
let train = null;             // ce que le TER a déjà fait
const dernier = { klaxon: -9, sonnette: -9, appel: -9, quilles: -9 };
const alea = B.rng(Date.now() % 1e9);

const clamp = (x, a = -0.9, b = 0.9) => Math.max(a, Math.min(b, x));
const NIV = (nom) => B.NIVEAUX[nom] ?? 0.2;

// Nouvelle course : tout peut resonner.
export function reinitialiser() {
  annonces.clear(); appels.clear(); cloches.clear(); pistes.clear();
  prochain = {}; rafales = {}; train = null;
}

// L'atterrissage (main.js) : force = vitesse de chute, surface sous les roues.
export function atterrir(force, surface) {
  B.jouer("atterrissage", { force, surface, volume: window.CONFIG.veloVolume ?? 1 });
}

function allumer() {
  C = {};
  for (const nom of ["roulement", "vent", "blizzard", "vagues", "jet"]) C[nom] = B.couche(ctx, bus, nom);
  C.gTic = ctx.createGain(); C.gTic.connect(bus);
  C.gSol = ctx.createGain(); C.gSol.connect(bus);
}
function eteindre(t) {
  for (const c of Object.values(C)) if (c && c.stop) c.stop(t + 0.1);
  C = null;
  for (const m of moteurs.values()) m.arreter(t);
  moteurs.clear();
}

// E : voir etatSon() dans main.js.
export function pas(dt, E) {
  const s = audio.sfxOutput();
  if (!s) return; // contexte suspendu (onglet quitté) : rien ne joue, rien à régler
  if (s.ctx !== ctx) { ctx = s.ctx; bus = null; busDest = null; C = null; moteurs.clear(); }
  if (!bus) { bus = ctx.createGain(); bus.gain.value = 0; }
  if (busDest !== s.dest) { try { bus.disconnect(); } catch (e) { /* jamais branché */ } bus.connect(s.dest); busDest = s.dest; }
  const t = ctx.currentTime;
  const actif = E.etat === "course" || (E.etat === "fin" && E.finAge < 3.5);
  if (!actif) {
    bus.gain.setTargetAtTime(0, t, E.etat === "fin" ? 0.5 : 0.08);
    if (C && t - dernierActif > 2.5) eteindre(t);
    return;
  }
  dernierActif = t;
  if (!C) allumer();
  bus.gain.setTargetAtTime(window.CONFIG.bruitagesVolume ?? 1, t, 0.15);
  velo(E, t);
  if (E.etat !== "course") {
    for (const m of moteurs.values()) m.arreter(t);
    moteurs.clear();
    return;
  }
  enFace(E, t);
  betes(E, t);
  gare(E, t);
  bowling(E, t);
  nature(E, t);
}

// --- Le vélo ---------------------------------------------------------------------
// Le pneu selon ce qu'il y a dessous : f/q/lp = le timbre du roulement, g = son
// niveau ; grain = ce qui crépite en plus (neige, lattes : une par rangée).
const SURFACES = {
  route: { f: 380, q: 0.6, lp: 1400, g: 1 },
  sable: { f: 300, q: 0.5, lp: 1000, g: 0.85 },
  neige: { f: 900, q: 0.5, lp: 3000, g: 0.55, grain: "neige", cadence: 16 },
  bois: { f: 300, q: 0.7, lp: 1600, g: 0.8, grain: "latte" },
  piste: { f: 220, q: 0.7, lp: 900, g: 0.7 },
  toit: { f: 700, q: 2.5, lp: 2500, g: 0.6 },
};
function velo(E, t) {
  const V = window.CONFIG.veloVolume ?? 1;
  const vit = Math.min(1.2, E.vitesse / E.vitesseMax);
  const S = SURFACES[E.surface] || SURFACES.route;
  const roule = E.auSol && E.vitesse > 0.2 && E.etat === "course" || (E.etat === "fin" && E.auSol);
  const fin = E.etat === "fin" ? Math.max(0, 1 - E.finAge / 3.5) : 1;
  C.roulement.gain.setTargetAtTime(roule ? NIV("couche_roulement") * V * S.g * (0.4 + 0.6 * Math.min(1, vit)) * fin : 0, t, roule ? 0.04 : 0.02);
  C.roulement.f.setTargetAtTime(S.f * (0.8 + 0.4 * vit), t, 0.08);
  C.roulement.q.setTargetAtTime(S.q, t, 0.08);
  C.roulement.lp.setTargetAtTime(S.lp, t, 0.08);
  // Ce qui crépite sous le pneu : la neige, les lattes des halles.
  if (roule && S.grain) {
    C.gSol.gain.setTargetAtTime(NIV(S.grain === "latte" ? "planches" : "neigeRoule") * V, t, 0.05);
    const cadence = S.grain === "latte" ? E.vitesse : S.cadence * (0.6 + 0.6 * vit);
    rafale("sol", t, cadence, (tt) => B.jouerGrain(ctx, C.gSol, S.grain, tt, 0.85 + alea() * 0.3));
  } else rafales.sol = 0;
  // La roue libre : « tic-tic-tic » en l'air, et après l'arrivée.
  const roueLibre = (!E.auSol && E.tAir > 0.12) || E.etat === "fin";
  if (roueLibre) {
    C.gTic.gain.setTargetAtTime(NIV("roueLibre") * V * fin, t, 0.04);
    const cadence = E.etat === "fin" ? Math.max(6, 22 - E.finAge * 4) : 26 - 8 * Math.min(1, E.tAir / 1.6);
    rafale("roue", t, cadence, (tt) => B.jouerGrain(ctx, C.gTic, "tic", tt, 0.95 + alea() * 0.1));
  } else rafales.roue = 0;
  // Le vent de la vitesse : plus fort en l'air, au turbo, en jetpack.
  const souffle = vit * vit * (1 + (E.auSol ? 0 : 0.5) + (E.turbo ? 1.2 : 0) + (E.jetpack ? 0.8 : 0)) * fin;
  C.vent.gain.setTargetAtTime(NIV("couche_vent") * V * souffle, t, 0.25);
  C.vent.f.setTargetAtTime(450 + 700 * vit + (E.turbo ? 600 : 0), t, 0.3);
  // Le jetpack : il gronde quand on pousse, veilleuse sinon.
  C.jet.gain.setTargetAtTime(E.jetpack ? NIV("couche_jet") * (E.poussee ? 1 : 0.2) : 0, t, E.jetpack ? 0.05 : 0.12);
  C.jet.lp.setTargetAtTime(E.poussee ? 1100 : 500, t, 0.08);
}
// Une rafale de grains, planifiés juste devant l'horloge audio.
function rafale(cle, t, cadence, jouer) {
  if (cadence <= 0.5) { rafales[cle] = 0; return; }
  if (!rafales[cle] || rafales[cle] < t - 0.1 || rafales[cle] > t + 1) rafales[cle] = t + 0.01;
  while (rafales[cle] < t + 0.1) { jouer(rafales[cle]); rafales[cle] += (1 / cadence) * (0.85 + 0.3 * alea()); }
}

// --- Ce qui arrive en face ------------------------------------------------------
function enFace(E, t) {
  const vus = new Set();
  for (let r = Math.max(0, Math.floor(E.v) - 28); r <= E.v + 36; r++) {
    const row = rows.rowAt(r);
    if (row.type !== "contresens" || !row.armed || rows.KINDS[row.kind].lanceur) continue;
    const o = rows.contresensAt(r, row, E.tm);
    if (!o) continue;
    const x = E.ecranX(o.v), d = o.v - E.v;
    // Il entre à l'écran : son klaxon (la sonnette du vélo pour un piéton ou un skieur).
    if (!annonces.has(r) && d > 0 && x < 1.5) {
      annonces.add(r);
      if (!E.ejectes.has(r)) {
        if (row.kind === "pieton" || row.kind === "skieur") {
          if (t - dernier.sonnette > 2.5) { dernier.sonnette = t; B.jouer("sonnette", { pan: -0.15 }); }
        } else {
          const nom = B.klaxonDe(row.kind);
          if (nom && t - dernier.klaxon > 0.8) { dernier.klaxon = t; B.jouer(nom, { pan: 0.75, doppler: 1.03 }); }
        }
      }
    }
    // Son moteur, tant qu'il est à l'écran ou presque.
    if (!B.KINDS_MOTEUR.includes(row.kind) || x < -0.35 || x > 1.6 || E.ejectes.has(r)) continue;
    vus.add(r);
    let m = moteurs.get(r);
    if (!m) { m = B.moteur(ctx, bus, row.kind); moteurs.set(r, m); }
    m.regler(NIV(`moteur_${row.kind}`) / (1 + (d / 7) ** 2), 2 * x - 1, 1 + 0.06 * Math.tanh(d / 2.5), t);
  }
  for (const [r, m] of moteurs) if (!vus.has(r)) { m.arreter(t); moteurs.delete(r); }
}

// --- Les bêtes qui nous voient arriver -------------------------------------------
function betes(E, t) {
  for (let r = Math.floor(E.v) + 4; r <= E.v + 26; r++) {
    const row = rows.rowAt(r);
    if (row.type !== "statique" || !B.APPELS[row.kind] || appels.has(r)) continue;
    const x = E.ecranX(r);
    if (x > 1.02) continue;
    appels.add(r);
    // Quatre sur cinq, jamais deux d'affilée trop vite.
    const h = Math.abs(Math.sin(r * 12.9898 + 4.1) * 43758.5453) % 1;
    if (h < 0.8 && t - dernier.appel > 1) { dernier.appel = t; B.jouer(B.APPELS[row.kind], { pan: clamp(2 * x - 1, -0.2, 0.85) }); }
  }
}

// --- La gare : le TER entre en gare -------------------------------------------------
// Il arrive de derrière (scene.decalageTrain) : on l'entend klaxonner au loin
// à gauche, gronder en approchant, il nous double, crisse en freinant le long
// du quai, souffle à l'arrêt ; le carillon sonne quand on monte sur le quai.
function gare(E, t) {
  const d = rows.debutHalle("gare");
  if (d === null) return;
  const T = scene.TRAIN, p = E.v;
  if (p < d + T.klaxon - 12 || p > d + rows.HALLE_ROWS + 12) {
    for (const nom of ["grondement", "freins"]) if (C[nom]) C[nom].gain.setTargetAtTime(0, t, 0.3);
    return;
  }
  if (!train) train = { klaxon: false, pschit: false, carillon: false, rail: 0 };
  if (!C.grondement) C.grondement = B.couche(ctx, bus, "grondement");
  if (!C.freins) C.freins = B.couche(ctx, bus, "freins");
  const brut = (d + T.arret - p) / T.approche, s = Math.max(0, Math.min(1, brut));
  const vTrain = brut >= 1 ? 0 : 2 * T.elan * s * E.vitesse / T.approche; // rangées/s (immobile tant qu'il attend, hors champ)
  const off = scene.decalageTrain(d, p), arriere = d + 4 + off, nez = d + rows.HALLE_ROWS - 4 + off;
  const dist = p < arriere ? arriere - p : p > nez ? p - nez : 0;
  const pres = 1 / (1 + (dist / 15) ** 2), pan = clamp(2 * E.ecranX(Math.max(arriere, Math.min(nez, p + 6))) - 1);
  // Le klaxon d'abord, de loin derrière nous.
  if (!train.klaxon && p >= d + T.klaxon) { train.klaxon = true; B.jouer("train", { pan: -0.8, doppler: 1.03, prioritaire: true }); }
  // Il roule : grondement et « ta-dam » des rails, de plus en plus lents.
  C.grondement.gain.setTargetAtTime(train.klaxon ? NIV("couche_grondement") * Math.min(1, vTrain / 18) * pres : 0, t, 0.15);
  if (vTrain > 1.2 && pres > 0.2 && t >= train.rail) {
    train.rail = t + 7 / vTrain;
    B.jouer("rail", { pan, volume: pres * Math.min(1, 0.3 + vTrain / 15), ecart: Math.min(0.2, 1.4 / vTrain) });
  }
  // Il freine : ça crisse, de plus en plus fort jusqu'à l'arrêt.
  const crisse = s > 0.015 && s < 0.4 ? Math.min(1, (0.4 - s) / 0.15) * Math.min(1, s / 0.04) : 0;
  C.freins.gain.setTargetAtTime(NIV("couche_freins") * crisse * pres, t, 0.1);
  // À l'arrêt : il souffle. Sur le quai : le carillon.
  if (!train.pschit && brut <= 0) { train.pschit = true; B.jouer("pschit", { pan }); }
  if (!train.carillon && p > d + rows.HALLE_MONTEE + 2) { train.carillon = true; B.jouer("carillon", { pan: 0.25, etouffe: 5000 }); }
}

// --- Le bowling : une boule, des quilles ---------------------------------------------
function bowling(E, t) {
  const d = rows.debutHalle("bowling");
  if (d === null) return;
  const p = E.v;
  if (p < d - 6 || p > d + rows.HALLE_ROWS + 6) {
    if (C.boules) C.boules.gain.setTargetAtTime(0, t, 0.3);
    pistes.clear();
    return;
  }
  if (!C.boules) C.boules = B.couche(ctx, bus, "boules");
  C.boules.gain.setTargetAtTime(NIV("couche_boules"), t, 0.3);
  const v1 = d + rows.HALLE_MONTEE;
  for (const v of scene.pistesBowling(v1, v1 + rows.HALLE_PLAT)) {
    if (Math.abs(v - p) > 14) { pistes.delete(v); continue; }
    const k = scene.phaseQuilles(E.tDecor, v), avant = pistes.get(v);
    pistes.set(v, k);
    if (avant === undefined || !(avant < scene.QUILLES_IMPACT && k >= scene.QUILLES_IMPACT)) continue;
    const x = E.ecranX(v), proche = 1 / (1 + ((v - p) / 6) ** 2);
    if (x < -0.1 || x > 1.1 || proche < 0.12 || t - dernier.quilles < 0.12) continue;
    dernier.quilles = t;
    B.jouer("quilles", { pan: clamp(2 * x - 1), volume: proche });
  }
}

// --- L'ambiance de chaque décor --------------------------------------------------------
function nature(E, t) {
  const A = window.CONFIG.ambianceVolume ?? 1;
  const jour = E.nuit < 0.4, nuit = E.nuit > 0.55, dehors = E.halle !== "bowling";
  // Toutes les min à max secondes (la première fois : un peu plus tôt).
  const quand = (cle, min, max) => {
    if (prochain[cle] === undefined) prochain[cle] = t + (min + alea() * (max - min)) * 0.5;
    if (t < prochain[cle]) return false;
    prochain[cle] = t + min + alea() * (max - min);
    return true;
  };
  const cote = () => (alea() < 0.5 ? -1 : 1) * (0.3 + alea() * 0.5);
  if (E.biome === "route" && jour && dehors && quand("oiseau", 2.5, 6.5)) B.jouer("oiseau", { pan: cote(), volume: 0.5 + 0.5 * alea(), ambiance: true });
  if (E.biome === "route" && nuit && dehors && quand("grillon", 1.6, 4)) B.jouer("grillon", { pan: cote(), volume: 0.6 + 0.4 * alea(), ambiance: true });
  if (nuit && E.biome !== "plage" && dehors && quand("chouette", 13, 24)) B.jouer("chouette", { pan: cote(), ambiance: true });
  if (E.biome === "plage" && quand("mouette", 5, 12)) B.jouer("mouette", { pan: 0.15 + alea() * 0.6, volume: 0.6 + 0.4 * alea(), ambiance: true });
  if (E.zone === "prairie" && jour && quand("meuh", 12, 25)) B.jouer("meuh", { pan: cote(), volume: 0.5, etouffe: 900, ambiance: true });
  // La cloche, au passage d'un clocher (une seule rangée possible devant nous).
  const r0 = Math.ceil(E.v + 3), r = r0 + ((27 - r0) % 55 + 55) % 55;
  if (r <= E.v + 18 && !cloches.has(r) && scene.clocherA(r)) { cloches.add(r); B.jouer("cloche", { pan: 0.55, ambiance: true }); }
  // Le blizzard de la montagne : des rafales qui changent de couleur.
  const neige = E.biome === "neige" && dehors;
  C.blizzard.gain.setTargetAtTime(neige ? NIV("couche_blizzard") * A : 0, t, 1.2);
  if (neige && t > (prochain.rafale || 0)) {
    prochain.rafale = t + 2 + alea() * 2.5;
    C.blizzard.f.setTargetAtTime(380 + alea() * 600, t, 0.9);
    C.blizzard.f2.setTargetAtTime(1000 + alea() * 900, t, 1.1);
  }
  // La mer : une vague toutes les ~7 s, qui monte, se brise et se retire.
  const plage = E.biome === "plage";
  C.vagues.gain.setTargetAtTime(plage ? NIV("couche_vagues") * A : 0, t, 1.5);
  if (plage && t >= (prochain.vague || 0) - 0.05) {
    const T = 6.5 + alea() * 2, t0 = Math.max(t, prochain.vague || t);
    C.vagues.env.setValueAtTime(0.2, t0);
    C.vagues.env.linearRampToValueAtTime(1, t0 + 0.42 * T);
    C.vagues.env.linearRampToValueAtTime(0.55, t0 + 0.55 * T);
    C.vagues.env.linearRampToValueAtTime(0.2, t0 + T);
    C.vagues.lp.setValueAtTime(450, t0);
    C.vagues.lp.linearRampToValueAtTime(1900, t0 + 0.45 * T);
    C.vagues.lp.linearRampToValueAtTime(700, t0 + T);
    prochain.vague = t0 + T;
  }
}
