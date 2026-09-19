#!/usr/bin/env bash
# brancher-domaine.sh — Branche le sous-domaine de la v2 sur GitHub Pages.
#
# À lancer UNE FOIS, quand l'artiste a ajouté chez OVH (zone
# la-ville-est-belle-pmc.fr) l'enregistrement :
#
#     pote   CNAME   pmcmp3.github.io.
#
# Ne pas le lancer avant : GitHub redirigerait alors pmcmp3.github.io/jai-un-pote-v2/
# vers une adresse qui ne répond pas encore, et le jeu serait hors ligne.
#
# Usage :  ./outils/brancher-domaine.sh [domaine]      (défaut : pote.la-ville-est-belle-pmc.fr)
set -euo pipefail
cd "$(dirname "$0")/.."
DOMAINE="${1:-pote.la-ville-est-belle-pmc.fr}"

# 1. Le DNS doit déjà pointer vers GitHub Pages.
CIBLE="$(dig +short "$DOMAINE" CNAME | tr -d '[:space:]')"
if [ "$CIBLE" != "pmcmp3.github.io." ]; then
  echo "✗ $DOMAINE ne pointe pas (encore) vers pmcmp3.github.io (réponse DNS : « ${CIBLE:-rien} »)."
  echo "  Ajouter chez OVH : pote  CNAME  pmcmp3.github.io.  — puis relancer dans quelques minutes."
  exit 1
fi
echo "✓ DNS : $DOMAINE → $CIBLE"

# 2. Le build embarque le CNAME, et les liens de ligue passent sur le domaine.
echo "$DOMAINE" > public/CNAME
sed -i '' "s#lienJeu: \"https://pmcmp3.github.io/jai-un-pote-v2/\"#lienJeu: \"https://$DOMAINE/\"#" public/config.js
grep -n "lienJeu:" public/config.js
./deploy.sh "Domaine $DOMAINE"

# 3. GitHub Pages : domaine personnalisé, certificat, HTTPS forcé.
export GH_TOKEN="$(gh auth token --user pmcmp3)"
gh api -X PUT repos/pmcmp3/jai-un-pote-v2/pages -f cname="$DOMAINE" >/dev/null
echo "… attente du certificat HTTPS (quelques minutes à une heure)"
for i in $(seq 1 90); do
  ETAT="$(gh api repos/pmcmp3/jai-un-pote-v2/pages --jq '.https_certificate.state // "aucun"')"
  echo "  certificat : $ETAT"
  [ "$ETAT" = "approved" ] && break
  sleep 40
done
gh api -X PUT repos/pmcmp3/jai-un-pote-v2/pages -F https_enforced=true >/dev/null && echo "✓ HTTPS forcé"
curl -sI "https://$DOMAINE/" | head -1
echo "✅ https://$DOMAINE/  (bêta : https://$DOMAINE/?ligue=BETA)"
