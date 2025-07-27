import { describe, it, expect, vi } from 'vitest';
import { PaymentClient } from '../src/client.js';
import { PaymentRequest } from '../src/core.js'; 
import http from 'http';

vi.mock('http');

describe('PaymentClient', () => {
  let client; // Declare client here to recreate it each time

  beforeEach(() => {
    vi.clearAllMocks();
    // Recreate client instance to ensure clean state
    client = new PaymentClient('http://localhost:8001', 'http://localhost:8002');
    client.defaultUp = true;
    client.lastCheck = null;
    client.consecutiveFailures = 0;
  });

  it('should send payment to default processor', async () => {
    const payment = new PaymentRequest('123e4567-e89b-12d3-a456-426614174000', 19.90);
    vi.spyOn(client, 'checkDefaultHealth').mockResolvedValue(true);
    vi.mocked(http.request).mockImplementation((url, options, callback) => {
      const res = {
        statusCode: 200,
        on: vi.fn().mockImplementation((event, handler) => {
          if (event === 'data') handler('{}');
          if (event === 'end') handler();
        }),
      };
      callback(res);
      return { write: vi.fn(), end: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn() };
    });

    await expect(client.sendToDefault(payment)).resolves.toBe('{}');
  });

  it('should handle health check failure', async () => {
    vi.spyOn(client, 'performHealthCheck').mockRejectedValue(new Error('Health check failed'));
    console.log('Before checkDefaultHealth:', {
      defaultUp: client.defaultUp,
      lastCheck: client.lastCheck,
      consecutiveFailures: client.consecutiveFailures
    });
    const result = await client.checkDefaultHealth();
    console.log('After checkDefaultHealth:', {
      result,
      defaultUp: client.defaultUp,
      consecutiveFailures: client.consecutiveFailures
    });
    expect(result).toBe(false);
    expect(client.defaultUp).toBe(false);
    expect(client.consecutiveFailures).toBe(1);
  });
});