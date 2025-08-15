import { PaymentClient } from './client.js';
import { addPaymentToFile } from './store.js';
import { getEnv } from './config.js';

class WorkerPool {
  constructor(size, defaultURL, fallbackURL) {
    this.queue = [];
    this.workers = size;
    this.client = new PaymentClient(defaultURL, fallbackURL);
    this.queueSize = parseInt(getEnv('QUEUE_SIZE', '1000'), 10);
    this.processing = new Set();
    this.totalProcessed = 0;
  }

  start() {
    console.log(`Starting ${this.workers} workers...`);
    for (let i = 0; i < this.workers; i++) {
      this.worker(i);
    }
  }

  enqueue(payment) {
    if (this.queue.length >= this.queueSize) {
      console.log('Queue full, payment rejected');
      return false;
    }
    
    if (!payment.requestedAt) {
      payment.requestedAt = new Date().toISOString();
    }
    
    this.queue.push(payment);
    return true;
  }

  async worker(workerId) {
    console.log(`Worker ${workerId} started`);
    
    while (true) {
      if (this.queue.length > 0) {
        const payment = this.queue.shift();
        if (payment) {
          await this.processPayment(payment, workerId);
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }
  }

async processPayment(payment, workerId) {
  const startTime = Date.now();
  let defaultError = null; 
  let processor = 'unknown';
  
  try {
    try {
      await this.client.sendToDefault(payment);
      processor = 'default';
      await addPaymentToFile(payment, processor);
      this.totalProcessed++;
      const duration = Date.now() - startTime;
      if (duration > 100) {
        console.log(`Worker ${workerId}: Payment processed via default in ${duration}ms`);
      }
      return;
    } catch (err) {
      defaultError = err; 
      if (defaultError.message.includes('409') || defaultError.message.includes('422')) {
        console.log(`Worker ${workerId}: Payment validation error: ${defaultError.message}`);
        return;
      }
      console.log(`Worker ${workerId}: Default failed (${defaultError.message}), trying fallback...`);
    }
    
    try {
      await this.client.sendToFallback(payment);
      processor = 'fallback';
      await addPaymentToFile(payment, processor);
      this.totalProcessed++;
      const duration = Date.now() - startTime;
      console.log(`Worker ${workerId}: Payment processed via fallback in ${duration}ms`);
    } catch (fallbackError) {
      console.error(`Worker ${workerId}: Both processors failed for payment ${payment.correlationId}`);
      console.error(`Default error: ${defaultError?.message || 'Unknown'}`);
      console.error(`Fallback error: ${fallbackError.message}`);
      try {
        await addPaymentToFile(payment, 'failed');
      } catch (storeError) {
        console.error(`Worker ${workerId}: Failed to store unprocessed payment: ${storeError.message}`);
      }
    }
  } catch (error) {
    console.error(`Worker ${workerId}: Unexpected error processing payment: ${error.message}`);
  }
}

  getStats() {
    return {
      queueLength: this.queue.length,
      totalProcessed: this.totalProcessed,
      queueSize: this.queueSize,
      workers: this.workers,
      clientStats: this.client.getStats(),
    };
  }
}

function NewWorkerPool(size, defaultURL, fallbackURL) {
  return new WorkerPool(size, defaultURL, fallbackURL);
}

export { WorkerPool, NewWorkerPool };