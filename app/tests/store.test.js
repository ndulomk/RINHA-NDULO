import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// Mocks globais
const mockClient = {
  query: vi.fn(),
  release: vi.fn()
};

const mockPool = {
  connect: vi.fn(() => Promise.resolve(mockClient))
};

const mockPoolConstructor = vi.fn(() => mockPool);

// Mock do config antes de qualquer importação
vi.mock('../src/config.js', () => ({
  getEnv: vi.fn((key, defaultValue) => defaultValue)
}));

// Mock do pg com factory function
vi.mock('pg', () => ({
  default: {
    Pool: mockPoolConstructor
  }
}));

describe('Database Module Tests', () => {
  let addPaymentToFile, summaryFromFile, summaryFromDB, Summary;

  beforeAll(async () => {
    // Importação dinâmica após os mocks estarem configurados
    const module = await import('../src/store.js');
    addPaymentToFile = module.addPaymentToFile;
    summaryFromFile = module.summaryFromFile;
    summaryFromDB = module.summaryFromDB;
    Summary = module.Summary;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    // Reset client mocks to default behavior
    mockClient.query.mockResolvedValue({});
    mockClient.release.mockImplementation(() => {});
  });

  describe('Summary Class', () => {
    it('should create Summary with default values', () => {
      const summary = new Summary();
      
      expect(summary.totalRequests).toBe(0);
      expect(summary.totalAmount).toBe(0);
    });

    it('should create Summary with provided values', () => {
      const summary = new Summary(10, 500.50);
      
      expect(summary.totalRequests).toBe(10);
      expect(summary.totalAmount).toBe(500.50);
    });
  });

  describe('addPaymentToFile', () => {
    it('should successfully insert a payment', async () => {
      const payment = {
        correlationId: 'test-123',
        amount: 100.50,
        requestedAt: new Date('2024-01-01T10:00:00Z')
      };

      mockClient.query.mockResolvedValue({});

      await addPaymentToFile(payment);

      expect(mockPool.connect).toHaveBeenCalledOnce();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payments (correlationId, amount, requested_at)'),
        [payment.correlationId, payment.amount, payment.requestedAt]
      );
      expect(mockClient.release).toHaveBeenCalledOnce();
    });

    it('should handle database connection error', async () => {
      const payment = {
        correlationId: 'test-123',
        amount: 100.50,
        requestedAt: new Date('2024-01-01T10:00:00Z')
      };

      const connectionError = new Error('Connection failed');
      mockPool.connect.mockRejectedValue(connectionError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(addPaymentToFile(payment)).rejects.toThrow('Connection failed');
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to insert payment: Connection failed');
      
      consoleSpy.mockRestore();
    });

    it('should handle query error and release client', async () => {
      const payment = {
        correlationId: 'test-123',
        amount: 100.50,
        requestedAt: new Date('2024-01-01T10:00:00Z')
      };

      const queryError = new Error('Query failed');
      mockClient.query.mockRejectedValue(queryError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(addPaymentToFile(payment)).rejects.toThrow('Query failed');
      
      expect(mockClient.release).toHaveBeenCalledOnce();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to insert payment: Query failed');
      
      consoleSpy.mockRestore();
    });

    it('should release client even if client.release throws', async () => {
      const payment = {
        correlationId: 'test-123',
        amount: 100.50,
        requestedAt: new Date('2024-01-01T10:00:00Z')
      };

      mockClient.query.mockResolvedValue({});
      mockClient.release.mockImplementation(() => {
        throw new Error('Release failed');
      });

      // O código original não captura erros do release, então vai lançar o erro
      await expect(addPaymentToFile(payment)).rejects.toThrow('Release failed');
    });
  });

  describe('summaryFromFile', () => {
    it('should return summary without date filters', async () => {
      const mockResult = {
        rows: [{
          total_requests: '5',
          total_amount: '250.75'
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await summaryFromFile();

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as total_requests, COALESCE(SUM(amount), 0) as total_amount'),
        []
      );
      expect(result).toBeInstanceOf(Summary);
      expect(result.totalRequests).toBe(5);
      expect(result.totalAmount).toBe(250.75);
      expect(mockClient.release).toHaveBeenCalledOnce();
    });

    it('should return summary with from date filter', async () => {
      const mockResult = {
        rows: [{
          total_requests: '3',
          total_amount: '150.25'
        }]
      };

      const fromDate = new Date('2024-01-01');
      mockClient.query.mockResolvedValue(mockResult);

      const result = await summaryFromFile(fromDate);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE requested_at >= $1'),
        [fromDate]
      );
      expect(result.totalRequests).toBe(3);
      expect(result.totalAmount).toBe(150.25);
    });

    it('should return summary with to date filter', async () => {
      const mockResult = {
        rows: [{
          total_requests: '2',
          total_amount: '100.50'
        }]
      };

      const toDate = new Date('2024-12-31');
      mockClient.query.mockResolvedValue(mockResult);

      const result = await summaryFromFile(null, toDate);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE requested_at <= $1'),
        [toDate]
      );
      expect(result.totalRequests).toBe(2);
      expect(result.totalAmount).toBe(100.50);
    });

    it('should return summary with both date filters', async () => {
      const mockResult = {
        rows: [{
          total_requests: '4',
          total_amount: '200.00'
        }]
      };

      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-12-31');
      mockClient.query.mockResolvedValue(mockResult);

      const result = await summaryFromFile(fromDate, toDate);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE requested_at >= $1 AND requested_at <= $2'),
        [fromDate, toDate]
      );
      expect(result.totalRequests).toBe(4);
      expect(result.totalAmount).toBe(200.00);
    });

    it('should handle query error and return default Summary', async () => {
      const queryError = new Error('Query failed');
      mockClient.query.mockRejectedValue(queryError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await summaryFromFile();

      expect(result).toBeInstanceOf(Summary);
      expect(result.totalRequests).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to query summary: Query failed');
      expect(mockClient.release).toHaveBeenCalledOnce();
      
      consoleSpy.mockRestore();
    });

    it('should handle connection error and return default Summary', async () => {
      const connectionError = new Error('Connection failed');
      mockPool.connect.mockRejectedValue(connectionError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await summaryFromFile();

      expect(result).toBeInstanceOf(Summary);
      expect(result.totalRequests).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to query summary: Connection failed');
      
      consoleSpy.mockRestore();
    });

    it('should handle null values in database result', async () => {
      const mockResult = {
        rows: [{
          total_requests: null,
          total_amount: null
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await summaryFromFile();

      expect(result.totalRequests).toBeNaN(); // parseInt(null) = NaN
      expect(result.totalAmount).toBeNaN(); // parseFloat(null) = NaN
    });
  });

  describe('summaryFromDB', () => {
    it('should be an alias for summaryFromFile', () => {
      expect(summaryFromDB).toBe(summaryFromFile);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle edge case with empty result set', async () => {
      const mockResult = {
        rows: [{
          total_requests: '0',
          total_amount: '0'
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await summaryFromFile();

      expect(result.totalRequests).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('should handle large numbers correctly', async () => {
      const mockResult = {
        rows: [{
          total_requests: '999999',
          total_amount: '123456789.99'
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      const result = await summaryFromFile();

      expect(result.totalRequests).toBe(999999);
      expect(result.totalAmount).toBe(123456789.99);
    });
  });
});