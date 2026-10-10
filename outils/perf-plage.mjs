// perf-plage.mjs — Coût d'une image à la plage (5 octobre 2026 : soleil
// couchant intensifié, halo et lumière dorée plein écran) contre le début de
// course. Mode vidéo, processeur ralenti ×4 (un téléphone moyen).
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5189, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const contexte = await navigateur.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await contexte.newPage();
await page.addInitScript(() => {
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1,"mouette":1}'); localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
await page.goto(`http://localhost:${port}/?debug&dpr=2`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
await page.keyboard.press("KeyI"); await page.keyboard.press("KeyD");
const cdp = await contexte.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const mesurer = (t) => page.evaluate((t) => {
  const P = window.__pote;
  P.videoDemarrer(); P.videoAvance(t);
  for (let i = 0; i < 20; i++) P.videoPas(1 / 60);
  const d = [];
  for (let i = 0; i < 120; i++) { const t0 = performance.now(); P.videoPas(1 / 60); d.push(performance.now() - t0); }
  d.sort((a, b) => a - b);
  return { moy: d.reduce((a, b) => a + b, 0) / d.length, p95: d[Math.floor(d.length * 0.95)] };
}, t);
const debut = await mesurer(30);
const plage = await mesurer(160);
console.log(`Image (simulation + rendu, CPU ×4) : début ${debut.moy.toFixed(1)} ms (p95 ${debut.p95.toFixed(1)}) · plage ${plage.moy.toFixed(1)} ms (p95 ${plage.p95.toFixed(1)})`);
// Seuil : la moitié d'une image à 60 i/s (8,3 ms) sur un téléphone moyen.
const pire = Math.max(debut.moy, plage.moy);
verdict(pire < 8.3, `image la plus chère ${pire.toFixed(1)} ms en moyenne (seuil 8,3 ms, CPU ×4)`);
await navigateur.close(); await serveur.close();
