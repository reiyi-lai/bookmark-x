-- Add INSERT policy for users table to allow service role to create users
CREATE POLICY "Service role can insert users" ON users
  FOR INSERT WITH CHECK (true); 