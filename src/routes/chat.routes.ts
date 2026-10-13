import type { FastifyInstance } from "fastify";
import { ChatController } from "@/controllers/chat.controller.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/auth-cookies.js";
import { ChatService } from "@/services/chat.service.js";

const chatService = new ChatService();
const chatController = new ChatController(chatService);

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
		// sujeito a CSRF. Só exigimos o double-submit token quando a sessão
		// atual depende do cookie.
		const usedCookieAuth = !request.headers.authorization;
		if (usedCookieAuth && UNSAFE_METHODS.has(request.method)) {
			const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
			const csrfHeader = request.headers[CSRF_HEADER_NAME];

			if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
				return reply
					.status(403)
					.send({ message: "CSRF token inválido ou ausente." });
			}
		}
	});

	app.post("/chat", chatController.handle.bind(chatController));
	app.get("/chats", chatController.listAll.bind(chatController));
	app.get("/chat/:id", chatController.getHistory.bind(chatController));
	app.delete("/chat/:id", chatController.deleteChat.bind(chatController));
}
