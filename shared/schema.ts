// Run npm run supabase:types first
import { Database } from './supabase-types';

// DATABASE TYPES (generated from Supabase)
type DatabaseUser = Database['public']['Tables']['users']['Row'];
type DatabaseCategory = Database['public']['Tables']['categories']['Row'];
type DatabaseBookmark = Database['public']['Tables']['bookmarks']['Row'];

export interface ClientUser {
  id: number;
  username: string;
  displayName: string;
  twitterUserId: string;
  twitterAccessToken: string | null;
  twitterRefreshToken: string | null;
  twitterTokenExpiry: Date | null;
}

// Media attachment types for the tweet
export interface MediaAttachment {
  type: 'photo' | 'video' | 'gif' | 'detected';
  url?: string;
  preview_url?: string;
}

// Raw tweet data collected by the extension
export interface CollectedTweet {
  tweetId: string;
  tweetUrl: string;
  authorName: string;
  handle: string;
  tweetText: string;
  time: string;
  profilePicture: string;
  media: 'has_media' | null;
}

// Intermediate format for importing tweets to server
export interface ImportedBookmark {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  media_attachments?: MediaAttachment[] | null;
  url: string;
  author: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string | null;
  };
}

// Bookmark with media attachments properly typed
export interface Bookmark extends Omit<DatabaseBookmark, 'media_attachments'> {
  media_attachments?: MediaAttachment[] | null;
}

// Client-side bookmark to display on bookmark cards
export interface ClientBookmark {
  id: string;
  content: string;
  url: string;
  userId: string;
  categoryId: number;
  tweetId: string;
  authorName: string;
  authorUsername: string;
  authorProfileImage: string | null;
  createdAt: Date;
  bookmarkedAt: Date;
}

// Database types for API operations
export type InsertUser = Database['public']['Tables']['users']['Insert'];
export type InsertCategory = Database['public']['Tables']['categories']['Insert'];
export type InsertBookmark = Database['public']['Tables']['bookmarks']['Insert'];

// Frontend-only type with additional UI metadata
export interface Category extends DatabaseCategory {
  icon: string;
  order: number;
}

export const CATEGORY_METADATA: Record<string, { icon: string; order: number }> = {
  "Content Ideas": { icon: "lightbulb", order: 1 },
  "Automation Tools": { icon: "build", order: 2 },
  "Interesting Reads": { icon: "menu_book", order: 3 },
  "Career Tips": { icon: "work", order: 4 },
  "Job Opportunities": { icon: "person_search", order: 5 },
  "Good Quotes": { icon: "format_quote", order: 6 },
  "Knowledge/Trivia": { icon: "school", order: 7 },
  "Uncategorized": { icon: "help_outline", order: 8 }
};

export const enrichCategoryWithMetadata = (dbCategory: DatabaseCategory): Category => ({
  ...dbCategory,
  icon: CATEGORY_METADATA[dbCategory.name]?.icon || "help_outline",
  order: CATEGORY_METADATA[dbCategory.name]?.order || 999
});