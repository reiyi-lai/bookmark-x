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

      // Only require Twitter ID for auth
      if (!twitterUser?.id) {
        return res.status(400).json({ error: "Twitter ID required" });
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
        // Create new user with Twitter info
        const userData = {
          twitter_id: twitterUser.id,
          twitter_username: twitterUser.username || null // Username is optional
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

      // Batch check for duplicates to improve performance
      const tweetIds = processedBookmarks.map(bookmark => bookmark.id);
      
      const { data: existingBookmarks } = await supabase
        .from('bookmarks')
        .select('tweet_id')
        .eq('user_id', userId)
        .in('tweet_id', tweetIds);

      const existingTweetIds = new Set(
        existingBookmarks?.map(b => b.tweet_id) || []
      );

      // Filter out duplicates
      const newBookmarks = processedBookmarks.filter(
        bookmark => !existingTweetIds.has(bookmark.id)
      );

      if (newBookmarks.length === 0) {
        return res.json({ 
          success: true, 
          stats: {
            total: processedBookmarks.length,
            imported: 0,
            categorized: {}
          },
          userId: userId,
          message: "All bookmarks already exist"
        });
      }

      console.log(`Importing ${newBookmarks.length} new bookmarks (${existingTweetIds.size} duplicates skipped)`);

      // Prepare all bookmark data for batch insert
      const bookmarkDataArray = newBookmarks.map(bookmark => ({
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
      }));

      // Database batch operations
      const DB_BATCH_SIZE = 500;
      const allInsertedBookmarks: any[] = [];
      
      console.log(`Processing ${bookmarkDataArray.length} bookmarks in database chunks of ${DB_BATCH_SIZE}`);
      
      for (let i = 0; i < bookmarkDataArray.length; i += DB_BATCH_SIZE) {
        const chunk = bookmarkDataArray.slice(i, i + DB_BATCH_SIZE);
        const chunkNumber = Math.floor(i / DB_BATCH_SIZE) + 1;
        const totalChunks = Math.ceil(bookmarkDataArray.length / DB_BATCH_SIZE);
        
        console.log(`Inserting database chunk ${chunkNumber}/${totalChunks} (${chunk.length} bookmarks)`);
        
        try {
          const { data: insertedBookmarks, error: insertError } = await supabase
            .from('bookmarks')
            .insert(chunk)
            .select('category_id');

          if (insertError) {
            console.error(`Error inserting database chunk ${chunkNumber}:`, insertError);
            throw insertError;
          }

          if (insertedBookmarks) {
            allInsertedBookmarks.push(...insertedBookmarks);
          }
          
          // Add a small delay between chunks to be respectful to Supabase
          if (i + DB_BATCH_SIZE < bookmarkDataArray.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (error) {
          console.error(`Failed to insert database chunk ${chunkNumber}:`, error);
          throw error;
        }
      }

      // Calculate statistics from all inserted bookmarks
      stats.imported = allInsertedBookmarks.length;
      
      // Count categories from inserted bookmarks
      allInsertedBookmarks.forEach(bookmark => {
        const categoryId = bookmark.category_id;
        stats.categorized[categoryId] = (stats.categorized[categoryId] || 0) + 1;
      });

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

      // SECURITY: Verify the requesting user owns this userId
      const requestingUserId = await getUserFromRequest(req);
      if (!requestingUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      if (requestingUserId !== userId) {
        return res.status(403).json({ error: "Forbidden: Cannot modify another user's data" });
      }

      // Check if user exists and user owns this record
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

      // Check if email already exists for another user
      const { data: emailCheck, error: emailError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (emailError && emailError.code !== 'PGRST116') { // PGRST116 is "not found"
        throw emailError;
      }

      if (emailCheck) {
        return res.status(409).json({ 
          error: "EMAIL_ALREADY_EXISTS",
          title: "Enter another email",
          message: "Email already exists under another x.com account"
        });
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

  // Middleware to extract user ID from request
  const getUserFromRequest = async (req: Request): Promise<string | null> => {
    try {
      // Get twitter_id from query parameter (from client requests)
      const twitterId = req.headers['x-twitter-id'] || req.query.twitter_id;
      
      if (!twitterId) {
        return null;
      }
      
      // Get user by twitter_id
      const { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('twitter_id', twitterId)
        .single();
        
      if (error || !user) {
        return null;
      }
      
      return user.id;
    } catch (error) {
      console.error('Error getting user from request:', error);
      return null;
    }
  };

  // 2. WEB APP ROUTES
  
  // Get bookmarks with optional filtering
  app.get("/api/bookmarks", async (req: Request, res: Response) => {
    try {
      const { categoryId, search } = req.query;
      
      // Get user ID from request
      const userId = await getUserFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      let query = supabase
        .from('bookmarks')
        .select(`
          *,
          categories (
            id,
            name,
            color
          )
        `)
        .eq('user_id', userId); // CRITICAL FIX: Filter by user_id

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

      // Get user ID from request
      const userId = await getUserFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Now delete the bookmark
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', bookmarkId)
        .eq('user_id', userId);

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

      const userId = await getUserFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { error } = await supabase
        .from('bookmarks')
        .update({ category_id: categoryId })
        .eq('id', bookmarkId)
        .eq('user_id', userId);

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
      const userId = await getUserFromRequest(req);
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', userId);

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
              .eq('id', bookmark.id)
              .eq('user_id', userId);

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
