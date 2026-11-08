// accessibilite.mjs — Chaque écran passé à axe-core (règles WCAG 2.1 et 2.2 AA) :
// aucune violation sérieuse ou critique, et le clavier : Échap referme un tiroir et
// rend le focus au bouton qui l'a ouvert. La base est simulée, rien ne sort.
//   node outils/accessibilite.mjs [--detail]
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
const detail = process.argv.includes("--detail");
const axe = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5183, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await contexte.route(/supabase\.co/, (route) => {
  const r = route.request(), table = new URL(r.url()).pathname.split("/").pop();
  if (r.method() !== "GET") return route.fulfill({ status: 201, body: "" });
  let corps = [];
  const j = (rang, pseudo, metres, commission) => ({ rang, pseudo, metres, commission, potes: 2, code: "ESSAI", nom: "Ligue d'essai", total: metres + commission, classes: 40 });
  if (table === "concours") corps = [{ id: 1, debut: "2026-11-02T07:00:00Z", fin: "2026-11-22T11:00:00Z", plafond_score: 110000, commission: 0.1 }];
  else if (table === "concours_joueurs") corps = [j(1, "tom", 9000, 400), j(2, "lola", 8000, 300), j(3, "sam", 7000, 200), j(4, "pmc", 5000, 100)];
  else if (table === "concours_ligues") corps = [{ code: "ESSAI", nom: "Ligue d'essai", joueurs: 7, total: 20000 }];
  else if (table === "ligue_membres") corps = [{ pseudo: "pmc", skin: null }, { pseudo: "lola", skin: null }];
  else if (table === "ligue_scores") corps = [{ pseudo: "lola", metres: 3000, potes: 1 }];
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
});
const page = await contexte.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2LigueVue", "1");
  localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1,"mouette":1}'); localStorage.setItem("jp2Parties", "5");
  localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
});
await page.goto(`http://localhost:${port}/?debug&base`);
await page.waitForFunction(() => document.getElementById("pseudo-input") && getComputedStyle(document.getElementById("overlay")).display !== "none", null, { timeout: 20000 });
await page.waitForTimeout(6000); // l'écran de chargement dure au moins 5 s

const violations = [];
async function passer(nom) {
  await page.waitForTimeout(450);
  await page.evaluate(axe);
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, aide: v.help, n: v.nodes.length, cibles: v.nodes.slice(0, 6).map((n) => n.target.join(" ") + (n.any[0] && n.any[0].data && n.any[0].data.contrastRatio ? ` (${n.any[0].data.contrastRatio})` : "")) }));
  });
  for (const v of r) violations.push({ ecran: nom, ...v });
  console.log(`${nom} : ${r.length ? r.map((v) => `${v.id}[${v.impact}]×${v.n}`).join(", ") : "rien à signaler"}`);
  if (detail) for (const v of r) console.log(`   ${v.id} — ${v.aide}\n     ${v.cibles.join("\n     ")}`);
}

await page.fill("#pseudo-input", "pmc");
await page.fill("#insta-input", "pmc.mp3");
await passer("inscription");
await page.click("#step1-next");
await passer("cycliste ou ligue");
await page.evaluate(() => { if (window.__pote) document.querySelector('[data-step="2"]'); });
await page.click("#step3-ligue").catch(() => {});
await passer("ma ligue");
// Une ligue pour voir l'écran « avec » : le code déjà en mémoire au rechargement.
await page.evaluate(() => localStorage.setItem("jp2Ligue", JSON.stringify({ code: "ESSAI", membres: [{ nom: "pmc", skin: null }, { nom: "lola", skin: null }] })));
await page.reload();
await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await passer("mon cycliste, avec ligue");
await page.click("#step3-ligue");
await passer("ma ligue, avec ligue");
await page.click("#step2-back");
await page.waitForTimeout(200);
await page.click("#play-button");
await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
await page.waitForTimeout(900);
await page.click("#pause-button");
await passer("pause");
await page.click("#resume-button");
await page.waitForTimeout(600);
await page.keyboard.press("KeyF");
await page.waitForSelector("#end-concours:not(.hidden)", { timeout: 15000 });
await passer("fin de course");
await page.evaluate(() => document.getElementById("end-concours-voir").scrollIntoView({ block: "center" }));
await page.focus("#end-concours-voir");
await page.click("#end-concours-voir");
await page.waitForFunction(() => document.querySelectorAll("#classement-liste li").length > 0);
await passer("classements");
const dansTiroir = await page.evaluate(() => !!document.activeElement.closest("#classement-sheet"));
await page.keyboard.press("Escape");
await page.waitForTimeout(450);
const clavier = await page.evaluate(() => ({ ferme: !document.getElementById("classement-sheet").classList.contains("visible"), focus: document.activeElement.id }));
console.log("clavier :", JSON.stringify({ dansTiroir, ...clavier }));
await page.click("#end-ligue-partager");
await page.waitForTimeout(500);
await passer("invitation");

const graves = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
const ok = !graves.length && dansTiroir && clavier.ferme && clavier.focus === "end-concours-voir" && !erreurs.length;
verdict(ok, `${graves.length} violation(s) sérieuse(s) ou critique(s), ${violations.length - graves.length} mineure(s) · Échap et focus : ${dansTiroir && clavier.ferme && clavier.focus === "end-concours-voir" ? "OK" : "NON"} · ${erreurs.length} erreur(s) JS`);
await navigateur.close(); await serveur.close();
