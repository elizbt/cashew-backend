import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
	user: {
		findUnique: vi.fn(),
		create: vi.fn(),
	},
};

vi.mock("../lib/prisma", () => ({ prisma: prismaMock }));

describe("routes/auth.routes", () => {
	let app: FastifyInstance;

	beforeEach(async () => {
		vi.clearAllMocks();
		const { buildApp } = await import("../app.js");
		app = buildApp({ logger: false });
		await app.ready();
	});

	afterEach(async () => {
		await app.close();
	});

	describe("POST /register", () => {
		it("returns 201 and never echoes the password back", async () => {
			prismaMock.user.findUnique.mockResolvedValue(null);
			prismaMock.user.create.mockImplementation(async ({ data }: any) => ({
				id: "user-1",
				...data,
			}));

			const response = await app.inject({
				method: "POST",
				url: "/register",
				payload: {
					name: "Ana",
					email: "ana@example.com",
					password: "Senha123",
				},
			});

			expect(response.statusCode).toBe(201);
			const body = response.json();
			expect(body).toEqual({
				id: "user-1",
				name: "Ana",
				email: "ana@example.com",
			});
			expect(body.password).toBeUndefined();
		});

		it("returns 400 for a weak password instead of hitting the database", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/register",
				payload: { name: "Ana", email: "ana@example.com", password: "weak" },
			});

			expect(response.statusCode).toBe(400);
			expect(prismaMock.user.create).not.toHaveBeenCalled();
		});

		it("returns 400 when the e-mail is already registered", async () => {
			prismaMock.user.findUnique.mockResolvedValue({ id: "existing" });

			const response = await app.inject({
				method: "POST",
				url: "/register",
				payload: {
					name: "Ana",
					email: "ana@example.com",
					password: "Senha123",
				},
			});

			expect(response.statusCode).toBe(400);
			expect(response.json().message).toBe(
				"Usuário já cadastrado com este e-mail.",
			);
		});

		it("rejects a payload without a password field", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/register",
				payload: { name: "Ana", email: "ana@example.com" },
			});

			expect(response.statusCode).toBe(400);
		});
	});

	describe("POST /login", () => {
		it("returns a JWT and the user on valid credentials", async () => {
			const passwordHash = await bcrypt.hash("Senha123", 8);
			prismaMock.user.findUnique.mockResolvedValue({
				id: "user-1",
				name: "Ana",
				email: "ana@example.com",
				password: passwordHash,
			});

			const response = await app.inject({
				method: "POST",
				url: "/login",
				payload: { email: "ana@example.com", password: "Senha123" },
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.user).toEqual({
				id: "user-1",
				name: "Ana",
				email: "ana@example.com",
			});
			expect(typeof body.token).toBe("string");
			expect(body.token.split(".")).toHaveLength(3);

			const decoded = app.jwt.decode<{ sub: string; name: string }>(body.token);
			expect(decoded?.sub).toBe("user-1");
		});

		it("returns 401 with a generic message for a wrong password (no user enumeration)", async () => {
			const passwordHash = await bcrypt.hash("Senha123", 8);
			prismaMock.user.findUnique.mockResolvedValue({
				id: "user-1",
				name: "Ana",
				email: "ana@example.com",
				password: passwordHash,
			});

			const response = await app.inject({
				method: "POST",
				url: "/login",
				payload: { email: "ana@example.com", password: "wrong-password" },
			});

			expect(response.statusCode).toBe(401);
			expect(response.json().message).toBe("E-mail ou senha inválidos.");
		});

		it("returns the same 401 message for a non-existent e-mail as for a wrong password", async () => {
			prismaMock.user.findUnique.mockResolvedValue(null);

			const response = await app.inject({
				method: "POST",
				url: "/login",
				payload: { email: "ghost@example.com", password: "Senha123" },
			});

			expect(response.statusCode).toBe(401);
			expect(response.json().message).toBe("E-mail ou senha inválidos.");
		});

		it("returns 400 (not 401) for a malformed payload, without touching the database", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/login",
				payload: { email: "not-an-email" },
			});

			expect(response.statusCode).toBe(400);
			expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
		});
	});
});
