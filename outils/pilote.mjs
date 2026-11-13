// pilote.mjs — Le pilote automatique du harnais, partagé par les outils qui
// ont besoin de voir une course se jouer pour de vrai (outils/video.mjs,
// outils/contraste.mjs).
//
// La règle est celle du JOUEUR IDÉAL de outils/mesurer.mjs : au sol, on part
// quand l'obstacle suivant est à `montée × vitesse` ; on tient l'appui pour un
// saut haut ; on re-tape au sommet pour un double saut. En jetpack, on monte
// vers la prochaine pièce.
//
// ⚠️ La fonction est envoyée au navigateur par `page.evaluate` : seule sa
// SOURCE voyage. Elle ne doit donc rien emprunter à Node (aucune variable de
// ce module), et tout lire dans `window.__pote` / `window.CONFIG`.
//
//   await page.evaluate(installerPilote);   // pose window.__pilote
//
// `videoPas`/`videoAvance` appellent `window.__pilote` à chaque pas.
export function installerPilote() {
  const st = { plan: null, tenir: false, double: false, appuye: false };
  const presser = () => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })); st.appuye = true; };
  const lacher = () => { if (st.appuye) window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" })); st.appuye = false; };
  window.__pilote = () => {
    const P = window.__pote, pl = P.player, R = P.rows, C = window.CONFIG;
    if (P.jetpack().reste > 0) {
      const cible = P.jetPieces().find((c) => c.v > pl.v + 0.5);
      const corps = pl.jumpY + 0.85;
      if (cible && cible.h > corps + 0.2) { if (!st.appuye) presser(); } else lacher();
      st.plan = null;
      return;
    }
    if (st.plan && pl.auSol && pl.jumpVy <= 0 && st.plan.parti) { st.plan = null; lacher(); }
    if (!st.plan && pl.auSol) {
      const vit = P.vitesse();
      for (let r = Math.floor(pl.v) + 1; r <= Math.floor(pl.v) + 14; r++) {
        const row = R.rowAt(r);
        if (row.type === "safe") continue;
        const type = R.familleDe(row.kind);
        if (r - pl.v <= vit * R.montee(type)) { st.plan = { type, parti: false }; presser(); st.tenir = type !== "tap"; if (!st.tenir) lacher(); st.double = false; }
        break;
      }
    } else if (st.plan) {
      if (pl.jumpY > R.solAt(pl.v) + 0.05) st.plan.parti = true;
      if (st.tenir && pl.tHaut >= C.sautTenueMaxS) { lacher(); st.tenir = false; }
      if (st.plan.type === "double" && !st.double && st.plan.parti && pl.jumpVy <= 0) { lacher(); presser(); lacher(); st.double = true; }
    }
  };
}
