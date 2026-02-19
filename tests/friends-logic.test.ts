import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalFriendPair,
  normalizeUsername,
  shouldAutoAcceptReciprocal,
} from "@/lib/friends/logic";

test("canonicalFriendPair sorts consistently", () => {
  const [a, b] = canonicalFriendPair("z-user", "a-user");
  assert.equal(a, "a-user");
  assert.equal(b, "z-user");
});

test("normalizeUsername strips @ and lowers case", () => {
  assert.equal(normalizeUsername("@Alice"), "alice");
  assert.equal(normalizeUsername("  BOB  "), "bob");
});

test("shouldAutoAcceptReciprocal respects existing friendship", () => {
  assert.equal(
    shouldAutoAcceptReciprocal({ hasReciprocalPending: true, alreadyFriends: false }),
    true
  );
  assert.equal(
    shouldAutoAcceptReciprocal({ hasReciprocalPending: true, alreadyFriends: true }),
    false
  );
  assert.equal(
    shouldAutoAcceptReciprocal({ hasReciprocalPending: false, alreadyFriends: false }),
    false
  );
});
