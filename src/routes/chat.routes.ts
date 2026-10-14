import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ChatController } from "@/controllers/chat.controller.js";
import {
	CSRF_COOKIE_NAME,
	CSRF_HEADER_NAME,
} from "@/lib/auth-cookie.constants.js";
import { ChatService } from "@/services/chat.service.js";

const chatService = new ChatService();
const chatController = new ChatController(chatService);

const BEARER_PATTERN = /^Bearer\s/i;

function tokensMatch(a: string, b: string) {
	const bufferA = Buffer.from(a);
	const bufferB = Buffer.from(b);
	return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function chatRoutes(app: FastifyInstance) {
	// Autenticação roda antes de qualquer handler, fora do try/catch de cada
	// controller: assim um JWT ausente/inválido vira 401 (erro padrão do
	// fastify-jwt) em vez de ser engolido pelo catch genérico do controller
	// e virar 500.
	app.addHook("preHandler", async (request, reply) => {
		await request.jwtVerify();

		// Cookies são enviados automaticamente pelo navegador em qualquer
		// origem (é exatamente isso que CSRF explora); um header
		// Authorization, por outro lado, só vai numa requisição se o próprio
		// código do cliente o adicionar explicitamente, então não está
		// sujeito a CSRF. O critério de "veio por Bearer" é o mesmo regex que
		// o @fastify/jwt usa para escolher o header em vez do cookie — com
		// qualquer outro Authorization (ex.: Basic) ele autentica pelo cookie.
		const usedBearerAuth = BEARER_PATTERN.test(
			request.headers.authorization ?? "",
		);
		if (!usedBearerAuth && UNSAFE_METHODS.has(request.method)) {
			const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
			const csrfHeader = request.headers[CSRF_HEADER_NAME];

			if (
				typeof csrfCookie !== "string" ||
				typeof csrfHeader !== "string" ||
				!tokensMatch(csrfCookie, csrfHeader)
			) {
				return reply.status(403).send({
					code: "CSRF_INVALID",
					message: "CSRF token inválido ou ausente.",
				});
			}
		}
	});

	app.post("/chat", chatController.handle.bind(chatController));
	app.get("/chats", chatController.listAll.bind(chatController));
	app.get("/chat/:id", chatController.getHistory.bind(chatController));
	app.delete("/chat/:id", chatController.deleteChat.bind(chatController));
}
