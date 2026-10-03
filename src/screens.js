// screens.js — Écrans hors-jeu de « J'ai un pote » : menu (un seul champ),
// écran de fin, carte de mort, tiroir album (même échelle de conversion que
// le premier jeu, mêmes clés localStorage — un joueur qui a déjà ouvert
// l'album sur l'autre jeu est « libre » ici aussi), pause, son.
// Câblage DOM et présentation uniquement ; main.js garde l'état de partie et
// reçoit les actions en callbacks via init().

import * as audio from "./audio.js";
import * as sfx from "./sfx.js";
import * as net from "./net.js";
import * as friends from "./friends.js";
import { COULEURS, CHAPEAUX, VELOS, SKIN_DEFAUT } from "./rider.js";

const pts = (n) => `${Math.floor(Number(n) || 0).toLocaleString("fr-FR")} pts`;

let deps = null;
const $ = (id) => document.getElementById(id);

const overlay = $("overlay");
const onboardingEl = $("onboarding");
const endScreenEl = $("end-screen");
const pseudoInput = $("pseudo-input");
const playButton = $("play-button");
const loadingBlock = $("loading");
const loadingFill = $("loading-fill");
const loadingLabel = $("loading-label");
const ctaLink = $("cta-link");
const endCta = $("end-cta");
const scoreVal = $("score-val");
const endSub = $("end-sub");
const endBest = $("end-best");
const replayButton = $("replay-button");
const instaLink = $("insta-link");
const reviveSheet = $("revive-sheet");
const reviveArc = $("revive-arc");
const reviveTimer = $("revive-timer");
const reviveTimerNum = $("revive-timer-num");
const reviveTitle = $("revive-title");
const reviveText = $("revive-text");
const reviveCta = $("revive-cta");
const reviveReplay = $("revive-replay");
const reviveDecline = $("revive-decline");
const gateSheet = $("gate-sheet");
const gatePlatforms = $("gate-platforms");
const gateHint = $("gate-hint");
const gateEyebrow = $("gate-eyebrow");
const gateTitle = $("gate-title");
const gateText = $("gate-text");
const gateCta = $("gate-cta");
const gateCtaLabel = $("gate-cta-label");
const gateGo = $("gate-go");
const gateLater = $("gate-later");
const muteButton = $("mute-button");
const pauseButton = $("pause-button");
const pauseScreen = $("pause-screen");
const pauseVolumeSlider = $("pause-volume-slider");
const resumeButton = $("resume-button");
const pauseReplayButton = $("pause-replay-button");

// --- Conversion (mêmes clés que le premier jeu) -----------------------------
// Clés PROPRES à « J'ai un pote » depuis le 7 septembre 2026 : quelqu'un qui a
// déjà franchi le tiroir sur « La ville est belle » repasse par l'album ici
// (« la personne avait déjà joué, elle a pu rejouer sans passer par Spotify »).
const CLE_MORCEAU_OUVERT = "jp2MorceauOuvert";
const CLE_PMC_SUIVI = "jp2PmcSuivi";
const CLE_PLATEFORME = "jp2PlateformeAlbum";
const CLE_PSEUDO = "jp2Pseudo";
const CLE_RECORD = "jp2Record";
const CLE_PARTIES = "jp2Parties";
const CLE_LIGUE = "jp2Ligue";
const CLE_INSTA = "jp2Insta", CLE_VILLE = "jp2Ville", CLE_SKIN = "jp2Skin", CLE_SOURCE = "jp2Source", CLE_SPRINT = "jp2Sprint";

// --- Bêta fermée (16 septembre 2026) -----------------------------------------
// Une seule ligue pour les fans du groupe WhatsApp : on arrive par
// `…/jai-un-pote/?ligue=BETA`, le menu se réduit (pseudo → cycliste → JOUER),
// il n'y a ni choix de ligue, ni sprint, ni tiroir album, et l'écran de fin
// porte un bouton « Laisser un retour ». Les autres visiteurs, eux, gardent le
// jeu normal : le mode ne s'allume QUE si la ligue courante est celle-là.
const CODE_BETA = String(window.CONFIG.ligueBeta || "").toUpperCase();
export function enBeta() { return Boolean(CODE_BETA) && Boolean(ligue) && ligue.code === CODE_BETA; }

// `?zero` : tout effacer (pseudo, record, conversion) — « comme si je n'avais
// jamais joué ». Même origine que le premier jeu, donc ça le remet à zéro aussi.
try {
  if (new URLSearchParams(location.search).has("zero")) {
    localStorage.clear();
    const url = new URL(location.href); url.searchParams.delete("zero"); history.replaceState(null, "", url.toString());
  }
  // `?premiere` (3 octobre 2026 : « un lien comme si c'était la première fois
  // que je me connectais et que je pouvais créer ma ligue ») : tout effacer
  // comme `?zero`, puis ligue démo VIDE — on crée sa ligue, on « invite », des
  // potes fictifs arrivent un par un et le boost monte. Rien ne part au réseau.
  if (new URLSearchParams(location.search).has("premiere")) {
    localStorage.clear();
    localStorage.setItem("jp2Demo", "cree");
    const url = new URL(location.href); url.searchParams.delete("premiere"); history.replaceState(null, "", url.toString());
  }
} catch (e) { /* rien */ }
try {
  if (new URLSearchParams(location.search).has("neuf")) {
    localStorage.removeItem(CLE_MORCEAU_OUVERT);
    localStorage.removeItem(CLE_PMC_SUIVI);
    localStorage.removeItem(CLE_PLATEFORME);
    localStorage.removeItem("jp2-appris"); // le tuto contextuel se rejoue
    localStorage.removeItem("jp2-conseils-vus");
    const url = new URL(location.href); url.searchParams.delete("neuf"); history.replaceState(null, "", url.toString());
  }
} catch (e) { /* rien */ }

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* navigation privée */ } }

function morceauDejaOuvert() { return lsGet(CLE_MORCEAU_OUVERT) === "1"; }
function pmcDejaSuivi() { return lsGet(CLE_PMC_SUIVI) === "1"; }
let fanCache = morceauDejaOuvert();
export function estFan() { return fanCache; }
function niveauConversion() {
  if (!morceauDejaOuvert()) return "presave";
  if (!pmcDejaSuivi()) return "suivre";
  return "libre";
}
export function niveauConversionCourant() { return niveauConversion(); }

export function getPseudo() { return pseudoInput.value.trim().replace(/^@+/, ""); }
const instaInput = $("insta-input"), villeInput = $("ville-input");
export function getInsta() { return instaInput.value.trim().replace(/^@+/, ""); }
export function getVille() { return villeInput.value.trim(); }
export function getSource() { return lsGet(CLE_SOURCE) || null; }
// Skin du joueur (personnalisation, étape 3 du menu).
let skin = null;
export function getSkin() {
  if (!skin) { try { skin = { ...SKIN_DEFAUT, ...(JSON.parse(lsGet(CLE_SKIN) || "{}")) }; } catch (e) { skin = { ...SKIN_DEFAUT }; } if (skin.velo === "roller") skin.velo = "enfant"; }
  return skin;
}
function setSkin(cle, val) { getSkin()[cle] = val; lsSet(CLE_SKIN, JSON.stringify(skin)); construireSkinUi(); }
function construireSkinUi() {
  const sk = getSkin();
  // Menu réduit le 20 septembre 2026 (« il faut réduire : si on choisit le
  // T-shirt, on ne choisit pas le short ») : trois réglages au lieu de six —
  // le short et les chaussures se déduisent du maillot. Sur un petit iPhone,
  // la carte tenait à peine à l'écran.
  const listes = { genre: [["Homme", "homme"], ["Femme", "femme"]], c1: COULEURS, chapeau: CHAPEAUX.map((c) => [c, c]), velo: [["VTT", "vtt"], ["Grand Bi", "grandbi"], ["Vélo enfant", "enfant"]] };
  document.querySelectorAll("#skin-options .chips").forEach((box) => {
    const cle = box.dataset.cle;
    box.textContent = "";
    for (const [label, val] of listes[cle]) {
      const b = document.createElement("button");
      b.type = "button";
      const couleur = cle === "c1" || cle === "short" || cle === "chaussures";
      b.className = `chip${couleur ? " couleur" : ""}${sk[cle] === val ? " actif" : ""}`;
      if (couleur) { b.style.background = val; b.title = label; b.setAttribute("aria-label", label); } else b.textContent = label;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        setSkin(cle, val);
        // Le reste de la tenue suit le maillot : short foncé assorti,
        // chaussures claires ou sombres selon la couleur choisie.
        if (cle === "c1") {
          const clair = ["#f2ede2", "#ffcf2e"].includes(val);
          setSkin("c2", clair ? "#e13e26" : "#f2ede2");
          setSkin("short", clair ? "#3a3e4e" : "#33353d");
          setSkin("chaussures", clair ? "#33353d" : "#f2ede2");
        }
      });
      box.appendChild(b);
    }
  });
}

