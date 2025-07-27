import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

// Mock all dependencies
vi.mock('../src/worker.js', () => ({
  NewWorkerPool: vi.fn(() => ({
    start: vi.fn(),
    enqueue: vi.fn().mockReturnValue(true),
  })),
}));

vi.mock('../src/core.js', () => ({
  parseAndValidatePayment: vi.fn(),
}));

vi.mock('../src/store.js', () => ({
  summaryFromDB: vi.fn(),
}));

vi.mock('../src/config.js', () => ({
  config: {
    enableRequestLogging: false,
    isDevelopment: true
  },
  getEnv: vi.fn().mockImplementation((key, fallback) => fallback),
}));

import { registerRoutes } from '../src/api.js';
import { config } from '../src/config.js';

describe('Fastify App', () => {
  let fastify;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create Fastify instance similar to the main app
    fastify = Fastify({
      logger: config.enableRequestLogging ? {
        transport: {
          target: 'pino-pretty'
        }
      } : false,
      bodyLimit: 1048576, // 1MB in bytes
    });

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

    // Add test route that throws an error for testing error handling
    fastify.get('/test-error', async (request, reply) => {
      throw new Error('Test error');
    });
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should respond to health check', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
    });
  });

  it('should handle 404 for unknown routes', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/unknown'
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.payload)).toEqual({ error: 'Not Found' });
  });

  it('should handle uncaught errors in development', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/test-error'
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body).toEqual({
      error: 'Internal Server Error',
      details: 'Test error',
    });
  });

  it('should set custom headers', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.headers['x-powered-by']).toBe('Rinha-Backend-2025');
  });

  it('should handle JSON body parsing', async () => {
    // Mock the parseAndValidatePayment to return success
    const { parseAndValidatePayment } = await import('../src/core.js');
    parseAndValidatePayment.mockReturnValue({
      value: { correlationId: '123e4567-e89b-12d3-a456-426614174000', amount: 19.90 },
      error: null,
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/payments',
      payload: { correlationId: '123e4567-e89b-12d3-a456-426614174000', amount: 19.90 },
      headers: {
        'content-type': 'application/json'
      }
    });

    expect(response.statusCode).toBe(202);
  });

  it('should handle large payloads within limit', async () => {
    const { parseAndValidatePayment } = await import('../src/core.js');
    parseAndValidatePayment.mockReturnValue({
      value: { correlationId: '123e4567-e89b-12d3-a456-426614174000', amount: 19.90 },
      error: null,
    });

    // Create a payload that's under 1MB
    const largePayload = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      amount: 19.90,
      description: 'x'.repeat(1000) // 1KB description
    };

    const response = await fastify.inject({
      method: 'POST',
      url: '/payments',
      payload: largePayload,
      headers: {
        'content-type': 'application/json'
      }
    });

    expect(response.statusCode).toBe(202);
  });

  it('should reject payloads over 1MB limit', async () => {
    // Create a payload over 1MB
    const oversizedPayload = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      amount: 19.90,
      description: 'x'.repeat(1048577) // Over 1MB
    };

    const response = await fastify.inject({
      method: 'POST',
      url: '/payments',
      payload: oversizedPayload,
      headers: {
        'content-type': 'application/json'
      }
    });

    expect(response.statusCode).toBe(413); // Payload Too Large
  });
});