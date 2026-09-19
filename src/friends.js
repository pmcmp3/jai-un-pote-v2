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
import { drawRider, RIDER_HEIGHT } from "./voxrider.js";

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
let joins = 0;
let marques = []; // { v, type: "saut" | "salto" } — là où le joueur a sauté

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
export function recordPlayer(v, type) {
  if (type) marques.push({ v, type });
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
  const manquants = potesParDefaut().filter((d) => !choisis.some((m) => m.nom === d.nom));
  selection = choisis.concat(manquants).slice(0, max);
}
// Le joueur a gardé l'appui : la dernière marque devient un saut tenu.
export function marquerTenue() {
  for (let i = marques.length - 1; i >= 0; i--) { if (marques[i].type === "saut") { marques[i].type = "haut"; return; } if (marques[i].type === "double") return; }
}
export function enLigue() { return nomsLigue !== null; }
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
    u: 3.4, v: v - 2.2, prevV: v - 2.2, u0: 3.4, dv0: -2.2,
    arrive: 0, leave: null, pedal: Math.random() * 6, phase: Math.random() * 6,
    jumpY: 0, jumpVy: 0, doubled: false, flip: 0, lastMark: player.v,
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

export function update(dt, player, phys) {
  const vivants = alive().sort((a, b) => a.slot - b.slot);
  vivants.forEach((p, i) => { p.slot = i; });
  for (const p of potes) {
    p.prevV = p.v;
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
      continue;
    }
    p.u += (cibleU - p.u) * Math.min(1, 4 * dt);
    p.v = cibleV;
    // Sauts, sauts tenus et doubles sauts, aux marques du joueur.
    for (const m of marques) {
      if (m.v <= p.lastMark || m.v > p.v) continue;
      p.lastMark = m.v;
      if ((m.type === "saut" || m.type === "haut") && p.jumpY <= 0) {
        p.jumpVy = phys.vJump; p.jumpY = 0.001; p.doubled = false;
        p.tenue = m.type === "haut" ? phys.tenueMax : 0;   // il tient l'appui comme le joueur
      } else if (m.type === "double" && p.jumpY > 0 && !p.doubled) {
        p.jumpVy = phys.vDouble; p.doubled = true; p.flip = 0.001;
      }
    }
    if (p.jumpY > 0) {
      const tenu = p.tenue > 0 && p.jumpVy > 0;
      if (tenu) p.tenue -= dt;
      p.jumpVy -= (tenu ? phys.gTenu : phys.g) * dt;
      p.jumpY += p.jumpVy * dt;
      if (p.jumpY <= 0) { p.jumpY = 0; p.jumpVy = 0; p.doubled = false; p.flip = 0; p.tenue = 0; }
    }
    if (p.flip > 0) p.flip = Math.min(Math.PI * 2, p.flip + dt * (Math.PI * 2 / 0.5));
  }
  potes = potes.filter((p) => !p.leave || p.leave.t < 1);
}

export function members() {
  return alive().filter((p) => p.arrive >= 1).map((p) => ({ id: `p${p.slot}`, u: p.u, v: p.v, prevV: p.prevV, jumpY: p.jumpY, pote: p }));
}

export function drawables(ctx, pedalPhase) {
  const out = [];
  for (const p of potes) {
    let u = p.u, v = p.v, y = p.jumpY, alpha = 1;
    if (p.leave) {
      // Il décroche : il ralentit, part dans le champ du fond, s'efface.
      const t = p.leave.t;
      v -= t * t * 3.5;
      u += t * 2.2;
      y += Math.sin(Math.min(1, t) * Math.PI) * 1.2;
      alpha = 1 - t;
    }
    out.push({
      u, v, draw: () => {
        drawRider(ctx, u, v, y, p.palette, pedalPhase + p.pedal, alpha, p.flip);
        // Le prénom s'affiche 3 s à l'arrivée du pote, puis s'efface : dans
        // une meute serrée, cinq étiquettes permanentes se marchaient dessus.
        const vu = p.arrive >= 1 ? Math.max(0, Math.min(1, (3.6 - p.age) / 0.6)) : 0;
        if (p.name && vu > 0 && !p.leave) {
          const g = project(u, v, y + RIDER_HEIGHT + 0.2);
          ctx.save();
          ctx.globalAlpha *= vu;
          ctx.font = `700 10px "Helvetica Neue", Helvetica, Arial, sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineJoin = "round";
          ctx.strokeText(`@${p.name}`, g.x, g.y);
          ctx.fillStyle = "#fff";
          ctx.fillText(`@${p.name}`, g.x, g.y);
          ctx.restore();
        }
      },
    });
  }
  return out;
}
