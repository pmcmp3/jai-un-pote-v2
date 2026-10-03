// hud.js — Interface peinte dans le canvas pendant la course : le SCORE en
// gros (serif de l'e-card ; « pts » depuis le 9 septembre 2026 — tout le
// monde fait la même distance, ce qui compte c'est les potes et les pièces), le multiplicateur, la rangée de potes et la
// jauge vers le prochain, le décompte 3-2-1-GO, le rappel des commandes.
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

// `hud` = { metres, potes, potesMax, gaugeT (0..1 vers le prochain pote),
//           mult (multiplicateur des mètres), nextIn (points manquants) }
// Police réduite jusqu'à tenir dans maxW (responsive : « ça dépasse de partout »).
function fitFont(ctx, weight, size, text, maxW, min = 9) {
  let t = size;
  ctx.font = `${weight} ${t}px ${POLICE}`;
  while (ctx.measureText(text).width > maxW && t > min) { t -= 1; ctx.font = `${weight} ${t}px ${POLICE}`; }
  return t;
}

// `hud` = { metres, potes, potesMax, gaugeT, mult, restant, restantS, avance, turbo, safeTop, nuit }
// Disposition revue le 5 octobre 2026 (« la manière dont les points sont
// affichés et la temporalité, le 1,5, ce n'est pas hyper ergonomique [...]
// que ça soit un peu plus intelligemment fait ») :
//   haut   : la barre du MORCEAU (le chrono de la course), sur toute la
//            largeur, qui se remplit jusqu'au drapeau — comme une story ;
//   centre : les points ;
//   droite : les cases des potes, puis « N POTES » avec le multiplicateur
//            qu'ils donnent (×1,5…) — on lit d'où il vient —, puis la jauge
//            du prochain pote. Plus aucun texte flouté.
export function renderHud(ctx, width, height, hud) {
  ctx.save();
  const top = hud.safeTop || 0;
  ctx.textBaseline = "top";
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  // Texte noir de jour, blanc la nuit (pas d'ombre portée, 30 septembre 2026).
  const TXT = hud.nuit > 0.5 ? BLANC : NOIR, TXT_VIDE = hud.nuit > 0.5 ? "rgba(255,255,255,0.28)" : "rgba(13,13,16,0.22)";

  // --- Droite : cases, « N POTES » + multiplicateur, jauge -----------------
  const cell = 10, gap = 3, total = hud.potesMax;
  const rowW = Math.max(60, total * cell + (total - 1) * gap);
  const rx = width - PAD - rowW, ry = top + PAD + 6;
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < hud.potes ? TXT : TXT_VIDE;
    roundRect(ctx, rx + i * (cell + gap), ry, cell, cell, 2);
    ctx.fill();
  }
  const libelle = total === 0 ? "INVITE TES POTES" : hud.potes === 0 ? "TOUT SEUL" : hud.potes === 1 ? "1 POTE" : `${hud.potes} POTES`;
  ctx.font = `800 11px ${POLICE}`;
  const wLib = ctx.measureText(libelle).width;
  const y2 = ry + cell + 6;
  ctx.textAlign = "right";
  ctx.fillStyle = TXT;
  ctx.fillText(libelle, width - PAD, y2);
  let gaucheDroite = Math.min(rx, width - PAD - wLib);
  if (hud.mult > 1.001) {
    const txt = `×${String(hud.mult).replace(".", ",")}`;
    ctx.font = `900 11px ${POLICE}`;
    const w = ctx.measureText(txt).width + 10;
    const xP = width - PAD - wLib - 6 - w;
    ctx.fillStyle = hud.turbo ? ROUGE : JAUNE;
    roundRect(ctx, xP, y2 - 3, w, 17, 3);
    ctx.fill();
    ctx.fillStyle = hud.turbo ? BLANC : "#4a3305";
    ctx.textAlign = "center";
    ctx.fillText(txt, xP + w / 2, y2 + 0.5);
    gaucheDroite = Math.min(gaucheDroite, xP);
  }
  if (total > 0 && !hud.plein) {
    const gy = y2 + 19;
    ctx.fillStyle = TXT_VIDE;
    roundRect(ctx, rx, gy, rowW, 4, 2);
    ctx.fill();
    ctx.fillStyle = JAUNE;
    roundRect(ctx, rx, gy, Math.max(4, rowW * Math.min(1, hud.gaugeT)), 4, 2);
    ctx.fill();
    // Le texte de la jauge : net, sur une étiquette sombre (jaune pâle illisible sur le ciel).
    const txt = `PROCHAIN POTE : ${hud.restant} PIÈCE${hud.restant > 1 ? "S" : ""}`;
    fitFont(ctx, "800", 10, txt, rowW + 50, 8);
    const w = ctx.measureText(txt).width + 8;
    ctx.fillStyle = "rgba(13,13,16,0.55)";
    roundRect(ctx, width - PAD - w, gy + 8, w, 15, 3);
    ctx.fill();
    ctx.fillStyle = JAUNE;
    ctx.textAlign = "right";
    ctx.fillText(txt, width - PAD - 4, gy + 10.5);
  }

  // --- Centre : les points ---------------------------------------------------
  const leftEnd = 14 + 46 + 10, rightStart = gaucheDroite - 10;
  const centerW = rightStart - leftEnd;
  const cx = (leftEnd + rightStart) / 2;
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

