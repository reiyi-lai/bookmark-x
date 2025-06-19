-- Drop existing policies
CREATE POLICY "Allow service role and user access" ON bookmarks
  FOR SELECT USING (
    -- Allow service role (when no auth.uid present)
    auth.jwt() IS NULL
  ); 