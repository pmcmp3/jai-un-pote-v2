// bruitages.js — Le SOUND DESIGN (4 octobre 2026, nuit : « un bruitage de
// bicyclette dans le fond, en pas fort », « quand je prends une poule je veux
// un bruit de poule, un bruit de klaxon quand une voiture arrive [...] plus de
// sound design, à fond : à la gare je veux un klaxon de train, au bowling un
// bruit de quilles »).
//
// Tout est SYNTHÉTISÉ, comme sfx.js : oscillateurs, bruit filtré, formants.
// Zéro fichier à télécharger — le jeu s'ouvre dans le navigateur d'Instagram,
// chaque Mo compte — et rien à licencier. Chaque son est une fonction pure
// (contexte, sortie, instant, options) : le jeu les joue en direct (jouer),
// outils/bruitages.mjs les rend hors ligne pour mesurer leur niveau et
// dessiner leur spectrogramme.
//
// Les ANIMAUX sont des voix : une source à contour de hauteur passée dans
// des FORMANTS (passe-bandes en parallèle) — ce sont eux qui font « meuh »
// plutôt que « bêê ». Cloches, tôle, sonnette et quilles sont des PARTIELS
// (sinus qui décroissent chacun à leur vitesse). Klaxons : notes saturées
// dans le pavillon (passe-bande).
//
// NIVEAUX : un gain par son, calé par outils/bruitages.mjs sur le morceau
// (−9,9 LUFS intégré) — voir le tableau en bas. Le joueur règle le tout avec
// son curseur de volume (sortie audio.sfxOutput, comme sfx.js), config.js
// avec bruitagesVolume / ambianceVolume.

import * as audio from "./audio.js";

// --- Briques -------------------------------------------------------------------
const BRUITS = new WeakMap();
// 2 s de bruit blanc par contexte, déterministe (rendus hors ligne stables).
function bufferBruit(ctx) {
  let b = BRUITS.get(ctx);
  if (!b) {
    const n = Math.floor(ctx.sampleRate * 2);
    b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 1234567;
    for (let i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; d[i] = s / 0x40000000 - 1; }
    BRUITS.set(ctx, b);
  }
  return b;
}
export function rng(graine) {
  let s = (Math.floor(graine) >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function gain(ctx, v = 1) { const n = ctx.createGain(); n.gain.value = v; return n; }
function filtre(ctx, type, f, q = 0.707) { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; }
function osc(ctx, type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
export function sourceBruit(ctx, t0, duree, alea = Math.random) {
  const s = ctx.createBufferSource();
  s.buffer = bufferBruit(ctx);
  s.loop = true;
  s.start(t0, alea() * 1.8);
  if (duree !== undefined) s.stop(t0 + duree + 0.03);
  return s;
}
const COURBES = new Map();
function saturation(k) {
  let c = COURBES.get(k);
  if (!c) {
    c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    COURBES.set(k, c);
  }
  return c;
}
function sature(ctx, k) { const ws = ctx.createWaveShaper(); ws.curve = saturation(k); return ws; }
// Attaque linéaire, puis décroissance exponentielle de constante tau.
function percussion(param, t0, crete, attaque, tau) {
  param.setValueAtTime(0, t0);
  param.linearRampToValueAtTime(crete, t0 + attaque);
  param.setTargetAtTime(0, t0 + attaque, tau);
}
function contour(param, t0, pts) {
  param.setValueAtTime(pts[0][1], t0);
  for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], t0 + pts[i][0]);
}

// Une bouffée de bruit filtré (souffle, impact, crissement, plume).
function bouffee(ctx, out, t0, { type = "bandpass", f, q = 1, crete = 1, attaque = 0.003, tau = 0.03, alea }) {
  const n = sourceBruit(ctx, t0, attaque + tau * 7, alea), fl = filtre(ctx, type, f, q), g = gain(ctx, 0);
  percussion(g.gain, t0, crete, attaque, tau);
  n.connect(fl); fl.connect(g); g.connect(out);
}
// Un coup sourd : un sinus qui plonge (choc, roue qui retombe, boule).
function coupSourd(ctx, out, t0, { f0 = 110, f1 = 50, duree = 0.14, crete = 1 }) {
  const o = osc(ctx, "sine", f0), g = gain(ctx, 0);
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + duree);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(crete, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  o.connect(g); g.connect(out);
  o.start(t0); o.stop(t0 + duree + 0.02);
}
// Des partiels [fréquence, crête, tau] : cloche, tôle, sonnette, bois creux.
function partiels(ctx, out, t0, liste, attaque = 0.002) {
  for (const [f, a, tau] of liste) {
    const o = osc(ctx, "sine", f), g = gain(ctx, 0);
    percussion(g.gain, t0, a, attaque, tau);
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + attaque + tau * 7);
  }
}
// Un sifflement d'oiseau : sinus qui glisse de f0 à f1.
function sifflet(ctx, out, t0, f0, f1, duree, crete, fm = 0) {
  const o = osc(ctx, "sine", f0), g = gain(ctx, 0);
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + duree);
  if (fm) { const l = osc(ctx, "sine", 38), lg = gain(ctx, fm); l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + duree + 0.02); }
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(crete, t0 + Math.min(0.012, duree * 0.3));
  g.gain.setValueAtTime(crete, t0 + duree * 0.6);
  g.gain.linearRampToValueAtTime(0, t0 + duree);
  o.connect(g); g.connect(out);
  o.start(t0); o.stop(t0 + duree + 0.02);
}