// --- Menu en trois étapes ----------------------------------------------------
const onboarding = $("onboarding");
export function setStep(n) {
  if (enBeta() && n === 2) n = 3; // pas d'étape « ma ligue » en bêta : elle est imposée
  onboarding.dataset.step = String(n); if (n === 3) construireSkinUi(); majSprint(); majBoutonJouer();
}
// Ordre du premier passage (3 octobre 2026 : « choisir son personnage, ça
// arrive avant de créer la ligue [...] ils ont envie de jouer ») : pseudo →
// cycliste (« Continuer ») → ligue (« Jouer »). Ensuite, le cycliste est
// l'accueil avec JOUER, la ligue reste à un tap (« Ma ligue »).
const CLE_LIGUE_VUE = "jp2LigueVue";
function premierPassage() { return ligueDispo() && !ligue && !lsGet(CLE_LIGUE_VUE); }
function majBoutonJouer() {
  const premier = premierPassage();
  playButton.textContent = premier ? "Continuer" : "Jouer";
  playButton.disabled = getPseudo().length === 0 || (!premier && !loadingDone);
  const b = $("boost-ligue"), liens = $("step3-links");
  if (liens) liens.classList.toggle("hidden", premier);
  if (b && premier) b.classList.add("hidden"); else afficherBoost();
}
export function stepCourante() { return Number(onboarding.dataset.step) || 1; }
function enregistrerProfil() {
  const nouveau = !lsGet(CLE_PSEUDO);
  lsSet(CLE_PSEUDO, getPseudo()); lsSet(CLE_INSTA, getInsta()); lsSet(CLE_VILLE, getVille());
  if (nouveau) net.evenement("inscription", { pseudo: getPseudo(), source: getSource(), ligue: ligue ? ligue.code : null });
}
export function getRecord() { return Number(lsGet(CLE_RECORD)) || 0; }
export function getParties() { return Number(lsGet(CLE_PARTIES)) || 0; }
export function compterPartie() { lsSet(CLE_PARTIES, String(getParties() + 1)); }
export function setRecord(m) { lsSet(CLE_RECORD, String(Math.floor(m))); }

export function showOverlay() { overlay.classList.add("visible"); }
export function hideOverlay() { overlay.classList.remove("visible"); }
export function showOverlayOnLoad() { requestAnimationFrame(() => requestAnimationFrame(showOverlay)); }

function setView(view) {
  onboardingEl.classList.toggle("active", view === "onboarding");
  endScreenEl.classList.toggle("active", view === "end");
  overlay.classList.toggle("end-view", view === "end");
  ctaLink.style.display = view === "onboarding" ? "" : "none";
}

// --- Décompte circulaire (carte de mort) -----------------------------------
const REVIVE_DELAI_S = 10;
const REVIVE_TICK_MAX_S = 0.3;
const ARC = 2 * Math.PI * 33;

function creerDecompte(boite, num, arc) {
  let id = 0, restant = 0, total = 1;
  const maj = () => {
    num.textContent = `${Math.max(0, Math.ceil(restant))}`;
    arc.style.strokeDashoffset = `${ARC * (1 - Math.max(0, restant) / total)}`;
  };
  return {
    get restant() { return restant; },
    arreter() { clearInterval(id); id = 0; },
    demarrer(duree, onZero) {
      clearInterval(id);
      total = duree; restant = duree;
      boite.classList.remove("hidden");
      maj();
      audio.setReviveIntensity(0);
      let precedent = performance.now();
      id = setInterval(() => {
        const maintenant = performance.now();
        const ecoule = Math.min((maintenant - precedent) / 1000, REVIVE_TICK_MAX_S);
        precedent = maintenant;
        if (document.hidden) return;
        restant -= ecoule;
        maj();
        audio.setReviveIntensity(1 - Math.max(0, restant) / total);
        if (restant <= 0) { clearInterval(id); id = 0; onZero(); }
      }, 100);
    },
  };
}
const decompteRevive = creerDecompte(reviveTimer, reviveTimerNum, reviveArc);

let reviveCallbacks = null;
let reviveMetres = 0;

// `potes` = nombre de potes au maximum de la course : la carte les promet de
// retour (c'est le ressort émotionnel demandé : les potes s'en vont, ouvre
// l'album pour les rattraper).
export function openReviveSheet({ metres, potes, onAccept, onDecline, onReplay }) {
  reviveCallbacks = { onAccept, onDecline, onReplay };
  reviveMetres = metres;
  reviveTitle.textContent = potes > 0 ? "Tes potes t'attendent" : "Ta course n'est pas finie";
  reviveText.textContent = potes > 0
    ? `Reprends à ${pts(metres)}, et ${Math.min(2, potes)} pote${Math.min(2, potes) > 1 ? "s" : ""} te retombe${Math.min(2, potes) > 1 ? "nt" : ""} dessus.`
    : `Reprends pile ici, à ${pts(metres)}.`;
  reviveCta.classList.remove("locked");
  reviveSheet.classList.add("visible");
  reviveSheet.setAttribute("aria-hidden", "false");
  decompteRevive.demarrer(REVIVE_DELAI_S, () => reviveResoudre("onDecline"));
}
function closeReviveSheet() {
  decompteRevive.arreter();
  reviveSheet.classList.remove("visible");
  reviveSheet.setAttribute("aria-hidden", "true");
}
function reviveResoudre(issue) {
  if (!reviveCallbacks) return;
  const cb = reviveCallbacks[issue];
  reviveCallbacks = null;
  closeReviveSheet();
  cb();
}
function reprendreDecompteRevive(restant) {
  if (!reviveCallbacks) return;
  if (restant <= 0) { reviveResoudre("onDecline"); return; }
  decompteRevive.demarrer(restant, () => reviveResoudre("onDecline"));
}

// --- Tiroir album ------------------------------------------------------------
let gateEtat = null;
let gateRetourTimer = 0;

