INSERT INTO "subjects" ("name", "description") VALUES
  ('Mathematics', 'Build confidence with clear, step-by-step lessons.'),
  ('Physics', 'Explore the principles behind the world around us.'),
  ('Chemistry', 'Understand matter, reactions, and the periodic table.'),
  ('Biology', 'Learn about living systems from cells to ecosystems.')
ON CONFLICT DO NOTHING;
