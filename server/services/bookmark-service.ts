import { createCategorizer } from './ml-categorizer';
import { createClient } from '@supabase/supabase-js';
import type { Category, ImportedBookmark } from '@shared/schema';

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

    // Filter out bookmarks without essential data
    const validBookmarks = bookmarksData.filter(bookmark => 
      bookmark.id && bookmark.text
    );

    if (validBookmarks.length === 0) {
      return {
        bookmarks: [],
        categories
      };
    }

    console.log(`Processing ${validBookmarks.length} bookmarks with batch categorization...`);

    // Extract texts for batch processing
    const texts = validBookmarks.map(bookmark => bookmark.text);

    // Batch categorize all texts at once
    const categoryIds = await categorizer.categorizeBatch(texts);

    // Combine bookmarks with their categories
    const processedBookmarks: ProcessedBookmark[] = [];
    
    for (let i = 0; i < validBookmarks.length; i++) {
      const bookmark = validBookmarks[i];
      const categoryId = categoryIds[i];

      processedBookmarks.push({
        ...bookmark,
        categoryId
      });
    }

    console.log(`Successfully processed ${processedBookmarks.length} bookmarks`);

    return {
      bookmarks: processedBookmarks,
      categories
    };
  }
} 