function plateformes() {
  const l = window.CONFIG.plateformesAlbum;
  return Array.isArray(l) ? l.filter((p) => p && p.url && p.nom) : [];
}
function texteGeste(liste) {
  const pref = liste.find((p) => p.id === lsGet(CLE_PLATEFORME));
  const geste = pref && pref.geste ? pref.geste : "appuie sur ＋ ou ♥";
  return `Une fois dans l'app : ${geste} pour ajouter l'album à ta bibliothèque.`;
}
function construirePlateformes() {
  const liste = plateformes();
  gatePlatforms.textContent = "";
  if (!liste.length) return false;
  // Cinq liens de la même taille, sans « préféré » (6 septembre 2026).
  liste.forEach((p) => {
    const a = document.createElement("a");
    a.className = "plat-btn";
    a.href = p.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    const dot = document.createElement("span"); dot.className = "plat-dot"; dot.style.background = p.couleur || "#0d0d10";
    const nom = document.createElement("span"); nom.className = "plat-nom"; nom.textContent = p.nom;
    const fl = document.createElement("span"); fl.className = "plat-fleche"; fl.textContent = "↗";
    a.append(dot, nom, fl);
    a.addEventListener("click", () => {
      if (!gateEtat || gateEtat.phase !== "demande") return;
      lsSet(CLE_PLATEFORME, p.id || p.nom);
      lsSet(CLE_MORCEAU_OUVERT, "1");
      net.evenement("clic_album", { pseudo: getPseudo(), ligue: ligue ? ligue.code : null, source: getSource() });
      fanCache = true;
      setTimeout(gatePhaseAbsence, 0);
    });
    gatePlatforms.appendChild(a);
  });
  return true;
}

// Même tiroir, même wording pour les trois entrées (6 septembre 2026 :
// « ça doit être la même condition pour rejouer [...] tu vires le titre, tu
// mets "Ajoute l'album à ta bibliothèque pour continuer la partie" »).
function gateTextes(action, niveau) {
  const continuer = action === "continuer";
  const presave = niveau === "presave";
  return {
    // Sticker rouge, comme toutes les cartes (28 septembre 2026, cohérence des menus).
    eyebrow: presave ? "L'album est sorti" : "Dernière étape",
    titre: presave
      ? (continuer ? "Ajoute l'album à ta bibliothèque pour continuer la partie" : "Ajoute l'album à ta bibliothèque pour rejouer")
      : (continuer ? "Abonne-toi à PMC pour continuer la partie" : "Abonne-toi à PMC pour rejouer"),
    texte: "",
    ctaLabel: presave ? "Écouter l'album" : "S'abonner à PMC",
    goLabel: continuer ? "Continuer ma course" : "Rejouer",
  };
}

function ouvrirGate({ action, onUnlocked, onCancel, niveauForce, goLabelForce = null }) {
  const niveau = niveauForce || niveauConversion();
  const t = gateTextes(action, niveau);
  gateEtat = { action, onUnlocked, onCancel, niveau, phase: "demande" };
  gateEyebrow.textContent = t.eyebrow;
  gateEyebrow.classList.toggle("hidden", !t.eyebrow);
  gateTitle.textContent = t.titre;
  gateText.textContent = t.texte;
  gateText.classList.toggle("hidden", !t.texte);
  gateCtaLabel.textContent = t.ctaLabel;
  gateCta.href = niveau === "presave" ? ((plateformes()[0] || {}).url || "#") : (window.CONFIG.lienSuivre || "#");
  const panneau = niveau === "presave" && construirePlateformes();
  gatePlatforms.classList.toggle("hidden", !panneau);
  gateHint.classList.add("hidden");
  gateCta.classList.toggle("hidden", panneau);
  gateGo.textContent = goLabelForce || t.goLabel;
  gateGo.classList.add("hidden");
  gateGo.classList.add("locked");
  gateLater.textContent = "Fermer";
  gateSheet.classList.add("visible");
  gateSheet.setAttribute("aria-hidden", "false");
}
function gatePhaseAbsence() {
  if (!gateEtat) return;
  gateEtat.phase = "absence";
  gateTitle.textContent = gateEtat.niveau === "presave" ? "Tu l'as ajouté ? Merci !" : "Abonnement enregistré, merci !";
  gateText.textContent = gateEtat.action === "ecouter" ? "Reviens dans le jeu quand tu veux." : "Reviens dans le jeu quand tu veux, c'est débloqué.";
  gateText.classList.remove("hidden");
  gatePlatforms.classList.add("hidden");
  gateHint.classList.add("hidden");
  gateCta.classList.add("hidden");
  gateGo.classList.remove("hidden");
  gateGo.classList.add("locked");
  audio.setReviveIntensity(0);
  clearTimeout(gateRetourTimer);
  gateRetourTimer = setTimeout(() => { if (gateEtat && gateEtat.phase === "absence" && !document.hidden) gatePhasePret(); }, 1800);
}
function gatePhasePret() {
  if (!gateEtat) return;
  clearTimeout(gateRetourTimer);
  gateEtat.phase = "pret";
  audio.setReviveIntensity(1);
  gateTitle.textContent = gateEtat.action === "ecouter" ? "Merci !" : "C'est reparti !";
  gateText.textContent = gateEtat.action === "continuer" ? "Tes potes reviennent. Reprends quand tu es prêt." : gateEtat.action === "ecouter" ? "Bonne écoute." : "Nouvelle course, quand tu veux.";
  gateText.classList.remove("hidden");
  gateGo.classList.remove("hidden");
  gateGo.classList.remove("locked");
}
function fermerGate() {
  clearTimeout(gateRetourTimer);
  gateSheet.classList.remove("visible");
  gateSheet.setAttribute("aria-hidden", "true");
}
function gateResoudre(issue) {
  if (!gateEtat) return;
  const cb = issue === "onUnlocked" ? gateEtat.onUnlocked : gateEtat.onCancel;
  gateEtat = null;
  fermerGate();
  if (cb) cb();
}
export function ouvrirEcoute() {
  if (!plateformes().length) return;
  // Depuis l'écran de fin, le bouton armé au retour relance une course ;
  // depuis le menu, il ferme simplement (JOUER est juste là).
  const enFin = endScreenEl.classList.contains("active");
  ouvrirGate({
    action: "rejouer", niveauForce: "presave",
    onUnlocked: enFin ? () => { hideOverlay(); showPauseButton(); deps.restartGame(); } : null,
    onCancel: null,
    goLabelForce: enFin ? null : "Fermer",
  });
}
function exigerConversion({ action, onOk, onCancel }) {
  // En bêta, aucune porte : les testeurs sont déjà des fans (groupe WhatsApp)
  // et doivent pouvoir enchaîner les parties pour trouver des bugs.
  if (enBeta() || niveauConversion() === "libre") { onOk(); return; }
  ouvrirGate({ action, onUnlocked: onOk, onCancel });
}

// --- Ligue entre potes (7 septembre 2026) -------------------------------------
// Un code à 5 lettres, stocké en local. Les autres membres deviennent les
// potes du peloton ; chaque course envoie un score ; l'écran de fin montre le
// classement de la ligue. `?ligue=CODE` dans l'URL = invitation.
const ligueBloc = $("ligue-bloc"), ligueSans = $("ligue-sans"), ligueAvec = $("ligue-avec");
const ligueInput = $("ligue-input"), ligueRejoindre = $("ligue-rejoindre"), ligueCreer = $("ligue-creer");
const ligueCodeEl = $("ligue-code"), ligueMembresEl = $("ligue-membres"), liguePartager = $("ligue-partager"), ligueQuitter = $("ligue-quitter"), ligueMsg = $("ligue-msg");
const endLigue = $("end-ligue"), endLigueCode = $("end-ligue-code"), endLigueListe = $("end-ligue-liste"), endLiguePartager = $("end-ligue-partager");
let ligue = null;           // { code, membres: [] }
let ligueInvitation = null; // code reçu par l'URL, en attente d'un pseudo

