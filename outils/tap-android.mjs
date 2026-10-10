// tap-android.mjs — UN tap doit faire UN saut (4 octobre 2026, nuit : sur
// Android, un tap faisait un double saut). Chrome en mode téléphone tactile :
// page.tap() envoie le toucher, puis Chrome rejoue le geste en souris comme
// le fait Android. On compte les appuis reçus par le jeu et on regarde si le
// cycliste a fait un double saut.
//   node outils/tap-android.mjs
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";

const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5197, strictPort: false, hmr: false } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const contexte = await navigateur.newContext({
  viewport: { width: 384, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.8,
  userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 350.0.0.0.0 Android",
});
const page = await contexte.newPage();
await page.addInitScript(() => {
  if (sessionStorage.getItem("pose")) return;
  sessionStorage.setItem("pose", "1");
  localStorage.clear();
  localStorage.setItem("jp2Pseudo", "test"); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1,"mouette":1}');
  localStorage.setItem("jp2Parties", "6"); localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
  // Compte ce que le jeu reçoit (avant ses propres écouteurs).
  window.__evts = [];
  for (const t of ["touchstart", "touchend", "mousedown", "mouseup", "click"]) window.addEventListener(t, () => window.__evts.push(t), true);
});
await page.goto(`http://localhost:${port}/?debug`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.tap("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre() && window.__pote.clock.now() > 1.5, null, { timeout: 30000 });
await page.keyboard.press("KeyI");
const cdp = await contexte.newCDPSession(page);
let doubles = 0;
for (let essai = 0; essai < 5; essai++) {
  await page.waitForFunction(() => window.__pote.player.auSol, null, { timeout: 10000 });
  await page.evaluate(() => { window.__evts = []; window.__vu = { double: false, flip: 0, haut: 0 }; });
  // Un VRAI tap de doigt : posé ~120 ms, puis levé (page.tap pose et lève
  // dans la même milliseconde — le bug ne se voyait pas).
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 190, y: 600 }] });
  await page.waitForTimeout(120);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  // Suivre le saut jusqu'à l'atterrissage.
  const vu = await page.evaluate(() => new Promise((ok) => {
    const p = window.__pote.player, t0 = performance.now(), v = window.__vu;
    const suivre = () => {
      v.double = v.double || p.doubled; v.flip = Math.max(v.flip, p.flip); v.haut = Math.max(v.haut, p.jumpY);
      if ((performance.now() - t0 > 250 && p.auSol) || performance.now() - t0 > 3000) ok({ ...v, evts: window.__evts.join(",") });
      else requestAnimationFrame(suivre);
    };
    requestAnimationFrame(suivre);
  }));
  if (vu.double) doubles += 1;
  console.log(`tap ${essai + 1} : ${vu.double ? "DOUBLE SAUT" : "saut simple"} (hauteur ${vu.haut.toFixed(2)} u, salto ${vu.flip > 0 ? "oui" : "non"}) · reçu : ${vu.evts}`);
}
verdict(doubles === 0, doubles ? `${doubles}/5 taps ont fait un double saut` : "5/5 : un tap = un saut");
await navigateur.close();
await serveur.close();
