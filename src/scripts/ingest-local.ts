import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { geminiEmbedding } from "../lib/gemini";

dotenv.config({ override: true });

const prisma = new PrismaClient();

async function ingestLocalFile(filePath: string) {
	try {
		const absolutePath = path.resolve(filePath);
		const fileName = path.basename(filePath);
		const fileUrl = `local://${fileName}`;

		console.log(`\n--- Iniciando ingestão local: ${absolutePath} ---`);

		if (!fs.existsSync(absolutePath)) {
			throw new Error("Arquivo não encontrado.");
		}

		console.log(`Limpando registros antigos para: ${fileUrl}`);
		await prisma.$executeRaw`DELETE FROM documents WHERE url = ${fileUrl}`;

		const content = fs.readFileSync(absolutePath, "utf-8");

		const normalizedContent = content.replace(/\r\n/g, "\n");
		const chunks = normalizedContent
			.split("\n\n")
			.filter((c) => c.trim().length > 0);
		console.log(`${chunks.length} blocos detectados.`);

		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];
			console.log(`Processando bloco ${i + 1}/${chunks.length}...`);

			const result = await geminiEmbedding.embedContent(chunk);
			const embedding = result.embedding.values;

			await prisma.$executeRaw`
        INSERT INTO documents (id, content, url, embedding, "createdAt")
        VALUES (
          gen_random_uuid(), 
          ${chunk}, 
          ${fileUrl}, 
          ${embedding}::vector, 
          NOW()
        )
      `;
		}

		console.log("--- Ingestão local concluída! ---\n");
	} catch (error) {
		console.error("Erro na ingestão local:", error);
	} finally {
		await prisma.$disconnect();
	}
}

const fileArg = process.argv[2] || "src/data/conhecimento.md";
ingestLocalFile(fileArg);
