-- À coller UNE FOIS dans le SQL Editor : la course est plus rapide (vitesse
-- finale 5,6 → 8,4), donc les scores montent. Le score parfait maximal passe de
-- 18 476 à 23 050 ; avec le boost de ligue ×3, un humain peut atteindre 69 150.
-- L'ancien plafond (75 000) était trop juste : on le relève pour ne JAMAIS
-- refuser une vraie partie en silence.
update public.concours set plafond_score = 95000 where id = 1;
select plafond_score from public.concours where id = 1;
