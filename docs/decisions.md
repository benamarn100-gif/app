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

| Paar | Kontrast | Ziel | Geplante Anpassung (minimal, Phase 1) |
|---|---|---|---|
| frei `#15803D` auf frei-weich `#DCF5E6` | 4,36 | 4,5 | Text auf weicher Fläche minimal abdunkeln |
| wenige `#B45309` auf wenige-weich `#FDEFD3` | 4,42 | 4,5 | Text minimal abdunkeln |
| Primär `#0F766E` auf Primär-weich `#DDF1EE` | 4,66 | 4,5 | ok |
| unbekannt `#64748B` auf Hintergrund `#F7F5F0` / gedämpft `#EEF3F1` | 4,37 / 4,24 | 4,5 | minimal abdunkeln |
| unbekannt `#64748B` auf dunkler Fläche `#121E1C` | 3,59 | 4,5 | eigener Dunkel-Wert (heller) |
| Rahmen `#DCE4E1` auf Fläche (hell) / `#26403C` (dunkel) | 1,29 / 1,53 | 3,0 für Bedien-Grenzen | `border` bleibt dekorativ (Karten); neues Token `borderStrong` (≥ 3:1) für Eingabefelder, Chips, Fokusringe |

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
