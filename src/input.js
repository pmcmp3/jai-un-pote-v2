// input.js — Gestes (une seule voie) :
//   tap court               → saut
//   appui MAINTENU (≤ 0,4 s) → le saut monte plus haut, tant qu'on appuie
//   re-tap en l'air         → double saut (on remonte) + salto
//   swipe vers le bas       → roue arrière (décoratif)
//   swipe vers le haut      → saut aussi (réflexe du premier jeu)
// Le saut part au TOUCHER (et non au relâcher) : c'est ce qui permet de
// mesurer la durée de l'appui. Le swipe latéral est ignoré (une seule voie).

const SWIPE_THRESHOLD = 28;
let jumpPressed = false;
let wheelie = false;
let holding = false;

export function consumeJumpPress() { if (jumpPressed) { jumpPressed = false; return true; } return false; }
export function consumeWheelie() { if (wheelie) { wheelie = false; return true; } return false; }
// Vrai tant que le doigt (ou la barre d'espace) reste appuyé : main.js s'en
// sert pour prolonger la montée du saut.
export function isHolding() { return holding; }

const overlayEl = document.getElementById("overlay");
function onOverlay(target) { return overlayEl && target instanceof Node && overlayEl.contains(target); }

let activeId = null, originX = 0, originY = 0, consumed = false;

function begin(x, y, id, target) {
  if (onOverlay(target)) return;
  activeId = id; originX = x; originY = y; consumed = false;
  jumpPressed = true;   // le saut part au toucher
  holding = true;
}
function move(x, y) {
  if (activeId === null || consumed) return;
  const dx = x - originX, dy = y - originY;
  if (Math.abs(dy) >= SWIPE_THRESHOLD && dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.2) {
    wheelie = true;     // swipe vers le bas : roue arrière
    consumed = true;
  } else if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.2) {
    consumed = true;    // swipe latéral : ignoré (une seule voie)
  }
}
function end() {
  if (activeId === null) return;
  activeId = null;
  holding = false;
}

// ⚠️ UN tap = DEUX appuis sur Android : après touchstart/touchend, Android
// rejoue le geste en événements souris (mousedown, mouseup) de compatibilité.
// Ce mousedown arrive quand le cycliste vient de décoller et compterait comme
// le re-tap du double saut (iOS ne les envoie pas au canvas). Toute souris qui
// suit un toucher de moins d'une seconde est donc ignorée.
let dernierToucher = -1e9;
const toucher = () => { dernierToucher = performance.now(); };
window.addEventListener("touchstart", (e) => { toucher(); if (activeId !== null) return; const t = e.changedTouches[0]; begin(t.clientX, t.clientY, t.identifier, e.target); }, { passive: true });
window.addEventListener("touchmove", (e) => { for (const t of e.changedTouches) if (t.identifier === activeId) move(t.clientX, t.clientY); }, { passive: true });
window.addEventListener("touchend", (e) => { toucher(); for (const t of e.changedTouches) if (t.identifier === activeId) end(); }, { passive: true });
window.addEventListener("touchcancel", () => { toucher(); activeId = null; holding = false; }, { passive: true });
window.addEventListener("mousedown", (e) => { if (performance.now() - dernierToucher < 1000) return; begin(e.clientX, e.clientY, "mouse", e.target); });
window.addEventListener("mousemove", (e) => { if (activeId === "mouse") move(e.clientX, e.clientY); });
window.addEventListener("mouseup", () => { if (activeId === "mouse") end(); });

export function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}
window.addEventListener("keydown", (e) => {
  if (isTypingTarget(e.target)) return;
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW" || e.code === "KeyZ") { if (!e.repeat) jumpPressed = true; holding = true; }
  else if (e.code === "ArrowDown" || e.code === "KeyS") { if (!e.repeat) wheelie = true; }
});
window.addEventListener("keyup", (e) => { if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW" || e.code === "KeyZ") holding = false; });
