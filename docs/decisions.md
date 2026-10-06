# Entscheidungen (ADR-light)

Format: **Entscheidung** – Begründung – verworfene Alternativen. Stand 06.10.2026.
Neue Entscheidungen werden unten angehängt, geänderte als „ersetzt durch D-xx“ markiert.

---

**D-01 · Expo SDK 57 (stabil), nicht SDK 58.**
SDK 57 ist der aktuelle stabile Kanal (`latest`, RN 0.86.3, React 19.2.3). SDK 58 liegt nur unter `next` (Beta seit 29.09.2026). Upgrade auf 58 nach stabilem Release als eigener Schritt. New Architecture ist seit SDK 55 Pflicht – passt zu MapLibre v11 und FlashList v2, die nur noch New Arch unterstützen.

**D-02 · Native Pakete nur über `npx expo install`.**
Mehrere npm-„latest“-Versionen sind neuer als SDK 57 erlaubt (Reanimated 4.7 vs. 4.5.1, Gesture Handler 3.3 vs. 2.32, FlashList 2.3 vs. 2.0.2). `expo install --check` läuft in CI.

**D-03 · TypeScript 6.0 (`~6.0.3`) im strict-Modus.**
Das SDK-57-Template pinnt TS 6.0. TS 7 (nativer Compiler) ist veröffentlicht, aber nicht der Expo-Standard – Wechsel später.

**D-04 · Einzelnes Expo-Projekt im Repo-Root, npm, Dashboard in Phase 6 als npm-Workspace `dashboard/`.**
Hält die vorgegebenen Pfade (`src/config/brand.ts`, `src/design/tokens.ts`, `scripts/check-contrast.ts`) ein und ist der reibungsärmste Weg für EAS Build. Verworfen: pnpm-Monorepo mit `apps/*` (mehr Konfiguration, Pfade weichen von Vorgabe ab).

**D-05 · Styling mit `StyleSheet` + zentralen Tokens + `useTheme()`, kein NativeWind.**
NativeWind 4.2 (stabil) basiert auf Tailwind v3; NativeWind 5 (Tailwind v4) ist noch `rc` (5.0.0-rc.0). Mit StyleSheet sind Tokens typisiert, Dark Mode/Dynamic Type laufen über einen Theme-Hook ohne Build-Magie, und ESLint kann hartkodierte Werte außerhalb `src/design` verbieten. Verworfen: NativeWind 5 RC (Stabilitätsrisiko), Tamagui/Unistyles (zusätzliche Abstraktion ohne Mehrwert für diesen Umfang).

**D-06 · Kontrast: erwartete minimale Anpassungen (Vorabprüfung).**
Eine Vorabrechnung der Vorgabe-Palette zeigt, wo `scripts/check-contrast.ts` in Phase 1 anschlagen wird:

| Paar                                                               | Kontrast    | Ziel                   | Geplante Anpassung (minimal, Phase 1)                                                                       |
| ------------------------------------------------------------------ | ----------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| frei `#15803D` auf frei-weich `#DCF5E6`                            | 4,36        | 4,5                    | Text auf weicher Fläche minimal abdunkeln                                                                   |
| wenige `#B45309` auf wenige-weich `#FDEFD3`                        | 4,42        | 4,5                    | Text minimal abdunkeln                                                                                      |
| Primär `#0F766E` auf Primär-weich `#DDF1EE`                        | 4,66        | 4,5                    | ok                                                                                                          |
| unbekannt `#64748B` auf Hintergrund `#F7F5F0` / gedämpft `#EEF3F1` | 4,37 / 4,24 | 4,5                    | minimal abdunkeln                                                                                           |
| unbekannt `#64748B` auf dunkler Fläche `#121E1C`                   | 3,59        | 4,5                    | eigener Dunkel-Wert (heller)                                                                                |
| Rahmen `#DCE4E1` auf Fläche (hell) / `#26403C` (dunkel)            | 1,29 / 1,53 | 3,0 für Bedien-Grenzen | `border` bleibt dekorativ (Karten); neues Token `borderStrong` (≥ 3:1) für Eingabefelder, Chips, Fokusringe |

Alle übrigen Text-Paare liegen über 4,5:1 (z. B. Text primär auf Hintergrund 15,2:1, Weiß auf Primär 5,5:1, Text auf Coral 6,5:1). Das Skript passt nicht automatisch an; es meldet und die Anpassung wird im Token-File dokumentiert.

