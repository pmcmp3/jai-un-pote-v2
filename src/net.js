// net.js — Ligues entre potes : un code de ligue réunit des gens qui se
// connaissent, et les membres d'une ligue rejoignent la course de chacun.
// Supabase REST (config.apiBase / apiKey), tables de
// supabase-migration-ligues.sql. Jamais bloquant : sans réseau ou sans
// table, tout renvoie null et le jeu tourne avec les prénoms par défaut.

// Jamais d'appel depuis un serveur local ni un navigateur piloté (les 14 tests
// de `npm run verif` jouent de vraies parties) : ils rempliraient le tableau de
// bord de fausses courses. `?base` dans l'adresse force le branchement.
const HORS_BASE = typeof location === "undefined" || (!/[?&]base\b/.test(location.search) &&
  (navigator.webdriver || /^(localhost|127\.|10\.|192\.168\.|\[::1\]|.*\.local$)/.test(location.hostname)));
function configured() { return !HORS_BASE && Boolean(window.CONFIG.apiBase && window.CONFIG.apiKey); }
function url(table, query = "") { return `${window.CONFIG.apiBase}/${table}${query}`; }
function headers(extra = {}) {
  return { "Content-Type": "application/json", apikey: window.CONFIG.apiKey, Authorization: `Bearer ${window.CONFIG.apiKey}`, ...extra };
}
async function get(table, query) {
  if (!configured()) return null;
  try {
    const res = await fetch(url(table, query), { headers: headers() });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}
async function post(table, body, extra = {}, query = "") {
  if (!configured()) return false;
  try {
    const res = await fetch(url(table, query), { method: "POST", headers: headers({ Prefer: "return=minimal", ...extra }), body: JSON.stringify(body) });
    return res.ok;
  } catch (e) { return false; }
}

// --- Le joueur, son appareil, sa variante ------------------------------------
// Identifiant anonyme tiré au sort au premier chargement et gardé dans le
// téléphone : il ne dit pas QUI joue. Il sert à deux choses — reconnaître un
// parcours d'un bout à l'autre dans le tableau de bord, et repérer vingt
// pseudos d'une même ligue qui sortent d'un seul téléphone.
export function joueurId() {
  try { let j = localStorage.getItem("jp2Joueur"); if (!j) { j = Math.random().toString(36).slice(2, 10); localStorage.setItem("jp2Joueur", j); } return j; } catch (e) { return null; }
}

// A/B TEST : la variante d'un joueur est TIRÉE DE SON IDENTIFIANT, pas au
// hasard à chaque fois — sinon il verrait une version différente à chaque
// visite et la mesure ne voudrait rien dire. Même joueur, même variante,
// toujours. Une seule valeur dans la liste = test éteint.
export function variante(test) {
  const liste = (window.CONFIG.abTests || {})[test];
  if (!Array.isArray(liste) || !liste.length) return null;
  if (liste.length === 1) return liste[0];
  const cle = `${test}:${joueurId() || ""}`;
  let h = 2166136261;
  for (let i = 0; i < cle.length; i++) { h ^= cle.charCodeAt(i); h = Math.imul(h, 16777619); }
  return liste[Math.abs(h) % liste.length];
}

export function estConfigure() { return configured(); }
export function normaliserCode(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); }

// Code à 5 lettres sans ambiguïté (pas de O/0, I/1).
export function genererCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 5; i++) c += A[Math.floor(Math.random() * A.length)];
  return c;
}

export async function creerLigue(code, pseudo, skin = null, nom = "") {
  const cap = window.CONFIG.liguesParVague || 0; // 0 = pas de limite
  if (cap) {
    const n = await liguesCetteSemaine();
    if (n !== null && n >= cap) return { erreur: "vague" };
  }
  // Le nom s'affiche dans le classement du concours : un code à cinq lettres
  // ne se reconnaît pas, « les Bonnets » si.
  const ok = await post("ligues", { code, nom: String(nom || "").trim().slice(0, 28) || `Ligue de ${pseudo}`, createur: pseudo });
  if (!ok) return { erreur: "reseau" };
  return rejoindreLigue(code, pseudo, skin);
}

export const LIGUE_MAX = 21; // toi + 20 potes (boost de ligue)
// La bêta fermée a son propre plafond, porté par la colonne `ligues.plafond`
// (supabase-migration-beta.sql) ; sans cette colonne, repli sur plafondLigue().
export function estBeta(code) { return Boolean(window.CONFIG.ligueBeta) && code === window.CONFIG.ligueBeta; }
export function plafondLigue(code) { return estBeta(code) ? (window.CONFIG.ligueBetaPlafond || 60) : LIGUE_MAX; }

