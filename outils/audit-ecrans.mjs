// audit-ecrans.mjs — Chaque écran, sur toute la gamme de téléphones (et en
// paysage, tablette, ordinateur) : taille des cibles tactiles, texte qui
// déborde ou est coupé, petits corps, débordement horizontal. Base simulée.
//   node outils/audit-ecrans.mjs [--photos] [largeurxhauteur …]
import { createServer } from "vite";
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { verdict } from "./verdict.mjs";
const photos = process.argv.includes("--photos");
const racine = fileURLToPath(new URL("..", import.meta.url));
const sorties = fileURLToPath(new URL("./sorties/audit/", import.meta.url));
mkdirSync(sorties, { recursive: true });
const CIBLE_MIN = 44, CORPS_MIN = 11;
let ECRANS = [[320, 568, "iPhone SE 1"], [360, 640, "petit Android"], [375, 667, "iPhone SE"], [393, 852, "iPhone 16"], [412, 915, "Pixel"], [430, 932, "Pro Max"], [844, 390, "paysage"], [820, 1180, "iPad"], [1440, 900, "ordinateur"]];
const choisis = process.argv.slice(2).filter((a) => /^\d+x\d+$/.test(a));
if (choisis.length) ECRANS = ECRANS.filter(([w, h]) => choisis.includes(`${w}x${h}`));
const serveur = await createServer({ root: racine, logLevel: "error", server: { port: 5187, strictPort: false, hmr: false, watch: { ignored: ["**/*"] } } });
await serveur.listen();
const port = serveur.config.server.port;
const navigateur = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });

function inspecter([cibleMin, corpsMin]) {
  const vw = innerWidth, vh = innerHeight, out = [];
  const nom = (e) => (e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}${e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).join(".") : ""}`) + (e.textContent ? ` « ${e.textContent.trim().replace(/\s+/g, " ").slice(0, 28)} »` : "");
  const visible = (e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05; };
  const dessus = (e) => { const r = e.getBoundingClientRect(); const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2)); const t = document.elementFromPoint(x, y); return t && (e.contains(t) || t.contains(e)); };
  for (const e of document.querySelectorAll("button, a[href], input, select, textarea, [role=button], [role=slider], .chip")) {
    if (!visible(e) || e.disabled && false) continue;
    let r = e.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) continue; // hors champ d'une zone qui défile
    if (!dessus(e)) continue;
    // La zone SENSIBLE : l'élément, agrandi par son ::after invisible, ou le
    // <label> qui l'entoure (une case à cocher se coche en touchant sa ligne).
    const ap = getComputedStyle(e, "::after");
    let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    if (ap.content !== "none" && ap.position === "absolute") { x0 += Math.min(0, parseFloat(ap.left) || 0); y0 += Math.min(0, parseFloat(ap.top) || 0); x1 -= Math.min(0, parseFloat(ap.right) || 0); y1 -= Math.min(0, parseFloat(ap.bottom) || 0); }
    const lab = e.closest("label");
    if (lab) { const l = lab.getBoundingClientRect(); x0 = Math.min(x0, l.left); y0 = Math.min(y0, l.top); x1 = Math.max(x1, l.right); y1 = Math.max(y1, l.bottom); }
    const w = x1 - x0, h = y1 - y0;
    if (w < cibleMin - 0.5 || h < cibleMin - 0.5) out.push(`cible ${Math.round(w)}×${Math.round(h)} ${nom(e)}`);
    if (r.left < -1 || r.right > vw + 1) out.push(`hors écran (x ${Math.round(r.left)}→${Math.round(r.right)}) ${nom(e)}`);
  }
  if (document.documentElement.scrollWidth > vw + 1) out.push(`la page déborde en largeur (${document.documentElement.scrollWidth} > ${vw})`);
  const marche = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vus = new Set();
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    const e = n.parentElement;
    if (!n.nodeValue.trim() || !e || vus.has(e) || !visible(e) || e.closest("svg, script, style, .sr-only, [aria-hidden=true]")) continue;
    vus.add(e);
    const g = document.createRange(); g.selectNodeContents(n); const r = g.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > vh) continue;
    if (!dessus(e)) continue;
    const s = getComputedStyle(e), corps = parseFloat(s.fontSize);
    if (corps < corpsMin) out.push(`corps ${corps}px ${nom(e)}`);
    if (r.left < -1 || r.right > vw + 1) out.push(`texte hors écran (x ${Math.round(r.left)}→${Math.round(r.right)}) ${nom(e)}`);
    // Les points de suspension voulus (un pseudo trop long) ne sont pas un défaut.
    if (s.overflow === "hidden" && s.textOverflow !== "ellipsis" && e.scrollWidth > e.clientWidth + 1) out.push(`texte coupé ${nom(e)}`);
    // Un texte qui dépasse du bas d'un panneau qui ne défile pas.
    let p = e.parentElement, defile = false;
    while (p && p !== document.body) { const ps = getComputedStyle(p); if (/(auto|scroll)/.test(ps.overflowY) && p.scrollHeight > p.clientHeight + 1) { defile = true; break; } p = p.parentElement; }
    if (!defile && r.bottom > vh + 1) out.push(`sous le bas de l'écran (y ${Math.round(r.bottom)} > ${vh}) ${nom(e)}`);
  }
  return [...new Set(out)];
}