**D-07 · Navigation: Expo Router, native Stacks, Tabs über `NativeTabs` – gekapselt.**
Native Tab-Bars (iOS-UITabBar inkl. Liquid Glass, Android Material) sind schneller und von Haus aus barrierefrei. Da die API in SDK 57 noch `unstable-native-tabs` heißt, liegt sie hinter `src/features/navigation/TabsLayout.tsx`; Fallback auf JS-Tabs ist eine Datei. Modale Flows (Buchung, Filter, Warteliste) als native `formSheet` mit `sheetAllowedDetents`.

**D-08 · Karte: MapLibre React Native v11 statt react-native-maps.**
Offener Stack (OSM), kein Google-Maps-SDK auf Android (kein API-Key, keine Datenübermittlung an Google), Clustering nativ über `GeoJSONSource cluster`, eigene Pins mit Statusfarbe + Icon + Uhrzeit. Preis: kein Expo Go → Development Build (s. Risiko). Verworfen: react-native-maps (Google-Abhängigkeit Android, Clustering nur via Zusatzbibliothek).

**D-09 · Kartenkacheln: Style-URL konfigurierbar; Entwicklung OpenFreeMap, Produktion eigener EU-Tileserver (offene Frage 5).**
Jede Kachelanfrage verrät IP und ungefähren Standort an den Kachelanbieter – deshalb EU, ohne Cookies/Keys. Attribution „© OpenStreetMap-Mitwirkende“ immer sichtbar.

**D-10 · Map-Bottom-Sheet: `@gorhom/bottom-sheet` v5 (Snap 25/50/90 %).**
Volle Kontrolle über Federparameter aus den Tokens, liegt innerhalb des Such-Tabs über der Karte, Reduce-Motion-fähig. Fallback siehe Risiko-Tabelle.

**D-11 · Zwei Adapter-Ebenen: `AvailabilityProvider` (Server-Quellen) und `AvailabilityRepository` (App-Zugriff).**
Die App soll nicht wissen, ob ein Slot aus Seed, Dashboard oder 116117 stammt. Ein `InMemoryRepository` mit demselben deterministischen Seed-Generator ermöglicht Tests, Showcase und „Demo ohne Backend“; `supabase/seed.sql` wird aus demselben Generator erzeugt.

**D-12 · `appointments.slot_id`: partieller statt einfacher Unique-Index.**
Vorgabe „slot_id unique“ würde verhindern, dass ein stornierter Slot erneut gebucht wird (Storno gibt den Slot frei). Lösung: `unique (slot_id) where status = 'confirmed'` – Doppelbuchung bleibt unmöglich, Neubuchung nach Storno möglich.

**D-13 · Aktualität über `availability_sources.last_synced_at`, nicht über `slots.updated_at`.**
Ein unveränderter Slot ist nicht „veraltet“, wenn die Praxis ihn gestern bestätigt hat. Die Quelle (Seed-Lauf, Dashboard-Aktion, 116117-Sync) meldet ihren letzten Abgleich; daraus kommen „Aktualisiert vor X Min.“ und „Unbekannt“ (> 24 h).

**D-14 · Alle Client-Schreibzugriffe über Edge Functions; mutierende SQL-Funktionen nur für `service_role`.**
Entspricht der Vorgabe und verhindert, dass Clients RPCs an der Edge Function vorbei aufrufen. Edge Functions prüfen JWT, validieren mit zod, rufen `security definer`-Funktionen mit der geprüften `user_id`. Lesen bleibt direkt (RLS, öffentliche Daten).

**D-15 · Realtime per Broadcast aus der Datenbank, Topics nach Geohash-5.**
Supabase empfiehlt Broadcast gegenüber `postgres_changes` für Skalierung; Payload wird bereinigt; Abo nach sichtbarem Kartenausschnitt (Zellen ~4,9 km). Private Channels: Clients dürfen lesen, nicht senden.

**D-16 · Fehler-Monitoring: Sentry-kompatibles SDK, nur mit EU-DSN, standardmäßig aus (Opt-in), `sendDefaultPii: false`, `beforeSend` entfernt URLs/Query-Parameter/Breadcrumb-Daten, kein Session Replay.**
Ohne konfigurierte DSN wird nichts initialisiert. Anbieterwahl offen (Frage 4).

