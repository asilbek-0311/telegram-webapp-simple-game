import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-user";
import { searchUsers } from "@/lib/db/friends";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";
  if (!query.trim()) {
    return NextResponse.json({ users: [] });
  }

  const users = await searchUsers({ viewerId: auth.user.id, query });
  return NextResponse.json({ users });
}
