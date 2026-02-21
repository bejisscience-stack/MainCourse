import { User } from './member';

export interface MessageAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  fileType: 'image' | 'video' | 'gif';
  fileSize: number;
  mimeType: string;
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
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // User IDs who reacted
}