// Adhésion idempotente (doublon ignoré). Renvoie { membres }, { membres,
// homonyme: true } ou { erreur } ("inexistante", "complete", "reseau").
//
// `dejaDedans` = ce téléphone se souvient d'être dans cette ligue. Sinon, un
// pseudo déjà présent est probablement un HOMONYME — et deux « tom » ne font
// qu'un seul membre (clé unique code+pseudo) et qu'une seule ligne au
// classement (le record le plus haut gagne) : le second effacerait son propre
// score sans le voir. On ne BLOQUE pas (ce peut être lui, sur un
// nouveau téléphone, et le priver de son pseudo lui coûterait son record) :
// on le prévient, c'est tout.
export async function rejoindreLigue(code, pseudo, skin = null, dejaDedans = false) {
  // `select=*` (et pas `code`) : la colonne `plafond` n'existe pas avant la
  // migration bêta, et PostgREST refuserait un select la nommant.
  const existe = await get("ligues", `?code=eq.${encodeURIComponent(code)}&select=*`);
  if (!existe) return { erreur: "reseau" };
  if (!existe.length) return { erreur: "inexistante" };
  const cap = Number(existe[0] && existe[0].plafond) || plafondLigue(code);
  const avant = (await membres(code)) || [];
  const pris = avant.some((m) => m.nom === pseudo);
  if (!pris && avant.length >= cap) return { erreur: "complete" };
  const homonyme = pris && !dejaDedans;
  // Adhésion (doublon ignoré) puis mise à jour du skin si la colonne existe.
  await post("ligue_membres", { code, pseudo, skin: skin ? JSON.stringify(skin) : null }, { Prefer: "return=minimal,resolution=merge-duplicates" }, "?on_conflict=code,pseudo");
  const liste = await membres(code);
  return liste ? { membres: liste, homonyme } : { erreur: "reseau" };
}

// Membres = [{ nom, skin }] dans l'ordre d'arrivée.
export async function membres(code) {
  const rows = await get("ligue_membres", `?code=eq.${encodeURIComponent(code)}&select=pseudo,skin,created_at&order=created_at.asc&limit=200`);
  if (!rows) return null;
  return rows.map((r) => { let skin = null; try { skin = r.skin ? JSON.parse(r.skin) : null; } catch (e) { skin = null; } return { nom: r.pseudo, skin }; });
}

// Vagues : 5 ligues créées par semaine (lundi → dimanche), au-delà on attend lundi.
export async function liguesCetteSemaine() {
  const lundi = debutSemaine();
  const exclus = [window.CONFIG.ligueDemo || "PMCMP", window.CONFIG.ligueBeta || "BETA"].join(",");
  const rows = await get("ligues", `?created_at=gte.${lundi.toISOString()}&code=not.in.(${exclus})&select=code`);
  return rows ? rows.length : null;
}
export function debutSemaine(d = new Date()) {
  const x = new Date(d); const j = (x.getDay() + 6) % 7; x.setDate(x.getDate() - j); x.setHours(0, 0, 0, 0); return x;
}

// Score d'une course. `extra` = { graine, trace, duree } : la graine de la
// route, et la trace du fantôme quand la course bat le record de la ligue.
// ⚠️ Repli sans ces colonnes si la migration
// supabase-migration-ligues.sql (troisième partie) n'est pas passée :
// PostgREST refuse un insert portant une colonne inconnue, et le score doit
// partir quand même.
export async function envoyerScore(code, pseudo, metres, potes, mode = "course", extra = null) {
  const base = { code, pseudo, metres: Math.floor(metres), potes, mode };
  if (extra && extra.graine !== undefined && extra.graine !== null) {
    const ok = await post("ligue_scores", { ...base, graine: extra.graine, trace: extra.trace || null, duree_s: Math.floor(extra.duree || 0), appareil: joueurId() });
    if (ok) return true;
  }
  return post("ligue_scores", base);
}

