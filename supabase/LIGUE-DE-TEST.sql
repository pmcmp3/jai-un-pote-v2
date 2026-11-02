-- Ligue d'ESSAI : toi + 5 faux potes, pour tester le concours sur ton téléphone.
-- À coller APRÈS CONCOURS-A-COLLER.sql. Relançable sans doublon.
-- Lien : https://pmcmp3.github.io/jai-un-pote-v2/?ligue=ESSAI
-- Pour tout effacer ensuite : voir le bloc NETTOYAGE tout en bas.

insert into public.ligues (code, nom, createur, plafond, concours)
values ('ESSAI', 'Ligue d''essai', 'tom', 6, true)
on conflict (code) do update set nom = excluded.nom, plafond = excluded.plafond;

insert into public.ligue_membres (code, pseudo, skin) values
  ('ESSAI', 'tom',   '{"motif":"raye","c1":"#2f7a46","c2":"#f2ede2","short":"#3a3e4e","chapeau":"casquette","chaussures":"#565a66","velo":"vtt"}'),
  ('ESSAI', 'lola',  '{"motif":"uni","c1":"#ffcf2e","c2":"#f2ede2","short":"#3f63b4","chapeau":"paille","chaussures":"#f2ede2","velo":"grandbi"}'),
  ('ESSAI', 'sam',   '{"motif":"uni","c1":"#f2ede2","c2":"#f2ede2","short":"#b8402c","chapeau":"aucun","chaussures":"#f2ede2","velo":"vtt"}'),
  ('ESSAI', 'nina',  '{"motif":"uni","c1":"#e13e26","c2":"#f2ede2","short":"#3a3e4e","chapeau":"bob","chaussures":"#e0742e","velo":"vtt"}'),
  ('ESSAI', 'yanis', '{"motif":"carreaux","c1":"#e13e26","c2":"#0d0d10","short":"#c8963a","chapeau":"casquette","chaussures":"#33353d","velo":"grandbi"}')
on conflict (code, pseudo) do nothing;

-- Une course de 2 minutes chacun : ils comptent pour le boost de ligue (30 s
-- minimum) et la ligue apparaît dans le classement du concours.
insert into public.ligue_scores (code, pseudo, metres, potes, mode, duree_s, appareil)
select 'ESSAI', v.pseudo, v.metres, v.potes, 'course', 120, 'faux-' || v.pseudo
from (values ('tom', 4200, 5), ('lola', 3100, 4), ('sam', 2600, 3), ('nina', 1800, 2), ('yanis', 900, 1)) as v(pseudo, metres, potes)
where not exists (select 1 from public.ligue_scores s where s.code = 'ESSAI' and s.pseudo = v.pseudo);

select * from public.concours_ligues order by total desc;

-- ===========================================================================
-- NETTOYAGE — à coller quand tu as fini de tester (efface la ligue ET tes scores dedans) :
--
-- delete from public.ligue_scores where code = 'ESSAI';
-- delete from public.ligue_membres where code = 'ESSAI';
-- delete from public.ligues where code = 'ESSAI';
-- ===========================================================================
