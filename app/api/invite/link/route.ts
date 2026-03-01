import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-user";
import { createInviteToken } from "@/lib/auth/invite";
import { getEnv } from "@/lib/config";
import { InviteLinkResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const env = getEnv();
  const { token, expiresAt } = createInviteToken({
    inviterUserId: auth.user.id,
    secret: env.sessionSecret,
    ttlSec: env.inviteTtlSec,
  });

  const startAppLink = `https://t.me/${env.telegramBotUsername}?startapp=invite_${token}`;
  const webFallbackLink = `${env.appBaseUrl.replace(/\/$/, "")}/?invite=${token}`;

  const payload: InviteLinkResponse = {
    inviteToken: token,
    startAppLink,
    webFallbackLink,
    expiresAt,
  };

  return NextResponse.json(payload);
}
