import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
	GEMINI_API_KEY: z.string().min(1),
	DATABASE_URL: z.string().url(),
	JWT_SECRET: z.string().min(16),
	PORT: z.coerce.number().default(3333),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
	console.error("❌ Invalid environment variables", _env.error.format());
	throw new Error("Invalid environment variables");
}

export const env = _env.data;
