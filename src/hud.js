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

// `hud` = { metres, potes, potesMax, gaugeT, mult, restant, elan, restantS, turbo, safeTop }
// Disposition (7 septembre 2026, « en haut tout se marche dessus ») :
//   gauche  : pause (DOM), et SOUS lui la barre SALTO ;
//   centre  : les mètres (taille adaptée au nombre de chiffres), le chrono ;
//   droite  : les 8 cases, « N POTES », la jauge du prochain.
// La pastille ×N vit SOUS le chrono, et le bandeau d'événement plus bas
// encore (renderBanner) : trois étages qui ne se chevauchent jamais.
export function renderHud(ctx, width, height, hud) {
  ctx.save();
  const top = hud.safeTop || 0;
  // Ni bandeau sombre, ni contour noir (20 septembre 2026 : « les points en
  // haut, c'est super, mais enlève le contour noir — laisse le texte blanc,
  // avec une ombre portée à 25 % d'opacité, ça fera très bien le taf »).
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowOffsetY = 2;
  const ecrire = (txt, x, y, taille = 0) => { ctx.shadowBlur = Math.max(3, taille * 0.12); ctx.fillText(txt, x, y); };

  // Colonnes : gauche = 14..(14+96), droite = 8 cases de 10 px.
  const cell = 10, gap = 3, total = hud.potesMax;
  const rowW = Math.max(60, total * cell + (total - 1) * gap);
  const rx = width - PAD - rowW;
  const leftEnd = 14 + 96 + 10, rightStart = rx - 10;
  const centerW = rightStart - leftEnd;
  const cx = (leftEnd + rightStart) / 2;

  // Mètres : serif, taille réduite si ça ne tient pas entre les colonnes.
  const num = formatMetres(hud.metres);
  let taille = 40;
  ctx.font = `900 ${taille}px ${POLICE_TITRE}`;
  while (ctx.measureText(num).width + 22 > centerW && taille > 22) { taille -= 2; ctx.font = `900 ${taille}px ${POLICE_TITRE}`; }
  const wNum = ctx.measureText(num).width;
  ctx.font = `700 14px ${POLICE}`;
  const wUnit = ctx.measureText(" pts").width;
  const x0 = cx - (wNum + wUnit) / 2;
  ctx.fillStyle = BLANC;
  ctx.textAlign = "left";
  ctx.font = `900 ${taille}px ${POLICE_TITRE}`;
  ecrire(num, x0, top + PAD - 6, taille);
  ctx.font = `700 14px ${POLICE}`;
  ecrire(" pts", x0 + wNum, top + PAD + taille * 0.5 - 4, 14);

  // Chrono sous les mètres.
  if (hud.restantS !== undefined) {
    const s = Math.max(0, hud.restantS);
    ctx.font = `700 12px ${POLICE}`;
    ctx.textAlign = "center";
    ctx.fillStyle = s <= 10 ? ROUGE : BLANC;
    ecrire(`${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`, cx, top + PAD + taille * 0.9 + 2, 12);
  }
  // Pastille ×N sous le chrono.
  if (hud.mult > 1.001) {
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    const txt = `×${String(hud.mult).replace(".", ",")}${hud.turbo ? " TURBO" : ""}`;
    ctx.font = `900 12px ${POLICE}`;
    const w = ctx.measureText(txt).width + 16;
    ctx.fillStyle = JAUNE;
    roundRect(ctx, cx - w / 2, top + PAD + taille * 0.9 + 18, w, 20, 3);
    ctx.fill();
    ctx.fillStyle = "#4a3305";
    ctx.textAlign = "center";
    ctx.fillText(txt, cx, top + PAD + taille * 0.9 + 22);
    ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowOffsetY = 2;
  }

  // Droite : cases, compte, jauge. Les aplats ne portent pas l'ombre du texte.
  const sansOmbre = () => { ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; };
  const avecOmbre = () => { ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowOffsetY = 2; };
  const ry = top + PAD + 2;
  sansOmbre();
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < hud.potes ? BLANC : "rgba(255,255,255,0.28)";
    roundRect(ctx, rx + i * (cell + gap), ry, cell, cell, 2);
    ctx.fill();
  }
  avecOmbre();
  ctx.font = `700 11px ${POLICE}`;
  ctx.textAlign = "right";
  ctx.fillStyle = BLANC;
  ecrire(total === 0 ? "INVITE TES POTES" : hud.potes === 0 ? "TOUT SEUL" : hud.potes === 1 ? "1 POTE" : `${hud.potes} POTES`, width - PAD, ry + cell + 5, 11);
  if (total > 0 && !hud.plein) {
    sansOmbre();
    const gy = ry + cell + 22;
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    roundRect(ctx, rx, gy, rowW, 4, 2);
    ctx.fill();
    ctx.fillStyle = JAUNE;
    roundRect(ctx, rx, gy, Math.max(4, rowW * Math.min(1, hud.gaugeT)), 4, 2);
    ctx.fill();
    avecOmbre();
    fitFont(ctx, "700", 10, `PROCHAIN POTE : ${hud.restant}`, rowW + 30, 8);
    ctx.fillStyle = JAUNE;
    ecrire(`PROCHAIN POTE : ${hud.restant} PIÈCE${hud.restant > 1 ? "S" : ""}`, width - PAD, gy + 9, 10);
  }

  ctx.restore();
}

