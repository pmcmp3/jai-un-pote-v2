// rendu-identique.mjs — Preuve qu'une réorganisation du code n'a pas changé
// l'IMAGE : la même course (ligue de démo = même route, départ reproductible
// `__pote.videoAuDepart`, hasard et horloge murale figés) est rendue pas à pas
// à des instants fixes, et chaque image est comparée pixel à pixel à une
// référence prise avant la retouche.
//   node outils/rendu-identique.mjs --reference   → prend la référence
//   node outils/rendu-identique.mjs               → compare à la référence
// Images : outils/sorties/rendu/ (ref-*.png, new-*.png).
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";

const racine = fileURLToPath(new URL("..", import.meta.url));
const dossier = fileURLToPath(new URL("./sorties/rendu/", import.meta.url));
mkdirSync(dossier, { recursive: true });
const reference = process.argv.includes("--reference");
// Départ, marché, montagne, nuit, gare, bowling, bouchon, plage, arrivée.
const INSTANTS = [1, 18, 27, 45, 62, 78, 90, 104, 118, 132, 150, 162, 171];

const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5203, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await navigateur.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1}'); localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
  // Figés au départ de la course (le menu et le chargement en ont besoin
  // avant) : le hasard repart d'une graine fixe, l'horloge murale ne bouge plus.
  const vraieHorloge = performance.now.bind(performance), vraiHasard = Math.random;
  let fige = false, a = 0;
  performance.now = () => (fige ? 1000 : vraieHorloge());
  Math.random = () => {
    if (!fige) return vraiHasard();
    a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Au départ : plus aucune autre boucle d'animation (aperçus du menu,
  // peloton de l'explication) ne tourne en temps réel à côté du pas à pas.
  window.__figerAuDepart = () => { fige = true; a = 12345; window.requestAnimationFrame = () => 0; };
  window.__refigerHasard = () => { a = 12345; };
});
await page.goto(`http://localhost:${serveur.config.server.port}/?debug&demo`);
await page.waitForFunction(() => window.__pote && !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.evaluate(() => window.__pote.videoAuDepart(window.__figerAuDepart));
await page.click("#play-button");
await page.waitForFunction(() => window.__pote.estDemarre(), null, { timeout: 40000 });
await page.keyboard.press("KeyI"); // invincible : la course va au bout
await page.keyboard.press("KeyD"); // sans le panneau de debug (il affiche des ms réelles)
const images = await page.evaluate((instants) => {
  const P = window.__pote, out = [];
  window.__refigerHasard();
  // Le cycliste pédale déjà en temps réel avant le départ : même phase pour tous.
  P.player.pedal = 0; P.player.prevPedal = 0;
  // Les potes de ligue qui viendront sont tirés au hasard avant le départ : on retire.
  P.friends.reset();
  for (const t of instants) {
    P.videoAvance(t);
    P.videoPas(1 / 60);
    out.push({ t, url: document.getElementById("game-canvas").toDataURL("image/png") });
  }
  return out;
}, INSTANTS);
await navigateur.close(); await serveur.close();

const h = (b) => createHash("sha1").update(b).digest("hex");
let differentes = 0, manquantes = 0;
for (const { t, url } of images) {
  const png = Buffer.from(url.split(",")[1], "base64");
  const nom = `${String(t).padStart(3, "0")}s.png`;
  if (reference) { writeFileSync(`${dossier}ref-${nom}`, png); continue; }
  writeFileSync(`${dossier}new-${nom}`, png);
  if (!existsSync(`${dossier}ref-${nom}`)) { manquantes += 1; continue; }
  if (h(readFileSync(`${dossier}ref-${nom}`)) !== h(png)) { differentes += 1; console.log(`  ${t} s : image DIFFÉRENTE (outils/sorties/rendu/ref-${nom} / new-${nom})`); }
}
if (reference) console.log(`Référence prise : ${images.length} images dans outils/sorties/rendu/.`);
verdict(!erreurs.length && !differentes && !manquantes, reference ? `${images.length} images de référence, ${erreurs.length} erreur(s) JS`
  : `${images.length - differentes - manquantes}/${images.length} images identiques au pixel près${manquantes ? `, ${manquantes} sans référence` : ""}, ${erreurs.length} erreur(s) JS`);
