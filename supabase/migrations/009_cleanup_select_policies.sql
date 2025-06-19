-- Drop the redundant "Users can view own bookmarks" policy
DROP POLICY IF EXISTS "Users can view own bookmarks" ON bookmarks;

-- Keep and update the service role policy to be more explicit
ALTER POLICY "Allow service role and user access" 
ON bookmarks
TO public
USING (
  -- Allow service role access (when no JWT present)
  auth.jwt() IS NULL
  OR 
  -- Allow authenticated users to view their own bookmarks
  (auth.uid()::text = user_id::text)
); 