-- MedNow · Zeitfenster „next24h“ (jetzt bis jetzt + 24 h).
-- „today“ endet um Mitternacht Berlin: ab dem Abend zeigt die Suche dann fast immer „ausgebucht“,
-- obwohl am nächsten Morgen Termine frei sind. Unbekannte Werte fallen wie bisher auf „week“ zurück.

create or replace function app.window_bounds(p_window text, p_now timestamptz, out w_from timestamptz, out w_to timestamptz)
language sql stable
set search_path = ''
as $$
  select
    case p_window when 'tomorrow'
      then (date_trunc('day', p_now at time zone 'Europe/Berlin') + interval '1 day') at time zone 'Europe/Berlin'
      else p_now end,
    case p_window
      when 'next24h' then p_now + interval '24 hours'
      when 'today' then (date_trunc('day', p_now at time zone 'Europe/Berlin') + interval '1 day') at time zone 'Europe/Berlin' - interval '1 microsecond'
      when 'tomorrow' then (date_trunc('day', p_now at time zone 'Europe/Berlin') + interval '2 days') at time zone 'Europe/Berlin' - interval '1 microsecond'
      else (date_trunc('day', p_now at time zone 'Europe/Berlin') + interval '7 days') at time zone 'Europe/Berlin' - interval '1 microsecond'
    end
$$;
