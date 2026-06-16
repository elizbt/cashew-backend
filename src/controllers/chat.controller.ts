import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { chatSchema } from "@/schemas/chat.schema.js";
import type { ChatService } from "@/services/chat.service.js";

import { z } from "zod";

export class ChatController {
	constructor(private chatService: ChatService) {}

	async handle(request: FastifyRequest, reply: FastifyReply) {
		try {
			await request.jwtVerify();
			const userId = (request.user as any).sub as string;

			const data = chatSchema.parse(request.body);
			const result = await this.chatService.sendMessage(
				data.message,
				userId,
				data.chatId,
			);

			return reply.status(200).send(result);
		} catch (error: unknown) {
			if (error instanceof ZodError) {
				return reply.status(400).send({
					message: "Erro de validação nos dados enviados.",
					issues: error.format(),
				});
			}

			console.error("Erro inesperado no ChatController:", error);
			return reply
				.status(500)
				.send({ message: "Ocorreu um erro interno no servidor." });
		}
	}

	async getHistory(request: FastifyRequest, reply: FastifyReply) {
		try {
			await request.jwtVerify();
			const userId = (request.user as any).sub as string;

			const paramsSchema = z.object({
				id: z.string().uuid(),
			});

			const { id } = paramsSchema.parse(request.params);
			const chat = await this.chatService.getChatMessages(id);

			if (!chat || chat.userId !== userId) {
				return reply.status(404).send({ message: "Conversa não encontrada." });
			}

			return reply.status(200).send(chat);
		} catch (error: unknown) {
			if (error instanceof ZodError) {
				return reply.status(400).send({ message: "ID de conversa inválido." });
			}

			return reply.status(500).send({ message: "Erro ao buscar histórico." });
		}
	}

	async deleteChat(request: FastifyRequest, reply: FastifyReply) {
		try {
			await request.jwtVerify();
			const userId = (request.user as any).sub as string;

			const paramsSchema = z.object({
				id: z.string().uuid(),
			});

			const { id } = paramsSchema.parse(request.params);

			await this.chatService.deleteChat(id, userId);

			return reply.status(204).send();
		} catch (error: unknown) {
			if (error instanceof ZodError) {
				return reply.status(400).send({ message: "ID de conversa inválido." });
			}

			if (error instanceof Error && error.message === "Chat not found or not owned by user") {
				return reply.status(404).send({ message: "Conversa não encontrada." });
			}

			console.error("Erro ao deletar chat:", error);
			return reply.status(500).send({ message: "Erro ao deletar conversa." });
		}
	}
}
