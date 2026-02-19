import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/config";
import type { DbSchema } from "@/lib/supabase/schema";

let adminClient: ReturnType<typeof createClient<DbSchema>> | null = null;

export function getSupabaseAdmin() {
  if (adminClient) {
    return adminClient;
  }

  const env = getEnv();
  adminClient = createClient<DbSchema>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
