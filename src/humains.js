// humains.js — QUI on croise, sur la route et dans le décor : un seul tirage
// pour tous les personnages (peau, cheveux, coiffure, taille, corpulence, âge),
// pour que la foule soit variée — toutes les couleurs de peau, gros et minces,
// petits et grands, jeunes et vieux, enfants.
//
// Déterministe (une graine = la rangée, ou une position du décor) : un même
// piéton garde la même tête d'une image à l'autre, et la même TAILLE pour la
// collision (rows.js) que pour le dessin (props.js) — un petit monsieur se
// saute plus bas qu'un grand, et ce qu'on voit ne ment jamais sur la boîte.
//
// ⚠️ Jamais d'enfant SUR LA ROUTE (`enfants: false`) : ils sont dans le décor
// (plage, marché, village). Un cycliste qui percute un enfant et l'envoie
// valser en turbo, ça ne passe pas — ni en jeu, ni dans un Reel.

// Huit peaux, de très claire à très foncée, métisses comprises : tirage
// uniforme, donc la moitié des gens sont mats à foncés.
export const PEAUX = ["#f5d6be", "#ebc19f", "#dea67c", "#c98c5c", "#b0744a", "#955f3a", "#784729", "#5a341e"];
const NOIRS = ["#0d0d0f", "#1c120a", "#2a1a10"];
const BRUNS = ["#3d2616", "#5a3a22", "#6b4426"];
const CLAIRS = ["#a8662e", "#c99a4a", "#e2c47a"];   // roux, blond foncé, blond
const GRIS = ["#8e8e94", "#b9b9be", "#e6e6e8"];

function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function choisir(liste, x) { return liste[Math.min(liste.length - 1, Math.floor(x * liste.length))]; }

// Teinte plus sombre (ombres d'un personnage dessiné à plat).
export function assombrir(hex, k = 0.82) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s) => Math.round(((n >> s) & 255) * k);
  return `#${((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1)}`;
}

const cache = new Map();
// { peau, peauOmbre, fonce, cheveux, coiffure, taille, corpulence, age, femme, barbe }
//   taille     : × la hauteur nominale (1 = la plus grande ; enfant ~0,6)
//   corpulence : × la largeur nominale — jamais moins de 1,05, 1,12 le plus
//                souvent, 1,38 une personne ronde
//   coiffure   : court · rase · long · chignon · afro · tresses · chauve
export function humain(graine, { enfants = true } = {}) {
  const cle = `${graine}|${enfants ? 1 : 0}`;
  const deja = cache.get(cle);
  if (deja) return deja;
  const g = (k) => hash01(graine * 7.13 + k * 19.71);
  const iPeau = Math.floor(g(1) * PEAUX.length);
  const fonce = iPeau >= 5;
  const a = g(2);
  const age = enfants && a < 0.16 ? "enfant" : a > 0.8 ? "vieux" : "adulte";
  const femme = g(3) < 0.5;
  const t = g(4);
  const taille = age === "enfant" ? 0.56 + 0.12 * t : age === "vieux" ? 0.9 + 0.06 * t : t < 0.3 ? 0.88 : t < 0.72 ? 0.95 : 1;
  const c = g(5);
  const corpulence = age === "enfant" ? 1.05 : c < 0.25 ? 1.05 : c < 0.7 ? 1.12 : 1.38;
  const h = g(6);
  const cheveux = age === "vieux" ? choisir(GRIS, h)
    : fonce ? choisir(h < 0.75 ? NOIRS : BRUNS, (h * 4) % 1)
    : choisir(h < 0.35 ? NOIRS : h < 0.7 ? BRUNS : CLAIRS, (h * 3) % 1);
  const s = g(7);
  const coiffure = age === "vieux" ? (femme ? (s < 0.6 ? "chignon" : "court") : (s < 0.5 ? "chauve" : "court"))
    : femme ? choisir(fonce ? ["afro", "tresses", "long", "chignon", "court"] : ["long", "chignon", "court", "long", "afro"], s)
    : choisir(fonce ? ["afro", "rase", "court", "tresses", "chauve"] : ["court", "rase", "court", "chauve", "long"], s);
  const barbe = !femme && age !== "enfant" && g(8) < 0.3;
  const peau = PEAUX[iPeau];
  // Une afro blonde ou rousse se lisait comme une auréole : brune ou noire.
  const teinte = coiffure === "afro" && age !== "vieux" && CLAIRS.includes(cheveux) ? choisir(BRUNS, h) : cheveux;
  const m = { peau, peauOmbre: assombrir(peau), fonce, cheveux: teinte, coiffure, taille, corpulence, age, femme, barbe };
  if (cache.size > 4000) cache.clear();
  cache.set(cle, m);
  return m;
}

// Taille d'un humain-OBSTACLE à la rangée r (jamais un enfant) : la collision
// (rows.js) et le dessin (props.js) lisent la même.
export function tailleObstacle(r) { return humain(Math.round(r), { enfants: false }).taille; }
