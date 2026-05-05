import type { User } from "./member";

export interface DmLastMessagePreview {
  id: string;
  content: string | null;
  userId: string;
  createdAt: number;
  hasAttachments: boolean;
}

export interface DirectConversation {
  id: string;
  otherUser: User | null;
  lastMessageAt: number | null;
  unreadCount: number;
  lastReadAt: number | null;
  lastMessage: DmLastMessagePreview | null;
}

export interface DmTypingUser {
  id: string;
  username: string;
  expiresAt: number;
}
