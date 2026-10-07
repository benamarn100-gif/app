// Edge Function "billing_webhook" – RevenueCat meldet Käufe, Verlängerungen und Abläufe
// (verify_jwt = false, geschützt über REVENUECAT_WEBHOOK_SECRET im Authorization-Header).
import { liveContext } from '../_shared/context.ts';
import { handleBillingWebhook } from '../_shared/handlers.ts';
import { serve } from '../_shared/http.ts';

const ctx = liveContext();
Deno.serve(serve((req) => handleBillingWebhook(req, ctx)));
