// friends.js — Les potes derrière le joueur.
//
// v2 (19 septembre 2026, vue de profil, une voie) : la file indienne de la
// v1 (premier pote 3 rangées derrière, puis 1,6 par pote) sortait de l'écran
// en portrait — on ne voit que ~3,5 unités derrière le joueur. Les potes
// roulent donc en MEUTE serrée, comme la horde de Zombie Tsunami : chacun a
// sa place en profondeur (u) sur la largeur de la route, ils se chevauchent
// sans se cacher. Ils refont les sauts ET les saltos du joueur au même
// endroit (marques posées par main.js), ce qui donne la vague de la meute qui
// saute l'un après l'autre. Aucun dégât ; ils ramassent les pièces qu'ils
// croisent.

import { project } from "./scene.js";
import { PALETTES, paletteDepuisSkin } from "./rider.js";
import { drawRider, drawJetpack, RIDER_HEIGHT } from "./voxrider.js";

// Profondeur de chaque place de la meute (+ = côté fond, − = côté caméra).
const U_MEUTE = [0.55, -0.45, 0.95, -0.15, 0.3, -0.6, 0.75, 0.1];
export const SPACING = 0.5;
function ecart() { return window.CONFIG.potesEcart || SPACING; }
function premierRecul() { return window.CONFIG.potesRecul || 1.0; }
// Rangée d'un pote de rang `slot` (0 = juste derrière le joueur).
function vDuSlot(playerV, slot) { return playerV - premierRecul() - slot * ecart(); }
const LEAVE_S = 0.8;
const ARRIVAL_S = 1.1;

let potes = [];
let maxCount = 0;
let largeurEcran = 400; // pour garder les pastilles d'arrivée dans l'écran
export function setLargeurEcran(w) { largeurEcran = w || largeurEcran; }
let joins = 0;
let marques = []; // { id, v, type, ref } — là où le joueur a sauté, et devant quel obstacle
let markId = 0;

export function reset() { potes = []; maxCount = 0; joins = 0; marques = []; tirerSelection(); }
export function alive() { return potes.filter((p) => !p.leave); }
export function count() { return alive().length; }
export function maxReached() { return maxCount; }
// En ligue, le peloton c'est LES MEMBRES de la ligue, rien d'autre (7 septembre
// 2026 : « c'est plus Soberland etc., juste les gens qui font partie de la
// ligue, donc le nombre de potes = le nombre de personnes dans la ligue »).
// ⚠️ TOUJOURS `config.potesMax` depuis le 16 septembre 2026 (bêta fermée) :
// renversement assumé du « le nombre de potes = le nombre de personnes dans la
// ligue » du 7 septembre. Mesuré sur la première course de bêta : premier
// inscrit seul dans sa ligue → `potes: 0` en base, aucun pote ne vient de toute
// la course, le jeu perd son cœur et paraît vide (« je suis tout seul, il n'y a
// pas assez de difficulté »). Le peloton est donc COMPLÉTÉ par les potes par
// défaut (listeMembres) : les membres de la ligue d'abord, les autres ensuite.
// Le plafond protège aussi la ligue de bêta, qui peut compter 60 personnes.
export function max() { return Math.min(listeMembres().length, window.CONFIG.potesMax); }

// Marque un saut ("saut"), un saut tenu ("haut") ou un double saut ("double")
// du joueur en v : la meute le refait au même endroit.
// `ref` = { r, d } : l'obstacle franchi (sa rangée) et la distance qui l'en
// séparait au moment du saut — le pote saute à la MÊME distance de lui, même
// s'il roule (voiture en face, tracteur). Sans obstacle : au même endroit.
export function recordPlayer(v, type, ref = null) {
  if (type) marques.push({ id: ++markId, v, type, ref });
  const minV = vDuSlot(v, max() + 1) - 1;
  if (marques.length && marques[0].v < minV) marques = marques.filter((m) => m.v > minV);
}

