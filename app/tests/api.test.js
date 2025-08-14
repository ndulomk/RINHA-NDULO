import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

// Create a mock pool that we can control globally
let mockPool = {
  enqueue: vi.fn().mockReturnValue(true),
  start: vi.fn(),
};

// First, mock all dependencies properly
vi.mock('../src/worker.js', () => ({
  NewWorkerPool: vi.fn(() => mockPool),
}));

vi.mock('../src/core.js', () => ({
  parseAndValidatePayment: vi.fn(),
}));

vi.mock('../src/store.js', () => ({
  summaryFromDB: vi.fn(),
}));

vi.mock('../src/config.js', () => ({
  getEnv: vi.fn().mockImplementation((key, fallback) => fallback),
}));

// Mock process.exit to prevent test termination
vi.mock('process', () => ({
  exit: vi.fn(),
}));

// Import the mocked functions
import { NewWorkerPool } from '../src/worker.js';
import { parseAndValidatePayment } from '../src/core.js';
import { summaryFromDB } from '../src/store.js';

// Now import the registerRoutes function after all mocks are set up
import { registerRoutes } from '../src/api.js';

describe('API Routes', () => {
  let fastify;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset the mock pool to default behavior
    mockPool.enqueue.mockReturnValue(true);
    mockPool.start.mockImplementation(() => {});

    // Create a new Fastify instance for each test
    fastify = Fastify({
      logger: false // Disable logging in tests
    });

    // Register routes
    await registerRoutes(fastify);
  });

  afterEach(async () => {
    // Clean up after each test
    await fastify.close();
  });

  it('POST /payments should accept valid payment', async () => {
    parseAndValidatePayment.mockReturnValue({
      value: { correlationId: '123e4567-e89b-12d3-a456-426614174000', amount: 19.90 },
      error: null,
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/payments',
      payload: { correlationId: '123e4567-e89b-12d3-a456-426614174000', amount: 19.90 }
    });

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.payload)).toEqual({ status: 'accepted' });
  });

  it('POST /payments should reject invalid payment', async () => {
    parseAndValidatePayment.mockReturnValue({
      value: null,
      error: new Error('Invalid UUID'),
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/payments',
      payload: { correlationId: 'invalid-uuid', amount: 19.90 }
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toEqual({ error: 'Invalid UUID' });
  });

  it('POST /payments should return queue full when enqueue fails', async () => {
    parseAndValidatePayment.mockReturnValue({
      value: { correlationId: '123e4567-e89b-12d3-a456-426614174000', amount: 19.90 },
      error: null,
    });

    // Set the mock to return false for queue full scenario
    mockPool.enqueue.mockReturnValue(false);

    const response = await fastify.inject({
      method: 'POST',
      url: '/payments',
      payload: { correlationId: '123e4567-e89b-12d3-a456-426614174000', amount: 19.90 }
    });

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.payload)).toEqual({ error: 'queue full' });
  });

  it('GET /payments-summary should return summary', async () => {
    summaryFromDB.mockResolvedValue({
      totalRequests: 15,
      totalAmount: 150.75,
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/payments-summary?from=2023-01-01&to=2023-12-31'
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      totalRequests: 15,
      totalAmount: 150.75,
    });
  });

  it('GET /payments-summary should handle database errors', async () => {
    summaryFromDB.mockRejectedValue(new Error('Database connection failed'));

    const response = await fastify.inject({
      method: 'GET',
      url: '/payments-summary'
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.payload)).toEqual({ 
      error: 'Failed to fetch payment summary' 
    });
  });

  it('GET /payments-summary should work without query parameters', async () => {
    summaryFromDB.mockResolvedValue({
      totalRequests: 10,
      totalAmount: 100.50,
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/payments-summary'
    });

    expect(response.statusCode).toBe(200);
    expect(summaryFromDB).toHaveBeenCalledWith(null, null);
  });

  it('GET /health should return health status', async () => {
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
});