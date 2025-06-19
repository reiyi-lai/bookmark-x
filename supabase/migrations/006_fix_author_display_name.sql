-- Change author_display_name to TEXT type to remove length limit
ALTER TABLE bookmarks 
  ALTER COLUMN author_display_name TYPE TEXT; 