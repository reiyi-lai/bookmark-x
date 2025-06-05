import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { createCategorizer } from "../services/ml-categorizer";
import { BookmarkService } from "../services/bookmark-service";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function registerRoutes(app: Express): Promise<Server> {
  // 1. CHROME EXTENSION ROUTES
  
  // Import from Chrome extension
  app.post("/api/bookmarks/import", async (req: Request, res: Response) => {
    try {
      const { bookmarks: importedBookmarks, twitterUser } = req.body;
      
      if (!Array.isArray(importedBookmarks)) {
        return res.status(400).json({ error: "Invalid bookmark data" });
      }

      if (!twitterUser?.id || !twitterUser?.username) {
        return res.status(400).json({ error: "Twitter user info required" });
      }

      // First, get or create user
      let { data: existingUser, error: userLookupError } = await supabase
        .from('users')
        .select('id')
        .eq('twitter_id', twitterUser.id)
        .single();

      if (userLookupError && userLookupError.code !== 'PGRST116') { // PGRST116 is "not found"
        throw userLookupError;
      }

      let userId: string;
      
      if (!existingUser) {
        // Create new user with Twitter info only
        const userData = {
          twitter_id: twitterUser.id,
          twitter_username: twitterUser.username
        };

        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert(userData)
          .select('id')
          .single();

        if (createError) {
          throw createError;
        }
        
        userId = newUser.id;
      } else {
        userId = existingUser.id;
      }

      const { bookmarks: processedBookmarks, categories } = await BookmarkService.processBookmarks(importedBookmarks);

      const stats = {
        total: processedBookmarks.length,
        imported: 0,
        categorized: {} as Record<number, number>
      };

      // Initialize category counts
      categories.forEach(category => {
        stats.categorized[category.id] = 0;
      });

      // Save bookmark to Supabase
      for (const bookmark of processedBookmarks) {
        try {
          // Check for duplicates
          const { data: existing } = await supabase
            .from('bookmarks')
            .select('id')
            .eq('tweet_id', bookmark.id)
            .eq('user_id', userId)
            .single();

          if (existing) {
            continue; 
          }

          // Prepare bookmark data for Supabase
          const bookmarkData = {
            tweet_id: bookmark.id,
            tweet_url: bookmark.url,
            tweet_content: bookmark.text,
            author_username: bookmark.author.username,
            author_display_name: bookmark.author.name,
            author_profile_picture: bookmark.author.profile_image_url,
            tweet_date: bookmark.created_at,
            category_id: bookmark.categoryId,
            media_attachments: bookmark.media_attachments,
            user_id: userId
          };

          // Save to Supabase
          const { error: insertError } = await supabase
            .from('bookmarks')
            .insert(bookmarkData);

          if (insertError) {
            console.error(`Error saving bookmark ${bookmark.id}:`, insertError);
            continue;
          }

          // Update statistics
          stats.imported++;
          stats.categorized[bookmark.categoryId] = (stats.categorized[bookmark.categoryId] || 0) + 1;
        } catch (error) {
          console.error(`Error processing bookmark ${bookmark.id}:`, error);
        }
      }

      res.json({ 
        success: true, 
        stats: stats,
        userId: userId
      });
    } catch (error) {
      console.error("Error importing bookmarks:", error);
      res.status(500).json({ error: "Failed to import bookmarks" });
    }
  });

  // Complete user registration with email
  app.post("/api/users/:userId/complete-registration", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Check if user exists
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single();

      if (userError) {
        throw userError;
      }

      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (existingUser.email) {
        return res.status(400).json({ error: "User already has an email registered" });
      }

      // Update user with email
      const { error: updateError } = await supabase
        .from('users')
        .update({ email })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      res.json({ 
        success: true,
        message: "Registration completed successfully"
      });
    } catch (error) {
      console.error("Error completing registration:", error);
      res.status(500).json({ error: "Failed to complete registration" });
    }
  });

  // 2. WEB APP ROUTES
  
  // Get bookmarks with optional filtering
  app.get("/api/bookmarks", async (req: Request, res: Response) => {
    try {
      const { categoryId, search } = req.query;
      
      let query = supabase
        .from('bookmarks')
        .select(`
          *,
          categories (
            id,
            name,
            color
          )
        `);

      // Filter by category
      if (categoryId) {
        query = query.eq('category_id', parseInt(categoryId as string));
      }

      // Filter by search
      if (search) {
        query = query.or(`tweet_content.ilike.%${search}%,author_display_name.ilike.%${search}%,author_username.ilike.%${search}%`);
      }

      const { data: bookmarks, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Match client Bookmark interface
      const transformedBookmarks = bookmarks?.map(bookmark => ({
        id: bookmark.id,
        content: bookmark.tweet_content,
        url: bookmark.tweet_url,
        userId: bookmark.user_id,
        categoryId: bookmark.category_id,
        tweetId: bookmark.tweet_id,
        authorName: bookmark.author_display_name,
        authorUsername: bookmark.author_username,
        authorProfileImage: bookmark.author_profile_picture,
        createdAt: new Date(bookmark.tweet_date),
        bookmarkedAt: new Date(bookmark.created_at)
      })) || [];

      res.json(transformedBookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ error: "Failed to fetch bookmarks" });
    }
  });

  // Delete a bookmark
  app.delete("/api/bookmarks/:id", async (req: Request, res: Response) => {
    try {
      const bookmarkId = parseInt(req.params.id);
      
      if (isNaN(bookmarkId)) {
        return res.status(400).json({ error: "Invalid bookmark ID" });
      }

      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', bookmarkId)
        .eq('user_id', 'chrome_extension_user');

      if (error) {
        throw error;
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      res.status(500).json({ error: "Failed to delete bookmark" });
    }
  });

  // Update bookmark category
  app.patch("/api/bookmarks/:id/category", async (req: Request, res: Response) => {
    try {
      const bookmarkId = parseInt(req.params.id);
      const { categoryId } = req.body;
      
      if (isNaN(bookmarkId) || !categoryId) {
        return res.status(400).json({ error: "Invalid bookmark ID or category ID" });
      }

      const { error } = await supabase
        .from('bookmarks')
        .update({ category_id: categoryId })
        .eq('id', bookmarkId)
        .eq('user_id', 'chrome_extension_user');

      if (error) {
        throw error;
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating bookmark category:", error);
      res.status(500).json({ error: "Failed to update bookmark category" });
    }
  });

  // Get categories
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const categories = await BookmarkService.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Recategorize all bookmarks
  app.post("/api/bookmarks/recategorize", async (req: Request, res: Response) => {
    try {
      // Get all bookmarks
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from('bookmarks')
        .select('*');

      if (bookmarksError || !bookmarks) {
        throw new Error('Failed to fetch bookmarks');
      }

      // Get categories and create categorizer
      const categories = await BookmarkService.getCategories();
      const categorizer = createCategorizer(categories);
      
      let updated = 0;
      
      // Process each bookmark
      for (const bookmark of bookmarks) {
        try {
          const newCategoryId = await categorizer.categorize(bookmark.tweet_content);
          
          if (newCategoryId !== bookmark.category_id) {
            const { error } = await supabase
              .from('bookmarks')
              .update({ category_id: newCategoryId })
              .eq('id', bookmark.id);

            if (!error) {
              updated++;
            }
          }
        } catch (error) {
          console.error(`Error recategorizing bookmark ${bookmark.id}:`, error);
        }
      }

      res.json({ 
        success: true, 
        stats: { 
          total: bookmarks.length, 
          updated 
        } 
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
