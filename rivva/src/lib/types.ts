export type DbRoom = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  host_id: string;
  is_private: boolean;
  status: 'waiting' | 'playing';
  now_playing: string | null;
  capacity: number;
  sync_controls: boolean;
  allow_reactions: boolean;
  chat_enabled: boolean;
  created_at: string;
};

export type RoomListItem = DbRoom & {
  host: { display_name: string } | null;
  room_members: { user_id: string; profiles: { display_name: string } | null }[];
};

export type Member = { user_id: string; name: string };

export type ChatMessage = {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
  name: string;
};