export function getLigue() { return ligue; }
// --- LIGUE DÉMO (29 septembre 2026 : « copie-moi le lien avec ma ligue, pour
// que ce soit une ligue fake ») -------------------------------------------------
// `?demo` dans l'URL : une ligue locale, sans réseau, pour montrer le système
// — 6 potes ont « joué », boost ×1,6 actif, classement de fin où l'on se
// compare à eux. Rien n'est envoyé nulle part. Mémorisé (jp2Demo) jusqu'à `?zero`.
const DEMO = { code: "DEMO", noms: ["lea", "marius", "ines", "hugo", "nita", "oscar"] };
let demo = false, demoCree = false; // demoCree : ligue démo à créer soi-même (`?premiere`)
try {
  if (new URLSearchParams(location.search).has("demo")) { localStorage.setItem("jp2Demo", "1"); const u = new URL(location.href); u.searchParams.delete("demo"); history.replaceState(null, "", u.toString()); }
  const m = localStorage.getItem("jp2Demo");
  demo = m === "1" || m === "cree"; demoCree = m === "cree";
} catch (e) { demo = false; }
// `?premiere` : après « Inviter des potes », les potes fictifs rejoignent la
// ligue un par un (le partage réel enverrait un lien vers une ligue qui n'existe pas).
let arriveesDemo = [];
function stopperArrivees() { arriveesDemo.forEach(clearTimeout); arriveesDemo = []; }
function simulerArrivees() {
  if (arriveesDemo.length || !ligue) return;
  const deja = new Set(ligue.membres.map((m) => m.nom));
  const noms = DEMO.noms.filter((n) => !deja.has(n));
  if (!noms.length) { ligueMessage("Tous tes potes sont là !"); return; }
  ligueMessage("Ici c'est pour de faux : tes potes reçoivent le lien…");
  noms.forEach((nom, i) => arriveesDemo.push(setTimeout(() => {
    if (!ligue) return;
    ligue.membres.push({ nom, skin: null });
    memoriserLigue(); appliquerNomsLigue(); afficherLigue(); rafraichirBoost();
    ligueMessage(`@${nom} a joué : tes points +${Math.round((boost.mult - 1) * 100)} %`);
    if (i === noms.length - 1) arriveesDemo = [];
  }, 1800 + i * 1500)));
}
export function estDemo() { return demo; }
// Classement fake : les potes démo s'étagent SOUS une course terminée (on veut
// voir « tu es premier »), au-dessus d'une course écourtée.
function autresDemo() { const moi = getPseudo(); return ligue ? ligue.membres.map((m) => m.nom).filter((n) => n !== moi) : []; }
function classementDemo(metres, fin) {
  const base = fin ? metres : Math.max(metres * 1.6, 900);
  const f = [0.93, 0.81, 0.7, 0.58, 0.44, 0.31];
  const rows = autresDemo().slice(0, f.length).map((n, i) => ({ pseudo: n, metres: Math.round(base * f[i]) }));
  rows.push({ pseudo: getPseudo() || "toi", metres: Math.floor(metres) });
  const moi = getPseudo() || "toi";
  return rows.sort((a, b) => b.metres - a.metres || (a.pseudo === moi ? -1 : b.pseudo === moi ? 1 : 0));
}
// Boost de ligue : { potes: [pseudos], mult }.
let boost = { potes: [], mult: 1 };
export function getBoost() { return boost; }
function calculerBoost(potes) {
  const C = window.CONFIG;
  const n = Math.min(potes.length, C.boostLigueMaxPotes || 20);
  boost = { potes, mult: Math.round((1 + n * (C.boostLigueParPote || 0.1)) * 100) / 100 };
  afficherBoost();
}
function afficherBoost() {
  const el = $("boost-ligue");
  if (!el) return;
  // Sans base Supabase, pas de ligue : le boost ne peut compter personne
  // (sauf en ligue démo).
  el.classList.toggle("hidden", (!net.estConfigure() && !demo) || enBeta());
  const C = window.CONFIG, pct = Math.round((C.boostLigueParPote || 0.1) * 100);
  const n = ligue && !ligue.enAttente ? ligue.membres.filter((m) => m.nom !== getPseudo()).length : 0;
  // Explication en deux lignes (« il faut que j'arrive à trouver un moyen
  // d'expliquer assez simplement comment ça fonctionne ») : le chiffre, puis la règle.
  el.innerHTML = "";
  const titre = document.createElement("b");
  // En POURCENTAGE (« les 1,6 %, faut faire des phrases plus simples »).
  titre.textContent = `TES POINTS +${Math.round((boost.mult - 1) * 100)} %`;
  const ligne1 = document.createElement("span");
  ligne1.textContent = n ? ` · ${n} pote${n > 1 ? "s" : ""} dans ta ligue` : "";
  const regle = document.createElement("small");
  regle.textContent = `1 pote qui joue ${C.boostLigueDureeS || 30} s = +${pct} % pour toi · Inviter →`;
  el.append(titre, ligne1, regle);
}
async function rafraichirBoost() {
  if (demo) { calculerBoost(autresDemo()); return; }
  if (!ligue || ligue.enAttente || !net.estConfigure()) { calculerBoost([]); return; }
  const p = await net.potesActifs(ligue.code, getPseudo());
  if (p) calculerBoost(p);
}

