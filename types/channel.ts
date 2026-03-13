export type ChannelType = 'text' | 'voice' | 'lectures';

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  description?: string;
  courseId?: string;
}



