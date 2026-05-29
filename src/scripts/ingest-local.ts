import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { embeddingModel } from '../lib/gemini';
import * as dotenv from 'dotenv';

dotenv.config({ override: true });

const prisma = new PrismaClient();

async function ingestLocalFile(filePath: string) {
  try {
    const absolutePath = path.resolve(filePath);
    console.log(`\n--- Iniciando ingestão local: ${absolutePath} ---`);

    if (!fs.existsSync(absolutePath)) {
      throw new Error('Arquivo não encontrado.');
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    
    const chunks = content.split('\n\n').filter(c => c.trim().length > 0);
    console.log(`${chunks.length} blocos detectados.`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processando bloco ${i + 1}/${chunks.length}...`);

      const result = await embeddingModel.embedContent(chunk);
      const embedding = result.embedding.values;

      await prisma.$executeRaw`
        INSERT INTO documents (id, content, url, embedding, "createdAt")
        VALUES (
          gen_random_uuid(), 
          ${chunk}, 
          ${'local://' + path.basename(filePath)}, 
          ${embedding}::vector, 
          NOW()
        )
      `;
    }

    console.log('--- Ingestão local concluída! ---\n');
  } catch (error) {
    console.error('Erro na ingestão local:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const fileArg = process.argv[2] || 'src/data/conhecimento.md';
ingestLocalFile(fileArg);