// Une VOIX : source à contour de hauteur → formants → enveloppe.
//   hauteur  : [[t, Hz], …]          formants : [[Hz ou [[t, Hz], …], Q, gain], …]
//   rugosite / vibrato : { f, prof } (modulation de fréquence, Hz)
//   tremolo  : { f, prof } (modulation d'amplitude, 0..1)
//   grain    : saturation (0 = aucune) · souffle : bruit dans les formants
function voix(ctx, out, t0, p) {
  const { duree, volume = 1, type = "sawtooth", attaque = 0.01, relache = 0.06 } = p;
  const fin = t0 + duree;
  const o = osc(ctx, type, p.hauteur[0][1]);
  contour(o.frequency, t0, p.hauteur);
  const lfos = [];
  for (const m of [p.rugosite, p.vibrato]) {
    if (!m) continue;
    const l = osc(ctx, "sine", m.f), lg = gain(ctx, m.prof);
    l.connect(lg); lg.connect(o.frequency); lfos.push(l);
  }
  let src = o;
  if (p.grain) { const ws = sature(ctx, p.grain); o.connect(ws); src = ws; }
  const env = gain(ctx, 0);
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(volume, t0 + attaque);
  env.gain.setValueAtTime(volume, Math.max(t0 + attaque, fin - relache));
  env.gain.linearRampToValueAtTime(0, fin);
  let sortie = env;
  if (p.tremolo) {
    const tg = gain(ctx, 1 - p.tremolo.prof), l = osc(ctx, "sine", p.tremolo.f), lg = gain(ctx, p.tremolo.prof);
    l.connect(lg); lg.connect(tg.gain); env.connect(tg); sortie = tg; lfos.push(l);
  }
  sortie.connect(out);
  let souffle = null;
  if (p.souffle) { souffle = gain(ctx, p.souffle); sourceBruit(ctx, t0, duree, p.alea).connect(souffle); }
  for (const [f, q, gf] of p.formants) {
    const bp = filtre(ctx, "bandpass", Array.isArray(f) ? f[0][1] : f, q);
    if (Array.isArray(f)) contour(bp.frequency, t0, f);
    const fg = gain(ctx, gf);
    src.connect(bp);
    if (souffle) souffle.connect(bp);
    bp.connect(fg); fg.connect(env);
  }
  o.start(t0); o.stop(fin + 0.05);
  for (const l of lfos) { l.start(t0); l.stop(fin + 0.05); }
}

// Un KLAXON : notes saturées dans un pavillon (passe-bande) + le corps (grave).
function klaxon(ctx, out, t0, { notes, type = "square", segments, f = 1800, q = 1.2, grain = 2, bend = 0, attaque = 0.008, corps = 0.4, doppler = 1 }) {
  const fin = segments[segments.length - 1][1];
  const env = gain(ctx, 0);
  for (const [a, b] of segments) {
    env.gain.setValueAtTime(0, t0 + a);
    env.gain.linearRampToValueAtTime(1, t0 + a + attaque);
    env.gain.setValueAtTime(1, t0 + b - 0.015);
    env.gain.linearRampToValueAtTime(0, t0 + b);
  }
  const mix = gain(ctx, 1 / notes.length);
  for (const n of notes) {
    const o = osc(ctx, type, n * doppler);
    if (bend) { o.frequency.setValueAtTime(n * doppler * (1 + bend), t0); o.frequency.exponentialRampToValueAtTime(n * doppler, t0 + 0.08); }
    o.connect(mix); o.start(t0); o.stop(t0 + fin + 0.03);
  }
  const ws = sature(ctx, grain), bp = filtre(ctx, "bandpass", f, q), lp = filtre(ctx, "lowpass", 5200, 0.7);
  mix.connect(ws); ws.connect(bp); bp.connect(lp); lp.connect(env);
  if (corps) { const c = filtre(ctx, "lowpass", 900, 0.7), cg = gain(ctx, corps); ws.connect(c); c.connect(cg); cg.connect(env); }
  env.connect(out);
}
// Battements d'ailes : bouffées de plumes, de plus en plus faibles.
function ailes(ctx, out, t0, duree, freq, crete, alea) {
  const n = Math.round(duree * freq);
  for (let i = 0; i < n; i++) {
    const t = t0 + i / freq + (alea() - 0.5) * 0.012, k = 1 - 0.55 * i / n;
    bouffee(ctx, out, t, { f: 1300 + alea() * 1000, q: 0.9, crete: crete * (0.6 + 0.4 * alea()) * k, attaque: 0.006, tau: 0.018, alea });
    bouffee(ctx, out, t, { type: "lowpass", f: 380, crete: crete * 0.5 * k, attaque: 0.004, tau: 0.02, alea });
  }
}

// --- Les sons ------------------------------------------------------------------
// (ctx, out, t0, o) — o.alea : tirage pseudo-aléatoire (variété d'une fois à
// l'autre, rendu hors ligne reproductible).
const SONS = {};

