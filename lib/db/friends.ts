import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canonicalFriendPair, normalizeUsername } from "@/lib/friends/logic";
import {
  FriendGraphResponse,
  InviteAcceptResponse,
  InvitePreviewResponse,
  InviteStatus,
  UserPublic,
} from "@/lib/types";

type UserRow = {
  id: string;
  telegram_id: string;
  username: string | null;
  display_name: string | null;
  facehash_seed: string;
};

type FriendshipRow = {
  id: string;
  user_a_id: string;
  user_b_id: string;
};

type FriendRequestRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "rejected" | "canceled";
};

function toUserPublic(row: UserRow): UserPublic {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username,
    displayName: row.display_name,
    facehashSeed: row.facehash_seed,
  };
}

async function getUserById(userId: string): Promise<UserPublic | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, telegram_id, username, display_name, facehash_seed")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toUserPublic(data as UserRow);
}

async function getPendingRequest(options: {
  fromUserId: string;
  toUserId: string;
}): Promise<{ id: string } | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("friend_requests")
    .select("id")
    .eq("from_user_id", options.fromUserId)
    .eq("to_user_id", options.toUserId)
    .eq("status", "pending")
    .maybeSingle();

  return (data as { id: string } | null) ?? null;
}

async function getExistingFriendship(options: {
  leftUserId: string;
  rightUserId: string;
}): Promise<{ id: string } | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const [userA, userB] = canonicalFriendPair(options.leftUserId, options.rightUserId);
  const { data } = await supabaseAdmin
    .from("friendships")
    .select("id")
    .eq("user_a_id", userA)
    .eq("user_b_id", userB)
    .maybeSingle();

  return (data as { id: string } | null) ?? null;
}

async function upsertFriendship(options: {
  leftUserId: string;
  rightUserId: string;
}): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin();
  const [userA, userB] = canonicalFriendPair(options.leftUserId, options.rightUserId);

  const { data, error } = await supabaseAdmin
    .from("friendships")
    .upsert(
      {
        user_a_id: userA,
        user_b_id: userB,
      },
      {
        onConflict: "user_a_id,user_b_id",
      }
    )
    .select("id")
    .single();

  const friendship = data as { id: string } | null;
  if (error || !friendship?.id) {
    throw new Error("Unable to create friendship");
  }

  return friendship.id;
}

export async function listDirectFriendIds(userId: string): Promise<Set<string>> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("friendships")
    .select("user_a_id, user_b_id")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  if (error || !data) {
    return new Set();
  }

  const ids = new Set<string>();
  for (const row of data as Pick<FriendshipRow, "user_a_id" | "user_b_id">[]) {
    ids.add(row.user_a_id === userId ? row.user_b_id : row.user_a_id);
  }
  return ids;
}

export async function searchUsers(options: {
  viewerId: string;
  query: string;
}): Promise<UserPublic[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const normalized = normalizeUsername(options.query);
  if (!normalized) {
    return [];
  }

  const friendIds = await listDirectFriendIds(options.viewerId);
  const excludedIds = [options.viewerId, ...Array.from(friendIds)];

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, telegram_id, username, display_name, facehash_seed")
    .ilike("username", `${normalized}%`)
    .limit(10);

  if (error || !data) {
    return [];
  }

  return (data as UserRow[])
    .filter((row) => !excludedIds.includes(row.id))
    .map(toUserPublic);
}

export async function sendFriendRequest(options: {
  fromUserId: string;
  targetUsername: string;
}): Promise<{ status: string; friendshipId: string | null }> {
  const supabaseAdmin = getSupabaseAdmin();
  const username = normalizeUsername(options.targetUsername);
  if (!username) {
    throw new Error("Username is empty");
  }

  const { data: target, error: targetErr } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (targetErr) {
    throw new Error("Unable to search target user");
  }

  const targetUser = target as { id: string } | null;

  if (!targetUser?.id) {
    throw new Error("Target username not found");
  }

  if (targetUser.id === options.fromUserId) {
    throw new Error("Cannot connect to yourself");
  }

  const existing = await getExistingFriendship({
    leftUserId: options.fromUserId,
    rightUserId: targetUser.id,
  });

  if (existing?.id) {
    return { status: "already_connected", friendshipId: existing.id };
  }

  const pendingSame = await getPendingRequest({
    fromUserId: options.fromUserId,
    toUserId: targetUser.id,
  });

  if (pendingSame?.id) {
    return { status: "pending", friendshipId: null };
  }

  const reciprocal = await getPendingRequest({
    fromUserId: targetUser.id,
    toUserId: options.fromUserId,
  });

  if (reciprocal?.id) {
    const { error: updateReciprocalError } = await supabaseAdmin
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", reciprocal.id);

    if (updateReciprocalError) {
      throw new Error("Unable to accept reciprocal request");
    }

    const { error: insertAcceptedError } = await supabaseAdmin
      .from("friend_requests")
      .insert({
        from_user_id: options.fromUserId,
        to_user_id: targetUser.id,
        status: "accepted",
      });

    if (insertAcceptedError) {
      throw new Error("Unable to store accepted request");
    }

    const friendshipId = await upsertFriendship({
      leftUserId: options.fromUserId,
      rightUserId: targetUser.id,
    });

    return { status: "accepted", friendshipId };
  }

  const { error: insertPendingError } = await supabaseAdmin.from("friend_requests").insert({
    from_user_id: options.fromUserId,
    to_user_id: targetUser.id,
    status: "pending",
  });

  if (insertPendingError) {
    throw new Error("Unable to create friend request");
  }

  return { status: "pending", friendshipId: null };
}

