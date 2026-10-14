import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: false,
		include: ["src/**/*.test.ts"],
		// Valores fictícios para que a suíte não dependa do .env local nem
		// chegue a serviços reais. O dotenv não sobrescreve variáveis já
		// definidas, então estes valores vencem um .env presente na máquina.
		env: {
			GEMINI_API_KEY: "test-gemini-key",
			DATABASE_URL: "postgresql://test:test@localhost:5432/test",
			JWT_SECRET: "test-jwt-secret-with-enough-length",
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.test.ts",
				"src/scripts/**",
				"src/server.ts",
				"src/generated/**",
			],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
