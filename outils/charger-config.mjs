// charger-config.mjs — Pose window.CONFIG (public/config.js) pour les
// scripts de mesure Node, avec d'éventuelles surcharges.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
export function chargerConfig(surcharges = {}) {
  globalThis.window = globalThis.window || {};
  const src = readFileSync(fileURLToPath(new URL("../public/config.js", import.meta.url)), "utf8").replace("Object.freeze(window.CONFIG);", "");
  new Function("window", src)(globalThis.window);
  Object.assign(globalThis.window.CONFIG, surcharges);
  return globalThis.window.CONFIG;
}
