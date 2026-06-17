# Backend TCC - Chat AI (RAG)

Este é o backend do sistema de Chat AI desenvolvido para o Trabalho de Conclusão de Curso (TCC). O sistema utiliza técnicas de RAG (Retrieval-Augmented Generation) integrando a API do Google Gemini com um banco de dados vetorial PostgreSQL.

## Tecnologias Utilizadas

- Runtime: [Node.js](https://nodejs.org/) (v18+)
- Linguagem: [TypeScript](https://www.typescriptlang.org/)
- Framework Web: [Fastify](https://www.fastify.io/)
- ORM: [Prisma](https://www.prisma.io/)
- Banco de Dados: [PostgreSQL](https://www.postgresql.org/) com extensão [pgvector](https://github.com/pgvector/pgvector)
- AI/LLM: [Google Gemini API](https://ai.google.dev/)
- Web Scraping: [Playwright](https://playwright.dev/)
- Validação: [Zod](https://zod.dev/)
- Lint/Format: [Biome](https://biomejs.dev/)

---

## Pre-requisitos

Antes de começar, você precisará ter instalado em sua máquina:

1. Node.js (recomenda-se a versão LTS)
2. Docker e Docker Compose (para rodar o banco de dados facilmente)
3. Uma chave de API do Google Gemini ([Obtenha aqui](https://aistudio.google.com/app/apikey))

---

## Instalacao

1. Clone o repositorio:
   ```bash
   git clone <url-do-repositorio>
   cd backend-tcc
   ```

2. Instale as dependencias:
   ```bash
   npm install
   ```

3. Instale os navegadores do Playwright (necessario para o scraping):
   ```bash
   npx playwright install chromium
   ```

---

## Configuracao (Variaveis de Ambiente)

Crie um arquivo .env na raiz do projeto com base no arquivo .env.example:

```env
PORT=3333
DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/tcc_chat?schema=public"
GEMINI_API_KEY="SUA_CHAVE_AQUI"
```

---

## Banco de Dados

O projeto utiliza PostgreSQL com a extensão pgvector para armazenar os embeddings dos documentos.

1. Suba o banco de dados via Docker:
   ```bash
   docker-compose up -d
   ```

2. Execute as migracões do Prisma:
   ```bash
   npm run prisma:migrate
   ```

3. Gere o cliente do Prisma:
   ```bash
   npm run prisma:generate
   ```

---

## Scripts de Ingestao e Scraping

O sistema possui scripts para alimentar o banco de dados com informações que servirão de base para o chat.

- Scraping de dados: Coleta informações de uma URL e salva em arquivo Markdown local.
  ```bash
  npm run scrape <URL>
  ```

- Ingestao de dados (Remoto): Processa uma URL via Jina Reader e gera embeddings diretamente no banco.
  ```bash
  npm run ingest <URL>
  ```

- Ingestao de dados (Local): Processa arquivos Markdown da pasta `src/data` e gera embeddings.
  ```bash
  npm run ingest:local
  ```

- Ingestao de todos os dados:
  ```bash
  npm run ingest:all
  ```

---

## Rodando a Aplicacao

### Modo de Desenvolvimento
```bash
npm run dev
```
O servidor iniciará por padrão em http://localhost:3333.

### Modo de Produção
1. Gere o build:
   ```bash
   npm run build
   ```
2. Inicie o servidor:
   ```bash
   npm run start
   ```

---

## API Endpoints

### Autenticacao
- POST /register: Criar um novo usuário.
- POST /login: Autenticar um usuário.

### Chat
- POST /chat: Enviar uma mensagem e receber resposta da IA.
- GET /chats: Listar todos os chats do usuário.
- GET /chat/:id: Obter o histórico de um chat específico.
- DELETE /chat/:id: Deletar um chat.

---

## Qualidade de Codigo

O projeto utiliza o Biome para linting e formatação:
- npm run lint: Verifica erros de lint.
- npm run format: Formata o código automaticamente.
- npm run check: Lint e format com correção automática.

---

## Docker (Opcional)

Se desejar rodar toda a aplicação via Docker:
```bash
docker-compose up --build
```
Isso subirá tanto o banco de dados quanto a aplicação Node.js.
