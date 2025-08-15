CREATE UNLOGGED TABLE payments (
    correlationId UUID PRIMARY KEY,
    amount DECIMAL NOT NULL,
    requested_at TIMESTAMP NOT NULL,
    processor VARCHAR(20) DEFAULT 'unknown'
);

CREATE INDEX payments_requested_at ON payments (requested_at);
CREATE INDEX payments_processor ON payments (processor);