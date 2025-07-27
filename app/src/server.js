import Fastify from 'fastify';
import { registerRoutes } from './api.js';
import { config } from './config.js';

const fastify = Fastify({
  logger: config.enableRequestLogging ? {
    transport: {
      target: 'pino-pretty'
    }
  } : false,
  bodyLimit: 1048576,
});

// JSON parsing is enabled by default in Fastify
// Content-Type headers are handled automatically

// Custom headers hook
fastify.addHook('onSend', async (request, reply, payload) => {
  reply.header('Content-Type', 'application/json; charset=utf-8');
  reply.header('X-Powered-By', 'Rinha-Backend-2025');
  return payload;
});

// Register application routes
await registerRoutes(fastify);

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  console.error('Unhandled error:', error.message);
  console.error(error.stack);
  
  // Handle Payload Too Large error
  if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE' || error.message === 'Request body is too large') {
    return reply.status(413).send({ error: 'Payload Too Large' });
  }
  
  reply.status(500).send({ 
    error: 'Internal Server Error',
    ...(config.isDevelopment && { details: error.message })
  });
});

// 404 handler
fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({ error: 'Not Found' });
});

const start = async () => {
  try {
    await fastify.listen({ port: 9999, host: '0.0.0.0' });
    console.log('Server running on port 9999');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();