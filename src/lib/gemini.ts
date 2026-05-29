import * as dotenv from "dotenv";

dotenv.config({ override: true });

const apiKey = (process.env.GEMINI_API_KEY || "").trim();

const chatModel = (process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash")
  .trim()
  .replace(/^models\//, "");

const embeddingModelName = (
  process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004"
)
  .trim()
  .replace(/^models\//, "");

if (!apiKey) {
  console.warn("Aviso: GEMINI_API_KEY não encontrada ou está vazia.");
}

export const geminiModel = {
  async generateContent(prompt: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${chatModel}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error?.message || `Erro no Gemini API (${response.status})`,
      );

    return {
      response: {
        text: () => data.candidates[0].content.parts[0].text,
      },
    };
  },

  startChat(options: any) {
    const history = options.history || [];
    return {
      async sendMessage(text: string) {
        const contents = history.map((h: any) => ({
          role: h.role === "model" ? "model" : "user",
          parts: h.parts,
        }));

        contents.push({
          role: "user",
          parts: [{ text }],
        });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${chatModel}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
        });

        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error?.message || `Erro no Gemini API (${response.status})`,
          );

        return {
          response: {
            text: () => data.candidates[0].content.parts[0].text,
          },
        };
      },
    };
  },
};

export const embeddingModel = {
  async embedContent(text: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModelName}:embedContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
    });

    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error?.message || `Erro no Embedding API (${response.status})`,
      );

    return {
      embedding: {
        values: data.embedding.values,
      },
    };
  },
};
