-- « J'ai un pote v2 » — REMISE À ZÉRO POUR LE LANCEMENT (22 novembre 2026).
--
-- À coller EN UNE FOIS dans l'éditeur SQL du projet Supabase de la v2 :
--   https://supabase.com/dashboard/project/khlxublwgcqihuezzsam/sql/new
-- (JAMAIS le projet de la v1.) À lancer juste AVANT d'annoncer le jeu.
--
-- ⚠️ CE FICHIER EFFACE, et ça ne se rattrape pas : tous les scores, tous les
-- membres, toutes les fiches de joueurs (Insta, emails), tous les événements
-- de mesure et toutes les ligues de test. Il garde seulement :
--   - PMCMP, la ligue de démo et ses cinq cyclistes (le jeu en a besoin) ;
--   - BRUNO, la ligue du bureau, vide.
-- Puis il ouvre le concours maintenant et le ferme le jeudi 31 décembre 2026
-- à 12 h 00, heure de Paris (même date que public/config.js et le règlement).

begin;

delete from public.ligue_scores;
delete from public.ligue_membres where code <> 'PMCMP';
delete from public.ligues where code not in ('PMCMP', 'BRUNO');
delete from public.joueurs;
delete from public.evenements;
delete from public.retours_beta;

update public.ligues set concours = true where code = 'BRUNO';
update public.concours
   set debut = now(),
       fin   = '2026-12-31T12:00:00+01:00'
 where id = 1;

commit;
notify pgrst, 'reload schema';

-- VÉRIFICATION — à lire :
--   1. fin = 2026-12-31 11:00:00+00, plafond 110000, commission 0.100 ;
--   2. il ne reste que PMCMP et BRUNO ;
--   3. le classement est vide ; 4. les quatre compteurs sont à 0.
select debut, fin, plafond_score, commission from public.concours;
select code, nom, plafond, concours from public.ligues order by code;
select count(*) as classes from public.concours_joueurs;
select (select count(*) from public.ligue_scores) as scores,
       (select count(*) from public.ligue_membres where code <> 'PMCMP') as membres,
       (select count(*) from public.joueurs) as joueurs,
       (select count(*) from public.evenements) as evenements;
