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

		it("returns validation errors in the {message, issues: [{message}]} shape the frontend expects", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/register",
				payload: { name: "Ana", email: "ana@example.com", password: "weak" },
			});

			const body = response.json();
			expect(body.message).toBe("Dados inválidos");
			expect(Array.isArray(body.issues)).toBe(true);
			expect(body.issues.length).toBeGreaterThan(0);
			for (const issue of body.issues) {
				expect(typeof issue.message).toBe("string");
			}
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

		it("also sets an httpOnly session cookie and a readable CSRF cookie", async () => {
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

			const cookies = Object.fromEntries(
				response.cookies.map((c) => [c.name, c]),
			);

			expect(cookies.token).toBeDefined();
			expect(cookies.token.httpOnly).toBe(true);
			expect(cookies.token.sameSite).toBe("Lax");
			expect(cookies.token.value.split(".")).toHaveLength(3);

			expect(cookies.csrfToken).toBeDefined();
			expect(cookies.csrfToken.httpOnly).toBeFalsy();
			expect(cookies.csrfToken.value.length).toBeGreaterThan(20);

			// double-submit: token e csrfToken devem ser valores diferentes
			expect(cookies.csrfToken.value).not.toBe(cookies.token.value);
		});

		it("returns the CSRF token in the body too, matching the cookie (frontend on another host can't read the cookie)", async () => {
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

			const csrfCookie = response.cookies.find((c) => c.name === "csrfToken");
			expect(response.json().csrfToken).toBe(csrfCookie?.value);
		});

		it("marks cookies Secure only outside development (secure requires HTTPS, which local dev usually isn't)", async () => {
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

			const tokenCookie = response.cookies.find((c) => c.name === "token");
			// NODE_ENV in this test run is "test", not "production"
			expect(tokenCookie?.secure).toBeFalsy();
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

	describe("GET /csrf", () => {
		it("rejects a request without a session with 401", async () => {
			const response = await app.inject({ method: "GET", url: "/csrf" });

			expect(response.statusCode).toBe(401);
		});

		it("returns the CSRF token of the current session cookie", async () => {
			const token = app.jwt.sign({ name: "Ana" }, { sub: "user-1" });

			const response = await app.inject({
				method: "GET",
				url: "/csrf",
				cookies: { token, csrfToken: "existing-csrf-value" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({ csrfToken: "existing-csrf-value" });
		});

		it("issues a new CSRF cookie when the session has none yet", async () => {
			const token = app.jwt.sign({ name: "Ana" }, { sub: "user-1" });

			const response = await app.inject({
				method: "GET",
				url: "/csrf",
				cookies: { token },
			});

			const csrfCookie = response.cookies.find((c) => c.name === "csrfToken");
			expect(csrfCookie?.value.length).toBeGreaterThan(20);
			expect(response.json().csrfToken).toBe(csrfCookie?.value);
		});
	});

	describe("POST /logout", () => {
		it("clears both session cookies (only the server can, since token is httpOnly)", async () => {
			const response = await app.inject({ method: "POST", url: "/logout" });

			expect(response.statusCode).toBe(204);

			const cookies = Object.fromEntries(
				response.cookies.map((c) => [c.name, c]),
			);
			expect(cookies.token.value).toBe("");
			expect(cookies.csrfToken.value).toBe("");
		});
	});

	describe("brute-force rate limiting", () => {
		it("blocks a 6th /login attempt from the same IP within a minute with 429", async () => {
			prismaMock.user.findUnique.mockResolvedValue(null);
			const attempt = () =>
				app.inject({
					method: "POST",
					url: "/login",
					payload: { email: "attacker@example.com", password: "GuessMe1" },
				});

			const results = [];
			for (let i = 0; i < 6; i++) {
				results.push(await attempt());
			}

			expect(results.slice(0, 5).map((r) => r.statusCode)).toEqual([
				401, 401, 401, 401, 401,
			]);
			expect(results[5].statusCode).toBe(429);
		});

		it("blocks a 6th /register attempt from the same IP within a minute with 429", async () => {
			prismaMock.user.findUnique.mockResolvedValue(null);
			prismaMock.user.create.mockImplementation(async ({ data }: any) => ({
				id: "user-1",
				...data,
			}));
			const attempt = (email: string) =>
				app.inject({
					method: "POST",
					url: "/register",
					payload: { name: "Ana", email, password: "Senha123" },
				});

			const results = [];
			for (let i = 0; i < 6; i++) {
				results.push(await attempt(`ana${i}@example.com`));
			}

			expect(results[5].statusCode).toBe(429);
		});

		it("still blocks a 6th /login attempt when the client rotates a spoofed X-Forwarded-For", async () => {
			prismaMock.user.findUnique.mockResolvedValue(null);
			// O proxy confiável sempre anexa o IP real do cliente no fim da
			// lista; o que vem antes é escolhido pelo cliente e não pode mudar
			// a chave do rate limit.
			const attempt = (i: number) =>
				app.inject({
					method: "POST",
					url: "/login",
					headers: { "x-forwarded-for": `10.0.0.${i}, 203.0.113.7` },
					payload: { email: "attacker@example.com", password: "GuessMe1" },
				});

			const results = [];
			for (let i = 0; i < 6; i++) {
				results.push(await attempt(i));
			}

			expect(results[5].statusCode).toBe(429);
		});

		it("does not rate-limit /chat or /health (different route, different limiter scope)", async () => {
			// The plugin is registered with global:false, so anything that
			// doesn't opt in via config.rateLimit must stay unaffected even
			// after several rapid requests.
			const responses = await Promise.all(
				Array.from({ length: 10 }, () =>
					app.inject({ method: "GET", url: "/health" }),
				),
			);

			for (const response of responses) {
				expect(response.statusCode).toBe(200);
			}
		});
	});
});
