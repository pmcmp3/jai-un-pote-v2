// hud.js — Interface peinte dans le canvas pendant la course : le SCORE en
// gros (serif de l'e-card, en « pts » : tout le monde fait la même distance,
// ce qui départage ce sont les potes et les pièces), le multiplicateur, le
// nombre de potes et la prochaine étape, le décompte 3-2-1-GO, les tutos.
// Le canvas ne lit pas les variables CSS : mêmes valeurs qu'index.html.

const BLANC = "#ffffff";
const NOIR = "#0d0d10";
const JAUNE = "#ffcf2e";
const ROUGE = "#e13e26";
const PANNEAU = "rgba(13,13,16,0.72)";
const POLICE = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';
const POLICE_TITRE = '"Source Serif 2", Georgia, serif';
const PAD = 16;

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export function formatMetres(m) {
  return `${Math.floor(m).toLocaleString("fr-FR")}`;
}

// Police réduite jusqu'à tenir dans maxW (petits écrans).
function fitFont(ctx, weight, size, text, maxW, min = 9) {
  let t = size;
  ctx.font = `${weight} ${t}px ${POLICE}`;
  while (ctx.measureText(text).width > maxW && t > min) { t -= 1; ctx.font = `${weight} ${t}px ${POLICE}`; }
  return t;
}

// `hud` = { metres, potes, potesMax, gaugeT, mult, restant, restantS, avance,
//           turbo, safeTop, nuit, plage, plein }
// Disposition :
//   haut   : la barre du MORCEAU (le chrono), sur toute la largeur, jusqu'au
//            drapeau — rouge les 10 dernières secondes ;
//   centre : les points ;
//   droite : « ×1,5  2 POTES » en gros, puis « PROCHAINE ÉTAPE » et
//            « 6 PIÈCES ». Ni cases ni jauge, aucun texte flouté.
// Texte blanc la nuit ET sur la plage : le noir ne se lit pas sur le ciel violet.
export function renderHud(ctx, width, height, hud) {
  ctx.save();
  const top = hud.safeTop || 0;
  ctx.textBaseline = "top";
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  const clair = hud.nuit > 0.5 || (hud.plage || 0) > 0.35;
  const TXT = clair ? BLANC : NOIR, TXT_VIDE = clair ? "rgba(255,255,255,0.28)" : "rgba(13,13,16,0.22)";
  const TXT_DOUX = clair ? "rgba(255,255,255,0.8)" : "rgba(13,13,16,0.72)";

  // --- Droite : « ×1,5  2 POTES », puis la prochaine étape -----------------
  const total = hud.potesMax;
  const xD = width - PAD, y1 = top + PAD + 6;
  const libelle = total === 0 ? "INVITE TES POTES" : hud.potes === 0 ? "TOUT SEUL" : hud.potes === 1 ? "1 POTE" : `${hud.potes} POTES`;
  ctx.textAlign = "right";
  ctx.font = `900 16px ${POLICE}`;
  const wLib = ctx.measureText(libelle).width;
  ctx.fillStyle = TXT;
  ctx.fillText(libelle, xD, y1 + 2);
  let gaucheDroite = xD - wLib;
  if (hud.mult > 1.001) {
    const txt = `×${String(hud.mult).replace(".", ",")}`;
    ctx.font = `900 15px ${POLICE}`;
    const w = ctx.measureText(txt).width + 14;
    const xP = xD - wLib - 8 - w;
    ctx.fillStyle = hud.turbo ? ROUGE : JAUNE;
    roundRect(ctx, xP, y1 - 2, w, 24, 4);
    ctx.fill();
    ctx.fillStyle = hud.turbo ? BLANC : "#4a3305";
    ctx.textAlign = "center";
    ctx.fillText(txt, xP + w / 2, y1 + 3);
    gaucheDroite = Math.min(gaucheDroite, xP);
  }
  if (total > 0 && !hud.plein) {
    ctx.textAlign = "right";
    ctx.font = `800 10.5px ${POLICE}`;
    ctx.fillStyle = TXT_DOUX;
    ctx.fillText("PROCHAINE ÉTAPE", xD, y1 + 29);
    ctx.font = `900 16px ${POLICE}`;
    ctx.fillStyle = TXT;
    ctx.fillText(`${hud.restant} PIÈCE${hud.restant > 1 ? "S" : ""}`, xD, y1 + 43);
  }

  // --- Centre : les points, au MILIEU DE L'ÉCRAN (pas entre les deux blocs :
  // avec « ×5 5 POTES » à droite, ils partaient vers la gauche). Ils
  // rapetissent plutôt que de toucher le bouton pause ou le bloc de droite.
  const leftEnd = 14 + 46 + 10, rightStart = gaucheDroite - 10;
  const cx = width / 2;
  const centerW = 2 * Math.min(cx - leftEnd, rightStart - cx);
  const num = formatMetres(hud.metres);
  let taille = 40;
  ctx.font = `900 ${taille}px ${POLICE_TITRE}`;
  while (ctx.measureText(num).width + 26 > centerW && taille > 22) { taille -= 2; ctx.font = `900 ${taille}px ${POLICE_TITRE}`; }
  const wNum = ctx.measureText(num).width;
  ctx.font = `700 14px ${POLICE}`;
  const wUnit = ctx.measureText(" pts").width;
  const x0 = cx - (wNum + wUnit) / 2;
  ctx.fillStyle = TXT;
  ctx.textAlign = "left";
  ctx.font = `900 ${taille}px ${POLICE_TITRE}`;
  ctx.fillText(num, x0, top + PAD - 2);
  ctx.font = `700 14px ${POLICE}`;
  ctx.fillText(" pts", x0 + wNum, top + PAD + taille * 0.5);

  // --- Tout en haut : la barre du MORCEAU, comme les barres des stories ----
  // (Instagram) : elle se remplit jusqu'au drapeau d'arrivée, rouge dans les
  // dix dernières secondes.
  if (hud.avance !== undefined) {
    const a = Math.max(0, Math.min(1, hud.avance));
    const fin = hud.restantS !== undefined && hud.restantS <= 10;
    const bx = PAD, bw = width - 2 * PAD - 14, by = top + 4;
    ctx.fillStyle = TXT_VIDE;
    roundRect(ctx, bx, by, bw, 4, 2);
    ctx.fill();
    ctx.fillStyle = fin ? ROUGE : TXT;
    roundRect(ctx, bx, by, Math.max(4, bw * a), 4, 2);
    ctx.fill();
    const fx = bx + bw + 4, fy = by - 3;
    ctx.fillStyle = TXT;
    ctx.fillRect(fx, fy, 1.5, 11);
    for (let k = 0; k < 3; k++) for (let l = 0; l < 2; l++) { ctx.fillStyle = (k + l) % 2 ? BLANC : NOIR; ctx.fillRect(fx + 1.5 + k * 2.5, fy + l * 2.5, 2.5, 2.5); }
  }
  ctx.restore();
}

