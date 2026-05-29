import { FastifyReply, FastifyRequest } from 'fastify';
import { ChatService } from '@/services/chat.service.js';
import { chatSchema } from '@/schemas/chat.schema.js';

const chatService = new ChatService();

export class ChatController {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = chatSchema.parse(request.body);
      const result = await chatService.sendMessage(data.message, data.chatId);

      return reply.status(200).send(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ message: 'Validation error', issues: error.format() });
      }

      console.error(error);
      return reply.status(500).send({ message: 'Internal server error' });
    }
  }
}
