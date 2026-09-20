// Enums

export enum ContentType {
  Audio = 'audio',
  Text = 'text',
}

export enum NotificationType {
  Announcement = 'announcement',
  Event = 'event',
  Sermon = 'sermon',
}

export enum WordCategory {
  Name = 'name',
  Place = 'place',
  Book = 'book',
  Theme = 'theme',
}

// Interfaces

// Administrator account. The `members` table is retained but now stores only
// administrators (there is no public membership). `role` is always 'administrator'.
export interface Admin {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'administrator';
  failed_login_attempts: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Announcement {
  expires_on: string | null;
  id: number;
  title: string;
  body: string;
  attachment_path: string | null;
  attachment_type: string | null;
  published_at: Date;
  created_by: number;
  updated_at: Date;
}

export interface Sermon {
  id: number;
  title: string;
  speaker: string;
  sermon_date: Date;
  content_type: ContentType;
  text_content: string | null;
  audio_path: string | null;
  created_by: number;
  published_at: Date;
  updated_at: Date;
}

export interface Event {
  detail_page_status: 'off' | 'not_started' | 'draft' | 'published';
  detail_page_path: string | null;
  id: number;
  title: string;
  event_date: Date;
  location: string;
  description: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface FacebookPageSource {
  id: number;
  page_id: string;
  page_name: string;
  access_token: string;
  is_active: boolean;
  created_at: Date;
}

export interface FacebookPostCache {
  id: number;
  source_id: number;
  fb_post_id: string;
  content: string;
  posted_at: Date;
  fetched_at: Date;
}

export interface Notification {
  id: number;
  member_id: number;
  title: string;
  message: string;
  type: NotificationType;
  reference_id: number;
  is_read: boolean;
  created_at: Date;
}

export interface PushSubscription {
  id: number;
  member_id: number;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  created_at: Date;
}

export interface WordListEntry {
  id: number;
  word: string;
  category: WordCategory;
  is_custom: boolean;
  added_by: number | null;
  created_at: Date;
}