// La main qui tape, DESSINÉE plutôt qu'en emoji 👆, qui change de tête selon
// le téléphone (Samsung ≠ iPhone). Mêmes formes que le SVG de la
// carte « 1 tap = 1 saut » (index.html), repère 48 × 48.
function dessinerMain(ctx, x, y, k) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  ctx.lineWidth = 2.4; ctx.lineJoin = "round"; ctx.strokeStyle = NOIR;
  const bloc = (bx, by, w, h, r, col = BLANC) => { ctx.fillStyle = col; roundRect(ctx, bx, by, w, h, r); ctx.fill(); roundRect(ctx, bx, by, w, h, r); ctx.stroke(); };
  ctx.save(); ctx.translate(12.5, 32); ctx.rotate((-28 * Math.PI) / 180); bloc(-4.5, -7, 9, 14, 4.5); ctx.restore(); // pouce
  bloc(14, 23, 27, 19, 7);   // paume
  bloc(25, 18, 8, 12, 4);    // doigts repliés
  bloc(31, 20, 7, 11, 3.5);
  bloc(17, 3, 9, 27, 4.5);   // l'index
  bloc(17, 40, 21, 6, 1.5, ROUGE); // la manche
  ctx.restore();
}

// Doigt qui tape, au départ des premières parties, jusqu'au premier saut :
// montre qu'il faut TAPER l'écran, pas glisser.
export function renderTapHint(ctx, width, height, t, alpha) {
  if (alpha <= 0.01) return;
  const ph = (t % 0.9) / 0.9;
  const x = width / 2, y = height * 0.62;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (ph > 0.45) {
    const k = (ph - 0.45) / 0.55;
    ctx.strokeStyle = `rgba(225,62,38,${1 - k})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 10 + k * 34, 0, Math.PI * 2); ctx.stroke();
  }
  const dy = ph < 0.45 ? 14 * (1 - ph / 0.45) : 0;
  dessinerMain(ctx, x - 18, y - 6 + dy, 44 / 48);
  ctx.textAlign = "center";
  const msg = "TAPE L'ÉCRAN POUR SAUTER · PAS BESOIN DE GLISSER";
  fitFont(ctx, "800", 11, msg, width - 50, 8);
  const w = ctx.measureText(msg).width + 20;
  ctx.fillStyle = NOIR; ctx.fillRect(x - w / 2, y + 56, w, 24);
  ctx.fillStyle = BLANC; ctx.textBaseline = "middle";
  ctx.fillText(msg, x, y + 69);
  ctx.restore();
}

// Décompte « 3, 2, 1, GO » calé sur les temps (voir main.js).
export function renderCountIn(ctx, width, height, t, beatPeriod, beats, linger, avecSon = true) {
  let texte, age;
  if (t < 0) {
    const restant = -t / beatPeriod;
    const n = Math.ceil(restant);
    if (n > beats) return;
    texte = `${n}`;
    age = (n - restant) * beatPeriod;
  } else {
    if (t >= linger) return;
    texte = "GO !";
    age = t;
  }
  const tPop = Math.min(1, age / 0.22);
  const scale = 1.45 - 0.45 * tPop;
  const alpha = t < 0 ? 1 : Math.max(0, 1 - (t / linger) ** 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(width / 2, Math.max(height * 0.3, 190));
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${t < 0 ? 84 : 66}px ${POLICE_TITRE}`;
  // Contour noir net sous le remplissage : un simple flou se perd sur le ciel
  // clair.
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  ctx.lineWidth = 3;
  ctx.strokeStyle = NOIR;
  ctx.lineJoin = "round";
  ctx.strokeText(texte, 0, 0);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = t < 0 ? BLANC : JAUNE;
  ctx.fillText(texte, 0, 0);
  ctx.restore();
  // Rappel de jouer avec le son (les klaxons annoncent les voitures). Pas si
  // la carte « Monte le son » de l'explication vient de passer.
  if (!avecSon) return;
  const msg = "MONTE LE SON : LES KLAXONS T'ANNONCENT LES VOITURES";
  ctx.save();
  ctx.globalAlpha = alpha;
  fitFont(ctx, "800", 11, msg, width - 60, 8);
  const w = ctx.measureText(msg).width + 20, y = Math.max(height * 0.3, 190) + 72;
  ctx.translate(width / 2, y); ctx.rotate(-0.02);
  ctx.fillStyle = NOIR; ctx.fillRect(-w / 2, -12, w, 24);
  ctx.fillStyle = BLANC; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(msg, 0, 1);
  ctx.restore();
}

// Bandeau ponctuel (« +1 POTE », « −2 POTES », « SOBERLAND EST LÀ ! ») :
// même vocabulaire que le bandeau de palier du premier jeu.
export function renderBanner(ctx, width, height, banner, safeTop = 0, yForce = null) {
  if (!banner || banner.timer <= 0) return;
  const age = banner.duree - banner.timer;
  ctx.save();
  ctx.globalAlpha = Math.min(1, banner.timer * 2, age * 6);
  const maxW = Math.min(width - 48, 330);
  let ft = 20; ctx.font = `900 ${ft}px ${POLICE_TITRE}`;
  while (ctx.measureText(banner.titre).width > maxW - 44 && ft > 12) { ft -= 1; ctx.font = `900 ${ft}px ${POLICE_TITRE}`; }
  const w = Math.max(170, Math.min(maxW, ctx.measureText(banner.titre).width + 46));
  const h = banner.sous ? 56 : 40;
  const y = yForce !== null ? yForce : safeTop + 150;
  const tPop = Math.min(1, age / 0.3);
  const scale = 0.85 + 0.15 * tPop + 0.05 * Math.sin(tPop * Math.PI);
  ctx.translate(width / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-width / 2, -(y + h / 2));
  const x = (width - w) / 2;
  // Carte BLANCHE à bord noir, comme les panneaux du jeu et l'e-card de l'EP
  // (DA du jeu, jamais un fond gris).
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, 3); ctx.fill();
  ctx.strokeStyle = NOIR; ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 3); ctx.stroke();
  // L'onglet de couleur, posé de travers à cheval sur le bord haut.
  ctx.font = `800 9px ${POLICE}`;
  const tw = Math.min(w - 30, Math.max(60, ctx.measureText(banner.etiquette || "").width + 22)), th = 15;
  ctx.save();
  ctx.translate(x + 18 + tw / 2, y);
  ctx.rotate(-0.035);
  ctx.fillStyle = banner.couleur;
  ctx.fillRect(-tw / 2, -th / 2, tw, th);
  ctx.strokeStyle = NOIR; ctx.lineWidth = 1.2;
  ctx.strokeRect(-tw / 2, -th / 2, tw, th);
  if (banner.etiquette) {
    ctx.fillStyle = banner.couleur === ROUGE ? BLANC : NOIR;
    ctx.font = `800 9px ${POLICE}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(banner.etiquette, 0, 0.5);
  }
  ctx.restore();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = NOIR;
  ctx.font = `900 ${ft}px ${POLICE_TITRE}`;
  ctx.fillText(banner.titre, width / 2, y + (banner.sous ? 13 : 9));
  if (banner.sous) {
    fitFont(ctx, "500", 12, banner.sous, w - 24, 9);
    ctx.fillStyle = "rgba(13,13,16,0.6)";
    ctx.fillText(banner.sous, width / 2, y + 36);
  }
  ctx.restore();
}

// Effets du TURBO LAIT (vue de profil) : traits HORIZONTAUX qui filent vers
// la gauche. Les couleurs saturées viennent du CSS (canvas.turbo).
export function renderTurbo(ctx, width, height, t, force) {
  if (force <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = force * 0.75;
  // Pas de voile blanc sur le bord droit (il masque le jeu) : seulement les
  // traits de vitesse.
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 14; i++) {
    const y = height * (0.2 + ((i * 0.618) % 1) * 0.7);
    const len = 50 + (i * 37) % 110;
    const x = width - ((t * (1100 + i * 80) + i * 173) % (width + len));
    ctx.fillRect(x, y, len, 2);
  }
  ctx.restore();
}

// Tutoriel du tout début : une consigne à la fois, en gros, jusqu'au geste.
// Même carte que le reste du jeu, par cohérence : blanche à bord noir, onglet
// rouge de travers (jaune quand l'étape est réussie), titre en serif noire.
export function renderTuto(ctx, width, height, tuto) {
  if (!tuto) return;
  ctx.save();
  // En gros : une consigne trop petite est vue sans être lue.
  const w = Math.min(width - 24, 350), h = tuto.sous ? 118 : 84;
  const x = width / 2 - w / 2, y = tuto.y !== undefined ? tuto.y : height * 0.3; // en HAUT, sous le score
  ctx.globalAlpha = tuto.alpha;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, 3); ctx.fill();
  ctx.strokeStyle = NOIR; ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 3); ctx.stroke();
  const onglet = tuto.onglet || (tuto.ok ? "BIEN !" : `TUTO ${tuto.index}/${tuto.total}`);
  ctx.save();
  ctx.translate(x + 16 + 50, y);
  ctx.rotate(-0.035);
  ctx.fillStyle = tuto.ok ? JAUNE : ROUGE;
  ctx.fillRect(-50, -10, 100, 20);
  ctx.strokeStyle = NOIR; ctx.lineWidth = 1.2;
  ctx.strokeRect(-50, -10, 100, 20);
  ctx.fillStyle = tuto.ok ? NOIR : BLANC;
  ctx.font = `800 11px ${POLICE}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(onglet, 0, 0.5);
  ctx.restore();
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  let t = 31; ctx.font = `900 ${t}px ${POLICE_TITRE}`;
  while (ctx.measureText(tuto.titre).width > w - 24 && t > 16) { t -= 1; ctx.font = `900 ${t}px ${POLICE_TITRE}`; }
  ctx.fillStyle = NOIR;
  ctx.fillText(tuto.titre, width / 2, y + 24);
  if (tuto.sous) {
    fitFont(ctx, "700", 16, tuto.sous, w - 24, 11);
    ctx.fillStyle = "rgba(13,13,16,0.82)";
    ctx.fillText(tuto.sous, width / 2, y + 72);
  }
  ctx.restore();
}

