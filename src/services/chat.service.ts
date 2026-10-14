import { detectCourse } from "../lib/course-catalog";
import { geminiEmbedding, getChatModel } from "../lib/gemini";
import { prisma } from "../lib/prisma";

export interface ChatResponse {
	chatId: string;
	response: string;
	sources?: string[];
}

interface DocumentContext {
	content: string;
	url: string;
}

export class ChatNotFoundError extends Error {
	readonly code = "CHAT_NOT_FOUND";

	constructor() {
		super("Chat not found or not owned by user");
		this.name = "ChatNotFoundError";
	}
}

export const FALLBACK_TRIGGER = "não possuo informações precisas";

const DISCLAIMER = `
IMPORTANTE: Eu sou a "Assistente Castanha", um protótipo de Inteligência Artificial criado como Projeto de Conclusão de Curso (TCC) por um estudante do IFNMG - Campus Araçuaí para tirar dúvidas sobre os cursos superiores e assuntos relacionados. 
Eu NÃO sou um canal oficial da instituição. Minhas respostas são baseadas em documentos públicos, mas podem conter imprecisões. Sempre confirme informações críticas no site oficial (https://www.ifnmg.edu.br).
`;

const SYSTEM_PROMPT = `
Você é a "Assistente Castanha", uma inteligência artificial criada para tirar dúvidas sobre os Cursos Superiores do IFNMG - Campus Araçuaí e assuntos relacionados (Projeto de TCC).

REGRAS RÍGIDAS DE ATUAÇÃO:
1. Seu objetivo é tirar dúvidas sobre os cursos superiores (como Administração, Engenharia Agrícola e Ambiental, TADS e Gestão em Saúde) e serviços do Campus Araçuaí.
2. Se o usuário perguntar sobre Cursos Técnicos, Ensino Médio ou qualquer outro assunto fora do escopo de Ensino Superior, responda educadamente que seu escopo é limitado apenas aos cursos de graduação (superiores).
3. Utilize APENAS o contexto fornecido para basear suas respostas de forma direta e objetiva. É PROIBIDO usar seu conhecimento geral/próprio para citar nomes de pessoas, coordenadores, professores, e-mails, telefones, datas, números de vagas ou qualquer outro dado factual específico — mesmo que pareça plausível. Se esses dados não estiverem explicitamente no contexto, trate como informação não encontrada.
4. Cada trecho do contexto começa com o título do documento de origem (ex.: "# Bacharelado em Administração"); use-o para saber a qual curso a informação pertence. Se a pergunta citar um curso específico e o contexto só tiver informação de outro curso, NÃO use essa informação — trate como se não houvesse contexto relevante. Se a pergunta NÃO especificar o curso (ex.: "quem é o coordenador do curso?"), responda com a informação de cada curso presente no contexto, identificando o curso de cada uma.
5. Se você não encontrar a informação no contexto ou se a pergunta for fora do escopo institucional superior, responda exatamente: "${FALLBACK_TRIGGER} sobre este assunto no momento."
6. Sempre mantenha um tom profissional e cordial.
7. Não repita avisos sobre ser um projeto de TCC ou sua identidade, a menos que seja a primeira mensagem do chat.
`;

export class ChatService {
	private async getContext(
		query: string,
	): Promise<{ text: string; sources: string[] }> {
		try {
			const result = await geminiEmbedding.embedContent(query);
			const vector = result.embedding.values;
			const course = detectCourse(query);

			// Se a pergunta menciona um curso específico, restringe a busca aos
			// documentos daquele curso (+ documentos institucionais sem curso
			// definido) para não trazer, por engano, o coordenador/contato de
			// outro curso que tenha ficado semanticamente parecido.
			const documents = course
				? await prisma.$queryRaw<DocumentContext[]>`
            SELECT content, url FROM documents
            WHERE course = ${course} OR course IS NULL
            ORDER BY embedding <=> ${vector}::vector
            LIMIT 8
          `
				: await prisma.$queryRaw<DocumentContext[]>`
            SELECT content, url FROM documents
            ORDER BY embedding <=> ${vector}::vector
            LIMIT 8
          `;

			if (documents.length === 0) return { text: "", sources: [] };

			const text = documents.map((d) => d.content).join("\n\n---\n\n");
			const sources = [...new Set(documents.map((d) => d.url))];

			return { text, sources };
		} catch (error) {
			console.error("Erro ao buscar contexto RAG:", error);
			return { text: "", sources: [] };
		}
	}

