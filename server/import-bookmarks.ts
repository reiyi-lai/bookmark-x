import { TwitterBookmark } from './twitter-api';
import { MLCategorizer, createCategorizer } from './ml-categorizer';
import { storage } from './storage';
import { InsertBookmark } from '@shared/schema';

// Interface for the imported bookmark JSON format
export interface ImportedBookmark {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  author?: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string | null;
  };
}

// Process imported bookmarks and save them using the ML categorizer
export async function processImportedBookmarks(
  bookmarksData: ImportedBookmark[],
  userId: number
): Promise<{
  total: number;
  imported: number;
  categorized: Record<number, number>;
}> {
  // Get all categories for the ML categorizer
  const categories = await storage.getCategories();
  
  // Initialize the ML categorizer
  const categorizer = createCategorizer(categories);
  
  // Statistics for the import process
  const stats = {
    total: bookmarksData.length,
    imported: 0,
    categorized: {} as Record<number, number>
  };
  
  // Initialize category counts
  categories.forEach(category => {
    stats.categorized[category.id] = 0;
  });

  // Process each bookmark
  for (const bookmark of bookmarksData) {
    try {
      // Ensure bookmark has essential data (even if minimal)
      if (!bookmark.id || !bookmark.text) {
        console.log("Skipping bookmark without id or text:", bookmark);
        continue;
      }
      
      // Check if bookmark already exists by ID
      const existingBookmark = await storage.getBookmarkByTweetId(bookmark.id);
      if (existingBookmark) {
        continue; // Skip duplicates
      }
      
      // Use ML to categorize the bookmark text
      const categoryId = await categorizer.categorize(bookmark.text);
      
      // Increment the category count for statistics
      stats.categorized[categoryId] = (stats.categorized[categoryId] || 0) + 1;
      
      // Get author information with fallbacks
      const authorName = bookmark.author?.name || 'Imported Tweet';
      const authorUsername = bookmark.author?.username || 'imported';
      const authorProfileImage = bookmark.author?.profile_image_url || null;
      
      // Construct the tweet URL
      const tweetId = bookmark.id;
      const tweetUrl = authorUsername === 'imported' 
        ? `https://twitter.com/status/${tweetId}` 
        : `https://twitter.com/${authorUsername}/status/${tweetId}`;
      
      // Convert to our internal format
      const twitterBookmark: TwitterBookmark = {
        tweetId,
        authorName,
        authorUsername,
        authorProfileImage: authorProfileImage as string | null | undefined, // Cast to fix type issue
        content: bookmark.text,
        createdAt: new Date(bookmark.created_at || new Date()),
        url: tweetUrl,
      };
      
      // Create the bookmark data for storage
      const bookmarkData: InsertBookmark = {
        tweetId: twitterBookmark.tweetId,
        userId,
        categoryId,
        authorName: twitterBookmark.authorName,
        authorUsername: twitterBookmark.authorUsername,
        authorProfileImage: twitterBookmark.authorProfileImage || null,
        content: twitterBookmark.content,
        createdAt: twitterBookmark.createdAt,
        bookmarkedAt: new Date(),
        url: twitterBookmark.url,
      };
      
      // Save to storage
      await storage.createBookmark(bookmarkData);
      stats.imported++;
    } catch (error) {
      console.error(`Error processing bookmark ${bookmark.id}:`, error);
      // Continue with the next bookmark even if one fails
    }
  }
  
  return stats;
}

// Normalize Twitter API response format to our import format
export function normalizeTwitterResponse(
  data: any
): ImportedBookmark[] {
  try {
    console.log("Data format received:", typeof data, Array.isArray(data) ? "array" : "not array");
    
    // Handle string input (sometimes JSON is passed as a string)
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.error("Failed to parse string as JSON:", e);
      }
    }
    
    // If it's a single tweet/post object, wrap it in an array
    if (!Array.isArray(data) && typeof data === 'object' && data !== null) {
      if (data.text || data.content || data.tweet || data.message) {
        data = [data];
      } else if (data.data && Array.isArray(data.data)) {
        // Twitter API format with data array
        data = data.data;
      }
    }
    
    // If we don't have an array at this point, return empty array
    if (!Array.isArray(data)) {
      console.error("Could not convert data to array format");
      return [];
    }
    
    // Check if this is an array of strings (simple format)
    const isArrayOfStrings = data.length > 0 && typeof data[0] === 'string';
    
    if (isArrayOfStrings) {
      // Convert simple string array to our expected format
      return data.map((text: string, index: number) => {
        return {
          id: `imported-${index}`,
          text: text,
          author_id: 'imported-user',
          created_at: new Date().toISOString(),
          author: {
            id: 'imported-user',
            name: 'Imported Tweet',
            username: 'imported',
            profile_image_url: null
          }
        };
      });
    }
    
    // Otherwise, handle complex objects
    return data.map((item: any, index: number) => {
      // Extract core fields with fallbacks for different formats
      const id = item.id || item.tweet_id || item.tweetId || `imported-${index}`;
      const text = item.text || item.content || item.tweet || item.message || '';
      const authorId = item.author_id || item.authorId || 'unknown';
      const createdAt = item.created_at || item.createdAt || new Date().toISOString();
      
      // Extract author information
      let author;
      if (item.author) {
        author = item.author;
      } else if (item.user) { 
        author = item.user;
      } else {
        // Create generic author if none exists
        author = {
          id: authorId,
          name: item.authorName || item.author_name || 'Unknown Author',
          username: item.authorUsername || item.author_username || 'unknown',
          profile_image_url: item.authorProfileImage || item.author_profile_image || null
        };
      }
      
      // Return normalized format
      return {
        id,
        text,
        author_id: authorId,
        created_at: createdAt,
        author
      };
    });
  } catch (error) {
    console.error('Error normalizing Twitter response:', error);
    throw error;
  }
}