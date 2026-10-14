import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastify, { type FastifyInstance } from "fastify";
import { env } from "./config/env";
import { authRoutes } from "./routes/auth.routes";
import { chatRoutes } from "./routes/chat.routes";

export interface BuildAppOptions {
	logger?: boolean;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
	const app = fastify({ logger: options.logger ?? true });

	app.register(cors, {
		origin: "*",
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	});

	app.register(fastifyJwt, {
		secret: env.JWT_SECRET,
	});

	app.register(authRoutes);
	app.register(chatRoutes);

	app.get("/health", async () => {
		return { status: "ok" };
	});

	return app;
}
