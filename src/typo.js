// typo.js — La typographie française de tous les textes de l'interface, y compris
// ceux écrits après coup : une espace insécable devant % : ; ? ! » et après «,
// entre un nombre et son unité, et entre les deux derniers mots d'un paragraphe
// (jamais un mot seul sur sa ligne, même là où `text-wrap: balance` n'existe pas).
const NBSP = " ";
const BLOCS = "p, small, li, summary, label span, button, a";

function corriger(texte) {
  return texte
    .replace(/[ \t]+([%:;?!»])/g, `${NBSP}$1`)
    .replace(/«[ \t]+/g, `«${NBSP}`)
    .replace(/(\d)[ \t]+(pts|potes?|joueurs?|jours?|heures?|min|s)\b/g, `$1${NBSP}$2`);
}
function dernierTexte(bloc) {
  const parcours = document.createTreeWalker(bloc, NodeFilter.SHOW_TEXT);
  let dernier = null;
  while (parcours.nextNode()) if (parcours.currentNode.nodeValue.trim()) dernier = parcours.currentNode;
  return dernier;
}
function traiterNoeud(n) {
  const parent = n.parentElement;
  if (!parent || parent.closest("script, style, textarea, input, select")) return;
  let t = corriger(n.nodeValue);
  const bloc = parent.closest(BLOCS);
  if (bloc && dernierTexte(bloc) === n) t = t.replace(/ (\S+\s*)$/, `${NBSP}$1`);
  if (t !== n.nodeValue) n.nodeValue = t;
}
function traiter(racine) {
  if (racine.nodeType === Node.TEXT_NODE) { traiterNoeud(racine); return; }
  if (racine.nodeType !== Node.ELEMENT_NODE) return;
  const parcours = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  const noeuds = [];
  while (parcours.nextNode()) noeuds.push(parcours.currentNode);
  noeuds.forEach(traiterNoeud);
}

export function installerTypo() {
  traiter(document.body);
  new MutationObserver((changements) => {
    for (const c of changements) {
      if (c.type === "characterData") traiterNoeud(c.target);
      else { c.addedNodes.forEach(traiter); traiter(c.target); }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
}
