# Implementation Plan: RAG with pgvector and Gemini - Chatbot IFNMG

**Date:** 2026-05-27  
**Status:** Draft  
**Reference Design:** `docs/superpowers/specs/2026-05-27-rag-implementation-design.md`

## Overview
This plan outlines the steps to implement Retrieval-Augmented Generation (RAG) using `pgvector` for storage and Google Gemini for embeddings and chat generation.

---

## Phase 1: Infrastructure & Environment
**Goal:** Prepare the environment to support vector operations and Jina Reader API.

1.  **Update Docker Configuration:**
    - Modify `docker-compose.yml` to change the `db` image from `postgres:16-alpine` to `pgvector/pgvector:pg16`.
2.  **Environment Variables:**
    - Ensure `GEMINI_API_KEY` is present in `.env`.
    - (Optional) Add `JINA_API_KEY` if high-volume requests are expected (otherwise use anonymous tier).
3.  **Restart Services:**
    - Run `docker-compose up -d` to pull and start the new database image.

---

## Phase 2: Database Schema & Extensions
**Goal:** Enable vector support and create the `Document` model.

1.  **Prisma Schema Update:**
    - Add the `Document` model to `prisma/schema.prisma` as defined in the design spec.
    - Note: `embedding` field must use `Unsupported("vector(768)")`.
2.  **Migration & SQL Extension:**
    - Run `npx prisma migrate dev --name add_documents_and_vector_extension --create-only`.
    - Edit the generated SQL migration file to include:
      ```sql
      CREATE EXTENSION IF NOT EXISTS vector;
      ```
    - Run `npx prisma migrate dev` to apply changes.
3.  **Prisma Client Regeneration:**
    - Ensure `npx prisma generate` is executed.

---

## Phase 3: Gemini Library Updates
**Goal:** Expose embedding functionality.

1.  **Update `src/lib/gemini.ts`:**
    - Initialize and export `embeddingModel` using `text-embedding-004`.
    - Update `geminiModel` to use `gemini-1.5-flash` or `gemini-1.5-pro` (standardizing on latest models).

---

## Phase 4: Ingestion Script
**Goal:** Create a CLI tool to populate the knowledge base.

1.  **Create `src/scripts/ingest.ts`:**
    - Implement a function to fetch Markdown from `https://r.jina.ai/<URL>`.
    - Implement text chunking (1000 chars, 10% overlap).
    - Implement embedding generation for each chunk.
    - Implement database insertion using `prisma.$executeRaw` (to handle the `vector` type).
2.  **Update `package.json`:**
    - Add a script entry: `"ingest": "tsx src/scripts/ingest.ts"`.

---

## Phase 5: RAG Logic Implementation
**Goal:** Update `ChatService` to use retrieved context.

1.  **Update `src/services/chat.service.ts`:**
    - **Vector Search:** Add a private method to generate embeddings for the user question and query the database for the top 3 similar chunks.
    - **Prompt Engineering:**
      - Update the `SYSTEM_PROMPT` to include the TCC project disclaimer.
      - Inject the retrieved chunks into the prompt before sending it to Gemini.
    - **Logic Refinement:** Ensure the bot handles cases where no relevant context is found.

---

## Phase 6: Validation & Testing
**Goal:** Ensure the RAG system works as expected.

1.  **Ingestion Test:**
    - Run `npm run ingest https://www.ifnmg.edu.br/aracuai` and verify data in the `documents` table.
2.  **RAG Flow Test:**
    - Send questions about IFNMG Araçuaí via the chat endpoint.
    - Verify that the response contains specific information from the site.
    - Verify that the disclaimer is present.
3.  **Performance Check:**
    - Ensure search latency is within acceptable limits (< 2 seconds).

---

## File Summary of Changes
| File | Action | Description |
| :--- | :--- | :--- |
| `docker-compose.yml` | Update | Change to `pgvector/pgvector:pg16`. |
| `prisma/schema.prisma` | Update | Add `Document` model. |
| `src/lib/gemini.ts` | Update | Add `embeddingModel`. |
| `src/scripts/ingest.ts` | Create | New ingestion CLI script. |
| `src/services/chat.service.ts` | Update | Implement vector search and context injection. |
| `package.json` | Update | Add `ingest` script. |
