/*
 * The database client.
 *
 * This is NOT src/lib/supabase.ts. That one is the browser client: anon key,
 * a logged-in user's session, and RLS doing the work of keeping people out of
 * each other's data. None of that is available to a server process, so this
 * client holds the service_role key and RLS is off the table -- every policy
 * in the database is bypassed on every query.
 *
 * Which means the guardrail moves from Postgres into this process, into
 * userScope.ts, and that file is the only thing standing between two people's
 * training histories. It is small and heavily tested for exactly that reason.
 *
 * A future hardening step, if the project still carries a legacy HS256 JWT
 * secret: mint a short-lived token per request with sub = the resolved user
 * and let RLS enforce isolation again, keeping userScope as defence in depth.
 * Not built speculatively -- newer Supabase projects sign with keys whose
 * private half cannot be exported, so whether it is even possible has to be
 * checked against this project before any code assumes it.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/database.types';

export type Client = SupabaseClient<Database>;

export function createServiceClient(env: NodeJS.ProcessEnv = process.env): Client {
  const url = env.EZ_SUPABASE_URL?.trim();
  const key = env.EZ_SUPABASE_SERVICE_ROLE_KEY?.trim();

  const missing = [!url && 'EZ_SUPABASE_URL', !key && 'EZ_SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean);
  if (missing.length) {
    throw new Error(`Missing ${missing.join(' and ')}.`);
  }

  return createClient<Database>(url!, key!, {
    auth: {
      // A server has no session to persist and nothing to refresh against.
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      // Marks this server's writes as Claude's. The database stamps template
      // provenance from it, together with the service_role key (EZ-53).
      headers: { 'x-ez-client': 'claude-mcp' },
    },
  });
}

/*
 * email -> auth.users.id.
 *
 * Goes through the admin API rather than a select on auth.users, because the
 * schema behind that table is Supabase's to change and the admin endpoint is
 * the supported contract. listUsers is paged; the filter is applied
 * client-side because the API has no exact-email query, and the page size is
 * generous relative to a household.
 */
export function createUserLookup(client: Client) {
  return async function lookup(email: string): Promise<string | null> {
    const wanted = email.toLowerCase();

    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;

      const hit = data.users.find((u) => u.email?.toLowerCase() === wanted);
      if (hit) return hit.id;

      if (data.users.length < 200) return null;
    }

    // Twenty pages of 200 is four thousand accounts. Reaching here means the
    // assumption behind this loop is wrong, which is worth an error rather
    // than a silent "no such user".
    throw new Error('Gave up looking for the user after 20 pages.');
  };
}
