import { parseAndValidatePayment } from './core.js';
import { NewWorkerPool } from './worker.js';
import { summaryFromDB } from './store.js';
import { getEnv } from './config.js';

const defaultURL = getEnv('PAYMENT_PROCESSOR_URL_DEFAULT', 'http://localhost:8001');
const fallbackURL = getEnv('PAYMENT_PROCESSOR_URL_FALLBACK', 'http://localhost:8002');
const workers = parseInt(getEnv('WORKERS', '4'), 10);

console.log('Default Processor URL:', defaultURL);
console.log('Fallback Processor URL:', fallbackURL);
console.log('Workers:', workers);

if (isNaN(workers) || workers <= 0) {
    console.error('Invalid number of workers');
    process.exit(1);
}

let pool;

function initializePool() {
    if (!pool) {
        try {
            pool = NewWorkerPool(workers, defaultURL, fallbackURL);
            pool.start();
        } catch (error) {
            console.error('Failed to initialize WorkerPool:', error.message);
            process.exit(1);
        }
    }
    return pool;
}

// Schema definitions for validation
const paymentSchema = {
    type: 'object',
    required: ['correlationId', 'amount'],
    properties: {
        correlationId: { type: 'string', format: 'uuid' },
        amount: { type: 'number', minimum: 0.01 },
        requestedAt: { type: 'string', format: 'date-time' }
    },
    additionalProperties: false
};

const summaryQuerySchema = {
    type: 'object',
    properties: {
        from: { type: 'string' },
        to: { type: 'string' }
    }
};

// Função auxiliar para processar summary
async function getPaymentSummary(request, reply) {
    const { from: fromStr, to: toStr } = request.query;
    let from = null;
    let to = null;

    if (fromStr) {
        const parsed = new Date(fromStr);
        if (!isNaN(parsed.getTime())) from = parsed;
    }

    if (toStr) {
        const parsed = new Date(toStr);
        if (!isNaN(parsed.getTime())) to = parsed;
    }

    try {
        const summary = await summaryFromDB(from, to);
        reply.status(200).send({
            totalRequests: summary.totalRequests,
            totalAmount: summary.totalAmount,
        });
    } catch (error) {
        console.error('Error fetching payment summary:', error.message);
        reply.status(500).send({ error: 'Failed to fetch payment summary' });
    }
}

export async function registerRoutes(fastify) {
    // Initialize pool lazily when routes are registered
    const workerPool = initializePool();

    // POST /payments
    fastify.post('/payments', async (request, reply) => {
        const body = request.body;
        const { value: payment, error } = parseAndValidatePayment(JSON.stringify(body));

        if (error) {
            return reply.status(400).send({ error: error.message });
        }

        try {
            const success = workerPool.enqueue(payment);
            if (!success) {
                return reply.status(503).send({ error: 'queue full' });
            }
            reply.status(202).send({ status: 'accepted' });
        } catch (err) {
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // GET /payments-summary
    fastify.get('/payments-summary', {
        schema: {
            querystring: summaryQuerySchema
        }
    }, getPaymentSummary);

    // GET /admin/payments-summary 
    fastify.get('/admin/payments-summary', {
        schema: {
            querystring: summaryQuerySchema
        }
    }, getPaymentSummary);

    // GET /health
    fastify.get('/health', async (request, reply) => {
        reply.status(200).send({
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    });
}