import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Keep the users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  twitterAccessToken: text("twitter_access_token"),
  twitterRefreshToken: text("twitter_refresh_token"),
  twitterTokenExpiry: timestamp("twitter_token_expiry"),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  order: integer("order").default(0),
});

export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  tweetId: text("tweet_id").notNull().unique(),
  userId: integer("user_id").notNull(),
  categoryId: integer("category_id"),
  authorName: text("author_name").notNull(),
  authorUsername: text("author_username").notNull(),
  authorProfileImage: text("author_profile_image"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull(),
  bookmarkedAt: timestamp("bookmarked_at").notNull(),
  url: text("url").notNull(),
});

// Define schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  description: true,
  icon: true,
  color: true,
  order: true,
});

export const insertBookmarkSchema = createInsertSchema(bookmarks).pick({
  tweetId: true,
  userId: true,
  categoryId: true,
  authorName: true,
  authorUsername: true,
  authorProfileImage: true,
  content: true,
  createdAt: true,
  bookmarkedAt: true,
  url: true,
});

// Define types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;

// Categories that will be used for bookmarks
export const DEFAULT_CATEGORIES: InsertCategory[] = [
  { name: "Content Ideas", description: "Ideas for creating content", icon: "lightbulb", color: "#6c5ce7", order: 1 },
  { name: "Automation Tools", description: "Tools for automation", icon: "build", color: "#3498db", order: 2 },
  { name: "Interesting Reads", description: "Articles and threads worth reading", icon: "menu_book", color: "#2ecc71", order: 3 },
  { name: "Career Tips", description: "Career advice and tips", icon: "work", color: "#e67e22", order: 4 },
  { name: "Good Quotes", description: "Inspirational and thoughtful quotes", icon: "format_quote", color: "#f1c40f", order: 5 },
  { name: "Knowledge/Trivia", description: "General knowledge and interesting facts", icon: "school", color: "#e74c3c", order: 6 },
  { name: "Uncategorized", description: "Bookmarks not yet categorized", icon: "help_outline", color: "#95a5a6", order: 7 },
];
