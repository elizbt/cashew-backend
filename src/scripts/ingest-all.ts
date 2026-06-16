import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
const { PDFParse } = require("pdf-parse");
import { geminiEmbedding } from "../lib/gemini";

dotenv.config({ override: true });

const prisma = new PrismaClient();

const DATA_DIRS = {
	manual: path.join(process.cwd(), "src/data/manual"),
	documentos: path.join(process.cwd(), "src/data/documentos"),
	faq: path.join(process.cwd(), "src/data/faq"),
};

async function chunkText(
	text: string,
	size = 1500,
	overlap = 200,
): Promise<string[]> {
	const chunks: string[] = [];
	let i = 0;
	while (i < text.length) {
		const end = Math.min(i + size, text.length);
		chunks.push(text.substring(i, end));
		if (end === text.length) break;
		i += size - overlap;
	}
	return chunks;
}

async function processFile(
	filePath: string,
	type: "manual" | "documentos" | "faq",
) {
	const fileName = path.basename(filePath);
	const fileUrl = `file://${type}/${fileName}`;

	console.log(`\n--- Processando: ${fileUrl} ---`);

	try {
		await prisma.$executeRaw`DELETE FROM documents WHERE url = ${fileUrl}`;

		let content = "";
		if (filePath.toLowerCase().endsWith(".pdf")) {
			const dataBuffer = fs.readFileSync(filePath);
			const parser = new PDFParse({ data: dataBuffer });
			const result = await parser.getText();
			content = result.text;
		} else if (
			filePath.toLowerCase().endsWith(".md") ||
			filePath.toLowerCase().endsWith(".txt")
		) {
			content = fs.readFileSync(filePath, "utf-8");
		} else {
			console.log(`Pulando arquivo desconhecido: ${fileName}`);
			return;
		}

		const normalizedContent = content.replace(/\r\n/g, "\n").trim();
		if (!normalizedContent) {
			console.log(`Arquivo vazio ou sem texto extraível: ${fileName}`);
			return;
		}

		let chunks: string[] = [];
		if (type === "faq") {
			chunks = normalizedContent
				.split(/\n(?=# )|\n(?=## )/)
				.filter((c) => c.trim().length > 0);
		} else {
			chunks = await chunkText(normalizedContent);
		}

		console.log(`${chunks.length} blocos detectados.`);

		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i].trim();
			if (!chunk) continue;

			console.log(`Indexando bloco ${i + 1}/${chunks.length}...`);
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
	} catch (error) {
		console.error(`Erro ao processar arquivo ${fileName}:`, error);
	}
}

async function main() {
	try {
		console.log("\n=== Iniciando ingestão completa da base de conhecimento ===\n");

		for (const [key, dirPath] of Object.entries(DATA_DIRS)) {
			if (!fs.existsSync(dirPath)) {
				console.log(`Diretório não encontrado: ${dirPath}`);
				continue;
			}

			const files = fs.readdirSync(dirPath);
			console.log(`>> Pasta [${key}]: ${files.length} arquivos encontrados.`);

			for (const file of files) {
				const filePath = path.join(dirPath, file);
				if (fs.statSync(filePath).isFile()) {
					await processFile(filePath, key as any);
				}
			}
		}

		console.log("\n✅ Ingestão completa finalizada com sucesso!");
	} catch (error) {
		console.error("\n❌ Erro fatal durante a ingestão:", error);
	} finally {
		await prisma.$disconnect();
	}
}

main();
