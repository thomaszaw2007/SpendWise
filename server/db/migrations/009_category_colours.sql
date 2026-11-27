-- Keep existing categories and transactions; add a personal colour to each category.
BEGIN;
ALTER TABLE categories ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#0d9165';
UPDATE categories SET color = CASE lower(name)
  WHEN 'transport' THEN '#0284c7' WHEN 'groceries' THEN '#8b5cf6'
  WHEN 'shopping' THEN '#db2777' WHEN 'education' THEN '#6366f1'
  WHEN 'entertainment' THEN '#d97706' WHEN 'healthcare' THEN '#dc2626'
  WHEN 'subscriptions' THEN '#ea580c' WHEN 'bills & utilities' THEN '#0891b2'
  WHEN 'others' THEN '#64748b' WHEN 'freelance' THEN '#0284c7'
  WHEN 'gifts' THEN '#db2777' ELSE '#0d9165' END;
ALTER TABLE categories ADD CONSTRAINT categories_color_hex CHECK (color ~ '^#[0-9a-fA-F]{6}$');
COMMIT;