// ===== La ferme =====
// Poule percutée : « KRAAAK ! bok-bok », et ça bat des ailes.
SONS.poule = (ctx, out, t0, o) => {
  const k = 0.94 + o.alea() * 0.12;
  voix(ctx, out, t0, { hauteur: [[0, 640 * k], [0.05, 1020 * k], [0.18, 900 * k], [0.3, 720 * k]], duree: 0.32, attaque: 0.012, relache: 0.09,
    formants: [[1150, 5, 1], [2500, 6, 0.8], [3700, 7, 0.35]], rugosite: { f: 62, prof: 70 }, grain: 3, souffle: 0.3, alea: o.alea });
  voix(ctx, out, t0 + 0.4, { hauteur: [[0, 560 * k], [0.07, 440 * k]], duree: 0.08, attaque: 0.006, relache: 0.04,
    formants: [[950, 4, 1], [2200, 5, 0.6]], rugosite: { f: 50, prof: 30 }, grain: 2, volume: 0.75 });
  voix(ctx, out, t0 + 0.55, { hauteur: [[0, 520 * k], [0.07, 410 * k]], duree: 0.08, attaque: 0.006, relache: 0.04,
    formants: [[950, 4, 1], [2200, 5, 0.6]], rugosite: { f: 50, prof: 30 }, grain: 2, volume: 0.6 });
  ailes(ctx, out, t0 + 0.02, 0.6, 13, 0.55, o.alea);
};
// Poule qui glousse en nous voyant arriver : « bok… bok-bok ».
SONS.glousse = (ctx, out, t0, o) => {
  const k = 0.92 + o.alea() * 0.16;
  [[0, 520], [0.17, 500], [0.27, 560]].forEach(([dt, f], i) => voix(ctx, out, t0 + dt, { hauteur: [[0, f * k], [0.07, f * k * 0.8]], duree: 0.075, attaque: 0.006, relache: 0.035,
    formants: [[950, 4, 1], [2100, 5, 0.5]], rugosite: { f: 45, prof: 25 }, grain: 1.5, volume: i === 2 ? 1 : 0.8 }));
};
// Vache : « MEUUUH » (fachee : plus aigu, plus court — on lui est rentré dedans).
function meuh(ctx, out, t0, o, fache) {
  const k = (fache ? 1.25 : 1) * (0.94 + o.alea() * 0.12), d = fache ? 0.75 : 1.15;
  voix(ctx, out, t0, { hauteur: [[0, 98 * k], [0.22 * d, 128 * k], [0.7 * d, 120 * k], [d, 92 * k]], duree: d, attaque: 0.1, relache: 0.22,
    formants: [[[[0, 300], [0.25 * d, 720], [0.75 * d, 620], [d, 320]], 2.2, 1], [[[0, 900], [0.25 * d, 1180], [d, 820]], 4, 0.45], [2500, 6, 0.08]],
    vibrato: { f: 5.5, prof: 2.5 }, souffle: 0.12, grain: 1.5, alea: o.alea });
}
SONS.meuh = (ctx, out, t0, o) => meuh(ctx, out, t0, o, false);
SONS.vache = (ctx, out, t0, o) => meuh(ctx, out, t0, o, true);
// Mouton : « BÊÊÊÊ », chevrotant.
function bee(ctx, out, t0, o, fache) {
  const k = (fache ? 1.2 : 1) * (0.93 + o.alea() * 0.14), d = fache ? 0.6 : 0.8;
  voix(ctx, out, t0, { hauteur: [[0, 300 * k], [0.1, 310 * k], [d, 255 * k]], duree: d, attaque: 0.03, relache: 0.15,
    formants: [[[[0, 300], [0.05, 650], [d, 600]], 3, 1], [1850, 5, 0.6], [2700, 6, 0.25]],
    vibrato: { f: 7.2, prof: 22 }, tremolo: { f: 7.2, prof: 0.55 }, souffle: 0.2, grain: 1.2, alea: o.alea });
}
SONS.bee = (ctx, out, t0, o) => bee(ctx, out, t0, o, false);
SONS.mouton = (ctx, out, t0, o) => bee(ctx, out, t0, o, true);
// Cochon : « groin-groin » quand il nous voit, « COUIIIC » quand on le percute.
SONS.groin = (ctx, out, t0, o) => {
  for (const dt of [0, 0.22]) voix(ctx, out, t0 + dt, { type: "square", hauteur: [[0, 95], [0.15, 78]], duree: 0.17, attaque: 0.01, relache: 0.06,
    formants: [[420, 2, 1], [1100, 4, 0.4]], tremolo: { f: 26, prof: 0.6 }, grain: 2, souffle: 0.4, alea: o.alea });
};
SONS.cochon = (ctx, out, t0, o) => {
  const k = 0.95 + o.alea() * 0.1;
  voix(ctx, out, t0, { hauteur: [[0, 750 * k], [0.1, 1350 * k], [0.32, 1150 * k], [0.45, 880 * k]], duree: 0.46, attaque: 0.015, relache: 0.1,
    formants: [[1500, 3, 1], [3000, 4, 0.5]], rugosite: { f: 70, prof: 120 }, grain: 3, souffle: 0.2, alea: o.alea });
};
// Chien : « OUAF OUAF » de loin, « kaï kaï kaï » percuté.
SONS.ouaf = (ctx, out, t0, o) => {
  for (const dt of [0, 0.22]) voix(ctx, out, t0 + dt, { hauteur: [[0, 420], [0.04, 520], [0.13, 330]], duree: 0.14, attaque: 0.004, relache: 0.05,
    formants: [[650, 2.5, 1], [1500, 3.5, 0.6], [2800, 5, 0.2]], grain: 4, souffle: 0.5, alea: o.alea });
};
SONS.chien = (ctx, out, t0, o) => {
  [0, 0.12, 0.26].forEach((dt, i) => voix(ctx, out, t0 + dt, { hauteur: [[0, 1250 - i * 60], [0.07, 900 - i * 60]], duree: 0.09, attaque: 0.004, relache: 0.04,
    formants: [[1300, 3, 1], [2600, 4, 0.5]], grain: 2, souffle: 0.15, alea: o.alea, volume: 1 - i * 0.15 }));
};
// Chat : « miaou », puis « MRAOU-hhhh » quand on lui roule dessus.
function miaou(ctx, out, t0, o, fache) {
  const k = fache ? 1.3 : 1, d = fache ? 0.42 : 0.55;
  voix(ctx, out, t0, { hauteur: [[0, 520 * k], [0.27 * d, 760 * k], [0.76 * d, 600 * k], [d, 480 * k]], duree: d, attaque: 0.02, relache: 0.12,
    formants: [[[[0, 500], [0.22 * d, 950], [0.73 * d, 700], [d, 420]], 3, 1], [[[0, 2600], [0.22 * d, 1600], [0.73 * d, 1100], [d, 900]], 5, 0.6], [3300, 7, 0.2]],
    vibrato: { f: 6, prof: 8 }, grain: fache ? 3 : 1.5, souffle: 0.1, alea: o.alea });
  if (fache) bouffee(ctx, out, t0 + d - 0.05, { type: "highpass", f: 2500, q: 0.7, crete: 0.35, attaque: 0.03, tau: 0.12, alea: o.alea });
}
SONS.miaou = (ctx, out, t0, o) => miaou(ctx, out, t0, o, false);
SONS.chat = (ctx, out, t0, o) => miaou(ctx, out, t0, o, true);
// Botte de foin : « pouf », et la paille qui crépite.
SONS.botte = (ctx, out, t0, o) => {
  coupSourd(ctx, out, t0, { f0: 85, f1: 45, duree: 0.16, crete: 0.9 });
  bouffee(ctx, out, t0, { type: "lowpass", f: 1400, crete: 0.7, attaque: 0.004, tau: 0.05, alea: o.alea });
  for (let i = 0; i < 14; i++) bouffee(ctx, out, t0 + 0.02 + o.alea() * 0.3, { type: "highpass", f: 3000, crete: 0.12 + o.alea() * 0.15, attaque: 0.001, tau: 0.004, alea: o.alea });
};

