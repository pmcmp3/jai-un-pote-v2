#!/usr/bin/env bash
# Déploiement de « J'ai un pote v2 » sur GitHub Pages, dépôt pmcmp3/jai-un-pote-v2.
# Indépendant du site principal (pmcmp3/la-ville-est-belle) : ce script ne
# touche JAMAIS l'autre dépôt, donc jamais le jeu du concours ni la bêta v1.
#
# Usage :  ./deploy.sh "message de commit"
#          DEPLOY_DRY=1 ./deploy.sh "test"   → tout sauf les deux push
#
# Pousse avec le compte GitHub `pmcmp3` sans changer le compte actif du poste
# (`gh auth switch`) : le mot de passe est fourni à git par `gh auth token
# --user pmcmp3`, le temps de la commande seulement.
#
# Adresse : https://pmcmp3.github.io/jai-un-pote-v2/ — ou le sous-domaine si
# public/CNAME existe (Vite le copie dans le build, GitHub Pages le lit).
set -euo pipefail
cd "$(dirname "$0")"

MSG="${1:-Mise a jour du jeu}"
BRANCHE="$(git rev-parse --abbrev-ref HEAD)"
AIDE_GIT='!f() { test "$1" = get && echo username=pmcmp3 && echo "password=$(gh auth token --user pmcmp3)"; }; f'
push() {
  if [ "${DEPLOY_DRY:-0}" = "1" ]; then echo "[dry] git push $*"; return; fi
  git -c credential.helper= -c credential.helper="$AIDE_GIT" push "$@"
}

# 0. Source : historique normal (pas de snapshot orphelin, le dépôt est neuf).
git add -A
git commit -q -m "$MSG" || echo "→ rien à committer sur $BRANCHE"
push -q origin "$BRANCHE"

# 1. Build (base relative : servable sous /jai-un-pote-v2/ comme à la racine d'un domaine).
rm -rf dist-pages
npx vite build --base=./ --outDir=dist-pages --emptyOutDir
find dist-pages -name '.DS_Store' -delete
touch dist-pages/.nojekyll

# 2. Branche gh-pages = un commit orphelin du build, construit dans un worktree
#    séparé (jamais de --orphan dans l'arbre principal : il désindexe tout).
TMP="$(mktemp -d)/gh-pages"
git worktree add -q --detach "$TMP" HEAD
(
  cd "$TMP"
  git checkout -q --orphan gh-pages-build
  git rm -rq --cached . >/dev/null
  git clean -fdxq
  cp -R "$OLDPWD/dist-pages/." .
  git add -A
  git -c user.name="$(git -C "$OLDPWD" config user.name || echo pmcmp3)" -c user.email="$(git -C "$OLDPWD" config user.email || echo pmcmp3@users.noreply.github.com)" commit -q -m "$MSG"
)
( cd "$TMP" && push -q origin "HEAD:gh-pages" --force )
git worktree remove --force "$TMP"
git branch -D gh-pages-build >/dev/null 2>&1 || true

if [ -f public/CNAME ]; then URL="https://$(tr -d '[:space:]' < public/CNAME)/"; else URL="https://pmcmp3.github.io/jai-un-pote-v2/"; fi
echo "✅ Déployé. Le site se rafraîchit en 1 à 2 minutes : $URL"
