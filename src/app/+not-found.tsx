import { Redirect } from 'expo-router';

/**
 * Unbekannte Adressen (veraltete Deep Links, Web-Aufruf unter fremdem Pfad)
 * führen zur Startseite statt zu einer Fehlerseite.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