// ===== Les gens =====
// « Ouf ! » (un souffle voisé) et le choc du corps ; la voix suit la personne.
SONS.ouf = (ctx, out, t0, o) => {
  const f0 = (o.femme ? 230 : 135) * (0.93 + o.alea() * 0.14);
  voix(ctx, out, t0, { hauteur: [[0, f0 * 1.15], [0.05, f0 * 1.25], [0.2, f0 * 0.85]], duree: 0.22, attaque: 0.008, relache: 0.08,
    formants: [[380, 4, 1], [900, 5, 0.5], [2400, 6, 0.12]], souffle: 0.35, grain: 1.5, alea: o.alea });
  coupSourd(ctx, out, t0, { f0: 110, f1: 55, duree: 0.12, crete: 0.7 });
};
// Le costard : en plus, la mallette qui claque et les feuilles qui volent.
SONS.costard = (ctx, out, t0, o) => {
  SONS.ouf(ctx, out, t0, o);
  partiels(ctx, out, t0 + 0.12, [[1900, 0.25, 0.012], [3100, 0.12, 0.008]], 0.0005);
  for (let i = 0; i < 10; i++) bouffee(ctx, out, t0 + 0.15 + o.alea() * 0.45, { f: 3500 + o.alea() * 2500, q: 1.2, crete: 0.1 + o.alea() * 0.1, attaque: 0.01, tau: 0.02, alea: o.alea });
};
// Le skieur : en plus, les skis et les bâtons qui s'entrechoquent dans la neige.
SONS.skieur = (ctx, out, t0, o) => {
  SONS.ouf(ctx, out, t0, o);
  for (const dt of [0.05, 0.11, 0.2]) { bouffee(ctx, out, t0 + dt, { f: 1100, q: 4, crete: 0.5, attaque: 0.001, tau: 0.012, alea: o.alea }); partiels(ctx, out, t0 + dt, [[1150, 0.15, 0.02]], 0.0005); }
  bouffee(ctx, out, t0 + 0.02, { f: 2400, q: 0.8, crete: 0.3, attaque: 0.01, tau: 0.1, alea: o.alea });
};
// Le bonhomme de neige : « pouf », il s'effondre en crissant.
SONS.bonhomme = (ctx, out, t0, o) => {
  coupSourd(ctx, out, t0, { f0: 70, f1: 40, duree: 0.2, crete: 0.8 });
  bouffee(ctx, out, t0, { f: 900, q: 0.7, crete: 0.8, attaque: 0.005, tau: 0.09, alea: o.alea });
  for (let i = 0; i < 12; i++) bouffee(ctx, out, t0 + 0.01 + o.alea() * 0.25, { f: 2000 + o.alea() * 1400, q: 1, crete: 0.25 + o.alea() * 0.2, attaque: 0.002, tau: 0.01, alea: o.alea });
};

// ===== Les véhicules =====
// Leurs klaxons, à l'arrivée (« un bruit de klaxon quand une voiture arrive ») :
// chacun le sien. doppler > 1 : il fonce vers nous.
const KLAXONS = {
  // La voiture : « tut-tuuut », double ton européen.
  contresens: { notes: [415, 523], segments: [[0, 0.11], [0.17, 0.5]], f: 1700, q: 1.1, grain: 2.2, corps: 0.5 },
  voiture: { notes: [415, 523], segments: [[0, 0.11], [0.17, 0.5]], f: 1700, q: 1.1, grain: 2.2, corps: 0.5 },
  // Le car scolaire : grave, long, le ton qui s'installe.
  bus: { notes: [233, 294], type: "sawtooth", segments: [[0, 0.62]], f: 900, q: 0.9, grain: 2, bend: -0.04, attaque: 0.03, corps: 0.7 },
  // Le tracteur : « pouet-pouet » nasillard.
  tracteur: { notes: [349], segments: [[0, 0.13], [0.2, 0.34]], f: 1250, q: 3, grain: 3, corps: 0.3 },
  // Le chasse-neige : la corne de camion.
  chasseneige: { notes: [165, 208, 247], type: "sawtooth", segments: [[0, 0.85]], f: 700, q: 0.8, grain: 1.8, bend: -0.05, attaque: 0.05, corps: 0.8 },
  // Le buggy : « bip-bip ! ».
  buggy: { notes: [740], segments: [[0, 0.08], [0.13, 0.21]], f: 2200, q: 1.5, grain: 1.5, corps: 0.3 },
};
for (const [kind, k] of Object.entries(KLAXONS)) SONS[`klaxon_${kind}`] = (ctx, out, t0, o) => klaxon(ctx, out, t0, { ...k, doppler: o.doppler || 1 });
// Choc contre un véhicule : le coup, la tôle, le verre, et le klaxon qui
// s'étrangle. `gros` : tracteur, car, chasse-neige.
SONS.carambolage = (ctx, out, t0, o) => {
  const k = o.gros ? 0.7 : 1, a = o.alea;
  coupSourd(ctx, out, t0, { f0: 85 * k, f1: 36 * k, duree: 0.32, crete: 1 });
  bouffee(ctx, out, t0, { type: "lowpass", f: 2400, crete: 0.8, tau: 0.06, alea: a });
  partiels(ctx, out, t0 + 0.005, [[370 * k, 0.3, 0.12], [912 * k, 0.22, 0.09], [1495 * k, 0.16, 0.07], [2210 * k, 0.12, 0.05], [3130 * k, 0.08, 0.04]]);
  if (!o.gros) for (let i = 0; i < 6; i++) partiels(ctx, out, t0 + 0.04 + a() * 0.3, [[2800 + a() * 3600, 0.05 + a() * 0.05, 0.04]], 0.0005);
  klaxon(ctx, out, t0 + 0.06, { ...KLAXONS[o.gros ? "bus" : "contresens"], segments: [[0, 0.14]], doppler: 0.96 });
};

// ===== Le vélo =====
// La sonnette, pour les piétons qui arrivent (« dring-dring »).
SONS.sonnette = (ctx, out, t0) => {
  for (const dt of [0, 0.05, 0.1, 0.32, 0.37, 0.42]) partiels(ctx, out, t0 + dt, [[2650, 0.5, 0.22], [3950, 0.3, 0.16], [5350, 0.18, 0.1], [7100, 0.08, 0.07]], 0.001);
};
// L'atterrissage : le pneu qui écrase, la chaîne qui claque — et ce sur quoi
// on retombe (neige, sable, planches, toit de voiture).
SONS.atterrissage = (ctx, out, t0, o) => {
  const f = Math.max(0.25, Math.min(1, (o.force || 6) / 10)), a = o.alea;
  coupSourd(ctx, out, t0, { f0: 120, f1: 55, duree: 0.1, crete: 0.6 + 0.4 * f });
  bouffee(ctx, out, t0, { type: "lowpass", f: 600, crete: 0.15 + 0.4 * f, tau: 0.03, alea: a });
  for (let i = 0; i < 3; i++) partiels(ctx, out, t0 + 0.01 + i * 0.018 * (1 + a()), [[3200 + a() * 2400, 0.1 * f, 0.012]], 0.0005);
  if (o.surface === "neige") for (let i = 0; i < 6; i++) bouffee(ctx, out, t0 + a() * 0.08, { f: 1800 + a() * 1400, q: 1, crete: 0.3 * f, attaque: 0.002, tau: 0.008, alea: a });
  else if (o.surface === "sable") bouffee(ctx, out, t0, { type: "lowpass", f: 1200, crete: 0.5 * f, attaque: 0.006, tau: 0.08, alea: a });
  else if (o.surface === "bois" || o.surface === "piste") { partiels(ctx, out, t0, [[180, 0.4 * f, 0.06], [420, 0.2 * f, 0.04]]); bouffee(ctx, out, t0, { f: 800, q: 3, crete: 0.5 * f, tau: 0.02, alea: a }); }
  else if (o.surface === "toit") partiels(ctx, out, t0, [[176, 0.5 * f, 0.25], [412, 0.35 * f, 0.18], [688, 0.25 * f, 0.12], [1050, 0.15 * f, 0.08]]);
};

