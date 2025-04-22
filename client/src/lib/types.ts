// Type definitions for the client
export interface User {
  id: number;
  username: string;
  displayName: string;
  twitterUserId: string;
  twitterAccessToken: string | null;
  twitterRefreshToken: string | null;
  twitterTokenExpiry: Date | null;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  order: number | null;
  description: string | null;
  icon: string;
}

export interface Bookmark {
  id: number;
  content: string;
  url: string;
  userId: number;
  categoryId: number | null;
  tweetId: string;
  authorName: string;
  authorUsername: string;
  authorProfileImage: string | null;
  createdAt: Date;
  bookmarkedAt: Date;
}