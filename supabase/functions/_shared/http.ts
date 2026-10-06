/** HTTP-Hilfen für alle Edge Functions: CORS, JSON, Fehlercodes. */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, idempotency-key, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export type ErrorCode =
  | 'slot_taken'
  | 'hold_expired'
  | 'consent_missing'
  | 'verification_required'
  | 'offer_expired'
  | 'not_found'
  | 'invalid_input'
  | 'rate_limited'
  | 'unauthorized'
  | 'not_implemented'
  | 'unknown';

const STATUS: Record<ErrorCode, number> = {
  slot_taken: 409,
  hold_expired: 409,
  consent_missing: 412,
  verification_required: 403,
  offer_expired: 410,
  not_found: 404,
  invalid_input: 400,
  rate_limited: 429,
  unauthorized: 401,
  not_implemented: 501,
  unknown: 500,
};

export class HttpError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
  }
}

const KNOWN = new Set(Object.keys(STATUS));

/** Bildet Datenbankfehler ('slot_taken' etc. aus app.raise_app_error) auf Codes ab. */
export function toErrorCode(error: unknown): ErrorCode {
  if (error instanceof HttpError) return error.code;
  const message = (error as { message?: string } | null)?.message ?? '';
  return KNOWN.has(message) ? (message as ErrorCode) : 'unknown';
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function errorResponse(error: unknown): Response {
  const code = toErrorCode(error);
  if (code === 'unknown') {
    // Keine personenbezogenen Daten loggen – nur den technischen Fehlertext.
    console.error('Unerwarteter Fehler', (error as Error)?.message ?? String(error));
  }
  return json({ error: code }, STATUS[code]);
}

/** Gemeinsamer Rahmen: OPTIONS, nur POST, Fehlerbehandlung. */
export function serve(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'invalid_input' }, 405);
    try {
      return await handler(req);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError('invalid_input');
  }
}
