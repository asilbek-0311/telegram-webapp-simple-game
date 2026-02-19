import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-user";
import { getEnv } from "@/lib/config";
import { getFriendGraph, listIncomingPendingRequests } from "@/lib/db/friends";

export async function GET(request: NextRequest) {
  const env = getEnv();
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [graph, incoming] = await Promise.all([
      getFriendGraph(auth.user.id, env.secondDegreeLimit),
      listIncomingPendingRequests(auth.user.id),
    ]);

    return NextResponse.json({
      ...graph,
      pendingIncomingRequests: incoming,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load graph" }, { status: 500 });
  }
}
