import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-user";
import { sendFriendRequest } from "@/lib/db/friends";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rate = consumeRateLimit({
    key: `request:${ip}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Retry in ${rate.retryAfterSec}s` },
      { status: 429 }
    );
  }

  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let targetUsername = "";
  try {
    const body = (await request.json()) as { targetUsername?: string };
    targetUsername = body.targetUsername?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!targetUsername) {
    return NextResponse.json({ error: "targetUsername is required" }, { status: 400 });
  }

  try {
    const result = await sendFriendRequest({
      fromUserId: auth.user.id,
      targetUsername,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