**D-17 · Push über Expo Push Service hinter Interface `PushSender`.**
Geringster Aufwand; Inhalte sind ohnehin datensparsam (kein Arzt, keine Fachrichtung). Expo wird als Auftragsverarbeiter in die Legal-Checkliste aufgenommen. Wechsel auf direkt APNs/FCM (HTTP v1) ist ein austauschbares Modul.

**D-18 · Erinnerungen (24 h / 2 h) als lokale Benachrichtigungen.**
Keine Server-Infrastruktur, funktioniert offline, keine Daten an Push-Dienste. Erlaubnis wird im Erfolgsscreen angefragt („Erinnerung aktivieren“) – im Moment des Nutzens.

**D-19 · Feldverschlüsselung mit `pgcrypto` + Schlüssel aus Supabase Vault.**
pgsodium und Transparent Column Encryption sind bei Supabase „pending deprecation“ und werden nicht empfohlen. Ent-/Verschlüsselung ausschließlich in `security definer`-Funktionen; der Client sieht nie Schlüssel.

**D-20 · Zeit: `timestamptz` (UTC) speichern, Anzeige mit `date-fns` 4 + `@date-fns/tz` in `Europe/Berlin`.**
Leichtgewichtig, Intl-basiert (Hermes unterstützt `timeZone`), testbar mit `TZ=UTC`. Verworfen: Temporal-Polyfill (Bundle-Größe), Moment/Luxon (Größe).

**D-21 · i18n: i18next + react-i18next, du/Sie über i18next-`context` (`key` / `key_formal`).**
Standard ist „du“ (Vorgabe). `scripts/check-i18n.ts` prüft Schlüsselparität de/en und dass jede du-Form eine Sie-Form hat (Deutsch). Englisch braucht keine Formvariante.

**D-22 · Icons: Lucide (`lucide-react-native`).**
Konsistente Outline-Icons (2 px Strich), großes Set inklusive medizinischer Motive (z. B. `Baby`, `Ear`, `Eye`, `Bone`, `Brain`, `HeartPulse`), einzeln importierbar. Verworfen: Phosphor (ebenfalls gut, aber Lucide hat die passenderen Status-Icons in einem Stil).

**D-23 · Fonts zur Build-Zeit einbetten (`expo-font`-Config-Plugin).**
Kein Font-Laden beim Start → hilft dem Kaltstart-Ziel < 2 s und verhindert Layout-Sprünge.

**D-24 · Anonyme Supabase-Session ab App-Start; Upgrade per E-Mail-Code vor der ersten Buchung (vorbehaltlich Frage 3).**
Erlaubt RLS-geschützte eigene Zeilen ohne Registrierungshürde. Beim Verknüpfen bleibt die Nutzer-ID erhalten, Daten wandern mit.

**D-25 · Demo-Daten sind fiktiv – auch die Adressen.**
Keine Kombination aus realen Praxen (z. B. OSM) mit erfundener Verfügbarkeit, weil das „erfundene Fakten über reale Praxen“ wären. Seed-Praxen tragen fiktive Namen und fiktive Straßennamen mit realer PLZ, `is_demo = true`, in der UI mit „Demo“-Kennzeichen. OSM-Import (Phase 6+) liefert nur Verzeichnisdaten, Verfügbarkeit bleibt dort „Unbekannt“, bis die Praxis selbst pflegt.

**D-26 · Analytics: keine in Phase 1–4; Phase 5 eigenes, anonymes Opt-in-Event-Logging in Supabase (ohne Nutzer-ID, ohne Standort).**

**D-27 · Praxis-Dashboard (Phase 6): Vite + React SPA statt Next.js.**
Kein SSR-Bedarf, einfache statische EU-Auslieferung, gleiche Supabase-Auth/RLS. Endgültig bestätigt zu Beginn von Phase 6.

---

## Entscheidungen während der Umsetzung (Phasen 1–6)

**D-28 · Schriften zur Laufzeit aus lokalen Assets laden (ersetzt D-23).**
Beim Einbetten per Config-Plugin unterscheiden sich die Font-Family-Namen zwischen iOS (PostScript-Name) und Android (Dateiname). `useFonts` mit festen Schlüsseln (`Inter_400Regular` …) ist auf iOS, Android und Web identisch. Die vier Schnitte werden einzeln importiert (nicht das ganze Paket) und liegen im App-Bundle – kein Netzwerk, der Splash bleibt sichtbar, bis sie geladen sind.

