import type { FastifyInstance } from "fastify";
import { ChatController } from "@/controllers/chat.controller.js";
import { ChatService } from "@/services/chat.service.js";

const chatService = new ChatService();
const chatController = new ChatController(chatService);

export async function chatRoutes(app: FastifyInstance) {
	app.post("/chat", chatController.handle.bind(chatController));
	app.get("/chat/:id", chatController.getHistory.bind(chatController));
	app.delete("/chat/:id", chatController.deleteChat.bind(chatController));
}
