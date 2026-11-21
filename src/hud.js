// hud.js — Interface peinte dans le canvas pendant la course : le SCORE en
// gros (serif de l'e-card, en « pts » : tout le monde fait la même distance,
// ce qui départage ce sont les potes et les pièces), le multiplicateur, le
// nombre de potes et la prochaine étape, le décompte 3-2-1-GO, les tutos.
// Le canvas ne lit pas les variables CSS : mêmes valeurs qu'index.html.

const BLANC = "#ffffff";
const NOIR = "#0d0d10";
const JAUNE = "#ffcf2e";
const ROUGE = "#e13e26";
// Le même rouge, juste assez foncé pour porter du texte BLANC en AA (4,63:1 au
// lieu de 4,25:1) : réservé aux pastilles écrites, jamais au décor peint.
const ROUGE_TXT = "#c9341d"; // 5,2:1 sous du blanc (#d93820 tombait à 4,35:1 en fondu)
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
//
// ⚠️ LE BANDEAU N'EST PLUS ÉCRIT À MÊME LE CIEL (21 novembre 2026). Le ciel
// change tout le temps : le même score noir passait de 15:1 sur un ciel clair
// à 2,38:1 sur un nuage sombre. Trois réponses ont été essayées :
//   13 nov. : un LISERÉ de la couleur opposée — refusé (« pas de contour ») ;
//   15 nov. : un HALO flou sous les lettres — refusé le 21 (« un gros sujet
//             d'ombre, très moche, je veux pas d'ombre derrière les textes ») ;
//   21 nov. : des PLAQUES à plat — blanc, bord noir 1,5 px, rayon 4 px : la
//             carte du menu, le bouton pause, les pastilles « LOLA EST LÀ ».
// Plus aucun shadowBlur ni strokeText sur du texte dans tout le jeu : un texte
// peint dans le canvas est soit sur une plaque, soit sur un voile sombre plein.
export function plaque(ctx, x, y, w, h, fond = BLANC) {
  ctx.fillStyle = fond;
  roundRect(ctx, x, y, w, h, 4); ctx.fill();
  ctx.strokeStyle = NOIR; ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 4); ctx.stroke();
}
export function renderHud(ctx, width, height, hud) {
  ctx.save();
  const top = hud.safeTop || 0;
  ctx.textBaseline = "top";
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  const clair = hud.nuit > 0.5 || (hud.plage || 0) > 0.35;
  const TXT = clair ? BLANC : NOIR, TXT_VIDE = clair ? "rgba(255,255,255,0.28)" : "rgba(13,13,16,0.22)";

  // --- Droite : une plaque « ×1,5  2 POTES », et dessous la prochaine étape.
  const total = hud.potesMax;
  const xD = width - 14, y1 = top + 16, H1 = 30;
  const libelle = total === 0 ? "INVITE TES POTES" : hud.potes === 0 ? "TOUT SEUL" : hud.potes === 1 ? "1 POTE" : `${hud.potes} POTES`;
  ctx.font = `900 14px ${POLICE}`;
  const wLib = ctx.measureText(libelle).width;
  const etape = total > 0 && !hud.plein;
  // LA PROCHAINE ÉTAPE SE DESSINE (21 novembre 2026 : « au lieu d'écrire "une
  // pièce", tu mets des pièces […] dès que tu en récoltes une, ça passe à 2 ») :
  // autant de pièces qu'il en reste à ramasser avant le prochain pote. Au-delà
  // de 6, une pièce et « ×12 », comme le compteur d'un Mario Kart.
  const nPieces = etape ? Math.max(1, Math.ceil(hud.restant)) : 0;
  const R_P = 6.5, PAS_P = 16, enRang = nPieces <= 6;
  ctx.font = `900 13px ${POLICE}`;
  const wCompte = etape && !enRang ? ctx.measureText(`×${nPieces}`).width + 4 : 0;
  const wEtape = 0;
  const wL2 = etape ? (enRang ? (nPieces - 1) * PAS_P + 2 * R_P : 2 * R_P + wCompte) : 0;
  let txtMult = "", wMult = 0;
  if (hud.mult > 1.001) { txtMult = `×${String(hud.mult).replace(".", ",")}`; ctx.font = `900 13px ${POLICE}`; wMult = ctx.measureText(txtMult).width + 12; }
  const wD = Math.max(wLib + (wMult ? wMult + 7 : 0), wEtape, wL2) + 20;
  const hD = etape ? H1 + 24 : H1;
  const xG = xD - wD;
  plaque(ctx, xG, y1, wD, hD);
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.font = `900 14px ${POLICE}`;
  ctx.fillStyle = NOIR;
  ctx.fillText(libelle, xD - 10, y1 + H1 / 2 + 1);
  if (wMult) {
    const xP = xD - 10 - wLib - 7 - wMult;
    ctx.fillStyle = hud.turbo ? ROUGE_TXT : JAUNE;
    roundRect(ctx, xP, y1 + 5, wMult, H1 - 10, 3); ctx.fill();
    ctx.fillStyle = hud.turbo ? BLANC : "#4a3305";
    ctx.textAlign = "center";
    ctx.font = `900 13px ${POLICE}`;
    ctx.fillText(txtMult, xP + wMult / 2, y1 + H1 / 2 + 1);
  }
  if (etape) {
    ctx.fillStyle = "rgba(13,13,16,0.14)";
    ctx.fillRect(xG + 10, y1 + H1 - 1, wD - 20, 1);
    const yP = y1 + H1 + 11;
    const piece = (cxp) => {
      ctx.fillStyle = JAUNE; ctx.strokeStyle = NOIR; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cxp, yP, R_P, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#c98a00"; ctx.fillRect(cxp - 1, yP - 3, 2, 6);
    };
    if (enRang) for (let i = 0; i < nPieces; i++) piece(xD - 10 - R_P - i * PAS_P);
    else {
      ctx.textAlign = "right"; ctx.font = `900 13px ${POLICE}`; ctx.fillStyle = NOIR;
      ctx.fillText(`×${nPieces}`, xD - 10, yP + 1);
      piece(xD - 10 - wCompte - R_P);
    }
  }

  // --- Centre : les points, au MILIEU DE L'ÉCRAN, sur leur plaque. Ils
  // rapetissent plutôt que de toucher le bouton pause ou le bloc de droite ;
  // sur un écran étroit où le milieu est pris, ils se rangent entre les deux.
  const leftEnd = 14 + 46 + 8, rightStart = xG - 8;
  let cx = width / 2;
  if (2 * Math.min(cx - leftEnd, rightStart - cx) < 96) cx = (leftEnd + rightStart) / 2;
  const centerW = 2 * Math.min(cx - leftEnd, rightStart - cx);
  const num = formatMetres(hud.metres);
  let taille = 30;
  ctx.font = `700 12px ${POLICE}`;
  const wUnit = ctx.measureText(" pts").width;
  ctx.font = `900 ${taille}px ${POLICE_TITRE}`;
  while (ctx.measureText(num).width + wUnit + 24 > centerW && taille > 16) { taille -= 1; ctx.font = `900 ${taille}px ${POLICE_TITRE}`; }
  const wNum = ctx.measureText(num).width;
  const wS = wNum + wUnit + 24, hS = 46;
  plaque(ctx, cx - wS / 2, y1, wS, hS);
  const x0 = cx - (wNum + wUnit) / 2, yS = y1 + hS / 2;
  ctx.fillStyle = NOIR;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(num, x0, yS + taille * 0.34);
  ctx.font = `700 12px ${POLICE}`;
  ctx.fillText(" pts", x0 + wNum, yS + taille * 0.34);

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
  // Plus de bandeau écrit sous le doigt (15 novembre 2026, « enlève le texte
  // au début ») : le geste animé suffit.
  ctx.restore();
}

