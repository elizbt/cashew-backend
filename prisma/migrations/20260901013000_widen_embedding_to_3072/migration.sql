-- Widen "embedding" from vector(768) to vector(3072) to use the native
-- (non-truncated) output dimension of gemini-embedding-001. Existing rows
-- are cleared since they must be re-embedded at the new dimension anyway.
TRUNCATE TABLE "documents";

ALTER TABLE "documents" ALTER COLUMN "embedding" TYPE vector(3072);
