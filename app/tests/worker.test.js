import { describe, it, expect, vi } from 'vitest';
import { WorkerPool, NewWorkerPool } from '../src/worker.js';
import { PaymentClient } from '../src/client.js';
import { addPaymentToFile } from '../src/store.js';

vi.mock('../src/client.js');
vi.mock('../src/store.js');

describe('WorkerPool', () => {
  const pool = NewWorkerPool(2, 'http://localhost:8001', 'http://localhost:8002');

  it('should enqueue payment', () => {
    const payment = { correlationId: '123e4567-e89b-12d3-a456-426614174000', amount: 19.90 };
    expect(pool.enqueue(payment)).toBe(true);
    expect(pool.queue).toContain(payment);
  });

  it('should reject payment when queue is full', () => {
    pool.queueSize = 1;
    pool.queue = [{}];
    const payment = { correlationId: '123e4567-e89b-12d3-a456-426614174000', amount: 19.90 };
    expect(pool.enqueue(payment)).toBe(false);
  });

  it('should process payment via default processor', async () => {
    vi.spyOn(pool.client, 'sendToDefault').mockResolvedValue('{}');
    vi.spyOn(pool.client, 'sendToFallback').mockResolvedValue('{}');
    vi.mocked(addPaymentToFile).mockResolvedValue();

    const payment = { correlationId: '123e4567-e89b-12d3-a456-426614174000', amount: 19.90 };
    await pool.processPayment(payment, 1);
    expect(pool.totalProcessed).toBe(1);
    expect(addPaymentToFile).toHaveBeenCalledWith(payment);
  });
});