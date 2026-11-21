# DESIGN.md — le système de l'interface (« J'ai un pote v2 »)

Posé le 21 novembre 2026, demandé : « tu écris trop de choses, les gens quand ils jouent ils ne
lisent pas […] les alignements, on comprend rien, les tailles de typo […] t'as même pas de
design system, faut que t'en fasses un ». Avant : 35 combinaisons taille/graisse, 9 interlettrages.

## 1. Le texte : on en met le moins possible

- **Un écran dit une chose.** Un titre (le sticker rouge), l'information, l'action. Pas de phrase
  qui explique une règle : ce qui s'explique se TOUCHE (l'éclair du bonus ouvre sa carte).
- Pas de phrase d'encouragement, pas de compte à rebours du concours, pas de « touche pour… ».
- Un bouton = un verbe. Un champ = son placeholder, pas d'étiquette ni de picto devant.
- Avant d'ajouter une ligne : peut-on l'enlever, ou la remplacer par un pictogramme + un chiffre ?

## 2. Typographie — quatre rôles, des jetons, jamais une taille à la main

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Étiquette | `--t-xs` | 11 px, 700, CAPITALES, `--ls-l` | stickers, libellés, puces, pastilles |
| Note | `--t-s` | 12 px, 500, gris `--gris` | secondaire, liens, boutons (700 capitales) |
| Corps | `--t-m` | 13 px, 500 (700 = ce qui compte) | lignes de classement, textes |
| Saisie | `--t-saisie` | 16 px, 500 | champs (sous 16 px, iOS zoome) |
| Titre | `--t-titre` | 22 px, serif 900 | nom de la ligue, titres de tiroir |
| Score | — | 48 px, serif 900 | le score de fin, seul |

- Graisses : **500** et **700** en Helvetica ; **900** réservé à la serif.
- Interlettrage : `--ls-l` (0,12 em) pour les capitales, `--ls-s` (0,04 em) pour les puces, 0 ailleurs.
- Couleurs de texte : `--noir`, `--gris`, `--rouge`. Le jaune `--jaune` est un FOND (moi, bonus).

## 3. Mise en page

- Une carte = **une colonne de 240 px** ; tout s'aligne dessus (champs, boutons, listes).
- Espacements : `--e1` 4 · `--e2` 8 · `--e3` 12 · `--e4` 16 · `--e5` 24. Rien d'autre.
- Champ : cadre 1,5 px, rayon `--rayon`, **44 px** de haut. Les mêmes partout.
- Bouton : 44 px de haut, pleine colonne. Rouge plein = l'action ; blanc bordé = l'autre.
- Liste classée (`.rangs`) : lignes de 44 px, rang · pseudo · éclair · points ; **ma ligne en
  jaune encadré**.
- **Cible tactile ≥ 44 × 44 px** : un petit élément étend sa zone par un `::after` invisible.
- **Aucune ombre, aucun contour sous un texte.** Dans le canvas, un texte est sur une plaque
  (`hud.plaque`, `hud.renderPastille`) ou sur le sticker rouge.

## 4. Ce qui le garde vrai

`npm run verif` : `ecrans` (cibles, débordements, 3 tailles de téléphone), `lignes` (mots seuls),
`contraste`, `accessibilite`. `node outils/audit-ecrans.mjs --photos` capture les 9 formats.
