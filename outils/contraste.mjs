// contraste.mjs — Le contraste de TOUT ce qui est écrit, du menu à la fin du
// morceau (`node outils/contraste.mjs [--detail]`).
//
// POURQUOI UN TEST DE PLUS. axe-core (outils/accessibilite.mjs) ne voit que le
// DOM : pour lui, le canvas est une image, et les textes qui comptent le plus
// pendant une partie — le score, « +1 POTE », « TURBO ! », les tutos, les
// alertes, le décompte, l'écran de fin — n'ont JAMAIS été mesurés. Or ils sont
// écrits par-dessus un décor qui change tout le temps : village, montagne,
// grotte, nuit, plage, coucher de soleil.
//
// COMMENT. On enveloppe `fillText`/`strokeText` : avant chaque texte on
// photographie les pixels DERRIÈRE lui, après on regarde lesquels ont changé
// (l'encre), et on calcule le rapport de contraste WCAG entre la couleur du
// texte et ce qu'il y avait dessous, pixel par pixel. Ce qui est JUGÉ, c'est
// le 5e percentile de ces rapports, pas le pire pixel isolé : WCAG compare une
// couleur de texte à une couleur de fond, et une poignée de pixels
// d'anticrénelage au bord d'une pastille ne rend rien illisible. Le pire pixel
// et la moyenne restent affichés à côté, pour juger sur pièce.
// Puis on joue la course entière, image par image (mode vidéo du harnais), en
// déclenchant turbo, jetpack, conseils et tutos.
//
// SEUILS (WCAG 2.1, 1.4.3 AA) : 4,5:1 pour un texte normal, 3:1 pour un grand
// texte (≥ 24 px, ou ≥ 18,66 px en gras). Un texte CERNÉ (un `strokeText` sous
// le même texte) est jugé sur son contour : c'est lui qui le détache du décor.
//
// LIMITES ASSUMÉES, écrites noir sur blanc :
//   - les textes mesurés à mi-fondu ne comptent pas (`globalAlpha` < 0,92) :
//     on mesure un texte dans son état lisible, pas pendant son apparition ;
//   - le canvas porte un filtre CSS permanent `saturate(1.28) contrast(1.03)`
//     qui ne peut qu'AMÉLIORER les chiffres d'ici (le contraste réel est
//     légèrement meilleur), sauf à la mort où `grayscale(1)` enlève la
//     couleur : cette colonne-là est calculée en plus (voir « gris »).
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
import { installerPilote } from "./pilote.mjs";

const detail = process.argv.includes("--detail");
// --dom : sauter la course et n'auditer que les écrans HTML (quelques secondes,
// pour itérer sur une couleur du règlement ou d'un tiroir).
const domSeul = process.argv.includes("--dom");
const racine = fileURLToPath(new URL("..", import.meta.url));
const sorties = fileURLToPath(new URL("./sorties/", import.meta.url));
mkdirSync(sorties, { recursive: true });

const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5187, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
// Base simulée : rien ne sort, et le classement de fin a de quoi s'afficher.
await contexte.route(/supabase\.co/, (route) => {
  const r = route.request(), table = new URL(r.url()).pathname.split("/").pop();
  if (r.method() !== "GET") return route.fulfill({ status: 201, body: "" });
  const j = (rang, pseudo, metres, commission) => ({ rang, pseudo, metres, commission, potes: 2, code: "ESSAI", nom: "Ligue d'essai", total: metres + commission, classes: 40 });
  let corps = [];
  if (table === "concours") corps = [{ id: 1, debut: "2026-11-02T07:00:00Z", fin: "2026-11-22T11:00:00Z", plafond_score: 110000, commission: 0.1 }];
  else if (table === "concours_joueurs") corps = [j(1, "tom", 9000, 400), j(2, "lola", 8000, 300), j(3, "sam", 7000, 200), j(4, "pmc", 5000, 100)];
  else if (table === "concours_ligues") corps = [{ code: "ESSAI", nom: "Ligue d'essai", joueurs: 7, total: 20000 }];
  else if (table === "ligue_membres") corps = [{ pseudo: "pmc", skin: null }, { pseudo: "lola", skin: null }];
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
});
const page = await contexte.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));