// Fin du morceau = fin de la course : le STICKER rouge posé de travers de
// toute la DA (cartes, onglets, e-card de l'EP), qui tombe sur l'écran avec un
// rebond, et une ligne dessous.
export function renderFin(ctx, width, height, age, sous = "Tu es allé au bout du morceau") {
  const tPop = Math.min(1, age / 0.32);
  const rebond = 1 + 0.12 * Math.sin(tPop * Math.PI) * (1 - tPop * 0.4);
  ctx.save();
  ctx.globalAlpha = Math.min(1, age * 5);
  ctx.fillStyle = `rgba(13,13,16,${Math.min(0.28, age * 0.6)})`;
  ctx.fillRect(0, 0, width, height);
  const cx = width / 2, cy = height * 0.36;
  ctx.translate(cx, cy);
  ctx.rotate(-0.045);
  const sc = (0.6 + 0.4 * tPop) * rebond;
  ctx.scale(sc, sc);
  const txt = "T E R M I N É  !";
  const taille = Math.min(34, width * 0.085);
  ctx.font = `900 ${taille}px ${POLICE}`;
  const w = ctx.measureText(txt).width + 44, h = taille + 30;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(-w / 2 + 4, -h / 2 + 6, w, h);
  ctx.fillStyle = ROUGE;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = NOIR; ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = BLANC;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(txt, 0, 2);
  ctx.restore();
  // La ligne dessous, qui arrive juste après le sticker.
  const a2 = Math.max(0, Math.min(1, (age - 0.3) * 4));
  if (a2 > 0) {
    ctx.save();
    ctx.globalAlpha = a2;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.font = `700 15px ${POLICE}`;
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = BLANC;
    ctx.fillText(sous, width / 2, cy + 44 + (1 - a2) * 8);
    ctx.restore();
  }
}

