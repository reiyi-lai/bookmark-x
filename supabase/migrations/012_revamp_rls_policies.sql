-- Users can only see their own bookmarks
CREATE POLICY "Users can view own bookmarks" ON bookmarks
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users 
      WHERE twitter_id = current_setting('request.jwt.claims', true)::json->>'twitter_id'
    )
  );

-- Users can only insert bookmarks for themselves
CREATE POLICY "Users can insert own bookmarks" ON bookmarks
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM users 
      WHERE twitter_id = current_setting('request.jwt.claims', true)::json->>'twitter_id'
    )
  );

-- Users can only update their own bookmarks
CREATE POLICY "Users can update own bookmarks" ON bookmarks
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM users 
      WHERE twitter_id = current_setting('request.jwt.claims', true)::json->>'twitter_id'
    )
  );

-- Users can only delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks" ON bookmarks
  FOR DELETE USING (
    user_id IN (
      SELECT id FROM users 
      WHERE twitter_id = current_setting('request.jwt.claims', true)::json->>'twitter_id'
    )
  );

-- Anyone can view categories
CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT USING (true);

-- Users can only see and modify their own records
CREATE POLICY "Users can view own record" ON users
  FOR SELECT USING (
    twitter_id = current_setting('request.jwt.claims', true)::json->>'twitter_id'
  );

CREATE POLICY "Users can update own record" ON users  
  FOR UPDATE USING (
    twitter_id = current_setting('request.jwt.claims', true)::json->>'twitter_id'
  );

-- Allow inserting new users (for registration)
CREATE POLICY "Allow user creation" ON users
  FOR INSERT WITH CHECK (true);