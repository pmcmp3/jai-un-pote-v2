// classement-general.mjs — Le classement général et la commission (8 novembre
// 2026) : sur l'écran de fin, ta place au général et ce qui la compose ; dans le
// tiroir, les onglets Général / Ma ligue / Les ligues, le podium du tirage et ta
// ligne quand tu es loin ; un joueur sans ligue envoie son score et apparaît aussi.
// ⚠️ TOUTE la base est simulée : aucune requête ne sort vers Supabase.
//   node outils/classement-general.mjs
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
const racine = fileURLToPath(new URL("..", import.meta.url));
const sorties = fileURLToPath(new URL("./sorties/", import.meta.url));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5198, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });

const joueur = (rang, pseudo, metres, commission, potes, code, nom) => ({ rang, pseudo, metres, commission, potes, code, nom, total: metres + commission, classes: 240 });
const HAUT = [joueur(1, "tom", 30000, 14000, 14, "GROS", "Les quinze"), joueur(2, "solo", 41000, 0, 0, null, null), joueur(3, "lea", 20000, 16000, 14, "GROS", "Les quinze"), joueur(4, "ines", 18000, 1000, 2, "DUO", "Duo")];
const MOI = joueur(37, "pmc", 12400, 4300, 6, "ESSAI", "Ligue d'essai");
const LIGUE = [joueur(37, "pmc", 12400, 4300, 6, "ESSAI", "Ligue d'essai"), joueur(52, "lola", 3100, 5200, 6, "ESSAI", "Ligue d'essai")];

