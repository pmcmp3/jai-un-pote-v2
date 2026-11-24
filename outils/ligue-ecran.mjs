// ligue-ecran.mjs — Capture de l'écran « Ma ligue » (seul dans sa ligue, puis
// avec deux potes), ligue démo, 393×852. Sortie : outils/sorties/ligue-*.png
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
const racine = fileURLToPath(new URL("..", import.meta.url));
const sorties = fileURLToPath(new URL("./sorties/", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5197, strictPort: false } });
await serveur.listen();
const port = serveur.config.server.port;
const nav = await chromium.launch({ channel: "chrome", headless: true });
for (const [nom, membres] of [["seul", ["pmc"]], ["potes", ["pmc", "lea", "marius"]]]) {
  const ctx = await nav.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript((m) => {
    localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2Insta", "pmc.mp3");
    localStorage.setItem("jp2LigueVue", "1"); localStorage.setItem("jp2Parties", "5");
    localStorage.setItem("jp2Demo", "cree");
    localStorage.setItem("jp2Ligue", JSON.stringify({ code: "BOBVILLE", nom: "Bobville", membres: m.map((n) => ({ nom: n, skin: null })), demo: true }));
  }, membres);
  await page.goto(`http://localhost:${port}/`);
  await page.waitForTimeout(6500);
  await page.evaluate(() => document.getElementById("step3-ligue").click());
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${sorties}ligue-${nom}.png` });
  console.log("→ outils/sorties/ligue-" + nom + ".png");
  await ctx.close();
}
await nav.close(); await serveur.close();
