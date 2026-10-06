// Edge Function "hold_slot" – Fachlogik in ../_shared/handlers.ts (testbar ohne Supabase).
import { liveContext } from '../_shared/context.ts';
import { handleHoldSlot } from '../_shared/handlers.ts';
import { serve } from '../_shared/http.ts';

const ctx = liveContext();
Deno.serve(serve((req) => handleHoldSlot(req, ctx)));
