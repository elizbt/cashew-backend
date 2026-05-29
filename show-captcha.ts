import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.document.findMany({ 
    take: 1,
    select: { content: true, url: true }
  });
  console.log("--- CONTEÚDO CAPTURADO DO SITE ---");
  console.log(docs[0]?.content);
  console.log("----------------------------------");
}

main().finally(() => prisma.$disconnect());
