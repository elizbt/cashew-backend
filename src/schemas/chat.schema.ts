import { z } from "zod";

export const chatSchema = z.object({
	message: z.string().min(1, "A mensagem não pode estar vazia."),
	chatId: z.string().uuid().optional(),
});

export type ChatInput = z.infer<typeof chatSchema>;
