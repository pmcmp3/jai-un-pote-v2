// rider.js — Les PALETTES des cyclistes (joueur, Soberland, potes) et les
// skins choisis au menu (paletteDepuisSkin). Le dessin lui-même est dans
// voxrider.js (vue de profil, en cubes).

// Palettes. `top1`/`top2` = les rayures du haut (identiques = uni),
// `cap` = casquette (null : tête nue), `beard` = barbe sous la nuque.
export const PALETTES = {
  pmc: { hair: "#0d0d0f", hairHi: "#2a2a2e", skin: "#c98a5b", top1: "#f0ead9", top2: "#2f7a46", pants: "#3a3e4e", pantsLo: "#31353f", shoe: "#565a66", cap: null, beard: false },
  soberland: { hair: "#3a2415", hairHi: "#5a3a22", skin: "#d69a68", top1: "#b8402c", top2: "#2b2c33", pants: "#2b2c33", pantsLo: "#1f2026", shoe: "#f2ede2", cap: "#f2ede2", beard: true },
  potes: [
    { hair: "#6b4426", hairHi: "#8a5c36", skin: "#e0b083", top1: "#f4f1ea", top2: "#4a72c8", pants: "#3f63b4", pantsLo: "#31509a", shoe: "#e0742e", cap: null, beard: false },
    { hair: "#241609", hairHi: "#3d2a14", skin: "#8a5a33", top1: "#e13e26", top2: "#e13e26", pants: "#33353d", pantsLo: "#26282f", shoe: "#f2ede2", cap: "#0d0d10", beard: true },
    { hair: "#3a2415", hairHi: "#5a3a22", skin: "#c98a5b", top1: "#2f6d4a", top2: "#f2ede2", pants: "#c8963a", pantsLo: "#a87b2c", shoe: "#33353d", cap: null, beard: false },
    { hair: "#1c1108", hairHi: "#33241a", skin: "#6f4526", top1: "#c8963a", top2: "#33353d", pants: "#4a5260", pantsLo: "#3a414d", shoe: "#d8442c", cap: "#d8442c", beard: false },
    { hair: "#d8b25a", hairHi: "#eccb7c", skin: "#e8c39a", top1: "#8a3fd4", top2: "#f2ede2", pants: "#0d0d10", pantsLo: "#1a1a1e", shoe: "#ffffff", cap: null, beard: false },
    { hair: "#0d0d0f", hairHi: "#2a2a2e", skin: "#b07a4e", top1: "#ffcf2e", top2: "#0d0d10", pants: "#3a3e4e", pantsLo: "#31353f", shoe: "#ffcf2e", cap: "#ffffff", beard: true },
    { hair: "#8a3a1a", hairHi: "#a85630", skin: "#d69a68", top1: "#f2ede2", top2: "#e13e26", pants: "#2b2c33", pantsLo: "#1f2026", shoe: "#2b2c33", cap: null, beard: false },
  ],
};

// --- Skins (7 septembre 2026 : « personnalisation du cycliste ») ---------------
// Un skin = { motif, c1, c2, short, chapeau, chaussures, velo }. Les couleurs
// sont choisies dans COULEURS ; le motif habille le torse (uni / rayé /
// carreaux) ; chapeau : casquette, bob, paille ou aucun ; vélo : vtt ou grandbi.
export const COULEURS = [
  ["blanc", "#f2ede2"], ["rouge", "#e13e26"], ["jaune", "#ffcf2e"],
  ["vert", "#2f7a46"], ["bleu", "#3f63b4"], ["noir", "#0d0d10"],
];
export const CHAPEAUX = ["casquette", "bob", "paille", "aucun"];
export const SKIN_DEFAUT = { genre: "homme", motif: "raye", c1: "#2f7a46", c2: "#f2ede2", short: "#3a3e4e", chapeau: "casquette", chaussures: "#565a66", velo: "vtt" };

export function paletteDepuisSkin(skin, base = PALETTES.pmc) {
  const s = { ...SKIN_DEFAUT, ...(skin || {}) };
  const uni = s.motif === "uni";
  return {
    ...base,
    top1: s.c1, top2: uni ? s.c1 : s.c2, motif: s.motif,
    pants: s.short, pantsLo: s.short, shoe: s.chaussures,
    cap: s.chapeau === "casquette" ? s.c1 : null,
    hat: s.chapeau === "aucun" ? null : s.chapeau,
    // Le bob suit le MAILLOT (1er octobre 2026 : « tu peux pas changer la couleur
    // du bob ») — il prenait c2, la couleur secondaire, presque toujours crème.
    hatColor: s.chapeau === "paille" ? "#e8c66a" : s.c1,
    velo: s.velo === "roller" ? "enfant" : s.velo, // l'ancien roller devient le vélo enfant
    // Homme / femme (28 septembre 2026 : « au début faut choisir entre homme et
    // femme ») : cheveux longs attachés, pas de barbe.
    genre: s.genre,
    beard: s.genre === "femme" ? false : base.beard,
  };
}
