// lignes.mjs — Aucun mot seul sur la dernière ligne d'un texte (« … tu peux le
// / battre. »), sur tous les écrans et toutes les largeurs de téléphone. Base simulée.
//   node outils/lignes.mjs
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
const racine = fileURLToPath(new URL("..", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5182, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });

// Pour chaque texte visible : les mots par ligne, d'après leur position réelle.
const MESURE = () => {
  const blocs = [...document.querySelectorAll("p, small, li, summary, label span, .btn, .link-minimal, .expl-texte")];
  const seuls = [];
  for (const b of blocs) {
    if (b.closest('[aria-hidden="true"]') || !b.getClientRects().length || getComputedStyle(b).visibility === "hidden") continue;
    if (b.querySelector("p, li")) continue;
    const parcours = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    const mots = [];
    while (parcours.nextNode()) {
      const n = parcours.currentNode;
      for (const m of n.nodeValue.matchAll(/[^\s\u00a0\u202f]+/g)) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const c = r.getBoundingClientRect();
        if (c.width) mots.push({ top: c.top, h: c.height });
      }
    }
    // Une nouvelle ligne quand le mot descend de plus de 60 % de sa hauteur (les
    // étiquettes légèrement tournées ne comptent donc pas pour deux lignes).
    let lignes = 0, dernier = 0, top = -1e9;
    for (const m of mots) { if (m.top - top > m.h * 0.6) { lignes += 1; dernier = 0; top = m.top; } dernier += 1; }
    if (lignes >= 2 && dernier === 1) seuls.push(`${b.id || b.className || b.tagName} : « ${b.textContent.trim().slice(0, 70)} »`);
  }
  return seuls;
};

const probleme = new Map();
let vus = 0;
for (const largeur of [320, 360, 375, 390, 412, 430]) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await contexte.route(/supabase\.co/, (route) => {
    const r = route.request(), table = new URL(r.url()).pathname.split("/").pop();
    if (r.method() !== "GET") return route.fulfill({ status: 201, body: "" });
    let corps = [];
    const j = (rang, pseudo, metres, commission) => ({ rang, pseudo, metres, commission, potes: 6, code: "ESSAI", nom: "Ligue d'essai", total: metres + commission, classes: 240 });
    if (table === "concours") corps = [{ id: 1, debut: "2026-11-02T07:00:00Z", fin: "2026-11-22T11:00:00Z", plafond_score: 110000, commission: 0.1 }];
    else if (table === "concours_joueurs") corps = new URL(r.url()).searchParams.get("pseudo") ? [j(37, "pmc", 12400, 4300)] : [j(1, "tom", 30000, 14000), j(2, "lola", 20000, 9000), j(3, "sam", 18000, 8000), j(4, "nina", 15000, 2000)];
    else if (table === "concours_ligues") corps = [{ code: "ESSAI", nom: "Ligue d'essai", joueurs: 7, total: 20000 }];
    else if (table === "ligue_membres") corps = [{ pseudo: "pmc", skin: null }, { pseudo: "lola", skin: null }];
    else if (table === "ligue_scores") corps = [{ pseudo: "lola", metres: 3000, potes: 1 }, { pseudo: "pmc", metres: 2000, potes: 1 }];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
  const page = await contexte.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2LigueVue", "1");
    localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1,"mouette":1}'); localStorage.setItem("jp2Parties", "5");
    localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
  });
  const noter = async (ecran) => {
    await page.waitForTimeout(300);
    vus += 1;
    for (const t of await page.evaluate(MESURE)) { const k = `${ecran} — ${t}`; if (!probleme.has(k)) probleme.set(k, new Set()); probleme.get(k).add(largeur); }
  };
  await page.goto(`http://localhost:${port}/?debug&base`);
  await page.waitForTimeout(5800);
  await noter("inscription");
  await page.evaluate(() => { const d = document.getElementById("plus-contact"); if (d) d.open = true; });
  await noter("inscription, détails ouverts");
  await page.fill("#pseudo-input", "pmc"); await page.fill("#insta-input", "pmc.mp3");
  await page.click("#step1-next");
  await noter("mon cycliste");
  await page.click("#step3-ligue");
  await noter("ma ligue");
  await page.evaluate(() => localStorage.setItem("jp2Ligue", JSON.stringify({ code: "ESSAI", membres: [{ nom: "pmc", skin: null }, { nom: "lola", skin: null }] })));
  await page.reload();
  await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
  await noter("mon cycliste, avec ligue");
  await page.click("#step3-ligue");
  await noter("ma ligue, avec ligue");
  await page.click("#step2-back");
  await page.click("#play-button");
  await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
  await page.waitForTimeout(700);
  await page.keyboard.press("KeyF");
  await page.waitForSelector("#end-concours:not(.hidden)", { timeout: 15000 });
  await noter("fin de course");
  await page.evaluate(() => document.getElementById("end-concours-voir").click());
  await page.waitForFunction(() => document.querySelectorAll("#classement-liste li").length > 0);
  await noter("classement général");
  for (const vue of ["ligue", "ligues"]) { await page.evaluate((vue) => document.querySelector(`#classement-onglets [data-vue="${vue}"]`).click(), vue); await noter(`classement ${vue}`); }
  await page.evaluate(() => document.getElementById("classement-fermer").click());
  await page.evaluate(() => document.getElementById("end-ligue-partager").click());
  await noter("invitation");
  await contexte.close();
}
for (const [k, l] of probleme) console.log(`${k} (${[...l].join(", ")} px)`);
verdict(probleme.size === 0, `${vus} écrans mesurés sur 6 largeurs : ${probleme.size} texte(s) avec un mot seul sur sa dernière ligne`);
await navigateur.close(); await serveur.close();
