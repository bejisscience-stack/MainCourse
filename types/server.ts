import type { Message } from './message';

export interface Server {
  id: string;
  name: string;
  icon: string;
  channels: ChannelCategory[];
}

export interface ChannelCategory {
  id: string;
  name: string;
  channels: Channel[];
}

export interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'lectures';
  description?: string;
  messages?: Message[];
  courseId?: string; // Link to course if created from course
  categoryName?: string;
  displayOrder?: number;
  videos?: Video[];
}

export interface Video {
  id: string;
  channelId: string;
  courseId: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number; // Duration in seconds
  displayOrder: number;
  isPublished: boolean;
  progress?: VideoProgress;
}

export interface VideoProgress {
  id: string;
  userId: string;
  videoId: string;
  courseId: string;
  progressSeconds: number;
  durationSeconds?: number;
  isCompleted: boolean;
  completedAt?: string;
}
