// bouclier.mjs — L'invincibilité ne passe JAMAIS d'une course à la suivante.
// Le bouclier (fin de turbo, reprise après « Continuer ») est une date sur
// l'horloge du morceau, qui repart de 0 à chaque course : non remis à zéro,
// un turbo fini à 156 s rendait la course SUIVANTE invincible jusqu'à 156 s.
// Scénario : turbo à 150 s, fin de course, REJOUER, puis 25 s sans un geste —
// le joueur immobile doit se faire toucher comme d'habitude.
//   node outils/bouclier.mjs
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5184, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2Insta", "pmc.mp3"); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1,"mouette":1}'); localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
await page.goto(`http://localhost:${port}/?debug`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
await page.evaluate(() => window.__pote.videoDemarrer());
// Course 1 : on arrive à 150 s sans mourir, on prend un lait, le turbo s'éteint.
await page.evaluate(() => { const P = window.__pote; P.setInvincible(true); P.videoAvance(150); P.setInvincible(false); P.lait(); P.videoPas(6); });
const finCourse1 = await page.evaluate(() => ({ t: window.__pote.clock.now(), bouclier: window.__pote.bouclier() }));
// Fin de course, puis REJOUER.
await page.keyboard.press("KeyF");
await page.waitForFunction(() => !document.getElementById("end-screen").classList.contains("hidden") && getComputedStyle(document.getElementById("replay-button")).display !== "none", null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.evaluate(() => document.getElementById("replay-button").click());
await page.waitForFunction(() => window.__pote.game.ended === false && window.__pote.clock.now() < 5, null, { timeout: 30000 });
const debut2 = await page.evaluate(() => ({ t: window.__pote.clock.now(), bouclier: window.__pote.bouclier() }));
// Course 2 : 25 s sans un geste.
// Par pas d'une seconde : une mort ouvre la carte « Tombé ! », qui GÈLE
// l'horloge — avancer d'un coup jusqu'à 25 s ne finirait jamais.
await page.evaluate(() => window.__pote.videoDemarrer());
const mortVue = () => page.evaluate(() => { const g = window.__pote.game; return !!g.ended || !!g.reviveOffered || window.__pote.friends.count() < window.__pote.friends.maxReached(); });
for (let i = 0; i < 25; i++) { await page.evaluate(() => window.__pote.videoPas(1)); if (await mortVue()) break; }
const course2 = await page.evaluate(() => ({ t: window.__pote.clock.now(), chocs: window.__pote.chocs().length, mort: !!(window.__pote.game.ended || window.__pote.game.reviveOffered), perdus: window.__pote.friends.maxReached() - window.__pote.friends.count(), bouclier: window.__pote.bouclier() }));
await navigateur.close(); await serveur.close();
console.log("course 1, fin du turbo :", JSON.stringify(finCourse1));
console.log("course 2, départ       :", JSON.stringify(debut2));
console.log("course 2, après 25 s   :", JSON.stringify(course2));
// Un choc sous bouclier est compté aussi : ce qui prouve, c'est qu'il COÛTE.
const ok = debut2.bouclier === 0 && (course2.mort || course2.perdus > 0) && erreurs.length === 0;
verdict(ok, ok ? `aucun bouclier hérité : le joueur immobile ${course2.mort ? "meurt" : "perd un pote"} à ${course2.t.toFixed(0)} s` : `bouclier hérité de la course précédente : ${debut2.bouclier.toFixed(1)} s d'invincibilité au départ${erreurs.length ? " · erreurs : " + erreurs.join(" | ") : ""}`);
