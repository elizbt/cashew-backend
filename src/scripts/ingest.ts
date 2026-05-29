import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { embeddingModel } from '../lib/gemini';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function ingest(url: string) {
  try {
    console.log(`\n--- Iniciando ingestão de: ${url} ---`);

    console.log('Lendo conteúdo via Jina Reader...');
    const response = await axios.get(`https://r.jina.ai/${url}`);
    const markdown = response.data;

    if (!markdown) {
      throw new Error('Não foi possível obter o conteúdo da URL.');
    }

    console.log('Processando chunks...');
    const chunkSize = 1500;
    const overlap = 200;
    const chunks: string[] = [];

    for (let i = 0; i < markdown.length; i += chunkSize - overlap) {
      chunks.push(markdown.substring(i, i + chunkSize));
    }

    console.log(`${chunks.length} chunks gerados.`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processando chunk ${i + 1}/${chunks.length}...`);

      const result = await embeddingModel.embedContent(chunk);
      const embedding = result.embedding.values;

      await prisma.$executeRaw`
        INSERT INTO documents (id, content, url, embedding, "createdAt")
        VALUES (
          gen_random_uuid(), 
          ${chunk}, 
          ${url}, 
          ${embedding}::vector, 
          NOW()
        )
      `;
    }

    console.log('--- Ingestão concluída com sucesso! ---\n');
  } catch (error) {
    console.error('Erro na ingestão:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const targetUrl = process.argv[2];

if (!targetUrl) {
  console.error('Por favor, forneça uma URL. Exemplo: npm run ingest https://www.ifnmg.edu.br/aracuai');
  process.exit(1);
}

ingest(targetUrl);
