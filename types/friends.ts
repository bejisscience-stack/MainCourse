import type { User } from "./member";

export type { User };

export type FriendCandidateStatus =
  | "none"
  | "pending_out"
  | "pending_in"
  | "friends";

export interface FriendCandidate {
  id: string;
  username: string;
  avatarUrl: string;
  role?: string;
  status: FriendCandidateStatus;
}

export interface Friend {
  friendshipId: string;
  user: User;
  since: number;
}

export type FriendRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "canceled";

export interface FriendRequest {
  id: string;
  status: FriendRequestStatus;
  createdAt: number;
  user: User;
}
