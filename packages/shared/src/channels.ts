export type ChannelType = 'text' | 'word_of_day' | 'memes';

export const CHANNEL_TYPES: ChannelType[] = ['text', 'word_of_day', 'memes'];

export interface CreateChannelRequestDto {
  name: string;
  type: ChannelType;
  position: number;
}

export interface UpdateChannelRequestDto {
  name?: string;
  type?: ChannelType;
  position?: number;
}

export interface ChannelDto {
  id: string;
  groupId: string;
  name: string;
  type: ChannelType;
  position: number;
  createdAt: string;
}
