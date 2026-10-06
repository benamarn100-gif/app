#!/usr/bin/env bash
# Kaltstart-Messung auf einem Android-Gerät (docs/performance.md §4).
#
# Voraussetzungen: Testversion (Profil „preview“) installiert, USB-Debugging an,
# `adb devices` zeigt das Gerät. Der erste Lauf ist ein Aufwärmlauf und zählt nicht.
#
# Nutzung: scripts/measure-startup.sh [Läufe=10] [Paket=de.mednow.app]
#
# Gemessen je Lauf:
#   erstes Bild  – `am start -W` TotalTime (Prozessstart bis erstes Bild, meist das Startbild)
#   bedienbar    – Prozessstart bis erste bedienbare Ansicht (logcat: „START u0“ → „[startup]“)
#   davon JS     – JS-Start bis bedienbar (von der App selbst gemessen, src/lib/startup.ts)
set -euo pipefail
# Hinweis: läuft auch mit der alten bash 3.2 von macOS (leere Arrays, kein mapfile).

RUNS="${1:-10}"
PKG="${2:-de.mednow.app}"

command -v adb >/dev/null || { echo "adb fehlt – Android SDK Platform-Tools installieren." >&2; exit 1; }
adb get-state >/dev/null 2>&1 || { echo "Kein Gerät verbunden (adb devices)." >&2; exit 1; }

ACTIVITY="$(adb shell cmd package resolve-activity --brief "$PKG" | tail -n 1 | tr -d '\r')"
[[ "$ACTIVITY" == */* ]] || { echo "App $PKG ist nicht installiert." >&2; exit 1; }

echo "Gerät: $(adb shell getprop ro.product.model | tr -d '\r') · Android $(adb shell getprop ro.build.version.release | tr -d '\r')"
echo "App:   $ACTIVITY · $RUNS Messläufe + 1 Aufwärmlauf"
echo

first_frame=()
interactive=()
js=()

for run in $(seq 0 "$RUNS"); do
  adb shell am force-stop "$PKG"
  sleep 2
  adb logcat -c
  total="$(adb shell am start -W -n "$ACTIVITY" | tr -d '\r' | awk -F': ' '/TotalTime/ {print $2}')"

  log=""
  for _ in $(seq 1 40); do
    log="$(adb logcat -d -v epoch -s ActivityTaskManager ActivityManager ReactNativeJS | tr -d '\r')"
    grep -q '\[startup\]' <<<"$log" && break
    sleep 0.5
  done

  t0="$(grep -m1 'START u0' <<<"$log" | awk '{print $1}' || true)"
  line="$(grep -m1 '\[startup\]' <<<"$log" || true)"
  if [[ -z "$line" || -z "$t0" ]]; then
    echo "Lauf $run: erstes Bild ${total:-?} ms · keine Messzeile der App (Testversion mit Diagnose installiert?)"
    continue
  fi
  t1="$(awk '{print $1}' <<<"$line")"
  ready="$(awk -v a="$t0" -v b="$t1" 'BEGIN { printf "%d", (b - a) * 1000 }')"
  js_ms="$(sed -E 's/.*"jsToInteractiveMs":([0-9]+).*/\1/' <<<"$line")"

  if [[ "$run" -eq 0 ]]; then
    echo "Aufwärmlauf: erstes Bild ${total} ms · bedienbar ${ready} ms (zählt nicht)"
    continue
  fi
  echo "Lauf $run: erstes Bild ${total} ms · bedienbar ${ready} ms (davon JS ${js_ms} ms)"
  first_frame+=("$total")
  interactive+=("$ready")
  js+=("$js_ms")
done

median() {
  [[ $# -eq 0 ]] && { echo "–"; return; }
  printf '%s\n' "$@" | sort -n | awk '{ v[NR] = $1 } END { if (NR % 2) print v[(NR + 1) / 2]; else print int((v[NR / 2] + v[NR / 2 + 1]) / 2) }'
}

echo
echo "Median erstes Bild: $(median ${first_frame[@]+"${first_frame[@]}"}) ms"
echo "Median bedienbar:   $(median ${interactive[@]+"${interactive[@]}"}) ms   (Ziel < 2000 ms)"
echo "Median davon JS:    $(median ${js[@]+"${js[@]}"}) ms"
