import type { FastifyInstance } from "fastify";
import { ChatController } from "@/controllers/chat.controller.js";
import { ChatService } from "@/services/chat.service.js";

const chatService = new ChatService();
const chatController = new ChatController(chatService);

export async function chatRoutes(app: FastifyInstance) {
	// Autenticação roda antes de qualquer handler, fora do try/catch de cada
	// controller: assim um JWT ausente/inválido vira 401 (erro padrão do
	// fastify-jwt) em vez de ser engolido pelo catch genérico do controller
	// e virar 500.
	app.addHook("preHandler", async (request) => {
		await request.jwtVerify();
	});

	app.post("/chat", chatController.handle.bind(chatController));
	app.get("/chats", chatController.listAll.bind(chatController));
	app.get("/chat/:id", chatController.getHistory.bind(chatController));
	app.delete("/chat/:id", chatController.deleteChat.bind(chatController));
}
