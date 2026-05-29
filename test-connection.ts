import { geminiModel, embeddingModel } from './src/lib/gemini';
import * as dotenv from 'dotenv';

dotenv.config();

async function runTests() {
  console.log('--- Iniciando Testes de Conexão Gemini ---');

  try {
    console.log('\n1. Testando Chat (gemini-1.5-flash-latest)...');
    const result = await geminiModel.generateContent('Olá');
    const response = await result.response;
    console.log('✅ Chat OK! Resposta:', response.text());
  } catch (error: any) {
    console.error('❌ Erro no Chat:', error.message);
  }

  try {
    console.log('\n2. Testando Embedding (gemini-embedding-001)...');
    const result = await embeddingModel.embedContent('Teste de embedding');
    console.log('✅ Embedding OK! Vetor gerado com sucesso.');
  } catch (error: any) {
    console.error('❌ Erro no Embedding:', error.message);
  }

  console.log('\n--- Testes Finalizados ---');
}

runTests();
