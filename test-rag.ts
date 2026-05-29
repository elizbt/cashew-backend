import { ChatService } from './src/services/chat.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function testRAG() {
  const chatService = new ChatService();
  const question = "Quais são os cursos oferecidos pelo IFNMG?";

  console.log(`\n--- Testando RAG ---`);
  console.log(`Pergunta: "${question}"`);
  console.log('Aguardando resposta do Assistente TADS...\n');

  try {
    const result = await chatService.sendMessage(question);
    console.log('--- Resposta do Bot ---');
    console.log(result.response);
    console.log('\n--- Fim do Teste ---');
  } catch (error) {
    console.error('Erro no teste de RAG:', error);
  }
}

testRAG();
