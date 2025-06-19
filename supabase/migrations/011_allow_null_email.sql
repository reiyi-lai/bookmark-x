-- Make email column nullable to support progressive registration
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;
 
-- Add comment explaining the change
COMMENT ON COLUMN users.email IS 'User email - can be null during initial Twitter registration'; 