// ---------------------------------------------------------------------------
// L'INSTRUMENT, posé avant que le jeu ne crée son contexte 2D.
// ---------------------------------------------------------------------------
await page.addInitScript(() => {
  const P = CanvasRenderingContext2D.prototype;
  const vrai = { fill: P.fillText, stroke: P.strokeText };
  const sonde = (window.__contraste = {
    actif: false, scene: "", t: 0, mesures: new Map(), contours: new Map(), n: 0,
    alertes: [], vus: new Set(), contour: null,
  });

  const lum = (r, g, b) => {
    const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const rapport = (a, b) => { const x = lum(...a), y = lum(...b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Le gris que donnerait le filtre `grayscale(1)` du canvas à la mort.
  const gris = ([r, g, b]) => { const v = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b); return [v, v, v]; };

  const sonde2 = document.createElement("span");
  const cacheCouleur = new Map();
  function versRgb(style) {
    if (typeof style !== "string") return null;
    if (cacheCouleur.has(style)) return cacheCouleur.get(style);
    sonde2.style.color = ""; sonde2.style.color = style;
    if (!sonde2.style.color) { cacheCouleur.set(style, null); return null; }
    document.documentElement.appendChild(sonde2);
    const m = getComputedStyle(sonde2).color.match(/[\d.]+/g);
    sonde2.remove();
    // Le 4e nombre est l'alpha : un contour à moitié transparent ne détache
    // pas franchement le texte, on ne lui accordera rien.
    const v = m ? [Number(m[0]), Number(m[1]), Number(m[2]), m[3] === undefined ? 1 : Number(m[3])] : null;
    cacheCouleur.set(style, v);
    return v;
  }

  function mesurer(ctx, type, texte, x, y, args) {
    const t = String(texte);
    if (!t.trim() || ctx.globalAlpha < 0.92) return false;
    const couleur = versRgb(type === "fill" ? ctx.fillStyle : ctx.strokeStyle);
    if (!couleur) return false; // dégradé ou motif : on ne sait pas dire sa couleur
    let m; try { m = ctx.measureText(t); } catch (e) { return false; }
    const asc = m.actualBoundingBoxAscent || 10, desc = m.actualBoundingBoxDescent || 2;
    const al = ctx.textAlign, bl = ctx.textBaseline;
    const gx = x - (al === "center" ? m.width / 2 : al === "right" || al === "end" ? m.width : 0);
    let gy = y;
    if (bl === "middle") gy = y + (asc - desc) / 2;
    else if (bl === "top" || bl === "hanging") gy = y + asc;
    else if (bl === "bottom") gy = y - desc;
    const x0 = gx, x1 = gx + m.width, y0 = gy - asc, y1 = gy + desc;
    const T = ctx.getTransform();
    const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([px, py]) => [T.a * px + T.c * py + T.e, T.b * px + T.d * py + T.f]);
    const marge = 2;
    const bx = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])) - marge));
    const by = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])) - marge));
    const bw = Math.min(ctx.canvas.width - bx, Math.ceil(Math.max(...pts.map((p) => p[0])) + marge) - bx);
    const bh = Math.min(ctx.canvas.height - by, Math.ceil(Math.max(...pts.map((p) => p[1])) + marge) - by);
    if (bw < 3 || bh < 3) return false;

    let avant;
    try { avant = ctx.getImageData(bx, by, bw, bh).data; } catch (e) { return false; }
    vrai[type].apply(ctx, args);
    let apres;
    try { apres = ctx.getImageData(bx, by, bw, bh).data; } catch (e) { return true; }

    // L'encre : les pixels franchement changés. Le reste est de l'anticrénelage.
    // Un texte CERNÉ se juge sur le meilleur des deux : sa couleur ou celle de
    // son liseré, contre le fond. Noir cerné de blanc reste lisible partout —
    // c'est le liseré qui prend le relais quand le fond rejoint le texte.
    const c = sonde.contour;
    const liseret = c && c.texte === t && sonde.n - c.n <= 1 && c.couleur[3] >= 0.95 ? c.couleur : null;
    let pire = Infinity, pireGris = Infinity, somme = 0, n = 0;
    const tous = [];
    for (let i = 0; i < avant.length; i += 4) {
      const d = Math.max(Math.abs(apres[i] - avant[i]), Math.abs(apres[i + 1] - avant[i + 1]), Math.abs(apres[i + 2] - avant[i + 2]));
      if (d < 48) continue;
      const fond = [avant[i], avant[i + 1], avant[i + 2]];
      const r = liseret ? Math.max(rapport(couleur, fond), rapport(liseret, fond)) : rapport(couleur, fond);
      if (r < pire) pire = r;
      tous.push(r);
      const rg = liseret ? Math.max(rapport(gris(couleur), gris(fond)), rapport(gris(liseret), gris(fond))) : rapport(gris(couleur), gris(fond));
      pireGris = Math.min(pireGris, rg);
      somme += r; n++;
    }
    if (!n) return true;
    tous.sort((a, b) => a - b);
    const bas = tous[Math.floor(tous.length * 0.05)];   // 5e percentile

    const taille = Number((ctx.font.match(/(\d+(?:\.\d+)?)px/) || [0, 12])[1]);
    const gras = /\b([6-9]00|bold)/.test(ctx.font);
    const grand = taille >= 24 || (gras && taille >= 18.66);
    const origine = (new Error().stack.split("\n")[3] || "").match(/\/src\/([\w.-]+\.js):(\d+)/);
    // Les chiffres ne font pas un texte différent : « 1 901 » et « 1 902 »,
    // c'est LE SCORE. Sinon la liste se remplit de la même ligne mille fois.
    if (origine && origine[1] === "debug.js") return true;   // le calque ?debug n'est pas le jeu
    const cle = `${type}|${t.slice(0, 28).replace(/[\d\u202f\u00a0 ]+/g, "N")}|${couleur.join(",")}|${Math.round(taille)}`;
    const avantE = sonde.mesures.get(cle);
    const e = { type, texte: t.slice(0, 28), couleur: `rgb(${couleur.slice(0, 3).join(",")})`, cerne: !!liseret, taille: Math.round(taille), grand, seuil: grand ? 3 : 4.5,
                bas: Math.round(bas * 100) / 100, pire: Math.round(pire * 100) / 100, pireGris: Math.round(pireGris * 100) / 100, moyen: Math.round((somme / n) * 100) / 100,
                scene: sonde.scene, t: Math.round(sonde.t * 10) / 10, ou: origine ? `${origine[1]}:${origine[2]}` : "?" };
    if (!avantE || e.bas < avantE.bas) sonde.mesures.set(cle, e);
    if (e.bas < e.seuil && type === "fill" && !sonde.vus.has(cle)) { sonde.vus.add(cle); sonde.alertes.push({ cle, ...e }); }
    if (type === "stroke") { sonde.contours.set(`${t.slice(0, 28)}|${Math.round(taille)}`, e); sonde.contour = { texte: t, couleur, n: sonde.n }; }
    sonde.n++;
    return true;
  }

  P.fillText = function (texte, x, y) {
    if (!sonde.actif) return vrai.fill.apply(this, arguments);
    if (mesurer(this, "fill", texte, x, y, arguments)) return;
    return vrai.fill.apply(this, arguments);
  };
  P.strokeText = function (texte, x, y) {
    if (!sonde.actif) return vrai.stroke.apply(this, arguments);
    if (mesurer(this, "stroke", texte, x, y, arguments)) return;
    return vrai.stroke.apply(this, arguments);
  };

  // Le menu est franchi comme dans les autres outils (pseudo connu, ligue vue,
  // 5 parties jouées) MAIS on ne touche ni à `jp2-appris` ni à
  // `jp2-conseils-vus` : les trois conseils (« TAPE ! », « RESTE APPUYÉ ! »,
  // « TAPE… PUIS RE-TAPE ! ») et les projecteurs (lait, alerte, mouette)
  // doivent sortir, ce sont des textes à mesurer comme les autres.
  localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2Insta", "pmc.mp3");
  localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});

