import { afterEach, describe, expect, it, vi } from "vitest";

// Neutraliza o `import "dotenv/config"` dentro de env.ts: sem isso, o dotenv
// recarregaria as variáveis do .env real do projeto e mascararia os cenários
// de "variável ausente" que este arquivo testa.
vi.mock("dotenv/config", () => ({}));

const ORIGINAL_ENV: Record<string, string> = Object.fromEntries(
	Object.entries(process.env).filter(([, v]) => v !== undefined),
) as Record<string, string>;

async function loadEnvWith(
	overrides: Record<string, string>,
	omit: string[] = [],
) {
	vi.resetModules();
	const nextEnv: Record<string, string> = { ...ORIGINAL_ENV, ...overrides };
	for (const key of omit) delete nextEnv[key];
	process.env = nextEnv;
	return import("./env.js");
}

describe("config/env", () => {
	afterEach(() => {
		process.env = { ...ORIGINAL_ENV };
		vi.resetModules();
	});

	it("loads successfully when all required variables are present", async () => {
		const { env } = await loadEnvWith({
			GEMINI_API_KEY: "a-valid-key",
			DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
			JWT_SECRET: "a-secret-that-is-long-enough",
			PORT: "4000",
		});

		expect(env.GEMINI_API_KEY).toBe("a-valid-key");
		expect(env.PORT).toBe(4000);
	});

	it("defaults PORT to 3333 when not provided", async () => {
		const { env } = await loadEnvWith(
			{
				GEMINI_API_KEY: "a-valid-key",
				DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
				JWT_SECRET: "a-secret-that-is-long-enough",
			},
			["PORT"],
		);

		expect(env.PORT).toBe(3333);
	});

	it("throws instead of booting when GEMINI_API_KEY is missing", async () => {
		await expect(
			loadEnvWith(
				{
					DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
					JWT_SECRET: "a-secret-that-is-long-enough",
				},
				["GEMINI_API_KEY"],
			),
		).rejects.toThrow("Invalid environment variables");
	});

	it("throws instead of booting when DATABASE_URL is not a valid URL", async () => {
		await expect(
			loadEnvWith({
				GEMINI_API_KEY: "a-valid-key",
				DATABASE_URL: "not-a-url",
				JWT_SECRET: "a-secret-that-is-long-enough",
			}),
		).rejects.toThrow("Invalid environment variables");
	});

	it("throws instead of booting when JWT_SECRET is missing or too short (blocks the insecure hardcoded fallback)", async () => {
		await expect(
			loadEnvWith(
				{
					GEMINI_API_KEY: "a-valid-key",
					DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
					JWT_SECRET: "short",
				},
				[],
			),
		).rejects.toThrow("Invalid environment variables");
	});
});