// Doigt qui tape, au départ des premières parties, jusqu'au premier saut
// (1er octobre 2026 : « il faut mettre un logo, un GIF de quelqu'un qui tape,
// pour dire qu'il faut taper sur l'écran, il n'y a pas besoin de slider »).
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
  ctx.font = "44px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText("👆", x + 4, y - 6 + dy);
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
  // OMBRE PORTÉE franche (27 septembre 2026 : « il y a un problème avec les
  // chiffres : pas d'ombre portée ») — l'ancien flou noir à 55 % se perdait
  // sur le ciel clair. Un double décalé net, puis un flou doux dessous.
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
  // « Il faut mettre au début qu'il faut jouer avec du son » (29 septembre 2026).
  // Pas si la carte « Monte le son » de l'explication vient de passer.
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

// Rappel des commandes, en bas, pendant les premières secondes de course.
export function renderHint(ctx, width, height, alpha) {
  if (alpha <= 0.01) return;
  const txt = "TAP = SAUT  ·  RESTE APPUYÉ = PLUS HAUT  ·  RE-TAP = DOUBLE";
  ctx.save();
  ctx.globalAlpha = alpha;
  // Ni panneau ni contour : texte blanc, ombre portée à 25 %, comme le score.
  fitFont(ctx, "800", 12, txt, width - 40, 8);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = BLANC;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(txt, width / 2, height * 0.845);
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
  // (20 septembre 2026 : « quand il y a Hugo affiché, pas un panneau avec un
  // fond gris — que ce soit à la DA du jeu, là ça va pas du tout »).
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

// Effets du TURBO LAIT : flou de vitesse (v2, vue de profil) — voile sur le
// bord qui arrive et traits HORIZONTAUX qui filent vers la gauche. Les
// couleurs saturées viennent du CSS (canvas.turbo).
export function renderTurbo(ctx, width, height, t, force) {
  if (force <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = force * 0.75;
  // Plus de voile blanc sur le bord droit (20 septembre 2026 : « quand on a
  // pris une brique de lait, t'as des overlays blancs sur la droite, enlève
  // l'overlay blanc ») : il ne reste que les traits de vitesse.
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 14; i++) {
    const y = height * (0.2 + ((i * 0.618) % 1) * 0.7);
    const len = 50 + (i * 37) % 110;
    const x = width - ((t * (1100 + i * 80) + i * 173) % (width + len));
    ctx.fillRect(x, y, len, 2);
  }
  ctx.restore();
}

// « Qui tu vas croiser » : le bestiaire du début de course (20 septembre
// 2026 : « le mec qui lance ses poules, je connais le jeu mais les gens ne
// vont pas le voir — il faudra mettre un panneau au tout début qui présente
// tous les types d'ennemis »). Les vignettes sont dessinées par le VRAI
// moteur (main.js les pré-rend une fois), le geste est écrit à côté.
export function renderBestiaire(ctx, width, height, alpha, groupes, safeTop = 0, index = 0, restant = 0) {
  if (alpha <= 0.01 || !groupes || !groupes.length) return;
  const g = groupes[Math.min(index, groupes.length - 1)];
  const w = Math.min(width - 32, 330), h = 150;
  const x = width / 2 - w / 2, y = Math.max(safeTop + 104, height * 0.15);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  // Même carte blanche à bord noir que le reste du jeu.
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, 3); ctx.fill();
  ctx.strokeStyle = NOIR; ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 3); ctx.stroke();
  // Onglet rouge de travers : « QUI TU VAS CROISER », plus le décompte.
  ctx.save();
  ctx.translate(x + 16 + 86, y);
  ctx.rotate(-0.035);
  ctx.fillStyle = ROUGE;
  ctx.fillRect(-86, -8, 172, 16);
  ctx.strokeStyle = NOIR; ctx.lineWidth = 1.2;
  ctx.strokeRect(-86, -8, 172, 16);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 9px ${POLICE}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("QUI TU VAS CROISER", 0, 0.5);
  ctx.restore();
  // Les vignettes de la famille en cours, dessinées par le vrai moteur.
  const ih = 66;
  let total = 0;
  for (const img of g.images) total += ih * (img.width / img.height) + 6;
  let vx = width / 2 - total / 2;
  for (const img of g.images) {
    const iw = ih * (img.width / img.height);
    ctx.drawImage(img, vx, y + 22, iw, ih);
    vx += iw + 6;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = NOIR;
  fitFont(ctx, "900", 21, g.geste, w - 28, 12);
  ctx.fillText(g.geste, width / 2, y + 94);
  ctx.font = `500 12px ${POLICE}`;
  ctx.fillStyle = "rgba(13,13,16,0.6)";
  ctx.fillText(g.texte, width / 2, y + 120);
  // Décompte de 10 et pastilles d'étape, en bas à droite de la carte.
  ctx.font = `800 11px ${POLICE}`;
  ctx.fillStyle = "rgba(13,13,16,0.45)";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.max(0, restant)}`, x + w - 12, y + h - 18);
  for (let i = 0; i < groupes.length; i++) {
    ctx.fillStyle = i === index ? ROUGE : "rgba(13,13,16,0.2)";
    roundRect(ctx, x + 12 + i * 12, y + h - 14, 8, 5, 2);
    ctx.fill();
  }
  ctx.restore();
}

// Tutoriel du tout début : une consigne à la fois, en gros, jusqu'au geste.
// Même carte que le reste du jeu depuis le 28 septembre 2026 (« je veux une
// cohérence dans les menus ») : blanche à bord noir, onglet rouge de travers
// (jaune quand l'étape est réussie), titre en serif noire — c'était le seul
// panneau encore sombre et translucide.
export function renderTuto(ctx, width, height, tuto) {
  if (!tuto) return;
  ctx.save();
  const w = Math.min(width - 32, 330), h = tuto.sous ? 92 : 70;
  const x = width / 2 - w / 2, y = tuto.y !== undefined ? tuto.y : height * 0.3; // en HAUT, sous le score (29 septembre 2026)
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
  ctx.fillRect(-50, -8, 100, 16);
  ctx.strokeStyle = NOIR; ctx.lineWidth = 1.2;
  ctx.strokeRect(-50, -8, 100, 16);
  ctx.fillStyle = tuto.ok ? NOIR : BLANC;
  ctx.font = `800 9px ${POLICE}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(onglet, 0, 0.5);
  ctx.restore();
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  let t = 24; ctx.font = `900 ${t}px ${POLICE_TITRE}`;
  while (ctx.measureText(tuto.titre).width > w - 28 && t > 14) { t -= 1; ctx.font = `900 ${t}px ${POLICE_TITRE}`; }
  ctx.fillStyle = NOIR;
  ctx.fillText(tuto.titre, width / 2, y + 22);
  if (tuto.sous) {
    fitFont(ctx, "500", 12, tuto.sous, w - 28, 9);
    ctx.fillStyle = "rgba(13,13,16,0.6)";
    ctx.fillText(tuto.sous, width / 2, y + 58);
  }
  ctx.restore();
}

