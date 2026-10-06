// Edge Function "send_notifications" – Push-Worker für die Outbox (verify_jwt = false,
// geschützt über das gemeinsame Geheimnis WORKER_SECRET im Header x-worker-secret).
import { liveContext } from '../_shared/context.ts';
import { handleSendNotifications } from '../_shared/handlers.ts';
import { serve } from '../_shared/http.ts';
import { ExpoPushSender } from '../_shared/push.ts';

const ctx = liveContext();
const sender = new ExpoPushSender(Deno.env.get('EXPO_ACCESS_TOKEN') ?? undefined);
Deno.serve(serve((req) => handleSendNotifications(req, ctx, sender)));