await page.goto(`http://localhost:${port}/?debug&base`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 25000 });

// ---------------------------------------------------------------------------
// LA COURSE ENTIÈRE, image par image.
// ---------------------------------------------------------------------------
const scene = (nom, t = 0) => page.evaluate(([s, tt]) => { window.__contraste.scene = s; window.__contraste.t = tt; }, [nom, t]);
await page.evaluate(() => { window.__contraste.actif = true; });

await scene("menu");
await page.waitForTimeout(600);
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
// Pas à pas : on ne dépend plus du temps réel, chaque image est mesurée.
await page.evaluate(installerPilote);   // le joueur idéal : il saute « juste »
await page.evaluate(() => {
  window.__pote.videoDemarrer();
  window.__pote.setInvincible(true);     // la course doit aller jusqu'à la plage
});
for (let i = 0; i < 5; i++) await page.keyboard.press("KeyP"); // cinq potes au peloton
await page.keyboard.press("KeyD");                             // pas de calque de debug mesuré

const DUREE = await page.evaluate(() => window.CONFIG.dureeMorceau);
if (domSeul) await page.keyboard.press("KeyF");   // fin immédiate : on ne veut que le DOM
const PAS = 1 / 12;            // 12 images mesurées par seconde de course
const LOT = 8;                 // images avancées par aller-retour (la photo-preuve arrive donc au plus 8 images après)
const TURBOS = [18, 55, 96, 140];
const JETPACK = 75;
let t = 0, fait = new Set(), faibleN = 0;
const preuves = [];
while (!domSeul && t < DUREE - 1) {
  const biome = t < 28 ? "village" : t < 62 ? "campagne" : t < 95 ? "montagne" : t < 120 ? "nuit" : t < 150 ? "grotte" : "plage";
  await scene(biome, t);
  for (const s of TURBOS) if (t >= s && !fait.has(`l${s}`)) { fait.add(`l${s}`); await page.evaluate(() => window.__pote.lait()); }
  if (t >= JETPACK && !fait.has("jet")) { fait.add("jet"); await page.evaluate(() => window.__pote.forcerJetpack()); }
  // Les images avancent par LOTS dans la page : un aller-retour par lot au lieu
  // d'un par image, sinon la course entière prend cinq minutes et ne tient plus
  // dans le filet. Les mesures, elles, restent faites image par image.
  const alertes = await page.evaluate(([dt, n]) => {
    for (let i = 0; i < n && !window.__pote.game.ended; i++) window.__pote.videoPas(dt);
    const a = window.__contraste.alertes; window.__contraste.alertes = [];
    return a;
  }, [PAS, LOT]);
  for (const a of alertes) {
    const nom = `contraste-faible-${String(++faibleN).padStart(2, "0")}`;
    preuves.push({ ...a, image: `outils/sorties/${nom}.png` });
    await page.screenshot({ path: `${sorties}${nom}.png` });
  }
  if (Math.round(t) % 25 === 0 && !fait.has(`p${Math.round(t)}`)) { fait.add(`p${Math.round(t)}`); await page.screenshot({ path: `${sorties}contraste-${String(Math.round(t)).padStart(3, "0")}s.png` }); }
  t += PAS * LOT;
  if (await page.evaluate(() => window.__pote.game.ended)) break;
}
const finie = await page.evaluate(() => window.__pote.game.ended);
await scene("fin de course", DUREE);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${sorties}contraste-fin.png` });

const sonde = await page.evaluate(() => ({ n: window.__contraste.n, mesures: [...window.__contraste.mesures.values()], contours: [...window.__contraste.contours.keys()] }));

const cerne = (m) => m.cerne;
const juges = sonde.mesures.filter((m) => m.type === "fill");
const sous = juges.filter((m) => m.bas < m.seuil);
const graves = sous.filter((m) => m.bas < 3 && !cerne(m));
const limites = sous.filter((m) => !graves.includes(m));

console.log(`\n— Textes dessinés dans le canvas : ${sonde.n} mesures, ${juges.length} textes distincts, course jouée jusqu'à ${Math.round(t)} s sur ${Math.round(DUREE)}`);
const photo = (m) => { const p = preuves.find((x) => x.texte === m.texte && x.ou === m.ou); return p ? "  " + p.image : ""; };
const ligne = (m) => `  ${String(m.bas).padStart(5)}:1 (5e pct ; ${m.pire} au pire pixel, ${m.moyen} en moyenne — seuil ${m.seuil})  ${m.taille}px${m.grand ? " grand" : ""}  ${cerne(m) ? "cerné  " : "       "}${JSON.stringify(m.texte).padEnd(26)} ${m.couleur.padEnd(18)} ${m.scene} ${m.t}s  ${m.ou}${photo(m)}`;
if (sous.length) {
  console.log("\n— Sous le seuil WCAG AA :");
  for (const m of sous.sort((a, b) => a.bas - b.bas)) console.log(ligne(m));
} else console.log("  aucun texte sous le seuil");
if (detail) {
  console.log("\n— Tous les textes, du pire au meilleur :");
  for (const m of juges.sort((a, b) => a.bas - b.bas)) console.log(ligne(m));
}
const grisEnnui = juges.filter((m) => m.bas >= m.seuil && m.pireGris < m.seuil);
if (grisEnnui.length) {
  console.log("\n— Lisibles en couleur, plus assez à la mort (filtre grayscale) :");
  for (const m of grisEnnui) console.log(`  ${String(m.pireGris).padStart(5)}:1 en gris (${m.bas}:1 en couleur)  ${JSON.stringify(m.texte)} ${m.ou}`);
}


