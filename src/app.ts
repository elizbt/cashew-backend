import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastifyJwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import fastify, { type FastifyInstance } from "fastify";
import { env } from "./config/env";
import { AUTH_COOKIE_NAME } from "./lib/auth-cookies";
import { authRoutes } from "./routes/auth.routes";
import { chatRoutes } from "./routes/chat.routes";

export interface BuildAppOptions {
	logger?: boolean;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
	// trustProxy: em produção rodamos atrás de um proxy/PaaS que termina TLS
	// (Render/Railway/Fly/Nginx...) — isso faz o Fastify calcular
	// request.protocol/request.ip a partir de X-Forwarded-Proto/-For em vez
	// do socket cru, que sempre chega como HTTP vindo do proxy.
	const app = fastify({ logger: options.logger ?? true, trustProxy: true });

	const corsOrigin = env.CORS_ORIGIN
		? env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
		: true; // dev sem CORS_ORIGIN definido: reflete a origem da requisição

	app.register(cors, {
		origin: corsOrigin,
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	});

	// API pura (sem HTML/estáticos), então a CSP por si só tem pouco efeito
	// aqui — o que importa são os headers que independem de servir HTML:
	// HSTS, X-Content-Type-Options e X-Frame-Options.
	app.register(helmet, {
		global: true,
		contentSecurityPolicy: false,
	});

	app.register(cookie);

	app.register(fastifyJwt, {
		secret: env.JWT_SECRET,
		// Permite autenticar tanto via header Authorization: Bearer (clientes
		// não-browser, e fallback durante a migração do frontend) quanto via
		// o cookie httpOnly setado no login.
		cookie: { cookieName: AUTH_COOKIE_NAME, signed: false },
	});

	// global: false → nada é limitado por padrão; /login e /register opt-in
	// via `config.rateLimit` na própria definição da rota (auth.routes.ts).
	app.register(rateLimit, { global: false });

	// Em produção, qualquer requisição que chegue como HTTP puro (via
	// X-Forwarded-Proto, graças ao trustProxy acima) é redirecionada para
	// HTTPS. /health fica de fora porque health checks internos do
	// proxy/PaaS costumam bater direto no container, sem esse header.
	if (env.NODE_ENV === "production") {
		app.addHook("onRequest", async (request, reply) => {
			if (request.url === "/health") return;
			if (request.protocol !== "https") {
				return reply.redirect(
					`https://${request.headers.host}${request.url}`,
					301,
				);
			}
		});
	}

	app.register(authRoutes);
	app.register(chatRoutes);

	app.get("/health", async () => {
		return { status: "ok" };
	});

	return app;
}
