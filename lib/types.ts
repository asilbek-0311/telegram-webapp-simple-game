export type UserPublic = {
  id: string;
  telegramId: string;
  username: string | null;
  displayName: string | null;
  facehashSeed: string;
};

export type FriendRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "rejected" | "canceled";
  createdAt: string;
  updatedAt: string;
};

export type Friendship = {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
};

export type GraphNode = {
  id: string;
  username: string | null;
  displayName: string | null;
  facehashSeed: string;
  depth: 0 | 1 | 2;
};

export type GraphEdge = {
  source: string;
  target: string;
};

export type FriendGraphResponse = {
  me: UserPublic;
  directFriends: UserPublic[];
  secondDegree: UserPublic[];
  edges: GraphEdge[];
  pendingIncoming: UserPublic[];
  pendingOutgoing: UserPublic[];
  stats: {
    connected: number;
    pendingIncoming: number;
  };
};

export type InviteStatus =
  | "can_accept"
  | "already_connected"
  | "pending_incoming"
  | "pending_outgoing"
  | "self";

export type InviteLinkResponse = {
  inviteToken: string;
  startAppLink: string;
  webFallbackLink: string;
  expiresAt: string;
};

export type InvitePreviewResponse = {
  inviter: UserPublic;
  status: InviteStatus;
  expiresAt: string;
};

export type InviteAcceptResponse = {
  status: "accepted" | "already_connected";
  friendshipId: string | null;
};

export type ApiError = {
  error: string;
};
