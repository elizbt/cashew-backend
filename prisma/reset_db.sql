DROP TABLE IF EXISTS documents;
CREATE TABLE documents (
    id TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT,
    embedding vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
