import {
  users, categories, bookmarks,
  type User, type InsertUser,
  type Category, type InsertCategory,
  type Bookmark, type InsertBookmark,
  DEFAULT_CATEGORIES
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserTwitterTokens(userId: number, accessToken: string, refreshToken: string, expiryTimestamp: Date): Promise<User>;
  
  // Category operations
  getCategories(): Promise<Category[]>;
  getCategoryById(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Bookmark operations
  getBookmarks(userId: number): Promise<Bookmark[]>;
  getBookmarksByCategory(userId: number, categoryId: number): Promise<Bookmark[]>;
  getBookmarkById(id: number): Promise<Bookmark | undefined>;
  getBookmarkByTweetId(tweetId: string): Promise<Bookmark | undefined>;
  createBookmark(bookmark: InsertBookmark): Promise<Bookmark>;
  updateBookmarkCategory(id: number, categoryId: number): Promise<Bookmark | undefined>;
  deleteBookmark(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private categories: Map<number, Category>;
  private bookmarks: Map<number, Bookmark>;
  
  private userId: number;
  private categoryId: number;
  private bookmarkId: number;

  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.bookmarks = new Map();
    
    this.userId = 1;
    this.categoryId = 1;
    this.bookmarkId = 1;
    
    // Initialize with default categories
    this.initializeDefaultCategories();
  }

  private initializeDefaultCategories() {
    DEFAULT_CATEGORIES.forEach(category => {
      this.createCategory(category);
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id, twitterAccessToken: null, twitterRefreshToken: null, twitterTokenExpiry: null };
    this.users.set(id, user);
    return user;
  }

  async updateUserTwitterTokens(userId: number, accessToken: string, refreshToken: string, expiryTimestamp: Date): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updatedUser: User = {
      ...user,
      twitterAccessToken: accessToken,
      twitterRefreshToken: refreshToken,
      twitterTokenExpiry: expiryTimestamp
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values()).sort((a, b) => {
      // Default to 0 if order is null or undefined
      const orderA = a.order !== null && a.order !== undefined ? a.order : 0;
      const orderB = b.order !== null && b.order !== undefined ? b.order : 0;
      return orderA - orderB;
    });
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = this.categoryId++;
    const category: Category = { 
      id,
      name: insertCategory.name,
      icon: insertCategory.icon,
      color: insertCategory.color,
      description: insertCategory.description || null,
      order: insertCategory.order || null
    };
    this.categories.set(id, category);
    return category;
  }

  // Bookmark operations
  async getBookmarks(userId: number): Promise<Bookmark[]> {
    return Array.from(this.bookmarks.values())
      .filter(bookmark => bookmark.userId === userId)
      .sort((a, b) => new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime());
  }

  async getBookmarksByCategory(userId: number, categoryId: number): Promise<Bookmark[]> {
    return Array.from(this.bookmarks.values())
      .filter(bookmark => bookmark.userId === userId && bookmark.categoryId === categoryId)
      .sort((a, b) => new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime());
  }

  async getBookmarkById(id: number): Promise<Bookmark | undefined> {
    return this.bookmarks.get(id);
  }

  async getBookmarkByTweetId(tweetId: string): Promise<Bookmark | undefined> {
    return Array.from(this.bookmarks.values()).find(
      (bookmark) => bookmark.tweetId === tweetId
    );
  }

  async createBookmark(insertBookmark: InsertBookmark): Promise<Bookmark> {
    // Check if bookmark already exists by tweetId
    const existingBookmark = await this.getBookmarkByTweetId(insertBookmark.tweetId);
    if (existingBookmark) {
      return existingBookmark;
    }

    const id = this.bookmarkId++;
    const bookmark: Bookmark = { 
      id,
      tweetId: insertBookmark.tweetId,
      userId: insertBookmark.userId,
      categoryId: insertBookmark.categoryId || null,
      authorName: insertBookmark.authorName,
      authorUsername: insertBookmark.authorUsername,
      authorProfileImage: insertBookmark.authorProfileImage || null,
      content: insertBookmark.content,
      createdAt: insertBookmark.createdAt,
      bookmarkedAt: insertBookmark.bookmarkedAt,
      url: insertBookmark.url
    };
    this.bookmarks.set(id, bookmark);
    return bookmark;
  }

  async updateBookmarkCategory(id: number, categoryId: number): Promise<Bookmark | undefined> {
    const bookmark = await this.getBookmarkById(id);
    if (!bookmark) {
      return undefined;
    }

    const updatedBookmark: Bookmark = {
      ...bookmark,
      categoryId
    };

    this.bookmarks.set(id, updatedBookmark);
    return updatedBookmark;
  }

  async deleteBookmark(id: number): Promise<boolean> {
    return this.bookmarks.delete(id);
  }
}

export const storage = new MemStorage();
