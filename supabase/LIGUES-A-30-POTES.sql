-- « J'ai un pote v2 » — UNE LIGUE = 31 PLACES (toi + 30 potes), 22 novembre 2026.
--
-- À coller dans l'éditeur SQL du projet v2 :
--   https://supabase.com/dashboard/project/khlxublwgcqihuezzsam/sql/new
-- Relançable sans risque, n'efface rien.
--
-- Le jeu donne maintenant +10 % par pote jusqu'à 30 potes (×4). Sans ce
-- fichier, la base refuse le 22e membre et le bonus s'arrête à +200 %.
-- Le plafond anti-triche monte avec : score parfait maximal 20 488 × 4 = 81 952,
-- plafond conseillé 115 000 (node outils/plafond.mjs).

alter table public.ligues alter column plafond set default 31;
update public.ligues set plafond = 31 where plafond < 31 and code not in ('PMCMP', 'BETA');
update public.concours set plafond_score = 115000 where id = 1 and plafond_score < 115000;

create or replace function public.ligue_plafond() returns trigger language plpgsql as $$
declare cap integer;
begin
  if exists (select 1 from public.ligue_membres where code = new.code and pseudo = new.pseudo) then
    return new;
  end if;
  select coalesce(plafond, 31) into cap from public.ligues where code = new.code for update;
  if cap is null then cap := 31; end if;
  if (select count(*) from public.ligue_membres where code = new.code) >= cap then
    raise exception 'ligue complete (% max)', cap;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';

-- VÉRIFICATION : plafond_score = 115000 ; BRUNO à 31 ; PMCMP reste à 6.
select plafond_score from public.concours;
select code, plafond from public.ligues order by code;