// Le jetpack : un doigt qui APPUIE et RESTE appuyé, l'anneau se remplit
// pendant qu'il tient. Dit « reste appuyé pour voler » sans un mot.
export function renderHoldHint(ctx, width, height, t, alpha) {
  if (alpha <= 0.01) return;
  const cyc = 1.6, ph = (t % cyc) / cyc;
  const x = width / 2, y = height * 0.62;
  const appuye = ph > 0.18 && ph < 0.88;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.stroke();
  if (appuye) {
    const k = (ph - 0.18) / 0.7;
    ctx.strokeStyle = JAUNE;
    ctx.beginPath(); ctx.arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
  }
  const dy = ph < 0.18 ? 14 * (1 - ph / 0.18) : ph > 0.88 ? 14 * ((ph - 0.88) / 0.12) : 0;
  dessinerMain(ctx, x - 18, y - 6 + dy, 44 / 48);
  ctx.restore();
}

// Décompte « 3, 2, 1, C'EST PARTI ! » calé sur les temps (voir main.js).
// ⚠️ Plus AUCUN texte dessous depuis le 15 novembre 2026 (« enlève le texte
// au début, tu mets juste 3, 2, 1, c'est parti ») : ni le rappel de la
// ligue, ni « monte le son » — la carte « Monte le son » le dit avant.
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
    texte = "C'EST PARTI !";
    age = t;
  }
  const tPop = Math.min(1, age / 0.22);
  const scale = 1.45 - 0.45 * tPop;
  const alpha = t < 0 ? 1 : Math.max(0, 1 - (t / linger) ** 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(width / 2, Math.max(height * 0.3, 190));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let taille = t < 0 ? 72 : 40;
  ctx.font = `900 ${taille}px ${POLICE_TITRE}`;
  // « C'EST PARTI ! » à 1,45× au premier instant ne doit pas sortir de l'écran.
  while ((ctx.measureText(texte).width + taille * 0.7) * 1.45 > width - 24 && taille > 20) { taille -= 2; ctx.font = `900 ${taille}px ${POLICE_TITRE}`; }
  ctx.scale(scale, scale);
  // LE STICKER ROUGE DE TRAVERS de toute la DA (onglets des cartes, « TERMINÉ »)
  // porte le chiffre : à plat, sans ombre, lisible sur n'importe quel ciel.
  ctx.rotate(-0.045);
  const w = Math.max(ctx.measureText(texte).width + taille * 0.7, taille * 1.25), h = taille * 1.25;
  ctx.fillStyle = ROUGE_TXT;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = NOIR; ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = BLANC;
  ctx.fillText(texte, 0, taille * 0.04);
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
  ctx.fillStyle = tuto.ok ? JAUNE : ROUGE_TXT;   // porte du blanc en 11 px : AA
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
    ctx.font = `700 14px ${POLICE}`;
    const ws = Math.min(width - 24, ctx.measureText(sous).width + 28), ys = cy + 46 + (1 - a2) * 8;
    plaque(ctx, width / 2 - ws / 2, ys, ws, 30);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = NOIR;
    ctx.fillText(sous, width / 2, ys + 16, ws - 16);
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
  // `jaune` : true (jaune), false (blanc) ou une couleur ; le rouge porte du blanc.
  const fond = jaune === true ? JAUNE : !jaune ? BLANC : jaune === ROUGE ? ROUGE_TXT : jaune;
  ctx.fillStyle = fond; ctx.strokeStyle = NOIR; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.rect(Math.round(x - w / 2) + 0.5, Math.round(y - h) + 0.5, Math.round(w), h); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fond === ROUGE_TXT ? BLANC : NOIR; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(texte, x, y - h / 2 + 0.5);
  ctx.restore();
}

