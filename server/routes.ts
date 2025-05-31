import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { categorizeBookmark } from "./twitter-api";
import { insertBookmarkSchema } from "@shared/schema";
import { MLCategorizer, createCategorizer } from "./ml-categorizer";
import { processImportedBookmarks, normalizeTwitterResponse } from "./import-bookmarks";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes

  // Get all bookmarks for a user  
  app.get("/api/bookmarks", async (req: Request, res: Response) => {
    try {
      const { search, category } = req.query;
      
      // Use default user ID for now (until extension is built)
      const userId = 1;

      let bookmarks = await storage.getBookmarks(userId);

      // Filter by category if specified
      if (category && category !== 'all') {
        const categoryId = parseInt(category as string);
        if (!isNaN(categoryId)) {
          bookmarks = await storage.getBookmarksByCategory(userId, categoryId);
        }
      }

      // Filter by search term if specified
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        bookmarks = bookmarks.filter(bookmark => 
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

  // Import bookmarks from JSON
  app.post("/api/bookmarks/import", async (req: Request, res: Response) => {
    try {
      const { bookmarks: importedBookmarks } = req.body;
      
      if (!Array.isArray(importedBookmarks)) {
        return res.status(400).json({ error: "Invalid bookmark data" });
      }

      // Use default user ID for now (until extension is built)
      const userId = 1;

      const importStats = await processImportedBookmarks(importedBookmarks, userId);
      
      res.json({ 
        success: true, 
        stats: importStats 
      });
    } catch (error) {
      console.error("Error importing bookmarks:", error);
      res.status(500).json({ error: "Failed to import bookmarks" });
    }
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

  // Chrome Extension specific endpoint for single bookmark categorization
  app.post("/api/categorize", async (req: Request, res: Response) => {
    try {
      const { text, categories: availableCategories } = req.body;
      
      if (!text || !availableCategories) {
        return res.status(400).json({ error: "Missing text or categories" });
      }

      // Get all categories if not provided
      const categories = availableCategories || await storage.getCategories();
      
      // Create ML categorizer
      const categorizer = createCategorizer(categories);
      
      // Categorize the text
      const categoryId = await categorizer.categorize(text);
      
      // Find the category details
      const category = categories.find(cat => cat.id === categoryId);
      
      res.json({
        categoryId,
        category: category?.name || 'Unknown',
        confidence: 0.8 // Could be enhanced to return actual confidence from ML model
      });
    } catch (error) {
      console.error("Error categorizing text:", error);
      res.status(500).json({ error: "Failed to categorize text" });
    }
  });

  // Update bookmark category
  app.patch("/api/bookmarks/:id/category", async (req: Request, res: Response) => {
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
  });

  // Delete bookmark
  app.delete("/api/bookmarks/:id", async (req: Request, res: Response) => {
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

  // Recategorize all bookmarks using ML
  app.post("/api/bookmarks/recategorize", async (req: Request, res: Response) => {
    try {
      // Use default user ID for now (until extension is built)
      const userId = 1;

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
