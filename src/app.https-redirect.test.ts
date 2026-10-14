import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/prisma", () => ({
	prisma: {
		user: { findUnique: vi.fn(), create: vi.fn() },
		chat: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
		message: { create: vi.fn() },
		department: { findMany: vi.fn() },
	},
}));
vi.mock("./lib/gemini", () => ({
	geminiEmbedding: { embedContent: vi.fn() },
	getChatModel: vi.fn(),
}));

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_CORS_ORIGIN = process.env.CORS_ORIGIN;

async function buildAppWithEnv(nodeEnv: string, corsOrigin?: string) {
	vi.resetModules();
	process.env.NODE_ENV = nodeEnv;
	if (corsOrigin) process.env.CORS_ORIGIN = corsOrigin;
	const { buildApp } = await import("./app.js");
	return buildApp({ logger: false });
}

describe("app.ts — HTTPS enforcement behind a TLS-terminating proxy (production only)", () => {
	let app: FastifyInstance | undefined;

	afterEach(async () => {
		await app?.close();
		app = undefined;
		process.env.NODE_ENV = ORIGINAL_NODE_ENV;
		process.env.CORS_ORIGIN = ORIGINAL_CORS_ORIGIN;
		vi.resetModules();
	});

	it("redirects to https when the proxy reports the original request was http", async () => {
		app = await buildAppWithEnv("production", "https://app.example.com");

		const response = await app.inject({
			method: "GET",
			url: "/chats",
			headers: { "x-forwarded-proto": "http", host: "api.example.com" },
		});

		expect(response.statusCode).toBe(301);
		expect(response.headers.location).toBe("https://api.example.com/chats");
	});

	it("does not redirect when the proxy reports https", async () => {
		app = await buildAppWithEnv("production", "https://app.example.com");

		const response = await app.inject({
			method: "GET",
			url: "/chats",
			headers: {
				"x-forwarded-proto": "https",
				host: "api.example.com",
				authorization: "Bearer not-a-real-token",
			},
		});

		// Reaches the actual route (401 from a bad token) instead of a 301.
		expect(response.statusCode).not.toBe(301);
	});

	it("never redirects /health, since PaaS health checks hit the container directly over plain HTTP", async () => {
		app = await buildAppWithEnv("production", "https://app.example.com");

		const response = await app.inject({
			method: "GET",
			url: "/health",
			headers: { "x-forwarded-proto": "http", host: "internal" },
		});

		expect(response.statusCode).toBe(200);
	});

	it("does not redirect in development (no proxy in front locally)", async () => {
		app = await buildAppWithEnv("development");

		const response = await app.inject({
			method: "GET",
			url: "/chats",
			headers: { "x-forwarded-proto": "http", host: "localhost:3333" },
		});

		expect(response.statusCode).not.toBe(301);
	});
});