// Pastille d'annonce : petite, au-dessus d'un cycliste, là où
// les yeux regardent déjà. Fond blanc, bord noir, comme les cartes du menu.
export function renderPastille(ctx, x, y, texte, alpha, jaune = false) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `900 11px ${POLICE}`;
  const w = ctx.measureText(texte).width + 16, h = 20;
  x = Math.max(8 + w / 2, Math.min(ctx.canvas.clientWidth - 8 - w / 2, x)); // jamais coupée au bord
  ctx.fillStyle = jaune ? JAUNE : BLANC; ctx.strokeStyle = NOIR; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.rect(Math.round(x - w / 2) + 0.5, Math.round(y - h) + 0.5, Math.round(w), h); ctx.fill(); ctx.stroke();
  ctx.fillStyle = NOIR; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(texte, x, y - h / 2 + 0.5);
  ctx.restore();
}

// Projecteur : tout l'écran assombri sauf un cercle autour de l'objet, le
// nom de l'objet en jaune, une phrase, et « touche pour continuer ».
export function renderProjecteur(ctx, width, height, p, info, t) {
  const a = Math.min(1, p.age * 5);
  const r = p.r * (1 + 0.06 * Math.sin(t * 6));
  ctx.save();
  ctx.globalAlpha = a;
  // Pas de cercle net : l'écran s'assombrit à 70 %, et autour de l'objet
  // l'assombrissement s'efface en FONDU jusqu'à 0 (l'objet à 100 %).
  const voile = ctx.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, r * 2.6);
  voile.addColorStop(0, "rgba(8,8,12,0)");
  voile.addColorStop(1, "rgba(8,8,12,0.7)");
  ctx.fillStyle = voile;
  ctx.fillRect(0, 0, width, height);
  // Texte sous l'objet, ou au-dessus s'il est bas dans l'écran.
  const dessous = p.y < height * 0.55;
  ctx.font = `700 18px ${POLICE}`;
  const lignes = couper(ctx, info.sous, Math.min(320, width - 40));
  const y0 = dessous ? p.y + r + 40 : p.y - r - 52 - lignes.length * 25;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  fitFont(ctx, "900", 32, info.titre, width - 32, 16);
  ctx.fillStyle = JAUNE; ctx.fillText(info.titre, width / 2, y0);
  ctx.font = `700 18px ${POLICE}`; ctx.fillStyle = BLANC;
  lignes.forEach((l, i) => ctx.fillText(l, width / 2, y0 + 36 + i * 25));
  if (p.age > 0.5) {
    ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * 5));
    ctx.font = `900 15px ${POLICE}`; ctx.fillStyle = BLANC;
    ctx.fillText("TOUCHE POUR CONTINUER", width / 2, height - 60);
  }
  ctx.restore();
}
function couper(ctx, texte, max) {
  const mots = texte.split(" "), out = [];
  let l = "";
  for (const m of mots) { const e = l ? l + " " + m : m; if (ctx.measureText(e).width > max && l) { out.push(l); l = m; } else l = e; }
  if (l) out.push(l);
  return out;
}
