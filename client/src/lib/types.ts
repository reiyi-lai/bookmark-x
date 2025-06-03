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
  content: string | null;
  url: string;
  userId: string | null;
  categoryId: number | null;
  tweetId: string;
  authorName: string | null;
  authorUsername: string | null;
  authorProfileImage: string | null;
  createdAt: Date;
  bookmarkedAt: Date;
}