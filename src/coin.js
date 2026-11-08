// coin.js — La PIÈCE à l'effigie de PMC à vélo. Un disque doré qui tourne
// autour de son axe vertical : la face porte le pictogramme du cycliste en pixel art,
// la tranche apparaît quand la pièce est de profil. Centrée sur l'origine
// du contexte (faire translate avant). R = rayon écran.

const FACE = "#ffcf2e", FACE_HI = "#ffe45e", RIM = "#c07f0c", EDGE = "#a86a08", INK = "#5a3a08";

// Cycliste vu de profil, 15×11 (# = encre). Deux roues, cadre, dos courbé,
// tête, casquette — le logo de PMC à vélo.
const LOGO = [
  "........###....",
  "........####...",
  "......###......",
  ".....##........",
  ".....##.#......",
  "....#####......",
  "...#.#..#......",
  "..#..#..##.....",
  ".###.###.###...",
  "#...##.##...#..",
  ".###.....###...",
];
const LOGO_W = 15, LOGO_H = 11;

// Le halo doux derrière la pièce : une seule image préparée, redessinée à l'échelle.
let lueur = null;
function imageLueur() {
  if (lueur) return lueur;
  lueur = document.createElement("canvas");
  lueur.width = lueur.height = 96;
  const g = lueur.getContext("2d"), d = g.createRadialGradient(48, 48, 12, 48, 48, 48);
  d.addColorStop(0, "rgba(255,240,170,0.75)");
  d.addColorStop(0.5, "rgba(255,214,90,0.28)");
  d.addColorStop(1, "rgba(255,200,60,0)");
  g.fillStyle = d;
  g.fillRect(0, 0, 96, 96);
  return lueur;
}

// L'éclat : une étoile à quatre branches, quand la pièce fait face à la lumière.
function eclat(ctx, x, y, taille, force) {
  ctx.save();
  ctx.globalAlpha = force;
  ctx.fillStyle = "#fffdf0";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, r = i % 2 ? taille * 0.14 : taille;
    if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + r, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawCoin(ctx, R, spin, rouge = false) {
  const c = Math.cos(spin);
  const G = R * 2.1;
  ctx.drawImage(imageLueur(), -G, -G, G * 2, G * 2);
  if (rouge) {
    // Pièce « ROUGE » rare = un pote direct. Elle reste DORÉE (en rouge, elle se
    // lit comme un poison) : même pièce, plus grosse, avec un grand halo solaire.
    const halo = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 3.4);
    halo.addColorStop(0, "rgba(255,240,150,0.95)");
    halo.addColorStop(0.45, "rgba(255,205,60,0.35)");
    halo.addColorStop(1, "rgba(255,190,60,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(-R * 3.2, -R * 3.2, R * 6.4, R * 6.4);
  }
  const FACE_C = rouge ? "#ffe066" : FACE, FACE_HI_C = rouge ? "#fff6c8" : FACE_HI, RIM_C = rouge ? "#d99a0c" : RIM, EDGE_C = rouge ? "#b87d06" : EDGE;
  const rx = Math.max(R * 0.08, R * Math.abs(c));
  const thick = R * 0.16;
  // Tranche : décalée du côté qui s'éloigne, visible surtout de profil.
  ctx.fillStyle = EDGE_C;
  ctx.beginPath();
  ctx.ellipse(-Math.sign(c) * thick * (1 - Math.abs(c)), 0, rx, R, 0, 0, Math.PI * 2);
  ctx.fill();
  // Face : disque doré, anneau, reflet.
  ctx.fillStyle = RIM_C;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, R, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = FACE_C;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.82, R * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = FACE_HI_C;
  ctx.beginPath();
  ctx.ellipse(-rx * 0.25, -R * 0.3, rx * 0.35, R * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // La pièce brille quand elle se présente de face : un reflet, puis l'éclat.
  const face = Math.abs(c) ** 10;
  if (face > 0.02) {
    ctx.fillStyle = `rgba(255,255,255,${0.75 * face})`;
    ctx.beginPath();
    ctx.ellipse(-rx * 0.28, -R * 0.34, rx * 0.34, R * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();
    eclat(ctx, R * 0.42, -R * 0.5, R * 0.95, face);
  }
  // Logo, écrasé horizontalement avec l'angle, masqué de profil.
  if (window.CONFIG.piecesLogo && Math.abs(c) > 0.22) {
    const px = (R * 1.25) / LOGO_H;
    const sx = px * Math.abs(c), sy = px;
    ctx.fillStyle = INK;
    for (let y = 0; y < LOGO_H; y++) {
      const row = LOGO[y];
      for (let x = 0; x < LOGO_W; x++) {
        if (row[x] !== "#") continue;
        ctx.fillRect((x - LOGO_W / 2) * sx, (y - LOGO_H / 2) * sy, sx + 0.3, sy + 0.3);
      }
    }
  }
}