**D-29 · Routen unter `src/app/` (statt `app/`).**
Standard des SDK-57-Templates; Expo Router erkennt `src/app` automatisch. Routen bleiben dünn und rendern Feature-Screens aus `src/features/*`.

**D-30 · Schema `app` ist über die API erreichbar – aber nur für `service_role`.**
Edge Functions rufen die security-definer-Funktionen per supabase-js (`db: { schema: 'app' }`) auf. Alle mutierenden Funktionen sind für `anon`/`authenticated` widerrufen, alle Tabellen in `app` haben RLS ohne Policies. `config.toml` → `api.schemas` enthält `app` (gehostet: `supabase config push` oder Dashboard → API → Exposed schemas).

**D-31 · Web-Vorschau mit JS-Tabs (`TabsLayout.web.tsx`).**
Native Tabs werden im Web oben angezeigt; für die Entwicklungs-Vorschau und Screenshots gibt es eine klassische Tab-Bar unten. Gleichzeitig der dokumentierte Fallback für D-07.

**D-32 · Demo-Slots erzeugt die Datenbank selbst (`app.demo_generate_slots`).**
Statische Stammdaten (Praxen, Ärzte, Profile) kommen aus dem TS-Generator (`supabase/seed.sql`, identische IDs). Slots erzeugt eine SQL-Funktion mit deterministischem Hash und rollt sie nachts weiter – ohne Node-Prozess im Betrieb. Die konkreten Demo-Slots in App-Demo und Datenbank können sich daher unterscheiden.

**D-33 · Demo-Modus simuliert die Warteliste.**
Ohne Backend gibt es keine anderen Nutzenden. Nach dem Eintragen wird nach ~20 s ein passender Termin „frei“ (fiktive Stornierung), es folgen Angebot, lokale Mitteilung und 10-Minuten-Countdown – der echte Ablauf ist in SQL umgesetzt und getestet (`05_waitlist.test.sql`).

**D-34 · Fiktive Telefonnummern aus dem für Film/Fernsehen reservierten Bereich (069 90009 xxx).**
„Anrufen“ funktioniert in der Demo, erreicht aber niemanden.

**D-35 · Push-Tokens speichern Sprache und du/Sie.**
Der Server kennt sonst die Sprache nicht. Die Texte bleiben datensparsam (keine Praxis/Fachrichtung).

**D-36 · Buchen erfordert eine bestätigte E-Mail (Supabase-Modus).**
Umsetzung der Empfehlung zu Frage 3: anonyme Sitzung ab Start, vor der ersten Buchung 6-stelliger Code (`updateUser` + `verifyOtp('email_change')`, Nutzer-ID bleibt). Existiert die Adresse schon, Anmeldung per OTP. Die Edge Function prüft `is_anonymous`. Im Demo-Modus entfällt der Schritt.

**D-37 · Kalender über `expo-calendar/legacy` (`createEventInCalendarAsync`).**
SDK 57 markiert die alte API als veraltet zugunsten von `calendar.addEventWithForm()`, das auf Android keinen Standardkalender kennt. Der Legacy-Import öffnet auf beiden Plattformen den System-Dialog ohne Lese-Berechtigung. Migration in `TODO.md`.

**D-38 · Abgelaufene Wartelisten-Angebote sind nicht sofort frei buchbar.**
Nur abgelaufene **Checkout**-Holds gelten als frei. Ein abgelaufenes Angebot reicht der Job (alle 30 s) an die nächste Person weiter – sonst könnte jemand ohne Warteliste der nächsten Person in der Schlange zuvorkommen.

**D-39 · Karten-Pins als generierte PNGs mit Status-Symbol (`scripts/generate-map-icons.ts`).**
Farbe + Symbol (✓ ! × ?) + Uhrzeit als Label – Status nie nur über Farbe, auch auf der Karte.

**D-40 · Optimierter Seed-Generator.**
Zeitzonen-Rechnungen werden je Tag/Uhrzeit gecacht, Würfe über einen Integer-Mixer: 230 ms → 70 ms (Desktop) für ~7 000 Slots. Die Erzeugung läuft erst nach dem ersten Frame.

## Phase 6 – Praxis-Dashboard