// Décompte « 3, 2, 1, GO » calé sur les temps (voir main.js).
export function renderCountIn(ctx, width, height, t, beatPeriod, beats, linger) {
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
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 18;
  ctx.font = `900 ${t < 0 ? 78 : 64}px ${POLICE_TITRE}`;
  ctx.fillStyle = t < 0 ? BLANC : JAUNE;
  ctx.fillText(texte, 0, 0);
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
  ctx.shadowColor = "rgba(0,0,0,0.25)";
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
export function renderBanner(ctx, width, height, banner, safeTop = 0) {
  if (!banner || banner.timer <= 0) return;
  const age = banner.duree - banner.timer;
  ctx.save();
  ctx.globalAlpha = Math.min(1, banner.timer * 2, age * 6);
  const maxW = Math.min(width - 48, 330);
  let ft = 20; ctx.font = `900 ${ft}px ${POLICE_TITRE}`;
  while (ctx.measureText(banner.titre).width > maxW - 44 && ft > 12) { ft -= 1; ctx.font = `900 ${ft}px ${POLICE_TITRE}`; }
  const w = Math.max(170, Math.min(maxW, ctx.measureText(banner.titre).width + 46));
  const h = banner.sous ? 56 : 40;
  const y = safeTop + 150;
  const tPop = Math.min(1, age / 0.3);
  const scale = 0.85 + 0.15 * tPop + 0.05 * Math.sin(tPop * Math.PI);
  ctx.translate(width / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-width / 2, -(y + h / 2));
  const x = (width - w) / 2;
  // Carte BLANCHE à bord noir, comme les panneaux du jeu et l'e-card de l'EP
  // (20 septembre 2026 : « quand il y a Hugo affiché, pas un panneau avec un
  // fond gris — que ce soit à la DA du jeu, là ça va pas du tout »).
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  roundRect(ctx, x + 2, y + 4, w, h, 3); ctx.fill();
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, 3); ctx.fill();
  ctx.strokeStyle = NOIR; ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 3); ctx.stroke();
  // L'onglet de couleur, posé de travers à cheval sur le bord haut.
  const tw = Math.min(w - 30, 92), th = 15;
  ctx.save();
  ctx.translate(x + 18 + tw / 2, y);
  ctx.rotate(-0.035);
  ctx.fillStyle = banner.couleur;
  ctx.fillRect(-tw / 2, -th / 2, tw, th);
  ctx.strokeStyle = NOIR; ctx.lineWidth = 1.2;
  ctx.strokeRect(-tw / 2, -th / 2, tw, th);
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
  ctx.globalAlpha = force;
  const g = ctx.createLinearGradient(width, 0, width * 0.7, 0);
  g.addColorStop(0, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(width * 0.7, 0, width * 0.3, height);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  for (let i = 0; i < 16; i++) {
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
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  roundRect(ctx, x + 2, y + 4, w, h, 3); ctx.fill();
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
export function renderTuto(ctx, width, height, tuto) {
  if (!tuto) return;
  ctx.save();
  const w = Math.min(width - 32, 340), h = tuto.sous ? 96 : 74;
  const x = width / 2 - w / 2, y = height * 0.3;
  ctx.globalAlpha = tuto.alpha;
  ctx.fillStyle = PANNEAU;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = tuto.ok ? JAUNE : BLANC;
  roundRect(ctx, x, y, w, 3, 1);
  ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.font = `700 10px ${POLICE}`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(tuto.ok ? "BIEN !" : `TUTO ${tuto.index}/${tuto.total}`, width / 2, y + 12);
  let t = 26; ctx.font = `900 ${t}px ${POLICE_TITRE}`;
  while (ctx.measureText(tuto.titre).width > w - 24 && t > 14) { t -= 1; ctx.font = `900 ${t}px ${POLICE_TITRE}`; }
  ctx.fillStyle = tuto.ok ? JAUNE : BLANC;
  ctx.fillText(tuto.titre, width / 2, y + 26);
  if (tuto.sous) {
    fitFont(ctx, "500", 13, tuto.sous, w - 24, 9);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(tuto.sous, width / 2, y + 60);
  }
  ctx.restore();
}

// Fin du morceau = fin de la course : « TERMINÉ ! » en énorme, en serif.
export function renderFin(ctx, width, height, age) {
  const tPop = Math.min(1, age / 0.25);
  ctx.save();
  ctx.globalAlpha = Math.min(1, age * 4);
  ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.8 - age * 1.2)})`;
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height * 0.34);
  const sc = 1.4 - 0.4 * tPop;
  ctx.scale(sc * 0.66, sc); // condensé comme le titre « j'ai un pote » (scaleX 0,66)
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.min(74, width * 0.19)}px ${POLICE_TITRE}`;
  ctx.fillStyle = NOIR;
  ctx.fillText("terminé !", 4, 4);
  ctx.fillStyle = BLANC;
  ctx.fillText("terminé !", 0, 0);
  ctx.restore();
}
