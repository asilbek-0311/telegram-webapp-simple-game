import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/config";
import { verifyTelegramInitData } from "@/lib/auth/telegram";
import {
  createSessionToken,
  getSessionCookieName,
  getSessionTtlSec,
} from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { FriendGraphResponse, UserPublic } from "@/lib/types";
import { getFriendGraph } from "@/lib/db/friends";
import { consumeRateLimit } from "@/lib/rate-limit";

function toUserPublic(row: {
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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const env = getEnv();
  const supabaseAdmin = getSupabaseAdmin();
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const authRate = consumeRateLimit({
    key: `auth:${ip}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!authRate.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Retry in ${authRate.retryAfterSec}s` },
      { status: 429 }
    );
  }

  let initData = "";
  try {
    const body = (await request.json()) as { initData?: string };
    initData = body.initData?.trim() ?? "";
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!initData) {
    return jsonError("initData is required", 400);
  }

  let verified;
  try {
    verified = verifyTelegramInitData({
      initData,
      botToken: env.telegramBotToken,
      maxAgeSec: env.authMaxAgeSec,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Telegram auth";
    return jsonError(message, 401);
  }

  const facehashSeed = verified.username ?? `tg_${verified.telegramId}`;

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        telegram_id: verified.telegramId,
        username: verified.username,
        display_name: verified.displayName,
        facehash_seed: facehashSeed,
      },
      {
        onConflict: "telegram_id",
      }
    )
    .select("id, telegram_id, username, display_name, facehash_seed")
    .single();

  if (error || !user) {
    return jsonError("Unable to authenticate user", 500);
  }

  const userRow = user as {
    id: string;
    telegram_id: string;
    username: string | null;
    display_name: string | null;
    facehash_seed: string;
  };

  const token = createSessionToken({
    userId: userRow.id,
    telegramId: userRow.telegram_id,
    secret: env.sessionSecret,
  });

  let graph: FriendGraphResponse;
  try {
    graph = await getFriendGraph(userRow.id, env.secondDegreeLimit);
  } catch {
    graph = {
      me: toUserPublic(userRow),
      directFriends: [],
      secondDegree: [],
      edges: [],
      pendingIncoming: [],
      pendingOutgoing: [],
      stats: { connected: 0, pendingIncoming: 0 },
    };
  }

  const response = NextResponse.json({
    user: toUserPublic(userRow),
    stats: graph.stats,
  });

  response.cookies.set({
    name: getSessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionTtlSec(),
  });

  return response;
}
