import pkg from 'pg';
import { getEnv } from './config.js';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: getEnv('DATABASE_URL', 'postgres://rinha:rinha123@localhost:5432/rinha'),
  max: 20, 
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
});

class Summary {
  constructor(totalRequests = 0, totalAmount = 0) {
    this.totalRequests = totalRequests;
    this.totalAmount = totalAmount;
  }
}

async function addPaymentToFile(payment, processor = 'unknown') {
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `INSERT INTO payments (correlationId, amount, requested_at, processor) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (correlationId) DO UPDATE SET processor = $4`,
      [payment.correlationId, payment.amount, payment.requestedAt, processor]
    );
  } catch (error) {
    console.error(`Failed to insert payment: ${error.message}`);
    throw error;
  } finally {
    if (client) client.release();
  }
}

async function summaryFromFile(from, to) {
  let client;
  try {
    client = await pool.connect();
    
    let defaultQuery = `SELECT COUNT(*) as total_requests, COALESCE(SUM(amount), 0) as total_amount 
                        FROM payments WHERE processor = 'default'`;
    const defaultParams = [];
    
    if (from) {
      defaultQuery += ` AND requested_at >= $${defaultParams.length + 1}`;
      defaultParams.push(from);
    }
    if (to) {
      defaultQuery += ` AND requested_at <= $${defaultParams.length + 1}`;
      defaultParams.push(to);
    }
    
    let fallbackQuery = `SELECT COUNT(*) as total_requests, COALESCE(SUM(amount), 0) as total_amount 
                         FROM payments WHERE processor = 'fallback'`;
    const fallbackParams = [];
    
    if (from) {
      fallbackQuery += ` AND requested_at >= $${fallbackParams.length + 1}`;
      fallbackParams.push(from);
    }
    if (to) {
      fallbackQuery += ` AND requested_at <= $${fallbackParams.length + 1}`;
      fallbackParams.push(to);
    }
    
    const [defaultResult, fallbackResult] = await Promise.all([
      client.query(defaultQuery, defaultParams),
      client.query(fallbackQuery, fallbackParams)
    ]);
    
    return {
      default: new Summary(
        parseInt(defaultResult.rows[0].total_requests),
        parseFloat(defaultResult.rows[0].total_amount)
      ),
      fallback: new Summary(
        parseInt(fallbackResult.rows[0].total_requests),
        parseFloat(fallbackResult.rows[0].total_amount)
      )
    };
    
  } catch (error) {
    console.error(`Failed to query summary: ${error.message}`);
    return {
      default: new Summary(0, 0),
      fallback: new Summary(0, 0)
    };
  } finally {
    if (client) client.release();
  }
}

const summaryFromDB = summaryFromFile;

export { addPaymentToFile, summaryFromFile, summaryFromDB, Summary };