import { createClient } from '@supabase/supabase-js';
import { User, Category, Bookmark, MediaAttachment, InsertBookmark, enrichCategoryWithMetadata } from '@shared/schema';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'bookmark-x-auth',
    storage: {
      getItem: (key: string) => {
        return new Promise<string | null>((resolve) => {
          chrome.storage.local.get([key], (result: { [key: string]: any }) => {
            resolve(result[key] || null);
          });
        });
      },
      setItem: (key: string, value: string) => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.set({ [key]: value }, () => {
            resolve();
          });
        });
      },
      removeItem: (key: string) => {
        return new Promise<void>((resolve) => {
          chrome.storage.local.remove([key], () => {
            resolve();
          });
        });
      },
    },
  },
});

export const getCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*');

  if (error) throw error;
  
  const enrichedCategories = (data || []).map(enrichCategoryWithMetadata);
  return enrichedCategories.sort((a, b) => a.order - b.order);
};

export const getDefaultCategory = async (): Promise<Category | null> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('name', 'Uncategorized')
    .single();

  if (error) return null;
  
  return data ? enrichCategoryWithMetadata(data) : null;
};

export const createOrUpdateUser = async (twitterId: string, twitterUsername: string, email?: string): Promise<User> => {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      twitter_id: twitterId,
      twitter_username: twitterUsername,
      email,
    }, {
      onConflict: 'twitter_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getUserByTwitterId = async (twitterId: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('twitter_id', twitterId)
    .single();

  if (error) return null;
  return data;
};

type BookmarkInput = Omit<InsertBookmark, 'id' | 'created_at' | 'updated_at' | 'last_synced_at'>;
export const saveBookmarks = async (bookmarks: BookmarkInput[]): Promise<Bookmark[]> => {
  const { data, error } = await supabase
    .from('bookmarks')
    .upsert(bookmarks, {
      onConflict: 'user_id,tweet_id',
      ignoreDuplicates: false,
    })
    .select();

  if (error) throw error;
  return data || [];
};

export const getUserBookmarks = async (userId: string): Promise<Bookmark[]> => {
  const { data, error } = await supabase
    .from('bookmarks')
    .select(`
      *,
      categories (
        id,
        name,
        color
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}; 