// Les potes portent les pseudos de la LIGUE quand il y en a une (5 membres
// tirés au hasard par course), complétés par les prénoms par défaut.
// Liste de membres { nom, skin } : ceux de la ligue, sinon la ligue de démo.
let nomsLigue = null;
export function setNomsLigue(liste) {
  nomsLigue = Array.isArray(liste) ? liste.map((m) => (typeof m === "string" ? { nom: m, skin: null } : m)) : null;
  tirerSelection();
}
// ⚠️ 5 membres TIRÉS AU HASARD à chaque course (16 septembre 2026, demandé
// pour la bêta : « oui, 5 personnes aléatoires à chaque fois »). Une ligue de
// bêta peut compter 60 personnes pour 5 places dans le peloton : sans tirage,
// tout le monde verrait éternellement les 5 premiers inscrits. Le tirage est
// refait à chaque `reset()` (donc à chaque course) et à chaque arrivée d'une
// nouvelle liste de membres ; il est FIGÉ pendant la course, sinon les
// prénoms changeraient entre deux potes d'un même peloton.
// Non seedé, volontairement : les prénoms ne touchent pas au gameplay, la
// course reste la même pour toute la ligue (graine du code, regles.js).
let selection = null;
function tirerSelection() {
  if (!nomsLigue) { selection = null; return; }
  const max = window.CONFIG.potesMax;
  const pool = nomsLigue.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const choisis = pool.slice(0, max);
  // Dans une ligue, les places vides sont des BOTS (3 octobre 2026 : « Bot 1,
  // Bot 2, Bot 3 [...] remplacés au fur et à mesure par tes vrais potes »),
  // numérotés après les vrais membres — même numérotation que le menu.
  const manquants = potesParDefaut().filter((d) => !choisis.some((m) => m.nom === d.nom))
    .map((d, k) => ({ nom: `bot ${choisis.length + k + 1}`, skin: d.skin }));
  selection = choisis.concat(manquants).slice(0, max);
}
// Le joueur a gardé l'appui : la dernière marque devient un saut tenu.
// Durée réelle de l'appui du joueur sur son dernier saut : le pote la lit
// pendant son propre saut (4 octobre 2026 — il tenait toujours au maximum,
// son saut était plus long que celui du joueur et il ratait le suivant).
export function majTenue(t) {
  for (let i = marques.length - 1; i >= 0; i--) { const m = marques[i]; if (m.type === "saut" || m.type === "haut") { m.tenue = Math.max(m.tenue || 0, t); return; } if (m.type === "double") return; }
}
export function marquerTenue() {
  for (let i = marques.length - 1; i >= 0; i--) { if (marques[i].type === "saut") { marques[i].type = "haut"; return; } if (marques[i].type === "double") return; }
}
function potesParDefaut() { return window.CONFIG.potesDefaut || (window.CONFIG.potesNoms || ["paul"]).map((n) => ({ nom: n, skin: null })); }
// Le peloton de la course : le tirage ci-dessus (membres de la ligue d'abord,
// complétés par les potes par défaut), sinon la ligue de démo.
function listeMembres() { return selection || potesParDefaut(); }
function listeNoms() { return listeMembres().map((m) => m.nom); }
// Prénom : le premier de la liste qui n'est pas déjà dans le peloton
// (Soberland revient en premier s'il est parti — plus de doublons).
function prochainNom() {
  const noms = listeNoms();
  const pris = new Set(alive().map((p) => p.name));
  return noms.find((n) => !pris.has(n)) || null;
}

export function join(player) {
  const vivants = alive();
  if (vivants.length >= max()) return null;
  const slot = vivants.length;
  const name = prochainNom();
  if (!name) return null;
  const idx = Math.max(0, listeNoms().indexOf(name));
  const membre = listeMembres()[idx];
  const base = PALETTES.potes[idx % PALETTES.potes.length];
  const palette = membre && membre.skin ? paletteDepuisSkin(membre.skin, base) : base;
  joins += 1;
  // Il arrive du champ, derrière, et rejoint sa place dans la meute.
  const v = vDuSlot(player.v, slot);
  const pote = {
    slot, palette, name,
    // Il arrive PAR LA ROUTE, de derrière (28 septembre 2026) : en arrivant
    // du champ du fond, il passait derrière les panneaux et les lampadaires
    // du bas-côté (« regarde les textures qui se passent devant »).
    u: U_MEUTE[slot % U_MEUTE.length], v: v - 4.5, prevV: v - 4.5, u0: U_MEUTE[slot % U_MEUTE.length], dv0: -4.5,
    arrive: 0, leave: null, pedal: Math.random() * 6, phase: Math.random() * 6,
    jumpY: 0, jumpVy: 0, doubled: false, flip: 0, lastMarkId: markId,
  };
  potes.push(pote);
  maxCount = Math.max(maxCount, vivants.length + 1);
  return pote;
}

export function lose(n) {
  const vivants = alive().sort((a, b) => b.slot - a.slot);
  const perdus = vivants.slice(0, n);
  for (const p of perdus) p.leave = { t: 0 };
  return perdus;
}

function sauter(p, m, sol, phys) {
  p.jumpVy = phys.vJump; p.jumpY = sol + 0.001; p.doubled = false;
  p.marqueSaut = m; p.tenueT = 0; // il tient l'appui exactement comme le joueur
}

