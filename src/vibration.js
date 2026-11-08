// vibration.js — Les vibrations du jeu. Android : navigator.vibrate. iPhone :
// Safari n'a pas cette API ; basculer un interrupteur natif (input switch, iOS 17.4
// et plus) donne un petit coup de vibreur, sans garantie selon la version d'iOS.
// Coupable dans le panneau du son (clé jp2Vibrations).
const CLE = "jp2Vibrations";
let actif = true;
try { actif = localStorage.getItem(CLE) !== "0"; } catch (e) { /* stockage bloqué : allumé */ }

export function vibrationsActives() { return actif; }
export function setVibrations(oui) {
  actif = !!oui;
  try { localStorage.setItem(CLE, actif ? "1" : "0"); } catch (e) { /* rien */ }
}

let etiquette = null;
function coupIphone() {
  if (!etiquette) {
    etiquette = document.createElement("label");
    etiquette.setAttribute("aria-hidden", "true");
    etiquette.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden";
    const interrupteur = document.createElement("input");
    interrupteur.type = "checkbox";
    interrupteur.setAttribute("switch", "");
    interrupteur.tabIndex = -1;
    etiquette.appendChild(interrupteur);
    document.body.appendChild(etiquette);
  }
  etiquette.click();
}

// `motif` : durée en ms, ou [vibre, pause, vibre…] comme navigator.vibrate.
export function vibrer(motif) {
  if (!actif) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(motif); return; }
    if (!/iP(hone|ad|od)/.test(navigator.userAgent)) return;
    coupIphone();
    // Le coup de l'iPhone a une durée fixe : un motif devient plusieurs coups.
    if (Array.isArray(motif)) {
      let t = 0;
      for (let i = 2; i < motif.length; i += 2) { t += motif[i - 2] + motif[i - 1]; setTimeout(coupIphone, t); }
    }
  } catch (e) { /* rien */ }
}
