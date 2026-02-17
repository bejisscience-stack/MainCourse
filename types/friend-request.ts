export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  senderUsername?: string;
  senderAvatarUrl?: string;
  receiverUsername?: string;
  receiverAvatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Friendship {
  id: string;
  friendId: string;
  friendUsername: string;
  friendAvatarUrl: string;
  createdAt: string;
}
