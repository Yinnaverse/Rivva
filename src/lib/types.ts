export type DbRoom = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  host_id: string;
  is_private: boolean;
  status: 'waiting' | 'playing';
  now_playing: string | null;
  video_id: string | null;
  capacity: number;
  sync_controls: boolean;
  allow_reactions: boolean;
  chat_enabled: boolean;
  created_at: string;
};

export type RoomListItem = DbRoom & {
  host: { display_name: string } | null;
  room_members: { user_id: string; profiles: { display_name: string; avatar_url: string | null } | null }[];
};

export type Member = { user_id: string; name: string; avatar?: string | null };

export type ChatMessage = {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
  name: string;
};

export type Video = {
  id: string;
  owner_id: string;
  title: string;
  source_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  is_shared: boolean;
  created_at: string;
};

export type SubtitleRow = { id: string; video_id: string; lang: string; label: string; path: string };

export type Playback = {
  room_id: string;
  playing: boolean;
  held: boolean;
  position: number;
  updated_at: string;
  updated_by: string | null;
};
