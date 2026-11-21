// ligue-nom.mjs — Nom de ligue choisi = lien d'invitation (15 novembre 2026).
// « Les Gamers » → code LESGAMERS → …/?ligue=lesgamers, dans WhatsApp/SMS/Snap.
// Nom déjà pris → message clair, rien d'écrit. Un pote qui ouvre le lien rejoint
// la ligue. ⚠️ TOUTE la base est simulée : aucune requête ne sort vers Supabase.
//   node outils/ligue-nom.mjs
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
const racine = fileURLToPath(new URL("..", import.meta.url));
const sorties = fileURLToPath(new URL("./sorties/", import.meta.url));
mkdirSync(sorties, { recursive: true });
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5199, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true });

// La base simulée, partagée entre les deux téléphones.
const base = { ligues: [{ code: "BETA", nom: "Bêta-test", createur: "pmc" }], ligue_membres: [] };
const ecrits = [];
async function telephone(pseudo) {
  const contexte = await navigateur.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await contexte.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true }); } catch (e) { /* rien */ } });
  await contexte.route(/supabase\.co/, async (route) => {
    const r = route.request(), u = new URL(r.url()), table = u.pathname.split("/").pop(), q = u.searchParams;
    if (r.method() === "POST") {
      const corps = JSON.parse(r.postData() || "null");
      ecrits.push({ table, corps });
      if (table === "ligues") { if (base.ligues.some((l) => l.code === corps.code)) return route.fulfill({ status: 409, body: "" }); base.ligues.push(corps); }
      if (table === "ligue_membres" && !base.ligue_membres.some((m) => m.code === corps.code && m.pseudo === corps.pseudo)) base.ligue_membres.push({ ...corps, created_at: new Date().toISOString() });
      return route.fulfill({ status: 201, body: "" });
    }
    if (r.method() !== "GET") return route.fulfill({ status: 204, body: "" });
    const code = (q.get("code") || "").replace(/^eq\./, "");
    let corps = [];
    if (table === "ligues" && code) corps = base.ligues.filter((l) => l.code === code);
    else if (table === "ligue_membres" && code) corps = base.ligue_membres.filter((m) => m.code === code);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  await page.addInitScript((pseudo) => {
    localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2Pseudo", pseudo); localStorage.setItem("jp2Insta", `${pseudo}.mp3`);
    localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1,"mouette":1}'); localStorage.setItem("jp2Parties", "3");
    localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
  }, pseudo);
  return { page, erreurs, contexte };
}
const texte = (page, id) => page.evaluate((id) => document.getElementById(id).textContent.replace(/\s+/g, " ").trim(), id);
const visible = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return !!e && !e.classList.contains("hidden") && e.offsetParent !== null; }, id);
const allerALaLigue = async (page) => {
  await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
  if (!(await visible(page, "ligue-sans")) && !(await visible(page, "ligue-avec"))) {
    await page.evaluate(async () => (await import("/src/screens.js")).setStep && (await import("/src/screens.js")).setStep(2)).catch(() => {});
  }
};

// Un focus sans doigt est rendu aussitôt (anti-clavier fantôme d'Instagram) :
// on touche le champ comme un vrai joueur avant d'écrire.
const ecrire = async (page, sel, v) => { await page.tap(sel); await page.fill(sel, v); };
const checks = [];
const juger = (titre, ok, detail = "") => { checks.push([titre, ok]); console.log(`${ok ? "  ✓" : "  ✗"} ${titre}${detail ? " — " + detail : ""}`); };

