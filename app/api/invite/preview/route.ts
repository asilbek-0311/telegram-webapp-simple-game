import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-user";
import { verifyInviteToken } from "@/lib/auth/invite";
import { getEnv } from "@/lib/config";
import { getInvitePreview } from "@/lib/db/friends";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rate = consumeRateLimit({
    key: `invite-preview:${ip}`,
    limit: 30,
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

  let token = "";
  try {
    const body = (await request.json()) as { token?: string };
    token = body.token?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  try {
    const env = getEnv();
    const parsed = verifyInviteToken({
      token,
      secret: env.sessionSecret,
    });

    const preview = await getInvitePreview({
      viewerUserId: auth.user.id,
      inviterUserId: parsed.inviterUserId,
      expiresAt: parsed.expiresAt,
    });

    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to preview invite";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
