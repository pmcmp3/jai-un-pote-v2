// input.js — v2 (19 septembre 2026, une seule voie) :
//   tap court               → saut
//   appui MAINTENU (≤ 0,4 s) → le saut monte plus haut, tant qu'on appuie
//   re-tap en l'air         → double saut (on remonte) + salto
//   swipe vers le bas       → roue arrière (décoratif)
//   swipe vers le haut      → saut aussi (réflexe du premier jeu)
// Le saut part au TOUCHER (et non au relâcher) depuis le 20 septembre 2026 :
// c'est ce qui permet de mesurer la durée de l'appui. Le swipe latéral est
// ignoré (il n'y a plus de voie).

const SWIPE_THRESHOLD = 28;
let jumpPressed = false;
let wheelie = false;
let holding = false;

export function consumeJumpPress() { if (jumpPressed) { jumpPressed = false; return true; } return false; }
export function consumeWheelie() { if (wheelie) { wheelie = false; return true; } return false; }
// Vrai tant que le doigt (ou la barre d'espace) reste appuyé : main.js s'en
// sert pour prolonger la montée du saut.
export function isHolding() { return holding; }
export function setAirborne() { /* plus utilisé : le tap part toujours au toucher */ }

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

window.addEventListener("touchstart", (e) => { if (activeId !== null) return; const t = e.changedTouches[0]; begin(t.clientX, t.clientY, t.identifier, e.target); }, { passive: true });
window.addEventListener("touchmove", (e) => { for (const t of e.changedTouches) if (t.identifier === activeId) move(t.clientX, t.clientY); }, { passive: true });
window.addEventListener("touchend", (e) => { for (const t of e.changedTouches) if (t.identifier === activeId) end(); }, { passive: true });
window.addEventListener("touchcancel", () => { activeId = null; holding = false; }, { passive: true });
window.addEventListener("mousedown", (e) => begin(e.clientX, e.clientY, "mouse", e.target));
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
