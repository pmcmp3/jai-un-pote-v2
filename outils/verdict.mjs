// verdict.mjs — La dernière ligne de chaque test du filet (`npm run verif`) :
// OK ou ÉCHEC, écrit noir sur blanc, et un code de sortie ≠ 0 en cas d'échec
// pour que outils/verif.mjs (et donc deploy.sh) s'arrête.
export function verdict(ok, resume) {
  console.log(`${ok ? "✅ OK" : "❌ ÉCHEC"} — ${resume}`);
  if (!ok) process.exitCode = 1;
  return ok;
}
