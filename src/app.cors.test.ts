import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

// Sem isso, o dotenv recarregaria CORS_ORIGIN do .env real (local ou CI) a
// cada vi.resetModules() e mascararia o cenário "variável ausente".
vi.mock("dotenv/config", () => ({}));
vi.mock("./lib/prisma", () => ({ prisma: {} }));
vi.mock("./lib/gemini", () => ({
	geminiEmbedding: { embedContent: vi.fn() },
	getChatModel: vi.fn(),
}));

async function buildAppWithCorsOrigin(corsOrigin: string | undefined) {
	vi.resetModules();
	vi.stubEnv("GEMINI_API_KEY", "a-valid-key");
	vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db");
	vi.stubEnv("JWT_SECRET", "a-secret-that-is-long-enough");
	vi.stubEnv("NODE_ENV", "test");
	vi.stubEnv("CORS_ORIGIN", corsOrigin);
	const { buildApp } = await import("./app.js");
	return buildApp({ logger: false });
}

function allowedOrigin(app: FastifyInstance, origin: string) {
	return app
		.inject({ method: "GET", url: "/health", headers: { origin } })
		.then((response) => response.headers["access-control-allow-origin"]);
}

describe("app.ts — CORS allowlist", () => {
	let app: FastifyInstance | undefined;

	afterEach(async () => {
		await app?.close();
		app = undefined;
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("allows only localhost origins when CORS_ORIGIN is not set", async () => {
		app = await buildAppWithCorsOrigin(undefined);

		expect(await allowedOrigin(app, "http://localhost:5173")).toBe(
			"http://localhost:5173",
		);
		expect(await allowedOrigin(app, "http://127.0.0.1:3000")).toBe(
			"http://127.0.0.1:3000",
		);
		expect(
			await allowedOrigin(app, "https://evil.example.com"),
		).toBeUndefined();
		expect(
			await allowedOrigin(app, "http://localhost.evil.com"),
		).toBeUndefined();
	});

	it("allows only the configured origins when CORS_ORIGIN is set", async () => {
		app = await buildAppWithCorsOrigin("https://app.example.com");

		expect(await allowedOrigin(app, "https://app.example.com")).toBe(
			"https://app.example.com",
		);
		expect(await allowedOrigin(app, "http://localhost:5173")).toBeUndefined();
	});
});
