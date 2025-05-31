// Run npm run supabase:types first
import { Database } from './supabase-types';

// DATABASE TYPES (generated from Supabase)
export type User = Database['public']['Tables']['users']['Row'];
type DatabaseCategory = Database['public']['Tables']['categories']['Row'];
type DatabaseBookmark = Database['public']['Tables']['bookmarks']['Row'];

export interface MediaAttachment {
  type: 'photo' | 'video' | 'gif';
  url: string;
  preview_url?: string;
}
export interface Bookmark extends Omit<DatabaseBookmark, 'media_attachments'> {
  media_attachments?: MediaAttachment[] | null;
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