export async function acceptFriendRequest(options: {
  requestId: string;
  accepterUserId: string;
}): Promise<{ status: "accepted"; friendshipId: string }> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: request, error: requestError } = await supabaseAdmin
    .from("friend_requests")
    .select("id, from_user_id, to_user_id, status")
    .eq("id", options.requestId)
    .maybeSingle();

  if (requestError || !request) {
    throw new Error("Request not found");
  }

  const friendRequest = request as Pick<
    FriendRequestRow,
    "id" | "from_user_id" | "to_user_id" | "status"
  >;

  if (friendRequest.to_user_id !== options.accepterUserId) {
    throw new Error("You cannot accept this request");
  }

  if (friendRequest.status !== "pending") {
    throw new Error("Request is not pending");
  }

  const { error: updateError } = await supabaseAdmin
    .from("friend_requests")
    .update({ status: "accepted" })
    .eq("id", friendRequest.id);

  if (updateError) {
    throw new Error("Unable to accept request");
  }

  const friendshipId = await upsertFriendship({
    leftUserId: friendRequest.from_user_id,
    rightUserId: friendRequest.to_user_id,
  });

  return { status: "accepted", friendshipId };
}

export async function getInvitePreview(options: {
  viewerUserId: string;
  inviterUserId: string;
  expiresAt: string;
}): Promise<InvitePreviewResponse> {
  const inviter = await getUserById(options.inviterUserId);
  if (!inviter) {
    throw new Error("Inviter not found");
  }

  let status: InviteStatus = "can_accept";

  if (options.viewerUserId === options.inviterUserId) {
    status = "self";
  } else {
    const existing = await getExistingFriendship({
      leftUserId: options.viewerUserId,
      rightUserId: options.inviterUserId,
    });

    if (existing?.id) {
      status = "already_connected";
    } else {
      const incoming = await getPendingRequest({
        fromUserId: options.inviterUserId,
        toUserId: options.viewerUserId,
      });

      if (incoming?.id) {
        status = "pending_incoming";
      } else {
        const outgoing = await getPendingRequest({
          fromUserId: options.viewerUserId,
          toUserId: options.inviterUserId,
        });

        status = outgoing?.id ? "pending_outgoing" : "can_accept";
      }
    }
  }

  return {
    inviter,
    status,
    expiresAt: options.expiresAt,
  };
}

export async function acceptInviteTokenForUser(options: {
  viewerUserId: string;
  inviterUserId: string;
}): Promise<InviteAcceptResponse> {
  const supabaseAdmin = getSupabaseAdmin();

  if (options.viewerUserId === options.inviterUserId) {
    throw new Error("This is your invite link");
  }

  const existing = await getExistingFriendship({
    leftUserId: options.viewerUserId,
    rightUserId: options.inviterUserId,
  });

  if (existing?.id) {
    return { status: "already_connected", friendshipId: existing.id };
  }

  const incoming = await getPendingRequest({
    fromUserId: options.inviterUserId,
    toUserId: options.viewerUserId,
  });

  if (incoming?.id) {
    const accepted = await acceptFriendRequest({
      requestId: incoming.id,
      accepterUserId: options.viewerUserId,
    });

    return { status: accepted.status, friendshipId: accepted.friendshipId };
  }

  const outgoing = await getPendingRequest({
    fromUserId: options.viewerUserId,
    toUserId: options.inviterUserId,
  });

  if (outgoing?.id) {
    const { error: updateOutgoingError } = await supabaseAdmin
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", outgoing.id);

    if (updateOutgoingError) {
      throw new Error("Unable to confirm pending request");
    }

    const { error: insertMirrorAccepted } = await supabaseAdmin
      .from("friend_requests")
      .insert({
        from_user_id: options.inviterUserId,
        to_user_id: options.viewerUserId,
        status: "accepted",
      });

    if (insertMirrorAccepted) {
      throw new Error("Unable to store accepted invite request");
    }

    const friendshipId = await upsertFriendship({
      leftUserId: options.viewerUserId,
      rightUserId: options.inviterUserId,
    });

    return { status: "accepted", friendshipId };
  }

  const { error: insertAcceptedError } = await supabaseAdmin
    .from("friend_requests")
    .insert({
      from_user_id: options.inviterUserId,
      to_user_id: options.viewerUserId,
      status: "accepted",
    });

  if (insertAcceptedError) {
    throw new Error("Unable to create accepted invite request");
  }

  const friendshipId = await upsertFriendship({
    leftUserId: options.viewerUserId,
    rightUserId: options.inviterUserId,
  });

  return { status: "accepted", friendshipId };
}

