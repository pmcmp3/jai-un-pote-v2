// a11y.js — Les tiroirs et fenêtres du jeu au clavier et au lecteur d'écran : à
// l'ouverture le focus entre dedans, Tab y reste, Échap referme par le bouton de
// sortie du tiroir, et le focus revient au bouton qui l'a ouvert.
const TIROIRS = {
  "classement-sheet": "classement-fermer",
  "partage-sheet": "partage-fermer",
  "retour-sheet": "retour-fermer",
  "gate-sheet": "gate-later",
  "revive-sheet": "revive-decline",
  "pause-screen": null, // Échap y est déjà géré par le menu pause
};
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea, select, summary, [tabindex]:not([tabindex="-1"])';
const pile = [];

function visibles(el) { return [...el.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === document.activeElement); }

function ouvert(el) {
  if (pile.some((t) => t.el === el)) return;
  pile.push({ el, retour: document.activeElement });
  const titre = el.querySelector('[role="dialog"]');
  const cible = visibles(el)[0] || titre;
  if (!cible) return;
  if (cible === titre) titre.tabIndex = -1;
  // Après la transition de visibilité : un élément encore caché ne prend pas le focus.
  setTimeout(() => cible.focus({ preventScroll: true }), 40);
}
function ferme(el) {
  const i = pile.findIndex((t) => t.el === el);
  if (i < 0) return;
  const [t] = pile.splice(i, 1);
  if (t.retour && document.contains(t.retour) && t.retour.offsetParent !== null) t.retour.focus({ preventScroll: true });
}

export function installerA11y() {
  for (const id of Object.keys(TIROIRS)) {
    const el = document.getElementById(id);
    if (!el) continue;
    new MutationObserver(() => (el.classList.contains("visible") ? ouvert(el) : ferme(el))).observe(el, { attributes: true, attributeFilter: ["class"] });
  }
  // En phase de capture : Échap ne doit pas aussi ouvrir le menu pause derrière.
  window.addEventListener("keydown", (e) => {
    const t = pile[pile.length - 1];
    if (!t) return;
    if (e.key === "Escape") {
      const sortie = TIROIRS[t.el.id] && document.getElementById(TIROIRS[t.el.id]);
      if (!sortie) return;
      sortie.click();
      e.stopPropagation(); e.preventDefault();
    } else if (e.key === "Tab") {
      const f = visibles(t.el);
      if (!f.length) { e.preventDefault(); return; }
      const premier = f[0], dernier = f[f.length - 1];
      if (e.shiftKey && document.activeElement === premier) { dernier.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === dernier) { premier.focus(); e.preventDefault(); }
      else if (!t.el.contains(document.activeElement)) { premier.focus(); e.preventDefault(); }
    }
  }, true);
}

// Ce que le lecteur d'écran lit quand l'image ne suffit pas (score, classement).
export function annoncer(texte) {
  const el = document.getElementById("annonces");
  if (el) el.textContent = texte;
}
