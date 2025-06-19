-- Add INSERT policy for bookmarks table
-- This allows the service role (server) to insert bookmarks without user_id
-- and allows authenticated users to insert their own bookmarks
CREATE POLICY "Service role can insert bookmarks" ON bookmarks
  FOR INSERT WITH CHECK (
    -- Allow service role to insert without user_id
    (user_id IS NULL AND auth.jwt() IS NULL) OR
    -- Allow authenticated users to insert their own bookmarks
    (auth.uid()::text = user_id::text)
  ); 