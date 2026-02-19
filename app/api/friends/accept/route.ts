import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-user";
import { acceptFriendRequest } from "@/lib/db/friends";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestId = "";
  try {
    const body = (await request.json()) as { requestId?: string };
    requestId = body.requestId?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  try {
    const result = await acceptFriendRequest({
      requestId,
      accepterUserId: auth.user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