async function scenario({ largeur, hauteur, avecLigue, nom }) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await contexte.newPage();
  const erreurs = [], ecrits = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  // Rien ne sort : toute requête vers la base est servie ici, et toute écriture notée.
  await contexte.route(/supabase\.co/, async (route) => {
    const r = route.request(), u = new URL(r.url()), table = u.pathname.split("/").pop(), q = u.searchParams;
    if (r.method() !== "GET") { if (table === "ligue_scores") ecrits.push(JSON.parse(r.postData())); return route.fulfill({ status: 201, body: "" }); }
    let corps = [];
    if (table === "concours") corps = [{ id: 1, debut: "2026-11-02T07:00:00Z", fin: "2026-11-22T11:00:00Z", plafond_score: 95000, commission: 0.1 }];
    else if (table === "concours_joueurs") corps = q.get("pseudo") ? [{ ...MOI, ...(avecLigue ? {} : { code: null, nom: null, commission: 0, potes: 0, total: 12400 }) }] : q.get("code") ? LIGUE : HAUT.slice(0, Number(q.get("limit")) || 100);
    // Sept pseudos pour QUATRE téléphones : lola, sam, nina et yanis sortent
    // tous du même (« la ferme de potes »). Le boost doit donc compter 3 potes
    // et non 6 — c'est la faille trouvée par l'audit à l'aveugle du 13 novembre.
    else if (table === "ligue_scores" && avecLigue) corps = [["pmc", "tel-pmc"], ["lola", "tel-ferme"], ["sam", "tel-ferme"], ["nina", "tel-ferme"], ["yanis", "tel-ferme"], ["tom", "tel-tom"], ["hugo", "tel-hugo"]].map(([pseudo, appareil], i) => ({ pseudo, appareil, metres: 5000 - i * 500, potes: 1, trace: null }));
    else if (table === "concours_ligues") corps = [{ code: "GROS", nom: "Les quinze", joueurs: 15, total: 170000 }, { code: "ESSAI", nom: "Ligue d'essai", joueurs: 7, total: 20000 }];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
  await page.addInitScript((avecLigue) => {
    localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2Pseudo", "pmc"); localStorage.setItem("jp2Insta", "pmc.mp3"); localStorage.setItem("jp2LigueVue", "1");
    localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1,"mouette":1}'); localStorage.setItem("jp2Parties", "5");
    localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
    if (avecLigue) localStorage.setItem("jp2Ligue", JSON.stringify({ code: "ESSAI", membres: [{ nom: "pmc", skin: null }, { nom: "lola", skin: null }] }));
  }, avecLigue);
  await page.goto(`http://localhost:${port}/?debug&base`);
  await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
  // Le boost se demande directement à net.js : la bannière du menu, elle, ne se
  // rafraîchit qu'au lancement de la course, trop tard pour être lue ici.
  const boost = avecLigue ? await page.evaluate(async () => (await import("/src/net.js")).potesActifs("ESSAI", "pmc")) : null;
  await page.click("#play-button");
  await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.keyboard.press("KeyF");
  await page.waitForSelector("#end-concours:not(.hidden)", { timeout: 15000 });
  await page.waitForTimeout(600);
  const texte = (id) => page.evaluate((id) => document.getElementById(id).textContent.trim(), id);
  const fin = { rang: await texte("end-concours-rang"), detail: await texte("end-concours-detail"), ecart: await texte("end-concours-ecart") };
  await page.screenshot({ path: `${sorties}classement-${nom}-fin.png` });
  await page.evaluate(() => document.getElementById("end-concours-voir").scrollIntoView({ block: "center" }));
  await page.click("#end-concours-voir");
  await page.waitForSelector("#classement-sheet.visible");
  await page.waitForFunction(() => document.querySelectorAll("#classement-liste li").length > 0);
  await page.waitForTimeout(450);
  const lignes = () => page.evaluate(() => [...document.querySelectorAll("#classement-liste li")].map((l) => l.textContent.replace(/\s+/g, " ").trim()));
  const general = await lignes();
  await page.screenshot({ path: `${sorties}classement-${nom}-general.png` });
  const onglets = await page.evaluate(() => [...document.querySelectorAll("#classement-onglets .chip:not(.hidden)")].map((b) => b.dataset.vue));
  let ligue = null;
  if (avecLigue) {
    await page.click('#classement-onglets [data-vue="ligue"]');
    await page.waitForTimeout(250);
    ligue = await lignes();
    await page.screenshot({ path: `${sorties}classement-${nom}-ligue.png` });
  }
  await page.click('#classement-onglets [data-vue="ligues"]');
  await page.waitForTimeout(250);
  const ligues = await lignes();
  const debordement = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  // Avec le classement de la ligue en plus, REJOUER doit rester atteignable.
  await page.click("#classement-fermer");
  await page.waitForTimeout(400);
  const rejouable = await page.evaluate(() => { const b = document.getElementById("replay-button"); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  await page.screenshot({ path: `${sorties}classement-${nom}-rejouer.png` });
  await contexte.close();
  return { fin, boost, general, onglets, ligue, ligues, ecrits, erreurs, debordement, rejouable };
}

const a = await scenario({ largeur: 375, hauteur: 812, avecLigue: true, nom: "ligue" });
console.log("avec ligue :", JSON.stringify(a, null, 1));
const b = await scenario({ largeur: 320, hauteur: 568, avecLigue: false, nom: "seul" });
console.log("sans ligue :", JSON.stringify(b, null, 1));

const c = await scenario({ largeur: 320, hauteur: 568, avecLigue: true, nom: "petit" });
console.log("petit écran avec ligue :", JSON.stringify({ rejouable: c.rejouable, erreurs: c.erreurs, debordement: c.debordement }));

// Le boost compte les TÉLÉPHONES, pas les pseudos : sept pseudos sortis de
// quatre téléphones (dont le mien) valent 3 potes, donc +30 %, et non +60 %.
const okFerme = Array.isArray(a.boost) && a.boost.length === 3;
console.log("ferme de potes :", okFerme ? "OK — 7 pseudos sortis de 4 téléphones = 3 potes (+30 %), pas 6 (+60 %)" : `KO — potes comptés : ${JSON.stringify(a.boost)}`);

const okA = /37e sur 240/.test(a.fin.rang) && /12\s400\spts de record \+ 4\s300\spts de commission \(6\spotes\)/.test(a.fin.detail) && /Il te manque/.test(a.fin.ecart)
  && a.general.some((l) => /Tirage au sort/i.test(l)) && a.general[a.general.length - 1].includes("@pmc") && a.general[a.general.length - 1].startsWith("37")
  && a.onglets.join() === "general,ligue,ligues" && a.ligue.length === 2 && a.ligues.length === 2
  && a.ecrits.some((e) => e.code === "ESSAI");
const okB = /sur 240/.test(b.fin.rang) && /Chaque pote/.test(b.fin.detail) && b.onglets.join() === "general,ligues"
  && b.ecrits.length === 1 && b.ecrits[0].code === "PMCMP" && b.ecrits[0].mode === "course" && !b.ecrits[0].trace;
const propre = [a, b, c].every((x) => !x.erreurs.length && !x.debordement && x.rejouable);
verdict(okA && okB && okFerme && propre, `avec ligue : ${okA ? "rang, détail, podium, ta ligne, 3 onglets" : "ÉCHEC"} · ferme de potes : ${okFerme ? "un téléphone = un pote" : "ÉCHEC"} · sans ligue : ${okB ? "score envoyé sous PMCMP, présent au général" : "ÉCHEC"} · REJOUER atteignable sur petit écran : ${c.rejouable ? "oui" : "NON"} · ${a.erreurs.length + b.erreurs.length + c.erreurs.length} erreur(s) JS`);
await navigateur.close(); await serveur.close();
