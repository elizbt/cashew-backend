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
	process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004"
).trim();

if (!apiKey) {
	console.warn("Aviso: GEMINI_API_KEY não encontrada.");
}

const genAI = new GoogleGenerativeAI(apiKey);

export function getChatModel(systemInstruction?: string, useFallback = false) {
	return genAI.getGenerativeModel({
		model: useFallback ? fallbackModelName : chatModelName,
		systemInstruction,
	});
}

export const embeddingModel = genAI.getGenerativeModel({
	model: embeddingModelName,
});

export const geminiEmbedding = {
	async embedContent(text: string) {
		const result = await embeddingModel.embedContent(text);
		return {
			embedding: {
				values: result.embedding.values,
			},
		};
	},
};