// Fin du morceau = fin de la course. Refait le 27 septembre 2026 (« quand il
// y a marqué Terminé, c'est quand même pas très esthétique ») : plus de voile
// blanc ni de serif condensée en contour noir, mais le STICKER rouge posé de
// travers de toute la DA (cartes, onglets, e-card de l'EP), qui tombe sur
// l'écran avec un rebond, et une ligne dessous.
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

// Pastille d'annonce (3 octobre 2026) : petite, au-dessus d'un cycliste, là où
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
  ctx.fillStyle = "rgba(8,8,12,0.74)";
  ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.arc(p.x, p.y, r, 0, Math.PI * 2, true); ctx.fill("evenodd");
  ctx.strokeStyle = JAUNE; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
  // Texte sous l'objet, ou au-dessus s'il est bas dans l'écran.
  const dessous = p.y < height * 0.55;
  const y0 = dessous ? p.y + r + 34 : p.y - r - 70;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  fitFont(ctx, "900", 24, info.titre, width - 40, 14);
  ctx.fillStyle = JAUNE; ctx.fillText(info.titre, width / 2, y0);
  ctx.font = `600 14px ${POLICE}`; ctx.fillStyle = BLANC;
  const lignes = couper(ctx, info.sous, Math.min(300, width - 48));
  lignes.forEach((l, i) => ctx.fillText(l, width / 2, y0 + 28 + i * 19));
  if (p.age > 0.5) {
    ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * 5));
    ctx.font = `900 13px ${POLICE}`; ctx.fillStyle = BLANC;
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
