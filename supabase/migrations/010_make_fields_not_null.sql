-- First, remove any records with NULL values in critical fields

-- Remove bookmarks with NULL values in any critical field
DELETE FROM bookmarks 
WHERE tweet_content IS NULL 
   OR author_username IS NULL 
   OR author_display_name IS NULL 
   OR user_id IS NULL 
   OR tweet_date IS NULL 
   OR category_id IS NULL;

-- Remove users with NULL email
DELETE FROM users 
WHERE email IS NULL;

-- Now add NOT NULL constraints

-- Users table
ALTER TABLE users
  ALTER COLUMN email SET NOT NULL;

-- Bookmarks table
ALTER TABLE bookmarks
  ALTER COLUMN tweet_content SET NOT NULL,
  ALTER COLUMN author_username SET NOT NULL,
  ALTER COLUMN author_display_name SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN tweet_date SET NOT NULL,
  ALTER COLUMN category_id SET NOT NULL;

-- Add default value for category_id to prevent future NULL values
ALTER TABLE bookmarks
  ALTER COLUMN category_id SET DEFAULT 7; -- ID of 'Uncategorized' category

-- Add a comment explaining the migration
COMMENT ON TABLE bookmarks IS 'Update NOT NULL fields for bookmarks';
COMMENT ON TABLE users IS 'Update NOT NULL fields for users - email and Twitter credentials'; 