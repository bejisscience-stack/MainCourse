import { User } from "./member";

export interface MessageAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  fileType: "image" | "video" | "gif";
  fileSize: number;
  mimeType: string;
  // When set, the attachment lives in a private bucket and the renderer must
  // resolve a signed URL via the appropriate API rather than using fileUrl.
  filePath?: string;
}

export interface ReplyPreview {
  id: string;
  username: string;
  content: string;
}

export interface Message {
  id: string;
  user: User;
  content: string;
  timestamp: number;
  edited?: boolean;
  reactions?: Reaction[];
  replyTo?: string; // ID of message being replied to
  replyPreview?: ReplyPreview; // Preview of the message being replied to
  attachments?: MessageAttachment[]; // Media attachments
  pinned?: boolean;
  pinnedAt?: number;
  pinnedBy?: {
    id: string;
    username: string;
  };
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // User IDs who reacted
}

export interface PinnedMessage {
  id: string;
  messageId: string;
  channelId: string;
  courseId: string;
  pinnedAt: number;
  pinnedBy: {
    id: string;
    username: string;
  };
  message: Message;
  preview: string;
}