	async sendMessage(
		content: string,
		userId: string,
		chatId?: string,
	): Promise<ChatResponse> {
		let chat:
			| (import("@prisma/client").Chat & {
					messages: import("@prisma/client").Message[];
			  })
			| null = null;

		if (chatId) {
			chat = await prisma.chat.findUnique({
				where: { id: chatId, userId },
				include: { messages: { orderBy: { createdAt: "desc" }, take: 10 } },
			});
			if (chat) chat.messages.reverse();
		}

		if (!chat) {
			chat = await prisma.chat.create({
				data: {
					title: content.substring(0, 50),
					userId,
				},
				include: { messages: true },
			});
		}

		const { text: contextText, sources } = await this.getContext(content);

		await prisma.message.create({
			data: {
				chatId: chat.id,
				role: "user",
				content,
			},
		});

		const history = (chat.messages || []).map((m) => ({
			role: m.role === "user" ? "user" : "model",
			parts: [{ text: m.content }],
		}));

		const promptWithContext = `
Abaixo está o contexto recuperado do site oficial para ajudar na resposta. 
Se o contexto não for relevante para a pergunta, ignore-o.

CONTEXTO:
${contextText || "Nenhuma informação específica encontrada."}

PERGUNTA DO USUÁRIO:
${content}
    `;

		const finalPrompt =
			history.length === 0
				? `${DISCLAIMER}\n\n${promptWithContext}`
				: promptWithContext;

		let responseText = "";
		let attempts = 0;
		const maxAttempts = 3;

		while (attempts < maxAttempts) {
			try {
				const useFallback = attempts > 0;
				const model = getChatModel(SYSTEM_PROMPT, useFallback);
				const chatSession = model.startChat({ history });
				const result = await chatSession.sendMessage(finalPrompt);
				responseText = result.response.text();
				break;
			} catch (error: any) {
				attempts++;
				console.error(`Tentativa ${attempts} falhou:`, error.message);

				if (attempts >= maxAttempts) {
					throw error;
				}

				await new Promise((resolve) => setTimeout(resolve, attempts * 1000));
			}
		}

		const urlMapping: Record<string, string> = {
			"administracao.md":
				"https://www.ifnmg.edu.br/cursos/263-portal/aracuai/aracuai-cursos-superiores/bacharelado-em-administracao/12981-bacharelado-em-administracao",
			"engenharia-agricola.md":
				"https://www.ifnmg.edu.br/cursos/408-portal/aracuai/aracuai-cursos-superiores/engenharia-agricola-e-ambiental/17185-engenharia-agricola-e-ambiental",
			"tads.md":
				"https://www.ifnmg.edu.br/cursos/265-portal/aracuai/aracuai-cursos-superiores/tecnologia-em-analise-e-desenvolvimento-de-sistemas/12999-tecnologia-em-analise-e-desenvolvimento-de-sistemas",
			"gestao-saude.md":
				"https://www.ifnmg.edu.br/cursos/550-portal/aracuai/aracuai-cursos-superiores/tecnologia-em-gestao-em-saude/22763-tecnologia-em-gestao-em-saude",
			"gestao-ambiental.md":
				"https://www.ifnmg.edu.br/cursos/264-portal/aracuai/aracuai-cursos-superiores/tecnologia-em-gestao-ambiental/12990-tecnologia-em-gestao-ambiental",
			"estude-no-ifnmg.md": "https://www.ifnmg.edu.br/estude-no-ifnmg",
			"assistencia-estudantil.md":
				"https://www.ifnmg.edu.br/assistencia-estudantil-aracuai/apresentacao",
			"biblioteca.md": "https://www.ifnmg.edu.br/biblioteca-ara/apresentacao",
			"historico-campus.md": "https://www.ifnmg.edu.br/manu-aracuai/historico",
		};

		const mappedSources = sources
			.map((src) => {
				const fileName = src.split("/").pop() || "";
				return urlMapping[fileName] || null;
			})
			.filter((src): src is string => src !== null);

		const uniqueSources = [...new Set(mappedSources)];

		const isFallbackTriggered = responseText.includes(FALLBACK_TRIGGER);

		if (isFallbackTriggered) {
			await prisma.unansweredQuestion.create({
				data: { content },
			});

			const departments = await prisma.department.findMany();
			const contactsInfo = departments
				.map((d) => `${d.name}: ${d.email} | ${d.phone}`)
				.join("\n");

			const finalResponse = `${responseText}\n\nPara mais informações, você pode entrar em contato com os setores responsáveis:\n${contactsInfo || "Secretaria Acadêmica: secretaria.aracuai@ifnmg.edu.br"}`;

			await prisma.message.create({
				data: {
					chatId: chat.id,
					role: "model",
					content: finalResponse,
				},
			});

			return {
				chatId: chat.id,
				response: finalResponse,
				sources: [],
			};
		}

		await prisma.message.create({
			data: {
				chatId: chat.id,
				role: "model",
				content: responseText,
			},
		});

		return {
			chatId: chat.id,
			response: responseText,
			sources: uniqueSources,
		};
	}

	async getChatMessages(chatId: string) {
		const chat = await prisma.chat.findUnique({
			where: { id: chatId },
			include: {
				messages: {
					orderBy: { createdAt: "asc" },
				},
			},
		});

		return chat;
	}

	async getUserChats(userId: string) {
		const chats = await prisma.chat.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});

		return chats;
	}

	async deleteChat(chatId: string, userId: string) {
		const chat = await prisma.chat.findUnique({
			where: { id: chatId },
		});

		if (!chat || chat.userId !== userId) {
			throw new ChatNotFoundError();
		}

		await prisma.$transaction([
			prisma.message.deleteMany({
				where: { chatId },
			}),
			prisma.chat.delete({
				where: { id: chatId },
			}),
		]);
	}
}
