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

// ML Service configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Python ML service integration
 */
class MLServiceClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Categorize multiple texts using the Python ML service
   */
  async categorizeBatch(texts: string[], categories: Category[]): Promise<number[]> {
    try {
      console.log(`Calling Python ML service at ${this.baseUrl}/categorize/batch`);
      
      const response = await fetch(`${this.baseUrl}/categorize/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts,
          categories: categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            description: cat.description || ''
          }))
        }),
      });

      if (!response.ok) {
        throw new Error(`ML service responded with ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Extract category IDs from the response
      return result.results.map((item: any) => item.category_id);
    } catch (error) {
      console.error('ML service error:', error);
      
      // Fallback: assign all bookmarks to first category
      const fallbackCategoryId = categories.length > 0 ? categories[0].id : 1;
      console.log(`Using fallback categorization (category ID: ${fallbackCategoryId})`);
      
      return texts.map(() => fallbackCategoryId);
    }
  }

  /**
   * Check if the ML service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const health = await response.json();
        return health.status === 'healthy';
      }
      
      return false;
    } catch (error) {
      console.warn('ML service health check failed:', error);
      return false;
    }
  }
}

/**
 * BookmarkService handles business logic for bookmark processing
 */
export class BookmarkService {
  private static mlClient = new MLServiceClient(ML_SERVICE_URL);

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
   * Process Chrome extension bookmarks with Python ML categorization
   */
  static async processBookmarks(
    bookmarksData: ImportedBookmark[]
  ): Promise<{
    bookmarks: ProcessedBookmark[];
    categories: Category[];
  }> {
    // Get categories from Supabase
    const categories = await this.getCategories();

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

    console.log(`Processing ${validBookmarks.length} bookmarks with Python ML service...`);

    // Check ML service health
    const isHealthy = await this.mlClient.healthCheck();
    if (!isHealthy) {
      console.warn('ML service is not healthy, but continuing with fallback categorization');
    }

    // Extract texts for batch processing
    const texts = validBookmarks.map(bookmark => bookmark.text);

    // Batch categorize all texts using Python ML service
    const categoryIds = await this.mlClient.categorizeBatch(texts, categories);

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

    console.log(`Successfully processed ${processedBookmarks.length} bookmarks with Python ML service`);

    return {
      bookmarks: processedBookmarks,
      categories
    };
  }
} 