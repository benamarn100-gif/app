-- Phase 4: Abo-Stufen werden in der Datenbank durchgesetzt – ohne Vorrang auf Wartelisten.
begin;
select plan(12);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000f1', 'free@example.org', false),
  ('00000000-0000-4000-8000-0000000000f2', 'plus@example.org', false);
select app.grant_consent(u, 'health_data', '2026-10-01')
  from unnest(array['00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f2']::uuid[]) u;

create temp table pr as select id from public.practices order by name limit 3;

-- Kostenlos: 1 aktiver Alarm, höchstens 14 Tage, Ich + 1 Person
select is(app.plan_for('00000000-0000-4000-8000-0000000000f1'), 'free', 'ohne Abo: kostenlos');
select ok(
  app.join_waitlist('00000000-0000-4000-8000-0000000000f1', (select id from pr limit 1), null, null, null, null, 7, 10) is not null,
  'kostenlos: erster Alarm'
);
select throws_ok(
  $$ select app.join_waitlist('00000000-0000-4000-8000-0000000000f1', (select id from pr offset 1 limit 1), null, null, null, null, 7, 10) $$,
  'P0001', 'plan_limit', 'kostenlos: zweiter Alarm → plan_limit'
);
select throws_ok(
  $$ select app.join_waitlist('00000000-0000-4000-8000-0000000000f2', (select id from pr limit 1), null, null, null, null, 60, 10) $$,
  'P0001', 'plan_limit', 'kostenlos: 60 Tage → plan_limit'
);
select ok(app.add_dependent('00000000-0000-4000-8000-0000000000f1', 'Mia', 'child_6_12') is not null, 'kostenlos: ein Familienmitglied');
select throws_ok(
  $$ select app.add_dependent('00000000-0000-4000-8000-0000000000f1', 'Ben', 'child_0_5') $$,
  'P0001', 'plan_limit', 'kostenlos: zweites Familienmitglied → plan_limit'
);

-- Plus: 10 Alarme, 60 Tage
select app.set_entitlement('00000000-0000-4000-8000-0000000000f2', 'plus', app.now() + interval '30 days', 'mednow_plus_pass_30d');
select is(app.plan_for('00000000-0000-4000-8000-0000000000f2'), 'plus', 'Pass aktiv → Plus');
select ok(
  (select count(*) from pr, lateral app.join_waitlist('00000000-0000-4000-8000-0000000000f2', pr.id, null, null, null, null, 60, 10)) = 3,
  'Plus: mehrere Alarme mit 60 Tagen'
);

-- Fairness: Plus ändert nicht die Reihenfolge – Eintragungszeit entscheidet
select ok(
  (select bool_and(w.created_at >= f.created_at)
     from public.waitlist_entries w
     join public.waitlist_entries f on f.user_id = '00000000-0000-4000-8000-0000000000f1'
    where w.user_id = '00000000-0000-4000-8000-0000000000f2' and w.practice_id = f.practice_id),
  'früher eingetragen (kostenlos) bleibt vor später eingetragen (Plus)'
);

-- Ablauf: abgelaufen → wieder kostenlos; beendet → Eintrag gelöscht
update app.entitlements set expires_at = app.now() - interval '1 minute' where user_id = '00000000-0000-4000-8000-0000000000f2';
select is(app.plan_for('00000000-0000-4000-8000-0000000000f2'), 'free', 'abgelaufen → kostenlos');
select app.set_entitlement('00000000-0000-4000-8000-0000000000f2', null, null, null);
select is((select count(*)::int from app.entitlements where user_id = '00000000-0000-4000-8000-0000000000f2'), 0, 'beendet → gelöscht');

-- App liest nur die eigene Stufe
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f1", "role": "authenticated"}';
select is((public.get_my_plan() ->> 'plan'), 'free', 'get_my_plan liefert die eigene Stufe');
reset role;

select * from finish();
rollback;