// 1. Thomas crée « Les Gamers ».
const t = await telephone("thomas");
await t.page.goto(`http://localhost:${port}/?debug&base`);
await allerALaLigue(t.page);
const etape = await t.page.evaluate(() => [...document.querySelectorAll("[id^=step]")].filter((e) => e.offsetParent !== null).map((e) => e.id));
console.log("étapes visibles :", etape.join(", "), t.erreurs);
if (!(await visible(t.page, "ligue-nom"))) {
  // Habitué : il arrive à l'étape du cycliste ; la ligue est à l'étape d'avant.
  const retour = await t.page.$("#step3-back, [data-step-back], #ligue-changer");
  if (retour) await retour.click();
}
await t.page.waitForSelector("#ligue-nom", { state: "visible", timeout: 10000 });
await ecrire(t.page, "#ligue-nom", "Les Gamers");
const apercu = await t.page.evaluate(() => document.getElementById("ligue-nom-apercu").dataset.lien || "");
juger("aperçu du lien pendant la saisie", /\?ligue=lesgamers$/.test(apercu), apercu);
await ecrire(t.page, "#ligue-nom", "Les Écureuils d'Été");
juger("accents et apostrophes nettoyés", /\?ligue=lesecureuilsdete$/.test(await t.page.evaluate(() => document.getElementById("ligue-nom-apercu").dataset.lien || "")), "data-lien");
// Nom déjà pris : rien n'est créé.
await ecrire(t.page, "#ligue-nom", "Bêta");
const avantPris = ecrits.length;
await t.page.click("#ligue-creer");
await t.page.waitForFunction(() => /déjà pris/.test(document.getElementById("ligue-msg").textContent), null, { timeout: 8000 }).catch(() => {});
juger("nom déjà pris : message clair", /déjà pris/.test(await texte(t.page, "ligue-msg")), await texte(t.page, "ligue-msg"));
juger("nom déjà pris : rien d'écrit", ecrits.length === avantPris);
await ecrire(t.page, "#ligue-nom", "Les Gamer");
juger("le message d'erreur s'efface en retapant", !(await visible(t.page, "ligue-msg")) || !(await texte(t.page, "ligue-msg")));
await t.page.screenshot({ path: `${sorties}ligue-nom-pris.png` });
// Le vrai nom.
await ecrire(t.page, "#ligue-nom", "Les Gamers");
await t.page.screenshot({ path: `${sorties}ligue-nom-saisie.png` });
await t.page.click("#ligue-creer");
await t.page.waitForSelector("#ligue-avec:not(.hidden)", { timeout: 8000 });
const creee = base.ligues.find((l) => l.code === "LESGAMERS");
juger("ligue créée sous le code LESGAMERS", !!creee && creee.nom === "Les Gamers", JSON.stringify(creee));
juger("titre = le nom", (await texte(t.page, "ligue-titre")) === "Les Gamers", await texte(t.page, "ligue-titre"));
juger("lien prêt", /\?ligue=lesgamers$/.test(await t.page.evaluate(() => document.getElementById("ligue-lien").textContent)), "ligue-lien");
const largeurTitre = await t.page.evaluate(() => { const c = document.getElementById("ligue-titre"); return [c.scrollWidth, c.clientWidth]; });
juger("le nom tient dans la carte", largeurTitre[0] <= largeurTitre[1], largeurTitre.join(" ≤ "));
await t.page.screenshot({ path: `${sorties}ligue-nom-creee.png` });
await t.page.click("#ligue-partager");
await t.page.waitForSelector("#partage-sheet.visible", { timeout: 5000 });
const partage = await t.page.evaluate(() => ({ lien: document.getElementById("partage-lien").textContent, wa: decodeURIComponent(document.getElementById("partage-whatsapp").href), sms: decodeURIComponent(document.getElementById("partage-sms").href), snap: decodeURIComponent(document.getElementById("partage-snap").href) }));
juger("WhatsApp : lien + nom de la ligue", /\?ligue=lesgamers/.test(partage.wa) && partage.wa.includes("« Les Gamers »"), partage.wa);
juger("SMS : lien", /\?ligue=lesgamers/.test(partage.sms));
juger("Snap : lien", /\?ligue=lesgamers/.test(partage.snap));
await t.page.screenshot({ path: `${sorties}ligue-nom-partage.png` });
// Un autre message choisi garde le nom de la ligue.
const autre = await t.page.$("#partage-select option:not(:checked)");
if (autre) { await t.page.selectOption("#partage-select", { index: 1 }); juger("autre message : nom gardé", (decodeURIComponent(await t.page.evaluate(() => document.getElementById("partage-whatsapp").href))).includes("« Les Gamers »")); }

// 2. Un pote ouvre le lien.
const p = await telephone("lea");
await p.page.goto(`http://localhost:${port}/?ligue=lesgamers&debug&base`);
await p.page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
await p.page.waitForTimeout(400);
const etat = await p.page.evaluate(async () => (await import("/src/screens.js")).getLigue());
juger("le lien en minuscules retrouve la ligue", etat && etat.code === "LESGAMERS", JSON.stringify(etat));
// L'adhésion part au lancement de la course.
await p.page.evaluate(async () => (await import("/src/screens.js")).preparerLigue());
await p.page.waitForTimeout(300);
juger("le pote est dans la ligue", base.ligue_membres.some((m) => m.code === "LESGAMERS" && m.pseudo === "lea"), JSON.stringify(base.ligue_membres));
const apres = await p.page.evaluate(async () => (await import("/src/screens.js")).getLigue());
juger("le pote voit le nom de la ligue", apres && apres.nom === "Les Gamers", JSON.stringify(apres && apres.nom));

const erreurs = [...t.erreurs, ...p.erreurs];
juger("aucune erreur de page", !erreurs.length, erreurs.join(" | "));
await navigateur.close(); await serveur.close();
const rates = checks.filter(([, ok]) => !ok).map(([t]) => t);
verdict(!rates.length, rates.length ? `raté : ${rates.join(", ")}` : `nom de ligue → lien ?ligue=…, partage, nom pris, pote qui rejoint (${checks.length} vérifications)`);
