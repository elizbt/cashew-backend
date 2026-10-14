import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config({ override: true });

const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const chatModelName = (
	process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash"
).trim();
const fallbackModelName = (
	process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite"
).trim();
const embeddingModelName = (
	process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001"
).trim();

if (!apiKey) {
	console.warn("Aviso: GEMINI_API_KEY não encontrada.");
}

const genAI = new GoogleGenerativeAI(apiKey);

export function getChatModel(systemInstruction?: string, useFallback = false) {
	return genAI.getGenerativeModel({
		model: useFallback ? fallbackModelName : chatModelName,
		systemInstruction,
		generationConfig: {
			temperature: 0.2,
		},
	});
}

export const embeddingModel = genAI.getGenerativeModel({
	model: embeddingModelName,
});

// A coluna "embedding" no banco é vector(3072) (ver prisma/migrations),
// a dimensão nativa (sem truncation via Matryoshka) do gemini-embedding-001.
// Sem índice ANN, a busca é um scan sequencial — custo linear no número de
// chunks, ainda não medido. Os índices HNSW/IVFFlat do pgvector aceitam no
// máximo 2000 dimensões para o tipo vector: se um índice for necessário,
// migrar a coluna para halfvec(3072) ou truncar a dimensionalidade.
const EMBEDDING_DIMENSIONS = 3072;

export const geminiEmbedding = {
	async embedContent(text: string) {
		const result = await embeddingModel.embedContent({
			content: { role: "user", parts: [{ text }] },
			outputDimensionality: EMBEDDING_DIMENSIONS,
		} as Parameters<typeof embeddingModel.embedContent>[0]);
		return {
			embedding: {
				values: result.embedding.values,
			},
		};
	},
};
