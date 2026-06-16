import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updateTo3072() {
	try {
		console.log("Alterando coluna de embedding para 3072 dimensões...");
		await prisma.$executeRaw`ALTER TABLE documents ALTER COLUMN embedding TYPE vector(3072);`;
		console.log("Sucesso! O banco agora aceita 3072 dimensões.");
	} catch (error) {
		console.error("Erro ao atualizar dimensões:", error);
	} finally {
		await prisma.$disconnect();
	}
}

updateTo3072();
