// marchand.mjs — Le vocal du marchand part-il au bon moment ? (4 octobre 2026,
// nuit) Une vraie course (horloge audio, joueur invincible pour ne pas mourir
// avant le marché), relevé toutes les 0,25 s : position, état du vocal.
//   node outils/marchand.mjs
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5196, strictPort: false, hmr: false } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await navigateur.newContext({ viewport: { width: 375, height: 812 } })).newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
await page.addInitScript(() => {
  if (sessionStorage.getItem("pose")) return;
  sessionStorage.setItem("pose", "1");
  localStorage.clear();
  localStorage.setItem("jp2Pseudo", "test"); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1}');
  localStorage.setItem("jp2Parties", "6"); localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
await page.goto(`http://localhost:${port}/?debug`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
await page.keyboard.press("KeyI"); // invincible : on veut atteindre le marché
let dernier = null;
const debut = Date.now();
while (Date.now() - debut < 42000) {
  const e = await page.evaluate(() => ({ t: window.__pote.tMonde(), v: window.__pote.player.v, ...window.__pote.marchand() }));
  if (e.etat !== dernier) {
    console.log(`t ${e.t.toFixed(1)} s · v ${e.v.toFixed(1)} · marchand ${e.etat}` + (e.milieu ? ` (milieu du marché : rangée ${e.milieu}, écart ${(e.milieu - e.v).toFixed(1)})` : ""));
    dernier = e.etat;
  }
  if (e.etat === "fini") break;
  await page.waitForTimeout(250);
}
console.log(erreurs.length ? `ERREURS : ${erreurs.join(" | ")}` : "aucune erreur JS");
await navigateur.close();
await serveur.close();
