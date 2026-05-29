# Design Doc: Implementação de RAG com pgvector e Gemini - Chatbot IFNMG (TADS)

**Data:** 2026-05-27  
**Status:** Approved  
**Autor:** Gemini CLI  

## 1. Objetivo
Implementar um sistema de **Retrieval-Augmented Generation (RAG)** para o chatbot do IFNMG - Campus Araçuaí. O objetivo é permitir que o bot responda dúvidas baseadas em informações reais extraídas do site da instituição, garantindo que o sistema se identifique claramente como um projeto experimental de TCC.

## 2. Requisitos de Negócio
- **Precisão:** As respostas devem ser fundamentadas em dados reais do IFNMG.
- **Transparência:** O bot deve informar em todas as sessões que é um projeto de TCC e não um canal oficial.
- **Facilidade de Atualização:** Deve ser possível adicionar novas páginas ou editais via comando CLI simples.
- **Escalabilidade:** A arquitetura deve suportar o crescimento do volume de documentos sem perda de performance.

## 3. Arquitetura Técnica

### 3.1. Stack Tecnológica
- **Banco de Dados:** PostgreSQL 16 com extensão `pgvector`.
- **Embeddings:** Google Generative AI (`text-embedding-004`).
- **Orquestração de Dados:** Prisma ORM com queries SQL raw para busca vetorial.
- **Ingestão:** Jina Reader API (conversão de URL para Markdown limpo).

### 3.2. Modelo de Dados (Prisma)
Uma nova tabela será adicionada para armazenar o conhecimento base:

```prisma
model Document {
  id        String                 @id @default(uuid())
  content   String                 @db.Text
  url       String?                // Fonte da informação
  embedding Unsupported("vector(768)")?
  createdAt DateTime               @default(now())

  @@map("documents")
}
```

### 3.3. Fluxo de Ingestão (Script CLI)
Um script `src/scripts/ingest.ts` será responsável por:
1. Receber uma URL do site do IFNMG.
2. Utilizar `https://r.jina.ai/<URL>` para obter o conteúdo em Markdown.
3. Dividir o texto em blocos (chunks) de ~1000 caracteres com sobreposição de 10%.
4. Gerar vetores para cada bloco usando o Gemini.
5. Salvar no PostgreSQL.

### 3.4. Fluxo de Chat (RAG)
1. **Entrada:** Usuário envia uma pergunta.
2. **Vetorização:** A pergunta é convertida em um vetor de 768 dimensões.
3. **Busca:** SQL Raw busca os 3 blocos mais similares usando o operador `<=>` (cosine distance).
4. **Contextualização:** O conteúdo recuperado é injetado no System Prompt.
5. **Geração:** Gemini gera a resposta final.

## 4. Estratégia de Disclaimer e Identidade
O **System Prompt** será atualizado para:
> "Você é o 'Assistente TADS', um protótipo de Inteligência Artificial criado como Projeto de Conclusão de Curso (TCC) por estudantes do IFNMG - Campus Araçuaí. Você NÃO é um canal oficial da instituição. Use as informações fornecidas no contexto para responder, mas sempre recomende a consulta ao site oficial para decisões importantes."

## 5. Infraestrutura (Docker)
A imagem do Postgres no `docker-compose.yml` será alterada para `pgvector/pgvector:pg16` para garantir a disponibilidade das funções vetoriais.

## 6. Próximos Passos
1. Atualizar `docker-compose.yml` e `schema.prisma`.
2. Implementar script de ingestão.
3. Atualizar `ChatService` com a lógica de busca vetorial.
4. Testar com páginas reais do IFNMG Araçuaí.