// Projecteur : tout l'écran assombri sauf un cercle autour de l'objet, le
// nom de l'objet en jaune, une phrase, et « touche pour continuer ».
// Le CERCLE sur le danger d'une consigne : pendant qu'on explique un geste, le
// reste de l'écran s'assombrit en fondu et un anneau se pose sur ce qu'il faut
// franchir. Contrairement au projecteur (renderProjecteur), le monde n'est pas
// gelé et rien ne bloque : c'est le tuto contextuel qui garde la main.
export function renderCible(ctx, width, height, c, alpha, t) {
  if (alpha <= 0.01) return;
  const r = c.r * (1 + 0.045 * Math.sin(t * 7));
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  const voile = ctx.createRadialGradient(c.x, c.y, r * 1.05, c.x, c.y, r * 3);
  voile.addColorStop(0, "rgba(8,8,12,0)");
  voile.addColorStop(1, "rgba(8,8,12,0.58)");
  ctx.fillStyle = voile;
  ctx.fillRect(0, 0, width, height);
  // Anneau blanc plein, filet rouge autour : il se lit sur le ciel comme sur la nuit.
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(255,255,255,0.96)";
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(225,62,38,${0.55 + 0.35 * Math.sin(t * 7)})`;
  ctx.beginPath(); ctx.arc(c.x, c.y, r + 6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

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
