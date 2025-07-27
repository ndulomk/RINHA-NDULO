import { describe, it, expect } from 'vitest';
import { parseAndValidatePayment, PaymentRequest, ValidationError } from '../src/core.js';

describe('Core', () => {
  it('should validate and parse valid payment', () => {
    const input = {
      correlationId: '123e4567-e89b-12d3-a456-426614174000',
      amount: 19.90,
      requestedAt: '2023-01-01T00:00:00Z',
    };
    const result = parseAndValidatePayment(JSON.stringify(input));
    expect(result.error).toBeNull();
    expect(result.value).toBeInstanceOf(PaymentRequest);
    expect(result.value.amount).toBe(19.90);
  });

  it('should reject invalid UUID', () => {
    const input = { correlationId: 'invalid-uuid', amount: 19.90 };
    const result = parseAndValidatePayment(JSON.stringify(input));
    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error.message).toBe('correlationId must be a valid UUID');
  });
});