// ---------------------------------------------------------------------------
// LE DOM, règle de contraste seule, sur les écrans et sur le règlement.
// ---------------------------------------------------------------------------
const { readFileSync } = await import("node:fs");
const { createRequire } = await import("node:module");
const axe = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const faibles = [];
async function contrasteDom(nom) {
  await page.evaluate(axe);
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast", "color-contrast-enhanced", "link-in-text-block"] } });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, cibles: v.nodes.slice(0, 8).map((x) => `${x.target.join(" ")} ${x.any[0] && x.any[0].data ? `(${x.any[0].data.contrastRatio}:1, ${x.any[0].data.fontSize})` : ""}`) }));
  });
  for (const v of r) if (v.id === "color-contrast") faibles.push({ ecran: nom, ...v });
  const aa = r.filter((v) => v.id === "color-contrast");
  const aaa = r.filter((v) => v.id === "color-contrast-enhanced");
  console.log(`  ${nom.padEnd(22)} AA : ${aa.length ? aa.map((v) => `${v.n} texte(s)`).join(", ") : "rien"} · AAA (7:1) : ${aaa.reduce((n, v) => n + v.n, 0)} texte(s) sous le seuil`);
  if (detail) for (const v of r) for (const c of v.cibles) console.log(`     ${v.id} ${c}`);
}
console.log("\n— Le DOM, règle de contraste seule :");
await contrasteDom("écran de fin");
await page.click("#end-concours-voir", { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(700);
await contrasteDom("classements");
await page.keyboard.press("Escape");
await page.click("#end-ligue-partager", { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(500);
await contrasteDom("invitation");
await page.keyboard.press("Escape");
await page.goto(`http://localhost:${port}/reglement.html`);
await page.waitForTimeout(400);
await contrasteDom("règlement");

// ---------------------------------------------------------------------------
// LE VERDICT.
// ---------------------------------------------------------------------------
const ok = !graves.length && !faibles.length && finie !== null && !erreurs.length && (domSeul || sonde.n > 500);
verdict(ok, `canvas : ${juges.length} textes mesurés, ${graves.length} illisible(s) (< 3:1 sans contour), ${limites.length} juste(s) · DOM : ${faibles.reduce((n, v) => n + v.n, 0)} texte(s) sous AA · ${erreurs.length} erreur(s) JS`);
await navigateur.close(); await serveur.close();
