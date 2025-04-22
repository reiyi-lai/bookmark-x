import fs from 'fs/promises';
import path from 'path';
import { InsertBookmark } from '@shared/schema';
import { MLCategorizer } from './ml-categorizer';

interface TwitterBookmarkInput {
  tweetId: string;
  authorName: string;
  authorUsername: string;
  authorProfileImage?: string;
  content: string;
  createdAt: string;
  url: string;
}

/**
 * Load Twitter bookmarks from a JSON file
 * @param filePath Path to the JSON file containing Twitter bookmarks
 * @param userId User ID to associate with the bookmarks
 * @returns Array of bookmark objects ready to be inserted into storage
 */
export async function loadBookmarksFromFile(filePath: string, userId: number): Promise<InsertBookmark[]> {
  try {
    // Read and parse the JSON file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const bookmarkData = JSON.parse(fileContent);
    
    // Validate and convert the data
    const bookmarks: InsertBookmark[] = [];
    
    // Determine if the data is an array or an object with data property
    const bookmarksArray = Array.isArray(bookmarkData) 
      ? bookmarkData 
      : (bookmarkData.data && Array.isArray(bookmarkData.data)) 
        ? bookmarkData.data 
        : null;
    
    if (!bookmarksArray) {
      throw new Error('Invalid bookmark data format');
    }
    
    // Process each bookmark
    for (const item of bookmarksArray) {
      if (!validateBookmark(item)) {
        console.warn('Skipping invalid bookmark:', item);
        continue;
      }
      
      // Create bookmark object
      const newBookmark: InsertBookmark = {
        tweetId: item.tweetId,
        userId,
        categoryId: 1, // Default category, can be updated later
        authorName: item.authorName,
        authorUsername: item.authorUsername,
        authorProfileImage: item.authorProfileImage || null,
        content: item.content,
        createdAt: new Date(item.createdAt),
        bookmarkedAt: new Date(),
        url: item.url
      };
      
      bookmarks.push(newBookmark);
    }
    
    return bookmarks;
  } catch (error) {
    console.error('Error loading bookmarks from file:', error);
    throw error;
  }
}

/**
 * Validate bookmark data has all required fields
 * @param bookmark Bookmark object to validate
 * @returns Boolean indicating if the bookmark is valid
 */
function validateBookmark(bookmark: any): bookmark is TwitterBookmarkInput {
  return (
    typeof bookmark === 'object' &&
    typeof bookmark.tweetId === 'string' &&
    typeof bookmark.authorName === 'string' &&
    typeof bookmark.authorUsername === 'string' &&
    typeof bookmark.content === 'string' &&
    typeof bookmark.createdAt === 'string' &&
    typeof bookmark.url === 'string'
  );
}

/**
 * Save bookmarks to JSON file
 * @param bookmarks Array of bookmarks to save
 * @param filePath Path to save the JSON file
 */
export function saveBookmarksToFile(bookmarks: any[], filePath: string): void {
  try {
    // Ensure the directory exists
    const dir = path.dirname(filePath);
    fs.mkdir(dir, { recursive: true });
    
    // Write the bookmarks to file
    fs.writeFile(filePath, JSON.stringify(bookmarks, null, 2), 'utf-8');
    console.log(`Saved ${bookmarks.length} bookmarks to ${filePath}`);
  } catch (error) {
    console.error('Error saving bookmarks to file:', error);
    throw error;
  }
}