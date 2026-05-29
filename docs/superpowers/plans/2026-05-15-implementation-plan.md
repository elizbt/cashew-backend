# Plano de Implementação: Esqueleto Chatbot IFNMG-TADS

Este plano descreve as etapas para implementar o backend do chatbot seguindo a arquitetura em camadas aprovada.

## Fase 1: Setup do Ambiente e Infraestrutura
- [ ] Inicializar projeto Node.js e instalar dependências (`fastify`, `typescript`, `prisma`, `zod`, `@google/generative-ai`, `dotenv`).
- [ ] Configurar `tsconfig.json` e scripts no `package.json`.
- [ ] Criar `Dockerfile` e `docker-compose.yml` para PostgreSQL.
- [ ] Configurar o Prisma Schema com as tabelas: `Chat`, `Message`, `UnansweredQuestion`, `Department`.

## Fase 2: Libs e Configurações
- [ ] Configurar cliente singleton do Prisma em `src/lib/prisma.ts`.
- [ ] Configurar cliente singleton do Gemini em `src/lib/gemini.ts`.
- [ ] Criar validação de variáveis de ambiente com Zod em `src/config/env.ts`.

## Fase 3: Camada de Serviços (Lógica de Negócio)
- [ ] Implementar `ChatService`:
    - Gerenciamento de histórico de mensagens.
    - Integração com Gemini SDK com System Prompt rígido.
    - Lógica de Fallback: Identificação de "não sei" e busca de `Department` no banco.
    - Persistência de `UnansweredQuestion`.

## Fase 4: Camada de API (Rotas e Controllers)
- [ ] Criar Zod Schemas para validação de requests em `src/schemas/chat.schema.ts`.
- [ ] Implementar `ChatController` para gerenciar a rota `/chat`.
- [ ] Configurar o servidor Fastify e registrar as rotas.

## Fase 5: Validação Final
- [ ] Executar migrações do Prisma via Docker.
- [ ] Testar o fluxo completo via `curl` ou ferramenta de API.
- [ ] Verificar logs e persistência no banco.

**Padrão de Commits:** Todos os passos seguirão o padrão de commits convencionais (ex: `feat:`, `chore:`, `config:`).
