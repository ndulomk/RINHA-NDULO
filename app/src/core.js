import { v4 as uuidv4, validate as isValidUUID } from 'uuid';

class PaymentRequest {
  constructor(correlationId, amount, requestedAt = null) {
    this.correlationId = correlationId;
    this.amount = amount;
    this.requestedAt = requestedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      correlationId: this.correlationId,
      amount: this.amount,
      requestedAt: this.requestedAt
    };
  }
}

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

function parseAndValidatePayment(jsonString) {
  try {
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    
    if (!data.correlationId) {
      return { 
        value: null, 
        error: new ValidationError("correlationId is required", "correlationId") 
      };
    }

    if (typeof data.correlationId !== 'string') {
      return { 
        value: null, 
        error: new ValidationError("correlationId must be a string", "correlationId") 
      };
    }

    if (!isValidUUID(data.correlationId)) {
      return { 
        value: null, 
        error: new ValidationError("correlationId must be a valid UUID", "correlationId") 
      };
    }
    if (data.amount === null || data.amount === undefined) {
      return { 
        value: null, 
        error: new ValidationError("amount is required", "amount") 
      };
    }

    const amount = parseFloat(data.amount);
    if (isNaN(amount)) {
      return { 
        value: null, 
        error: new ValidationError("amount must be a valid number", "amount") 
      };
    }

    if (amount <= 0) {
      return { 
        value: null, 
        error: new ValidationError("amount must be greater than 0", "amount") 
      };
    }

    if (amount > 999999999.99) {
      return { 
        value: null, 
        error: new ValidationError("amount is too large", "amount") 
      };
    }

    let requestedAt = null;
    if (data.requestedAt) {
      const date = new Date(data.requestedAt);
      if (isNaN(date.getTime())) {
        return { 
          value: null, 
          error: new ValidationError("requestedAt must be a valid ISO timestamp", "requestedAt") 
        };
      }
      requestedAt = date.toISOString();
    }

    const payment = new PaymentRequest(
      data.correlationId,
      Math.round(amount * 100) / 100,
      requestedAt
    );

    return { value: payment, error: null };

  } catch (parseError) {
    return { 
      value: null, 
      error: new ValidationError("Invalid JSON format", "json") 
    };
  }
}

function generateUUID() {
  return uuidv4();
}

function isValidTimestamp(timestamp) {
  if (!timestamp) return true; 
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

function formatAmount(amount) {
  return Math.round(amount * 100) / 100;
}

function createTestPayment(amount = 19.90) {
  return new PaymentRequest(generateUUID(), amount);
}

export { 
  PaymentRequest, 
  ValidationError,
  parseAndValidatePayment, 
  generateUUID,
  isValidTimestamp,
  formatAmount,
  createTestPayment
};