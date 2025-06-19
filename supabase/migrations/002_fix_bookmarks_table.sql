-- Increase the length limit for author_display_name
ALTER TABLE bookmarks 
  ALTER COLUMN author_display_name TYPE VARCHAR(255);
 
-- Add a simple INSERT policy for bookmarks
CREATE POLICY "Enable insert for all" ON bookmarks
  FOR INSERT
  WITH CHECK (true); 