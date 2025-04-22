import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import { getAuthUrl, getAccessToken, TwitterApiClient } from "./twitter-api";
import { insertBookmarkSchema } from "@shared/schema";
import { MLCategorizer, createCategorizer } from "./ml-categorizer";
import { processImportedBookmarks, normalizeTwitterResponse } from "./import-bookmarks";

// Add custom properties to the session
declare module 'express-session' {
  interface SessionData {
    userId: number;
    twitterUserId: string;
    loggedIn: boolean;
  }
}

const MemoryStoreSession = MemoryStore(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up session middleware
  app.use(
    session({
      cookie: { maxAge: 86400000 }, // 24 hours
      store: new MemoryStoreSession({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || "twitter-bookmark-organizer-secret",
    })
  );

  // API routes
  app.get("/api/auth/twitter", (req: Request, res: Response) => {
    try {
      const authUrl = getAuthUrl();
      res.json({ url: authUrl });
    } catch (error) {
      console.error("Error generating auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get("/api/auth/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Missing code parameter" });
    }

    try {
      // Exchange auth code for tokens
      const { accessToken, refreshToken, expiresIn } = await getAccessToken(
        code
      );

      // Create a Twitter API client with the access token
      const twitterClient = new TwitterApiClient(accessToken);

      // Get the user details from Twitter
      const twitterUser = await twitterClient.getUser();

      // Check if the user exists in our system
      let user = await storage.getUserByUsername(twitterUser.username);

      // If user doesn't exist, create one
      if (!user) {
        // Generate a random password for the user
        const password = Math.random().toString(36).substring(2, 15);
        user = await storage.createUser({
          username: twitterUser.username,
          password,
        });
      }

      // Update the user's Twitter tokens
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + expiresIn);
      
      await storage.updateUserTwitterTokens(
        user.id,
        accessToken,
        refreshToken,
        expiryDate
      );

      // Store user info in session
      req.session.userId = user.id;
      req.session.twitterUserId = twitterUser.id;
      req.session.loggedIn = true;

      // Redirect to the frontend
      res.redirect("/");
    } catch (error) {
      console.error("Error in Twitter callback:", error);
      res.status(500).json({ error: "Failed to authenticate with Twitter" });
    }
  });

  app.get("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/status", (req: Request, res: Response) => {
    res.json({
      loggedIn: !!req.session.loggedIn,
      userId: req.session.userId,
    });
  });

  // Categories endpoints
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Bookmarks endpoints
  app.get("/api/bookmarks", async (req: Request, res: Response) => {
    // Default to user ID 1 if not authenticated for demo purposes
    const userId = req.session.userId || 1;
    const { categoryId, search } = req.query;

    try {
      let bookmarks;

      if (categoryId && typeof categoryId === "string") {
        bookmarks = await storage.getBookmarksByCategory(
          userId,
          parseInt(categoryId)
        );
      } else {
        bookmarks = await storage.getBookmarks(userId);
      }

      // Apply search filter if provided
      if (search && typeof search === "string" && search.trim() !== "") {
        const searchLower = search.toLowerCase();
        bookmarks = bookmarks.filter(
          (bookmark) =>
            bookmark.content.toLowerCase().includes(searchLower) ||
            bookmark.authorName.toLowerCase().includes(searchLower) ||
            bookmark.authorUsername.toLowerCase().includes(searchLower)
        );
      }

      res.json(bookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ error: "Failed to fetch bookmarks" });
    }
  });

  app.get("/api/bookmarks/sync", async (req: Request, res: Response) => {
    if (!req.session.userId || !req.session.twitterUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.session.userId;
    const twitterUserId = req.session.twitterUserId;

    try {
      // Get the user to access the Twitter token
      const user = await storage.getUser(userId);
      if (!user || !user.twitterAccessToken) {
        return res.status(401).json({ error: "Twitter token not found" });
      }

      // Check if token is expired
      if (user.twitterTokenExpiry && new Date(user.twitterTokenExpiry) < new Date()) {
        return res.status(401).json({ error: "Twitter token expired" });
      }

      // Create Twitter client
      const twitterClient = new TwitterApiClient(user.twitterAccessToken);

      // Calculate the date 3 months ago
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Fetch bookmarks from Twitter API
      let allBookmarks = [];
      let nextToken = undefined;
      let hasMorePages = true;

      while (hasMorePages) {
        const { bookmarks, nextToken: token } = await twitterClient.fetchBookmarks(
          twitterUserId,
          nextToken
        );

        // Filter bookmarks to only include those from the last 3 months
        const recentBookmarks = bookmarks.filter(
          (bookmark) => new Date(bookmark.createdAt) >= threeMonthsAgo
        );

        allBookmarks.push(...recentBookmarks);
        nextToken = token;
        hasMorePages = !!token && recentBookmarks.length > 0;
      }

      // Save bookmarks to our database
      const savedBookmarks = [];
      for (const bookmark of allBookmarks) {
        // Determine category based on content
        const categoryId = TwitterApiClient.categorizeBookmark(bookmark.content);

        // Create bookmark data
        const bookmarkData = {
          tweetId: bookmark.tweetId,
          userId,
          categoryId,
          authorName: bookmark.authorName,
          authorUsername: bookmark.authorUsername,
          authorProfileImage: bookmark.authorProfileImage || null,
          content: bookmark.content,
          createdAt: bookmark.createdAt,
          bookmarkedAt: new Date(),
          url: bookmark.url,
        };

        // Validate the bookmark data
        const validatedBookmark = insertBookmarkSchema.parse(bookmarkData);

        // Save to storage
        const savedBookmark = await storage.createBookmark(validatedBookmark);
        savedBookmarks.push(savedBookmark);
      }

      res.json({ 
        success: true, 
        bookmarksCount: savedBookmarks.length 
      });
    } catch (error) {
      console.error("Error syncing bookmarks:", error);
      res.status(500).json({ error: "Failed to sync bookmarks" });
    }
  });

  app.patch(
    "/api/bookmarks/:id/category",
    async (req: Request, res: Response) => {
      // Default to user ID 1 if not authenticated for demo purposes
      const userId = req.session.userId || 1;
      
      const { id } = req.params;
      const { categoryId } = req.body;

      if (!id || !categoryId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      try {
        const bookmark = await storage.getBookmarkById(parseInt(id));

        if (!bookmark) {
          return res.status(404).json({ error: "Bookmark not found" });
        }

        const category = await storage.getCategoryById(categoryId);
        if (!category) {
          return res.status(404).json({ error: "Category not found" });
        }

        const updatedBookmark = await storage.updateBookmarkCategory(
          parseInt(id),
          categoryId
        );

        res.json(updatedBookmark);
      } catch (error) {
        console.error("Error updating bookmark category:", error);
        res.status(500).json({ error: "Failed to update bookmark category" });
      }
    }
  );

  app.delete("/api/bookmarks/:id", async (req: Request, res: Response) => {
    // Default to user ID 1 if not authenticated for demo purposes
    const userId = req.session.userId || 1;
    
    const { id } = req.params;

    try {
      const bookmark = await storage.getBookmarkById(parseInt(id));

      if (!bookmark) {
        return res.status(404).json({ error: "Bookmark not found" });
      }

      await storage.deleteBookmark(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      res.status(500).json({ error: "Failed to delete bookmark" });
    }
  });

  // Import bookmarks from JSON
  app.post("/api/bookmarks/import", async (req: Request, res: Response) => {
    // Default to user ID 1 if not authenticated for demo purposes
    const userId = req.session.userId || 1;

    try {
      const { bookmarks } = req.body;

      if (!bookmarks || !Array.isArray(bookmarks)) {
        return res.status(400).json({ error: "Invalid bookmarks data. Expected an array." });
      }

      // Normalize the bookmarks data format
      const normalizedData = normalizeTwitterResponse(bookmarks);

      // Process and save the bookmarks using ML categorization
      const importStats = await processImportedBookmarks(normalizedData, userId);

      res.json({
        success: true,
        stats: importStats
      });
    } catch (error) {
      console.error("Error importing bookmarks:", error);
      res.status(500).json({ 
        error: "Failed to import bookmarks",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Recategorize all bookmarks using ML
  app.post("/api/bookmarks/recategorize", async (req: Request, res: Response) => {
    // Default to user ID 1 if not authenticated for demo purposes
    const userId = req.session.userId || 1;

    try {
      // Get all categories
      const categories = await storage.getCategories();
      
      // Create ML categorizer
      const categorizer = createCategorizer(categories);
      
      // Get all bookmarks for the current user
      const bookmarks = await storage.getBookmarks(userId);
      
      const results = {
        total: bookmarks.length,
        updated: 0,
        categorized: {} as Record<number, number>
      };
      
      // Initialize category counts
      categories.forEach(category => {
        results.categorized[category.id] = 0;
      });
      
      // Process each bookmark
      for (const bookmark of bookmarks) {
        // Use ML to categorize the content
        const newCategoryId = await categorizer.categorize(bookmark.content);
        
        // Skip if the category is the same
        if (bookmark.categoryId === newCategoryId) {
          results.categorized[newCategoryId] = (results.categorized[newCategoryId] || 0) + 1;
          continue;
        }
        
        // Update the bookmark category
        await storage.updateBookmarkCategory(bookmark.id, newCategoryId);
        results.updated++;
        results.categorized[newCategoryId] = (results.categorized[newCategoryId] || 0) + 1;
      }
      
      res.json({
        success: true,
        stats: results
      });
    } catch (error) {
      console.error("Error recategorizing bookmarks:", error);
      res.status(500).json({ error: "Failed to recategorize bookmarks" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
