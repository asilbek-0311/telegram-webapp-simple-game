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

export type ApiError = {
  error: string;
};
