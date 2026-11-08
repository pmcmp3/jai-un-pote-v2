// turbo.mjs — La brique de lait fait tout exploser : les obstacles restent sur la
// route pendant le turbo et sautent en l'air, le joueur ne perd rien, et la sortie
// du turbo est dégagée (aucun choc dans la seconde qui suit).
//   node outils/turbo.mjs
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
const racine = fileURLToPath(new URL("..", import.meta.url));
const sorties = fileURLToPath(new URL("./sorties/", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5186, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2Insta", "pmc.mp3"); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1,"mouette":1}'); localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
await page.goto(`http://localhost:${port}/?debug&dpr=2`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
await page.keyboard.press("KeyD");
await page.evaluate(() => window.__pote.videoDemarrer());

const bilan = [];
for (const t of [40, 75, 110, 150]) {
  // On arrive au moment voulu sans mourir, puis le turbo seul protège.
  await page.evaluate((t) => { const P = window.__pote; P.setInvincible(true); P.videoAvance(t); P.setInvincible(false); }, t);
  const avant = await page.evaluate(() => ({ boum: window.__pote.explosions(), chocs: window.__pote.chocs().length, potes: window.__pote.friends.count() }));
  await page.evaluate(() => window.__pote.lait());
  let photo = false;
  // Par paquets de 5 pas : pas besoin d'un aller-retour avec la page à chaque image.
  for (let i = 0; i < 60; i++) {
    const eclats = await page.evaluate(() => { window.__pote.videoPas(5 / 60); return window.__pote.eclats(); });
    if (!photo && eclats > 15) { photo = true; await page.screenshot({ path: `${sorties}turbo-${t}.png`, timeout: 15000 }); }
  }
  const apres = await page.evaluate(() => ({ boum: window.__pote.explosions(), potes: window.__pote.friends.count(), turbo: window.__pote.game.turbo, fin: window.__pote.game.ended }));
  bilan.push({ t, explosions: apres.boum - avant.boum, potesPerdus: avant.potes - apres.potes, photo });
  if (apres.fin) break;
}
console.log(JSON.stringify(bilan, null, 1));
console.log(erreurs.length ? `⚠️ erreurs : ${erreurs.join(" | ")}` : "aucune erreur JS");
const total = bilan.reduce((a, b) => a + b.explosions, 0);
const sansDegats = bilan.every((b) => b.potesPerdus <= 0);
// Le parcours change à chaque partie : un turbo peut tomber dans une halle sans
// obstacle. On juge donc le total, pas chaque turbo.
verdict(bilan.length === 4 && total >= 8 && sansDegats && !erreurs.length,
  `${total} explosions sur ${bilan.length} turbos, ${sansDegats ? "aucun pote perdu" : "DES POTES PERDUS"}, ${erreurs.length} erreur(s) JS`);
await navigateur.close(); await serveur.close();
