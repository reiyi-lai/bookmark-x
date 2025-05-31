import { z } from 'zod';

// Keep the TwitterBookmark interface for extension use
export interface TwitterBookmark {
  tweetId: string;
  authorName: string;
  authorUsername: string;
  authorProfileImage?: string | null;
  content: string;
  createdAt: Date;
  url: string;
}

// Helper method to categorize bookmarks based on content (moved from TwitterApiClient)
export function categorizeBookmark(content: string): number {
  // Default to uncategorized (assuming it's the last category with ID 7)
  let categoryId = 7;

  const contentLower = content.toLowerCase();

  // Simple keyword matching for categorization
  if (contentLower.includes('idea') || contentLower.includes('content') || contentLower.includes('strategy')) {
    categoryId = 1; // Content Ideas
  } else if (contentLower.includes('tool') || contentLower.includes('automation') || contentLower.includes('workflow')) {
    categoryId = 2; // Automation Tools
  } else if (contentLower.includes('article') || contentLower.includes('read') || contentLower.includes('blog')) {
    categoryId = 3; // Interesting Reads
  } else if (contentLower.includes('career') || contentLower.includes('job') || contentLower.includes('skill')) {
    categoryId = 4; // Career Tips
  } else if (contentLower.includes('quote') || contentLower.includes('"') || contentLower.includes('"')) {
    categoryId = 5; // Good Quotes
  } else if (contentLower.includes('fact') || contentLower.includes('trivia') || contentLower.includes('did you know')) {
    categoryId = 6; // Knowledge/Trivia
  }

  return categoryId;
}
