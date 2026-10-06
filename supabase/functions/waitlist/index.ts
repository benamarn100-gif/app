// Edge Function "waitlist" – Fachlogik in ../_shared/handlers.ts (testbar ohne Supabase).
import { liveContext } from '../_shared/context.ts';
import { handleWaitlist } from '../_shared/handlers.ts';
import { serve } from '../_shared/http.ts';

const ctx = liveContext();
Deno.serve(serve((req) => handleWaitlist(req, ctx)));
