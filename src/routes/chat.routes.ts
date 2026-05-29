import type { FastifyInstance } from "fastify";
import { ChatController } from "@/controllers/chat.controller.js";

const chatController = new ChatController();

export async function chatRoutes(app: FastifyInstance) {
  app.post("/chat", chatController.handle.bind(chatController));
}
