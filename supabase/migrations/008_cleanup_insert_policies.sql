-- Drop the redundant "Enable insert for all" policy
DROP POLICY IF EXISTS "Enable insert for all" ON bookmarks;

-- Keep and update the service role policy to be more explicit
ALTER POLICY "Service role can insert bookmarks" 
ON bookmarks
TO public
WITH CHECK (
  -- Allow service role access (when no JWT present)
  auth.jwt() IS NULL
  OR 
  -- Allow authenticated users to insert their own bookmarks (for future use)
  (auth.uid()::text = user_id::text)
); 