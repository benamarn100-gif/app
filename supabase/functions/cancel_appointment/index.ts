// Edge Function "cancel_appointment" – Fachlogik in ../_shared/handlers.ts (testbar ohne Supabase).
import { liveContext } from '../_shared/context.ts';
import { handleCancelAppointment } from '../_shared/handlers.ts';
import { serve } from '../_shared/http.ts';

const ctx = liveContext();
Deno.serve(serve((req) => handleCancelAppointment(req, ctx)));