**D-41 · Dashboard-Zugriff über security-definer-RPCs statt Edge Functions.**
Die App schreibt über Edge Functions (Idempotenz, Validierung, Regionsbindung). Das Dashboard ruft dagegen `public.dashboard_*`-RPCs direkt auf: Jede Funktion prüft Mitgliedschaft (`practice_members`) und zweiten Faktor (`aal2`) in der Datenbank, validiert Eingaben in SQL und schreibt ein Zugriffsprotokoll. Direkte Tabellenrechte gibt es nicht. Weniger bewegliche Teile, gleiche Sicherheitsgrenze (die Datenbank), vollständig mit pgTAP getestet (`06_dashboard.test.sql`).

**D-42 · Zwei-Faktor-Pflicht (TOTP) für Praxis-Konten.**
Das Dashboard zeigt Namen und Telefonnummern von Patient:innen (Art.-9-Kontext). Anmeldung per E-Mail-Code (kein Passwort, keine neuen Konten über das Dashboard), danach TOTP über Supabase Auth MFA. Ohne `aal2` liefert die Datenbank `mfa_required`. Konten legt das MedNow-Team nach Prüfung der Praxis an (`app.add_practice_member`).

**D-43 · Datensparsame Buchungsansicht.**
Kontaktdaten nur für bestätigte Termine; nach einer Absage werden sie in der Ansicht nicht mehr geliefert. Bei Familienmitgliedern sieht die Praxis nur die Altersgruppe (der in der App vergebene Name bleibt privat). Jeder Abruf wird in `app.practice_audit_log` protokolliert (12 Monate). Die Wochenansicht kennzeichnet über MedNow gebuchte Slots nur mit der Termin-ID.

**D-44 · Absage durch die Praxis: Slot entfällt, Push ohne Details.**
Sagt die Praxis ab, wird der Slot storniert (nicht erneut angeboten – meist fällt die Sprechzeit aus). Die Person erhält „Die Praxis hat einen Ihrer Termine abgesagt. Details in der App.“ – ohne Praxis, Arzt, Uhrzeit (Sperrbildschirm).

**D-45 · Wochenvorlagen in Berliner Ortszeit, Umrechnung beim Anwenden.**
Vorlagen speichern Wochentag (ISO) und Uhrzeiten ohne Zeitzone; `dashboard_apply_templates` rechnet je Kalendertag mit `at time zone 'Europe/Berlin'` um. 09:00 bleibt 09:00 vor und nach der Zeitumstellung (getestet in SQL und Vitest). Anwenden ist idempotent (Exclusion-Constraint, `on conflict do nothing`).

**D-46 · Dashboard nutzt Domain-Code und Tokens der App direkt.**
Status-Regeln, Zeit-Helfer, Seed-Generator, Anlass-/Altersgruppen-Texte und Design-Tokens kommen aus `../src` (Vite-Alias `@app`). Farben werden als CSS-Variablen generiert (`virtual:mednow-theme.css`), ein Test stellt sicher, dass `styles.css` keine Farbwerte enthält und nur definierte Variablen nutzt. Demo-Modus: dieselbe fiktive Praxis wie in der Demo-App; App-Demo und Dashboard-Demo teilen keine Daten (beide laufen ohne Backend). Mit Supabase sehen beide denselben Stand in Echtzeit.

**D-47 · Strenge Content-Security-Policy, keine eingebetteten Ressourcen.**
Der Build setzt `default-src 'self'` plus die Supabase-Origin; Schriften liegen lokal (keine Google-Fonts-Abfragen), `assetsInlineLimit: 0` verhindert `data:`-Schriften. Zod wurde im Dashboard entfernt, weil seine JIT-Prüfung (`new Function`) CSP-Verstöße meldet.

## Phase 5 – Politur

**D-48 · Sentry (EU) nur nach Opt-in und erst dann geladen.**
`@sentry/react-native` ist installiert, wird aber erst nach Einwilligung im Datenschutz-Center per `require` geladen und initialisiert; beim Widerruf wird es sofort beendet. Nur EU-DSNs (`*.de.sentry.io` oder GlitchTip). Abgeschaltet: Tracing, Sitzungen, Screenshots, View-Hierarchie, Netzwerk-/Navigations-/Konsolen-Breadcrumbs, Nutzer- und Anfragekontext; `beforeSend` bereinigt E-Mail, IDs, Telefonnummern, Koordinaten. Quellkarten-Upload über das Config-Plugin nur, wenn `SENTRY_ORG`/`SENTRY_PROJECT` gesetzt sind. Im Sentry-Projekt zusätzlich „IP-Adressen nicht speichern“ aktivieren (`TODO.md`).

