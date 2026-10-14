import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.fn();
const prismaMock = {
	$queryRaw: queryRawMock,
	$transaction: vi.fn(),
	chat: {
		findUnique: vi.fn(),
		create: vi.fn(),
		findMany: vi.fn(),
		delete: vi.fn(),
	},
	message: {
		create: vi.fn(),
		deleteMany: vi.fn(),
	},
	unansweredQuestion: {
		create: vi.fn(),
	},
	department: {
		findMany: vi.fn(),
	},
};

const embedContentMock = vi.fn();
const getChatModelMock = vi.fn();
const sendMessageMock = vi.fn();

vi.mock("../lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../lib/gemini", () => ({
	geminiEmbedding: { embedContent: embedContentMock },
	getChatModel: getChatModelMock,
}));

function lastQueryRawSql(): string {
	const call = queryRawMock.mock.calls.at(-1);
	const strings: TemplateStringsArray = call?.[0];
	return strings.join("?");
}

describe("services/chat.service", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		embedContentMock.mockResolvedValue({ embedding: { values: [0.1, 0.2] } });
		queryRawMock.mockResolvedValue([]);
		prismaMock.chat.create.mockImplementation(async ({ data }: any) => ({
			id: "new-chat-id",
			userId: data.userId,
			title: data.title,
			messages: [],
		}));
		prismaMock.message.create.mockResolvedValue({});
		prismaMock.department.findMany.mockResolvedValue([]);

		getChatModelMock.mockReturnValue({
			startChat: () => ({ sendMessage: sendMessageMock }),
		});
		sendMessageMock.mockResolvedValue({
			response: { text: () => "Resposta padrão do modelo." },
		});
	});

	describe("course-aware retrieval", () => {
		it("filters retrieval to the TADS course when the question mentions TADS", async () => {
			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			await service.sendMessage(
				"Quem é o coordenador do curso de TADS?",
				"user-1",
			);

			const sql = lastQueryRawSql();
			expect(sql).toContain("WHERE course = ?");
			expect(queryRawMock.mock.calls[0].slice(1)).toContain("tads");
		});

		it("detects the course regardless of accents/casing", async () => {
			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			await service.sendMessage("quem coordena ENGENHARIA AGRÍCOLA?", "user-1");

			expect(queryRawMock.mock.calls[0].slice(1)).toContain(
				"engenharia-agricola-ambiental",
			);
		});

		it("does not filter by course when the question is generic", async () => {
			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			await service.sendMessage("Qual o horário da biblioteca?", "user-1");

			const sql = lastQueryRawSql();
			expect(sql).not.toContain("WHERE course");
		});

		it("never lets raw user text reach the SQL string (only bound as a query parameter)", async () => {
			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			const malicious = "TADS'; DROP TABLE documents; --";
			await service.sendMessage(malicious, "user-1");

			const sql = lastQueryRawSql();
			expect(sql).not.toContain("DROP TABLE");
			expect(embedContentMock).toHaveBeenCalledWith(malicious);
		});
	});

	describe("sendMessage", () => {
		it("creates a new chat, stores both messages, and maps known source files to public URLs", async () => {
			queryRawMock.mockResolvedValue([
				{ content: "conteúdo do TADS", url: "file://manual/tads.md" },
			]);
			sendMessageMock.mockResolvedValue({
				response: { text: () => "O coordenador é Fulano." },
			});

			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			const result = await service.sendMessage(
				"Quem é o coordenador do TADS?",
				"user-1",
			);

			expect(prismaMock.chat.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ userId: "user-1" }),
				}),
			);
			expect(prismaMock.message.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						role: "user",
						content: "Quem é o coordenador do TADS?",
					}),
				}),
			);
			expect(prismaMock.message.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						role: "model",
						content: "O coordenador é Fulano.",
					}),
				}),
			);
			expect(result.sources).toEqual([
				"https://www.ifnmg.edu.br/cursos/265-portal/aracuai/aracuai-cursos-superiores/tecnologia-em-analise-e-desenvolvimento-de-sistemas/12999-tecnologia-em-analise-e-desenvolvimento-de-sistemas",
			]);
			expect(result.chatId).toBe("new-chat-id");
		});

		it("continues an existing chat owned by the caller and forwards prior messages as history", async () => {
			prismaMock.chat.findUnique.mockResolvedValue({
				id: "chat-1",
				userId: "user-1",
				messages: [
					{ role: "user", content: "Olá", createdAt: new Date(2024, 0, 1) },
					{
						role: "model",
						content: "Oi! Como posso ajudar?",
						createdAt: new Date(2024, 0, 2),
					},
				],
			});

			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			await service.sendMessage("E sobre o TADS?", "user-1", "chat-1");

			expect(prismaMock.chat.findUnique).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: "chat-1", userId: "user-1" } }),
			);
			expect(prismaMock.chat.create).not.toHaveBeenCalled();
		});

		it("silently starts a brand-new chat when chatId belongs to another user (no data is leaked)", async () => {
			// findUnique is scoped by {id, userId} — a chatId owned by someone
			// else simply doesn't match and returns null.
			prismaMock.chat.findUnique.mockResolvedValue(null);

			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			const result = await service.sendMessage(
				"continuando...",
				"user-1",
				"someone-elses-chat-id",
			);

			expect(prismaMock.chat.create).toHaveBeenCalled();
			expect(result.chatId).toBe("new-chat-id");
		});

		it("retries with the fallback model on failure and succeeds if a later attempt works", async () => {
			vi.useFakeTimers();
			try {
				sendMessageMock
					.mockRejectedValueOnce(new Error("timeout"))
					.mockResolvedValueOnce({ response: { text: () => "Resposta ok." } });

				const { ChatService } = await import("./chat.service.js");
				const service = new ChatService();

				const pending = service.sendMessage("Oi", "user-1");
				await vi.runAllTimersAsync();
				const result = await pending;

				expect(result.response).toBe("Resposta ok.");
				expect(getChatModelMock).toHaveBeenNthCalledWith(
					1,
					expect.any(String),
					false,
				);
				expect(getChatModelMock).toHaveBeenNthCalledWith(
					2,
					expect.any(String),
					true,
				);
			} finally {
				vi.useRealTimers();
			}
		});

		it("throws after exhausting all retry attempts", async () => {
			vi.useFakeTimers();
			try {
				sendMessageMock.mockRejectedValue(new Error("modelo indisponível"));

				const { ChatService } = await import("./chat.service.js");
				const service = new ChatService();

				const pending = service.sendMessage("Oi", "user-1");
				const assertion = expect(pending).rejects.toThrow(
					"modelo indisponível",
				);
				await vi.runAllTimersAsync();
				await assertion;
				expect(sendMessageMock).toHaveBeenCalledTimes(3);
			} finally {
				vi.useRealTimers();
			}
		});

		it("logs the question and appends department contacts when the model can't answer from context", async () => {
			sendMessageMock.mockResolvedValue({
				response: {
					text: () =>
						"não possuo informações precisas sobre este assunto no momento.",
				},
			});
			prismaMock.department.findMany.mockResolvedValue([
				{
					name: "Secretaria",
					email: "secretaria@ifnmg.edu.br",
					phone: "38-0000-0000",
				},
			]);

			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			const result = await service.sendMessage(
				"Quantos alunos existem no mundo?",
				"user-1",
			);

			expect(prismaMock.unansweredQuestion.create).toHaveBeenCalledWith({
				data: { content: "Quantos alunos existem no mundo?" },
			});
			expect(result.response).toContain("Secretaria: secretaria@ifnmg.edu.br");
			expect(result.sources).toEqual([]);
		});

		it("falls back to a generic contact when no department is registered", async () => {
			sendMessageMock.mockResolvedValue({
				response: {
					text: () =>
						"não possuo informações precisas sobre este assunto no momento.",
				},
			});
			prismaMock.department.findMany.mockResolvedValue([]);

			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			const result = await service.sendMessage(
				"pergunta fora de escopo",
				"user-1",
			);

			expect(result.response).toContain("secretaria.aracuai@ifnmg.edu.br");
		});
	});

	describe("authorization", () => {
		it("deleteChat refuses to delete a chat that does not exist", async () => {
			prismaMock.chat.findUnique.mockResolvedValue(null);
			const { ChatService, ChatNotFoundError } = await import(
				"./chat.service.js"
			);
			const service = new ChatService();

			await expect(
				service.deleteChat("missing-chat", "user-1"),
			).rejects.toBeInstanceOf(ChatNotFoundError);
			expect(prismaMock.$transaction).not.toHaveBeenCalled();
		});

		it("deleteChat refuses to delete a chat owned by a different user (IDOR)", async () => {
			prismaMock.chat.findUnique.mockResolvedValue({
				id: "chat-1",
				userId: "victim-user",
			});
			const { ChatService, ChatNotFoundError } = await import(
				"./chat.service.js"
			);
			const service = new ChatService();

			await expect(
				service.deleteChat("chat-1", "attacker-user"),
			).rejects.toBeInstanceOf(ChatNotFoundError);
			expect(prismaMock.$transaction).not.toHaveBeenCalled();
		});

		it("deleteChat removes messages and the chat when the caller is the owner", async () => {
			prismaMock.chat.findUnique.mockResolvedValue({
				id: "chat-1",
				userId: "user-1",
			});
			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			await service.deleteChat("chat-1", "user-1");

			expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
			expect(prismaMock.message.deleteMany).toHaveBeenCalledWith({
				where: { chatId: "chat-1" },
			});
			expect(prismaMock.chat.delete).toHaveBeenCalledWith({
				where: { id: "chat-1" },
			});
		});

		it("getUserChats lists only the caller's own chats", async () => {
			prismaMock.chat.findMany.mockResolvedValue([
				{ id: "chat-1", userId: "user-1" },
			]);
			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			const chats = await service.getUserChats("user-1");

			expect(prismaMock.chat.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ where: { userId: "user-1" } }),
			);
			expect(chats).toEqual([{ id: "chat-1", userId: "user-1" }]);
		});
	});

	describe("resilience", () => {
		it("degrades to an empty context instead of crashing the whole request when retrieval fails", async () => {
			embedContentMock.mockRejectedValue(
				new Error("Gemini embeddings API is down"),
			);

			const { ChatService } = await import("./chat.service.js");
			const service = new ChatService();

			const result = await service.sendMessage(
				"Quem é o coordenador do TADS?",
				"user-1",
			);

			expect(result.response).toBe("Resposta padrão do modelo.");
			expect(result.sources).toEqual([]);
		});
	});
});
