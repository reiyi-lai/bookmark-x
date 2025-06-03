import { createCategorizer } from './ml-categorizer';
import { createClient } from '@supabase/supabase-js';
import type { Category } from '@shared/schema';

interface ImportedBookmark {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  media_attachments?: any[] | null;
  url: string;
  author?: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string | null;
  };
}

export interface ProcessedBookmark extends ImportedBookmark {
  categoryId: number;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * BookmarkService handles business logic for bookmark processing
 */
export class BookmarkService {
  /**
   * Get all categories from database
   */
  static async getCategories(): Promise<Category[]> {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*');
      
    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }
    
    return categories || [];
  }

  /**
   * Process Chrome extension bookmarks with ML categorization
   */
  static async processBookmarks(
    bookmarksData: ImportedBookmark[]
  ): Promise<{
    bookmarks: ProcessedBookmark[];
    categories: Category[];
  }> {
    // Get categories from Supabase
    const categories = await this.getCategories();

    // Initialize ML categorizer
    const categorizer = createCategorizer(categories);

    // Process each bookmark with categorization
    const processedBookmarks: ProcessedBookmark[] = [];
    
    for (const bookmark of bookmarksData) {
      try {
        // Ensure bookmark has essential data
        if (!bookmark.id || !bookmark.text) {
          continue;
        }

        const categoryId = await categorizer.categorize(bookmark.text);
        
        processedBookmarks.push({
          ...bookmark,
          categoryId
        });
      } catch (error) {
        console.error(`Error categorizing bookmark ${bookmark.id}:`, error);
      }
    }

    return {
      bookmarks: processedBookmarks,
      categories
    };
  }
} 