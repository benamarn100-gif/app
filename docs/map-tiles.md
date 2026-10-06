# Eigener Kartenspeicher in der EU

> Stand: 06.10.2026. In Entwicklung und Testversionen lädt die Karte den Stil von OpenFreeMap. Für den
> Echtbetrieb liegen Kacheln, Stile, Schriften und Symbole in **einem eigenen Speicher in der EU** – die
> App fragt dann keine Dritten mehr nach Karteninhalten (keine IP-Adressen an fremde Kartendienste).

## 1. Aufbau (ohne Server-Prozess)

```
S3-kompatibler EU-Speicher (öffentlich lesbar, HTTPS, Range-Anfragen)
├── germany.pmtiles          Deutschland-Ausschnitt der Protomaps-Basiskarte (OSM, ODbL), Zoom 0–15
├── style-light.json         heller Stil, deutsche Beschriftung, ohne Geschäfte/Restaurants
├── style-dark.json          dunkler Stil (App im dunklen Design)
├── fonts/Noto Sans …/       Schriften als PBF-Glyphen
└── sprites/v4/light|dark    Symbole
```

MapLibre Native (Android ≥ 11.8, iOS 6.x – die App nutzt 13.6 bzw. die passende iOS-Version) liest
PMTiles direkt per HTTP-Bereichsanfragen (`pmtiles://https://…`). Ein Kachelserver ist nicht nötig;
der Speicher liefert nur Dateien aus. Größe bei Zoom 15: einige GB (genaue Zahl zeigt der Workflow).

## 2. Speicher wählen und anlegen

Geeignet sind S3-kompatible Speicher mit Rechenzentrum in Deutschland/EU und AV-Vertrag, z. B.
**Hetzner Object Storage** (Falkenstein/Nürnberg), **IONOS S3** (Frankfurt/Berlin) oder ein anderer
deutscher Anbieter. Schritte (Beispiel Hetzner):

1. Bucket anlegen, z. B. `mednow-karten`, Standort `fsn1`.
2. Zugangsschlüssel (Access Key/Secret Key) mit Schreibrecht nur für diesen Bucket erzeugen.
3. Öffentliches Lesen erlauben (Bucket-Richtlinie oder ACL `public-read` für die Objekte).
4. CORS für Web-Clients (Praxis-Dashboard, Web-Version) setzen:
   ```json
   [
     {
       "AllowedOrigins": ["https://<deine-domains>"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["Range", "If-Match"],
       "ExposeHeaders": ["ETag", "Content-Range"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```
   (`aws s3api put-bucket-cors --endpoint-url … --bucket … --cors-configuration file://cors.json`)
5. Optional: eigene Domain (z. B. `karten.mednow.de`) per CNAME auf den Bucket; dann diese als
   öffentliche Basis-URL verwenden.

## 3. Befüllen und aktualisieren

GitHub → _Settings → Secrets and variables → Actions_:

| Art      | Name                                         | Beispiel                                            |
| -------- | -------------------------------------------- | --------------------------------------------------- |
| Secret   | `TILES_S3_ACCESS_KEY`, `TILES_S3_SECRET_KEY` | Schlüssel aus Schritt 2                             |
| Variable | `TILES_S3_ENDPOINT`                          | `https://fsn1.your-objectstorage.com`               |
| Variable | `TILES_S3_BUCKET`                            | `mednow-karten`                                     |
| Variable | `TILES_PUBLIC_URL`                           | `https://mednow-karten.fsn1.your-objectstorage.com` |

Dann _Actions_ → „Kartenkacheln bereitstellen (EU)“ → _Run workflow_. Der Workflow sucht den neuesten
Protomaps-Build, schneidet Deutschland aus (`go-pmtiles extract --bbox … --maxzoom 15`), prüft die Datei,
erzeugt die Stile (`scripts/build-map-style.ts`), lädt Schriften/Symbole aus `protomaps/basemaps-assets`,
lädt alles hoch und prüft danach Stil, Range-Anfrage (HTTP 206) und eine Schriftdatei. Er läuft danach
**monatlich** von selbst.

## 4. App umstellen

expo.dev → Projekt → _Environment variables_ (Umgebungen `preview` und `production`):

```
EXPO_PUBLIC_MAP_STYLE_URL=https://<basis-url>/style-light.json
EXPO_PUBLIC_MAP_STYLE_URL_DARK=https://<basis-url>/style-dark.json
```

Danach neuer Build oder EAS Update. Die Diagnose-Seite der Testversion zeigt den Kartenserver an.
Die Quellenangabe (© OpenStreetMap-Mitwirkende, Protomaps) erscheint über das ⓘ-Symbol der Karte und
muss sichtbar bleiben (ODbL).

## 5. Alternativen

- **Eigener kleiner Server** (z. B. Hetzner Cloud CX22): `go-pmtiles serve` oder ein Webserver mit
  Range-Unterstützung (Caddy/nginx) vor denselben Dateien – sinnvoll, wenn Zugriffe protokolliert,
  begrenzt oder per eigener Domain mit eigenem TLS ausgeliefert werden sollen.
- **VersaTiles** (versatiles.org, Projekt aus Deutschland): fertige OSM-Kacheln, Stile und Server – ebenfalls
  selbst betreibbar.
- **Kommerzieller EU-Anbieter** mit AV-Vertrag (z. B. MapTiler, Standort Schweiz/EU) – weniger Betrieb,
  laufende Kosten.
