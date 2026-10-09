// volumes.mjs — Les deux curseurs du son (4 octobre 2026, nuit : « un réglage
// pour la musique et un réglage pour les effets sonores ») : le bouton ♪ du
// menu ouvre le panneau, chaque curseur règle SON gain (et pas l'autre), le
// réglage survit au rechargement, et le menu pause montre les mêmes curseurs.
//   node outils/volumes.mjs
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
const racine = fileURLToPath(new URL("..", import.meta.url));
const sorties = fileURLToPath(new URL("./sorties/", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5197, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await navigateur.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1}'); localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
const url = `http://localhost:${port}/?debug`;
await page.goto(url);
await page.waitForTimeout(1500);
const etat = () => page.evaluate(async () => { const a = await import("/src/audio.js"); return { musique: a.getVolumeMusique(), effets: a.getVolumeEffets(), visible: document.getElementById("pause-screen").classList.contains("visible"), reglages: document.getElementById("pause-screen").classList.contains("reglages"), titre: document.querySelector("#pause-screen .step-eyebrow").textContent, stock: [localStorage.getItem("jp2VolMusique"), localStorage.getItem("jp2VolEffets")] }; });
const regler = (id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, [id, v]);
await page.click("#mute-button");
await page.waitForTimeout(400);
await page.screenshot({ path: `${sorties}62-son-menu.png` });
const menu = await etat();
console.log("♪ du menu :", JSON.stringify(menu));
await regler("volume-musique", 40); await regler("volume-effets", 70);
console.log("après réglage :", JSON.stringify(await etat()));
await page.click("#son-fermer");
await page.waitForTimeout(300);
console.log("fermé :", JSON.stringify(await etat()));
await page.reload(); await page.waitForTimeout(1500);
const recharge = await etat();
console.log("après rechargement :", JSON.stringify(recharge));
// En course : le menu pause a les mêmes curseurs, et les gains suivent.
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
await page.waitForTimeout(4500);
await page.click("#pause-button");
await page.waitForTimeout(400);
await page.screenshot({ path: `${sorties}63-son-pause.png` });
const pause = await etat();
console.log("pause :", JSON.stringify(pause));
await regler("volume-musique", 0);
const gains = await page.evaluate(async () => { const a = await import("/src/audio.js"); const s = a.sfxOutput(); return { effets: s ? s.dest.gain.value : null }; });
console.log("musique coupée, gain des effets :", JSON.stringify(gains));
console.log(erreurs.length ? `⚠️ erreurs : ${erreurs.join(" | ")}` : "aucune erreur JS");
const proche = (a, b) => Math.abs(a - b) < 0.01;
verdict(menu.visible && menu.reglages && proche(recharge.musique, 0.4) && proche(recharge.effets, 0.7) && pause.visible && proche(gains.effets ?? -1, 0.7) && !erreurs.length,
  `♪ ouvre le réglage : ${menu.visible && menu.reglages ? "oui" : "NON"} · gardé au rechargement : musique ${recharge.musique}, effets ${recharge.effets} · effets à ${gains.effets === null ? "?" : gains.effets.toFixed(2)} quand la musique est coupée · ${erreurs.length} erreur(s) JS`);
await navigateur.close(); await serveur.close();
