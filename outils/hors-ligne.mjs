// hors-ligne.mjs — Le service worker sert la page même sans réseau, quel que
// soit le lien (?9&premiere, ?ligue=…) : le build est servi, la page est
// chargée une fois (le service worker s'installe), puis le réseau est coupé
// et chaque lien est rouvert.
import { build, preview } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";

const racine = fileURLToPath(new URL("..", import.meta.url));
const sortie = fileURLToPath(new URL("./sorties/hors-ligne/", import.meta.url));
await build({ root: racine, logLevel: "error", build: { outDir: sortie, emptyOutDir: true } });
const serveur = await preview({ root: racine, logLevel: "error", build: { outDir: sortie }, preview: { port: 5207, strictPort: true, host: "127.0.0.1" } });
// 127.0.0.1 et non localhost : main.js n’enregistre pas le service worker sur localhost.
const base = `http://127.0.0.1:${serveur.config.preview.port}/`;
const navigateur = await chromium.launch({ channel: "chrome", headless: true });
const contexte = await navigateur.newContext();
const page = await contexte.newPage();
page.setDefaultTimeout(20000);
await page.goto(base);
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload(); // désormais contrôlée par le service worker
await contexte.setOffline(true);
const LIENS = ["", "?premiere", "?ligue=ABCD", "?demo"];
let ok = 0;
for (const l of LIENS) {
  const r = await page.goto(base + l).then(() => page.evaluate(() => !!document.getElementById("play-button"))).catch((e) => e.message.split("\n")[0]);
  console.log(`  ${l || "(sans paramètre)"} : ${r === true ? "page servie" : `ÉCHEC (${r})`}`);
  if (r === true) ok += 1;
}
// Le lien de test « ?9&premiere », réseau rétabli : il retire le service worker,
// vide les caches et recharge sans le « 9 » — la page doit arriver entière
// (le jeu efface ensuite lui-même « premiere » de l’adresse).
await contexte.setOffline(false);
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.goto(base + "?9&premiere");
await page.waitForURL((u) => !/[?&]9(&|$)/.test(u.search), { timeout: 10000 }).catch(() => {});
await page.waitForSelector("#play-button", { state: "attached" });
const remis = !/[?&]9(&|$)/.test(new URL(page.url()).search) && !erreurs.length;
console.log(`  ?9&premiere (en ligne) : ${remis ? "rechargée proprement" : `ÉCHEC (${page.url()}, ${erreurs.join(" / ")})`}`);
await navigateur.close(); await serveur.close();
verdict(ok === LIENS.length && remis, `${ok}/${LIENS.length} liens servis hors ligne, ?9&premiere ${remis ? "OK" : "en échec"}`);
