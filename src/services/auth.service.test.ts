import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
	user: {
		findUnique: vi.fn(),
		create: vi.fn(),
	},
};

vi.mock("../lib/prisma", () => ({ prisma: prismaMock }));

describe("services/auth.service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("registerSchema", () => {
		it("rejects passwords without an uppercase letter", async () => {
			const { registerSchema } = await import("./auth.service.js");
			const result = registerSchema.safeParse({
				name: "Ana",
				email: "ana@example.com",
				password: "senha123",
			});
			expect(result.success).toBe(false);
		});

		it("rejects passwords without a digit", async () => {
			const { registerSchema } = await import("./auth.service.js");
			const result = registerSchema.safeParse({
				name: "Ana",
				email: "ana@example.com",
				password: "SenhaForte",
			});
			expect(result.success).toBe(false);
		});

		it("rejects passwords shorter than 6 characters", async () => {
			const { registerSchema } = await import("./auth.service.js");
			const result = registerSchema.safeParse({
				name: "Ana",
				email: "ana@example.com",
				password: "S1a",
			});
			expect(result.success).toBe(false);
		});

		it("rejects malformed emails", async () => {
			const { registerSchema } = await import("./auth.service.js");
			const result = registerSchema.safeParse({
				name: "Ana",
				email: "not-an-email",
				password: "Senha123",
			});
			expect(result.success).toBe(false);
		});

		it("accepts a name/email/password that satisfies every rule", async () => {
			const { registerSchema } = await import("./auth.service.js");
			const result = registerSchema.safeParse({
				name: "Ana",
				email: "ana@example.com",
				password: "Senha123",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("AuthService.register", () => {
		it("rejects registration when the e-mail is already in use", async () => {
			prismaMock.user.findUnique.mockResolvedValue({
				id: "existing-id",
				email: "ana@example.com",
			});
			const { AuthService } = await import("./auth.service.js");
			const service = new AuthService();

			await expect(
				service.register({
					name: "Ana",
					email: "ana@example.com",
					password: "Senha123",
				}),
			).rejects.toThrow("Usuário já cadastrado com este e-mail.");

			expect(prismaMock.user.create).not.toHaveBeenCalled();
		});

		it("hashes the password before persisting and never returns it", async () => {
			prismaMock.user.findUnique.mockResolvedValue(null);
			prismaMock.user.create.mockImplementation(async ({ data }: any) => ({
				id: "new-id",
				...data,
			}));

			const { AuthService } = await import("./auth.service.js");
			const service = new AuthService();

			const result = await service.register({
				name: "Ana",
				email: "ana@example.com",
				password: "Senha123",
			});

			const persistedData = prismaMock.user.create.mock.calls[0][0].data;
			expect(persistedData.password).not.toBe("Senha123");
			expect(await bcrypt.compare("Senha123", persistedData.password)).toBe(
				true,
			);

			expect(result).toEqual({
				id: "new-id",
				name: "Ana",
				email: "ana@example.com",
			});
			expect((result as any).password).toBeUndefined();
		});
	});

	describe("AuthService.authenticate", () => {
		it("rejects login for an e-mail that does not exist", async () => {
			prismaMock.user.findUnique.mockResolvedValue(null);
			const { AuthService } = await import("./auth.service.js");
			const service = new AuthService();

			await expect(
				service.authenticate({
					email: "ghost@example.com",
					password: "Senha123",
				}),
			).rejects.toThrow("E-mail ou senha inválidos.");
		});

		it("rejects login with a wrong password without revealing which field was wrong", async () => {
			const storedHash = await bcrypt.hash("CorrectPass1", 8);
			prismaMock.user.findUnique.mockResolvedValue({
				id: "user-id",
				name: "Ana",
				email: "ana@example.com",
				password: storedHash,
			});
			const { AuthService } = await import("./auth.service.js");
			const service = new AuthService();

			await expect(
				service.authenticate({
					email: "ana@example.com",
					password: "WrongPass1",
				}),
			).rejects.toThrow("E-mail ou senha inválidos.");
		});

		it("returns the user without the password hash on a correct login", async () => {
			const storedHash = await bcrypt.hash("CorrectPass1", 8);
			prismaMock.user.findUnique.mockResolvedValue({
				id: "user-id",
				name: "Ana",
				email: "ana@example.com",
				password: storedHash,
			});
			const { AuthService } = await import("./auth.service.js");
			const service = new AuthService();

			const result = await service.authenticate({
				email: "ana@example.com",
				password: "CorrectPass1",
			});

			expect(result).toEqual({
				id: "user-id",
				name: "Ana",
				email: "ana@example.com",
			});
			expect((result as any).password).toBeUndefined();
		});
	});
});
