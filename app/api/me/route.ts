import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-user";
import { getEnv } from "@/lib/config";
import { getFriendGraph } from "@/lib/db/friends";

export async function GET(request: NextRequest) {
  const env = getEnv();
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const graph = await getFriendGraph(auth.user.id, env.secondDegreeLimit);

  return NextResponse.json({
    user: auth.user,
    stats: graph.stats,
  });
}