**D-49 · Icons und date-fns einzeln importieren, Bundle-Budget in CI.**
Metro entfernt ungenutzte Exporte nicht. Der Lucide-Barrel brachte alle ~1 900 Icons ins Bundle. `src/components/icons.ts` exportiert die genutzten Icons über die offiziellen Unterpfade (`lucide-react-native/icons/*`), date-fns über `date-fns/<funktion>`; ESLint verbietet Barrel-Importe. Web-Bundle 7,4 → 5,1 MB. `scripts/check-bundle-size.ts` bricht in CI ab, wenn Web oder Android das Budget überschreiten. Expo-Tree-Shaking ist noch als „unstable“ markiert und wird daher nicht genutzt.

**D-50 · Hoch- und Querformat.**
WCAG 1.3.4 (BFSG) verlangt, die Ausrichtung nicht ohne Not festzulegen. `orientation: 'default'`; Inhalte sind auf 640 dp begrenzt und zentriert, niedrige Fenster bekommen einen kompakten Praxis-Kopf.

**D-51 · Zeitbegrenzungen: wesentlich in der App, verlängerbar im Dashboard.**
Die 5-Minuten-Reservierung und das 10-Minuten-Wartelisten-Angebot sind für einen fairen Zugang zu knappen Terminen wesentlich (WCAG 2.2.1, Ausnahme „essential“); die Restzeit ist sichtbar, wird eine Minute vor Ablauf für Screenreader angekündigt, und der Termin kann danach neu gewählt werden. Die automatische Abmeldung im Dashboard (30 Min.) warnt 60 Sekunden vorher mit „Angemeldet bleiben“.

**D-52 · Maestro-Abläufe ohne Gerät in CI.**
`.maestro/` enthält die drei Kernabläufe (Akut buchen, Suche & buchen inkl. Storno, Warteliste) gegen stabile `testID`s; Syntax ist mit `maestro check-syntax` geprüft. Ausführung braucht einen Development-/Preview-Build auf Simulator oder Emulator (lokal oder EAS Workflows) – in der normalen CI läuft sie nicht (`TODO.md`).

## Nach Phase 6 – Web-Demo

**D-53 · Web-Version robust gegen eingebettete und eingeschränkte Browser.**
Beim Bau der klickbaren Demo fielen Lücken der Web-Variante auf, die auch echte Browser betreffen: (1) `Alert.alert` ist in react-native-web wirkungslos – Rückfragen (Stornieren, Widerruf, Löschen) laufen jetzt über `useConfirm()`: nativ der System-Dialog, im Web ein eigener Dialog. (2) Ist der Browser-Speicher blockiert, blieb die App leer – `createSafeStorage` fällt auf den Arbeitsspeicher zurück. (3) NetInfo prüft im Web per `HEAD /` und meldete hinter Unterpfaden „offline“ – im Web gilt `navigator.onLine`, im Demo-Modus laufen Abfragen netzunabhängig. (4) Kalender und lokale Erinnerungen werden im Web nicht angeboten. (5) Unbekannte Pfade leiten zur Startseite (`+not-found`).

**D-54 · Kein „gerade vergeben“-Hinweis für die eigene Buchung.**
Die Praxisseite liegt unter dem Buchungs-Sheet; die optimistische Markierung „gebucht“ löste dort den Hinweis für fremde Buchungen aus. Er erscheint jetzt nur, wenn die Seite im Vordergrund ist und der Termin nicht zu den eigenen Buchungen gehört (Regressionstest in `flows.test.tsx`).

## Testversionen

**D-55 · Testversionen über EAS mit Demo-Daten, erkennbar am Update-Kanal.**
Profil `preview` baut eine installierbare APK bzw. interne iOS-Version mit Demo-Daten, Namen „MedNow Test“ und Diagnose-Seite. Die Projekt-ID steht fest in `app.config.ts` (wie `eas init --id`; dynamische Konfiguration kann EAS nicht selbst beschreiben) – sie ist kein Geheimnis und muss auch auf den EAS-Build-Servern vorhanden sein (Push-Token, Updates). Diagnose ist an, wenn `EXPO_PUBLIC_DIAGNOSTICS=1` gesetzt ist **oder** der Build auf einem Testkanal läuft – so bleibt sie auch nach einem EAS Update an, das ohne die Build-Variablen entsteht. Produktions-Builds werden erst nach Abnahme eingereicht (`docs/test-builds.md`).

