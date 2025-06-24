-- Migration to update categories for new categorization system
-- Remove old categories and add new ones

-- Update existing bookmarks that were in "Interesting Reads" to "Personal Reads"
-- (we'll create Personal Reads first)
INSERT INTO categories (name, description, color) VALUES
  ('Personal Reads', 'Thoughts on life, insights, quotes, and personal reflections', '#e91e63'),
  ('Academic Research', 'Research papers, studies, and academic content especially AI/ML', '#673ab7');

-- Move bookmarks from old categories to new ones
-- "Interesting Reads" -> "Personal Reads"
UPDATE bookmarks 
SET category_id = (SELECT id FROM categories WHERE name = 'Personal Reads')
WHERE category_id = (SELECT id FROM categories WHERE name = 'Interesting Reads');

-- "Good Quotes" -> "Personal Reads" 
UPDATE bookmarks 
SET category_id = (SELECT id FROM categories WHERE name = 'Personal Reads')
WHERE category_id = (SELECT id FROM categories WHERE name = 'Good Quotes');

-- Now safely remove the old categories
DELETE FROM categories WHERE name IN ('Interesting Reads', 'Good Quotes'); 