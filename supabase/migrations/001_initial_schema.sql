-- Ran in Supabase SQL Editor

-- Create users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  twitter_id VARCHAR(50) UNIQUE NOT NULL,
  twitter_username VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table with default categories (matching existing schema)
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bookmarks table
CREATE TABLE bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tweet_id VARCHAR(50) NOT NULL,
  tweet_url TEXT NOT NULL,
  tweet_content TEXT,
  author_username VARCHAR(50),
  author_display_name VARCHAR(100),
  author_profile_picture TEXT,
  media_attachments JSONB, -- store array of media URLs/types
  tweet_date TIMESTAMP WITH TIME ZONE,
  category_id INTEGER REFERENCES categories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tweet_id) -- prevent duplicate bookmarks per user
);

-- Insert default categories (matching existing DEFAULT_CATEGORIES)
INSERT INTO categories (name, description, color) VALUES
  ('Content Ideas', 'Ideas for creating content', '#6c5ce7'),
  ('Automation Tools', 'Tools for automation', '#3498db'),
  ('Interesting Reads', 'Articles and threads worth reading', '#2ecc71'),
  ('Career Tips', 'Career advice and tips', '#e67e22'),
  ('Good Quotes', 'Motivational and insightful quotes', '#9b59b6'),
  ('Knowledge/Trivia', 'Interesting facts and trivia', '#f39c12'),
  ('Uncategorized', 'Bookmarks that haven''t been categorized yet', '#95a5a6');

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- RLS Policies for bookmarks table (READ-ONLY for users, INSERT only via sync)
CREATE POLICY "Users can view own bookmarks" ON bookmarks
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- NOTE: No INSERT policy for users - bookmarks should only be created via sync process

CREATE POLICY "Users can update own bookmarks" ON bookmarks
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own bookmarks" ON bookmarks
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Categories are readable by all authenticated users
CREATE POLICY "Categories are viewable by authenticated users" ON categories
  FOR SELECT TO authenticated USING (true);

-- Create indexes for better performance
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_category_id ON bookmarks(category_id);
CREATE INDEX idx_bookmarks_tweet_id ON bookmarks(tweet_id);
CREATE INDEX idx_bookmarks_last_synced ON bookmarks(last_synced_at);
CREATE INDEX idx_users_twitter_id ON users(twitter_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookmarks_updated_at BEFORE UPDATE ON bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 