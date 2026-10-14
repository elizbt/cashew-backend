import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.fn();
const prismaMock = {
	$queryRaw: queryRawMock,
	$transaction: vi.fn(),
	chat: {
		findUnique: vi.fn(),
		create: vi.fn(),
		findMany: vi.fn(),
		delete: vi.fn(),
	},
	message: {
		create: vi.fn(),
		deleteMany: vi.fn(),
	},
	unansweredQuestion: { create: vi.fn() },
	department: { findMany: vi.fn() },
};

const embedContentMock = vi.fn();
const getChatModelMock = vi.fn();
const sendMessageMock = vi.fn();

vi.mock("../lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../lib/gemini", () => ({
	geminiEmbedding: { embedContent: embedContentMock },
	getChatModel: getChatModelMock,
}));

describe("routes/chat.routes", () => {
	let app: FastifyInstance;
	let tokenForUser1: string;
	let tokenForUser2: string;

	beforeEach(async () => {
		vi.clearAllMocks();

		embedContentMock.mockResolvedValue({ embedding: { values: [0.1] } });
		queryRawMock.mockResolvedValue([]);
		prismaMock.department.findMany.mockResolvedValue([]);
		prismaMock.chat.create.mockImplementation(async ({ data }: any) => ({
			id: "new-chat-id",
			userId: data.userId,
			messages: [],
		}));
		getChatModelMock.mockReturnValue({
			startChat: () => ({ sendMessage: sendMessageMock }),
		});
		sendMessageMock.mockResolvedValue({ response: { text: () => "ok" } });

		const { buildApp } = await import("../app.js");
		app = buildApp({ logger: false });
		await app.ready();

		tokenForUser1 = app.jwt.sign({ name: "User 1" }, { sub: "user-1" });
		tokenForUser2 = app.jwt.sign({ name: "User 2" }, { sub: "user-2" });
	});

	afterEach(async () => {
		await app.close();
	});

	describe("CORS without CORS_ORIGIN", () => {
		it("allows a localhost origin with credentials", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
				headers: { origin: "http://localhost:5173" },
			});

			expect(response.headers["access-control-allow-origin"]).toBe(
				"http://localhost:5173",
			);
		});

		it("does not reflect an arbitrary origin", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/health",
				headers: { origin: "https://evil.example.com" },
			});

			expect(response.headers["access-control-allow-origin"]).toBeUndefined();
		});
	});

	describe("GET /health", () => {
		it("is public and reports ok", async () => {
			const response = await app.inject({ method: "GET", url: "/health" });
			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({ status: "ok" });
		});
	});

	describe("security headers", () => {
		it("sets baseline security headers (helmet) on every response", async () => {
			const response = await app.inject({ method: "GET", url: "/health" });

			expect(response.headers["x-content-type-options"]).toBe("nosniff");
			expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
			expect(response.headers["strict-transport-security"]).toBeDefined();
		});
	});

	describe("cookie-based session + CSRF (double-submit)", () => {
		it("allows a safe GET using only the cookie, no CSRF header needed", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/chats",
				cookies: { token: tokenForUser1 },
			});

			expect(response.statusCode).toBe(200);
		});

		it("blocks a cookie-authenticated POST /chat with no CSRF header at all", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/chat",
				cookies: { token: tokenForUser1, csrfToken: "the-real-csrf-value" },
				payload: { message: "Oi" },
			});

			expect(response.statusCode).toBe(403);
			expect(prismaMock.chat.create).not.toHaveBeenCalled();
		});

		it("blocks a cookie-authenticated POST /chat when the CSRF header doesn't match the cookie", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/chat",
				cookies: { token: tokenForUser1, csrfToken: "the-real-csrf-value" },
				headers: { "x-csrf-token": "a-guessed-wrong-value" },
				payload: { message: "Oi" },
			});

			expect(response.statusCode).toBe(403);
		});

		it("allows a cookie-authenticated POST /chat when the CSRF header matches the cookie", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/chat",
				cookies: { token: tokenForUser1, csrfToken: "the-real-csrf-value" },
				headers: { "x-csrf-token": "the-real-csrf-value" },
				payload: { message: "Oi" },
			});

			expect(response.statusCode).toBe(200);
		});

		it("still requires CSRF when the Authorization header is not Bearer (auth falls back to the cookie)", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/chat",
				cookies: { token: tokenForUser1, csrfToken: "the-real-csrf-value" },
				headers: { authorization: "Basic Zm9vOmJhcg==" },
				payload: { message: "Oi" },
			});

			expect(response.statusCode).toBe(403);
			expect(response.json().code).toBe("CSRF_INVALID");
		});

		it("does not require a CSRF header for Bearer-token auth (not vulnerable to CSRF)", async () => {
			// No browser attaches a custom Authorization header automatically
			// cross-site, so a request authenticated this way can only have
			// been sent deliberately by the legitimate client.
			const response = await app.inject({
				method: "POST",
				url: "/chat",
				headers: { authorization: `Bearer ${tokenForUser1}` },
				payload: { message: "Oi" },
			});

			expect(response.statusCode).toBe(200);
		});
	});

	describe("authentication guard", () => {
		it.each([
			["POST", "/chat"],
			["GET", "/chats"],
			["GET", "/chat/11111111-1111-4111-8111-111111111111"],
			["DELETE", "/chat/11111111-1111-4111-8111-111111111111"],
		])("rejects %s %s without a token", async (method, url) => {
			const response = await app.inject({ method: method as any, url });
			expect(response.statusCode).toBe(401);
		});

		it("rejects a request with a garbage/forged token", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/chats",
				headers: { authorization: "Bearer not-a-real-jwt" },
			});
			expect(response.statusCode).toBe(401);
		});

		it("rejects a token signed with a different secret", async () => {
			// A forged token can only be crafted by an attacker who knows a
			// (wrong) secret; fastify-jwt must reject it as invalid, not as
			// merely "different user".
			const jwt = await import("jsonwebtoken");
			const forged = jwt.default.sign(
				{ sub: "user-1" },
				"attacker-controlled-secret",
			);

			const response = await app.inject({
				method: "GET",
				url: "/chats",
				headers: { authorization: `Bearer ${forged}` },
			});
			expect(response.statusCode).toBe(401);
		});
	});

	describe("POST /chat", () => {
		it("accepts a valid message from an authenticated user", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/chat",
				headers: { authorization: `Bearer ${tokenForUser1}` },
				payload: { message: "Olá" },
			});

			expect(response.statusCode).toBe(200);
			expect(prismaMock.chat.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ userId: "user-1" }),
				}),
			);
		});

		it("rejects an empty message with 400", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/chat",
				headers: { authorization: `Bearer ${tokenForUser1}` },
				payload: { message: "" },
			});

			expect(response.statusCode).toBe(400);
			expect(response.json()).toEqual({
				code: "VALIDATION_ERROR",
				message: "Dados inválidos",
				issues: [{ message: expect.any(String) }],
			});
		});

		it("rejects a malformed chatId with 400", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/chat",
				headers: { authorization: `Bearer ${tokenForUser1}` },
				payload: { message: "Oi", chatId: "not-a-uuid" },
			});

			expect(response.statusCode).toBe(400);
		});

		it("returns a generic 500 (not a leaked stack trace) when persisting the chat fails unexpectedly", async () => {
			prismaMock.chat.create.mockRejectedValue(
				new Error('password authentication failed for user "johndoe"'),
			);

			const response = await app.inject({
				method: "POST",
				url: "/chat",
				headers: { authorization: `Bearer ${tokenForUser1}` },
				payload: { message: "Oi" },
			});

			expect(response.statusCode).toBe(500);
			expect(response.body).not.toContain("johndoe");
		});
	});

	describe("GET /chats", () => {
		it("returns a generic 500 (not a leaked stack trace) when the database call fails unexpectedly", async () => {
			prismaMock.chat.findMany.mockRejectedValue(
				new Error("connection refused"),
			);

			const response = await app.inject({
				method: "GET",
				url: "/chats",
				headers: { authorization: `Bearer ${tokenForUser1}` },
			});

			expect(response.statusCode).toBe(500);
			expect(response.body).not.toContain("connection refused");
		});
	});

	describe("GET /chat/:id (IDOR protection)", () => {
		it("returns 404 (not 200) for a chat owned by a different user", async () => {
			prismaMock.chat.findUnique.mockResolvedValue({
				id: "chat-1",
				userId: "user-2",
				messages: [{ role: "user", content: "segredo do user 2" }],
			});

			const response = await app.inject({
				method: "GET",
				url: "/chat/11111111-1111-4111-8111-111111111111",
				headers: { authorization: `Bearer ${tokenForUser1}` },
			});

			expect(response.statusCode).toBe(404);
			expect(response.body).not.toContain("segredo do user 2");
		});

		it("returns the identical 404 shape for a chat that truly does not exist (no existence oracle)", async () => {
			prismaMock.chat.findUnique.mockResolvedValue(null);

			const notFoundResponse = await app.inject({
				method: "GET",
				url: "/chat/11111111-1111-4111-8111-111111111111",
				headers: { authorization: `Bearer ${tokenForUser1}` },
			});

			prismaMock.chat.findUnique.mockResolvedValue({
				id: "chat-2",
				userId: "user-2",
				messages: [],
			});
			const notOwnedResponse = await app.inject({
				method: "GET",
				url: "/chat/22222222-2222-4222-8222-222222222222",
				headers: { authorization: `Bearer ${tokenForUser1}` },
			});

			expect(notFoundResponse.statusCode).toBe(notOwnedResponse.statusCode);
			expect(notFoundResponse.json()).toEqual(notOwnedResponse.json());
		});

		it("returns 200 with the messages for the owner", async () => {
			prismaMock.chat.findUnique.mockResolvedValue({
				id: "chat-1",
				userId: "user-1",
				messages: [{ role: "user", content: "minha pergunta" }],
			});

			const response = await app.inject({
				method: "GET",
				url: "/chat/11111111-1111-4111-8111-111111111111",
				headers: { authorization: `Bearer ${tokenForUser1}` },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json().messages[0].content).toBe("minha pergunta");
		});

		it("rejects a non-UUID id with 400 before ever touching the database", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/chat/not-a-uuid",
				headers: { authorization: `Bearer ${tokenForUser1}` },
			});

			expect(response.statusCode).toBe(400);
			expect(prismaMock.chat.findUnique).not.toHaveBeenCalled();
		});

		it("returns 500 (not a leaked stack trace) when the database call fails unexpectedly", async () => {
			prismaMock.chat.findUnique.mockRejectedValue(
				new Error("connection refused"),
			);

			const response = await app.inject({
				method: "GET",
				url: "/chat/11111111-1111-4111-8111-111111111111",
				headers: { authorization: `Bearer ${tokenForUser1}` },
			});

			expect(response.statusCode).toBe(500);
			expect(response.body).not.toContain("connection refused");
		});
	});

	describe("DELETE /chat/:id (IDOR protection)", () => {
		it("returns 404 and does not delete anything when the chat belongs to another user", async () => {
			prismaMock.chat.findUnique.mockResolvedValue({
				id: "chat-1",
				userId: "user-2",
			});

			const response = await app.inject({
				method: "DELETE",
				url: "/chat/11111111-1111-4111-8111-111111111111",
				headers: { authorization: `Bearer ${tokenForUser1}` },
			});

			expect(response.statusCode).toBe(404);
			expect(prismaMock.$transaction).not.toHaveBeenCalled();
		});

		it("returns 204 when the owner deletes their own chat", async () => {
			prismaMock.chat.findUnique.mockResolvedValue({
				id: "chat-1",
				userId: "user-1",
			});

			const response = await app.inject({
				method: "DELETE",
				url: "/chat/11111111-1111-4111-8111-111111111111",
				headers: { authorization: `Bearer ${tokenForUser1}` },
			});

			expect(response.statusCode).toBe(204);
			expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
		});

		it("rejects a non-UUID id with 400 before ever touching the database", async () => {
			const response = await app.inject({
				method: "DELETE",
				url: "/chat/not-a-uuid",
				headers: { authorization: `Bearer ${tokenForUser1}` },
			});

			expect(response.statusCode).toBe(400);
			expect(prismaMock.chat.findUnique).not.toHaveBeenCalled();
		});

		it("returns 500 (not a leaked stack trace) when the database call fails unexpectedly", async () => {
			prismaMock.chat.findUnique.mockRejectedValue(
				new Error("connection refused"),
			);

			const response = await app.inject({
				method: "DELETE",
				url: "/chat/11111111-1111-4111-8111-111111111111",
				headers: { authorization: `Bearer ${tokenForUser1}` },
			});

			expect(response.statusCode).toBe(500);
			expect(response.body).not.toContain("connection refused");
		});
	});

	describe("cross-user isolation end to end", () => {
		it("user 2's token cannot be used to read a chat owned by user 1, even though the record itself is found", async () => {
			// getChatMessages() looks the chat up by id alone; ownership is
			// enforced afterwards in the controller. This test pins that
			// contract down so a future refactor can't silently drop it.
			prismaMock.chat.findUnique.mockResolvedValue({
				id: "chat-1",
				userId: "user-1",
				messages: [{ role: "user", content: "dado do user 1" }],
			});

			const response = await app.inject({
				method: "GET",
				url: "/chat/11111111-1111-4111-8111-111111111111",
				headers: { authorization: `Bearer ${tokenForUser2}` },
			});

			expect(response.statusCode).toBe(404);
			expect(response.body).not.toContain("dado do user 1");
		});
	});
});