**D-56 · EAS Update ohne Wartezeit beim Start.**
`expo-updates` mit `checkAutomatically: ON_LOAD` und `fallbackToCacheTimeout: 0`: Der Kaltstart wartet nie auf das Netz (Ziel < 2 s), ein geladenes Update gilt ab dem nächsten Start. `runtimeVersion` folgt der App-Version; neue native Module erfordern eine neue Version und einen neuen Build. Für Builds ohne EAS (GitHub-Ersatzweg) schaltet `EXPO_NO_UPDATES=1` Updates ab.

**D-57 · Startzeit: in der App ab JS-Start, von außen ab Prozessstart.**
Ohne natives Zusatzmodul kennt JS den Prozessstart nicht. Die App misst daher vom JS-Start (`performance.rnStartupTiming.startTime`, sonst erstes geladenes Modul über `index.ts`) bis zur ersten bedienbaren Ansicht (Startseite mit Daten bzw. Einführung, nach dem nächsten Frame) und speichert die letzten 20 Werte nur in Testversionen lokal. Den vollständigen Kaltstart misst `scripts/measure-startup.sh` über logcat-Zeitstempel („START u0“ bis zur Messzeile der App) – ohne Code im Produktions-Pfad, der Daten sammelt.

**D-58 · Zustände über aria-\* statt nur accessibilityState; Ansagen enthalten alles Sichtbare.**
axe-core auf dem Web-Export fand: Optionsfelder/Kontrollkästchen ohne `aria-checked` (react-native-web übersetzt `accessibilityState` nicht), „ausgewählt“ zusätzlich zu „aktiviert“ (doppelte Ansage), wählbare Tage ohne Termine, ein Regler mit verschachtelten Tasten, eine leere Kopf-Überschrift, fehlender Hauptbereich. `PressableScale` setzt jetzt `aria-checked/selected/disabled/busy/expanded` (wirkt nativ und im Web), Optionsfelder melden nur „aktiviert“, leere Tage sind deaktiviert, der Umkreis ist nativ ein Regler und im Web eine Gruppe aus zwei Tasten. Praxiskarten und die Akut-Schaltfläche sagen alles an, was sichtbar ist (inkl. Aktualität, Bewertung, Demo-Kennzeichnung); Hinweise werden im Web an den Namen angehängt, weil es dort keine Hinweise gibt. Prüfplan mit erwarteten Ansagen: `docs/screenreader-testplan.md`.

**D-59 · Karten im Echtbetrieb aus eigenem EU-Speicher (PMTiles, ohne Kachelserver).**
Deutschland-Ausschnitt der Protomaps-Basiskarte als eine PMTiles-Datei plus Stile, Schriften und Symbole in einem S3-kompatiblen Speicher in der EU; MapLibre Native liest PMTiles direkt per Range-Anfragen. Kein Server-Prozess, keine Kartenanfragen an Dritte, monatliche Aktualisierung per GitHub-Workflow. Stile werden aus `@protomaps/basemaps` erzeugt (deutsche Beschriftung, ohne POI-Ebene, hell und dunkel) und gegen die MapLibre-Spezifikation geprüft. Entwicklung und Testversionen nutzen weiter OpenFreeMap. Alternative mit eigenem Server oder VersaTiles: `docs/map-tiles.md`.

**D-60 · Gehostetes Projekt über den Connector, Rest über den Workflow.**
Das Projekt in Frankfurt wurde über den Supabase-Connector angelegt und mit den Migrationen 0100–0800 bestückt; eine Prüfsummen-Abfrage bestätigt, dass Funktionen, Spalten, Regeln und Rechte der lokal getesteten Datenbank entsprechen. Zwei Abweichungen vom lokalen Stand wurden dabei sichtbar und behoben: `realtime.messages` gehört auf gehosteten Projekten Supabase (RLS nur noch einschalten, wenn aus), `pg_net` gehört ins Schema `extensions`. Funktionen mit DELETE-Anweisungen verlangt der Connector einzeln bestätigt; sie kommen als idempotente Migration 0900 über den GitHub-Workflow, ebenso Demo-Daten, Auth-/API-Konfiguration und Edge Functions – exakt aus dem Repository statt abgeschrieben. Die App nutzt den neuen Publishable Key (öffentlich, durch RLS geschützt).
