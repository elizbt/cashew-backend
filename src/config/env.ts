import { z } from "zod";
import "dotenv/config";

const envSchema = z
	.object({
		GEMINI_API_KEY: z.string().min(1),
		DATABASE_URL: z.string().url(),
		JWT_SECRET: z.string().min(16),
		PORT: z.coerce.number().default(3333),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		// Lista de origens (separadas por vírgula) autorizadas a fazer
		// requisições com credentials (cookie de sessão). Obrigatório em
		// produção porque CORS com origin "*" não é compatível com
		// credentials: true (nem o navegador permite).
		CORS_ORIGIN: z.string().optional(),
		// Quantos proxies (TLS/LB/CDN) existem entre o cliente e o app. Define
		// qual entrada do X-Forwarded-For vira request.ip — chave do rate limit.
		TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
	})
	.refine((data) => data.NODE_ENV !== "production" || !!data.CORS_ORIGIN, {
		message:
			"CORS_ORIGIN é obrigatório quando NODE_ENV=production (não é seguro refletir/aceitar qualquer origem quando cookies com credentials estão habilitados).",
		path: ["CORS_ORIGIN"],
	});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
	console.error("❌ Invalid environment variables", _env.error.format());
	throw new Error("Invalid environment variables");
}

export const env = _env.data;
