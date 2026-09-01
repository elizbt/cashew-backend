import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PrismaClientMock = vi.fn().mockImplementation(function PrismaClient(
	this: any,
) {
	this.marker = Symbol("prisma-instance");
});

vi.mock("@prisma/client", () => ({ PrismaClient: PrismaClientMock }));

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe("lib/prisma", () => {
	beforeEach(() => {
		vi.resetModules();
		PrismaClientMock.mockClear();
		// biome-ignore lint: test-only cleanup of the global singleton
		(globalThis as any).prisma = undefined;
	});

	afterEach(() => {
		process.env.NODE_ENV = ORIGINAL_NODE_ENV;
		(globalThis as any).prisma = undefined;
	});

	it("creates a single PrismaClient instance and caches it on globalThis outside production", async () => {
		process.env.NODE_ENV = "development";

		const { prisma: first } = await import("./prisma.js");
		expect(PrismaClientMock).toHaveBeenCalledTimes(1);
		expect((globalThis as any).prisma).toBe(first);

		vi.resetModules();
		const { prisma: second } = await import("./prisma.js");

		// The module re-runs, but it must reuse the instance already cached
		// on globalThis instead of opening a second database connection
		// (the classic "too many Prisma clients" dev hot-reload bug).
		expect(PrismaClientMock).toHaveBeenCalledTimes(1);
		expect(second).toBe(first);
	});

	it("does not pollute globalThis in production", async () => {
		process.env.NODE_ENV = "production";

		await import("./prisma.js");

		expect((globalThis as any).prisma).toBeUndefined();
	});
});
