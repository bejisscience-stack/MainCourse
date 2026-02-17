import type { Message } from './message';

export interface DMConversation {
  id: string;
  friendId: string;
  friendUsername: string;
  friendAvatarUrl: string;
  lastMessageAt: string | null;
  createdAt: string;
}

/** DM messages reuse the existing Message type from message.ts */
export type DMMessage = Message;
