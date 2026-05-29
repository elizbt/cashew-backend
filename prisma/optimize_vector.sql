ALTER TABLE documents ALTER COLUMN embedding TYPE vector(768);
DELETE FROM documents;
