import type { User } from "./member";

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string;
  };
}

export interface Friend {
  id: string;
  username: string;
  avatarUrl: string;
  role?: string;
}

export interface BlockedUser {
  id: string;
  username: string;
  avatarUrl: string;
  blockedAt: string;
}

export interface DMChannel {
  id: string;
  otherUser: {
    id: string;
    username: string;
    avatarUrl: string;
  };
  lastMessage: {
    content: string | null;
    timestamp: number;
    senderId: string;
  } | null;
  unreadCount: number;
  createdAt: string;
}

export interface DMMessage {
  id: string;
  user: User;
  content: string;
  timestamp: number;
  edited?: boolean;
  reactions?: { emoji: string; count: number; users: string[] }[];
  replyTo?: string;
  replyPreview?: { id: string; username: string; content: string };
  attachments?: {
    id: string;
    fileUrl: string;
    fileName: string;
    fileType: "image" | "video" | "gif";
    fileSize: number;
    mimeType: string;
  }[];
}