function ligueMessage(txt) { ligueMsg.textContent = txt || ""; ligueMsg.classList.toggle("hidden", !txt); }
// Le peloton compte au moins 4 cyclistes (3 octobre 2026 : « trois bots qui
// s'appellent Bot 1, Bot 2 et Bot 3 [...] remplacés au fur et à mesure par
// les personnes qui arrivent vraiment »). Mêmes noms dans le jeu (friends.js).
export const BOTS_LIGUE = 3;
let pelotonAffiche = new Set();
function afficherLigue() {
  if (!ligueDispo()) { ligueBloc.classList.add("hidden"); return; }
  ligueBloc.classList.remove("hidden");
  ligueSans.classList.toggle("hidden", !!ligue);
  ligueAvec.classList.toggle("hidden", !ligue);
  ligueQuitter.classList.toggle("hidden", !ligue);
  const suivant = $("step2-next");
  // Hiérarchie : sans ligue → CRÉER en rouge, « Jouer sans ligue » en petit ;
  // seul dans sa ligue → INVITER en rouge ; des potes sont là → JOUER.
  const autres = ligue ? ligue.membres.filter((m) => m.nom !== getPseudo()) : [];
  const seul = !!ligue && !ligue.enAttente && autres.length === 0;
  suivant.textContent = ligue ? "Jouer" : "Jouer sans ligue";
  suivant.classList.toggle("btn-primary", !!ligue && !seul);
  suivant.classList.toggle("btn-secondary", !ligue || seul);
  suivant.classList.toggle("btn-petit", !ligue);
  if (!ligue) { pelotonAffiche = new Set(); return; }
  ligueCodeEl.textContent = ligue.code;
  $("ligue-titre").textContent = ligue.enAttente ? "Tu rejoins la ligue" : "Ta ligue";
  liguePartager.classList.toggle("hidden", !!ligue.enAttente);
  const ul = $("ligue-peloton");
  ul.textContent = "";
  const slots = [{ nom: getPseudo() || "toi", cls: "moi" }].concat(autres.map((m) => ({ nom: m.nom, cls: "" })));
  for (let k = autres.length + 1; k <= BOTS_LIGUE; k++) slots.push({ nom: `bot ${k}`, cls: "bot" });
  const vus = new Set();
  slots.forEach((sl) => {
    const li = document.createElement("li");
    li.className = sl.cls + (sl.cls === "" && pelotonAffiche.size && !pelotonAffiche.has(sl.nom) ? " nouveau" : "");
    li.textContent = sl.cls === "bot" ? sl.nom.replace("bot", "Bot") : `@${sl.nom}`;
    ul.appendChild(li); vus.add(sl.nom);
  });
  pelotonAffiche = vus;
  if (ligue.enAttente) ligueMembresEl.textContent = "Tu en fais partie ! Appuie sur Jouer.";
  else ligueMembresEl.textContent = autres.length >= BOTS_LIGUE
    ? `${autres.length} pote${autres.length > 1 ? "s" : ""} dans ta ligue : ils pédalent derrière toi.`
    : "En attendant tes potes, des bots roulent avec toi. Chaque pote qui rejoint remplace un bot.";
}
function ligueDispo() { return (net.estConfigure() || demo) && !enBeta(); }
function memoriserLigue() { if (ligue) lsSet(CLE_LIGUE, JSON.stringify(ligue)); else { try { localStorage.removeItem(CLE_LIGUE); } catch (e) { /* rien */ } } }
function appliquerNomsLigue() {
  const moi = getPseudo();
  friends.setNomsLigue(ligue && !ligue.enAttente ? ligue.membres.filter((m) => m.nom !== moi) : null);
}
async function rejoindre(code, creer = false) {
  const pseudo = getPseudo();
  if (!pseudo) { ligueMessage("Écris ton pseudo d'abord."); pseudoInput.focus(); return false; }
  code = net.normaliserCode(code);
  if (code.length < 4) { ligueMessage("Code de ligue : 5 lettres."); return false; }
  if (demo) {
    // Démo : créer = une ligue où l'on est seul ; rejoindre = la ligue démo pleine.
    ligue = { code, membres: creer ? [{ nom: pseudo, skin: null }] : DEMO.noms.map((nom) => ({ nom, skin: null })), demo: true };
    memoriserLigue(); appliquerNomsLigue(); afficherLigue(); ligueMessage(creer ? "Ta ligue est créée ! Maintenant, invite tes potes." : ""); rafraichirBoost();
    return true;
  }
  ligueMessage("…");
  const invitation = !!(ligue && ligue.enAttente);
  const r = creer ? await net.creerLigue(code, pseudo, getSkin()) : await net.rejoindreLigue(code, pseudo, getSkin());
  if (r.erreur) {
    ligueMessage(r.erreur === "complete" ? `Cette ligue est complète (${net.LIGUE_MAX} max).` : r.erreur === "inexistante" ? "Cette ligue n'existe pas." : r.erreur === "vague" ? `${window.CONFIG.liguesParVague || 5} ligues sont déjà en course cette semaine. La tienne démarre lundi : réessaie à ce moment-là.` : "Pas de réseau, réessaie.");
    if (ligue && ligue.enAttente) { ligue = null; memoriserLigue(); afficherLigue(); }
    return false;
  }
  ligue = { code, membres: r.membres };
  memoriserLigue(); appliquerNomsLigue(); afficherLigue(); appliquerModeBeta(); ligueMessage(""); rafraichirBoost();
  if (invitation) net.evenement("invitation_acceptee", { pseudo, ligue: code, source: getSource() });
  return true;
}
function lienLigue(code) { return `${window.CONFIG.lienJeu || location.origin + location.pathname}?ligue=${code}`; }
async function partagerLigue(texte) {
  if (demo) { simulerArrivees(); return; }
  const code = ligue ? ligue.code : "";
  const data = { title: "J'ai un pote", text: texte, url: lienLigue(code) };
  net.evenement("invitation_envoyee", { pseudo: getPseudo(), ligue: code, source: getSource() });
  try {
    if (navigator.share) { await navigator.share(data); return; }
    await navigator.clipboard.writeText(`${texte} ${data.url}`);
    ligueMessage("Lien copié !");
  } catch (e) { /* partage annulé */ }
}
// Rafraîchit les membres au démarrage d'une course (les potes qui ont
// rejoint depuis apparaissent).
export async function preparerLigue() {
  if (demo) { appliquerNomsLigue(); await rafraichirBoost(); return; }
  if (ligue && ligue.enAttente) { await rejoindre(ligue.code); ligueInvitation = null; }
  if (!ligue) { friends.setNomsLigue(null); return; }
  const membres = await net.membres(ligue.code);
  if (membres) { ligue.membres = membres; memoriserLigue(); }
  appliquerNomsLigue(); afficherLigue();
  await rafraichirBoost();
}
// Fin de course : envoi du score, puis classement de la ligue sur la carte.
// `bilan` = { graine, trace, scoreMax } (main.js) : la graine de la route et
// la trace du fantôme, envoyée SEULEMENT si la course bat le record de la
// ligue sur cette route (9 septembre 2026).
export async function finLigue(metres, potes, mode = "course", bilan = {}) {
  endLigue.classList.add("hidden");
  if (mode === "sprint") lsSet(CLE_SPRINT, net.jourSprint());
  const code = ligue ? ligue.code : (window.CONFIG.ligueDemo || "PMCMP");
  if (!ligue && mode !== "sprint") return;
  if (demo && mode !== "sprint") { afficherClassement(ligue.code, classementDemo(metres, bilan.fin)); return; }
  let trace = null;
  if (mode !== "sprint" && bilan.trace) {
    const avant = await net.classement(ligue.code, bilan.graine);
    const meilleur = avant && avant.length ? Math.max(...avant.map((r) => Number(r.metres) || 0)) : 0;
    if (Math.floor(metres) > meilleur) trace = bilan.trace;
  }
  await net.envoyerScore(code, getPseudo(), metres, potes, mode, { graine: bilan.graine, trace, duree: bilan.duree });
  const endRelais = $("end-relais");
  if (mode === "sprint") {
    // Classement du sprint du jour, toutes ligues confondues.
    const rows = await net.classementSprint(net.jourSprint());
    if (!rows) return;
    endLigueCode.textContent = "Sprint du dimanche";
    endLigueListe.textContent = "";
    const moi = getPseudo();
    rows.slice(0, 10).forEach((r, i) => {
      const li = document.createElement("li");
      if (r.pseudo === moi) li.className = "moi";
      li.innerHTML = `<span class="rang">${i + 1}</span><span class="nom"></span><span class="m">${pts(r.metres)}</span>`;
      li.querySelector(".nom").textContent = `@${r.pseudo}`;
      endLigueListe.appendChild(li);
    });
    endRelais.classList.add("hidden");
    endLigue.classList.remove("hidden");
    return;
  }
  const rows = await net.classement(ligue.code, bilan.graine);
  if (!rows) return;
  const relais = await net.relais(ligue.code);
  const objectif = window.CONFIG.relaisDistance || 30000;
  endRelais.classList.remove("hidden");
  endRelais.textContent = `Relais : ${Number(relais.metres).toLocaleString("fr-FR")} / ${objectif.toLocaleString("fr-FR")} pts`;
  afficherClassement(ligue.code, rows);
}
// Classement de la ligue sur l'écran de fin, avec le rang du joueur en tête
// de carte (« il faut un système de classement à la fin qui dit que je suis
// premier, je peux inviter des potes »).
function afficherClassement(code, rows, titre = null) {
  endLigueCode.textContent = titre || code;
  endLigueListe.textContent = "";
  const moi = getPseudo() || "toi";
  const rang = rows.findIndex((r) => r.pseudo === moi) + 1;
  const annonce = $("end-rang");
  if (annonce) { annonce.textContent = rang === 1 ? "Tu es 1er de ta ligue !" : rang > 0 ? `Tu es ${rang}e de ta ligue` : ""; annonce.classList.toggle("hidden", !rang); }
  rows.slice(0, enBeta() ? 12 : 7).forEach((r, i) => {
    const li = document.createElement("li");
    if (r.pseudo === moi) li.className = "moi";
    const rang = document.createElement("span"); rang.className = "rang"; rang.textContent = `${i + 1}`;
    const nom = document.createElement("span"); nom.className = "nom"; nom.textContent = `@${r.pseudo}`;
    const m = document.createElement("span"); m.className = "m"; m.textContent = pts(r.metres);
    li.append(rang, nom, m);
    endLigueListe.appendChild(li);
  });
  endLigue.classList.remove("hidden");
}
function initLigue() {
  afficherBoost();
  rafraichirBoost();
  const b = $("boost-ligue");
  if (b) b.addEventListener("click", () => { if (ligue && !ligue.enAttente) partagerLigue(`Viens jouer 30 s dans ma ligue « J'ai un pote » (code ${ligue.code}) : ça me booste mes points !`); else if (!enBeta()) setStep(2); });
  try { const j = lsGet(CLE_LIGUE); if (j) ligue = JSON.parse(j); } catch (e) { ligue = null; }
  if (demo && !demoCree) ligue = { code: DEMO.code, membres: DEMO.noms.map((nom) => ({ nom, skin: null })), demo: true };
  try {
    const code = new URLSearchParams(location.search).get("ligue");
    // Le lien d'invitation suffit : la personne fait déjà partie de la ligue,
    // elle n'a plus qu'à écrire son pseudo (l'adhésion part au JOUER).
    if (code) {
      ligueInvitation = net.normaliserCode(code);
      if (!ligue || ligue.code !== ligueInvitation) ligue = { code: ligueInvitation, membres: [], enAttente: true };
      const url = new URL(location.href); url.searchParams.delete("ligue"); history.replaceState(null, "", url.toString());
    }
  } catch (e) { /* rien */ }
  afficherLigue(); appliquerNomsLigue();
  ligueRejoindre.addEventListener("click", () => rejoindre(ligueInput.value));
  ligueCreer.addEventListener("click", () => rejoindre(net.genererCode(), true));
  ligueQuitter.addEventListener("click", () => { stopperArrivees(); ligue = null; memoriserLigue(); appliquerNomsLigue(); afficherLigue(); appliquerModeBeta(); });
  const copierCode = async () => {
    if (!ligue) return;
    try { await navigator.clipboard.writeText(ligue.code); } catch (e) { /* rien */ }
    ligueMessage(`Code ${ligue.code} copié !`);
    const aide = $("ligue-code-aide"); if (aide) { aide.textContent = "Copié !"; setTimeout(() => { aide.textContent = "Touche pour copier"; }, 1600); }
  };
  $("ligue-code-btn").addEventListener("click", copierCode);
  $("end-ligue-titre").addEventListener("click", async () => {
    const code = ligue ? ligue.code : endLigueCode.textContent;
    try { await navigator.clipboard.writeText(code); } catch (e) { /* rien */ }
    const c = $("end-ligue-copier"); if (c) { c.textContent = "· copié !"; setTimeout(() => { c.textContent = "· copier"; }, 1600); }
  });
  liguePartager.addEventListener("click", () => partagerLigue(`Tu es dans ma ligue « J'ai un pote » (code ${ligue ? ligue.code : ""}) : tu pédales derrière moi, viens battre mon score`));
  endLiguePartager.addEventListener("click", () => partagerLigue(`J'ai fait ${scoreVal.textContent} pts dans notre ligue « J'ai un pote » (code ${ligue ? ligue.code : ""}), même course pour tout le monde. Viens me battre`));
  ["pointerdown", "touchstart", "touchmove", "mousedown"].forEach((t) => ligueInput.addEventListener(t, (e) => e.stopPropagation()));
  ligueInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); rejoindre(ligueInput.value); } });
}

