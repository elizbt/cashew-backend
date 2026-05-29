# Design Doc: Chatbot de Assistência Estudantil - IFNMG Araçuaí (TADS)

**Data:** 2026-05-15  
**Status:** Draft  
**Autor:** Gemini CLI  

## 1. Objetivo
Criar o esqueleto inicial de um chatbot especializado para o curso de Tecnologia em Análise e Desenvolvimento de Sistemas (TADS) do IFNMG - Campus Araçuaí. O sistema deve responder dúvidas institucionais e de editais, com um fallback robusto para contatos humanos.

## 2. Tecnologias
- **Runtime:** Node.js (v20+)
- **Framework:** Fastify (Agilidade e performance)
- **Linguagem:** TypeScript (Segurança de tipos)
- **ORM:** Prisma com PostgreSQL (Persistência)
- **Validação:** Zod (Type-safety em runtime)
- **IA:** Google Generative AI SDK (Gemini Pro)
- **Infra:** Docker & Docker Compose

## 3. Arquitetura (Camadas)
- `src/controllers`: Gerenciamento de requisições e respostas.
- `src/services`: Integração com Gemini e lógica de fallback.
- `src/schemas`: Contratos de dados com Zod.
- `src/routes`: Endpoints da API.
- `src/lib`: Clientes singleton (Prisma, Gemini).

## 4. Modelo de Dados (Prisma)
- **`Chat`**: `id, createdAt, title`
- **`Message`**: `id, chatId, role (user/model), content, createdAt`
- **`UnansweredQuestion`**: `id, content, createdAt, status`
- **`Department`**: `id, name, email, phone, description`

## 5. Fluxo de Exceção e IA
- **System Prompt:** Rígido, focado em TADS e IFNMG Araçuaí.
- **Trigger de Fallback:** Identificação de frases de incerteza da IA ou detecção de fora de escopo.
- **Ação:** Gravar pergunta na tabela `UnansweredQuestion` e retornar lista de `Department` do banco.

## 6. Endpoints
- `POST /chat`: Envio de mensagens.
- `GET /departments`: Consulta de setores (para o frontend/fallback).

## 7. Infraestrutura
- `Dockerfile`: Multi-stage build para otimização.
- `docker-compose`: Orquestração de App + DB PostgreSQL.
