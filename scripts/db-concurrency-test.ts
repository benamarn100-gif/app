/**
 * Nebenläufigkeitstest: Doppelbuchung muss technisch unmöglich sein.
 *  1. 50 verschiedene Personen buchen gleichzeitig denselben Slot → genau 1 Erfolg, 49× 'slot_taken'.
 *  2. 10 parallele Wiederholungen derselben Anfrage (gleicher Idempotenz-Schlüssel) → 1 Termin.
 * Läuft gegen die Test-Datenbank aus scripts/db-test.sh.
 */
import { Pool } from 'pg';

const DB = process.env.MEDNOW_TEST_DB ?? 'mednow_test';
const pool = new Pool({ database: DB, max: 60 });
const CONSENT = '2026-10-01';

async function main() {
  const setup = await pool.connect();
  let failures = 0;
  const users: string[] = [];
  try {
    for (let i = 0; i < 51; i++) {
      const { rows } = await setup.query<{ id: string }>(
        `insert into auth.users (email, is_anonymous) values ($1, false) returning id`,
        [`concurrency-${Date.now()}-${i}@example.org`],
      );
      users.push(rows[0]!.id);
      await setup.query(`select app.grant_consent($1, 'health_data', $2)`, [rows[0]!.id, CONSENT]);
    }
    const slots = await setup.query<{ id: string }>(
      `select id from public.availability_slots where status = 'open' and starts_at > now() + interval '3 hours'
       order by starts_at limit 2`,
    );
    const [slotA, slotB] = slots.rows.map((r) => r.id);
    if (!slotA || !slotB) throw new Error('Keine offenen Slots für den Test');

    // 1) 50 Personen, ein Slot
    const attempts = users.slice(0, 50).map(async (user, i) => {
      const client = await pool.connect();
      try {
        await client.query(
          `select app.book_slot($1, $2, $3, null, null, 'Test Person', '0661 123456', 'public', $4)`,
          [user, slotA, `concurrency-key-${i}-xxxx`, CONSENT],
        );
        return 'ok';
      } catch (error) {
        return (error as Error).message;
      } finally {
        client.release();
      }
    });
    const results = await Promise.all(attempts);
    const ok = results.filter((r) => r === 'ok').length;
    const taken = results.filter((r) => r === 'slot_taken').length;
    const active = await setup.query<{ n: string }>(
      `select count(*) as n from public.appointments where slot_id = $1 and status = 'confirmed'`,
      [slotA],
    );
    console.log(
      `  50 parallele Buchungen: ${ok} Erfolg, ${taken} × slot_taken, ${active.rows[0]!.n} aktive Termine`,
    );
    if (ok !== 1 || taken !== 49 || active.rows[0]!.n !== '1') {
      failures++;
      console.error(
        '  ✗ Doppelbuchung nicht verhindert!',
        results.filter((r) => r !== 'ok' && r !== 'slot_taken'),
      );
    } else {
      console.log('  ✓ Genau eine Buchung, Doppelbuchung verhindert');
    }

    // 2) Gleiche Anfrage 10× parallel (Netzwerk-Retry) → genau ein Termin
    const user = users[50]!;
    const retries = await Promise.all(
      Array.from({ length: 10 }, async () => {
        const client = await pool.connect();
        try {
          const { rows } = await client.query<{ r: { id: string } }>(
            `select app.book_slot($1, $2, 'same-idempotency-key', null, null, 'Test Person', '0661 123456', 'public', $3) as r`,
            [user, slotB, CONSENT],
          );
          return rows[0]!.r.id;
        } catch (error) {
          return `error:${(error as Error).message}`;
        } finally {
          client.release();
        }
      }),
    );
    const ids = new Set(retries);
    console.log(`  10 parallele Wiederholungen: ${ids.size} eindeutige Ergebnisse`);
    if (ids.size !== 1 || [...ids][0]!.startsWith('error:')) {
      failures++;
      console.error('  ✗ Idempotenz verletzt:', [...ids]);
    } else {
      console.log('  ✓ Idempotenz: alle Wiederholungen liefern denselben Termin');
    }

    // Aufräumen
    await setup.query(
      `delete from public.booking_contacts where appointment_id in (select id from public.appointments where user_id = any($1))`,
      [users],
    );
    await setup.query(`delete from public.appointments where user_id = any($1)`, [users]);
    await setup.query(`update public.availability_slots set status = 'open' where id = any($1)`, [
      [slotA, slotB],
    ]);
    await setup.query(`delete from auth.users where id = any($1)`, [users]);
  } finally {
    setup.release();
    await pool.end();
  }
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