// --- Sprint du dimanche --------------------------------------------------------
const sprintButton = $("sprint-button"), sprintNote = $("sprint-note");
function majSprint() {
  if (enBeta() || !net.estConfigure() || !net.sprintOuvert()) { sprintButton.classList.add("hidden"); sprintNote.classList.add("hidden"); return; }
  const fait = lsGet(CLE_SPRINT) === net.jourSprint();
  sprintButton.classList.toggle("hidden", fait);
  sprintNote.classList.remove("hidden");
  sprintNote.textContent = fait ? "Sprint du dimanche déjà couru : une seule tentative, le classement est sur ton écran de fin." : "Une seule tentative, la même route pour tout le monde.";
}

// --- Chargement --------------------------------------------------------------
// Au moins `config.chargementMinS` secondes de 0 à 100 % (6 septembre 2026 :
// « une phase de chargement de 5-6 s, ça fait sérieux »), le temps de mettre
// en cache le morceau, les polices et de préchauffer le moteur (main.js,
// prechauffer()). La barre ne dépasse jamais ce qui est VRAIMENT chargé.
let loadingDone = false;
const loadingT0 = performance.now();
const ETAPES = ["Le morceau arrive", "Les potes s'échauffent", "La route se construit", "Les poules se placent", "C'est prêt"];
let prechauffe = 0; // 0..1, rempli par main.js
export function setPrechauffage(p) { prechauffe = Math.max(prechauffe, Math.min(1, p)); }
export function syncLoadingUi() {
  if (loadingDone) return;
  if (audio.getLoadError()) {
    loadingDone = true;
    loadingBlock.classList.add("failed");
    loadingLabel.textContent = "Son indisponible, le jeu reste jouable";
    playButton.disabled = false;
    setTimeout(() => $("splash").classList.add("fini"), 1500);
    return;
  }
  const minS = window.CONFIG.chargementMinS || 0;
  const tempsT = minS > 0 ? Math.min(1, (performance.now() - loadingT0) / 1000 / minS) : 1;
  const reel = (audio.isReadyToStart() ? 1 : audio.getProgress()) * 0.7 + prechauffe * 0.3;
  const p = Math.min(reel, tempsT);
  const pct = Math.round(p * 100);
  loadingFill.style.width = `${pct}%`;
  loadingLabel.textContent = `${ETAPES[Math.min(ETAPES.length - 1, Math.floor(p * ETAPES.length))]} · ${pct} %`;
  if (p >= 1) { loadingDone = true; loadingBlock.classList.add("done"); $("splash").classList.add("fini"); majBoutonJouer(); }
}

// --- Fin de partie -----------------------------------------------------------
export function showEndScreen({ metres, potesMax, record, fin, sprint, scoreMax }) {
  scoreVal.textContent = Math.floor(metres).toLocaleString("fr-FR");
  derniereCourse = { metres: Math.floor(metres), potes: potesMax, fin: !!fin };
  // Course de ligue : le score PARFAIT de cette route (simulation.js), pour
  // savoir à quelle distance du maximum on est (« si le score maximal c'est
  // 100 000 et que le premier fait 88 000… »).
  const endMax = $("end-max");
  const pct = Math.round((window.CONFIG.boostLigueParPote || 0.1) * 100);
  const ligneBoost = sprint || (!net.estConfigure() && !demo) ? "" : boost.potes.length
    ? `Tes potes te donnent <b>+${Math.round((boost.mult - 1) * 100)} %</b> · +${pct} % par nouveau pote`
    : `<b>+${pct} %</b> de points par pote invité qui joue`;
  // (30 septembre 2026 : « à la place du score parfait, dis : Tu peux encore
  // faire un meilleur score ».)
  // 3 octobre 2026 : « mets meilleur score [...] tu peux battre ton meilleur score ».
  const meilleur = Math.max(getRecord(), Math.floor(metres));
  const mieux = record ? "" : `Meilleur score : ${pts(meilleur)} · tu peux le battre.`;
  endMax.classList.toggle("hidden", !mieux && !ligneBoost);
  endMax.innerHTML = [mieux, ligneBoost].filter(Boolean).join("<br>");
  // Le but : arriver au bout du morceau avec un max de potes.
  const potesTxt = potesMax === 0 ? "0 pote" : `${potesMax} pote${potesMax > 1 ? "s" : ""}`;
  // Aller au bout du morceau, c'est la victoire : on le dit (20 septembre
  // 2026 : « bravo d'avoir joué avec tes potes, tu peux écouter le morceau »).
  // 30 septembre 2026 : « enlève le bravo, tu es allé au bout du morceau avec
  // 5 potes. Faut mettre : nouveau record, 5 potes maximum. Tu enlèves le tag
  // terminé » — et le sticker record fait doublon avec la ligne (place gagnée
  // pour l'iPhone 16).
  endSub.textContent = record ? `Meilleur score · ${potesTxt} maximum` : fin ? `${potesTxt} maximum` : `Tombé avant la fin · ${potesTxt}`;
  endBest.classList.add("hidden");
  $("end-eyebrow").textContent = sprint ? "Sprint du dimanche" : "Ta course";
  if (sprint) endSub.textContent = `Sprint · ${potesTxt}`;
  setTimeout(() => { setView("end"); showOverlay(); }, fin ? 1500 : 600);
}

