// menu-android.mjs — Choisir une puce de « mon cycliste » ne doit RIEN faire
// bouger (4 octobre 2026, nuit, Samsung dans Instagram : « dès qu'on
// sélectionne un carreau, la fenêtre réapparaît du bas et remonte à sa
// position initiale »). Chrome en téléphone Android, vrais taps de doigt
// (posés ~100 ms) : position de la carte et défilement relevés avant/après.
//   node outils/menu-android.mjs
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5198, strictPort: false, hmr: false } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true });
const contexte = await navigateur.newContext({
  viewport: { width: 384, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.8,
  userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 350.0.0.0.0 Android",
});
const page = await contexte.newPage();
await page.addInitScript(() => {
  if (sessionStorage.getItem("pose")) return;
  sessionStorage.setItem("pose", "1");
  localStorage.clear();
  localStorage.setItem("jp2Pseudo", "test"); localStorage.setItem("jp2LigueVue", "1"); localStorage.setItem("jp2Parties", "6");
});
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.waitForTimeout(1200);
const cdp = await contexte.newCDPSession(page);
const tapDoigt = async (x, y) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await page.waitForTimeout(100);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
const etat = () => page.evaluate(() => {
  const o = document.getElementById("overlay"), c = document.querySelector('#onboarding .step[data-step="3"]');
  return { haut: Math.round(c.getBoundingClientRect().top), defile: Math.round(o.scrollTop), retour: o.classList.contains("retour"), focus: document.activeElement ? document.activeElement.tagName : "" };
});
// Un peu de défilement, comme quelqu'un qui descend vers « Chapeau ».
await page.evaluate(() => { document.getElementById("overlay").scrollTop = 60; });
await page.waitForTimeout(300);
let bouge = 0;
for (const [cle, k] of [["chapeau", 1], ["genre", 1], ["c1", 3], ["chapeau", 2], ["velo", 1], ["genre", 0]]) {
  const avant = await etat();
  const b = await page.evaluate(([cle, k]) => { const el = document.querySelectorAll(`#skin-options .chips[data-cle="${cle}"] .chip`)[k]; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, txt: el.textContent || el.title }; }, [cle, k]);
  await tapDoigt(b.x, b.y);
  const pendant = [];
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(70); pendant.push(await etat()); }
  const actif = await page.evaluate(([cle, k]) => document.querySelectorAll(`#skin-options .chips[data-cle="${cle}"] .chip`)[k].classList.contains("actif"), [cle, k]);
  const ecart = Math.max(...pendant.map((p) => Math.abs(p.haut - avant.haut)));
  const retour = pendant.some((p) => p.retour);
  if (ecart > 2 || retour) bouge += 1;
  console.log(`${ecart > 2 || retour ? "BOUGE" : "OK   "} ${cle.padEnd(8)} « ${b.txt} » choisi : ${actif ? "oui" : "NON"} · carte ${avant.haut} → max ${ecart} px d'écart · défilement ${avant.defile} → ${pendant[pendant.length - 1].defile}${retour ? " · animation de retour rejouée" : ""} · focus ${pendant[0].focus}`);
}
console.log(bouge ? `${bouge}/6 choix font bouger le menu` : "6/6 : la carte ne bouge pas");
await navigateur.close();
await serveur.close();
