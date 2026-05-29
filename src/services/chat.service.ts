import { geminiModel, embeddingModel } from "../lib/gemini";
import { prisma } from "../lib/prisma";

const DISCLAIMER = `
IMPORTANTE: Eu sou o "Assistente TADS", um protótipo de Inteligência Artificial criado como Projeto de Conclusão de Curso (TCC) por estudantes do IFNMG - Campus Araçuaí. 
Eu NÃO sou um canal oficial da instituição. Minhas respostas são baseadas em documentos públicos, mas podem conter imprecisões. Sempre confirme informações críticas no site oficial (ifnmg.edu.br).
`;

const SYSTEM_PROMPT = `
Você é o Assistente Virtual do IFNMG - Campus Araçuaí (Projeto de TCC).

REGRAS RÍGIDAS DE ATUAÇÃO:
1. Responda APENAS sobre o IFNMG Campus Araçuaí e assuntos acadêmicos relacionados.
2. Utilize o contexto fornecido abaixo para basear suas respostas.
3. Se o usuário perguntar algo fora do contexto fornecido ou fora do escopo institucional, ou se você não tiver certeza, responda: "Sinto muito, mas não possuo informações precisas sobre este assunto no momento."
4. Sempre mantenha um tom profissional e cordial.
5. Em sua primeira resposta em um novo chat, você DEVE incluir o aviso de que é um projeto de TCC.

${DISCLAIMER}
`;

export class ChatService {
  private async getContext(query: string): Promise<string> {
    try {
      const result = await embeddingModel.embedContent(query);
      const vector = result.embedding.values;

      const documents: any[] = await prisma.$queryRaw`
        SELECT content FROM documents 
        ORDER BY embedding <=> ${vector}::vector 
        LIMIT 3
      `;

      if (documents.length === 0) return "";

      return documents.map(d => d.content).join("\n\n---\n\n");
    } catch (error) {
      console.error("Erro ao buscar contexto RAG:", error);
      return "";
    }
  }

  async sendMessage(content: string, chatId?: string) {
    let chat;

    if (chatId) {
      chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 10 } },
      });
      if (chat) chat.messages.reverse();
    }

    if (!chat) {
      chat = await prisma.chat.create({
        data: { title: content.substring(0, 50) },
        include: { messages: true },
      });
    }

    const context = await this.getContext(content);

    await prisma.message.create({
      data: {
        chatId: chat.id,
        role: "user",
        content,
      },
    });

    const history = chat.messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const fullPrompt = `
Contexto recuperado do site oficial:
${context || "Nenhuma informação específica encontrada no banco de dados."}

Pergunta do Usuário: ${content}
    `;

    const chatSession = geminiModel.startChat({
      history: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        {
          role: "model",
          parts: [
            {
              text: "Entendido. Sou o Assistente TADS (Projeto de TCC) e utilizarei o contexto fornecido para responder de forma precisa e ética.",
            },
          ],
        },
        ...history,
      ],
    });

    const result = await chatSession.sendMessage(fullPrompt);
    const responseText = result.response.text();

    const isFallbackTriggered = responseText.includes(
      "não possuo informações precisas",
    );

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
    };
  }
}