// --- Retour des testeurs (bêta fermée, 16 septembre 2026) --------------------
// « Laisser un retour » sur l'écran de fin : une carte, un champ libre, un
// envoi, une confirmation dans la MÊME carte (pas de second pop-up qui se
// referme tout seul). Le retour part avec le pseudo, le score de la course
// qui vient de finir et le numéro de partie — table retours_beta, jamais
// relue par le jeu. Un échec réseau le dit et garde le texte à l'écran.
const retourSheet = $("retour-sheet"), retourForm = $("retour-form"), retourOk = $("retour-ok");
const retourInput = $("retour-input"), retourEnvoyer = $("retour-envoyer"), retourCompteur = $("retour-compteur");
let derniereCourse = null;
const TEXTE_RETOUR = "Ce qui t'a plu, ce qui t'a saoulé, ce qui bugue. Écris tout, c'est exactement ce qu'il me faut.";

export function ouvrirRetour() {
  retourForm.classList.remove("hidden");
  retourOk.classList.add("hidden");
  $("retour-title").textContent = "Ton retour";
  $("retour-text").textContent = TEXTE_RETOUR;
  retourEnvoyer.textContent = "Envoyer";
  retourEnvoyer.classList.remove("locked");
  majCompteurRetour();
  retourSheet.classList.add("visible");
  retourSheet.setAttribute("aria-hidden", "false");
  setTimeout(() => retourInput.focus(), 120);
}
function fermerRetour() {
  retourSheet.classList.remove("visible");
  retourSheet.setAttribute("aria-hidden", "true");
}
function majCompteurRetour() {
  const n = retourInput.value.trim().length;
  retourCompteur.textContent = `${retourInput.value.length}/1200`;
  retourEnvoyer.disabled = n < 3;
}
async function envoyerRetour() {
  const texte = retourInput.value.trim();
  if (texte.length < 3) return;
  retourEnvoyer.disabled = true;
  retourEnvoyer.classList.add("locked");
  retourEnvoyer.textContent = "Envoi…";
  const c = derniereCourse || {};
  const ok = await net.envoyerRetour({
    ligue: ligue ? ligue.code : null,
    pseudo: getPseudo() || null,
    texte,
    score: c.metres !== undefined ? c.metres : null,
    potes: c.potes !== undefined ? c.potes : null,
    fin: c.fin !== undefined ? c.fin : null,
    partie: getParties(),
    appareil: navigator.userAgent.slice(0, 180),
  });
  if (!ok.ok) {
    retourEnvoyer.disabled = false;
    retourEnvoyer.classList.remove("locked");
    retourEnvoyer.textContent = "Réessayer";
    $("retour-title").textContent = "Pas parti, réessaie";
    $("retour-text").textContent = `${ok.detail || "envoi impossible"} — réessaie, ou envoie-moi ça sur WhatsApp.`;
    return;
  }
  $("retour-text").textContent = TEXTE_RETOUR;
  retourInput.value = "";
  majCompteurRetour();
  retourForm.classList.add("hidden");
  retourOk.classList.remove("hidden");
  net.evenement("retour_beta", { pseudo: getPseudo(), ligue: ligue ? ligue.code : null, source: getSource() });
}

// Bascule visuelle du mode bêta : menu réduit, sprint et tiroir album hors
// jeu, bouton de retour sur l'écran de fin.
function appliquerModeBeta() {
  const on = enBeta();
  document.body.classList.toggle("beta", on);
  $("beta-tag").classList.toggle("hidden", !on);
  $("beta-note").classList.toggle("hidden", !on);
  $("end-retour").classList.toggle("hidden", !(on && window.CONFIG.betaRetours !== false));
  if (on) $("beta-tag").textContent = `Bêta-test · ligue ${ligue.code}`;
}

// --- Pause / son -------------------------------------------------------------
export function showPauseButton() { pauseButton.hidden = false; muteButton.hidden = true; }
export function hidePauseButton() { pauseButton.hidden = true; muteButton.hidden = false; if (deps.isManuallyPaused()) closePauseMenu(); }
function openPauseMenu() {
  if (deps.isManuallyPaused() || pauseButton.hidden) return;
  deps.openPause();
  pauseVolumeSlider.value = String(Math.round(audio.getVolume() * 100));
  pauseScreen.classList.add("visible");
}
function closePauseMenu() {
  if (!deps.isManuallyPaused()) return;
  deps.closePause();
  pauseScreen.classList.remove("visible");
}
function syncMuteIcon() {
  const coupe = audio.getVolume() <= 0;
  muteButton.classList.toggle("muted", coupe);
  muteButton.textContent = coupe ? "✕" : "♪";
}

// --- Démarrage ---------------------------------------------------------------
// Explication au lancement, en TROIS temps (1er octobre 2026, test avec une
// joueuse : elle glissait au lieu de taper, lisait « 1,6 % », ne savait pas que
// la partie dure le morceau) : 1) tape l'écran, pas besoin de glisser ;
// 2) une partie = un morceau, jusqu'à la ligne d'arrivée ; 3) joue avec tes
// potes, +10 % par pote. Un tap passe à l'étape suivante ; après la
// troisième, la course part toute seule. Le contexte audio est débloqué AVANT,
// dans le geste du JOUER. 3 premières parties + toujours en ligue démo.
const EXPL_ETAPES = [4.2, 3.8, 5.4];
function montrerExplication(ensuite) {
  const box = $("explication");
  if (!box || (!demo && getParties() >= 3) || enBeta()) { ensuite(); return; }
  const etapes = [...box.querySelectorAll(".expl-etape")];
  const potes = [...box.querySelectorAll("#expl-potes span")];
  const mult = $("expl-mult"), barre = box.querySelector("#expl-barre i"), eyebrow = $("expl-eyebrow");
  let minuteurs = [], idx = -1, fini = false;
  const vider = () => { minuteurs.forEach(clearTimeout); minuteurs = []; };
  const finir = () => { if (fini) return; fini = true; vider(); box.classList.add("hidden"); ensuite(); };
  const etape = (i) => {
    vider();
    if (i >= etapes.length) { finir(); return; }
    idx = i;
    etapes.forEach((e, k) => e.classList.toggle("on", k === i));
    eyebrow.textContent = `Comment jouer · ${i + 1}/${etapes.length}`;
    $("expl-passer").textContent = i < etapes.length - 1 ? "Touche pour continuer" : "Touche pour jouer";
    barre.style.transition = "none"; barre.style.width = "0";
    requestAnimationFrame(() => requestAnimationFrame(() => { barre.style.transition = `width ${EXPL_ETAPES[i]}s linear`; barre.style.width = "100%"; }));
    if (i === 2) {
      potes.forEach((p) => p.classList.remove("on"));
      mult.textContent = "+0 %";
      potes.forEach((p, k) => minuteurs.push(setTimeout(() => {
        p.classList.add("on");
        mult.textContent = `+${(k + 1) * 10} %`;
        mult.classList.remove("pop"); void mult.offsetWidth; mult.classList.add("pop");
        try { sfx.piece(); } catch (e) { /* pas de son, tant pis */ }
      }, 500 + k * 550)));
    }
    minuteurs.push(setTimeout(() => etape(i + 1), EXPL_ETAPES[i] * 1000));
  };
  if (!box.dataset.branche) {
    box.dataset.branche = "1";
    // Le tap qui fait avancer ne doit pas devenir un saut (input.js écoute window).
    ["touchstart", "mousedown", "touchend", "mouseup"].forEach((t) => box.addEventListener(t, (e) => e.stopPropagation()));
  }
  box.onpointerdown = (e) => { e.stopPropagation(); etape(idx + 1); };
  box.classList.remove("hidden");
  etape(0);
}
function startGame(opts = {}) {
  // Après une course, JOUER (depuis le menu, atteint par « Menu » sur l'écran
  // de fin) relance une course neuve — par la MÊME porte que REJOUER, sinon
  // le détour par le menu la contournerait.
  if (deps.isGameStartRequested()) {
    exigerConversion({ action: "rejouer", onOk: () => { enregistrerProfil(); hideOverlay(); showPauseButton(); deps.restartGame(opts); }, onCancel: () => {} });
    return;
  }
  audio.unlock();
  enregistrerProfil();
  const lancer = () => {
    audio.play();
    preparerLigue();
    deps.requestGameStart(opts);
    hideOverlay();
    showPauseButton();
  };
  if (opts.sprint) lancer(); else montrerExplication(lancer);
}

