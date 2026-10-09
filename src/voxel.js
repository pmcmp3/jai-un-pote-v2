// voxel.js — Lecture des couleurs pour le rendu en cubes (scene.js) : hex ou
// "rgb(...)" → [r, g, b].

// Accepte hex ET "rgb(...)" : une couleur déjà assombrie revient sous forme
// rgb(). Sans ce cas, parseInt rend NaN, Canvas ignore en silence le fillStyle
// invalide et la face est peinte avec la couleur précédente.
export function parseColor(c) {
  // Filet : une couleur manquante peint du gris au lieu de faire tomber tout
  // le rendu (et, avec lui, la pile de transformations du canvas).
  if (typeof c !== "string" || !c) return [136, 136, 136];
  if (c[0] === "#") {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/\d+/g);
  return m ? m.map(Number) : [136, 136, 136];
}