// Boost de ligue : les AUTRES membres qui ont fait au moins une course de
// `boostLigueDureeS` secondes dans cette ligue (null = pas de réseau).
//
// ⚠️ UN APPAREIL = UN POTE, jamais un pseudo (13 novembre 2026). Un audit à
// l'aveugle du concours l'a trouvé : on comptait les pseudos distincts, donc
// vingt pseudos créés sur un SEUL téléphone — dix minutes en navigation
// privée, trente et une secondes de jeu chacun — donnaient le boost maximum
// (×3) à vie. C'était la meilleure stratégie du concours, et elle battait le
// recrutement de vrais potes. La commission, elle, dédoublonnait déjà par
// appareil (vue `concours_joueurs`) : le boost était la moitié oubliée de la
// même règle.
// Repli sur le pseudo pour les scores d'avant la colonne `appareil`, et on ne
// se compte jamais soi-même — ni sous son pseudo, ni sous son appareil.
export async function potesActifs(code, moi) {
  const min = window.CONFIG.boostLigueDureeS || 30;
  const rows = await get("ligue_scores", `?code=eq.${encodeURIComponent(code)}&duree_s=gte.${min}&select=pseudo,appareil&limit=2000`);
  if (!rows) return null;
  const mien = joueurId();
  const vus = new Set();
  for (const r of rows) {
    if (r.pseudo === moi) continue;
    if (mien && r.appareil === mien) continue;
    vus.add(r.appareil || `pseudo:${r.pseudo}`);
  }
  return [...vus];
}

// Le FANTÔME de la ligue : la meilleure course (avec trace) sur CETTE route.
export async function fantome(code, graine) {
  const rows = await get("ligue_scores", `?code=eq.${encodeURIComponent(code)}&mode=eq.course&graine=eq.${graine}&trace=not.is.null&select=pseudo,metres,trace&order=metres.desc&limit=1`);
  return rows && rows.length ? rows[0] : null;
}

// Relais de ligue : mètres cumulés de la semaine (vue ligue_relais).
export async function relais(code) {
  const rows = await get("ligue_relais", `?code=eq.${encodeURIComponent(code)}&select=metres,parties`);
  return rows && rows.length ? rows[0] : { metres: 0, parties: 0 };
}

// Sprint du dimanche : classement du jour, toutes ligues confondues.
export function jourSprint(d = new Date()) { return d.toISOString().slice(0, 10); }
export function sprintOuvert(d = new Date()) { return d.getDay() === 0 && d.getHours() >= 12; }
export async function classementSprint(jour) {
  return get("ligue_scores", `?mode=eq.sprint&created_at=gte.${jour}T00:00:00&select=pseudo,code,metres&order=metres.desc&limit=20`);
}

// Événements du funnel : fire-and-forget.
// Chaque événement porte la VISITE (une par chargement de page) et le JOUEUR
// (identifiant anonyme gardé dans le téléphone) : le tableau de bord en tire
// les parcours, les durées et l'endroit où l'on quitte. `keepalive` : l'envoi
// part même quand la page se ferme. `window.__evenements` garde la liste de la
// visite (tests et ?debug), base branchée ou non.
const VISITE = Math.random().toString(36).slice(2, 10);
export function evenement(type, infos = {}) {
  const ligne = { type, ...infos, details: { ...(infos.details || {}), visite: VISITE, joueur: joueurId(), ab: variante("ecoute"), depuisChargement: Math.round(performance.now() / 1000) } };
  (window.__evenements = window.__evenements || []).push(ligne);
  if (!configured()) return;
  try {
    fetch(url("evenements"), { method: "POST", keepalive: true, headers: headers({ Prefer: "return=minimal" }), body: JSON.stringify(ligne) }).catch(() => {});
  } catch (e) { /* pas de réseau */ }
}

// Retour d'un testeur (bêta fermée) : écrit depuis l'écran de fin, lié au
// pseudo, jamais relu par le jeu (table retours_beta, insert-only, lue dans
// le tableau de bord Supabase).
// ⚠️ Renvoie le DÉTAIL de l'échec (statut HTTP ou message PostgREST), affiché
// par le tiroir : sans lui, un retour perdu ne laisse aucune trace à l'écran.
export async function envoyerRetour(infos) {
  if (!configured()) return { ok: false, detail: "hors ligne" };
  try {
    const res = await fetch(url("retours_beta"), { method: "POST", headers: headers({ Prefer: "return=minimal" }), body: JSON.stringify(infos) });
    if (res.ok) return { ok: true };
    let detail = `erreur ${res.status}`;
    try { const j = await res.json(); if (j && j.message) detail += ` · ${j.message}`; } catch (e) { /* corps vide */ }
    return { ok: false, detail };
  } catch (e) { return { ok: false, detail: "pas de réseau" }; }
}