export function init(d) {
  deps = d;
  [ctaLink, endCta].forEach((lien) => {
    lien.removeAttribute("href"); lien.removeAttribute("target"); lien.setAttribute("role", "button");
    lien.addEventListener("click", (e) => { e.preventDefault(); ouvrirEcoute(); });
  });
  instaLink.href = window.CONFIG.lienInsta;
  const credit = $("credit-insta"); if (credit) credit.href = window.CONFIG.lienInsta;
  try { const src = new URLSearchParams(location.search).get("src"); if (src) lsSet(CLE_SOURCE, src.slice(0, 32)); } catch (e) { /* rien */ }
  pseudoInput.value = lsGet(CLE_PSEUDO) || "";
  instaInput.value = lsGet(CLE_INSTA) || "";
  villeInput.value = lsGet(CLE_VILLE) || "";
  const step1Next = $("step1-next");
  const syncPlay = () => { majBoutonJouer(); step1Next.disabled = getPseudo().length === 0; };
  pseudoInput.addEventListener("input", syncPlay);
  syncPlay();
  [pseudoInput, instaInput, villeInput].forEach((inp) => ["pointerdown", "touchstart", "touchmove", "mousedown"].forEach((t) => inp.addEventListener(t, (e) => e.stopPropagation())));
  step1Next.addEventListener("click", () => { if (!getPseudo()) { pseudoInput.focus(); return; } enregistrerProfil(); setStep(3); });
  $("step2-next").addEventListener("click", () => { if (!loadingDone) return; lsSet(CLE_LIGUE_VUE, "1"); if (getPseudo().length === 0) { setStep(1); return; } startGame(); });
  $("step2-back").addEventListener("click", () => setStep(3));
  $("step3-ligue").addEventListener("click", () => setStep(2));
  $("step3-profil").addEventListener("click", () => setStep(1));
  playButton.addEventListener("click", () => {
    if (getPseudo().length === 0) { setStep(1); pseudoInput.focus(); return; }
    if (premierPassage()) { lsSet(CLE_LIGUE_VUE, "1"); setStep(2); return; }
    startGame();
  });
  sprintButton.addEventListener("click", () => { if (getPseudo().length === 0) { setStep(1); return; } startGame({ sprint: true }); });
  net.evenement("arrivee", { pseudo: lsGet(CLE_PSEUDO) || null, source: getSource(), ligue: null });
  // (Pas de MutationObserver sur `disabled` : il se redéclenchait lui-même en
  // boucle et gelait la page — syncLoadingUi relit le champ à la fin du
  // chargement, l'input le relit à chaque frappe.)

  $("end-retour").addEventListener("click", ouvrirRetour);
  retourInput.addEventListener("input", majCompteurRetour);
  ["pointerdown", "touchstart", "touchmove", "mousedown"].forEach((t) => retourSheet.addEventListener(t, (e) => e.stopPropagation()));
  retourEnvoyer.addEventListener("click", envoyerRetour);
  $("retour-fermer").addEventListener("click", fermerRetour);
  $("retour-ok-fermer").addEventListener("click", fermerRetour);
  // Entrée envoie, Maj+Entrée fait un retour à la ligne.
  retourInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyerRetour(); } });

  // Retour au menu depuis l'écran de fin (27 septembre 2026 : « à la fin, je
  // peux pas revenir au menu principal pour changer de ligue »). On arrive
  // sur « Mon cycliste », d'où « Ma ligue » et « Mon profil » sont à un tap.
  $("end-menu").addEventListener("click", () => {
    document.getElementById("game-canvas").classList.remove("game-over-bw");
    setView("onboarding");
    setStep(3);
  });
  replayButton.addEventListener("click", () => {
    exigerConversion({ action: "rejouer", onOk: () => { hideOverlay(); showPauseButton(); deps.restartGame(); }, onCancel: () => {} });
  });

  function porteDepuisCarteDeMort(action, issue) {
    if (!reviveCallbacks) return;
    const restant = decompteRevive.restant;
    decompteRevive.arreter();
    exigerConversion({ action, onOk: () => reviveResoudre(issue), onCancel: () => reprendreDecompteRevive(restant) });
  }
  reviveCta.addEventListener("click", () => porteDepuisCarteDeMort("continuer", "onAccept"));
  reviveReplay.addEventListener("click", () => porteDepuisCarteDeMort("rejouer", "onReplay"));
  reviveDecline.addEventListener("click", () => reviveResoudre("onDecline"));

  gateCta.addEventListener("click", () => {
    if (!gateEtat || gateEtat.phase !== "demande") return;
    if (gateEtat.niveau === "presave") { lsSet(CLE_MORCEAU_OUVERT, "1"); fanCache = true; }
    else lsSet(CLE_PMC_SUIVI, "1");
    setTimeout(gatePhaseAbsence, 0);
  });
  gateGo.addEventListener("click", () => { if (!gateEtat || gateEtat.phase !== "pret") return; gateResoudre("onUnlocked"); });
  gateLater.addEventListener("click", () => gateResoudre("onCancel"));
  document.addEventListener("visibilitychange", () => {
    if (!gateEtat) return;
    if (document.hidden) { audio.setReviveIntensity(0); return; }
    if (gateEtat.phase === "absence") gatePhasePret();
  });

  syncMuteIcon();
  muteButton.addEventListener("click", (e) => { e.stopPropagation(); audio.setVolume(audio.getVolume() > 0 ? 0 : 1); syncMuteIcon(); });
  pauseButton.addEventListener("click", (e) => { e.stopPropagation(); openPauseMenu(); });
  resumeButton.addEventListener("click", (e) => { e.stopPropagation(); closePauseMenu(); });
  pauseReplayButton.addEventListener("click", (e) => { e.stopPropagation(); closePauseMenu(); deps.restartGame(); });
  pauseVolumeSlider.addEventListener("input", () => { audio.setVolume(Number(pauseVolumeSlider.value) / 100); syncMuteIcon(); });
  ["pointerdown", "pointerup", "touchstart", "touchmove", "touchend", "mousedown"].forEach((t) => {
    pauseScreen.addEventListener(t, (e) => e.stopPropagation());
    [muteButton, pauseButton].forEach((b) => b.addEventListener(t, (e) => e.stopPropagation()));
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") { if (deps.isManuallyPaused()) closePauseMenu(); else openPauseMenu(); }
    if ((e.code === "Enter") && overlay.classList.contains("visible") && e.target !== ligueInput && stepCourante() === 3) {
      if (endScreenEl.classList.contains("active")) replayButton.click();
      else if (!playButton.disabled) startGame();
    }
  });
  initLigue();
  appliquerModeBeta();
  setView("onboarding");
  // Habitué → directement « Mon cycliste » ; invitation → « Ma ligue » ; sinon l'inscription.
  setStep(!lsGet(CLE_PSEUDO) ? 1 : (ligue && ligue.enAttente) ? 2 : 3);
}