export async function getFriendGraph(
  userId: string,
  secondDegreeLimit: number
): Promise<FriendGraphResponse> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: meData, error: meErr } = await supabaseAdmin
    .from("users")
    .select("id, telegram_id, username, display_name, facehash_seed")
    .eq("id", userId)
    .single();

  if (meErr || !meData) {
    throw new Error("User not found");
  }

  const me = toUserPublic(meData as UserRow);

  const { data: directEdgeRows } = await supabaseAdmin
    .from("friendships")
    .select("user_a_id, user_b_id")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  const directIds = new Set<string>();
  for (const row of (directEdgeRows ?? []) as Pick<
    FriendshipRow,
    "user_a_id" | "user_b_id"
  >[]) {
    directIds.add(row.user_a_id === userId ? row.user_b_id : row.user_a_id);
  }

  const directFriends = directIds.size
    ? (
        await supabaseAdmin
          .from("users")
          .select("id, telegram_id, username, display_name, facehash_seed")
          .in("id", Array.from(directIds))
      ).data?.map((row) => toUserPublic(row as UserRow)) ?? []
    : [];

  const edges: Array<{ source: string; target: string }> = directFriends.map((friend) => ({
    source: userId,
    target: friend.id,
  }));

  let secondDegree: UserPublic[] = [];

  if (directIds.size) {
    const directIdArray = Array.from(directIds);
    const inClause = `(${directIdArray.join(",")})`;
    const { data: secondEdges } = await supabaseAdmin
      .from("friendships")
      .select("user_a_id, user_b_id")
      .or(`user_a_id.in.${inClause},user_b_id.in.${inClause}`);

    const secondIds = new Set<string>();
    for (const edge of (secondEdges ?? []) as Pick<
      FriendshipRow,
      "user_a_id" | "user_b_id"
    >[]) {
      const directCandidate = directIds.has(edge.user_a_id)
        ? edge.user_a_id
        : directIds.has(edge.user_b_id)
          ? edge.user_b_id
          : null;

      if (!directCandidate) {
        continue;
      }

      const other = directCandidate === edge.user_a_id ? edge.user_b_id : edge.user_a_id;
      if (other === userId || directIds.has(other)) {
        continue;
      }
      if (secondIds.size >= secondDegreeLimit) {
        break;
      }
      secondIds.add(other);
      edges.push({ source: directCandidate, target: other });
    }

    if (secondIds.size) {
      const { data: secondUsers } = await supabaseAdmin
        .from("users")
        .select("id, telegram_id, username, display_name, facehash_seed")
        .in("id", Array.from(secondIds));

      secondDegree = (secondUsers ?? []).map((row) => toUserPublic(row as UserRow));
    }
  }

  const { data: incomingRows } = await supabaseAdmin
    .from("friend_requests")
    .select("from_user_id")
    .eq("to_user_id", userId)
    .eq("status", "pending");

  const incomingIds = Array.from(
    new Set((incomingRows ?? []).map((row) => row.from_user_id as string))
  );

  const pendingIncoming = incomingIds.length
    ? (
        await supabaseAdmin
          .from("users")
          .select("id, telegram_id, username, display_name, facehash_seed")
          .in("id", incomingIds)
      ).data?.map((row) => toUserPublic(row as UserRow)) ?? []
    : [];

  const { data: outgoingRows } = await supabaseAdmin
    .from("friend_requests")
    .select("to_user_id")
    .eq("from_user_id", userId)
    .eq("status", "pending");

  const outgoingIds = Array.from(
    new Set((outgoingRows ?? []).map((row) => row.to_user_id as string))
  );

  const pendingOutgoing = outgoingIds.length
    ? (
        await supabaseAdmin
          .from("users")
          .select("id, telegram_id, username, display_name, facehash_seed")
          .in("id", outgoingIds)
      ).data?.map((row) => toUserPublic(row as UserRow)) ?? []
    : [];

  return {
    me,
    directFriends,
    secondDegree,
    edges,
    pendingIncoming,
    pendingOutgoing,
    stats: {
      connected: directFriends.length,
      pendingIncoming: pendingIncoming.length,
    },
  };
}

export async function listIncomingPendingRequests(userId: string): Promise<
  Array<{
    id: string;
    from: UserPublic;
  }>
> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: rows } = await supabaseAdmin
    .from("friend_requests")
    .select("id, from_user_id")
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const requestRows = (rows ?? []) as Array<{ id: string; from_user_id: string }>;
  if (!requestRows.length) {
    return [];
  }

  const userIds = Array.from(new Set(requestRows.map((row) => row.from_user_id)));
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, telegram_id, username, display_name, facehash_seed")
    .in("id", userIds);

  const map = new Map((users ?? []).map((row) => [row.id as string, toUserPublic(row as UserRow)]));

  return requestRows
    .map((row) => {
      const from = map.get(row.from_user_id);
      if (!from) {
        return null;
      }
      return { id: row.id, from };
    })
    .filter((item): item is { id: string; from: UserPublic } => item !== null);
}
