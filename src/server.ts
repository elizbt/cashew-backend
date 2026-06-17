import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastify from "fastify";
import { env } from "@/config/env.js";
import { chatRoutes } from "@/routes/chat.routes.js";
import { authRoutes } from "@/routes/auth.routes.js";

const app = fastify({ logger: true });

app.register(cors, {
	origin: "*",
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

app.register(fastifyJwt, {
	secret: process.env.JWT_SECRET || "super-secret-tcc-key",
});

app.register(authRoutes);
app.register(chatRoutes);

app.get("/health", async () => {
	return { status: "ok" };
});

const start = async () => {
	try {
		await app.listen({ port: env.PORT, host: "0.0.0.0" });
		console.log(`🚀 Server ready at http://localhost:${env.PORT}`);
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

start();
