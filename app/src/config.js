import dotenv from "dotenv";

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

function getEnv(key, fallback = "") {
  const value = process.env[key];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return value;
}

function getEnvInt(key, fallback = 0) {
  const value = getEnv(key);
  if (!value) return fallback;
  
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function getEnvBool(key, fallback = false) {
  const value = getEnv(key).toLowerCase();
  if (!value) return fallback;
  
  return value === 'true' || value === '1' || value === 'yes' || value === 'on';
}

// Configurações da aplicação
export const config = {
  // Server
  port: getEnvInt('PORT', 9999),
  host: getEnv('HOST', '0.0.0.0'),
  
  // Database
  databaseUrl: getEnv('DATABASE_URL', 'postgres://rinha:rinha123@localhost:5432/rinha'),
  
  // Payment Processors
  defaultProcessorUrl: getEnv('PAYMENT_PROCESSOR_URL_DEFAULT', 'http://localhost:8001'),
  fallbackProcessorUrl: getEnv('PAYMENT_PROCESSOR_URL_FALLBACK', 'http://localhost:8002'),
  
  // Workers
  workers: getEnvInt('WORKERS', 4),
  queueSize: getEnvInt('QUEUE_SIZE', 1000),
  
  // Timeouts e retry
  requestTimeout: getEnvInt('REQUEST_TIMEOUT', 10000),
  healthCheckInterval: getEnvInt('HEALTH_CHECK_INTERVAL', 5000),
  maxRetries: getEnvInt('MAX_RETRIES', 3),
  
  // Environment
  nodeEnv: getEnv('NODE_ENV', 'development'),
  isProduction: getEnv('NODE_ENV') === 'production',
  isDevelopment: getEnv('NODE_ENV') === 'development',
  
  // Logging
  enableRequestLogging: getEnvBool('ENABLE_REQUEST_LOGGING', false)
};

export { getEnv, getEnvInt, getEnvBool };