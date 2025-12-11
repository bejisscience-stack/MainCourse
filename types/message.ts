import { User } from './member';

export interface Message {
  id: string;
  user: User;
  content: string;
  timestamp: number;
  edited?: boolean;
  reactions?: Reaction[];
  replyTo?: string; // ID of message being replied to
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // User IDs who reacted
}