let roueT = 0;
let solOmbre = () => 0; // plancher sous un pote (halles, collines) : pas d'ombre au sol quand il roule au-dessus
export function update(dt, player, phys) {
  if (phys && phys.sol) solOmbre = phys.sol;
  const vivants = alive().sort((a, b) => a.slot - b.slot);
  vivants.forEach((p, i) => { p.slot = i; });
  for (const p of potes) {
    p.prevV = p.v;
    p.prevJumpY = p.jumpY;
    if (p.leave) { p.leave.t += dt / LEAVE_S; continue; }
    p.phase += dt;
    p.age = (p.age || 0) + dt;
    const cibleU = U_MEUTE[p.slot % U_MEUTE.length] + Math.sin(p.phase * 0.9) * 0.08;
    const cibleV = vDuSlot(player.v, p.slot) + Math.sin(p.phase * 0.7 + p.slot) * 0.12;
    if (p.arrive < 1) {
      p.arrive = Math.min(1, p.arrive + dt / ARRIVAL_S);
      const e = 1 - Math.pow(1 - p.arrive, 3);
      p.u = p.u0 + (cibleU - p.u0) * e;
      p.v = cibleV + p.dv0 * (1 - e);
      // Il roule SUR la rampe pendant son arrivée aussi (30 septembre 2026 :
      // un pote arrivé dans les halles roulait sous le plancher, puis sautait
      // d'un coup dessus).
      const solA = phys.sol ? phys.sol(p.v) : 0;
      p.jumpY = solA; p.jumpVy = 0; p.auSol = true;
      continue;
    }
    p.u += (cibleU - p.u) * Math.min(1, 4 * dt);
    p.v = cibleV;
    // Le sol sous lui : la route, la halle, ou le toit d'une voiture s'il est
    // déjà au-dessus (il roule sur les toits comme le joueur).
    const sol = phys.solSous ? phys.solSous(p.v, Math.max(p.jumpY, p.prevJumpY)) : phys.sol ? phys.sol(p.v) : 0;
    // JETPACK (5 octobre 2026) : la meute suit EXACTEMENT la trajectoire du
    // joueur dans les airs — même hauteur au même endroit de la route, comme
    // une file indienne d'avions. Rien de ce qu'il a survolé ne la touche.
    const ht = phys.trace ? phys.trace(p.v) : null;
    if (ht !== null) {
      p.jumpY = Math.max(sol, ht); p.jumpVy = 0; p.doubled = false; p.flip = 0; p.marqueSaut = null; p.enAttente = null;
      for (const m of marques) if (m.v <= p.v && m.id > p.lastMarkId) p.lastMarkId = m.id;
      p.jetpack = ht > sol + 0.05 || p.jetpack && p.jumpY > sol + 0.05;
      p.auSol = p.jumpY <= sol + 0.001;
      continue;
    }
    p.jetpack = false;
    // Un saut arrivé pendant qu'il était encore en l'air part dès qu'il touche
    // le sol (0,3 s au plus) : sinon il sautait le saut, puis faisait le
    // double saut suivant depuis trop bas et retombait AVANT la voiture.
    if (p.enAttente) {
      p.enAttente.t -= dt;
      if (p.jumpY <= sol + 0.02) { sauter(p, p.enAttente.m, sol, phys); p.enAttente = null; }
      else if (p.enAttente.t <= 0) p.enAttente = null;
    }
    // Sauts, sauts tenus et doubles sauts, aux marques du joueur, DANS L'ORDRE.
    for (const m of marques) {
      if (p.enAttente) break;
      if (m.id <= p.lastMarkId) continue;
      const c = m.ref && phys.centreRef ? phys.centreRef(m.ref.r) : null;
      const pret = c !== null ? c - p.v <= m.ref.d : m.v <= p.v;
      if (!pret) break;
      p.lastMarkId = m.id;
      if (m.type === "saut" || m.type === "haut") {
        if (p.jumpY <= sol + 0.02) sauter(p, m, sol, phys);
        else p.enAttente = { m, t: 0.3 };
      } else if (m.type === "double" && p.jumpY > sol && !p.doubled) {
        p.jumpVy = phys.vDouble; p.doubled = true; p.flip = 0.001; p.marqueSaut = null; // plus d'appui après le double, comme le joueur
      }
    }
    if (p.jumpY > sol) {
      const tenu = p.marqueSaut && p.jumpVy > 0 && p.tenueT < Math.min(phys.tenueMax, p.marqueSaut.tenue || 0);
      if (tenu) p.tenueT += dt;
      p.jumpVy -= (tenu ? phys.gTenu : phys.g) * dt;
      p.jumpY += p.jumpVy * dt;
      if (phys.plafond) { const pl = phys.plafond(p.v); if (p.jumpY > pl) { p.jumpY = pl; if (p.jumpVy > 0) p.jumpVy = 0; } }
    }
    // Comme le joueur, le pote colle au plancher de la halle (rows.solAt).
    // Collage à la descente, comme le joueur (main.js).
    if (p.auSol && p.jumpVy <= 0 && p.jumpY > sol && p.jumpY - sol < 0.35) p.jumpY = sol;
    if (p.jumpY <= sol) { p.jumpY = sol; p.jumpVy = 0; p.doubled = false; p.flip = 0; p.marqueSaut = null; }
    p.auSol = p.jumpY <= sol + 0.001;
    if (p.flip > 0) p.flip = Math.min(Math.PI * 2, p.flip + dt * (Math.PI * 2 / 0.5));
    if (p.roue > 0) { p.roue += dt / 0.9; if (p.roue >= 1 || !p.auSol) p.roue = 0; }
  }
  // Toutes les ~15 s, un pote au hasard fait une roue arrière, pour rien
  // (30 septembre 2026 : « ça peut être trop bien »).
  roueT += dt;
  if (roueT >= 15) {
    roueT = 0;
    const libres = potes.filter((p) => !p.leave && p.arrive >= 1 && p.auSol && !(p.roue > 0));
    if (libres.length) libres[Math.floor(Math.random() * libres.length)].roue = 0.001;
  }
  potes = potes.filter((p) => !p.leave || p.leave.t < 1);
}

