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

async function addPaymentToFile(payment) {
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `INSERT INTO payments (correlationId, amount, requested_at) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (correlationId) DO NOTHING`,
      [payment.correlationId, payment.amount, payment.requestedAt]
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
    let query = `SELECT COUNT(*) as total_requests, COALESCE(SUM(amount), 0) as total_amount FROM payments`;
    const params = [];
    if (from) {
      query += ` WHERE requested_at >= $${params.length + 1}`;
      params.push(from);
    }
    if (to) {
      query += `${from ? ' AND' : ' WHERE'} requested_at <= $${params.length + 1}`;
      params.push(to);
    }
    const result = await client.query(query, params);
    if (result.rows.length === 0) {
      return new Summary(0, 0); 
    }
    return new Summary(
      parseInt(result.rows[0].total_requests),
      parseFloat(result.rows[0].total_amount)
    );
  } catch (error) {
    console.error(`Failed to query summary: ${error.message}`);
    return new Summary(0, 0); 
  } finally {
    if (client) client.release();
  }
}

const summaryFromDB = summaryFromFile;

export { addPaymentToFile, summaryFromFile, summaryFromDB, Summary };