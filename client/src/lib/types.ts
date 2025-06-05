// Type definitions for client
export interface User {
  id: number;
  username: string;
  displayName: string;
  twitterUserId: string;
  twitterAccessToken: string | null;
  twitterRefreshToken: string | null;
  twitterTokenExpiry: Date | null;
}

export type { Category } from '@shared/schema';

export interface Bookmark {
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