export function members() {
  return alive().filter((p) => p.arrive >= 1).map((p) => ({ id: `p${p.slot}`, u: p.u, v: p.v, prevV: p.prevV, jumpY: p.jumpY, pote: p }));
}

export function drawables(ctx, pedalPhase, penteAt = null) {
  const out = [];
  for (const p of potes) {
    let u = p.u, v = p.v, y = p.jumpY, alpha = 1;
    if (p.leave) {
      // Il décroche : il ralentit, part dans le champ du fond, s'efface.
      const t = p.leave.t;
      v -= t * t * 4.5;   // il se laisse distancer sur la route (plus de détour par le champ du fond)
      y += Math.sin(Math.min(1, t) * Math.PI) * 1.2;
      alpha = 1 - t;
    }
    out.push({
      u, v, draw: () => {
        // Incliné dans la pente de la halle, comme le joueur.
        drawRider(ctx, u, v, y, p.palette, pedalPhase + p.pedal, alpha, p.flip, solOmbre(v) < 0.05 && !p.jetpack, p.roue || 0, p.auSol && penteAt ? penteAt(v) : 0);
        if (p.jetpack) drawJetpack(ctx, u, v, y, p.jumpY > (p.prevJumpY || 0) - 0.01, performance.now() / 1000 + p.slot);
        // Le prénom s'affiche 3 s à l'arrivée du pote, puis s'efface : dans
        // une meute serrée, cinq étiquettes permanentes se marchaient dessus.
        const vu = p.arrive >= 1 ? Math.max(0, Math.min(1, (3.6 - p.age) / 0.6)) : 0;
        if (p.name && vu > 0 && !p.leave) {
          const g = project(u, v, y + RIDER_HEIGHT + 0.2);
          ctx.save();
          ctx.globalAlpha *= vu;
          // Pastille « LEA EST LÀ » au-dessus du pote qui arrive (3 octobre
          // 2026 : « un pop-up par-dessus le joueur [...] pendant 3 secondes,
          // de manière hyper simple ») — remplace le grand bandeau.
          const txt = `${p.name.toUpperCase()} EST LÀ`;
          ctx.font = `900 11px "Helvetica Neue", Helvetica, Arial, sans-serif`;
          const w = ctx.measureText(txt).width + 14, h = 19;
          // Toujours ENTIÈRE dans l'écran (4 octobre 2026 : « bot 5 est là,
          // on ne voit pas le tag en entier, il est coupé à gauche »).
          const x = Math.max(8 + w / 2, Math.min(largeurEcran - 8 - w / 2, g.x));
          ctx.fillStyle = "#ffcf2e"; ctx.strokeStyle = "#0d0d10"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.rect(Math.round(x - w / 2) + 0.5, Math.round(g.y - h - 4) + 0.5, Math.round(w), h); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#0d0d10"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(txt, x, g.y - 4 - h / 2 + 0.5);
          ctx.restore();
        }
      },
    });
  }
  return out;
}
