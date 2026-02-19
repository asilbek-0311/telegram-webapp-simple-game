import { NextRequest } from "next/server";
import { getEnv } from "@/lib/config";
import {
  getSessionCookieName,
  verifySessionToken,
} from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { UserPublic } from "@/lib/types";

export type AuthenticatedContext = {
  user: UserPublic;
};

function mapUser(row: {
  id: string;
  telegram_id: string;
  username: string | null;
  display_name: string | null;
  facehash_seed: string;
}): UserPublic {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username,
    displayName: row.display_name,
    facehashSeed: row.facehash_seed,
  };
}

export async function requireAuth(
  request: NextRequest
): Promise<AuthenticatedContext | null> {
  const env = getEnv();
  const supabaseAdmin = getSupabaseAdmin();
  const token = request.cookies.get(getSessionCookieName())?.value;
  if (!token) {
    return null;
  }

  const session = verifySessionToken({ token, secret: env.sessionSecret });
  if (!session) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, telegram_id, username, display_name, facehash_seed")
    .eq("id", session.uid)
    .single();

  if (error || !data) {
    return null;
  }

  if (data.telegram_id !== session.tid) {
    return null;
  }

  return {
    user: mapUser(
      data as {
        id: string;
        telegram_id: string;
        username: string | null;
        display_name: string | null;
        facehash_seed: string;
      }
    ),
  };
}
