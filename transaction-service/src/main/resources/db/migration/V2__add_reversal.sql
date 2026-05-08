ALTER TABLE transactions ADD COLUMN reverses_transaction_id UUID NULL;

ALTER TABLE transactions
    ADD CONSTRAINT fk_transactions_reverses
    FOREIGN KEY (reverses_transaction_id) REFERENCES transactions(id);

-- Enforces at most one reversal per original at the DB level.
-- A partial unique index (WHERE NOT NULL) avoids index bloat on the common case
-- of rows that are not reversals.
CREATE UNIQUE INDEX uq_one_reversal_per_tx
    ON transactions(reverses_transaction_id)
    WHERE reverses_transaction_id IS NOT NULL;
