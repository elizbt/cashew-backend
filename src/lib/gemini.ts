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

// Teto por chamada ao Gemini: sem ele um provedor lento prende o handler de
// /chat indefinidamente (e o retry com fallback em chat.service multiplica a
// espera). Fica abaixo dos 60s que o frontend espera por /chat.
const GEMINI_TIMEOUT_MS = 25_000;

export function getChatModel(systemInstruction?: string, useFallback = false) {
	return genAI.getGenerativeModel(
		{
			model: useFallback ? fallbackModelName : chatModelName,
			systemInstruction,
			generationConfig: {
				temperature: 0.2,
			},
		},
		{ timeout: GEMINI_TIMEOUT_MS },
	);
}

export const embeddingModel = genAI.getGenerativeModel(
	{ model: embeddingModelName },
	{ timeout: GEMINI_TIMEOUT_MS },
);

// A coluna "embedding" no banco é vector(3072) (ver prisma/migrations),
// a dimensão nativa (sem truncation via Matryoshka) do gemini-embedding-001.
// Com um corpus pequeno e sem índice ANN, não há custo relevante em manter
// a dimensão cheia, e a qualidade da busca é melhor do que truncando pra 768.
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
