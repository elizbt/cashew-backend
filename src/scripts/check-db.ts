import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    const counts = await prisma.$queryRaw`
      SELECT url, COUNT(*)::int as chunks 
      FROM documents 
      GROUP BY url 
      ORDER BY url ASC
    `;
    
    console.log("\n=== Verificação do Banco de Dados ===");
    console.table(counts);
    
    const total = await prisma.document.count();
    console.log(`Total de blocos indexados: ${total}`);
  } catch (error) {
    console.error("Erro ao verificar banco:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