const bilan = [];
let erreursJs = 0;
for (const [w, h, appareil] of ECRANS) {
  const mobile = w < 1000;
  const contexte = await navigateur.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await contexte.route(/supabase\.co/, (route) => {
    const r = route.request(), table = new URL(r.url()).pathname.split("/").pop();
    if (r.method() !== "GET") return route.fulfill({ status: 201, body: "" });
    let corps = [];
    const j = (rang, pseudo, metres, commission) => ({ rang, pseudo, metres, commission, potes: 2, code: "ESSAI", nom: "Les Écureuils d'Été", total: metres + commission, classes: 40 });
    if (table === "concours") corps = [{ id: 1, debut: "2026-11-02T07:00:00Z", fin: "2026-11-22T11:00:00Z", plafond_score: 110000, commission: 0.1 }];
    else if (table === "concours_joueurs") corps = [j(1, "tom_le_plus_rapide_du_monde", 109000, 4000), j(2, "lola", 8000, 300), j(3, "sam", 7000, 200), j(37, "pmc", 5000, 100)];
    else if (table === "concours_ligues") corps = [{ code: "LESECUREUILSDETE", nom: "Les Écureuils d'Été", joueurs: 7, total: 120000 }];
    else if (table === "ligue_membres") corps = [{ pseudo: "pmc", skin: null }, { pseudo: "lola", skin: null }, { pseudo: "tom_le_plus_rapide_du_monde", skin: null }];
    else if (table === "ligue_scores") corps = [{ pseudo: "lola", metres: 3000, potes: 1 }, { pseudo: "tom_le_plus_rapide_du_monde", metres: 109000, potes: 5 }];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
  const page = await contexte.newPage();
  page.on("pageerror", (e) => { erreursJs++; console.log("   ⚠️ erreur JS :", e.message); });
  await page.addInitScript(() => {
    localStorage.setItem("jp2-appris", '["tap","haut","double"]'); localStorage.setItem("jp2LigueVue", "1");
    localStorage.setItem("jp2-conseils-vus", '{"lait":1,"alerte":1,"mouette":1}'); localStorage.setItem("jp2Parties", "5");
    localStorage.setItem("jp2MorceauOuvert", "1"); localStorage.setItem("jp2PmcSuivi", "1");
  });
  console.log(`\n■ ${w}×${h} — ${appareil}`);
  let n = 0;
  async function passer(nom) {
    await page.waitForTimeout(500);
    const r = await page.evaluate(inspecter, [CIBLE_MIN, CORPS_MIN]);
    for (const l of r) bilan.push({ ecran: `${w}×${h}`, nom, l });
    console.log(`  ${nom} : ${r.length ? "\n     " + r.join("\n     ") : "rien à signaler"}`);
    if (photos) await page.screenshot({ path: `${sorties}${w}x${h}-${String(++n).padStart(2, "0")}-${nom.replace(/[^a-z0-9]+/gi, "-")}.png` });
  }
  const clic = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
  try {
    await page.goto(`http://localhost:${port}/?debug&base`);
    await page.waitForFunction(() => document.getElementById("pseudo-input") && getComputedStyle(document.getElementById("overlay")).display !== "none", null, { timeout: 20000 });
    await page.waitForTimeout(6000);
    await passer("inscription vide");
    await page.fill("#pseudo-input", "pmc"); await page.fill("#insta-input", "pmc.mp3");
    await clic("#step1-next");
    await passer("mon cycliste");
    await clic("#step3-ligue");
    await passer("ma ligue sans ligue");
    await page.evaluate(() => localStorage.setItem("jp2Ligue", JSON.stringify({ code: "LESECUREUILSDETE", nom: "Les Écureuils d'Été", membres: [{ nom: "pmc", skin: null }, { nom: "lola", skin: null }, { nom: "tom_le_plus_rapide_du_monde", skin: null }] })));
    await page.reload();
    await page.waitForFunction(() => !document.getElementById("play-button").disabled, null, { timeout: 20000 });
    await passer("mon cycliste avec ligue");
    await clic("#step3-ligue");
    await passer("ma ligue avec ligue");
    await clic("#step2-back");
    await page.waitForTimeout(200);
    await clic("#play-button");
    await page.waitForFunction(() => window.__pote && window.__pote.estDemarre(), null, { timeout: 30000 });
    await page.keyboard.press("KeyI");
    for (let i = 0; i < 5; i++) await page.keyboard.press("KeyP");
    await page.waitForTimeout(2500);
    await passer("course");
    await clic("#pause-button");
    await passer("pause");
    await clic("#resume-button");
    await page.waitForTimeout(600);
    await page.keyboard.press("KeyF");
    await page.waitForSelector("#end-concours:not(.hidden)", { timeout: 15000 });
    await passer("fin de course");
    await page.evaluate(() => { const c = document.querySelector("#end-screen .panel-scroll, #end-screen"); if (c) c.scrollTop = 9999; window.scrollTo(0, 9999); });
    await passer("fin de course bas");
    await clic("#end-concours-voir");
    await page.waitForFunction(() => document.querySelectorAll("#classement-liste li").length > 0);
    await passer("classements");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(450);
    await clic("#end-ligue-partager");
    await passer("invitation");
  } catch (e) { bilan.push({ ecran: `${w}×${h}`, nom: "parcours", l: "interrompu : " + e.message.split("\n")[0] }); console.log("   ⚠️ parcours interrompu :", e.message.split("\n")[0]); if (photos) await page.screenshot({ path: `${sorties}${w}x${h}-erreur.png` }); }
  await contexte.close();
}
const tel = bilan.filter((b) => !/^(844|820|1440)/.test(b.ecran));
verdict(!tel.length && !erreursJs, `${tel.length} défaut(s) sur téléphone, ${bilan.length - tel.length} hors téléphone (paysage, tablette, ordinateur) · ${erreursJs} erreur(s) JS`);
await navigateur.close(); await serveur.close();