// ===== La gare =====
// Le TER : « pouêêt — pouêêêêt », deux tons d'avertisseur, qui s'installent
// comme une corne à air.
SONS.train = (ctx, out, t0, o) => {
  const d = o.doppler || 1;
  klaxon(ctx, out, t0, { notes: [554, 556, 277], type: "sawtooth", segments: [[0, 0.45]], f: 1100, q: 0.7, grain: 1.6, bend: -0.03, attaque: 0.05, corps: 0.6, doppler: d });
  klaxon(ctx, out, t0 + 0.55, { notes: [440, 442, 220], type: "sawtooth", segments: [[0, 1.1]], f: 950, q: 0.7, grain: 1.6, bend: -0.03, attaque: 0.06, corps: 0.6, doppler: d * 0.985 });
};
// « Ta-dam » : deux essieux sur un joint de rail.
SONS.rail = (ctx, out, t0, o) => {
  for (const dt of [0, o.ecart || 0.085]) {
    coupSourd(ctx, out, t0 + dt, { f0: 140, f1: 70, duree: 0.09, crete: 0.8 });
    bouffee(ctx, out, t0 + dt, { f: 420, q: 1.2, crete: 0.5, tau: 0.025, alea: o.alea });
    bouffee(ctx, out, t0 + dt, { f: 2600, q: 2, crete: 0.12, tau: 0.012, alea: o.alea });
  }
};
// Les freins qui relâchent l'air, à l'arrêt.
SONS.pschit = (ctx, out, t0, o) => {
  const n = sourceBruit(ctx, t0, 1.6, o.alea), hp = filtre(ctx, "highpass", 1500, 0.7), bp = filtre(ctx, "bandpass", 4200, 0.6), g = gain(ctx, 0);
  contour(g.gain, t0, [[0, 0], [0.03, 1], [0.5, 0.75], [1.5, 0]]);
  n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out);
};
// Le carillon des annonces (deux notes, rien de plus).
SONS.carillon = (ctx, out, t0) => {
  for (const [dt, f] of [[0, 880], [0.42, 698.5]]) partiels(ctx, out, t0 + dt, [[f, 0.7, 0.5], [f * 2, 0.15, 0.25], [f * 3, 0.06, 0.15]], 0.004);
};

// ===== Le bowling =====
// La boule qui percute, puis les quilles : des « toc » de bois creux qui
// s'entrechoquent, serrés d'abord, puis qui retombent.
SONS.quilles = (ctx, out, t0, o) => {
  const a = o.alea;
  coupSourd(ctx, out, t0, { f0: 95, f1: 55, duree: 0.16, crete: 0.9 });
  bouffee(ctx, out, t0, { type: "lowpass", f: 900, crete: 0.6, tau: 0.04, alea: a });
  const n = 9 + Math.floor(a() * 4);
  for (let i = 0; i < n; i++) {
    const t = t0 + 0.004 + (i < 5 ? i * 0.011 : 0.05 + Math.min(0.45, -0.11 * Math.log(1 - a() * 0.98)));
    const f = 900 + a() * 1900, cr = (i < 5 ? 0.9 : 0.55) * (0.5 + 0.5 * a());
    bouffee(ctx, out, t, { f, q: 7, crete: cr * 1.6, attaque: 0.001, tau: 0.03, alea: a });
    partiels(ctx, out, t, [[f, cr * 0.25, 0.035], [f * 2.7, cr * 0.08, 0.02]], 0.001);
  }
};

