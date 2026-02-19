export function normalizeUsername(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

export function canonicalFriendPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function shouldAutoAcceptReciprocal(options: {
  hasReciprocalPending: boolean;
  alreadyFriends: boolean;
}): boolean {
  return options.hasReciprocalPending && !options.alreadyFriends;
}
