import fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from '@/config/env.js';
import { chatRoutes } from '@/routes/chat.routes.js';

const app = fastify({ logger: true });

app.register(cors, {
  origin: '*',
});

app.register(chatRoutes);

app.get('/health', async () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 Server ready at http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
