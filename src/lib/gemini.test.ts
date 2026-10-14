import { beforeEach, describe, expect, it, vi } from "vitest";

const getGenerativeModelMock = vi.fn();
const embedContentMock = vi.fn();

vi.mock("@google/generative-ai", () => {
	class GoogleGenerativeAI {
		getGenerativeModel = getGenerativeModelMock;
	}
	return { GoogleGenerativeAI };
});
// gemini.ts calls dotenv.config({ override: true }) at import time, which
// would otherwise re-populate GEMINI_API_KEY from the real .env and mask
// the "missing key" warning test below.
vi.mock("dotenv", () => ({ config: vi.fn() }));

describe("lib/gemini", () => {
	beforeEach(() => {
		vi.resetModules();
		getGenerativeModelMock.mockReset();
		embedContentMock.mockReset();
		getGenerativeModelMock.mockReturnValue({ embedContent: embedContentMock });
	});

	it("selects the primary chat model with a low, deterministic temperature", async () => {
		const { getChatModel } = await import("./gemini.js");

		getChatModel("system instruction", false);

		expect(getGenerativeModelMock).toHaveBeenCalledWith(
			expect.objectContaining({
				model: expect.any(String),
				systemInstruction: "system instruction",
				generationConfig: expect.objectContaining({ temperature: 0.2 }),
			}),
		);
	});

	it("switches to the fallback model name when useFallback is true", async () => {
		const { getChatModel } = await import("./gemini.js");

		getChatModel(undefined, false);
		const primaryModel = getGenerativeModelMock.mock.calls.at(-1)?.[0].model;

		getChatModel(undefined, true);
		const fallbackModel = getGenerativeModelMock.mock.calls.at(-1)?.[0].model;

		expect(fallbackModel).not.toBe(primaryModel);
	});

	it("requests embeddings truncated to 3072 dimensions to match the documents.embedding column", async () => {
		embedContentMock.mockResolvedValue({ embedding: { values: [0.1, 0.2] } });

		const { geminiEmbedding } = await import("./gemini.js");
		await geminiEmbedding.embedContent("qual curso devo escolher?");

		expect(embedContentMock).toHaveBeenCalledWith(
			expect.objectContaining({
				content: {
					role: "user",
					parts: [{ text: "qual curso devo escolher?" }],
				},
				outputDimensionality: 3072,
			}),
		);
	});

	it("returns only the embedding values from the SDK response", async () => {
		embedContentMock.mockResolvedValue({
			embedding: { values: [1, 2, 3] },
		});

		const { geminiEmbedding } = await import("./gemini.js");
		const result = await geminiEmbedding.embedContent("texto qualquer");

		expect(result).toEqual({ embedding: { values: [1, 2, 3] } });
	});

	it("warns instead of crashing at boot when GEMINI_API_KEY is missing", async () => {
		const originalKey = process.env.GEMINI_API_KEY;
		delete process.env.GEMINI_API_KEY;
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		try {
			await import("./gemini.js");
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining("GEMINI_API_KEY"),
			);
		} finally {
			warnSpy.mockRestore();
			process.env.GEMINI_API_KEY = originalKey;
		}
	});
});
