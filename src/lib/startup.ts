import { useEffect } from 'react';
import { Platform } from 'react-native';

import { env } from '@/config/env';

import { appStorage } from './storage';

/**
 * Startzeit-Messung für Testversionen (docs/performance.md §4).
 *
 * Gemessen wird vom Start der JS-Ausführung bis zur ersten bedienbaren Ansicht
 * (Startseite mit Daten bzw. Einführung). Die Zeit davor – Prozessstart, Splash,
 * Laden der Laufzeit – misst `scripts/measure-startup.sh` von außen über logcat.
 *
 * Dieses Modul wird als Erstes geladen (index.ts), damit `bootAt` möglichst früh liegt.
 */

type StartupTiming = { startTime?: number | null };
type PerformanceWithStartup = Performance & { rnStartupTiming?: StartupTiming };

const perf = (globalThis as { performance?: PerformanceWithStartup }).performance;
const now = () => (perf?.now ? perf.now() : Date.now());
const bootAt = now();

export type StartupMeasurement = {
  /** Zeitpunkt der Messung (ISO) */
  at: string;
  platform: string;
  /** Erste bedienbare Ansicht */
  screen: 'home' | 'onboarding';
  /** JS-Start bis bedienbar, in ms */
  jsToInteractiveMs: number;
};

const STORAGE_KEY = 'mednow.diagnostics.startup.v1';
const KEEP = 20;

let measured = false;

/** Beginn der JS-Ausführung: nativer RN-Zeitstempel, sonst Laden dieses Moduls. */
function jsStart(): number {
  try {
    const start = perf?.rnStartupTiming?.startTime;
    if (typeof start === 'number' && start > 0 && start <= bootAt) return start;
  } catch {
    // Ältere Laufzeit ohne rnStartupTiming
  }
  return bootAt;
}

export function markInteractive(screen: StartupMeasurement['screen']): StartupMeasurement | null {
  if (measured) return null;
  measured = true;
  const measurement: StartupMeasurement = {
    at: new Date().toISOString(),
    platform: Platform.OS,
    screen,
    jsToInteractiveMs: Math.max(0, Math.round(now() - jsStart())),
  };
  if (env.diagnostics) {
    // Diese Zeile wertet scripts/measure-startup.sh aus (Tag ReactNativeJS).
    console.info(`[startup] ${JSON.stringify(measurement)}`);
    void saveMeasurement(measurement);
  }
  return measurement;
}

/** Meldet die erste bedienbare Ansicht – nach dem nächsten gezeichneten Frame. */
export function useMarkInteractive(screen: StartupMeasurement['screen'], ready: boolean) {
  useEffect(() => {
    if (!ready || measured) return;
    const frame = requestAnimationFrame(() => markInteractive(screen));
    return () => cancelAnimationFrame(frame);
  }, [ready, screen]);
}

async function saveMeasurement(measurement: StartupMeasurement) {
  const previous = await loadMeasurements();
  await appStorage.setItem(STORAGE_KEY, JSON.stringify([measurement, ...previous].slice(0, KEEP)));
}

export async function loadMeasurements(): Promise<StartupMeasurement[]> {
  try {
    const raw = await appStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (m): m is StartupMeasurement =>
            typeof m === 'object' && m !== null && typeof m.jsToInteractiveMs === 'number',
        )
      : [];
  } catch {
    return [];
  }
}

export async function clearMeasurements() {
  await appStorage.removeItem(STORAGE_KEY);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/** Nur für Tests */
export function resetStartupForTests() {
  measured = false;
}