// Classement de la ligue. Avec `graine` : seules les courses de CETTE route
// comptent (les scores d'une ancienne version du parcours restent en base
// mais sortent du classement), meilleure course par pseudo, agrégée ici —
// une ligue ne pèse que quelques centaines de lignes. Sans graine (ou colonne
// absente) : la vue ligue_classement.
export async function classement(code, graine) {
  if (graine !== undefined && graine !== null) {
    const rows = await get("ligue_scores", `?code=eq.${encodeURIComponent(code)}&mode=eq.course&graine=eq.${graine}&select=pseudo,metres,potes&order=metres.desc&limit=500`);
    if (rows) {
      const par = new Map();
      for (const r of rows) {
        const m = par.get(r.pseudo) || { pseudo: r.pseudo, metres: 0, potes: 0, parties: 0 };
        m.metres = Math.max(m.metres, Number(r.metres) || 0);
        m.potes = Math.max(m.potes, Number(r.potes) || 0);
        m.parties += 1;
        par.set(r.pseudo, m);
      }
      return [...par.values()].sort((a, b) => b.metres - a.metres);
    }
  }
  return get("ligue_classement", `?code=eq.${encodeURIComponent(code)}&select=pseudo,metres,potes,parties&order=metres.desc&limit=50`);
}

// --- LE CONCOURS ----------------------------------------------------------------
// La règle : score au général = ton record + une commission sur le record de
// chaque pote de ta ligue. À la clôture, tirage au sort entre les 3 premiers.
// Tout est calculé par la base (vue `concours_joueurs`,
// CLASSEMENT-GENERAL-A-COLLER.sql) : le jeu ne fait que lire.

// Dates et plafond, lus une fois par chargement. La base fait foi ; sans
// réseau, repli sur `config.concoursFin` pour que le compte à rebours
// s'affiche quand même.
let concoursCache;
export async function concours() {
  if (concoursCache !== undefined) return concoursCache;
  const rows = await get("concours", "?id=eq.1&select=*");
  const repli = window.CONFIG.concoursFin ? { debut: null, fin: window.CONFIG.concoursFin, plafond_score: null } : null;
  concoursCache = rows && rows.length ? rows[0] : repli;
  return concoursCache;
}
// Reste-t-il du temps ? (null = on ne sait pas, donc on n'affiche rien.)
export function restantMs(c, maintenant = Date.now()) {
  if (!c || !c.fin) return null;
  const fin = Date.parse(c.fin);
  return Number.isFinite(fin) ? fin - maintenant : null;
}

// Classement des ligues (pour l'honneur : le lot se joue au général), la plus
// forte d'abord. Les ligues de test en sont
// exclues par la base (colonne `ligues.concours`), jamais par le jeu.
export async function classementLigues(limite = 100) {
  return get("concours_ligues", `?select=code,nom,joueurs,total&order=total.desc,code.asc&limit=${limite}`);
}

// Le classement général : tous les joueurs, avec ou sans ligue.
const CHAMPS_JOUEUR = "pseudo,metres,commission,potes,total,rang,classes,code,nom";
export async function classementGeneral(limite = 100) {
  return get("concours_joueurs", `?select=${CHAMPS_JOUEUR}&order=rang.asc&limit=${limite}`);
}
// La ligne d'un joueur (son rang, même loin du haut du classement).
export async function maPlace(pseudo) {
  if (!pseudo) return null;
  const rows = await get("concours_joueurs", `?pseudo=eq.${encodeURIComponent(pseudo)}&select=${CHAMPS_JOUEUR}&limit=1`);
  return rows && rows.length ? rows[0] : null;
}
// Les joueurs d'une ligue, dans l'ordre du général.
export async function joueursDeLigue(code) {
  return get("concours_joueurs", `?code=eq.${encodeURIComponent(code)}&select=${CHAMPS_JOUEUR}&order=rang.asc&limit=${LIGUE_MAX + 10}`);
}

// La fiche de contact du joueur : c'est la SEULE chose qui permettra de
// prévenir la ligue gagnante. Table en insertion seule, illisible avec la clé
// publique — une ligne de plus à chaque enregistrement, la plus récente fait foi.
export async function enregistrerJoueur({ pseudo, insta, email, newsletter, ville, ligue }) {
  if (!pseudo) return false;
  return post("joueurs", {
    pseudo, insta: insta || null, email: email || null,
    newsletter: Boolean(newsletter), ville: ville || null, ligue: ligue || null,
    appareil: joueurId(),
  });
}
