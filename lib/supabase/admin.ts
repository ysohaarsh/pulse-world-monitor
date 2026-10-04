import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

/** Service-role client. Bypasses RLS — only use in trusted server code (ingestion, cron). */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(SUPABASE_URL(), key, { auth: { persistSession: false } });
}