// ===== Les ambiances =====
// Oiseaux du jour : mésange (« ti-tu ti-tu »), moineau (« tchip »), merle.
SONS.oiseau = (ctx, out, t0, o) => {
  const a = o.alea, espece = Math.floor(a() * 3);
  if (espece === 0) {
    for (let i = 0; i < 3; i++) { sifflet(ctx, out, t0 + i * 0.22, 4300, 4100, 0.07, 1); sifflet(ctx, out, t0 + i * 0.22 + 0.09, 3300, 3200, 0.08, 0.8); }
  } else if (espece === 1) {
    let t = t0;
    const n = 2 + Math.floor(a() * 3);
    for (let i = 0; i < n; i++) { sifflet(ctx, out, t, 3600 + a() * 900, 2900, 0.05, 0.9, 180); t += 0.12 + a() * 0.08; }
  } else {
    let t = t0;
    const n = 3 + Math.floor(a() * 3);
    for (let i = 0; i < n; i++) { const f0 = 1700 + a() * 1100, d = 0.08 + a() * 0.12; sifflet(ctx, out, t, f0, f0 * (0.85 + a() * 0.4), d, 0.9); t += d + 0.04 + a() * 0.08; }
  }
};
// Grillon (la nuit) : des paquets de trois impulsions, une seule source.
SONS.grillon = (ctx, out, t0, o) => {
  const f = 4300 + o.alea() * 700, s = osc(ctx, "sine", f), g = gain(ctx, 0);
  for (let k = 0; k < 6; k++) for (let i = 0; i < 3; i++) {
    const t = t0 + k * 0.34 + i * 0.026;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.003); g.gain.linearRampToValueAtTime(0, t + 0.016);
  }
  s.connect(g); g.connect(out);
  s.start(t0); s.stop(t0 + 2.1);
};
// Chouette : « hou… hou-hou ».
SONS.chouette = (ctx, out, t0) => {
  const lp = filtre(ctx, "lowpass", 1000, 0.7);
  lp.connect(out);
  for (const [dt, f, d] of [[0, 420, 0.42], [0.75, 395, 0.2], [1.0, 400, 0.38]]) {
    const s = osc(ctx, "sine", f), g = gain(ctx, 0);
    s.frequency.setValueAtTime(f, t0 + dt); s.frequency.linearRampToValueAtTime(f * 0.94, t0 + dt + d);
    g.gain.setValueAtTime(0, t0 + dt); g.gain.linearRampToValueAtTime(1, t0 + dt + 0.06); g.gain.setValueAtTime(1, t0 + dt + d * 0.6); g.gain.linearRampToValueAtTime(0, t0 + dt + d);
    s.connect(g); g.connect(lp);
    s.start(t0 + dt); s.stop(t0 + dt + d + 0.02);
  }
};
// Mouettes : « kiaou kiaou ».
SONS.mouette = (ctx, out, t0, o) => {
  const a = o.alea, k = 0.9 + a() * 0.2;
  let t = t0;
  const n = 2 + Math.floor(a() * 3);
  for (let i = 0; i < n; i++) {
    voix(ctx, out, t, { hauteur: [[0, 1250 * k], [0.06, 2150 * k], [0.18, 1700 * k], [0.27, 1350 * k]], duree: 0.28, attaque: 0.01, relache: 0.1,
      formants: [[2100, 3, 1], [3300, 5, 0.4], [1200, 3, 0.3]], rugosite: { f: 90, prof: 60 }, grain: 2.5, souffle: 0.15, alea: a, volume: 1 - i * 0.12 });
    t += 0.3 + a() * 0.12;
  }
};
// La cloche du village : trois coups qui résonnent.
SONS.cloche = (ctx, out, t0, o) => {
  const lp = filtre(ctx, "lowpass", 2600, 0.7);
  lp.connect(out);
  const f = 196;
  for (let i = 0; i < (o.coups || 3); i++) {
    const t = t0 + i * 1.7;
    partiels(ctx, lp, t, [[f * 0.5, 0.5, 1.6], [f, 0.8, 1.1], [f * 1.19, 0.6, 0.8], [f * 1.5, 0.35, 0.6], [f * 2, 0.55, 0.55], [f * 2.52, 0.22, 0.35], [f * 3.01, 0.15, 0.25]]);
    bouffee(ctx, lp, t, { type: "highpass", f: 1800, crete: 0.25, attaque: 0.001, tau: 0.01, alea: o.alea });
  }
};

// --- Les GRAINS : sons très courts joués en rafale ---------------------------------
// La roue libre (« tic-tic-tic » quand on est en l'air), la neige qui crisse
// sous le pneu, les lattes de bois des rampes. Un petit buffer calculé une
// fois par contexte : une rafale de 24 grains par seconde ne coûte qu'un nœud
// par grain.
const GRAINS = new WeakMap();
export function grain(ctx, nom) {
  let m = GRAINS.get(ctx);
  if (!m) { m = {}; GRAINS.set(ctx, m); }
  if (m[nom]) return m[nom];
  const sr = ctx.sampleRate, n = Math.round(sr * ({ tic: 0.008, neige: 0.03, latte: 0.05 }[nom] || 0.02));
  const b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  let s = 987654;
  const r = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x40000000 - 1; };
  if (nom === "tic") for (let i = 0; i < n; i++) { const t = i / sr; d[i] = 0.6 * Math.sin(2 * Math.PI * 5200 * t) * Math.exp(-t / 0.0012) + 0.5 * r() * Math.exp(-t / 0.0006); }
  else if (nom === "latte") for (let i = 0; i < n; i++) { const t = i / sr; d[i] = 0.7 * Math.sin(2 * Math.PI * 620 * t) * Math.exp(-t / 0.009) + 0.35 * Math.sin(2 * Math.PI * 1480 * t) * Math.exp(-t / 0.005) + 0.3 * r() * Math.exp(-t / 0.0015); }
  else {
    // Neige : bruit dans un résonateur passe-bande (RBJ) vers 2,4 kHz.
    const w = 2 * Math.PI * 2400 / sr, al = Math.sin(w) / 2.4, a0 = 1 + al;
    const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, x = r() * Math.exp(-t / 0.006) * Math.min(1, t / 0.002);
      const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y;
    }
  }
  let crete = 0;
  for (let i = 0; i < n; i++) crete = Math.max(crete, Math.abs(d[i]));
  for (let i = 0; i < n; i++) d[i] *= 0.9 / (crete || 1);
  m[nom] = b;
  return b;
}
export function jouerGrain(ctx, out, nom, t, vitesse = 1) {
  const s = ctx.createBufferSource();
  s.buffer = grain(ctx, nom);
  s.playbackRate.value = vitesse;
  s.connect(out);
  s.start(t);
}

// --- Les COUCHES continues : ambiance.js les règle à chaque image ----------------
//   roulement : le pneu sur la chaussée     vent : l'air de la vitesse
//   blizzard  : le vent de la montagne      vagues : la mer (enveloppe par vague)
//   jet       : le jetpack                  grondement / freins : le TER
//   boules    : les boules qui roulent au bowling
export function couche(ctx, out, nom) {
  const t = ctx.currentTime, src = sourceBruit(ctx, t), g = gain(ctx, 0), osc2 = [];
  const c = { gain: g.gain, stop(tt) { for (const o of [src, ...osc2]) try { o.stop(tt); } catch (e) { /* déjà arrêté */ } } };
  if (nom === "roulement") {
    const bp = filtre(ctx, "bandpass", 380, 0.6), lp = filtre(ctx, "lowpass", 1400, 0.7);
    src.connect(bp); bp.connect(lp); lp.connect(g);
    c.f = bp.frequency; c.q = bp.Q; c.lp = lp.frequency;
  } else if (nom === "vent") {
    const bp = filtre(ctx, "bandpass", 700, 0.5);
    src.connect(bp); bp.connect(g); c.f = bp.frequency;
  } else if (nom === "blizzard") {
    const bp = filtre(ctx, "bandpass", 600, 3.5), bp2 = filtre(ctx, "bandpass", 1300, 2), g2 = gain(ctx, 0.35);
    src.connect(bp); bp.connect(g); src.connect(bp2); bp2.connect(g2); g2.connect(g);
    c.f = bp.frequency; c.f2 = bp2.frequency;
  } else if (nom === "vagues") {
    const hp = filtre(ctx, "highpass", 90, 0.7), lp = filtre(ctx, "lowpass", 600, 0.5), env = gain(ctx, 0.2);
    src.connect(hp); hp.connect(lp); lp.connect(env); env.connect(g);
    c.lp = lp.frequency; c.env = env.gain;
  } else if (nom === "jet") {
    const lp = filtre(ctx, "lowpass", 900, 0.7), bp = filtre(ctx, "bandpass", 230, 1.2), bg = gain(ctx, 1.5);
    src.connect(lp); lp.connect(g); src.connect(bp); bp.connect(bg); bg.connect(g);
    c.lp = lp.frequency;
  } else if (nom === "grondement") {
    const lp = filtre(ctx, "lowpass", 220, 0.9);
    src.connect(lp); lp.connect(g); c.f = lp.frequency;
  } else if (nom === "freins") {
    // Le crissement des freins : deux sifflements qui battent + un souffle aigu.
    const bp = filtre(ctx, "bandpass", 3300, 8), bg = gain(ctx, 0.6), mix = gain(ctx, 0.5);
    src.connect(bp); bp.connect(bg); bg.connect(g);
    for (const f of [3150, 3420]) { const o = osc(ctx, "sine", f); o.connect(mix); o.start(t); osc2.push(o); }
    mix.connect(g);
  } else if (nom === "boules") {
    const lp = filtre(ctx, "lowpass", 160, 0.8);
    src.connect(lp); lp.connect(g);
  }
  g.connect(out);
  return c;
}

