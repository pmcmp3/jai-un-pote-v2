-- « J'ai un pote v2 » — LA LIGUE DE TEST (20 septembre 2026, demandée).
--
-- À exécuter dans l'éditeur SQL du projet Supabase de la V2, APRÈS
-- supabase/schema-v2.sql. Ne touche à rien d'autre : ni aux scores, ni aux
-- autres ligues, ni au projet de la v1 (où tourne la bêta du premier jeu).
-- Relançable sans erreur (les doublons sont ignorés).
--
-- La ligue s'appelle TESTV2. Elle est déclarée comme LIGUE DE BÊTA dans
-- public/config.js (`ligueBeta: "TESTV2"`), ce qui lui donne trois choses que
-- les autres ligues n'ont pas :
--   · un menu simplifié : pseudo → cycliste → JOUER (ni choix de ligue, ni
--     sprint du dimanche, ni tiroir album) ;
--   · un plafond de 60 joueurs au lieu de 6 ;
--   · le bouton « Laisser un retour » sur l'écran de fin, qui écrit dans la
--     table `retours_beta`.
--
-- ⚠️ `retours_beta` n'est PAS lisible avec la clé publique du jeu : les
-- retours se lisent uniquement dans le Table editor de Supabase.

-- 1. La ligue.
insert into public.ligues (code, nom, createur, plafond)
values ('TESTV2', 'Ligue de test', 'pmc', 60)
on conflict (code) do update set nom = excluded.nom, plafond = excluded.plafond;

-- 2. Les quatre premiers membres : ils forment le peloton que les nouveaux
--    verront rouler derrière eux dès leur première course. Chacun a son
--    maillot (le champ `skin` est le même JSON que celui du menu du jeu).
insert into public.ligue_membres (code, pseudo, skin) values
  ('TESTV2', 'arthur',  '{"motif":"raye","c1":"#2f7a46","c2":"#f2ede2","short":"#3a3e4e","chapeau":"casquette","chaussures":"#565a66","velo":"vtt"}'),
  ('TESTV2', 'louis',   '{"motif":"uni","c1":"#ffcf2e","c2":"#f2ede2","short":"#3f63b4","chapeau":"bob","chaussures":"#f2ede2","velo":"vtt"}'),
  ('TESTV2', 'antoine', '{"motif":"carreaux","c1":"#e13e26","c2":"#0d0d10","short":"#c8963a","chapeau":"paille","chaussures":"#33353d","velo":"grandbi"}'),
  ('TESTV2', 'paul',    '{"motif":"uni","c1":"#f2ede2","c2":"#f2ede2","short":"#b8402c","chapeau":"aucun","chaussures":"#f2ede2","velo":"roller"}')
on conflict (code, pseudo) do update set skin = excluded.skin;

-- 3. Vérification : doit répondre 4.
select count(*) as membres from public.ligue_membres where code = 'TESTV2';