// Les MOTEURS de ce qui arrive en face : une note de moteur (passe-bas),
// modulée au rythme des cylindres, + un bruit (diesel, lame, skis). doppler
// > 1 tant qu'il fonce vers nous, < 1 une fois passé.
const MOTEURS = {
  contresens: { f: 46, lp: 520, am: 23, prof: 0.25 },
  bus: { f: 36, lp: 420, am: 18, prof: 0.4, bruit: { f: 1400, q: 1.5, g: 0.25 } },
  // Le tracteur : « pof-pof-pof », un gros mono-cylindre.
  tracteur: { f: 11, lp: 380, am: 11, prof: 0.7, bruit: { f: 520, q: 1.2, g: 0.5 } },
  // Le chasse-neige : un gros diesel, et la lame qui racle.
  chasseneige: { f: 30, lp: 380, am: 15, prof: 0.3, bruit: { f: 1000, q: 0.8, g: 0.45 } },
  // Le buggy : un petit deux-temps qui bourdonne.
  buggy: { f: 72, lp: 1200, bp: 800, am: 36, prof: 0.4 },
  // Le skieur : « chhh… chhh… », ses skis qui glissent à chaque poussée.
  skieur: { f: 0, am: 1.3, prof: 0.9, bruit: { f: 2600, q: 0.9, g: 1 } },
};
export function moteur(ctx, out, kind) {
  const M = MOTEURS[kind];
  if (!M) return null;
  const t = ctx.currentTime;
  const am = gain(ctx, 1 - M.prof / 2), lfo = osc(ctx, "sine", M.am), lg = gain(ctx, M.prof / 2), g = gain(ctx, 0);
  lfo.connect(lg); lg.connect(am.gain);
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  am.connect(g);
  if (pan) { g.connect(pan); pan.connect(out); } else g.connect(out);
  const sources = [lfo], oscs = [];
  if (M.f) {
    const o = osc(ctx, "sawtooth", M.f), lp = filtre(ctx, "lowpass", M.lp, 0.9);
    o.connect(lp);
    if (M.bp) { const b = filtre(ctx, "bandpass", M.bp, 1.2); lp.connect(b); b.connect(am); } else lp.connect(am);
    oscs.push(o); sources.push(o);
  }
  if (M.bruit) {
    const src = sourceBruit(ctx, t), b = filtre(ctx, "bandpass", M.bruit.f, M.bruit.q), bg = gain(ctx, M.bruit.g);
    src.connect(b); b.connect(bg); bg.connect(am); sources.push(src);
  }
  lfo.start(t);
  for (const o of oscs) o.start(t); // (le bruit, lui, est déjà parti : sourceBruit)
  return {
    regler(niveau, p, doppler, tt) {
      g.gain.setTargetAtTime(niveau, tt, 0.06);
      if (pan) pan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, p)), tt, 0.06);
      for (const o of oscs) o.frequency.setTargetAtTime(M.f * doppler, tt, 0.06);
      lfo.frequency.setTargetAtTime(M.am * doppler, tt, 0.06);
    },
    arreter(tt) {
      g.gain.setTargetAtTime(0, tt, 0.05);
      for (const o of sources) try { o.stop(tt + 0.4); } catch (e) { /* déjà arrêté */ }
    },
  };
}
export const KINDS_MOTEUR = Object.keys(MOTEURS);

// Pour le banc d'écoute (outils/bruitages.mjs) : chaque couche, chaque
// moteur et chaque rafale de grains, 2 s à leur niveau nominal (gain 1).
for (const kind of KINDS_MOTEUR) SONS[`moteur_${kind}`] = (ctx, out, t0) => { const m = moteur(ctx, out, kind); m.regler(1, 0, 1, t0); m.arreter(t0 + 2); };
for (const nom of ["roulement", "vent", "blizzard", "vagues", "jet", "grondement", "freins", "boules"]) {
  SONS[`couche_${nom}`] = (ctx, out, t0) => { const c = couche(ctx, out, nom); c.gain.setValueAtTime(0, 0); c.gain.setValueAtTime(1, t0); if (c.env) c.env.setValueAtTime(1, t0); c.stop(t0 + 2.5); };
}
SONS.roueLibre = (ctx, out, t0) => { for (let i = 0; i < 36; i++) jouerGrain(ctx, out, "tic", t0 + i / 24); };
SONS.neigeRoule = (ctx, out, t0, o) => { for (let i = 0; i < 24; i++) jouerGrain(ctx, out, "neige", t0 + i / 16 + o.alea() * 0.03, 0.85 + o.alea() * 0.3); };
SONS.planches = (ctx, out, t0) => { for (let i = 0; i < 10; i++) { jouerGrain(ctx, out, "latte", t0 + i / 7); jouerGrain(ctx, out, "latte", t0 + i / 7 + 0.12, 0.92); } };

// --- Ce que chaque choc fait entendre --------------------------------------------
const CHOCS = {
  poule: "poule", poulejetee: "poule", vache: "vache", mouton: "mouton", cochon: "cochon", chien: "chien", chat: "chat", botte: "botte",
  pieton: "ouf", fermier: "ouf", baigneur: "ouf", costard: "costard", skieur: "skieur", bonhomme: "bonhomme",
  voiture: "carambolage", contresens: "carambolage", buggy: "carambolage", bus: "carambolage", tracteur: "carambolage", chasseneige: "carambolage",
};
const GROS = new Set(["bus", "tracteur", "chasseneige"]);
// Ce qu'un animal dit en nous voyant arriver.
export const APPELS = { poule: "glousse", vache: "meuh", mouton: "bee", cochon: "groin", chien: "ouaf", chat: "miaou" };

// --- Niveaux ----------------------------------------------------------------------
// Gain de chaque son, calé par outils/bruitages.mjs : la crête de son niveau
// momentané (fenêtre 400 ms) visée en LUFS, le morceau étant à −9,9 LUFS.
// Un choc ~12 LU sous la musique, un klaxon ~13, le train ~10, le vélo et
// l'ambiance ~20-25 (« en pas fort »).
export const CIBLES = {
  poule: -22, glousse: -27, vache: -22, meuh: -28, mouton: -22, bee: -28, cochon: -22, groin: -28, chien: -22, ouaf: -27, chat: -22, miaou: -28,
  botte: -24, ouf: -23, costard: -23, skieur: -23, bonhomme: -24, carambolage: -21,
  klaxon_contresens: -23, klaxon_voiture: -23, klaxon_bus: -23, klaxon_tracteur: -24, klaxon_chasseneige: -23, klaxon_buggy: -24,
  sonnette: -25, atterrissage: -27, train: -20, rail: -29, pschit: -28, carillon: -28, quilles: -24,
  oiseau: -33, grillon: -35, chouette: -33, mouette: -31, cloche: -29,
  // Continus, au niveau nominal (ambiance.js les module) : le vélo « en pas fort ».
  couche_roulement: -33, roueLibre: -34, neigeRoule: -34, planches: -32, couche_vent: -36, couche_blizzard: -33, couche_vagues: -31,
  couche_jet: -26, couche_grondement: -28, couche_freins: -27, couche_boules: -33,
  moteur_contresens: -30, moteur_bus: -29, moteur_tracteur: -29, moteur_chasseneige: -29, moteur_buggy: -30, moteur_skieur: -32,
};
export const NIVEAUX = {
  poule: 0.279, glousse: 0.38, meuh: 0.245, vache: 0.437, bee: 0.285, mouton: 0.589, groin: 0.376, cochon: 0.168, ouaf: 0.143, chien: 0.309,
  miaou: 0.095, chat: 0.15, botte: 0.676, ouf: 0.631, costard: 0.603, skieur: 0.575, bonhomme: 0.638, carambolage: 0.305, klaxon_contresens: 0.186,
  klaxon_voiture: 0.186, klaxon_bus: 0.148, klaxon_tracteur: 0.248, klaxon_chasseneige: 0.151, klaxon_buggy: 0.229, sonnette: 0.141,
  atterrissage: 0.624, train: 0.26, rail: 0.422, pschit: 0.09, carillon: 0.108, quilles: 0.484, oiseau: 0.037, grillon: 0.066, chouette: 0.039,
  mouette: 0.052, cloche: 0.056,
  couche_roulement: 0.182, roueLibre: 0.193, neigeRoule: 0.153, planches: 0.195, couche_vent: 0.074, couche_blizzard: 0.24, couche_vagues: 0.232,
  couche_jet: 0.211, couche_grondement: 0.589, couche_freins: 0.061, couche_boules: 0.417,
  moteur_contresens: 0.146, moteur_bus: 0.191, moteur_tracteur: 0.412, moteur_chasseneige: 0.197, moteur_buggy: 0.394, moteur_skieur: 0.129,
};
// Durée d'un son (budget de voix simultanées).
const DUREES = { vache: 1, meuh: 1.3, cloche: 5.5, train: 1.8, pschit: 1.6, chouette: 1.5, grillon: 2.1, mouette: 1.4, sonnette: 1, carillon: 1.3 };
export const NOMS = Object.keys(SONS);

// Rendu sur n'importe quel contexte (le jeu, ou hors ligne pour l'outil).
export function rendre(nom, ctx, out, t0, o = {}) {
  const fn = SONS[nom];
  if (!fn) return false;
  fn(ctx, out, t0, { ...o, alea: o.alea || rng(o.graine ?? Math.random() * 1e9) });
  return true;
}

// --- Lecture en direct ----------------------------------------------------------
// o.pan (−1 gauche … 1 droite), o.volume, o.etouffe (Hz : de loin, à travers
// les murs), o.ambiance (suit ambianceVolume), o.prioritaire (passe même si
// beaucoup de sons jouent déjà).
const enCours = [];
const MAX_VOIX = 14;
export function jouer(nom, o = {}) {
  const sortie = audio.sfxOutput();
  if (!sortie || !SONS[nom]) return false;
  const { ctx, dest } = sortie;
  const t = ctx.currentTime;
  while (enCours.length && enCours[0] < t) enCours.shift();
  if (enCours.length >= MAX_VOIX && !o.prioritaire) return false;
  const C = window.CONFIG;
  const niveau = (NIVEAUX[nom] ?? 0.3) * (o.volume ?? 1) * (C.bruitagesVolume ?? 1) * (o.ambiance ? (C.ambianceVolume ?? 1) : 1);
  if (niveau < 0.0005) return false;
  const g = gain(ctx, niveau);
  if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); g.connect(p); p.connect(dest); }
  else g.connect(dest);
  let entree = g;
  if (o.etouffe) { const lp = filtre(ctx, "lowpass", o.etouffe, 0.7); lp.connect(g); entree = lp; }
  const t0 = t + 0.01 + (o.delai || 0);
  rendre(nom, ctx, entree, t0, o);
  if (window.__journalSons) window.__journalSons.push({ nom, pan: o.pan || 0, volume: o.volume ?? 1 }); // banc d'essai (?debug)
  enCours.push(t0 + (DUREES[nom] || 0.7));
  enCours.sort((x, y) => x - y);
  return true;
}
// Le choc contre un obstacle : le son de ce qu'on a percuté.
export function choc(kind, o = {}) {
  const nom = CHOCS[kind];
  if (!nom) return false;
  return jouer(nom, { ...o, gros: GROS.has(kind), prioritaire: true });
}
export function klaxonDe(kind) { return KLAXONS[kind] ? `klaxon_${kind}` : null; }
